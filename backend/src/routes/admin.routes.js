import { Router } from "express";
import multer from "multer";
import {
  verifyToken,
  requireRole,
} from "../middlewares/auth.middleware.js";
import * as adminController from "../controllers/admin.controller.js";
import * as paymentController from "../controllers/payment.controller.js";
import {
  getSupportMessages,
  markSupportMessageRead,
  deleteSupportMessage,
  replySupportMessage,
} from "../controllers/support.controller.js";
import {
  getTeacherQuizzes,
  getTeacherQuizById,
  assignQuizToStudents,
  getQuizAnalytics,
  createTeacherQuiz,
  downloadQuizBulkTemplate,
  bulkUploadTeacherQuiz,
  getQuizSubmissions,
} from "../controllers/teacher.quiz.controller.js";
import {
  getFinalQuizRequests,
  updateFinalQuizRequestStatus,
  updateCourseRewatchAccess,
  unlockSession,
} from "../controllers/teacher.controller.js";
import {
  createTest,
  downloadTestBulkTemplate,
  getManagedTests,
  getManagedTestById,
  getManagedTestRanking,
  bulkUploadManagedTest,
} from "../controllers/tests.controller.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const adminOnly = [verifyToken, requireRole("admin")];
const adminOrStudent = [verifyToken, requireRole("admin", "student")];

router.get("/stats", adminOnly, adminController.getDashboardStats);
router.get(
  "/revenue-chart",
  adminOnly,
  adminController.getRevenueChart
);
router.get(
  "/recent-enrollments",
  adminOnly,
  adminController.getRecentEnrollments
);
router.get(
  "/top-courses",
  adminOnly,
  adminController.getTopCourses
);
router.get(
  "/recent-activity",
  adminOnly,
  adminController.getRecentActivity
);
router.get(
  "/analytics-report",
  adminOnly,
  adminController.getAnalyticsReport
);

router.get("/users", adminOnly, adminController.getUsers);
router.get("/users/:uid", adminOnly, adminController.getUserById);
router.post("/users", adminOnly, adminController.createUser);
router.put("/users/:uid", adminOnly, adminController.updateUser);
router.delete("/users/:uid", adminOnly, adminController.deleteUser);
router.patch("/users/:uid/role", adminOnly, adminController.setUserRole);
router.patch(
  "/users/:uid/reset-device",
  adminOnly,
  adminController.resetUserDevice
);

router.get("/teachers", adminOnly, adminController.getTeachers);
router.get("/teachers/:uid", adminOnly, adminController.getTeacherById);
router.get("/students", adminOnly, adminController.getStudents);
router.patch(
  "/students/:uid/approve",
  adminOnly,
  adminController.approveStudent
);
router.patch(
  "/students/:uid/reject",
  adminOnly,
  adminController.rejectStudent
);
router.get(
  "/students/template",
  adminOnly,
  adminController.downloadStudentsBulkTemplate
);
router.post(
  "/students/bulk-upload",
  adminOnly,
  upload.single("file"),
  adminController.bulkUploadStudents
);
router.get("/students/:uid/progress", adminOnly, adminController.getStudentProgressById);
router.get("/students/:uid", adminOnly, adminController.getStudentById);
router.patch(
  "/students/:uid/payment-rejections/reset",
  adminOnly,
  adminController.resetStudentPaymentRejectLock
);

router.get("/quizzes/template", adminOnly, downloadQuizBulkTemplate);
router.get("/quizzes", adminOnly, getTeacherQuizzes);
router.get("/quizzes/:quizId", adminOnly, getTeacherQuizById);
router.get("/quizzes/:quizId/analytics", adminOnly, getQuizAnalytics);
router.post("/quizzes", adminOnly, createTeacherQuiz);
router.post("/quizzes/bulk-upload", adminOnly, upload.single("file"), bulkUploadTeacherQuiz);
router.patch("/quizzes/:quizId/assign", adminOnly, assignQuizToStudents);
router.get("/quizzes/:quizId/submissions", adminOnly, getQuizSubmissions);
router.get("/tests", adminOnly, getManagedTests);
router.post("/tests", adminOnly, createTest);
router.get("/tests/template", adminOnly, downloadTestBulkTemplate);
router.post("/tests/bulk-upload", adminOnly, upload.single("file"), bulkUploadManagedTest);
router.get("/tests/:testId", adminOnly, getManagedTestById);
router.get("/tests/:testId/ranking", adminOnly, getManagedTestRanking);
router.get("/final-quiz-requests", adminOnly, getFinalQuizRequests);
router.patch(
  "/final-quiz-requests/:requestId",
  adminOnly,
  updateFinalQuizRequestStatus
);
router.patch("/sessions/:sessionId/unlock", adminOnly, unlockSession);

