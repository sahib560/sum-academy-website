import { Router } from "express";
import { admin, db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";

const router = Router();

const trimText = (value = "") => String(value || "").trim();
const lowerText = (value = "") => trimText(value).toLowerCase();
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const toDayStart = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return null;
  const copy = new Date(parsed);
  copy.setHours(0, 0, 0, 0);
  return copy;
};
const todayStart = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};
const dayDiff = (future, now) => {
  if (!future || !now) return null;
  return Math.ceil((future.getTime() - now.getTime()) / 86400000);
};

const getClassSubjectIds = (classData = {}) => {
  const ids = [];
  const assignedSubjects = Array.isArray(classData.assignedSubjects)
    ? classData.assignedSubjects
    : [];
  assignedSubjects.forEach((entry) => {
    const subjectId =
      typeof entry === "string"
        ? trimText(entry)
        : trimText(entry?.subjectId || entry?.courseId || entry?.id);
    if (subjectId) ids.push(subjectId);
  });

  const assignedCourses = Array.isArray(classData.assignedCourses)
    ? classData.assignedCourses
    : [];
  assignedCourses.forEach((entry) => {
    const courseId =
      typeof entry === "string"
        ? trimText(entry)
        : trimText(entry?.courseId || entry?.subjectId || entry?.id);
    if (courseId) ids.push(courseId);
  });

  const legacyCourseId = trimText(classData.courseId);
  if (legacyCourseId) ids.push(legacyCourseId);

  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  shifts.forEach((shift) => {
    const shiftSubjectId = trimText(shift?.subjectId || shift?.courseId);
    if (shiftSubjectId) ids.push(shiftSubjectId);
  });

  return [...new Set(ids)];
};

const normalizeSubjectMeta = (id, row = {}) => {
  const price = Math.max(0, toNumber(row.price, 0));
  const discountPercent = Math.max(
    0,
    Math.min(100, toNumber(row.discountPercent ?? row.discount, 0))
  );
  const finalPrice = Math.max(
    Number((price - (price * discountPercent) / 100).toFixed(2)),
    0
  );
  const title = trimText(row.title || row.courseName || row.name) || "Subject";
  return {
    subjectId: id,
    title,
    description: trimText(row.description || row.shortDescription || ""),
    price,
    discountPercent,
    finalPrice,
    thumbnail: row.thumbnail || null,
    teacherId: trimText(row.teacherId || row.teacher?.id || ""),
    teacherName:
      trimText(row.teacherName || row.teacher?.name || row.teacher?.fullName) ||
      "Teacher",
  };
};

const getClassStatus = (classData = {}, capacity = 30, enrolledCount = 0) => {
  const start = toDayStart(classData.startDate);
  const end = toDayStart(classData.endDate);
  const today = todayStart();
  const isFull = enrolledCount >= capacity;

  if (end && today.getTime() > end.getTime()) {
    return "expired";
  }
  if (isFull) return "full";
  if (start && today.getTime() < start.getTime()) {
    return "upcoming";
  }
  return "active";
};

const getOptionalUid = async (req) => {
  const authHeader = trimText(req.headers?.authorization || "");
  const tokenFromHeader = authHeader.startsWith("Bearer ")
    ? trimText(authHeader.slice(7))
    : "";
  const token = tokenFromHeader || trimText(req.query?.token || "");
  if (!token) return "";
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return trimText(decoded?.uid);
  } catch {
    return "";
  }
};

const getStudentPurchasedKeySet = async (studentId) => {
  if (!studentId) return new Set();
  const snap = await db
    .collection(COLLECTIONS.ENROLLMENTS)
    .where("studentId", "==", studentId)
    .get();
  const validStatuses = new Set([
    "",
    "active",
    "upcoming",
    "completed",
    "pending_review",
  ]);
  const keySet = new Set();
  snap.docs.forEach((doc) => {
    const row = doc.data() || {};
    const classId = trimText(row.classId);
    const subjectId = trimText(row.subjectId || row.courseId);
    const status = lowerText(row.status || "");
    if (!classId || !subjectId) return;
    if (!validStatuses.has(status)) return;
    keySet.add(`${classId}::${subjectId}`);
  });
  return keySet;
};

