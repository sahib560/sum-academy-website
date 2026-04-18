import PDFDocument from "pdfkit";
import { admin, auth, db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import {
  sendCertificateIssued,
  sendSecurityDeactivationEmail,
  sendStudentHelpSupportEmail,
} from "../services/email.service.js";
import { errorResponse, successResponse } from "../utils/response.utils.js";
import {
  isPakistanPhone,
  normalizePakistanPhone,
} from "../utils/phone.utils.js";
import { buildCourseContentForStudent } from "./progress.controller.js";

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const SETTINGS_DOC_ID = "siteSettings";
const SECURITY_VIOLATION_LIMIT = 3;
const SECURITY_REASONS = new Set([
  "screenshot",
  "printscreen",
  "tab_switch",
  "window_blur",
  "devtools",
  "screen_record",
  "default",
]);
const SECURITY_PAGES = new Set(["video", "quiz", "learning", "unknown"]);
const trimText = (value = "") => String(value || "").trim();
const lowerText = (value = "") => trimText(value).toLowerCase();
const clampPercent = (value) => Math.max(0, Math.min(100, Number(value || 0)));
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
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
  const raw = String(value || "").trim();
  // If stored as local datetime without timezone (no Z / no offset),
  // interpret it as Pakistan time (Asia/Karachi) to avoid server-timezone drift.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw) && !/Z$|[+-]\d{2}:\d{2}$/.test(raw)) {
    const normalized = raw.length === 16 ? `${raw}:00` : raw;
    const parsedPk = new Date(`${normalized}+05:00`);
    return Number.isNaN(parsedPk.getTime()) ? null : parsedPk;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIso = (value) => {
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString() : null;
};

const LIVE_ACCESS_COLLECTION = "liveSessionAccess";
const PAKISTAN_UTC_OFFSET_HOURS = 5;
const PK_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const PK_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Karachi",
  weekday: "short",
});
const WEEKDAY_TO_INDEX = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};
const TIME_24_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const TIME_12_RE = /^(\d{1,2}):([0-5]\d)\s*(am|pm)$/i;
const DURATION_TIME_RE = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/;
const PK_DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const getPkDateKey = (value = new Date()) => {
  const parsed = parseDate(value);
  if (!parsed) return null;
  const parts = PK_DATE_PARTS_FORMATTER.formatToParts(parsed);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
};

const parsePkDateKey = (value = "") => {
  const clean = trimText(value);
  if (!PK_DATE_KEY_RE.test(clean)) return null;
  const [year, month, day] = clean.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const addDaysToDateKey = (dateKey = "", days = 0) => {
  const parsed = parsePkDateKey(dateKey);
  if (!parsed) return null;
  const base = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + Number(days || 0), 12, 0, 0));
  const year = String(base.getUTCFullYear());
  const month = String(base.getUTCMonth() + 1).padStart(2, "0");
  const day = String(base.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseTimeToMinutes = (value = "") => {
  const clean = trimText(value).toLowerCase();
  if (!clean) return null;
  const time24 = TIME_24_RE.exec(clean);
  if (time24) {
    return Number(time24[1]) * 60 + Number(time24[2]);
  }
  const time12 = TIME_12_RE.exec(clean);
  if (time12) {
    const rawHour = Number(time12[1]);
    const minute = Number(time12[2]);
    const meridiem = lowerText(time12[3]);
    const hour24 = (rawHour % 12) + (meridiem === "pm" ? 12 : 0);
    return hour24 * 60 + minute;
  }
  return null;
};

const parseDurationToSeconds = (value) => {
  if (value === null || value === undefined) return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return Math.round(numeric);
  const clean = trimText(value);
  if (!clean) return 0;
  const parts = DURATION_TIME_RE.exec(clean);
  if (!parts) return 0;
  const first = Number(parts[1]);
  const second = Number(parts[2]);
  const third = Number(parts[3] || 0);
  if (parts[3] !== undefined) {
    return first * 3600 + second * 60 + third;
  }
  return first * 60 + second;
};

const toPkDateTime = (dateKey = "", timeValue = "") => {
  const parsedDate = parsePkDateKey(dateKey);
  const timeMinutes = parseTimeToMinutes(timeValue);
  if (!parsedDate || timeMinutes === null) return null;
  const hour = Math.floor(timeMinutes / 60);
  const minute = timeMinutes % 60;
  return new Date(
    Date.UTC(
      parsedDate.year,
      parsedDate.month - 1,
      parsedDate.day,
      hour - PAKISTAN_UTC_OFFSET_HOURS,
      minute,
      0,
      0
    )
  );
};

const getPkWeekdayIndex = (dateValue) => {
  const parsed = parseDate(dateValue);
  if (!parsed) return null;
  const label = lowerText(PK_WEEKDAY_FORMATTER.format(parsed));
  return WEEKDAY_TO_INDEX[label] ?? null;
};

const normalizeShiftDays = (days = []) => {
  const values = Array.isArray(days) ? days : [days];
  const normalized = new Set();
  values.forEach((entry) => {
    const clean = lowerText(entry);
    if (!clean) return;
    if (clean === "weekend") {
      normalized.add(6);
      normalized.add(0);
      return;
    }
    if (clean === "weekday" || clean === "weekdays") {
      [1, 2, 3, 4, 5].forEach((day) => normalized.add(day));
      return;
    }
    const splitParts = clean.split(/[,/|]/).map((part) => lowerText(part));
    splitParts.forEach((part) => {
      if (WEEKDAY_TO_INDEX[part] !== undefined) {
        normalized.add(WEEKDAY_TO_INDEX[part]);
      }
    });
    if (WEEKDAY_TO_INDEX[clean] !== undefined) {
      normalized.add(WEEKDAY_TO_INDEX[clean]);
    }
  });
  return [...normalized];
};

const resolveShiftDurationSeconds = (shift = {}) => {
  const startMinutes = parseTimeToMinutes(shift?.startTime);
  const endMinutes = parseTimeToMinutes(shift?.endTime);
  if (startMinutes === null || endMinutes === null) return 0;
  const delta = endMinutes - startMinutes;
  if (delta <= 0) return 0;
  return delta * 60;
};

const resolveLiveVideoDurationSeconds = (lecture = {}, shift = {}) => {
  const videoDurationSec = Math.max(
    parseDurationToSeconds(lecture.durationSec),
    parseDurationToSeconds(lecture.videoDuration),
    parseDurationToSeconds(lecture.videoDurationSec)
  );
  const shiftDurationSec = resolveShiftDurationSeconds(shift);

  // Rule:
  // - If live video duration exists, session ends when the video ends
  //   (even if it's shorter than the shift).
  // - If duration is missing, fall back to shift duration.
  if (videoDurationSec > 0) return Math.max(videoDurationSec, 60);
  return Math.max(shiftDurationSec, 60);
};

const buildLiveSessionId = ({
  classId = "",
  shiftId = "",
  subjectId = "",
  lectureId = "",
  dateKey = "",
}) =>
  [classId, shiftId, subjectId, lectureId, dateKey]
    .map((value) => trimText(value).replace(/[^a-zA-Z0-9_-]/g, "_"))
    .filter(Boolean)
    .join("__");

const parseSessionClockToMinutes = (value = "") => {
  const clean = trimText(value);
  if (!clean || !TIME_24_RE.test(clean)) return null;
  const [hours, minutes] = clean.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const resolveSessionDateTime = (dateValue = "", timeValue = "00:00") => {
  const day = formatSessionDate(dateValue);
  const minutes = parseSessionClockToMinutes(timeValue);
  if (!day || minutes === null) return null;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  const date = new Date(year, month - 1, dayOfMonth, hour, minute, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isStudentInClassData = (uid = "", classData = {}) => {
  const cleanUid = trimText(uid);
  const students = Array.isArray(classData?.students) ? classData.students : [];
  return students.some((entry) => {
    if (typeof entry === "string") return trimText(entry) === cleanUid;
    return (
      trimText(entry?.studentId || entry?.id || entry?.uid) === cleanUid
    );
  });
};

const resolveSessionRuntimeState = (sessionData = {}) => {
  const now = new Date();
  const startAt = resolveSessionDateTime(sessionData.date, sessionData.startTime);
  const endAt = resolveSessionDateTime(sessionData.date, sessionData.endTime);
  const explicitStatus = lowerText(sessionData.status || "");
  if (explicitStatus === "cancelled") {
    return { status: "cancelled", startAt, endAt, isRunning: false };
  }
  if (explicitStatus === "completed") {
    return { status: "completed", startAt, endAt, isRunning: false };
  }
  if (!startAt || !endAt || endAt.getTime() <= startAt.getTime()) {
    return { status: "upcoming", startAt, endAt, isRunning: false };
  }
  if (now.getTime() < startAt.getTime()) {
    return { status: "upcoming", startAt, endAt, isRunning: false };
  }
  if (now.getTime() >= endAt.getTime()) {
    return { status: "completed", startAt, endAt, isRunning: false };
  }
  return { status: "active", startAt, endAt, isRunning: true };
};

const getStudentSessionAccess = async ({ studentId = "", sessionId = "" }) => {
  const sessionSnap = await db.collection(COLLECTIONS.SESSIONS).doc(sessionId).get();
  if (!sessionSnap.exists) return { error: "Session not found", status: 404 };
  const sessionData = sessionSnap.data() || {};
  const classId = trimText(sessionData.classId);
  if (!classId) return { error: "Session class is missing", status: 500 };

  const [classSnap, enrollmentSnap] = await Promise.all([
    db.collection(COLLECTIONS.CLASSES).doc(classId).get(),
    db
      .collection(COLLECTIONS.ENROLLMENTS)
      .where("studentId", "==", studentId)
      .where("classId", "==", classId)
      .where("status", "==", "active")
      .limit(1)
      .get(),
  ]);

  if (!classSnap.exists) return { error: "Class not found", status: 404 };
  const classData = classSnap.data() || {};

  const canAccess = !enrollmentSnap.empty || isStudentInClassData(studentId, classData);
  if (!canAccess) {
    return { error: "You are not enrolled in this class session", status: 403 };
  }

  return {
    sessionRef: sessionSnap.ref,
    sessionData,
    classData,
  };
};

const findNextShiftOccurrence = ({
  shift = {},
  classData = {},
  durationSeconds = 0,
  now = new Date(),
}) => {
  const startTime = trimText(shift?.startTime);
  const startMinutes = parseTimeToMinutes(startTime);
  if (startMinutes === null) return null;

  const classStartKey = getPkDateKey(classData.startDate);
  const classEndKey = getPkDateKey(classData.endDate);
  const todayKey = getPkDateKey(now);
  if (!todayKey) return null;

  const activeWeekdays = normalizeShiftDays(shift?.days);
  const maxLookAheadDays = 366;

  for (let offset = 0; offset <= maxLookAheadDays; offset += 1) {
    const dateKey = addDaysToDateKey(todayKey, offset);
    if (!dateKey) continue;
    if (classStartKey && dateKey < classStartKey) continue;
    if (classEndKey && dateKey > classEndKey) continue;

    if (activeWeekdays.length > 0) {
      const weekday = getPkWeekdayIndex(toPkDateTime(dateKey, "12:00"));
      if (weekday === null || !activeWeekdays.includes(weekday)) continue;
    }

    const startAt = toPkDateTime(dateKey, startTime);
    if (!startAt) continue;
    const endAt = new Date(startAt.getTime() + durationSeconds * 1000);
    if (endAt.getTime() <= now.getTime()) continue;

    return { dateKey, startAt, endAt };
  }

  return null;
};

const removeTrailingSlashes = (value = "") => trimText(value).replace(/\/+$/, "");

const getRequestProtocol = (req) => {
  const forwarded = trimText(req.headers?.["x-forwarded-proto"]);
  if (forwarded) return forwarded.split(",")[0].trim();
  return trimText(req.protocol) || "https";
};

const getApiBaseUrl = (req) => {
  const configured = removeTrailingSlashes(process.env.API_BASE_URL || "");
  if (configured) return configured;
  const host = trimText(req.headers?.["x-forwarded-host"] || req.get?.("host"));
  if (!host) return removeTrailingSlashes(process.env.CLIENT_URL || "");
  return `${getRequestProtocol(req)}://${host}`;
};

const getCertificateDownloadUrl = (req, cert = {}) => {
  const direct = trimText(
    cert.pdfUrl ||
      cert.downloadUrl ||
      cert.certificatePdfUrl ||
      cert.fileUrl ||
      cert.url
  );
  if (/^https?:\/\//i.test(direct)) return direct;

  const certKey = trimText(cert.id || cert.certId);
  if (!certKey) return null;
  const baseUrl = getApiBaseUrl(req);
  if (!baseUrl) return `/api/student/certificates/${encodeURIComponent(certKey)}/download`;
  return `${baseUrl}/api/student/certificates/${encodeURIComponent(certKey)}/download`;
};

const formatCertificateIssuedDate = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return "N/A";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const buildCertificateCompletionTitle = (cert = {}) => {
  const completionTitle = trimText(cert.completionTitle);
  if (completionTitle) return completionTitle;

  const className = trimText(cert.className);
  const batchCode = trimText(cert.batchCode);
  const courseName = trimText(cert.courseName);
  if (className) {
    const classLabel = batchCode ? `${className} (${batchCode})` : className;
    return courseName ? `${classLabel} - ${courseName}` : classLabel;
  }
  return courseName || "Course Completion";
};

const streamCertificatePdf = (res, cert = {}) => {
  const certId = trimText(cert.certId || cert.id || "certificate");
  const safeFileName = `SUM_Certificate_${certId}`.replace(/[^a-zA-Z0-9._-]/g, "_");
  const studentName = trimText(cert.studentName || "Student");
  const completionTitle = buildCertificateCompletionTitle(cert);
  const issuedOn = formatCertificateIssuedDate(cert.issuedAt || cert.createdAt);
  const verificationUrl = trimText(cert.verificationUrl || "");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}.pdf"`);
  res.setHeader("Cache-Control", "private, no-store, max-age=0");

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(res);

  doc.rect(24, 24, 547, 795).lineWidth(1.2).stroke("#2A4D9B");

  doc.fontSize(16).fillColor("#2A4D9B").text("SUM Academy", { align: "center" });
  doc.moveDown(0.6);
  doc.fontSize(32).fillColor("#111827").text("Certificate of Completion", { align: "center" });
  doc.moveDown(1.2);
  doc.fontSize(13).fillColor("#4B5563").text("This is to certify that", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(30).fillColor("#0F172A").text(studentName, { align: "center" });
  doc.moveDown(0.6);
  doc.fontSize(12).fillColor("#4B5563").text("has successfully completed", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(18).fillColor("#1D4ED8").text(completionTitle, { align: "center" });

  doc.moveDown(2.2);
  doc.fontSize(11).fillColor("#6B7280").text(`Certificate ID: ${certId}`, { align: "center" });
  doc.moveDown(0.4);
  doc.fontSize(11).fillColor("#6B7280").text(`Issued on: ${issuedOn}`, { align: "center" });
  if (verificationUrl) {
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#2563EB").text(`Verify: ${verificationUrl}`, {
      align: "center",
      link: verificationUrl,
      underline: true,
    });
  }

  doc.moveDown(3);
  doc.fontSize(11).fillColor("#111827").text("Authorized by", { align: "center" });
  doc.moveDown(0.4);
  doc.fontSize(13).fillColor("#111827").text("SUM Academy", { align: "center" });

  doc.end();
};

const getValidatedStudentCertificates = async (uid) => {
  const studentSnap = await db.collection(COLLECTIONS.STUDENTS).doc(uid).get();
  if (!studentSnap.exists) return [];
  const studentData = studentSnap.data() || {};
  const certRefs = Array.isArray(studentData.certificates) ? studentData.certificates : [];
  const certIds = certRefs
    .map((entry) => trimText(entry?.certId || entry?.id))
    .filter(Boolean);

  if (!certIds.length) return [];

  const certDocs = await Promise.all(
    certIds.map(async (certId) => {
      const byCertIdSnap = await db
        .collection(COLLECTIONS.CERTIFICATES)
        .where("certId", "==", certId)
        .limit(1)
        .get();
      if (!byCertIdSnap.empty) {
        const row = byCertIdSnap.docs[0];
        return { id: row.id, ...(row.data() || {}) };
      }
      const docSnap = await db.collection(COLLECTIONS.CERTIFICATES).doc(certId).get();
      return docSnap.exists ? { id: docSnap.id, ...(docSnap.data() || {}) } : null;
    })
  );

  const normalizedCerts = certDocs
    .filter(Boolean)
    .map((cert) => ({
      ...cert,
      issuedAt: toIso(cert.issuedAt),
      createdAt: toIso(cert.createdAt),
      revokedAt: toIso(cert.revokedAt),
    }));

  const certCourseIds = [
    ...new Set(
      normalizedCerts
        .map((cert) => trimText(cert.subjectId || cert.courseId))
        .filter(Boolean)
    ),
  ];
  const courseValidationMap = Object.fromEntries(
    await Promise.all(
      certCourseIds.map(async (courseId) => {
        try {
          const [lectures, progressRows, finalQuizState] = await Promise.all([
            getCourseLectures(courseId),
            getProgressRowsForStudent(uid, courseId),
            resolveFinalQuizRequirementState({ studentId: uid, courseId }),
          ]);
          const progressMap = buildLectureProgressMap(progressRows, courseId);
          const totalLectures = lectures.length;
          const completedLectures = lectures.filter(
            (lecture) => progressMap[lecture.id]?.isCompleted
          ).length;
          const lecturesCompleted =
            totalLectures > 0 ? completedLectures >= totalLectures : true;
          const finalQuizOk =
            !finalQuizState.requiresFinalQuiz || finalQuizState.finalQuizPassed;
          return [courseId, lecturesCompleted && finalQuizOk];
        } catch {
          return [courseId, false];
        }
      })
    )
  );

  return normalizedCerts
    .filter((cert) => {
      const courseId = trimText(cert.subjectId || cert.courseId);
      if (!courseId) return false;
      return courseValidationMap[courseId] === true;
    })
    .sort(
      (a, b) =>
        (parseDate(b.issuedAt || b.createdAt)?.getTime() || 0) -
        (parseDate(a.issuedAt || a.createdAt)?.getTime() || 0)
    );
};

const formatSessionDate = (value) => {
  const text = trimText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10);
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : "";
};

const toDateOnly = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return null;
  const date = new Date(parsed);
  date.setHours(0, 0, 0, 0);
  return date;
};

const maxDate = (dates = []) =>
  dates.filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0] || null;

const minDate = (dates = []) =>
  dates.filter(Boolean).sort((a, b) => a.getTime() - b.getTime())[0] || null;

const isDateInRange = (date, start, end) => {
  if (!date) return false;
  if (start && date.getTime() < start.getTime()) return false;
  if (end && date.getTime() > end.getTime()) return false;
  return true;
};

const daysInclusive = (start, end) => {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  if (endDate.getTime() < startDate.getTime()) return 0;
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
};

const getCurrentAndLongestStreak = (sessions = []) => {
  if (!Array.isArray(sessions) || !sessions.length) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const sorted = [...sessions].sort(
    (a, b) => (toDateOnly(a.date)?.getTime() || 0) - (toDateOnly(b.date)?.getTime() || 0)
  );
  const isPresentLike = (status) => ["present", "late"].includes(lowerText(status));

  let longest = 0;
  let running = 0;
  sorted.forEach((row) => {
    if (isPresentLike(row.status)) {
      running += 1;
      if (running > longest) longest = running;
    } else {
      running = 0;
    }
  });

  let current = 0;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    if (!isPresentLike(sorted[index].status)) break;
    current += 1;
  }

  return { currentStreak: current, longestStreak: longest };
};

const getNameFromEmail = (email = "") => trimText(email).split("@")[0] || "Student";

const resolveClientContext = (req) => {
  const forwarded = req.headers?.["x-forwarded-for"];
  const realIP = forwarded
    ? String(forwarded).split(",")[0].trim()
    : req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      "unknown";

  const clientIP =
    realIP === "::1"
      ? "127.0.0.1"
      : String(realIP).startsWith("::ffff:")
        ? String(realIP).replace("::ffff:", "")
        : String(realIP);

  const userAgent = String(req.headers?.["user-agent"] || "unknown");
  let browser = "Unknown Browser";
  if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) browser = "Chrome";
  else if (/firefox/i.test(userAgent)) browser = "Firefox";
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = "Safari";
  else if (/edg/i.test(userAgent)) browser = "Edge";
  else if (/opera|opr/i.test(userAgent)) browser = "Opera";

  let os = "Unknown OS";
  if (/windows/i.test(userAgent)) os = "Windows";
  else if (/macintosh|mac os/i.test(userAgent)) os = "MacOS";
  else if (/linux/i.test(userAgent)) os = "Linux";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/iphone|ipad/i.test(userAgent)) os = "iOS";

  return {
    clientIP,
    clientDevice: `${browser} on ${os}`,
    userAgent,
  };
};

const chunkArray = (items = [], size = 10) => {
  const rows = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
};

const getStudentAndUser = async (uid) => {
  const [studentSnap, userSnap] = await Promise.all([
    db.collection(COLLECTIONS.STUDENTS).doc(uid).get(),
    db.collection(COLLECTIONS.USERS).doc(uid).get(),
  ]);
  return {
    studentExists: studentSnap.exists,
    userExists: userSnap.exists,
    studentData: studentSnap.exists ? studentSnap.data() || {} : {},
    userData: userSnap.exists ? userSnap.data() || {} : {},
  };
};

const getEnrolledRows = async (uid) => {
  const snap = await db
    .collection(COLLECTIONS.ENROLLMENTS)
    .where("studentId", "==", uid)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
};

const getStudentClassMembershipRows = async (uid) => {
  const classesSnap = await db.collection(COLLECTIONS.CLASSES).get();
  return classesSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((row) => {
      const students = Array.isArray(row.students) ? row.students : [];
      return students.some((entry) => {
        if (typeof entry === "string") return trimText(entry) === uid;
        return trimText(entry?.studentId || entry?.id || entry?.uid) === uid;
      });
    });
};

const getStudentCourseIdsFromClassRow = (classData = {}, uid = "") => {
  const courseIds = new Set();
  const students = Array.isArray(classData.students) ? classData.students : [];
  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  const shiftCourseMap = shifts.reduce((acc, shift) => {
    const shiftId = trimText(shift?.id);
    const shiftCourseId = trimText(shift?.subjectId || shift?.courseId);
    if (shiftId && shiftCourseId) acc[shiftId] = shiftCourseId;
    return acc;
  }, {});

  const assignedSubjectIds = (Array.isArray(classData.assignedSubjects)
    ? classData.assignedSubjects
    : []
  )
    .map((entry) => {
      if (typeof entry === "string") return trimText(entry);
      return trimText(entry?.subjectId || entry?.courseId || entry?.id);
    })
    .filter(Boolean);
  const assignedCourseIds = (Array.isArray(classData.assignedCourses)
    ? classData.assignedCourses
    : []
  )
    .map((entry) => {
      if (typeof entry === "string") return trimText(entry);
      return trimText(entry?.subjectId || entry?.courseId || entry?.id);
    })
    .filter(Boolean);

  const matchingEntries = students
    .map((entry) =>
      typeof entry === "string"
        ? { studentId: trimText(entry), shiftId: "", courseId: "" }
        : {
            studentId: trimText(entry?.studentId || entry?.id || entry?.uid),
            shiftId: trimText(entry?.shiftId),
            courseId: trimText(entry?.subjectId || entry?.courseId),
          }
    )
    .filter((entry) => entry.studentId === uid);

  if (matchingEntries.length < 1) return [];

  assignedSubjectIds.forEach((courseId) => {
    if (courseId) courseIds.add(courseId);
  });
  assignedCourseIds.forEach((courseId) => {
    if (courseId) courseIds.add(courseId);
  });

  matchingEntries.forEach((entry) => {
    if (entry.courseId) courseIds.add(entry.courseId);
    if (entry.shiftId && shiftCourseMap[entry.shiftId]) {
      courseIds.add(shiftCourseMap[entry.shiftId]);
    }
  });

  if (!courseIds.size) {
    const classCourseId = trimText(classData.courseId);
    if (classCourseId) {
      courseIds.add(classCourseId);
    } else if (assignedCourseIds.length === 1) {
      courseIds.add(assignedCourseIds[0]);
    }
  }

  return [...courseIds];
};

const ACTIVE_ENROLLMENT_STATUSES = new Set([
  "active",
  "upcoming",
  "completed",
  "pending_review",
  "",
]);
const PENDING_PAYMENT_STATUSES = new Set([
  "awaiting_receipt",
  "pending",
  "pending_verification",
]);
const FINAL_QUIZ_REQUEST_STATUSES = new Set([
  "pending",
  "approved",
  "rejected",
  "completed",
  "cancelled",
]);

