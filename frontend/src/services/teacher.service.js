import api from "../api/axios.js";

export const getTeacherDashboard = () =>
  api.get("/teacher/dashboard").then((response) => response.data?.data || {});

export const getTeacherCourses = () =>
  api.get("/teacher/courses").then((r) => r.data.data);

export const getTeacherVideos = () =>
  api.get("/teacher/videos").then((r) => r.data.data || []);

export const createTeacherVideo = (data) =>
  api.post("/teacher/videos", data).then((r) => r.data);

export const getTeacherCourseById = (courseId) =>
  api.get(`/teacher/courses/${courseId}`).then((r) => r.data.data);

export const getChapters = (courseId, subjectId) =>
  api
    .get(`/teacher/courses/${courseId}/subjects/${subjectId}/chapters`)
    .then((r) => r.data.data);

export const addChapter = (courseId, subjectId, data) =>
  api
    .post(`/teacher/courses/${courseId}/subjects/${subjectId}/chapters`, data)
    .then((r) => r.data);

export const updateChapter = (chapterId, data) =>
  api.put(`/teacher/chapters/${chapterId}`, data).then((r) => r.data);

export const deleteChapter = (chapterId) =>
  api.delete(`/teacher/chapters/${chapterId}`).then((r) => r.data);

export const getLectures = (chapterId) =>
  api.get(`/teacher/chapters/${chapterId}/lectures`).then((r) => r.data.data);

export const addLecture = (chapterId, data) =>
  api.post(`/teacher/chapters/${chapterId}/lectures`, data).then((r) => r.data);

export const updateLecture = (lectureId, data) =>
  api.put(`/teacher/lectures/${lectureId}`, data).then((r) => r.data);

export const deleteLecture = (lectureId) =>
  api.delete(`/teacher/lectures/${lectureId}`).then((r) => r.data);

export const saveLectureContent = (lectureId, data) =>
  api.post(`/teacher/lectures/${lectureId}/content`, data).then((r) => r.data);

export const deleteLectureContent = (lectureId, contentId, type) =>
  api
    .delete(`/teacher/lectures/${lectureId}/content/${contentId}`, {
      data: { type },
    })
    .then((r) => r.data);

export const getCourseStudents = (courseId) =>
  api.get(`/teacher/courses/${courseId}/students`).then((r) => r.data.data);

export const updateVideoAccess = (courseId, studentId, data) =>
  api
    .patch(`/teacher/courses/${courseId}/students/${studentId}/video-access`, data)
    .then((r) => r.data);

export const updateCourseRewatchAccess = (courseId, studentId, data) =>
  api
    .patch(`/teacher/courses/${courseId}/students/${studentId}/rewatch-access`, data)
    .then((r) => r.data);

export const getFinalQuizRequests = (params) =>
  api.get("/teacher/final-quiz-requests", { params }).then((r) => r.data.data);

export const updateFinalQuizRequestStatus = (requestId, data) =>
  api
    .patch(`/teacher/final-quiz-requests/${requestId}`, data)
    .then((r) => r.data);

export const getTeacherStudents = () =>
  api.get("/teacher/students").then((r) => r.data.data);

export const getTeacherStudentById = (studentId) =>
  api.get(`/teacher/students/${studentId}`).then((r) => r.data.data);

export const getStudentProgress = (studentId, courseId) =>
  api
    .get(`/teacher/students/${studentId}/progress/${courseId}`)
    .then((r) => r.data.data);

export const updateStudentVideoAccess = (studentId, data) =>
  api.patch(`/teacher/students/${studentId}/video-access`, data).then((r) => r.data);

export const getStudentAttendance = (studentId, classId) =>
  api
    .get(`/teacher/students/${studentId}/attendance/${classId}`)
    .then((r) => r.data.data);

export const getTeacherSessions = () =>
  api.get("/teacher/sessions").then((r) => r.data.data);

export const getSessionById = (sessionId) =>
  api.get(`/teacher/sessions/${sessionId}`).then((r) => r.data.data);

export const createSession = (data) =>
  api.post("/teacher/sessions", data).then((r) => r.data);

export const updateSession = (sessionId, data) =>
  api.put(`/teacher/sessions/${sessionId}`, data).then((r) => r.data);

