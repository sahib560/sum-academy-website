import multer from "multer";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { v4 as uuidv4 } from "uuid";
import { admin, db, bucket } from "../config/firebase.js";
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

const resolveFfmpegPath = () =>
  process.env.FFMPEG_PATH ||
  process.env.FFMPEG_BIN ||
  ffmpegInstaller.path ||
  "";
const resolveFfprobePath = () =>
  process.env.FFPROBE_PATH ||
  process.env.FFPROBE_BIN ||
  ffprobeInstaller.path ||
  "";

const ffmpegPath = resolveFfmpegPath();
const ffprobePath = resolveFfprobePath();
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);

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

const generateHlsVariants = async (inputPath, outputDir) =>
  new Promise((resolve, reject) => {
    const masterName = "master.m3u8";
    ffmpeg(inputPath)
      .outputOptions([
        "-preset veryfast",
        "-g 48",
        "-sc_threshold 0",
        "-hls_time 6",
        "-hls_playlist_type vod",
        "-hls_flags independent_segments",
        "-hls_segment_filename",
        `${outputDir}/v%v/segment_%03d.ts`,
        "-master_pl_name",
        masterName,
        "-var_stream_map",
        "v:0,a:0 v:1,a:1 v:2,a:2",
      ])
      .complexFilter([
        "[0:v]split=3[v240][v480][v720]",
        "[v240]scale=w=426:h=240:force_original_aspect_ratio=decrease[v240out]",
        "[v480]scale=w=854:h=480:force_original_aspect_ratio=decrease[v480out]",
        "[v720]scale=w=1280:h=720:force_original_aspect_ratio=decrease[v720out]",
      ])
      .outputOptions([
        "-map",
        "[v240out]",
        "-map",
        "0:a?",
        "-c:v:0",
        "libx264",
        "-b:v:0",
        "400k",
        "-maxrate:v:0",
        "500k",
        "-bufsize:v:0",
        "800k",
        "-c:a:0",
        "aac",
        "-b:a:0",
        "96k",
        "-map",
        "[v480out]",
        "-map",
        "0:a?",
        "-c:v:1",
        "libx264",
        "-b:v:1",
        "1000k",
        "-maxrate:v:1",
        "1200k",
        "-bufsize:v:1",
        "1800k",
        "-c:a:1",
        "aac",
        "-b:a:1",
        "128k",
        "-map",
        "[v720out]",
        "-map",
        "0:a?",
        "-c:v:2",
        "libx264",
        "-b:v:2",
        "2500k",
        "-maxrate:v:2",
        "3000k",
        "-bufsize:v:2",
        "4500k",
        "-c:a:2",
        "aac",
        "-b:a:2",
        "128k",
      ])
      .output(`${outputDir}/v%v/prog_index.m3u8`)
      .on("end", () => resolve({ masterName }))
      .on("error", (err) => reject(err))
      .run();
  });

const listFilesRecursively = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
};

const buildFirebaseTokenUrl = (bucketName, filePath, token) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    filePath
  )}?alt=media&token=${token}`;

const rewritePlaylistUrls = async (playlistPath, filePathMap) => {
  const raw = await fs.readFile(playlistPath, "utf8");
  const lines = raw.split(/\r?\n/).map((line) => {
    if (!line || line.startsWith("#")) return line;
    const mapped = filePathMap.get(line.trim());
    return mapped || line;
  });
  await fs.writeFile(playlistPath, lines.join("\n"));
};

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

    const shouldTranscode =
      String(process.env.TRANSCODE_VIDEOS || "true").toLowerCase() !== "false";
    const shouldGenerateHls =
      String(process.env.HLS_TRANSCODE || "true").toLowerCase() !== "false";
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
        const msg = err?.message || String(err);
        console.error("Video transcode failed:", msg);
        // Fallback: still upload original video so uploads don't break.
        // Mark hlsError so admin can re-encode later.
        uploadPath = originalPath;
        targetMime = req.file.mimetype || "video/mp4";
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

    let hlsUrl = "";
    let hlsError = "";
    if (shouldGenerateHls && uploadPath !== originalPath) {
      const hlsToken = uuidv4();
      const hlsRoot = path.join(os.tmpdir(), `sum-hls-${Date.now()}`);
      await fs.mkdir(hlsRoot, { recursive: true });
      try {
        await generateHlsVariants(uploadPath, hlsRoot);
      } catch (err) {
        hlsError = err?.message || "HLS conversion failed";
      }

      if (!hlsError) {
        const files = await listFilesRecursively(hlsRoot);
        const filePathMap = new Map();
        const hlsFolder = `videos/hls/courses/${courseId}/subjects/${subjectId}/${lectureId || uuidv4()}`;

        for (const filePath of files) {
          const relative = path.relative(hlsRoot, filePath).replace(/\\/g, "/");
          const destination = `${hlsFolder}/${relative}`;
          const isPlaylist = relative.endsWith(".m3u8");
          const cacheControl = isPlaylist
            ? "public,max-age=300"
            : "public,max-age=31536000,immutable";

          await bucket.upload(filePath, {
            destination,
            resumable: false,
            metadata: {
              contentType: isPlaylist ? "application/vnd.apple.mpegurl" : "video/mp2t",
              cacheControl,
              metadata: {
                firebaseStorageDownloadTokens: hlsToken,
                originalName: req.file.originalname,
                uploadedAt: new Date().toISOString(),
              },
            },
          });

          const publicUrl = buildFirebaseTokenUrl(bucket.name, destination, hlsToken);
          filePathMap.set(relative, publicUrl);
        }

        const playlistFiles = files.filter((filePath) => filePath.endsWith(".m3u8"));
        for (const playlistPath of playlistFiles) {
          await rewritePlaylistUrls(playlistPath, filePathMap);
        }

        for (const playlistPath of playlistFiles) {
          const relative = path.relative(hlsRoot, playlistPath).replace(/\\/g, "/");
          const destination = `${hlsFolder}/${relative}`;
          await bucket.upload(playlistPath, {
            destination,
            resumable: false,
            metadata: {
              contentType: "application/vnd.apple.mpegurl",
              cacheControl: "public,max-age=300",
              metadata: {
                firebaseStorageDownloadTokens: hlsToken,
                originalName: req.file.originalname,
                uploadedAt: new Date().toISOString(),
              },
            },
          });
        }

        hlsUrl = buildFirebaseTokenUrl(
          bucket.name,
          `${hlsFolder}/master.m3u8`,
          hlsToken
        );
      }

      await fs.rm(hlsRoot, { recursive: true, force: true }).catch(() => {});
    }

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
            hlsUrl: hlsUrl || "",
            hlsGeneratedAt: hlsUrl ? admin.firestore.FieldValue.serverTimestamp() : null,
            hlsError: hlsError || (uploadPath === originalPath ? "FFmpeg unavailable. Saved original MP4." : null),
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
        hlsUrl,
        hlsError: hlsError || (uploadPath === originalPath ? "FFmpeg unavailable. Saved original MP4." : undefined),
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
