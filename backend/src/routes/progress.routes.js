import express from "express";
import {
  getCourseContent,
  markLectureComplete,
  saveWatchProgress,
  updateVideoAccess,
  unlockAllVideosForStudent,
  setLectureLock,
  getStudentCourseProgress,
  completeStudentSubjectByStaff,
  completeStudentClassByStaff,
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
router.get(
  "/student/subjects/:subjectId/content",
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
router.post(
  "/student/subjects/:subjectId/lectures/:lectureId/complete",
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
  "/student/subjects/:subjectId/lectures/:lectureId/progress",
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
router.patch(
  "/subjects/:subjectId/students/:studentId/video-access",
  verifyToken,
  requireRole("teacher", "admin"),
  updateVideoAccess
);

router.patch(
  "/courses/:courseId/lectures/:lectureId/lock",
  verifyToken,
  requireRole("teacher", "admin"),
  setLectureLock
);
router.patch(
  "/subjects/:subjectId/lectures/:lectureId/lock",
  verifyToken,
  requireRole("teacher", "admin"),
  setLectureLock
);

router.post(
  "/courses/:courseId/students/:studentId/unlock-all",
  verifyToken,
  requireRole("teacher", "admin"),
  unlockAllVideosForStudent
);
router.post(
  "/subjects/:subjectId/students/:studentId/unlock-all",
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
router.get(
  "/subjects/:subjectId/students/:studentId/progress",
  verifyToken,
  requireRole("teacher", "admin"),
  getStudentCourseProgress
);

router.post(
  "/courses/:courseId/students/:studentId/complete",
  verifyToken,
  requireRole("teacher", "admin"),
  completeStudentSubjectByStaff
);
router.post(
  "/subjects/:subjectId/students/:studentId/complete",
  verifyToken,
  requireRole("teacher", "admin"),
  completeStudentSubjectByStaff
);
router.post(
  "/classes/:classId/students/:studentId/complete",
  verifyToken,
  requireRole("teacher", "admin"),
  completeStudentClassByStaff
);

export default router;
