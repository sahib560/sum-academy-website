import { Router } from "express";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";
import {
  initiatePayment,
  getPaymentStatus,
  getMyPayments,
  getMyInstallments,
  getPaymentMethodsConfig,
  getAdminPayments,
  verifyBankTransfer,
  getInstallments,
  getInstallmentById,
  createInstallmentPlan,
  markInstallmentPaid,
  sendInstallmentReminders,
  overrideInstallment,
  finishPaymentRequest,
} from "../controllers/payment.controller.js";
import { validatePromoCode } from "../controllers/admin.controller.js";

const studentPaymentRoutes = Router();
const adminPaymentRoutes = Router();

const adminOnly = [verifyToken, requireRole("admin")];

studentPaymentRoutes.post("/initiate", verifyToken, initiatePayment);
studentPaymentRoutes.post("/validate-promo", verifyToken, validatePromoCode);
studentPaymentRoutes.get("/config", verifyToken, getPaymentMethodsConfig);
studentPaymentRoutes.post("/:paymentId/finish", verifyToken, finishPaymentRequest);
studentPaymentRoutes.get("/:id/status", verifyToken, getPaymentStatus);
studentPaymentRoutes.get("/my-payments", verifyToken, getMyPayments);
studentPaymentRoutes.get("/my-installments", verifyToken, getMyInstallments);

adminPaymentRoutes.get("/payments", adminOnly, getAdminPayments);
adminPaymentRoutes.patch("/payments/:id/verify", adminOnly, verifyBankTransfer);

adminPaymentRoutes.get("/installments", adminOnly, getInstallments);
adminPaymentRoutes.get("/installments/:planId", adminOnly, getInstallmentById);
adminPaymentRoutes.patch(
  "/installments/:planId/:number/pay",
  adminOnly,
  markInstallmentPaid
);
adminPaymentRoutes.post(
  "/installments/send-reminders",
  adminOnly,
  sendInstallmentReminders
);
adminPaymentRoutes.put("/installments/:planId/override", adminOnly, overrideInstallment);
adminPaymentRoutes.post("/installments", adminOnly, createInstallmentPlan);

export { adminPaymentRoutes };
export default studentPaymentRoutes;

