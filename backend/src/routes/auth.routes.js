import { Router } from "express";
import {
  sendRegistrationOtp,
  verifyRegistrationOtp,
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  setUserRole,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetForgotPassword,
} from "../controllers/auth.controller.js";
import {
  verifyToken,
  verifyFirebaseToken,
  requireRole,
  detectDevice,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register/send-otp", sendRegistrationOtp);
router.post("/register/verify-otp", verifyRegistrationOtp);
router.post("/register", verifyFirebaseToken, detectDevice, registerUser);
router.post("/login", verifyFirebaseToken, detectDevice, loginUser);
router.post("/forgot-password/send-otp", sendForgotPasswordOtp);
router.post("/forgot-password/verify-otp", verifyForgotPasswordOtp);
router.post("/forgot-password/reset", resetForgotPassword);
router.post("/logout", verifyToken, logoutUser);
router.get("/me", verifyToken, detectDevice, getMe);
router.patch(
  "/set-role",
  verifyToken,
  requireRole("admin"),
  setUserRole
);

export default router;
