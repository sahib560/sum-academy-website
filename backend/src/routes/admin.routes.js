import { Router } from "express";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";
import {
  getDashboardStats,
  getRecentEnrollments,
  getTopCourses,
  getRecentActivity,
  getRevenueChart,
  getUsers,
  createUser,
  updateUser,
  resetUserDevice,
  deleteUser,
  setUserRole,
  getTeachers,
  createTeacher,
  getStudents,
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getClasses,
  createClass,
  getPayments,
  verifyBankTransfer,
  getPromoCodes,
  createPromoCode,
  getCertificates,
  getAnnouncements,
  createAnnouncement,
} from "../controllers/admin.controller.js";

const router = Router();

router.use(verifyToken, requireRole("admin"));

router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/enrollments", getRecentEnrollments);
router.get("/dashboard/top-courses", getTopCourses);
router.get("/dashboard/activity", getRecentActivity);
router.get("/dashboard/revenue-chart", getRevenueChart);

router.get("/users", getUsers);
router.post("/users", createUser);
router.put("/users/:uid", updateUser);
router.patch("/users/:uid/reset-device", resetUserDevice);
router.delete("/users/:uid", deleteUser);
router.patch("/users/:uid/role", setUserRole);

router.get("/teachers", getTeachers);
router.post("/teachers", createTeacher);

router.get("/students", getStudents);

router.get("/courses", getCourses);
router.post("/courses", createCourse);
router.put("/courses/:courseId", updateCourse);
router.delete("/courses/:courseId", deleteCourse);

router.get("/classes", getClasses);
router.post("/classes", createClass);

router.get("/payments", getPayments);
router.patch("/payments/:paymentId/verify", verifyBankTransfer);

router.get("/promo-codes", getPromoCodes);
router.post("/promo-codes", createPromoCode);

router.get("/certificates", getCertificates);

router.get("/announcements", getAnnouncements);
router.post("/announcements", createAnnouncement);

export default router;
