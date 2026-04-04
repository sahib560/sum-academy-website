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

const normalizeSubjectName = (value = "") => String(value).trim();
const STUDENT_BULK_HEADERS = ["name", "email", "password", "phone", "address"];

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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

const normalizeBulkPhone = (value = "") => normalizePakistanPhone(value);

const buildCourseSubjects = async (subjects = []) => {
  if (!Array.isArray(subjects)) return [];

  const mapped = await Promise.all(
    subjects.map(async (subject, index) => {
      const subjectName = normalizeSubjectName(subject?.name || "");
      const teacherId = String(subject?.teacherId || "").trim();

      let teacherName = String(subject?.teacherName || "").trim();
      if (teacherId && !teacherName) {
        const teacherSnap = await db
          .collection(COLLECTIONS.TEACHERS)
          .doc(teacherId)
          .get();
        teacherName = teacherSnap.exists
          ? teacherSnap.data().fullName || ""
          : "";
      }

      return {
        id: String(subject?.id || uuidv4()),
        name: subjectName,
        teacherId,
        teacherName,
        order: Number(subject?.order || index + 1),
      };
    })
  );

  return mapped.filter(
    (subject) => subject.name && subject.teacherId
  );
};

const courseIdMatches = (item, courseId) =>
  item === courseId || item?.courseId === courseId;

const subjectIdMatches = (item, subjectId) =>
  item === subjectId || item?.subjectId === subjectId;

const hasCourseLinks = async (courseId) => {
  const [classesSnap, teachersSnap, studentsSnap, quizzesSnap] =
    await Promise.all([
      db.collection(COLLECTIONS.CLASSES).get(),
      db.collection(COLLECTIONS.TEACHERS).get(),
      db
        .collection(COLLECTIONS.STUDENTS)
        .where("enrolledCourses", "array-contains", courseId)
        .limit(1)
        .get(),
      db.collection("quizzes").where("courseId", "==", courseId).limit(1).get(),
    ]);

  const classLinked = classesSnap.docs.some((doc) => {
    const data = doc.data() || {};
    const assignedCourses = Array.isArray(data.assignedCourses)
      ? data.assignedCourses
      : [];
    const shifts = Array.isArray(data.shifts) ? data.shifts : [];
    return (
      assignedCourses.some((course) => courseIdMatches(course, courseId)) ||
      shifts.some((shift) => courseIdMatches(shift?.courseId, courseId))
    );
  });

  const teacherLinked = teachersSnap.docs.some((doc) => {
    const data = doc.data() || {};
    const assignedCourses = Array.isArray(data.assignedCourses)
      ? data.assignedCourses
      : [];
    return assignedCourses.some((course) => courseIdMatches(course, courseId));
  });

  const studentLinked = !studentsSnap.empty;
  const quizLinked = !quizzesSnap.empty;

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
          String(subject?.teacherId || "").trim() === teacherId
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
      subjects.some((subject) => String(subject?.teacherId || "").trim() === teacherId)
    );
  });

  return courseLinked;
};

const CLASS_STATUSES = new Set(["upcoming", "active", "completed"]);
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

