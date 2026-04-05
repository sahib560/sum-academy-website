import express from "express";
import {
  upload,
  uploadThumbnail,
  uploadCoursePDF,
  uploadCourseVideo,
  uploadPaymentReceipt,
  uploadLogo,
  deleteUploadedFile,
} from "../controllers/upload.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";

const router = express.Router();

const adminOrTeacher = [verifyToken, requireRole("admin", "teacher")];
const adminOnly = [verifyToken, requireRole("admin")];
const authOnly = [verifyToken];

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
  upload.single("file"),
  uploadCourseVideo
);

router.post("/upload/logo", adminOnly, upload.single("file"), uploadLogo);

router.post(
  "/payments/:paymentId/receipt",
  authOnly,
  upload.single("file"),
  uploadPaymentReceipt
);

router.patch(
  "/payments/:paymentId/receipt",
  authOnly,
  upload.single("file"),
  uploadPaymentReceipt
);

router.delete("/upload/file", adminOrTeacher, deleteUploadedFile);

export default router;
