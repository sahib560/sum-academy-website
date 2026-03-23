import { storage } from "../config/firebase.js";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

const VIDEO_TYPES = [
  "video/mp4",
  "video/x-msvideo",
  "video/quicktime",
];
const PDF_TYPES = ["application/pdf"];
const THUMBNAIL_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024;
const MAX_PDF_SIZE = 50 * 1024 * 1024;
const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024;

const sanitizeFilename = (name = "file") =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_");

const uploadFile = (file, path, onProgress) =>
  new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      "state_changed",
      (snapshot) => {
        const percentage = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        if (typeof onProgress === "function") {
          onProgress(percentage);
        }
      },
      (error) => reject(error),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({
            url,
            name: file.name,
            size: file.size,
            contentType: file.type,
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });

export const uploadVideo = async (
  file,
  courseId,
  subjectId,
  onProgress
) => {
  if (!VIDEO_TYPES.includes(file?.type)) {
    throw new Error("Only MP4, AVI, and MOV files are allowed.");
  }
  if (file.size > MAX_VIDEO_SIZE) {
    throw new Error("Video size must be less than 2GB.");
  }

  const filename = `${Date.now()}-${sanitizeFilename(file.name)}`;
  const path = `courses/${courseId}/subjects/${subjectId}/videos/${filename}`;
  const uploaded = await uploadFile(file, path, onProgress);

  return {
    ...uploaded,
    type: "video",
  };
};

export const uploadPDF = async (
  file,
  courseId,
  subjectId,
  onProgress
) => {
  if (!PDF_TYPES.includes(file?.type)) {
    throw new Error("Only PDF files are allowed.");
  }
  if (file.size > MAX_PDF_SIZE) {
    throw new Error("PDF size must be less than 50MB.");
  }

  const filename = `${Date.now()}-${sanitizeFilename(file.name)}`;
  const path = `courses/${courseId}/subjects/${subjectId}/pdfs/${filename}`;
  const uploaded = await uploadFile(file, path, onProgress);

  return {
    ...uploaded,
    type: "pdf",
  };
};

export const uploadThumbnail = async (file, courseId, onProgress) => {
  if (!THUMBNAIL_TYPES.includes(file?.type)) {
    throw new Error("Only JPG, PNG, and WEBP are allowed.");
  }
  if (file.size > MAX_THUMBNAIL_SIZE) {
    throw new Error("Thumbnail size must be less than 5MB.");
  }

  const filename = `${Date.now()}-${sanitizeFilename(file.name)}`;
  const path = `courses/thumbnails/${courseId}/${filename}`;
  const uploaded = await uploadFile(file, path, onProgress);

  return {
    ...uploaded,
    type: "thumbnail",
  };
};

export const deleteFile = async (url) => {
  if (!url) return;
  const fileRef = ref(storage, url);
  await deleteObject(fileRef);
};

export const FILE_LIMITS = {
  MAX_VIDEO_SIZE,
  MAX_PDF_SIZE,
  MAX_THUMBNAIL_SIZE,
};