const getEnrollmentStatusFromClassDates = (classData = {}) => {
  const start = normalizeDateValue(classData?.startDate);
  const end = normalizeDateValue(classData?.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (start) {
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    if (today.getTime() < startDay.getTime()) return "upcoming";
  }

  if (end) {
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    if (today.getTime() > endDay.getTime()) return "completed";
  }

  return "active";
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
  return CLASS_STATUSES.has(normalized) ? normalized : "upcoming";
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

  const minAllowedMinutes = now.getHours() * 60 + now.getMinutes() + 60;
  if (minAllowedMinutes >= 24 * 60) {
    return "Today is almost over. Please choose tomorrow as class start date.";
  }

  if (shiftStartMinutes < minAllowedMinutes) {
    return "For classes starting today, shift start time must be at least 1 hour from now";
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
  const courseSnap = await db.collection(COLLECTIONS.COURSES).doc(courseId).get();
  if (!courseSnap.exists) return null;
  const courseData = courseSnap.data() || {};
  const subjectName = Array.isArray(courseData.subjects)
    ? courseData.subjects?.[0]?.name || ""
    : "";
  return {
    courseId,
    courseName: courseData.title || "",
    subjectName,
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
        : String(item?.courseId || "").trim();
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
  const courseId = String(shiftInput?.courseId || "").trim();
  const teacherId = String(shiftInput?.teacherId || "").trim();
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
      courseId: courseMeta.courseId,
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
    } = req.body || {};

    if (password !== undefined) {
      return errorResponse(
        res,
        "Password cannot be changed from this endpoint",
        400
      );
    }

    const trim = (value = "") => String(value || "").trim();
    const isValidEmail = (value = "") =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

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
    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (nextEmail && !isValidEmail(nextEmail)) {
      return errorResponse(res, "Enter a valid email address", 400);
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
      const authUpdates = {};
      if (nextName) authUpdates.displayName = nextName;
      if (nextEmail && nextEmail !== String(userData.email || "").toLowerCase()) {
        authUpdates.email = nextEmail;
      }
      if (Object.keys(authUpdates).length > 0) {
        await admin.auth().updateUser(uid, authUpdates);
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
      },
      "User updated"
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
    const data = await adminService.getAllCourses();
    return successResponse(res, data, "Courses fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch courses", 500);
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
      price,
      discountPercent,
      status,
      thumbnail,
      hasCertificate,
      subjects = [],
    } = req.body;

    if (!title || String(title).trim().length < 5) {
      return errorResponse(res, "Title must be at least 5 characters", 400);
    }

    const normalizedSubjects = await buildCourseSubjects(subjects);
    if (normalizedSubjects.length < 1) {
      return errorResponse(res, "At least one subject is required", 400);
    }

    const ref = await db.collection(COLLECTIONS.COURSES).add({
      title: String(title).trim(),
      description: description || "",
      shortDescription: shortDescription || "",
      category: category || "",
      level: level || "beginner",
      price: toSafeNumber(price, 0),
      discountPercent: Math.max(0, toSafeNumber(discountPercent, 0)),
      status: status || "draft",
      thumbnail: thumbnail || null,
      subjects: normalizedSubjects,
      enrollmentCount: 0,
      completionCount: 0,
      rating: 0,
      hasCertificate: hasCertificate !== false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(res, { id: ref.id }, "Course created", 201);
  } catch (e) {
    return errorResponse(res, "Failed to create course", 500);
  }
};

export const updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const incoming = { ...req.body };
    if (Array.isArray(incoming.subjects)) {
      incoming.subjects = await buildCourseSubjects(incoming.subjects);
    }
    if (incoming.price !== undefined) {
      incoming.price = toSafeNumber(incoming.price, 0);
    }
    if (incoming.discountPercent !== undefined) {
      incoming.discountPercent = Math.max(
        0,
        toSafeNumber(incoming.discountPercent, 0)
      );
    }

    const updates = {
      ...incoming,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection(COLLECTIONS.COURSES).doc(courseId).update(updates);
    return successResponse(res, { courseId }, "Course updated");
  } catch (e) {
    return errorResponse(res, "Failed to update course", 500);
  }
};

export const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const linked = await hasCourseLinks(courseId);
    if (linked) {
      return errorResponse(
        res,
        "Cannot delete course while linked to classes, teachers, students, or quizzes",
        400
      );
    }
    const courseRef = db.collection(COLLECTIONS.COURSES).doc(courseId);

    const contentSnap = await courseRef.collection("content").get();
    const batch = db.batch();
    contentSnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(courseRef);
    await batch.commit();

    return successResponse(res, { courseId }, "Course deleted");
  } catch (e) {
    return errorResponse(res, "Failed to delete course", 500);
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

export const addCourseContent = async (req, res) => {
  try {
    const { courseId, subjectId } = req.params;
    const {
      type,
      title,
      url,
      size = 0,
      contentType = "",
      noteType = "",
    } = req.body;

    if (!type || !title || !url) {
      return errorResponse(res, "type, title and url are required", 400);
    }

    const allowed = ["video", "pdf", "notes"];
    if (!allowed.includes(type)) {
      return errorResponse(res, "Invalid content type", 400);
    }

    const courseSnap = await db
      .collection(COLLECTIONS.COURSES)
      .doc(courseId)
      .get();
    if (!courseSnap.exists) {
      return errorResponse(res, "Course not found", 404);
    }

    const subjects = Array.isArray(courseSnap.data().subjects)
      ? courseSnap.data().subjects
      : [];
    const subject = subjects.find((item) => item.id === subjectId);
    if (!subject) {
      return errorResponse(res, "Subject not found", 404);
    }

    const contentData = {
      id: uuidv4(),
      subjectId,
      type,
      title: String(title).trim(),
      url,
      size: toSafeNumber(size, 0),
      contentType: contentType || "",
      noteType: noteType || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db
      .collection(COLLECTIONS.COURSES)
      .doc(courseId)
      .collection("content")
      .doc(contentData.id)
      .set(contentData);

    await db.collection(COLLECTIONS.COURSES).doc(courseId).update({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(res, contentData, "Content added", 201);
  } catch (e) {
    return errorResponse(res, "Failed to add content", 500);
  }
};

export const getCourseContent = async (req, res) => {
  try {
    const { courseId } = req.params;

    const courseSnap = await db
      .collection(COLLECTIONS.COURSES)
      .doc(courseId)
      .get();
    if (!courseSnap.exists) {
      return errorResponse(res, "Course not found", 404);
    }

    const courseData = courseSnap.data();
    const subjects = Array.isArray(courseData.subjects)
      ? courseData.subjects
      : [];

    const contentSnap = await db
      .collection(COLLECTIONS.COURSES)
      .doc(courseId)
      .collection("content")
      .get();

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

    return successResponse(res, result, "Course content fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch course content", 500);
  }
};

export const deleteCourseContent = async (req, res) => {
  try {
    const { courseId, contentId } = req.params;

    await db
      .collection(COLLECTIONS.COURSES)
      .doc(courseId)
      .collection("content")
      .doc(contentId)
      .delete();

    await db.collection(COLLECTIONS.COURSES).doc(courseId).update({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(res, { contentId }, "Content deleted");
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
      assignedCourses = [],
      shifts = [],
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

    const resolvedCourses = await buildAssignedCourses(assignedCourses);
    if (resolvedCourses.length < 1) {
      return errorResponse(res, "At least 1 course is required", 400);
    }

    if (!Array.isArray(shifts) || shifts.length < 1) {
      return errorResponse(res, "At least 1 shift is required", 400);
    }

    const normalizedShifts = [];
    for (const shift of shifts) {
      const resolved = await buildShiftPayload(shift, resolvedCourses, startDate);
      if (resolved.error) {
        return errorResponse(res, resolved.error, 400);
      }
      normalizedShifts.push(resolved.data);
    }

    const classPayload = {
      name: String(name).trim(),
      batchCode: String(batchCode).trim() || generateBatchCode(name),
      description: String(description || "").trim(),
      status: normalizeStatus(status),
      capacity: parsedCapacity,
      enrolledCount: 0,
      students: [],
      assignedCourses: resolvedCourses,
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

    const existingAssignedCourses = Array.isArray(classData.assignedCourses)
      ? classData.assignedCourses
      : [];
    const existingShifts = Array.isArray(classData.shifts) ? classData.shifts : [];

    let nextAssignedCourses = existingAssignedCourses;
    if (req.body.assignedCourses !== undefined) {
      nextAssignedCourses = await buildAssignedCourses(req.body.assignedCourses);
      if (nextAssignedCourses.length < 1) {
        return errorResponse(res, "At least 1 course is required", 400);
      }
      updates.assignedCourses = nextAssignedCourses;
    }

    let nextShifts = existingShifts;
    if (req.body.shifts !== undefined) {
      if (!Array.isArray(req.body.shifts) || req.body.shifts.length < 1) {
        return errorResponse(res, "At least 1 shift is required", 400);
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
    } else if (req.body.assignedCourses !== undefined) {
      const assignedCourseIds = new Set(
        nextAssignedCourses.map((course) => course.courseId)
      );
      const hasInvalidShift = existingShifts.some(
        (shift) => !assignedCourseIds.has(shift.courseId)
      );
      if (hasInvalidShift) {
        return errorResponse(
          res,
          "Remove or update shifts that use removed courses first",
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

    if (req.body.batchCode !== undefined) {
      updates.batchCode =
        String(req.body.batchCode || "").trim() ||
        String(classData.batchCode || generateBatchCode(updates.name || classData.name));
    }

    updates.teachers = collectTeachersFromShifts(nextShifts);
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await classRef.update(updates);
    return successResponse(res, { classId }, "Class updated");
  } catch (e) {
    return errorResponse(res, "Failed to update class", 500);
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
    const assignedCourses = Array.isArray(classData.assignedCourses)
      ? classData.assignedCourses
      : [];
    const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
    const teachers = Array.isArray(classData.teachers) ? classData.teachers : [];

    if (
      enrolledCount > 0 ||
      students.length > 0 ||
      assignedCourses.length > 0 ||
      shifts.length > 0 ||
      teachers.length > 0
    ) {
      return errorResponse(
        res,
        "Cannot delete class while it has students, courses, or teachers assigned",
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
    const { courseId } = req.body;

    if (!courseId) {
      return errorResponse(res, "courseId is required", 400);
    }

    const classRef = db.collection(COLLECTIONS.CLASSES).doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists) {
      return errorResponse(res, "Class not found", 404);
    }

    const classData = classSnap.data() || {};
    const assignedCourses = Array.isArray(classData.assignedCourses)
      ? classData.assignedCourses
      : [];
    if (assignedCourses.some((course) => course.courseId === courseId)) {
      return errorResponse(res, "Course already assigned to class", 409);
    }

    const courseMeta = await getCourseMeta(courseId);
    if (!courseMeta) {
      return errorResponse(res, "Course not found", 404);
    }

    assignedCourses.push(courseMeta);

    await classRef.update({
      assignedCourses,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(res, courseMeta, "Course assigned to class", 201);
  } catch (e) {
    return errorResponse(res, "Failed to assign course", 500);
  }
};

export const removeClassCourse = async (req, res) => {
  try {
    const { classId, courseId } = req.params;

    const classRef = db.collection(COLLECTIONS.CLASSES).doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists) {
      return errorResponse(res, "Class not found", 404);
    }

    const classData = classSnap.data() || {};
    const assignedCourses = Array.isArray(classData.assignedCourses)
      ? classData.assignedCourses
      : [];
    const nextAssignedCourses = assignedCourses.filter(
      (course) => course.courseId !== courseId
    );
    if (nextAssignedCourses.length === assignedCourses.length) {
      return errorResponse(res, "Course not assigned to class", 404);
    }

    const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
    const hasCourseShift = shifts.some((shift) => shift.courseId === courseId);
    if (hasCourseShift) {
      return errorResponse(
        res,
        "Remove shifts linked to this course first",
        400
      );
    }

    await classRef.update({
      assignedCourses: nextAssignedCourses,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(res, { courseId }, "Course removed from class");
  } catch (e) {
    return errorResponse(res, "Failed to remove course", 500);
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
    const assignedCourses = Array.isArray(classData.assignedCourses)
      ? classData.assignedCourses
      : [];
    if (assignedCourses.length < 1) {
      return errorResponse(res, "Assign at least one course before adding shifts", 400);
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
            courseId: String(entry?.courseId || "").trim(),
            enrolledAt: entry?.enrolledAt || null,
          }
    )
    .filter((entry) => Boolean(entry.studentId));

const getClassAssignedCourseIds = (classData = {}) => {
  const ids = [];
  const assignedCourses = Array.isArray(classData.assignedCourses)
    ? classData.assignedCourses
    : [];
  assignedCourses.forEach((entry) => {
    const courseId =
      typeof entry === "string"
        ? String(entry || "").trim()
        : String(entry?.courseId || entry?.id || "").trim();
    if (courseId) ids.push(courseId);
  });

  const classCourseId = String(classData.courseId || "").trim();
  if (classCourseId) ids.push(classCourseId);

  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  shifts.forEach((shift) => {
    const shiftCourseId = String(shift?.courseId || "").trim();
    if (shiftCourseId) ids.push(shiftCourseId);
  });

  return [...new Set(ids)];
};

const buildKnownError = (message, meta = {}) => {
  const error = new Error(message);
  error.meta = meta;
  return error;
};

const enrollStudentInClassCore = async ({ classId, studentId, shiftId = "" }) => {
  const cleanClassId = String(classId || "").trim();
  const cleanStudentId = String(studentId || "").trim();
  const cleanShiftId = String(shiftId || "").trim();
  if (!cleanClassId) throw buildKnownError("CLASS_NOT_FOUND");
  if (!cleanStudentId) throw buildKnownError("STUDENT_REQUIRED");

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

    if (normalizedStudents.some((entry) => entry.studentId === cleanStudentId)) {
      throw buildKnownError("ALREADY_ENROLLED");
    }
    if (currentCount >= capacity) {
      throw buildKnownError("CLASS_FULL", { capacity, currentCount });
    }

    const enrollmentStatus = getEnrollmentStatusFromClassDates(classData);
    if (enrollmentStatus === "completed") {
      throw buildKnownError("CLASS_ENDED");
    }

    const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
    const selectedShift = cleanShiftId
      ? shifts.find((shift) => String(shift?.id || "").trim() === cleanShiftId)
      : shifts[0] || null;
    if (cleanShiftId && !selectedShift) {
      throw buildKnownError("SHIFT_NOT_FOUND");
    }

    const assignedCourseIds = getClassAssignedCourseIds(classData);
    if (!assignedCourseIds.length) {
      throw buildKnownError("CLASS_HAS_NO_COURSES");
    }

    const enrollmentQuery = db
      .collection(COLLECTIONS.ENROLLMENTS)
      .where("studentId", "==", cleanStudentId);
    const enrollmentSnap = await transaction.get(enrollmentQuery);
    const existingRows = enrollmentSnap.docs.map((doc) => ({
      ref: doc.ref,
      data: doc.data() || {},
    }));

    const enrolledAt = new Date().toISOString();
    const nextStudents = [
      ...normalizedStudents,
      {
        studentId: cleanStudentId,
        shiftId: String(selectedShift?.id || "").trim(),
        courseId: String(selectedShift?.courseId || "").trim(),
        enrolledAt,
      },
    ];

    transaction.update(classRef, {
      students: nextStudents,
      enrolledCount: nextStudents.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    let createdEnrollmentCount = 0;
    for (const courseId of assignedCourseIds) {
      const existingEnrollment = existingRows.find((row) => {
        const existingCourseId = String(row.data?.courseId || "").trim();
        const existingClassId = String(row.data?.classId || "").trim();
        return existingCourseId === courseId && existingClassId === cleanClassId;
      });

      if (existingEnrollment) {
        const existingData = existingEnrollment.data || {};
        const mergedStatus = mergeEnrollmentStatus(
          existingData.status,
          enrollmentStatus
        );
        transaction.set(
          existingEnrollment.ref,
          {
            classId: cleanClassId,
            shiftId: String(selectedShift?.id || "").trim(),
            status: mergedStatus,
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
        courseId,
        classId: cleanClassId,
        shiftId: String(selectedShift?.id || "").trim() || null,
        status: enrollmentStatus,
        progress: 0,
        completedAt: null,
        enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
        classStartDate: classData.startDate || null,
        classEndDate: classData.endDate || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: "class_enrollment",
      });

      transaction.set(
        db.collection(COLLECTIONS.COURSES).doc(courseId),
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
    if (assignedCourseIds.length > 0) {
      studentUpdates.enrolledCourses = admin.firestore.FieldValue.arrayUnion(
        ...assignedCourseIds
      );
    }
    transaction.set(studentRef, studentUpdates, { merge: true });

    result = {
      classId: cleanClassId,
      className,
      studentId: cleanStudentId,
      coursesEnrolled: assignedCourseIds.length,
      createdEnrollments: createdEnrollmentCount,
      remainingCapacity: Math.max(capacity - nextStudents.length, 0),
      capacity,
      currentCount: nextStudents.length,
      shiftId: String(selectedShift?.id || "").trim() || null,
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

    if (!studentId) {
      return errorResponse(res, "studentId is required", 400);
    }
    if (!shiftId) {
      return errorResponse(res, "shiftId is required", 400);
    }

    const result = await enrollStudentInClassCore({
      classId,
      studentId,
      shiftId,
    });

    return successResponse(
      res,
      result,
      `Student enrolled in ${result.className || "class"}! Access granted to ${result.coursesEnrolled} course(s).`
    );
  } catch (e) {
    const meta = e?.meta || {};
    if (e.message === "CLASS_NOT_FOUND") {
      return errorResponse(res, "Class not found", 404);
    }
    if (e.message === "STUDENT_NOT_FOUND") {
      return errorResponse(res, "Student not found", 404);
    }
    if (e.message === "ALREADY_ENROLLED") {
      return errorResponse(
        res,
        "Student is already enrolled in this class",
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
    if (e.message === "CLASS_ENDED") {
      return errorResponse(
        res,
        "Cannot enroll student. This class has already ended.",
        400
      );
    }
    if (e.message === "CLASS_HAS_NO_COURSES") {
      return errorResponse(res, "This class has no assigned courses", 400);
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
    const assignedCourses = Array.isArray(classData.assignedCourses)
      ? classData.assignedCourses
      : [];
    const shiftMap = {};
    shifts.forEach((shift) => {
      shiftMap[shift.id] = shift;
    });
    const courseMap = {};
    assignedCourses.forEach((course) => {
      courseMap[course.courseId] = course;
    });

    const studentEntries = Array.isArray(classData.students) ? classData.students : [];
    const normalizedEntries = studentEntries.map((entry) =>
      typeof entry === "string"
        ? { studentId: entry, shiftId: "", courseId: "", enrolledAt: null }
        : {
            studentId: entry.studentId,
            shiftId: entry.shiftId || "",
            courseId: entry.courseId || "",
            enrolledAt: entry.enrolledAt || null,
          }
    );

    if (normalizedEntries.length < 1) {
      return successResponse(res, [], "Class students fetched");
    }

    const uniqueIds = [...new Set(normalizedEntries.map((entry) => entry.studentId))];
    const [studentRoleSnaps, userSnaps] = await Promise.all([
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
    ]);

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
        courseId: entry.courseId || shift?.courseId || "",
        courseName: course?.courseName || shift?.courseName || "",
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

    if (!studentId) {
      return errorResponse(res, "studentId is required", 400);
    }

    const result = await enrollStudentInClassCore({
      classId,
      studentId,
      shiftId,
    });

    return successResponse(
      res,
      result,
      `Student enrolled in ${result.className || "class"}! Access granted to ${result.coursesEnrolled} course(s).`
    );
  } catch (e) {
    const meta = e?.meta || {};
    if (e.message === "CLASS_NOT_FOUND") {
      return errorResponse(res, "Class not found", 404);
    }
    if (e.message === "STUDENT_NOT_FOUND") {
      return errorResponse(res, "Student not found", 404);
    }
    if (e.message === "ALREADY_ENROLLED") {
      return errorResponse(
        res,
        "Student is already enrolled in this class",
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
    if (e.message === "CLASS_HAS_NO_COURSES") {
      return errorResponse(res, "This class has no assigned courses", 400);
    }
    if (e.message === "CLASS_ENDED") {
      return errorResponse(
        res,
        "Cannot enroll student. This class has already ended.",
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
      const rowCourseId = String(row.data.courseId || "").trim();
      if (rowClassId !== cleanClassId) return false;
      if (!assignedCourseIds.length) return true;
      return assignedCourseIds.includes(rowCourseId);
    });

    const decrementByCourse = docsToDelete.reduce((acc, row) => {
      const courseId = String(row.data.courseId || "").trim();
      if (!courseId) return acc;
      acc[courseId] = (acc[courseId] || 0) + 1;
      return acc;
    }, {});

    const remainingEnrollments = studentEnrollments.filter(
      (row) => !docsToDelete.some((removeRow) => removeRow.id === row.id)
    );
    const remainingCourseIds = new Set(
      remainingEnrollments
        .map((row) => String(row.data.courseId || "").trim())
        .filter(Boolean)
    );
    const removedCourseIds = [
      ...new Set(docsToDelete.map((row) => String(row.data.courseId || "").trim()).filter(Boolean)),
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
      `${studentName} removed from class. Access to class courses revoked.`
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
    const { action } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return errorResponse(res, "Action must be approve or reject", 400);
    }

    const newStatus = action === "approve" ? "paid" : "rejected";

    await db.collection(COLLECTIONS.PAYMENTS).doc(paymentId).update({
      status: newStatus,
      verifiedBy: req.user.uid,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (action === "approve") {
      const paySnap = await db
        .collection(COLLECTIONS.PAYMENTS)
        .doc(paymentId)
        .get();
      const payData = paySnap.data();

      await db.collection(COLLECTIONS.ENROLLMENTS).add({
        studentId: payData.studentId,
        courseId: payData.courseId,
        paymentId,
        status: "active",
        progress: 0,
        completedAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.COURSES)
        .doc(payData.courseId)
        .update({
          enrollmentCount: admin.firestore.FieldValue.increment(1),
        });
    }

    return successResponse(
      res,
      { paymentId, status: newStatus },
      "Payment updated"
    );
  } catch (e) {
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
      const expiryDate = new Date(expiresAt);
      if (Number.isNaN(expiryDate.getTime())) {
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
        const expiryDate = new Date(expiresAt);
        if (Number.isNaN(expiryDate.getTime())) {
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

    const promoData = snap.docs[0].data();
    const requesterStudentId = studentId || req.user?.uid || "";

    if (!promoData.isActive) {
      return errorResponse(res, "Promo code is inactive", 400);
    }

    if (promoData.expiresAt && new Date(promoData.expiresAt) < new Date()) {
      return errorResponse(res, "Promo code has expired", 400);
    }

    if (
      Number(promoData.usageLimit || 0) > 0 &&
      Number(promoData.usageCount || 0) >= Number(promoData.usageLimit || 0)
    ) {
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
        return (
          String(payment.promoCode || "").toUpperCase() === normalizedCode &&
          String(payment.status || "").toLowerCase() !== "rejected"
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
    const [stats, revenue, enrollments] = await Promise.all([
      adminService.getDashboardStats(),
      adminService.getRevenueChart(Number(days) || 30),
      adminService.getRecentEnrollments(50),
    ]);

    return successResponse(
      res,
      {
        stats,
        revenue,
        enrollments,
        generatedAt: new Date().toISOString(),
      },
      "Analytics report fetched"
    );
  } catch (e) {
    return errorResponse(res, "Failed to generate report", 500);
  }
};
