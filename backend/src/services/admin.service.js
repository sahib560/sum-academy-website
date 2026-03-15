import { admin, db } from "../config/firebase.js";

const getCollectionCount = async (collectionRef) => {
  const snapshot = await collectionRef.get();
  return snapshot.size;
};

const sumPaidRevenue = async () => {
  const snapshot = await db
    .collection("payments")
    .where("status", "==", "paid")
    .get();

  let total = 0;
  snapshot.forEach((doc) => {
    const amount = Number(doc.data()?.amount || 0);
    total += Number.isNaN(amount) ? 0 : amount;
  });

  return total;
};

const resolveUserName = (userDoc) => {
  if (!userDoc) return "Unknown";
  return (
    userDoc.fullName ||
    userDoc.name ||
    userDoc.displayName ||
    userDoc.email ||
    "Unknown"
  );
};

const resolveCourseName = (courseDoc) => {
  if (!courseDoc) return "Unknown";
  return courseDoc.title || courseDoc.name || "Unknown";
};

const getDashboardStats = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    totalStudents,
    totalTeachers,
    totalCourses,
    totalClasses,
    totalRevenue,
    enrollmentsToday,
    activeUsers,
    pendingBankTransfers,
  ] = await Promise.all([
    getCollectionCount(db.collection("students")),
    getCollectionCount(db.collection("teachers")),
    getCollectionCount(db.collection("courses")),
    getCollectionCount(db.collection("classes")),
    sumPaidRevenue(),
    db
      .collection("enrollments")
      .where(
        "createdAt",
        ">=",
        admin.firestore.Timestamp.fromDate(startOfDay)
      )
      .get()
      .then((snap) => snap.size),
    db
      .collection("users")
      .where("isActive", "==", true)
      .get()
      .then((snap) => snap.size),
    db
      .collection("payments")
      .where("method", "==", "bank_transfer")
      .where("status", "==", "pending")
      .get()
      .then((snap) => snap.size),
  ]);

  return {
    totalStudents,
    totalTeachers,
    totalCourses,
    totalClasses,
    totalRevenue,
    enrollmentsToday,
    activeUsers,
    pendingBankTransfers,
  };
};

const getRecentEnrollments = async (limit = 8) => {
  const snapshot = await db
    .collection("enrollments")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const results = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data() || {};
      const studentId = data.studentId || data.studentUid || data.uid;
      const courseId = data.courseId;

      const [studentSnap, courseSnap] = await Promise.all([
        studentId ? db.collection("users").doc(studentId).get() : null,
        courseId ? db.collection("courses").doc(courseId).get() : null,
      ]);

      const studentName = studentSnap?.exists
        ? resolveUserName(studentSnap.data())
        : "Unknown";
      const courseName = courseSnap?.exists
        ? resolveCourseName(courseSnap.data())
        : "Unknown";

      return {
        id: doc.id,
        studentName,
        courseName,
        amount: data.amount || 0,
        method: data.method || "unknown",
        status: data.status || "pending",
        createdAt: data.createdAt || null,
      };
    })
  );

  return results;
};

const getTopCourses = async (limit = 5) => {
  const snapshot = await db
    .collection("courses")
    .orderBy("enrollmentCount", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      title: data.title || data.name || "Untitled",
      teacherName: data.teacherName || "",
      enrollmentCount: data.enrollmentCount || 0,
      revenue: data.revenue || 0,
    };
  });
};

const getRecentActivity = async (limit = 10) => {
  const snapshot = await db
    .collection("auditLogs")
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      action: data.action || "",
      uid: data.uid || "",
      email: data.email || "",
      ip: data.ip || "",
      device: data.device || "",
      timestamp: data.timestamp || null,
    };
  });
};

const getRevenueByDay = async (days = 7) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const snapshot = await db
    .collection("payments")
    .where("status", "==", "paid")
    .where(
      "createdAt",
      ">=",
      admin.firestore.Timestamp.fromDate(startDate)
    )
    .get();

  const totals = {};
  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const createdAt = data.createdAt?.toDate?.() || null;
    if (!createdAt) return;
    const key = createdAt.toISOString().slice(0, 10);
    const amount = Number(data.amount || 0);
    totals[key] = (totals[key] || 0) + (Number.isNaN(amount) ? 0 : amount);
  });

  return Object.keys(totals)
    .sort()
    .map((date) => ({ date, amount: totals[date] }));
};