const getStudentPendingPayments = async (uid, courseId = "") => {
  const snap = await db
    .collection(COLLECTIONS.PAYMENTS)
    .where("studentId", "==", uid)
    .get();

  const cleanCourseId = trimText(courseId);
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((row) => PENDING_PAYMENT_STATUSES.has(lowerText(row.status || "pending")))
    .filter((row) => (cleanCourseId ? trimText(row.subjectId || row.courseId) === cleanCourseId : true))
    .sort(
      (a, b) =>
        (parseDate(b.createdAt)?.getTime() || 0) -
        (parseDate(a.createdAt)?.getTime() || 0)
    );
};

const getStudentEnrolledCourseIds = async (uid, includeClassFallback = true) => {
  const enrollments = await getEnrolledRows(uid);

  const enrollmentIds = enrollments
    .filter((row) => ACTIVE_ENROLLMENT_STATUSES.has(lowerText(row.status || "active")))
    .map((row) => trimText(row.subjectId || row.courseId))
    .filter(Boolean);

  if (enrollmentIds.length > 0 || !includeClassFallback) {
    return [...new Set(enrollmentIds)];
  }

  const classMembershipRows = await getStudentClassMembershipRows(uid);
  const classCourseIds = classMembershipRows.flatMap((row) =>
    getStudentCourseIdsFromClassRow(row, uid)
  );

  return [...new Set([...classCourseIds, ...enrollmentIds])];
};

const getStudentClassIds = async (uid, enrollments = null) => {
  const enrollmentRows = Array.isArray(enrollments) ? enrollments : await getEnrolledRows(uid);
  const classFromEnrollments = enrollmentRows
    .map((row) => trimText(row.classId))
    .filter(Boolean);

  const fromClassMembership = (await getStudentClassMembershipRows(uid)).map((row) => row.id);

  return [...new Set([...classFromEnrollments, ...fromClassMembership])];
};

