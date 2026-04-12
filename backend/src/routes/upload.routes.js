import express from "express";
import {
  upload,
  videoUpload,
  apkUpload,
  uploadThumbnail,
  uploadCoursePDF,
  uploadCourseVideo,
  uploadPaymentReceipt,
  uploadLogo,
  uploadAndroidApk,
  deleteUploadedFile,
} from "../controllers/upload.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";

const router = express.Router();

const adminOrTeacher = [verifyToken, requireRole("admin", "teacher")];
const adminOnly = [verifyToken, requireRole("admin")];
const authOnly = [verifyToken];
const maybeReceiptUpload = (req, res, next) => {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("multipart/form-data")) {
    return upload.single("file")(req, res, next);
  }
  return next();
};

router.post(
  "/upload/thumbnail",
  adminOrTeacher,
  upload.single("file"),
  uploadThumbnail
);

router.post("/upload/pdf", adminOrTeacher, upload.single("file"), uploadCoursePDF);

router.post(
  "/upload/video",
  adminOrTeacher,
  (req, res, next) => {
    req.setTimeout(0);
    res.setTimeout(0);
    next();
  },
  videoUpload.single("file"),
  uploadCourseVideo
);

router.post("/upload/logo", adminOnly, upload.single("file"), uploadLogo);

router.post("/upload/apk", adminOnly, apkUpload.single("file"), uploadAndroidApk);

router.post(
  "/payments/:paymentId/receipt",
  authOnly,
  maybeReceiptUpload,
  uploadPaymentReceipt
);

router.patch(
  "/payments/:paymentId/receipt",
  authOnly,
  maybeReceiptUpload,
  uploadPaymentReceipt
);

router.delete("/upload/file", adminOrTeacher, deleteUploadedFile);

export default router;
