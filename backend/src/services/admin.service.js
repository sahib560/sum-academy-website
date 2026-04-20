import { db, admin } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";

const trimText = (value = "") => String(value || "").trim();
const lowerText = (value = "") => trimText(value).toLowerCase();
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const clampPercent = (value) => Math.max(0, Math.min(100, toNumber(value, 0)));
const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const getEnrollmentStatusFromClassDates = (classData = {}) => {
  const start = parseDate(classData?.startDate);
  const end = parseDate(classData?.endDate);
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
const chunkArray = (rows = [], size = 10) => {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
};

const ACTIVE_ENROLLMENT_STATUSES = new Set([
  "active",
  "upcoming",
  "completed",
  "pending_review",
  "",
]);

const getClassStudentEntries = (classData = {}) => {
  const raw = Array.isArray(classData.students) ? classData.students : [];
  return raw
    .map((entry) =>
      typeof entry === "string"
        ? { studentId: trimText(entry), shiftId: "", courseId: "", enrolledAt: null }
        : {
            studentId: trimText(entry?.studentId || entry?.id || entry?.uid),
            shiftId: trimText(entry?.shiftId),
            courseId: trimText(entry?.subjectId || entry?.courseId),
            enrolledAt: entry?.enrolledAt || null,
          }
    )
    .filter((entry) => Boolean(entry.studentId));
};

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

  const directCourseId = trimText(classData.courseId);
  if (directCourseId) ids.push(directCourseId);

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

const resolveClassEntryCourseIds = (entry = {}, classData = {}) => {
  const explicitCourseId = trimText(entry?.courseId);
  if (explicitCourseId) return [explicitCourseId];

  const shiftId = trimText(entry?.shiftId);
  const shiftCourseMap = getClassShiftCourseMap(classData);
  if (shiftId && shiftCourseMap[shiftId]) return [shiftCourseMap[shiftId]];

  const assignedCourseIds = getClassAssignedCourseIds(classData);
  if (assignedCourseIds.length > 0) return assignedCourseIds;

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
          status: getEnrollmentStatusFromClassDates(classData),
          classStartDate: classData?.startDate || null,
          classEndDate: classData?.endDate || null,
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

    if (priority >= 2) {
      const status = lowerText(row?.status || "active");
      if (!ACTIVE_ENROLLMENT_STATUSES.has(status)) return;
    }

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

const extractCourseProgress = (progressRows = [], courseId = "", fallbackProgress = 0) => {
  const cleanCourseId = trimText(courseId);
  const scopedRows = progressRows.filter(
    (row) =>
      trimText(row.subjectId || row.courseId) === cleanCourseId ||
      !trimText(row.subjectId || row.courseId)
  );

  const direct = scopedRows.find(
    (row) => trimText(row.subjectId || row.courseId) === cleanCourseId
  );
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
            toNumber(row.progress, 0) >= 100 ||
            toNumber(row.progressPercent, 0) >= 100 ||
            toNumber(row.completionPercent, 0) >= 100
        )
      ).length;
      return clampPercent((completed / lectureRows.length) * 100);
    }
  }

  return clampPercent(fallbackProgress);
};

const getLiveEnrollmentCountByCourse = async (courseIds = []) => {
  const cleanCourseIds = [...new Set(courseIds.map((id) => trimText(id)).filter(Boolean))];
  if (!cleanCourseIds.length) return {};

  const classesSnap = await db.collection(COLLECTIONS.CLASSES).get();
  const classDocs = classesSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
  const inferredRows = buildClassDerivedEnrollmentRows(classDocs, cleanCourseIds);

  const mergedRows = mergeEnrollmentRowsByStudentCourse([], inferredRows);
  return mergedRows.reduce((acc, row) => {
    const courseId = trimText(row.subjectId || row.courseId);
    if (!courseId) return acc;
    acc[courseId] = (acc[courseId] || 0) + 1;
    return acc;
  }, {});
};