const getClassStatus = (classData = {}) => {
  const explicitStatus = lowerText(classData.status || "");
  const start = parseDate(classData.startDate);
  const end = parseDate(classData.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const capacity = Math.max(1, toNumber(classData.capacity, 30));
  const enrolledCount = Math.max(
    toNumber(classData.enrolledCount, 0),
    Array.isArray(classData.students) ? classData.students.length : 0
  );

  if (start) {
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    if (today.getTime() < startDay.getTime()) return "upcoming";
  }
  if (end) {
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    if (today.getTime() > endDay.getTime()) return "expired";
  }
  if (enrolledCount >= capacity) return "full";
  if (explicitStatus === "expired" || explicitStatus === "completed") return "expired";
  if (explicitStatus === "upcoming") return "upcoming";
  if (explicitStatus === "full") return "full";
  return "active";
};

const isClassUnlockedForStudent = (classData = {}, uid = "") => {
  const cleanUid = trimText(uid);
  if (!cleanUid) return false;

  const directIds = Array.isArray(classData.unlockedStudentIds)
    ? classData.unlockedStudentIds
    : [];
  if (directIds.some((entry) => trimText(entry) === cleanUid)) return true;

  const altIds = Array.isArray(classData.rewatchUnlockedStudentIds)
    ? classData.rewatchUnlockedStudentIds
    : [];
  if (altIds.some((entry) => trimText(entry) === cleanUid)) return true;

  const rows = Array.isArray(classData.unlockedStudents) ? classData.unlockedStudents : [];
  return rows.some((entry) => {
    const studentId =
      typeof entry === "string"
        ? trimText(entry)
        : trimText(entry?.studentId || entry?.id || entry?.uid);
    if (studentId !== cleanUid) return false;
    if (typeof entry === "object" && entry?.active === false) return false;
    return true;
  });
};

const buildClassCompletionStateForStudent = ({
  uid = "",
  classData = {},
  enrollments = [],
  progressRows = [],
}) => {
  const classId = trimText(classData.id);
  const classCourseIds = getStudentCourseIdsFromClassRow(classData, uid);
  const enrollmentCourseIds = enrollments
    .filter(
      (row) => trimText(row.studentId) === uid && trimText(row.classId) === classId
    )
    .map((row) => trimText(row.subjectId || row.courseId))
    .filter(Boolean);
  const resolvedCourseIds = [
    ...new Set(
      (classCourseIds.length > 0 ? classCourseIds : enrollmentCourseIds).filter(Boolean)
    ),
  ];

  const courseCompletionRows = resolvedCourseIds.map((courseId) => {
    const enrollment = enrollments.find(
      (row) =>
        trimText(row.studentId) === uid &&
        trimText(row.subjectId || row.courseId) === courseId &&
        (!trimText(row.classId) || trimText(row.classId) === classId)
    );
    const progress = normalizeProgressPercent(progressRows, courseId, 0);
    const status = lowerText(enrollment?.status || "active");
    const completed =
      progress >= 100 || status === "completed" || Boolean(enrollment?.completedAt);
    return { courseId, progress, completed };
  });

  const allCoursesCompleted =
    courseCompletionRows.length > 0 && courseCompletionRows.every((row) => row.completed);
  const status = getClassStatus(classData);
  const manualCompleted =
    lowerText(classData.completionStatus) === "completed" ||
    lowerText(classData.status) === "completed" ||
    Boolean(classData.completedByTeacher) ||
    Boolean(classData.isCompleted);
  const endedByDate = status === "completed";
  const completed = manualCompleted || endedByDate || allCoursesCompleted;
  const lockAfterCompletion = classData.lockAfterCompletion !== false;
  const studentUnlocked = isClassUnlockedForStudent(classData, uid);
  const isLocked = completed && lockAfterCompletion && !studentUnlocked;

  return {
    classId,
    className: trimText(classData.name) || "Class",
    batchCode: trimText(classData.batchCode),
    status,
    completed,
    endedByDate,
    manualCompleted,
    allCoursesCompleted,
    lockAfterCompletion,
    studentUnlocked,
    isLocked,
    courseCompletionRows,
    courseIds: resolvedCourseIds,
  };
};

const resolveCourseAccessStateFromClasses = ({
  uid = "",
  courseId = "",
  classRows = [],
  enrollments = [],
  progressRows = [],
}) => {
  const cleanCourseId = trimText(courseId);
  const contexts = classRows
    .map((classData) =>
      buildClassCompletionStateForStudent({
        uid,
        classData,
        enrollments,
        progressRows,
      })
    )
    .filter((row) => row.courseIds.includes(cleanCourseId));

  if (!contexts.length) {
    return {
      hasClassContext: false,
      isLocked: false,
      isCompletedWindow: false,
      eligibleForCertificate: true,
      classStates: [],
    };
  }

  const isLocked = contexts.every((row) => row.isLocked);
  const isCompletedWindow = contexts.some((row) => row.completed);
  const firstCompletedContext =
    contexts.find((row) => row.completed) || contexts[0] || null;

  return {
    hasClassContext: true,
    isLocked,
    isCompletedWindow,
    eligibleForCertificate: isCompletedWindow,
    classStates: contexts,
    preferredClassContext: firstCompletedContext
      ? {
          classId: firstCompletedContext.classId,
          className: firstCompletedContext.className,
          batchCode: firstCompletedContext.batchCode,
        }
      : null,
  };
};

const buildStudentClassAndCourseData = ({
  uid = "",
  classRows = [],
  enrollments = [],
  courseMap = {},
  progressRows = [],
}) => {
  const classes = [];
  const courseRows = [];

  classRows.forEach((classData = {}) => {
    const classId = trimText(classData.id);
    if (!classId) return;

    const assignedCourseIds = (Array.isArray(classData.assignedCourses)
      ? classData.assignedCourses
      : []
    )
      .map((entry) => {
        if (typeof entry === "string") return trimText(entry);
        return trimText(entry?.courseId || entry?.id);
      })
      .filter(Boolean);
    const fallbackClassCourseIds = getStudentCourseIdsFromClassRow(classData, uid);
    const activeEnrollmentRows = enrollments.filter((row) => {
      const rowStudentId = trimText(row.studentId);
      const rowClassId = trimText(row.classId);
      const rowCourseId = trimText(row.subjectId || row.courseId);
      const rowStatus = lowerText(row.status || "active");
      return (
        rowStudentId === uid &&
        rowClassId === classId &&
        rowCourseId &&
        ACTIVE_ENROLLMENT_STATUSES.has(rowStatus)
      );
    });
    const enrollmentCourseIds = activeEnrollmentRows
      .map((row) => trimText(row.subjectId || row.courseId))
      .filter(Boolean);
    const paidCourseIdSet = new Set(enrollmentCourseIds);
    const resolvedCourseIds = [
      ...new Set(
        [...assignedCourseIds, ...fallbackClassCourseIds, ...enrollmentCourseIds].filter(Boolean)
      ),
    ];

    const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
    const students = Array.isArray(classData.students) ? classData.students : [];
    const studentEntry = students
      .map((entry) =>
        typeof entry === "string"
          ? { studentId: trimText(entry), shiftId: "", enrolledAt: null }
          : {
              studentId: trimText(entry?.studentId || entry?.id || entry?.uid),
              shiftId: trimText(entry?.shiftId),
              enrolledAt: entry?.enrolledAt || null,
            }
      )
      .find((entry) => entry.studentId === uid);
    const shift = shifts.find(
      (row) => trimText(row?.id) === trimText(studentEntry?.shiftId)
    );
    const classCompletionState = buildClassCompletionStateForStudent({
      uid,
      classData: { ...classData, id: classId },
      enrollments,
      progressRows,
    });
    const classStatus = getClassStatus(classData);
    const isExpired = classStatus === "expired";
    const isUpcoming = classStatus === "upcoming";
    const isFull = classStatus === "full";
    const canEnroll = !isExpired && !isFull;
    const canLearn = !isExpired && !isUpcoming;
    const today = toDateOnly(new Date());
    const startDateOnly = toDateOnly(classData.startDate);
    const endDateOnly = toDateOnly(classData.endDate);
    const daysUntilStart = startDateOnly && today
      ? Math.ceil((startDateOnly.getTime() - today.getTime()) / 86400000)
      : null;
    const daysUntilEnd = endDateOnly && today
      ? Math.ceil((endDateOnly.getTime() - today.getTime()) / 86400000)
      : null;

    const classCourses = resolvedCourseIds.map((courseId) => {
      const cleanCourseId = trimText(courseId);
      const course = courseMap[cleanCourseId] || {};
      const enrollment = activeEnrollmentRows.find((row) => {
        const rowClassId = trimText(row.classId);
        const rowCourseId = trimText(row.subjectId || row.courseId);
        return rowCourseId === cleanCourseId && (!rowClassId || rowClassId === classId);
      });
      const isPaymentLocked = !Boolean(enrollment);
      const classWindowLocked = isUpcoming || isExpired;
      const subjects = Array.isArray(course.subjects) ? course.subjects : [];
      const teacherName =
        trimText(course.teacherName) ||
        trimText(subjects[0]?.teacherName) ||
        trimText(shift?.teacherName) ||
        "Teacher";
      const progress = isPaymentLocked
        ? 0
        : normalizeProgressPercent(
            progressRows,
            cleanCourseId,
            0
          );
      const courseState = classCompletionState.courseCompletionRows.find(
        (row) => trimText(row.subjectId || row.courseId) === cleanCourseId
      );
      const latestActivity = isPaymentLocked
        ? 0
        : progressRows
            .filter(
              (row) =>
                trimText(row.subjectId || row.courseId) === cleanCourseId
            )
            .map(
              (row) =>
                parseDate(row.updatedAt || row.completedAt || row.createdAt)?.getTime() || 0
            )
            .sort((a, b) => b - a)[0] || 0;
      const price = 0;
      const discountPercent = 0;
      const finalPrice = 0;

      const payload = {
        id: `${classId}_${cleanCourseId}`,
        classId,
        className: trimText(classData.name) || "Class",
        batchCode: trimText(classData.batchCode),
        courseId: cleanCourseId,
        title: trimText(course.title) || "Course",
        description: trimText(course.description || course.shortDescription),
        thumbnail: course.thumbnail || null,
        category: trimText(course.category),
        level: trimText(course.level || "beginner"),
        teacherName,
        subjects: subjects.map((subject) => ({
          id: trimText(subject?.id || subject?.subjectId),
          name: trimText(subject?.name || subject?.subjectName) || "Subject",
          teacherId: trimText(subject?.teacherId),
          teacherName: trimText(subject?.teacherName) || "Teacher",
        })),
        price,
        discountPercent,
        finalPrice,
        enrollmentType: lowerText(enrollment?.enrollmentType || ""),
        isPaymentLocked,
        progress,
        isCompleted: !isPaymentLocked && clampPercent(progress) >= 100,
        classCompleted: classCompletionState.completed,
        classStatus,
        classLocked:
          !isPaymentLocked &&
          (
            classCompletionState.isLocked ||
            classWindowLocked ||
            (
              Boolean(courseState?.completed) &&
              classCompletionState.lockAfterCompletion &&
              !classCompletionState.studentUnlocked
            )
          ),
        canRewatch:
          !isPaymentLocked &&
          !(
            classCompletionState.isLocked ||
            classWindowLocked ||
            (
              Boolean(courseState?.completed) &&
              classCompletionState.lockAfterCompletion &&
              !classCompletionState.studentUnlocked
            )
          ),
        certificateEligible: !isPaymentLocked && classCompletionState.completed,
        courseCompletedInClass: !isPaymentLocked && Boolean(courseState?.completed),
        enrolledAt:
          isPaymentLocked
            ? null
            : enrollment?.createdAt ||
              enrollment?.enrolledAt ||
              studentEntry?.enrolledAt ||
              null,
        latestActivity,
        paymentLockMessage: isPaymentLocked
          ? "Purchase this course to access content."
          : classWindowLocked
            ? isUpcoming
              ? "Class has not started yet."
              : "Class has expired."
            : "",
      };

      courseRows.push(payload);
      return payload;
    });

    const paidClassCourses = classCourses.filter((row) => !row.isPaymentLocked);
    const overallProgress =
      paidClassCourses.length > 0
        ? Number(
            (
              paidClassCourses.reduce((sum, row) => sum + clampPercent(row.progress), 0) /
              paidClassCourses.length
            ).toFixed(2)
          )
        : 0;
    const paidCoursesCount = paidClassCourses.length;
    const totalCoursesCount = classCourses.length;
    const lockedCoursesCount = Math.max(totalCoursesCount - paidCoursesCount, 0);

    classes.push({
      classId,
      id: classId,
      name: trimText(classData.name) || "Class",
      batchCode: trimText(classData.batchCode),
      description: trimText(classData.description),
      status: classStatus,
      classStatus,
      canEnroll,
      canLearn,
      isExpired,
      isUpcoming,
      isFull,
      isCompletedWindow: classCompletionState.completed,
      isLockedAfterCompletion: classCompletionState.isLocked,
      canRewatch: !classCompletionState.isLocked,
      lockAfterCompletion: classCompletionState.lockAfterCompletion,
      unlockedForStudent: classCompletionState.studentUnlocked,
      teacherName:
        trimText(classData.teacherName) ||
        trimText(classData.teachers?.[0]?.teacherName) ||
        trimText(shift?.teacherName) ||
        "Teacher",
      capacity: Math.max(1, toNumber(classData.capacity, 30)),
      enrolledCount: Array.isArray(classData.students) ? classData.students.length : 0,
      startDate: toIso(classData.startDate),
      endDate: toIso(classData.endDate),
      daysUntilStart,
      daysUntilEnd,
      shiftId: trimText(shift?.id),
      shiftName: trimText(shift?.name),
      shiftDays: Array.isArray(shift?.days) ? shift.days : [],
      shiftStartTime: trimText(shift?.startTime),
      shiftEndTime: trimText(shift?.endTime),
      courses: classCourses,
      paidCoursesCount,
      totalCoursesCount,
      lockedCoursesCount,
      hasLockedCourses: lockedCoursesCount > 0,
      overallProgress,
    });
  });

  return { classes, courseRows };
};

const getCourseDocsByIds = async (courseIds = []) => {
  const uniqueIds = [...new Set(courseIds.map((id) => trimText(id)).filter(Boolean))];
  if (!uniqueIds.length) return {};

  const snaps = await Promise.all(
    uniqueIds.map(async (courseId) => {
      const [subjectSnap, courseSnap] = await Promise.all([
        db.collection(COLLECTIONS.SUBJECTS).doc(courseId).get(),
        db.collection(COLLECTIONS.COURSES).doc(courseId).get(),
      ]);
      return subjectSnap.exists ? subjectSnap : courseSnap;
    })
  );
  return snaps.reduce((acc, snap) => {
    if (snap.exists) acc[snap.id] = snap.data() || {};
    return acc;
  }, {});
};

const getProgressRowsForStudent = async (uid, courseId = "") => {
  const snap = await db
    .collection(COLLECTIONS.PROGRESS)
    .where("studentId", "==", uid)
    .get();

  const rows = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  const cleanCourseId = trimText(courseId);
  if (!cleanCourseId) return rows;
  return rows.filter(
    (row) => trimText(row.subjectId || row.courseId) === cleanCourseId || !trimText(row.subjectId || row.courseId)
  );
};

const getCourseLectures = async (courseId) => {
  const [byCourseSnap, bySubjectSnap] = await Promise.all([
    db.collection(COLLECTIONS.LECTURES).where("courseId", "==", courseId).get(),
    db.collection(COLLECTIONS.LECTURES).where("subjectId", "==", courseId).get(),
  ]);
  const byCourse = [...byCourseSnap.docs, ...bySubjectSnap.docs]
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(
      (row, index, arr) => arr.findIndex((entry) => trimText(entry.id) === trimText(row.id)) === index
    );
  if (byCourse.length > 0) return byCourse;

  const [chaptersByCourseSnap, chaptersBySubjectSnap] = await Promise.all([
    db.collection(COLLECTIONS.CHAPTERS).where("courseId", "==", courseId).get(),
    db.collection(COLLECTIONS.CHAPTERS).where("subjectId", "==", courseId).get(),
  ]);
  const chapterIds = [...chaptersByCourseSnap.docs, ...chaptersBySubjectSnap.docs].map(
    (doc) => doc.id
  );
  if (!chapterIds.length) return [];

  const lectureChunks = await Promise.all(
    chunkArray(chapterIds, 10).map((ids) =>
      db.collection(COLLECTIONS.LECTURES).where("chapterId", "in", ids).get()
    )
  );
  return lectureChunks.flatMap((snap) =>
    snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
  );
};

const normalizeProgressPercent = (progressRows = [], courseId = "", fallback = 0) => {
  const cleanCourseId = trimText(courseId);
  const direct = progressRows.find(
    (row) =>
      trimText(row.subjectId || row.courseId) === cleanCourseId &&
      !trimText(row.lectureId)
  );
  const directPercent = Number(
    direct?.progress ?? direct?.progressPercent ?? direct?.completionPercent
  );
  if (Number.isFinite(directPercent)) return clampPercent(directPercent);

  const lectureRows = progressRows.filter(
    (row) =>
      trimText(row.lectureId) &&
      trimText(row.subjectId || row.courseId) === cleanCourseId
  );
  if (lectureRows.length > 0) {
    const byLectureId = lectureRows.reduce((acc, row) => {
      const lectureId = trimText(row.lectureId);
      if (!lectureId) return acc;
      const isCompleted = Boolean(
        row.isCompleted ||
          row.completed ||
          toNumber(row.progress, 0) >= 100 ||
          toNumber(row.progressPercent, 0) >= 100 ||
          toNumber(row.completionPercent, 0) >= 100
      );
      const rawPercent = Number(
        row.watchedPercent ?? row.progress ?? row.progressPercent ?? row.completionPercent
      );
      const durationSec = Math.max(
        0,
        toNumber(row.durationSec ?? row.videoDurationSec ?? row.totalDurationSec, 0)
      );
      const currentTimeSec = Math.max(
        0,
        toNumber(row.currentTimeSec ?? row.resumeAtSeconds ?? row.lastPositionSec, 0)
      );
      const inferredPercent =
        durationSec > 0 ? (Math.min(currentTimeSec, durationSec) / durationSec) * 100 : 0;
      const weightedPercent = isCompleted
        ? 100
        : clampPercent(Number.isFinite(rawPercent) ? rawPercent : inferredPercent);

      if (!acc[lectureId]) {
        acc[lectureId] = weightedPercent;
        return acc;
      }
      acc[lectureId] = Math.max(acc[lectureId], weightedPercent);
      return acc;
    }, {});

    const scores = Object.values(byLectureId);
    if (scores.length > 0) {
      const total = scores.reduce((sum, score) => sum + toNumber(score, 0), 0);
      const computedPercent = clampPercent(total / scores.length);
      const fallbackPercent = Number(fallback);
      if (Number.isFinite(fallbackPercent) && fallbackPercent > 0) {
        return clampPercent(Math.min(computedPercent, fallbackPercent));
      }
      return computedPercent;
    }
  }

  return clampPercent(fallback);
};

const buildLectureProgressMap = (progressRows = [], courseId = "") => {
  const cleanCourseId = trimText(courseId);
  const map = {};
  progressRows.forEach((row) => {
    const lectureId = trimText(row.lectureId);
    if (!lectureId) return;
    if (trimText(row.subjectId || row.courseId) && trimText(row.subjectId || row.courseId) !== cleanCourseId) return;
    map[lectureId] = {
      isCompleted: Boolean(
        row.isCompleted ||
          row.completed ||
          toNumber(row.progress, 0) >= 100 ||
          toNumber(row.progressPercent, 0) >= 100 ||
          toNumber(row.completionPercent, 0) >= 100
      ),
      completedAt: toIso(row.completedAt),
    };
  });
  return map;
};

const parseAnnouncementDate = (value) => parseDate(value)?.getTime() || 0;

const sanitizeQuestionForStudent = (question = {}) => {
  const type = lowerText(question.type || question.questionType);
  const optionsRaw = Array.isArray(question.options)
    ? question.options
    : question.options && typeof question.options === "object"
      ? [question.options.A, question.options.B, question.options.C, question.options.D].filter(Boolean)
      : [];
  const options = optionsRaw.map((option) => trimText(option)).filter(Boolean);

  return {
    questionId: trimText(question.questionId || question.id),
    type: type || "mcq",
    questionType: type || "mcq",
    questionText: trimText(question.questionText || question.text),
    options: type === "short_answer" ? [] : options,
    marks: Math.max(1, toNumber(question.marks, 1)),
    order: toNumber(question.order, 0),
  };
};

const normalizeSubmittedAnswers = (answers = []) => {
  if (Array.isArray(answers)) {
    return answers.reduce((acc, row) => {
      const questionId = trimText(row?.questionId);
      if (!questionId) return acc;
      acc[questionId] = row?.answer;
      return acc;
    }, {});
  }
  if (answers && typeof answers === "object") return { ...answers };
  return {};
};

const gradeObjectiveAnswer = (question = {}, rawAnswer) => {
  const type = lowerText(question.type || question.questionType);
  const marks = Math.max(1, toNumber(question.marks, 1));

  if (type === "short_answer") {
    return {
      isCorrect: null,
      marksObtained: null,
      status: "pending_review",
      pending: true,
    };
  }

  if (type === "true_false") {
    const answer = lowerText(rawAnswer);
    const submitted =
      answer === "true" || answer === "t" || answer === "1" || answer === "yes";
    const submittedKnown =
      ["true", "t", "1", "yes", "false", "f", "0", "no"].includes(answer);
    const correctRaw = question.correctAnswer;
    const correctBool =
      typeof correctRaw === "boolean"
        ? correctRaw
        : ["true", "t", "1", "yes"].includes(lowerText(correctRaw));
    const isCorrect = submittedKnown && submitted === correctBool;
    return {
      isCorrect,
      marksObtained: isCorrect ? marks : 0,
      status: "graded",
      pending: false,
    };
  }

  const optionsRaw = Array.isArray(question.options)
    ? question.options
    : question.options && typeof question.options === "object"
      ? [question.options.A, question.options.B, question.options.C, question.options.D].filter(Boolean)
      : [];
  const options = optionsRaw.map((option) => trimText(option));
  const correctRaw = trimText(question.correctAnswer);
  const answerText = trimText(rawAnswer);
  const letterMap = { A: 0, B: 1, C: 2, D: 3 };
  const answerUpper = answerText.toUpperCase();
  const correctUpper = correctRaw.toUpperCase();
  const selectedByLetter =
    letterMap[answerUpper] !== undefined ? trimText(options[letterMap[answerUpper]]) : "";
  const correctByLetter =
    letterMap[correctUpper] !== undefined ? trimText(options[letterMap[correctUpper]]) : "";
  const normalizedSubmitted = lowerText(selectedByLetter || answerText);
  const normalizedCorrect = lowerText(correctByLetter || correctRaw);
  const isCorrect =
    (letterMap[answerUpper] !== undefined &&
      letterMap[correctUpper] !== undefined &&
      answerUpper === correctUpper) ||
    (Boolean(normalizedSubmitted) && normalizedSubmitted === normalizedCorrect);

  return {
    isCorrect,
    marksObtained: isCorrect ? marks : 0,
    status: "graded",
    pending: false,
  };
};

const generateCertificateId = () => {
  const year = new Date().getFullYear();
  const token = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `SUM-${year}-${token.padEnd(8, "X").slice(0, 8)}`;
};

const isFinalQuizRow = (quiz = {}) => {
  const tags = Array.isArray(quiz.tags) ? quiz.tags : [];
  const scope = lowerText(quiz.scope || quiz.quizScope || "");
  const chapterId = trimText(quiz.chapterId);
  if (scope === "subject" || scope === "final") return true;
  if (!chapterId && scope && scope !== "chapter") return true;
  return (
    quiz.isFinalQuiz === true ||
    lowerText(quiz.quizType) === "final" ||
    lowerText(quiz.assessmentType) === "final" ||
    lowerText(quiz.type) === "final" ||
    lowerText(quiz.category) === "final" ||
    lowerText(quiz.tag) === "final" ||
    tags.some((tag) => lowerText(tag) === "final")
  );
};

const getCourseFinalQuizzes = async (courseId = "") => {
  const cleanCourseId = trimText(courseId);
  if (!cleanCourseId) return [];

  const [byCourseSnap, bySubjectSnap] = await Promise.all([
    db
      .collection(COLLECTIONS.QUIZZES)
      .where("courseId", "==", cleanCourseId)
      .get(),
    db
      .collection(COLLECTIONS.QUIZZES)
      .where("subjectId", "==", cleanCourseId)
      .get(),
  ]);

  return [...byCourseSnap.docs, ...bySubjectSnap.docs]
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(
      (row, index, arr) =>
        arr.findIndex((entry) => trimText(entry.id) === trimText(row.id)) === index
    )
    .filter((row) => !["draft", "inactive", "deleted", "archived"].includes(lowerText(row.status || "active")))
    .filter((row) => isFinalQuizRow(row));
};

const getLatestFinalQuizResultForStudent = async ({
  studentId = "",
  courseId = "",
  finalQuizMap = {},
}) => {
  const cleanStudentId = trimText(studentId);
  const cleanCourseId = trimText(courseId);
  if (!cleanStudentId || !cleanCourseId) {
    return null;
  }

  const snap = await db
    .collection(COLLECTIONS.QUIZ_RESULTS)
    .where("studentId", "==", cleanStudentId)
    .get();

  const finalQuizIds = new Set(Object.keys(finalQuizMap));
  if (!finalQuizIds.size) return null;

  const rows = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((row) => trimText(row.subjectId || row.courseId) === cleanCourseId)
    .filter((row) => finalQuizIds.has(trimText(row.quizId)))
    .sort(
      (a, b) =>
        (parseDate(b.submittedAt || b.updatedAt || b.createdAt)?.getTime() || 0) -
        (parseDate(a.submittedAt || a.updatedAt || a.createdAt)?.getTime() || 0)
    );

  if (!rows.length) return null;
  const latest = rows[0];
  const quizMeta = finalQuizMap[trimText(latest.quizId)] || {};
  const passScore = toNumber(
    latest.passScore ?? quizMeta.passScore,
    50
  );
  const percentage = toNumber(
    latest.percentage ?? latest.scorePercent ?? latest.totalScore,
    0
  );
  const passed =
    latest.isPassed === true ||
    (lowerText(latest.status) === "completed" && percentage >= passScore);

  return {
    resultId: latest.id,
    quizId: trimText(latest.quizId),
    status: lowerText(latest.status || "completed"),
    passScore,
    percentage,
    passed,
    submittedAt: toIso(latest.submittedAt || latest.createdAt),
  };
};

const getLatestFinalQuizRequest = async (studentId = "", courseId = "") => {
  const cleanStudentId = trimText(studentId);
  const cleanCourseId = trimText(courseId);
  if (!cleanStudentId || !cleanCourseId) return null;

  const snap = await db
    .collection(COLLECTIONS.FINAL_QUIZ_REQUESTS)
    .where("studentId", "==", cleanStudentId)
    .get();

  const rows = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((row) => trimText(row.subjectId || row.courseId) === cleanCourseId)
    .filter((row) => FINAL_QUIZ_REQUEST_STATUSES.has(lowerText(row.status || "pending")))
    .sort(
      (a, b) =>
        (parseDate(
          b.requestedAt || b.createdAt || b.updatedAt
        )?.getTime() || 0) -
        (parseDate(
          a.requestedAt || a.createdAt || a.updatedAt
        )?.getTime() || 0)
    );

  return rows[0] || null;
};

const getApprovedFinalQuizCourseIds = async (studentId = "") => {
  const cleanStudentId = trimText(studentId);
  if (!cleanStudentId) return new Set();

  const snap = await db
    .collection(COLLECTIONS.FINAL_QUIZ_REQUESTS)
    .where("studentId", "==", cleanStudentId)
    .get();

  const allowedStatuses = new Set(["approved", "completed"]);
  const courseIds = snap.docs
    .map((doc) => doc.data() || {})
    .filter((row) => allowedStatuses.has(lowerText(row.status || "")))
    .map((row) => trimText(row.subjectId || row.courseId))
    .filter(Boolean);

  return new Set(courseIds);
};

const canStudentAttemptQuiz = ({
  quiz = {},
  studentId = "",
  approvedFinalQuizCourseIds = new Set(),
}) => {
  const uid = trimText(studentId);
  if (!uid) return false;

  if (isQuizAssignedToStudent(quiz, uid)) return true;
  if (!isFinalQuizRow(quiz)) return false;

  const courseId = trimText(quiz.subjectId || quiz.courseId);
  return Boolean(courseId && approvedFinalQuizCourseIds.has(courseId));
};

const resolveFinalQuizRequirementState = async ({
  studentId = "",
  courseId = "",
}) => {
  const finalQuizzes = await getCourseFinalQuizzes(courseId);
  const finalQuizMap = finalQuizzes.reduce((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {});
  const requiresFinalQuiz = finalQuizzes.length > 0;
  if (!requiresFinalQuiz) {
    return {
      requiresFinalQuiz: false,
      finalQuizCount: 0,
      finalQuizPassed: true,
      requestId: "",
      requestStatus: "",
      requestSubmittedAt: null,
      requestReviewedAt: null,
      canRequest: false,
      latestFinalQuizResult: null,
    };
  }

  const [latestResult, latestRequest] = await Promise.all([
    getLatestFinalQuizResultForStudent({
      studentId,
      courseId,
      finalQuizMap,
    }),
    getLatestFinalQuizRequest(studentId, courseId),
  ]);

  const requestStatus = lowerText(latestRequest?.status || "");
  const canRequest =
    !latestResult?.passed &&
    requestStatus !== "pending" &&
    requestStatus !== "approved";

  return {
    requiresFinalQuiz: true,
    finalQuizCount: finalQuizzes.length,
    finalQuizPassed: Boolean(latestResult?.passed),
    requestId: trimText(latestRequest?.id),
    requestStatus,
    requestSubmittedAt: toIso(
      latestRequest?.requestedAt || latestRequest?.createdAt
    ),
    requestReviewedAt: toIso(
      latestRequest?.reviewedAt || latestRequest?.updatedAt
    ),
    canRequest,
    latestFinalQuizResult: latestResult,
  };
};

const ensureCertificateForCompletion = async ({
  studentId,
  studentData,
  userData,
  courseId,
  courseData,
  classContext = null,
}) => {
  const existingSnap = await db
    .collection(COLLECTIONS.CERTIFICATES)
    .where("studentId", "==", studentId)
    .where("courseId", "==", courseId)
    .limit(1)
    .get();
  if (!existingSnap.empty) return { created: false, certificateId: existingSnap.docs[0].id };

  const certRef = db.collection(COLLECTIONS.CERTIFICATES).doc();
  const certId = generateCertificateId();
  const studentName =
    trimText(studentData.fullName) ||
    trimText(studentData.name) ||
    trimText(userData.fullName) ||
    getNameFromEmail(userData.email || "");
  const courseName = trimText(courseData.title) || "Course";
  const className = trimText(classContext?.className);
  const batchCode = trimText(classContext?.batchCode);
  const classId = trimText(classContext?.classId);
  const completionScope = className ? "class" : "course";
  const completionTitle = className
    ? [className, batchCode ? `(${batchCode})` : ""].filter(Boolean).join(" ")
    : courseName;
  const verificationUrl = `${process.env.CLIENT_URL || ""}/verify/${certId}`;

  await certRef.set({
    studentId,
    studentName,
    courseId,
    courseName,
    classId: classId || null,
    className: className || null,
    batchCode: batchCode || null,
    completionScope,
    completionTitle,
    certId,
    verificationUrl,
    issuedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    isRevoked: false,
  });

  await db.collection(COLLECTIONS.STUDENTS).doc(studentId).set(
    {
      certificates: admin.firestore.FieldValue.arrayUnion({
        certId,
        courseId,
        courseName,
        classId: classId || null,
        className: className || null,
        batchCode: batchCode || null,
        completionScope,
        completionTitle,
        issuedAt: new Date().toISOString(),
      }),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  try {
    const email = trimText(userData.email);
    if (email) {
      await sendCertificateIssued(email, studentName, courseName, verificationUrl);
    }
  } catch (error) {
    console.error("sendCertificateIssued error:", error?.message || error);
  }

  return { created: true, certificateId: certRef.id, certId };
};

const ensureCertificatesForFullyCompletedClasses = async ({
  studentId,
  studentData = {},
  userData = {},
  classRows = [],
  enrollments = [],
  progressRows = [],
}) => {
  const cleanStudentId = trimText(studentId);
  if (!cleanStudentId) {
    return {
      targetedCourses: 0,
      createdCertificates: 0,
      blockedByFinalQuiz: 0,
    };
  }

  const completedClassStates = classRows
    .map((classData = {}) =>
      buildClassCompletionStateForStudent({
        uid: cleanStudentId,
        classData,
        enrollments,
        progressRows,
      })
    )
    .filter((row) => row.allCoursesCompleted && row.courseCompletionRows.length > 0);

  const targetCourseIds = [
    ...new Set(
      completedClassStates
        .flatMap((row) =>
          row.courseCompletionRows
            .filter((courseRow) => courseRow.completed)
            .map((courseRow) => trimText(courseRow.courseId))
        )
        .filter(Boolean)
    ),
  ];

  if (!targetCourseIds.length) {
    return {
      targetedCourses: 0,
      createdCertificates: 0,
      blockedByFinalQuiz: 0,
    };
  }

  const courseMap = await getCourseDocsByIds(targetCourseIds);
  const courseClassContextMap = completedClassStates.reduce((acc, classState) => {
    const classContext = {
      classId: classState.classId,
      className: classState.className,
      batchCode: classState.batchCode,
    };
    classState.courseCompletionRows
      .filter((courseRow) => courseRow.completed)
      .forEach((courseRow) => {
        const cleanCourseId = trimText(courseRow.courseId);
        if (!cleanCourseId || acc[cleanCourseId]) return;
        acc[cleanCourseId] = classContext;
      });
    return acc;
  }, {});
  let createdCertificates = 0;
  let blockedByFinalQuiz = 0;

  for (const courseId of targetCourseIds) {
    const finalQuizState = await resolveFinalQuizRequirementState({
      studentId: cleanStudentId,
      courseId,
    });
    if (finalQuizState.requiresFinalQuiz && !finalQuizState.finalQuizPassed) {
      blockedByFinalQuiz += 1;
      continue;
    }

    const certResult = await ensureCertificateForCompletion({
      studentId: cleanStudentId,
      studentData,
      userData,
      courseId,
      courseData: courseMap[courseId] || {},
      classContext: courseClassContextMap[courseId] || null,
    });
    if (certResult?.created) createdCertificates += 1;
  }

  return {
    targetedCourses: targetCourseIds.length,
    createdCertificates,
    blockedByFinalQuiz,
  };
};

export const getStudentDashboard = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const [
      profile,
      enrollments,
      announcementsSnap,
      sessionsSnap,
      installmentsSnap,
      paymentsSnap,
      classMembershipRows,
      progressRows,
    ] =
      await Promise.all([
        getStudentAndUser(uid),
        getEnrolledRows(uid),
        db.collection(COLLECTIONS.ANNOUNCEMENTS).orderBy("createdAt", "desc").get(),
        db.collection(COLLECTIONS.SESSIONS).get(),
        db.collection(COLLECTIONS.INSTALLMENTS).where("studentId", "==", uid).get(),
        db.collection(COLLECTIONS.PAYMENTS).where("studentId", "==", uid).get(),
        getStudentClassMembershipRows(uid),
        getProgressRowsForStudent(uid),
      ]);

    const studentData = profile.studentData;
    const userData = profile.userData;
    const enrollmentClassIds = enrollments
      .map((row) => trimText(row.classId))
      .filter(Boolean);
    const classMap = classMembershipRows.reduce((acc, row) => {
      acc[trimText(row.id)] = row;
      return acc;
    }, {});
    const missingClassIds = [...new Set(enrollmentClassIds)].filter(
      (classId) => !classMap[classId]
    );
    const missingClassRows = await Promise.all(
      missingClassIds.map(async (classId) => {
        const snap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
        return snap.exists ? { id: snap.id, ...(snap.data() || {}) } : null;
      })
    );
    const allClassRows = [
      ...classMembershipRows,
      ...missingClassRows.filter(Boolean),
    ].map((row) => ({
      ...(row || {}),
      id: trimText(row?.id),
    }));

    const enrolledCourseIds = [
      ...new Set(
        allClassRows
          .flatMap((row) => getStudentCourseIdsFromClassRow(row, uid))
          .concat(enrollments.map((row) => trimText(row.subjectId || row.courseId)))
          .filter(Boolean)
      ),
    ];
    const courseMap = await getCourseDocsByIds(enrolledCourseIds);
    const learningData = buildStudentClassAndCourseData({
      uid,
      classRows: allClassRows,
      enrollments,
      courseMap,
      progressRows,
    });
    const classRows = learningData.classes;
    const courseRows = [...learningData.courseRows].sort(
      (a, b) => toNumber(b.latestActivity, 0) - toNumber(a.latestActivity, 0)
    );
    const pendingPayments = paymentsSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) =>
        PENDING_PAYMENT_STATUSES.has(lowerText(row.status || "pending"))
      )
      .sort(
        (a, b) =>
          (parseDate(b.createdAt)?.getTime() || 0) -
          (parseDate(a.createdAt)?.getTime() || 0)
      );
    const latestPendingPayment = pendingPayments[0] || null;
    const attendancePayload = await buildStudentAttendancePayload(uid);

    const paidCourseRows = courseRows.filter((row) => !row.isPaymentLocked);
    const finalQuizStateByCourseId = {};
    await Promise.all(
      paidCourseRows.map(async (row) => {
        const cleanCourseId = trimText(row.courseId);
        if (!cleanCourseId) return;
        try {
          finalQuizStateByCourseId[cleanCourseId] =
            await resolveFinalQuizRequirementState({
              studentId: uid,
              courseId: cleanCourseId,
            });
        } catch {
          finalQuizStateByCourseId[cleanCourseId] = null;
        }
      })
    );
    const completedCount = paidCourseRows.filter(
      (row) => clampPercent(row.progress) >= 100
    ).length;
    const lastAccessed =
      [...paidCourseRows].sort((a, b) => b.latestActivity - a.latestActivity)[0] ||
      null;

    const courseIdSet = new Set(courseRows.map((row) => trimText(row.subjectId || row.courseId)).filter(Boolean));
    const classIdSet = new Set(classRows.map((row) => trimText(row.classId)).filter(Boolean));
    const classNameById = classRows.reduce((acc, row) => {
      acc[trimText(row.classId)] = trimText(row.name);
      return acc;
    }, {});
    const latestAnnouncements = announcementsSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => {
        const targetType = lowerText(row.targetType || "system");
        const targetId = trimText(row.targetId);
        const audienceRole = lowerText(row.audienceRole || "student");
        if (!(audienceRole === "student" || audienceRole === "all")) return false;
        if (targetType === "system") return true;
        if (targetType === "course") return courseIdSet.has(targetId);
        if (targetType === "class") return classIdSet.has(targetId);
        return false;
      })
      .sort((a, b) => parseAnnouncementDate(b.createdAt) - parseAnnouncementDate(a.createdAt))
      .slice(0, 3)
      .map((row) => ({
        id: row.id,
        title: trimText(row.title) || "Announcement",
        message: trimText(row.message),
        targetType: lowerText(row.targetType || "system"),
        targetId: trimText(row.targetId),
        isPinned: Boolean(row.isPinned),
        createdAt: toIso(row.createdAt),
        isRead: Array.isArray(row.readBy) ? row.readBy.includes(uid) : false,
      }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingSessions = sessionsSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => classIdSet.has(trimText(row.classId)))
      .filter((row) => {
        const parsedDate = parseDate(row.date);
        if (!parsedDate) return false;
        parsedDate.setHours(0, 0, 0, 0);
        return parsedDate >= today;
      })
      .sort((a, b) => parseAnnouncementDate(a.date) - parseAnnouncementDate(b.date))
      .slice(0, 3)
      .map((row) => ({
        id: row.id,
        classId: trimText(row.classId),
        className: classNameById[trimText(row.classId)] || "Class",
        topic: trimText(row.topic) || "Session",
        date: toIso(row.date),
        startTime: trimText(row.startTime),
        endTime: trimText(row.endTime),
        platform: trimText(row.platform),
        meetingLink: trimText(row.meetingLink),
        status: lowerText(row.status || "upcoming"),
      }));

    const nextInstallment = installmentsSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => lowerText(row.status) === "active")
      .flatMap((plan) => {
        const installments = Array.isArray(plan.installments) ? plan.installments : [];
        return installments
          .filter((item) => lowerText(item.status) !== "paid")
          .map((item) => ({
            planId: plan.id,
            courseId: trimText(plan.courseId),
            courseName: trimText(plan.courseName),
            installmentNumber: toNumber(item.number, 0),
            amount: toNumber(item.amount, 0),
            dueDate: trimText(item.dueDate),
            status: lowerText(item.status || "pending"),
          }));
      })
      .sort((a, b) => {
        const aTime = parseDate(a.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        const bTime = parseDate(b.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })[0] || null;

    return successResponse(
      res,
      {
        profile: {
          uid,
          fullName:
            trimText(studentData.fullName) ||
            trimText(studentData.name) ||
            trimText(userData.fullName) ||
            getNameFromEmail(userData.email || ""),
          email: trimText(userData.email),
          phoneNumber: trimText(studentData.phoneNumber || studentData.phone || userData.phoneNumber),
          fatherName: trimText(studentData.fatherName),
          fatherPhone: trimText(studentData.fatherPhone),
          fatherOccupation: trimText(studentData.fatherOccupation),
          address: trimText(studentData.address),
          district: trimText(studentData.district),
          domicile: trimText(studentData.domicile),
          caste: trimText(studentData.caste),
          createdAt: toIso(userData.createdAt || studentData.createdAt),
          lastLoginAt: toIso(userData.lastLoginAt),
        },
        stats: {
          enrolledCount: classRows.length,
          enrolledClassesCount: classRows.length,
          enrolledCoursesCount: paidCourseRows.length,
          totalCoursesInClassesCount: courseRows.length,
          lockedCoursesCount: Math.max(courseRows.length - paidCourseRows.length, 0),
          completedCount,
          certificatesCount: Array.isArray(studentData.certificates)
            ? studentData.certificates.length
            : 0,
        },
        classes: classRows,
        courses: courseRows.map((row) => ({
          id: row.id,
          classId: row.classId,
          className: row.className,
          batchCode: row.batchCode,
          subjectId: row.courseId,
          courseId: row.courseId,
          title: row.title,
          thumbnail: row.thumbnail,
          teacherName: row.teacherName,
          price: 0,
          discountPercent: 0,
          finalPrice: 0,
          enrollmentType: row.enrollmentType || null,
          isPaymentLocked: Boolean(row.isPaymentLocked),
          progress: row.progress,
          finalQuiz: (() => {
            const state = finalQuizStateByCourseId[trimText(row.courseId)];
            if (!state || !state.requiresFinalQuiz) {
              return {
                required: false,
                total: 0,
                passed: true,
                requestId: null,
                requestStatus: null,
                canRequest: false,
                canRequestNow: false,
              };
            }
            const progressPercent = clampPercent(row.progress);
            return {
              required: true,
              total: toNumber(state.finalQuizCount, 0),
              passed: Boolean(state.finalQuizPassed),
              requestId: state.requestId || null,
              requestStatus: state.requestStatus || null,
              requestSubmittedAt: state.requestSubmittedAt || null,
              requestReviewedAt: state.requestReviewedAt || null,
              canRequest: Boolean(state.canRequest),
              canRequestNow:
                Boolean(state.canRequest) &&
                progressPercent >= 100 &&
                !Boolean(state.finalQuizPassed),
            };
          })(),
        })),
        lastAccessedCourse: lastAccessed
          ? {
              id: lastAccessed.id,
              classId: lastAccessed.classId,
              className: lastAccessed.className,
              batchCode: lastAccessed.batchCode,
              subjectId: lastAccessed.courseId,
              courseId: lastAccessed.courseId,
              title: lastAccessed.title,
              thumbnail: lastAccessed.thumbnail,
              teacherName: lastAccessed.teacherName,
              isPaymentLocked: Boolean(lastAccessed.isPaymentLocked),
              progress: lastAccessed.progress,
              finalQuiz: (() => {
                const state =
                  finalQuizStateByCourseId[trimText(lastAccessed.courseId)];
                if (!state || !state.requiresFinalQuiz) {
                  return {
                    required: false,
                    total: 0,
                    passed: true,
                    requestId: null,
                    requestStatus: null,
                    canRequest: false,
                    canRequestNow: false,
                  };
                }
                const progressPercent = clampPercent(lastAccessed.progress);
                return {
                  required: true,
                  total: toNumber(state.finalQuizCount, 0),
                  passed: Boolean(state.finalQuizPassed),
                  requestId: state.requestId || null,
                  requestStatus: state.requestStatus || null,
                  requestSubmittedAt: state.requestSubmittedAt || null,
                  requestReviewedAt: state.requestReviewedAt || null,
                  canRequest: Boolean(state.canRequest),
                  canRequestNow:
                    Boolean(state.canRequest) &&
                    progressPercent >= 100 &&
                    !Boolean(state.finalQuizPassed),
                };
              })(),
            }
          : null,
        attendanceSummary: attendancePayload.summary || {
          totalSessions: 0,
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          attendancePercent: 0,
          currentStreak: 0,
          longestStreak: 0,
          learningDaysElapsed: 0,
          courseDurationDays: 0,
          learningDayProgress: null,
        },
        announcements: latestAnnouncements,
        upcomingSessions,
        nextInstallment,
        access: {
          hasPendingApproval: pendingPayments.length > 0,
          pendingApprovalCount: pendingPayments.length,
          canAccessCourses: paidCourseRows.length > 0,
          latestPendingPayment: latestPendingPayment
            ? {
                id: latestPendingPayment.id,
                reference: trimText(latestPendingPayment.reference),
                method: lowerText(latestPendingPayment.method),
                status: lowerText(latestPendingPayment.status || "pending"),
                classId: trimText(latestPendingPayment.classId),
                className: trimText(latestPendingPayment.className),
                courseId: trimText(latestPendingPayment.courseId),
                courseName: trimText(latestPendingPayment.courseName),
                amount: toNumber(latestPendingPayment.amount, 0),
                createdAt: toIso(latestPendingPayment.createdAt),
                receiptUploadedAt: toIso(latestPendingPayment.receiptUploadedAt),
              }
            : null,
        },
      },
      "Student dashboard fetched"
    );
  } catch (error) {
    console.error("getStudentDashboard error:", error);
    return errorResponse(res, "Failed to fetch student dashboard", 500);
  }
};

export const getStudentCourses = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const [enrollments, classMembershipRows, progressRows] = await Promise.all([
      getEnrolledRows(uid),
      getStudentClassMembershipRows(uid),
      getProgressRowsForStudent(uid),
    ]);
    const enrollmentClassIds = enrollments
      .map((row) => trimText(row.classId))
      .filter(Boolean);
    const classMap = classMembershipRows.reduce((acc, row) => {
      acc[trimText(row.id)] = row;
      return acc;
    }, {});
    const missingClassIds = [...new Set(enrollmentClassIds)].filter(
      (classId) => !classMap[classId]
    );
    const missingClassRows = await Promise.all(
      missingClassIds.map(async (classId) => {
        const snap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
        return snap.exists ? { id: snap.id, ...(snap.data() || {}) } : null;
      })
    );
    const classRows = [
      ...classMembershipRows,
      ...missingClassRows.filter(Boolean),
    ].map((row) => ({
      ...(row || {}),
      id: trimText(row?.id),
    }));

    const courseIds = [
      ...new Set(
        classRows
          .flatMap((row) => getStudentCourseIdsFromClassRow(row, uid))
          .concat(enrollments.map((row) => trimText(row.subjectId || row.courseId)))
          .filter(Boolean)
      ),
    ];
    const courseMap = await getCourseDocsByIds(courseIds);
    const data = buildStudentClassAndCourseData({
      uid,
      classRows,
      enrollments,
      courseMap,
      progressRows,
    }).courseRows.sort((a, b) => {
      const classCompare = trimText(a.className).localeCompare(trimText(b.className));
      if (classCompare !== 0) return classCompare;
      return trimText(a.title).localeCompare(trimText(b.title));
    });

    return successResponse(res, data, "Student courses fetched");
  } catch (error) {
    console.error("getStudentCourses error:", error);
    return errorResponse(res, "Failed to fetch student courses", 500);
  }
};

