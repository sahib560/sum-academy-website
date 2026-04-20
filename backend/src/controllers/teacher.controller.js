import { db, admin } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";
import {
  isPakistanPhone,
  normalizePakistanPhone,
} from "../utils/phone.utils.js";
import {
  sendSessionScheduledEmail,
  sendSessionCancelledEmail,
} from "../services/email.service.js";
import { v4 as uuidv4 } from "uuid";

const DAY_INDEX = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getEnrollmentStatusFromClassDates = (classData = {}) => {
  const explicitStatus = String(classData?.status || "")
    .trim()
    .toLowerCase();
  if (
    ["completed", "permanently_completed", "closed"].includes(explicitStatus) ||
    classData?.isCompleted === true ||
    classData?.completed === true ||
    classData?.permanentlyCompleted === true ||
    classData?.completionLocked === true
  ) {
    return "completed";
  }
  const start = toDate(classData?.startDate);
  const end = toDate(classData?.endDate);
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

const toIso = (value) => {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : null;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

const capitalize = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return "Draft";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getNameFromEmail = (email = "") =>
  String(email || "")
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim();

const isFinalQuizEntry = (quiz = {}) => {
  const tags = Array.isArray(quiz.tags) ? quiz.tags : [];
  const toLower = (value) => String(value || "").trim().toLowerCase();
  return (
    quiz.isFinalQuiz === true ||
    toLower(quiz.quizType) === "final" ||
    toLower(quiz.assessmentType) === "final" ||
    toLower(quiz.type) === "final" ||
    toLower(quiz.category) === "final" ||
    toLower(quiz.tag) === "final" ||
    tags.some((tag) => toLower(tag) === "final")
  );
};

const normalizeStudentCourseRefs = (rawCourses = [], enrolledAtMap = {}) => {
  const list = Array.isArray(rawCourses) ? rawCourses : [];
  const rows = [];
  const seen = new Set();

  list.forEach((entry) => {
    const courseId =
      typeof entry === "string"
        ? trimText(entry)
        : trimText(entry?.courseId || entry?.id);
    if (!courseId || seen.has(courseId)) return;
    seen.add(courseId);
    rows.push({
      courseId,
      enrolledAt:
        toIso(enrolledAtMap?.[courseId]) ||
        toIso(
          typeof entry === "object"
            ? entry?.enrolledAt || entry?.createdAt
            : null
        ),
    });
  });

  return rows;
};

const resolveStudentName = (studentDoc = {}, userDoc = {}) => {
  return (
    studentDoc.fullName ||
    studentDoc.name ||
    userDoc.fullName ||
    userDoc.name ||
    userDoc.displayName ||
    getNameFromEmail(userDoc.email) ||
    "Student"
  );
};

const subjectHasTeacher = (subject = {}, teacherId = "") => {
  const cleanId = trimText(teacherId);
  if (!cleanId) return false;
  if (trimText(subject.teacherId) === cleanId) return true;
  const teacherIds = Array.isArray(subject.teacherIds) ? subject.teacherIds : [];
  if (teacherIds.some((id) => trimText(id) === cleanId)) return true;
  const teachers = Array.isArray(subject.teachers) ? subject.teachers : [];
  return teachers.some(
    (row) => trimText(row?.teacherId || row?.id || row?.uid) === cleanId
  );
};

const normalizeTeacherCourseIds = (courses = [], teacherId = "") => {
  return courses
    .filter((course) => {
      const data = course.data || {};
      const legacyTeacherMatch = String(data.teacherId || "") === teacherId;
      const subjects = Array.isArray(data.subjects) ? data.subjects : [];
      const subjectMatch = subjects.some(
        (subject) => subjectHasTeacher(subject, teacherId)
      );
      return legacyTeacherMatch || subjectMatch;
    })
    .map((course) => course.id);
};

const getNextShiftDate = (days = [], minDate, maxDate) => {
  if (!Array.isArray(days) || !days.length || !minDate || !maxDate) return null;

  const dayIndexes = days
    .map((day) => DAY_INDEX[String(day || "").trim().toLowerCase()])
    .filter((day) => Number.isInteger(day));

  if (!dayIndexes.length) return null;

  const start = new Date(minDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(maxDate);
  end.setHours(23, 59, 59, 999);

  let best = null;
  for (const targetDay of dayIndexes) {
    const candidate = new Date(start);
    const diff = (targetDay - candidate.getDay() + 7) % 7;
    candidate.setDate(candidate.getDate() + diff);
    if (candidate < start || candidate > end) continue;
    if (!best || candidate < best) best = candidate;
  }

  return best;
};

export const getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user?.uid;
    if (!teacherId) {
      return errorResponse(res, "Missing teacher uid", 400);
    }

    const [allCourses, classesSnap, enrollmentsSnap, quizResultsSnap] =
      await Promise.all([
        getUnifiedCourseRows(),
        db.collection(COLLECTIONS.CLASSES).get(),
        db.collection(COLLECTIONS.ENROLLMENTS).get(),
        db.collection(COLLECTIONS.QUIZ_RESULTS).get(),
      ]);

    const teacherOwnedCourseIds = new Set(
      normalizeTeacherCourseIds(allCourses, teacherId)
    );
    const teacherClassDocs = classesSnap.docs
      .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
      .filter((row) => {
        if (isTeacherAssignedToClass(row.data, teacherId)) return true;
        const classCourseIds = getClassAssignedCourseIds(row.data);
        return classCourseIds.some((courseId) =>
          teacherOwnedCourseIds.has(trimText(courseId))
        );
      });

    const teacherCourseIds = new Set([
      ...teacherOwnedCourseIds,
      ...getTeacherClassDerivedCourseIds(teacherClassDocs, teacherId),
    ]);

    const teacherCourses = allCourses.filter((course) =>
      teacherCourseIds.has(course.id)
    );

    const courseMetaById = {};
    teacherCourses.forEach((course) => {
      courseMetaById[course.id] = course.data;
    });

    const teacherEnrollments = enrollmentsSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => teacherCourseIds.has(String(row.courseId || "")));

    const inferredEnrollments = buildClassDerivedEnrollmentRows(
      teacherClassDocs,
      Array.from(teacherCourseIds)
    );
    const mergedEnrollments = mergeEnrollmentRowsByStudentCourse(
      teacherEnrollments,
      inferredEnrollments
    );

    const uniqueStudentIds = new Set(
      mergedEnrollments
        .map((row) => String(row.studentId || "").trim())
        .filter(Boolean)
    );

    const [studentDocs, userDocs] = await Promise.all([
      Promise.all(
        Array.from(uniqueStudentIds).map(async (studentId) => {
          const snap = await db.collection(COLLECTIONS.STUDENTS).doc(studentId).get();
          return [studentId, snap.exists ? snap.data() || {} : {}];
        })
      ),
      Promise.all(
        Array.from(uniqueStudentIds).map(async (studentId) => {
          const snap = await db.collection(COLLECTIONS.USERS).doc(studentId).get();
          return [studentId, snap.exists ? snap.data() || {} : {}];
        })
      ),
    ]);

    const studentById = Object.fromEntries(studentDocs);
    const userById = Object.fromEntries(userDocs);

    const enrollmentMetrics = {};
    mergedEnrollments.forEach((row) => {
      const courseId = String(row.courseId || "");
      if (!courseId) return;
      if (!enrollmentMetrics[courseId]) {
        enrollmentMetrics[courseId] = {
          count: 0,
          progressTotal: 0,
          progressRows: 0,
        };
      }
      enrollmentMetrics[courseId].count += 1;
      const progress = toNumber(row.progress, null);
      if (Number.isFinite(progress)) {
        enrollmentMetrics[courseId].progressTotal += progress;
        enrollmentMetrics[courseId].progressRows += 1;
      }
    });

    const courses = teacherCourses
      .map((course) => {
        const data = course.data || {};
        const metrics = enrollmentMetrics[course.id] || {
          count: 0,
          progressTotal: 0,
          progressRows: 0,
        };

        const fallbackEnrolled = Math.max(
          0,
          toNumber(data.enrollmentCount, 0),
          metrics.count
        );

        const avgCompletion =
          metrics.progressRows > 0
            ? Math.round(metrics.progressTotal / metrics.progressRows)
            : fallbackEnrolled > 0
              ? Math.round(
                  (toNumber(data.completionCount, 0) / fallbackEnrolled) * 100
                )
              : 0;

        return {
          id: course.id,
          title:
            trimText(data.title || data.subjectName || data.courseName) || "Untitled Subject",
          enrolled: fallbackEnrolled,
          completion: Math.max(0, Math.min(100, avgCompletion)),
          status: capitalize(data.status || "draft"),
          updatedAt: toIso(data.updatedAt) || toIso(data.createdAt),
        };
      })
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .slice(0, 8);

    const overallCompletionRate =
      mergedEnrollments.length > 0
        ? Math.round(
            mergedEnrollments.reduce(
              (sum, row) => sum + Math.max(0, Math.min(100, toNumber(row.progress, 0))),
              0
            ) / mergedEnrollments.length
          )
        : 0;

    const pendingQuizReviews = quizResultsSnap.docs
      .map((doc) => doc.data() || {})
      .filter((row) => {
        const courseId = String(row.courseId || "").trim();
        const belongsToTeacherCourse = teacherCourseIds.has(courseId);
        const belongsToTeacher = String(row.teacherId || "").trim() === teacherId;
        if (!belongsToTeacherCourse && !belongsToTeacher) return false;
        const status = String(row.status || "").toLowerCase();
        if (status.includes("pending") || status.includes("submitted")) return true;
        if (row.reviewedAt) return false;
        return row.score === null || row.score === undefined;
      }).length;

    const activities = mergedEnrollments
      .flatMap((row) => {
        const studentId = String(row.studentId || "").trim();
        const studentDoc = studentById[studentId] || {};
        const userDoc = userById[studentId] || {};
        const studentName = resolveStudentName(studentDoc, userDoc);
        const courseMeta = courseMetaById[String(row.courseId || "")] || {};
        const courseName =
          trimText(courseMeta.title || courseMeta.subjectName || courseMeta.courseName) ||
          "Subject";

        const items = [];
        const enrolledAt = toIso(row.createdAt);
        if (enrolledAt) {
          items.push({
            id: `${row.id}-enroll`,
            name: studentName,
            action: "New enrollment",
            course: courseName,
            timestamp: enrolledAt,
          });
        }

        const completedAt = toIso(row.completedAt);
        if (completedAt) {
          items.push({
            id: `${row.id}-completed`,
            name: studentName,
            action: "Course completed",
            course: courseName,
            timestamp: completedAt,
          });
        }
        return items;
      })
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        name: item.name,
        action: item.action,
        course: item.course,
        time: item.timestamp,
      }));

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const sessions = classesSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .flatMap((classData) => {
        const startDate = toDate(classData.startDate) || now;
        const endDate = toDate(classData.endDate) || new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        if (endDate < now) return [];

        const minDate = startDate > now ? startDate : now;
        const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];

        return shifts
          .filter((shift) => String(shift?.teacherId || "") === teacherId)
          .map((shift) => {
            const nextDate = getNextShiftDate(shift?.days || [], minDate, endDate);
            if (!nextDate) return null;
            return {
              id: `${classData.id}-${shift?.id || `${shift?.name || "shift"}-${shift?.startTime || "time"}`}`,
              title: `${classData.name || "Class"} - ${shift?.courseName || shift?.name || "Session"}`,
              date: nextDate.toISOString(),
              time: String(shift?.startTime || "").trim() || "TBD",
            };
          })
          .filter(Boolean);
      })
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
      .slice(0, 6);

    const payload = {
      stats: {
        myCourses: teacherCourses.length,
        totalMyStudents: uniqueStudentIds.size,
        avgCompletionRate: overallCompletionRate,
        pendingQuizReviews,
      },
      courses,
      activities,
      sessions,
    };

    return successResponse(res, payload, "Teacher dashboard fetched");
  } catch (error) {
    console.error("getTeacherDashboard error:", error);
    return errorResponse(res, "Failed to fetch teacher dashboard", 500);
  }
};

const VIDEO_ACCESS_COLLECTION = "videoAccess";
const VIDEO_LIBRARY_COLLECTION = COLLECTIONS.VIDEOS || "videos";
const FINAL_QUIZ_REQUEST_COLLECTION =
  COLLECTIONS.FINAL_QUIZ_REQUESTS || "finalQuizRequests";
const COURSE_STATUSES = new Set(["draft", "published", "archived"]);
const COURSE_MUTABLE_FIELDS = new Set([
  "title",
  "description",
  "shortDescription",
  "category",
  "level",
  "price",
  "discountPercent",
  "status",
  "thumbnail",
  "hasCertificate",
]);
const LECTURE_MUTABLE_FIELDS = new Set([
  "title",
  "order",
  "videoUrl",
  "videoTitle",
  "videoId",
  "videoMode",
  "isLiveSession",
  "videoDuration",
  "pdfNotes",
  "books",
  "isPublished",
]);

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

const trimText = (value = "") => String(value || "").trim();

const lowerText = (value = "") => trimText(value).toLowerCase();
const PERMANENT_COMPLETION_MESSAGE =
  "This class or subject is completed. Your certificate is generated. Thank you for joining us. Keep exploring our other subjects and classes. Thank you.";
const isMarkedCompletedState = (row = {}) => {
  const normalizedStatus = lowerText(
    row?.status || row?.lifecycleStatus || row?.state || ""
  );
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

const toPositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseLectureDurationToSeconds = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value > 0 ? Math.round(value) : 0;
  const raw = trimText(value);
  if (!raw) return 0;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) return Math.round(numeric);
  const hhmmss = raw.match(/^(\d{1,2}):([0-5]?\d):([0-5]?\d)$/);
  if (hhmmss) {
    const h = Number(hhmmss[1]);
    const m = Number(hhmmss[2]);
    const s = Number(hhmmss[3]);
    return h * 3600 + m * 60 + s;
  }
  const mmss = raw.match(/^([0-5]?\d):([0-5]?\d)$/);
  if (mmss) {
    const m = Number(mmss[1]);
    const s = Number(mmss[2]);
    return m * 60 + s;
  }
  return 0;
};

const parseDate = (value) => {
  if (!value) return null;
  try {
    if (typeof value?.toDate === "function") {
      const parsed = value.toDate();
      return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
  } catch {
    // ignore
  }
  const raw = trimText(value);
  // If stored/sent without timezone (no Z / no offset), treat as Pakistan time to avoid
  // "random" UTC shifts when converting to ISO.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw) && !/Z$|[+-]\d{2}:\d{2}$/.test(raw)) {
    const normalized = raw.length === 16 ? `${raw}:00` : raw; // add seconds if missing
    const parsedPk = new Date(`${normalized}+05:00`);
    return Number.isNaN(parsedPk.getTime()) ? null : parsedPk;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const PK_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
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

const formatPkDateTimeLocal = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return null;
  const parts = PK_DATE_TIME_FORMATTER.formatToParts(parsed);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;
  const second = parts.find((p) => p.type === "second")?.value;
  if (!year || !month || !day || !hour || !minute || !second) return null;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

const ACTIVE_ENROLLMENT_STATUSES = new Set([
  "active",
  "upcoming",
  "completed",
  "pending_review",
  "",
]);
const FINAL_QUIZ_REQUEST_ACTIONS = new Set(["approve", "reject", "complete"]);

const getClassShiftCourseMap = (classData = {}) => {
  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  return shifts.reduce((acc, shift) => {
    const shiftId = trimText(shift?.id);
    const courseId = trimText(shift?.subjectId || shift?.courseId);
    if (shiftId && courseId) acc[shiftId] = courseId;
    return acc;
  }, {});
};

const getClassAssignedCourseIds = (classData = {}) => {
  const ids = [];
  const directCourseId = trimText(classData.courseId);
  if (directCourseId) ids.push(directCourseId);

  const assignedSubjects = Array.isArray(classData.assignedSubjects)
    ? classData.assignedSubjects
    : [];
  assignedSubjects.forEach((entry) => {
    const courseId =
      typeof entry === "string"
        ? trimText(entry)
        : trimText(entry?.subjectId || entry?.courseId || entry?.id);
    if (courseId) ids.push(courseId);
  });

  const assignedCourses = Array.isArray(classData.assignedCourses)
    ? classData.assignedCourses
    : [];
  assignedCourses.forEach((entry) => {
    const courseId =
      typeof entry === "string"
        ? trimText(entry)
        : trimText(entry?.subjectId || entry?.courseId || entry?.id);
    if (courseId) ids.push(courseId);
  });

  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  shifts.forEach((shift) => {
    const courseId = trimText(shift?.subjectId || shift?.courseId);
    if (courseId) ids.push(courseId);
  });

  return [...new Set(ids)];
};

const ensureSubjectEditableForContent = async (courseId = "") => {
  const cleanCourseId = trimText(courseId);
  if (!cleanCourseId) {
    return { editable: false, error: "courseId is required", status: 400 };
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
    return getClassAssignedCourseIds(classData).includes(cleanCourseId);
  });

  if (subjectCompleted || classCompleted) {
    return {
      editable: false,
      error: PERMANENT_COMPLETION_MESSAGE,
      status: 400,
      code: "SUBJECT_OR_CLASS_COMPLETED",
    };
  }

  return { editable: true };
};

const isTeacherListedInClassTeachers = (classData = {}, uid = "") => {
  const cleanUid = trimText(uid);
  if (!cleanUid) return false;
  const teachers = Array.isArray(classData.teachers) ? classData.teachers : [];
  return teachers.some((entry) => {
    if (typeof entry === "string") return trimText(entry) === cleanUid;
    return (
      trimText(entry?.teacherId) === cleanUid ||
      trimText(entry?.id) === cleanUid ||
      trimText(entry?.uid) === cleanUid
    );
  });
};

const getTeacherCourseIdsFromClassData = (
  classData = {},
  uid = "",
  teacherOwnedCourseIds = []
) => {
  const cleanUid = trimText(uid);
  if (!cleanUid) return [];

  const shiftCourses = (Array.isArray(classData.shifts) ? classData.shifts : [])
    .filter((shift) => trimText(shift?.teacherId) === cleanUid)
    .map((shift) => trimText(shift?.subjectId || shift?.courseId))
    .filter(Boolean);
  if (shiftCourses.length) return [...new Set(shiftCourses)];

  if (
    trimText(classData.teacherId) === cleanUid ||
    isTeacherListedInClassTeachers(classData, cleanUid)
  ) {
    return getClassAssignedCourseIds(classData);
  }

  const ownedSet = new Set(
    (Array.isArray(teacherOwnedCourseIds) ? teacherOwnedCourseIds : [])
      .map((id) => trimText(id))
      .filter(Boolean)
  );
  if (ownedSet.size > 0) {
    const classCourseIds = getClassAssignedCourseIds(classData);
    const linkedOwned = classCourseIds.filter((courseId) => ownedSet.has(trimText(courseId)));
    if (linkedOwned.length > 0) return [...new Set(linkedOwned)];
  }

  return [];
};

const getTeacherClassDerivedCourseIds = (
  classDocs = [],
  uid = "",
  teacherOwnedCourseIds = []
) => {
  const courseIds = new Set();
  classDocs.forEach((row) => {
    getTeacherCourseIdsFromClassData(
      row?.data || {},
      uid,
      teacherOwnedCourseIds
    ).forEach((courseId) => {
      const cleanCourseId = trimText(courseId);
      if (cleanCourseId) courseIds.add(cleanCourseId);
    });
  });
  return Array.from(courseIds);
};

const getTeacherClassesByCourseId = (
  classDocs = [],
  uid = "",
  teacherOwnedCourseIds = []
) => {
  const map = {};
  classDocs.forEach((row) => {
    const classId = trimText(row?.id);
    const classData = row?.data || {};
    if (!classId) return;
    const linkedCourseIds = getTeacherCourseIdsFromClassData(
      classData,
      uid,
      teacherOwnedCourseIds
    );
    linkedCourseIds.forEach((courseId) => {
      const cleanCourseId = trimText(courseId);
      if (!cleanCourseId) return;
      if (!Array.isArray(map[cleanCourseId])) map[cleanCourseId] = [];
      if (map[cleanCourseId].some((item) => item.id === classId)) return;
      map[cleanCourseId].push({
        id: classId,
        name: trimText(classData.name) || "Class",
        batchCode: trimText(classData.batchCode),
      });
    });
  });
  return map;
};

const resolveClassEntryCourseIds = (entry = {}, classData = {}) => {
  const explicitCourseId = trimText(entry?.courseId);
  if (explicitCourseId) return [explicitCourseId];

  const shiftId = trimText(entry?.shiftId);
  const shiftCourseMap = getClassShiftCourseMap(classData);
  if (shiftId && shiftCourseMap[shiftId]) return [shiftCourseMap[shiftId]];

  const assignedCourseIds = getClassAssignedCourseIds(classData);
  if (assignedCourseIds.length === 1) return [assignedCourseIds[0]];

  return [];
};

const isClassUnlockedForStudent = (classData = {}, studentId = "") => {
  const cleanStudentId = trimText(studentId);
  if (!cleanStudentId) return false;

  const directIds = Array.isArray(classData.unlockedStudentIds)
    ? classData.unlockedStudentIds
    : [];
  if (directIds.some((entry) => trimText(entry) === cleanStudentId)) return true;

  const rewatchIds = Array.isArray(classData.rewatchUnlockedStudentIds)
    ? classData.rewatchUnlockedStudentIds
    : [];
  if (rewatchIds.some((entry) => trimText(entry) === cleanStudentId)) return true;

  const rows = Array.isArray(classData.unlockedStudents) ? classData.unlockedStudents : [];
  return rows.some((entry) => {
    const entryId =
      typeof entry === "string"
        ? trimText(entry)
        : trimText(entry?.studentId || entry?.id || entry?.uid);
    if (entryId !== cleanStudentId) return false;
    if (typeof entry === "object" && entry?.active === false) return false;
    return true;
  });
};

const buildUnlockedStudentRows = (rows = [], studentId = "", unlocked = true, updatedBy = "") => {
  const cleanStudentId = trimText(studentId);
  if (!cleanStudentId) return Array.isArray(rows) ? rows : [];
  const existing = Array.isArray(rows) ? rows : [];

  const filtered = existing.filter((entry) => {
    const entryId =
      typeof entry === "string"
        ? trimText(entry)
        : trimText(entry?.studentId || entry?.id || entry?.uid);
    return entryId && entryId !== cleanStudentId;
  });

  if (!unlocked) return filtered;

  return [
    ...filtered,
    {
      studentId: cleanStudentId,
      active: true,
      unlockedAt: new Date().toISOString(),
      unlockedBy: trimText(updatedBy),
    },
  ];
};

const buildClassDerivedEnrollmentRows = (classDocs = [], allowedCourseIds = []) => {
  const allowedSet = new Set(
    (Array.isArray(allowedCourseIds) ? allowedCourseIds : [])
      .map((id) => trimText(id))
      .filter(Boolean)
  );
  const hasCourseFilter = allowedSet.size > 0;

  const rows = [];
  classDocs.forEach((row) => {
    const classId = trimText(row?.id);
    const classData = row?.data || {};
    const students = getClassStudentEntries(classData);
    students.forEach((entry) => {
      const studentId = trimText(entry?.studentId);
      if (!studentId) return;
      const courseIds = resolveClassEntryCourseIds(entry, classData);
      courseIds.forEach((courseId) => {
        const cleanCourseId = trimText(courseId);
        if (!cleanCourseId) return;
        if (hasCourseFilter && !allowedSet.has(cleanCourseId)) return;
        rows.push({
          id: `class_${classId}_${studentId}_${cleanCourseId}`,
          studentId,
          courseId: cleanCourseId,
          classId,
          shiftId: trimText(entry?.shiftId),
          status: getEnrollmentStatusFromClassDates(classData),
          progress: 0,
          classStartDate: classData?.startDate || null,
          classEndDate: classData?.endDate || null,
          createdAt: entry?.enrolledAt || classData.updatedAt || classData.createdAt || null,
          updatedAt: entry?.enrolledAt || classData.updatedAt || classData.createdAt || null,
          source: "class_membership",
        });
      });
    });
  });

  return rows;
};

const mergeEnrollmentRowsByStudentCourse = (directRows = [], inferredRows = []) => {
  const byKey = new Map();

  const addRow = (row, priority) => {
    const studentId = trimText(row?.studentId);
    const courseId = trimText(row?.courseId);
    if (!studentId || !courseId) return;

    const status = lowerText(row?.status || "active");
    if (priority >= 2 && !ACTIVE_ENROLLMENT_STATUSES.has(status)) return;

    const key = `${studentId}::${courseId}`;
    const existing = byKey.get(key);
    if (!existing || priority > existing.priority) {
      byKey.set(key, { priority, value: { ...row, studentId, courseId } });
    }
  };

  directRows.forEach((row) => addRow(row, 2));
  inferredRows.forEach((row) => addRow(row, 1));

  return Array.from(byKey.values()).map((entry) => entry.value);
};

const getLiveEnrollmentRowsForCourses = async (courseIds = []) => {
  const cleanCourseIds = [...new Set(courseIds.map((id) => trimText(id)).filter(Boolean))];
  if (!cleanCourseIds.length) return [];

  const enrollmentSnapshots = await Promise.all(
    chunkArray(cleanCourseIds, 10).map((ids) =>
      db.collection(COLLECTIONS.ENROLLMENTS).where("courseId", "in", ids).get()
    )
  );
  const directRows = enrollmentSnapshots.flatMap((snap) =>
    snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
  );

  const classesSnap = await db.collection(COLLECTIONS.CLASSES).get();
  const classDocs = classesSnap.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() || {},
  }));
  const inferredRows = buildClassDerivedEnrollmentRows(classDocs, cleanCourseIds);

  return mergeEnrollmentRowsByStudentCourse(directRows, inferredRows);
};

