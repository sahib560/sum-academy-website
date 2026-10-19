import { admin, db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";
import {
  uploadPdfResource,
  isPdfBuffer,
  deleteFile,
  MAX_SIZES,
} from "../services/storage.service.js";
import { streamPdfFileFromR2, deleteFromR2 } from "../services/r2.service.js";

const { FieldValue } = admin.firestore;

const generateSlug = (text = "") => {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
};

const sanitizeTag = (tag = "") =>
  String(tag || "")
    .trim()
    .toLowerCase()
    .slice(0, 30);

const parseTags = (raw) => {
  if (Array.isArray(raw)) {
    return Array.from(new Set(raw.map(sanitizeTag).filter(Boolean)));
  }
  if (typeof raw === "string") {
    return Array.from(
      new Set(
        raw
          .split(",")
          .map(sanitizeTag)
          .filter(Boolean)
      )
    );
  }
  return [];
};

const recordAuditLog = async ({ uid, action, resourceId, details = {}, ip = "", device = "" }) => {
  try {
    await db.collection(COLLECTIONS.AUDIT_LOGS).add({
      uid: String(uid || "unknown"),
      action: `pdf_resource_${action}`,
      resourceId: String(resourceId || ""),
      details,
      ip: String(ip || ""),
      device: String(device || ""),
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("[AuditLog] Failed to record PDF resource audit log:", err?.message || err);
  }
};

/**
 * -------------------------------------------------------------
 * PUBLIC CONTROLLER METHODS
 * -------------------------------------------------------------
 */

export const getPublicPdfResources = async (req, res) => {
  try {
    const {
      search = "",
      category = "",
      subject = "",
      classLevel = "",
      page = 1,
      limit = 12,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const searchQuery = String(search || "").trim().toLowerCase();
    const targetCategory = String(category || "").trim().toLowerCase();
    const targetSubject = String(subject || "").trim().toLowerCase();
    const targetClassLevel = String(classLevel || "").trim().toLowerCase();

    // Query published resources from Firestore
    let query = db
      .collection(COLLECTIONS.PDF_RESOURCES)
      .where("status", "==", "published");

    const snapshot = await query.get();

    let resources = [];
    const allCategories = new Set();
    const allSubjects = new Set();
    const allClassLevels = new Set();

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const id = doc.id;

      if (data.category) allCategories.add(data.category);
      if (data.subject) allSubjects.add(data.subject);
      if (data.classLevel) allClassLevels.add(data.classLevel);

      // Safe client payload without internal storage keys
      resources.push({
        id,
        title: data.title || "Untitled Resource",
        slug: data.slug || "",
        description: data.description || "",
        category: data.category || "General",
        subject: data.subject || "General",
        classLevel: data.classLevel || "All",
        tags: Array.isArray(data.tags) ? data.tags : [],
        originalFileName: data.originalFileName || "",
        fileSize: Number(data.fileSize || 0),
        pageCount: data.pageCount || null,
        status: data.status || "published",
        downloadCount: Number(data.downloadCount || 0),
        publishedAt: data.publishedAt ? data.publishedAt.toDate?.() || data.publishedAt : null,
        createdAt: data.createdAt ? data.createdAt.toDate?.() || data.createdAt : null,
      });
    });

    // In-memory filter for flexible search across multiple fields
    if (searchQuery) {
      resources = resources.filter((item) => {
        const titleMatch = item.title.toLowerCase().includes(searchQuery);
        const descMatch = item.description.toLowerCase().includes(searchQuery);
        const subjectMatch = item.subject.toLowerCase().includes(searchQuery);
        const catMatch = item.category.toLowerCase().includes(searchQuery);
        const tagMatch = item.tags.some((t) => t.toLowerCase().includes(searchQuery));
        return titleMatch || descMatch || subjectMatch || catMatch || tagMatch;
      });
    }

    if (targetCategory && targetCategory !== "all") {
      resources = resources.filter(
        (item) => item.category.toLowerCase() === targetCategory
      );
    }

    if (targetSubject && targetSubject !== "all") {
      resources = resources.filter(
        (item) => item.subject.toLowerCase() === targetSubject
      );
    }

    if (targetClassLevel && targetClassLevel !== "all") {
      resources = resources.filter(
        (item) => item.classLevel.toLowerCase() === targetClassLevel
      );
    }

    // Sort
    resources.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA == null) return 1;
      if (valB == null) return -1;

      if (sortOrder === "asc") {
        return valA > valB ? 1 : valA < valB ? -1 : 0;
      }
      return valA < valB ? 1 : valA > valB ? -1 : 0;
    });

    const total = resources.length;
    const totalPages = Math.ceil(total / parsedLimit) || 1;
    const startIndex = (parsedPage - 1) * parsedLimit;
    const paginated = resources.slice(startIndex, startIndex + parsedLimit);

    return successResponse(
      res,
      {
        resources: paginated,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total,
          totalPages,
          hasNextPage: parsedPage < totalPages,
          hasPrevPage: parsedPage > 1,
        },
        filters: {
          categories: Array.from(allCategories).sort(),
          subjects: Array.from(allSubjects).sort(),
          classLevels: Array.from(allClassLevels).sort(),
        },
      },
      "Public PDF resources fetched successfully"
    );
  } catch (error) {
    console.error("getPublicPdfResources error:", error);
    return errorResponse(res, "Failed to retrieve public PDF resources", 500);
  }
};