const buildStudentLiveSessions = async (uid) => {
  const [enrollments, classMembershipRows] = await Promise.all([
    getEnrolledRows(uid),
    getStudentClassMembershipRows(uid),
  ]);
  const enrollmentClassIds = enrollments.map((row) => trimText(row.classId)).filter(Boolean);
  const classMap = classMembershipRows.reduce((acc, row) => {
    acc[trimText(row.id)] = row;
    return acc;
  }, {});
  const missingClassIds = [...new Set(enrollmentClassIds)].filter((classId) => !classMap[classId]);
  const missingClassRows = await Promise.all(
    missingClassIds.map(async (classId) => {
      const snap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
      return snap.exists ? { id: snap.id, ...(snap.data() || {}) } : null;
    })
  );
  const classRows = [...classMembershipRows, ...missingClassRows.filter(Boolean)].map((row) => ({
    ...(row || {}),
    id: trimText(row?.id),
  }));

  const paidByClassSubject = new Set(
    enrollments
      .filter((row) => ACTIVE_ENROLLMENT_STATUSES.has(lowerText(row.status || "active")))
      .map((row) => `${trimText(row.classId)}::${trimText(row.subjectId || row.courseId)}`)
      .filter((key) => !key.endsWith("::"))
  );
  const subjectIds = new Set();
  classRows.forEach((classData) => {
    const classId = trimText(classData.id);
    if (!classId) return;
    const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
    shifts.forEach((shift) => {
      const subjectId = trimText(shift?.subjectId || shift?.courseId);
      if (!subjectId) return;
      if (paidByClassSubject.has(`${classId}::${subjectId}`)) {
        subjectIds.add(subjectId);
      }
    });
  });

  const [subjectSnaps, liveAccessSnap, lectureRowsBySubject, liveContentBySubject, progressSnap] = await Promise.all([
    Promise.all(
      [...subjectIds].map(async (subjectId) => {
        const [subjectSnap, courseSnap] = await Promise.all([
          db.collection(COLLECTIONS.SUBJECTS).doc(subjectId).get(),
          db.collection(COLLECTIONS.COURSES).doc(subjectId).get(),
        ]);
        const target = subjectSnap.exists ? subjectSnap : courseSnap;
        return {
          id: subjectId,
          data: target.exists ? target.data() || {} : {},
        };
      })
    ),
    db
      .collection(LIVE_ACCESS_COLLECTION)
      .where("studentId", "==", uid)
      .get()
      .catch(() => ({ docs: [] })),
    Promise.all(
      [...subjectIds].map(async (subjectId) => ({
        subjectId,
        lectures: await getCourseLectures(subjectId),
      }))
    ),
    Promise.all(
      [...subjectIds].map(async (subjectId) => {
        try {
          const [subjectSnap, courseSnap] = await Promise.all([
            db.collection(COLLECTIONS.SUBJECTS).doc(subjectId).get(),
            db.collection(COLLECTIONS.COURSES).doc(subjectId).get(),
          ]);
          const parentRef = subjectSnap.exists ? subjectSnap.ref : courseSnap.exists ? courseSnap.ref : null;
          if (!parentRef) return { subjectId, videos: [] };
          const snap = await parentRef.collection("content").get();
          const videos = snap.docs
            .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
            .filter((row) => lowerText(row.type) === "video" && row.isLiveSession === true)
            .filter((row) => Boolean(trimText(row.url)))
            .map((row) => ({
              id: trimText(row.id),
              title: trimText(row.title) || "Live Session",
              url: trimText(row.url),
              videoMode: trimText(row.videoMode || "live_session"),
              isLiveSession: true,
              durationSec: Math.max(
                0,
                toNumber(row.durationSec ?? row.videoDurationSec ?? row.totalDurationSec, 0)
              ),
              videoDuration: trimText(row.videoDuration),
              liveStartAt: trimText(row.liveStartAt),
              liveEndAt: trimText(row.liveEndAt),
              premiereEndedAt: row.premiereEndedAt || null,
              parentType: subjectSnap.exists ? "subject" : "course",
            }));
          return { subjectId, videos };
        } catch {
          return { subjectId, videos: [] };
        }
      })
    ),
    db
      .collection(COLLECTIONS.PROGRESS)
      .where("studentId", "==", uid)
      .get()
      .catch(() => ({ docs: [] })),
  ]);

  const subjectMap = subjectSnaps.reduce((acc, row) => {
    acc[row.id] = row.data || {};
    return acc;
  }, {});

  // "now" is needed for filtering upcoming/active live content sessions.
  const now = new Date();
  const contentLiveMap = (Array.isArray(liveContentBySubject) ? liveContentBySubject : []).reduce(
    (acc, row) => {
      const subjectId = trimText(row.subjectId);
      if (!subjectId) return acc;
      const videos = Array.isArray(row.videos) ? row.videos : [];
      const nowMs = now.getTime();
      const next = videos
        .filter((video) => {
          if (!video.liveStartAt) return false;
          if (video.premiereEndedAt) return false;
          const end = parseDate(video.liveEndAt);
          if (end && end.getTime() <= nowMs) return false;
          return true;
        })
        .sort((a, b) => (parseDate(a.liveStartAt)?.getTime() || 0) - (parseDate(b.liveStartAt)?.getTime() || 0))[0];
      acc[subjectId] = next || null;
      return acc;
    },
    {}
  );

  const lectureMap = lectureRowsBySubject.reduce((acc, row) => {
    const liveLectures = (Array.isArray(row.lectures) ? row.lectures : [])
      .filter((lecture) => {
        if (!lecture?.isLiveSession) return false;
        const url = trimText(
          lecture?.videoUrl ||
            lecture?.streamUrl ||
            lecture?.playbackUrl ||
            lecture?.signedUrl ||
            lecture?.videoSignedUrl
        );
        return Boolean(url);
      })
      .sort((a, b) => toNumber(a.order, 0) - toNumber(b.order, 0));

    // Support multiple live lectures in the same subject/shift:
    // Only schedule the "next" live lecture that has not ended yet (no premiereEndedAt).
    // This keeps later live lectures locked until the earlier one finishes.
    const nextLiveLecture =
      liveLectures.find((lecture) => !lecture?.premiereEndedAt) || liveLectures[0] || null;

    const subjectId = trimText(row.subjectId);
    const contentLive = contentLiveMap[subjectId] || null;

    if (nextLiveLecture) {
      // If lecture doesn't have explicit schedule, but admin subject-content has it, use that schedule for live session.
      if (!nextLiveLecture.liveStartAt && contentLive?.liveStartAt) {
        acc[subjectId] = {
          ...nextLiveLecture,
          liveStartAt: contentLive.liveStartAt,
          liveEndAt: contentLive.liveEndAt || null,
        };
      } else {
        acc[subjectId] = nextLiveLecture;
      }
      return acc;
    }

    if (contentLive) {
      acc[subjectId] = {
        id: `content_${contentLive.id}`,
        title: contentLive.title,
        videoUrl: contentLive.url,
        videoMode: contentLive.videoMode || "live_session",
        isLiveSession: true,
        durationSec: contentLive.durationSec,
        videoDuration: contentLive.videoDuration,
        liveStartAt: contentLive.liveStartAt,
        liveEndAt: contentLive.liveEndAt,
        premiereEndedAt: contentLive.premiereEndedAt || null,
        __source: "subject_content",
        __contentId: contentLive.id,
      };
      return acc;
    }

    acc[subjectId] = null;
    return acc;
  }, {});

  // Lazily finalize premiere (unlock recorded controls) after live window ends.
  // This keeps CoursePlayer consistent: live lecture is locked until premiere ends.
  const lectureFinalizePromises = [];
  const progressFinalizePromises = [];
  const progressByKey = (progressSnap?.docs || []).reduce((acc, doc) => {
    const row = doc.data() || {};
    const lectureId = trimText(row.lectureId);
    if (!lectureId) return acc;
    const courseId = trimText(row.subjectId || row.courseId);
    if (!courseId) return acc;
    acc[`${courseId}::${lectureId}`] = { ref: doc.ref, row };
    return acc;
  }, {});
  const liveAccessMap = (liveAccessSnap.docs || []).reduce((acc, doc) => {
    const row = doc.data() || {};
    const sessionId = trimText(row.sessionId);
    if (!sessionId) return acc;
    acc[sessionId] = row;
    return acc;
  }, {});

  const sessions = [];

  classRows.forEach((classData) => {
    const classId = trimText(classData.id);
    if (!classId) return;
    const classStatus = getClassStatus(classData);
    const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
    const coveredSubjects = new Set();
    shifts.forEach((shift) => {
      const shiftId = trimText(shift?.id);
      const subjectId = trimText(shift?.subjectId || shift?.courseId);
      if (!subjectId || !paidByClassSubject.has(`${classId}::${subjectId}`)) return;
      coveredSubjects.add(subjectId);

      const lecture = lectureMap[subjectId];
      if (!lecture) return;

      const durationSeconds = resolveLiveVideoDurationSeconds(lecture, shift);

      // If lecture has an explicit live schedule, prefer it over shift-based occurrence.
      // This allows admin/teacher to pick a specific date/time for the live video.
      const scheduledStart = parseDate(lecture.liveStartAt);
      const scheduledEnd = parseDate(lecture.liveEndAt);

      let startAt = null;
      let endAt = null;
      let dateKey = "";

      if (scheduledStart) {
        startAt = scheduledStart;
        endAt =
          scheduledEnd ||
          new Date(scheduledStart.getTime() + Math.max(60, durationSeconds) * 1000);
        dateKey = formatSessionDate(startAt);
      } else {
        const occurrence = findNextShiftOccurrence({
          shift,
          classData,
          durationSeconds,
          now,
        });
        if (!occurrence) return;
        startAt = occurrence.startAt;
        endAt = occurrence.endAt;
        dateKey = occurrence.dateKey;
      }

      const joinOpenAt = new Date(startAt.getTime() - 10 * 60 * 1000);
      // Allow joining up to 10 minutes after the start time.
      const joinCloseAt = new Date(startAt.getTime() + 10 * 60 * 1000);
      const sessionId = buildLiveSessionId({
        classId,
        shiftId,
        subjectId,
        lectureId: trimText(lecture.id),
        dateKey,
      });
      const accessRow = liveAccessMap[sessionId] || null;
      const joined = Boolean(accessRow) && accessRow.active !== false;

      const nowMs = now.getTime();
      const joinOpenMs = joinOpenAt.getTime();
      const joinCloseMs = joinCloseAt.getTime();
      const startMs = startAt.getTime();
      const endMs = endAt.getTime();

      let status = "scheduled";
      let lockReason = "";
      let canJoin = false;
      let canPlay = false;
      let waiting = false;

      if (classStatus === "expired") {
        status = "expired";
        lockReason = "Class has ended.";
      } else if (nowMs < joinOpenMs) {
        status = "scheduled";
        lockReason = "Join opens 10 minutes before the session start time.";
      } else if (nowMs >= joinOpenMs && nowMs < startMs) {
        status = joined ? "waiting" : "join_window_open";
        lockReason = "Waiting for session start time.";
        canJoin = !joined;
        waiting = true;
      } else if (nowMs >= startMs && nowMs < endMs) {
        if (joined) {
          status = "live";
          canPlay = true;
        } else {
          status = "live";
          // Join allowed only until joinCloseAt (10 min after start).
          if (nowMs < joinCloseMs) {
            canJoin = true;
            lockReason = "Session is live now. Join to continue.";
          } else {
            canJoin = false;
            lockReason = "Join window has closed. You can no longer join after 10 minutes from the session start time.";
          }
        }
      } else {
        status = "ended";
        lockReason = "This live session has ended.";
      }

      sessions.push({
        id: sessionId,
        classId,
        className: trimText(classData.name) || "Class",
        batchCode: trimText(classData.batchCode),
        classStatus,
        shiftId,
        shiftName: trimText(shift?.name) || "Shift",
        shiftDays: Array.isArray(shift?.days) ? shift.days : [],
        shiftStartTime: trimText(shift?.startTime),
        shiftEndTime: trimText(shift?.endTime),
        subjectId,
        courseId: subjectId,
        subjectName:
          trimText(shift?.subjectName || shift?.courseName) ||
          trimText(subjectMap[subjectId]?.title) ||
          "Subject",
        teacherId: trimText(shift?.teacherId || subjectMap[subjectId]?.teacherId),
        teacherName:
          trimText(shift?.teacherName || subjectMap[subjectId]?.teacherName) || "Teacher",
        lectureId: trimText(lecture.id),
        lectureTitle: trimText(lecture.title) || "Live Session",
        hlsUrl:
          trimText(
            lecture.hlsUrl ||
              (typeof lecture.streamUrl === "string" && /\.m3u8(\?|#|$)/i.test(lecture.streamUrl)
                ? lecture.streamUrl
                : "") ||
              (typeof lecture.videoUrl === "string" && /\.m3u8(\?|#|$)/i.test(lecture.videoUrl)
                ? lecture.videoUrl
                : "")
          ) || null,
        videoUrl:
          trimText(
            lecture.videoUrl ||
              lecture.streamUrl ||
              lecture.playbackUrl ||
              lecture.signedUrl ||
              lecture.videoSignedUrl
          ) || null,
        videoMode: trimText(lecture.videoMode || "live_session"),
        isLiveSession: true,
        sessionDate: dateKey,
        joinWindow: {
          opensAt: joinOpenAt.toISOString(),
          closesAt: joinCloseAt.toISOString(),
        },
        timing: {
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          durationSeconds,
          shiftDurationSeconds: resolveShiftDurationSeconds(shift),
          videoDurationSeconds: Math.max(
            parseDurationToSeconds(lecture.durationSec),
            parseDurationToSeconds(lecture.videoDuration)
          ),
        },
        status,
        waiting,
        canJoin,
        canPlay,
        isJoined: joined,
        joinedAt: toIso(accessRow?.joinedAt) || null,
        lockReason,
      });

      // When the live window ends and the student joined, mark the live lecture completed.
      // This unlocks the next lecture/quiz in sequential flow.
      if (status === "ended" && joined && accessRow && accessRow.lectureCompleted !== true) {
        const liveLectureId = trimText(lecture.id);
        const liveCourseId = subjectId;
        const durationSec = Math.max(
          parseDurationToSeconds(lecture.durationSec),
          parseDurationToSeconds(lecture.videoDuration),
          parseDurationToSeconds(lecture.videoDurationSec),
          0
        );
        const progressKey = `${liveCourseId}::${liveLectureId}`;
        const existingProgress = progressByKey[progressKey] || null;
        progressFinalizePromises.push(
          (async () => {
            try {
              const payload = {
                studentId: uid,
                subjectId: liveCourseId,
                courseId: liveCourseId,
                lectureId: liveLectureId,
                isCompleted: true,
                watchedPercent: 100,
                durationSec: durationSec,
                currentTimeSec: durationSec,
                completedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };
              if (!existingProgress) {
                payload.createdAt = serverTimestamp();
                await db.collection(COLLECTIONS.PROGRESS).add(payload);
              } else if (!existingProgress.row?.isCompleted) {
                await existingProgress.ref.set(payload, { merge: true });
              }

              await db
                .collection(LIVE_ACCESS_COLLECTION)
                .doc(`${uid}__${sessionId}`)
                .set(
                  {
                    lectureCompleted: true,
                    lectureCompletedAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  },
                  { merge: true }
                );
            } catch {
              // best-effort
            }
          })()
        );
      }

      if (
        status === "ended" &&
        Boolean(lecture?.isLiveSession) &&
        lowerText(lecture?.videoMode || "") === "live_session" &&
        !lecture?.premiereEndedAt
      ) {
        if (lecture.__source === "subject_content" && lecture.__contentId) {
          // Best-effort: mark content live session ended so next one can become active.
          lectureFinalizePromises.push(
            (async () => {
              try {
                const [subjectSnap, courseSnap] = await Promise.all([
                  db.collection(COLLECTIONS.SUBJECTS).doc(subjectId).get(),
                  db.collection(COLLECTIONS.COURSES).doc(subjectId).get(),
                ]);
                const parentRef = subjectSnap.exists ? subjectSnap.ref : courseSnap.exists ? courseSnap.ref : null;
                if (!parentRef) return;
                await parentRef
                  .collection("content")
                  .doc(trimText(lecture.__contentId))
                  .set({ premiereEndedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
              } catch {
                // ignore
              }
            })()
          );
        } else {
          lectureFinalizePromises.push(
            db
              .collection(COLLECTIONS.LECTURES)
              .doc(trimText(lecture.id))
              .set({ premiereEndedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true })
              .catch(() => null)
          );
        }
      }
    });

    // Fallback: if shifts are missing or not linked to a purchased subject, still surface
    // scheduled live lectures that have explicit `liveStartAt` so students can join from Live page.
    // This prevents "nothing showing" when class shift metadata is incomplete.
    enrollments
      .filter((row) => trimText(row.classId) === classId)
      .filter((row) => ACTIVE_ENROLLMENT_STATUSES.has(lowerText(row.status || "active")))
      .forEach((row) => {
        const subjectId = trimText(row.subjectId || row.courseId);
        if (!subjectId) return;
        if (coveredSubjects.has(subjectId)) return;
        if (!paidByClassSubject.has(`${classId}::${subjectId}`)) return;

        const lecture = lectureMap[subjectId];
        if (!lecture) return;

        const scheduledStart = parseDate(lecture.liveStartAt);
        if (!scheduledStart) return; // fallback mode only for explicit schedules

        const scheduledEnd = parseDate(lecture.liveEndAt);
        const durationSeconds = resolveLiveVideoDurationSeconds(lecture, {});
        const startAt = scheduledStart;
        const endAt =
          scheduledEnd ||
          new Date(scheduledStart.getTime() + Math.max(60, durationSeconds) * 1000);
        const dateKey = formatSessionDate(startAt);

        const joinOpenAt = new Date(startAt.getTime() - 10 * 60 * 1000);
        const joinCloseAt = new Date(startAt.getTime() + 10 * 60 * 1000);
        const sessionId = buildLiveSessionId({
          classId,
          shiftId: "no_shift",
          subjectId,
          lectureId: trimText(lecture.id),
          dateKey,
        });
        const accessRow = liveAccessMap[sessionId] || null;
        const joined = Boolean(accessRow) && accessRow.active !== false;

        const nowMs = now.getTime();
        const joinOpenMs = joinOpenAt.getTime();
        const joinCloseMs = joinCloseAt.getTime();
        const startMs = startAt.getTime();
        const endMs = endAt.getTime();

        let status = "scheduled";
        let lockReason = "";
        let canJoin = false;
        let canPlay = false;
        let waiting = false;

        if (classStatus === "expired") {
          status = "expired";
          lockReason = "Class has ended.";
        } else if (nowMs < joinOpenMs) {
          status = "scheduled";
          lockReason = "Join opens 10 minutes before the session start time.";
        } else if (nowMs >= joinOpenMs && nowMs < startMs) {
          status = joined ? "waiting" : "join_window_open";
          lockReason = "Waiting for session start time.";
          canJoin = !joined;
          waiting = true;
        } else if (nowMs >= startMs && nowMs < endMs) {
          if (joined) {
            status = "live";
            canPlay = true;
          } else if (nowMs < joinCloseMs) {
            status = "live";
            canJoin = true;
            lockReason = "Session is live now. Join to continue.";
          } else {
            status = "live";
            lockReason =
              "Join window has closed. You can no longer join after 10 minutes from the session start time.";
          }
        } else {
          status = "ended";
          lockReason = "This live session has ended.";
        }

        sessions.push({
          id: sessionId,
          classId,
          className: trimText(classData.name) || "Class",
          batchCode: trimText(classData.batchCode),
          classStatus,
          shiftId: "no_shift",
          shiftName: "Scheduled",
          shiftDays: [],
          shiftStartTime: "",
          shiftEndTime: "",
          subjectId,
          courseId: subjectId,
          subjectName: trimText(subjectMap[subjectId]?.title) || "Subject",
          teacherId: trimText(subjectMap[subjectId]?.teacherId),
          teacherName: trimText(subjectMap[subjectId]?.teacherName) || "Teacher",
          lectureId: trimText(lecture.id),
          lectureTitle: trimText(lecture.title) || "Live Session",
          // Prefer an explicit HLS playlist if available (best playback for large files).
          // Fallback is still `videoUrl` (MP4).
          hlsUrl:
            trimText(
              lecture.hlsUrl ||
                (typeof lecture.streamUrl === "string" && /\.m3u8(\?|#|$)/i.test(lecture.streamUrl)
                  ? lecture.streamUrl
                  : "") ||
                (typeof lecture.videoUrl === "string" && /\.m3u8(\?|#|$)/i.test(lecture.videoUrl)
                  ? lecture.videoUrl
                  : "")
            ) || null,
          videoUrl:
            trimText(
              lecture.videoUrl ||
                lecture.streamUrl ||
                lecture.playbackUrl ||
                lecture.signedUrl ||
                lecture.videoSignedUrl
            ) || null,
          videoMode: trimText(lecture.videoMode || "live_session"),
          isLiveSession: true,
          sessionDate: dateKey,
          joinWindow: {
            opensAt: joinOpenAt.toISOString(),
            closesAt: joinCloseAt.toISOString(),
          },
          timing: {
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            durationSeconds,
            shiftDurationSeconds: 0,
            videoDurationSeconds: Math.max(
              parseDurationToSeconds(lecture.durationSec),
              // Back-compat for older lecture docs that stored strings like "10:30"
              // (new writes should only use durationSec).
              parseDurationToSeconds(lecture.videoDuration)
            ),
          },
          status,
          waiting,
          canJoin,
          canPlay,
          isJoined: joined,
          joinedAt: toIso(accessRow?.joinedAt) || null,
          lockReason,
        });
      });
  });

  if (lectureFinalizePromises.length > 0) {
    // Fire-and-forget (best effort); do not block response.
    void Promise.allSettled(lectureFinalizePromises);
  }
  if (progressFinalizePromises.length > 0) {
    // Fire-and-forget (best effort); do not block response.
    void Promise.allSettled(progressFinalizePromises);
  }

  return sessions.sort(
    (a, b) =>
      (parseDate(a?.timing?.startAt)?.getTime() || 0) -
      (parseDate(b?.timing?.startAt)?.getTime() || 0)
  );
};

export const getStudentLiveSessions = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const sessions = await buildStudentLiveSessions(uid);
    const liveNowCount = sessions.filter((row) => row.status === "live").length;
    const joinableCount = sessions.filter((row) => row.canJoin).length;

    return successResponse(
      res,
      {
        sessions,
        summary: {
          total: sessions.length,
          liveNow: liveNowCount,
          joinable: joinableCount,
        },
      },
      "Student live sessions fetched"
    );
  } catch (error) {
    console.error("getStudentLiveSessions error:", error);
    return errorResponse(res, "Failed to fetch live sessions", 500);
  }
};

export const joinStudentLiveSession = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const sessionId = trimText(req.params?.sessionId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!sessionId) return errorResponse(res, "sessionId is required", 400);

    const sessions = await buildStudentLiveSessions(uid);
    const session = sessions.find((row) => trimText(row.id) === sessionId);
    if (!session) {
      return errorResponse(res, "Live session not found", 404);
    }

    const accessRef = db.collection(LIVE_ACCESS_COLLECTION).doc(`${uid}__${sessionId}`);
    const existingSnap = await accessRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() || {} : null;
    const now = new Date();
    const nowMs = now.getTime();
    const joinOpenMs = parseDate(session.joinWindow?.opensAt)?.getTime() || 0;
    const joinCloseMs = parseDate(session.joinWindow?.closesAt)?.getTime() || 0;
    const startMs = parseDate(session.timing?.startAt)?.getTime() || 0;
    const endMs = parseDate(session.timing?.endAt)?.getTime() || 0;
    const canResumeJoinedSession =
      Boolean(existingData) && existingData.active !== false && nowMs < endMs;

      if (!canResumeJoinedSession) {
        if (session.classStatus === "expired") {
          return errorResponse(res, "Class has ended.", 403, { code: "CLASS_EXPIRED" });
        }
        if (nowMs < joinOpenMs) {
          return errorResponse(
            res,
            "You can join only 10 minutes before the session start time.",
            403,
            { code: "JOIN_NOT_OPEN" }
          );
        }
      if (nowMs >= endMs) {
        return errorResponse(res, "This live session has ended.", 403, {
          code: "SESSION_ENDED",
        });
      }
      if (joinCloseMs && nowMs >= joinCloseMs) {
        return errorResponse(
          res,
          "Join window has closed. You can no longer join after 10 minutes from the session start time.",
          403,
          { code: "JOIN_CLOSED" }
        );
      }
    }

    await accessRef.set(
      {
        sessionId,
        studentId: uid,
        classId: session.classId,
        shiftId: session.shiftId,
        subjectId: session.subjectId,
        courseId: session.courseId,
        lectureId: session.lectureId,
        sessionDate: session.sessionDate,
        joinedAt: existingData?.joinedAt || serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        active: true,
        startAt: session.timing?.startAt || null,
        endAt: session.timing?.endAt || null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return successResponse(
      res,
      {
        sessionId,
        waiting: nowMs < startMs,
        canPlay: nowMs >= startMs && nowMs < endMs,
        startAt: session.timing?.startAt || null,
        endAt: session.timing?.endAt || null,
      },
      nowMs < startMs
        ? "Joined live waiting room. Playback starts at the scheduled time."
        : "Joined live session"
    );
  } catch (error) {
    console.error("joinStudentLiveSession error:", error);
    return errorResponse(res, "Failed to join live session", 500);
  }
};

export const getStudentSessionById = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const sessionId = trimText(req.params?.sessionId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!sessionId) return errorResponse(res, "sessionId is required", 400);

    const sessions = await buildStudentLiveSessions(uid);
    const session = sessions.find((row) => trimText(row.id) === sessionId) || null;
    if (!session) return errorResponse(res, "Live session not found", 404);

    return successResponse(
      res,
      {
        ...session,
      },
      "Session fetched"
    );
  } catch (error) {
    console.error("getStudentSessionById error:", error);
    return errorResponse(res, "Failed to fetch session", 500);
  }
};

export const getSessionStatus = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const sessionId = trimText(req.params?.sessionId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!sessionId) return errorResponse(res, "sessionId is required", 400);

    const sessions = await buildStudentLiveSessions(uid);
    const session = sessions.find((row) => trimText(row.id) === sessionId) || null;
    if (!session) return errorResponse(res, "Live session not found", 404);

    const now = new Date();
    const startAt = parseDate(session.timing?.startAt) || now;
    const endAt = parseDate(session.timing?.endAt) || now;
    const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startAt.getTime()) / 1000));
    const remainingSeconds = Math.max(0, Math.floor((endAt.getTime() - now.getTime()) / 1000));

    let joinedCount = 0;
    try {
      const joinedSnap = await db
        .collection(LIVE_ACCESS_COLLECTION)
        .where("sessionId", "==", sessionId)
        .where("active", "==", true)
        .get();
      joinedCount = joinedSnap.size;
    } catch {
      const joinedSnap = await db
        .collection(LIVE_ACCESS_COLLECTION)
        .where("sessionId", "==", sessionId)
        .get();
      joinedCount = joinedSnap.docs.filter((doc) => Boolean(doc.data()?.active)).length;
    }

    let totalStudents = 0;
    try {
      const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(trimText(session.classId)).get();
      if (classSnap.exists) {
        const classData = classSnap.data() || {};
        totalStudents = Math.max(
          0,
          Number(
            classData?.capacity ||
              classData?.studentLimit ||
              (Array.isArray(classData?.students) ? classData.students.length : 0) ||
              0
          )
        );
      }
    } catch {
      totalStudents = 0;
    }
    const normalizedStatus =
      session.status === "live"
        ? "live"
        : session.status === "ended" || session.status === "expired"
          ? "ended"
          : "upcoming";
    const canJoin = Boolean(session.canJoin);
    const isLocked = Boolean(session.status === "ended");

    return successResponse(
      res,
      {
        sessionId,
        status: normalizedStatus,
        topic: trimText(session.lectureTitle) || trimText(session.subjectName) || "Live Session",
        teacherName: trimText(session.teacherName) || "Teacher",
        // NOTE: `timing.startAt/endAt` is the source of truth for schedule.
        // The `date/startTime/endTime` fields are kept for legacy clients.
        date: formatSessionDate(session.timing?.startAt || session.sessionDate),
        startTime: trimText(session.shiftStartTime),
        endTime: trimText(session.shiftEndTime),
        platform: "video",
        meetingLink: "",
        classId: trimText(session.classId),
        className: trimText(session.className),
        batchCode: trimText(session.batchCode),
        lectureId: trimText(session.lectureId),
        joinedCount,
        totalStudents,
        elapsedSeconds,
        remainingSeconds,
        canJoin,
        isLocked,
        // Preferred playback URL (HLS if available)
        hlsUrl: trimText(session.hlsUrl || ""),
        recordingUrl: trimText(session.videoUrl || ""),
        joinWindow: session.joinWindow || null,
        timing: session.timing || null,
      },
      "Session status fetched"
    );
  } catch (error) {
    console.error("getSessionStatus error:", error);
    return errorResponse(res, "Failed to fetch session status", 500);
  }
};