const getLiveEnrollmentCountByCourse = async (courseIds = []) => {
  const rows = await getLiveEnrollmentRowsForCourses(courseIds);
  return rows.reduce((acc, row) => {
    const courseId = trimText(row.subjectId || row.courseId);
    if (!courseId) return acc;
    acc[courseId] = (acc[courseId] || 0) + 1;
    return acc;
  }, {});
};

const buildCourseLikeDataFromSubject = (id, data = {}) => {
  const title = trimText(data.title || data.subjectName || data.courseName) || "Untitled Subject";
  const teacherId = trimText(data.teacherId);
  const teacherName = trimText(data.teacherName) || "Teacher";
  const teachers = Array.isArray(data.teachers) ? data.teachers : [];
  const teacherIds = Array.isArray(data.teacherIds) ? data.teacherIds : [];
  return {
    title,
    description: trimText(data.description),
    shortDescription: trimText(data.shortDescription),
    category: trimText(data.category),
    level: trimText(data.level) || "beginner",
    status: lowerText(data.status || "published") || "published",
    thumbnail: data.thumbnail || null,
    subjects: [
      {
        id,
        name: title,
        teacherId,
        teacherName,
        teachers,
        teacherIds,
        order: 1,
      },
    ],
    enrollmentCount: toPositiveNumber(data.enrollmentCount, 0),
    completionCount: toPositiveNumber(data.completionCount, 0),
    rating: toPositiveNumber(data.rating, 0),
    ratingCount: toPositiveNumber(data.ratingCount, 0),
    hasCertificate: data.hasCertificate !== false,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    teacherId,
    teacherName,
    teachers,
    teacherIds,
    __docId: id,
    __source: "subjects",
  };
};

const mergeCourseAndSubjectData = (id, legacyCourseData = {}, subjectData = {}) => {
  const courseData = legacyCourseData || {};
  const subjectLike = buildCourseLikeDataFromSubject(id, subjectData || {});
  const mergedTitle =
    trimText(subjectLike.title || courseData.title || courseData.subjectName || courseData.courseName) ||
    "Untitled Subject";
  const mergedCategory =
    trimText(subjectLike.category || courseData.category || subjectLike.subjectName || courseData.subjectName) ||
    "General";

  return {
    ...courseData,
    ...subjectLike,
    title: mergedTitle,
    category: mergedCategory,
    teacherId: trimText(subjectLike.teacherId || courseData.teacherId),
    teacherName: trimText(subjectLike.teacherName || courseData.teacherName || "Teacher") || "Teacher",
    teachers: Array.isArray(subjectLike.teachers) && subjectLike.teachers.length > 0
      ? subjectLike.teachers
      : Array.isArray(courseData.teachers)
        ? courseData.teachers
        : [],
    teacherIds: Array.isArray(subjectLike.teacherIds) && subjectLike.teacherIds.length > 0
      ? subjectLike.teacherIds
      : Array.isArray(courseData.teacherIds)
        ? courseData.teacherIds
        : [],
    subjects:
      Array.isArray(subjectLike.subjects) && subjectLike.subjects.length > 0
        ? subjectLike.subjects
        : Array.isArray(courseData.subjects)
          ? courseData.subjects
          : [],
    enrollmentCount: Math.max(
      toPositiveNumber(courseData.enrollmentCount, 0),
      toPositiveNumber(subjectLike.enrollmentCount, 0)
    ),
    completionCount: Math.max(
      toPositiveNumber(courseData.completionCount, 0),
      toPositiveNumber(subjectLike.completionCount, 0)
    ),
    rating: toPositiveNumber(courseData.rating ?? subjectLike.rating, 0),
    ratingCount: Math.max(
      toPositiveNumber(courseData.ratingCount, 0),
      toPositiveNumber(subjectLike.ratingCount, 0)
    ),
    hasCertificate:
      courseData.hasCertificate === false || subjectLike.hasCertificate === false ? false : true,
    createdAt: courseData.createdAt || subjectLike.createdAt || null,
    updatedAt: courseData.updatedAt || subjectLike.updatedAt || null,
    __docId: id,
    __source: "merged_subject_course",
  };
};

const getUnifiedCourseRows = async () => {
  const [coursesSnap, subjectsSnap] = await Promise.all([
    db.collection(COLLECTIONS.COURSES).get(),
    db.collection(COLLECTIONS.SUBJECTS).get(),
  ]);

  const rowsById = {};
  coursesSnap.docs.forEach((doc) => {
    rowsById[doc.id] = {
      id: doc.id,
      data: {
        ...(doc.data() || {}),
        __docId: doc.id,
        __source: "courses",
      },
    };
  });

  subjectsSnap.docs.forEach((doc) => {
    const subjectData = doc.data() || {};
    if (rowsById[doc.id]) {
      rowsById[doc.id] = {
        id: doc.id,
        data: mergeCourseAndSubjectData(doc.id, rowsById[doc.id].data || {}, subjectData),
      };
      return;
    }
    rowsById[doc.id] = {
      id: doc.id,
      data: buildCourseLikeDataFromSubject(doc.id, subjectData),
    };
  });

  return Object.values(rowsById);
};

const serializeCourse = (id, data = {}) => {
  const subjects = Array.isArray(data.subjects) ? data.subjects : [];
  return {
    id,
    title: trimText(data.title || data.subjectName || data.courseName),
    description: data.description || "",
    shortDescription: data.shortDescription || "",
    category: trimText(data.category || data.subjectName),
    level: data.level || "beginner",
    status: lowerText(data.status || "draft") || "draft",
    thumbnail: data.thumbnail || null,
    price: toPositiveNumber(data.price, 0),
    discountPercent: toPositiveNumber(data.discountPercent, 0),
    subjects,
    enrollmentCount: toPositiveNumber(data.enrollmentCount, 0),
    completionCount: toPositiveNumber(data.completionCount, 0),
    rating: toPositiveNumber(data.rating, 0),
    ratingCount: toPositiveNumber(data.ratingCount, 0),
    hasCertificate: data.hasCertificate !== false,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    teacherId: data.teacherId || "",
    teacherName: data.teacherName || "",
  };
};

const serializeChapter = (id, data = {}) => ({
  id,
  courseId: data.courseId || "",
  subjectId: data.subjectId || "",
  title: data.title || "",
  order: toPositiveNumber(data.order, 1),
  lecturesCount: Math.max(0, toPositiveNumber(data.lecturesCount, 0)),
  createdAt: toIso(data.createdAt),
  updatedAt: toIso(data.updatedAt),
});

const serializeLecture = (id, data = {}) => {
  const durationSec = Math.max(
    parseLectureDurationToSeconds(
      data.durationSec ?? data.videoDurationSec ?? data.videoDuration ?? data.duration
    ),
    0
  );
  const videoDuration = (() => {
    if (!durationSec) return null;
    const h = Math.floor(durationSec / 3600);
    const m = Math.floor((durationSec % 3600) / 60);
    const s = durationSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  })();

  return {
    id,
    chapterId: data.chapterId || "",
    courseId: data.courseId || "",
    subjectId: data.subjectId || "",
    title: data.title || "",
    order: toPositiveNumber(data.order, 1),
    videoUrl: data.videoUrl || null,
    hlsUrl: data.hlsUrl || null,
    videoTitle: data.videoTitle || null,
    videoId: data.videoId || null,
    videoMode: trimText(data.videoMode) || "recorded",
    isLiveSession: Boolean(data.isLiveSession),
    // Do not rely on stored string duration. Single source of truth is durationSec.
    videoDuration,
    durationSec,
    premiereEndedAt: toIso(data.premiereEndedAt),
    pdfNotes: Array.isArray(data.pdfNotes) ? data.pdfNotes : [],
    books: Array.isArray(data.books) ? data.books : [],
    isPublished: Boolean(data.isPublished),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
};

const getTeacherDisplayName = async (uid, email = "") => {
  const [teacherSnap, userSnap] = await Promise.all([
    db.collection(COLLECTIONS.TEACHERS).doc(uid).get(),
    db.collection(COLLECTIONS.USERS).doc(uid).get(),
  ]);

  if (teacherSnap.exists) {
    const data = teacherSnap.data() || {};
    if (trimText(data.fullName)) return trimText(data.fullName);
    if (trimText(data.name)) return trimText(data.name);
  }

  if (userSnap.exists) {
    const data = userSnap.data() || {};
    if (trimText(data.fullName)) return trimText(data.fullName);
    if (trimText(data.name)) return trimText(data.name);
    if (trimText(data.displayName)) return trimText(data.displayName);
    if (trimText(data.email)) return getNameFromEmail(data.email);
  }

  return getNameFromEmail(email);
};

const isCourseOwner = (courseData = {}, uid = "") => {
  if (!uid) return false;
  if (String(courseData.teacherId || "") === uid) return true;
  const teacherIds = Array.isArray(courseData.teacherIds) ? courseData.teacherIds : [];
  if (teacherIds.some((id) => trimText(id) === uid)) return true;
  const teachers = Array.isArray(courseData.teachers) ? courseData.teachers : [];
  if (teachers.some((row) => trimText(row?.teacherId || row?.id || row?.uid) === uid)) return true;
  const subjects = Array.isArray(courseData.subjects) ? courseData.subjects : [];
  return subjects.some((subject) => subjectHasTeacher(subject, uid));
};

const getCourseIfOwned = async (courseId, uid) => {
  const courseRef = db.collection(COLLECTIONS.COURSES).doc(courseId);
  const subjectRef = db.collection(COLLECTIONS.SUBJECTS).doc(courseId);
  const [courseSnap, subjectSnap] = await Promise.all([
    courseRef.get(),
    subjectRef.get(),
  ]);
  if (!courseSnap.exists && !subjectSnap.exists) {
    return { error: "Subject/Course not found", status: 404 };
  }

  const resolvedRef = courseSnap.exists ? courseRef : subjectRef;
  const resolvedSnap = courseSnap.exists ? courseSnap : subjectSnap;
  const courseData = courseSnap.exists
    ? { ...(courseSnap.data() || {}), __docId: courseId, __source: "courses" }
    : buildCourseLikeDataFromSubject(courseId, subjectSnap.data() || {});
  if (!isCourseOwner(courseData, uid)) {
    return { error: "Forbidden", status: 403 };
  }

  return {
    courseRef: resolvedRef,
    courseSnap: resolvedSnap,
    courseData,
  };
};

const getChapterWithOwnedCourse = async (chapterId, uid) => {
  const chapterRef = db.collection(COLLECTIONS.CHAPTERS).doc(chapterId);
  const chapterSnap = await chapterRef.get();
  if (!chapterSnap.exists) {
    return { error: "Chapter not found", status: 404 };
  }

  const chapterData = chapterSnap.data() || {};
  const courseId = String(chapterData.courseId || "");
  if (!courseId) {
    return { error: "Chapter has no course association", status: 400 };
  }

  const owned = await getCourseIfOwned(courseId, uid);
  if (owned.error) return owned;

  return {
    ...owned,
    chapterRef,
    chapterSnap,
    chapterData,
  };
};

const getLectureWithOwnedCourse = async (lectureId, uid) => {
  const lectureRef = db.collection(COLLECTIONS.LECTURES).doc(lectureId);
  const lectureSnap = await lectureRef.get();
  if (!lectureSnap.exists) {
    return { error: "Lecture not found", status: 404 };
  }

  const lectureData = lectureSnap.data() || {};
  let courseId = String(lectureData.courseId || "");

  if (!courseId) {
    const chapterId = String(lectureData.chapterId || "");
    if (!chapterId) {
      return { error: "Lecture has no chapter association", status: 400 };
    }
    const chapterSnap = await db.collection(COLLECTIONS.CHAPTERS).doc(chapterId).get();
    if (!chapterSnap.exists) {
      return { error: "Lecture chapter not found", status: 404 };
    }
    courseId = String(chapterSnap.data()?.courseId || "");
    if (!courseId) {
      return { error: "Lecture course not found", status: 400 };
    }
  }

  const owned = await getCourseIfOwned(courseId, uid);
  if (owned.error) return owned;

  return {
    ...owned,
    lectureRef,
    lectureSnap,
    lectureData: { ...lectureData, courseId },
  };
};

const getOrderedDocs = async (collectionName, field, value) => {
  try {
    return await db
      .collection(collectionName)
      .where(field, "==", value)
      .orderBy("order", "asc")
      .get();
  } catch {
    const snap = await db.collection(collectionName).where(field, "==", value).get();
    const sorted = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .sort((a, b) => toPositiveNumber(a.order, 0) - toPositiveNumber(b.order, 0));
    return {
      docs: sorted.map((row) => ({
        id: row.id,
        data: () => row,
      })),
      size: sorted.length,
    };
  }
};

const resolveSubjectTeacherName = async (teacherId, fallbackName = "") => {
  const cleanId = trimText(teacherId);
  if (!cleanId) return trimText(fallbackName);

  const teacherSnap = await db.collection(COLLECTIONS.TEACHERS).doc(cleanId).get();
  if (teacherSnap.exists) {
    const data = teacherSnap.data() || {};
    return trimText(data.fullName || data.name || fallbackName);
  }

  return trimText(fallbackName);
};

const normalizeSubjectAssignment = (subject = {}, index = 0) => ({
  subjectId: trimText(subject?.id || subject?.subjectId) || `subject-${index + 1}`,
  subjectName: trimText(subject?.name || subject?.subjectName),
  teacherId: trimText(subject?.teacherId),
  teacherName: trimText(subject?.teacherName),
  teacherIds: Array.isArray(subject?.teacherIds) ? subject.teacherIds : [],
  teachers: Array.isArray(subject?.teachers) ? subject.teachers : [],
  order: toPositiveNumber(subject?.order, index + 1),
});

const getAllCourseSubjects = (courseData = {}) => {
  const subjects = Array.isArray(courseData.subjects) ? courseData.subjects : [];
  const normalized = subjects
    .map((subject, index) => normalizeSubjectAssignment(subject, index))
    .filter((subject) => Boolean(subject.subjectId))
    .sort((a, b) => toPositiveNumber(a.order, 0) - toPositiveNumber(b.order, 0));
  if (normalized.length > 0) return normalized;

  const fallbackId = trimText(courseData.__docId || courseData.id || courseData.subjectId);
  const fallbackName =
    trimText(courseData.subjectName || courseData.title || courseData.courseName) ||
    "Subject";
  if (!fallbackId) return [];
  return [
    {
      subjectId: fallbackId,
      subjectName: fallbackName,
      teacherId: trimText(courseData.teacherId),
      teacherName: trimText(courseData.teacherName) || "Teacher",
      teacherIds: Array.isArray(courseData.teacherIds) ? courseData.teacherIds : [],
      teachers: Array.isArray(courseData.teachers) ? courseData.teachers : [],
      order: 1,
    },
  ];
};

const getTeacherAssignedSubjects = (courseData = {}, uid = "") => {
  return getAllCourseSubjects(courseData)
    .filter((subject) => subjectHasTeacher(subject, uid))
    .sort((a, b) => toPositiveNumber(a.order, 0) - toPositiveNumber(b.order, 0));
};

const getCourseWithAssignedSubjects = async (
  courseId,
  uid,
  forbiddenMessage = "You are not assigned to this course",
  role = ""
) => {
  const courseRef = db.collection(COLLECTIONS.COURSES).doc(courseId);
  const subjectRef = db.collection(COLLECTIONS.SUBJECTS).doc(courseId);
  const [courseSnap, subjectSnap] = await Promise.all([
    courseRef.get(),
    subjectRef.get(),
  ]);
  if (!courseSnap.exists && !subjectSnap.exists) {
    return { error: "Subject/Course not found", status: 404 };
  }

  const resolvedRef = courseSnap.exists ? courseRef : subjectRef;
  const resolvedSnap = courseSnap.exists ? courseSnap : subjectSnap;
  const courseData = courseSnap.exists
    ? { ...(courseSnap.data() || {}), __docId: courseId, __source: "courses" }
    : buildCourseLikeDataFromSubject(courseId, subjectSnap.data() || {});
  const normalizedRole = lowerText(role);
  if (normalizedRole === "admin") {
    return {
      courseRef: resolvedRef,
      courseSnap: resolvedSnap,
      courseData,
      mySubjects: getAllCourseSubjects(courseData),
    };
  }

  const cleanCourseId = trimText(courseId);
  const assignedSubjects = getTeacherAssignedSubjects(courseData, uid);
  const isLegacyOwner = trimText(courseData.teacherId) === uid;
  let mySubjects =
    assignedSubjects.length > 0
      ? assignedSubjects
      : isLegacyOwner
        ? getAllCourseSubjects(courseData)
        : [];
  if (!mySubjects.length) {
    const teacherClassDocs = await getTeacherAssignedClassDocs(uid);
    const classDerivedCourseIds = new Set(
      getTeacherClassDerivedCourseIds(teacherClassDocs, uid)
    );
    if (classDerivedCourseIds.has(cleanCourseId)) {
      mySubjects = getAllCourseSubjects(courseData);
    }
  }
  if (!mySubjects.length) return { error: forbiddenMessage, status: 403 };

  return { courseRef: resolvedRef, courseSnap: resolvedSnap, courseData, mySubjects };
};

const getOrderedDocsWhere = async (collectionName, filters = []) => {
  let query = db.collection(collectionName);
  filters.forEach(([field, op, value]) => {
    query = query.where(field, op, value);
  });

  try {
    return await query.orderBy("order", "asc").get();
  } catch {
    const snap = await query.get();
    const sorted = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .sort((a, b) => toPositiveNumber(a.order, 0) - toPositiveNumber(b.order, 0));
    return {
      docs: sorted.map((row) => ({
        id: row.id,
        data: () => row,
      })),
      size: sorted.length,
    };
  }
};

const getChapterWithAssignedSubject = async (chapterId, uid, role = "") => {
  const chapterRef = db.collection(COLLECTIONS.CHAPTERS).doc(chapterId);
  const chapterSnap = await chapterRef.get();
  if (!chapterSnap.exists) return { error: "Chapter not found", status: 404 };

  const chapterData = chapterSnap.data() || {};
  const courseId = trimText(chapterData.courseId);
  const subjectId = trimText(chapterData.subjectId);
  if (!courseId || !subjectId) {
    return { error: "Chapter subject mapping is missing", status: 400 };
  }

  const linkedCourse = await getCourseWithAssignedSubjects(
    courseId,
    uid,
    "You are not assigned to this course",
    role
  );
  if (linkedCourse.error) return linkedCourse;

  if (lowerText(role) === "admin") {
    return { ...linkedCourse, chapterRef, chapterSnap, chapterData };
  }

  const ownsSubject = linkedCourse.mySubjects.some(
    (subject) => subject.subjectId === subjectId
  );
  if (!ownsSubject) return { error: "Forbidden", status: 403 };

  return { ...linkedCourse, chapterRef, chapterSnap, chapterData };
};

const getLectureWithAssignedSubject = async (lectureId, uid, role = "") => {
  const lectureRef = db.collection(COLLECTIONS.LECTURES).doc(lectureId);
  const lectureSnap = await lectureRef.get();
  if (!lectureSnap.exists) return { error: "Lecture not found", status: 404 };

  const lectureData = lectureSnap.data() || {};
  const chapterId = trimText(lectureData.chapterId);
  if (!chapterId) return { error: "Lecture chapter association is missing", status: 400 };

  const chapterRef = db.collection(COLLECTIONS.CHAPTERS).doc(chapterId);
  const chapterSnap = await chapterRef.get();
  if (!chapterSnap.exists) return { error: "Chapter not found", status: 404 };

  const chapterData = chapterSnap.data() || {};
  const courseId = trimText(lectureData.courseId || chapterData.courseId);
  const subjectId = trimText(lectureData.subjectId || chapterData.subjectId);
  if (!courseId || !subjectId) {
    return { error: "Lecture subject mapping is missing", status: 400 };
  }

  const linkedCourse = await getCourseWithAssignedSubjects(
    courseId,
    uid,
    "You are not assigned to this course",
    role
  );
  if (linkedCourse.error) return linkedCourse;

  if (lowerText(role) === "admin") {
    return {
      ...linkedCourse,
      chapterRef,
      chapterSnap,
      chapterData,
      lectureRef,
      lectureSnap,
      lectureData,
    };
  }

  const ownsSubject = linkedCourse.mySubjects.some(
    (subject) => subject.subjectId === subjectId
  );
  if (!ownsSubject) return { error: "Forbidden", status: 403 };

  return {
    ...linkedCourse,
    lectureRef,
    lectureSnap,
    lectureData: { ...lectureData, courseId, subjectId, chapterId },
    chapterRef,
    chapterSnap,
    chapterData: { ...chapterData, courseId, subjectId },
  };
};

const resolveVideoLibraryUrl = (row = {}) =>
  trimText(
    row?.url ||
      row?.videoUrl ||
      row?.downloadUrl ||
      row?.fileUrl ||
      row?.storageUrl
  );

const normalizeVideoLibraryRow = (id, data = {}) => ({
  id,
  title: trimText(data.title) || "Untitled Video",
  url: resolveVideoLibraryUrl(data),
  courseId: trimText(data.courseId),
  subjectId: trimText(data.subjectId) || trimText(data.courseId),
  courseName: trimText(data.courseName) || trimText(data.subjectName),
  subjectName: trimText(data.subjectName) || trimText(data.courseName),
  teacherId: trimText(data.teacherId),
  teacherName: trimText(data.teacherName) || "Teacher",
  videoMode:
    trimText(data.videoMode).toLowerCase() === "live_session"
      ? "live_session"
      : "recorded",
  isLiveSession: Boolean(data.isLiveSession),
  durationSec: Math.max(0, toPositiveNumber(data.durationSec ?? data.videoDurationSec ?? data.totalDurationSec, 0)),
  videoDuration: (() => {
    const seconds = Math.max(0, toPositiveNumber(data.durationSec ?? data.videoDurationSec ?? data.totalDurationSec, 0));
    if (!seconds) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  })(),
  isActive: data.isActive !== false,
  createdAt: toIso(data.createdAt),
  updatedAt: toIso(data.updatedAt),
});

const getVideoLibraryEntry = async (videoId) => {
  const cleanVideoId = trimText(videoId);
  if (!cleanVideoId) return null;
  const snap = await db.collection(VIDEO_LIBRARY_COLLECTION).doc(cleanVideoId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() || {}) };
};