export const getPublicPdfResourceById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return errorResponse(res, "Resource ID is required", 400);

    const docSnap = await db.collection(COLLECTIONS.PDF_RESOURCES).doc(id).get();
    if (!docSnap.exists) {
      return errorResponse(res, "PDF resource not found", 404);
    }

    const data = docSnap.data() || {};
    if (data.status !== "published") {
      return errorResponse(res, "This resource is not publicly available", 404);
    }

    return successResponse(
      res,
      {
        id: docSnap.id,
        title: data.title || "Untitled",
        slug: data.slug || "",
        description: data.description || "",
        category: data.category || "General",
        subject: data.subject || "General",
        classLevel: data.classLevel || "All",
        tags: Array.isArray(data.tags) ? data.tags : [],
        originalFileName: data.originalFileName || "",
        fileSize: Number(data.fileSize || 0),
        pageCount: data.pageCount || null,
        downloadCount: Number(data.downloadCount || 0),
        publishedAt: data.publishedAt ? data.publishedAt.toDate?.() || data.publishedAt : null,
        createdAt: data.createdAt ? data.createdAt.toDate?.() || data.createdAt : null,
      },
      "PDF resource details fetched successfully"
    );
  } catch (error) {
    console.error("getPublicPdfResourceById error:", error);
    return errorResponse(res, "Failed to retrieve resource details", 500);
  }
};

export const previewPublicPdfResource = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return errorResponse(res, "Resource ID is required", 400);

    const docSnap = await db.collection(COLLECTIONS.PDF_RESOURCES).doc(id).get();
    if (!docSnap.exists) {
      return errorResponse(res, "PDF resource not found", 404);
    }

    const data = docSnap.data() || {};
    if (data.status !== "published") {
      return errorResponse(res, "This resource is not publicly available", 404);
    }

    const objectKey = data.objectKey;
    if (!objectKey) {
      return errorResponse(res, "File location is missing for this resource", 500);
    }

    const filename = `${data.slug || "document"}.pdf`;
    return await streamPdfFileFromR2(objectKey, req.headers.range, res, {
      disposition: "inline",
      filename,
    });
  } catch (error) {
    console.error("previewPublicPdfResource error:", error);
    return errorResponse(res, "Failed to stream PDF preview", 500);
  }
};

export const downloadPublicPdfResource = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return errorResponse(res, "Resource ID is required", 400);

    const docRef = db.collection(COLLECTIONS.PDF_RESOURCES).doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return errorResponse(res, "PDF resource not found", 404);
    }

    const data = docSnap.data() || {};
    if (data.status !== "published") {
      return errorResponse(res, "This resource is not publicly available", 404);
    }

    const objectKey = data.objectKey;
    if (!objectKey) {
      return errorResponse(res, "File location is missing for this resource", 500);
    }

    // Atomically increment download count
    docRef.update({
      downloadCount: FieldValue.increment(1),
    }).catch((err) => console.warn("Failed to increment downloadCount:", err.message));

    const filename = `${data.slug || "document"}.pdf`;
    return await streamPdfFileFromR2(objectKey, req.headers.range, res, {
      disposition: "attachment",
      filename,
    });
  } catch (error) {
    console.error("downloadPublicPdfResource error:", error);
    return errorResponse(res, "Failed to download PDF document", 500);
  }
};