export const getDashboardStats = async () => {
  const [
    studentsSnap,
    teachersSnap,
    subjectsSnap,
    coursesSnap,
    classesSnap,
    paymentsSnap,
    enrollmentsSnap,
    totalEnrollmentsSnap,
    pendingPaymentsSnap,
    pendingApprovalsSnap,
  ] = await Promise.all([
    db.collection(COLLECTIONS.USERS).where("role", "==", "student").count().get(),
    db.collection(COLLECTIONS.TEACHERS).count().get(),
    db.collection(COLLECTIONS.SUBJECTS).count().get(),
    db.collection(COLLECTIONS.COURSES).count().get(),
    db.collection(COLLECTIONS.CLASSES).count().get(),
    db.collection(COLLECTIONS.PAYMENTS).where("status", "==", "paid").get(),
    db
      .collection(COLLECTIONS.ENROLLMENTS)
      .where("status", "in", ["active", "upcoming"])
      .count()
      .get(),
    db.collection(COLLECTIONS.ENROLLMENTS).count().get(),
    db
      .collection(COLLECTIONS.PAYMENTS)
      .where("status", "==", "pending")
      .where("method", "==", "bank_transfer")
      .count()
      .get(),
    db
      .collection(COLLECTIONS.USERS)
      .where("role", "==", "student")
      .where("status", "==", "pending_approval")
      .count()
      .get(),
  ]);

  const totalRevenue = paymentsSnap.docs.reduce(
    (sum, doc) => sum + (doc.data().amount || 0),
    0
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const enrollmentsToday = paymentsSnap.docs.filter((doc) => {
    const createdAt = doc.data().createdAt?.toDate();
    return createdAt && createdAt >= today;
  }).length;

  return {
    totalStudents: studentsSnap.data().count,
    totalTeachers: teachersSnap.data().count,
    totalCourses:
      (subjectsSnap.data().count || 0) > 0
        ? subjectsSnap.data().count
        : coursesSnap.data().count,
    totalClasses: classesSnap.data().count,
    totalRevenue,
    totalEnrollments: totalEnrollmentsSnap.data().count,
    activeEnrollments: enrollmentsSnap.data().count,
    enrollmentsToday,
    pendingBankTransfers: pendingPaymentsSnap.data().count,
    pendingApprovals: pendingApprovalsSnap.data().count,
  };
};

export const getRevenueChart = async (days = 7) => {
  try {
    const snap = await db.collection(COLLECTIONS.PAYMENTS).get();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const revenueMap = {};
    snap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.status !== "paid") return;

      const createdAt = data.createdAt?.toDate?.();
      if (!createdAt || createdAt < startDate) return;

      const date = createdAt.toISOString().split("T")[0];
      revenueMap[date] = (revenueMap[date] || 0) + (data.amount || 0);
    });

    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      result.push({ date: dateStr, amount: revenueMap[dateStr] || 0 });
    }

    return result;
  } catch (e) {
    console.error("getRevenueChart error:", e.message);
    return [];
  }
};

export const getRecentEnrollments = async (limit = 8) => {
  try {
    const snap = await db.collection(COLLECTIONS.PAYMENTS).get();

    if (snap.empty) return [];

    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((payment) => payment.status === "paid")
      .sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      })
      .slice(0, limit)
      .map((payment) => ({
        ...payment,
        createdAt: payment.createdAt?.toDate?.()?.toISOString() || null,
      }));
  } catch (e) {
    console.error("getRecentEnrollments error:", e.message);
    return [];
  }
};

export const getTopCourses = async (limit = 5) => {
  const [subjectsSnap, coursesSnap] = await Promise.all([
    db.collection(COLLECTIONS.SUBJECTS).orderBy("enrollmentCount", "desc").limit(limit).get(),
    db.collection(COLLECTIONS.COURSES).orderBy("enrollmentCount", "desc").limit(limit).get(),
  ]);
  const rows = [];
  const seen = new Set();

  subjectsSnap.docs.forEach((doc) => {
    seen.add(doc.id);
    rows.push({ id: doc.id, ...doc.data(), title: trimText(doc.data()?.title) || "Subject" });
  });
  coursesSnap.docs.forEach((doc) => {
    if (seen.has(doc.id)) return;
    rows.push({ id: doc.id, ...doc.data(), title: trimText(doc.data()?.title) || "Subject" });
  });

  return rows
    .sort((a, b) => toNumber(b.enrollmentCount, 0) - toNumber(a.enrollmentCount, 0))
    .slice(0, limit);
};

const resolveClassTeacherName = (classData = {}) => {
  const direct =
    trimText(classData.teacherName) ||
    trimText(classData.classTeacherName) ||
    trimText(classData.teacherFullName);
  if (direct) return direct;
  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  for (const shift of shifts) {
    const name = trimText(shift?.teacherName);
    if (name) return name;
  }
  return "Teacher";
};

const buildClassEnrollmentStats = (enrollmentRows = []) => {
  return enrollmentRows.reduce((acc, row) => {
    const classId = trimText(row.classId);
    if (!classId) return acc;
    const status = lowerText(row.status || "");
    const entry = acc[classId] || { enrolled: 0, completed: 0 };
    if (ACTIVE_ENROLLMENT_STATUSES.has(status)) {
      entry.enrolled += 1;
    }
    if (status === "completed") {
      entry.completed += 1;
    }
    acc[classId] = entry;
    return acc;
  }, {});
};

const buildClassRevenueStats = (paymentRows = []) => {
  return paymentRows.reduce((acc, row) => {
    if (lowerText(row.status || "") !== "paid") return acc;
    const classId = trimText(row.classId);
    if (!classId) return acc;
    acc[classId] = (acc[classId] || 0) + toNumber(row.amount, 0);
    return acc;
  }, {});
};