export const joinStudentSession = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const sessionId = trimText(req.params?.sessionId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!sessionId) return errorResponse(res, "sessionId is required", 400);

    const sessions = await buildStudentLiveSessions(uid);
    const session = sessions.find((row) => trimText(row.id) === sessionId);
    if (!session) {
      return errorResponse(res, "Live session not found", 404);
    }

    const accessRef = db.collection(LIVE_ACCESS_COLLECTION).doc(`${uid}__${sessionId}`);
    const existingSnap = await accessRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() || {} : null;
    const now = new Date();
    const nowMs = now.getTime();
    const joinOpenMs = parseDate(session.joinWindow?.opensAt)?.getTime() || 0;
    const joinCloseMs = parseDate(session.joinWindow?.closesAt)?.getTime() || 0;
    const startMs = parseDate(session.timing?.startAt)?.getTime() || 0;
    const endMs = parseDate(session.timing?.endAt)?.getTime() || 0;
    const canResumeJoinedSession =
      Boolean(existingData) && existingData.active !== false && nowMs < endMs;

    if (!canResumeJoinedSession) {
      if (session.classStatus === "expired") {
        return errorResponse(res, "Class has ended.", 403, { code: "CLASS_EXPIRED" });
      }
      if (nowMs < joinOpenMs) {
        return errorResponse(
          res,
          "You can join only 10 minutes before class shift start time.",
          403,
          { code: "JOIN_NOT_OPEN" }
        );
      }
      if (nowMs >= endMs) {
        return errorResponse(res, "This live session has ended.", 403, {
          code: "SESSION_ENDED",
        });
      }
      // Join is closed once the session start time hits.
      if (joinCloseMs && nowMs >= joinCloseMs) {
        return errorResponse(
          res,
          "Join window has closed. You can no longer join after 10 minutes from the session start time.",
          403,
          { code: "JOIN_CLOSED" }
        );
      }
    }

    await accessRef.set(
      {
        sessionId,
        studentId: uid,
        classId: session.classId,
        shiftId: session.shiftId,
        subjectId: session.subjectId,
        courseId: session.courseId,
        lectureId: session.lectureId,
        sessionDate: session.sessionDate,
        joinedAt: existingData?.joinedAt || serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        active: true,
        startAt: session.timing?.startAt || null,
        endAt: session.timing?.endAt || null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return successResponse(
      res,
      {
        sessionId,
        waiting: nowMs < startMs,
        canPlay: nowMs >= startMs && nowMs < endMs,
        startAt: session.timing?.startAt || null,
        endAt: session.timing?.endAt || null,
      },
      nowMs < startMs
        ? "Joined live waiting room. Playback starts at shift time."
        : "Joined live session"
    );
  } catch (error) {
    console.error("joinStudentSession error:", error);
    return errorResponse(res, "Failed to join session", 500);
  }
};

export const leaveSession = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const sessionId = trimText(req.params?.sessionId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!sessionId) return errorResponse(res, "sessionId is required", 400);

    const accessRef = db.collection(LIVE_ACCESS_COLLECTION).doc(`${uid}__${sessionId}`);
    await accessRef.set(
      {
        active: false,
        leftAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return successResponse(res, { sessionId }, "Left session");
  } catch (error) {
    console.error("leaveSession error:", error);
    return errorResponse(res, "Failed to leave session", 500);
  }
};

export const getSessionSync = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const sessionId = trimText(req.params?.sessionId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!sessionId) return errorResponse(res, "sessionId is required", 400);

    const sessions = await buildStudentLiveSessions(uid);
    const session = sessions.find((row) => trimText(row.id) === sessionId) || null;
    if (!session) return errorResponse(res, "Live session not found", 404);

    const startAt = parseDate(session.timing?.startAt) || new Date();
    const endAt = parseDate(session.timing?.endAt) || new Date(startAt.getTime() + 60 * 60 * 1000);
    const now = new Date();

    const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startAt.getTime()) / 1000));
    const totalSeconds = Math.max(
      0,
      Math.floor((endAt.getTime() - startAt.getTime()) / 1000)
    );
    const remainingSeconds = Math.max(
      0,
      Math.floor((endAt.getTime() - now.getTime()) / 1000)
    );

    return successResponse(
      res,
      {
        sessionId,
        startedAt: startAt.toISOString(),
        elapsedSeconds,
        remainingSeconds,
        totalSeconds,
        isRunning: session.status === "live" && remainingSeconds > 0,
        status: session.status,
        // Preferred playback URL (HLS if available), then MP4.
        hlsUrl: trimText(session.hlsUrl || ""),
        videoUrl: trimText(session.videoUrl || ""),
        lectureId: trimText(session.lectureId),
        topic: trimText(session.lectureTitle) || "Live Session",
        // Keep legacy endTime field, but also expose full timing object for clients.
        endTime: trimText(session.shiftEndTime),
        timing: session.timing || { startAt: startAt.toISOString(), endAt: endAt.toISOString(), durationSeconds: totalSeconds },
      },
      "Session sync data"
    );
  } catch (error) {
    console.error("getSessionSync error:", error);
    return errorResponse(res, "Failed to sync session", 500);
  }
};

export const logSessionViolation = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const sessionId = trimText(req.params?.sessionId);
    const reason = lowerText(req.body?.reason || "default");
    const count = Math.max(1, toNumber(req.body?.count, 1));
    const timestamp = trimText(req.body?.timestamp) || new Date().toISOString();
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!sessionId) return errorResponse(res, "sessionId is required", 400);

    const context = resolveClientContext(req);
    await db.collection("sessionViolations").add({
      sessionId,
      studentId: uid,
      reason,
      count,
      timestamp,
      ip: context.clientIP || "",
      device: context.clientDevice || "",
      userAgent: context.userAgent || "",
      createdAt: serverTimestamp(),
    });

    const violationSnap = await db
      .collection("sessionViolations")
      .where("studentId", "==", uid)
      .get();
    // We historically counted "records", but the frontend also sends a running `count`.
    // Use the max of both so "Violation 3" always triggers deactivation even if a client
    // only manages to report the last event.
    const maxClientCount = (violationSnap.docs || []).reduce((acc, doc) => {
      const row = doc.data() || {};
      return Math.max(acc, Math.max(0, toNumber(row.count, 0)));
    }, 0);
    const totalViolations = Math.max(violationSnap.size, maxClientCount, count);
    let deactivated = false;

    if (totalViolations >= SECURITY_VIOLATION_LIMIT) {
      const userRef = db.collection(COLLECTIONS.USERS).doc(uid);
      const studentRef = db.collection(COLLECTIONS.STUDENTS).doc(uid);

      await Promise.all([
        userRef.set(
          {
            isActive: false,
            status: "deactivated",
            securityViolationCount: totalViolations,
            securityDeactivationReason: "Session security violation limit reached",
            lastSecurityViolationReason: reason,
            securityDeactivatedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
        studentRef.set(
          {
            approvalStatus: "deactivated",
            securityViolationCount: totalViolations,
            securityDeactivatedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
      ]);
      deactivated = true;

      // Disable Firebase Auth account as well (best effort).
      try {
        await admin.auth().updateUser(uid, { disabled: true });
      } catch {
        // ignore
      }

      try {
        const [userSnap, studentSnap] = await Promise.all([userRef.get(), studentRef.get()]);
        const userData = userSnap.exists ? userSnap.data() || {} : {};
        const studentData = studentSnap.exists ? studentSnap.data() || {} : {};
        const email = trimText(userData.email);
        if (email) {
          await sendSecurityDeactivationEmail(
            email,
            trimText(studentData.fullName || userData.fullName || userData.name || "Student"),
            {
              reason,
              page: "live_session",
              count: totalViolations,
              limit: SECURITY_VIOLATION_LIMIT,
            }
          );
        }
      } catch (mailError) {
        console.error("logSessionViolation email error:", mailError);
      }
    }

    return successResponse(
      res,
      {
        sessionId,
        reason,
        count,
        totalViolations,
        deactivated,
      },
      deactivated ? "Account deactivated due to repeated security violations" : "Violation logged"
    );
  } catch (error) {
    console.error("logSessionViolation error:", error);
    return errorResponse(res, "Failed to log violation", 500);
  }
};

export const getStudentCourseProgress = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const courseId = trimText(req.params?.courseId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!courseId) return errorResponse(res, "courseId is required", 400);

    const enrolledIds = await getStudentEnrolledCourseIds(uid, true);
    if (!enrolledIds.includes(courseId)) {
      const pendingPayments = await getStudentPendingPayments(uid, courseId);
      if (pendingPayments.length > 0) {
        const latestPending = pendingPayments[0];
        return errorResponse(
          res,
          "Payment receipt submitted. Waiting for admin approval before course access.",
          403,
          {
            code: "PENDING_APPROVAL",
            paymentId: latestPending.id,
            status: lowerText(latestPending.status || "pending"),
            reference: trimText(latestPending.reference),
          }
        );
      }
      return errorResponse(res, "You are not enrolled in this course", 403);
    }

    const courseSnap = await db.collection(COLLECTIONS.COURSES).doc(courseId).get();
    if (!courseSnap.exists) return errorResponse(res, "Course not found", 404);
    const courseData = courseSnap.data() || {};

    const [
      chaptersSnap,
      lectures,
      progressRows,
      allProgressRows,
      videoAccessSnap,
      enrollmentRows,
      classMembershipRows,
    ] = await Promise.all([
      db.collection(COLLECTIONS.CHAPTERS).where("courseId", "==", courseId).get(),
      getCourseLectures(courseId),
      getProgressRowsForStudent(uid, courseId),
      getProgressRowsForStudent(uid),
      db.collection("videoAccess").where("studentId", "==", uid).get(),
      getEnrolledRows(uid),
      getStudentClassMembershipRows(uid),
    ]);

    const enrollmentClassIds = enrollmentRows
      .map((row) => trimText(row.classId))
      .filter(Boolean);
    const classMap = classMembershipRows.reduce((acc, row) => {
      acc[trimText(row.id)] = row;
      return acc;
    }, {});
    const missingClassIds = [...new Set(enrollmentClassIds)].filter(
      (classId) => !classMap[classId]
    );
    const missingClassRows = await Promise.all(
      missingClassIds.map(async (classId) => {
        const snap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
        return snap.exists ? { id: snap.id, ...(snap.data() || {}) } : null;
      })
    );
    const classRows = [...classMembershipRows, ...missingClassRows.filter(Boolean)].map(
      (row) => ({
        ...(row || {}),
        id: trimText(row?.id),
      })
    );
    const courseAccessState = resolveCourseAccessStateFromClasses({
      uid,
      courseId,
      classRows,
      enrollments: enrollmentRows,
      progressRows: allProgressRows,
    });
    const finalQuizState = await resolveFinalQuizRequirementState({
      studentId: uid,
      courseId,
    });

    const lectureByChapter = {};
    lectures.forEach((lecture) => {
      const chapterId = trimText(lecture.chapterId);
      if (!lectureByChapter[chapterId]) lectureByChapter[chapterId] = [];
      lectureByChapter[chapterId].push(lecture);
    });

    const lectureProgressMap = buildLectureProgressMap(progressRows, courseId);
    const accessMap = videoAccessSnap.docs.reduce((acc, doc) => {
      const data = doc.data() || {};
      const lectureId = trimText(data.lectureId);
      if (!lectureId) return acc;
      const granted = data.hasAccess !== false;
      if (acc[lectureId] === undefined) {
        acc[lectureId] = granted;
      } else {
        // If there are multiple access rows for same lecture, a granted row wins.
        acc[lectureId] = Boolean(acc[lectureId]) || granted;
      }
      return acc;
    }, {});

    const chapters = chaptersSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .sort((a, b) => toNumber(a.order, 0) - toNumber(b.order, 0))
      .map((chapter) => {
        const chapterLectures = (lectureByChapter[chapter.id] || [])
          .sort((a, b) => toNumber(a.order, 0) - toNumber(b.order, 0))
          .map((lecture) => {
            const progress = lectureProgressMap[lecture.id] || {};
            const hasAccess =
              accessMap[lecture.id] !== undefined
                ? accessMap[lecture.id]
                : !courseAccessState.isLocked;
            return {
              lectureId: lecture.id,
              title: trimText(lecture.title) || "Lecture",
              isCompleted: Boolean(progress.isCompleted),
              completedAt: progress.completedAt || null,
              hasAccess,
              videoUrl: trimText(lecture.videoUrl),
              videoId: trimText(lecture.videoId),
              videoMode: trimText(lecture.videoMode) || "recorded",
              isLiveSession: Boolean(lecture.isLiveSession),
              videoTitle: trimText(lecture.videoTitle),
              videoDuration:
                lecture.videoDuration === null || lecture.videoDuration === undefined
                  ? null
                  : lecture.videoDuration,
              pdfNotes: Array.isArray(lecture.pdfNotes) ? lecture.pdfNotes : [],
              books: Array.isArray(lecture.books) ? lecture.books : [],
              notes: trimText(lecture.notes || lecture.description),
              signedUrl: trimText(
                lecture.signedUrl ||
                  lecture.signedVideoUrl ||
                  lecture.videoSignedUrl ||
                  lecture.streamUrl ||
                  lecture.playbackUrl
              ),
            };
          });

        const totalLectures = chapterLectures.length;
        const completedLectures = chapterLectures.filter((row) => row.isCompleted).length;

        return {
          chapterId: chapter.id,
          title: trimText(chapter.title) || "Chapter",
          order: toNumber(chapter.order, 0),
          totalLectures,
          completedLectures,
          lectures: chapterLectures,
        };
      });

    const allLectures = chapters.flatMap((row) => row.lectures);
    const totalLectures = allLectures.length;
    const completedLectures = allLectures.filter((row) => row.isCompleted).length;
    const overallPercent =
      totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0;

    return successResponse(
      res,
      {
        course: {
          id: courseId,
          title: trimText(courseData.title) || "Course",
          description: trimText(courseData.description || courseData.shortDescription),
          teacherName: trimText(courseData.teacherName) || "Teacher",
        },
        progress: {
          completedLectures,
          totalLectures,
          completionPercent: clampPercent(overallPercent),
        },
        access: {
          hasClassContext: courseAccessState.hasClassContext,
          isLockedAfterCompletion: courseAccessState.isLocked,
          isCompletedWindow: courseAccessState.isCompletedWindow,
          certificateEligible:
            courseAccessState.eligibleForCertificate &&
            (!finalQuizState.requiresFinalQuiz || finalQuizState.finalQuizPassed),
          finalQuiz: {
            required: finalQuizState.requiresFinalQuiz,
            total: finalQuizState.finalQuizCount,
            passed: finalQuizState.finalQuizPassed,
            requestId: finalQuizState.requestId || null,
            requestStatus: finalQuizState.requestStatus || null,
            requestSubmittedAt: finalQuizState.requestSubmittedAt,
            requestReviewedAt: finalQuizState.requestReviewedAt,
            canRequest: finalQuizState.canRequest,
            latestResult: finalQuizState.latestFinalQuizResult,
          },
          classStates: courseAccessState.classStates.map((row) => ({
            classId: row.classId,
            status: row.status,
            completed: row.completed,
            isLocked: row.isLocked,
            unlockedForStudent: row.studentUnlocked,
          })),
        },
        chapters,
      },
      "Course progress fetched"
    );
  } catch (error) {
    console.error("getStudentCourseProgress error:", error);
    return errorResponse(res, "Failed to fetch course progress", 500);
  }
};

export const getFinalQuizRequestStatus = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const courseId = trimText(req.params?.courseId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!courseId) return errorResponse(res, "courseId is required", 400);

    const enrolledIds = await getStudentEnrolledCourseIds(uid, false);
    if (!enrolledIds.includes(courseId)) {
      return errorResponse(res, "You are not enrolled in this course", 403);
    }

    const finalQuizState = await resolveFinalQuizRequirementState({
      studentId: uid,
      courseId,
    });

    if (!finalQuizState.requiresFinalQuiz) {
      return successResponse(
        res,
        {
          required: false,
          message: "No final quiz is configured for this course",
        },
        "Final quiz status fetched"
      );
    }

    return successResponse(
      res,
      {
        required: true,
        total: finalQuizState.finalQuizCount,
        passed: finalQuizState.finalQuizPassed,
        requestId: finalQuizState.requestId || null,
        requestStatus: finalQuizState.requestStatus || null,
        requestSubmittedAt: finalQuizState.requestSubmittedAt,
        requestReviewedAt: finalQuizState.requestReviewedAt,
        canRequest: finalQuizState.canRequest,
        latestResult: finalQuizState.latestFinalQuizResult,
      },
      "Final quiz status fetched"
    );
  } catch (error) {
    console.error("getFinalQuizRequestStatus error:", error);
    return errorResponse(res, "Failed to fetch final quiz status", 500);
  }
};