/**
 * -------------------------------------------------------------
 * ADMIN CONTROLLER METHODS
 * -------------------------------------------------------------
 */

export const getAdminPdfResources = async (req, res) => {
  try {
    const {
      search = "",
      status = "all",
      category = "",
      subject = "",
      classLevel = "",
      page = 1,
      limit = 15,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const searchQuery = String(search || "").trim().toLowerCase();
    const targetStatus = String(status || "").trim().toLowerCase();
    const targetCategory = String(category || "").trim().toLowerCase();
    const targetSubject = String(subject || "").trim().toLowerCase();
    const targetClassLevel = String(classLevel || "").trim().toLowerCase();

    let query = db.collection(COLLECTIONS.PDF_RESOURCES);

    if (targetStatus && targetStatus !== "all") {
      query = query.where("status", "==", targetStatus);
    }

    const snapshot = await query.get();

    let resources = [];
    const allCategories = new Set();
    const allSubjects = new Set();
    const allClassLevels = new Set();

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      if (data.category) allCategories.add(data.category);
      if (data.subject) allSubjects.add(data.subject);
      if (data.classLevel) allClassLevels.add(data.classLevel);

      resources.push({
        id: doc.id,
        title: data.title || "Untitled Resource",
        slug: data.slug || "",
        description: data.description || "",
        category: data.category || "General",
        subject: data.subject || "General",
        classLevel: data.classLevel || "All",
        tags: Array.isArray(data.tags) ? data.tags : [],
        originalFileName: data.originalFileName || "",
        objectKey: data.objectKey || "",
        contentType: data.contentType || "application/pdf",
        fileSize: Number(data.fileSize || 0),
        pageCount: data.pageCount || null,
        status: data.status || "draft",
        downloadCount: Number(data.downloadCount || 0),
        uploadedBy: data.uploadedBy || "",
        publishedAt: data.publishedAt ? data.publishedAt.toDate?.() || data.publishedAt : null,
        createdAt: data.createdAt ? data.createdAt.toDate?.() || data.createdAt : null,
        updatedAt: data.updatedAt ? data.updatedAt.toDate?.() || data.updatedAt : null,
      });
    });

    if (searchQuery) {
      resources = resources.filter((item) => {
        const titleMatch = item.title.toLowerCase().includes(searchQuery);
        const descMatch = item.description.toLowerCase().includes(searchQuery);
        const subjectMatch = item.subject.toLowerCase().includes(searchQuery);
        const catMatch = item.category.toLowerCase().includes(searchQuery);
        const fileMatch = item.originalFileName.toLowerCase().includes(searchQuery);
        const tagMatch = item.tags.some((t) => t.toLowerCase().includes(searchQuery));
        return titleMatch || descMatch || subjectMatch || catMatch || fileMatch || tagMatch;
      });
    }

    if (targetCategory && targetCategory !== "all") {
      resources = resources.filter(
        (item) => item.category.toLowerCase() === targetCategory
      );
    }

    if (targetSubject && targetSubject !== "all") {
      resources = resources.filter(
        (item) => item.subject.toLowerCase() === targetSubject
      );
    }

    if (targetClassLevel && targetClassLevel !== "all") {
      resources = resources.filter(
        (item) => item.classLevel.toLowerCase() === targetClassLevel
      );
    }

    resources.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA == null) return 1;
      if (valB == null) return -1;

      if (sortOrder === "asc") {
        return valA > valB ? 1 : valA < valB ? -1 : 0;
      }
      return valA < valB ? 1 : valA > valB ? -1 : 0;
    });

    const total = resources.length;
    const totalPages = Math.ceil(total / parsedLimit) || 1;
    const startIndex = (parsedPage - 1) * parsedLimit;
    const paginated = resources.slice(startIndex, startIndex + parsedLimit);

    return successResponse(
      res,
      {
        resources: paginated,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total,
          totalPages,
          hasNextPage: parsedPage < totalPages,
          hasPrevPage: parsedPage > 1,
        },
        filters: {
          categories: Array.from(allCategories).sort(),
          subjects: Array.from(allSubjects).sort(),
          classLevels: Array.from(allClassLevels).sort(),
        },
      },
      "Admin PDF resources retrieved successfully"
    );
  } catch (error) {
    console.error("getAdminPdfResources error:", error);
    return errorResponse(res, "Failed to retrieve PDF resources", 500);
  }
};