let cachedCourseNameById = null;
let cachedCourseNameExpiresAt = 0;
const getCourseNameByIdMap = async () => {
  const now = Date.now();
  if (cachedCourseNameById && cachedCourseNameExpiresAt > now) {
    return cachedCourseNameById;
  }

  const [subjectsSnap, coursesSnap] = await Promise.all([
    db.collection(COLLECTIONS.SUBJECTS).get(),
    db.collection(COLLECTIONS.COURSES).get(),
  ]);

  const courseNameById = {};
  subjectsSnap.docs.forEach((doc) => {
    courseNameById[doc.id] = trimText(doc.data()?.title) || "Subject";
  });
  coursesSnap.docs.forEach((doc) => {
    if (courseNameById[doc.id]) return;
    courseNameById[doc.id] = trimText(doc.data()?.title) || "Subject";
  });

  cachedCourseNameById = courseNameById;
  cachedCourseNameExpiresAt = now + 10 * 60 * 1000;
  return courseNameById;
};

export const getTopClasses = async (limit = 5) => {
  const limitSize = Math.min(25, Math.max(1, toNumber(limit, 5)));
  let classesSnap = null;
  try {
    classesSnap = await db
      .collection(COLLECTIONS.CLASSES)
      .orderBy("enrollmentCount", "desc")
      .limit(limitSize)
      .get();
  } catch {
    // Fallback if field/index missing: still avoid enrollment/payment full scans.
    classesSnap = await db.collection(COLLECTIONS.CLASSES).get();
  }

  const classRows = classesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  const mapped = classRows.map((row) => {
    const fallbackCount = Math.max(
      toNumber(row.enrollmentCount, 0),
      toNumber(row.activeStudents, 0),
      toNumber(row.enrolledCount, 0),
      Array.isArray(row.students) ? row.students.length : toNumber(row.studentCount, 0)
    );
    return {
      id: row.id,
      className: trimText(row.name) || "Class",
      title: trimText(row.name) || "Class",
      batchCode: trimText(row.batchCode),
      teacherName: resolveClassTeacherName(row),
      enrollmentCount: fallbackCount,
      completedCount: Math.max(0, toNumber(row.completedCount, 0)),
      revenue: Math.max(0, toNumber(row.totalRevenue ?? row.revenue, 0)),
    };
  });

  return mapped
    .sort((a, b) => {
      const diff = toNumber(b.enrollmentCount, 0) - toNumber(a.enrollmentCount, 0);
      if (diff !== 0) return diff;
      return toNumber(b.revenue, 0) - toNumber(a.revenue, 0);
    })
    .slice(0, limit);
};

export const getClassPerformance = async () => {
  const classesSnap = await db.collection(COLLECTIONS.CLASSES).get();
  const classRows = classesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));

  return classRows.map((row) => {
    const enrolled = Math.max(
      toNumber(row.enrollmentCount, 0),
      toNumber(row.activeStudents, 0),
      toNumber(row.enrolledCount, 0),
      Array.isArray(row.students) ? row.students.length : toNumber(row.studentCount, 0)
    );
    const completed = Math.max(0, toNumber(row.completedCount, 0));
    const completionRate = enrolled ? Math.round((completed / enrolled) * 100) : 0;
    return {
      id: row.id,
      className: trimText(row.name) || "Class",
      batchCode: trimText(row.batchCode),
      teacherName: resolveClassTeacherName(row),
      enrolled,
      completed,
      completionRate,
      revenue: Math.max(0, toNumber(row.totalRevenue ?? row.revenue, 0)),
    };
  });
};

export const getRecentActivity = async (limit = 10) => {
  const snap = await db
    .collection(COLLECTIONS.AUDIT_LOGS)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate()?.toISOString(),
  }));
};

export const getAllUsers = async (filters = {}) => {
  const snap = await db.collection(COLLECTIONS.USERS).get();
  let users = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (filters.role) {
    const normalizedRole = String(filters.role).toLowerCase();
    users = users.filter(
      (user) => String(user.role || "").toLowerCase() === normalizedRole
    );
  }
  if (filters.isActive !== undefined) {
    users = users.filter((user) => Boolean(user.isActive) === filters.isActive);
  }

  if (filters.search) {
    const s = filters.search.toLowerCase();
    users = users.filter((u) => u.email?.toLowerCase().includes(s));
  }

  return users.sort((a, b) => {
    const aTime =
      typeof a.createdAt?.toDate === "function"
        ? a.createdAt.toDate().getTime()
        : new Date(a.createdAt || 0).getTime() || 0;
    const bTime =
      typeof b.createdAt?.toDate === "function"
        ? b.createdAt.toDate().getTime()
        : new Date(b.createdAt || 0).getTime() || 0;
    return bTime - aTime;
  });
};

