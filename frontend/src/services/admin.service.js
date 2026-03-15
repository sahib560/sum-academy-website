import api from "../api/axios.js";

export const getDashboardStats = async () => {
  const response = await api.get("/admin/dashboard/stats");
  return response.data;
};

export const getRecentEnrollments = async () => {
  const response = await api.get("/admin/dashboard/enrollments");
  return response.data;
};

export const getTopCourses = async () => {
  const response = await api.get("/admin/dashboard/top-courses");
  return response.data;
};

export const getRecentActivity = async () => {
  const response = await api.get("/admin/dashboard/activity");
  return response.data;
};

export const getRevenueChart = async (days = 7) => {
  const response = await api.get(
    `/admin/dashboard/revenue-chart?days=${days}`
  );
  return response.data;
};

export const getUsers = async (params) => {
  const response = await api.get("/admin/users", { params });
  return response.data;
};

export const createUser = async (data) => {
  const response = await api.post("/admin/users", data);
  return response.data;
};

export const updateUser = async (uid, data) => {
  const response = await api.put(`/admin/users/${uid}`, data);
  return response.data;
};

export const resetUserDevice = async (uid, data) => {
  const response = await api.patch(`/admin/users/${uid}/reset-device`, data);
  return response.data;
};

export const deleteUser = async (uid) => {
  const response = await api.delete(`/admin/users/${uid}`);
  return response.data;
};

export const setUserRole = async (uid, role) => {
  const response = await api.patch(`/admin/users/${uid}/role`, { role });
  return response.data;
};

export const getTeachers = async () => {
  const response = await api.get("/admin/teachers");
  return response.data;
};

export const createTeacher = async (data) => {
  const response = await api.post("/admin/teachers", data);
  return response.data;
};

export const getStudents = async () => {
  const response = await api.get("/admin/students");
  return response.data;
};

export const getCourses = async () => {
  const response = await api.get("/admin/courses");
  return response.data;
};

export const createCourse = async (data) => {
  const response = await api.post("/admin/courses", data);
  return response.data;
};

export const updateCourse = async (id, data) => {
  const response = await api.put(`/admin/courses/${id}`, data);
  return response.data;
};

export const deleteCourse = async (id) => {
  const response = await api.delete(`/admin/courses/${id}`);
  return response.data;
};

export const getClasses = async () => {
  const response = await api.get("/admin/classes");
  return response.data;
};

export const createClass = async (data) => {
  const response = await api.post("/admin/classes", data);
  return response.data;
};

export const getPayments = async (params) => {
  const response = await api.get("/admin/payments", { params });
  return response.data;
};

export const verifyBankTransfer = async (id, action) => {
  const response = await api.patch(`/admin/payments/${id}/verify`, { action });
  return response.data;
};

export const getPromoCodes = async () => {
  const response = await api.get("/admin/promo-codes");
  return response.data;
};

export const createPromoCode = async (data) => {
  const response = await api.post("/admin/promo-codes", data);
  return response.data;
};

export const getCertificates = async () => {
  const response = await api.get("/admin/certificates");
  return response.data;
};

export const getAnnouncements = async () => {
  const response = await api.get("/admin/announcements");
  return response.data;
};

export const createAnnouncement = async (data) => {
  const response = await api.post("/admin/announcements", data);
  return response.data;
};
