import api from "../api/axios.js";

export const getTeacherDashboard = () =>
  api.get("/teacher/dashboard").then((response) => response.data?.data || {});
