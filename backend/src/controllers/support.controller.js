import { admin, db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import {
  sendStudentHelpSupportEmail,
  sendSupportReplyEmail,
} from "../services/email.service.js";
import { errorResponse, successResponse } from "../utils/response.utils.js";

const SETTINGS_DOC_ID = "siteSettings";
const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const trimText = (value = "") => String(value || "").trim();
const lowerText = (value = "") => trimText(value).toLowerCase();
const isValidEmail = (value = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimText(value));
const normalizeEmailAddress = (value = "") => {
  const raw = trimText(value);
  if (!raw) return "";
  const match = raw.match(/<([^>]+)>/);
  return trimText(match?.[1] || raw).toLowerCase();
};

const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIso = (value) => {
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString() : null;
};

const getSupportEmail = async () => {
  const settingsSnap = await db
    .collection(COLLECTIONS.SETTINGS)
    .doc(SETTINGS_DOC_ID)
    .get();
  const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};

  return (
    normalizeEmailAddress(settings.contact?.email) ||
    normalizeEmailAddress(settings.general?.contactEmail) ||
    normalizeEmailAddress(process.env.SMTP_EMAIL) ||
    normalizeEmailAddress(process.env.EMAIL_FROM)
  );
};

const getMessageStatus = (row = {}) => {
  if (row.repliedAt) return "replied";
  return row.isRead ? "read" : "unread";
};

