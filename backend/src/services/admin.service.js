import { db, admin } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";

const trimText = (value = "") => String(value || "").trim();
const lowerText = (value = "") => trimText(value).toLowerCase();
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const clampPercent = (value) => Math.max(0, Math.min(100, toNumber(value, 0)));
const chunkArray = (rows = [], size = 10) => {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
};

const ACTIVE_ENROLLMENT_STATUSES = new Set([
  "active",
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
            courseId: trimText(entry?.courseId),
            enrolledAt: entry?.enrolledAt || null,
          }
    )
    .filter((entry) => Boolean(entry.studentId));
};

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
          status: "active",
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

  const enrollmentSnapshots = await Promise.all(
    chunkArray(cleanCourseIds, 10).map((ids) =>
      db.collection(COLLECTIONS.ENROLLMENTS).where("courseId", "in", ids).get()
    )
  );
  const directRows = enrollmentSnapshots.flatMap((snap) =>
    snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
  );

  const classesSnap = await db.collection(COLLECTIONS.CLASSES).get();
  const classDocs = classesSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
  const inferredRows = buildClassDerivedEnrollmentRows(classDocs, cleanCourseIds);

  const mergedRows = mergeEnrollmentRowsByStudentCourse(directRows, inferredRows);
  return mergedRows.reduce((acc, row) => {
    const courseId = trimText(row.courseId);
    if (!courseId) return acc;
    acc[courseId] = (acc[courseId] || 0) + 1;
    return acc;
  }, {});
};

export const getDashboardStats = async () => {
  const [
    studentsSnap,
    teachersSnap,
    coursesSnap,
    classesSnap,
    paymentsSnap,
    enrollmentsSnap,
    pendingPaymentsSnap,
    pendingApprovalsSnap,
  ] = await Promise.all([
    db.collection(COLLECTIONS.USERS).where("role", "==", "student").count().get(),
    db.collection(COLLECTIONS.TEACHERS).count().get(),
    db.collection(COLLECTIONS.COURSES).count().get(),
    db.collection(COLLECTIONS.CLASSES).count().get(),
    db.collection(COLLECTIONS.PAYMENTS).where("status", "==", "paid").get(),
    db
      .collection(COLLECTIONS.ENROLLMENTS)
      .where("status", "==", "active")
      .count()
      .get(),
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
    totalCourses: coursesSnap.data().count,
    totalClasses: classesSnap.data().count,
    totalRevenue,
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
  const snap = await db
    .collection(COLLECTIONS.COURSES)
    .orderBy("enrollmentCount", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
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

export const getAllStudents = async () => {
  const [studentsSnap, usersSnap, enrollmentsSnap, classesSnap, coursesSnap, progressSnap] =
    await Promise.all([
    db.collection(COLLECTIONS.STUDENTS).get(),
    db.collection(COLLECTIONS.USERS).where("role", "==", "student").get(),
    db.collection(COLLECTIONS.ENROLLMENTS).get(),
    db.collection(COLLECTIONS.CLASSES).get(),
    db.collection(COLLECTIONS.COURSES).get(),
    db.collection(COLLECTIONS.PROGRESS).get(),
  ]);

  const studentsMap = {};
  studentsSnap.docs.forEach((doc) => {
    studentsMap[doc.id] = doc.data();
  });

  const courseNameById = coursesSnap.docs.reduce((acc, doc) => {
    acc[doc.id] = trimText(doc.data()?.title) || "Course";
    return acc;
  }, {});

  const directEnrollments = enrollmentsSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() || {}),
  }));
  const classDocs = classesSnap.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() || {},
  }));
  const inferredEnrollments = buildClassDerivedEnrollmentRows(classDocs);
  const mergedEnrollments = mergeEnrollmentRowsByStudentCourse(
    directEnrollments,
    inferredEnrollments
  );
  const enrollmentsByStudentId = mergedEnrollments.reduce((acc, row) => {
    const studentId = trimText(row.studentId);
    if (!studentId) return acc;
    if (!acc[studentId]) acc[studentId] = [];
    acc[studentId].push(row);
    return acc;
  }, {});

  const progressByStudentId = progressSnap.docs.reduce((acc, doc) => {
    const row = doc.data() || {};
    const studentId = trimText(row.studentId);
    if (!studentId) return acc;
    if (!acc[studentId]) acc[studentId] = [];
    acc[studentId].push(row);
    return acc;
  }, {});

  return usersSnap.docs.map((doc) => {
    const userData = doc.data();
    const studentData = studentsMap[doc.id] || {};
    const studentId = doc.id;
    const studentEnrollments = Array.isArray(enrollmentsByStudentId[studentId])
      ? enrollmentsByStudentId[studentId]
      : [];
    const studentProgressRows = Array.isArray(progressByStudentId[studentId])
      ? progressByStudentId[studentId]
      : [];

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

    const enrolledCoursesFromRows = studentEnrollments.map((row) => {
      const courseId = trimText(row.courseId);
      return {
        id: `${studentId}_${courseId}`,
        courseId,
        classId: trimText(row.classId),
        courseName: courseNameById[courseId] || "Course",
        enrolledAt: row.createdAt || row.enrolledAt || null,
        completedAt: row.completedAt || null,
        progress: extractCourseProgress(studentProgressRows, courseId, row.progress),
      };
    });

    const profileCourses = Array.isArray(studentData.enrolledCourses)
      ? studentData.enrolledCourses
      : [];
    const mergedCourseMap = new Map(
      enrolledCoursesFromRows.map((course) => [trimText(course.courseId), course])
    );
    profileCourses.forEach((entry, index) => {
      const courseId = trimText(typeof entry === "string" ? entry : entry?.courseId || entry?.id);
      if (!courseId) return;
      if (mergedCourseMap.has(courseId)) return;
      mergedCourseMap.set(courseId, {
        id: `${studentId}_profile_${index}`,
        courseId,
        classId: trimText(entry?.classId),
        courseName:
          trimText(typeof entry === "string" ? "" : entry?.courseName || entry?.name) ||
          courseNameById[courseId] ||
          "Course",
        enrolledAt: typeof entry === "string" ? null : entry?.enrolledAt || entry?.createdAt || null,
        completedAt: typeof entry === "string" ? null : entry?.completedAt || null,
        progress: extractCourseProgress(
          studentProgressRows,
          courseId,
          typeof entry === "string" ? 0 : entry?.progress
        ),
      });
    });

    const enrolledCourses = Array.from(mergedCourseMap.values());
    const avgProgress =
      enrolledCourses.length > 0
        ? Math.round(
            enrolledCourses.reduce((sum, row) => sum + clampPercent(row.progress), 0) /
              enrolledCourses.length
          )
        : 0;

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
      enrolledCourses,
      avgProgress,
      completedCourses: enrolledCourses.filter(
        (course) => clampPercent(course.progress) >= 100 || Boolean(course.completedAt)
      ).length,
    };
  });
};

export const getAllCourses = async () => {
  const snap = await db
    .collection(COLLECTIONS.COURSES)
    .orderBy("createdAt", "desc")
    .get();
  const courses = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
