import * as adminService from "../services/admin.service.js";
import { db, admin } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";
import {
  isPakistanPhone,
  normalizePakistanPhone,
} from "../utils/phone.utils.js";
import {
  sendRegistrationOTP,
  sendApprovalEmail,
  sendRejectionEmail,
} from "../services/email.service.js";
import { v4 as uuidv4 } from "uuid";
import { deleteFile } from "../services/storage.service.js";

const normalizeSubjectName = (value = "") => String(value).trim();
const STUDENT_BULK_HEADERS = ["name", "email", "password", "phone", "address"];

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePaymentState = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase();

const ACTIVE_PROMO_USAGE_STATES = new Set([
  "pending",
  "pending_verification",
  "paid",
]);
const ANNOUNCEMENT_ELIGIBLE_ENROLLMENT_STATES = new Set([
  "",
  "active",
  "upcoming",
  "completed",
  "pending_review",
]);

const parseCsvLine = (line = "") => {
  const row = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }
    if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  row.push(current);
  return row.map((cell) => String(cell || "").trim());
};

const parseCsvWithHeader = (csvText = "") => {
  const lines = String(csvText || "").split(/\r?\n/);
  if (!lines.length) return { headers: [], rows: [] };

  let headers = [];
  let headerSet = false;
  const rows = [];

  lines.forEach((line, lineIndex) => {
    const lineNo = lineIndex + 1;
    const trimmed = String(line || "").trim();
    if (!trimmed) return;
    if (trimmed.startsWith("#")) return;

    if (!headerSet) {
      headers = parseCsvLine(line).map((header) =>
        String(header || "").trim().toLowerCase()
      );
      headerSet = true;
      return;
    }

    const values = parseCsvLine(line);
    const row = { __row: lineNo };
    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] || "";
    });

    const hasAnyData = headers.some((header) => String(row[header] || "").trim());
    if (hasAnyData) rows.push(row);
  });

  return { headers, rows };
};

const csvEscapeCell = (value = "") => {
  const raw = String(value ?? "");
  if (!/[",\r\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
};

const buildCsv = (rows = []) =>
  rows.map((row) => row.map((cell) => csvEscapeCell(cell)).join(",")).join("\n");

const countActivePromoUsages = async ({ promoCodeId = "", code = "" }) => {
  const cleanPromoCodeId = String(promoCodeId || "").trim();
  const normalizedCode = String(code || "")
    .trim()
    .toUpperCase();
  const docsById = new Map();

  if (cleanPromoCodeId) {
    const byPromoIdSnap = await db
      .collection(COLLECTIONS.PAYMENTS)
      .where("promoCodeId", "==", cleanPromoCodeId)
      .get();
    byPromoIdSnap.docs.forEach((doc) => docsById.set(doc.id, doc));
  }

  if (normalizedCode) {
    const byCodeSnap = await db
      .collection(COLLECTIONS.PAYMENTS)
      .where("promoCode", "==", normalizedCode)
      .get();
    byCodeSnap.docs.forEach((doc) => docsById.set(doc.id, doc));
  }

  let count = 0;
  docsById.forEach((doc) => {
    const payment = doc.data() || {};
    const status = normalizePaymentState(payment.status);
    if (ACTIVE_PROMO_USAGE_STATES.has(status)) {
      count += 1;
    }
  });

  return count;
};

const parsePromoExpiryDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();

  const raw = String(value).trim();
  if (!raw) return null;

  // Date-only inputs should remain valid for the entire selected day.
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  // Backward compatibility for old promo docs saved at midnight UTC.
  if (/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/i.test(raw)) {
    const year = parsed.getUTCFullYear();
    const month = parsed.getUTCMonth();
    const day = parsed.getUTCDate();
    return new Date(year, month, day, 23, 59, 59, 999);
  }

  return parsed;
};

const isPromoExpired = (value) => {
  const expiryDate = parsePromoExpiryDate(value);
  if (!expiryDate) return false;
  return expiryDate.getTime() < Date.now();
};

const parseNullableBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    if (clean === "true") return true;
    if (clean === "false") return false;
  }
  return null;
};

const getCourseAnnouncementRecipientIds = async (courseId = "") => {
  const cleanCourseId = String(courseId || "").trim();
  if (!cleanCourseId) return [];

  const snap = await db
    .collection(COLLECTIONS.ENROLLMENTS)
    .where("courseId", "==", cleanCourseId)
    .get();

  return [
    ...new Set(
      snap.docs
        .map((doc) => doc.data() || {})
        .filter((row) =>
          ANNOUNCEMENT_ELIGIBLE_ENROLLMENT_STATES.has(
            normalizePaymentState(row.status || "active")
          )
        )
        .map((row) => String(row.studentId || "").trim())
        .filter(Boolean)
    ),
  ];
};

const createCourseStudentAnnouncement = async ({
  title = "",
  message = "",
  courseId = "",
  courseName = "",
  postedBy = "",
  postedByName = "Admin",
  postedByRole = "admin",
}) => {
  const cleanCourseId = String(courseId || "").trim();
  const cleanTitle = String(title || "").trim();
  const cleanMessage = String(message || "").trim();
  if (!cleanCourseId || !cleanTitle || !cleanMessage) return;

  const recipientIds = await getCourseAnnouncementRecipientIds(cleanCourseId);
  if (recipientIds.length < 1) return;

  await db.collection(COLLECTIONS.ANNOUNCEMENTS).add({
    title: cleanTitle,
    message: cleanMessage,
    targetType: "course",
    targetId: cleanCourseId,
    targetName: String(courseName || "").trim() || "Course",
    audienceRole: "student",
    postedBy: String(postedBy || "").trim(),
    postedByName: String(postedByName || "").trim() || "Admin",
    postedByRole: String(postedByRole || "").trim() || "admin",
    sendEmail: false,
    isPinned: false,
    studentsReached: recipientIds.length,
    recipientIds,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

const normalizeBulkPhone = (value = "") => normalizePakistanPhone(value);

const normalizeTeacherEntry = async (entry = {}) => {
  const teacherId = String(entry?.teacherId || entry?.id || entry?.uid || "").trim();
  if (!teacherId) return null;
  let teacherName = String(entry?.teacherName || entry?.name || "").trim();
  if (!teacherName) {
    const teacherSnap = await db
      .collection(COLLECTIONS.TEACHERS)
      .doc(teacherId)
      .get();
    teacherName = teacherSnap.exists
      ? String(teacherSnap.data()?.fullName || "").trim()
      : "";
  }
  return {
    teacherId,
    teacherName: teacherName || "Teacher",
  };
};

const normalizeTeachers = async (input = [], fallback = {}) => {
  const raw = Array.isArray(input) ? input : [];
  const normalized = [];
  for (const row of raw) {
    const mapped = await normalizeTeacherEntry(row);
    if (mapped) normalized.push(mapped);
  }

  if (!normalized.length) {
    const fallbackEntry = await normalizeTeacherEntry(fallback);
    if (fallbackEntry) normalized.push(fallbackEntry);
  }

  const seen = new Set();
  const deduped = normalized.filter((row) => {
    if (!row.teacherId || seen.has(row.teacherId)) return false;
    seen.add(row.teacherId);
    return true;
  });

  return deduped;
};

const subjectHasTeacher = (subject = {}, teacherId = "") => {
  const cleanId = String(teacherId || "").trim();
  if (!cleanId) return false;
  if (String(subject?.teacherId || "").trim() === cleanId) return true;
  const teacherIds = Array.isArray(subject?.teacherIds) ? subject.teacherIds : [];
  if (teacherIds.some((id) => String(id || "").trim() === cleanId)) return true;
  const teachers = Array.isArray(subject?.teachers) ? subject.teachers : [];
  return teachers.some(
    (row) =>
      String(row?.teacherId || row?.id || row?.uid || "").trim() === cleanId
  );
};

const buildCourseSubjects = async (subjects = []) => {
  if (!Array.isArray(subjects)) return [];

  const mapped = await Promise.all(
    subjects.map(async (subject, index) => {
      const subjectName = normalizeSubjectName(subject?.name || "");
      const teachers = await normalizeTeachers(
        subject?.teachers || subject?.teacherIds || [],
        {
          teacherId: subject?.teacherId,
          teacherName: subject?.teacherName,
        }
      );
      const primaryTeacher = teachers[0] || {};

      return {
        id: String(subject?.id || uuidv4()),
        name: subjectName,
        teacherId: String(primaryTeacher.teacherId || "").trim(),
        teacherName: String(primaryTeacher.teacherName || "").trim(),
        teachers,
        teacherIds: teachers.map((row) => row.teacherId),
        order: Number(subject?.order || index + 1),
      };
    })
  );

  return mapped.filter((subject) => subject.name && subject.teacherId);
};

const courseIdMatches = (item, courseId) =>
  item === courseId || item?.courseId === courseId;

const subjectIdMatches = (item, subjectId) =>
  item === subjectId || item?.subjectId === subjectId;

const hasCourseLinks = async (courseId) => {
  const [classesSnap, teachersSnap, studentsByCourseSnap, studentsBySubjectSnap, quizzesByCourseSnap, quizzesBySubjectSnap] =
    await Promise.all([
      db.collection(COLLECTIONS.CLASSES).get(),
      db.collection(COLLECTIONS.TEACHERS).get(),
      db
        .collection(COLLECTIONS.STUDENTS)
        .where("enrolledCourses", "array-contains", courseId)
        .limit(1)
        .get(),
      db
        .collection(COLLECTIONS.STUDENTS)
        .where("enrolledSubjects", "array-contains", courseId)
        .limit(1)
        .get(),
      db.collection("quizzes").where("courseId", "==", courseId).limit(1).get(),
      db.collection("quizzes").where("subjectId", "==", courseId).limit(1).get(),
    ]);

  const classLinked = classesSnap.docs.some((doc) => {
    const data = doc.data() || {};
    const assignedSubjects = Array.isArray(data.assignedSubjects)
      ? data.assignedSubjects
      : [];
    const assignedCourses = Array.isArray(data.assignedCourses)
      ? data.assignedCourses
      : [];
    const shifts = Array.isArray(data.shifts) ? data.shifts : [];
    return (
      assignedSubjects.some((subject) => subjectIdMatches(subject, courseId)) ||
      assignedCourses.some((course) => courseIdMatches(course, courseId)) ||
      shifts.some(
        (shift) =>
          courseIdMatches(shift?.courseId, courseId) ||
          subjectIdMatches(shift?.subjectId, courseId)
      )
    );
  });

  const teacherLinked = teachersSnap.docs.some((doc) => {
    const data = doc.data() || {};
    const assignedCourses = Array.isArray(data.assignedCourses)
      ? data.assignedCourses
      : [];
    return assignedCourses.some((course) => courseIdMatches(course, courseId));
  });

  const studentLinked = !studentsByCourseSnap.empty || !studentsBySubjectSnap.empty;
  const quizLinked = !quizzesByCourseSnap.empty || !quizzesBySubjectSnap.empty;

  return classLinked || teacherLinked || studentLinked || quizLinked;
};

const hasSubjectLinks = async (courseId, subjectId) => {
  const courseRef = db.collection(COLLECTIONS.COURSES).doc(courseId);
  const [contentSnap, quizSnap] = await Promise.all([
    courseRef
      .collection("content")
      .where("subjectId", "==", subjectId)
      .limit(1)
      .get(),
    db
      .collection("quizzes")
      .where("courseId", "==", courseId)
      .where("subjectId", "==", subjectId)
      .limit(1)
      .get(),
  ]);

  return !contentSnap.empty || !quizSnap.empty;
};

const hasTeacherLinks = async (teacherId) => {
  const [teacherSnap, classesSnap, coursesSnap] = await Promise.all([
    db.collection(COLLECTIONS.TEACHERS).doc(teacherId).get(),
    db.collection(COLLECTIONS.CLASSES).get(),
    db.collection(COLLECTIONS.COURSES).get(),
  ]);

  const toRefId = (value, key) => {
    if (typeof value === "string") return value.trim();
    if (!value || typeof value !== "object") return "";
    if (key && value[key]) return String(value[key]).trim();
    if (value.id) return String(value.id).trim();
    return "";
  };

  const teacherData = teacherSnap.exists ? teacherSnap.data() || {} : {};
  const assignedCourses = Array.isArray(teacherData.assignedCourses)
    ? teacherData.assignedCourses
    : [];
  const assignedClasses = Array.isArray(teacherData.assignedClasses)
    ? teacherData.assignedClasses
    : [];
  const assignedSubjects = Array.isArray(teacherData.assignedSubjects)
    ? teacherData.assignedSubjects
    : [];

  const existingCourseIds = new Set(
    coursesSnap.docs.map((doc) => String(doc.id || "").trim()).filter(Boolean)
  );
  const existingClassIds = new Set(
    classesSnap.docs.map((doc) => String(doc.id || "").trim()).filter(Boolean)
  );

  const validAssignedCourses = assignedCourses.filter((course) =>
    existingCourseIds.has(toRefId(course, "courseId"))
  );
  const validAssignedClasses = assignedClasses.filter((classItem) =>
    existingClassIds.has(toRefId(classItem, "classId"))
  );

  const validAssignedSubjects = assignedSubjects.filter((subjectItem) => {
    const subjectId = toRefId(subjectItem, "subjectId");
    if (!subjectId) return false;
    return coursesSnap.docs.some((doc) => {
      const subjects = Array.isArray(doc.data()?.subjects) ? doc.data().subjects : [];
      return subjects.some(
        (subject) =>
          String(subject?.id || "").trim() === subjectId &&
          subjectHasTeacher(subject, teacherId)
      );
    });
  });

  const needsCleanup =
    validAssignedCourses.length !== assignedCourses.length ||
    validAssignedClasses.length !== assignedClasses.length ||
    validAssignedSubjects.length !== assignedSubjects.length;

  if (needsCleanup && teacherSnap.exists) {
    await db.collection(COLLECTIONS.TEACHERS).doc(teacherId).set(
      {
        assignedCourses: validAssignedCourses,
        assignedClasses: validAssignedClasses,
        assignedSubjects: validAssignedSubjects,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  if (
    validAssignedCourses.length ||
    validAssignedClasses.length ||
    validAssignedSubjects.length
  ) {
    return true;
  }

  const classLinked = classesSnap.docs.some((doc) => {
    const data = doc.data() || {};
    const teachers = Array.isArray(data.teachers) ? data.teachers : [];
    const shifts = Array.isArray(data.shifts) ? data.shifts : [];
    const directTeacherId = String(data.teacherId || "").trim();
    return (
      directTeacherId === teacherId ||
      teachers.some((entry) => toRefId(entry, "teacherId") === teacherId) ||
      shifts.some((shift) => String(shift?.teacherId || "").trim() === teacherId)
    );
  });
  if (classLinked) return true;

  const courseLinked = coursesSnap.docs.some((doc) => {
    const data = doc.data() || {};
    const directTeacherId = String(data.teacherId || "").trim();
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];
    return (
      directTeacherId === teacherId ||
      subjects.some((subject) => subjectHasTeacher(subject, teacherId))
    );
  });

  return courseLinked;
};

const CLASS_STATUSES = new Set(["upcoming", "active", "completed", "expired", "full"]);
const VIDEO_LIBRARY_COLLECTION = COLLECTIONS.VIDEOS || "videos";
const PERMANENT_COMPLETION_MESSAGE =
  "This class or subject is completed. Your certificate is generated. Thank you for joining us. Keep exploring our other subjects and classes. Thank you.";
const SHIFT_NAME_OPTIONS = new Set([
  "Morning",
  "Evening",
  "Night",
  "Weekend",
  "Custom",
]);
const FULL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const DAY_ALIASES = {
  mon: "Monday",
  monday: "Monday",
  tue: "Tuesday",
  tues: "Tuesday",
  tuesday: "Tuesday",
  wed: "Wednesday",
  wednesday: "Wednesday",
  thu: "Thursday",
  thur: "Thursday",
  thurs: "Thursday",
  thursday: "Thursday",
  fri: "Friday",
  friday: "Friday",
  sat: "Saturday",
  saturday: "Saturday",
  sun: "Sunday",
  sunday: "Sunday",
};

const normalizeDateValue = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isMarkedCompletedState = (row = {}) => {
  const normalizedStatus = String(
    row?.status || row?.lifecycleStatus || row?.state || ""
  )
    .trim()
    .toLowerCase();
  if (["completed", "permanently_completed", "closed"].includes(normalizedStatus)) {
    return true;
  }
  return (
    row?.isCompleted === true ||
    row?.completed === true ||
    row?.permanentlyCompleted === true ||
    row?.completionLocked === true ||
    row?.lockedAfterCompletion === true ||
    row?.isLockedAfterCompletion === true
  );
};

const getClassLifecycleStatus = (classData = {}, enrolledCount = 0, capacity = 30) => {
  const cappedCapacity = Math.max(1, Number(capacity || classData?.capacity || 30));
  const explicitStatus = String(classData?.status || "").trim().toLowerCase();
  if (
    ["completed", "permanently_completed", "closed"].includes(explicitStatus) ||
    isMarkedCompletedState(classData)
  ) {
    return "completed";
  }
  const start = normalizeDateValue(classData?.startDate);
  const end = normalizeDateValue(classData?.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (end) {
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    if (today.getTime() > endDay.getTime()) return "expired";
  }

  if (Number(enrolledCount || 0) >= cappedCapacity) return "full";

  if (start) {
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    if (today.getTime() < startDay.getTime()) return "upcoming";
  }

  return "active";
};

const getEnrollmentStatusFromClassDates = (classData = {}) => {
  const status = getClassLifecycleStatus(
    classData,
    Array.isArray(classData?.students) ? classData.students.length : Number(classData?.enrolledCount || 0),
    Number(classData?.capacity || 30)
  );
  if (status === "upcoming") return "upcoming";
  if (status === "active" || status === "full") return "active";
  return "completed";
};

const mergeEnrollmentStatus = (currentStatus = "", nextStatus = "") => {
  const current = String(currentStatus || "").trim().toLowerCase();
  const next = String(nextStatus || "").trim().toLowerCase();
  if (current === "active" || next === "active") return "active";
  if (current === "upcoming" || next === "upcoming") return "upcoming";
  if (next) return next;
  return current || "active";
};

const normalizeStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!CLASS_STATUSES.has(normalized)) return "upcoming";
  if (normalized === "expired" || normalized === "full") return "active";
  return normalized;
};

const normalizeShiftName = (value = "") => {
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (SHIFT_NAME_OPTIONS.has(trimmed)) return trimmed;
  return trimmed;
};

const normalizeDays = (days = []) => {
  if (!Array.isArray(days)) return [];
  const seen = new Set();
  const normalized = [];

  days.forEach((day) => {
    const key = String(day || "").trim().toLowerCase();
    const resolved = DAY_ALIASES[key];
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
      normalized.push(resolved);
    }
  });

  return normalized;
};

const isValidTime = (value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ""));

const isStartBeforeEnd = (start, end) => {
  if (!isValidTime(start) || !isValidTime(end)) return false;
  const [sh, sm] = String(start).split(":").map(Number);
  const [eh, em] = String(end).split(":").map(Number);
  return sh * 60 + sm < eh * 60 + em;
};

const toTimeMinutes = (value) => {
  if (!isValidTime(value)) return null;
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
};

const isSameCalendarDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const validateShiftStartWindowForToday = (classStartDate, shiftStartTime) => {
  const parsedStartDate = normalizeDateValue(classStartDate);
  if (!parsedStartDate) return null;

  const now = new Date();
  if (!isSameCalendarDay(parsedStartDate, now)) return null;

  const shiftStartMinutes = toTimeMinutes(shiftStartTime);
  if (shiftStartMinutes === null) return null;

  const minAllowedMinutes = now.getHours() * 60 + now.getMinutes();
  if (shiftStartMinutes < minAllowedMinutes) {
    return "For classes starting today, shift start time cannot be in the past";
  }

  return null;
};

const generateBatchCode = (name = "CLS") => {
  const prefix = String(name)
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 4);
  return `${prefix || "CLS"}-${Date.now().toString().slice(-5)}`;
};

const validateClassDates = (startDate, endDate, checkFutureStart = true) => {
  const start = normalizeDateValue(startDate);
  const end = normalizeDateValue(endDate);
  if (!start) return "Start date is required";
  if (!end) return "End date is required";

  if (checkFutureStart) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startFloor = new Date(start);
    startFloor.setHours(0, 0, 0, 0);
    if (startFloor < today) {
      return "Start date cannot be in the past";
    }
  }

  if (end <= start) {
    return "End date must be after start date";
  }

  return null;
};

