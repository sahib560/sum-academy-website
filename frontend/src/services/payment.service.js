import api from "../api/axios.js";

export const initiatePayment = (data) =>
  api.post("/payments/initiate", data).then((r) => r.data.data);

export const getPaymentConfig = () =>
  api.get("/payments/config").then((r) => r.data.data);

export const uploadPaymentReceipt = (paymentId, receiptUrl) =>
  api
    .post(`/payments/${paymentId}/receipt`, { receiptUrl })
    .then((r) => r.data.data);

export const getPaymentStatus = (paymentId) =>
  api.get(`/payments/${paymentId}/status`).then((r) => r.data.data);

export const getMyPayments = () =>
  api.get("/payments/my-payments").then((r) => r.data.data || []);

export const getMyInstallments = () =>
  api.get("/payments/my-installments").then((r) => r.data.data || []);

export const getAdminPayments = (params = {}) =>
  api.get("/admin/payments", { params }).then((r) => r.data.data || []);

export const verifyPayment = (paymentId, action) =>
  api.patch(`/admin/payments/${paymentId}/verify`, { action }).then((r) => r.data);

export const getInstallmentsAdmin = () =>
  api.get("/admin/installments").then((r) => r.data.data || []);

export const createInstallmentPlan = (data) =>
  api.post("/admin/installments", data).then((r) => r.data);

export const markInstallmentPaid = (planId, number) =>
  api.patch(`/admin/installments/${planId}/${number}/pay`).then((r) => r.data);

export const sendInstallmentReminders = () =>
  api.post("/admin/installments/send-reminders").then((r) => r.data);

export const validatePromoCode = (code, courseId) =>
  api
    .post("/payments/validate-promo", {
      code: String(code || "").toUpperCase(),
      courseId,
    })
    .then((r) => r.data.data);
