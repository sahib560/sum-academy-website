import api from "../api/axios.js";

export const getDashboardStats = () =>
  api.get("/admin/stats").then((r) => r.data.data);

export const getRevenueChart = (days = 7) =>
  api.get(`/admin/revenue-chart?days=${days}`).then((r) => r.data.data);

export const getRecentEnrollments = () =>
  api.get("/admin/recent-enrollments").then((r) => r.data.data);

export const getTopCourses = () =>
  api.get("/admin/top-courses").then((r) => r.data.data);

export const getRecentActivity = () =>
  api.get("/admin/recent-activity").then((r) => r.data.data);

export const getAnalyticsReport = (days = 30) =>
  api.get(`/admin/analytics-report?days=${days}`).then((r) => r.data.data);

export const getUsers = (params) =>
  api.get("/admin/users", { params }).then((r) => r.data.data);

export const createUser = (data) =>
  api.post("/admin/users", data).then((r) => r.data);

export const updateUser = (uid, data) =>
  api.put(`/admin/users/${uid}`, data).then((r) => r.data);

export const deleteUser = (uid) =>
  api.delete(`/admin/users/${uid}`).then((r) => r.data);

export const setUserRole = (uid, role) =>
  api.patch(`/admin/users/${uid}/role`, { role }).then((r) => r.data);

export const resetUserDevice = (uid, data = { resetDevice: true }) =>
  api.patch(`/admin/users/${uid}/reset-device`, data).then((r) => r.data);

export const resetDevice = (uid) =>
  api.patch(`/admin/users/${uid}/reset-device`, {}).then((r) => r.data);

export const getTeachers = () =>
  api.get("/admin/teachers").then((r) => r.data.data);

export const getStudents = () =>
  api.get("/admin/students").then((r) => r.data.data);

export const approveStudent = (uid) =>
  api.patch(`/admin/students/${uid}/approve`).then((r) => r.data);

export const rejectStudent = (uid, reason = "") =>
  api.patch(`/admin/students/${uid}/reject`, { reason }).then((r) => r.data);

