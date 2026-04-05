import { Router } from "express";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";
import {
  getStudentDashboard,
  getStudentCourses,
  getStudentCourseProgress,
  markLectureComplete,
  getStudentCertificates,
  getStudentQuizzes,
  getQuizById,
  submitQuizAttempt,
  getStudentAnnouncements,
  markAnnouncementRead,
  getStudentAttendance,
  reportSecurityViolation,
  submitHelpSupportMessage,
  getStudentSettings,
  updateStudentSettings,
} from "../controllers/student.controller.js";

const router = Router();

router.use(verifyToken, requireRole("student"));

router.get("/dashboard", getStudentDashboard);
router.get("/courses", getStudentCourses);
router.get("/courses/:courseId/progress", getStudentCourseProgress);
router.post("/courses/:courseId/lectures/:lectureId/complete", markLectureComplete);

router.get("/certificates", getStudentCertificates);
router.get("/quizzes", getStudentQuizzes);
router.get("/quizzes/:quizId", getQuizById);
router.post("/quizzes/:quizId/submit", submitQuizAttempt);

router.get("/announcements", getStudentAnnouncements);
router.patch("/announcements/:id/read", markAnnouncementRead);

router.get("/attendance", getStudentAttendance);
router.post("/security/violations", reportSecurityViolation);
router.post("/help-support", submitHelpSupportMessage);

router.get("/settings", getStudentSettings);
router.put("/settings", updateStudentSettings);

export default router;