export const getAdminPdfResourceStats = async (req, res) => {
  try {
    const snapshot = await db.collection(COLLECTIONS.PDF_RESOURCES).get();

    let total = 0;
    let published = 0;
    let draft = 0;
    let archived = 0;
    let totalDownloads = 0;
    let totalBytes = 0;

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      total += 1;
      const status = String(data.status || "draft").toLowerCase();
      if (status === "published") published += 1;
      else if (status === "draft") draft += 1;
      else if (status === "archived") archived += 1;

      totalDownloads += Number(data.downloadCount || 0);
      totalBytes += Number(data.fileSize || 0);
    });

    return successResponse(
      res,
      {
        total,
        published,
        draft,
        archived,
        totalDownloads,
        totalBytes,
      },
      "PDF resource statistics retrieved"
    );
  } catch (error) {
    console.error("getAdminPdfResourceStats error:", error);
    return errorResponse(res, "Failed to calculate PDF resource statistics", 500);
  }
};

export const getAdminPdfResourceById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return errorResponse(res, "Resource ID is required", 400);

    const docSnap = await db.collection(COLLECTIONS.PDF_RESOURCES).doc(id).get();
    if (!docSnap.exists) {
      return errorResponse(res, "PDF resource not found", 404);
    }

    const data = docSnap.data() || {};
    return successResponse(
      res,
      {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate?.() || data.createdAt : null,
        updatedAt: data.updatedAt ? data.updatedAt.toDate?.() || data.updatedAt : null,
        publishedAt: data.publishedAt ? data.publishedAt.toDate?.() || data.publishedAt : null,
      },
      "PDF resource details retrieved"
    );
  } catch (error) {
    console.error("getAdminPdfResourceById error:", error);
    return errorResponse(res, "Failed to retrieve resource details", 500);
  }
};

export const previewAdminPdfResource = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return errorResponse(res, "Resource ID is required", 400);

    const docSnap = await db.collection(COLLECTIONS.PDF_RESOURCES).doc(id).get();
    if (!docSnap.exists) {
      return errorResponse(res, "PDF resource not found", 404);
    }

    const data = docSnap.data() || {};
    const objectKey = data.objectKey;
    if (!objectKey) {
      return errorResponse(res, "File location missing for this resource", 500);
    }

    const filename = `${data.slug || "document"}.pdf`;
    return await streamPdfFileFromR2(objectKey, req.headers.range, res, {
      disposition: "inline",
      filename,
    });
  } catch (error) {
    console.error("previewAdminPdfResource error:", error);
    return errorResponse(res, "Failed to stream PDF for preview", 500);
  }
};