const getCourseStudentIdsForAnnouncement = async (courseId = "") => {
  const cleanCourseId = trimText(courseId);
  if (!cleanCourseId) return [];

  const snap = await db
    .collection(COLLECTIONS.ENROLLMENTS)
    .where("courseId", "==", cleanCourseId)
    .get();

  return [
    ...new Set(
      snap.docs
        .map((doc) => doc.data() || {})
        .filter((row) => ACTIVE_ENROLLMENT_STATUSES.has(lowerText(row.status || "active")))
        .map((row) => trimText(row.studentId))
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
  postedByName = "Teacher",
  postedByRole = "teacher",
}) => {
  const cleanCourseId = trimText(courseId);
  const cleanTitle = trimText(title);
  const cleanMessage = trimText(message);
  if (!cleanCourseId || !cleanTitle || !cleanMessage) return;

  const recipientIds = await getCourseStudentIdsForAnnouncement(cleanCourseId);
  if (recipientIds.length < 1) return;

  await db.collection(COLLECTIONS.ANNOUNCEMENTS).add({
    title: cleanTitle,
    message: cleanMessage,
    targetType: "course",
    targetId: cleanCourseId,
    targetName: trimText(courseName) || "Course",
    audienceRole: "student",
    postedBy: trimText(postedBy),
    postedByName: trimText(postedByName) || "Teacher",
    postedByRole: trimText(postedByRole) || "teacher",
    sendEmail: false,
    isPinned: false,
    studentsReached: recipientIds.length,
    recipientIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

const formatPkDateTimeLabel = (value) => {
  if (!value) return "";
  const parsed = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

const getSubjectVideoCount = async ({
  courseId,
  subjectId = "",
  ignoreLectureId = "",
}) => {
  const cleanCourseId = trimText(courseId);
  if (!cleanCourseId) return 0;
  const cleanSubjectId = trimText(subjectId);
  const snap = await db.collection(COLLECTIONS.LECTURES).where("courseId", "==", cleanCourseId).get();
  const ignored = trimText(ignoreLectureId);
  return snap.docs.filter((doc) => {
    if (ignored && doc.id === ignored) return false;
    const data = doc.data() || {};
    if (cleanSubjectId && trimText(data.subjectId) !== cleanSubjectId) return false;
    return Boolean(trimText(data.videoUrl));
  }).length;
};

const resolveLectureVideoMeta = async ({
  courseId,
  lectureId,
  subjectId = "",
  currentLectureData = {},
  requestedVideoId = "",
  requestedTitle = "",
  requestedUrl = "",
  requestedVideoMode = "",
  requestedIsLiveSession = null,
}) => {
  const cleanVideoId = trimText(requestedVideoId);
  let sourceTitle = trimText(requestedTitle);
  let sourceUrl = trimText(requestedUrl);
  let selectedVideoRow = null;

  if (cleanVideoId) {
    selectedVideoRow = await getVideoLibraryEntry(cleanVideoId);
    if (!selectedVideoRow || selectedVideoRow.isActive === false) {
      return { error: "Video library item not found", status: 404 };
    }
    sourceUrl = resolveVideoLibraryUrl(selectedVideoRow);
    if (!sourceUrl) {
      return { error: "Selected video has no URL", status: 400 };
    }
    sourceTitle = trimText(selectedVideoRow.title) || sourceTitle;
  }

  if (!sourceUrl) {
    return { error: "Video url is required", status: 400 };
  }

  const existingVideoUrl = trimText(currentLectureData.videoUrl);
  const hasExistingVideo = Boolean(existingVideoUrl);
  const existingMode = trimText(currentLectureData.videoMode).toLowerCase();
  const existingLive = Boolean(currentLectureData.isLiveSession);
  let videoMode = existingMode || "recorded";
  let isLiveSession = existingLive;
  const requestedLive = parseNullableBoolean(requestedIsLiveSession);
  const requestedMode = trimText(requestedVideoMode).toLowerCase();
  let preferredLive = null;

  if (requestedLive !== null) {
    preferredLive = requestedLive;
  } else if (requestedMode === "live_session") {
    preferredLive = true;
  } else if (requestedMode === "recorded") {
    preferredLive = false;
  } else if (cleanVideoId) {
    preferredLive =
      trimText(selectedVideoRow?.videoMode).toLowerCase() === "live_session" ||
      Boolean(selectedVideoRow?.isLiveSession);
  }

  if (hasExistingVideo && preferredLive !== null) {
    isLiveSession = preferredLive;
    videoMode = isLiveSession ? "live_session" : "recorded";
  }

  if (!hasExistingVideo) {
    const existingSubjectVideoCount = await getSubjectVideoCount({
      courseId,
      subjectId,
      ignoreLectureId: lectureId,
    });
    const isFirstSubjectVideo = existingSubjectVideoCount < 1;

    if (isFirstSubjectVideo) {
      videoMode = "live_session";
      isLiveSession = true;
    } else {
      isLiveSession = preferredLive === true;
      videoMode = isLiveSession ? "live_session" : "recorded";
    }
  }

  const durationSecFromLibrary = Math.max(
    0,
    toPositiveNumber(
      selectedVideoRow?.durationSec ??
        selectedVideoRow?.videoDurationSec ??
        selectedVideoRow?.totalDurationSec,
      0
    ),
    // Backward compatibility: older library docs stored a string label (mm:ss / hh:mm:ss)
    // instead of numeric seconds.
    parseLectureDurationToSeconds(selectedVideoRow?.videoDuration)
  );

  // Optional HLS playlist for smoother playback on web (especially large files).
  // If present, student live page will prefer `hlsUrl`.
  const resolvedHlsUrl = (() => {
    const hls = trimText(selectedVideoRow?.hlsUrl);
    if (hls) return hls;
    // Back-compat: some library items stored .m3u8 directly in url/streamUrl.
    if (typeof sourceUrl === "string" && /\.m3u8(\?|#|$)/i.test(sourceUrl)) return sourceUrl;
    if (typeof selectedVideoRow?.streamUrl === "string" && /\.m3u8(\?|#|$)/i.test(selectedVideoRow.streamUrl)) {
      return trimText(selectedVideoRow.streamUrl);
    }
    return "";
  })();

  return {
    videoId: cleanVideoId || null,
    videoTitle: sourceTitle || null,
    videoUrl: sourceUrl,
    hlsUrl: resolvedHlsUrl || null,
    videoMode,
    isLiveSession,
    durationSec: durationSecFromLibrary,
    isFirstLiveSession: Boolean(!hasExistingVideo && isLiveSession),
  };
};

export const getTeacherCourses = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = lowerText(req.user?.role);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);

    if (role === "admin") {
      const [courseRows, classesSnap] = await Promise.all([
        getUnifiedCourseRows(),
        db.collection(COLLECTIONS.CLASSES).get(),
      ]);

      const classesByCourseId = {};
      classesSnap.docs.forEach((doc) => {
        const classData = doc.data() || {};
        const classInfo = {
          id: doc.id,
          name: trimText(classData.name) || "Class",
          batchCode: trimText(classData.batchCode),
        };
        const classCourseIds = getClassAssignedCourseIds(classData);
        classCourseIds.forEach((courseId) => {
          const cleanCourseId = trimText(courseId);
          if (!cleanCourseId) return;
          if (!Array.isArray(classesByCourseId[cleanCourseId])) {
            classesByCourseId[cleanCourseId] = [];
          }
          if (!classesByCourseId[cleanCourseId].some((row) => row.id === classInfo.id)) {
            classesByCourseId[cleanCourseId].push(classInfo);
          }
        });
      });

      const mappedCourses = courseRows
        .map((row) => {
          const course = serializeCourse(row.id, row.data);
          const mySubjects = getAllCourseSubjects(row.data);
          const firstSubjectName = trimText(mySubjects[0]?.subjectName);
          return {
            id: course.id,
            title: trimText(course.title) || firstSubjectName || "Untitled Subject",
            category: trimText(course.category) || firstSubjectName || "General",
            level: course.level,
            status: course.status,
            thumbnail: course.thumbnail,
            price: course.price,
            mySubjects,
            enrollmentCount: course.enrollmentCount,
            classes: classesByCourseId[course.id] || [],
            createdAt: course.createdAt,
          };
        })
        .filter((course) => course.mySubjects.length > 0);

      const liveEnrollmentCountByCourse = await getLiveEnrollmentCountByCourse(
        mappedCourses.map((course) => course.id)
      );

      const courses = mappedCourses
        .map((course) => ({
          ...course,
          enrollmentCount: Math.max(
            toPositiveNumber(course.enrollmentCount, 0),
            toPositiveNumber(liveEnrollmentCountByCourse[course.id], 0)
          ),
        }))
        .sort(
          (a, b) =>
            (new Date(b.createdAt || 0).getTime() || 0) -
            (new Date(a.createdAt || 0).getTime() || 0)
        );

      return successResponse(res, courses, "Courses fetched");
    }

    const [classDocs, courseRows] = await Promise.all([
      getTeacherAssignedClassDocs(uid),
      getUnifiedCourseRows(),
    ]);
    const teacherOwnedCourseIds = courseRows
      .filter((row) => {
        const assignedSubjects = getTeacherAssignedSubjects(row.data, uid);
        const isLegacyOwner = trimText(row.data?.teacherId) === trimText(uid);
        return assignedSubjects.length > 0 || isLegacyOwner;
      })
      .map((row) => row.id);
    const classDerivedCourseIds = new Set(
      getTeacherClassDerivedCourseIds(classDocs, uid, teacherOwnedCourseIds)
    );
    const classesByCourseId = getTeacherClassesByCourseId(
      classDocs,
      uid,
      teacherOwnedCourseIds
    );

    const mappedCourses = courseRows
      .map((row) => {
        const course = serializeCourse(row.id, row.data);
        const assignedSubjects = getTeacherAssignedSubjects(row.data, uid);
        const isLegacyOwner = trimText(row.data?.teacherId) === trimText(uid);
        const isClassLinked = classDerivedCourseIds.has(course.id);
        const mySubjects =
          assignedSubjects.length > 0
            ? assignedSubjects
            : isLegacyOwner || isClassLinked
              ? getAllCourseSubjects(row.data)
              : [];
        const firstSubjectName = trimText(mySubjects[0]?.subjectName);
        return {
          id: course.id,
          title: trimText(course.title) || firstSubjectName || "Untitled Subject",
          category: trimText(course.category) || firstSubjectName || "General",
          level: course.level,
          status: course.status,
          thumbnail: course.thumbnail,
          price: course.price,
          mySubjects,
          enrollmentCount: course.enrollmentCount,
          classes: classesByCourseId[course.id] || [],
          createdAt: course.createdAt,
        };
      })
      .filter((course) => course.mySubjects.length > 0);

    const liveEnrollmentCountByCourse = await getLiveEnrollmentCountByCourse(
      mappedCourses.map((course) => course.id)
    );

    const courses = mappedCourses
      .map((course) => ({
        ...course,
        enrollmentCount: Math.max(
          toPositiveNumber(course.enrollmentCount, 0),
          toPositiveNumber(liveEnrollmentCountByCourse[course.id], 0)
        ),
      }))
      .filter((course) => course.mySubjects.length > 0)
      .sort(
        (a, b) =>
          (new Date(b.createdAt || 0).getTime() || 0) -
          (new Date(a.createdAt || 0).getTime() || 0)
      );

    return successResponse(res, courses, "Teacher assigned courses fetched");
  } catch (error) {
    console.error("getTeacherCourses error:", error);
    return errorResponse(res, "Failed to fetch teacher courses", 500);
  }
};

export const getTeacherVideoLibrary = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = lowerText(req.user?.role);
    if (!uid) return errorResponse(res, "Missing user uid", 400);

    let videos = [];
    try {
      const snap = await db
        .collection(VIDEO_LIBRARY_COLLECTION)
        .orderBy("createdAt", "desc")
        .get();
      videos = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    } catch {
      const fallback = await db.collection(VIDEO_LIBRARY_COLLECTION).get();
      videos = fallback.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
      videos.sort(
        (a, b) =>
          (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)
      );
    }

    let allowedCourseIds = new Set();
    if (role === "teacher") {
      const assignedCourses = await getTeacherAssignedCourses(uid);
      allowedCourseIds = new Set(
        (assignedCourses.courseIds || []).map((id) => trimText(id)).filter(Boolean)
      );
    }

    const payload = videos
      .map((row) => normalizeVideoLibraryRow(row.id, row))
      .filter((row) => row.isActive)
      .filter((row) => {
        if (role === "admin") return true;
        return row.teacherId === uid || allowedCourseIds.has(row.courseId);
      });

    return successResponse(res, payload, "Video library fetched");
  } catch (error) {
    console.error("getTeacherVideoLibrary error:", error);
    return errorResponse(res, "Failed to fetch video library", 500);
  }
};

export const createTeacherVideoLibraryItem = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = lowerText(req.user?.role || "teacher");
    if (!uid) return errorResponse(res, "Missing user uid", 400);

    const {
      title = "",
      url = "",
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

    const cleanTitle = trimText(title);
    const cleanUrl = trimText(url);
    const cleanCourseId = trimText(courseId || subjectId);
    if (cleanTitle.length < 3) {
      return errorResponse(res, "title must be at least 3 characters", 400);
    }
    if (!cleanUrl) return errorResponse(res, "url is required", 400);
    if (!cleanCourseId) return errorResponse(res, "courseId is required", 400);

    const [subjectSnap, courseSnap] = await Promise.all([
      db.collection(COLLECTIONS.SUBJECTS).doc(cleanCourseId).get(),
      db.collection(COLLECTIONS.COURSES).doc(cleanCourseId).get(),
    ]);
    if (!subjectSnap.exists && !courseSnap.exists) {
      return errorResponse(res, "Subject/Course not found", 404);
    }
    const courseData = subjectSnap.exists
      ? subjectSnap.data() || {}
      : courseSnap.data() || {};

    if (role === "teacher" && !isCourseOwner(courseData, uid)) {
      return errorResponse(res, "You are not assigned to this course", 403);
    }

    const resolvedTeacherId = role === "teacher" ? uid : trimText(teacherId);
    const resolvedTeacherName =
      role === "teacher"
        ? await getTeacherDisplayName(uid, req.user?.email || "")
        : trimText(teacherName) || trimText(courseData.teacherName) || "Teacher";
    const liveFlag =
      parseNullableBoolean(isLiveSession) === true ||
      trimText(videoMode).toLowerCase() === "live_session";

    const payload = {
      title: cleanTitle,
      url: cleanUrl,
      courseId: cleanCourseId,
      subjectId: cleanCourseId,
      courseName: trimText(courseName) || trimText(courseData.title) || "Subject",
      subjectName: trimText(courseName) || trimText(courseData.title) || "Subject",
      teacherId: resolvedTeacherId,
      teacherName: resolvedTeacherName,
      videoMode: liveFlag ? "live_session" : "recorded",
      isLiveSession: liveFlag,
      durationSec: Math.max(
        0,
        toPositiveNumber(durationSec ?? 0, 0)
      ),
      isActive: isActive !== false,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const ref = db.collection(VIDEO_LIBRARY_COLLECTION).doc();
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
  } catch (error) {
    console.error("createTeacherVideoLibraryItem error:", error);
    return errorResponse(res, "Failed to add video to library", 500);
  }
};

export const getTeacherCourseById = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = lowerText(req.user?.role);
    const courseId = trimText(req.params?.courseId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!courseId) return errorResponse(res, "courseId is required", 400);

    const linkedCourse = await getCourseWithAssignedSubjects(
      courseId,
      uid,
      "You are not assigned to this course",
      role
    );
    if (linkedCourse.error) {
      return errorResponse(res, linkedCourse.error, linkedCourse.status);
    }

    const mySubjects = await Promise.all(
      linkedCourse.mySubjects.map(async (subject) => {
        const chaptersSnap = await getOrderedDocsWhere(COLLECTIONS.CHAPTERS, [
          ["courseId", "==", courseId],
          ["subjectId", "==", subject.subjectId],
        ]);

        const chapters = await Promise.all(
          chaptersSnap.docs.map(async (doc) => {
            const chapter = serializeChapter(doc.id, doc.data());
            const lecturesSnap = await getOrderedDocsWhere(COLLECTIONS.LECTURES, [
              ["chapterId", "==", chapter.id],
            ]);

            const lectures = lecturesSnap.docs
              .map((lectureDoc) => serializeLecture(lectureDoc.id, lectureDoc.data()))
              .sort((a, b) => toPositiveNumber(a.order, 0) - toPositiveNumber(b.order, 0))
              .map((lecture) => ({
                lectureId: lecture.id,
                title: lecture.title,
                order: lecture.order,
                videoUrl: lecture.videoUrl,
                videoTitle: lecture.videoTitle,
                videoDuration: lecture.videoDuration,
                pdfNotes: lecture.pdfNotes,
                books: lecture.books,
              }));

            return {
              chapterId: chapter.id,
              title: chapter.title,
              order: chapter.order,
              lectures,
            };
          })
        );

        chapters.sort((a, b) => toPositiveNumber(a.order, 0) - toPositiveNumber(b.order, 0));

        return {
          subjectId: subject.subjectId,
          subjectName: subject.subjectName,
          chapters,
        };
      })
    );

    const course = serializeCourse(courseId, linkedCourse.courseData);
    return successResponse(
      res,
      {
        courseId,
        courseTitle: course.title,
        courseStatus: course.status,
        mySubjects,
      },
      "Teacher course content fetched"
    );
  } catch (error) {
    console.error("getTeacherCourseById error:", error);
    return errorResponse(res, "Failed to fetch teacher course", 500);
  }
};

export const getChapters = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = lowerText(req.user?.role);
    const courseId = trimText(req.params?.courseId);
    const subjectId = trimText(req.params?.subjectId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!courseId || !subjectId) {
      return errorResponse(res, "courseId and subjectId are required", 400);
    }

    if (role !== "admin") {
      const linkedCourse = await getCourseWithAssignedSubjects(courseId, uid);
      if (linkedCourse.error) {
        return errorResponse(res, linkedCourse.error, linkedCourse.status);
      }
      const ownsSubject = linkedCourse.mySubjects.some(
        (subject) => subject.subjectId === subjectId
      );
      if (!ownsSubject) return errorResponse(res, "Forbidden", 403);
    }

    const chaptersSnap = await getOrderedDocsWhere(COLLECTIONS.CHAPTERS, [
      ["courseId", "==", courseId],
      ["subjectId", "==", subjectId],
    ]);
    const chapters = chaptersSnap.docs.map((doc) =>
      serializeChapter(doc.id, doc.data())
    );

    return successResponse(res, chapters, "Chapters fetched");
  } catch (error) {
    console.error("getChapters error:", error);
    return errorResponse(res, "Failed to fetch chapters", 500);
  }
};

export const addChapterToCourse = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = lowerText(req.user?.role);
    const courseId = trimText(req.params?.courseId);
    const subjectId = trimText(req.params?.subjectId || req.body?.subjectId);
    const { title, order } = req.body || {};
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!courseId || !subjectId) {
      return errorResponse(res, "courseId and subjectId are required", 400);
    }
    if (trimText(title).length < 3) {
      return errorResponse(res, "Chapter title must be at least 3 characters", 400);
    }

    const linkedCourse = await getCourseWithAssignedSubjects(
      courseId,
      uid,
      "You are not assigned to this course",
      role
    );
    if (linkedCourse.error) {
      return errorResponse(res, linkedCourse.error, linkedCourse.status);
    }
    const ownsSubject = linkedCourse.mySubjects.some(
      (subject) => subject.subjectId === subjectId
    );
    if (!ownsSubject) return errorResponse(res, "Forbidden", 403);

    const editableState = await ensureSubjectEditableForContent(courseId);
    if (!editableState.editable) {
      return errorResponse(res, editableState.error, editableState.status || 400, {
        ...(editableState.code ? { code: editableState.code } : {}),
      });
    }

    const existingSnap = await db
      .collection(COLLECTIONS.CHAPTERS)
      .where("courseId", "==", courseId)
      .where("subjectId", "==", subjectId)
      .get();

    const maxOrder = existingSnap.docs.reduce(
      (max, doc) => Math.max(max, toPositiveNumber(doc.data()?.order, 0)),
      0
    );
    const parsedOrder = Number(order);
    const finalOrder =
      Number.isFinite(parsedOrder) && parsedOrder > 0 ? parsedOrder : maxOrder + 1;

    const chapterData = {
      courseId,
      subjectId,
      title: trimText(title),
      order: finalOrder,
      lecturesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const chapterRef = await db.collection(COLLECTIONS.CHAPTERS).add(chapterData);
    const chapterSnap = await chapterRef.get();

    return successResponse(
      res,
      serializeChapter(chapterRef.id, chapterSnap.data() || {}),
      "Chapter added",
      201
    );
  } catch (error) {
    console.error("addChapterToCourse error:", error);
    return errorResponse(res, "Failed to add chapter", 500);
  }
};

export const updateChapter = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = lowerText(req.user?.role);
    const chapterId = trimText(req.params?.chapterId);
    const { title, order } = req.body || {};
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!chapterId) return errorResponse(res, "chapterId is required", 400);

    const linked = await getChapterWithAssignedSubject(chapterId, uid, role);
    if (linked.error) return errorResponse(res, linked.error, linked.status);

    const updates = {};
    if (title !== undefined) {
      if (trimText(title).length < 3) {
        return errorResponse(res, "Chapter title must be at least 3 characters", 400);
      }
      updates.title = trimText(title);
    }
    if (order !== undefined) {
      const parsedOrder = Number(order);
      if (!Number.isFinite(parsedOrder) || parsedOrder <= 0) {
        return errorResponse(res, "Chapter order must be a positive number", 400);
      }
      updates.order = parsedOrder;
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse(res, "No valid fields to update", 400);
    }

    updates.updatedAt = serverTimestamp();

    await linked.chapterRef.update(updates);

    const updatedSnap = await linked.chapterRef.get();
    return successResponse(
      res,
      serializeChapter(chapterId, updatedSnap.data() || {}),
      "Chapter updated"
    );
  } catch (error) {
    console.error("updateChapter error:", error);
    return errorResponse(res, "Failed to update chapter", 500);
  }
};

