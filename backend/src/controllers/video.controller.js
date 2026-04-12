import { db, bucket } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";

const toText = (value = "") => String(value || "").trim();

const extractStoragePath = (url = "") => {
  const raw = toText(url);
  if (!raw) return "";
  // Firebase token URL pattern
  const firebaseMatch = raw.match(/\/o\/(.+?)(\?|$)/);
  if (firebaseMatch?.[1]) return decodeURIComponent(firebaseMatch[1]);
  // Google APIs public URL pattern
  const parts = raw.split("storage.googleapis.com/");
  if (parts.length > 1) {
    const pathPart = parts[1].split("?")[0];
    const withoutBucket = pathPart.split("/").slice(1).join("/");
    return decodeURIComponent(withoutBucket || "");
  }
  return "";
};

const getLectureAndAccess = async (lectureId, studentId) => {
  const lectureSnap = await db
    .collection(COLLECTIONS.LECTURES)
    .doc(lectureId)
    .get();
  if (!lectureSnap.exists) {
    return { error: "Lecture not found", status: 404 };
  }
  const lecture = lectureSnap.data() || {};
  const courseId = toText(lecture.courseId || lecture.subjectId || "");
  if (!courseId) {
    return { error: "Lecture course not found", status: 500 };
  }

  const [activeEnroll, completedEnroll] = await Promise.all([
    db
      .collection(COLLECTIONS.ENROLLMENTS)
      .where("studentId", "==", studentId)
      .where("courseId", "==", courseId)
      .where("status", "==", "active")
      .get(),
    db
      .collection(COLLECTIONS.ENROLLMENTS)
      .where("studentId", "==", studentId)
      .where("courseId", "==", courseId)
      .where("status", "==", "completed")
      .get(),
  ]);

  if (activeEnroll.empty && completedEnroll.empty) {
    return { error: "Not enrolled in this course", status: 403 };
  }

  const isCourseCompleted = !completedEnroll.empty;
  if (isCourseCompleted) {
    const accessSnap = await db
      .collection("videoAccess")
      .where("studentId", "==", studentId)
      .where("lectureId", "==", lectureId)
      .where("hasAccess", "==", true)
      .get();
    if (accessSnap.empty) {
      return {
        error: "Video locked after course completion. Contact teacher.",
        status: 403,
        code: "COMPLETION_LOCKED",
      };
    }
  }

  return { lecture };
};

export const getVideoStreamUrl = async (req, res) => {
  try {
    const lectureId = toText(req.params?.lectureId);
    const studentId = toText(req.user?.uid);
    if (!lectureId) return errorResponse(res, "lectureId is required", 400);
    if (!studentId) return errorResponse(res, "Student not found", 401);

    const access = await getLectureAndAccess(lectureId, studentId);
    if (access.error) {
      return errorResponse(res, access.error, access.status, access.code ? { code: access.code } : {});
    }
    const lecture = access.lecture || {};

    if (toText(lecture.hlsUrl)) {
      const studentSnap = await db
        .collection(COLLECTIONS.STUDENTS)
        .doc(studentId)
        .get();
      const studentName = studentSnap.exists
        ? toText(studentSnap.data()?.fullName || studentSnap.data()?.name || "")
        : "";

      return successResponse(
        res,
        {
          streamUrl: toText(lecture.hlsUrl),
          lectureId,
          title: toText(lecture.title || lecture.videoTitle || ""),
          duration: toText(lecture.videoDuration || ""),
          watermarkText: `${studentName} | SUM Academy`,
          expiresIn: 7200,
        },
        "Stream URL generated"
      );
    }

    const videoPath =
      toText(lecture.videoPath) || extractStoragePath(lecture.videoUrl);
    if (!videoPath) {
      return errorResponse(res, "Video file path not found", 404);
    }

    const file = bucket.file(videoPath);
    const [exists] = await file.exists();
    if (!exists) {
      return errorResponse(res, "Video file not found in storage", 404);
    }

    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 2 * 60 * 60 * 1000,
      responseDisposition: "inline",
      responseType: "video/mp4",
    });

    const studentSnap = await db
      .collection(COLLECTIONS.STUDENTS)
      .doc(studentId)
      .get();
    const studentName = studentSnap.exists
      ? toText(studentSnap.data()?.fullName || studentSnap.data()?.name || "")
      : "";

    return successResponse(
      res,
      {
        streamUrl: signedUrl,
        lectureId,
        title: toText(lecture.title || lecture.videoTitle || ""),
        duration: toText(lecture.videoDuration || ""),
        watermarkText: `${studentName} | SUM Academy`,
        expiresIn: 7200,
      },
      "Stream URL generated"
    );
  } catch (error) {
    console.error("getVideoStreamUrl error:", error);
    return errorResponse(res, "Failed to get stream URL", 500);
  }
};