export const createPdfResource = async (req, res) => {
  let uploadedObjectKey = null;

  try {
    const file = req.file;
    if (!file) {
      return errorResponse(res, "Please select a PDF document to upload", 400);
    }

    if (!isPdfBuffer(file.buffer)) {
      return errorResponse(
        res,
        "Uploaded file is not a valid PDF document (invalid file signature)",
        400
      );
    }

    const {
      title,
      description = "",
      category = "General",
      subject = "General",
      classLevel = "All",
      tags = [],
      status = "published",
    } = req.body;

    const trimmedTitle = String(title || "").trim();
    if (!trimmedTitle) {
      return errorResponse(res, "Document title is required", 400);
    }

    const normalizedStatus = ["published", "draft", "archived"].includes(status)
      ? status
      : "draft";

    const slug = generateSlug(trimmedTitle) || `pdf-${Date.now()}`;
    const parsedTagsList = parseTags(tags);

    // Upload to Cloudflare R2
    const uploadResult = await uploadPdfResource({
      fileBuffer: file.buffer,
      originalName: file.originalname,
      maxSize: MAX_SIZES.pdf,
    });

    uploadedObjectKey = uploadResult.objectKey;

    const resourceData = {
      title: trimmedTitle,
      slug,
      description: String(description || "").trim().slice(0, 2000),
      category: String(category || "General").trim().slice(0, 50),
      subject: String(subject || "General").trim().slice(0, 50),
      classLevel: String(classLevel || "All").trim().slice(0, 50),
      tags: parsedTagsList,
      originalFileName: String(file.originalname || "document.pdf").slice(0, 200),
      objectKey: uploadResult.objectKey,
      contentType: "application/pdf",
      fileSize: uploadResult.size,
      pageCount: null,
      status: normalizedStatus,
      downloadCount: 0,
      uploadedBy: req.user?.uid || "admin",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      publishedAt: normalizedStatus === "published" ? FieldValue.serverTimestamp() : null,
    };

    const docRef = await db.collection(COLLECTIONS.PDF_RESOURCES).add(resourceData);

    await recordAuditLog({
      uid: req.user?.uid,
      action: "create",
      resourceId: docRef.id,
      details: { title: trimmedTitle, status: normalizedStatus, size: uploadResult.size },
      ip: req.clientIP || req.ip,
      device: req.clientDevice,
    });

    return successResponse(
      res,
      {
        id: docRef.id,
        ...resourceData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      "PDF resource uploaded and created successfully",
      201
    );
  } catch (error) {
    console.error("createPdfResource error:", error);

    // Compensation: Clean up uploaded R2 object if Firestore write failed
    if (uploadedObjectKey) {
      try {
        console.warn(`[Compensation] Deleting orphaned R2 object: ${uploadedObjectKey}`);
        await deleteFromR2(uploadedObjectKey);
      } catch (cleanupErr) {
        console.error("[Compensation Failed] Failed to clean up orphaned R2 object:", cleanupErr);
      }
    }

    return errorResponse(res, error?.message || "Failed to create PDF resource", 500);
  }
};

export const updatePdfResource = async (req, res) => {
  let newUploadedObjectKey = null;

  try {
    const { id } = req.params;
    if (!id) return errorResponse(res, "Resource ID is required", 400);

    const docRef = db.collection(COLLECTIONS.PDF_RESOURCES).doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return errorResponse(res, "PDF resource not found", 404);
    }

    const currentData = docSnap.data() || {};
    const oldObjectKey = currentData.objectKey;

    const {
      title,
      description,
      category,
      subject,
      classLevel,
      tags,
      status,
    } = req.body;

    const updatePayload = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (title !== undefined) {
      const trimmed = String(title || "").trim();
      if (!trimmed) return errorResponse(res, "Title cannot be empty", 400);
      updatePayload.title = trimmed;
      updatePayload.slug = generateSlug(trimmed) || currentData.slug;
    }

    if (description !== undefined) {
      updatePayload.description = String(description || "").trim().slice(0, 2000);
    }

    if (category !== undefined) {
      updatePayload.category = String(category || "General").trim().slice(0, 50);
    }

    if (subject !== undefined) {
      updatePayload.subject = String(subject || "General").trim().slice(0, 50);
    }

    if (classLevel !== undefined) {
      updatePayload.classLevel = String(classLevel || "All").trim().slice(0, 50);
    }

    if (tags !== undefined) {
      updatePayload.tags = parseTags(tags);
    }

    if (status !== undefined) {
      const normalizedStatus = ["published", "draft", "archived"].includes(status)
        ? status
        : currentData.status;
      updatePayload.status = normalizedStatus;

      if (normalizedStatus === "published" && !currentData.publishedAt) {
        updatePayload.publishedAt = FieldValue.serverTimestamp();
      }
    }

    // Optional replacement file
    if (req.file) {
      if (!isPdfBuffer(req.file.buffer)) {
        return errorResponse(res, "Uploaded replacement file is not a valid PDF document", 400);
      }

      const uploadResult = await uploadPdfResource({
        fileBuffer: req.file.buffer,
        originalName: req.file.originalname,
        maxSize: MAX_SIZES.pdf,
      });

      newUploadedObjectKey = uploadResult.objectKey;
      updatePayload.objectKey = uploadResult.objectKey;
      updatePayload.originalFileName = String(req.file.originalname || "document.pdf").slice(0, 200);
      updatePayload.fileSize = uploadResult.size;
    }

    await docRef.update(updatePayload);

    // If new file replaced old file, clean up old file from R2
    if (newUploadedObjectKey && oldObjectKey && oldObjectKey !== newUploadedObjectKey) {
      deleteFromR2(oldObjectKey).catch((delErr) =>
        console.warn("[Storage] Failed to delete replaced R2 object:", delErr?.message)
      );
    }

    await recordAuditLog({
      uid: req.user?.uid,
      action: "update",
      resourceId: id,
      details: { updatedFields: Object.keys(updatePayload), fileReplaced: Boolean(newUploadedObjectKey) },
      ip: req.clientIP || req.ip,
      device: req.clientDevice,
    });

    const updatedSnap = await docRef.get();
    const updatedData = updatedSnap.data() || {};

    return successResponse(
      res,
      {
        id,
        ...updatedData,
        createdAt: updatedData.createdAt ? updatedData.createdAt.toDate?.() || updatedData.createdAt : null,
        updatedAt: updatedData.updatedAt ? updatedData.updatedAt.toDate?.() || updatedData.updatedAt : null,
        publishedAt: updatedData.publishedAt ? updatedData.publishedAt.toDate?.() || updatedData.publishedAt : null,
      },
      "PDF resource updated successfully"
    );
  } catch (error) {
    console.error("updatePdfResource error:", error);

    // Compensation: if new file was uploaded but Firestore update failed, delete the newly uploaded object
    if (newUploadedObjectKey) {
      try {
        console.warn(`[Compensation] Deleting orphaned replacement R2 object: ${newUploadedObjectKey}`);
        await deleteFromR2(newUploadedObjectKey);
      } catch (cleanupErr) {
        console.error("[Compensation Failed] Failed to clean up orphaned R2 object:", cleanupErr);
      }
    }

    return errorResponse(res, error?.message || "Failed to update PDF resource", 500);
  }
};