export const getAllUsersPaginated = async ({
  pageSize = 50,
  cursor = "",
  filters = {},
} = {}) => {
  const limitSize = Math.min(200, Math.max(1, toNumber(pageSize, 50)));
  const cleanCursor = trimText(cursor);
  const roleFilter = trimText(filters?.role).toLowerCase();
  const hasRoleFilter = Boolean(roleFilter);
  const hasActiveFilter = filters?.isActive !== undefined && filters?.isActive !== null;
  const isActiveFilter = Boolean(filters?.isActive);
  const searchRaw = trimText(filters?.search);
  const searchNeedle = lowerText(searchRaw);
  const hasSearch = Boolean(searchNeedle);

  let baseQuery = db.collection(COLLECTIONS.USERS);
  if (hasRoleFilter) baseQuery = baseQuery.where("role", "==", roleFilter);
  if (hasActiveFilter) baseQuery = baseQuery.where("isActive", "==", isActiveFilter);

  const usersCollection = db.collection(COLLECTIONS.USERS);
  const buildUserItems = async (entries = []) => {
    const teacherIds = [];
    const studentIds = [];
    entries.forEach((entry) => {
      const role = lowerText(entry?.data?.role);
      if (role === "teacher") teacherIds.push(entry.id);
      if (role === "student") studentIds.push(entry.id);
    });

    const [teacherSnaps, studentSnaps] = await Promise.all([
      Promise.all(
        [...new Set(teacherIds)].map((id) =>
          db.collection(COLLECTIONS.TEACHERS).doc(id).get()
        )
      ).catch(() => []),
      Promise.all(
        [...new Set(studentIds)].map((id) =>
          db.collection(COLLECTIONS.STUDENTS).doc(id).get()
        )
      ).catch(() => []),
    ]);
    const teacherMap = (teacherSnaps || []).reduce((acc, snap) => {
      if (!snap?.exists) return acc;
      acc[snap.id] = snap.data() || {};
      return acc;
    }, {});
    const studentMap = (studentSnaps || []).reduce((acc, snap) => {
      if (!snap?.exists) return acc;
      acc[snap.id] = snap.data() || {};
      return acc;
    }, {});

    return entries.map((entry) => {
      const uid = entry.id;
      const userData = entry.data || {};
      const role = lowerText(userData.role);
      const roleProfile =
        role === "teacher"
          ? teacherMap[uid] || {}
          : role === "student"
            ? studentMap[uid] || {}
            : {};
      return {
        id: uid,
        uid,
        ...userData,
        ...roleProfile,
        role: role || lowerText(roleProfile.role),
        email: trimText(userData.email || roleProfile.email),
        isActive: userData.isActive ?? true,
        createdAt: roleProfile.createdAt || userData.createdAt || null,
      };
    });
  };

  const matchSearch = (user) => {
    if (!hasSearch) return true;
    const haystack = [
      user?.uid,
      user?.id,
      user?.email,
      user?.fullName,
      user?.name,
      user?.phone,
      user?.phoneNumber,
    ]
      .filter(Boolean)
      .map((value) => lowerText(value))
      .join(" | ");
    return haystack.includes(searchNeedle);
  };

  const fetchBatch = async (afterDocId = "") => {
    let usersSnap = null;
    try {
      let q = baseQuery.orderBy("createdAt", "desc").limit(limitSize + 1);
      if (afterDocId) {
        const cursorSnap = await usersCollection.doc(afterDocId).get();
        if (cursorSnap.exists) q = q.startAfter(cursorSnap);
      }
      usersSnap = await q.get();
    } catch {
      // Fallback: avoid composite index issues.
      let q = baseQuery.limit(limitSize + 1);
      if (afterDocId) {
        const cursorSnap = await usersCollection.doc(afterDocId).get();
        if (cursorSnap.exists) q = q.startAfter(cursorSnap);
      }
      usersSnap = await q.get();
    }
    const docs = usersSnap?.docs || [];
    return docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
  };

  if (!hasRoleFilter && !hasActiveFilter && !hasSearch && !cleanCursor) {
    const maxAdmins = Math.min(5, Math.max(0, limitSize - 1));
    const maxTeachers = Math.min(10, Math.max(0, limitSize - 1 - maxAdmins));
    const remaining = Math.max(0, limitSize - maxAdmins - maxTeachers);

    const [adminDocs, teacherDocs, studentDocs] = await Promise.all([
      maxAdmins
        ? usersCollection
            .where("role", "==", "admin")
            .orderBy("createdAt", "desc")
            .limit(maxAdmins)
            .get()
            .then((snap) => snap.docs || [])
            .catch(() => [])
        : Promise.resolve([]),
      maxTeachers
        ? usersCollection
            .where("role", "==", "teacher")
            .orderBy("createdAt", "desc")
            .limit(maxTeachers)
            .get()
            .then((snap) => snap.docs || [])
            .catch(() => [])
        : Promise.resolve([]),
      usersCollection
        .where("role", "==", "student")
        .orderBy("createdAt", "desc")
        .limit(remaining + 1)
        .get()
        .then((snap) => snap.docs || [])
        .catch(() => []),
    ]);

    const adminEntries = adminDocs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
    const teacherEntries = teacherDocs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
    const studentRaw = studentDocs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
    const studentEntries = studentRaw.slice(0, remaining);
    const hasMore = studentRaw.length > remaining;
    const nextCursor = hasMore ? studentEntries[studentEntries.length - 1]?.id || "" : "";

    const items = await buildUserItems(
      [...adminEntries, ...teacherEntries, ...studentEntries].slice(0, limitSize)
    );

    return { items, page: { pageSize: limitSize, hasMore, nextCursor } };
  }

  let scanned = 0;
  const maxScan = Math.max(200, limitSize * 10);
  const collected = [];
  let scanCursor = cleanCursor;
  let lastScannedId = "";
  let hasMoreScan = true;

  while (collected.length < limitSize && hasMoreScan) {
    const batch = await fetchBatch(scanCursor);
    scanned += batch.length;
    if (!batch.length) {
      hasMoreScan = false;
      break;
    }

    const pageEntries = batch.slice(0, limitSize);
    const hasMore = batch.length > limitSize;
    lastScannedId = pageEntries[pageEntries.length - 1]?.id || "";
    scanCursor = lastScannedId;
    if (!hasSearch) {
      const items = await buildUserItems(pageEntries);
      return {
        items,
        page: {
          pageSize: limitSize,
          hasMore,
          nextCursor: hasMore ? (pageEntries[pageEntries.length - 1]?.id || "") : "",
        },
      };
    }

    const enriched = await buildUserItems(pageEntries);
    const matches = enriched.filter(matchSearch);
    collected.push(...matches);

    hasMoreScan = hasMore;
    if (scanned >= maxScan) break;
  }

  const items = collected.slice(0, limitSize);
  const hasMore = hasMoreScan;
  const nextCursor = hasMore ? lastScannedId || "" : "";

  return {
    items,
    page: { pageSize: limitSize, hasMore, nextCursor },
  };
};

