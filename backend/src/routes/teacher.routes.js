import { Router } from "express";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";
import { getTeacherDashboard } from "../controllers/teacher.controller.js";

const router = Router();
const teacherOnly = [verifyToken, requireRole("teacher")];

router.get("/dashboard", teacherOnly, getTeacherDashboard);

export default router;
