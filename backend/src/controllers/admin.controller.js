import * as adminService from "../services/admin.service.js";
import { db, admin } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";
import { sendRegistrationOTP } from "../services/email.service.js";
import { v4 as uuidv4 } from "uuid";

const normalizeSubjectName = (value = "") => String(value).trim();

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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
    if (startFloor <= today) {
      return "Start date must be in the future";
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
  const teacherSnap = await db.collection(COLLECTIONS.TEACHERS).doc(teacherId).get();
  if (!teacherSnap.exists) return null;
  return {
    teacherId,
    teacherName: teacherSnap.data()?.fullName || "",
  };
};

const buildShiftPayload = async (shiftInput, assignedCourses) => {
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
  if (!teacherMeta) {
    return { error: "Shift teacher not found" };
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

export const createUser = async (req, res) => {
  try {
    const { name, email, password, phone, role, subject, bio } = req.body;

    if (!name || !email || !password || !role) {
      return errorResponse(res, "All fields required", 400);
    }

    const allowedRoles = ["student", "teacher", "admin"];
    if (!allowedRoles.includes(role)) {
      return errorResponse(res, "Invalid role", 400);
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

    batch.set(db.collection(COLLECTIONS.USERS).doc(uid), {
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
      batch.set(db.collection(COLLECTIONS.STUDENTS).doc(uid), {
        uid,
        fullName: name,
        phoneNumber: phone || "",
        enrolledCourses: [],
        certificates: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (role === "teacher") {
      batch.set(db.collection(COLLECTIONS.TEACHERS).doc(uid), {
        uid,
        fullName: name,
        phoneNumber: phone || "",
        subject: subject || "",
        bio: bio || "",
        assignedSubjects: subject ? [subject] : [],
        assignedClasses: [],
        assignedCourses: [],
        profilePicture: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (role === "admin") {
      batch.set(db.collection(COLLECTIONS.ADMINS).doc(uid), {
        uid,
        fullName: name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    return successResponse(
      res,
      { uid, email, role, name },
      `${role} created successfully`,
      201
    );
  } catch (e) {
    if (e.code === "auth/email-already-exists") {
      return errorResponse(res, "Email already in use", 409);
    }
    return errorResponse(res, "Failed to create user", 500);
  }
};

export const updateUser = async (req, res) => {
  try {
    const { uid } = req.params;
    const { name, isActive, phone, subject, bio } = req.body;

    const userSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    if (!userSnap.exists) {
      return errorResponse(res, "User not found", 404);
    }

    const userData = userSnap.data();
    const updates = {};

    if (isActive !== undefined) {
      updates.isActive = isActive;
      if (!isActive) {
        await admin.auth().revokeRefreshTokens(uid);
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.collection(COLLECTIONS.USERS).doc(uid).update(updates);
    }

    if (name || userData.role === "teacher") {
      const roleCol =
        userData.role === "student"
          ? COLLECTIONS.STUDENTS
          : userData.role === "teacher"
          ? COLLECTIONS.TEACHERS
          : COLLECTIONS.ADMINS;

      const roleUpdates = {};
      if (name) roleUpdates.fullName = name;
      if (userData.role === "student") {
        if (phone !== undefined) roleUpdates.phoneNumber = phone;
      }
      if (userData.role === "teacher") {
        if (phone !== undefined) roleUpdates.phoneNumber = phone;
        if (subject !== undefined) {
          roleUpdates.subject = subject;
          roleUpdates.assignedSubjects = subject ? [subject] : [];
        }
        if (bio !== undefined) roleUpdates.bio = bio;
      }

      if (Object.keys(roleUpdates).length > 0) {
        await db.collection(roleCol).doc(uid).set(roleUpdates, { merge: true });
      }

      if (name) {
        await admin.auth().updateUser(uid, { displayName: name });
      }
    }

    return successResponse(res, { uid }, "User updated");
  } catch (e) {
    return errorResponse(res, "Failed to update user", 500);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { uid } = req.params;

    const userSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    if (!userSnap.exists) {
      return errorResponse(res, "User not found", 404);
    }

    const userData = userSnap.data();
    const roleCol =
      userData.role === "student"
        ? COLLECTIONS.STUDENTS
        : userData.role === "teacher"
        ? COLLECTIONS.TEACHERS
        : COLLECTIONS.ADMINS;

    const batch = db.batch();
    batch.delete(db.collection(COLLECTIONS.USERS).doc(uid));
    batch.delete(db.collection(roleCol).doc(uid));
    await batch.commit();

    await admin.auth().deleteUser(uid);

    return successResponse(res, { uid }, "User deleted");
  } catch (e) {
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
    const { device, webIp } = req.body;

    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      deviceResetBy: req.user.uid,
    };
    if (device) updates.assignedWebDevice = device;
    if (webIp) updates.assignedWebIp = webIp;

    await db.collection(COLLECTIONS.USERS).doc(uid).update(updates);
    return successResponse(res, updates, "Device reset");
  } catch (e) {
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
      const resolved = await buildShiftPayload(shift, resolvedCourses);
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
        const resolved = await buildShiftPayload(shift, nextAssignedCourses);
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

    const resolved = await buildShiftPayload(req.body, assignedCourses);
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
      assignedCourses
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
    const requestedCourseId = String(req.body?.courseId || "").trim();

    if (!studentId) {
      return errorResponse(res, "studentId is required", 400);
    }
    if (!shiftId) {
      return errorResponse(res, "shiftId is required", 400);
    }

    const userSnap = await db.collection(COLLECTIONS.USERS).doc(studentId).get();
    if (!userSnap.exists || userSnap.data()?.role !== "student") {
      return errorResponse(res, "Student not found", 404);
    }

    await db.runTransaction(async (transaction) => {
      const classRef = db.collection(COLLECTIONS.CLASSES).doc(classId);
      const classSnap = await transaction.get(classRef);
      if (!classSnap.exists) {
        throw new Error("CLASS_NOT_FOUND");
      }

      const classData = classSnap.data() || {};
      const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
      const assignedCourses = Array.isArray(classData.assignedCourses)
        ? classData.assignedCourses
        : [];
      const students = Array.isArray(classData.students) ? classData.students : [];

      const normalizedStudents = students.map((entry) =>
        typeof entry === "string"
          ? { studentId: entry, shiftId: "", courseId: "", enrolledAt: null }
          : {
              studentId: entry.studentId,
              shiftId: entry.shiftId || "",
              courseId: entry.courseId || "",
              enrolledAt: entry.enrolledAt || null,
            }
      );

      if (normalizedStudents.some((entry) => entry.studentId === studentId)) {
        throw new Error("STUDENT_ALREADY_ENROLLED");
      }

      const capacity = Number(classData.capacity || 0);
      if (normalizedStudents.length >= capacity) {
        throw new Error("CLASS_FULL");
      }

      const shift = shifts.find((item) => item.id === shiftId);
      if (!shift) {
        throw new Error("SHIFT_NOT_FOUND");
      }

      const finalCourseId = requestedCourseId || shift.courseId || "";
      if (!finalCourseId) {
        throw new Error("COURSE_REQUIRED");
      }
      if (!assignedCourses.some((course) => course.courseId === finalCourseId)) {
        throw new Error("COURSE_NOT_ASSIGNED");
      }

      normalizedStudents.push({
        studentId,
        shiftId,
        courseId: finalCourseId,
        enrolledAt: new Date().toISOString(),
      });

      transaction.update(classRef, {
        students: normalizedStudents,
        enrolledCount: normalizedStudents.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return successResponse(
      res,
      { classId, studentId, shiftId },
      "Student enrolled in class"
    );
  } catch (e) {
    if (e.message === "CLASS_NOT_FOUND") {
      return errorResponse(res, "Class not found", 404);
    }
    if (e.message === "STUDENT_ALREADY_ENROLLED") {
      return errorResponse(res, "Student already enrolled in this class", 409);
    }
    if (e.message === "CLASS_FULL") {
      return errorResponse(res, "Class is full", 400);
    }
    if (e.message === "SHIFT_NOT_FOUND") {
      return errorResponse(res, "Shift not found", 404);
    }
    if (e.message === "COURSE_REQUIRED") {
      return errorResponse(res, "Course is required for enrollment", 400);
    }
    if (e.message === "COURSE_NOT_ASSIGNED") {
      return errorResponse(res, "Selected course is not assigned to class", 400);
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
    if (!req.body?.shiftId) {
      const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
      const firstShift = classSnap.data()?.shifts?.[0];
      req.body.shiftId = firstShift?.id || "";
    }
    return addStudentToClass(req, res);
  } catch (e) {
    return errorResponse(res, "Failed to enroll student", 500);
  }
};

export const removeStudentFromClass = async (req, res) => {
  try {
    const { classId, studentId } = req.params;

    await db.runTransaction(async (transaction) => {
      const classRef = db.collection(COLLECTIONS.CLASSES).doc(classId);
      const classSnap = await transaction.get(classRef);
      if (!classSnap.exists) {
        throw new Error("CLASS_NOT_FOUND");
      }

      const classData = classSnap.data() || {};
      const students = Array.isArray(classData.students) ? classData.students : [];
      const normalizedStudents = students.map((entry) =>
        typeof entry === "string"
          ? { studentId: entry, shiftId: "", courseId: "", enrolledAt: null }
          : {
              studentId: entry.studentId,
              shiftId: entry.shiftId || "",
              courseId: entry.courseId || "",
              enrolledAt: entry.enrolledAt || null,
            }
      );

      const nextStudents = normalizedStudents.filter(
        (entry) => entry.studentId !== studentId
      );

      if (nextStudents.length === normalizedStudents.length) {
        throw new Error("STUDENT_NOT_IN_CLASS");
      }

      transaction.update(classRef, {
        students: nextStudents,
        enrolledCount: nextStudents.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return successResponse(res, {}, "Student removed from class");
  } catch (e) {
    if (e.message === "CLASS_NOT_FOUND") {
      return errorResponse(res, "Class not found", 404);
    }
    if (e.message === "STUDENT_NOT_IN_CLASS") {
      return errorResponse(res, "Student is not enrolled in this class", 404);
    }
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
    const data = await adminService.getAllPromoCodes();
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
    } = req.body;

    if (!code || !discountType || !discountValue) {
      return errorResponse(res, "Code, type and value required", 400);
    }

    const upperCode = code.toUpperCase().trim();

    const existing = await db
      .collection(COLLECTIONS.PROMO_CODES)
      .where("code", "==", upperCode)
      .get();
    if (!existing.empty) {
      return errorResponse(res, "Code already exists", 409);
    }

    const ref = await db.collection(COLLECTIONS.PROMO_CODES).add({
      code: upperCode,
      discountType,
      discountValue: Number(discountValue),
      courseId: courseId || null,
      usageLimit: Number(usageLimit) || 0,
      usageCount: 0,
      expiresAt: expiresAt || null,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(
      res,
      { id: ref.id, code: upperCode },
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
    await db.collection(COLLECTIONS.PROMO_CODES).doc(codeId).update(req.body);
    return successResponse(res, {}, "Promo code updated");
  } catch (e) {
    return errorResponse(res, "Failed to update promo code", 500);
  }
};

export const deletePromoCode = async (req, res) => {
  try {
    const { codeId } = req.params;
    await db.collection(COLLECTIONS.PROMO_CODES).doc(codeId).delete();
    return successResponse(res, {}, "Promo code deleted");
  } catch (e) {
    return errorResponse(res, "Failed to delete promo code", 500);
  }
};

export const validatePromoCode = async (req, res) => {
  try {
    const { code, courseId } = req.body;

    const snap = await db
      .collection(COLLECTIONS.PROMO_CODES)
      .where("code", "==", code.toUpperCase())
      .where("isActive", "==", true)
      .get();

    if (snap.empty) {
      return errorResponse(res, "Invalid promo code", 404);
    }

    const promoData = snap.docs[0].data();

    if (promoData.expiresAt && new Date(promoData.expiresAt) < new Date()) {
      return errorResponse(res, "Promo code expired", 400);
    }

    if (promoData.usageLimit > 0 && promoData.usageCount >= promoData.usageLimit) {
      return errorResponse(res, "Promo code usage limit reached", 400);
    }

    if (promoData.courseId && promoData.courseId !== courseId) {
      return errorResponse(
        res,
        "Promo code not valid for this course",
        400
      );
    }

    return successResponse(
      res,
      {
        code: promoData.code,
        discountType: promoData.discountType,
        discountValue: promoData.discountValue,
      },
      "Promo code valid"
    );
  } catch (e) {
    return errorResponse(res, "Failed to validate promo code", 500);
  }
};

export const getCertificates = async (req, res) => {
  try {
    const data = await adminService.getAllCertificates();
    return successResponse(res, data, "Certificates fetched");
  } catch (e) {
    return errorResponse(res, "Failed to fetch certificates", 500);
  }
};

export const generateCertificate = async (req, res) => {
  try {
    const { studentId, courseId } = req.body;

    const [studentSnap, courseSnap] = await Promise.all([
      db.collection(COLLECTIONS.STUDENTS).doc(studentId).get(),
      db.collection(COLLECTIONS.COURSES).doc(courseId).get(),
    ]);

    if (!studentSnap.exists || !courseSnap.exists) {
      return errorResponse(res, "Student or course not found", 404);
    }

    const certId = uuidv4().toUpperCase().substring(0, 12);

    const ref = await db.collection(COLLECTIONS.CERTIFICATES).add({
      studentId,
      studentName: studentSnap.data().fullName,
      courseId,
      courseName: courseSnap.data().title,
      certId,
      qrCode: `https://sumacademy.com/verify/${certId}`,
      issuedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection(COLLECTIONS.STUDENTS).doc(studentId).update({
      certificates: admin.firestore.FieldValue.arrayUnion({
        certId,
        courseId,
        courseName: courseSnap.data().title,
        issuedAt: new Date().toISOString(),
      }),
    });

    return successResponse(
      res,
      { id: ref.id, certId },
      "Certificate generated",
      201
    );
  } catch (e) {
    return errorResponse(res, "Failed to generate certificate", 500);
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
