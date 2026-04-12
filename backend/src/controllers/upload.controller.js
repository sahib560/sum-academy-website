import multer from "multer";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { admin, db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";
import {
  uploadFile,
  uploadImage,
  uploadVideo,
  uploadVideoFromPath,
  uploadReceipt,
  uploadLogo as uploadLogoFile,
  uploadAPK,
  uploadAPKFromPath,
  deleteFile,
  MAX_SIZES,
} from "../services/storage.service.js";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZES.video },
});

const videoDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file?.originalname || "") || ".mp4";
    cb(null, `sum-video-${Date.now()}${ext}`);
  },
});

export const videoUpload = multer({
  storage: videoDiskStorage,
  limits: { fileSize: MAX_SIZES.video },
});

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const formatDuration = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const probeVideo = async (filePath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(data || {});
    });
  });

const transcodeToMp4 = async (inputPath) =>
  new Promise((resolve, reject) => {
    const outputPath = path.join(os.tmpdir(), `sum-transcoded-${Date.now()}.mp4`);
    ffmpeg(inputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .audioBitrate("128k")
      .outputOptions([
        "-profile:v high",
        "-level 4.1",
        "-pix_fmt yuv420p",
        "-movflags +faststart",
      ])
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });

const apkDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename: (req, file, cb) => {
    const ext = path.extname(file?.originalname || "") || ".apk";
    cb(null, `sum-apk-${Date.now()}${ext}`);
  },
});

export const apkUpload = multer({
  storage: apkDiskStorage,
  limits: { fileSize: MAX_SIZES.apk },
});

export const uploadThumbnail = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, "No file uploaded", 400);

    const result = await uploadImage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      "thumbnails"
    );

    return successResponse(res, { url: result.url }, "Thumbnail uploaded");
  } catch (error) {
    return errorResponse(res, error?.message || "Failed to upload thumbnail", 400);
  }
};

export const uploadCoursePDF = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, "No file uploaded", 400);

    const { courseId = "", subjectId = "", type = "pdf" } = req.body || {};
    if (!courseId || !subjectId) {
      return errorResponse(res, "courseId and subjectId are required", 400);
    }

    const folder = `courses/${courseId}/subjects/${subjectId}`;
    const result = await uploadFile({
      fileBuffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      folder: `pdfs/${folder}`,
      maxSize: MAX_SIZES.pdf,
    });

    return successResponse(
      res,
      {
        url: result.url,
        name: req.file.originalname,
        size: result.size,
        type,
      },
      "PDF uploaded"
    );
  } catch (error) {
    return errorResponse(res, error?.message || "Failed to upload PDF", 400);
  }
};