const getAllUsers = async (filters = {}) => {
  let query = db.collection("users");

  if (filters.role) {
    query = query.where("role", "==", filters.role);
  }
  if (typeof filters.isActive === "boolean") {
    query = query.where("isActive", "==", filters.isActive);
  }

  const snapshot = await query.get();
  let users = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  if (filters.search) {
    const term = filters.search.toLowerCase();
    users = users.filter((user) => {
      const name =
        user.fullName ||
        user.name ||
        user.displayName ||
        user.email ||
        "";
      return name.toLowerCase().includes(term);
    });
  }

  return users;
};

const getAllTeachers = async () => {
  const snapshot = await db.collection("teachers").get();
  const results = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data() || {};
      const userSnap = await db.collection("users").doc(data.uid).get();
      return {
        id: doc.id,
        ...(userSnap.exists ? userSnap.data() : {}),
        ...data,
      };
    })
  );
  return results;
};

const getAllStudents = async () => {
  const snapshot = await db.collection("students").get();
  const results = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data() || {};
      const userSnap = await db.collection("users").doc(data.uid).get();
      return {
        id: doc.id,
        ...(userSnap.exists ? userSnap.data() : {}),
        ...data,
      };
    })
  );
  return results;
};

const getAllCourses = async () => {
  const snapshot = await db.collection("courses").get();
  const results = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data() || {};
      const teacherId = data.teacherId;
      const teacherSnap = teacherId
        ? await db.collection("users").doc(teacherId).get()
        : null;
      const teacherName =
        teacherSnap?.exists ? resolveUserName(teacherSnap.data()) : "Unknown";
      return {
        id: doc.id,
        ...data,
        teacherName,
      };
    })
  );
  return results;
};

const getAllClasses = async () => {
  const snapshot = await db.collection("classes").get();
  const results = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data() || {};
      const teacherId = data.teacherId;
      const teacherSnap = teacherId
        ? await db.collection("users").doc(teacherId).get()
        : null;
      const teacherName =
        teacherSnap?.exists ? resolveUserName(teacherSnap.data()) : "Unknown";
      return {
        id: doc.id,
        ...data,
        teacherName,
      };
    })
  );
  return results;
};

const getAllPayments = async (filters = {}) => {
  let query = db.collection("payments");

  if (filters.method) {
    query = query.where("method", "==", filters.method);
  }
  if (filters.status) {
    query = query.where("status", "==", filters.status);
  }
  if (filters.dateRange?.start) {
    query = query.where(
      "createdAt",
      ">=",
      admin.firestore.Timestamp.fromDate(filters.dateRange.start)
    );
  }
  if (filters.dateRange?.end) {
    query = query.where(
      "createdAt",
      "<=",
      admin.firestore.Timestamp.fromDate(filters.dateRange.end)
    );
  }

  const snapshot = await query.get();
  const results = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data() || {};
      const studentId = data.studentId || data.studentUid || data.uid;
      const courseId = data.courseId;
      const [studentSnap, courseSnap] = await Promise.all([
        studentId ? db.collection("users").doc(studentId).get() : null,
        courseId ? db.collection("courses").doc(courseId).get() : null,
      ]);
      return {
        id: doc.id,
        ...data,
        studentName: studentSnap?.exists
          ? resolveUserName(studentSnap.data())
          : "Unknown",
        courseName: courseSnap?.exists
          ? resolveCourseName(courseSnap.data())
          : "Unknown",
      };
    })
  );
  return results;
};

const getAllPromoCodes = async () => {
  const snapshot = await db.collection("promoCodes").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const getAllCertificates = async () => {
  const snapshot = await db.collection("certificates").get();
  const results = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data() || {};
      const studentId = data.studentId || data.studentUid || data.uid;
      const courseId = data.courseId;
      const [studentSnap, courseSnap] = await Promise.all([
        studentId ? db.collection("users").doc(studentId).get() : null,
        courseId ? db.collection("courses").doc(courseId).get() : null,
      ]);
      return {
        id: doc.id,
        ...data,
        studentName: studentSnap?.exists
          ? resolveUserName(studentSnap.data())
          : "Unknown",
        courseName: courseSnap?.exists
          ? resolveCourseName(courseSnap.data())
          : "Unknown",
      };
    })
  );
  return results;
};

const getAllAnnouncements = async () => {
  const snapshot = await db
    .collection("announcements")
    .orderBy("createdAt", "desc")
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export {
  getDashboardStats,
  getRecentEnrollments,
  getTopCourses,
  getRecentActivity,
  getRevenueByDay,
  getAllUsers,
  getAllTeachers,
  getAllStudents,
  getAllCourses,
  getAllClasses,
  getAllPayments,
  getAllPromoCodes,
  getAllCertificates,
  getAllAnnouncements,
};