export const updatePdfResourceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id) return errorResponse(res, "Resource ID is required", 400);

    const normalizedStatus = String(status || "").toLowerCase().trim();
    if (!["published", "draft", "archived"].includes(normalizedStatus)) {
      return errorResponse(
        res,
        "Invalid status. Must be 'published', 'draft', or 'archived'",
        400
      );
    }

    const docRef = db.collection(COLLECTIONS.PDF_RESOURCES).doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return errorResponse(res, "PDF resource not found", 404);
    }

    const currentData = docSnap.data() || {};
    const updatePayload = {
      status: normalizedStatus,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (normalizedStatus === "published" && !currentData.publishedAt) {
      updatePayload.publishedAt = FieldValue.serverTimestamp();
    }

    await docRef.update(updatePayload);

    await recordAuditLog({
      uid: req.user?.uid,
      action: "status_change",
      resourceId: id,
      details: { previousStatus: currentData.status, newStatus: normalizedStatus },
      ip: req.clientIP || req.ip,
      device: req.clientDevice,
    });

    return successResponse(
      res,
      { id, status: normalizedStatus },
      `PDF resource status updated to ${normalizedStatus}`
    );
  } catch (error) {
    console.error("updatePdfResourceStatus error:", error);
    return errorResponse(res, "Failed to update resource status", 500);
  }
};

export const deletePdfResource = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return errorResponse(res, "Resource ID is required", 400);

    const docRef = db.collection(COLLECTIONS.PDF_RESOURCES).doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return errorResponse(res, "PDF resource not found", 404);
    }

    const data = docSnap.data() || {};
    const objectKey = data.objectKey;

    // Delete document from Firestore first
    await docRef.delete();

    // Delete file from R2
    if (objectKey) {
      try {
        await deleteFromR2(objectKey);
      } catch (r2Err) {
        console.error(`[Storage Warning] Failed to delete R2 object ${objectKey}:`, r2Err?.message);
        // We log the failure so administrators or cleanup tasks can track it
        await recordAuditLog({
          uid: req.user?.uid,
          action: "delete_r2_failed",
          resourceId: id,
          details: { objectKey, error: r2Err?.message },
          ip: req.clientIP || req.ip,
          device: req.clientDevice,
        });
      }
    }

    await recordAuditLog({
      uid: req.user?.uid,
      action: "delete",
      resourceId: id,
      details: { title: data.title, objectKey },
      ip: req.clientIP || req.ip,
      device: req.clientDevice,
    });

    return successResponse(res, { id }, "PDF resource deleted successfully");
  } catch (error) {
    console.error("deletePdfResource error:", error);
    return errorResponse(res, "Failed to delete PDF resource", 500);
  }
};
