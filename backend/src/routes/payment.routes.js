import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import {
  initiatePayment,
  uploadPaymentReceipt,
  getPaymentStatus,
  getMyPayments,
  getMyInstallments,
  getPaymentMethodsConfig,
} from "../controllers/payment.controller.js";
import { validatePromoCode } from "../controllers/admin.controller.js";

const router = Router();

router.post("/initiate", verifyToken, initiatePayment);
router.post("/validate-promo", verifyToken, validatePromoCode);
router.get("/config", verifyToken, getPaymentMethodsConfig);
router.post("/:id/receipt", verifyToken, uploadPaymentReceipt);
router.get("/:id/status", verifyToken, getPaymentStatus);
router.get("/my-payments", verifyToken, getMyPayments);
router.get("/my-installments", verifyToken, getMyInstallments);

export default router;
