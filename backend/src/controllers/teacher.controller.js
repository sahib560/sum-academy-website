import { db, admin } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";
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

const toIso = (value) => {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : null;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

const normalizeTeacherCourseIds = (courses = [], teacherId = "") => {
  return courses
    .filter((course) => {
      const data = course.data || {};
      const legacyTeacherMatch = String(data.teacherId || "") === teacherId;
      const subjects = Array.isArray(data.subjects) ? data.subjects : [];
      const subjectMatch = subjects.some(
        (subject) => String(subject?.teacherId || "") === teacherId
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

    const [coursesSnap, classesSnap, enrollmentsSnap, quizResultsSnap] =
      await Promise.all([
        db.collection(COLLECTIONS.COURSES).get(),
        db.collection(COLLECTIONS.CLASSES).get(),
        db.collection(COLLECTIONS.ENROLLMENTS).get(),
        db.collection(COLLECTIONS.QUIZ_RESULTS).get(),
      ]);

    const allCourses = coursesSnap.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() || {},
    }));

    const teacherCourseIds = new Set(
      normalizeTeacherCourseIds(allCourses, teacherId)
    );

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

    const teacherClassDocs = classesSnap.docs
      .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
      .filter((row) => isTeacherAssignedToClass(row.data, teacherId));
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
          title: data.title || "Untitled Course",
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
        const courseName =
          courseMetaById[String(row.courseId || "")]?.title || "Course";

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
  "videoDuration",
  "pdfNotes",
  "books",
  "isPublished",
]);

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

const trimText = (value = "") => String(value || "").trim();

const lowerText = (value = "") => trimText(value).toLowerCase();

const toPositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const ACTIVE_ENROLLMENT_STATUSES = new Set([
  "active",
  "completed",
  "pending_review",
  "",
]);

const getClassShiftCourseMap = (classData = {}) => {
  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  return shifts.reduce((acc, shift) => {
    const shiftId = trimText(shift?.id);
    const courseId = trimText(shift?.courseId);
    if (shiftId && courseId) acc[shiftId] = courseId;
    return acc;
  }, {});
};

const getClassAssignedCourseIds = (classData = {}) => {
  const ids = [];
  const directCourseId = trimText(classData.courseId);
  if (directCourseId) ids.push(directCourseId);

  const assignedCourses = Array.isArray(classData.assignedCourses)
    ? classData.assignedCourses
    : [];
  assignedCourses.forEach((entry) => {
    const courseId =
      typeof entry === "string"
        ? trimText(entry)
        : trimText(entry?.courseId || entry?.id);
    if (courseId) ids.push(courseId);
  });

  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  shifts.forEach((shift) => {
    const courseId = trimText(shift?.courseId);
    if (courseId) ids.push(courseId);
  });

  return [...new Set(ids)];
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
          status: "active",
          progress: 0,
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
    const courseId = trimText(row.courseId);
    if (!courseId) return acc;
    acc[courseId] = (acc[courseId] || 0) + 1;
    return acc;
  }, {});
};

