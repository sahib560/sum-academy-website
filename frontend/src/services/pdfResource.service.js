import api from "../api/axios.js";

const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * Public PDF Resource Service Methods
 */
export const getPublicPdfResources = async (params = {}) => {
  const response = await api.get("/public/pdf-resources", { params });
  return response.data?.data || { resources: [], pagination: {}, filters: {} };
};

export const getPublicPdfResourceById = async (id) => {
  const response = await api.get(`/public/pdf-resources/${id}`);
  return response.data?.data || null;
};

export const getPublicPdfPreviewUrl = (id) => {
  const cleanBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  return `${cleanBase}/public/pdf-resources/${id}/preview`;
};

export const getPublicPdfDownloadUrl = (id) => {
  const cleanBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  return `${cleanBase}/public/pdf-resources/${id}/download`;
};

/**
 * Admin PDF Resource Service Methods
 */
export const getAdminPdfResources = async (params = {}) => {
  const response = await api.get("/admin/pdf-resources", { params });
  return response.data?.data || { resources: [], pagination: {}, filters: {} };
};

export const getAdminPdfResourceStats = async () => {
  const response = await api.get("/admin/pdf-resources/stats");
  return response.data?.data || {
    total: 0,
    published: 0,
    draft: 0,
    archived: 0,
    totalDownloads: 0,
    totalBytes: 0,
  };
};

export const getAdminPdfResourceById = async (id) => {
  const response = await api.get(`/admin/pdf-resources/${id}`);
  return response.data?.data || null;
};

export const getAdminPdfPreviewUrl = (id) => {
  const cleanBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  return `${cleanBase}/admin/pdf-resources/${id}/preview`;
};

export const createPdfResource = async (formData, onUploadProgress) => {
  const response = await api.post("/admin/pdf-resources", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });
  return response.data?.data || null;
};

export const updatePdfResource = async (id, formData, onUploadProgress) => {
  const response = await api.patch(`/admin/pdf-resources/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });
  return response.data?.data || null;
};

export const updatePdfResourceStatus = async (id, status) => {
  const response = await api.patch(`/admin/pdf-resources/${id}/status`, { status });
  return response.data?.data || null;
};

export const deletePdfResource = async (id) => {
  const response = await api.delete(`/admin/pdf-resources/${id}`);
  return response.data?.data || null;
};
