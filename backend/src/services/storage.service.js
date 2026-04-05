import path from "path";
import { v4 as uuidv4 } from "uuid";
import { bucket } from "../config/firebase.js";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml",
];

const ALLOWED_PDF_TYPES = ["application/pdf"];

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/avi",
  "video/x-msvideo",
  "video/quicktime",
  "video/mov",
];

const MAX_SIZES = {
  image: 5 * 1024 * 1024,
  pdf: 50 * 1024 * 1024,
  video: 2 * 1024 * 1024 * 1024,
  receipt: 10 * 1024 * 1024,
  logo: 2 * 1024 * 1024,
};

const sanitizeFolder = (value = "") =>
  String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");

export const uploadFile = async ({
  fileBuffer,
  originalName,
  mimeType,
  folder,
  maxSize,
}) => {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error("Invalid file buffer");
  }
  if (!originalName) {
    throw new Error("originalName is required");
  }
  if (!mimeType) {
    throw new Error("mimeType is required");
  }
  if (!folder) {
    throw new Error("folder is required");
  }

  const limit = Number(maxSize || 0);
  if (limit > 0 && fileBuffer.length > limit) {
    throw new Error(
      `File too large. Max size: ${Math.round(limit / 1024 / 1024)}MB`
    );
  }

  const ext = path.extname(originalName) || ".bin";
  const fileName = `${Date.now()}-${uuidv4()}${ext}`;
  const safeFolder = sanitizeFolder(folder);
  const filePath = `${safeFolder}/${fileName}`;
  const file = bucket.file(filePath);

  await file.save(fileBuffer, {
    resumable: false,
    metadata: {
      contentType: mimeType,
      metadata: {
        originalName,
        uploadedAt: new Date().toISOString(),
      },
    },
  });

  await file.makePublic();

  return {
    url: `https://storage.googleapis.com/${bucket.name}/${filePath}`,
    fileName,
    filePath,
    originalName,
    mimeType,
    size: fileBuffer.length,
  };
};

export const deleteFile = async (filePathOrUrl) => {
  try {
    if (!filePathOrUrl) return;
    const raw = String(filePathOrUrl || "").trim();
    const bucketPrefix = `https://storage.googleapis.com/${bucket.name}/`;
    const cleanPath = raw.startsWith(bucketPrefix)
      ? raw.replace(bucketPrefix, "")
      : raw;
    if (!cleanPath) return;
    await bucket.file(cleanPath).delete();
  } catch (error) {
    console.error("Delete file error:", error?.message || error);
  }
};

export const uploadImage = async (
  fileBuffer,
  originalName,
  mimeType,
  subfolder = ""
) => {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error("Only JPG, PNG, WEBP, SVG images allowed");
  }
  return uploadFile({
    fileBuffer,
    originalName,
    mimeType,
    folder: `images/${sanitizeFolder(subfolder)}`,
    maxSize: MAX_SIZES.image,
  });
};

export const uploadLogo = async (fileBuffer, originalName, mimeType) => {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error("Only JPG, PNG, WEBP, SVG allowed for logo");
  }
  return uploadFile({
    fileBuffer,
    originalName,
    mimeType,
    folder: "images/logos",
    maxSize: MAX_SIZES.logo,
  });
};

export const uploadPDF = async (
  fileBuffer,
  originalName,
  mimeType,
  subfolder = ""
) => {
  if (!ALLOWED_PDF_TYPES.includes(mimeType)) {
    throw new Error("Only PDF files allowed");
  }
  return uploadFile({
    fileBuffer,
    originalName,
    mimeType,
    folder: `pdfs/${sanitizeFolder(subfolder)}`,
    maxSize: MAX_SIZES.pdf,
  });
};

export const uploadVideo = async (
  fileBuffer,
  originalName,
  mimeType,
  subfolder = ""
) => {
  if (!ALLOWED_VIDEO_TYPES.includes(mimeType)) {
    throw new Error("Only MP4, AVI, MOV videos allowed");
  }
  return uploadFile({
    fileBuffer,
    originalName,
    mimeType,
    folder: `videos/${sanitizeFolder(subfolder)}`,
    maxSize: MAX_SIZES.video,
  });
};

export const uploadReceipt = async (fileBuffer, originalName, mimeType) => {
  if (![...ALLOWED_IMAGE_TYPES, "application/pdf"].includes(mimeType)) {
    throw new Error("Only JPG, PNG, WEBP or PDF receipts allowed");
  }
  return uploadFile({
    fileBuffer,
    originalName,
    mimeType,
    folder: "receipts",
    maxSize: MAX_SIZES.receipt,
  });
};

export { MAX_SIZES };