export const requestFinalQuizForCourse = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const courseId = trimText(req.params?.courseId);
    const notes = trimText(req.body?.notes || "");
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!courseId) return errorResponse(res, "courseId is required", 400);

    const enrolledIds = await getStudentEnrolledCourseIds(uid, false);
    if (!enrolledIds.includes(courseId)) {
      return errorResponse(res, "You are not enrolled in this course", 403);
    }

    const finalQuizState = await resolveFinalQuizRequirementState({
      studentId: uid,
      courseId,
    });
    if (!finalQuizState.requiresFinalQuiz) {
      return errorResponse(
        res,
        "No final quiz is configured for this course",
        400,
        { code: "FINAL_QUIZ_NOT_CONFIGURED" }
      );
    }
    if (finalQuizState.finalQuizPassed) {
      return errorResponse(
        res,
        "Final quiz is already passed for this course",
        409,
        { code: "FINAL_QUIZ_ALREADY_PASSED" }
      );
    }
    if (["pending", "approved"].includes(finalQuizState.requestStatus)) {
      return errorResponse(
        res,
        "A final quiz request is already in progress",
        409,
        {
          code: "FINAL_QUIZ_REQUEST_EXISTS",
          requestId: finalQuizState.requestId || null,
          requestStatus: finalQuizState.requestStatus || null,
        }
      );
    }

    const [courseLectures, progressRows, enrollmentSnap] = await Promise.all([
      getCourseLectures(courseId),
      getProgressRowsForStudent(uid, courseId),
      db
        .collection(COLLECTIONS.ENROLLMENTS)
        .where("studentId", "==", uid)
        .where("courseId", "==", courseId)
        .get(),
    ]);
    const totalLectures = courseLectures.length;
    const progressMap = buildLectureProgressMap(progressRows, courseId);
    const completedLectures = courseLectures.filter(
      (lecture) => progressMap[lecture.id]?.isCompleted
    ).length;
    const lectureCompletionPercent =
      totalLectures > 0
        ? Math.round((completedLectures / totalLectures) * 100)
        : 0;
    const enrollmentRows = enrollmentSnap.docs.map((doc) => doc.data() || {});
    const enrollmentProgress = enrollmentRows.length
      ? Math.max(
          ...enrollmentRows.map((row) =>
            toNumber(
              row.progress ?? row.progressPercent ?? row.completionPercent,
              0
            )
          )
        )
      : 0;
    const enrollmentMarkedCompleted = enrollmentRows.some((row) => {
      const status = lowerText(row.status || "");
      return status === "completed" || Boolean(row.completedAt);
    });
    const isCourseCompleted =
      totalLectures > 0
        ? completedLectures >= totalLectures
        : enrollmentMarkedCompleted || enrollmentProgress >= 100;
    const completionPercent =
      totalLectures > 0 ? lectureCompletionPercent : clampPercent(enrollmentProgress);
    if (!isCourseCompleted) {
      return errorResponse(
        res,
        "Complete all course lectures before requesting the final quiz",
        400,
        {
          code: "COURSE_NOT_COMPLETED",
          completedLectures,
          totalLectures,
          completionPercent: clampPercent(completionPercent),
          enrollmentProgress: clampPercent(enrollmentProgress),
          enrollmentMarkedCompleted,
        }
      );
    }

    const [profile, courseSnap] = await Promise.all([
      getStudentAndUser(uid),
      db.collection(COLLECTIONS.COURSES).doc(courseId).get(),
    ]);

    const studentName =
      trimText(profile.studentData.fullName) ||
      trimText(profile.studentData.name) ||
      trimText(profile.userData.fullName) ||
      trimText(profile.userData.name) ||
      getNameFromEmail(profile.userData.email || "");
    const studentEmail = trimText(
      profile.userData.email || profile.studentData.email
    );
    const courseName = trimText(courseSnap.data()?.title) || "Course";

    const existingRequest = await getLatestFinalQuizRequest(uid, courseId);
    const requestRef = existingRequest?.id
      ? db.collection(COLLECTIONS.FINAL_QUIZ_REQUESTS).doc(existingRequest.id)
      : db.collection(COLLECTIONS.FINAL_QUIZ_REQUESTS).doc();

    const payload = {
      studentId: uid,
      studentName,
      studentEmail,
      courseId,
      courseName,
      status: "pending",
      notes,
      requestSource: "student",
      requestedAt: serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null,
      reviewedByRole: "",
      updatedAt: serverTimestamp(),
      createdAt: existingRequest?.id ? existingRequest.createdAt || serverTimestamp() : serverTimestamp(),
    };

    await requestRef.set(payload, { merge: true });
    const createdSnap = await requestRef.get();
    const createdData = createdSnap.data() || {};

    return successResponse(
      res,
      {
        requestId: requestRef.id,
        courseId,
        courseName,
        status: lowerText(createdData.status || "pending"),
        requestedAt: toIso(createdData.requestedAt || createdData.createdAt),
        notes: trimText(createdData.notes),
      },
      "Final quiz request submitted. Please wait for admin/teacher approval.",
      201
    );
  } catch (error) {
    console.error("requestFinalQuizForCourse error:", error);
    return errorResponse(res, "Failed to request final quiz", 500);
  }
};

export const markLectureComplete = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const courseId = trimText(req.params?.courseId || req.body?.courseId);
    const lectureId = trimText(req.params?.lectureId || req.body?.lectureId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!courseId || !lectureId) {
      return errorResponse(res, "courseId and lectureId are required", 400);
    }

    const enrolledIds = await getStudentEnrolledCourseIds(uid, false);
    if (!enrolledIds.includes(courseId)) {
      const pendingPayments = await getStudentPendingPayments(uid, courseId);
      if (pendingPayments.length > 0) {
        return errorResponse(
          res,
          "Payment is pending admin approval. Lecture progress is locked for now.",
          403,
          { code: "PENDING_APPROVAL" }
        );
      }
      return errorResponse(res, "You are not enrolled in this course", 403);
    }

    const [courseSnap, lectureSnap] = await Promise.all([
      db.collection(COLLECTIONS.COURSES).doc(courseId).get(),
      db.collection(COLLECTIONS.LECTURES).doc(lectureId).get(),
    ]);
    if (!courseSnap.exists) return errorResponse(res, "Course not found", 404);
    if (!lectureSnap.exists) return errorResponse(res, "Lecture not found", 404);

    const progressSnap = await db
      .collection(COLLECTIONS.PROGRESS)
      .where("studentId", "==", uid)
      .where("courseId", "==", courseId)
      .where("lectureId", "==", lectureId)
      .limit(1)
      .get();

    if (progressSnap.empty) {
      await db.collection(COLLECTIONS.PROGRESS).add({
        studentId: uid,
        courseId,
        lectureId,
        isCompleted: true,
        progress: 100,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    } else {
      await progressSnap.docs[0].ref.set(
        {
          studentId: uid,
          courseId,
          lectureId,
          isCompleted: true,
          progress: 100,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    const [
      courseLectures,
      courseProgressRows,
      enrollmentSnap,
      profile,
      allProgressRows,
      allEnrollments,
      classMembershipRows,
    ] = await Promise.all([
      getCourseLectures(courseId),
      getProgressRowsForStudent(uid, courseId),
      db
        .collection(COLLECTIONS.ENROLLMENTS)
        .where("studentId", "==", uid)
        .where("courseId", "==", courseId)
        .get(),
      getStudentAndUser(uid),
      getProgressRowsForStudent(uid),
      getEnrolledRows(uid),
      getStudentClassMembershipRows(uid),
    ]);

    const totalLectures = courseLectures.length;
    const progressMap = buildLectureProgressMap(courseProgressRows, courseId);
    const completedCount = courseLectures.filter(
      (lecture) => progressMap[lecture.id]?.isCompleted
    ).length;
    const completionPercent =
      totalLectures > 0 ? Math.round((completedCount / totalLectures) * 100) : 0;
    const isCompleted = totalLectures > 0 && completedCount >= totalLectures;

    if (!enrollmentSnap.empty) {
      const batch = db.batch();
      enrollmentSnap.docs.forEach((doc) =>
        batch.update(doc.ref, {
          progress: clampPercent(completionPercent),
          status: isCompleted ? "completed" : "active",
          completedAt: isCompleted ? serverTimestamp() : null,
          updatedAt: serverTimestamp(),
        })
      );
      await batch.commit();
    }

    const enrollmentClassIds = allEnrollments
      .map((row) => trimText(row.classId))
      .filter(Boolean);
    const classMap = classMembershipRows.reduce((acc, row) => {
      acc[trimText(row.id)] = row;
      return acc;
    }, {});
    const missingClassIds = [...new Set(enrollmentClassIds)].filter(
      (classId) => !classMap[classId]
    );
    const missingClassRows = await Promise.all(
      missingClassIds.map(async (classId) => {
        const snap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
        return snap.exists ? { id: snap.id, ...(snap.data() || {}) } : null;
      })
    );
    const classRows = [...classMembershipRows, ...missingClassRows.filter(Boolean)].map(
      (row) => ({
        ...(row || {}),
        id: trimText(row?.id),
      })
    );
    const certificateAccess = resolveCourseAccessStateFromClasses({
      uid,
      courseId,
      classRows,
      enrollments: allEnrollments,
      progressRows: allProgressRows,
    });
    const finalQuizState = await resolveFinalQuizRequirementState({
      studentId: uid,
      courseId,
    });
    const certificateEligibleNow =
      certificateAccess.eligibleForCertificate &&
      (!finalQuizState.requiresFinalQuiz || finalQuizState.finalQuizPassed);

    let certificate = null;
    let certificatePending = false;
    if (isCompleted) {
      if (certificateEligibleNow) {
        certificate = await ensureCertificateForCompletion({
          studentId: uid,
          studentData: profile.studentData,
          userData: profile.userData,
          courseId,
          courseData: courseSnap.data() || {},
          classContext: certificateAccess.preferredClassContext || null,
        });
      } else {
        certificatePending = true;
      }
    }

    const classCertificateBatch = await ensureCertificatesForFullyCompletedClasses({
      studentId: uid,
      studentData: profile.studentData,
      userData: profile.userData,
      classRows,
      enrollments: allEnrollments,
      progressRows: allProgressRows,
    });

    return successResponse(
      res,
      {
        courseId,
        lectureId,
        completedLectures: completedCount,
        totalLectures,
        completionPercent: clampPercent(completionPercent),
        courseCompleted: isCompleted,
        certificateIssued:
          Boolean(certificate?.created) ||
          Number(classCertificateBatch.createdCertificates || 0) > 0,
        certificatePending,
        certificateEligible: certificateEligibleNow,
        certificateBlockedByFinalQuiz:
          finalQuizState.requiresFinalQuiz && !finalQuizState.finalQuizPassed,
        finalQuiz: {
          required: finalQuizState.requiresFinalQuiz,
          total: finalQuizState.finalQuizCount,
          passed: finalQuizState.finalQuizPassed,
          requestId: finalQuizState.requestId || null,
          requestStatus: finalQuizState.requestStatus || null,
          requestSubmittedAt: finalQuizState.requestSubmittedAt,
          requestReviewedAt: finalQuizState.requestReviewedAt,
          canRequest: finalQuizState.canRequest,
          latestResult: finalQuizState.latestFinalQuizResult,
        },
        classCertificatesIssued: Number(classCertificateBatch.createdCertificates || 0),
        classCertificateTargets: Number(classCertificateBatch.targetedCourses || 0),
        classCertificateBlockedByFinalQuiz: Number(
          classCertificateBatch.blockedByFinalQuiz || 0
        ),
        classLockState: {
          hasClassContext: certificateAccess.hasClassContext,
          isLockedAfterCompletion: certificateAccess.isLocked,
          classCount: certificateAccess.classStates.length,
        },
      },
      "Lecture marked as complete"
    );
  } catch (error) {
    console.error("markLectureComplete error:", error);
    return errorResponse(res, "Failed to update lecture progress", 500);
  }
};

export const exploreCourses = async (req, res) => {
  try {
    const category = trimText(req.query?.category).toLowerCase();
    const level = trimText(req.query?.level).toLowerCase();
    const search = trimText(req.query?.search).toLowerCase();

    let uid = "";
    const tokenHeader = trimText(req.headers?.authorization);
    if (tokenHeader.toLowerCase().startsWith("bearer ")) {
      const token = tokenHeader.split(" ").slice(1).join(" ").trim();
      if (token) {
        try {
          const decoded = await admin.auth().verifyIdToken(token);
          uid = trimText(decoded.uid);
        } catch {
          uid = "";
        }
      }
    }

    const [subjectsSnap, coursesSnap, teachersSnap, teacherUsersSnap, enrolledCourseIds] =
      await Promise.all([
        db.collection(COLLECTIONS.SUBJECTS).get(),
        db.collection(COLLECTIONS.COURSES).get(),
        db.collection(COLLECTIONS.TEACHERS).get(),
        db.collection(COLLECTIONS.USERS).where("role", "==", "teacher").get(),
        uid ? getStudentEnrolledCourseIds(uid) : Promise.resolve([]),
      ]);
    const enrolledSet = new Set(enrolledCourseIds);

    const teacherNameMap = {};
    teachersSnap.docs.forEach((doc) => {
      const data = doc.data() || {};
      const name =
        trimText(data.fullName) ||
        trimText(data.name) ||
        trimText(data.displayName) ||
        "";
      if (name) teacherNameMap[doc.id] = name;
    });
    teacherUsersSnap.docs.forEach((doc) => {
      const data = doc.data() || {};
      if (teacherNameMap[doc.id]) return;
      const name =
        trimText(data.fullName) ||
        trimText(data.name) ||
        trimText(data.displayName) ||
        getNameFromEmail(data.email);
      if (name) teacherNameMap[doc.id] = name;
    });

    const merged = {};
    const addRow = (id, data = {}, sourceType = "subject") => {
      const status = lowerText(data.status || data.publishStatus || "");
      if (["draft", "unpublished", "archived", "deleted", "inactive"].includes(status)) {
        return;
      }
      if (merged[id]?.sourceType === "subject" && sourceType === "course") return;
      merged[id] = { id, ...(data || {}), sourceType };
    };

    subjectsSnap.docs.forEach((doc) => addRow(doc.id, doc.data() || {}, "subject"));
    coursesSnap.docs.forEach((doc) => addRow(doc.id, doc.data() || {}, "course"));

    let courses = Object.values(merged);
    if (category) {
      courses = courses.filter((row) =>
        lowerText(row.category || row.stream || row.track) === category
      );
    }
    if (level) {
      courses = courses.filter((row) =>
        lowerText(row.level || row.difficulty || row.classLevel) === level
      );
    }
    if (search) {
      courses = courses.filter((row) => {
        const teacherId = trimText(row.teacherId || row.teacher?.id);
        return (
          lowerText(row.title || row.name || row.courseName || row.subjectName).includes(search) ||
          lowerText(row.description || row.shortDescription).includes(search) ||
          lowerText(row.category || row.stream || row.track).includes(search) ||
          lowerText(
            row.teacherName ||
              row.teacher?.name ||
              teacherNameMap[teacherId] ||
              row.instructorName
          ).includes(search)
        );
      });
    }

    const payload = courses
      .map((course) => {
        const teacherId = trimText(course.teacherId || course.teacher?.id);
        const originalPrice = 0;
        const discountPercent = 0;
        const discountAmount = 0;
        const discountedPrice = 0;
        const title =
          trimText(course.title || course.courseName || course.name || course.subjectName) ||
          "Untitled Subject";

        return {
          id: course.id,
          courseId: course.id,
          subjectId: course.id,
          sourceType: course.sourceType || "subject",
          title,
          description: trimText(course.description || course.shortDescription),
          thumbnail: course.thumbnail || null,
          category: trimText(course.category || course.stream || "Subject"),
          level: trimText(course.level || course.difficulty || "General"),
          originalPrice,
          price: originalPrice,
          discountPercent,
          discountAmount,
          discountedPrice,
          teacherId,
          teacherName:
            trimText(course.teacherName || course.teacher?.name || course.instructorName) ||
            teacherNameMap[teacherId] ||
            "Teacher",
          enrollmentCount: toNumber(course.enrollmentCount, 0),
          rating: toNumber(course.rating, 0),
          subjects: Array.isArray(course.subjects)
            ? course.subjects
            : course.sourceType === "subject"
              ? [title]
              : [],
          hasCertificate: course.hasCertificate !== false,
          isEnrolled: enrolledSet.has(course.id),
          createdAt: toIso(course.createdAt),
        };
      })
      .sort((a, b) => {
        const aTime = parseDate(a.createdAt)?.getTime() || 0;
        const bTime = parseDate(b.createdAt)?.getTime() || 0;
        if (aTime !== bTime) return bTime - aTime;
        return String(a.title || "").localeCompare(String(b.title || ""));
      });

    return successResponse(res, payload, "Explore courses fetched");
  } catch (error) {
    console.error("exploreCourses error:", error);
    return errorResponse(res, "Failed to fetch courses", 500);
  }
};

export const getPublicTeachers = async (_req, res) => {
  try {
    const [teacherUsersSnap, teacherProfilesSnap, subjectsSnap, coursesSnap, classesSnap] =
      await Promise.all([
        db.collection(COLLECTIONS.USERS).where("role", "==", "teacher").get(),
        db.collection(COLLECTIONS.TEACHERS).get(),
        db.collection(COLLECTIONS.SUBJECTS).get(),
        db.collection(COLLECTIONS.COURSES).get(),
        db.collection(COLLECTIONS.CLASSES).get(),
      ]);

    const teacherProfiles = {};
    teacherProfilesSnap.docs.forEach((doc) => {
      teacherProfiles[doc.id] = doc.data() || {};
    });

    const teacherSubjectMap = {};
    const addTeacherSubject = (teacherId, row = {}) => {
      const cleanTeacherId = trimText(teacherId);
      if (!cleanTeacherId) return;
      const status = lowerText(row.status || row.publishStatus || "");
      if (["draft", "unpublished", "archived", "deleted", "inactive"].includes(status)) return;
      const title = trimText(row.title || row.courseName || row.name);
      if (!title) return;
      if (!teacherSubjectMap[cleanTeacherId]) teacherSubjectMap[cleanTeacherId] = [];
      if (teacherSubjectMap[cleanTeacherId].some((item) => item.title === title)) return;
      teacherSubjectMap[cleanTeacherId].push({ id: row.id, title });
    };

    const subjectIds = new Set();
    subjectsSnap.docs.forEach((doc) => {
      const data = doc.data() || {};
      subjectIds.add(doc.id);
      addTeacherSubject(trimText(data.teacherId || data.teacher?.id), { id: doc.id, ...data });
    });
    coursesSnap.docs.forEach((doc) => {
      if (subjectIds.has(doc.id)) return;
      const data = doc.data() || {};
      addTeacherSubject(trimText(data.teacherId || data.teacher?.id), { id: doc.id, ...data });
    });

    const teacherClassMap = {};
    classesSnap.docs.forEach((doc) => {
      const data = doc.data() || {};
      const classId = trimText(doc.id);
      const teacherIds = new Set();

      const directTeacherId = trimText(data.teacherId);
      if (directTeacherId) teacherIds.add(directTeacherId);

      const teachers = Array.isArray(data.teachers) ? data.teachers : [];
      teachers.forEach((entry) => {
        const teacherId = trimText(
          typeof entry === "string" ? entry : entry?.teacherId || entry?.id
        );
        if (teacherId) teacherIds.add(teacherId);
      });

      const shifts = Array.isArray(data.shifts) ? data.shifts : [];
      shifts.forEach((shift) => {
        const teacherId = trimText(shift?.teacherId);
        if (teacherId) teacherIds.add(teacherId);
      });

      const assignedSubjects = Array.isArray(data.assignedSubjects) ? data.assignedSubjects : [];
      assignedSubjects.forEach((entry) => {
        const teacherId = trimText(entry?.teacherId);
        if (teacherId) teacherIds.add(teacherId);
      });

      teacherIds.forEach((teacherId) => {
        if (!teacherClassMap[teacherId]) teacherClassMap[teacherId] = new Set();
        teacherClassMap[teacherId].add(classId);
      });
    });

    const payload = teacherUsersSnap.docs
      .map((doc) => {
        const userData = doc.data() || {};
        const profileData = teacherProfiles[doc.id] || {};
        const isActive = userData.isActive !== false && profileData.isActive !== false;
        if (!isActive) return null;

        const fullName =
          trimText(profileData.fullName || profileData.name) ||
          trimText(userData.fullName || userData.name || userData.displayName) ||
          getNameFromEmail(userData.email);
        const subjects = teacherSubjectMap[doc.id] || [];
        const classesCount = teacherClassMap[doc.id]?.size || 0;

        return {
          id: doc.id,
          uid: doc.id,
          fullName: fullName || "Teacher",
          name: fullName || "Teacher",
          email: trimText(userData.email || profileData.email),
          title: trimText(profileData.title || profileData.role || "Instructor"),
          role: trimText(profileData.role || "Teacher"),
          subject: subjects[0]?.title || "Subject",
          subjects: subjects.map((row) => row.title),
          subjectsCount: subjects.length,
          coursesCount: subjects.length,
          classesCount,
          courses: `${subjects.length} ${subjects.length === 1 ? "Subject" : "Subjects"}`,
          bio: trimText(profileData.bio || profileData.description || profileData.about),
          rating: toNumber(profileData.rating, 0),
          profileImage:
            profileData.profileImage || profileData.avatar || profileData.photoURL || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || "")));

    return successResponse(res, payload, "Public teachers fetched");
  } catch (error) {
    console.error("getPublicTeachers error:", error);
    return errorResponse(res, "Failed to fetch teachers", 500);
  }
};

export const getStudentCertificates = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const payload = await getValidatedStudentCertificates(uid);
    const payloadWithDownload = payload.map((cert) => {
      const downloadUrl = getCertificateDownloadUrl(req, cert);
      return {
        ...cert,
        downloadUrl,
        pdfUrl: trimText(cert.pdfUrl) || downloadUrl,
      };
    });

    return successResponse(res, payloadWithDownload, "Certificates fetched");
  } catch (error) {
    console.error("getStudentCertificates error:", error);
    return errorResponse(res, "Failed to fetch certificates", 500);
  }
};

export const downloadStudentCertificate = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const certKey = trimText(req.params?.id);
    if (!certKey) return errorResponse(res, "Certificate id is required", 400);

    const certificates = await getValidatedStudentCertificates(uid);
    const certificate = certificates.find(
      (cert) =>
        trimText(cert.id) === certKey ||
        trimText(cert.certId).toLowerCase() === certKey.toLowerCase()
    );
    if (!certificate) {
      return errorResponse(res, "Certificate not found", 404);
    }

    const existingDirectUrl = trimText(
      certificate.pdfUrl ||
        certificate.downloadUrl ||
        certificate.certificatePdfUrl ||
        certificate.fileUrl ||
        certificate.url
    );
    if (/^https?:\/\//i.test(existingDirectUrl)) {
      return res.redirect(existingDirectUrl);
    }

    streamCertificatePdf(res, certificate);
  } catch (error) {
    console.error("downloadStudentCertificate error:", error);
    if (!res.headersSent) {
      return errorResponse(res, "Failed to download certificate", 500);
    }
  }
};

const getActiveQuizzesForCourseIds = async (courseIds = []) => {
  const cleanIds = [...new Set(courseIds.map((id) => trimText(id)).filter(Boolean))];
  if (!cleanIds.length) return [];

  const rows = [];
  for (const idsChunk of chunkArray(cleanIds, 10)) {
    if (!idsChunk.length) continue;
    try {
      const snap = await db
        .collection(COLLECTIONS.QUIZZES)
        .where("status", "==", "active")
        .where("courseId", "in", idsChunk)
        .get();
      rows.push(
        ...snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() || {}),
        }))
      );
    } catch {
      const snap = await db
        .collection(COLLECTIONS.QUIZZES)
        .where("courseId", "in", idsChunk)
        .get();
      rows.push(
        ...snap.docs
          .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
          .filter((row) => lowerText(row.status || "active") === "active")
      );
    }
  }

  const seen = new Set();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
};

const getLatestQuizAttemptMap = async (studentId) => {
  const snap = await db
    .collection(COLLECTIONS.QUIZ_RESULTS)
    .where("studentId", "==", studentId)
    .get();

  const byQuiz = {};
  snap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const quizId = trimText(data.quizId);
    if (!quizId) return;
    const submittedAt = parseDate(data.submittedAt || data.createdAt)?.getTime() || 0;
    const current = byQuiz[quizId];
    const currentTime =
      parseDate(current?.submittedAt || current?.createdAt)?.getTime() || -1;
    if (!current || submittedAt >= currentTime) {
      byQuiz[quizId] = { id: doc.id, ...(data || {}) };
    }
  });

  return byQuiz;
};

const parseQuizAssignmentStudents = (assignment = {}) => {
  const students = Array.isArray(assignment.students) ? assignment.students : [];
  return students
    .map((entry) => trimText(entry?.studentId || entry?.id || entry))
    .filter(Boolean);
};

const getQuizAssignmentDueAt = (quiz = {}) => {
  const assignment = quiz?.assignment || {};
  return parseDate(quiz?.dueDate || assignment.dueAt || quiz?.dueAt || null);
};

const isQuizAssignedToStudent = (quiz = {}, uid = "") => {
  const cleanId = trimText(uid);
  if (!cleanId) return false;

  // New assignment model
  const assignedStudents = Array.isArray(quiz.assignedStudents)
    ? quiz.assignedStudents.map((entry) => trimText(entry)).filter(Boolean)
    : [];
  if (assignedStudents.includes(cleanId)) return true;

  const assignedTo = lowerText(quiz.assignedTo || quiz.assignTo || "");
  if (assignedTo === "all_enrolled" || assignedTo === "all_subject") return true;

  // Legacy assignment model
  const assignmentStudents = parseQuizAssignmentStudents(quiz.assignment || {});
  if (!assignmentStudents.length) return false;
  return assignmentStudents.includes(cleanId);
};

