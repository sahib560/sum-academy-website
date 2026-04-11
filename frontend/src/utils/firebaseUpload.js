import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { app } from "../config/firebase.js";

const storage = getStorage(app);

const sanitizeName = (value = "file") =>
  String(value || "file").replace(/[^a-zA-Z0-9._-]/g, "_");

export const uploadToStorage = async ({ file, path, onProgress }) =>
  new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    // Ensure correct metadata so browsers can stream videos reliably (especially on mobile).
    const metadata = {
      contentType: file?.type || "application/octet-stream",
      contentDisposition: "inline",
      // Small cache to reduce repeated fetches while still allowing updates.
      cacheControl: "public, max-age=3600",
    };
    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const pct = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        if (typeof onProgress === "function") onProgress(pct);
      },
      (error) => {
        console.error("Upload error:", error);
        reject(error);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({
          url,
          path,
          name: file.name,
          size: file.size,
          type: file.type,
        });
      }
    );
  });

export const uploadThumbnail = async (file, courseId = "general", onProgress) => {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file?.type)) {
    throw new Error("Only JPG, PNG, WEBP allowed for thumbnails");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Thumbnail max size is 5MB");
  }
  const path = `thumbnails/${courseId}/${Date.now()}-${sanitizeName(file.name)}`;
  return uploadToStorage({ file, path, onProgress });
};

export const uploadCoursePDF = async (
  file,
  courseId,
  subjectId,
  onProgress
) => {
  if (file?.type !== "application/pdf") {
    throw new Error("Only PDF files allowed");
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("PDF max size is 50MB");
  }
  const path = `pdfs/courses/${courseId}/subjects/${subjectId}/${Date.now()}-${sanitizeName(
    file.name
  )}`;
  return uploadToStorage({ file, path, onProgress });
};

export const uploadCourseVideo = async (
  file,
  courseId,
  subjectId,
  onProgress
) => {
  const allowed = [
    "video/mp4",
    "video/avi",
    "video/x-msvideo",
    "video/quicktime",
    "video/mov",
  ];
  if (!allowed.includes(file?.type)) {
    throw new Error("Only MP4, AVI, MOV videos allowed");
  }
  if (file.size > 2 * 1024 * 1024 * 1024) {
    throw new Error("Video max size is 2GB");
  }
  const path = `videos/courses/${courseId}/subjects/${subjectId}/${Date.now()}-${sanitizeName(
    file.name
  )}`;
  return uploadToStorage({ file, path, onProgress });
};

export const uploadPaymentReceipt = async (file, studentId, onProgress) => {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "application/pdf",
  ];
  if (!allowed.includes(file?.type)) {
    throw new Error("Only JPG, PNG or PDF receipts allowed");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Receipt max size is 10MB");
  }
  const path = `receipts/${studentId}/${Date.now()}-${sanitizeName(file.name)}`;
  return uploadToStorage({ file, path, onProgress });
};

export const uploadLogo = async (file, onProgress) => {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
  ];
  if (!allowed.includes(file?.type)) {
    throw new Error("Only JPG, PNG, WEBP, SVG allowed for logo");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Logo max size is 2MB");
  }
  const path = `logos/${Date.now()}-${sanitizeName(file.name)}`;
  return uploadToStorage({ file, path, onProgress });
};

export const deleteFromStorage = async (filePath) => {
  try {
    const fileRef = ref(storage, filePath);
    await deleteObject(fileRef);
  } catch (error) {
    console.error("Delete error:", error?.message || error);
  }
};
