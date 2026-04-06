import api from "../api/axios.js";

export const getCourseContent = (courseId) =>
  api.get(`/student/courses/${courseId}/content`).then((r) => r.data.data);

export const markLectureComplete = (courseId, lectureId, watchedPercent = 0) =>
  api
    .post(`/student/courses/${courseId}/lectures/${lectureId}/complete`, {
      watchedPercent,
    })
    .then((r) => r.data.data);

export const saveWatchProgress = (courseId, lectureId, percent) =>
  api
    .patch(`/student/courses/${courseId}/lectures/${lectureId}/progress`, {
      watchedPercent: percent,
    })
    .then((r) => r.data);

export const updateVideoAccess = (courseId, studentId, lectureAccess) =>
  api
    .patch(`/courses/${courseId}/students/${studentId}/video-access`, { lectureAccess })
    .then((r) => r.data);

export const unlockAllVideos = (courseId, studentId) =>
  api.post(`/courses/${courseId}/students/${studentId}/unlock-all`).then((r) => r.data);

export const getStudentProgress = (courseId, studentId) =>
  api.get(`/courses/${courseId}/students/${studentId}/progress`).then((r) => r.data.data);