export const getUserRoleCounts = async () => {
  const usersRef = db.collection(COLLECTIONS.USERS);
  const roles = ["admin", "teacher", "student"];

  const [totalSnap, roleSnaps] = await Promise.all([
    usersRef.count().get(),
    Promise.all(roles.map((role) => usersRef.where("role", "==", role).count().get())),
  ]);

  const byRole = roles.reduce((acc, role, index) => {
    const snap = roleSnaps[index];
    const count = typeof snap?.data === "function" ? snap.data().count : snap?.data?.().count;
    acc[role] = Number(count || 0);
    return acc;
  }, {});

  const totalCount = typeof totalSnap?.data === "function" ? totalSnap.data().count : totalSnap?.data?.().count;

  return { total: Number(totalCount || 0), byRole };
};

export const getStudentCounts = async () => {
  const usersRef = db.collection(COLLECTIONS.USERS);
  const base = usersRef.where("role", "==", "student");

  const [
    totalSnap,
    activeSnap,
    inactiveSnap,
    pendingSnap,
    paymentBlockedSnap,
  ] = await Promise.all([
    base.count().get(),
    base.where("isActive", "==", true).count().get(),
    base.where("isActive", "==", false).count().get(),
    base.where("status", "==", "pending_approval").count().get(),
    base.where("paymentApprovalBlocked", "==", true).count().get(),
  ]);

  const readCount = (snap) =>
    typeof snap?.data === "function" ? snap.data().count : snap?.data?.().count;

  return {
    total: Number(readCount(totalSnap) || 0),
    active: Number(readCount(activeSnap) || 0),
    inactive: Number(readCount(inactiveSnap) || 0),
    pending: Number(readCount(pendingSnap) || 0),
    paymentBlocked: Number(readCount(paymentBlockedSnap) || 0),
  };
};

export const getAllTeachers = async () => {
  const [teachersSnap, usersSnap] = await Promise.all([
    db.collection(COLLECTIONS.TEACHERS).get(),
    db.collection(COLLECTIONS.USERS).where("role", "==", "teacher").get(),
  ]);

  const teachersMap = {};
  teachersSnap.docs.forEach((doc) => {
    teachersMap[doc.id] = doc.data();
  });

  return Promise.all(
    usersSnap.docs.map(async (doc) => {
      const userData = doc.data();
      const teacherData = teachersMap[doc.id] || {};

      let authDisplayName = "";
      try {
        const authUser = await admin.auth().getUser(doc.id);
        authDisplayName = authUser.displayName || "";
      } catch (_e) {
        authDisplayName = "";
      }

      const emailPrefix = (userData.email || "").split("@")[0];
      const fallbackName = emailPrefix
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

      const fullName =
        teacherData.fullName ||
        teacherData.name ||
        authDisplayName ||
        fallbackName ||
        "Unknown Teacher";

      return {
        id: doc.id,
        uid: doc.id,
        ...teacherData,
        fullName,
        email: userData.email || "",
        isActive: userData.isActive ?? true,
        createdAt: teacherData.createdAt || userData.createdAt || null,
      };
    })
  );
};

export const getAllTeachersPaginated = async ({
  pageSize = 50,
  cursor = "",
} = {}) => {
  const page = await getAllUsersPaginated({
    pageSize,
    cursor,
    filters: { role: "teacher" },
  });

  const items = (page.items || []).map((row) => {
    const emailPrefix = (row.email || "").split("@")[0];
    const fallbackName = emailPrefix
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    const fullName =
      trimText(row.fullName || row.name) ||
      trimText(row.displayName) ||
      fallbackName ||
      "Unknown Teacher";

    return {
      ...row,
      id: row.uid || row.id,
      uid: row.uid || row.id,
      fullName,
      email: row.email || "",
      isActive: row.isActive ?? true,
      createdAt: row.createdAt || null,
    };
  });

  return { items, page: page.page || { pageSize: toNumber(pageSize, 50), hasMore: false, nextCursor: "" } };
};

