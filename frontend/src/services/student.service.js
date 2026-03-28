import api from "../api/axios.js";

export const getStudentDashboard = () =>
  api.get("/student/dashboard").then((r) => r.data.data);

export const getStudentCourses = () =>
  api.get("/student/courses").then((r) => r.data.data);

export const getCourseProgress = (courseId) =>
  api.get(`/student/courses/${courseId}/progress`).then((r) => r.data.data);

export const markLectureComplete = (courseId, lectureId) =>
  api.post(`/student/courses/${courseId}/lectures/${lectureId}/complete`).then((r) => r.data);

export const exploreCourses = (params) =>
  api.get("/courses/explore", { params }).then((r) => r.data.data);

export const getStudentCertificates = () =>
  api.get("/student/certificates").then((r) => r.data.data);

export const getStudentQuizzes = () =>
  api.get("/student/quizzes").then((r) => r.data.data);

export const getQuizById = (quizId) =>
  api.get(`/student/quizzes/${quizId}`).then((r) => r.data.data);

export const submitQuizAttempt = (quizId, answers) =>
  api.post(`/student/quizzes/${quizId}/submit`, { answers }).then((r) => r.data);

export const getStudentAnnouncements = () =>
  api.get("/student/announcements").then((r) => r.data.data);

export const markAnnouncementRead = (id) =>
  api.patch(`/student/announcements/${id}/read`).then((r) => r.data);

export const getStudentAttendance = () =>
  api.get("/student/attendance").then((r) => r.data.data);

export const getStudentSettings = () =>
  api.get("/student/settings").then((r) => r.data.data);

export const updateStudentSettings = (data) =>
  api.put("/student/settings", data).then((r) => r.data);

export const submitStudentHelpSupport = (data) =>
  api.post("/student/help-support", data).then((r) => r.data);
