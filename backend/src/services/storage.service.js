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
  "video/webm",
  "video/x-matroska",
  "video/mkv",
  "application/octet-stream",
];

const VIDEO_MIME_BY_EXT = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
};

const normalizeVideoMime = (mimeType = "", originalName = "") => {
  const safeMime = String(mimeType || "").trim().toLowerCase();
  if (safeMime) return safeMime;
  const ext = path.extname(originalName || "").toLowerCase();
  return VIDEO_MIME_BY_EXT[ext] || "video/mp4";
};

const ALLOWED_APK_TYPES = [
  "application/vnd.android.package-archive",
  "application/x-android-package",
  "application/octet-stream",
  "application/zip",
  "application/x-zip-compressed",
  "multipart/x-zip",
  "application/java-archive",
];

const MAX_SIZES = {
  image: 5 * 1024 * 1024,
  pdf: 50 * 1024 * 1024,
  video: 2 * 1024 * 1024 * 1024,
  receipt: 10 * 1024 * 1024,
  logo: 2 * 1024 * 1024,
  apk: 300 * 1024 * 1024,
};

const sanitizeFolder = (value = "") =>
  String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");

const normalizeBucketName = (name = "") =>
  String(name || "")
    .trim()
    .replace(/^gs:\/\//i, "")
    .replace(/^\/+|\/+$/g, "");

const buildGoogleApisUrl = (bucketName, filePath) =>
  `https://storage.googleapis.com/${normalizeBucketName(bucketName)}/${filePath}`;

const buildFirebaseTokenUrl = (bucketName, filePath, token) =>
  `https://firebasestorage.googleapis.com/v0/b/${normalizeBucketName(
    bucketName
  )}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;

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
  const downloadToken = uuidv4();

  await file.save(fileBuffer, {
    resumable: false,
    metadata: {
      contentType: mimeType,
      metadata: {
        originalName,
        uploadedAt: new Date().toISOString(),
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  let url = buildGoogleApisUrl(bucket.name, filePath);
  try {
    await file.makePublic();
  } catch (error) {
    // Buckets with Uniform Access don't allow object ACL updates.
    // Fallback to Firebase token URL so upload still works.
    console.warn(
      "makePublic failed, using token URL:",
      error?.message || error
    );
    url = buildFirebaseTokenUrl(bucket.name, filePath, downloadToken);
  }

  return {
    url,
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
    const normalizedBucket = normalizeBucketName(bucket.name);
    const googlePrefix = `https://storage.googleapis.com/${normalizedBucket}/`;
    const firebasePrefix = `https://firebasestorage.googleapis.com/v0/b/${normalizedBucket}/o/`;

    let cleanPath = raw;
    if (raw.startsWith(googlePrefix)) {
      cleanPath = raw.replace(googlePrefix, "");
    } else if (raw.startsWith(firebasePrefix)) {
      const encoded = raw.replace(firebasePrefix, "").split("?")[0];
      cleanPath = decodeURIComponent(encoded || "");
    }
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
  const safeMime = normalizeVideoMime(mimeType, originalName);
  if (!ALLOWED_VIDEO_TYPES.includes(safeMime)) {
    throw new Error("Only MP4, AVI, MOV videos allowed");
  }
  return uploadFile({
    fileBuffer,
    originalName,
    mimeType: safeMime,
    folder: `videos/${sanitizeFolder(subfolder)}`,
    maxSize: MAX_SIZES.video,
  });
};

export const uploadVideoFromPath = async (
  localPath,
  originalName,
  mimeType,
  subfolder = ""
) => {
  if (!localPath) {
    throw new Error("Video temp file path is required");
  }
  const safeMime = normalizeVideoMime(mimeType, originalName);
  if (!ALLOWED_VIDEO_TYPES.includes(safeMime)) {
    throw new Error("Only MP4, AVI, MOV videos allowed");
  }

  const extension = path.extname(originalName) || ".mp4";
  const fileName = `${Date.now()}-${uuidv4()}${extension}`;
  const filePath = `videos/${sanitizeFolder(subfolder)}/${fileName}`;
  const downloadToken = uuidv4();

  await bucket.upload(localPath, {
    destination: filePath,
    resumable: false,
    metadata: {
      contentType: safeMime,
      cacheControl: "public,max-age=31536000,immutable",
      metadata: {
        originalName,
        uploadedAt: new Date().toISOString(),
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  const remote = bucket.file(filePath);
  let url = buildGoogleApisUrl(bucket.name, filePath);
  try {
    await remote.makePublic();
  } catch (error) {
    console.warn(
      "makePublic failed for video, using token URL:",
      error?.message || error
    );
    url = buildFirebaseTokenUrl(bucket.name, filePath, downloadToken);
  }

  return {
    url,
    fileName,
    filePath,
    originalName,
    mimeType,
  };
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

export const uploadAPK = async (fileBuffer, originalName, mimeType) => {
  const extension = String(path.extname(originalName || "") || "")
    .toLowerCase()
    .trim();
  if (extension !== ".apk") {
    throw new Error("Only APK file is allowed");
  }
  const normalizedMime = String(mimeType || "").toLowerCase().trim();
  const hasAllowedMime =
    !normalizedMime || ALLOWED_APK_TYPES.includes(normalizedMime);
  if (!hasAllowedMime) {
    throw new Error(
      "Invalid APK file type. Please upload a valid .apk package."
    );
  }
  return uploadFile({
    fileBuffer,
    originalName,
    mimeType:
      normalizedMime || "application/vnd.android.package-archive",
    folder: "apps/android",
    maxSize: MAX_SIZES.apk,
  });
};

export const uploadAPKFromPath = async (
  localPath,
  originalName,
  mimeType,
  fileSize = 0
) => {
  if (!localPath) {
    throw new Error("APK temp file path is required");
  }
  const extension = String(path.extname(originalName || "") || "")
    .toLowerCase()
    .trim();
  if (extension !== ".apk") {
    throw new Error("Only APK file is allowed");
  }
  if (Number(fileSize || 0) > MAX_SIZES.apk) {
    throw new Error(
      `File too large. Max size: ${Math.round(MAX_SIZES.apk / 1024 / 1024)}MB`
    );
  }
  const normalizedMime = String(mimeType || "").toLowerCase().trim();
  const hasAllowedMime =
    !normalizedMime || ALLOWED_APK_TYPES.includes(normalizedMime);
  if (!hasAllowedMime) {
    throw new Error(
      "Invalid APK file type. Please upload a valid .apk package."
    );
  }

  const fileName = `${Date.now()}-${uuidv4()}.apk`;
  const filePath = `apps/android/${fileName}`;
  const downloadToken = uuidv4();
  await bucket.upload(localPath, {
    destination: filePath,
    resumable: false,
    metadata: {
      contentType:
        normalizedMime || "application/vnd.android.package-archive",
      metadata: {
        originalName,
        uploadedAt: new Date().toISOString(),
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  const remote = bucket.file(filePath);
  let url = buildGoogleApisUrl(bucket.name, filePath);
  try {
    await remote.makePublic();
  } catch (error) {
    console.warn(
      "makePublic failed for APK, using token URL:",
      error?.message || error
    );
    url = buildFirebaseTokenUrl(bucket.name, filePath, downloadToken);
  }

  return {
    url,
    fileName,
    filePath,
    originalName,
    mimeType:
      normalizedMime || "application/vnd.android.package-archive",
    size: Number(fileSize || 0) || null,
  };
};

export { MAX_SIZES };
