/**
 * firebaseUpload.js
 * All uploads now go through the backend API → Cloudflare R2.
 * Firebase Storage is no longer used for any uploads.
 */
import api from "../api/axios.js";

// ─── Thumbnail ────────────────────────────────────────────────────────────────
export const uploadThumbnail = async (file, courseId = "general", onProgress) => {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file?.type)) {
    throw new Error("Only JPG, PNG, WEBP allowed for thumbnails");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Thumbnail max size is 5MB");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/upload/thumbnail", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (event.total && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  const url = response.data?.data?.url || response.data?.url || "";
  return { url, name: file.name, size: file.size, type: file.type, path: url };
};

// ─── PDF ──────────────────────────────────────────────────────────────────────
export const uploadCoursePDF = async (file, courseId, subjectId, onProgress) => {
  if (file?.type !== "application/pdf") {
    throw new Error("Only PDF files allowed");
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("PDF max size is 50MB");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("courseId", courseId || "general");
  formData.append("subjectId", subjectId || "general");

  const response = await api.post("/upload/pdf", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (event.total && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  const data = response.data?.data || response.data || {};
  const url = data?.url || "";
  return { url, name: file.name, size: file.size, type: file.type, path: url };
};

// ─── Video (via backend, disk-storage → R2) ───────────────────────────────────
export const uploadCourseVideo = async (file, courseId, subjectId, onProgress) => {
  const allowed = ["video/mp4", "video/avi", "video/x-msvideo", "video/quicktime", "video/mov", "video/webm"];
  if (!allowed.includes(file?.type)) {
    throw new Error("Only MP4, AVI, MOV videos allowed");
  }
  if (file.size > 2 * 1024 * 1024 * 1024) {
    throw new Error("Video max size is 2GB");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("courseId", courseId || "");
  formData.append("subjectId", subjectId || "");

  const response = await api.post("/upload/video", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (event.total && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  const data = response.data?.data || response.data || {};
  const url = data?.url || "";
  return { url, name: file.name, size: file.size, type: file.type, path: url };
};

// ─── Payment Receipt ──────────────────────────────────────────────────────────
export const uploadPaymentReceipt = async (file, paymentId, onProgress) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"];
  if (!allowed.includes(file?.type)) {
    throw new Error("Only JPG, PNG or PDF receipts allowed");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Receipt max size is 10MB");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post(`/payments/${paymentId}/receipt`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (event.total && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  const data = response.data?.data || response.data || {};
  const url = data?.url || "";
  return { url, name: file.name, size: file.size, type: file.type, path: url };
};

// ─── Logo ─────────────────────────────────────────────────────────────────────
export const uploadLogo = async (file, onProgress) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
  if (!allowed.includes(file?.type)) {
    throw new Error("Only JPG, PNG, WEBP, SVG allowed for logo");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Logo max size is 2MB");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/upload/logo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (event.total && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  const data = response.data?.data || response.data || {};
  const url = data?.url || "";
  return { url, name: file.name, size: file.size, type: file.type, path: url };
};

// ─── Generic image upload (favicon, certificate images, etc.) ─────────────────
export const uploadGenericImage = async (file, subfolder = "images", onProgress) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
  if (!allowed.includes(file?.type)) {
    throw new Error("Unsupported image type");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Image max size is 2MB");
  }

  const formData = new FormData();
  formData.append("file", file);

  // Re-use the thumbnail endpoint for generic images (same validation on backend)
  const response = await api.post("/upload/thumbnail", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (event.total && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  const data = response.data?.data || response.data || {};
  const url = data?.url || "";
  return { url, name: file.name, size: file.size, type: file.type, path: url };
};

// ─── uploadToStorage generic (kept for backwards compat) ─────────────────────
export const uploadToStorage = async ({ file, path, onProgress }) => {
  // Route to appropriate upload based on file type
  if (file?.type?.startsWith("video/")) {
    return uploadCourseVideo(file, "library", "general", onProgress);
  }
  if (file?.type === "application/pdf") {
    return uploadCoursePDF(file, "general", "general", onProgress);
  }
  return uploadGenericImage(file, "images", onProgress);
};

// ─── Delete (no-op: deletion is handled server-side) ─────────────────────────
export const deleteFromStorage = async (_filePath) => {
  // Files are now on R2. Deletion is handled server-side via /upload/file endpoint.
  // We keep this as a no-op to avoid breaking callers.
};