export const deleteChapter = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = lowerText(req.user?.role);
    const chapterId = trimText(req.params?.chapterId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!chapterId) return errorResponse(res, "chapterId is required", 400);

    const linked = await getChapterWithAssignedSubject(chapterId, uid, role);
    if (linked.error) return errorResponse(res, linked.error, linked.status);

    const lecturesSnap = await db
      .collection(COLLECTIONS.LECTURES)
      .where("chapterId", "==", chapterId)
      .get();

    const batch = db.batch();
    lecturesSnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(linked.chapterRef);
    await batch.commit();

    return successResponse(res, { chapterId }, "Chapter deleted");
  } catch (error) {
    console.error("deleteChapter error:", error);
    return errorResponse(res, "Failed to delete chapter", 500);
  }
};

export const getLectures = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = lowerText(req.user?.role);
    const chapterId = trimText(req.params?.chapterId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!chapterId) return errorResponse(res, "chapterId is required", 400);

    const linked = await getChapterWithAssignedSubject(chapterId, uid, role);
    if (linked.error) return errorResponse(res, linked.error, linked.status);

    const lecturesSnap = await getOrderedDocsWhere(COLLECTIONS.LECTURES, [
      ["chapterId", "==", chapterId],
    ]);
    const lectures = lecturesSnap.docs
      .map((doc) => serializeLecture(doc.id, doc.data()))
      .sort((a, b) => toPositiveNumber(a.order, 0) - toPositiveNumber(b.order, 0));

    return successResponse(res, lectures, "Lectures fetched");
  } catch (error) {
    console.error("getLectures error:", error);
    return errorResponse(res, "Failed to fetch lectures", 500);
  }
};

export const addLecture = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = lowerText(req.user?.role);
    const chapterId = trimText(req.params?.chapterId);
    const { title, order } = req.body || {};

    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!chapterId) return errorResponse(res, "chapterId is required", 400);
    if (trimText(title).length < 3) {
      return errorResponse(res, "Lecture title must be at least 3 characters", 400);
    }

    const linked = await getChapterWithAssignedSubject(chapterId, uid, role);
    if (linked.error) return errorResponse(res, linked.error, linked.status);

    const editableState = await ensureSubjectEditableForContent(
      trimText(linked.chapterData.courseId)
    );
    if (!editableState.editable) {
      return errorResponse(res, editableState.error, editableState.status || 400, {
        ...(editableState.code ? { code: editableState.code } : {}),
      });
    }

    const existingSnap = await db
      .collection(COLLECTIONS.LECTURES)
      .where("chapterId", "==", chapterId)
      .get();
    const maxOrder = existingSnap.docs.reduce(
      (max, doc) => Math.max(max, toPositiveNumber(doc.data()?.order, 0)),
      0
    );
    const parsedOrder = Number(order);
    const finalOrder =
      Number.isFinite(parsedOrder) && parsedOrder > 0 ? parsedOrder : maxOrder + 1;

    const lectureData = {
      chapterId,
      courseId: trimText(linked.chapterData.courseId),
      subjectId: trimText(linked.chapterData.subjectId),
      title: trimText(title),
      order: finalOrder,
      videoUrl: null,
      videoTitle: null,
      durationSec: 0,
      premiereEndedAt: null,
      pdfNotes: [],
      books: [],
      isPublished: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const lectureRef = await db.collection(COLLECTIONS.LECTURES).add(lectureData);

    await Promise.all([
      linked.chapterRef.update({
        lecturesCount: admin.firestore.FieldValue.increment(1),
        updatedAt: serverTimestamp(),
      }),
    ]);

    const lectureSnap = await lectureRef.get();
    return successResponse(
      res,
      serializeLecture(lectureRef.id, lectureSnap.data() || {}),
      "Lecture added",
      201
    );
  } catch (error) {
    console.error("addLecture error:", error);
    return errorResponse(res, "Failed to add lecture", 500);
  }
};

export const updateLecture = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = lowerText(req.user?.role);
    const lectureId = trimText(req.params?.lectureId);
    const title = trimText(req.body?.title);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!lectureId) return errorResponse(res, "lectureId is required", 400);
    if (title.length < 3) {
      return errorResponse(res, "Lecture title must be at least 3 characters", 400);
    }

    const linked = await getLectureWithAssignedSubject(lectureId, uid, role);
    if (linked.error) return errorResponse(res, linked.error, linked.status);

    await linked.lectureRef.update({
      title,
      updatedAt: serverTimestamp(),
    });

    const updatedSnap = await linked.lectureRef.get();
    return successResponse(
      res,
      serializeLecture(lectureId, updatedSnap.data() || {}),
      "Lecture updated"
    );
  } catch (error) {
    console.error("updateLecture error:", error);
    return errorResponse(res, "Failed to update lecture", 500);
  }
};

export const deleteLecture = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = lowerText(req.user?.role);
    const lectureId = trimText(req.params?.lectureId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!lectureId) return errorResponse(res, "lectureId is required", 400);

    const linked = await getLectureWithAssignedSubject(lectureId, uid, role);
    if (linked.error) return errorResponse(res, linked.error, linked.status);

    const chapterId = trimText(linked.lectureData.chapterId);

    await Promise.all([
      linked.lectureRef.delete(),
      chapterId
        ? db
            .collection(COLLECTIONS.CHAPTERS)
            .doc(chapterId)
            .update({
              lecturesCount: admin.firestore.FieldValue.increment(-1),
              updatedAt: serverTimestamp(),
            })
            .catch(() => null)
        : Promise.resolve(),
    ]);

    return successResponse(res, { lectureId }, "Lecture deleted");
  } catch (error) {
    console.error("deleteLecture error:", error);
    return errorResponse(res, "Failed to delete lecture", 500);
  }
};

export const saveLectureContent = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = lowerText(req.user?.role);
    const lectureId = trimText(req.params?.lectureId);
    const {
      type,
      title,
      url,
      size = 0,
      duration,
      durationSec,
      videoId,
      videoMode,
      isLiveSession,
      liveStartAt,
    } = req.body || {};
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!lectureId) return errorResponse(res, "lectureId is required", 400);

    const linked = await getLectureWithAssignedSubject(lectureId, uid, role);
    if (linked.error) return errorResponse(res, linked.error, linked.status);

    const editableState = await ensureSubjectEditableForContent(
      trimText(linked.lectureData.courseId)
    );
    if (!editableState.editable) {
      return errorResponse(res, editableState.error, editableState.status || 400, {
        ...(editableState.code ? { code: editableState.code } : {}),
      });
    }

    const normalizedType = lowerText(type);
    if (!["video", "pdf", "book"].includes(normalizedType)) {
      return errorResponse(res, "type must be video, pdf or book", 400);
    }

    const currentData = linked.lectureSnap.data() || {};
    const updates = {};
    const hadVideoBefore = Boolean(trimText(currentData.videoUrl));
    let firstLiveSession = false;

    if (normalizedType === "video") {
      if (!trimText(videoId) && !trimText(url)) {
        return errorResponse(
          res,
          "Either videoId or url is required for video content.",
          400
        );
      }
      const resolvedVideo = await resolveLectureVideoMeta({
        courseId: trimText(linked.lectureData.courseId),
        lectureId,
        subjectId: trimText(linked.lectureData.subjectId),
        currentLectureData: currentData,
        requestedVideoId: videoId,
        requestedTitle: title,
        requestedUrl: url,
        requestedVideoMode: videoMode,
        requestedIsLiveSession: isLiveSession,
      });
      if (resolvedVideo.error) {
        return errorResponse(res, resolvedVideo.error, resolvedVideo.status || 400);
      }
      updates.videoId = resolvedVideo.videoId || null;
      updates.videoUrl = resolvedVideo.videoUrl;
      updates.hlsUrl = trimText(resolvedVideo.hlsUrl) || null;
      updates.videoTitle = resolvedVideo.videoTitle;
      updates.videoMode = resolvedVideo.videoMode;
      updates.isLiveSession = resolvedVideo.isLiveSession;
      updates.durationSec = Math.max(
        parseLectureDurationToSeconds(durationSec ?? duration),
        parseLectureDurationToSeconds(currentData.durationSec ?? currentData.videoDurationSec),
        parseLectureDurationToSeconds(currentData.videoDuration),
        Math.max(0, toPositiveNumber(resolvedVideo.durationSec, 0))
      );
      // Single source of truth: durationSec. Remove legacy string duration field if present.
      updates.videoDuration = admin.firestore.FieldValue.delete();
      // If a video is attached, lecture becomes publishable/visible.
      updates.isPublished = true;
      updates.premiereEndedAt = resolvedVideo.isLiveSession ? null : currentData.premiereEndedAt || null;
      firstLiveSession = Boolean(resolvedVideo.isFirstLiveSession);

      // Live session scheduling (only for live videos):
      // UI provides a start datetime, end is auto-calculated from lecture duration.
      // If not provided, student live schedule falls back to class shift occurrence.
      if (resolvedVideo.isLiveSession) {
        const parsedStart = parseDate(liveStartAt);
        if (parsedStart) {
          const durationSec = Math.max(0, toPositiveNumber(updates.durationSec, 0));
          // Store as Pakistan-local datetime string (no Z) so Firestore shows the expected time.
          updates.liveStartAt = formatPkDateTimeLocal(parsedStart);
          // Only auto-calculate end time when we know the true duration.
          // If duration is missing, student live schedule will fall back to class shift.
          if (durationSec > 0) {
            const resolvedEnd = new Date(parsedStart.getTime() + durationSec * 1000);
            updates.liveEndAt = formatPkDateTimeLocal(resolvedEnd);
          } else {
            updates.liveEndAt = null;
          }
        } else if (liveStartAt !== undefined && liveStartAt !== null && trimText(liveStartAt)) {
          return errorResponse(res, "liveStartAt must be a valid ISO date", 400);
        }
      } else {
        // Recorded video should not keep live schedule fields.
        updates.liveStartAt = null;
        updates.liveEndAt = null;
      }
    }

    if (normalizedType === "pdf" || normalizedType === "book") {
      if (trimText(title).length < 3) {
        return errorResponse(res, "Content title must be at least 3 characters", 400);
      }
      if (!trimText(url)) return errorResponse(res, "Content url is required", 400);

      const nextItem = {
        id: uuidv4(),
        title: trimText(title),
        url: trimText(url),
        size: toPositiveNumber(size, 0),
        uploadedAt: new Date().toISOString(),
      };

      if (normalizedType === "pdf") {
        const current = Array.isArray(currentData.pdfNotes) ? currentData.pdfNotes : [];
        updates.pdfNotes = [...current, nextItem];
      } else {
        const current = Array.isArray(currentData.books) ? currentData.books : [];
        updates.books = [...current, nextItem];
      }
    }

    updates.updatedAt = serverTimestamp();

    await linked.lectureRef.update(updates);

    const updatedSnap = await linked.lectureRef.get();
    if (
      normalizedType === "video" &&
      !hadVideoBefore &&
      trimText(updates.videoUrl)
    ) {
      try {
        const isLiveSession =
          Boolean(updates.isLiveSession) || lowerText(updates.videoMode || "") === "live_session";
        const liveStartLabel = isLiveSession
          ? formatPkDateTimeLabel(updates.liveStartAt || linked.lectureData?.liveStartAt)
          : "";
        const liveEndLabel = isLiveSession
          ? formatPkDateTimeLabel(updates.liveEndAt || linked.lectureData?.liveEndAt)
          : "";
        const courseTitle = trimText(linked.courseData.title) || "your course";
        const lectureTitle = trimText(linked.lectureData.title) || "a lecture";
        const videoTitle = trimText(updates.videoTitle) || "Lecture Video";

        await createCourseStudentAnnouncement({
          title: isLiveSession
            ? `Live Session Scheduled: ${videoTitle}`
            : `New Video Added: ${videoTitle}`,
          message: isLiveSession
            ? `${lectureTitle} has a live session scheduled in ${courseTitle}${
                liveStartLabel ? ` (Starts: ${liveStartLabel})` : ""
              }${liveEndLabel ? ` (Ends: ${liveEndLabel})` : ""}.`
            : `${lectureTitle} now has a new video in ${courseTitle}.`,
          courseId: trimText(linked.lectureData.courseId),
          courseName: courseTitle,
          postedBy: uid,
          postedByName: await getTeacherDisplayName(uid, req.user?.email || ""),
          postedByRole: role || "teacher",
        });
      } catch (announcementError) {
        console.error("saveLectureContent announcement error:", announcementError);
      }
    }

    return successResponse(
      res,
      {
        ...serializeLecture(lectureId, updatedSnap.data() || {}),
        isFirstLiveSession: firstLiveSession,
      },
      firstLiveSession
        ? "Lecture content saved. First subject video marked as live session."
        : "Lecture content saved"
    );
  } catch (error) {
    console.error("saveLectureContent error:", error);
    return errorResponse(res, "Failed to save lecture content", 500);
  }
};

export const deleteLectureContent = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = lowerText(req.user?.role);
    const lectureId = trimText(req.params?.lectureId);
    const contentId = trimText(req.params?.contentId);
    const normalizedType = lowerText(req.body?.type);

    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!lectureId) return errorResponse(res, "lectureId is required", 400);
    if (!["video", "pdf", "book"].includes(normalizedType)) {
      return errorResponse(res, "type must be video, pdf or book", 400);
    }

    const linked = await getLectureWithAssignedSubject(lectureId, uid, role);
    if (linked.error) return errorResponse(res, linked.error, linked.status);

    const lectureData = linked.lectureSnap.data() || {};
    const updates = { updatedAt: serverTimestamp() };

    if (normalizedType === "video") {
      updates.videoUrl = null;
      updates.videoTitle = null;
      updates.videoId = null;
      updates.hlsUrl = null;
      updates.videoMode = "recorded";
      updates.isLiveSession = false;
      updates.videoDuration = admin.firestore.FieldValue.delete();
      updates.durationSec = 0;
      updates.premiereEndedAt = null;
      updates.liveStartAt = null;
      updates.liveEndAt = null;
    }

    if (normalizedType === "pdf") {
      const current = Array.isArray(lectureData.pdfNotes) ? lectureData.pdfNotes : [];
      updates.pdfNotes = current.filter((item) => String(item?.id || "") !== contentId);
    }

    if (normalizedType === "book") {
      const current = Array.isArray(lectureData.books) ? lectureData.books : [];
      updates.books = current.filter((item) => String(item?.id || "") !== contentId);
    }

    await linked.lectureRef.update(updates);

    return successResponse(res, { lectureId, contentId }, "Content removed");
  } catch (error) {
    console.error("deleteLectureContent error:", error);
    return errorResponse(res, "Failed to delete lecture content", 500);
  }
};

export const getCourseStudents = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = lowerText(req.user?.role);
    const courseId = trimText(req.params?.courseId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!courseId) return errorResponse(res, "courseId is required", 400);

    const linkedCourse = await getCourseWithAssignedSubjects(
      courseId,
      uid,
      "You are not assigned to this course",
      role
    );
    if (linkedCourse.error) {
      return errorResponse(res, linkedCourse.error, linkedCourse.status);
    }

    const enrollmentsSnap = await db
      .collection(COLLECTIONS.ENROLLMENTS)
      .where("courseId", "==", courseId)
      .get();

    const enrollments = enrollmentsSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() || {}),
    }));
    const classesSnap = await db.collection(COLLECTIONS.CLASSES).get();
    const classDocs = classesSnap.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() || {},
    }));
    const inferredEnrollments = buildClassDerivedEnrollmentRows(classDocs, [courseId]);
    const mergedEnrollments = mergeEnrollmentRowsByStudentCourse(
      enrollments,
      inferredEnrollments
    );
    const classMetaByStudentId = {};
    classDocs.forEach((row) => {
      const classId = trimText(row.id);
      const classData = row.data || {};
      if (!classId) return;
      const assignedCourseIds = getClassAssignedCourseIds(classData);
      const classHasCourse = assignedCourseIds.includes(courseId);
      if (!classHasCourse) return;

      const className = trimText(classData.name) || "Class";
      const batchCode = trimText(classData.batchCode);
      const studentEntries = getClassStudentEntries(classData);

      studentEntries.forEach((entry) => {
        const studentId = trimText(entry.studentId);
        if (!studentId) return;

        const entryCourseIds = resolveClassEntryCourseIds(entry, classData);
        const linkedToCourse = entryCourseIds.length
          ? entryCourseIds.includes(courseId)
          : classHasCourse;
        if (!linkedToCourse) return;

        if (!Array.isArray(classMetaByStudentId[studentId])) {
          classMetaByStudentId[studentId] = [];
        }
        if (classMetaByStudentId[studentId].some((item) => item.classId === classId)) {
          return;
        }
        classMetaByStudentId[studentId].push({
          classId,
          className,
          batchCode,
          rewatchUnlocked: isClassUnlockedForStudent(classData, studentId),
        });
      });
    });

    const studentIds = [
      ...new Set(
        mergedEnrollments
          .map((row) => trimText(row.studentId))
          .filter(Boolean)
      ),
    ];

    const [studentDocs, userDocs, progressDocs] = await Promise.all([
      Promise.all(
        studentIds.map(async (studentId) => {
          const snap = await db.collection(COLLECTIONS.STUDENTS).doc(studentId).get();
          return [studentId, snap.exists ? snap.data() || {} : {}];
        })
      ),
      Promise.all(
        studentIds.map(async (studentId) => {
          const snap = await db.collection(COLLECTIONS.USERS).doc(studentId).get();
          return [studentId, snap.exists ? snap.data() || {} : {}];
        })
      ),
      Promise.all(
        studentIds.map(async (studentId) => {
          const snap = await db
            .collection(COLLECTIONS.PROGRESS)
            .where("studentId", "==", studentId)
            .get();
          const progressRow = snap.docs
            .map((doc) => doc.data() || {})
            .find(
              (row) =>
                trimText(row.subjectId || row.courseId) === courseId &&
                !trimText(row.lectureId)
            );
          return [studentId, progressRow || null];
        })
      ),
    ]);

    const studentById = Object.fromEntries(studentDocs);
    const userById = Object.fromEntries(userDocs);
    const progressById = Object.fromEntries(progressDocs);

    const payload = mergedEnrollments.map((row) => {
      const studentId = trimText(row.studentId);
      const studentData = studentById[studentId] || {};
      const userData = userById[studentId] || {};
      const progressData = progressById[studentId] || {};

      const progress = Number(
        progressData?.progress ??
          progressData?.progressPercent ??
          progressData?.completionPercent ??
          row.progress ??
          0
      );

      const fullName =
        trimText(studentData.fullName) ||
        trimText(studentData.name) ||
        trimText(userData.fullName) ||
        trimText(userData.name) ||
        trimText(userData.displayName) ||
        getNameFromEmail(userData.email || "") ||
        "Student";
      const studentClasses = Array.isArray(classMetaByStudentId[studentId])
        ? classMetaByStudentId[studentId]
        : [];

      return {
        studentId,
        fullName,
        email: trimText(userData.email || studentData.email),
        classIds: studentClasses.map((item) => item.classId),
        classes: studentClasses,
        enrolledAt: toIso(row.createdAt || row.enrolledAt),
        progress: Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0,
        completedAt: toIso(row.completedAt || progressData?.completedAt),
        rewatchUnlocked: studentClasses.some((item) => item.rewatchUnlocked),
        lastActive: toIso(
          progressData?.updatedAt ||
            progressData?.lastActiveAt ||
            progressData?.lastViewedAt ||
            row.updatedAt ||
            row.createdAt
        ),
      };
    });

    payload.sort(
      (a, b) =>
        (new Date(b.enrolledAt || 0).getTime() || 0) -
        (new Date(a.enrolledAt || 0).getTime() || 0)
    );

    return successResponse(res, payload, "Course students fetched");
  } catch (error) {
    console.error("getCourseStudents error:", error);
    return errorResponse(res, "Failed to fetch course students", 500);
  }
};

export const updateVideoAccess = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = lowerText(req.user?.role);
    const courseId = trimText(req.params?.courseId);
    const studentId = trimText(req.params?.studentId);
    const lectureId = trimText(req.body?.lectureId);
    const hasAccess = Boolean(req.body?.hasAccess);

    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!courseId || !studentId) {
      return errorResponse(res, "courseId and studentId are required", 400);
    }
    if (!lectureId) {
      return errorResponse(res, "lectureId is required", 400);
    }

    const linkedLecture = await getLectureWithAssignedSubject(
      lectureId,
      uid,
      role
    );
    if (linkedLecture.error) {
      return errorResponse(res, linkedLecture.error, linkedLecture.status);
    }
    const lectureCourseId = trimText(
      linkedLecture.lectureData.courseId || linkedLecture.lectureData.subjectId
    );
    let resolvedCourseId = lectureCourseId;
    if (!resolvedCourseId) {
      const chapterId = trimText(linkedLecture.lectureData.chapterId);
      if (chapterId) {
        const chapterSnap = await db.collection("chapters").doc(chapterId).get().catch(() => null);
        const chapterData = chapterSnap?.exists ? chapterSnap.data() || {} : {};
        resolvedCourseId = trimText(chapterData.courseId || chapterData.subjectId);
      }
    }
    if (resolvedCourseId && resolvedCourseId !== courseId) {
      return errorResponse(res, "Lecture does not belong to this course", 400);
    }

    const docId = `${courseId}_${studentId}_${lectureId}`;
    await db
      .collection(VIDEO_ACCESS_COLLECTION)
      .doc(docId)
      .set(
        {
          courseId,
          studentId,
          lectureId,
          hasAccess,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

    return successResponse(
      res,
      {
        courseId,
        studentId,
        lectureId,
        hasAccess,
      },
      "Video access updated"
    );
  } catch (error) {
    console.error("updateVideoAccess error:", error);
    return errorResponse(res, "Failed to update video access", 500);
  }
};

