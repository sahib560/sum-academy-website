import { db, admin } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";

export const getDashboardStats = async () => {
  const [
    studentsSnap,
    teachersSnap,
    coursesSnap,
    classesSnap,
    paymentsSnap,
    enrollmentsSnap,
    pendingPaymentsSnap,
  ] = await Promise.all([
    db.collection(COLLECTIONS.STUDENTS).count().get(),
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
  const [studentsSnap, usersSnap] = await Promise.all([
    db.collection(COLLECTIONS.STUDENTS).get(),
    db.collection(COLLECTIONS.USERS).where("role", "==", "student").get(),
  ]);

  const studentsMap = {};
  studentsSnap.docs.forEach((doc) => {
    studentsMap[doc.id] = doc.data();
  });

  return usersSnap.docs.map((doc) => {
    const userData = doc.data();
    const studentData = studentsMap[doc.id] || {};

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

    return {
      id: doc.id,
      uid: doc.id,
      ...studentData,
      fullName,
      email: userData.email || "",
      isActive: userData.isActive ?? true,
      createdAt: studentData.createdAt || userData.createdAt || null,
      lastLoginAt: userData.lastLoginAt || null,
      assignedWebDevice: userData.assignedWebDevice || "",
      assignedWebIp: userData.assignedWebIp || "",
      lastKnownWebIp: userData.lastKnownWebIp || "",
    };
  });
};

export const getAllCourses = async () => {
  const snap = await db
    .collection(COLLECTIONS.COURSES)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