export const getAllStudents = async () => {
  return getAllStudentsPaginated();
};

export const getAllStudentsPaginated = async ({
  pageSize = 50,
  cursor = "",
  filters = {},
} = {}) => {
  const limitSize = Math.min(200, Math.max(1, toNumber(pageSize, 50)));
  const cleanCursor = trimText(cursor);
  const searchNeedle = lowerText(trimText(filters?.search));
  const hasSearch = Boolean(searchNeedle);

  const usersCollection = db.collection(COLLECTIONS.USERS);
  const baseUsersQuery = usersCollection.where("role", "==", "student");

  const fetchPage = async (pageCursor = "") => {
  let usersSnap = null;
  try {
    let usersQuery = baseUsersQuery.orderBy("createdAt", "desc").limit(limitSize + 1);
    if (pageCursor) {
      const cursorSnap = await usersCollection.doc(pageCursor).get();
      if (cursorSnap.exists) {
        usersQuery = usersQuery.startAfter(cursorSnap);
      }
    }
    usersSnap = await usersQuery.get();
  } catch {
    // Fallback (no composite index required): paginate by implicit document id ordering.
    let usersQuery = baseUsersQuery.limit(limitSize + 1);
    if (pageCursor) {
      const cursorSnap = await usersCollection.doc(pageCursor).get();
      if (cursorSnap.exists) {
        usersQuery = usersQuery.startAfter(cursorSnap);
      }
    }
    usersSnap = await usersQuery.get();
  }
  const rawUsers = usersSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
  const pageUsers = rawUsers.slice(0, limitSize);
  const hasMore = rawUsers.length > limitSize;
  const nextCursor = hasMore ? pageUsers[pageUsers.length - 1]?.id || "" : "";

  const studentIds = pageUsers.map((row) => row.id).filter(Boolean);
  if (!studentIds.length) {
    return {
      items: [],
      page: { pageSize: limitSize, hasMore: false, nextCursor: "" },
    };
  }

  const [studentSnaps, enrollmentsSnaps, securityViolationBatches, courseNameById] =
    await Promise.all([
      Promise.all(studentIds.map((id) => db.collection(COLLECTIONS.STUDENTS).doc(id).get())),
      Promise.all(
        chunkArray(studentIds, 10).map((chunk) =>
          db.collection(COLLECTIONS.ENROLLMENTS).where("studentId", "in", chunk).get()
        )
      ).catch(() => []),
      Promise.all(
        studentIds.map(async (studentId) => {
          try {
            return await db
              .collection(COLLECTIONS.SECURITY_VIOLATIONS)
              .where("studentId", "==", studentId)
              .orderBy("createdAt", "desc")
              .limit(10)
              .get();
          } catch {
            return await db
              .collection(COLLECTIONS.SECURITY_VIOLATIONS)
              .where("studentId", "==", studentId)
              .limit(25)
              .get()
              .catch(() => ({ docs: [] }));
          }
        })
      ),
      getCourseNameByIdMap(),
    ]);

  const studentsMap = studentSnaps.reduce((acc, snap) => {
    if (!snap.exists) return acc;
    acc[snap.id] = snap.data() || {};
    return acc;
  }, {});

  const safeCourseNameById = courseNameById || {};

  const directEnrollments = (Array.isArray(enrollmentsSnaps) ? enrollmentsSnaps : [])
    .flatMap((snap) => (snap?.docs || []).map((doc) => ({ id: doc.id, ...(doc.data() || {}) })));
  const enrollmentsByStudentId = directEnrollments.reduce((acc, row) => {
    const studentId = trimText(row.studentId);
    if (!studentId) return acc;
    if (!acc[studentId]) acc[studentId] = [];
    acc[studentId].push(row);
    return acc;
  }, {});

  const classIds = [
    ...new Set(
      directEnrollments.map((row) => trimText(row.classId)).filter(Boolean)
    ),
  ];
  const classSnaps = await Promise.all(
    classIds.map((classId) => db.collection(COLLECTIONS.CLASSES).doc(classId).get())
  ).catch(() => []);
  const classMap = (classSnaps || []).reduce((acc, snap) => {
    if (!snap?.exists) return acc;
    acc[snap.id] = snap.data() || {};
    return acc;
  }, {});

  const violationsByStudentId = securityViolationBatches.reduce((acc, snap) => {
    const docs = snap?.docs || [];
    docs.forEach((doc) => {
      const row = doc.data() || {};
      const studentId = trimText(row.studentId || row.uid);
      if (!studentId) return;
      if (!acc[studentId]) acc[studentId] = [];
      acc[studentId].push({ id: doc.id, ...row });
    });
    return acc;
  }, {});

  const items = pageUsers.map((entry) => {
    const userData = entry.data || {};
    const studentId = entry.id;
    const studentData = studentsMap[studentId] || {};
    const studentEnrollments = Array.isArray(enrollmentsByStudentId[studentId])
      ? enrollmentsByStudentId[studentId]
      : [];
    const studentViolationRows = Array.isArray(violationsByStudentId[studentId])
      ? [...violationsByStudentId[studentId]]
      : [];

    const enrollmentClassIds = studentEnrollments
      .map((row) => trimText(row.classId))
      .filter(Boolean);
    const studentStoredClasses = Array.isArray(studentData.enrolledClasses)
      ? studentData.enrolledClasses.map((id) => trimText(id)).filter(Boolean)
      : [];
    const enrolledClasses = [...new Set([...studentStoredClasses, ...enrollmentClassIds])];

    const emailPrefix = (userData.email || "").split("@")[0];
    const fallbackName = emailPrefix
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    const fullName =
      studentData.fullName ||
      studentData.name ||
      fallbackName ||
      "Unknown Student";

    const classCourseMap = new Map();
    enrolledClasses.forEach((classId) => {
      const classData = classMap[classId] || {};
      const classCourseIds = getClassAssignedCourseIds(classData);
      classCourseIds.forEach((courseId) => {
        const cleanCourseId = trimText(courseId);
        if (!cleanCourseId) return;
        const key = `${classId}::${cleanCourseId}`;
        if (!classCourseMap.has(key)) {
          classCourseMap.set(key, {
            classId,
            courseId: cleanCourseId,
          });
        }
      });
    });

    const paidEnrollmentRows = studentEnrollments.filter((enrollment) => {
      const status = lowerText(enrollment.status || "active");
      return ACTIVE_ENROLLMENT_STATUSES.has(status);
    });

    const enrolledCourses = paidEnrollmentRows
      .map((enrollment) => {
        const courseId = trimText(enrollment.subjectId || enrollment.courseId);
        const classId = trimText(enrollment.classId);
        if (!courseId) return null;
        return {
          id: `${studentId}_${courseId}_${classId || "class"}`,
          subjectId: courseId,
          courseId,
          classId,
          classIds: classId ? [classId] : [],
          enrollmentType:
            lowerText(enrollment.enrollmentType) === "full_class"
              ? "full_class"
              : "single_course",
          courseName: safeCourseNameById[courseId] || "Subject",
          subjectName: safeCourseNameById[courseId] || "Subject",
          enrolledAt: enrollment.createdAt || enrollment.enrolledAt || null,
          completedAt: enrollment.completedAt || null,
          progress: extractCourseProgress([], courseId, enrollment.progress),
        };
      })
      .filter(Boolean);

    const paidCourseKeys = new Set(
      enrolledCourses.map((course) => `${trimText(course.classId)}::${trimText(course.courseId)}`)
    );
    const lockedCourses = Array.from(classCourseMap.values())
      .filter(
        (row) =>
          !paidCourseKeys.has(`${trimText(row.classId)}::${trimText(row.courseId)}`)
      )
      .map((row) => ({
        id: `${studentId}_${row.courseId}_${row.classId || "class"}_locked`,
        classId: row.classId,
        subjectId: row.courseId,
        courseId: row.courseId,
        courseName: safeCourseNameById[row.courseId] || "Subject",
        subjectName: safeCourseNameById[row.courseId] || "Subject",
      }));
    const avgProgress =
      enrolledCourses.length > 0
        ? Math.round(
            enrolledCourses.reduce((sum, row) => sum + clampPercent(row.progress), 0) /
              enrolledCourses.length
          )
        : 0;

    const recentSecurityViolations = studentViolationRows
      .sort(
        (a, b) =>
          (parseDate(b.createdAt)?.getTime() || 0) -
          (parseDate(a.createdAt)?.getTime() || 0)
      )
      .slice(0, 5)
      .map((row) => ({
        id: row.id,
        reason: trimText(row.reason || "default"),
        page: trimText(row.page || "unknown"),
        attemptNumber: toNumber(row.attemptNumber, 0),
        action: trimText(row.action || "warning"),
        createdAt: row.createdAt || null,
        isResolved: Boolean(row.isResolved),
        resolvedAt: row.resolvedAt || null,
      }));

    return {
      id: studentId,
      uid: studentId,
      ...studentData,
      fullName,
      email: userData.email || "",
      isActive: userData.isActive ?? true,
      status: userData.status || "",
      approvalStatus: studentData.approvalStatus || "",
      createdAt: studentData.createdAt || userData.createdAt || null,
      lastLoginAt: userData.lastLoginAt || null,
      assignedWebDevice: userData.assignedWebDevice || "",
      assignedWebIp: userData.assignedWebIp || "",
      lastKnownWebIp: userData.lastKnownWebIp || "",
      enrolledClasses,
      enrolledClassesCount: enrolledClasses.length,
      enrolledCourses,
      lockedCourses,
      enrolledCoursesCount: enrolledCourses.length,
      lockedCoursesCount: lockedCourses.length,
      avgProgress,
      completedCourses: enrolledCourses.filter(
        (course) => clampPercent(course.progress) >= 100 || Boolean(course.completedAt)
      ).length,
      securityViolationCount: toNumber(
        userData.securityViolationCount,
        recentSecurityViolations.filter((row) => !row.isResolved).length
      ),
      securityViolationLimit: toNumber(userData.securityViolationLimit, 3),
      paymentRejectCount: toNumber(userData.paymentRejectCount, 0),
      paymentRejectLimit: Math.max(1, toNumber(userData.paymentRejectLimit, 3)),
      paymentApprovalBlocked: Boolean(userData.paymentApprovalBlocked),
      paymentApprovalBlockedAt: userData.paymentApprovalBlockedAt || null,
      paymentApprovalBlockedBy: trimText(userData.paymentApprovalBlockedBy),
      paymentApprovalBlockReason: trimText(userData.paymentApprovalBlockReason),
      paymentRejectResetAt: userData.paymentRejectResetAt || null,
      paymentRejectResetBy: trimText(userData.paymentRejectResetBy),
      lastSecurityViolationReason: trimText(userData.lastSecurityViolationReason),
      lastSecurityViolationAt: userData.lastSecurityViolationAt || null,
      securityDeactivatedAt: userData.securityDeactivatedAt || null,
      securityDeactivationReason: trimText(userData.securityDeactivationReason),
      recentSecurityViolations,
    };
  });

  return {
    items,
    page: {
      pageSize: limitSize,
      hasMore,
      nextCursor,
    },
  };
  };

  if (!hasSearch) {
    return fetchPage(cleanCursor);
  }

  const matchSearch = (row) => {
    const haystack = [
      row?.uid,
      row?.id,
      row?.email,
      row?.fullName,
      row?.name,
      row?.phone,
      row?.phoneNumber,
    ]
      .filter(Boolean)
      .map((value) => lowerText(value))
      .join(" | ");
    return haystack.includes(searchNeedle);
  };

  const collected = [];
  let scanCursor = cleanCursor;
  let hasMoreScan = true;
  const maxPages = Math.max(3, Math.ceil(500 / limitSize));
  let scannedPages = 0;

  while (collected.length < limitSize && hasMoreScan && scannedPages < maxPages) {
    const page = await fetchPage(scanCursor);
    const items = Array.isArray(page?.items) ? page.items : [];
    collected.push(...items.filter(matchSearch));
    scanCursor = page?.page?.nextCursor || "";
    hasMoreScan = Boolean(page?.page?.hasMore);
    scannedPages += 1;
    if (!scanCursor) break;
  }

  return {
    items: collected.slice(0, limitSize),
    page: {
      pageSize: limitSize,
      hasMore: hasMoreScan,
      nextCursor: hasMoreScan ? scanCursor : "",
    },
  };
};