export const updateCourseRewatchAccess = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = lowerText(req.user?.role);
    const courseId = trimText(req.params?.courseId);
    const studentId = trimText(req.params?.studentId);
    const unlocked = req.body?.unlocked !== false;
    const lockAfterCompletionRaw = req.body?.lockAfterCompletion;

    if (!uid) return errorResponse(res, "Missing user uid", 400);
    if (!courseId || !studentId) {
      return errorResponse(res, "courseId and studentId are required", 400);
    }

    const classDocs =
      role === "admin"
        ? (
            await db.collection(COLLECTIONS.CLASSES).get()
          ).docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }))
        : await getTeacherAssignedClassDocs(uid);

    const targetClasses = classDocs.filter((row) => {
      const classData = row.data || {};
      const classHasCourse = getClassAssignedCourseIds(classData).includes(courseId);
      if (!classHasCourse) return false;
      const studentEntries = getClassStudentEntries(classData).filter(
        (entry) => trimText(entry.studentId) === studentId
      );
      if (!studentEntries.length) return false;
      return studentEntries.some((entry) => {
        const courseIds = resolveClassEntryCourseIds(entry, classData);
        return courseIds.length ? courseIds.includes(courseId) : classHasCourse;
      });
    });

    if (!targetClasses.length) {
      return errorResponse(
        res,
        "No class enrollment found for this student in the selected course",
        404
      );
    }

    await Promise.all(
      targetClasses.map(async (row) => {
        const classRef = db.collection(COLLECTIONS.CLASSES).doc(row.id);
        const classData = row.data || {};
        const updates = {
          unlockedStudents: buildUnlockedStudentRows(
            classData.unlockedStudents,
            studentId,
            unlocked,
            uid
          ),
          updatedAt: serverTimestamp(),
        };

        if (unlocked) {
          updates.unlockedStudentIds = admin.firestore.FieldValue.arrayUnion(studentId);
          updates.rewatchUnlockedStudentIds =
            admin.firestore.FieldValue.arrayUnion(studentId);
        } else {
          updates.unlockedStudentIds = admin.firestore.FieldValue.arrayRemove(studentId);
          updates.rewatchUnlockedStudentIds =
            admin.firestore.FieldValue.arrayRemove(studentId);
        }

        if (typeof lockAfterCompletionRaw === "boolean") {
          updates.lockAfterCompletion = lockAfterCompletionRaw;
        }

        await classRef.set(updates, { merge: true });
      })
    );

    return successResponse(
      res,
      {
        courseId,
        studentId,
        unlocked,
        affectedClasses: targetClasses.map((row) => ({
          classId: row.id,
          className: trimText(row.data?.name) || "Class",
          batchCode: trimText(row.data?.batchCode),
        })),
      },
      unlocked
        ? "Rewatch unlocked for completed class content"
        : "Rewatch lock restored for completed class content"
    );
  } catch (error) {
    console.error("updateCourseRewatchAccess error:", error);
    return errorResponse(res, "Failed to update rewatch access", 500);
  }
};

export const getFinalQuizRequests = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = lowerText(req.user?.role);
    const statusFilter = lowerText(req.query?.status);
    const courseFilter = trimText(req.query?.courseId);
    if (!uid) return errorResponse(res, "Missing user uid", 400);

    let rows = [];
    try {
      const snap = await db
        .collection(FINAL_QUIZ_REQUEST_COLLECTION)
        .orderBy("requestedAt", "desc")
        .get();
      rows = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    } catch {
      const snap = await db.collection(FINAL_QUIZ_REQUEST_COLLECTION).get();
      rows = snap.docs
        .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
        .sort(
          (a, b) =>
            (new Date(toIso(b.requestedAt || b.createdAt) || 0).getTime() || 0) -
            (new Date(toIso(a.requestedAt || a.createdAt) || 0).getTime() || 0)
        );
    }

    if (role !== "admin") {
      const teacherCourses = await getTeacherAssignedCourses(uid);
      const allowedCourseIds = new Set(teacherCourses.courseIds || []);
      rows = rows.filter((row) =>
        allowedCourseIds.has(trimText(row.subjectId || row.courseId))
      );
    }

    if (courseFilter) {
      rows = rows.filter((row) => trimText(row.subjectId || row.courseId) === courseFilter);
    }
    if (statusFilter) {
      rows = rows.filter((row) => lowerText(row.status) === statusFilter);
    }

    const payload = rows.map((row) => ({
      requestId: row.id,
      studentId: trimText(row.studentId),
      studentName: trimText(row.studentName) || "Student",
      studentEmail: trimText(row.studentEmail),
      courseId: trimText(row.subjectId || row.courseId),
      courseName: trimText(row.courseName) || "Course",
      status: lowerText(row.status || "pending"),
      notes: trimText(row.notes),
      requestedAt: toIso(row.requestedAt || row.createdAt),
      reviewedAt: toIso(row.reviewedAt),
      reviewedBy: trimText(row.reviewedBy),
      reviewedByRole: lowerText(row.reviewedByRole),
      finalQuizPassed: row.finalQuizPassed === true,
      finalQuizResultId: trimText(row.finalQuizResultId),
      updatedAt: toIso(row.updatedAt),
    }));

    return successResponse(res, payload, "Final quiz requests fetched");
  } catch (error) {
    console.error("getFinalQuizRequests error:", error);
    return errorResponse(res, "Failed to fetch final quiz requests", 500);
  }
};

export const updateFinalQuizRequestStatus = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = lowerText(req.user?.role);
    const requestId = trimText(req.params?.requestId);
    const action = lowerText(req.body?.action);
    const notes = trimText(req.body?.notes || "");

    if (!uid) return errorResponse(res, "Missing user uid", 400);
    if (!requestId) return errorResponse(res, "requestId is required", 400);
    if (!FINAL_QUIZ_REQUEST_ACTIONS.has(action)) {
      return errorResponse(res, "action must be approve, reject or complete", 400);
    }

    const requestRef = db.collection(FINAL_QUIZ_REQUEST_COLLECTION).doc(requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) return errorResponse(res, "Request not found", 404);
    const requestData = requestSnap.data() || {};

    if (role !== "admin") {
      const teacherCourses = await getTeacherAssignedCourses(uid);
      const allowedCourseIds = new Set(teacherCourses.courseIds || []);
      if (!allowedCourseIds.has(trimText(requestData.courseId))) {
        return errorResponse(res, "Forbidden", 403);
      }
    }

    const nextStatus =
      action === "approve" ? "approved" : action === "reject" ? "rejected" : "completed";

    await requestRef.set(
      {
        status: nextStatus,
        reviewerNotes: notes,
        reviewedBy: uid,
        reviewedByRole: role || "teacher",
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (action === "approve") {
      const courseId = trimText(requestData.subjectId || requestData.courseId);
      const studentId = trimText(requestData.studentId);
      if (courseId && studentId) {
        const [byCourseSnap, bySubjectSnap] = await Promise.all([
          db
            .collection(COLLECTIONS.QUIZZES)
            .where("courseId", "==", courseId)
            .get(),
          db
            .collection(COLLECTIONS.QUIZZES)
            .where("subjectId", "==", courseId)
            .get(),
        ]);

        const finalQuizzes = [...byCourseSnap.docs, ...bySubjectSnap.docs].filter((doc) => {
          const row = doc.data() || {};
          const status = lowerText(row.status || "active");
          return status === "active" && isFinalQuizEntry(row);
        });

        if (finalQuizzes.length > 0) {
          const batch = db.batch();
          finalQuizzes.forEach((quizDoc) => {
            const quizData = quizDoc.data() || {};
            const assignment = quizData.assignment || {};
            const existingStudents = Array.isArray(assignment.students)
              ? assignment.students
              : [];
            const alreadyAssigned = existingStudents.some((entry) => {
              const assignedStudentId =
                typeof entry === "string"
                  ? trimText(entry)
                  : trimText(entry?.studentId || entry?.id);
              return assignedStudentId === studentId;
            });
            if (alreadyAssigned) return;

            const updatedStudents = [
              ...existingStudents,
              {
                studentId,
                fullName: trimText(requestData.studentName) || "Student",
                email: trimText(requestData.studentEmail),
              },
            ];

            batch.set(
              quizDoc.ref,
              {
                assignment: {
                  ...assignment,
                  targetType: "students",
                  assignedBy: assignment.assignedBy || uid,
                  assignedAt: assignment.assignedAt || serverTimestamp(),
                  courseId: trimText(assignment.courseId || courseId),
                  classId: trimText(assignment.classId || requestData.classId),
                  dueAt: assignment.dueAt || null,
                  students: updatedStudents,
                  totalAssigned: updatedStudents.length,
                },
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          });
          await batch.commit();
        }
      }
    }

    const updatedSnap = await requestRef.get();
    const updatedData = updatedSnap.data() || {};

    return successResponse(
      res,
      {
        requestId,
        status: lowerText(updatedData.status || nextStatus),
        reviewedAt: toIso(updatedData.reviewedAt),
        reviewedBy: trimText(updatedData.reviewedBy),
        reviewerNotes: trimText(updatedData.reviewerNotes),
      },
      "Final quiz request updated"
    );
  } catch (error) {
    console.error("updateFinalQuizRequestStatus error:", error);
    return errorResponse(res, "Failed to update final quiz request", 500);
  }
};

const clampPercent = (value) => Math.max(0, Math.min(100, toPositiveNumber(value, 0)));

const chunkArray = (rows = [], size = 10) => {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
};

const getTeacherAssignedCourses = async (uid) => {
  const [classDocs, courseRows] = await Promise.all([
    getTeacherAssignedClassDocs(uid),
    getUnifiedCourseRows(),
  ]);
  const teacherOwnedCourseIds = courseRows
    .filter((row) => {
      const assignedSubjects = getTeacherAssignedSubjects(row.data, uid);
      const legacyOwner = trimText(row.data?.teacherId) === trimText(uid);
      return assignedSubjects.length > 0 || legacyOwner;
    })
    .map((row) => row.id);
  const classDerivedCourseIds = new Set(
    getTeacherClassDerivedCourseIds(classDocs, uid, teacherOwnedCourseIds)
  );

  const courses = courseRows
    .map((row) => {
      const assignedSubjects = getTeacherAssignedSubjects(row.data, uid);
      const legacyOwner = trimText(row.data?.teacherId) === uid;
      const classLinked = classDerivedCourseIds.has(row.id);
      const mySubjects =
        assignedSubjects.length > 0
          ? assignedSubjects
          : legacyOwner || classLinked
            ? getAllCourseSubjects(row.data)
            : [];
      return {
        courseId: row.id,
        courseData: row.data,
        mySubjects,
      };
    })
    .filter((row) => row.mySubjects.length > 0);

  const courseIds = courses.map((row) => row.courseId);
  const courseNameById = Object.fromEntries(
    courses.map((row) => [
      row.courseId,
      trimText(
        row.courseData?.title ||
          row.courseData?.subjectName ||
          row.mySubjects?.[0]?.subjectName
      ) || "Untitled Subject",
    ])
  );
  const subjectIdsByCourseId = Object.fromEntries(
    courses.map((row) => [
      row.courseId,
      new Set(row.mySubjects.map((subject) => trimText(subject.subjectId)).filter(Boolean)),
    ])
  );

  return { courses, courseIds, courseNameById, subjectIdsByCourseId };
};

const getTeacherLectureRows = async (courseIds = [], subjectIdsByCourseId = {}) => {
  if (!courseIds.length) return [];
  const lectureSnapshots = await Promise.all(
    courseIds.map((courseId) =>
      db.collection(COLLECTIONS.LECTURES).where("courseId", "==", courseId).get()
    )
  );

  return lectureSnapshots.flatMap((snap) =>
    snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((lecture) => {
        const subjectId = trimText(lecture.subjectId);
        const courseId = trimText(lecture.courseId);
        const allowedSubjects = subjectIdsByCourseId[courseId];
        return Boolean(allowedSubjects && allowedSubjects.has(subjectId));
      })
  );
};

const extractCourseProgress = (progressRows = [], courseId = "", fallbackProgress = 0) => {
  const cleanCourseId = trimText(courseId);
  const scopedRows = progressRows.filter(
    (row) => trimText(row.subjectId || row.courseId) === cleanCourseId
  );

  const direct = scopedRows.find(
    (row) =>
      trimText(row.subjectId || row.courseId) === cleanCourseId &&
      !trimText(row.lectureId)
  );
  const directProgress = Number(
    direct?.progress ?? direct?.progressPercent ?? direct?.completionPercent
  );
  if (Number.isFinite(directProgress)) return clampPercent(directProgress);

  if (scopedRows.length > 0) {
    const lectureRows = scopedRows.filter((row) => trimText(row.lectureId));
    if (lectureRows.length) {
      const byLectureId = lectureRows.reduce((acc, row) => {
        const lectureId = trimText(row.lectureId);
        if (!lectureId) return acc;
        const isCompleted = Boolean(
          row.isCompleted ||
            row.completed ||
            toPositiveNumber(row.progress, 0) >= 100 ||
            toPositiveNumber(row.progressPercent, 0) >= 100 ||
            toPositiveNumber(row.completionPercent, 0) >= 100
        );
        const rawPercent = Number(
          row.watchedPercent ?? row.progress ?? row.progressPercent ?? row.completionPercent
        );
        const durationSec = Math.max(
          0,
          toPositiveNumber(row.durationSec ?? row.videoDurationSec ?? row.totalDurationSec, 0)
        );
        const currentTimeSec = Math.max(
          0,
          toPositiveNumber(row.currentTimeSec ?? row.resumeAtSeconds ?? row.lastPositionSec, 0)
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
        const total = scores.reduce((sum, score) => sum + toPositiveNumber(score, 0), 0);
        return clampPercent(total / scores.length);
      }
    }
  }

  return clampPercent(fallbackProgress);
};

export const getTeacherStudents = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = lowerText(req.user?.role);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);

    if (role === "admin") {
      const [usersSnap, studentsSnap, enrollmentsSnap, coursesSnap] = await Promise.all([
        db.collection(COLLECTIONS.USERS).where("role", "==", "student").get(),
        db.collection(COLLECTIONS.STUDENTS).get(),
        db.collection(COLLECTIONS.ENROLLMENTS).get(),
        db.collection(COLLECTIONS.COURSES).get(),
      ]);

      const studentDocById = Object.fromEntries(
        studentsSnap.docs.map((doc) => [doc.id, doc.data() || {}])
      );
      const courseNameById = Object.fromEntries(
        coursesSnap.docs.map((doc) => [doc.id, trimText(doc.data()?.title) || "Course"])
      );
      const enrollmentsByStudent = {};
      enrollmentsSnap.docs.forEach((doc) => {
        const row = doc.data() || {};
        const studentId = trimText(row.studentId);
        const courseId = trimText(row.subjectId || row.courseId);
        if (!studentId || !courseId) return;
        if (!Array.isArray(enrollmentsByStudent[studentId])) {
          enrollmentsByStudent[studentId] = [];
        }
        enrollmentsByStudent[studentId].push({
          courseId,
          courseName: courseNameById[courseId] || "Course",
          progress: clampPercent(row.progress),
          completedAt: toIso(row.completedAt),
          enrolledAt: toIso(row.createdAt || row.enrolledAt),
        });
      });

      const rows = usersSnap.docs
        .map((doc) => {
          const userData = doc.data() || {};
          const studentData = studentDocById[doc.id] || {};
          const fromStudentDoc = normalizeStudentCourseRefs(
            studentData.enrolledCourses,
            studentData.enrolledAtMap || {}
          ).map((entry) => ({
            courseId: entry.courseId,
            courseName: courseNameById[entry.courseId] || "Course",
            progress: 0,
            completedAt: null,
            enrolledAt: entry.enrolledAt || null,
          }));
          const fromEnrollments = Array.isArray(enrollmentsByStudent[doc.id])
            ? enrollmentsByStudent[doc.id]
            : [];

          const byCourse = new Map();
          [...fromStudentDoc, ...fromEnrollments].forEach((entry) => {
            const courseId = trimText(entry.courseId);
            if (!courseId) return;
            if (!byCourse.has(courseId)) {
              byCourse.set(courseId, {
                courseId,
                courseName: entry.courseName || courseNameById[courseId] || "Course",
                progress: clampPercent(entry.progress),
                completedAt: entry.completedAt || null,
                enrolledAt: entry.enrolledAt || null,
              });
              return;
            }
            const current = byCourse.get(courseId);
            byCourse.set(courseId, {
              ...current,
              progress: Math.max(
                clampPercent(current.progress),
                clampPercent(entry.progress)
              ),
              completedAt: current.completedAt || entry.completedAt || null,
              enrolledAt: current.enrolledAt || entry.enrolledAt || null,
            });
          });

          const enrolledCourses = Array.from(byCourse.values());
          const avgProgress =
            enrolledCourses.length > 0
              ? Math.round(
                  enrolledCourses.reduce(
                    (sum, courseRow) => sum + clampPercent(courseRow.progress),
                    0
                  ) / enrolledCourses.length
                )
              : 0;
          const completedCourses = enrolledCourses.filter(
            (courseRow) =>
              clampPercent(courseRow.progress) >= 100 || Boolean(courseRow.completedAt)
          ).length;

          const fullName =
            trimText(studentData.fullName) ||
            trimText(studentData.name) ||
            trimText(userData.fullName) ||
            trimText(userData.name) ||
            trimText(userData.displayName) ||
            getNameFromEmail(userData.email || "") ||
            "Student";

          return {
            uid: doc.id,
            fullName,
            email: trimText(userData.email),
            phoneNumber: trimText(
              studentData.phoneNumber || studentData.phone || userData.phoneNumber
            ),
            isActive: userData.isActive !== false,
            lastLoginAt: toIso(userData.lastLoginAt),
            enrolledCourses,
            avgProgress,
            completedCourses,
          };
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      return successResponse(res, rows, "Students fetched");
    }

    const { courseIds, courseNameById } = await getTeacherAssignedCourses(uid);
    if (!courseIds.length) {
      return successResponse(res, [], "Teacher students fetched");
    }

    const enrollmentChunks = await Promise.all(
      chunkArray(courseIds, 10).map((ids) =>
        db.collection(COLLECTIONS.ENROLLMENTS).where("courseId", "in", ids).get()
      )
    );
    const enrollments = enrollmentChunks.flatMap((snap) =>
      snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    );
    const classesSnap = await db.collection(COLLECTIONS.CLASSES).get();
    const classDocs = classesSnap.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() || {},
    }));
    const inferredEnrollments = buildClassDerivedEnrollmentRows(classDocs, courseIds);
    const mergedEnrollments = mergeEnrollmentRowsByStudentCourse(
      enrollments,
      inferredEnrollments
    );

    const studentIds = [
      ...new Set(mergedEnrollments.map((row) => trimText(row.studentId)).filter(Boolean)),
    ];

    if (!studentIds.length) {
      return successResponse(res, [], "Teacher students fetched");
    }

    const [studentDocs, userDocs, progressRowsByStudent] = await Promise.all([
      Promise.all(
        studentIds.map(async (studentId) => {
          const snap = await db.collection(COLLECTIONS.STUDENTS).doc(studentId).get();
          return [studentId, snap.exists ? snap.data() || {} : {}];
        })
      ),
      Promise.all(
        studentIds.map(async (studentId) => {
          const snap = await db.collection(COLLECTIONS.USERS).doc(studentId).get();
          return [studentId, snap.exists ? snap.data() || {} : {}];
        })
      ),
      Promise.all(
        studentIds.map(async (studentId) => {
          const snap = await db
            .collection(COLLECTIONS.PROGRESS)
            .where("studentId", "==", studentId)
            .get();
          return [studentId, snap.docs.map((doc) => doc.data() || {})];
        })
      ),
    ]);

    const studentById = Object.fromEntries(studentDocs);
    const userById = Object.fromEntries(userDocs);
    const progressByStudentId = Object.fromEntries(progressRowsByStudent);

    const rows = studentIds
      .map((studentId) => {
        const studentData = studentById[studentId] || {};
        const userData = userById[studentId] || {};
        const studentEnrollments = mergedEnrollments.filter(
          (row) => trimText(row.studentId) === studentId
        );
        const progressRows = Array.isArray(progressByStudentId[studentId])
          ? progressByStudentId[studentId]
          : [];

        const enrolledCourses = studentEnrollments.map((enrollment) => {
          const courseId = trimText(enrollment.subjectId || enrollment.courseId);
          const progress = extractCourseProgress(progressRows, courseId, enrollment.progress);
          const completedAt =
            toIso(enrollment.completedAt) ||
            toIso(
              progressRows.find(
                (row) => trimText(row.subjectId || row.courseId) === courseId && !trimText(row.lectureId)
              )?.completedAt
            );
          return {
            courseId,
            courseName: courseNameById[courseId] || "Course",
            progress,
            completedAt,
            enrolledAt: toIso(enrollment.createdAt || enrollment.enrolledAt),
          };
        });

        const avgProgress =
          enrolledCourses.length > 0
            ? Math.round(
                enrolledCourses.reduce(
                  (sum, courseRow) => sum + clampPercent(courseRow.progress),
                  0
                ) / enrolledCourses.length
              )
            : 0;

        const completedCourses = enrolledCourses.filter(
          (courseRow) => clampPercent(courseRow.progress) >= 100 || Boolean(courseRow.completedAt)
        ).length;

        const fullName =
          trimText(studentData.fullName) ||
          trimText(studentData.name) ||
          trimText(userData.fullName) ||
          trimText(userData.name) ||
          trimText(userData.displayName) ||
          getNameFromEmail(userData.email || "") ||
          "Student";

        return {
          uid: studentId,
          fullName,
          email: trimText(userData.email),
          phoneNumber: trimText(studentData.phoneNumber || studentData.phone || userData.phoneNumber),
          isActive: userData.isActive !== false,
          lastLoginAt: toIso(userData.lastLoginAt),
          enrolledCourses,
          avgProgress,
          completedCourses,
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    return successResponse(res, rows, "Teacher students fetched");
  } catch (error) {
    console.error("getTeacherStudents error:", error);
    return errorResponse(res, "Failed to fetch teacher students", 500);
  }
};

const isLectureCompletedForStudent = (progressRows = [], courseId = "", lectureId = "", fallbackCourseProgress = 0) => {
  const cleanCourseId = trimText(courseId);
  const cleanLectureId = trimText(lectureId);
  if (!cleanLectureId) return false;

  const rowByLecture = progressRows.find(
    (row) =>
      trimText(row.lectureId) === cleanLectureId &&
      trimText(row.subjectId || row.courseId) === cleanCourseId
  );
  if (rowByLecture) {
    return Boolean(
      rowByLecture.isCompleted ||
        rowByLecture.completed ||
        toPositiveNumber(rowByLecture.progress, 0) >= 100 ||
        toPositiveNumber(rowByLecture.progressPercent, 0) >= 100 ||
        toPositiveNumber(rowByLecture.completionPercent, 0) >= 100
    );
  }

  const courseRow = progressRows.find(
    (row) =>
      trimText(row.subjectId || row.courseId) === cleanCourseId &&
      !trimText(row.lectureId)
  );
  if (Array.isArray(courseRow?.completedLectureIds)) {
    return courseRow.completedLectureIds.some((id) => trimText(id) === cleanLectureId);
  }
  if (courseRow?.lectureProgress && typeof courseRow.lectureProgress === "object") {
    const lectureState = courseRow.lectureProgress[cleanLectureId];
    return Boolean(
      lectureState?.isCompleted ||
        lectureState?.completed ||
        toPositiveNumber(lectureState?.progress, 0) >= 100 ||
        toPositiveNumber(lectureState?.progressPercent, 0) >= 100
    );
  }

  return clampPercent(fallbackCourseProgress) >= 100;
};

const isTeacherAssignedToClass = (classData = {}, uid = "") => {
  if (!uid) return false;
  if (trimText(classData.teacherId) === uid) return true;

  const teachers = Array.isArray(classData.teachers) ? classData.teachers : [];
  const teacherMatch = teachers.some((entry) => {
    if (typeof entry === "string") return trimText(entry) === uid;
    return (
      trimText(entry?.teacherId) === uid ||
      trimText(entry?.id) === uid ||
      trimText(entry?.uid) === uid
    );
  });
  if (teacherMatch) return true;

  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  return shifts.some((shift) => trimText(shift?.teacherId) === uid);
};

export const getTeacherStudentById = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const studentId = trimText(req.params?.studentId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!studentId) return errorResponse(res, "studentId is required", 400);

    const { courses, courseIds, courseNameById, subjectIdsByCourseId } =
      await getTeacherAssignedCourses(uid);
    if (!courseIds.length) return errorResponse(res, "Not your student", 403);

    const [enrollmentRows, studentSnap, userSnap, progressSnap, quizResultsSnap, attendanceSnap, classesSnap] =
      await Promise.all([
        Promise.all(
          chunkArray(courseIds, 10).map((ids) =>
            db
              .collection(COLLECTIONS.ENROLLMENTS)
              .where("studentId", "==", studentId)
              .where("courseId", "in", ids)
              .get()
          )
        ),
        db.collection(COLLECTIONS.STUDENTS).doc(studentId).get(),
        db.collection(COLLECTIONS.USERS).doc(studentId).get(),
        db.collection(COLLECTIONS.PROGRESS).where("studentId", "==", studentId).get(),
        db.collection(COLLECTIONS.QUIZ_RESULTS).where("studentId", "==", studentId).get(),
        db.collection(COLLECTIONS.ATTENDANCE).where("studentId", "==", studentId).get(),
        db.collection(COLLECTIONS.CLASSES).get(),
      ]);
    const directEnrollments = enrollmentRows.flatMap((snap) =>
      snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    );
    const classDocs = classesSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
    const inferredEnrollments = buildClassDerivedEnrollmentRows(classDocs, courseIds).filter(
      (row) => trimText(row.studentId) === studentId
    );
    const enrollments = mergeEnrollmentRowsByStudentCourse(
      directEnrollments,
      inferredEnrollments
    );
    if (!enrollments.length) return errorResponse(res, "Not your student", 403);

    const studentData = studentSnap.exists ? studentSnap.data() || {} : {};
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const progressRows = progressSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    const quizRows = quizResultsSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => courseIds.includes(trimText(row.subjectId || row.courseId)));

    const teacherClassIds = classesSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => isTeacherAssignedToClass(row, uid))
      .map((row) => row.id);
    const attendanceRows = attendanceSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter(
        (row) =>
          teacherClassIds.includes(trimText(row.classId)) ||
          courseIds.includes(trimText(row.subjectId || row.courseId))
      );

    const teacherLectures = await getTeacherLectureRows(courseIds, subjectIdsByCourseId);
    const teacherLectureIds = new Set(teacherLectures.map((lecture) => lecture.id));
    const subjectNameByKey = {};
    courses.forEach((row) => {
      row.mySubjects.forEach((subject) => {
        const key = `${row.courseId}:${trimText(subject.subjectId)}`;
        subjectNameByKey[key] = trimText(subject.subjectName) || "Subject";
      });
    });

    const videoAccessSnap = await db
      .collection(VIDEO_ACCESS_COLLECTION)
      .where("studentId", "==", studentId)
      .get();
    const videoAccess = videoAccessSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => teacherLectureIds.has(trimText(row.lectureId)));

    const enrolledCourses = enrollments.map((enrollment) => {
      const courseId = trimText(enrollment.subjectId || enrollment.courseId);
      const progress = extractCourseProgress(progressRows, courseId, enrollment.progress);
      return {
        courseId,
        courseName: courseNameById[courseId] || "Course",
        progress,
        completedAt:
          toIso(enrollment.completedAt) ||
          toIso(
            progressRows.find(
              (row) =>
                trimText(row.subjectId || row.courseId) === courseId &&
                !trimText(row.lectureId)
            )?.completedAt
          ),
        enrolledAt: toIso(enrollment.createdAt || enrollment.enrolledAt),
        classId: trimText(enrollment.classId),
      };
    });

    const avgProgress =
      enrolledCourses.length > 0
        ? Math.round(
            enrolledCourses.reduce((sum, row) => sum + clampPercent(row.progress), 0) /
              enrolledCourses.length
          )
        : 0;
    const completedCourses = enrolledCourses.filter(
      (row) => clampPercent(row.progress) >= 100 || Boolean(row.completedAt)
    ).length;

    const fullName =
      trimText(studentData.fullName) ||
      trimText(studentData.name) ||
      trimText(userData.fullName) ||
      trimText(userData.name) ||
      trimText(userData.displayName) ||
      getNameFromEmail(userData.email || "") ||
      "Student";

    const availableClassIds = [
      ...new Set(enrolledCourses.map((row) => trimText(row.classId)).filter(Boolean)),
    ];
    const availableClasses = classesSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter(
        (row) =>
          availableClassIds.includes(row.id) &&
          isTeacherAssignedToClass(row, uid)
      )
      .map((row) => ({
        classId: row.id,
        className: trimText(row.name) || "Class",
      }));

    return successResponse(
      res,
      {
        uid: studentId,
        fullName,
        email: trimText(userData.email),
        phoneNumber: trimText(studentData.phoneNumber || studentData.phone || userData.phoneNumber),
        isActive: userData.isActive !== false,
        lastLoginAt: toIso(userData.lastLoginAt),
        assignedWebDevice: trimText(userData.assignedWebDevice),
        joinedAt: toIso(userData.createdAt),
        studentProfile: studentData,
        userProfile: {
          email: trimText(userData.email),
          isActive: userData.isActive !== false,
          lastLoginAt: toIso(userData.lastLoginAt),
          assignedWebDevice: trimText(userData.assignedWebDevice),
          createdAt: toIso(userData.createdAt),
        },
        enrolledCourses,
        avgProgress,
        completedCourses,
        quizResults: quizRows,
        attendance: attendanceRows,
        videoAccess,
        teacherLectures: teacherLectures.map((lecture) => ({
          lectureId: lecture.id,
          title: trimText(lecture.title) || "Lecture",
          courseId: trimText(lecture.courseId),
          courseName:
            courseNameById[trimText(lecture.courseId)] || "Course",
          subjectId: trimText(lecture.subjectId),
          subjectName:
            subjectNameByKey[
              `${trimText(lecture.courseId)}:${trimText(lecture.subjectId)}`
            ] || "Subject",
        })),
        availableClasses,
      },
      "Teacher student profile fetched"
    );
  } catch (error) {
    console.error("getTeacherStudentById error:", error);
    return errorResponse(res, "Failed to fetch student profile", 500);
  }
};