router.get("/catalog", async (req, res) => {
  try {
    const [subjectsSnap, coursesSnap] = await Promise.all([
      db.collection(COLLECTIONS.SUBJECTS).get(),
      db.collection(COLLECTIONS.COURSES).get(),
    ]);
    const rows = [];

    subjectsSnap.docs.forEach((doc) => {
      rows.push({ id: doc.id, ...normalizeSubjectMeta(doc.id, doc.data() || {}) });
    });

    coursesSnap.docs.forEach((doc) => {
      if (rows.some((row) => row.id === doc.id)) return;
      rows.push({ id: doc.id, ...normalizeSubjectMeta(doc.id, doc.data() || {}) });
    });

    const data = rows
      .filter((row) => lowerText(row.status) !== "archived")
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    return successResponse(res, data, "Subject catalog fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch subject catalog", 500);
  }
});

router.get("/available", async (req, res) => {
  try {
    const filterSubjectId = trimText(req.query.subjectId || req.query.courseId);
    const includeExpired = ["1", "true", "yes"].includes(
      lowerText(req.query.includeExpired || "")
    );

    const [classesSnap, subjectsSnap, coursesSnap, studentId] = await Promise.all([
      db.collection(COLLECTIONS.CLASSES).get(),
      db.collection(COLLECTIONS.SUBJECTS).get(),
      db.collection(COLLECTIONS.COURSES).get(),
      getOptionalUid(req),
    ]);

    const subjectMap = {};
    subjectsSnap.docs.forEach((doc) => {
      subjectMap[doc.id] = normalizeSubjectMeta(doc.id, doc.data() || {});
    });
    coursesSnap.docs.forEach((doc) => {
      if (subjectMap[doc.id]) return;
      subjectMap[doc.id] = normalizeSubjectMeta(doc.id, doc.data() || {});
    });

    const purchasedKeySet = await getStudentPurchasedKeySet(studentId);

    const data = classesSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .map((classItem) => {
        const subjectIds = getClassSubjectIds(classItem);
        const assignedSubjects = subjectIds
          .map((subjectId) => {
            const meta = subjectMap[subjectId] || normalizeSubjectMeta(subjectId, {});
            const alreadyPurchased = purchasedKeySet.has(`${classItem.id}::${subjectId}`);
            return {
              ...meta,
              alreadyPurchased,
              courseId: subjectId,
              courseName: meta.title,
            };
          })
          .filter((row) => trimText(row.subjectId));

        const capacity = Math.max(1, toNumber(classItem.capacity, 30));
        const students = Array.isArray(classItem.students) ? classItem.students : [];
        const enrolledCount = Math.max(
          students.length,
          toNumber(classItem.enrolledCount, 0)
        );
        const spotsLeft = Math.max(capacity - enrolledCount, 0);
        const classStatus = getClassStatus(classItem, capacity, enrolledCount);
        const isFull = classStatus === "full";
        const isUpcoming = classStatus === "upcoming";
        const isExpired = classStatus === "expired";
        const canEnroll = !isExpired && !isFull;
        const canLearn = classStatus === "active";

        const purchasedSubjects = assignedSubjects.filter((row) => row.alreadyPurchased);
        const unpurchasedSubjects = assignedSubjects.filter((row) => !row.alreadyPurchased);

        const totalPrice = Math.round(
          assignedSubjects.reduce((sum, row) => sum + toNumber(row.finalPrice, row.price), 0)
        );
        const remainingPrice = Math.round(
          unpurchasedSubjects.reduce((sum, row) => sum + toNumber(row.finalPrice, row.price), 0)
        );
        const isFullyEnrolled =
          assignedSubjects.length > 0 && unpurchasedSubjects.length === 0;
        const isPartiallyEnrolled =
          purchasedSubjects.length > 0 && !isFullyEnrolled;

        const startDay = toDayStart(classItem.startDate);
        const endDay = toDayStart(classItem.endDate);
        const nowDay = todayStart();
        const daysUntilStart = startDay ? Math.max(dayDiff(startDay, nowDay), 0) : null;
        const daysUntilEnd = endDay ? Math.max(dayDiff(endDay, nowDay), 0) : null;

        const shifts = (Array.isArray(classItem.shifts) ? classItem.shifts : [])
          .filter((shift) => {
            if (!filterSubjectId) return true;
            const shiftSubjectId = trimText(shift?.subjectId || shift?.courseId);
            return shiftSubjectId === filterSubjectId;
          })
          .map((shift) => {
            const subjectId = trimText(shift?.subjectId || shift?.courseId);
            return {
              id: trimText(shift?.id),
              name: trimText(shift?.name) || "Shift",
              days: Array.isArray(shift?.days) ? shift.days : [],
              startTime: trimText(shift?.startTime),
              endTime: trimText(shift?.endTime),
              teacherId: trimText(shift?.teacherId),
              teacherName: trimText(shift?.teacherName) || "Teacher",
              room: trimText(shift?.room),
              subjectId,
              subjectName:
                trimText(shift?.subjectName || shift?.courseName) ||
                subjectMap[subjectId]?.title ||
                "Subject",
              courseId: subjectId,
              courseName:
                trimText(shift?.subjectName || shift?.courseName) ||
                subjectMap[subjectId]?.title ||
                "Subject",
            };
          })
          .filter((shift) => Boolean(shift.id));

        const teacherName =
          trimText(classItem.teacherName) ||
          trimText(classItem.teachers?.[0]?.teacherName) ||
          trimText(shifts[0]?.teacherName) ||
          trimText(assignedSubjects[0]?.teacherName) ||
          "Teacher";

        return {
          id: classItem.id,
          name: trimText(classItem.name) || "Class",
          batchCode: trimText(classItem.batchCode),
          description: trimText(classItem.description),
          teacherName,
          teacherId:
            trimText(classItem.teacherId) ||
            trimText(classItem.teachers?.[0]?.teacherId) ||
            trimText(shifts[0]?.teacherId) ||
            trimText(assignedSubjects[0]?.teacherId),
          capacity,
          enrolledCount,
          spotsLeft,
          availableSpots: spotsLeft,
          classStatus,
          status: classStatus,
          canEnroll,
          canLearn,
          isExpired,
          isUpcoming,
          isFull,
          startDate: classItem.startDate || null,
          endDate: classItem.endDate || null,
          daysUntilStart,
          daysUntilEnd,
          totalPrice,
          remainingPrice,
          isFullyEnrolled,
          isPartiallyEnrolled,
          purchasedSubjectsCount: purchasedSubjects.length,
          unpurchasedSubjectsCount: unpurchasedSubjects.length,
          subjectsCount: assignedSubjects.length,
          coursesCount: assignedSubjects.length,
          assignedSubjects,
          assignedCourses: assignedSubjects.map((row) => ({
            ...row,
            courseId: row.subjectId,
            title: row.title,
          })),
          purchasedSubjects,
          unpurchasedSubjects,
          shifts,
        };
      })
      .filter((classItem) => (includeExpired ? true : !classItem.isExpired))
      .filter((classItem) =>
        filterSubjectId
          ? classItem.assignedSubjects.some((row) => row.subjectId === filterSubjectId)
          : true
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    return successResponse(res, data, "Available classes fetched");
  } catch (error) {
    console.error("getAvailableClasses error:", error);
    return errorResponse(res, "Failed to fetch available classes", 500);
  }
});

export default router;