export const uploadCourseVideo = async (req, res) => {
  const tempPath = req.file?.path || "";
  try {
    if (!req.file) return errorResponse(res, "No file uploaded", 400);

    const { courseId = "", subjectId = "", lectureId = "", title = "" } = req.body || {};
    if (!courseId || !subjectId) {
      return errorResponse(res, "courseId and subjectId are required", 400);
    }

    const shouldTranscode = String(process.env.TRANSCODE_VIDEOS || "true").toLowerCase() !== "false";
    const originalPath = tempPath || path.join(os.tmpdir(), `sum-upload-${Date.now()}`);

    if (!tempPath && req.file?.buffer) {
      await fs.writeFile(originalPath, req.file.buffer);
    }

    let uploadPath = originalPath;
    let targetMime = req.file.mimetype || "video/mp4";

    if (shouldTranscode) {
      try {
        uploadPath = await transcodeToMp4(originalPath);
        targetMime = "video/mp4";
      } catch (err) {
        console.error("Video transcode failed:", err?.message || err);
        return errorResponse(
          res,
          "Video could not be converted to a web-friendly format. Please upload H.264/AAC or try again.",
          400
        );
      }
    }

    let durationSec = 0;
    try {
      const meta = await probeVideo(uploadPath);
      durationSec = Number(meta?.format?.duration || 0) || 0;
    } catch (err) {
      console.warn("Video duration probe failed:", err?.message || err);
    }

    const result = await uploadVideoFromPath(
      uploadPath,
      req.file.originalname,
      targetMime,
      `courses/${courseId}/subjects/${subjectId}`
    );

    if (lectureId) {
      await db
        .collection(COLLECTIONS.LECTURES)
        .doc(lectureId)
        .set(
          {
            videoUrl: result.url,
            videoPath: result.filePath,
            videoTitle: title || req.file.originalname,
            videoDuration: durationSec ? formatDuration(durationSec) : "",
            durationSec: durationSec || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }

    return successResponse(
      res,
      {
        url: result.url,
        filePath: result.filePath,
        name: req.file.originalname,
        durationSec: durationSec || 0,
      },
      "Video uploaded"
    );
  } catch (error) {
    return errorResponse(res, error?.message || "Failed to upload video", 400);
  } finally {
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
};

export const uploadPaymentReceipt = async (req, res) => {
  try {
    const paymentId = req.params.paymentId || req.params.id;
    if (!paymentId) return errorResponse(res, "paymentId is required", 400);

    const paymentRef = db.collection(COLLECTIONS.PAYMENTS).doc(paymentId);
    const paySnap = await paymentRef.get();
    if (!paySnap.exists) return errorResponse(res, "Payment not found", 404);

    const payData = paySnap.data() || {};
    const isAdmin = req.user?.role === "admin";
    if (!isAdmin && payData.studentId && payData.studentId !== req.user?.uid) {
      return errorResponse(
        res,
        "You can upload receipt for your own payment only",
        403
      );
    }
    if (!isAdmin) {
      const studentUid = String(payData.studentId || req.user?.uid || "").trim();
      if (studentUid) {
        const userSnap = await db.collection(COLLECTIONS.USERS).doc(studentUid).get();
        const userData = userSnap.exists ? userSnap.data() || {} : {};
        if (userData.paymentApprovalBlocked) {
          return errorResponse(
            res,
            "Payment approvals are blocked after 3 rejected receipts. Contact admin to reset.",
            403,
            {
              code: "PAYMENT_APPROVAL_BLOCKED",
              rejectCount: Number(userData.paymentRejectCount || 0),
              rejectLimit: Number(userData.paymentRejectLimit || 3),
            }
          );
        }
      }
    }
    const paymentMethod = String(payData.method || "").toLowerCase();
    const supportedReceiptMethods = new Set([
      "bank_transfer",
      "easypaisa",
      "jazzcash",
    ]);
    if (!supportedReceiptMethods.has(paymentMethod)) {
      return errorResponse(
        res,
        "Unsupported payment method for receipt upload",
        400
      );
    }
    const currentStatus = String(payData.status || "").trim().toLowerCase();
    const allowedStatuses = new Set([
      "awaiting_receipt",
      "pending",
      "pending_verification",
      "rejected",
    ]);
    if (!allowedStatuses.has(currentStatus)) {
      return errorResponse(
        res,
        "Receipt cannot be uploaded for this payment status",
        400
      );
    }

    let result = null;
    const receiptUrlFromBody = String(req.body?.receiptUrl || "").trim();

    if (req.file) {
      result = await uploadReceipt(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
    } else if (receiptUrlFromBody) {
      if (!/^https?:\/\//i.test(receiptUrlFromBody)) {
        return errorResponse(res, "Invalid receipt URL", 400);
      }
      result = {
        url: receiptUrlFromBody,
        size: Number(req.body?.receiptSize || 0) || null,
      };
    } else {
      return errorResponse(res, "No file uploaded", 400);
    }

    await paymentRef.update({
      receiptUrl: result.url,
      receiptName: req.file?.originalname || null,
      receiptSize: result.size || null,
      status: "pending_verification",
      receiptUploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(
      res,
      {
        url: result.url,
        paymentId,
        status: "pending_verification",
      },
      "Receipt uploaded. Awaiting admin verification."
    );
  } catch (error) {
    return errorResponse(
      res,
      error?.message || "Failed to upload receipt",
      400
    );
  }
};

export const uploadLogo = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, "No file uploaded", 400);

    const result = await uploadLogoFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    await db
      .collection(COLLECTIONS.SETTINGS)
      .doc("siteSettings")
      .set({ general: { logoUrl: result.url } }, { merge: true });

    return successResponse(res, { url: result.url }, "Logo uploaded");
  } catch (error) {
    return errorResponse(res, error?.message || "Failed to upload logo", 400);
  }
};

export const uploadAndroidApk = async (req, res) => {
  const tempPath = req.file?.path || "";
  try {
    if (!req.file) return errorResponse(res, "No file uploaded", 400);

    const result = tempPath
      ? await uploadAPKFromPath(
          tempPath,
          req.file.originalname,
          req.file.mimetype,
          req.file.size
        )
      : await uploadAPK(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );

    await db
      .collection(COLLECTIONS.SETTINGS)
      .doc("siteSettings")
      .set(
        {
          general: {
            apkUrl: result.url,
            apkFileName: req.file.originalname || result.fileName,
            apkMimeType: req.file.mimetype || "application/vnd.android.package-archive",
            apkSize: result.size || null,
            apkUploadedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

    return successResponse(
      res,
      {
        url: result.url,
        fileName: req.file.originalname || result.fileName,
        size: result.size || null,
      },
      "APK uploaded"
    );
  } catch (error) {
    console.error("uploadAndroidApk error:", error);
    return errorResponse(res, error?.message || "Failed to upload APK", 400);
  } finally {
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
};

export const deleteUploadedFile = async (req, res) => {
  try {
    const { filePath } = req.body || {};
    if (!filePath) return errorResponse(res, "filePath required", 400);
    await deleteFile(filePath);
    return successResponse(res, {}, "File deleted");
  } catch (error) {
    return errorResponse(res, "Failed to delete file", 500);
  }
};