export const getStudentProgress = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const studentId = trimText(req.params?.studentId);
    const courseId = trimText(req.params?.courseId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!studentId || !courseId) {
      return errorResponse(res, "studentId and courseId are required", 400);
    }

    const linkedCourse = await getCourseWithAssignedSubjects(courseId, uid);
    if (linkedCourse.error) {
      return errorResponse(res, linkedCourse.error, linkedCourse.status);
    }

    const enrollmentSnap = await db
      .collection(COLLECTIONS.ENROLLMENTS)
      .where("studentId", "==", studentId)
      .get();
    const enrollmentRows = enrollmentSnap.docs.map((doc) => doc.data() || {});
    let enrollment = enrollmentRows.find(
      (row) => trimText(row.subjectId || row.courseId) === courseId
    ) || null;
    if (!enrollment) {
      const classesSnap = await db.collection(COLLECTIONS.CLASSES).get();
      const classDocs = classesSnap.docs.map((doc) => ({
        id: doc.id,
        data: doc.data() || {},
      }));
      const inferred = buildClassDerivedEnrollmentRows(classDocs, [courseId]).find(
        (row) => trimText(row.studentId) === studentId
      );
      if (!inferred) {
        return errorResponse(res, "Student is not enrolled in this course", 403);
      }
      enrollment = inferred;
    }

    const teacherSubjectIds = new Set(
      linkedCourse.mySubjects.map((subject) => trimText(subject.subjectId)).filter(Boolean)
    );
    const lecturesSnap = await db
      .collection(COLLECTIONS.LECTURES)
      .where("courseId", "==", courseId)
      .get();
    const lectures = lecturesSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((lecture) => teacherSubjectIds.has(trimText(lecture.subjectId)))
      .sort((a, b) => toPositiveNumber(a.order, 0) - toPositiveNumber(b.order, 0));

    const progressSnap = await db
      .collection(COLLECTIONS.PROGRESS)
      .where("studentId", "==", studentId)
      .get();
    const progressRows = progressSnap.docs.map((doc) => doc.data() || {});

    const videoAccessSnap = await db
      .collection(VIDEO_ACCESS_COLLECTION)
      .where("studentId", "==", studentId)
      .get();
    const videoAccessMap = Object.fromEntries(
      videoAccessSnap.docs.map((doc) => {
        const data = doc.data() || {};
        return [trimText(data.lectureId), Boolean(data.hasAccess)];
      })
    );

    const courseProgress = extractCourseProgress(progressRows, courseId, enrollment.progress);
    const lectureRows = lectures.map((lecture) => {
      const isCompleted = isLectureCompletedForStudent(
        progressRows,
        courseId,
        lecture.id,
        courseProgress
      );
      const lectureProgressRow = progressRows.find(
        (row) =>
          trimText(row.lectureId) === lecture.id &&
          trimText(row.subjectId || row.courseId) === courseId
      );
      return {
        lectureId: lecture.id,
        title: trimText(lecture.title) || "Lecture",
        isCompleted,
        completedAt: toIso(lectureProgressRow?.completedAt),
        hasVideoAccess: Boolean(videoAccessMap[lecture.id]),
      };
    });

    const totalLectures = lectureRows.length;
    const completedLectures = lectureRows.filter((row) => row.isCompleted).length;
    const progressPercent =
      totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : courseProgress;

    return successResponse(
      res,
      {
        courseId,
        courseName: trimText(linkedCourse.courseData.title) || "Course",
        totalLectures,
        completedLectures,
        progressPercent: clampPercent(progressPercent),
        lectures: lectureRows,
      },
      "Student progress fetched"
    );
  } catch (error) {
    console.error("getStudentProgress error:", error);
    return errorResponse(res, "Failed to fetch student progress", 500);
  }
};

export const updateStudentVideoAccess = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const studentId = trimText(req.params?.studentId);
    const lectureAccess = Array.isArray(req.body?.lectureAccess)
      ? req.body.lectureAccess
      : [];

    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!studentId) return errorResponse(res, "studentId is required", 400);
    if (!lectureAccess.length) {
      return errorResponse(res, "lectureAccess is required", 400);
    }

    const batch = db.batch();
    for (const row of lectureAccess) {
      const lectureId = trimText(row?.lectureId);
      if (!lectureId) continue;
      const linkedLecture = await getLectureWithAssignedSubject(lectureId, uid);
      if (linkedLecture.error) {
        return errorResponse(res, linkedLecture.error, linkedLecture.status);
      }
      const docRef = db
        .collection(VIDEO_ACCESS_COLLECTION)
        .doc(`${studentId}_${lectureId}`);
      batch.set(
        docRef,
        {
          studentId,
          lectureId,
          hasAccess: Boolean(row?.hasAccess),
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();

    return successResponse(
      res,
      { studentId, updatedCount: lectureAccess.length },
      "Video access updated"
    );
  } catch (error) {
    console.error("updateStudentVideoAccess error:", error);
    return errorResponse(res, "Failed to update student video access", 500);
  }
};

export const getStudentAttendance = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const studentId = trimText(req.params?.studentId);
    const classId = trimText(req.params?.classId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!studentId || !classId) {
      return errorResponse(res, "studentId and classId are required", 400);
    }

    const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
    if (!classSnap.exists) return errorResponse(res, "Class not found", 404);
    const classData = classSnap.data() || {};
    if (!isTeacherAssignedToClass(classData, uid)) {
      return errorResponse(res, "Forbidden", 403);
    }
    const classStudentEntry = getClassStudentEntries(classData).find(
      (entry) => trimText(entry.studentId) === studentId
    );
    if (!classStudentEntry) {
      return errorResponse(res, "Student is not enrolled in this class", 404);
    }

    const classCourseIds = resolveClassEntryCourseIds(classStudentEntry, classData);
    const enrollmentSnap = await db
      .collection(COLLECTIONS.ENROLLMENTS)
      .where("studentId", "==", studentId)
      .where("classId", "==", classId)
      .get();
    const enrollments = enrollmentSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => {
        if (!classCourseIds.length) return true;
        return classCourseIds.includes(trimText(row.subjectId || row.courseId));
      });

    const courseMap = await getCourseMapByIds(classCourseIds);
    const windowStart = maxDate([
      parseSessionDateOnly(classData.startDate),
      ...enrollments.map((row) => parseSessionDateOnly(row.createdAt || row.enrolledAt)),
      ...classCourseIds.map((courseId) => parseSessionDateOnly(courseMap[courseId]?.startDate)),
    ]);
    let windowEnd = minDate([
      parseSessionDateOnly(classData.endDate),
      ...enrollments.map((row) => parseSessionDateOnly(row.completedAt)),
      ...classCourseIds.map((courseId) => parseSessionDateOnly(courseMap[courseId]?.endDate)),
    ]);
    if (windowStart && windowEnd && windowEnd.getTime() < windowStart.getTime()) {
      windowEnd = null;
    }

    const [sessionsSnap, attendanceSnap] = await Promise.all([
      db.collection(COLLECTIONS.SESSIONS).where("classId", "==", classId).get(),
      db
        .collection(COLLECTIONS.ATTENDANCE)
        .where("studentId", "==", studentId)
        .where("classId", "==", classId)
        .get(),
    ]);

    const attendanceBySession = attendanceSnap.docs.reduce((acc, doc) => {
      const row = doc.data() || {};
      const sessionId = trimText(row.sessionId);
      if (sessionId) acc[sessionId] = row;
      return acc;
    }, {});

    const today = parseSessionDateOnly(new Date());
    const sessions = sessionsSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => !(lowerText(row.status) === "cancelled" || row.cancelledAt))
      .filter((row) => {
        const sessionDate = parseSessionDateOnly(row.date);
        if (!sessionDate) return false;
        if (classCourseIds.length) {
          const sessionCourseId = trimText(row.subjectId || row.courseId);
          if (sessionCourseId && !classCourseIds.includes(sessionCourseId)) return false;
        }
        if (windowStart && sessionDate.getTime() < windowStart.getTime()) return false;
        if (windowEnd && sessionDate.getTime() > windowEnd.getTime()) return false;
        return true;
      })
      .sort(
        (a, b) =>
          (parseSessionDateOnly(a.date)?.getTime() || 0) -
          (parseSessionDateOnly(b.date)?.getTime() || 0)
      )
      .map((row, index) => {
        const sessionDate = parseSessionDateOnly(row.date);
        const attendance = attendanceBySession[row.id] || null;
        const isUpcoming =
          sessionDate && today ? sessionDate.getTime() > today.getTime() : false;

        let status = "absent";
        if (isUpcoming) {
          status = "upcoming";
        } else if (attendance) {
          const normalized = lowerText(attendance.status);
          if (["present", "absent", "late"].includes(normalized)) status = normalized;
        }

        return {
          id: row.id,
          sessionNumber: index + 1,
          date: formatSessionDate(row.date),
          topic: trimText(row.topic || row.sessionTopic),
          status,
          remarks: trimText(attendance?.remarks || attendance?.note || row.remarks),
          isUpcoming,
        };
      });

    const conductedSessions = sessions.filter((row) => !row.isUpcoming);
    const totalSessions = conductedSessions.length;
    const presentCount = conductedSessions.filter((session) => session.status === "present").length;
    const absentCount = conductedSessions.filter((session) => session.status === "absent").length;
    const lateCount = conductedSessions.filter((session) => session.status === "late").length;
    const attendancePercent =
      totalSessions > 0
        ? Math.round(((presentCount + lateCount) / totalSessions) * 100)
        : 0;
    const { currentStreak, longestStreak } = getCurrentAndLongestStreak(conductedSessions);

    const learningStart =
      windowStart || parseSessionDateOnly(conductedSessions[0]?.date || sessions[0]?.date);
    const learningEnd = learningStart ? minDate([windowEnd, today]) || today : null;
    const learningDaysElapsed =
      learningStart && learningEnd ? daysInclusive(learningStart, learningEnd) : 0;
    const courseDurationDays =
      windowStart && windowEnd ? daysInclusive(windowStart, windowEnd) : 0;
    const learningDayProgress =
      courseDurationDays > 0
        ? Number(Math.min(100, ((learningDaysElapsed / courseDurationDays) * 100).toFixed(2)))
        : null;

    return successResponse(
      res,
      {
        classId,
        className: trimText(classData.name) || "Class",
        studentId,
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
        attendancePercent: clampPercent(attendancePercent),
        sessions,
      },
      "Student attendance fetched"
    );
  } catch (error) {
    console.error("getStudentAttendance error:", error);
    return errorResponse(res, "Failed to fetch student attendance", 500);
  }
};

const SESSION_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SESSION_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SESSION_ATTENDANCE_STATUSES = new Set(["present", "absent", "late"]);

const parseSessionDateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const parsed = new Date(value);
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  const text = String(value).trim();
  if (SESSION_DATE_REGEX.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  const parsed = toDate(value);
  if (!parsed) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const formatSessionDate = (value) => {
  const parsed = parseSessionDateOnly(value);
  if (!parsed) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeSessionTime = (value) => {
  const text = String(value || "").trim();
  return SESSION_TIME_REGEX.test(text) ? text : "";
};

const getMinutesFromSessionTime = (value) => {
  const normalized = normalizeSessionTime(value);
  if (!normalized) return null;
  const [hour, minute] = normalized.split(":").map(Number);
  return hour * 60 + minute;
};

const calculateSessionDurationMinutes = (startTime, endTime) => {
  const startMinutes = getMinutesFromSessionTime(startTime);
  const endMinutes = getMinutesFromSessionTime(endTime);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return null;
  if (endMinutes <= startMinutes) return null;
  return endMinutes - startMinutes;
};

const isSessionTimeOverlapping = (startA, endA, startB, endB) => {
  const aStart = getMinutesFromSessionTime(startA);
  const aEnd = getMinutesFromSessionTime(endA);
  const bStart = getMinutesFromSessionTime(startB);
  const bEnd = getMinutesFromSessionTime(endB);
  if (![aStart, aEnd, bStart, bEnd].every(Number.isFinite)) return false;
  return aStart < bEnd && aEnd > bStart;
};

const combineSessionDateTime = (dateValue, timeValue = "00:00") => {
  const date = parseSessionDateOnly(dateValue);
  const time = normalizeSessionTime(timeValue);
  if (!date || !time) return null;
  const [hour, minute] = time.split(":").map(Number);
  const merged = new Date(date);
  merged.setHours(hour, minute, 0, 0);
  return merged;
};

const isTodayOrFutureSessionDate = (value) => {
  const parsed = parseSessionDateOnly(value);
  if (!parsed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed >= today;
};

const isValidSessionUrl = (value = "") => {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const getClassStudentEntries = (classData = {}) => {
  const raw = Array.isArray(classData.students) ? classData.students : [];
  return raw
    .map((entry) =>
      typeof entry === "string"
        ? { studentId: trimText(entry), shiftId: "", courseId: "", enrolledAt: null }
        : {
            studentId: trimText(entry?.studentId),
            shiftId: trimText(entry?.shiftId),
            courseId: trimText(entry?.courseId),
            enrolledAt: entry?.enrolledAt || null,
          }
    )
    .filter((entry) => Boolean(entry.studentId));
};

const getTeacherAssignedClassDocs = async (uid) => {
  const byId = new Map();
  const attachDocs = (docs = []) => {
    docs.forEach((doc) => {
      byId.set(doc.id, { id: doc.id, data: doc.data() || {} });
    });
  };

  const [teacherIdSnap, teachersArraySnap, allClassesSnap, coursesSnap] = await Promise.all([
    db.collection(COLLECTIONS.CLASSES).where("teacherId", "==", uid).get(),
    db
      .collection(COLLECTIONS.CLASSES)
      .where("teachers", "array-contains", uid)
      .get()
      .catch(() => null),
    db.collection(COLLECTIONS.CLASSES).get(),
    db.collection(COLLECTIONS.COURSES).get(),
  ]);

  attachDocs(teacherIdSnap.docs);
  if (teachersArraySnap) attachDocs(teachersArraySnap.docs);

  const teacherOwnedCourseIds = new Set(
    coursesSnap.docs
      .filter((doc) => isCourseOwner(doc.data() || {}, uid))
      .map((doc) => trimText(doc.id))
      .filter(Boolean)
  );

  allClassesSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const classCourseIds = getClassAssignedCourseIds(data);
    const hasOwnedCourse = classCourseIds.some((courseId) =>
      teacherOwnedCourseIds.has(trimText(courseId))
    );
    if (isTeacherAssignedToClass(data, uid) || hasOwnedCourse) {
      byId.set(doc.id, { id: doc.id, data });
    }
  });

  return Array.from(byId.values());
};

const getSessionSortTimestamp = (sessionData = {}) => {
  const startAt = combineSessionDateTime(sessionData.date, sessionData.startTime);
  if (startAt) return startAt.getTime();
  const dateOnly = parseSessionDateOnly(sessionData.date);
  return dateOnly ? dateOnly.getTime() : 0;
};

const computeTeacherSessionStatus = (sessionData = {}, now = new Date()) => {
  const explicitStatus = lowerText(sessionData.status);
  if (explicitStatus === "cancelled" || sessionData.cancelledAt) return "cancelled";
  if (explicitStatus === "completed" || sessionData.completedAt) return "completed";

  const startAt = combineSessionDateTime(sessionData.date, sessionData.startTime);
  if (!startAt) return "upcoming";
  if (startAt > now) return "upcoming";

  const liveWindowEnd = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
  if (now <= liveWindowEnd) return "live";
  return "completed";
};

const getTeacherSessionDocsByClassIds = async (classIds = []) => {
  if (!classIds.length) return [];

  const rows = [];
  for (const chunk of chunkArray(classIds, 10)) {
    if (!chunk.length) continue;
    try {
      const snap = await db
        .collection(COLLECTIONS.SESSIONS)
        .where("classId", "in", chunk)
        .orderBy("date", "desc")
        .get();
      rows.push(
        ...snap.docs.map((doc) => ({
          id: doc.id,
          data: doc.data() || {},
        }))
      );
    } catch {
      const snap = await db
        .collection(COLLECTIONS.SESSIONS)
        .where("classId", "in", chunk)
        .get();
      rows.push(
        ...snap.docs.map((doc) => ({
          id: doc.id,
          data: doc.data() || {},
        }))
      );
    }
  }

  return rows.sort(
    (a, b) => getSessionSortTimestamp(b.data) - getSessionSortTimestamp(a.data)
  );
};

const getCourseMapByIds = async (courseIds = []) => {
  const cleanIds = [...new Set(courseIds.map((id) => trimText(id)).filter(Boolean))];
  if (!cleanIds.length) return {};

  const entries = await Promise.all(
    cleanIds.map(async (courseId) => {
      const snap = await db.collection(COLLECTIONS.COURSES).doc(courseId).get();
      return [courseId, snap.exists ? snap.data() || {} : null];
    })
  );

  return Object.fromEntries(entries.filter(([, value]) => Boolean(value)));
};

const getAttendanceCountBySessionIds = async (sessionIds = []) => {
  const counts = {};
  if (!sessionIds.length) return counts;

  const safeIds = [...new Set(sessionIds.map((id) => trimText(id)).filter(Boolean))];
  if (!safeIds.length) return counts;

  for (const chunk of chunkArray(safeIds, 10)) {
    if (!chunk.length) continue;
    try {
      const snap = await db
        .collection(COLLECTIONS.ATTENDANCE)
        .where("sessionId", "in", chunk)
        .get();
      snap.docs.forEach((doc) => {
        const row = doc.data() || {};
        const sessionId = trimText(row.sessionId);
        if (!sessionId) return;
        const status = lowerText(row.status);
        if (!SESSION_ATTENDANCE_STATUSES.has(status) || status === "absent") return;
        counts[sessionId] = (counts[sessionId] || 0) + 1;
      });
    } catch {
      const fallbackRows = await Promise.all(
        chunk.map(async (sessionId) => {
          const snap = await db
            .collection(COLLECTIONS.ATTENDANCE)
            .where("sessionId", "==", sessionId)
            .get();
          return [sessionId, snap.docs.map((doc) => doc.data() || {})];
        })
      );
      fallbackRows.forEach(([sessionId, rows]) => {
        const count = rows.filter((row) => {
          const status = lowerText(row.status);
          return status === "present" || status === "late";
        }).length;
        counts[sessionId] = count;
      });
    }
  }

  return counts;
};

const serializeTeacherSession = (
  id,
  sessionData = {},
  classById = {},
  courseById = {},
  attendanceCounts = {}
) => {
  const classId = trimText(sessionData.classId);
  const courseId = trimText(sessionData.courseId);
  const classData = classById[classId] || {};
  const courseData = courseById[courseId] || {};
  const classStudents = getClassStudentEntries(classData);
  const attendanceCount =
    attendanceCounts[id] !== undefined
      ? toPositiveNumber(attendanceCounts[id], 0)
      : toPositiveNumber(sessionData.attendanceCount, 0);

  return {
    id,
    classId,
    className: trimText(sessionData.className || classData.name) || "Class",
    courseId,
    courseName: trimText(sessionData.courseName || courseData.title) || "Course",
    topic: trimText(sessionData.topic) || "Untitled Session",
    description: trimText(sessionData.description),
    date: formatSessionDate(sessionData.date),
    startTime: normalizeSessionTime(sessionData.startTime),
    endTime: normalizeSessionTime(sessionData.endTime),
    duration: toPositiveNumber(sessionData.duration, 0),
    platform: trimText(sessionData.platform) || "Other",
    meetingLink: trimText(sessionData.meetingLink),
    status: computeTeacherSessionStatus(sessionData),
    attendanceCount,
    studentsCount: Math.max(
      toPositiveNumber(sessionData.studentsCount, 0),
      toPositiveNumber(classData.enrolledCount, classStudents.length),
      classStudents.length
    ),
    notifyStudents: sessionData.notifyStudents !== false,
    cancelReason: trimText(sessionData.cancelReason),
    createdAt: toIso(sessionData.createdAt),
    teacherId: trimText(sessionData.teacherId),
    teacherName: trimText(sessionData.teacherName),
    sessionNotes: trimText(sessionData.sessionNotes),
    completedAt: toIso(sessionData.completedAt),
    cancelledAt: toIso(sessionData.cancelledAt),
  };
};

const getSessionNotificationRecipients = async (classData = {}) => {
  const studentEntries = getClassStudentEntries(classData);
  const studentIds = [...new Set(studentEntries.map((row) => trimText(row.studentId)).filter(Boolean))];
  if (!studentIds.length) return [];

  const [studentDocs, userDocs] = await Promise.all([
    Promise.all(
      studentIds.map(async (studentId) => {
        const snap = await db.collection(COLLECTIONS.STUDENTS).doc(studentId).get();
        return [studentId, snap.exists ? snap.data() || {} : {}];
      })
    ),
    Promise.all(
      studentIds.map(async (studentId) => {
        const snap = await db.collection(COLLECTIONS.USERS).doc(studentId).get();
        return [studentId, snap.exists ? snap.data() || {} : {}];
      })
    ),
  ]);

  const studentById = Object.fromEntries(studentDocs);
  const userById = Object.fromEntries(userDocs);

  return studentIds
    .map((studentId) => {
      const studentData = studentById[studentId] || {};
      const userData = userById[studentId] || {};
      return {
        studentId,
        email: trimText(userData.email),
        fullName: resolveStudentName(studentData, userData),
      };
    })
    .filter((row) => Boolean(row.email));
};

const sendScheduledSessionEmails = async (recipients = [], sessionMeta = {}) => {
  if (!recipients.length) return 0;
  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      sendSessionScheduledEmail(recipient.email, recipient.fullName, sessionMeta)
    )
  );
  return results.filter((row) => row.status === "fulfilled").length;
};