export const streamVideo = async (req, res) => {
  try {
    const lectureId = toText(req.params?.lectureId);
    const studentId = toText(req.user?.uid);
    if (!lectureId) return res.status(400).json({ error: "lectureId is required" });
    if (!studentId) return res.status(401).json({ error: "Student not found" });

    const access = await getLectureAndAccess(lectureId, studentId);
    if (access.error) {
      return res.status(access.status || 403).json({ error: access.error, code: access.code });
    }
    const lecture = access.lecture || {};

    let filePath = toText(lecture.videoPath);
    if (!filePath && lecture.videoUrl) {
      filePath = extractStoragePath(lecture.videoUrl);
    }
    if (!filePath) {
      return res.status(404).json({ error: "Video path not found" });
    }

    const file = bucket.file(filePath);
    const [metadata] = await file.getMetadata();
    const fileSize = parseInt(metadata.size, 10);
    const mimeType = metadata.contentType || "video/mp4";

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1]
        ? parseInt(parts[1], 10)
        : Math.min(start + 10 * 1024 * 1024, fileSize - 1);
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": mimeType,
        "Cache-Control": "no-cache",
        "X-Frame-Options": "DENY",
      });

      const stream = file.createReadStream({ start, end });
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) res.status(500).end();
      });
      stream.pipe(res);
      return;
    }

    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": mimeType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
      "X-Frame-Options": "DENY",
    });
    const stream = file.createReadStream();
    stream.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (error) {
    console.error("streamVideo error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Stream failed" });
    }
  }
};

export const getLiveSessionVideo = async (req, res) => {
  try {
    const sessionId = toText(req.params?.sessionId);
    const studentId = toText(req.user?.uid);
    if (!sessionId) return errorResponse(res, "sessionId is required", 400);
    if (!studentId) return errorResponse(res, "Student not found", 401);

    const sessionSnap = await db.collection(COLLECTIONS.SESSIONS).doc(sessionId).get();
    if (!sessionSnap.exists) {
      return errorResponse(res, "Session not found", 404);
    }
    const session = sessionSnap.data() || {};

    if (!session.recordingUrl && !session.recordingPath) {
      return errorResponse(
        res,
        "No recording available for this session",
        404,
        { code: "NO_RECORDING" }
      );
    }

    if (session.isLocked || session.sessionLocked) {
      return errorResponse(
        res,
        "Session recording is locked. Contact teacher to unlock.",
        403,
        { code: "SESSION_LOCKED" }
      );
    }

    let filePath = toText(session.recordingPath);
    if (!filePath && session.recordingUrl) {
      filePath = extractStoragePath(session.recordingUrl);
    }
    if (!filePath) {
      return errorResponse(res, "Recording path not found", 404);
    }

    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) {
      return errorResponse(res, "Recording file not found", 404);
    }

    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 2 * 60 * 60 * 1000,
      responseDisposition: "inline",
      responseType: "video/mp4",
    });

    return successResponse(
      res,
      {
        streamUrl: signedUrl,
        sessionId,
        topic: toText(session.topic),
        duration: toText(session.duration || ""),
      },
      "Session recording URL generated"
    );
  } catch (error) {
    console.error("getLiveSessionVideo error:", error);
    return errorResponse(res, "Failed to get recording", 500);
  }
};
