import multer from "multer";
import { admin, db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";
import {
  uploadFile,
  uploadImage,
  uploadVideo,
  uploadReceipt,
  uploadLogo as uploadLogoFile,
  deleteFile,
  MAX_SIZES,
} from "../services/storage.service.js";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZES.video },
});

export const uploadThumbnail = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, "No file uploaded", 400);

    const result = await uploadImage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      "thumbnails"
    );

    return successResponse(res, { url: result.url }, "Thumbnail uploaded");
  } catch (error) {
    return errorResponse(res, error?.message || "Failed to upload thumbnail", 400);
  }
};

export const uploadCoursePDF = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, "No file uploaded", 400);

    const { courseId = "", subjectId = "", type = "pdf" } = req.body || {};
    if (!courseId || !subjectId) {
      return errorResponse(res, "courseId and subjectId are required", 400);
    }

    const folder = `courses/${courseId}/subjects/${subjectId}`;
    const result = await uploadFile({
      fileBuffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      folder: `pdfs/${folder}`,
      maxSize: MAX_SIZES.pdf,
    });

    return successResponse(
      res,
      {
        url: result.url,
        name: req.file.originalname,
        size: result.size,
        type,
      },
      "PDF uploaded"
    );
  } catch (error) {
    return errorResponse(res, error?.message || "Failed to upload PDF", 400);
  }
};

export const uploadCourseVideo = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, "No file uploaded", 400);

    const { courseId = "", subjectId = "" } = req.body || {};
    if (!courseId || !subjectId) {
      return errorResponse(res, "courseId and subjectId are required", 400);
    }

    const result = await uploadVideo(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      `courses/${courseId}/subjects/${subjectId}`
    );

    return successResponse(
      res,
      {
        url: result.url,
        name: req.file.originalname,
        size: result.size,
      },
      "Video uploaded"
    );
  } catch (error) {
    return errorResponse(res, error?.message || "Failed to upload video", 400);
  }
};

export const uploadPaymentReceipt = async (req, res) => {
  try {
    const paymentId = req.params.paymentId || req.params.id;
    if (!paymentId) return errorResponse(res, "paymentId is required", 400);

    const paymentRef = db.collection(COLLECTIONS.PAYMENTS).doc(paymentId);
    const paySnap = await paymentRef.get();
    if (!paySnap.exists) return errorResponse(res, "Payment not found", 404);

    const payData = paySnap.data() || {};
    const isAdmin = req.user?.role === "admin";
    if (!isAdmin && payData.studentId && payData.studentId !== req.user?.uid) {
      return errorResponse(
        res,
        "You can upload receipt for your own payment only",
        403
      );
    }
    if (String(payData.method || "").toLowerCase() !== "bank_transfer") {
      return errorResponse(res, "Receipt upload is only for bank transfer", 400);
    }

    let result = null;
    const receiptUrlFromBody = String(req.body?.receiptUrl || "").trim();

    if (req.file) {
      result = await uploadReceipt(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
    } else if (receiptUrlFromBody) {
      if (!/^https?:\/\//i.test(receiptUrlFromBody)) {
        return errorResponse(res, "Invalid receipt URL", 400);
      }
      result = {
        url: receiptUrlFromBody,
        size: Number(req.body?.receiptSize || 0) || null,
      };
    } else {
      return errorResponse(res, "No file uploaded", 400);
    }

    await paymentRef.update({
      receiptUrl: result.url,
      receiptName: req.file?.originalname || null,
      receiptSize: result.size || null,
      status: "pending_verification",
      receiptUploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(
      res,
      {
        url: result.url,
        paymentId,
        status: "pending_verification",
      },
      "Receipt uploaded. Awaiting admin verification."
    );
  } catch (error) {
    return errorResponse(
      res,
      error?.message || "Failed to upload receipt",
      400
    );
  }
};

export const uploadLogo = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, "No file uploaded", 400);

    const result = await uploadLogoFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    await db
      .collection(COLLECTIONS.SETTINGS)
      .doc("siteSettings")
      .set({ general: { logoUrl: result.url } }, { merge: true });

    return successResponse(res, { url: result.url }, "Logo uploaded");
  } catch (error) {
    return errorResponse(res, error?.message || "Failed to upload logo", 400);
  }
};

export const deleteUploadedFile = async (req, res) => {
  try {
    const { filePath } = req.body || {};
    if (!filePath) return errorResponse(res, "filePath required", 400);
    await deleteFile(filePath);
    return successResponse(res, {}, "File deleted");
  } catch (error) {
    return errorResponse(res, "Failed to delete file", 500);
  }
};