const serializeMessage = (id, row = {}) => ({
  id,
  source: trimText(row.source) || "student",
  userRole: trimText(row.userRole) || "student",
  userId: trimText(row.userId) || null,
  name: trimText(row.name),
  email: trimText(row.email),
  category: trimText(row.category) || "General",
  subject: trimText(row.subject),
  message: trimText(row.message),
  status: getMessageStatus(row),
  isRead: Boolean(row.isRead),
  replyMessage: trimText(row.replyMessage),
  repliedBy: trimText(row.repliedBy) || null,
  readBy: trimText(row.readBy) || null,
  readAt: toIso(row.readAt),
  repliedAt: toIso(row.repliedAt),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

const createSupportMessage = async ({
  source = "student",
  userRole = "student",
  userId = "",
  name = "",
  email = "",
  category = "General",
  subject = "",
  message = "",
}) => {
  const ref = db.collection(COLLECTIONS.SUPPORT_MESSAGES).doc();
  await ref.set({
    source: trimText(source) || "student",
    userRole: trimText(userRole) || "student",
    userId: trimText(userId) || null,
    name: trimText(name),
    email: trimText(email).toLowerCase(),
    category: trimText(category) || "General",
    subject: trimText(subject),
    message: trimText(message),
    isRead: false,
    status: "unread",
    replyMessage: "",
    repliedAt: null,
    repliedBy: null,
    readAt: null,
    readBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const submitPublicContactMessage = async (req, res) => {
  try {
    const name = trimText(req.body?.name);
    const email = trimText(req.body?.email).toLowerCase();
    const category = trimText(req.body?.category) || "Contact";
    const subject = trimText(req.body?.subject);
    const message = trimText(req.body?.message);

    if (name.length < 2) {
      return errorResponse(res, "Name must be at least 2 characters", 400);
    }
    if (!isValidEmail(email)) {
      return errorResponse(res, "Valid email is required", 400);
    }
    if (subject.length < 3) {
      return errorResponse(res, "Subject must be at least 3 characters", 400);
    }
    if (message.length < 10) {
      return errorResponse(res, "Message must be at least 10 characters", 400);
    }

    const ticketId = await createSupportMessage({
      source: "public",
      userRole: "guest",
      userId: "",
      name,
      email,
      category,
      subject,
      message,
    });

    const supportEmail = await getSupportEmail();
    if (isValidEmail(supportEmail)) {
      try {
        await sendStudentHelpSupportEmail(supportEmail, {
          requestSource: "public",
          studentName: name,
          studentEmail: email,
          category,
          subject,
          message,
        });
      } catch (emailError) {
        console.error("submitPublicContactMessage email error:", emailError.message);
      }
    }

    return successResponse(
      res,
      { ticketId, submitted: true },
      "Your message has been sent to support",
      201
    );
  } catch (error) {
    console.error("submitPublicContactMessage error:", error);
    return errorResponse(res, "Failed to submit contact message", 500);
  }
};

export const getSupportMessages = async (req, res) => {
  try {
    const status = lowerText(req.query?.status || "all");
    const source = lowerText(req.query?.source || "all");
    const search = lowerText(req.query?.search);

    const snap = await db
      .collection(COLLECTIONS.SUPPORT_MESSAGES)
      .orderBy("createdAt", "desc")
      .get();

    let rows = snap.docs.map((doc) =>
      serializeMessage(doc.id, doc.data() || {})
    );

    if (status && status !== "all") {
      rows = rows.filter((row) => row.status === status);
    }

    if (source && source !== "all") {
      rows = rows.filter((row) => lowerText(row.source) === source);
    }

    if (search) {
      rows = rows.filter((row) => {
        const haystack = `${row.name} ${row.email} ${row.subject} ${row.message} ${row.category}`.toLowerCase();
        return haystack.includes(search);
      });
    }

    return successResponse(res, rows, "Support messages fetched");
  } catch (error) {
    console.error("getSupportMessages error:", error);
    return errorResponse(res, "Failed to fetch support messages", 500);
  }
};

export const markSupportMessageRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const isRead = req.body?.isRead !== false;
    const docRef = db.collection(COLLECTIONS.SUPPORT_MESSAGES).doc(messageId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return errorResponse(res, "Support message not found", 404);
    }

    const row = snap.data() || {};
    const nextStatus = row.repliedAt ? "replied" : isRead ? "read" : "unread";

    await docRef.update({
      isRead,
      status: nextStatus,
      readAt: isRead ? serverTimestamp() : null,
      readBy: isRead ? req.user.uid : null,
      updatedAt: serverTimestamp(),
    });

    return successResponse(
      res,
      { id: messageId, isRead, status: nextStatus },
      isRead ? "Message marked as read" : "Message marked as unread"
    );
  } catch (error) {
    console.error("markSupportMessageRead error:", error);
    return errorResponse(res, "Failed to update message status", 500);
  }
};

export const replySupportMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const replyMessage = trimText(req.body?.replyMessage);
    if (replyMessage.length < 3) {
      return errorResponse(res, "Reply must be at least 3 characters", 400);
    }

    const docRef = db.collection(COLLECTIONS.SUPPORT_MESSAGES).doc(messageId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return errorResponse(res, "Support message not found", 404);
    }

    const row = snap.data() || {};
    const recipient = trimText(row.email).toLowerCase();
    if (!isValidEmail(recipient)) {
      return errorResponse(res, "Recipient email is invalid", 400);
    }

    await sendSupportReplyEmail(recipient, {
      name: trimText(row.name) || "Student",
      subject: trimText(row.subject) || "Support Request",
      originalMessage: trimText(row.message),
      replyMessage,
    });

    await docRef.update({
      isRead: true,
      status: "replied",
      readAt: row.readAt || serverTimestamp(),
      readBy: row.readBy || req.user.uid,
      replyMessage,
      repliedAt: serverTimestamp(),
      repliedBy: req.user.uid,
      updatedAt: serverTimestamp(),
    });

    return successResponse(
      res,
      { id: messageId, status: "replied" },
      "Reply sent successfully"
    );
  } catch (error) {
    console.error("replySupportMessage error:", error);
    return errorResponse(res, "Failed to send reply", 500);
  }
};

export const deleteSupportMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const docRef = db.collection(COLLECTIONS.SUPPORT_MESSAGES).doc(messageId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return errorResponse(res, "Support message not found", 404);
    }

    await docRef.delete();
    return successResponse(res, { id: messageId }, "Support message deleted");
  } catch (error) {
    console.error("deleteSupportMessage error:", error);
    return errorResponse(res, "Failed to delete support message", 500);
  }
};
