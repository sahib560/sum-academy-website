import { Router } from "express";
import multer from "multer";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";
import {
  createTeacherAnnouncement,
  getTeacherOutgoingAnnouncements,
} from "../controllers/announcement.controller.js";
import {
  getTeacherQuizzes,
  getTeacherQuizById,
  assignQuizToStudents,
  getQuizAnalytics,
  createTeacherQuiz,
  downloadQuizBulkTemplate,
  bulkUploadTeacherQuiz,
  previewQuizEvaluation,
  submitQuizAttempt,
  getQuizSubmissions,
  gradeShortAnswerSubmission,
} from "../controllers/teacher.quiz.controller.js";
import {
  getTeacherDashboard,
  getTeacherCourses,
  getTeacherCourseById,
  getChapters,
  addChapterToCourse,
  updateChapter,
  deleteChapter,
  getLectures,
  addLecture,
  updateLecture,
  deleteLecture,
  saveLectureContent,
  deleteLectureContent,
  getCourseStudents,
  updateVideoAccess,
  getTeacherStudents,
  getTeacherStudentById,
  getStudentProgress,
  updateStudentVideoAccess,
  getStudentAttendance,
  getTeacherSessions,
  getSessionById,
  createSession,
  updateSession,
  cancelSession,
  markSessionComplete,
  getSessionAttendance,
  saveSessionAttendance,
  getTeacherClasses,
  getTeacherSettingsProfile,
  updateTeacherSettingsProfile,
  getTeacherSettingsSecurity,
  revokeTeacherSession,
  revokeTeacherOtherSessions,
} from "../controllers/teacher.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.use(verifyToken, requireRole("teacher"));

router.get("/dashboard", getTeacherDashboard);

router.get("/courses", getTeacherCourses);
router.get("/courses/:courseId", getTeacherCourseById);

router.get("/courses/:courseId/subjects/:subjectId/chapters", getChapters);
router.post("/courses/:courseId/subjects/:subjectId/chapters", addChapterToCourse);
router.put("/chapters/:chapterId", updateChapter);
router.delete("/chapters/:chapterId", deleteChapter);

router.get("/chapters/:chapterId/lectures", getLectures);
router.post("/chapters/:chapterId/lectures", addLecture);
router.put("/lectures/:lectureId", updateLecture);
router.delete("/lectures/:lectureId", deleteLecture);

router.post("/lectures/:lectureId/content", saveLectureContent);
router.delete("/lectures/:lectureId/content/:contentId", deleteLectureContent);

router.get("/courses/:courseId/students", getCourseStudents);
router.patch(
  "/courses/:courseId/students/:studentId/video-access",
  updateVideoAccess
);

router.get("/students", getTeacherStudents);
router.get("/students/:studentId", getTeacherStudentById);
router.get("/students/:studentId/progress/:courseId", getStudentProgress);
router.patch("/students/:studentId/video-access", updateStudentVideoAccess);
router.get("/students/:studentId/attendance/:classId", getStudentAttendance);

router.get("/sessions", getTeacherSessions);
router.get("/sessions/:sessionId", getSessionById);
router.post("/sessions", createSession);
router.put("/sessions/:sessionId", updateSession);
router.patch("/sessions/:sessionId/cancel", cancelSession);
router.patch("/sessions/:sessionId/complete", markSessionComplete);
router.get("/sessions/:sessionId/attendance", getSessionAttendance);
router.post("/sessions/:sessionId/attendance", saveSessionAttendance);

router.get("/classes", getTeacherClasses);
router.get("/announcements", getTeacherOutgoingAnnouncements);
router.post("/announcements", createTeacherAnnouncement);
router.get("/quizzes/template", downloadQuizBulkTemplate);
router.get("/quizzes", getTeacherQuizzes);
router.get("/quizzes/:quizId", getTeacherQuizById);
router.get("/quizzes/:quizId/analytics", getQuizAnalytics);
router.post("/quizzes", createTeacherQuiz);
router.post("/quizzes/bulk-upload", upload.single("file"), bulkUploadTeacherQuiz);
router.patch("/quizzes/:quizId/assign", assignQuizToStudents);
router.post("/quizzes/:quizId/evaluate", previewQuizEvaluation);
router.post("/quizzes/:quizId/submissions", submitQuizAttempt);
router.get("/quizzes/:quizId/submissions", getQuizSubmissions);
router.patch(
  "/quizzes/:quizId/submissions/:resultId/grade-short",
  gradeShortAnswerSubmission
);
router.get("/settings/profile", getTeacherSettingsProfile);
router.put("/settings/profile", updateTeacherSettingsProfile);
router.get("/settings/security", getTeacherSettingsSecurity);
router.patch("/settings/security/sessions/:sessionDocId/revoke", revokeTeacherSession);
router.patch("/settings/security/sessions/revoke-all", revokeTeacherOtherSessions);

export default router;
