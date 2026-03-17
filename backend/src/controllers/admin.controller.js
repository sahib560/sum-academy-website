import { admin, db } from "../config/firebase.js";
import {
  getDashboardStats as fetchDashboardStats,
  getRecentEnrollments as fetchRecentEnrollments,
  getTopCourses as fetchTopCourses,
  getRecentActivity as fetchRecentActivity,
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
} from "../services/admin.service.js";
import {
  sendWelcomeEmail,
  sendAnnouncementEmail,
} from "../services/email.service.js";
import {
  successResponse,
  errorResponse,
} from "../utils/response.utils.js";

const getDashboardStats = async (req, res) => {
  try {
    const stats = await fetchDashboardStats();
    return successResponse(res, stats, "Dashboard stats fetched");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getRecentEnrollments = async (req, res) => {
  try {
    const enrollments = await fetchRecentEnrollments(8);
    return successResponse(res, enrollments, "Recent enrollments fetched");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getTopCourses = async (req, res) => {
  try {
    const courses = await fetchTopCourses(5);
    return successResponse(res, courses, "Top courses fetched");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getRecentActivity = async (req, res) => {
  try {
    const activity = await fetchRecentActivity(10);
    return successResponse(res, activity, "Recent activity fetched");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getRevenueChart = async (req, res) => {
  try {
    const days = Number(req.query.days || 7);
    const revenue = await getRevenueByDay(Number.isNaN(days) ? 7 : days);
    return successResponse(res, revenue, "Revenue chart fetched");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getUsers = async (req, res) => {
  try {
    const { role, isActive, search } = req.query;
    const filters = {
      role: role || undefined,
      isActive:
        typeof isActive === "string"
          ? isActive === "true"
          : undefined,
      search: search || undefined,
    };
    const users = await getAllUsers(filters);
    return successResponse(res, users, "Users fetched");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      role,
      subject = "",
      bio = "",
    } = req.body || {};

    const allowedRoles = ["student", "teacher", "admin"];
    if (!allowedRoles.includes(role)) {
      return errorResponse(
        res,
        "Invalid role. Must be student, teacher or admin",
        400
      );
    }

    if (!name || !email || !password) {
      return errorResponse(
        res,
        "Name, email and password are required",
        400
      );
    }

    const firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });

    const uid = firebaseUser.uid;
    await admin.auth().setCustomUserClaims(uid, { role });

    const batch = db.batch();

    batch.set(db.collection("users").doc(uid), {
      uid,
      email,
      role,
      isActive: true,
      assignedWebDevice: "",
      assignedWebIp: "",
      lastKnownWebIp: "",
      lastLoginAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (role === "student") {
      batch.set(db.collection("students").doc(uid), {
        uid,
        fullName: name,
        phoneNumber: phone || "",
        enrolledCourses: [],
        certificates: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (role === "teacher") {
      batch.set(db.collection("teachers").doc(uid), {
        uid,
        fullName: name,
        phoneNumber: phone || "",
        subject,
        bio,
        assignedSubjects: subject ? [subject] : [],
        profilePicture: null,
        assignedClasses: [],
        assignedCourses: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (role === "admin") {
      batch.set(db.collection("admins").doc(uid), {
        uid,
        fullName: name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    try {
      await sendWelcomeEmail(email, name, role);
    } catch (emailError) {
      console.error("Welcome email failed:", emailError.message);
    }

    return successResponse(
      res,
      { user: { uid, email, role, name } },
      `${role.charAt(0).toUpperCase() + role.slice(1)} created`,
      201
    );
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      return errorResponse(res, "Email already in use", 409);
    }
    console.error("Create user error:", error);
    return errorResponse(res, "Failed to create user", 500);
  }
};

const updateUser = async (req, res) => {
  try {
    const { uid } = req.params;
    const { name, phone, isActive } = req.body || {};

    if (!uid) {
      return errorResponse(res, "Missing user uid", 400);
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return errorResponse(res, "User not found", 404);
    }

    const user = userSnap.data();
    const updates = {};
    if (typeof isActive === "boolean") {
      updates.isActive = isActive;
    }

    if (Object.keys(updates).length > 0) {
      await userRef.update(updates);
    }

    if (user.role === "student" && (name || phone)) {
      const studentUpdates = {};
      if (name) studentUpdates.fullName = name;
      if (phone) studentUpdates.phoneNumber = phone;
      if (Object.keys(studentUpdates).length > 0) {
        await db.collection("students").doc(uid).set(studentUpdates, {
          merge: true,
        });
      }
    }

    if (user.role === "teacher" && name) {
      await db.collection("teachers").doc(uid).set({ fullName: name }, {
        merge: true,
      });
    }

    if (user.role === "admin" && name) {
      await db.collection("admins").doc(uid).set({ fullName: name }, {
        merge: true,
      });
    }

    if (isActive === false) {
      await admin.auth().revokeRefreshTokens(uid);
    }

    const updatedSnap = await userRef.get();
    return successResponse(res, updatedSnap.data(), "User updated");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const resetUserDevice = async (req, res) => {
  try {
    const { uid } = req.params;
    const { device, webIp } = req.body || {};

    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      deviceResetBy: req.user.uid,
    };

    if (device) updateData.assignedWebDevice = device;
    if (webIp) {
      updateData.assignedWebIp = webIp;
      updateData.lastKnownWebIp = webIp;
    }

    await db.collection("users").doc(uid).update(updateData);

    return successResponse(res, updateData, "Device reset successfully");
  } catch (error) {
    return errorResponse(res, "Failed to reset device", 500);
  }
};

const deleteUser = async (req, res) => {
  try {
    const { uid } = req.params;
    if (!uid) {
      return errorResponse(res, "Missing user uid", 400);
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return errorResponse(res, "User not found", 404);
    }

    const user = userSnap.data();
    await admin.auth().deleteUser(uid);
    await userRef.delete();

    if (user.role === "student") {
      await db.collection("students").doc(uid).delete();
    }
    if (user.role === "teacher") {
      await db.collection("teachers").doc(uid).delete();
    }
    if (user.role === "admin") {
      await db.collection("admins").doc(uid).delete();
    }

    return successResponse(res, { message: "User deleted" }, "User deleted");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const setUserRole = async (req, res) => {
  try {
    const { uid, role } = req.body || {};
    const allowedRoles = ["admin", "teacher", "student"];

    if (!uid || !allowedRoles.includes(role)) {
      return errorResponse(res, "Invalid role", 400);
    }

    await db.collection("users").doc(uid).update({ role });
    await admin.auth().setCustomUserClaims(uid, { role });

    return successResponse(res, { message: "Role updated" }, "Role updated");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getTeachers = async (req, res) => {
  try {
    const teachers = await getAllTeachers();
    return successResponse(res, teachers, "Teachers fetched");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const createTeacher = async (req, res) => {
  try {
    const { name, email, password, phone, subject, bio } = req.body || {};

    if (!name || !email || !password) {
      return errorResponse(
        res,
        "Name, email and password are required",
        400
      );
    }

    const firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });

    const uid = firebaseUser.uid;
    await admin.auth().setCustomUserClaims(uid, { role: "teacher" });

    const batch = db.batch();

    batch.set(db.collection("users").doc(uid), {
      uid,
      email,
      role: "teacher",
      isActive: true,
      assignedWebDevice: "",
      assignedWebIp: "",
      lastKnownWebIp: "",
      lastLoginAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.set(db.collection("teachers").doc(uid), {
      uid,
      fullName: name,
      phoneNumber: phone || "",
      subject: subject || "",
      bio: bio || "",
      assignedSubjects: subject ? [subject] : [],
      profilePicture: null,
      assignedClasses: [],
      assignedCourses: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return successResponse(
      res,
      { user: { uid, email, role: "teacher", name } },
      "Teacher account created successfully",
      201
    );
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      return errorResponse(res, "Email already in use", 409);
    }
    console.error("Create teacher error:", error);
    return errorResponse(res, "Failed to create teacher", 500);
  }
};

const getStudents = async (req, res) => {
  try {
    const students = await getAllStudents();
    return successResponse(res, students, "Students fetched");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getCourses = async (req, res) => {
  try {
    const courses = await getAllCourses();
    return successResponse(res, courses, "Courses fetched");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const createCourse = async (req, res) => {
  try {
    const { title, description, category, teacherId, price, level } =
      req.body || {};

    if (!title || !description || !category || !teacherId) {
      return errorResponse(res, "Missing required fields", 400);
    }

    const courseRef = await db.collection("courses").add({
      title,
      description,
      category,
      teacherId,
      price: price || 0,
      status: "draft",
      level: level || "",
      enrollmentCount: 0,
      chapters: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const courseSnap = await courseRef.get();
    return successResponse(
      res,
      { id: courseRef.id, ...courseSnap.data() },
      "Course created",
      201
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};

const updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!courseId) {
      return errorResponse(res, "Missing course id", 400);
    }

    await db.collection("courses").doc(courseId).update(req.body || {});
    const updated = await db.collection("courses").doc(courseId).get();
    return successResponse(
      res,
      { id: courseId, ...updated.data() },
      "Course updated"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};

const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!courseId) {
      return errorResponse(res, "Missing course id", 400);
    }

    await db.collection("courses").doc(courseId).delete();
    return successResponse(res, { message: "Course deleted" }, "Course deleted");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getClasses = async (req, res) => {
  try {
    const classes = await getAllClasses();
    return successResponse(res, classes, "Classes fetched");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const createClass = async (req, res) => {
  try {
    const { name, teacherId, startDate, endDate, capacity, description } =
      req.body || {};

    if (!name || !teacherId || !startDate || !endDate) {
      return errorResponse(res, "Missing required fields", 400);
    }

    const classRef = await db.collection("classes").add({
      name,
      teacherId,
      startDate,
      endDate,
      capacity: capacity || 0,
      description: description || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const classSnap = await classRef.get();
    return successResponse(
      res,
      { id: classRef.id, ...classSnap.data() },
      "Class created",
      201
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getPayments = async (req, res) => {
  try {
    const { method, status, startDate, endDate } = req.query || {};
    const filters = {
      method: method || undefined,
      status: status || undefined,
      dateRange:
        startDate || endDate
          ? {
              start: startDate ? new Date(startDate) : undefined,
              end: endDate ? new Date(endDate) : undefined,
            }
          : undefined,
    };

    const payments = await getAllPayments(filters);
    return successResponse(res, payments, "Payments fetched");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const verifyBankTransfer = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { action = "approve" } = req.body || {};

    if (!paymentId) {
      return errorResponse(res, "Missing payment id", 400);
    }

    const paymentRef = db.collection("payments").doc(paymentId);
    const paymentSnap = await paymentRef.get();

    if (!paymentSnap.exists) {
      return errorResponse(res, "Payment not found", 404);
    }

    const updates =
      action === "approve"
        ? {
            status: "paid",
            verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          }
        : { status: "rejected" };

    await paymentRef.update(updates);

    if (action === "approve") {
      const payment = paymentSnap.data() || {};
      if (payment.enrollmentId) {
        await db.collection("enrollments").doc(payment.enrollmentId).set(
          {
            status: "active",
            accessGranted: true,
          },
          { merge: true }
        );
      }
    }

    const updated = await paymentRef.get();
    return successResponse(
      res,
      { id: updated.id, ...updated.data() },
      "Payment updated"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getPromoCodes = async (req, res) => {
  try {
    const promoCodes = await getAllPromoCodes();
    return successResponse(res, promoCodes, "Promo codes fetched");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const createPromoCode = async (req, res) => {
  try {
    const { code, discountType, discountValue, courseId, usageLimit, expiresAt } =
      req.body || {};

    if (!code || !discountType || !discountValue) {
      return errorResponse(res, "Missing required fields", 400);
    }

    const normalizedCode = code.toUpperCase();
    const existing = await db
      .collection("promoCodes")
      .where("code", "==", normalizedCode)
      .limit(1)
      .get();

    if (!existing.empty) {
      return errorResponse(res, "Promo code already exists", 400);
    }

    const promoRef = await db.collection("promoCodes").add({
      code: normalizedCode,
      discountType,
      discountValue,
      courseId: courseId || null,
      usageLimit: usageLimit || 0,
      usageCount: 0,
      expiresAt: expiresAt || null,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const promoSnap = await promoRef.get();
    return successResponse(
      res,
      { id: promoRef.id, ...promoSnap.data() },
      "Promo code created",
      201
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getCertificates = async (req, res) => {
  try {
    const certificates = await getAllCertificates();
    return successResponse(res, certificates, "Certificates fetched");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getAnnouncements = async (req, res) => {
  try {
    const announcements = await getAllAnnouncements();
    return successResponse(res, announcements, "Announcements fetched");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const createAnnouncement = async (req, res) => {
  try {
    const { title, message, targetType, targetId, sendEmail } = req.body || {};
    if (!title || !message || !targetType) {
      return errorResponse(res, "Missing required fields", 400);
    }

    const announcementRef = await db.collection("announcements").add({
      title,
      message,
      targetType,
      targetId: targetId || null,
      sendEmail: Boolean(sendEmail),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (sendEmail) {
      let studentIds = [];
      if (targetType === "course" && targetId) {
        const enrollmentsSnap = await db
          .collection("enrollments")
          .where("courseId", "==", targetId)
          .get();
        studentIds = enrollmentsSnap.docs
          .map((doc) => doc.data()?.studentId)
          .filter(Boolean);
      } else if (targetType === "class" && targetId) {
        const enrollmentsSnap = await db
          .collection("enrollments")
          .where("classId", "==", targetId)
          .get();
        studentIds = enrollmentsSnap.docs
          .map((doc) => doc.data()?.studentId)
          .filter(Boolean);
      } else {
        const studentsSnap = await db
          .collection("users")
          .where("role", "==", "student")
          .get();
        studentIds = studentsSnap.docs.map((doc) => doc.id);
      }

      const studentSnaps = await Promise.all(
        [...new Set(studentIds)].map((id) =>
          db.collection("users").doc(id).get()
        )
      );

      await Promise.all(
        studentSnaps
          .filter((snap) => snap.exists)
          .map((snap) => {
            const data = snap.data() || {};
            if (!data.email) return null;
            return sendAnnouncementEmail(data.email, title, message);
          })
          .filter(Boolean)
      );
    }

    const announcementSnap = await announcementRef.get();
    return successResponse(
      res,
      { id: announcementRef.id, ...announcementSnap.data() },
      "Announcement created",
      201
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};

export {
  getDashboardStats,
  getRecentEnrollments,
  getTopCourses,
  getRecentActivity,
  getRevenueChart,
  getUsers,
  createUser,
  updateUser,
  resetUserDevice,
  deleteUser,
  setUserRole,
  getTeachers,
  createTeacher,
  getStudents,
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getClasses,
  createClass,
  getPayments,
  verifyBankTransfer,
  getPromoCodes,
  createPromoCode,
  getCertificates,
  getAnnouncements,
  createAnnouncement,
};
