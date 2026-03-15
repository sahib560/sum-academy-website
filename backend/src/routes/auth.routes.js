import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  setUserRole,
} from "../controllers/auth.controller.js";
import {
  verifyToken,
  verifyFirebaseToken,
  requireRole,
  detectDevice,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", verifyFirebaseToken, detectDevice, registerUser);
router.post("/login", verifyToken, detectDevice, loginUser);
router.post("/logout", verifyToken, logoutUser);
router.get("/me", verifyToken, getMe);
router.patch(
  "/set-role",
  verifyToken,
  requireRole("admin"),
  setUserRole
);

export default router;
