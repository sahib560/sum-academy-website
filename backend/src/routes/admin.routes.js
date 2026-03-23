import { Router } from "express";
import {
  verifyToken,
  requireRole,
  detectDevice,
} from "../middlewares/auth.middleware.js";
import * as adminController from "../controllers/admin.controller.js";

const router = Router();
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
router.get("/students", adminOnly, adminController.getStudents);

router.get("/courses", adminOnly, adminController.getCourses);
router.post("/courses", adminOnly, adminController.createCourse);
router.put(
  "/courses/:courseId",
  adminOnly,
  adminController.updateCourse
);
router.patch(
  "/courses/:courseId",
  adminOnly,
  adminController.updateCourse
);
router.delete(
  "/courses/:courseId",
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
router.delete(
  "/classes/:classId/courses/:courseId",
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

router.get("/payments", adminOnly, adminController.getPayments);
router.patch(
  "/payments/:paymentId/verify",
  adminOnly,
  adminController.verifyBankTransfer
);

router.get("/installments", adminOnly, adminController.getInstallments);
router.post(
  "/installments",
  adminOnly,
  adminController.createInstallmentPlan
);
router.patch(
  "/installments/:planId/:installmentNumber/pay",
  adminOnly,
  adminController.markInstallmentPaid
);

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
router.post(
  "/promo-codes/validate",
  adminOnly,
  adminController.validatePromoCode
);

router.get("/certificates", adminOnly, adminController.getCertificates);
router.post(
  "/certificates",
  adminOnly,
  adminController.generateCertificate
);

router.get(
  "/announcements",
  adminOnly,
  adminController.getAnnouncements
);
router.post(
  "/announcements",
  adminOnly,
  adminController.createAnnouncement
);
router.put(
  "/announcements/:announcementId",
  adminOnly,
  adminController.updateAnnouncement
);
router.delete(
  "/announcements/:announcementId",
  adminOnly,
  adminController.deleteAnnouncement
);

router.get("/settings", adminOnly, adminController.getSiteSettings);
router.put("/settings", adminOnly, adminController.updateSiteSettings);

export default router;