const getCourseMeta = async (courseId) => {
  const cleanCourseId = String(courseId || "").trim();
  if (!cleanCourseId) return null;

  const [subjectSnap, courseSnap] = await Promise.all([
    db.collection(COLLECTIONS.SUBJECTS).doc(cleanCourseId).get(),
    db.collection(COLLECTIONS.COURSES).doc(cleanCourseId).get(),
  ]);
  const snap = subjectSnap.exists ? subjectSnap : courseSnap;
  if (!snap.exists) return null;

  const row = snap.data() || {};
  const legacySubjects = Array.isArray(row.subjects) ? row.subjects : [];
  const subjectName =
    String(row.subjectName || "").trim() ||
    String(legacySubjects?.[0]?.name || "").trim() ||
    String(row.title || row.courseName || "").trim();
  const teacherId =
    String(row.teacherId || "").trim() ||
    String(legacySubjects?.[0]?.teacherId || "").trim();
  const teacherName =
    String(row.teacherName || "").trim() ||
    String(legacySubjects?.[0]?.teacherName || "").trim() ||
    "Teacher";
  const price = Math.max(0, toSafeNumber(row.price, 0));
  const discountPercent = Math.max(
    0,
    Math.min(100, toSafeNumber(row.discountPercent ?? row.discount, 0))
  );
  const finalPrice = Math.max(
    Number((price - (price * discountPercent) / 100).toFixed(2)),
    0
  );

  return {
    subjectId: cleanCourseId,
    subjectName: subjectName || "Subject",
    courseId: cleanCourseId,
    courseName:
      String(row.title || row.courseName || row.name || "").trim() || "Subject",
    teacherId,
    teacherName,
    subjectsCount: 1,
    price,
    discountPercent,
    finalPrice,
    thumbnail: row.thumbnail || null,
  };
};

const getSubjectCompletionState = async (courseId = "") => {
  const cleanCourseId = String(courseId || "").trim();
  if (!cleanCourseId) {
    return {
      locked: false,
      subjectCompleted: false,
      classCompleted: false,
      message: "",
    };
  }

  const [subjectSnap, courseSnap, classesSnap] = await Promise.all([
    db.collection(COLLECTIONS.SUBJECTS).doc(cleanCourseId).get(),
    db.collection(COLLECTIONS.COURSES).doc(cleanCourseId).get(),
    db.collection(COLLECTIONS.CLASSES).get(),
  ]);

  const subjectData = subjectSnap.exists
    ? subjectSnap.data() || {}
    : courseSnap.exists
      ? courseSnap.data() || {}
      : {};
  const subjectCompleted = isMarkedCompletedState(subjectData);
  const classCompleted = classesSnap.docs.some((doc) => {
    const classData = doc.data() || {};
    if (!isMarkedCompletedState(classData)) return false;
    const assignedIds = getClassAssignedCourseIds(classData);
    return assignedIds.includes(cleanCourseId);
  });

  const locked = subjectCompleted || classCompleted;
  return {
    locked,
    subjectCompleted,
    classCompleted,
    message: locked ? PERMANENT_COMPLETION_MESSAGE : "",
  };
};

const buildAssignedCourses = async (input = []) => {
  if (!Array.isArray(input)) return [];
  const uniqueIds = [];
  const seen = new Set();

  input.forEach((item) => {
    const courseId =
      typeof item === "string"
        ? item
        : String(item?.courseId || item?.subjectId || item?.id || "").trim();
    if (courseId && !seen.has(courseId)) {
      seen.add(courseId);
      uniqueIds.push(courseId);
    }
  });

  const resolved = [];
  for (const courseId of uniqueIds) {
    const meta = await getCourseMeta(courseId);
    if (meta) resolved.push(meta);
  }

  return resolved;
};

const calculateClassPriceFromCourseIds = async (courseIds = []) => {
  const uniqueCourseIds = [...new Set((Array.isArray(courseIds) ? courseIds : []).filter(Boolean))];
  if (uniqueCourseIds.length < 1) {
    return {
      totalPrice: 0,
      coursesCount: 0,
    };
  }

  const courseSnaps = await Promise.all(
    uniqueCourseIds.map(async (courseId) => {
      const cleanCourseId = String(courseId).trim();
      const [subjectSnap, courseSnap] = await Promise.all([
        db.collection(COLLECTIONS.SUBJECTS).doc(cleanCourseId).get(),
        db.collection(COLLECTIONS.COURSES).doc(cleanCourseId).get(),
      ]);
      return subjectSnap.exists ? subjectSnap : courseSnap;
    })
  );

  let totalPrice = 0;
  courseSnaps.forEach((snap) => {
    if (!snap.exists) return;
    const row = snap.data() || {};
    const price = Math.max(0, toSafeNumber(row.price, 0));
    const discountPercent = Math.max(
      0,
      Math.min(100, toSafeNumber(row.discountPercent, 0))
    );
    const finalPrice = Math.max(
      Number((price - (price * discountPercent) / 100).toFixed(2)),
      0
    );
    totalPrice += finalPrice;
  });

  return {
    totalPrice: Math.round(totalPrice),
    coursesCount: uniqueCourseIds.length,
  };
};

export const calculateClassPrice = async (classId) => {
  const cleanClassId = String(classId || "").trim();
  if (!cleanClassId) return 0;

  const classRef = db.collection(COLLECTIONS.CLASSES).doc(cleanClassId);
  const classSnap = await classRef.get();
  if (!classSnap.exists) return 0;

  const classData = classSnap.data() || {};
  const resolvedPrice = Math.max(
    0,
    toSafeNumber(classData.price ?? classData.totalPrice, 0)
  );

  await classRef.set(
    {
      price: resolvedPrice,
      totalPrice: resolvedPrice,
      priceUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return resolvedPrice;
};

const recalculateClassPricesByCourse = async (courseId) => {
  const cleanCourseId = String(courseId || "").trim();
  if (!cleanCourseId) return;

  const classSnap = await db.collection(COLLECTIONS.CLASSES).get();
  const impactedClassIds = classSnap.docs
    .filter((doc) => {
      const classData = doc.data() || {};
      const assignedSubjects = Array.isArray(classData.assignedSubjects)
        ? classData.assignedSubjects
        : [];
      const assignedCourses = Array.isArray(classData.assignedCourses)
        ? classData.assignedCourses
        : [];
      return [...assignedSubjects, ...assignedCourses].some((entry) => {
        const assignedId =
          typeof entry === "string"
            ? String(entry || "").trim()
            : String(entry?.subjectId || entry?.courseId || entry?.id || "").trim();
        return assignedId === cleanCourseId;
      });
    })
    .map((doc) => doc.id);

  for (const classId of impactedClassIds) {
    await calculateClassPrice(classId);
  }
};

const ensureTeacher = async (teacherId) => {
  const [teacherSnap, userSnap] = await Promise.all([
    db.collection(COLLECTIONS.TEACHERS).doc(teacherId).get(),
    db.collection(COLLECTIONS.USERS).doc(teacherId).get(),
  ]);

  if (!teacherSnap.exists || !userSnap.exists) {
    return { error: "Shift teacher not found" };
  }

  const userData = userSnap.data() || {};
  if (userData.role !== "teacher") {
    return { error: "Shift teacher not found" };
  }
  if (userData.isActive === false) {
    return { error: "Selected teacher is inactive. Activate teacher first." };
  }

  return {
    teacherId,
    teacherName: teacherSnap.data()?.fullName || "",
  };
};

const buildShiftPayload = async (shiftInput, assignedCourses, classStartDate = null) => {
  const name = normalizeShiftName(shiftInput?.name);
  const days = normalizeDays(shiftInput?.days || []);
  const startTime = String(shiftInput?.startTime || "").trim();
  const endTime = String(shiftInput?.endTime || "").trim();
  const courseId = String(shiftInput?.subjectId || shiftInput?.courseId || "").trim();
  const inputTeacherId = String(shiftInput?.teacherId || "").trim();
  const room = String(shiftInput?.room || "").trim();

  if (!name) {
    return { error: "Shift name is required" };
  }
  if (days.length < 1) {
    return { error: "Shift days are required" };
  }
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return { error: "Shift start and end time must be valid" };
  }
  if (!isStartBeforeEnd(startTime, endTime)) {
    return { error: "Shift start time must be before end time" };
  }
  const startWindowError = validateShiftStartWindowForToday(classStartDate, startTime);
  if (startWindowError) {
    return { error: startWindowError };
  }
  if (!courseId) {
    return { error: "Shift course is required" };
  }

  const courseMeta = assignedCourses.find((course) => course.courseId === courseId);
  if (!courseMeta) {
    return { error: "Shift course must be assigned to class first" };
  }

  const teacherId = String(courseMeta?.teacherId || inputTeacherId).trim();
  if (!teacherId) {
    return { error: "Shift teacher is required" };
  }

  const teacherMeta = await ensureTeacher(teacherId);
  if (teacherMeta?.error) {
    return { error: teacherMeta.error };
  }

  return {
    data: {
      id: String(shiftInput?.id || uuidv4()),
      name,
      days,
      startTime,
      endTime,
      teacherId: teacherMeta.teacherId,
      teacherName: teacherMeta.teacherName,
      subjectId: courseMeta.courseId,
      courseId: courseMeta.courseId,
      subjectName: courseMeta.courseName || "",
      courseName: courseMeta.courseName || "",
      room,
    },
  };
};

const collectTeachersFromShifts = (shifts = []) => {
  const seen = new Set();
  return shifts
    .filter((shift) => shift.teacherId)
    .map((shift) => ({
      teacherId: shift.teacherId,
      teacherName: shift.teacherName || "",
    }))
    .filter((item) => {
      if (seen.has(item.teacherId)) return false;
      seen.add(item.teacherId);
      return true;
    });
};

const getMissingShiftCourseNames = (assignedCourses = [], shifts = []) => {
  const normalizedCourses = (Array.isArray(assignedCourses) ? assignedCourses : [])
    .map((entry) => {
      if (typeof entry === "string") {
        const courseId = String(entry || "").trim();
        return courseId ? { courseId, courseName: courseId } : null;
      }
      const courseId = String(entry?.courseId || entry?.id || "").trim();
      if (!courseId) return null;
      return {
        courseId,
        courseName: String(entry?.courseName || entry?.title || "").trim() || courseId,
      };
    })
    .filter(Boolean);

  const shiftCourseIds = new Set(
    (Array.isArray(shifts) ? shifts : [])
      .map((shift) => String(shift?.subjectId || shift?.courseId || "").trim())
      .filter(Boolean)
  );

  return normalizedCourses
    .filter((course) => !shiftCourseIds.has(course.courseId))
    .map((course) => course.courseName);
};

export const getDashboardStats = async (req, res) => {
  try {
    const stats = await adminService.getDashboardStats();
    return successResponse(res, stats, "Stats fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch stats", 500);
  }
};

export const getRevenueChart = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const data = await adminService.getRevenueChart(days);
    return successResponse(res, data, "Revenue chart fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch revenue", 500);
  }
};

export const getRecentEnrollments = async (req, res) => {
  try {
    const data = await adminService.getRecentEnrollments(8);
    return successResponse(res, data, "Enrollments fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch enrollments", 500);
  }
};

export const getTopCourses = async (req, res) => {
  try {
    const data = await adminService.getTopCourses(5);
    return successResponse(res, data, "Top courses fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch courses", 500);
  }
};

export const getTopClasses = async (req, res) => {
  try {
    const data = await adminService.getTopClasses(5);
    return successResponse(res, data, "Top classes fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch classes", 500);
  }
};

export const getClassPerformance = async (req, res) => {
  try {
    const data = await adminService.getClassPerformance();
    return successResponse(res, data, "Class performance fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch class performance", 500);
  }
};

export const getRecentActivity = async (req, res) => {
  try {
    const data = await adminService.getRecentActivity(10);
    return successResponse(res, data, "Activity fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch activity", 500);
  }
};

const resolveUidParam = (req) =>
  String(req.params?.uid || req.params?.id || "").trim();

const toIsoOrNull = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    const parsed = value.toDate();
    return Number.isNaN(parsed?.getTime?.()) ? null : parsed.toISOString();
  }
  if (typeof value?._seconds === "number") {
    return new Date(value._seconds * 1000).toISOString();
  }
  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000).toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const normalizeVideoLibraryRow = (id, row = {}) => ({
  id,
  title: String(row.title || "").trim() || "Untitled Video",
  url: String(row.url || "").trim(),
  hlsUrl: String(row.hlsUrl || "").trim(),
  courseId: String(row.courseId || "").trim(),
  subjectId: String(row.subjectId || row.courseId || "").trim(),
  courseName: String(row.courseName || row.subjectName || "").trim(),
  subjectName: String(row.subjectName || row.courseName || "").trim(),
  teacherId: String(row.teacherId || "").trim(),
  teacherName: String(row.teacherName || "").trim() || "Teacher",
  videoMode:
    String(row.videoMode || "").trim().toLowerCase() === "live_session"
      ? "live_session"
      : "recorded",
  isLiveSession: Boolean(row.isLiveSession),
  // Single source of truth: durationSec. We compute a human label for clients.
  durationSec: Math.max(0, toSafeNumber(row.durationSec ?? row.videoDurationSec ?? row.totalDurationSec, 0)),
  videoDuration: (() => {
    const seconds = Math.max(0, toSafeNumber(row.durationSec ?? row.videoDurationSec ?? row.totalDurationSec, 0));
    if (!seconds) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  })(),
  isActive: row.isActive !== false,
  createdAt: toIsoOrNull(row.createdAt),
  updatedAt: toIsoOrNull(row.updatedAt),
});

const normalizeProgressPercent = (row = {}) => {
  const direct = [
    row.progress,
    row.progressPercent,
    row.completionPercent,
    row.percent,
  ]
    .map((value) => Number(value))
    .find((value) => Number.isFinite(value));
  if (Number.isFinite(direct)) {
    return Math.max(0, Math.min(100, direct));
  }
  return null;
};

export const getUserById = async (req, res) => {
  try {
    const uid = resolveUidParam(req);
    if (!uid) return errorResponse(res, "uid is required", 400);

    const userSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    if (!userSnap.exists) {
      return errorResponse(res, "User not found", 404);
    }

    const userData = userSnap.data() || {};
    return successResponse(
      res,
      {
        uid,
        ...userData,
        createdAt: toIsoOrNull(userData.createdAt),
        updatedAt: toIsoOrNull(userData.updatedAt),
        lastLoginAt: toIsoOrNull(userData.lastLoginAt),
      },
      "User fetched"
    );
  } catch (e) {
    return errorResponse(res, "Failed to fetch user", 500);
  }
};

export const getTeacherById = async (req, res) => {
  try {
    const uid = resolveUidParam(req);
    if (!uid) return errorResponse(res, "uid is required", 400);

    const [userSnap, teacherSnap] = await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(uid).get(),
      db.collection(COLLECTIONS.TEACHERS).doc(uid).get(),
    ]);

    if (!userSnap.exists || !teacherSnap.exists) {
      return errorResponse(res, "Teacher not found", 404);
    }

    const userData = userSnap.data() || {};
    if (String(userData.role || "").toLowerCase() !== "teacher") {
      return errorResponse(res, "Teacher not found", 404);
    }

    const teacherData = teacherSnap.data() || {};
    return successResponse(
      res,
      {
        uid,
        ...userData,
        ...teacherData,
        createdAt: toIsoOrNull(teacherData.createdAt || userData.createdAt),
        updatedAt: toIsoOrNull(teacherData.updatedAt || userData.updatedAt),
        lastLoginAt: toIsoOrNull(userData.lastLoginAt),
      },
      "Teacher fetched"
    );
  } catch (e) {
    return errorResponse(res, "Failed to fetch teacher", 500);
  }
};

export const getStudentById = async (req, res) => {
  try {
    const uid = resolveUidParam(req);
    if (!uid) return errorResponse(res, "uid is required", 400);

    const [userSnap, studentSnap] = await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(uid).get(),
      db.collection(COLLECTIONS.STUDENTS).doc(uid).get(),
    ]);

    if (!userSnap.exists || !studentSnap.exists) {
      return errorResponse(res, "Student not found", 404);
    }

    const userData = userSnap.data() || {};
    if (String(userData.role || "").toLowerCase() !== "student") {
      return errorResponse(res, "Student not found", 404);
    }

    const studentData = studentSnap.data() || {};
    return successResponse(
      res,
      {
        uid,
        ...userData,
        ...studentData,
        createdAt: toIsoOrNull(studentData.createdAt || userData.createdAt),
        updatedAt: toIsoOrNull(studentData.updatedAt || userData.updatedAt),
        lastLoginAt: toIsoOrNull(userData.lastLoginAt),
      },
      "Student fetched"
    );
  } catch (e) {
    return errorResponse(res, "Failed to fetch student", 500);
  }
};

export const getStudentProgressById = async (req, res) => {
  try {
    const uid = resolveUidParam(req);
    if (!uid) return errorResponse(res, "uid is required", 400);

    const [userSnap, studentSnap, progressSnap, enrollmentSnap] = await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(uid).get(),
      db.collection(COLLECTIONS.STUDENTS).doc(uid).get(),
      db.collection(COLLECTIONS.PROGRESS).where("studentId", "==", uid).get(),
      db.collection(COLLECTIONS.ENROLLMENTS).where("studentId", "==", uid).get(),
    ]);

    if (!userSnap.exists || !studentSnap.exists) {
      return errorResponse(res, "Student not found", 404);
    }
    const userData = userSnap.data() || {};
    if (String(userData.role || "").toLowerCase() !== "student") {
      return errorResponse(res, "Student not found", 404);
    }

    const enrolledCourseIds = new Set();
    const studentEnrolledCourses = Array.isArray(studentSnap.data()?.enrolledCourses)
      ? studentSnap.data().enrolledCourses
      : [];

    studentEnrolledCourses.forEach((entry) => {
      if (typeof entry === "string") {
        if (entry.trim()) enrolledCourseIds.add(entry.trim());
        return;
      }
      const courseId = String(entry?.courseId || entry?.id || "").trim();
      if (courseId) enrolledCourseIds.add(courseId);
    });

    enrollmentSnap.docs.forEach((doc) => {
      const courseId = String(doc.data()?.courseId || "").trim();
      if (courseId) enrolledCourseIds.add(courseId);
    });

    const progressRows = progressSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    progressRows.forEach((row) => {
      const courseId = String(row.courseId || "").trim();
      if (courseId) enrolledCourseIds.add(courseId);
    });

    const courseIds = [...enrolledCourseIds];
    const courseSnaps = await Promise.all(
      courseIds.map((courseId) =>
        db.collection(COLLECTIONS.COURSES).doc(courseId).get()
      )
    );
    const courseTitleMap = courseSnaps.reduce((acc, snap) => {
      if (snap.exists) {
        const data = snap.data() || {};
        acc[snap.id] = data.title || "Course";
      }
      return acc;
    }, {});

    const rowsByCourse = progressRows.reduce((acc, row) => {
      const courseId = String(row.courseId || "").trim();
      if (!courseId) return acc;
      if (!acc[courseId]) acc[courseId] = [];
      acc[courseId].push(row);
      return acc;
    }, {});

    const courses = courseIds.map((courseId) => {
      const rows = Array.isArray(rowsByCourse[courseId]) ? rowsByCourse[courseId] : [];
      const directPercents = rows
        .map((row) => normalizeProgressPercent(row))
        .filter((value) => Number.isFinite(value));
      const percent =
        directPercents.length > 0
          ? Math.max(...directPercents)
          : 0;
      const completedLectures = rows.filter((row) => row.isCompleted === true).length;
      const lastActivity = rows
        .map((row) => toIsoOrNull(row.updatedAt || row.completedAt || row.createdAt))
        .filter(Boolean)
        .sort()
        .pop() || null;

      return {
        courseId,
        courseName: courseTitleMap[courseId] || "Course",
        progress: Math.round(percent),
        completedLectures,
        lastActivityAt: lastActivity,
      };
    });

    const avgProgress =
      courses.length > 0
        ? Math.round(
            courses.reduce((sum, row) => sum + Number(row.progress || 0), 0) /
              courses.length
          )
        : 0;

    const summary = {
      totalCourses: courses.length,
      avgProgress,
      completedCourses: courses.filter((row) => Number(row.progress || 0) >= 100).length,
      progressRecords: progressRows.length,
    };

    return successResponse(
      res,
      {
        uid,
        summary,
        courses,
        progressRows: progressRows.map((row) => ({
          ...row,
          createdAt: toIsoOrNull(row.createdAt),
          updatedAt: toIsoOrNull(row.updatedAt),
          completedAt: toIsoOrNull(row.completedAt),
        })),
      },
      "Student progress fetched"
    );
  } catch (e) {
    return errorResponse(res, "Failed to fetch student progress", 500);
  }
};

export const getUsers = async (req, res) => {
  try {
    const { role, isActive, search } = req.query;
    const filters = {
      role,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      search,
    };
    const data = await adminService.getAllUsers(filters);
    return successResponse(res, data, "Users fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch users", 500);
  }
};

export const getTeachers = async (req, res) => {
  try {
    const data = await adminService.getAllTeachers();
    return successResponse(res, data, "Teachers fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch teachers", 500);
  }
};

export const getStudents = async (req, res) => {
  try {
    const data = await adminService.getAllStudents();
    return successResponse(res, data, "Students fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch students", 500);
  }
};

