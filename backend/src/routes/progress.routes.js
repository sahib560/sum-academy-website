import express from "express";
import {
  getCourseContent,
  markLectureComplete,
  saveWatchProgress,
  updateVideoAccess,
  unlockAllVideosForStudent,
  getStudentCourseProgress,
} from "../controllers/progress.controller.js";
import {
  verifyToken,
  requireRole,
} from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get(
  "/student/courses/:courseId/content",
  verifyToken,
  requireRole("student"),
  getCourseContent
);

router.post(
  "/student/courses/:courseId/lectures/:lectureId/complete",
  verifyToken,
  requireRole("student"),
  markLectureComplete
);

router.patch(
  "/student/courses/:courseId/lectures/:lectureId/progress",
  verifyToken,
  requireRole("student"),
  saveWatchProgress
);

router.patch(
  "/courses/:courseId/students/:studentId/video-access",
  verifyToken,
  requireRole("teacher", "admin"),
  updateVideoAccess
);

router.post(
  "/courses/:courseId/students/:studentId/unlock-all",
  verifyToken,
  requireRole("teacher", "admin"),
  unlockAllVideosForStudent
);

router.get(
  "/courses/:courseId/students/:studentId/progress",
  verifyToken,
  requireRole("teacher", "admin"),
  getStudentCourseProgress
);

export default router;