const sendCancelledSessionEmails = async (recipients = [], sessionMeta = {}) => {
  if (!recipients.length) return 0;
  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      sendSessionCancelledEmail(recipient.email, recipient.fullName, sessionMeta)
    )
  );
  return results.filter((row) => row.status === "fulfilled").length;
};

const getTeacherOwnedSession = async (sessionId, uid) => {
  const sessionRef = db.collection(COLLECTIONS.SESSIONS).doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) return { error: "Session not found", status: 404 };

  const sessionData = sessionSnap.data() || {};
  if (trimText(sessionData.teacherId) !== uid) {
    return { error: "Forbidden", status: 403 };
  }

  return { sessionRef, sessionSnap, sessionData };
};

export const getTeacherSessions = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);

    const classDocs = await getTeacherAssignedClassDocs(uid);
    const classIds = classDocs.map((row) => row.id).filter(Boolean);
    if (!classIds.length) {
      return successResponse(res, [], "Teacher sessions fetched");
    }

    const sessionDocs = await getTeacherSessionDocsByClassIds(classIds);
    if (!sessionDocs.length) {
      return successResponse(res, [], "Teacher sessions fetched");
    }

    const classById = Object.fromEntries(
      classDocs.map((row) => [row.id, row.data || {}])
    );
    const courseIds = [
      ...new Set(sessionDocs.map((row) => trimText(row.data.courseId)).filter(Boolean)),
    ];

    const [courseById, attendanceCounts] = await Promise.all([
      getCourseMapByIds(courseIds),
      getAttendanceCountBySessionIds(sessionDocs.map((row) => row.id)),
    ]);

    const payload = sessionDocs.map((row) =>
      serializeTeacherSession(
        row.id,
        row.data,
        classById,
        courseById,
        attendanceCounts
      )
    );

    return successResponse(res, payload, "Teacher sessions fetched");
  } catch (error) {
    console.error("getTeacherSessions error:", error);
    return errorResponse(res, "Failed to fetch teacher sessions", 500);
  }
};

export const getSessionById = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const sessionId = trimText(req.params?.sessionId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!sessionId) return errorResponse(res, "sessionId is required", 400);

    const owned = await getTeacherOwnedSession(sessionId, uid);
    if (owned.error) return errorResponse(res, owned.error, owned.status);

    const sessionData = owned.sessionData || {};
    const classId = trimText(sessionData.classId);
    const courseId = trimText(sessionData.courseId);

    const [classSnap, courseSnap, attendanceSnap] = await Promise.all([
      classId ? db.collection(COLLECTIONS.CLASSES).doc(classId).get() : null,
      courseId ? db.collection(COLLECTIONS.COURSES).doc(courseId).get() : null,
      db.collection(COLLECTIONS.ATTENDANCE).where("sessionId", "==", sessionId).get(),
    ]);

    const classData =
      classSnap && classSnap.exists ? classSnap.data() || {} : {};
    const courseData =
      courseSnap && courseSnap.exists ? courseSnap.data() || {} : {};

    const classStudents = getClassStudentEntries(classData);
    const studentIds = [
      ...new Set(classStudents.map((entry) => trimText(entry.studentId)).filter(Boolean)),
    ];

    const [studentDocs, userDocs] = await Promise.all([
      Promise.all(
        studentIds.map(async (studentId) => {
          const snap = await db.collection(COLLECTIONS.STUDENTS).doc(studentId).get();
          return [studentId, snap.exists ? snap.data() || {} : {}];
        })
      ),
      Promise.all(
        studentIds.map(async (studentId) => {
          const snap = await db.collection(COLLECTIONS.USERS).doc(studentId).get();
          return [studentId, snap.exists ? snap.data() || {} : {}];
        })
      ),
    ]);

    const studentById = Object.fromEntries(studentDocs);
    const userById = Object.fromEntries(userDocs);

    const attendanceRows = attendanceSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() || {}),
    }));

    const attendanceByStudent = {};
    attendanceRows.forEach((row) => {
      const studentId = trimText(row.studentId);
      if (!studentId) return;
      attendanceByStudent[studentId] = row;
    });

    const students = classStudents.map((entry) => {
      const studentId = trimText(entry.studentId);
      const studentData = studentById[studentId] || {};
      const userData = userById[studentId] || {};
      const attendanceRow = attendanceByStudent[studentId];
      return {
        studentId,
        fullName: resolveStudentName(studentData, userData),
        email: trimText(userData.email),
        status: attendanceRow
          ? lowerText(attendanceRow.status) || "not_marked"
          : "not_marked",
        markedAt: attendanceRow ? toIso(attendanceRow.markedAt) : null,
      };
    });

    const presentCount = students.filter((row) => row.status === "present").length;
    const absentCount = students.filter((row) => row.status === "absent").length;
    const lateCount = students.filter((row) => row.status === "late").length;
    const notMarkedCount = students.filter(
      (row) => row.status === "not_marked"
    ).length;

    const payload = {
      ...serializeTeacherSession(
        sessionId,
        sessionData,
        { [classId]: classData },
        { [courseId]: courseData },
        { [sessionId]: presentCount + lateCount }
      ),
      class: {
        id: classId,
        name: trimText(classData.name) || "Class",
        batchCode: trimText(classData.batchCode),
        enrolledCount: toPositiveNumber(classData.enrolledCount, students.length),
      },
      course: {
        id: courseId,
        title: trimText(courseData.title) || trimText(sessionData.courseName) || "Course",
      },
      students,
      attendance: attendanceRows.map((row) => ({
        id: row.id,
        sessionId: trimText(row.sessionId),
        classId: trimText(row.classId),
        studentId: trimText(row.studentId),
        status: lowerText(row.status),
        markedBy: trimText(row.markedBy),
        markedAt: toIso(row.markedAt),
      })),
      totalStudents: students.length,
      presentCount,
      absentCount,
      lateCount,
      notMarkedCount,
    };

    return successResponse(res, payload, "Session fetched");
  } catch (error) {
    console.error("getSessionById error:", error);
    return errorResponse(res, "Failed to fetch session", 500);
  }
};

export const createSession = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);

    const classId = trimText(req.body?.classId);
    const courseId = trimText(req.body?.courseId);
    const topic = trimText(req.body?.topic);
    const description = trimText(req.body?.description);
    const date = formatSessionDate(req.body?.date);
    const startTime = normalizeSessionTime(req.body?.startTime);
    const endTime = normalizeSessionTime(req.body?.endTime);
    const platform = trimText(req.body?.platform);
    const meetingLink = trimText(req.body?.meetingLink);
    const notifyStudents = req.body?.notifyStudents !== false;

    if (!classId) return errorResponse(res, "classId is required", 400);
    if (topic.length < 5) {
      return errorResponse(res, "topic must be at least 5 characters", 400);
    }
    if (!date) return errorResponse(res, "date is required", 400);
    if (!isTodayOrFutureSessionDate(date)) {
      return errorResponse(res, "date must be today or future", 400);
    }
    if (!startTime) return errorResponse(res, "startTime is required", 400);
    if (!endTime) return errorResponse(res, "endTime is required", 400);
    const duration = calculateSessionDurationMinutes(startTime, endTime);
    if (!duration) {
      return errorResponse(res, "endTime must be after startTime", 400);
    }
    if (!platform) return errorResponse(res, "platform is required", 400);
    if (!meetingLink || !isValidSessionUrl(meetingLink)) {
      return errorResponse(res, "meetingLink must be a valid URL", 400);
    }

    const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
    if (!classSnap.exists) return errorResponse(res, "Class not found", 404);
    const classData = classSnap.data() || {};
    if (!isTeacherAssignedToClass(classData, uid)) {
      return errorResponse(res, "You are not assigned to this class", 403);
    }

    // Class-level conflicts: same class, same date, overlapping time
    const existingClassSessionsSnap = await db
      .collection(COLLECTIONS.SESSIONS)
      .where("classId", "==", classId)
      .where("date", "==", date)
      .where("status", "not-in", ["cancelled", "completed"])
      .get();

    for (const doc of existingClassSessionsSnap.docs) {
      const existing = doc.data() || {};
      if (
        isSessionTimeOverlapping(
          startTime,
          endTime,
          normalizeSessionTime(existing.startTime),
          normalizeSessionTime(existing.endTime)
        )
      ) {
        return errorResponse(
          res,
          `Schedule conflict! Another session "${trimText(existing.topic) || "Session"}" is scheduled from ${normalizeSessionTime(existing.startTime)} to ${normalizeSessionTime(existing.endTime)} for this class on ${date}.`,
          409,
          {
            code: "SESSION_CONFLICT",
            conflictingSession: {
              id: doc.id,
              topic: trimText(existing.topic) || "Session",
              startTime: normalizeSessionTime(existing.startTime),
              endTime: normalizeSessionTime(existing.endTime),
            },
          }
        );
      }
    }

    // Teacher-level conflicts: same teacher, same date, overlapping time
    const teacherConflictSnap = await db
      .collection(COLLECTIONS.SESSIONS)
      .where("teacherId", "==", uid)
      .where("date", "==", date)
      .where("status", "not-in", ["cancelled", "completed"])
      .get();

    for (const doc of teacherConflictSnap.docs) {
      const existing = doc.data() || {};
      if (
        isSessionTimeOverlapping(
          startTime,
          endTime,
          normalizeSessionTime(existing.startTime),
          normalizeSessionTime(existing.endTime)
        )
      ) {
        return errorResponse(
          res,
          `You already have a session "${trimText(existing.topic) || "Session"}" at this time for class "${trimText(existing.className) || "Class"}".`,
          409,
          { code: "TEACHER_CONFLICT" }
        );
      }
    }

    let courseName = "";
    let courseData = {};
    if (courseId) {
      const courseSnap = await db.collection(COLLECTIONS.COURSES).doc(courseId).get();
      if (!courseSnap.exists) return errorResponse(res, "Course not found", 404);
      courseData = courseSnap.data() || {};
      courseName = trimText(courseData.title);
    }

    const teacherName = await getTeacherDisplayName(uid, req.user?.email || "");
    const classStudents = getClassStudentEntries(classData);
    const studentsCount = Math.max(
      toPositiveNumber(classData.enrolledCount, 0),
      classStudents.length
    );

    const payload = {
      classId,
      teacherId: uid,
      teacherName,
      courseId,
      courseName,
      topic,
      description: description || "",
      date,
      startTime,
      endTime,
      duration,
      platform,
      meetingLink,
      status: "upcoming",
      sessionStartedAt: null,
      notifyStudents,
      attendanceCount: 0,
      studentsCount,
      cancelReason: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const sessionRef = await db.collection(COLLECTIONS.SESSIONS).add(payload);

    let studentsNotified = 0;
    if (notifyStudents) {
      const recipients = await getSessionNotificationRecipients(classData);
      studentsNotified = await sendScheduledSessionEmails(recipients, {
        topic,
        date,
        startTime,
        endTime,
        platform,
        meetingLink,
      });
    }

    const createdSnap = await sessionRef.get();
    const createdData = createdSnap.data() || payload;
    const created = serializeTeacherSession(
      sessionRef.id,
      createdData,
      { [classId]: classData },
      courseId ? { [courseId]: courseData } : {},
      { [sessionRef.id]: 0 }
    );

    return successResponse(
      res,
      {
        ...created,
        studentsNotified,
      },
      "Session created",
      201
    );
  } catch (error) {
    console.error("createSession error:", error);
    return errorResponse(res, "Failed to create session", 500);
  }
};

export const updateSession = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const sessionId = trimText(req.params?.sessionId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!sessionId) return errorResponse(res, "sessionId is required", 400);

    const owned = await getTeacherOwnedSession(sessionId, uid);
    if (owned.error) return errorResponse(res, owned.error, owned.status);

    const current = owned.sessionData || {};
    const currentStatus = computeTeacherSessionStatus(current);
    if (currentStatus === "completed" || lowerText(current.status) === "completed") {
      return errorResponse(res, "Cannot edit a completed session", 400);
    }
    if (currentStatus === "cancelled" || lowerText(current.status) === "cancelled") {
      return errorResponse(res, "Cannot edit a cancelled session", 400);
    }

    const updates = {};
    const hasField = (key) => Object.prototype.hasOwnProperty.call(req.body || {}, key);

    if (hasField("topic")) {
      const topic = trimText(req.body.topic);
      if (topic.length < 5) {
        return errorResponse(res, "topic must be at least 5 characters", 400);
      }
      updates.topic = topic;
    }
    if (hasField("description")) {
      updates.description = trimText(req.body.description);
    }
    if (hasField("date")) {
      const date = formatSessionDate(req.body.date);
      if (!date) return errorResponse(res, "date is required", 400);
      if (!isTodayOrFutureSessionDate(date)) {
        return errorResponse(res, "date must be today or future", 400);
      }
      updates.date = date;
    }
    if (hasField("startTime")) {
      const startTime = normalizeSessionTime(req.body.startTime);
      if (!startTime) return errorResponse(res, "startTime is required", 400);
      updates.startTime = startTime;
    }
    if (hasField("endTime")) {
      const endTime = normalizeSessionTime(req.body.endTime);
      if (!endTime) return errorResponse(res, "endTime is required", 400);
      updates.endTime = endTime;
    }
    if (hasField("platform")) {
      const platform = trimText(req.body.platform);
      if (!platform) return errorResponse(res, "platform is required", 400);
      updates.platform = platform;
    }
    if (hasField("meetingLink")) {
      const meetingLink = trimText(req.body.meetingLink);
      if (!meetingLink || !isValidSessionUrl(meetingLink)) {
        return errorResponse(res, "meetingLink must be a valid URL", 400);
      }
      updates.meetingLink = meetingLink;
    }

    if (!Object.keys(updates).length) {
      return errorResponse(res, "No editable fields provided", 400);
    }

    const merged = { ...current, ...updates };
    const duration = calculateSessionDurationMinutes(merged.startTime, merged.endTime);
    if (!duration) {
      return errorResponse(res, "endTime must be after startTime", 400);
    }

    updates.duration = duration;
    updates.status = computeTeacherSessionStatus({
      ...merged,
      status: "upcoming",
      completedAt: null,
      cancelledAt: null,
    });
    updates.updatedAt = serverTimestamp();

    await owned.sessionRef.update(updates);
    const updatedSnap = await owned.sessionRef.get();
    const updatedData = updatedSnap.data() || {};

    const classId = trimText(updatedData.classId);
    const courseId = trimText(updatedData.courseId);
    const [classSnap, courseSnap] = await Promise.all([
      classId ? db.collection(COLLECTIONS.CLASSES).doc(classId).get() : null,
      courseId ? db.collection(COLLECTIONS.COURSES).doc(courseId).get() : null,
    ]);

    const payload = serializeTeacherSession(
      sessionId,
      updatedData,
      {
        [classId]:
          classSnap && classSnap.exists ? classSnap.data() || {} : {},
      },
      {
        [courseId]:
          courseSnap && courseSnap.exists ? courseSnap.data() || {} : {},
      },
      {}
    );

    return successResponse(res, payload, "Session updated");
  } catch (error) {
    console.error("updateSession error:", error);
    return errorResponse(res, "Failed to update session", 500);
  }
};

export const cancelSession = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const sessionId = trimText(req.params?.sessionId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!sessionId) return errorResponse(res, "sessionId is required", 400);

    const cancelReason = trimText(req.body?.cancelReason);
    const notifyStudents = req.body?.notifyStudents !== false;
    if (cancelReason.length < 10) {
      return errorResponse(res, "cancelReason must be at least 10 characters", 400);
    }

    const owned = await getTeacherOwnedSession(sessionId, uid);
    if (owned.error) return errorResponse(res, owned.error, owned.status);
    const status = lowerText(owned.sessionData.status);
    if (status === "cancelled") return errorResponse(res, "Already cancelled", 400);
    if (status === "completed") {
      return errorResponse(res, "Cannot cancel completed session", 400);
    }

    await owned.sessionRef.update({
      status: "cancelled",
      cancelReason,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    let studentsNotified = 0;
    const classId = trimText(owned.sessionData.classId);
    if (notifyStudents && classId) {
      const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
      if (classSnap.exists) {
        const classData = classSnap.data() || {};
        const recipients = await getSessionNotificationRecipients(classData);
        studentsNotified = await sendCancelledSessionEmails(recipients, {
          topic: trimText(owned.sessionData.topic),
          date: formatSessionDate(owned.sessionData.date),
          startTime: normalizeSessionTime(owned.sessionData.startTime),
          endTime: normalizeSessionTime(owned.sessionData.endTime),
          cancelReason,
        });
      }
    }

    return successResponse(
      res,
      { sessionId, studentsNotified },
      "Session cancelled"
    );
  } catch (error) {
    console.error("cancelSession error:", error);
    return errorResponse(res, "Failed to cancel session", 500);
  }
};

export const markSessionComplete = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const sessionId = trimText(req.params?.sessionId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!sessionId) return errorResponse(res, "sessionId is required", 400);

    const owned = await getTeacherOwnedSession(sessionId, uid);
    if (owned.error) return errorResponse(res, owned.error, owned.status);

    if (lowerText(owned.sessionData.status) === "cancelled") {
      return errorResponse(res, "Cannot complete a cancelled session", 400);
    }

    await owned.sessionRef.update({
      status: "completed",
      completedAt: serverTimestamp(),
      sessionNotes: trimText(req.body?.notes),
      updatedAt: serverTimestamp(),
    });

    return successResponse(
      res,
      { sessionId },
      "Session marked as complete"
    );
  } catch (error) {
    console.error("markSessionComplete error:", error);
    return errorResponse(res, "Failed to complete session", 500);
  }
};

export const unlockSession = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = lowerText(req.user?.role);
    const sessionId = trimText(req.params?.sessionId);
    if (!uid) return errorResponse(res, "Missing user uid", 400);
    if (!sessionId) return errorResponse(res, "sessionId is required", 400);

    const sessionRef = db.collection(COLLECTIONS.SESSIONS).doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) return errorResponse(res, "Session not found", 404);

    const sessionData = sessionSnap.data() || {};
    if (role !== "admin" && trimText(sessionData.teacherId) !== uid) {
      return errorResponse(res, "Forbidden", 403);
    }

    await sessionRef.set(
      {
        isLocked: false,
        sessionLocked: false,
        unlockedBy: uid,
        unlockedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return successResponse(res, { sessionId }, "Session unlocked");
  } catch (error) {
    console.error("unlockSession error:", error);
    return errorResponse(res, "Failed to unlock session", 500);
  }
};