export const approveStudent = async (req, res) => {
  try {
    const { uid } = req.params;

    await db.collection(COLLECTIONS.USERS).doc(uid).update({
      isActive: true,
      status: "approved",
      approvedBy: req.user.uid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection(COLLECTIONS.STUDENTS).doc(uid).set(
      {
        approvalStatus: "approved",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const userSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    const studentSnap = await db.collection(COLLECTIONS.STUDENTS).doc(uid).get();

    const email = userSnap.data()?.email || "";
    const fullName = studentSnap.data()?.fullName || "";
    let emailSent = false;

    if (email) {
      try {
        await sendApprovalEmail(email, fullName || "Student");
        emailSent = true;
      } catch (mailError) {
        console.error("approveStudent email error:", mailError);
      }
    }

    return successResponse(
      res,
      { uid, emailSent },
      emailSent
        ? "Student approved successfully"
        : "Student approved successfully (email pending/retry needed)"
    );
  } catch (e) {
    return errorResponse(res, "Failed to approve student", 500);
  }
};

export const rejectStudent = async (req, res) => {
  try {
    const { uid } = req.params;
    const { reason } = req.body || {};

    await db.collection(COLLECTIONS.USERS).doc(uid).update({
      isActive: false,
      status: "rejected",
      rejectedBy: req.user.uid,
      rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
      rejectionReason: reason || "",
    });

    await db.collection(COLLECTIONS.STUDENTS).doc(uid).set(
      {
        approvalStatus: "rejected",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const userSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    const studentSnap = await db.collection(COLLECTIONS.STUDENTS).doc(uid).get();

    const email = userSnap.data()?.email || "";
    const fullName = studentSnap.data()?.fullName || "";

    if (email) {
      await sendRejectionEmail(email, fullName || "Student", reason || "");
    }

    return successResponse(res, { uid }, "Student rejected");
  } catch (e) {
    return errorResponse(res, "Failed to reject student", 500);
  }
};

export const resetStudentPaymentRejectLock = async (req, res) => {
  try {
    const uid = resolveUidParam(req);
    if (!uid) return errorResponse(res, "uid is required", 400);

    const userRef = db.collection(COLLECTIONS.USERS).doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return errorResponse(res, "Student not found", 404);

    const userData = userSnap.data() || {};
    if (String(userData.role || "").toLowerCase() !== "student") {
      return errorResponse(res, "Student not found", 404);
    }

    await userRef.set(
      {
        paymentRejectCount: 0,
        paymentRejectLimit: Math.max(1, Number(userData.paymentRejectLimit || 3)),
        paymentApprovalBlocked: false,
        paymentApprovalBlockedAt: null,
        paymentApprovalBlockedBy: null,
        paymentApprovalBlockReason: null,
        paymentRejectResetBy: req.user?.uid || null,
        paymentRejectResetAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return successResponse(
      res,
      {
        uid,
        paymentRejectCount: 0,
        paymentApprovalBlocked: false,
      },
      "Student payment reject lock has been reset"
    );
  } catch (e) {
    console.error("resetStudentPaymentRejectLock error:", e);
    return errorResponse(res, "Failed to reset student payment lock", 500);
  }
};

export const downloadStudentsBulkTemplate = async (_req, res) => {
  try {
    const commentRow =
      "# Fill only: name,email,password,phone,address. Do not add id column.";
    const headerRow = ["name", "email", "password", "phone", "address"];
    const sampleRows = [
      ["Ali Raza", "ali.raza@example.com", "Ali@12345", "+923001234567", "Lahore"],
      ["Ayesha Khan", "ayesha.khan@example.com", "Ayesha@123", "+923121112233", "Karachi"],
      ["", "", "", "", ""],
      ["", "", "", "", ""],
    ];
    const csvContent = [commentRow, buildCsv([headerRow, ...sampleRows])].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Students_Bulk_Template.csv"`
    );
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("downloadStudentsBulkTemplate error:", error);
    return errorResponse(res, "Failed to download students template", 500);
  }
};

export const bulkUploadStudents = async (req, res) => {
  try {
    const fileBuffer = req.file?.buffer;
    const csvText = fileBuffer
      ? fileBuffer.toString("utf8")
      : String(req.body?.csvText || "").trim();

    if (!csvText) {
      return errorResponse(res, "CSV file is required", 400);
    }

    const parsed = parseCsvWithHeader(csvText);
    if (!parsed.headers.length) {
      return errorResponse(res, "CSV header row not found", 400);
    }

    const hasNameHeader =
      parsed.headers.includes("name") || parsed.headers.includes("fullname");
    if (!hasNameHeader) {
      return errorResponse(res, "CSV must include name column", 400);
    }

    const missingHeaders = STUDENT_BULK_HEADERS.filter(
      (header) => header !== "name" && !parsed.headers.includes(header)
    );
    if (missingHeaders.length) {
      return errorResponse(
        res,
        `CSV missing required columns: ${missingHeaders.join(", ")}`,
        400
      );
    }

    if (!parsed.rows.length) {
      return errorResponse(res, "No student rows found in CSV", 400);
    }

    const emailSeen = new Set();
    const rows = [];
    const validationErrors = [];

    parsed.rows.forEach((row) => {
      const lineNo = row.__row || 0;
      const fullName = String(row.name || row.fullname || "").trim();
      const email = String(row.email || "")
        .trim()
        .toLowerCase();
      const password = String(row.password || "").trim();
      const phone = normalizeBulkPhone(row.phone || "");
      const address = String(row.address || "").trim();

      if (!fullName) {
        validationErrors.push({ row: lineNo, message: "Name is required" });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        validationErrors.push({ row: lineNo, message: "Valid email is required" });
      }
      if (!password || password.length < 6) {
        validationErrors.push({
          row: lineNo,
          message: "Password must be at least 6 characters",
        });
      }
      if (!phone || !isPakistanPhone(phone)) {
        validationErrors.push({
          row: lineNo,
          message: "Phone must be 03001234567 or +923001234567 format",
        });
      }
      if (email && emailSeen.has(email)) {
        validationErrors.push({
          row: lineNo,
          message: "Duplicate email in CSV",
        });
      }
      if (email) emailSeen.add(email);

      rows.push({
        row: lineNo,
        fullName,
        email,
        password,
        phone,
        address,
      });
    });

    if (validationErrors.length) {
      return errorResponse(res, "CSV validation failed", 400, validationErrors);
    }

    const created = [];
    const failed = [];

    for (const row of rows) {
      let newUid = "";
      try {
        const firebaseUser = await admin.auth().createUser({
          email: row.email,
          password: row.password,
          displayName: row.fullName,
          emailVerified: true,
        });
        newUid = firebaseUser.uid;

        await admin.auth().setCustomUserClaims(newUid, { role: "student" });

        const batch = db.batch();
        batch.set(db.collection(COLLECTIONS.USERS).doc(newUid), {
          uid: newUid,
          email: row.email,
          fullName: row.fullName,
          name: row.fullName,
          phoneNumber: row.phone || "",
          address: row.address || "",
          role: "student",
          isActive: true,
          status: "approved",
          approvedBy: req.user.uid,
          approvedAt: admin.firestore.FieldValue.serverTimestamp(),
          assignedWebDevice: "",
          assignedWebIp: "",
          assignedUniqueDeviceId: "",
          lastKnownWebIp: "",
          lastLoginAt: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batch.set(db.collection(COLLECTIONS.STUDENTS).doc(newUid), {
          uid: newUid,
          email: row.email,
          fullName: row.fullName,
          phoneNumber: row.phone || "",
          address: row.address || "",
          enrolledCourses: [],
          certificates: [],
          approvalStatus: "approved",
          fatherName: "",
          fatherPhone: "",
          fatherOccupation: "",
          district: "",
          domicile: "",
          caste: "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await batch.commit();

        created.push({
          row: row.row,
          uid: newUid,
          fullName: row.fullName,
          email: row.email,
        });
      } catch (error) {
        if (newUid) {
          try {
            await admin.auth().deleteUser(newUid);
          } catch {
            // ignore rollback failures
          }
        }
        const message =
          error?.code === "auth/email-already-exists"
            ? "Email already exists"
            : error?.message || "Failed to create student";
        failed.push({
          row: row.row,
          email: row.email,
          message,
        });
      }
    }

    if (!created.length) {
      return errorResponse(res, "No students were created", 400, failed);
    }

    return successResponse(
      res,
      {
        totalRows: rows.length,
        createdCount: created.length,
        failedCount: failed.length,
        created,
        failed,
      },
      failed.length
        ? "Students bulk upload completed with some failures"
        : "Students bulk upload completed",
      201
    );
  } catch (error) {
    console.error("bulkUploadStudents error:", error);
    return errorResponse(res, "Failed to bulk upload students", 500);
  }
};

export const createUser = async (req, res) => {
  let normalizedEmail = "";
  try {
    const { name, email, password, phone, role, subject, bio } = req.body;

    if (!name || !email || !password || !role) {
      return errorResponse(res, "All fields required", 400);
    }

    const allowedRoles = ["student", "teacher", "admin"];
    if (!allowedRoles.includes(role)) {
      return errorResponse(res, "Invalid role", 400);
    }

    normalizedEmail = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return errorResponse(res, "Enter a valid email address", 400);
    }
    const normalizedPhone = normalizePakistanPhone(phone);
    if (!normalizedPhone || !isPakistanPhone(normalizedPhone)) {
      return errorResponse(
        res,
        "Phone must be 03001234567 or +923001234567 format",
        400
      );
    }

    const roleCollectionByRole = {
      student: COLLECTIONS.STUDENTS,
      teacher: COLLECTIONS.TEACHERS,
      admin: COLLECTIONS.ADMINS,
    };

    const hasCompleteProfile = async (uid, userRole) => {
      const roleCollection = roleCollectionByRole[String(userRole || "").toLowerCase()];
      if (!uid || !roleCollection) return false;
      const roleSnap = await db.collection(roleCollection).doc(uid).get();
      return roleSnap.exists;
    };

    const upsertUserWithRoleProfile = async (uid) => {
      const batch = db.batch();

      const userPayload = {
        uid,
        email: normalizedEmail,
        fullName: name,
        name,
        phoneNumber: normalizedPhone,
        role,
        isActive: true,
        status: role === "student" ? "approved" : "active",
        assignedWebDevice: "",
        assignedWebIp: "",
        assignedUniqueDeviceId: "",
        lastKnownWebIp: "",
        lastLoginAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (role === "student") {
        userPayload.approvedBy = req.user.uid;
        userPayload.approvedAt = admin.firestore.FieldValue.serverTimestamp();
      }

      batch.set(db.collection(COLLECTIONS.USERS).doc(uid), userPayload, { merge: true });

      if (role === "student") {
        batch.set(
          db.collection(COLLECTIONS.STUDENTS).doc(uid),
          {
            uid,
            fullName: name,
            phoneNumber: normalizedPhone,
            enrolledCourses: [],
            certificates: [],
            approvalStatus: "approved",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else if (role === "teacher") {
        batch.set(
          db.collection(COLLECTIONS.TEACHERS).doc(uid),
          {
            uid,
            fullName: name,
            phoneNumber: normalizedPhone,
            subject: subject || "",
            bio: bio || "",
            assignedSubjects: subject ? [subject] : [],
            assignedClasses: [],
            assignedCourses: [],
            profilePicture: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else if (role === "admin") {
        batch.set(
          db.collection(COLLECTIONS.ADMINS).doc(uid),
          {
            uid,
            fullName: name,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      await batch.commit();
    };

    const existingByEmailSnap = await db
      .collection(COLLECTIONS.USERS)
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();
    if (!existingByEmailSnap.empty) {
      const existingDoc = existingByEmailSnap.docs[0];
      const existingData = existingDoc.data() || {};
      const isComplete = await hasCompleteProfile(existingDoc.id, existingData.role || role);
      if (isComplete) {
        return errorResponse(res, "Email already in use", 409);
      }
      await db.collection(COLLECTIONS.USERS).doc(existingDoc.id).delete();
    }

    let firebaseUser = null;
    try {
      firebaseUser = await admin.auth().getUserByEmail(normalizedEmail);

      const existingUserDoc = await db.collection(COLLECTIONS.USERS).doc(firebaseUser.uid).get();
      if (existingUserDoc.exists) {
        const existingData = existingUserDoc.data() || {};
        const isComplete = await hasCompleteProfile(firebaseUser.uid, existingData.role || role);
        if (isComplete) {
          return errorResponse(res, "Email already in use", 409);
        }
        await db.collection(COLLECTIONS.USERS).doc(firebaseUser.uid).delete();
      }

      await admin.auth().updateUser(firebaseUser.uid, {
        email: normalizedEmail,
        password,
        displayName: name,
        emailVerified: true,
        disabled: false,
      });
    } catch (authLookupError) {
      if (authLookupError?.code !== "auth/user-not-found") {
        throw authLookupError;
      }
      firebaseUser = await admin.auth().createUser({
        email: normalizedEmail,
        password,
        displayName: name,
        emailVerified: true,
      });
    }

    const uid = firebaseUser.uid;
    await admin.auth().setCustomUserClaims(uid, { role });
    await upsertUserWithRoleProfile(uid);

    return successResponse(
      res,
      { uid, email: normalizedEmail, role, name },
      `${role} created successfully`,
      201
    );
  } catch (e) {
    if (e.code === "auth/email-already-exists") {
      try {
        const { name, password, role, phone, subject, bio } = req.body || {};
        const allowedRoles = ["student", "teacher", "admin"];
        if (!allowedRoles.includes(role) || !normalizedEmail || !name || !password) {
          return errorResponse(res, "Email already in use", 409);
        }

        const roleCollectionByRole = {
          student: COLLECTIONS.STUDENTS,
          teacher: COLLECTIONS.TEACHERS,
          admin: COLLECTIONS.ADMINS,
        };
        const authUser = await admin.auth().getUserByEmail(normalizedEmail);
        const normalizedPhone = normalizePakistanPhone(phone);
        if (!normalizedPhone || !isPakistanPhone(normalizedPhone)) {
          return errorResponse(
            res,
            "Phone must be 03001234567 or +923001234567 format",
            400
          );
        }
        const existingUserDoc = await db.collection(COLLECTIONS.USERS).doc(authUser.uid).get();

        let canRecover = true;
        if (existingUserDoc.exists) {
          const existingData = existingUserDoc.data() || {};
          const roleCollection = roleCollectionByRole[String(existingData.role || "").toLowerCase()];
          if (roleCollection) {
            const roleSnap = await db.collection(roleCollection).doc(authUser.uid).get();
            if (roleSnap.exists) canRecover = false;
          } else {
            canRecover = false;
          }
        }

        if (!canRecover) {
          return errorResponse(res, "Email already in use", 409);
        }

        await admin.auth().updateUser(authUser.uid, {
          email: normalizedEmail,
          password,
          displayName: name,
          emailVerified: true,
          disabled: false,
        });
        await admin.auth().setCustomUserClaims(authUser.uid, { role });

        const batch = db.batch();
        batch.set(
          db.collection(COLLECTIONS.USERS).doc(authUser.uid),
          {
            uid: authUser.uid,
            email: normalizedEmail,
            fullName: name,
            name,
            phoneNumber: normalizedPhone,
            role,
            isActive: true,
            status: role === "student" ? "approved" : "active",
            assignedWebDevice: "",
            assignedWebIp: "",
            assignedUniqueDeviceId: "",
            lastKnownWebIp: "",
            lastLoginAt: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        if (role === "student") {
          batch.set(
            db.collection(COLLECTIONS.STUDENTS).doc(authUser.uid),
            {
              uid: authUser.uid,
              fullName: name,
              phoneNumber: normalizedPhone,
              enrolledCourses: [],
              certificates: [],
              approvalStatus: "approved",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } else if (role === "teacher") {
          batch.set(
            db.collection(COLLECTIONS.TEACHERS).doc(authUser.uid),
            {
              uid: authUser.uid,
              fullName: name,
              phoneNumber: normalizedPhone,
              subject: subject || "",
              bio: bio || "",
              assignedSubjects: subject ? [subject] : [],
              assignedClasses: [],
              assignedCourses: [],
              profilePicture: null,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          batch.set(
            db.collection(COLLECTIONS.ADMINS).doc(authUser.uid),
            {
              uid: authUser.uid,
              fullName: name,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
        await batch.commit();

        return successResponse(
          res,
          { uid: authUser.uid, email: normalizedEmail, role, name },
          `${role} created successfully`,
          201
        );
      } catch (recoveryError) {
        console.error("createUser recovery error:", recoveryError);
        return errorResponse(res, "Email already in use", 409);
      }
    }
    console.error("createUser error:", e);
    return errorResponse(res, "Failed to create user", 500);
  }
};

export const updateUser = async (req, res) => {
  try {
    const { uid } = req.params;
    const {
      name,
      fullName,
      email,
      isActive,
      phone,
      phoneNumber,
      subject,
      bio,
      fatherName,
      fatherPhone,
      fatherOccupation,
      address,
      district,
      domicile,
      caste,
      password,
      confirmPassword,
    } = req.body || {};

    const trim = (value = "") => String(value || "").trim();
    const isValidEmail = (value = "") =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
    const hasPasswordField = Object.prototype.hasOwnProperty.call(
      req.body || {},
      "password"
    );
    const nextPassword = typeof password === "string" ? password : "";

    const nextName = trim(name || fullName);
    const nextEmail = trim(email).toLowerCase();
    const nextPhoneRaw = trim(phone !== undefined ? phone : phoneNumber);
    const nextPhone = nextPhoneRaw ? normalizePakistanPhone(nextPhoneRaw) : "";
    const nextFatherPhoneRaw = trim(fatherPhone);
    const nextFatherPhone = nextFatherPhoneRaw
      ? normalizePakistanPhone(nextFatherPhoneRaw)
      : "";

    const userSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    if (!userSnap.exists) {
      return errorResponse(res, "User not found", 404);
    }

    const userData = userSnap.data();
    const currentEmail = trim(userData.email).toLowerCase();
    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (nextEmail && !isValidEmail(nextEmail)) {
      return errorResponse(res, "Enter a valid email address", 400);
    }
    if (hasPasswordField) {
      if (!nextPassword || !nextPassword.trim()) {
        return errorResponse(res, "Password cannot be empty", 400);
      }
      if (nextPassword.trim().length < 6) {
        return errorResponse(res, "Password must be at least 6 characters", 400);
      }
      if (
        confirmPassword !== undefined &&
        String(confirmPassword || "") !== String(nextPassword || "")
      ) {
        return errorResponse(res, "Passwords do not match", 400);
      }
    }
    if ((phone !== undefined || phoneNumber !== undefined) && nextPhoneRaw && !isPakistanPhone(nextPhone)) {
      return errorResponse(
        res,
        "Phone must be 03001234567 or +923001234567 format",
        400
      );
    }
    if (fatherPhone !== undefined && nextFatherPhoneRaw && !isPakistanPhone(nextFatherPhone)) {
      return errorResponse(
        res,
        "Father phone must be 03001234567 or +923001234567 format",
        400
      );
    }

    if (
      isActive === false &&
      req.user?.uid === uid &&
      String(userData.role || "").toLowerCase() === "admin"
    ) {
      return errorResponse(
        res,
        "Admin cannot deactivate their own account",
        400,
        { code: "SELF_DEACTIVATE_NOT_ALLOWED" }
      );
    }

    if (isActive !== undefined) {
      updates.isActive = isActive;
      if (!isActive) {
        await admin.auth().revokeRefreshTokens(uid);
      } else {
        updates.securityViolationCount = 0;
        updates.lastSecurityViolationReason = "";
        updates.lastSecurityViolationAt = null;
        updates.securityDeactivatedAt = null;
        updates.securityDeactivationReason = "";
        updates.status =
          String(userData.role || "").toLowerCase() === "student"
            ? "approved"
            : String(userData.status || "").toLowerCase() === "deactivated"
              ? "active"
              : userData.status || "active";
      }
    }

    if (nextName) {
      updates.fullName = nextName;
      updates.name = nextName;
    }

    if (nextEmail) {
      updates.email = nextEmail;
    }

    if (phone !== undefined || phoneNumber !== undefined) {
      updates.phoneNumber = nextPhone;
    }

    try {
      let authUid = trim(userData.uid || uid);
      let authUser = null;

      const tryGetAuthByUid = async (candidateUid = "") => {
        const cleanUid = trim(candidateUid);
        if (!cleanUid) return null;
        try {
          return await admin.auth().getUser(cleanUid);
        } catch (authError) {
          if (authError?.code === "auth/user-not-found") return null;
          throw authError;
        }
      };

      const tryGetAuthByEmail = async (candidateEmail = "") => {
        const cleanEmail = trim(candidateEmail).toLowerCase();
        if (!cleanEmail) return null;
        try {
          return await admin.auth().getUserByEmail(cleanEmail);
        } catch (authError) {
          if (authError?.code === "auth/user-not-found") return null;
          throw authError;
        }
      };

      authUser = await tryGetAuthByUid(authUid);
      if (!authUser && nextEmail) {
        authUser = await tryGetAuthByEmail(nextEmail);
      }
      if (!authUser && currentEmail) {
        authUser = await tryGetAuthByEmail(currentEmail);
      }

      if (!authUser) {
        return errorResponse(
          res,
          "Linked Firebase Auth account not found for this user",
          404
        );
      }

      authUid = trim(authUser.uid);

      const authUpdates = {};
      if (nextName) authUpdates.displayName = nextName;
      if (nextEmail && nextEmail !== String(userData.email || "").toLowerCase()) {
        authUpdates.email = nextEmail;
      }
      if (hasPasswordField && nextPassword) {
        authUpdates.password = nextPassword.trim();
      }
      if (Object.keys(authUpdates).length > 0) {
        await admin.auth().updateUser(authUid, authUpdates);
      }

      if (hasPasswordField && nextPassword) {
        await admin.auth().revokeRefreshTokens(authUid);
      }

      if (authUid && authUid !== trim(userData.uid)) {
        updates.uid = authUid;
      }
    } catch (authError) {
      if (authError?.code === "auth/email-already-exists") {
        return errorResponse(res, "Email already in use", 409);
      }
      throw authError;
    }

    if (Object.keys(updates).length > 0) {
      await db.collection(COLLECTIONS.USERS).doc(uid).set(updates, { merge: true });
    }

    const roleCol =
      userData.role === "student"
        ? COLLECTIONS.STUDENTS
        : userData.role === "teacher"
          ? COLLECTIONS.TEACHERS
          : COLLECTIONS.ADMINS;

    const roleUpdates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (nextName) {
      roleUpdates.fullName = nextName;
      roleUpdates.name = nextName;
    }
    if (nextEmail) {
      roleUpdates.email = nextEmail;
    }
    if (phone !== undefined || phoneNumber !== undefined) {
      roleUpdates.phoneNumber = nextPhone;
      roleUpdates.phone = nextPhone;
    }

    if (userData.role === "teacher") {
      if (subject !== undefined) {
        const cleanSubject = trim(subject);
        roleUpdates.subject = cleanSubject;
        roleUpdates.assignedSubjects = cleanSubject ? [cleanSubject] : [];
      }
      if (bio !== undefined) roleUpdates.bio = trim(bio);
    }

    if (userData.role === "student") {
      if (isActive === true) {
        roleUpdates.approvalStatus = "approved";
        roleUpdates.securityViolationCount = 0;
        roleUpdates.lastSecurityViolationReason = "";
        roleUpdates.lastSecurityViolationAt = null;
        roleUpdates.securityDeactivatedAt = null;
      }
      if (fatherName !== undefined) roleUpdates.fatherName = trim(fatherName);
      if (fatherPhone !== undefined) roleUpdates.fatherPhone = nextFatherPhone;
      if (fatherOccupation !== undefined) {
        roleUpdates.fatherOccupation = trim(fatherOccupation);
      }
      if (address !== undefined) roleUpdates.address = trim(address);
      if (district !== undefined) roleUpdates.district = trim(district);
      if (domicile !== undefined) roleUpdates.domicile = trim(domicile);
      if (caste !== undefined) roleUpdates.caste = trim(caste);
    }

    if (Object.keys(roleUpdates).length > 1) {
      await db.collection(roleCol).doc(uid).set(roleUpdates, { merge: true });
    }

    return successResponse(
      res,
      {
        uid,
        role: userData.role,
        fullName: nextName || userData.fullName || userData.name || "",
        email: nextEmail || userData.email || "",
        passwordUpdated: Boolean(hasPasswordField && nextPassword),
      },
      hasPasswordField && nextPassword
        ? "User profile and password updated"
        : "User updated"
    );
  } catch (e) {
    console.error("updateUser error:", e);
    return errorResponse(res, "Failed to update user", 500);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { uid } = req.params;
    const [userDocSnap, studentSnap, teacherSnap, adminSnap] = await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(uid).get(),
      db.collection(COLLECTIONS.STUDENTS).doc(uid).get(),
      db.collection(COLLECTIONS.TEACHERS).doc(uid).get(),
      db.collection(COLLECTIONS.ADMINS).doc(uid).get(),
    ]);

    const userData = userDocSnap.exists ? userDocSnap.data() || {} : {};
    const studentData = studentSnap.exists ? studentSnap.data() || {} : {};
    const teacherData = teacherSnap.exists ? teacherSnap.data() || {} : {};
    const adminData = adminSnap.exists ? adminSnap.data() || {} : {};

    const resolvedRole =
      String(userData.role || "").toLowerCase() ||
      (studentSnap.exists
        ? "student"
        : teacherSnap.exists
          ? "teacher"
          : adminSnap.exists
            ? "admin"
            : "");

    if (!resolvedRole && !userDocSnap.exists) {
      return errorResponse(res, "User not found", 404);
    }

    const normalizedEmail = String(
      userData.email ||
        studentData.email ||
        teacherData.email ||
        adminData.email ||
        ""
    )
      .trim()
      .toLowerCase();

    if (
      req.user?.uid === uid &&
      resolvedRole === "admin"
    ) {
      return errorResponse(
        res,
        "Admin cannot delete their own account",
        400,
        { code: "SELF_DELETE_NOT_ALLOWED" }
      );
    }

    if (resolvedRole === "teacher") {
      const linked = await hasTeacherLinks(uid);
      if (linked) {
        return errorResponse(
          res,
          "Cannot delete teacher while assigned to courses, classes, or subjects",
          400
        );
      }
    }

    const usersRefByUidSnap = await db
      .collection(COLLECTIONS.USERS)
      .where("uid", "==", uid)
      .get();
    let usersRefByEmailSnap = { docs: [] };
    if (normalizedEmail) {
      usersRefByEmailSnap = await db
        .collection(COLLECTIONS.USERS)
        .where("email", "==", normalizedEmail)
        .get();
    }

    const userRefs = new Map();
    userRefs.set(db.collection(COLLECTIONS.USERS).doc(uid).path, db.collection(COLLECTIONS.USERS).doc(uid));
    usersRefByUidSnap.docs.forEach((doc) => {
      userRefs.set(doc.ref.path, doc.ref);
    });
    usersRefByEmailSnap.docs.forEach((doc) => {
      const row = doc.data() || {};
      const rowUid = String(row.uid || "").trim();
      const rowEmail = String(row.email || "").trim().toLowerCase();
      if (!rowUid || rowUid === uid || (normalizedEmail && rowEmail === normalizedEmail)) {
        userRefs.set(doc.ref.path, doc.ref);
      }
    });

    try {
      await admin.auth().deleteUser(uid);
    } catch (authError) {
      if (authError?.code !== "auth/user-not-found") {
        console.error("deleteUser auth delete error:", authError);
        return errorResponse(
          res,
          "Failed to delete user from authentication. No database changes were made.",
          500,
          { code: "AUTH_DELETE_FAILED" }
        );
      }
    }

    const batch = db.batch();
    Array.from(userRefs.values()).forEach((ref) => batch.delete(ref));
    batch.delete(db.collection(COLLECTIONS.STUDENTS).doc(uid));
    batch.delete(db.collection(COLLECTIONS.TEACHERS).doc(uid));
    batch.delete(db.collection(COLLECTIONS.ADMINS).doc(uid));
    await batch.commit();

    return successResponse(
      res,
      { uid },
      "User deleted from authentication and database"
    );
  } catch (e) {
    console.error("deleteUser error:", e);
    return errorResponse(res, "Failed to delete user", 500);
  }
};

export const setUserRole = async (req, res) => {
  try {
    const { uid } = req.params;
    const { role } = req.body;

    const allowed = ["student", "teacher", "admin"];
    if (!allowed.includes(role)) {
      return errorResponse(res, "Invalid role", 400);
    }

    const userRef = db.collection(COLLECTIONS.USERS).doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return errorResponse(res, "User not found", 404);
    }

    const userData = userSnap.data();
    const currentRole = userData.role;

    const roleCollections = [
      COLLECTIONS.STUDENTS,
      COLLECTIONS.TEACHERS,
      COLLECTIONS.ADMINS,
    ];

    let sourceRoleData = null;
    for (const collectionName of roleCollections) {
      const snap = await db.collection(collectionName).doc(uid).get();
      if (snap.exists) {
        sourceRoleData = snap.data();
        break;
      }
    }

    const fullName =
      sourceRoleData?.fullName ||
      sourceRoleData?.name ||
      (await admin.auth().getUser(uid)).displayName ||
      (userData.email || "").split("@")[0];

    const phoneNumber =
      sourceRoleData?.phoneNumber ||
      sourceRoleData?.phone ||
      "";

    if (role === "student") {
      await db.collection(COLLECTIONS.STUDENTS).doc(uid).set(
        {
          uid,
          fullName,
          phoneNumber,
          enrolledCourses: sourceRoleData?.enrolledCourses || [],
          certificates: sourceRoleData?.certificates || [],
          createdAt:
            sourceRoleData?.createdAt ||
            admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else if (role === "teacher") {
      await db.collection(COLLECTIONS.TEACHERS).doc(uid).set(
        {
          uid,
          fullName,
          phoneNumber,
          subject: sourceRoleData?.subject || "",
          bio: sourceRoleData?.bio || "",
          assignedSubjects: sourceRoleData?.assignedSubjects || [],
          assignedClasses: sourceRoleData?.assignedClasses || [],
          assignedCourses: sourceRoleData?.assignedCourses || [],
          profilePicture: sourceRoleData?.profilePicture || null,
          createdAt:
            sourceRoleData?.createdAt ||
            admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else if (role === "admin") {
      await db.collection(COLLECTIONS.ADMINS).doc(uid).set(
        {
          uid,
          fullName,
          createdAt:
            sourceRoleData?.createdAt ||
            admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (currentRole !== role) {
      await userRef.update({ role });
    }

    await admin.auth().setCustomUserClaims(uid, { role });

    return successResponse(res, { uid, role }, "Role updated");
  } catch (e) {
    return errorResponse(res, "Failed to update role", 500);
  }
};

export const resetUserDevice = async (req, res) => {
  try {
    const { uid } = req.params;

    const userSnap = await db.collection("users")
      .doc(uid).get();

    if (!userSnap.exists) {
      return errorResponse(res, "User not found", 404);
    }

    const userData = userSnap.data();

    if (userData.role !== "student") {
      return errorResponse(
        res,
        "Device reset only applies to students",
        400
      );
    }

    // Clear ALL device fields — no replacement values
    await db.collection("users").doc(uid).update({
      assignedWebDevice:      "",
      assignedWebIp:          "",
      assignedUniqueDeviceId: "",
      lastKnownWebIp:         "",
      deviceResetBy:          req.user.uid,
      deviceResetAt:          admin.firestore.FieldValue
                                .serverTimestamp(),
    });

    // Log this action in auditLogs
    await db.collection("auditLogs").add({
      uid,
      email:       userData.email,
      action:      "device_reset_by_admin",
      resetBy:     req.user.uid,
      timestamp:   admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(
      res,
      { uid },
      "Device reset successfully. Student can now login from any device once."
    );
  } catch (e) {
    console.error("Reset device error:", e);
    return errorResponse(res, "Failed to reset device", 500);
  }
};

export const getCourses = async (req, res) => {
  try {
    const [subjectsSnap, enrollmentsSnap] = await Promise.all([
      db
        .collection(COLLECTIONS.SUBJECTS)
        .orderBy("createdAt", "desc")
        .get(),
      db.collection(COLLECTIONS.ENROLLMENTS).get(),
    ]);
    const rowsById = {};
    subjectsSnap.docs.forEach((doc) => {
      const row = doc.data() || {};
      rowsById[doc.id] = {
        id: doc.id,
        title: String(row.title || "").trim(),
        description: String(row.description || "").trim(),
        category: String(row.category || "General").trim() || "General",
        level: String(row.level || "beginner").trim() || "beginner",
        price: toSafeNumber(row.price, 0),
        discountPercent: Math.max(
          0,
          toSafeNumber(row.discountPercent ?? row.discount, 0)
        ),
        discount: Math.max(0, toSafeNumber(row.discount, 0)),
        thumbnail: row.thumbnail || null,
        teacherId: String(row.teacherId || "").trim(),
        teacherName: String(row.teacherName || "").trim(),
        teachers: Array.isArray(row.teachers) ? row.teachers : [],
        teacherIds: Array.isArray(row.teacherIds)
          ? row.teacherIds.map((v) => String(v || "").trim()).filter(Boolean)
          : [],
        status: String(row.status || "published").trim().toLowerCase(),
        hasCertificate: row.hasCertificate !== false,
        enrollmentCount: toSafeNumber(row.enrollmentCount, 0),
        source: "subjects",
        createdAt: row.createdAt || null,
        updatedAt: row.updatedAt || null,
      };
    });

    const countableStatuses = new Set([
      "",
      "active",
      "completed",
      "upcoming",
      "pending_review",
    ]);
    const enrollmentSetBySubject = {};
    enrollmentsSnap.docs.forEach((doc) => {
      const row = doc.data() || {};
      const subjectId = String(row.subjectId || row.courseId || "").trim();
      const studentId = String(row.studentId || "").trim();
      const status = String(row.status || "").trim().toLowerCase();
      if (!subjectId || !studentId) return;
      if (!countableStatuses.has(status)) return;
      if (!enrollmentSetBySubject[subjectId]) {
        enrollmentSetBySubject[subjectId] = new Set();
      }
      enrollmentSetBySubject[subjectId].add(studentId);
    });

    Object.keys(rowsById).forEach((subjectId) => {
      const enrolledStudentSet = enrollmentSetBySubject[subjectId];
      rowsById[subjectId].enrollmentCount = enrolledStudentSet
        ? enrolledStudentSet.size
        : 0;
    });

    const data = Object.values(rowsById).sort((a, b) => {
      const aTitle = String(a.title || "").toLowerCase();
      const bTitle = String(b.title || "").toLowerCase();
      return aTitle.localeCompare(bTitle);
    });
    return successResponse(res, data, "Subjects fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch subjects", 500);
  }
};

export const createCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      shortDescription,
      category,
      level,
      status,
      thumbnail,
      teacherId,
      teacherName,
      teachers,
      teacherIds,
      hasCertificate,
    } = req.body;

    if (!title || String(title).trim().length < 3) {
      return errorResponse(res, "Title must be at least 3 characters", 400);
    }

    const ref = db.collection(COLLECTIONS.SUBJECTS).doc();
    const normalizedTeachers = await normalizeTeachers(
      teachers || teacherIds || [],
      { teacherId, teacherName }
    );
    if (!normalizedTeachers.length) {
      return errorResponse(res, "At least one teacher is required", 400);
    }
    const primaryTeacher = normalizedTeachers[0];

    const subjectPayload = {
      title: String(title).trim(),
      description: description || "",
      shortDescription: shortDescription || "",
      category: category || "",
      level: level || "beginner",
      thumbnail: thumbnail || null,
      teacherId: primaryTeacher.teacherId,
      teacherName: primaryTeacher.teacherName,
      teachers: normalizedTeachers,
      teacherIds: normalizedTeachers.map((row) => row.teacherId),
      status: status || "published",
      hasCertificate: hasCertificate !== false,
      enrollmentCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const courseMirrorPayload = {
      ...subjectPayload,
      subjects: [
        {
          id: ref.id,
          name: String(title).trim(),
          teacherId: primaryTeacher.teacherId,
          teacherName: primaryTeacher.teacherName,
          teachers: normalizedTeachers,
          teacherIds: normalizedTeachers.map((row) => row.teacherId),
          order: 1,
        },
      ],
    };

    await Promise.all([
      ref.set(subjectPayload),
      db.collection(COLLECTIONS.COURSES).doc(ref.id).set(courseMirrorPayload, { merge: true }),
    ]);

    return successResponse(
      res,
      { id: ref.id, subjectId: ref.id, teacherId: primaryTeacher.teacherId },
      "Subject created",
      201
    );
  } catch (e) {
    return errorResponse(res, "Failed to create subject", 500);
  }
};

export const updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const incoming = { ...req.body };

    if (
      incoming.teacherId !== undefined ||
      incoming.teachers !== undefined ||
      incoming.teacherIds !== undefined
    ) {
      const normalizedTeachers = await normalizeTeachers(
        incoming.teachers || incoming.teacherIds || [],
        { teacherId: incoming.teacherId, teacherName: incoming.teacherName }
      );
      if (!normalizedTeachers.length) {
        return errorResponse(res, "At least one teacher is required", 400);
      }
      const primaryTeacher = normalizedTeachers[0];
      incoming.teacherId = primaryTeacher.teacherId;
      incoming.teacherName = primaryTeacher.teacherName;
      incoming.teachers = normalizedTeachers;
      incoming.teacherIds = normalizedTeachers.map((row) => row.teacherId);
    }

    const updates = {
      ...incoming,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const subjectRef = db.collection(COLLECTIONS.SUBJECTS).doc(courseId);
    await subjectRef.set(updates, { merge: true });
    const latestSubjectSnap = await subjectRef.get();
    const latestSubjectData = latestSubjectSnap.exists
      ? latestSubjectSnap.data() || {}
      : {};
    const mirrorTitle = String(latestSubjectData.title || incoming.title || "").trim() || "Subject";
    const mirrorTeacherId = String(
      latestSubjectData.teacherId || incoming.teacherId || ""
    ).trim();
    const mirrorTeacherName = String(
      latestSubjectData.teacherName || incoming.teacherName || "Teacher"
    ).trim() || "Teacher";
    const mirrorTeachers = Array.isArray(latestSubjectData.teachers)
      ? latestSubjectData.teachers
      : incoming.teachers || [];
    const mirrorTeacherIds = Array.isArray(latestSubjectData.teacherIds)
      ? latestSubjectData.teacherIds
      : incoming.teacherIds || [];
    const courseMirrorPayload = {
      ...latestSubjectData,
      subjects: [
        {
          id: courseId,
          name: mirrorTitle,
          teacherId: mirrorTeacherId,
          teacherName: mirrorTeacherName,
          teachers: mirrorTeachers,
          teacherIds: mirrorTeacherIds,
          order: 1,
        },
      ],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection(COLLECTIONS.COURSES).doc(courseId).set(courseMirrorPayload, { merge: true });
    return successResponse(res, { subjectId: courseId, courseId }, "Subject updated");
  } catch (e) {
    return errorResponse(res, "Failed to update subject", 500);
  }
};

export const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const linked = await hasCourseLinks(courseId);
    if (linked) {
      return errorResponse(res, "Cannot delete subject while linked to active records", 400);
    }
    const subjectRef = db.collection(COLLECTIONS.SUBJECTS).doc(courseId);
    const courseRef = db.collection(COLLECTIONS.COURSES).doc(courseId);

    const contentSnap = await courseRef.collection("content").get();
    const batch = db.batch();
    contentSnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(subjectRef);
    batch.delete(courseRef);
    await batch.commit();

    return successResponse(res, { subjectId: courseId, courseId }, "Subject deleted");
  } catch (e) {
    return errorResponse(res, "Failed to delete subject", 500);
  }
};

export const addCourseSubject = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { name, teacherId, order } = req.body;

    if (!name || !teacherId) {
      return errorResponse(res, "Subject name and teacher are required", 400);
    }

    const teacherSnap = await db
      .collection(COLLECTIONS.TEACHERS)
      .doc(teacherId)
      .get();
    if (!teacherSnap.exists) {
      return errorResponse(res, "Teacher not found", 404);
    }

    const courseRef = db.collection(COLLECTIONS.COURSES).doc(courseId);
    const courseSnap = await courseRef.get();
    if (!courseSnap.exists) {
      return errorResponse(res, "Course not found", 404);
    }

    const subject = {
      id: uuidv4(),
      name: normalizeSubjectName(name),
      teacherId,
      teacherName: teacherSnap.data().fullName || "",
      order:
        Number(order) ||
        ((courseSnap.data()?.subjects || []).length + 1),
    };

    await courseRef.update({
      subjects: admin.firestore.FieldValue.arrayUnion(subject),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(res, subject, "Subject added", 201);
  } catch (e) {
    return errorResponse(res, "Failed to add subject", 500);
  }
};

export const removeCourseSubject = async (req, res) => {
  try {
    const { courseId, subjectId } = req.params;

    const linked = await hasSubjectLinks(courseId, subjectId);
    if (linked) {
      return errorResponse(
        res,
        "Cannot remove subject while linked to content or quizzes",
        400
      );
    }

    const courseRef = db.collection(COLLECTIONS.COURSES).doc(courseId);
    const courseSnap = await courseRef.get();
    if (!courseSnap.exists) {
      return errorResponse(res, "Course not found", 404);
    }

    const courseData = courseSnap.data();
    const currentSubjects = Array.isArray(courseData.subjects)
      ? courseData.subjects
      : [];

    const nextSubjects = currentSubjects.filter(
      (subject) => subject.id !== subjectId
    );
    if (nextSubjects.length === currentSubjects.length) {
      return errorResponse(res, "Subject not found", 404);
    }

    const normalized = nextSubjects.map((subject, index) => ({
      ...subject,
      order: index + 1,
    }));

    const contentSnap = await courseRef
      .collection("content")
      .where("subjectId", "==", subjectId)
      .get();

    const batch = db.batch();
    batch.update(courseRef, {
      subjects: normalized,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    contentSnap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    return successResponse(res, { subjectId }, "Subject removed");
  } catch (e) {
    return errorResponse(res, "Failed to remove subject", 500);
  }
};

export const getVideoLibrary = async (req, res) => {
  try {
    let rows = [];
    try {
      const snap = await db
        .collection(VIDEO_LIBRARY_COLLECTION)
        .orderBy("createdAt", "desc")
        .get();
      rows = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    } catch {
      const fallback = await db.collection(VIDEO_LIBRARY_COLLECTION).get();
      rows = fallback.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
      rows.sort(
        (a, b) =>
          (new Date(toIsoOrNull(b.createdAt) || 0).getTime() || 0) -
          (new Date(toIsoOrNull(a.createdAt) || 0).getTime() || 0)
      );
    }

    const payload = rows
      .map((row) => normalizeVideoLibraryRow(row.id, row))
      .filter((row) => row.isActive);

    return successResponse(res, payload, "Video library fetched");
  } catch (e) {
    console.error("getVideoLibrary error:", e);
    return errorResponse(res, "Failed to fetch video library", 500);
  }
};

export const createVideoLibraryItem = async (req, res) => {
  try {
    const {
      title = "",
      url = "",
      hlsUrl = "",
      courseId = "",
      subjectId = "",
      courseName = "",
      teacherId = "",
      teacherName = "",
      isActive = true,
      isLiveSession = false,
      videoMode = "",
      durationSec = 0,
    } = req.body || {};

    if (String(title).trim().length < 3) {
      return errorResponse(res, "title must be at least 3 characters", 400);
    }
    if (!String(url).trim()) {
      return errorResponse(res, "url is required", 400);
    }
    const cleanCourseId = String(courseId || subjectId || "").trim();
    if (!cleanCourseId) {
      return errorResponse(res, "subjectId/courseId is required", 400);
    }

    const [subjectMeta, requestedTeacherSnap] = await Promise.all([
      getCourseMeta(cleanCourseId),
      String(teacherId).trim()
        ? db.collection(COLLECTIONS.TEACHERS).doc(String(teacherId).trim()).get()
        : Promise.resolve(null),
    ]);

    if (!subjectMeta) {
      return errorResponse(res, "Subject not found", 404);
    }
    const subjectCompletionState = await getSubjectCompletionState(cleanCourseId);
    if (subjectCompletionState.locked) {
      return errorResponse(
        res,
        subjectCompletionState.message || PERMANENT_COMPLETION_MESSAGE,
        400,
        { code: "SUBJECT_OR_CLASS_COMPLETED" }
      );
    }

    const subjectTeacherId = String(subjectMeta.teacherId || "").trim();
    const requestedTeacherId = String(teacherId || "").trim();
    const resolvedTeacherId = subjectTeacherId || requestedTeacherId;
    if (!resolvedTeacherId) {
      return errorResponse(res, "Selected subject has no assigned teacher", 400);
    }
    const resolvedTeacherSnap =
      requestedTeacherSnap?.exists && requestedTeacherId === resolvedTeacherId
        ? requestedTeacherSnap
        : await db.collection(COLLECTIONS.TEACHERS).doc(resolvedTeacherId).get();

    const resolvedCourseName =
      String(courseName).trim() ||
      String(subjectMeta.courseName || subjectMeta.subjectName || "").trim() ||
      "Subject";
    const resolvedTeacherName =
      String(teacherName).trim() ||
      String(subjectMeta.teacherName || "").trim() ||
      String(resolvedTeacherSnap?.data?.()?.fullName || "").trim() ||
      String(subjectMeta.teacherName || "").trim() ||
      "Teacher";
    const requestedLive = parseNullableBoolean(isLiveSession);
    const isLiveFlag =
      requestedLive === true ||
      String(videoMode || "").trim().toLowerCase() === "live_session";

    const ref = db.collection(VIDEO_LIBRARY_COLLECTION).doc();
    const payload = {
      title: String(title).trim(),
      url: String(url).trim(),
      hlsUrl: String(hlsUrl || "").trim(),
      courseId: cleanCourseId,
      subjectId: cleanCourseId,
      courseName: resolvedCourseName,
      subjectName: resolvedCourseName,
      teacherId: resolvedTeacherId,
      teacherName: resolvedTeacherName,
      videoMode: isLiveFlag ? "live_session" : "recorded",
      isLiveSession: isLiveFlag,
      durationSec: Math.max(0, toSafeNumber(durationSec, 0)),
      isActive: isActive !== false,
      createdBy: req.user?.uid || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await ref.set(payload);

    return successResponse(
      res,
      normalizeVideoLibraryRow(ref.id, {
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      "Video added to library",
      201
    );
  } catch (e) {
    console.error("createVideoLibraryItem error:", e);
    return errorResponse(res, "Failed to add video to library", 500);
  }
};

export const deleteVideoLibraryItem = async (req, res) => {
  try {
    const videoId = String(req.params?.videoId || req.params?.id || "").trim();
    if (!videoId) return errorResponse(res, "videoId is required", 400);

    const docRef = db.collection(VIDEO_LIBRARY_COLLECTION).doc(videoId);
    const snap = await docRef.get();
    if (!snap.exists) return errorResponse(res, "Video not found", 404);

    const row = snap.data() || {};
    const filePath = String(row.filePath || row.videoPath || "").trim();
    const url = String(row.url || row.videoUrl || "").trim();

    // Best-effort storage cleanup.
    const deleteTargets = [];
    if (filePath) {
      deleteTargets.push(filePath);
    } else if (url) {
      const decoded = decodeURIComponent(url);
      const match = decoded.match(/\/o\/(.+?)(\?|$)/);
      if (match?.[1]) deleteTargets.push(match[1]);
    }

    if (deleteTargets.length > 0) {
      await Promise.allSettled(deleteTargets.map((pathKey) => deleteFile(pathKey)));
    }

    await docRef.delete();

    return successResponse(res, { id: videoId }, "Video deleted");
  } catch (e) {
    return errorResponse(res, "Failed to delete video", 500);
  }
};

export const addCourseContent = async (req, res) => {
  try {
    const { courseId, subjectId } = req.params;
    const {
      type,
      title,
      url,
      videoId,
      liveStartAt,
      size = 0,
      contentType = "",
      noteType = "",
      isLiveSession,
      videoMode: requestedVideoMode,
    } = req.body;

    if (!type) {
      return errorResponse(res, "type is required", 400);
    }

    const allowed = ["video", "pdf", "notes"];
    if (!allowed.includes(type)) {
      return errorResponse(res, "Invalid content type", 400);
    }

    const cleanCourseId = String(courseId || "").trim();
    const cleanSubjectId = String(subjectId || "").trim();
    const subjectCompletionState = await getSubjectCompletionState(cleanCourseId);
    if (subjectCompletionState.locked) {
      return errorResponse(
        res,
        subjectCompletionState.message || PERMANENT_COMPLETION_MESSAGE,
        400,
        { code: "SUBJECT_OR_CLASS_COMPLETED" }
      );
    }

    const [subjectSnap, courseSnap] = await Promise.all([
      db.collection(COLLECTIONS.SUBJECTS).doc(cleanCourseId).get(),
      db.collection(COLLECTIONS.COURSES).doc(cleanCourseId).get(),
    ]);

    let contentCollectionRef = null;
    let parentDocRef = null;
    let subject = null;
    let courseData = {};
    let resolvedSubjectId = cleanSubjectId || cleanCourseId;

    if (subjectSnap.exists) {
      const subjectData = subjectSnap.data() || {};
      contentCollectionRef = subjectSnap.ref.collection("content");
      parentDocRef = subjectSnap.ref;
      subject = {
        id: resolvedSubjectId || cleanCourseId,
        name:
          String(subjectData.title || subjectData.subjectName || "").trim() || "Subject",
        teacherId: String(subjectData.teacherId || "").trim(),
        teacherName: String(subjectData.teacherName || "").trim() || "Teacher",
      };
      courseData = {
        title:
          String(subjectData.title || subjectData.subjectName || "").trim() || "Subject",
      };
      resolvedSubjectId = subject.id;
    } else if (courseSnap.exists) {
      const legacyCourseData = courseSnap.data() || {};
      const subjects = Array.isArray(legacyCourseData.subjects)
        ? legacyCourseData.subjects
        : [];
      subject = subjects.find((item) => item.id === cleanSubjectId);
      if (!subject) {
        return errorResponse(res, "Subject not found", 404);
      }
      contentCollectionRef = courseSnap.ref.collection("content");
      parentDocRef = courseSnap.ref;
      courseData = legacyCourseData;
      resolvedSubjectId = cleanSubjectId;
    } else {
      return errorResponse(res, "Subject/Course not found", 404);
    }

    let resolvedTitle = String(title || "").trim();
    let resolvedUrl = String(url || "").trim();
    const resolvedVideoId = String(videoId || "").trim();
    let resolvedVideoMeta = null;
    if (type === "video" && resolvedVideoId) {
      const videoSnap = await db
        .collection(VIDEO_LIBRARY_COLLECTION)
        .doc(resolvedVideoId)
        .get();
      if (!videoSnap.exists) {
        return errorResponse(res, "Video not found in library", 404);
      }
      const videoData = videoSnap.data() || {};
      resolvedTitle = String(videoData.title || resolvedTitle).trim();
      resolvedUrl = String(videoData.url || "").trim();
      if (!resolvedUrl) {
        return errorResponse(res, "Selected video has no URL", 400);
      }
      resolvedVideoMeta = {
        videoMode: String(videoData.videoMode || "").trim().toLowerCase(),
        isLiveSession: Boolean(videoData.isLiveSession),
        durationSec: Math.max(
          0,
          toSafeNumber(
            videoData.durationSec ?? videoData.videoDurationSec ?? videoData.totalDurationSec,
            0
          )
        ),
      };
    }

    if (!resolvedTitle || !resolvedUrl) {
      return errorResponse(
        res,
        "title and url are required (or pass valid videoId)",
        400
      );
    }

    let videoMode = "recorded";
    let resolvedIsLiveSession = false;
    let resolvedDurationSec = 0;
    if (type === "video") {
      const requestedLive = parseNullableBoolean(isLiveSession);
      const requestedMode = String(requestedVideoMode || "").trim().toLowerCase();
      let preferredLive = null;

      if (requestedLive !== null) {
        preferredLive = requestedLive;
      } else if (requestedMode === "live_session") {
        preferredLive = true;
      } else if (requestedMode === "recorded") {
        preferredLive = false;
      } else if (resolvedVideoMeta) {
        preferredLive =
          resolvedVideoMeta.videoMode === "live_session" ||
          resolvedVideoMeta.isLiveSession === true;
      }

      const existingContentSnap = await db
        .collection(parentDocRef.parent.id)
        .doc(parentDocRef.id)
        .collection("content")
        .where("subjectId", "==", resolvedSubjectId)
        .where("type", "==", "video")
        .limit(1)
        .get();
      const isFirstSubjectVideo = existingContentSnap.empty;

      if (isFirstSubjectVideo) {
        resolvedIsLiveSession = true;
        videoMode = "live_session";
      } else {
        resolvedIsLiveSession = preferredLive === true;
        videoMode = resolvedIsLiveSession ? "live_session" : "recorded";
      }

      resolvedDurationSec = Math.max(0, toSafeNumber(resolvedVideoMeta?.durationSec, 0));
    }

    const parseDateValue = (value) => {
      if (!value) return null;
      const raw = String(value || "").trim();
      // Accept local Pakistan datetime strings without timezone ("2026-04-11T14:34:00")
      // and interpret them as Asia/Karachi.
      if (/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}/.test(raw) && !/Z$|[+-]\\d{2}:\\d{2}$/.test(raw)) {
        const normalized = raw.length === 16 ? `${raw}:00` : raw;
        const parsedPk = new Date(`${normalized}+05:00`);
        return Number.isNaN(parsedPk.getTime()) ? null : parsedPk;
      }
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const resolvedLiveStart = resolvedIsLiveSession ? parseDateValue(liveStartAt) : null;
    if (resolvedIsLiveSession && liveStartAt && !resolvedLiveStart) {
      return errorResponse(res, "liveStartAt must be a valid ISO date", 400);
    }
    const resolvedLiveEnd = 
      resolvedIsLiveSession && resolvedLiveStart 
        ? resolvedDurationSec > 0
          ? new Date(resolvedLiveStart.getTime() + resolvedDurationSec * 1000)
          : null
        : null; 

    const formatPkDateTimeLocal = (date) => {
      if (!date) return null;
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Karachi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        hourCycle: "h23",
      });
      const parts = formatter.formatToParts(date);
      const year = parts.find((p) => p.type === "year")?.value;
      const month = parts.find((p) => p.type === "month")?.value;
      const day = parts.find((p) => p.type === "day")?.value;
      const hour = parts.find((p) => p.type === "hour")?.value;
      const minute = parts.find((p) => p.type === "minute")?.value;
      const second = parts.find((p) => p.type === "second")?.value;
      if (!year || !month || !day || !hour || !minute || !second) return null;
      return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    };

    const contentData = {
      id: uuidv4(),
      subjectId: resolvedSubjectId,
      type,
      title: resolvedTitle,
      url: resolvedUrl,
      videoId: resolvedVideoId || null,
      videoMode,
      isLiveSession: resolvedIsLiveSession,
      durationSec: resolvedDurationSec,
      // Single source of truth: durationSec. Do not store a second duration string field.
      liveStartAt: resolvedLiveStart ? formatPkDateTimeLocal(resolvedLiveStart) : null,
      liveEndAt: resolvedLiveEnd ? formatPkDateTimeLocal(resolvedLiveEnd) : null,
      premiereEndedAt: null,
      size: toSafeNumber(size, 0),
      contentType: contentType || "",
      noteType: noteType || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await contentCollectionRef.doc(contentData.id).set(contentData);

    await parentDocRef.update({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (type === "video") {
      try {
        const actorName =
          String(req.user?.fullName || req.user?.name || req.user?.email || "")
            .trim()
            .split("@")[0] || "Admin";
        await createCourseStudentAnnouncement({
          title: `New Video Added: ${resolvedTitle}`,
          message: `${resolvedTitle} was added to ${
            String(subject?.name || "a subject").trim() || "your subject"
          } in ${String(courseData?.title || "your course").trim()}.`,
          courseId: cleanCourseId,
          courseName: String(courseData?.title || "").trim(),
          postedBy: req.user?.uid || "",
          postedByName: actorName,
          postedByRole: "admin",
        });
      } catch (announcementError) {
        console.error("addCourseContent announcement error:", announcementError);
      }
    }

    return successResponse(res, contentData, "Content added", 201);
  } catch (e) {
    return errorResponse(res, "Failed to add content", 500);
  }
};

export const getCourseContent = async (req, res) => {
  try {
    const { courseId } = req.params;
    const cleanCourseId = String(courseId || "").trim();
    const [subjectSnap, courseSnap] = await Promise.all([
      db.collection(COLLECTIONS.SUBJECTS).doc(cleanCourseId).get(),
      db.collection(COLLECTIONS.COURSES).doc(cleanCourseId).get(),
    ]);

    let subjects = [];
    let contentSnap = null;
    if (subjectSnap.exists) {
      const subjectData = subjectSnap.data() || {};
      subjects = [
        {
          id: cleanCourseId,
          name:
            String(subjectData.title || subjectData.subjectName || "").trim() || "Subject",
          teacherId: String(subjectData.teacherId || "").trim(),
          teacherName: String(subjectData.teacherName || "").trim() || "Teacher",
          order: 1,
        },
      ];
      contentSnap = await subjectSnap.ref.collection("content").get();
    } else if (courseSnap.exists) {
      const courseData = courseSnap.data() || {};
      subjects = Array.isArray(courseData.subjects) ? courseData.subjects : [];
      contentSnap = await courseSnap.ref.collection("content").get();
    } else {
      return errorResponse(res, "Subject/Course not found", 404);
    }

    const grouped = {};
    subjects.forEach((subject) => {
      grouped[subject.id] = {
        ...subject,
        content: [],
      };
    });

    contentSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (!grouped[data.subjectId]) {
        grouped[data.subjectId] = {
          id: data.subjectId,
          name: "Unknown Subject",
          teacherId: "",
          teacherName: "",
          order: 999,
          content: [],
        };
      }
      grouped[data.subjectId].content.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      });
    });

    const result = Object.values(grouped).sort(
      (a, b) => Number(a.order || 0) - Number(b.order || 0)
    );

    return successResponse(res, result, "Subject content fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch course content", 500);
  }
};

export const deleteCourseContent = async (req, res) => {
  try {
    const { courseId, contentId } = req.params;
    const cleanCourseId = String(courseId || "").trim();
    const cleanContentId = String(contentId || "").trim();

    const [subjectSnap, courseSnap] = await Promise.all([
      db.collection(COLLECTIONS.SUBJECTS).doc(cleanCourseId).get(),
      db.collection(COLLECTIONS.COURSES).doc(cleanCourseId).get(),
    ]);

    let deleted = false;
    if (subjectSnap.exists) {
      const subjectContentRef = subjectSnap.ref.collection("content").doc(cleanContentId);
      const subjectContentSnap = await subjectContentRef.get();
      if (subjectContentSnap.exists) {
        await subjectContentRef.delete();
        await subjectSnap.ref.update({
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        deleted = true;
      }
    }

    if (!deleted && courseSnap.exists) {
      const courseContentRef = courseSnap.ref.collection("content").doc(cleanContentId);
      const courseContentSnap = await courseContentRef.get();
      if (courseContentSnap.exists) {
        await courseContentRef.delete();
        await courseSnap.ref.update({
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        deleted = true;
      }
    }

    if (!deleted) {
      return errorResponse(res, "Content not found", 404);
    }

    return successResponse(res, { contentId: cleanContentId }, "Content deleted");
  } catch (e) {
    return errorResponse(res, "Failed to delete content", 500);
  }
};

export const getClasses = async (req, res) => {
  try {
    const data = await adminService.getAllClasses();
    return successResponse(res, data, "Classes fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch classes", 500);
  }
};

export const createClass = async (req, res) => {
  try {
    const {
      name = "",
      batchCode = "",
      description = "",
      status = "upcoming",
      capacity,
      startDate,
      endDate,
      assignedSubjects = [],
      assignedCourses = [],
      shifts = [],
      price,
    } = req.body;

    if (String(name).trim().length < 3) {
      return errorResponse(res, "Class name must be at least 3 characters", 400);
    }

    const parsedCapacity = Number(capacity);
    if (!Number.isFinite(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 1000) {
      return errorResponse(res, "Capacity must be between 1 and 1000", 400);
    }

    const dateError = validateClassDates(startDate, endDate, true);
    if (dateError) {
      return errorResponse(res, dateError, 400);
    }

    const resolvedCourses = await buildAssignedCourses(
      Array.isArray(assignedSubjects) && assignedSubjects.length > 0
        ? assignedSubjects
        : assignedCourses
    );
    if (resolvedCourses.length < 1) {
      return errorResponse(res, "At least 1 subject is required", 400);
    }

    const normalizedShifts = [];
    if (Array.isArray(shifts) && shifts.length > 0) {
      for (const shift of shifts) {
        const resolved = await buildShiftPayload(shift, resolvedCourses, startDate);
        if (resolved.error) {
          return errorResponse(res, resolved.error, 400);
        }
        normalizedShifts.push(resolved.data);
      }
    }

    if (normalizedShifts.length > 0) {
      const missingShiftCourses = getMissingShiftCourseNames(
        resolvedCourses,
        normalizedShifts
      );
      if (missingShiftCourses.length > 0) {
        return errorResponse(
          res,
          `Add at least one shift for each assigned subject. Missing schedule for: ${missingShiftCourses.join(
            ", "
          )}`,
          400
        );
      }
    }

    const classPrice = Math.max(0, toSafeNumber(price, 0));
    const classPricing = {
      totalPrice: classPrice,
      coursesCount: resolvedCourses.length,
    };

    const classPayload = {
      name: String(name).trim(),
      batchCode: String(batchCode).trim() || generateBatchCode(name),
      description: String(description || "").trim(),
      status: normalizeStatus(status),
      capacity: parsedCapacity,
      enrolledCount: 0,
      students: [],
      assignedSubjects: resolvedCourses.map((row) => ({
        ...row,
        subjectId: row.courseId,
        subjectName: row.courseName,
      })),
      assignedCourses: resolvedCourses,
      price: classPricing.totalPrice,
      totalPrice: classPricing.totalPrice,
      coursesCount: classPricing.coursesCount,
      subjectsCount: classPricing.coursesCount,
      priceCalculatedAt: admin.firestore.FieldValue.serverTimestamp(),
      shifts: normalizedShifts,
      teachers: collectTeachersFromShifts(normalizedShifts),
      startDate,
      endDate,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection(COLLECTIONS.CLASSES).add(classPayload);

    return successResponse(res, { id: ref.id, ...classPayload }, "Class created", 201);
  } catch (e) {
    return errorResponse(res, "Failed to create class", 500);
  }
};

export const updateClass = async (req, res) => {
  try {
    const { classId } = req.params;

    const classRef = db.collection(COLLECTIONS.CLASSES).doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists) {
      return errorResponse(res, "Class not found", 404);
    }

    const classData = classSnap.data() || {};
    const updates = {};

    if (req.body.name !== undefined) {
      if (String(req.body.name).trim().length < 3) {
        return errorResponse(res, "Class name must be at least 3 characters", 400);
      }
      updates.name = String(req.body.name).trim();
    }

    if (req.body.description !== undefined) {
      updates.description = String(req.body.description || "").trim();
    }

    if (req.body.status !== undefined) {
      updates.status = normalizeStatus(req.body.status);
    }

    if (req.body.capacity !== undefined) {
      const parsedCapacity = Number(req.body.capacity);
      if (!Number.isFinite(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 1000) {
        return errorResponse(res, "Capacity must be between 1 and 1000", 400);
      }
      if (parsedCapacity < Number(classData.enrolledCount || 0)) {
        return errorResponse(
          res,
          "Capacity cannot be smaller than current enrolled students",
          400
        );
      }
      updates.capacity = parsedCapacity;
    }

    if (req.body.price !== undefined) {
      const parsedPrice = Math.max(0, toSafeNumber(req.body.price, 0));
      updates.price = parsedPrice;
      updates.totalPrice = parsedPrice;
      updates.priceUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    const nextStartDate =
      req.body.startDate !== undefined ? req.body.startDate : classData.startDate;
    const nextEndDate =
      req.body.endDate !== undefined ? req.body.endDate : classData.endDate;

    if (req.body.startDate !== undefined || req.body.endDate !== undefined) {
      const dateError = validateClassDates(
        nextStartDate,
        nextEndDate,
        req.body.startDate !== undefined
      );
      if (dateError) {
        return errorResponse(res, dateError, 400);
      }
      updates.startDate = nextStartDate;
      updates.endDate = nextEndDate;
    }

    const existingAssignedSubjects = Array.isArray(classData.assignedSubjects)
      ? classData.assignedSubjects
      : [];
    const existingAssignedCourses = Array.isArray(classData.assignedCourses)
      ? classData.assignedCourses
      : [];
    const existingShifts = Array.isArray(classData.shifts) ? classData.shifts : [];

    let nextAssignedCourses =
      existingAssignedSubjects.length > 0 ? existingAssignedSubjects : existingAssignedCourses;
    if (req.body.assignedCourses !== undefined || req.body.assignedSubjects !== undefined) {
      const incomingAssigned =
        req.body.assignedSubjects !== undefined
          ? req.body.assignedSubjects
          : req.body.assignedCourses;
      nextAssignedCourses = await buildAssignedCourses(incomingAssigned);
      if (nextAssignedCourses.length < 1) {
        return errorResponse(res, "At least 1 subject is required", 400);
      }
      updates.assignedSubjects = nextAssignedCourses.map((row) => ({
        ...row,
        subjectId: row.courseId,
        subjectName: row.courseName,
      }));
      updates.assignedCourses = nextAssignedCourses;
    }

    let nextShifts = existingShifts;
    if (req.body.shifts !== undefined) {
      if (!Array.isArray(req.body.shifts)) {
        return errorResponse(res, "shifts must be an array", 400);
      }
      const rebuiltShifts = [];
      for (const shift of req.body.shifts) {
        const resolved = await buildShiftPayload(shift, nextAssignedCourses, nextStartDate);
        if (resolved.error) {
          return errorResponse(res, resolved.error, 400);
        }
        rebuiltShifts.push(resolved.data);
      }
      nextShifts = rebuiltShifts;
      updates.shifts = nextShifts;
    } else if (req.body.assignedCourses !== undefined || req.body.assignedSubjects !== undefined) {
      const assignedCourseIds = new Set(
        nextAssignedCourses.map((course) => course.courseId).filter(Boolean)
      );
      const hasInvalidShift = existingShifts.some(
        (shift) => !assignedCourseIds.has(shift.subjectId || shift.courseId)
      );
      if (hasInvalidShift) {
        return errorResponse(
          res,
          "Remove or update shifts that use removed subjects first",
          400
        );
      }
    }

    const todayShiftError = nextShifts
      .map((shift) => validateShiftStartWindowForToday(nextStartDate, shift?.startTime))
      .find(Boolean);
    if (todayShiftError) {
      return errorResponse(res, todayShiftError, 400);
    }

    if (nextShifts.length > 0) {
      const missingShiftCourses = getMissingShiftCourseNames(
        nextAssignedCourses,
        nextShifts
      );
      if (missingShiftCourses.length > 0) {
        return errorResponse(
          res,
          `Add at least one shift for each assigned subject. Missing schedule for: ${missingShiftCourses.join(
            ", "
          )}`,
          400
        );
      }
    }

    if (req.body.batchCode !== undefined) {
      updates.batchCode =
        String(req.body.batchCode || "").trim() ||
        String(classData.batchCode || generateBatchCode(updates.name || classData.name));
    }

    updates.coursesCount = nextAssignedCourses.length;
    updates.subjectsCount = nextAssignedCourses.length;

    updates.teachers = collectTeachersFromShifts(nextShifts);
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await classRef.update(updates);
    return successResponse(res, { classId }, "Class updated");
  } catch (e) {
    return errorResponse(res, "Failed to update class", 500);
  }
};

export const reopenClass = async (req, res) => {
  try {
    const classId = String(req.params?.classId || req.params?.id || "").trim();
    if (!classId) return errorResponse(res, "classId is required", 400);

    const classRef = db.collection(COLLECTIONS.CLASSES).doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists) return errorResponse(res, "Class not found", 404);

    const classData = classSnap.data() || {};
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const endDate = normalizeDateValue(classData.endDate);
    const endInPast = endDate ? endDate.getTime() < today.getTime() : true;
    const nextEnd = new Date(today);
    nextEnd.setDate(nextEnd.getDate() + 30);
    const nextEndKey = nextEnd.toISOString().slice(0, 10);

    const updates = {
      status: "active",
      startDate: classData.startDate || todayKey,
      endDate: endInPast ? nextEndKey : classData.endDate || nextEndKey,
      reopenedAt: admin.firestore.FieldValue.serverTimestamp(),
      reopenedBy: req.user?.uid || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await classRef.set(updates, { merge: true });
    return successResponse(
      res,
      {
        classId,
        startDate: updates.startDate,
        endDate: updates.endDate,
        status: updates.status,
      },
      "Class reopened successfully"
    );
  } catch (e) {
    console.error("reopenClass error:", e);
    return errorResponse(res, "Failed to reopen class", 500);
  }
};

export const deleteClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
    if (!classSnap.exists) {
      return errorResponse(res, "Class not found", 404);
    }
    const classData = classSnap.data() || {};
    const students = Array.isArray(classData.students) ? classData.students : [];
    const enrolledCount = Number(classData.enrolledCount || 0);
    const assignedSubjects = Array.isArray(classData.assignedSubjects)
      ? classData.assignedSubjects
      : [];
    const assignedCourses = Array.isArray(classData.assignedCourses)
      ? classData.assignedCourses
      : [];
    const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
    const teachers = Array.isArray(classData.teachers) ? classData.teachers : [];

    if (
      enrolledCount > 0 ||
      students.length > 0 ||
      assignedSubjects.length > 0 ||
      assignedCourses.length > 0 ||
      shifts.length > 0 ||
      teachers.length > 0
    ) {
      return errorResponse(
        res,
        "Cannot delete class while it has students, subjects, shifts, or teachers assigned",
        400
      );
    }
    await db.collection(COLLECTIONS.CLASSES).doc(classId).delete();
    return successResponse(res, { classId }, "Class deleted");
  } catch (e) {
    return errorResponse(res, "Failed to delete class", 500);
  }
};

export const addClassCourse = async (req, res) => {
  try {
    const { classId } = req.params;
    const courseId = String(req.body?.courseId || req.body?.subjectId || "").trim();

    if (!courseId) {
      return errorResponse(res, "subjectId/courseId is required", 400);
    }

    const classRef = db.collection(COLLECTIONS.CLASSES).doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists) {
      return errorResponse(res, "Class not found", 404);
    }

    const classData = classSnap.data() || {};
    const assignedSubjects = Array.isArray(classData.assignedSubjects)
      ? classData.assignedSubjects
      : [];
    const assignedCourses = Array.isArray(classData.assignedCourses)
      ? classData.assignedCourses
      : [];
    const allAssigned = [...assignedSubjects, ...assignedCourses];
    if (allAssigned.some((course) => String(course?.subjectId || course?.courseId || "").trim() === courseId)) {
      return errorResponse(res, "Subject already assigned to class", 409);
    }

    const courseMeta = await getCourseMeta(courseId);
    if (!courseMeta) {
      return errorResponse(res, "Subject not found", 404);
    }

    assignedCourses.push(courseMeta);
    assignedSubjects.push({
      ...courseMeta,
      subjectId: courseMeta.courseId,
      subjectName: courseMeta.courseName,
    });
    await classRef.update({
      assignedSubjects,
      assignedCourses,
      coursesCount: assignedCourses.length,
      subjectsCount: assignedCourses.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(
      res,
      { ...courseMeta, subjectId: courseMeta.courseId, subjectName: courseMeta.courseName },
      "Subject assigned to class",
      201
    );
  } catch (e) {
    return errorResponse(res, "Failed to assign subject", 500);
  }
};

export const removeClassCourse = async (req, res) => {
  try {
    const { classId } = req.params;
    const courseId = String(req.params?.courseId || req.params?.subjectId || "").trim();

    const classRef = db.collection(COLLECTIONS.CLASSES).doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists) {
      return errorResponse(res, "Class not found", 404);
    }

    const classData = classSnap.data() || {};
    const assignedSubjects = Array.isArray(classData.assignedSubjects)
      ? classData.assignedSubjects
      : [];
    const assignedCourses = Array.isArray(classData.assignedCourses)
      ? classData.assignedCourses
      : [];
    const nextAssignedSubjects = assignedSubjects.filter(
      (course) => String(course?.subjectId || course?.courseId || "").trim() !== courseId
    );
    const nextAssignedCourses = assignedCourses.filter(
      (course) => String(course?.subjectId || course?.courseId || "").trim() !== courseId
    );
    if (
      nextAssignedCourses.length === assignedCourses.length &&
      nextAssignedSubjects.length === assignedSubjects.length
    ) {
      return errorResponse(res, "Subject not assigned to class", 404);
    }

    const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
    const hasCourseShift = shifts.some(
      (shift) => String(shift?.subjectId || shift?.courseId || "").trim() === courseId
    );
    if (hasCourseShift) {
      return errorResponse(
        res,
        "Remove shifts linked to this subject first",
        400
      );
    }

    await classRef.update({
      assignedSubjects: nextAssignedSubjects,
      assignedCourses: nextAssignedCourses,
      coursesCount: nextAssignedCourses.length,
      subjectsCount: nextAssignedCourses.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(res, { subjectId: courseId, courseId }, "Subject removed from class");
  } catch (e) {
    return errorResponse(res, "Failed to remove subject", 500);
  }
};

export const addClassShift = async (req, res) => {
  try {
    const { classId } = req.params;

    const classRef = db.collection(COLLECTIONS.CLASSES).doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists) {
      return errorResponse(res, "Class not found", 404);
    }

    const classData = classSnap.data() || {};
    const assignedCourses = Array.isArray(classData.assignedSubjects)
      ? classData.assignedSubjects
      : Array.isArray(classData.assignedCourses)
        ? classData.assignedCourses
        : [];
    if (assignedCourses.length < 1) {
      return errorResponse(res, "Assign at least one subject before adding shifts", 400);
    }

    const resolved = await buildShiftPayload(
      req.body,
      assignedCourses,
      classData.startDate
    );
    if (resolved.error) {
      return errorResponse(res, resolved.error, 400);
    }

    const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
    shifts.push(resolved.data);

    await classRef.update({
      shifts,
      teachers: collectTeachersFromShifts(shifts),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(res, resolved.data, "Shift added", 201);
  } catch (e) {
    return errorResponse(res, "Failed to add shift", 500);
  }
};

export const updateClassShift = async (req, res) => {
  try {
    const { classId, shiftId } = req.params;

    const classRef = db.collection(COLLECTIONS.CLASSES).doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists) {
      return errorResponse(res, "Class not found", 404);
    }

    const classData = classSnap.data() || {};
    const assignedCourses = Array.isArray(classData.assignedCourses)
      ? classData.assignedCourses
      : [];
    const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
    const currentShift = shifts.find((shift) => shift.id === shiftId);
    if (!currentShift) {
      return errorResponse(res, "Shift not found", 404);
    }

    const resolved = await buildShiftPayload(
      { ...currentShift, ...req.body, id: currentShift.id },
      assignedCourses,
      classData.startDate
    );
    if (resolved.error) {
      return errorResponse(res, resolved.error, 400);
    }

    const nextShifts = shifts.map((shift) =>
      shift.id === shiftId ? resolved.data : shift
    );

    await classRef.update({
      shifts: nextShifts,
      teachers: collectTeachersFromShifts(nextShifts),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(res, resolved.data, "Shift updated");
  } catch (e) {
    return errorResponse(res, "Failed to update shift", 500);
  }
};

export const removeClassShift = async (req, res) => {
  try {
    const { classId, shiftId } = req.params;

    const classRef = db.collection(COLLECTIONS.CLASSES).doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists) {
      return errorResponse(res, "Class not found", 404);
    }

    const classData = classSnap.data() || {};
    const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
    const nextShifts = shifts.filter((shift) => shift.id !== shiftId);
    if (nextShifts.length === shifts.length) {
      return errorResponse(res, "Shift not found", 404);
    }

    const students = Array.isArray(classData.students) ? classData.students : [];
    const hasShiftStudents = students.some((entry) => {
      const row = typeof entry === "string" ? { studentId: entry } : entry || {};
      return row.shiftId === shiftId;
    });
    if (hasShiftStudents) {
      return errorResponse(
        res,
        "Remove students from this shift before deleting it",
        400
      );
    }

    await classRef.update({
      shifts: nextShifts,
      teachers: collectTeachersFromShifts(nextShifts),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(res, { shiftId }, "Shift removed");
  } catch (e) {
    return errorResponse(res, "Failed to remove shift", 500);
  }
};

const normalizeClassStudentEntries = (students = []) =>
  students
    .map((entry) =>
      typeof entry === "string"
        ? { studentId: String(entry).trim(), shiftId: "", courseId: "", enrolledAt: null }
        : {
            studentId: String(entry?.studentId || entry?.id || entry?.uid || "").trim(),
            shiftId: String(entry?.shiftId || "").trim(),
            courseId: String(entry?.subjectId || entry?.courseId || "").trim(),
            enrolledAt: entry?.enrolledAt || null,
          }
    )
    .filter((entry) => Boolean(entry.studentId));

const getClassAssignedCourseIds = (classData = {}) => {
  const ids = [];
  const assignedSubjects = Array.isArray(classData.assignedSubjects)
    ? classData.assignedSubjects
    : [];
  assignedSubjects.forEach((entry) => {
    const subjectId =
      typeof entry === "string"
        ? String(entry || "").trim()
        : String(entry?.subjectId || entry?.id || "").trim();
    if (subjectId) ids.push(subjectId);
  });

  const assignedCourses = Array.isArray(classData.assignedCourses)
    ? classData.assignedCourses
    : [];
  assignedCourses.forEach((entry) => {
    const courseId =
      typeof entry === "string"
        ? String(entry || "").trim()
        : String(entry?.subjectId || entry?.courseId || entry?.id || "").trim();
    if (courseId) ids.push(courseId);
  });

  const classCourseId = String(classData.courseId || "").trim();
  if (classCourseId) ids.push(classCourseId);

  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  shifts.forEach((shift) => {
    const shiftCourseId = String(shift?.subjectId || shift?.courseId || "").trim();
    if (shiftCourseId) ids.push(shiftCourseId);
  });

  return [...new Set(ids)];
};

const buildKnownError = (message, meta = {}) => {
  const error = new Error(message);
  error.meta = meta;
  return error;
};

const normalizeEnrollmentType = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "single_course") return "single_course";
  return "full_class";
};

const ACTIVE_ENROLLMENT_STATUS_SET = new Set([
  "",
  "active",
  "upcoming",
  "completed",
  "pending_review",
]);

const enrollStudentInClassCore = async ({
  classId,
  studentId,
  shiftId = "",
  enrollmentType = "full_class",
  courseId = "",
  paymentId = "",
}) => {
  const cleanClassId = String(classId || "").trim();
  const cleanStudentId = String(studentId || "").trim();
  const cleanShiftId = String(shiftId || "").trim();
  const cleanCourseId = String(courseId || "").trim();
  const cleanPaymentId = String(paymentId || "").trim();
  const normalizedEnrollmentType = normalizeEnrollmentType(enrollmentType);
  if (normalizedEnrollmentType === "single_course") {
    throw buildKnownError("SINGLE_COURSE_DISABLED");
  }
  if (!cleanClassId) throw buildKnownError("CLASS_NOT_FOUND");
  if (!cleanStudentId) throw buildKnownError("STUDENT_REQUIRED");
  if (
    normalizedEnrollmentType === "single_course" &&
    !cleanCourseId
  ) {
    throw buildKnownError("COURSE_REQUIRED");
  }

  let result = null;

  await db.runTransaction(async (transaction) => {
    const classRef = db.collection(COLLECTIONS.CLASSES).doc(cleanClassId);
    const studentRef = db.collection(COLLECTIONS.STUDENTS).doc(cleanStudentId);
    const userRef = db.collection(COLLECTIONS.USERS).doc(cleanStudentId);

    const [classSnap, studentSnap, userSnap] = await Promise.all([
      transaction.get(classRef),
      transaction.get(studentRef),
      transaction.get(userRef),
    ]);

    if (!classSnap.exists) {
      throw buildKnownError("CLASS_NOT_FOUND");
    }
    if (!studentSnap.exists || !userSnap.exists || userSnap.data()?.role !== "student") {
      throw buildKnownError("STUDENT_NOT_FOUND");
    }

    const classData = classSnap.data() || {};
    const className = String(classData.name || "").trim();
    const normalizedStudents = normalizeClassStudentEntries(
      Array.isArray(classData.students) ? classData.students : []
    );
    const currentCount = normalizedStudents.length;
    const capacity = Math.max(Number(classData.capacity || 30), 1);
    const alreadyInClass = normalizedStudents.some(
      (entry) => entry.studentId === cleanStudentId
    );

    const classWindowStatus = getClassLifecycleStatus(classData, currentCount, capacity);
    if (classWindowStatus === "completed") {
      throw buildKnownError("CLASS_COMPLETED");
    }
    if (classWindowStatus === "expired") {
      throw buildKnownError("CLASS_EXPIRED");
    }

    if (!alreadyInClass && currentCount >= capacity) {
      throw buildKnownError("CLASS_FULL", { capacity, currentCount });
    }

    const enrollmentStatus =
      classWindowStatus === "upcoming" ? "upcoming" : "active";

    const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
    const selectedShift = cleanShiftId
      ? shifts.find((shift) => String(shift?.id || "").trim() === cleanShiftId)
      : shifts[0] || null;
    if (cleanShiftId && !selectedShift) {
      throw buildKnownError("SHIFT_NOT_FOUND");
    }

    const assignedCourseIds = getClassAssignedCourseIds(classData);
    if (!assignedCourseIds.length) {
      throw buildKnownError("CLASS_HAS_NO_SUBJECTS");
    }
    if (
      normalizedEnrollmentType === "single_course" &&
      !assignedCourseIds.includes(cleanCourseId)
    ) {
      throw buildKnownError("COURSE_NOT_IN_CLASS");
    }
    if (
      normalizedEnrollmentType === "single_course" &&
      selectedShift &&
      String(selectedShift?.subjectId || selectedShift?.courseId || "").trim() &&
      String(selectedShift?.subjectId || selectedShift?.courseId || "").trim() !== cleanCourseId
    ) {
      throw buildKnownError("SHIFT_COURSE_MISMATCH");
    }
    const targetCourseIds =
      normalizedEnrollmentType === "single_course"
        ? [cleanCourseId]
        : assignedCourseIds;

    const completedSubjectIds = [];
    for (const courseIdRow of targetCourseIds) {
      const [subjectSnap, courseSnap] = await Promise.all([
        transaction.get(db.collection(COLLECTIONS.SUBJECTS).doc(courseIdRow)),
        transaction.get(db.collection(COLLECTIONS.COURSES).doc(courseIdRow)),
      ]);
      const rowData = subjectSnap.exists
        ? subjectSnap.data() || {}
        : courseSnap.exists
          ? courseSnap.data() || {}
          : {};
      if (isMarkedCompletedState(rowData)) {
        completedSubjectIds.push(courseIdRow);
      }
    }
    if (completedSubjectIds.length > 0) {
      throw buildKnownError("SUBJECT_COMPLETED", {
        subjectIds: completedSubjectIds,
      });
    }

    const enrollmentQuery = db
      .collection(COLLECTIONS.ENROLLMENTS)
      .where("studentId", "==", cleanStudentId);
    const enrollmentSnap = await transaction.get(enrollmentQuery);
    const existingRows = enrollmentSnap.docs.map((doc) => ({
      ref: doc.ref,
      data: doc.data() || {},
    }));

    const missingCourseIds = targetCourseIds.filter((courseIdRow) => {
      const existingEnrollment = existingRows.find((row) => {
        const existingCourseId = String(
          row.data?.subjectId || row.data?.courseId || ""
        ).trim();
        const existingClassId = String(row.data?.classId || "").trim();
        const status = String(row.data?.status || "").trim().toLowerCase();
        return (
          existingCourseId === courseIdRow &&
          existingClassId === cleanClassId &&
          ACTIVE_ENROLLMENT_STATUS_SET.has(status)
        );
      });
      return !existingEnrollment;
    });

    if (missingCourseIds.length < 1) {
      throw buildKnownError("ALREADY_ENROLLED", {
        enrollmentType: normalizedEnrollmentType,
      });
    }

    const enrolledAt = new Date().toISOString();
    const selectedCourseForStudentRow =
      normalizedEnrollmentType === "single_course"
        ? cleanCourseId
        : String(selectedShift?.subjectId || selectedShift?.courseId || "").trim() ||
          targetCourseIds[0] ||
          "";

    let nextStudents = normalizedStudents;
    if (!alreadyInClass) {
      nextStudents = [
        ...normalizedStudents,
        {
          studentId: cleanStudentId,
          shiftId: String(selectedShift?.id || "").trim(),
          courseId: selectedCourseForStudentRow,
          enrolledAt,
        },
      ];
      transaction.update(classRef, {
        students: nextStudents,
        enrolledCount: nextStudents.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    let createdEnrollmentCount = 0;
    for (const courseIdRow of targetCourseIds) {
      const existingEnrollment = existingRows.find((row) => {
        const existingCourseId = String(
          row.data?.subjectId || row.data?.courseId || ""
        ).trim();
        const existingClassId = String(row.data?.classId || "").trim();
        return existingCourseId === courseIdRow && existingClassId === cleanClassId;
      });

      if (existingEnrollment) {
        const existingData = existingEnrollment.data || {};
        const mergedStatus = mergeEnrollmentStatus(
          existingData.status,
          enrollmentStatus
        );
        const mergedEnrollmentType =
          normalizeEnrollmentType(existingData.enrollmentType) === "full_class" ||
          normalizedEnrollmentType === "full_class"
            ? "full_class"
            : "single_course";
        transaction.set(
          existingEnrollment.ref,
          {
            subjectId: courseIdRow,
            classId: cleanClassId,
            shiftId: String(selectedShift?.id || "").trim(),
            status: mergedStatus,
            paymentId: cleanPaymentId || existingData.paymentId || null,
            enrollmentType: mergedEnrollmentType,
            classStartDate: classData.startDate || null,
            classEndDate: classData.endDate || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        continue;
      }

      const enrollmentRef = db.collection(COLLECTIONS.ENROLLMENTS).doc();
      transaction.set(enrollmentRef, {
        studentId: cleanStudentId,
        subjectId: courseIdRow,
        courseId: courseIdRow,
        classId: cleanClassId,
        shiftId: String(selectedShift?.id || "").trim() || null,
        paymentId: cleanPaymentId || null,
        enrollmentType: normalizedEnrollmentType,
        status: enrollmentStatus,
        progress: 0,
        completedAt: null,
        enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
        classStartDate: classData.startDate || null,
        classEndDate: classData.endDate || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source:
          normalizedEnrollmentType === "full_class"
            ? "class_enrollment"
            : "single_course_enrollment",
      });

      transaction.set(
        db.collection(COLLECTIONS.SUBJECTS).doc(courseIdRow),
        {
          enrollmentCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      transaction.set(
        db.collection(COLLECTIONS.COURSES).doc(courseIdRow),
        {
          enrollmentCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      createdEnrollmentCount += 1;
    }

    const studentUpdates = {
      enrolledClasses: admin.firestore.FieldValue.arrayUnion(cleanClassId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (targetCourseIds.length > 0) {
      studentUpdates.enrolledCourses = admin.firestore.FieldValue.arrayUnion(
        ...targetCourseIds
      );
      studentUpdates.enrolledSubjects = admin.firestore.FieldValue.arrayUnion(
        ...targetCourseIds
      );
    }
    transaction.set(studentRef, studentUpdates, { merge: true });

    result = {
      classId: cleanClassId,
      className,
      studentId: cleanStudentId,
      enrollmentType: normalizedEnrollmentType,
      subjectsEnrolled: targetCourseIds.length,
      coursesEnrolled: targetCourseIds.length,
      createdEnrollments: createdEnrollmentCount,
      remainingCapacity: Math.max(
        capacity - (alreadyInClass ? currentCount : nextStudents.length),
        0
      ),
      capacity,
      currentCount: alreadyInClass ? currentCount : nextStudents.length,
      shiftId: String(selectedShift?.id || "").trim() || null,
      classStatus: classWindowStatus,
      courseId:
        normalizedEnrollmentType === "single_course" ? cleanCourseId : null,
      subjectId:
        normalizedEnrollmentType === "single_course" ? cleanCourseId : null,
    };
  });

  return result;
};

export const addStudentToClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const actorRole = req.user?.role;
    const requestedStudentId = String(req.body?.studentId || "").trim();
    const studentId =
      actorRole === "student"
        ? req.user.uid
        : requestedStudentId;
    const shiftId = String(req.body?.shiftId || "").trim();
    const enrollmentType = normalizeEnrollmentType(req.body?.enrollmentType);
    const courseId = String(req.body?.courseId || req.body?.subjectId || "").trim();
    const paymentId = String(req.body?.paymentId || "").trim();

    if (!studentId) {
      return errorResponse(res, "studentId is required", 400);
    }
    if (!shiftId) {
      return errorResponse(res, "shiftId is required", 400);
    }
    if (enrollmentType !== "full_class") {
      return errorResponse(
        res,
        "Single subject enrollment is disabled. Use full_class enrollment.",
        400
      );
    }

    const result = await enrollStudentInClassCore({
      classId,
      studentId,
      shiftId,
      enrollmentType,
      courseId,
      paymentId,
    });

    return successResponse(
      res,
      result,
      `Student enrolled in ${result.className || "class"}! Access granted to ${result.subjectsEnrolled || result.coursesEnrolled} subject(s).`
    );
  } catch (e) {
    const meta = e?.meta || {};
    if (e.message === "SINGLE_COURSE_DISABLED") {
      return errorResponse(
        res,
        "Single subject enrollment is disabled. Use full_class enrollment.",
        400
      );
    }
    if (e.message === "CLASS_NOT_FOUND") {
      return errorResponse(res, "Class not found", 404);
    }
    if (e.message === "STUDENT_NOT_FOUND") {
      return errorResponse(res, "Student not found", 404);
    }
    if (e.message === "ALREADY_ENROLLED") {
      return errorResponse(
        res,
        "Student is already enrolled in this class/course",
        409,
        { code: "ALREADY_ENROLLED" }
      );
    }
    if (e.message === "CLASS_FULL") {
      return errorResponse(
        res,
        `Class is full. Capacity is ${meta.capacity} students. Currently ${meta.currentCount} enrolled.`,
        400,
        {
          code: "CLASS_FULL",
          capacity: meta.capacity,
          currentCount: meta.currentCount,
        }
      );
    }
    if (e.message === "SHIFT_NOT_FOUND") {
      return errorResponse(res, "Shift not found", 404);
    }
    if (e.message === "CLASS_EXPIRED" || e.message === "CLASS_ENDED") {
      return errorResponse(
        res,
        "Cannot enroll student. This class is expired.",
        400
      );
    }
    if (e.message === "CLASS_COMPLETED") {
      return errorResponse(
        res,
        PERMANENT_COMPLETION_MESSAGE,
        400,
        { code: "CLASS_COMPLETED" }
      );
    }
    if (e.message === "SUBJECT_COMPLETED") {
      return errorResponse(
        res,
        PERMANENT_COMPLETION_MESSAGE,
        400,
        {
          code: "SUBJECT_COMPLETED",
          subjectIds: Array.isArray(meta.subjectIds) ? meta.subjectIds : [],
        }
      );
    }
    if (e.message === "CLASS_COMPLETED") {
      return errorResponse(
        res,
        PERMANENT_COMPLETION_MESSAGE,
        400,
        { code: "CLASS_COMPLETED" }
      );
    }
    if (e.message === "SUBJECT_COMPLETED") {
      return errorResponse(
        res,
        PERMANENT_COMPLETION_MESSAGE,
        400,
        {
          code: "SUBJECT_COMPLETED",
          subjectIds: Array.isArray(meta.subjectIds) ? meta.subjectIds : [],
        }
      );
    }
    if (e.message === "CLASS_HAS_NO_SUBJECTS" || e.message === "CLASS_HAS_NO_COURSES") {
      return errorResponse(res, "This class has no assigned subjects", 400);
    }
    if (e.message === "COURSE_REQUIRED") {
      return errorResponse(
        res,
        "subjectId/courseId is required for single_subject enrollment",
        400
      );
    }
    if (e.message === "COURSE_NOT_IN_CLASS") {
      return errorResponse(
        res,
        "Selected subject is not assigned to this class",
        400
      );
    }
    if (e.message === "SHIFT_COURSE_MISMATCH") {
      return errorResponse(
        res,
        "Selected shift does not belong to selected subject",
        400
      );
    }
    return errorResponse(res, "Failed to enroll student", 500);
  }
};

export const getClassStudents = async (req, res) => {
  try {
    const { classId } = req.params;

    const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
    if (!classSnap.exists) {
      return errorResponse(res, "Class not found", 404);
    }

    const classData = classSnap.data() || {};
    const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
    const assignedCourses = Array.isArray(classData.assignedSubjects)
      ? classData.assignedSubjects
      : Array.isArray(classData.assignedCourses)
        ? classData.assignedCourses
        : [];
    const assignedCourseIds = assignedCourses
      .map((course) =>
        String(course?.subjectId || course?.courseId || course?.id || course || "").trim()
      )
      .filter(Boolean);
    const shiftMap = {};
    shifts.forEach((shift) => {
      shiftMap[shift.id] = shift;
    });
    const courseMap = {};
    assignedCourses.forEach((course) => {
      const courseId = String(
        course?.subjectId || course?.courseId || course?.id || course || ""
      ).trim();
      if (!courseId) return;
      courseMap[courseId] = course;
    });

    const studentEntries = Array.isArray(classData.students) ? classData.students : [];
    const normalizedEntries = studentEntries.map((entry) =>
      typeof entry === "string"
        ? { studentId: entry, shiftId: "", courseId: "", enrolledAt: null }
        : {
            studentId: entry.studentId,
            shiftId: entry.shiftId || "",
            courseId: entry.subjectId || entry.courseId || "",
            enrolledAt: entry.enrolledAt || null,
          }
    );

    if (normalizedEntries.length < 1) {
      return successResponse(res, [], "Class students fetched");
    }

    const uniqueIds = [...new Set(normalizedEntries.map((entry) => entry.studentId))];
    const [studentRoleSnaps, userSnaps, enrollmentSnap] = await Promise.all([
      Promise.all(
        uniqueIds.map((studentId) =>
          db.collection(COLLECTIONS.STUDENTS).doc(studentId).get()
        )
      ),
      Promise.all(
        uniqueIds.map((studentId) =>
          db.collection(COLLECTIONS.USERS).doc(studentId).get()
        )
      ),
      db.collection(COLLECTIONS.ENROLLMENTS).where("classId", "==", classId).get(),
    ]);

    const enrollmentsByStudent = {};
    enrollmentSnap.docs.forEach((doc) => {
      const row = doc.data() || {};
      const studentId = String(row.studentId || "").trim();
      const courseId = String(row.subjectId || row.courseId || "").trim();
      if (!studentId || !courseId) return;
      const status = String(row.status || "active").trim().toLowerCase();
      if (!ACTIVE_ENROLLMENT_STATUS_SET.has(status)) return;
      if (!enrollmentsByStudent[studentId]) {
        enrollmentsByStudent[studentId] = [];
      }
      enrollmentsByStudent[studentId].push({
        courseId,
        enrollmentType: normalizeEnrollmentType(row.enrollmentType),
        enrolledAt: row.enrolledAt || row.createdAt || null,
      });
    });

    const studentsById = {};
    studentRoleSnaps.forEach((snap) => {
      if (snap.exists) studentsById[snap.id] = snap.data();
    });
    const usersById = {};
    userSnaps.forEach((snap) => {
      if (snap.exists) usersById[snap.id] = snap.data();
    });

    const data = normalizedEntries.map((entry) => {
      const studentRoleData = studentsById[entry.studentId] || {};
      const userData = usersById[entry.studentId] || {};
      const shift = shiftMap[entry.shiftId] || null;
      const course = courseMap[entry.courseId] || null;
      const studentEnrollments = Array.isArray(enrollmentsByStudent[entry.studentId])
        ? enrollmentsByStudent[entry.studentId]
        : [];
      const paidCourseIds = [
        ...new Set(studentEnrollments.map((row) => row.courseId).filter(Boolean)),
      ];
      const enrolledCourses = paidCourseIds.map((courseId) => ({
        subjectId: courseId,
        courseId,
        courseName:
          courseMap[courseId]?.subjectName ||
          courseMap[courseId]?.courseName ||
          courseMap[courseId]?.title ||
          "Subject",
        subjectName:
          courseMap[courseId]?.subjectName ||
          courseMap[courseId]?.courseName ||
          courseMap[courseId]?.title ||
          "Subject",
        enrollmentType:
          studentEnrollments.find((row) => row.courseId === courseId)?.enrollmentType ||
          "single_course",
      }));
      const lockedCourses = assignedCourseIds
        .filter((courseId) => !paidCourseIds.includes(courseId))
        .map((courseId) => ({
          subjectId: courseId,
          courseId,
          courseName:
            courseMap[courseId]?.subjectName ||
            courseMap[courseId]?.courseName ||
            courseMap[courseId]?.title ||
            "Subject",
          subjectName:
            courseMap[courseId]?.subjectName ||
            courseMap[courseId]?.courseName ||
            courseMap[courseId]?.title ||
            "Subject",
        }));

      return {
        studentId: entry.studentId,
        uid: entry.studentId,
        fullName:
          studentRoleData.fullName ||
          (userData.email ? userData.email.split("@")[0] : "Unknown Student"),
        email: userData.email || "",
        phoneNumber: studentRoleData.phoneNumber || "",
        isActive: userData.isActive ?? true,
        enrolledAt: entry.enrolledAt || null,
        shiftId: entry.shiftId || "",
        shiftName: shift?.name || "",
        shiftDays: shift?.days || [],
        startTime: shift?.startTime || "",
        endTime: shift?.endTime || "",
        teacherId: shift?.teacherId || "",
        teacherName: shift?.teacherName || "",
        subjectId: entry.courseId || shift?.subjectId || shift?.courseId || "",
        courseId: entry.courseId || shift?.subjectId || shift?.courseId || "",
        subjectName:
          course?.subjectName || course?.courseName || shift?.subjectName || shift?.courseName || "",
        courseName:
          course?.subjectName || course?.courseName || shift?.subjectName || shift?.courseName || "",
        enrolledCoursesCount: paidCourseIds.length,
        totalCoursesCount: assignedCourseIds.length,
        lockedCoursesCount: Math.max(assignedCourseIds.length - paidCourseIds.length, 0),
        enrolledCourses,
        lockedCourses,
      };
    });

    return successResponse(res, data, "Class students fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch class students", 500);
  }
};

export const enrollStudentInClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const studentId = String(req.body?.studentId || "").trim();
    const shiftId = String(req.body?.shiftId || "").trim();
    const enrollmentType = normalizeEnrollmentType(req.body?.enrollmentType);
    const courseId = String(req.body?.courseId || req.body?.subjectId || "").trim();
    const paymentId = String(req.body?.paymentId || "").trim();

    if (!studentId) {
      return errorResponse(res, "studentId is required", 400);
    }
    if (enrollmentType !== "full_class") {
      return errorResponse(
        res,
        "Single subject enrollment is disabled. Use full_class enrollment.",
        400
      );
    }

    const result = await enrollStudentInClassCore({
      classId,
      studentId,
      shiftId,
      enrollmentType,
      courseId,
      paymentId,
    });

    return successResponse(
      res,
      result,
      `Student enrolled in ${result.className || "class"}! Access granted to ${result.subjectsEnrolled || result.coursesEnrolled} subject(s).`
    );
  } catch (e) {
    const meta = e?.meta || {};
    if (e.message === "SINGLE_COURSE_DISABLED") {
      return errorResponse(
        res,
        "Single subject enrollment is disabled. Use full_class enrollment.",
        400
      );
    }
    if (e.message === "CLASS_NOT_FOUND") {
      return errorResponse(res, "Class not found", 404);
    }
    if (e.message === "STUDENT_NOT_FOUND") {
      return errorResponse(res, "Student not found", 404);
    }
    if (e.message === "ALREADY_ENROLLED") {
      return errorResponse(
        res,
        "Student is already enrolled in this class/course",
        409,
        { code: "ALREADY_ENROLLED" }
      );
    }
    if (e.message === "CLASS_FULL") {
      return errorResponse(
        res,
        `Class is full. Capacity is ${meta.capacity} students. Currently ${meta.currentCount} enrolled.`,
        400,
        {
          code: "CLASS_FULL",
          capacity: meta.capacity,
          currentCount: meta.currentCount,
        }
      );
    }
    if (e.message === "SHIFT_NOT_FOUND") {
      return errorResponse(res, "Shift not found", 404);
    }
    if (e.message === "CLASS_HAS_NO_SUBJECTS" || e.message === "CLASS_HAS_NO_COURSES") {
      return errorResponse(res, "This class has no assigned subjects", 400);
    }
    if (e.message === "COURSE_REQUIRED") {
      return errorResponse(
        res,
        "subjectId/courseId is required for single_subject enrollment",
        400
      );
    }
    if (e.message === "COURSE_NOT_IN_CLASS") {
      return errorResponse(
        res,
        "Selected subject is not assigned to this class",
        400
      );
    }
    if (e.message === "SHIFT_COURSE_MISMATCH") {
      return errorResponse(
        res,
        "Selected shift does not belong to selected subject",
        400
      );
    }
    if (e.message === "CLASS_EXPIRED" || e.message === "CLASS_ENDED") {
      return errorResponse(
        res,
        "Cannot enroll student. This class is expired.",
        400
      );
    }
    console.error("Enroll student error:", e);
    return errorResponse(res, "Failed to enroll student", 500);
  }
};

export const removeStudentFromClass = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const cleanClassId = String(classId || "").trim();
    const cleanStudentId = String(studentId || "").trim();
    let studentName = "Student";

    const classRef = db.collection(COLLECTIONS.CLASSES).doc(cleanClassId);
    const classSnap = await classRef.get();
    if (!classSnap.exists) {
      return errorResponse(res, "Class not found", 404);
    }

    const classData = classSnap.data() || {};
    const normalizedStudents = normalizeClassStudentEntries(
      Array.isArray(classData.students) ? classData.students : []
    );
    const studentEntry = normalizedStudents.find(
      (entry) => entry.studentId === cleanStudentId
    );
    if (!studentEntry) {
      return errorResponse(res, "Student is not enrolled in this class", 404);
    }
    try {
      const [studentSnap, userSnap] = await Promise.all([
        db.collection(COLLECTIONS.STUDENTS).doc(cleanStudentId).get(),
        db.collection(COLLECTIONS.USERS).doc(cleanStudentId).get(),
      ]);
      studentName =
        String(studentSnap.data()?.fullName || "").trim() ||
        String(studentSnap.data()?.name || "").trim() ||
        (userSnap.data()?.email ? userSnap.data().email.split("@")[0] : "Student");
    } catch {
      studentName = "Student";
    }

    const nextStudents = normalizedStudents.filter(
      (entry) => entry.studentId !== cleanStudentId
    );
    const assignedCourseIds = getClassAssignedCourseIds(classData);

    const enrollmentSnap = await db
      .collection(COLLECTIONS.ENROLLMENTS)
      .where("studentId", "==", cleanStudentId)
      .get();
    const studentEnrollments = enrollmentSnap.docs.map((doc) => ({
      id: doc.id,
      ref: doc.ref,
      data: doc.data() || {},
    }));

    const docsToDelete = studentEnrollments.filter((row) => {
      const rowClassId = String(row.data.classId || "").trim();
      const rowCourseId = String(
        row.data.subjectId || row.data.courseId || ""
      ).trim();
      if (rowClassId !== cleanClassId) return false;
      if (!assignedCourseIds.length) return true;
      return assignedCourseIds.includes(rowCourseId);
    });

    const decrementByCourse = docsToDelete.reduce((acc, row) => {
      const courseId = String(row.data.subjectId || row.data.courseId || "").trim();
      if (!courseId) return acc;
      acc[courseId] = (acc[courseId] || 0) + 1;
      return acc;
    }, {});

    const remainingEnrollments = studentEnrollments.filter(
      (row) => !docsToDelete.some((removeRow) => removeRow.id === row.id)
    );
    const remainingCourseIds = new Set(
      remainingEnrollments
        .map((row) => String(row.data.subjectId || row.data.courseId || "").trim())
        .filter(Boolean)
    );
    const removedCourseIds = [
      ...new Set(
        docsToDelete
          .map((row) => String(row.data.subjectId || row.data.courseId || "").trim())
          .filter(Boolean)
      ),
    ];
    const coursesToRemoveFromStudent = removedCourseIds.filter(
      (courseId) => !remainingCourseIds.has(courseId)
    );

    const batch = db.batch();
    batch.update(classRef, {
      students: nextStudents,
      enrolledCount: nextStudents.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    docsToDelete.forEach((row) => batch.delete(row.ref));

    Object.entries(decrementByCourse).forEach(([courseId, count]) => {
      if (!courseId || count < 1) return;
      batch.set(
        db.collection(COLLECTIONS.SUBJECTS).doc(courseId),
        {
          enrollmentCount: admin.firestore.FieldValue.increment(-count),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      batch.set(
        db.collection(COLLECTIONS.COURSES).doc(courseId),
        {
          enrollmentCount: admin.firestore.FieldValue.increment(-count),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    const studentUpdates = {
      enrolledClasses: admin.firestore.FieldValue.arrayRemove(cleanClassId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (coursesToRemoveFromStudent.length > 0) {
      studentUpdates.enrolledCourses = admin.firestore.FieldValue.arrayRemove(
        ...coursesToRemoveFromStudent
      );
      studentUpdates.enrolledSubjects = admin.firestore.FieldValue.arrayRemove(
        ...coursesToRemoveFromStudent
      );
    }
    batch.set(
      db.collection(COLLECTIONS.STUDENTS).doc(cleanStudentId),
      studentUpdates,
      { merge: true }
    );

    await batch.commit();

    return successResponse(
      res,
      { classId: cleanClassId, studentId: cleanStudentId },
      `${studentName} removed from class. Access to class subjects revoked.`
    );
  } catch (e) {
    console.error("removeStudentFromClass error:", e);
    return errorResponse(res, "Failed to remove student", 500);
  }
};

export const getPayments = async (req, res) => {
  try {
    const { method, status } = req.query;
    const data = await adminService.getAllPayments({ method, status });
    return successResponse(res, data, "Payments fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch payments", 500);
  }
};

export const verifyBankTransfer = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { action } = req.body || {};

    if (!paymentId) {
      return errorResponse(res, "paymentId is required", 400);
    }
    if (!["approve", "reject"].includes(action)) {
      return errorResponse(res, "action must be approve or reject", 400);
    }

    const paymentRef = db.collection(COLLECTIONS.PAYMENTS).doc(paymentId);
    const paySnap = await paymentRef.get();
    if (!paySnap.exists) {
      return errorResponse(res, "Payment not found", 404);
    }

    const payData = paySnap.data() || {};
    const newStatus = action === "approve" ? "paid" : "rejected";

    await paymentRef.update({
      status: newStatus,
      verifiedBy: req.user.uid,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const paidSubjectId = String(payData.subjectId || payData.courseId || "").trim();
    if (action === "approve" && payData.studentId && paidSubjectId) {
      const existingEnroll = await db
        .collection(COLLECTIONS.ENROLLMENTS)
        .where("studentId", "==", payData.studentId)
        .where("courseId", "==", paidSubjectId)
        .where("classId", "==", payData.classId || null)
        .limit(1)
        .get();

      if (existingEnroll.empty) {
        await db.collection(COLLECTIONS.ENROLLMENTS).add({
          studentId: payData.studentId,
          subjectId: paidSubjectId,
          courseId: paidSubjectId,
          classId: payData.classId || null,
          paymentId,
          status: "active",
          progress: 0,
          completedAt: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await db
          .collection(COLLECTIONS.SUBJECTS)
          .doc(paidSubjectId)
          .set(
            {
              enrollmentCount: admin.firestore.FieldValue.increment(1),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

        await db
          .collection(COLLECTIONS.COURSES)
          .doc(paidSubjectId)
          .set(
            {
              enrollmentCount: admin.firestore.FieldValue.increment(1),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      }
    }

    return successResponse(
      res,
      { paymentId, status: newStatus },
      action === "approve"
        ? "Payment approved. Student enrolled."
        : "Payment rejected."
    );
  } catch (e) {
    console.error("Verify payment error:", e);
    return errorResponse(res, "Failed to verify payment", 500);
  }
};

export const getInstallments = async (req, res) => {
  try {
    const data = await adminService.getAllInstallments();
    return successResponse(res, data, "Installments fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch installments", 500);
  }
};

export const createInstallmentPlan = async (req, res) => {
  try {
    const { studentId, courseId, totalAmount, numberOfInstallments, startDate } =
      req.body;

    const installmentAmount = Math.ceil(totalAmount / numberOfInstallments);

    const installments = [];
    for (let i = 0; i < numberOfInstallments; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      installments.push({
        number: i + 1,
        amount: installmentAmount,
        dueDate: dueDate.toISOString().split("T")[0],
        paidAt: null,
        status: "pending",
      });
    }

    const ref = await db.collection(COLLECTIONS.INSTALLMENTS).add({
      studentId,
      courseId,
      totalAmount,
      numberOfInstallments,
      paidCount: 0,
      installments,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(
      res,
      { id: ref.id },
      "Installment plan created",
      201
    );
  } catch (e) {
    return errorResponse(res, "Failed to create plan", 500);
  }
};

export const markInstallmentPaid = async (req, res) => {
  try {
    const { planId, installmentNumber } = req.params;

    const snap = await db.collection(COLLECTIONS.INSTALLMENTS).doc(planId).get();
    if (!snap.exists) {
      return errorResponse(res, "Plan not found", 404);
    }

    const data = snap.data();
    const installments = data.installments.map((inst) => {
      if (inst.number === Number(installmentNumber)) {
        return {
          ...inst,
          status: "paid",
          paidAt: new Date().toISOString(),
        };
      }
      return inst;
    });

    await db.collection(COLLECTIONS.INSTALLMENTS).doc(planId).update({
      installments,
      paidCount: admin.firestore.FieldValue.increment(1),
    });

    return successResponse(res, {}, "Installment marked paid");
  } catch (e) {
    return errorResponse(res, "Failed to mark paid", 500);
  }
};

export const getPromoCodes = async (req, res) => {
  try {
    const snap = await db
      .collection(COLLECTIONS.PROMO_CODES)
      .orderBy("createdAt", "desc")
      .get();

    const data = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() || {}),
    }));

    return successResponse(res, data, "Promo codes fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch promo codes", 500);
  }
};

export const createPromoCode = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      courseId,
      usageLimit,
      expiresAt,
      isSingleUse,
      isActive,
    } = req.body;

    const normalizedCode = String(code || "")
      .toUpperCase()
      .trim();
    if (!normalizedCode || normalizedCode.length < 4) {
      return errorResponse(res, "Code must be at least 4 characters", 400);
    }
    if (!/^[A-Z0-9]+$/.test(normalizedCode)) {
      return errorResponse(res, "Code must be alphanumeric only", 400);
    }
    if (!["percentage", "fixed"].includes(discountType)) {
      return errorResponse(
        res,
        "discountType must be percentage or fixed",
        400
      );
    }

    const parsedDiscountValue = Number(discountValue);
    if (!Number.isFinite(parsedDiscountValue) || parsedDiscountValue <= 0) {
      return errorResponse(res, "discountValue must be a positive number", 400);
    }
    if (discountType === "percentage" && (parsedDiscountValue < 1 || parsedDiscountValue > 100)) {
      return errorResponse(res, "Percentage discount must be between 1 and 100", 400);
    }

    const parsedUsageLimit = Number(usageLimit ?? 0);
    if (!Number.isFinite(parsedUsageLimit) || parsedUsageLimit < 0) {
      return errorResponse(res, "usageLimit must be 0 or a positive number", 400);
    }

    let expiresAtIso = null;
    if (expiresAt) {
      const expiryDate = parsePromoExpiryDate(expiresAt);
      if (!expiryDate) {
        return errorResponse(res, "Invalid expiresAt date", 400);
      }
      if (expiryDate <= new Date()) {
        return errorResponse(res, "expiresAt must be a future date", 400);
      }
      expiresAtIso = expiryDate.toISOString();
    }

    let resolvedCourseId = null;
    let courseName = null;
    if (courseId) {
      const courseSnap = await db.collection(COLLECTIONS.COURSES).doc(courseId).get();
      if (!courseSnap.exists) {
        return errorResponse(res, "Course not found", 404);
      }
      resolvedCourseId = courseId;
      courseName = courseSnap.data()?.title || null;
    }

    const existing = await db
      .collection(COLLECTIONS.PROMO_CODES)
      .where("code", "==", normalizedCode)
      .get();
    if (!existing.empty) {
      return errorResponse(res, "Code already exists", 409);
    }

    const payload = {
      code: normalizedCode,
      discountType,
      discountValue: parsedDiscountValue,
      courseId: resolvedCourseId,
      courseName,
      usageLimit: parsedUsageLimit,
      usageCount: 0,
      isSingleUse: Boolean(isSingleUse),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      expiresAt: expiresAtIso,
      createdBy: req.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection(COLLECTIONS.PROMO_CODES).add(payload);
    const createdSnap = await ref.get();
    const created = createdSnap.data() || payload;

    return successResponse(
      res,
      {
        id: ref.id,
        ...created,
      },
      "Promo code created",
      201
    );
  } catch (e) {
    return errorResponse(res, "Failed to create promo code", 500);
  }
};

export const updatePromoCode = async (req, res) => {
  try {
    const { codeId } = req.params;
    const codeRef = db.collection(COLLECTIONS.PROMO_CODES).doc(codeId);
    const codeSnap = await codeRef.get();
    if (!codeSnap.exists) {
      return errorResponse(res, "Promo code not found", 404);
    }

    const existing = codeSnap.data() || {};
    const {
      discountValue,
      usageLimit,
      isActive,
      expiresAt,
      isSingleUse,
      code,
      usageCount,
      createdAt,
      ...restIgnored
    } = req.body || {};

    if (
      code !== undefined ||
      usageCount !== undefined ||
      createdAt !== undefined
    ) {
      return errorResponse(
        res,
        "Cannot update code, usageCount, or createdAt fields",
        400
      );
    }
    if (Object.keys(restIgnored).length > 0) {
      const supported = ["discountValue", "usageLimit", "isActive", "expiresAt", "isSingleUse"];
      return errorResponse(
        res,
        `Only these fields can be updated: ${supported.join(", ")}`,
        400
      );
    }

    const updates = {};

    if (discountValue !== undefined) {
      const parsed = Number(discountValue);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return errorResponse(res, "discountValue must be positive", 400);
      }
      if (
        existing.discountType === "percentage" &&
        (parsed < 1 || parsed > 100)
      ) {
        return errorResponse(
          res,
          "Percentage discount must be between 1 and 100",
          400
        );
      }
      updates.discountValue = parsed;
    }

    if (usageLimit !== undefined) {
      const parsed = Number(usageLimit);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return errorResponse(res, "usageLimit must be 0 or positive", 400);
      }
      if (parsed > 0 && parsed < Number(existing.usageCount || 0)) {
        return errorResponse(
          res,
          "usageLimit cannot be less than current usageCount",
          400
        );
      }
      updates.usageLimit = parsed;
    }

    if (isActive !== undefined) {
      updates.isActive = Boolean(isActive);
    }

    if (isSingleUse !== undefined) {
      updates.isSingleUse = Boolean(isSingleUse);
    }

    if (expiresAt !== undefined) {
      if (expiresAt === null || expiresAt === "") {
        updates.expiresAt = null;
      } else {
        const expiryDate = parsePromoExpiryDate(expiresAt);
        if (!expiryDate) {
          return errorResponse(res, "Invalid expiresAt date", 400);
        }
        if (expiryDate <= new Date()) {
          return errorResponse(res, "expiresAt must be a future date", 400);
        }
        updates.expiresAt = expiryDate.toISOString();
      }
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await codeRef.update(updates);
    const updatedSnap = await codeRef.get();

    return successResponse(
      res,
      { id: codeId, ...(updatedSnap.data() || {}) },
      "Promo code updated"
    );
  } catch (e) {
    return errorResponse(res, "Failed to update promo code", 500);
  }
};

export const deletePromoCode = async (req, res) => {
  try {
    const { codeId } = req.params;
    const codeRef = db.collection(COLLECTIONS.PROMO_CODES).doc(codeId);
    const codeSnap = await codeRef.get();
    if (!codeSnap.exists) {
      return errorResponse(res, "Promo code not found", 404);
    }

    const codeData = codeSnap.data() || {};
    if (Number(codeData.usageCount || 0) > 0) {
      return errorResponse(
        res,
        "Cannot delete used promo code. Deactivate it instead.",
        400
      );
    }

    await codeRef.delete();
    return successResponse(res, {}, "Promo code deleted");
  } catch (e) {
    return errorResponse(res, "Failed to delete promo code", 500);
  }
};

export const validatePromoCode = async (req, res) => {
  try {
    const { code, courseId, studentId } = req.body || {};

    const normalizedCode = String(code || "")
      .toUpperCase()
      .trim();
    if (!normalizedCode) {
      return errorResponse(res, "Promo code is required", 400);
    }

    const snap = await db
      .collection(COLLECTIONS.PROMO_CODES)
      .where("code", "==", normalizedCode)
      .limit(1)
      .get();

    if (snap.empty) {
      return errorResponse(res, "Invalid promo code", 404);
    }

    const promoDoc = snap.docs[0];
    const promoData = promoDoc.data();
    const requesterStudentId = studentId || req.user?.uid || "";

    if (!promoData.isActive) {
      return errorResponse(res, "Promo code is inactive", 400);
    }

    if (isPromoExpired(promoData.expiresAt)) {
      return errorResponse(res, "Promo code has expired", 400);
    }

    const usageLimit = Number(promoData.usageLimit || 0);
    const storedUsageCount = Number(promoData.usageCount || 0);
    const activeUsageCount = await countActivePromoUsages({
      promoCodeId: promoDoc.id,
      code: normalizedCode,
    });
    const effectiveUsageCount = Math.max(storedUsageCount, activeUsageCount);

    if (usageLimit > 0 && effectiveUsageCount >= usageLimit) {
      return errorResponse(res, "Promo code usage limit reached", 400);
    }

    if (courseId && promoData.courseId && promoData.courseId !== courseId) {
      return errorResponse(
        res,
        "Promo code not valid for this course",
        400
      );
    }

    if (promoData.isSingleUse && requesterStudentId) {
      const studentPayments = await db
        .collection(COLLECTIONS.PAYMENTS)
        .where("studentId", "==", requesterStudentId)
        .get();

      const usedAlready = studentPayments.docs.some((doc) => {
        const payment = doc.data() || {};
        const status = normalizePaymentState(payment.status);
        const samePromoId =
          String(payment.promoCodeId || "").trim() === String(promoDoc.id || "").trim();
        const samePromoCode =
          String(payment.promoCode || "").toUpperCase() === normalizedCode;
        return (
          (samePromoId || samePromoCode) &&
          ACTIVE_PROMO_USAGE_STATES.has(status)
        );
      });

      if (usedAlready) {
        return errorResponse(res, "You have already used this promo code", 400);
      }
    }

    let originalAmount = 0;
    let courseDiscountPercent = 0;
    if (courseId) {
      const courseSnap = await db.collection(COLLECTIONS.COURSES).doc(courseId).get();
      if (courseSnap.exists) {
        const courseData = courseSnap.data() || {};
        originalAmount = Number(courseData.price || 0);
        courseDiscountPercent = Math.max(
          0,
          Math.min(100, Number(courseData.discountPercent || 0))
        );
      }
    }

    const courseDiscountAmount = Number(
      ((originalAmount * courseDiscountPercent) / 100).toFixed(2)
    );
    const amountAfterCourseDiscount = Math.max(
      Number((originalAmount - courseDiscountAmount).toFixed(2)),
      0
    );

    const discountAmount =
      promoData.discountType === "fixed"
        ? Math.min(amountAfterCourseDiscount, Number(promoData.discountValue || 0))
        : Number(
            (
              (amountAfterCourseDiscount * Number(promoData.discountValue || 0)) /
              100
            ).toFixed(2)
          );
    const finalAmount = Math.max(amountAfterCourseDiscount - discountAmount, 0);

    return successResponse(
      res,
      {
        code: promoData.code,
        discountType: promoData.discountType,
        discountValue: promoData.discountValue,
        usageLimit,
        usageCount: effectiveUsageCount,
        remainingUses: usageLimit > 0 ? Math.max(usageLimit - effectiveUsageCount, 0) : null,
        originalAmount,
        courseDiscountPercent,
        courseDiscountAmount,
        discountAmount,
        finalAmount,
      },
      "Promo code valid"
    );
  } catch (e) {
    return errorResponse(res, "Failed to validate promo code", 500);
  }
};

export const togglePromoCode = async (req, res) => {
  try {
    const { codeId } = req.params;
    const { isActive } = req.body || {};
    if (typeof isActive !== "boolean") {
      return errorResponse(res, "isActive boolean is required", 400);
    }

    const codeRef = db.collection(COLLECTIONS.PROMO_CODES).doc(codeId);
    const codeSnap = await codeRef.get();
    if (!codeSnap.exists) {
      return errorResponse(res, "Promo code not found", 404);
    }

    await codeRef.update({
      isActive,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(
      res,
      { id: codeId, isActive },
      `Promo code ${isActive ? "activated" : "deactivated"}`
    );
  } catch (e) {
    return errorResponse(res, "Failed to toggle promo code", 500);
  }
};

export const getAnnouncements = async (req, res) => {
  try {
    const data = await adminService.getAllAnnouncements();
    return successResponse(res, data, "Announcements fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch announcements", 500);
  }
};

export const createAnnouncement = async (req, res) => {
  try {
    const { title, message, targetType, targetId, sendEmail } = req.body;

    if (!title || !message) {
      return errorResponse(res, "Title and message required", 400);
    }

    const ref = await db.collection(COLLECTIONS.ANNOUNCEMENTS).add({
      title,
      message,
      targetType: targetType || "system",
      targetId: targetId || null,
      postedBy: req.user.uid,
      sendEmail: sendEmail || false,
      isPinned: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(res, { id: ref.id }, "Announcement posted", 201);
  } catch (e) {
    return errorResponse(res, "Failed to post announcement", 500);
  }
};

export const updateAnnouncement = async (req, res) => {
  try {
    const { announcementId } = req.params;
    await db.collection(COLLECTIONS.ANNOUNCEMENTS)
      .doc(announcementId)
      .update(req.body);
    return successResponse(res, {}, "Announcement updated");
  } catch (e) {
    return errorResponse(res, "Failed to update announcement", 500);
  }
};

export const deleteAnnouncement = async (req, res) => {
  try {
    const { announcementId } = req.params;
    await db.collection(COLLECTIONS.ANNOUNCEMENTS)
      .doc(announcementId)
      .delete();
    return successResponse(res, {}, "Announcement deleted");
  } catch (e) {
    return errorResponse(res, "Failed to delete announcement", 500);
  }
};

export const getSiteSettings = async (req, res) => {
  try {
    const data = await adminService.getSiteSettings();
    return successResponse(res, data, "Settings fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch settings", 500);
  }
};

export const updateSiteSettings = async (req, res) => {
  try {
    const data = await adminService.updateSiteSettings(req.body);
    return successResponse(res, data, "Settings updated");
  } catch (e) {
    return errorResponse(res, "Failed to update settings", 500);
  }
};

export const getAnalyticsReport = async (req, res) => {
  try {
    const { days } = req.query;
    const [stats, revenue, enrollments, topClasses, classPerformance] = await Promise.all([
      adminService.getDashboardStats(),
      adminService.getRevenueChart(Number(days) || 30),
      adminService.getRecentEnrollments(50),
      adminService.getTopClasses(5),
      adminService.getClassPerformance(),
    ]);

    return successResponse(
      res,
      {
        stats,
        revenue,
        enrollments,
        topClasses,
        classPerformance,
        generatedAt: new Date().toISOString(),
      },
      "Analytics report fetched"
    );
  } catch (e) {
    return errorResponse(res, "Failed to generate report", 500);
  }
};