export const cancelSession = (sessionId, data) =>
  api.patch(`/teacher/sessions/${sessionId}/cancel`, data).then((r) => r.data);

export const markSessionComplete = (sessionId, data) =>
  api.patch(`/teacher/sessions/${sessionId}/complete`, data).then((r) => r.data);

export const getSessionAttendance = (sessionId) =>
  api.get(`/teacher/sessions/${sessionId}/attendance`).then((r) => r.data.data);

export const saveSessionAttendance = (sessionId, data) =>
  api.post(`/teacher/sessions/${sessionId}/attendance`, data).then((r) => r.data);

export const getTeacherClasses = () =>
  api.get("/teacher/classes").then((r) => r.data.data);

export const getTeacherTimetable = () =>
  api.get("/teacher/timetable").then((r) => r.data.data);

export const createTeacherAnnouncement = (data) =>
  api.post("/teacher/announcements", data).then((r) => r.data);

export const getTeacherAnnouncements = () =>
  api.get("/teacher/announcements").then((r) => r.data.data);

export const getTeacherSettingsProfile = () =>
  api.get("/teacher/settings/profile").then((r) => r.data.data);

export const updateTeacherSettingsProfile = (data) =>
  api.put("/teacher/settings/profile", data).then((r) => r.data.data);

export const getTeacherSettingsSecurity = () =>
  api.get("/teacher/settings/security").then((r) => r.data.data);

export const revokeTeacherSession = (sessionDocId) =>
  api
    .patch(`/teacher/settings/security/sessions/${sessionDocId}/revoke`)
    .then((r) => r.data);

export const revokeTeacherOtherSessions = () =>
  api.patch("/teacher/settings/security/sessions/revoke-all").then((r) => r.data);

export const getTeacherQuizzes = () =>
  api.get("/teacher/quizzes").then((r) => r.data.data);

export const getTeacherTests = () =>
  api.get("/teacher/tests").then((r) => r.data.data || []);

export const createTeacherTest = (data) =>
  api.post("/teacher/tests", data).then((r) => r.data);

export const getTeacherTestById = (testId) =>
  api.get(`/teacher/tests/${testId}`).then((r) => r.data.data || {});

export const getTeacherTestRanking = (testId) =>
  api.get(`/teacher/tests/${testId}/ranking`).then((r) => r.data.data || {});

export const getTeacherQuizById = (quizId) =>
  api.get(`/teacher/quizzes/${quizId}`).then((r) => r.data.data);

export const getTeacherQuizAnalytics = (quizId) =>
  api.get(`/teacher/quizzes/${quizId}/analytics`).then((r) => r.data.data);

export const assignTeacherQuiz = (quizId, data) =>
  api.patch(`/teacher/quizzes/${quizId}/assign`, data).then((r) => r.data);

export const createTeacherQuiz = (data) =>
  api.post("/teacher/quizzes", data).then((r) => r.data);

export const bulkUploadTeacherQuiz = (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append("file", file);
  return api
    .post("/teacher/quizzes/bulk-upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    })
    .then((r) => r.data);
};

export const downloadTeacherQuizTemplate = async (params) => {
  const response = await api.get("/teacher/quizzes/template", {
    params,
    responseType: "blob",
  });
  const disposition = String(response.headers?.["content-disposition"] || "");
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^"]+)"?/i);
  const rawName = utfMatch?.[1] || plainMatch?.[1] || "quiz_template.csv";
  let filename = String(rawName).trim();
  try {
    filename = decodeURIComponent(filename);
  } catch {
    filename = String(rawName).trim();
  }

  return {
    blob: response.data,
    filename,
  };
};

export const previewTeacherQuizEvaluation = (quizId, data) =>
  api.post(`/teacher/quizzes/${quizId}/evaluate`, data).then((r) => r.data.data);

export const submitTeacherQuizAttempt = (quizId, data) =>
  api.post(`/teacher/quizzes/${quizId}/submissions`, data).then((r) => r.data);

export const getTeacherQuizSubmissions = (quizId) =>
  api.get(`/teacher/quizzes/${quizId}/submissions`).then((r) => r.data.data);

export const gradeTeacherShortAnswers = (quizId, resultId, data) =>
  api
    .patch(`/teacher/quizzes/${quizId}/submissions/${resultId}/grade-short`, data)
    .then((r) => r.data);