router.get("/courses", adminOnly, adminController.getCourses);
router.get("/subjects", adminOnly, adminController.getCourses);
router.get("/videos", adminOnly, adminController.getVideoLibrary);
router.post("/videos", adminOnly, adminController.createVideoLibraryItem);
router.post("/courses", adminOnly, adminController.createCourse);
router.post("/subjects", adminOnly, adminController.createCourse);
router.put(
  "/courses/:courseId",
  adminOnly,
  adminController.updateCourse
);
router.put(
  "/subjects/:courseId",
  adminOnly,
  adminController.updateCourse
);
router.patch(
  "/courses/:courseId",
  adminOnly,
  adminController.updateCourse
);
router.patch(
  "/subjects/:courseId",
  adminOnly,
  adminController.updateCourse
);
router.delete(
  "/courses/:courseId",
  adminOnly,
  adminController.deleteCourse
);
router.delete(
  "/subjects/:courseId",
  adminOnly,
  adminController.deleteCourse
);
router.post(
  "/courses/:courseId/subjects",
  adminOnly,
  adminController.addCourseSubject
);
router.delete(
  "/courses/:courseId/subjects/:subjectId",
  adminOnly,
  adminController.removeCourseSubject
);
router.post(
  "/courses/:courseId/subjects/:subjectId/content",
  adminOnly,
  adminController.addCourseContent
);
router.patch(
  "/courses/:courseId/students/:studentId/rewatch-access",
  adminOnly,
  updateCourseRewatchAccess
);
router.get(
  "/courses/:courseId/content",
  adminOnly,
  adminController.getCourseContent
);
router.delete(
  "/courses/:courseId/content/:contentId",
  adminOnly,
  adminController.deleteCourseContent
);

router.get("/classes", adminOnly, adminController.getClasses);
router.post("/classes", adminOnly, adminController.createClass);
router.put(
  "/classes/:classId",
  adminOnly,
  adminController.updateClass
);
router.patch(
  "/classes/:classId/reopen",
  adminOnly,
  adminController.reopenClass
);
router.delete(
  "/classes/:classId",
  adminOnly,
  adminController.deleteClass
);
router.post(
  "/classes/:classId/courses",
  adminOnly,
  adminController.addClassCourse
);
router.post(
  "/classes/:classId/subjects",
  adminOnly,
  adminController.addClassCourse
);
router.delete(
  "/classes/:classId/courses/:courseId",
  adminOnly,
  adminController.removeClassCourse
);
router.delete(
  "/classes/:classId/subjects/:courseId",
  adminOnly,
  adminController.removeClassCourse
);
router.post(
  "/classes/:classId/shifts",
  adminOnly,
  adminController.addClassShift
);
router.put(
  "/classes/:classId/shifts/:shiftId",
  adminOnly,
  adminController.updateClassShift
);
router.delete(
  "/classes/:classId/shifts/:shiftId",
  adminOnly,
  adminController.removeClassShift
);
router.post(
  "/classes/:classId/students",
  adminOrStudent,
  adminController.addStudentToClass
);
router.get(
  "/classes/:classId/students",
  adminOnly,
  adminController.getClassStudents
);
router.post(
  "/classes/:classId/enroll",
  adminOnly,
  adminController.enrollStudentInClass
);
router.delete(
  "/classes/:classId/students/:studentId",
  adminOnly,
  adminController.removeStudentFromClass
);

router.get("/payments", adminOnly, paymentController.getAdminPayments);
router.patch(
  "/payments/:paymentId/verify",
  adminOnly,
  paymentController.verifyBankTransfer
);

router.get("/installments", adminOnly, paymentController.getInstallments);
router.post(
  "/installments",
  adminOnly,
  paymentController.createInstallmentPlan
);
router.post(
  "/installments/send-reminders",
  adminOnly,
  paymentController.sendInstallmentReminders
);
router.patch(
  "/installments/:planId/:number/pay",
  adminOnly,
  paymentController.markInstallmentPaid
);

router.get("/support/messages", adminOnly, getSupportMessages);
router.patch("/support/messages/:messageId/read", adminOnly, markSupportMessageRead);
router.post("/support/messages/:messageId/reply", adminOnly, replySupportMessage);
router.delete("/support/messages/:messageId", adminOnly, deleteSupportMessage);

router.get("/promo-codes", adminOnly, adminController.getPromoCodes);
router.post(
  "/promo-codes",
  adminOnly,
  adminController.createPromoCode
);
router.put(
  "/promo-codes/:codeId",
  adminOnly,
  adminController.updatePromoCode
);
router.delete(
  "/promo-codes/:codeId",
  adminOnly,
  adminController.deletePromoCode
);
router.patch(
  "/promo-codes/:codeId/toggle",
  adminOnly,
  adminController.togglePromoCode
);
router.post(
  "/promo-codes/validate",
  adminOnly,
  adminController.validatePromoCode
);

export default router;