const serializeCourse = (id, data = {}) => {
  const subjects = Array.isArray(data.subjects) ? data.subjects : [];
  return {
    id,
    title: data.title || "",
    description: data.description || "",
    shortDescription: data.shortDescription || "",
    category: data.category || "",
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

const serializeLecture = (id, data = {}) => ({
  id,
  chapterId: data.chapterId || "",
  courseId: data.courseId || "",
  subjectId: data.subjectId || "",
  title: data.title || "",
  order: toPositiveNumber(data.order, 1),
  videoUrl: data.videoUrl || null,
  videoTitle: data.videoTitle || null,
  videoDuration:
    data.videoDuration === null || data.videoDuration === undefined
      ? null
      : data.videoDuration,
  pdfNotes: Array.isArray(data.pdfNotes) ? data.pdfNotes : [],
  books: Array.isArray(data.books) ? data.books : [],
  isPublished: Boolean(data.isPublished),
  createdAt: toIso(data.createdAt),
  updatedAt: toIso(data.updatedAt),
});

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
  const subjects = Array.isArray(courseData.subjects) ? courseData.subjects : [];
  return subjects.some((subject) => String(subject?.teacherId || "") === uid);
};

const getCourseIfOwned = async (courseId, uid) => {
  const courseRef = db.collection(COLLECTIONS.COURSES).doc(courseId);
  const courseSnap = await courseRef.get();
  if (!courseSnap.exists) {
    return { error: "Course not found", status: 404 };
  }

  const courseData = courseSnap.data() || {};
  if (!isCourseOwner(courseData, uid)) {
    return { error: "Forbidden", status: 403 };
  }

  return {
    courseRef,
    courseSnap,
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
  order: toPositiveNumber(subject?.order, index + 1),
});

const getAllCourseSubjects = (courseData = {}) => {
  const subjects = Array.isArray(courseData.subjects) ? courseData.subjects : [];
  return subjects
    .map((subject, index) => normalizeSubjectAssignment(subject, index))
    .filter((subject) => Boolean(subject.subjectId))
    .sort((a, b) => toPositiveNumber(a.order, 0) - toPositiveNumber(b.order, 0));
};

const getTeacherAssignedSubjects = (courseData = {}, uid = "") => {
  return getAllCourseSubjects(courseData)
    .filter((subject) => subject.teacherId === uid)
    .sort((a, b) => toPositiveNumber(a.order, 0) - toPositiveNumber(b.order, 0));
};

const getCourseWithAssignedSubjects = async (
  courseId,
  uid,
  forbiddenMessage = "You are not assigned to this course"
) => {
  const courseRef = db.collection(COLLECTIONS.COURSES).doc(courseId);
  const courseSnap = await courseRef.get();
  if (!courseSnap.exists) return { error: "Course not found", status: 404 };

  const courseData = courseSnap.data() || {};
  const assignedSubjects = getTeacherAssignedSubjects(courseData, uid);
  const isLegacyOwner = trimText(courseData.teacherId) === uid;
  const mySubjects =
    assignedSubjects.length > 0
      ? assignedSubjects
      : isLegacyOwner
        ? getAllCourseSubjects(courseData)
        : [];
  if (!mySubjects.length) return { error: forbiddenMessage, status: 403 };

  return { courseRef, courseSnap, courseData, mySubjects };
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

const getChapterWithAssignedSubject = async (chapterId, uid) => {
  const chapterRef = db.collection(COLLECTIONS.CHAPTERS).doc(chapterId);
  const chapterSnap = await chapterRef.get();
  if (!chapterSnap.exists) return { error: "Chapter not found", status: 404 };

  const chapterData = chapterSnap.data() || {};
  const courseId = trimText(chapterData.courseId);
  const subjectId = trimText(chapterData.subjectId);
  if (!courseId || !subjectId) {
    return { error: "Chapter subject mapping is missing", status: 400 };
  }

  const linkedCourse = await getCourseWithAssignedSubjects(courseId, uid);
  if (linkedCourse.error) return linkedCourse;

  const ownsSubject = linkedCourse.mySubjects.some(
    (subject) => subject.subjectId === subjectId
  );
  if (!ownsSubject) return { error: "Forbidden", status: 403 };

  return { ...linkedCourse, chapterRef, chapterSnap, chapterData };
};

const getLectureWithAssignedSubject = async (lectureId, uid) => {
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

  const linkedCourse = await getCourseWithAssignedSubjects(courseId, uid);
  if (linkedCourse.error) return linkedCourse;

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

export const getTeacherCourses = async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);

    const coursesSnap = await db.collection(COLLECTIONS.COURSES).get();
    const mappedCourses = coursesSnap.docs
      .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
      .map((row) => {
        const course = serializeCourse(row.id, row.data);
        const mySubjects = getTeacherAssignedSubjects(row.data, uid);
        return {
          id: course.id,
          title: course.title,
          category: course.category,
          level: course.level,
          status: course.status,
          thumbnail: course.thumbnail,
          price: course.price,
          mySubjects,
          enrollmentCount: course.enrollmentCount,
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

export const getTeacherCourseById = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const courseId = trimText(req.params?.courseId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!courseId) return errorResponse(res, "courseId is required", 400);

    const linkedCourse = await getCourseWithAssignedSubjects(
      courseId,
      uid,
      "You are not assigned to this course"
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
    const courseId = trimText(req.params?.courseId);
    const subjectId = trimText(req.params?.subjectId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!courseId || !subjectId) {
      return errorResponse(res, "courseId and subjectId are required", 400);
    }

    const linkedCourse = await getCourseWithAssignedSubjects(courseId, uid);
    if (linkedCourse.error) {
      return errorResponse(res, linkedCourse.error, linkedCourse.status);
    }
    const ownsSubject = linkedCourse.mySubjects.some(
      (subject) => subject.subjectId === subjectId
    );
    if (!ownsSubject) return errorResponse(res, "Forbidden", 403);

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

    const linkedCourse = await getCourseWithAssignedSubjects(courseId, uid);
    if (linkedCourse.error) {
      return errorResponse(res, linkedCourse.error, linkedCourse.status);
    }
    const ownsSubject = linkedCourse.mySubjects.some(
      (subject) => subject.subjectId === subjectId
    );
    if (!ownsSubject) return errorResponse(res, "Forbidden", 403);

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
    const chapterId = trimText(req.params?.chapterId);
    const { title, order } = req.body || {};
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!chapterId) return errorResponse(res, "chapterId is required", 400);

    const linked = await getChapterWithAssignedSubject(chapterId, uid);
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
    const chapterId = trimText(req.params?.chapterId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!chapterId) return errorResponse(res, "chapterId is required", 400);

    const linked = await getChapterWithAssignedSubject(chapterId, uid);
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
    const chapterId = trimText(req.params?.chapterId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!chapterId) return errorResponse(res, "chapterId is required", 400);

    const linked = await getChapterWithAssignedSubject(chapterId, uid);
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
    const chapterId = trimText(req.params?.chapterId);
    const { title, order } = req.body || {};

    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!chapterId) return errorResponse(res, "chapterId is required", 400);
    if (trimText(title).length < 3) {
      return errorResponse(res, "Lecture title must be at least 3 characters", 400);
    }

    const linked = await getChapterWithAssignedSubject(chapterId, uid);
    if (linked.error) return errorResponse(res, linked.error, linked.status);

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
      videoDuration: null,
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
    const lectureId = trimText(req.params?.lectureId);
    const title = trimText(req.body?.title);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!lectureId) return errorResponse(res, "lectureId is required", 400);
    if (title.length < 3) {
      return errorResponse(res, "Lecture title must be at least 3 characters", 400);
    }

    const linked = await getLectureWithAssignedSubject(lectureId, uid);
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
    const lectureId = trimText(req.params?.lectureId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!lectureId) return errorResponse(res, "lectureId is required", 400);

    const linked = await getLectureWithAssignedSubject(lectureId, uid);
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
    const lectureId = trimText(req.params?.lectureId);
    const { type, title, url, size = 0, duration } = req.body || {};
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!lectureId) return errorResponse(res, "lectureId is required", 400);

    const linked = await getLectureWithAssignedSubject(lectureId, uid);
    if (linked.error) return errorResponse(res, linked.error, linked.status);

    const normalizedType = lowerText(type);
    if (!["video", "pdf", "book"].includes(normalizedType)) {
      return errorResponse(res, "type must be video, pdf or book", 400);
    }

    const currentData = linked.lectureSnap.data() || {};
    const updates = {};

    if (normalizedType === "video") {
      if (!trimText(url)) {
        return errorResponse(res, "Video url is required", 400);
      }
      updates.videoUrl = trimText(url);
      updates.videoTitle = trimText(title) || null;
      updates.videoDuration = duration ?? "";
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
    return successResponse(
      res,
      serializeLecture(lectureId, updatedSnap.data() || {}),
      "Lecture content saved"
    );
  } catch (error) {
    console.error("saveLectureContent error:", error);
    return errorResponse(res, "Failed to save lecture content", 500);
  }
};

export const deleteLectureContent = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const lectureId = trimText(req.params?.lectureId);
    const contentId = trimText(req.params?.contentId);
    const normalizedType = lowerText(req.body?.type);

    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!lectureId) return errorResponse(res, "lectureId is required", 400);
    if (!["video", "pdf", "book"].includes(normalizedType)) {
      return errorResponse(res, "type must be video, pdf or book", 400);
    }

    const linked = await getLectureWithAssignedSubject(lectureId, uid);
    if (linked.error) return errorResponse(res, linked.error, linked.status);

    const lectureData = linked.lectureSnap.data() || {};
    const updates = { updatedAt: serverTimestamp() };

    if (normalizedType === "video") {
      updates.videoUrl = null;
      updates.videoTitle = null;
      updates.videoDuration = null;
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
    const courseId = trimText(req.params?.courseId);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);
    if (!courseId) return errorResponse(res, "courseId is required", 400);

    const linkedCourse = await getCourseWithAssignedSubjects(courseId, uid);
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
            .find((row) => trimText(row.courseId) === courseId);
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

      return {
        studentId,
        fullName,
        email: trimText(userData.email || studentData.email),
        enrolledAt: toIso(row.createdAt || row.enrolledAt),
        progress: Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0,
        completedAt: toIso(row.completedAt || progressData?.completedAt),
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

    const linkedLecture = await getLectureWithAssignedSubject(lectureId, uid);
    if (linkedLecture.error) {
      return errorResponse(res, linkedLecture.error, linkedLecture.status);
    }
    if (trimText(linkedLecture.lectureData.courseId) !== courseId) {
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

const clampPercent = (value) => Math.max(0, Math.min(100, toPositiveNumber(value, 0)));

const chunkArray = (rows = [], size = 10) => {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
};

const getTeacherAssignedCourses = async (uid) => {
  const coursesSnap = await db.collection(COLLECTIONS.COURSES).get();
  const courses = coursesSnap.docs
    .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
    .map((row) => {
      const assignedSubjects = getTeacherAssignedSubjects(row.data, uid);
      const legacyOwner = trimText(row.data?.teacherId) === uid;
      const mySubjects =
        assignedSubjects.length > 0
          ? assignedSubjects
          : legacyOwner
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
    courses.map((row) => [row.courseId, trimText(row.courseData?.title) || "Untitled Course"])
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
    (row) => trimText(row.courseId) === cleanCourseId || !trimText(row.courseId)
  );

  const direct = scopedRows.find((row) => trimText(row.courseId) === cleanCourseId);
  const directProgress = Number(
    direct?.progress ?? direct?.progressPercent ?? direct?.completionPercent
  );
  if (Number.isFinite(directProgress)) return clampPercent(directProgress);

  if (scopedRows.length > 0) {
    const lectureRows = scopedRows.filter((row) => trimText(row.lectureId));
    if (lectureRows.length) {
      const completed = lectureRows.filter((row) =>
        Boolean(
          row.isCompleted ||
            row.completed ||
            toPositiveNumber(row.progress, 0) >= 100 ||
            toPositiveNumber(row.progressPercent, 0) >= 100 ||
            toPositiveNumber(row.completionPercent, 0) >= 100
        )
      ).length;
      return clampPercent((completed / lectureRows.length) * 100);
    }
  }

  return clampPercent(fallbackProgress);
};

export const getTeacherStudents = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);

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
          const courseId = trimText(enrollment.courseId);
          const progress = extractCourseProgress(progressRows, courseId, enrollment.progress);
          const completedAt =
            toIso(enrollment.completedAt) ||
            toIso(
              progressRows.find((row) => trimText(row.courseId) === courseId)?.completedAt
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
      (!trimText(row.courseId) || trimText(row.courseId) === cleanCourseId)
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

  const courseRow = progressRows.find((row) => trimText(row.courseId) === cleanCourseId);
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
      .filter((row) => courseIds.includes(trimText(row.courseId)));

    const teacherClassIds = classesSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => isTeacherAssignedToClass(row, uid))
      .map((row) => row.id);
    const attendanceRows = attendanceSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter(
        (row) =>
          teacherClassIds.includes(trimText(row.classId)) ||
          courseIds.includes(trimText(row.courseId))
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
      const courseId = trimText(enrollment.courseId);
      const progress = extractCourseProgress(progressRows, courseId, enrollment.progress);
      return {
        courseId,
        courseName: courseNameById[courseId] || "Course",
        progress,
        completedAt:
          toIso(enrollment.completedAt) ||
          toIso(
            progressRows.find((row) => trimText(row.courseId) === courseId)?.completedAt
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
      .where("courseId", "==", courseId)
      .get();
    let enrollment =
      enrollmentSnap.empty ? null : enrollmentSnap.docs[0].data() || null;
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
          (!trimText(row.courseId) || trimText(row.courseId) === courseId)
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
        return classCourseIds.includes(trimText(row.courseId));
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
          const sessionCourseId = trimText(row.courseId);
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

  const [teacherIdSnap, teachersArraySnap, allClassesSnap] = await Promise.all([
    db.collection(COLLECTIONS.CLASSES).where("teacherId", "==", uid).get(),
    db
      .collection(COLLECTIONS.CLASSES)
      .where("teachers", "array-contains", uid)
      .get()
      .catch(() => null),
    db.collection(COLLECTIONS.CLASSES).get(),
  ]);

  attachDocs(teacherIdSnap.docs);
  if (teachersArraySnap) attachDocs(teachersArraySnap.docs);

  allClassesSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    if (isTeacherAssignedToClass(data, uid)) {
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
    if (!uid) return errorResponse(res, "Missing teacher uid", 400);

    const classDocs = await getTeacherAssignedClassDocs(uid);
    const payload = classDocs
      .map((row) => {
        const data = row.data || {};
        const students = getClassStudentEntries(data);
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
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return successResponse(res, payload, "Teacher classes fetched");
  } catch (error) {
    console.error("getTeacherClasses error:", error);
    return errorResponse(res, "Failed to fetch teacher classes", 500);
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
    phoneNumber: trimText(
      teacherData.phoneNumber || teacherData.phone || userData.phoneNumber
    ),
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
    const phoneNumber = trimText(req.body?.phoneNumber);
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