const isAnnouncementVisibleToStudent = (
  announcement = {},
  uid = "",
  courseIdSet = new Set(),
  classIdSet = new Set()
) => {
  const targetType = lowerText(announcement.targetType || "system");
  const targetId = trimText(announcement.targetId);
  const audienceRole = lowerText(announcement.audienceRole || "student");
  const recipientIds = Array.isArray(announcement.recipientIds)
    ? announcement.recipientIds.map((entry) => trimText(entry)).filter(Boolean)
    : [];

  if (targetType === "single_user") {
    return targetId === uid || recipientIds.includes(uid);
  }

  if (!(audienceRole === "student" || audienceRole === "all")) return false;
  if (targetType === "system") return true;
  if (targetType === "course") return courseIdSet.has(targetId);
  if (targetType === "class") return classIdSet.has(targetId);
  return false;
};

export const getStudentQuizzes = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const enrolledCourseIds = await getStudentEnrolledCourseIds(uid);
    if (!enrolledCourseIds.length) {
      return successResponse(res, [], "Student quizzes fetched");
    }

    const [quizzes, latestAttemptMap, courseMap, approvedFinalQuizCourseIds] = await Promise.all([
      getActiveQuizzesForCourseIds(enrolledCourseIds),
      getLatestQuizAttemptMap(uid),
      getCourseDocsByIds(enrolledCourseIds),
      getApprovedFinalQuizCourseIds(uid),
    ]);

    const nowTime = Date.now();
    const payload = quizzes
      .filter((quiz) =>
        canStudentAttemptQuiz({
          quiz,
          studentId: uid,
          approvedFinalQuizCourseIds,
        })
      )
      .map((quiz) => {
        const courseId = trimText(quiz.courseId);
        const courseData = courseMap[courseId] || {};
        const subjectId = trimText(quiz.subjectId);
        const subject = (Array.isArray(courseData.subjects) ? courseData.subjects : []).find(
          (row) => trimText(row?.id || row?.subjectId) === subjectId
        );
        const passScore = toNumber(quiz.passScore, 50);
        const latest = latestAttemptMap[quiz.id];
        const assignedStudents = Array.isArray(quiz.assignedStudents)
          ? quiz.assignedStudents.map((entry) => trimText(entry)).filter(Boolean)
          : [];
        const assignedTo = lowerText(quiz.assignedTo || quiz.assignTo || "");
        const isAssignedToYou = assignedStudents.includes(uid);
        const assignmentBadge = isAssignedToYou
          ? "assigned_to_you"
          : assignedTo === "all_class"
            ? "class_assignment"
            : assignedTo
              ? "course_assignment"
              : "assigned_to_you";
        const dueAtDate = getQuizAssignmentDueAt(quiz);
        const dueAt = dueAtDate ? dueAtDate.toISOString() : null;
        const isPastDue = dueAtDate ? dueAtDate.getTime() < nowTime : false;
        const percentage = toNumber(
          latest?.percentage ?? latest?.scorePercent,
          0
        );
        let status = "available";
        if (latest) {
          if (
            ["partial", "pending_review"].includes(lowerText(latest.status))
          ) {
            status = "attempted";
          } else if (latest.isPassed === true || percentage >= passScore) {
            status = "passed";
          } else {
            status = "failed";
          }
        } else if (isPastDue) {
          status = "expired";
        }

        return {
          id: quiz.id,
          title: trimText(quiz.title) || "Quiz",
          isFinalQuiz:
            quiz.isFinalQuiz === true ||
            lowerText(quiz.quizType) === "final" ||
            lowerText(quiz.assessmentType) === "final",
          courseId,
          courseName: trimText(quiz.courseName || courseData.title) || "Course",
          subjectId,
          subjectName:
            trimText(quiz.subjectName || subject?.subjectName || subject?.name) ||
            "Subject",
          scope: lowerText(quiz.scope || "subject"),
          chapterId: trimText(quiz.chapterId),
          chapterName: trimText(quiz.chapterName || quiz.chapterTitle),
          totalMarks: Math.max(0, toNumber(quiz.totalMarks, 0)),
          questionsCount: Math.max(
            0,
            toNumber(quiz.questionCount, Array.isArray(quiz.questions) ? quiz.questions.length : 0)
          ),
          timeLimit: Math.max(0, toNumber(quiz.timeLimit, 0)),
          passScore,
          assignedTo: assignedTo || null,
          isAssignedToYou,
          assignmentBadge,
          dueDate: dueAt,
          status,
          dueAt,
          isPastDue,
          lastAttempt: latest
            ? {
                // Keep legacy `score` field for old clients.
                score: toNumber(
                  latest.totalScore ?? latest.autoScore ?? latest.objectiveScore,
                  0
                ),
                autoScore: toNumber(latest.autoScore ?? latest.objectiveScore, 0),
                totalMarks: toNumber(latest.totalMarks, 0),
                percentage: toNumber(
                  latest.percentage ?? latest.scorePercent ?? latest.totalScore,
                  0
                ),
                isPassed: latest.isPassed === true,
                shortAnswerPending: toNumber(latest.shortAnswerPending, 0),
                rank: Number.isFinite(Number(latest.rank)) ? Number(latest.rank) : null,
                totalAttempts: toNumber(latest.totalAttempts, 0),
                topScore: toNumber(latest.topScore, 0),
                avgScore: toNumber(latest.avgScore, 0),
                passingCount: toNumber(latest.passingCount, 0),
                status: lowerText(latest.status || ""),
                submittedAt: toIso(latest.submittedAt || latest.createdAt),
              }
            : null,
        };
      })
      .sort(
        (a, b) =>
          (parseDate(b.lastAttempt?.submittedAt)?.getTime() ||
            parseDate(b.dueAt)?.getTime() ||
            0) -
          (parseDate(a.lastAttempt?.submittedAt)?.getTime() ||
            parseDate(a.dueAt)?.getTime() ||
            0)
      );

    return successResponse(res, payload, "Student quizzes fetched");
  } catch (error) {
    console.error("getStudentQuizzes error:", error);
    return errorResponse(res, "Failed to fetch quizzes", 500);
  }
};

const ensureQuizUnlockedForStudent = async ({
  studentId = "",
  courseId = "",
  quizId = "",
}) => {
  const built = await buildCourseContentForStudent(studentId, courseId);
  if (built?.error) {
    return {
      allowed: false,
      status: built.status || 403,
      code: built.code || "QUIZ_LOCKED",
      lockReason: "",
      error: built.error || "Quiz is locked for your current progress",
    };
  }

  const allQuizzes = [
    ...(Array.isArray(built.chapters)
      ? built.chapters.flatMap((chapter) =>
          Array.isArray(chapter?.quizzes) ? chapter.quizzes : []
        )
      : []),
    ...(Array.isArray(built.subjectQuizzes) ? built.subjectQuizzes : []),
  ];
  const matchedQuiz = allQuizzes.find(
    (row) => trimText(row?.quizId || row?.id) === trimText(quizId)
  );

  if (!matchedQuiz) {
    return {
      allowed: false,
      status: 403,
      code: "QUIZ_NOT_AVAILABLE",
      lockReason: "",
      error: "Quiz is not available for your current progress",
    };
  }

  if (matchedQuiz.isLocked) {
    return {
      allowed: false,
      status: 403,
      code: "QUIZ_LOCKED",
      lockReason: trimText(matchedQuiz.lockReason),
      error:
        trimText(matchedQuiz.lockReason) ||
        "Complete previous videos/quizzes to unlock this quiz",
    };
  }

  return {
    allowed: true,
    status: 200,
    code: "",
    lockReason: "",
    error: "",
  };
};

export const getQuizById = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const quizId = trimText(req.params?.quizId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!quizId) return errorResponse(res, "quizId is required", 400);

    const quizSnap = await db.collection(COLLECTIONS.QUIZZES).doc(quizId).get();
    if (!quizSnap.exists) return errorResponse(res, "Quiz not found", 404);
    const quizData = quizSnap.data() || {};
    const courseId = trimText(quizData.courseId);

    const enrolledIds = await getStudentEnrolledCourseIds(uid);
    if (!courseId || !enrolledIds.includes(courseId)) {
      return errorResponse(res, "You are not enrolled in this quiz course", 403);
    }

    const approvedFinalQuizCourseIds = await getApprovedFinalQuizCourseIds(uid);
    if (
      !canStudentAttemptQuiz({
        quiz: quizData,
        studentId: uid,
        approvedFinalQuizCourseIds,
      })
    ) {
      if (isFinalQuizRow(quizData)) {
        return errorResponse(
          res,
          "Final quiz is not approved for you yet. Request approval first.",
          403,
          { code: "FINAL_QUIZ_NOT_APPROVED" }
        );
      }
      return errorResponse(res, "This quiz is not assigned to you", 403);
    }
    const dueAtDate = getQuizAssignmentDueAt(quizData);
    if (dueAtDate && dueAtDate.getTime() < Date.now()) {
      return errorResponse(res, "Quiz deadline has passed", 403);
    }
    // Quizzes are attemptable even if previous videos are not completed (per product requirement).

    const questions = Array.isArray(quizData.questions) ? quizData.questions : [];
    const sanitizedQuestions = questions
      .map((question) => sanitizeQuestionForStudent(question))
      .filter((row) => row.questionId);

    return successResponse(
      res,
      {
        id: quizId,
        title: trimText(quizData.title) || "Quiz",
        description: trimText(quizData.description),
        isFinalQuiz:
          quizData.isFinalQuiz === true ||
          lowerText(quizData.quizType) === "final" ||
          lowerText(quizData.assessmentType) === "final",
        courseId,
        courseName: trimText(quizData.courseName) || "Course",
        subjectId: trimText(quizData.subjectId),
        subjectName: trimText(quizData.subjectName) || "Subject",
        chapterId: trimText(quizData.chapterId),
        chapterName: trimText(quizData.chapterName || quizData.chapterTitle),
        scope: lowerText(quizData.scope || "subject"),
        totalMarks: Math.max(
          0,
          toNumber(
            quizData.totalMarks,
            sanitizedQuestions.reduce(
              (sum, question) => sum + Math.max(1, toNumber(question.marks, 1)),
              0
            )
          )
        ),
        passScore: toNumber(quizData.passScore, 50),
        timeLimit: Math.max(0, toNumber(quizData.timeLimit, 0)),
        questions: sanitizedQuestions,
      },
      "Quiz fetched"
    );
  } catch (error) {
    console.error("getQuizById error:", error);
    return errorResponse(res, "Failed to fetch quiz", 500);
  }
};

export const submitQuizAttempt = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const quizId = trimText(req.params?.quizId);
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!quizId) return errorResponse(res, "quizId is required", 400);
    if (!answers.length) return errorResponse(res, "answers are required", 400);

    const quizSnap = await db.collection(COLLECTIONS.QUIZZES).doc(quizId).get();
    if (!quizSnap.exists) return errorResponse(res, "Quiz not found", 404);
    const quizData = quizSnap.data() || {};
    const courseId = trimText(quizData.courseId);
    const enrolledIds = await getStudentEnrolledCourseIds(uid);
    if (!courseId || !enrolledIds.includes(courseId)) {
      return errorResponse(res, "You are not enrolled in this quiz course", 403);
    }

    const approvedFinalQuizCourseIds = await getApprovedFinalQuizCourseIds(uid);
    if (
      !canStudentAttemptQuiz({
        quiz: quizData,
        studentId: uid,
        approvedFinalQuizCourseIds,
      })
    ) {
      if (isFinalQuizRow(quizData)) {
        return errorResponse(
          res,
          "Final quiz is not approved for you yet. Request approval first.",
          403,
          { code: "FINAL_QUIZ_NOT_APPROVED" }
        );
      }
      return errorResponse(res, "This quiz is not assigned to you", 403);
    }
    const dueAtDate = getQuizAssignmentDueAt(quizData);
    if (dueAtDate && dueAtDate.getTime() < Date.now()) {
      return errorResponse(res, "Quiz deadline has passed", 403);
    }
    // Quizzes are attemptable even if previous videos are not completed (per product requirement).

    const questions = Array.isArray(quizData.questions) ? quizData.questions : [];
    if (!questions.length) return errorResponse(res, "Quiz has no questions", 400);
    const isFinalQuiz = isFinalQuizRow(quizData);

    const answerMap = normalizeSubmittedAnswers(answers);
    let autoScore = 0;
    let shortAnswerPending = 0;
    const gradedAnswers = questions.map((question) => {
      const questionId = trimText(question.questionId || question.id);
      const questionType = lowerText(question.type || question.questionType || "mcq");
      const questionText = trimText(question.questionText || question.text);
      const maxMarks = Math.max(1, toNumber(question.marks, 1));
      const studentAnswerRaw = answerMap[questionId];
      const studentAnswer =
        studentAnswerRaw === undefined || studentAnswerRaw === null
          ? ""
          : String(studentAnswerRaw);

      const grading = gradeObjectiveAnswer(question, studentAnswerRaw);
      if (grading.pending) {
        shortAnswerPending += 1;
      } else {
        autoScore += Math.max(0, toNumber(grading.marksObtained, 0));
      }

      const marksValue =
        grading.marksObtained === null || grading.marksObtained === undefined
          ? null
          : Math.max(0, toNumber(grading.marksObtained, 0));

      return {
        questionId,
        type: questionType,
        questionType,
        questionText,
        submittedAnswer: studentAnswer,
        studentAnswer,
        expectedAnswer:
          questionType === "short_answer"
            ? trimText(question.expectedAnswer || "")
            : "",
        correctAnswer:
          questionType === "short_answer"
            ? null
            : questionType === "true_false"
              ? question.correctAnswer === true ||
                ["true", "1", "yes", "t"].includes(lowerText(question.correctAnswer))
              : trimText(question.correctAnswer),
        isCorrect: grading.isCorrect,
        marksAwarded: marksValue,
        marksObtained: marksValue,
        maxMarks,
        requiresManualReview: questionType === "short_answer",
        feedback: "",
        status: grading.status,
      };
    });

    const totalMarks = Math.max(
      0,
      toNumber(
        quizData.totalMarks,
        questions.reduce(
          (sum, question) => sum + Math.max(1, toNumber(question.marks, 1)),
          0
        )
      )
    );
    const percentage = totalMarks > 0 ? Number(((autoScore / totalMarks) * 100).toFixed(2)) : 0;
    const passScore = toNumber(quizData.passScore, 50);
    const status = shortAnswerPending > 0 ? "pending_review" : "completed";
    const isPassed = percentage >= passScore;

    const studentProfile = await getStudentAndUser(uid);
    const studentName =
      trimText(studentProfile.studentData.fullName) ||
      trimText(studentProfile.studentData.name) ||
      trimText(studentProfile.userData.fullName) ||
      getNameFromEmail(studentProfile.userData.email || "");

    const resultRef = await db.collection(COLLECTIONS.QUIZ_RESULTS).add({
      studentId: uid,
      studentName,
      quizId,
      quizTitle: trimText(quizData.title),
      teacherId: trimText(quizData.teacherId),
      courseId,
      courseName: trimText(quizData.courseName),
      subjectId: trimText(quizData.subjectId),
      subjectName: trimText(quizData.subjectName),
      chapterId: trimText(quizData.chapterId),
      chapterTitle: trimText(quizData.chapterTitle || quizData.chapterName),
      answers: gradedAnswers,
      autoScore,
      objectiveScore: autoScore,
      manualScore: 0,
      totalScore: autoScore,
      totalMarks,
      shortAnswerPending,
      pendingManualMarks: gradedAnswers
        .filter((row) => row.status === "pending_review")
        .reduce((sum, row) => sum + Math.max(1, toNumber(row.maxMarks, 1)), 0),
      status,
      percentage,
      scorePercent: percentage,
      isPassed,
      submittedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    let rank = null;
    let totalAttempts = null;
    let topScore = null;
    let avgScore = null;
    let passingCount = null;
    try {
      const allResultsSnap = await db
        .collection(COLLECTIONS.QUIZ_RESULTS)
        .where("quizId", "==", quizId)
        .get();

      const nonPartialRows = allResultsSnap.docs
        .map((doc) => doc.data() || {})
        .filter((row) => lowerText(row.status) !== "partial");

      const scores = nonPartialRows
        .map((row) => Number(row.percentage ?? row.scorePercent ?? 0))
        .filter((score) => Number.isFinite(score))
        .sort((a, b) => b - a);

      const studentScore = Number(percentage || 0);
      const foundIndex = scores.findIndex((s) => s <= studentScore);
      rank = foundIndex >= 0 ? foundIndex + 1 : scores.length + 1;

      totalAttempts = nonPartialRows.length;
      topScore = scores.length ? scores[0] : 0;
      avgScore =
        scores.length > 0
          ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2))
          : 0;
      passingCount = nonPartialRows.filter((row) => {
        const pct = Number(row.percentage ?? row.scorePercent ?? 0);
        if (!Number.isFinite(pct)) return false;
        return pct >= passScore;
      }).length;

      await resultRef.set(
        {
          rank,
          totalAttempts,
          topScore,
          avgScore,
          passingCount,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (rankError) {
      console.error("submitQuizAttempt rank error:", rankError);
      rank = null;
      totalAttempts = null;
      topScore = null;
      avgScore = null;
      passingCount = null;
    }

    let certificateIssued = false;
    let certificatePending = false;
    let certificateBlockedByFinalQuiz = false;
    let classCertificatesIssued = 0;
    let classCertificateBlockedByFinalQuiz = 0;

    if (isFinalQuiz && status === "completed") {
      const latestRequest = await getLatestFinalQuizRequest(uid, courseId);
      if (latestRequest?.id) {
        await db
          .collection(COLLECTIONS.FINAL_QUIZ_REQUESTS)
          .doc(latestRequest.id)
          .set(
            {
              status: isPassed ? "completed" : "rejected",
              finalQuizPassed: Boolean(isPassed),
              finalQuizResultId: resultRef.id,
              reviewedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
      }
    }

    if (isFinalQuiz && status === "completed" && isPassed) {
      const [
        profile,
        courseLectures,
        courseProgressRows,
        allProgressRows,
        allEnrollments,
        classMembershipRows,
        courseSnap,
      ] = await Promise.all([
        getStudentAndUser(uid),
        getCourseLectures(courseId),
        getProgressRowsForStudent(uid, courseId),
        getProgressRowsForStudent(uid),
        getEnrolledRows(uid),
        getStudentClassMembershipRows(uid),
        db.collection(COLLECTIONS.COURSES).doc(courseId).get(),
      ]);

      const totalLectures = courseLectures.length;
      const progressMap = buildLectureProgressMap(courseProgressRows, courseId);
      const completedCount = courseLectures.filter(
        (lecture) => progressMap[lecture.id]?.isCompleted
      ).length;
      const courseCompleted = totalLectures > 0 && completedCount >= totalLectures;

      const enrollmentClassIds = allEnrollments
        .map((row) => trimText(row.classId))
        .filter(Boolean);
      const classMap = classMembershipRows.reduce((acc, row) => {
        acc[trimText(row.id)] = row;
        return acc;
      }, {});
      const missingClassIds = [...new Set(enrollmentClassIds)].filter(
        (classId) => !classMap[classId]
      );
      const missingClassRows = await Promise.all(
        missingClassIds.map(async (classId) => {
          const snap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
          return snap.exists ? { id: snap.id, ...(snap.data() || {}) } : null;
        })
      );
      const classRows = [...classMembershipRows, ...missingClassRows.filter(Boolean)].map(
        (row) => ({
          ...(row || {}),
          id: trimText(row?.id),
        })
      );

      const certificateAccess = resolveCourseAccessStateFromClasses({
        uid,
        courseId,
        classRows,
        enrollments: allEnrollments,
        progressRows: allProgressRows,
      });
      const finalQuizState = await resolveFinalQuizRequirementState({
        studentId: uid,
        courseId,
      });
      const certificateEligibleNow =
        certificateAccess.eligibleForCertificate &&
        (!finalQuizState.requiresFinalQuiz || finalQuizState.finalQuizPassed);

      if (courseCompleted) {
        if (certificateEligibleNow) {
          const certResult = await ensureCertificateForCompletion({
            studentId: uid,
            studentData: profile.studentData,
            userData: profile.userData,
            courseId,
            courseData: courseSnap.exists ? courseSnap.data() || {} : {},
            classContext: certificateAccess.preferredClassContext || null,
          });
          certificateIssued = Boolean(certResult?.created);
        } else {
          certificatePending = true;
          certificateBlockedByFinalQuiz =
            finalQuizState.requiresFinalQuiz && !finalQuizState.finalQuizPassed;
        }
      }

      const classCertificateBatch = await ensureCertificatesForFullyCompletedClasses({
        studentId: uid,
        studentData: profile.studentData,
        userData: profile.userData,
        classRows,
        enrollments: allEnrollments,
        progressRows: allProgressRows,
      });
      classCertificatesIssued = Number(classCertificateBatch.createdCertificates || 0);
      classCertificateBlockedByFinalQuiz = Number(
        classCertificateBatch.blockedByFinalQuiz || 0
      );
      if (classCertificatesIssued > 0) {
        certificateIssued = true;
      }
    }

    return successResponse(
      res,
      {
        resultId: resultRef.id,
        quizId,
        isFinalQuiz,
        autoScore,
        totalMarks,
        shortAnswerPending,
        status,
        percentage,
        isPassed,
        rank,
        totalAttempts,
        topScore,
        avgScore,
        passingCount,
        certificateIssued,
        certificatePending,
        certificateBlockedByFinalQuiz,
        classCertificatesIssued,
        classCertificateBlockedByFinalQuiz,
        answers: gradedAnswers.map((row) => ({
          questionId: row.questionId,
          questionType: row.questionType,
          status: row.status,
          isCorrect: row.isCorrect,
          marksObtained: row.marksObtained,
        })),
      },
      "Quiz submitted successfully",
      201
    );
  } catch (error) {
    console.error("submitQuizAttempt error:", error);
    return errorResponse(res, "Failed to submit quiz attempt", 500);
  }
};

export const getStudentAnnouncements = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const [courseIds, classIds] = await Promise.all([
      getStudentEnrolledCourseIds(uid),
      getStudentClassIds(uid),
    ]);
    const courseIdSet = new Set(courseIds);
    const classIdSet = new Set(classIds);

    let rows = [];
    try {
      const snap = await db
        .collection(COLLECTIONS.ANNOUNCEMENTS)
        .orderBy("isPinned", "desc")
        .orderBy("createdAt", "desc")
        .get();
      rows = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    } catch {
      const snap = await db
        .collection(COLLECTIONS.ANNOUNCEMENTS)
        .orderBy("createdAt", "desc")
        .get();
      rows = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    }

    const payload = rows
      .filter((row) => isAnnouncementVisibleToStudent(row, uid, courseIdSet, classIdSet))
      .sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
          return a.isPinned ? -1 : 1;
        }
        return parseAnnouncementDate(b.createdAt) - parseAnnouncementDate(a.createdAt);
      })
      .map((row) => {
        const readBy = Array.isArray(row.readBy) ? row.readBy : [];
        return {
          id: row.id,
          title: trimText(row.title) || "Announcement",
          message: trimText(row.message),
          targetType: lowerText(row.targetType || "system"),
          targetId: trimText(row.targetId),
          audienceRole: lowerText(row.audienceRole || "student"),
          isPinned: Boolean(row.isPinned),
          createdAt: toIso(row.createdAt),
          updatedAt: toIso(row.updatedAt),
          postedBy: trimText(row.postedBy),
          postedByName: trimText(row.postedByName),
          isRead: readBy.includes(uid),
        };
      });

    return successResponse(res, payload, "Student announcements fetched");
  } catch (error) {
    console.error("getStudentAnnouncements error:", error);
    return errorResponse(res, "Failed to fetch announcements", 500);
  }
};

export const markAnnouncementRead = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const announcementId = trimText(req.params?.id || req.params?.announcementId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!announcementId) return errorResponse(res, "announcement id is required", 400);

    const ref = db.collection(COLLECTIONS.ANNOUNCEMENTS).doc(announcementId);
    const snap = await ref.get();
    if (!snap.exists) return errorResponse(res, "Announcement not found", 404);
    const data = snap.data() || {};

    const [courseIds, classIds] = await Promise.all([
      getStudentEnrolledCourseIds(uid),
      getStudentClassIds(uid),
    ]);
    if (
      !isAnnouncementVisibleToStudent(data, uid, new Set(courseIds), new Set(classIds))
    ) {
      return errorResponse(res, "Announcement not found", 404);
    }

    const readBy = Array.isArray(data.readBy) ? data.readBy : [];
    if (!readBy.includes(uid)) {
      await ref.set(
        { readBy: admin.firestore.FieldValue.arrayUnion(uid), updatedAt: serverTimestamp() },
        { merge: true }
      );
    }

    return successResponse(
      res,
      { id: announcementId, isRead: true },
      "Announcement marked as read"
    );
  } catch (error) {
    console.error("markAnnouncementRead error:", error);
    return errorResponse(res, "Failed to mark announcement as read", 500);
  }
};