export const getAllCourses = async () => {
  const [subjectsSnap, coursesSnap] = await Promise.all([
    db.collection(COLLECTIONS.SUBJECTS).orderBy("createdAt", "desc").get(),
    db.collection(COLLECTIONS.COURSES).orderBy("createdAt", "desc").get(),
  ]);

  const courses = [];
  const seen = new Set();
  subjectsSnap.docs.forEach((doc) => {
    const row = doc.data() || {};
    seen.add(doc.id);
    courses.push({
      id: doc.id,
      ...row,
      title: trimText(row.title) || "Subject",
      source: "subjects",
    });
  });
  coursesSnap.docs.forEach((doc) => {
    if (seen.has(doc.id)) return;
    const row = doc.data() || {};
    courses.push({
      id: doc.id,
      ...row,
      title: trimText(row.title) || "Subject",
      source: "courses",
    });
  });
  const liveCounts = await getLiveEnrollmentCountByCourse(
    courses.map((course) => course.id)
  );

  return courses.map((course) => ({
    ...course,
    enrollmentCount: Math.max(
      Number(course.enrollmentCount || 0),
      Number(liveCounts[course.id] || 0)
    ),
  }));
};

export const getAllClasses = async () => {
  const snap = await db
    .collection(COLLECTIONS.CLASSES)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const getAllPayments = async (filters = {}) => {
  let query = db.collection(COLLECTIONS.PAYMENTS);
  if (filters.method) query = query.where("method", "==", filters.method);
  if (filters.status) query = query.where("status", "==", filters.status);

  const snap = await query.orderBy("createdAt", "desc").get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate()?.toISOString(),
  }));
};

export const getAllInstallments = async () => {
  const snap = await db
    .collection(COLLECTIONS.INSTALLMENTS)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const getAllPromoCodes = async () => {
  const snap = await db
    .collection(COLLECTIONS.PROMO_CODES)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const getAllCertificates = async () => {
  const snap = await db
    .collection(COLLECTIONS.CERTIFICATES)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const getAllAnnouncements = async () => {
  const snap = await db
    .collection(COLLECTIONS.ANNOUNCEMENTS)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const getSiteSettings = async () => {
  const snap = await db.collection(COLLECTIONS.SETTINGS).doc("general").get();
  return snap.exists ? snap.data() : {};
};

export const updateSiteSettings = async (data) => {
  await db.collection(COLLECTIONS.SETTINGS).doc("general").set(data, {
    merge: true,
  });
  return data;
};