export const getSessionAttendance = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const sessionId = trimText(req.params?.sessionId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!sessionId) return errorResponse(res, "sessionId is required", 400);

    const owned = await getTeacherOwnedSession(sessionId, uid);
    if (owned.error) return errorResponse(res, owned.error, owned.status);

    const sessionData = owned.sessionData || {};
    const classId = trimText(sessionData.classId);
    if (!classId) return errorResponse(res, "Session class is missing", 400);

    const [classSnap, attendanceSnap] = await Promise.all([
      db.collection(COLLECTIONS.CLASSES).doc(classId).get(),
      db.collection(COLLECTIONS.ATTENDANCE).where("sessionId", "==", sessionId).get(),
    ]);

    if (!classSnap.exists) return errorResponse(res, "Class not found", 404);
    const classData = classSnap.data() || {};
    if (!isTeacherAssignedToClass(classData, uid)) {
      return errorResponse(
        res,
        "You are not assigned to this class attendance",
        403
      );
    }
    const sessionCourseId = trimText(sessionData.courseId);
    const sessionSubjectId = trimText(sessionData.subjectId);
    if (sessionCourseId) {
      const assigned = await getTeacherAssignedCourses(uid);
      const teacherCourseIds = new Set(
        (assigned.courseIds || []).map((id) => trimText(id)).filter(Boolean)
      );
      if (!teacherCourseIds.has(sessionCourseId)) {
        return errorResponse(
          res,
          "You are not assigned to this course attendance",
          403
        );
      }
      if (sessionSubjectId) {
        const subjectSet = assigned.subjectIdsByCourseId?.[sessionCourseId];
        if (subjectSet && subjectSet.size && !subjectSet.has(sessionSubjectId)) {
          return errorResponse(
            res,
            "You are not assigned to this subject attendance",
            403
          );
        }
      }
    }
    const classStudents = getClassStudentEntries(classData);
    const studentIds = [
      ...new Set(classStudents.map((entry) => trimText(entry.studentId)).filter(Boolean)),
    ];

    const [studentDocs, userDocs] = await Promise.all([
      Promise.all(
        studentIds.map(async (studentId) => {
          const snap = await db.collection(COLLECTIONS.STUDENTS).doc(studentId).get();
          return [studentId, snap.exists ? snap.data() || {} : {}];
        })
      ),
      Promise.all(
        studentIds.map(async (studentId) => {
          const snap = await db.collection(COLLECTIONS.USERS).doc(studentId).get();
          return [studentId, snap.exists ? snap.data() || {} : {}];
        })
      ),
    ]);

    const studentById = Object.fromEntries(studentDocs);
    const userById = Object.fromEntries(userDocs);
    const attendanceByStudent = {};
    attendanceSnap.docs.forEach((doc) => {
      const row = doc.data() || {};
      const studentId = trimText(row.studentId);
      if (!studentId) return;
      attendanceByStudent[studentId] = row;
    });

    const students = studentIds
      .map((studentId) => {
        const studentData = studentById[studentId] || {};
        const userData = userById[studentId] || {};
        const attendanceRow = attendanceByStudent[studentId] || null;
        const status = attendanceRow
          ? lowerText(attendanceRow.status) || "not_marked"
          : "not_marked";
        return {
          studentId,
          fullName: resolveStudentName(studentData, userData),
          email: trimText(userData.email),
          status: SESSION_ATTENDANCE_STATUSES.has(status) ? status : "not_marked",
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const presentCount = students.filter((row) => row.status === "present").length;
    const absentCount = students.filter((row) => row.status === "absent").length;
    const lateCount = students.filter((row) => row.status === "late").length;

    return successResponse(
      res,
      {
        sessionId,
        sessionTopic: trimText(sessionData.topic) || "Session",
        date: formatSessionDate(sessionData.date),
        totalStudents: students.length,
        presentCount,
        absentCount,
        lateCount,
        students,
      },
      "Session attendance fetched"
    );
  } catch (error) {
    console.error("getSessionAttendance error:", error);
    return errorResponse(res, "Failed to fetch session attendance", 500);
  }
};

export const saveSessionAttendance = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const sessionId = trimText(req.params?.sessionId);
    const attendanceRows = Array.isArray(req.body?.attendance) ? req.body.attendance : [];

    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!sessionId) return errorResponse(res, "sessionId is required", 400);
    if (!attendanceRows.length) {
      return errorResponse(res, "attendance is required", 400);
    }

    const owned = await getTeacherOwnedSession(sessionId, uid);
    if (owned.error) return errorResponse(res, owned.error, owned.status);
    const sessionData = owned.sessionData || {};
    const classId = trimText(sessionData.classId);
    if (!classId) return errorResponse(res, "Session class is missing", 400);

    const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
    if (!classSnap.exists) return errorResponse(res, "Class not found", 404);
    const classData = classSnap.data() || {};
    if (!isTeacherAssignedToClass(classData, uid)) {
      return errorResponse(
        res,
        "You are not assigned to this class attendance",
        403
      );
    }
    const sessionCourseId = trimText(sessionData.courseId);
    const sessionSubjectId = trimText(sessionData.subjectId);
    if (sessionCourseId) {
      const assigned = await getTeacherAssignedCourses(uid);
      const teacherCourseIds = new Set(
        (assigned.courseIds || []).map((id) => trimText(id)).filter(Boolean)
      );
      if (!teacherCourseIds.has(sessionCourseId)) {
        return errorResponse(
          res,
          "You are not assigned to this course attendance",
          403
        );
      }
      if (sessionSubjectId) {
        const subjectSet = assigned.subjectIdsByCourseId?.[sessionCourseId];
        if (subjectSet && subjectSet.size && !subjectSet.has(sessionSubjectId)) {
          return errorResponse(
            res,
            "You are not assigned to this subject attendance",
            403
          );
        }
      }
    }

    const allowedStudentIds = new Set(
      getClassStudentEntries(classData)
        .map((entry) => trimText(entry.studentId))
        .filter(Boolean)
    );
    if (!allowedStudentIds.size) {
      return errorResponse(res, "Class has no enrolled students", 400);
    }

    const normalizedRowsMap = {};
    for (const row of attendanceRows) {
      const studentId = trimText(row?.studentId);
      const status = lowerText(row?.status);
      if (!studentId) return errorResponse(res, "studentId is required", 400);
      if (!allowedStudentIds.has(studentId)) {
        return errorResponse(res, "Attendance contains student not in class", 400);
      }
      if (!SESSION_ATTENDANCE_STATUSES.has(status)) {
        return errorResponse(res, "status must be present, absent, or late", 400);
      }
      normalizedRowsMap[studentId] = status;
    }

    const batch = db.batch();
    Object.entries(normalizedRowsMap).forEach(([studentId, status]) => {
      const docId = `${sessionId}_${studentId}`;
      const ref = db.collection(COLLECTIONS.ATTENDANCE).doc(docId);
      batch.set(
        ref,
        {
          sessionId,
          classId,
          studentId,
          status,
          markedBy: uid,
          markedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();

    const latestAttendanceSnap = await db
      .collection(COLLECTIONS.ATTENDANCE)
      .where("sessionId", "==", sessionId)
      .get();

    const latestRows = latestAttendanceSnap.docs.map((doc) => doc.data() || {});
    const presentCount = latestRows.filter(
      (row) => lowerText(row.status) === "present"
    ).length;
    const absentCount = latestRows.filter(
      (row) => lowerText(row.status) === "absent"
    ).length;
    const lateCount = latestRows.filter((row) => lowerText(row.status) === "late").length;
    const attendanceCount = presentCount + lateCount;

    await owned.sessionRef.update({
      attendanceCount,
      updatedAt: serverTimestamp(),
    });

    return successResponse(
      res,
      {
        sessionId,
        classId,
        presentCount,
        absentCount,
        lateCount,
        attendanceCount,
      },
      "Attendance saved"
    );
  } catch (error) {
    console.error("saveSessionAttendance error:", error);
    return errorResponse(res, "Failed to save attendance", 500);
  }
};

export const getTeacherClasses = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = lowerText(req.user?.role);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);

    const classDocs =
      role === "admin"
        ? (
            await db.collection(COLLECTIONS.CLASSES).get()
          ).docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }))
        : await getTeacherAssignedClassDocs(uid);
    const payload = classDocs
      .map((row) => {
        const data = row.data || {};
        const students = getClassStudentEntries(data);
        const shifts = Array.isArray(data.shifts) ? data.shifts : [];
        const classAssignedTeacher = trimText(data.teacherId);
        const teacherShifts = shifts
          .filter((shift) => {
            if (role === "admin") return true;
            const shiftTeacherId = trimText(shift?.teacherId);
            if (shiftTeacherId) return shiftTeacherId === uid;
            return classAssignedTeacher === uid || isTeacherListedInClassTeachers(data, uid);
          })
          .map((shift) => ({
            id: trimText(shift?.id),
            name: trimText(shift?.name) || "Shift",
            courseId: trimText(shift?.courseId),
            courseName: trimText(shift?.courseName),
            teacherId: trimText(shift?.teacherId),
            startTime: trimText(shift?.startTime),
            endTime: trimText(shift?.endTime),
            days: Array.isArray(shift?.days) ? shift.days : [],
          }));

        return {
          id: row.id,
          name: trimText(data.name) || "Class",
          batchCode: trimText(data.batchCode),
          enrolledCount: Math.max(
            toPositiveNumber(data.enrolledCount, 0),
            students.length
          ),
          studentsCount: Math.max(
            toPositiveNumber(data.enrolledCount, 0),
            students.length
          ),
          assignedCourses: Array.isArray(data.assignedCourses)
            ? data.assignedCourses
            : [],
          startDate: toIso(data.startDate),
          endDate: toIso(data.endDate),
          shifts: teacherShifts,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return successResponse(res, payload, "Teacher classes fetched");
  } catch (error) {
    console.error("getTeacherClasses error:", error);
    return errorResponse(res, "Failed to fetch teacher classes", 500);
  }
};

export const reopenTeacherClass = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = lowerText(req.user?.role);
    const classId = trimText(req.params?.classId || req.params?.id);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!classId) return errorResponse(res, "classId is required", 400);

    const classRef = db.collection(COLLECTIONS.CLASSES).doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists) return errorResponse(res, "Class not found", 404);

    const classData = classSnap.data() || {};
    if (role !== "admin" && !isTeacherAssignedToClass(classData, uid)) {
      return errorResponse(res, "You are not assigned to this class", 403);
    }

    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const endDate = toDate(classData.endDate);
    const endInPast = endDate ? endDate.getTime() < today.getTime() : true;
    const nextEnd = new Date(today);
    nextEnd.setDate(nextEnd.getDate() + 30);
    const nextEndKey = nextEnd.toISOString().slice(0, 10);

    const updates = {
      status: "active",
      startDate: classData.startDate || todayKey,
      endDate: endInPast ? nextEndKey : classData.endDate || nextEndKey,
      reopenedAt: admin.firestore.FieldValue.serverTimestamp(),
      reopenedBy: uid,
      reopenedByRole: role || "teacher",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await classRef.set(updates, { merge: true });

    return successResponse(
      res,
      {
        classId,
        status: updates.status,
        startDate: updates.startDate,
        endDate: updates.endDate,
      },
      "Class reopened successfully"
    );
  } catch (error) {
    console.error("reopenTeacherClass error:", error);
    return errorResponse(res, "Failed to reopen class", 500);
  }
};

export const getTeacherTimetable = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = lowerText(req.user?.role);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);

    const classDocs =
      role === "admin"
        ? (
            await db.collection(COLLECTIONS.CLASSES).get()
          ).docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }))
        : await getTeacherAssignedClassDocs(uid);

    const classRows = [];
    const timetable = [];
    classDocs.forEach((row) => {
      const classData = row.data || {};
      const classId = trimText(row.id);
      const className = trimText(classData.name) || "Class";
      const batchCode = trimText(classData.batchCode);
      const startDate = toIso(classData.startDate);
      const endDate = toIso(classData.endDate);
      const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
      const classAssignedTeacher = trimText(classData.teacherId);

      const filteredShifts = shifts.filter((shift) => {
        if (role === "admin") return true;
        const shiftTeacherId = trimText(shift?.teacherId);
        if (shiftTeacherId) return shiftTeacherId === uid;
        return classAssignedTeacher === uid || isTeacherListedInClassTeachers(classData, uid);
      });

      classRows.push({
        classId,
        className,
        batchCode,
        startDate,
        endDate,
      });

      filteredShifts.forEach((shift) => {
        const days = Array.isArray(shift?.days) ? shift.days : [];
        const dayLabels = days.map((day) => trimText(day)).filter(Boolean);
        const sortedDays = dayLabels.sort((a, b) => {
          const aIndex = DAY_INDEX[lowerText(a)];
          const bIndex = DAY_INDEX[lowerText(b)];
          if (!Number.isInteger(aIndex) || !Number.isInteger(bIndex)) {
            return a.localeCompare(b);
          }
          return aIndex - bIndex;
        });

        timetable.push({
          id: `${classId}_${trimText(shift?.id) || uuidv4()}`,
          classId,
          className,
          batchCode,
          shiftId: trimText(shift?.id),
          shiftName: trimText(shift?.name) || "Shift",
          courseId: trimText(shift?.courseId),
          courseName: trimText(shift?.courseName) || "Course",
          teacherId: trimText(shift?.teacherId) || classAssignedTeacher,
          startTime: trimText(shift?.startTime),
          endTime: trimText(shift?.endTime),
          days: sortedDays,
          startDate,
          endDate,
        });
      });
    });

    timetable.sort((a, b) => {
      const dayA = Array.isArray(a.days) && a.days.length
        ? DAY_INDEX[lowerText(a.days[0])]
        : 99;
      const dayB = Array.isArray(b.days) && b.days.length
        ? DAY_INDEX[lowerText(b.days[0])]
        : 99;
      if (dayA !== dayB) return dayA - dayB;
      return String(a.startTime || "").localeCompare(String(b.startTime || ""));
    });

    return successResponse(
      res,
      {
        classes: classRows.sort((a, b) => a.className.localeCompare(b.className)),
        timetable,
      },
      "Teacher timetable fetched"
    );
  } catch (error) {
    console.error("getTeacherTimetable error:", error);
    return errorResponse(res, "Failed to fetch teacher timetable", 500);
  }
};

const sanitizeTeacherProfilePayload = (uid, userData = {}, teacherData = {}) => {
  const email = trimText(userData.email);
  const fullName =
    trimText(teacherData.fullName) ||
    trimText(teacherData.name) ||
    trimText(userData.fullName) ||
    trimText(userData.name) ||
    trimText(userData.displayName) ||
    getNameFromEmail(email) ||
    "Teacher";

  return {
    uid,
    email,
    fullName,
    phoneNumber:
      normalizePakistanPhone(
        trimText(teacherData.phoneNumber || teacherData.phone || userData.phoneNumber)
      ) ||
      trimText(teacherData.phoneNumber || teacherData.phone || userData.phoneNumber),
    subject: trimText(teacherData.subject),
    bio: trimText(teacherData.bio),
    profilePicture: trimText(teacherData.profilePicture),
    createdAt: toIso(teacherData.createdAt) || toIso(userData.createdAt),
    updatedAt: toIso(teacherData.updatedAt) || toIso(userData.updatedAt),
  };
};

const getTeacherActiveSessions = async (uid) => {
  try {
    const snap = await db
      .collection(COLLECTIONS.SESSIONS)
      .where("uid", "==", uid)
      .where("active", "==", true)
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
  } catch {
    const snap = await db
      .collection(COLLECTIONS.SESSIONS)
      .where("uid", "==", uid)
      .where("active", "==", true)
      .get();
    return snap.docs
      .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
      .sort(
        (a, b) =>
          (new Date(toIso(b.data.createdAt) || 0).getTime() || 0) -
          (new Date(toIso(a.data.createdAt) || 0).getTime() || 0)
      );
  }
};

const getTeacherAuditLogRows = async (uid, limit = 40) => {
  try {
    const snap = await db
      .collection(COLLECTIONS.AUDIT_LOGS)
      .where("uid", "==", uid)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
  } catch {
    const snap = await db
      .collection(COLLECTIONS.AUDIT_LOGS)
      .where("uid", "==", uid)
      .get();
    return snap.docs
      .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
      .sort(
        (a, b) =>
          (new Date(toIso(b.data.timestamp) || 0).getTime() || 0) -
          (new Date(toIso(a.data.timestamp) || 0).getTime() || 0)
      )
      .slice(0, limit);
  }
};

const resolveCurrentSessionId = (sessionRows = [], userData = {}) => {
  if (!sessionRows.length) return "";
  const assignedDevice = trimText(userData.assignedWebDevice);
  const assignedIp = trimText(userData.assignedWebIp);

  const strictMatch = sessionRows.find((row) => {
    const sessionDevice = trimText(row.data?.device);
    const sessionIp = trimText(row.data?.ip);
    return (
      assignedDevice &&
      assignedIp &&
      sessionDevice === assignedDevice &&
      sessionIp === assignedIp
    );
  });
  if (strictMatch) return strictMatch.id;

  const partialMatch = sessionRows.find((row) => {
    const sessionDevice = trimText(row.data?.device);
    return assignedDevice && sessionDevice === assignedDevice;
  });
  if (partialMatch) return partialMatch.id;

  return sessionRows[0]?.id || "";
};

export const getTeacherSettingsProfile = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);

    const [userSnap, teacherSnap] = await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(uid).get(),
      db.collection(COLLECTIONS.TEACHERS).doc(uid).get(),
    ]);

    if (!userSnap.exists) return errorResponse(res, "User not found", 404);

    const userData = userSnap.data() || {};
    const teacherData = teacherSnap.exists ? teacherSnap.data() || {} : {};
    const payload = sanitizeTeacherProfilePayload(uid, userData, teacherData);

    return successResponse(res, payload, "Teacher profile settings fetched");
  } catch (error) {
    console.error("getTeacherSettingsProfile error:", error);
    return errorResponse(res, "Failed to fetch teacher profile settings", 500);
  }
};

export const updateTeacherSettingsProfile = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);

    const fullName = trimText(req.body?.fullName);
    const phoneNumberRaw = trimText(req.body?.phoneNumber);
    const phoneNumber = phoneNumberRaw ? normalizePakistanPhone(phoneNumberRaw) : "";
    const subject = trimText(req.body?.subject);
    const bio = trimText(req.body?.bio);
    const profilePicture = trimText(req.body?.profilePicture);

    if (fullName.length < 2) {
      return errorResponse(res, "fullName must be at least 2 characters", 400);
    }
    if (subject.length > 120) {
      return errorResponse(res, "subject cannot exceed 120 characters", 400);
    }
    if (bio.length > 500) {
      return errorResponse(res, "bio cannot exceed 500 characters", 400);
    }
    if (phoneNumberRaw && !isPakistanPhone(phoneNumber)) {
      return errorResponse(
        res,
        "phoneNumber must be 03001234567 or +923001234567 format",
        400
      );
    }

    const userRef = db.collection(COLLECTIONS.USERS).doc(uid);
    const teacherRef = db.collection(COLLECTIONS.TEACHERS).doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return errorResponse(res, "User not found", 404);

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
      teacherRef,
      {
        uid,
        fullName,
        name: fullName,
        phoneNumber: phoneNumber || "",
        phone: phoneNumber || "",
        subject: subject || "",
        bio: bio || "",
        profilePicture: profilePicture || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();

    const [updatedUserSnap, updatedTeacherSnap] = await Promise.all([
      userRef.get(),
      teacherRef.get(),
    ]);
    const payload = sanitizeTeacherProfilePayload(
      uid,
      updatedUserSnap.data() || {},
      updatedTeacherSnap.exists ? updatedTeacherSnap.data() || {} : {}
    );

    return successResponse(res, payload, "Teacher profile settings updated");
  } catch (error) {
    console.error("updateTeacherSettingsProfile error:", error);
    return errorResponse(res, "Failed to update teacher profile settings", 500);
  }
};

export const getTeacherSettingsSecurity = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);

    const [userSnap, sessionRows, auditRows] = await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(uid).get(),
      getTeacherActiveSessions(uid),
      getTeacherAuditLogRows(uid),
    ]);

    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const currentSessionId = resolveCurrentSessionId(sessionRows, userData);

    const sessions = sessionRows.map((row) => {
      const data = row.data || {};
      return {
        id: row.id,
        device: trimText(data.device) || "Unknown device",
        ip: trimText(data.ip) || "-",
        deviceType: trimText(data.deviceType) || "web",
        isCurrent: row.id === currentSessionId,
        active: data.active !== false,
        createdAt: toIso(data.createdAt),
        lastActiveAt: toIso(data.lastActiveAt || data.updatedAt || data.createdAt),
      };
    });

    const loginHistory = auditRows
      .map((row) => {
        const data = row.data || {};
        const action = lowerText(data.action);
        let status = "info";
        if (action === "login_success") status = "success";
        if (action === "blocked_login") status = "blocked";
        if (action === "logout") status = "logout";

        return {
          id: row.id,
          action: action || "activity",
          status,
          ip: trimText(data.ip || data.attemptIP || data.assignedIP),
          device: trimText(data.device || data.attemptDevice || data.assignedDevice),
          reason: trimText(data.reason),
          timestamp: toIso(data.timestamp || data.createdAt),
        };
      })
      .filter((row) => Boolean(row.timestamp))
      .sort(
        (a, b) =>
          (new Date(b.timestamp || 0).getTime() || 0) -
          (new Date(a.timestamp || 0).getTime() || 0)
      );

    const blockedAttempts = loginHistory.filter(
      (row) => row.status === "blocked"
    ).length;

    return successResponse(
      res,
      {
        currentSessionId,
        sessions,
        loginHistory,
        totalActiveSessions: sessions.length,
        blockedAttempts,
        lastLoginAt: toIso(userData.lastLoginAt),
      },
      "Teacher security settings fetched"
    );
  } catch (error) {
    console.error("getTeacherSettingsSecurity error:", error);
    return errorResponse(res, "Failed to fetch teacher security settings", 500);
  }
};

export const revokeTeacherSession = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const sessionDocId = trimText(req.params?.sessionDocId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!sessionDocId) return errorResponse(res, "sessionDocId is required", 400);

    const sessionRef = db.collection(COLLECTIONS.SESSIONS).doc(sessionDocId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) return errorResponse(res, "Session not found", 404);

    const sessionData = sessionSnap.data() || {};
    if (trimText(sessionData.uid) !== uid) return errorResponse(res, "Forbidden", 403);
    if (sessionData.active === false) {
      return errorResponse(res, "Session is already revoked", 400);
    }

    await sessionRef.update({
      active: false,
      revokedAt: serverTimestamp(),
      revokedBy: uid,
      updatedAt: serverTimestamp(),
    });

    return successResponse(
      res,
      { sessionDocId },
      "Session revoked successfully"
    );
  } catch (error) {
    console.error("revokeTeacherSession error:", error);
    return errorResponse(res, "Failed to revoke session", 500);
  }
};

export const revokeTeacherOtherSessions = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);

    const [userSnap, sessionRows] = await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(uid).get(),
      getTeacherActiveSessions(uid),
    ]);

    if (!sessionRows.length) {
      return successResponse(res, { revokedCount: 0 }, "No active sessions found");
    }

    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const currentSessionId = resolveCurrentSessionId(sessionRows, userData);

    const rowsToRevoke = sessionRows.filter((row) => row.id !== currentSessionId);
    if (!rowsToRevoke.length) {
      return successResponse(
        res,
        { revokedCount: 0, currentSessionId },
        "No other active sessions found"
      );
    }

    const batch = db.batch();
    rowsToRevoke.forEach((row) => {
      batch.update(db.collection(COLLECTIONS.SESSIONS).doc(row.id), {
        active: false,
        revokedAt: serverTimestamp(),
        revokedBy: uid,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();

    return successResponse(
      res,
      { revokedCount: rowsToRevoke.length, currentSessionId },
      "Other sessions revoked successfully"
    );
  } catch (error) {
    console.error("revokeTeacherOtherSessions error:", error);
    return errorResponse(res, "Failed to revoke sessions", 500);
  }
};
