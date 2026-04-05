import {
  uploadToStorage,
  uploadThumbnail as uploadThumbnailV2,
  uploadCoursePDF,
  uploadCourseVideo,
  uploadPaymentReceipt as uploadPaymentReceiptV2,
  uploadLogo as uploadLogoV2,
  deleteFromStorage,
} from "./firebaseUpload.js";

export const uploadThumbnail = async (file, courseId, onProgress) =>
  uploadThumbnailV2(file, courseId, onProgress);

export const uploadPDF = async (file, courseId, subjectId, onProgress) =>
  uploadCoursePDF(file, courseId, subjectId, onProgress);

export const uploadVideo = async (file, courseId, subjectId, onProgress) =>
  uploadCourseVideo(file, courseId, subjectId, onProgress);

export const uploadReceipt = async (file, paymentOrStudentId, onProgress) =>
  uploadPaymentReceiptV2(file, paymentOrStudentId, onProgress);

export const uploadLogo = async (file, onProgress) =>
  uploadLogoV2(file, onProgress);

export const deleteFile = async (filePath) => deleteFromStorage(filePath);

export const FILE_LIMITS = {
  MAX_VIDEO_SIZE: 2 * 1024 * 1024 * 1024,
  MAX_PDF_SIZE: 50 * 1024 * 1024,
  MAX_THUMBNAIL_SIZE: 5 * 1024 * 1024,
  MAX_RECEIPT_SIZE: 10 * 1024 * 1024,
  MAX_LOGO_SIZE: 2 * 1024 * 1024,
};

export { uploadToStorage };