export const downloadStudentsBulkTemplate = async () => {
  const response = await api.get("/admin/students/template", {
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const disposition = response.headers?.["content-disposition"] || "";
  const nameMatch = disposition.match(/filename="?([^"]+)"?/i);
  link.href = url;
  link.download = nameMatch?.[1] || "Students_Bulk_Template.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const bulkUploadStudents = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api
    .post("/admin/students/bulk-upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

export const getCourses = () =>
  api.get("/admin/courses").then((r) => r.data.data);

export const getAdminVideos = () =>
  api.get("/admin/videos").then((r) => r.data.data || []);

export const createAdminVideo = (data) =>
  api.post("/admin/videos", data).then((r) => r.data);

export const createCourse = (data) =>
  api.post("/admin/courses", data).then((r) => r.data);

export const updateCourse = (id, data) =>
  api.put(`/admin/courses/${id}`, data).then((r) => r.data);

export const patchCourse = (id, data) =>
  api.patch(`/admin/courses/${id}`, data).then((r) => r.data);

export const deleteCourse = (id) =>
  api.delete(`/admin/courses/${id}`).then((r) => r.data);

export const addCourseSubject = (courseId, data) =>
  api.post(`/admin/courses/${courseId}/subjects`, data).then((r) => r.data);

export const removeCourseSubject = (courseId, subjectId) =>
  api
    .delete(`/admin/courses/${courseId}/subjects/${subjectId}`)
    .then((r) => r.data);

export const addCourseContent = (courseId, subjectId, data) =>
  api
    .post(`/admin/courses/${courseId}/subjects/${subjectId}/content`, data)
    .then((r) => r.data);

export const getCourseContent = (courseId) =>
  api.get(`/admin/courses/${courseId}/content`).then((r) => r.data.data);

export const deleteCourseContent = (courseId, contentId) =>
  api
    .delete(`/admin/courses/${courseId}/content/${contentId}`)
    .then((r) => r.data);

export const getClasses = () =>
  api.get("/admin/classes").then((r) => r.data.data);

export const createClass = (data) =>
  api.post("/admin/classes", data).then((r) => r.data);

export const updateClass = (id, data) =>
  api.put(`/admin/classes/${id}`, data).then((r) => r.data);

export const deleteClass = (id) =>
  api.delete(`/admin/classes/${id}`).then((r) => r.data);

export const addClassCourse = (classId, courseId) =>
  api
    .post(`/admin/classes/${classId}/courses`, { courseId })
    .then((r) => r.data);

export const removeClassCourse = (classId, courseId) =>
  api
    .delete(`/admin/classes/${classId}/courses/${courseId}`)
    .then((r) => r.data);

export const addClassShift = (classId, data) =>
  api
    .post(`/admin/classes/${classId}/shifts`, data)
    .then((r) => r.data);

export const updateClassShift = (classId, shiftId, data) =>
  api
    .put(`/admin/classes/${classId}/shifts/${shiftId}`, data)
    .then((r) => r.data);

export const deleteClassShift = (classId, shiftId) =>
  api
    .delete(`/admin/classes/${classId}/shifts/${shiftId}`)
    .then((r) => r.data);

export const addStudentToClass = (classId, data) =>
  api
    .post(`/admin/classes/${classId}/students`, data)
    .then((r) => r.data);

export const getClassStudents = (classId) =>
  api
    .get(`/admin/classes/${classId}/students`)
    .then((r) => r.data.data);

export const removeStudentFromClass = (classId, studentId) =>
  api
    .delete(`/admin/classes/${classId}/students/${studentId}`)
    .then((r) => r.data);

export const getAvailableClasses = (courseIdOrParams) => {
  const params =
    courseIdOrParams && typeof courseIdOrParams === "object"
      ? courseIdOrParams
      : { courseId: courseIdOrParams };
  return api.get("/classes/available", { params }).then((r) => r.data.data);
};

export const getCourseCatalog = () =>
  api.get("/classes/catalog").then((r) => r.data.data || []);

export const enrollInClass = (classId, studentId) =>
  addStudentToClass(classId, { studentId });

export const removeFromClass = (classId, studentId) =>
  removeStudentFromClass(classId, studentId);

export const getPayments = (params) =>
  api.get("/admin/payments", { params }).then((r) => r.data.data);

export const verifyBankTransfer = (id, action) =>
  api.patch(`/admin/payments/${id}/verify`, { action }).then((r) => r.data);

export const getInstallments = () =>
  api.get("/admin/installments").then((r) => r.data.data);

export const createInstallmentPlan = (data) =>
  api.post("/admin/installments", data).then((r) => r.data);

export const markInstallmentPaid = (planId, number) =>
  api.patch(`/admin/installments/${planId}/${number}/pay`).then((r) => r.data);

export const sendInstallmentReminders = () =>
  api.post("/admin/installments/send-reminders").then((r) => r.data);

export const getPromoCodes = () =>
  api.get("/admin/promo-codes").then((r) => r.data.data);

export const createPromoCode = (data) =>
  api.post("/admin/promo-codes", data).then((r) => r.data);

export const updatePromoCode = (id, data) =>
  api.put(`/admin/promo-codes/${id}`, data).then((r) => r.data);

export const deletePromoCode = (id) =>
  api.delete(`/admin/promo-codes/${id}`).then((r) => r.data);

export const togglePromoCode = (id, isActive) =>
  api.patch(`/admin/promo-codes/${id}/toggle`, { isActive }).then((r) => r.data);

export const validatePromoCode = (code, courseId) =>
  api.post("/admin/promo-codes/validate", { code, courseId }).then((r) => r.data);

export const getCertificates = () =>
  api.get("/admin/certificates").then((r) => r.data.data);

export const generateCertificate = (data) =>
  api.post("/admin/certificates", data).then((r) => r.data);

export const revokeCertificate = (certId) =>
  api.patch(`/admin/certificates/${certId}/revoke`).then((r) => r.data);

export const unrevokeCertificate = (certId) =>
  api.patch(`/admin/certificates/${certId}/unrevoke`).then((r) => r.data);

export const verifyCertificatePublic = (certId) =>
  api.get(`/verify/${certId}`).then((r) => r.data.data);

export const getAnnouncements = () =>
  api.get("/admin/announcements").then((r) => r.data.data);

export const getSupportMessages = (params = {}) =>
  api.get("/admin/support/messages", { params }).then((r) => r.data.data || []);

export const markSupportMessageRead = (messageId, isRead = true) =>
  api
    .patch(`/admin/support/messages/${messageId}/read`, { isRead })
    .then((r) => r.data.data || r.data);

export const deleteSupportMessage = (messageId) =>
  api.delete(`/admin/support/messages/${messageId}`).then((r) => r.data.data || r.data);

export const replySupportMessage = (messageId, replyMessage) =>
  api
    .post(`/admin/support/messages/${messageId}/reply`, { replyMessage })
    .then((r) => r.data.data || r.data);

export const getAdminQuizzes = () =>
  api.get("/admin/quizzes").then((r) => r.data.data);

export const getAdminQuizById = (quizId) =>
  api.get(`/admin/quizzes/${quizId}`).then((r) => r.data.data);

export const getAdminQuizAnalytics = (quizId) =>
  api.get(`/admin/quizzes/${quizId}/analytics`).then((r) => r.data.data);

export const createAdminQuiz = (data) =>
  api.post("/admin/quizzes", data).then((r) => r.data);

export const assignAdminQuiz = (quizId, data) =>
  api.patch(`/admin/quizzes/${quizId}/assign`, data).then((r) => r.data);

export const getAdminQuizSubmissions = (quizId) =>
  api.get(`/admin/quizzes/${quizId}/submissions`).then((r) => r.data.data);

export const bulkUploadAdminQuiz = (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append("file", file);
  return api
    .post("/admin/quizzes/bulk-upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    })
    .then((r) => r.data);
};

export const downloadAdminQuizTemplate = async (params) => {
  const response = await api.get("/admin/quizzes/template", {
    params,
    responseType: "blob",
  });
  return {
    blob: response.data,
    filename: "quiz_template.csv",
  };
};

export const createAnnouncement = (data) =>
  api.post("/admin/announcements", data).then((r) => r.data);

export const updateAnnouncement = (id, data) =>
  api.put(`/admin/announcements/${id}`, data).then((r) => r.data);

export const deleteAnnouncement = (id) =>
  api.delete(`/admin/announcements/${id}`).then((r) => r.data);

export const toggleAnnouncementPin = (id, isPinned) =>
  api.patch(`/admin/announcements/${id}/pin`, { isPinned }).then((r) => r.data);

export const getMyAnnouncements = () =>
  api.get("/announcements/my").then((r) => r.data.data);

export const markAnnouncementRead = (id) =>
  api.patch(`/announcements/${id}/read`).then((r) => r.data);

export const markAllAnnouncementsRead = () =>
  api.patch("/announcements/read-all").then((r) => r.data);

export const getSiteSettings = () =>
  api.get("/admin/settings").then((r) => r.data.data);

export const getPublicSettings = () =>
  api.get("/settings").then((r) => r.data.data);

export const updateGeneralSettings = (data) =>
  api.put("/admin/settings/general", data).then((r) => r.data);

export const updateHeroSettings = (data) =>
  api.put("/admin/settings/hero", data).then((r) => r.data);

export const updateHowItWorksSettings = (data) =>
  api.put("/admin/settings/how-it-works", data).then((r) => r.data);

export const updateFeaturesSettings = (data) =>
  api.put("/admin/settings/features", data).then((r) => r.data);

export const updateTestimonialsSettings = (data) =>
  api.put("/admin/settings/testimonials", data).then((r) => r.data);

export const updateAboutSettings = (data) =>
  api.put("/admin/settings/about", data).then((r) => r.data);

export const updateContactSettings = (data) =>
  api.put("/admin/settings/contact", data).then((r) => r.data);

export const updateFooterSettings = (data) =>
  api.put("/admin/settings/footer", data).then((r) => r.data);

export const updateEmailSettings = (data) =>
  api.put("/admin/settings/email", data).then((r) => r.data);

export const testEmailSettings = (testEmail) =>
  api.post("/admin/settings/email/test", { testEmail }).then((r) => r.data);

export const updatePaymentSettings = (data) =>
  api.put("/admin/settings/payment", data).then((r) => r.data);

export const updateSecuritySettings = (data) =>
  api.put("/admin/settings/security", data).then((r) => r.data);

export const updateAppearanceSettings = (data) =>
  api.put("/admin/settings/appearance", data).then((r) => r.data);

export const updateCertificateSettings = (data) =>
  api.put("/admin/settings/certificate", data).then((r) => r.data);

export const updateMaintenanceSettings = (data) =>
  api.put("/admin/settings/maintenance", data).then((r) => r.data);

export const getEmailTemplates = () =>
  api.get("/admin/settings/templates").then((r) => r.data.data);

export const updateEmailTemplate = (data) =>
  api.put("/admin/settings/templates", data).then((r) => r.data);

export const updateSiteSettings = (data) => {
  if (data?.general) return updateGeneralSettings(data.general);
  if (data?.email) return updateEmailSettings(data.email);
  if (data?.payment || data?.paymentSettings) {
    return updatePaymentSettings(data.payment || data.paymentSettings);
  }
  if (data?.security) return updateSecuritySettings(data.security);
  if (data?.appearance) return updateAppearanceSettings(data.appearance);
  if (data?.certificate) return updateCertificateSettings(data.certificate);
  return updateGeneralSettings(data);
};