const buildStudentAttendancePayload = async (uid = "") => {
  const cleanUid = trimText(uid);
  const emptySummary = {
    totalSessions: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    attendancePercent: 0,
    currentStreak: 0,
    longestStreak: 0,
    learningDaysElapsed: 0,
    courseDurationDays: 0,
    learningDayProgress: null,
  };
  const emptyPayload = { classes: [], summary: emptySummary };
  if (!cleanUid) return emptyPayload;

  const [enrolledCourseIds, enrollmentRows] = await Promise.all([
    getStudentEnrolledCourseIds(cleanUid),
    getEnrolledRows(cleanUid),
  ]);
  const enrolledCourseSet = new Set(
    enrolledCourseIds.map((id) => trimText(id)).filter(Boolean)
  );
  if (!enrolledCourseSet.size) return emptyPayload;

  const classIds = await getStudentClassIds(cleanUid, enrollmentRows);
  if (!classIds.length) return emptyPayload;

  const [classSnaps, attendanceSnap, courseMap] = await Promise.all([
    Promise.all(
      classIds.map(async (classId) => {
        const snap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
        return [classId, snap.exists ? snap.data() || {} : null];
      })
    ),
    db.collection(COLLECTIONS.ATTENDANCE).where("studentId", "==", cleanUid).get(),
    getCourseDocsByIds(enrolledCourseIds),
  ]);

  const classMap = Object.fromEntries(classSnaps.filter(([, row]) => Boolean(row)));
  const normalizeCourseIdsFromClass = (classData = {}) => {
    const ids = [];
    if (trimText(classData.courseId)) ids.push(trimText(classData.courseId));
    const assigned = Array.isArray(classData.assignedCourses) ? classData.assignedCourses : [];
    assigned.forEach((entry) => {
      const candidate =
        typeof entry === "string"
          ? trimText(entry)
          : trimText(entry?.courseId || entry?.id);
      if (candidate) ids.push(candidate);
    });
    const courses = Array.isArray(classData.courses) ? classData.courses : [];
    courses.forEach((entry) => {
      const candidate =
        typeof entry === "string"
          ? trimText(entry)
          : trimText(entry?.courseId || entry?.id);
      if (candidate) ids.push(candidate);
    });
    return [...new Set(ids)];
  };

  const filteredClassIds = classIds.filter((classId) => {
    const classData = classMap[classId];
    if (!classData) return false;
    const classCourseIds = getStudentCourseIdsFromClassRow(classData, cleanUid);
    const fallbackCourseIds = normalizeCourseIdsFromClass(classData);
    const resolvedCourseIds = classCourseIds.length ? classCourseIds : fallbackCourseIds;
    if (!resolvedCourseIds.length) return false;
    return resolvedCourseIds.some((courseId) => enrolledCourseSet.has(courseId));
  });
  if (!filteredClassIds.length) return emptyPayload;

  const sessionRows = [];
  for (const chunk of chunkArray(filteredClassIds, 10)) {
    if (!chunk.length) continue;
    try {
      const snap = await db
        .collection(COLLECTIONS.SESSIONS)
        .where("classId", "in", chunk)
        .get();
      sessionRows.push(...snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })));
    } catch {
      const fallbackRows = await Promise.all(
        chunk.map(async (classId) => {
          const snap = await db
            .collection(COLLECTIONS.SESSIONS)
            .where("classId", "==", classId)
            .get();
          return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
        })
      );
      sessionRows.push(...fallbackRows.flat());
    }
  }

  const sessionByClass = {};
  sessionRows.forEach((row) => {
    const classId = trimText(row.classId);
    if (!classId) return;
    if (!sessionByClass[classId]) sessionByClass[classId] = [];
    if (lowerText(row.status) === "cancelled" || row.cancelledAt) return;
    sessionByClass[classId].push(row);
  });

  const attendanceRows = attendanceSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  const attendanceBySession = attendanceRows.reduce((acc, row) => {
    const sessionId = trimText(row.sessionId);
    if (!sessionId) return acc;
    acc[sessionId] = row;
    return acc;
  }, {});

  const today = toDateOnly(new Date());
  const classes = filteredClassIds.map((classId) => {
    const classData = classMap[classId] || {};
    const classCourseIds = getStudentCourseIdsFromClassRow(classData, cleanUid);
    const fallbackCourseIds = normalizeCourseIdsFromClass(classData);
    const resolvedCourseIds = (classCourseIds.length ? classCourseIds : fallbackCourseIds).filter(
      (courseId) => enrolledCourseSet.has(courseId)
    );

    const matchingEnrollments = enrollmentRows.filter(
      (row) =>
        trimText(row.studentId) === cleanUid &&
        trimText(row.classId) === classId &&
        (!resolvedCourseIds.length || resolvedCourseIds.includes(trimText(row.subjectId || row.courseId)))
    );

    const windowStart = maxDate([
      toDateOnly(classData.startDate),
      ...matchingEnrollments.map((row) => toDateOnly(row.createdAt || row.enrolledAt)),
      ...resolvedCourseIds.map((courseId) => toDateOnly(courseMap[courseId]?.startDate)),
    ]);
    let windowEnd = minDate([
      toDateOnly(classData.endDate),
      ...matchingEnrollments.map((row) => toDateOnly(row.completedAt)),
      ...resolvedCourseIds.map((courseId) => toDateOnly(courseMap[courseId]?.endDate)),
    ]);
    if (windowStart && windowEnd && windowEnd.getTime() < windowStart.getTime()) {
      windowEnd = null;
    }

    const sessions = (sessionByClass[classId] || [])
      .filter((session) => {
        const sessionDate = toDateOnly(session.date);
        if (!sessionDate) return false;
        const sessionCourseId = trimText(session.courseId);
        if (
          resolvedCourseIds.length &&
          sessionCourseId &&
          !resolvedCourseIds.includes(sessionCourseId)
        ) {
          return false;
        }
        return isDateInRange(sessionDate, windowStart, windowEnd);
      })
      .sort(
        (a, b) => (toDateOnly(a.date)?.getTime() || 0) - (toDateOnly(b.date)?.getTime() || 0)
      );

    const normalizedSessions = sessions.map((session, index) => {
      const attendance = attendanceBySession[session.id] || null;
      const rawDate = toDateOnly(session.date);
      const normalizedDate = formatSessionDate(session.date);
      const startTime = trimText(session.startTime);
      const endTime = trimText(session.endTime);
      const startsAt = rawDate
        ? (() => {
            const date = new Date(rawDate);
            const timeMatch = /^(\d{2}):(\d{2})$/.exec(startTime);
            if (timeMatch) {
              date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
            } else {
              date.setHours(23, 59, 59, 999);
            }
            return date;
          })()
        : null;
      const isUpcoming = startsAt
        ? startsAt.getTime() > Date.now()
        : rawDate
          ? rawDate.getTime() > Date.now()
          : false;

      let status = "absent";
      if (isUpcoming) {
        status = "upcoming";
      } else if (attendance) {
        const normalizedStatus = lowerText(attendance.status);
        if (["present", "absent", "late"].includes(normalizedStatus)) {
          status = normalizedStatus;
        }
      }

      return {
        sessionId: session.id,
        sessionNumber: index + 1,
        date: normalizedDate,
        startTime,
        endTime,
        topic: trimText(session.topic) || "Session",
        courseId: trimText(session.courseId),
        courseName: trimText(session.courseName),
        subjectId: trimText(session.subjectId),
        subjectName: trimText(session.subjectName),
        status,
        remarks: trimText(attendance?.remarks || attendance?.note || session.remarks || ""),
        isUpcoming,
        markedBy: trimText(attendance?.markedBy),
        markedAt: toIso(attendance?.markedAt),
      };
    });

    const conductedSessions = normalizedSessions.filter((row) => !row.isUpcoming);
    const totalSessions = conductedSessions.length;
    const presentCount = conductedSessions.filter((row) => row.status === "present").length;
    const lateCount = conductedSessions.filter((row) => row.status === "late").length;
    const absentCount = conductedSessions.filter((row) => row.status === "absent").length;
    const attendancePercent =
      totalSessions > 0
        ? Number((((presentCount + lateCount) / totalSessions) * 100).toFixed(2))
        : 0;

    const { currentStreak, longestStreak } = getCurrentAndLongestStreak(conductedSessions);
    const learningStart =
      windowStart || toDateOnly(conductedSessions[0]?.date || normalizedSessions[0]?.date);
    const learningEnd = learningStart ? minDate([windowEnd, today]) || today : null;
    const learningDaysElapsed =
      learningStart && learningEnd ? daysInclusive(learningStart, learningEnd) : 0;
    const courseDurationDays =
      windowStart && windowEnd ? daysInclusive(windowStart, windowEnd) : 0;
    const learningDayProgress =
      courseDurationDays > 0
        ? Number(Math.min(100, ((learningDaysElapsed / courseDurationDays) * 100).toFixed(2)))
        : null;

    return {
      classId,
      className: trimText(classData.name) || "Class",
      batchCode: trimText(classData.batchCode),
      teacherName: trimText(classData.teacherName) || "Teacher",
      courseWindowStart: windowStart ? windowStart.toISOString().slice(0, 10) : null,
      courseWindowEnd: windowEnd ? windowEnd.toISOString().slice(0, 10) : null,
      learningDaysElapsed,
      courseDurationDays,
      learningDayProgress,
      currentStreak,
      longestStreak,
      totalSessions,
      presentCount,
      absentCount,
      lateCount,
      attendancePercent,
      sessions: normalizedSessions,
    };
  });

  const summary = classes.reduce(
    (acc, row) => {
      acc.totalSessions += row.totalSessions;
      acc.presentCount += row.presentCount;
      acc.absentCount += row.absentCount;
      acc.lateCount += row.lateCount;
      acc.learningDaysElapsed += toNumber(row.learningDaysElapsed, 0);
      acc.courseDurationDays += toNumber(row.courseDurationDays, 0);
      acc.currentStreak = Math.max(acc.currentStreak, toNumber(row.currentStreak, 0));
      acc.longestStreak = Math.max(acc.longestStreak, toNumber(row.longestStreak, 0));
      return acc;
    },
    {
      totalSessions: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      currentStreak: 0,
      longestStreak: 0,
      learningDaysElapsed: 0,
      courseDurationDays: 0,
    }
  );
  summary.attendancePercent =
    summary.totalSessions > 0
      ? Number((((summary.presentCount + summary.lateCount) / summary.totalSessions) * 100).toFixed(2))
      : 0;
  summary.learningDayProgress =
    summary.courseDurationDays > 0
      ? Number(
          Math.min(100, ((summary.learningDaysElapsed / summary.courseDurationDays) * 100).toFixed(2))
        )
      : null;

  return { classes, summary };
};

export const getStudentAttendance = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    const payload = await buildStudentAttendancePayload(uid);
    return successResponse(res, payload, "Student attendance fetched");
  } catch (error) {
    console.error("getStudentAttendance error:", error);
    return errorResponse(res, "Failed to fetch attendance", 500);
  }
};

export const reportSecurityViolation = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const rawReason = lowerText(req.body?.reason || "default");
    const rawPage = lowerText(req.body?.page || "unknown");
    const reason = SECURITY_REASONS.has(rawReason) ? rawReason : "default";
    const page = SECURITY_PAGES.has(rawPage) ? rawPage : "unknown";
    const details = trimText(req.body?.details || "");
    const { clientIP, clientDevice, userAgent } = resolveClientContext(req);

    const userRef = db.collection(COLLECTIONS.USERS).doc(uid);
    const studentRef = db.collection(COLLECTIONS.STUDENTS).doc(uid);
    const violationRef = db.collection(COLLECTIONS.SECURITY_VIOLATIONS).doc();

    let responseData = {
      violationId: violationRef.id,
      count: 0,
      limit: SECURITY_VIOLATION_LIMIT,
      reason,
      page,
      deactivated: false,
      contactAdmin: false,
    };

    await db.runTransaction(async (transaction) => {
      const [userSnap, studentSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(studentRef),
      ]);

      if (!userSnap.exists) {
        throw new Error("USER_NOT_FOUND");
      }
      const userData = userSnap.data() || {};
      if (lowerText(userData.role) !== "student") {
        throw new Error("NOT_STUDENT");
      }

      const currentCount = Math.max(0, toNumber(userData.securityViolationCount, 0));
      const alreadyDeactivated = userData.isActive === false;
      const nextCount = alreadyDeactivated ? currentCount : currentCount + 1;
      const deactivatedNow =
        !alreadyDeactivated && nextCount >= SECURITY_VIOLATION_LIMIT;

      const violationPayload = {
        uid,
        studentId: uid,
        reason,
        page,
        details: details || "",
        attemptNumber: nextCount,
        limit: SECURITY_VIOLATION_LIMIT,
        action: alreadyDeactivated
          ? "already_deactivated"
          : deactivatedNow
            ? "account_deactivated"
            : "warning",
        isResolved: false,
        resolvedAt: null,
        resolvedBy: null,
        ip: clientIP || "",
        device: clientDevice || "",
        userAgent: userAgent || "",
        createdAt: serverTimestamp(),
      };

      const userUpdates = {
        securityViolationCount: nextCount,
        securityViolationLimit: SECURITY_VIOLATION_LIMIT,
        lastSecurityViolationReason: reason,
        lastSecurityViolationAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const studentUpdates = {
        securityViolationCount: nextCount,
        lastSecurityViolationReason: reason,
        lastSecurityViolationAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (deactivatedNow || alreadyDeactivated) {
        userUpdates.isActive = false;
        userUpdates.status = "deactivated";
        userUpdates.securityDeactivatedAt =
          userData.securityDeactivatedAt || serverTimestamp();
        userUpdates.securityDeactivationReason = `Security violation limit reached (${SECURITY_VIOLATION_LIMIT}/${SECURITY_VIOLATION_LIMIT})`;

        studentUpdates.approvalStatus = "deactivated";
        studentUpdates.securityDeactivatedAt =
          studentSnap.exists && studentSnap.data()?.securityDeactivatedAt
            ? studentSnap.data().securityDeactivatedAt
            : serverTimestamp();
      }

      transaction.set(violationRef, violationPayload, { merge: true });
      transaction.set(userRef, userUpdates, { merge: true });
      if (studentSnap.exists) {
        transaction.set(studentRef, studentUpdates, { merge: true });
      }

      responseData = {
        violationId: violationRef.id,
        count: nextCount,
        limit: SECURITY_VIOLATION_LIMIT,
        reason,
        page,
        deactivated: Boolean(deactivatedNow || alreadyDeactivated),
        contactAdmin: Boolean(deactivatedNow || alreadyDeactivated),
      };
    });

    await db.collection(COLLECTIONS.AUDIT_LOGS).add({
      uid,
      action: responseData.deactivated
        ? "security_violation_deactivated"
        : "security_violation_warning",
      reason,
      page,
      attempt: responseData.count,
      limit: responseData.limit,
      ip: clientIP || "",
      device: clientDevice || "",
      timestamp: serverTimestamp(),
    });

    if (responseData.deactivated) {
      try {
        const [userSnap, studentSnap] = await Promise.all([
          userRef.get(),
          studentRef.get(),
        ]);
        const userData = userSnap.exists ? userSnap.data() || {} : {};
        const studentData = studentSnap.exists ? studentSnap.data() || {} : {};
        const email = trimText(userData.email);
        const fullName =
          trimText(studentData.fullName) ||
          trimText(userData.fullName) ||
          getNameFromEmail(email);
        if (email) {
          await sendSecurityDeactivationEmail(email, fullName, {
            reason,
            page,
            count: responseData.count,
            limit: responseData.limit,
          });
        }
      } catch (mailError) {
        console.error("reportSecurityViolation email error:", mailError);
      }
    }

    return successResponse(
      res,
      responseData,
      responseData.deactivated
        ? "Account deactivated due to repeated security violations"
        : "Security violation recorded"
    );
  } catch (error) {
    if (String(error?.message || "") === "USER_NOT_FOUND") {
      return errorResponse(res, "User profile not found", 404);
    }
    if (String(error?.message || "") === "NOT_STUDENT") {
      return errorResponse(res, "Only students can report violations", 403);
    }
    console.error("reportSecurityViolation error:", error);
    return errorResponse(res, "Failed to record security violation", 500);
  }
};

export const submitHelpSupportMessage = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const category = trimText(req.body?.category) || "General";
    const subject = trimText(req.body?.subject);
    const message = trimText(req.body?.message);
    if (subject.length < 3) {
      return errorResponse(res, "Subject must be at least 3 characters", 400);
    }
    if (message.length < 10) {
      return errorResponse(res, "Message must be at least 10 characters", 400);
    }

    const [studentSnap, userSnap, settingsSnap] = await Promise.all([
      db.collection(COLLECTIONS.STUDENTS).doc(uid).get(),
      db.collection(COLLECTIONS.USERS).doc(uid).get(),
      db.collection(COLLECTIONS.SETTINGS).doc(SETTINGS_DOC_ID).get(),
    ]);

    const studentData = studentSnap.exists ? studentSnap.data() || {} : {};
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const studentName =
      trimText(req.body?.name) ||
      trimText(studentData.fullName) ||
      trimText(studentData.name) ||
      trimText(userData.fullName) ||
      getNameFromEmail(userData.email || "");
    const studentEmail = trimText(userData.email || req.body?.email);
    if (!isValidEmail(studentEmail)) {
      return errorResponse(res, "Student email is invalid", 400);
    }

    const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};
    const adminEmail =
      normalizeEmailAddress(settings.contact?.email) ||
      normalizeEmailAddress(settings.general?.contactEmail) ||
      normalizeEmailAddress(process.env.SMTP_EMAIL) ||
      normalizeEmailAddress(process.env.EMAIL_FROM);
    if (!isValidEmail(adminEmail)) {
      return errorResponse(res, "Support email is not configured", 500);
    }

    const messageRef = db.collection(COLLECTIONS.SUPPORT_MESSAGES).doc();
    await messageRef.set({
      source: "student",
      userRole: "student",
      userId: uid,
      name: studentName || "Student",
      email: studentEmail,
      category,
      subject,
      message,
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

    await sendStudentHelpSupportEmail(adminEmail, {
      requestSource: "student",
      studentName: studentName || "Student",
      studentEmail,
      category,
      subject,
      message,
    });

    return successResponse(
      res,
      { submitted: true, ticketId: messageRef.id },
      "Help support message sent"
    );
  } catch (error) {
    console.error("submitHelpSupportMessage error:", error);
    return errorResponse(res, "Failed to send support message", 500);
  }
};

export const getStudentSettings = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const [userSnap, studentSnap] = await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(uid).get(),
      db.collection(COLLECTIONS.STUDENTS).doc(uid).get(),
    ]);
    if (!userSnap.exists && !studentSnap.exists) {
      return errorResponse(res, "Student profile not found", 404);
    }

    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const studentData = studentSnap.exists ? studentSnap.data() || {} : {};
    const payload = {
      uid,
      email: trimText(userData.email || studentData.email),
      role: "student",
      fullName:
        trimText(studentData.fullName) ||
        trimText(studentData.name) ||
        trimText(userData.fullName) ||
        getNameFromEmail(userData.email || ""),
      phoneNumber:
        normalizePakistanPhone(
          trimText(studentData.phoneNumber || userData.phoneNumber || studentData.phone)
        ) ||
        trimText(studentData.phoneNumber || userData.phoneNumber || studentData.phone),
      fatherName: trimText(studentData.fatherName),
      fatherPhone:
        normalizePakistanPhone(trimText(studentData.fatherPhone)) ||
        trimText(studentData.fatherPhone),
      fatherOccupation: trimText(studentData.fatherOccupation),
      address: trimText(studentData.address),
      district: trimText(studentData.district),
      domicile: trimText(studentData.domicile),
      caste: trimText(studentData.caste),
      profilePicture: studentData.profilePicture || userData.profilePicture || null,
      createdAt: toIso(studentData.createdAt || userData.createdAt),
      lastLoginAt: toIso(userData.lastLoginAt),
      enrolledCourses: Array.isArray(studentData.enrolledCourses)
        ? studentData.enrolledCourses
        : [],
      certificates: Array.isArray(studentData.certificates) ? studentData.certificates : [],
    };

    return successResponse(res, payload, "Student settings fetched");
  } catch (error) {
    console.error("getStudentSettings error:", error);
    return errorResponse(res, "Failed to fetch student settings", 500);
  }
};

export const updateStudentSettings = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const fullName = trimText(req.body?.fullName);
    const phoneNumberRaw = trimText(req.body?.phoneNumber);
    const phoneNumber = phoneNumberRaw
      ? normalizePakistanPhone(phoneNumberRaw)
      : "";
    const fatherName = trimText(req.body?.fatherName);
    const fatherPhoneRaw = trimText(req.body?.fatherPhone);
    const fatherPhone = fatherPhoneRaw
      ? normalizePakistanPhone(fatherPhoneRaw)
      : "";
    const fatherOccupation = trimText(req.body?.fatherOccupation);
    const address = trimText(req.body?.address);
    const district = trimText(req.body?.district);
    const domicile = trimText(req.body?.domicile);
    const caste = trimText(req.body?.caste);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (fullName.length < 2) {
      return errorResponse(res, "fullName must be at least 2 characters", 400);
    }
    if (fullName.length > 120) {
      return errorResponse(res, "fullName cannot exceed 120 characters", 400);
    }
    if (phoneNumberRaw && !isPakistanPhone(phoneNumber)) {
      return errorResponse(
        res,
        "phoneNumber must be 03001234567 or +923001234567 format",
        400
      );
    }
    if (fatherName.length > 120) {
      return errorResponse(res, "fatherName cannot exceed 120 characters", 400);
    }
    if (fatherPhoneRaw && !isPakistanPhone(fatherPhone)) {
      return errorResponse(
        res,
        "fatherPhone must be 03001234567 or +923001234567 format",
        400
      );
    }
    if (fatherOccupation.length > 120) {
      return errorResponse(res, "fatherOccupation cannot exceed 120 characters", 400);
    }
    if (district.length > 120) {
      return errorResponse(res, "district cannot exceed 120 characters", 400);
    }
    if (domicile.length > 120) {
      return errorResponse(res, "domicile cannot exceed 120 characters", 400);
    }
    if (caste.length > 120) {
      return errorResponse(res, "caste cannot exceed 120 characters", 400);
    }
    if (address.length > 300) {
      return errorResponse(res, "address cannot exceed 300 characters", 400);
    }

    const userRef = db.collection(COLLECTIONS.USERS).doc(uid);
    const studentRef = db.collection(COLLECTIONS.STUDENTS).doc(uid);
    const batch = db.batch();
    batch.set(
      userRef,
      {
        fullName,
        name: fullName,
        phoneNumber: phoneNumber || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    batch.set(
      studentRef,
      {
        uid,
        email: trimText(req.user?.email),
        fullName,
        name: fullName,
        phoneNumber: phoneNumber || "",
        phone: phoneNumber || "",
        fatherName: fatherName || "",
        fatherPhone: fatherPhone || "",
        fatherOccupation: fatherOccupation || "",
        address: address || "",
        district: district || "",
        domicile: domicile || "",
        caste: caste || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();

    try {
      await auth.updateUser(uid, { displayName: fullName });
    } catch (authError) {
      console.error("updateStudentSettings auth.updateUser error:", authError?.message || authError);
    }

    const [updatedUserSnap, updatedStudentSnap] = await Promise.all([
      userRef.get(),
      studentRef.get(),
    ]);
    const userData = updatedUserSnap.exists ? updatedUserSnap.data() || {} : {};
    const studentData = updatedStudentSnap.exists ? updatedStudentSnap.data() || {} : {};

    return successResponse(
      res,
      {
        uid,
        fullName:
          trimText(studentData.fullName) ||
          trimText(userData.fullName) ||
          fullName,
        phoneNumber:
          normalizePakistanPhone(
            trimText(studentData.phoneNumber || userData.phoneNumber || "")
          ) || trimText(studentData.phoneNumber || userData.phoneNumber || ""),
        email: trimText(userData.email || studentData.email),
        fatherName: trimText(studentData.fatherName),
        fatherPhone:
          normalizePakistanPhone(trimText(studentData.fatherPhone)) ||
          trimText(studentData.fatherPhone),
        fatherOccupation: trimText(studentData.fatherOccupation),
        address: trimText(studentData.address),
        district: trimText(studentData.district),
        domicile: trimText(studentData.domicile),
        caste: trimText(studentData.caste),
      },
      "Student settings updated"
    );
  } catch (error) {
    console.error("updateStudentSettings error:", error);
    return errorResponse(res, "Failed to update student settings", 500);
  }
};

