import { Router } from "express";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";
import {
  getStudentDashboard,
  getStudentCourses,
  getStudentLiveSessions,
  joinStudentLiveSession,
  getStudentSessionById,
  joinStudentSession,
  getSessionStatus,
  leaveSession,
  getSessionSync,
  logSessionViolation,
  getStudentCourseProgress,
  getFinalQuizRequestStatus,
  markLectureComplete,
  requestFinalQuizForCourse,
  getStudentCertificates,
  downloadStudentCertificate,
  getStudentQuizzes,
  getQuizById,
  submitQuizAttempt,
  getStudentAnnouncements,
  markAnnouncementRead,
  reportSecurityViolation,
  submitHelpSupportMessage,
  getStudentSettings,
  updateStudentSettings,
} from "../controllers/student.controller.js";
import {
  getStudentTests,
  getStudentTestById,
  startStudentTest,
  submitStudentTestAnswer,
  finishStudentTest,
  getStudentTestRanking,
  downloadStudentTestRankingPdf,
} from "../controllers/tests.controller.js";

const router = Router();

router.use(verifyToken, requireRole("student"));

router.get("/dashboard", getStudentDashboard);
router.get("/courses", getStudentCourses);
router.get("/tests", getStudentTests);
router.get("/tests/:testId", getStudentTestById);
router.post("/tests/:testId/start", startStudentTest);
router.post("/tests/:testId/answer", submitStudentTestAnswer);
router.post("/tests/:testId/finish", finishStudentTest);
router.get("/tests/:testId/ranking", getStudentTestRanking);
router.get("/tests/:testId/ranking/pdf", downloadStudentTestRankingPdf);
router.get("/live-sessions", getStudentLiveSessions);
router.post("/live-sessions/:sessionId/join", joinStudentLiveSession);
router.get("/sessions/:sessionId", getStudentSessionById);
router.post("/sessions/:sessionId/join", joinStudentSession);
router.get("/sessions/:sessionId/status", getSessionStatus);
router.post("/sessions/:sessionId/leave", leaveSession);
router.get("/sessions/:sessionId/sync", getSessionSync);
router.post("/sessions/:sessionId/violation", logSessionViolation);
router.get("/courses/:courseId/progress", getStudentCourseProgress);
router.get("/subjects/:subjectId/progress", (req, res, next) => {
  req.params.courseId = req.params.subjectId;
  return getStudentCourseProgress(req, res, next);
});
router.get("/courses/:courseId/final-quiz-request", getFinalQuizRequestStatus);
router.post("/courses/:courseId/final-quiz-request", requestFinalQuizForCourse);
router.post("/courses/:courseId/lectures/:lectureId/complete", markLectureComplete);

router.get("/certificates", getStudentCertificates);
router.get("/certificates/:id/download", downloadStudentCertificate);
router.get("/quizzes", getStudentQuizzes);
router.get("/quizzes/:quizId", getQuizById);
router.post("/quizzes/:quizId/submit", submitQuizAttempt);

router.get("/announcements", getStudentAnnouncements);
router.patch("/announcements/:id/read", markAnnouncementRead);

router.post("/security/violations", reportSecurityViolation);
router.post("/help-support", submitHelpSupportMessage);

router.get("/settings", getStudentSettings);
router.put("/settings", updateStudentSettings);

export default router;
