import { admin, db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { errorResponse, successResponse } from "../utils/response.utils.js";
import { sendAnnouncementEmail } from "../services/email.service.js";

const TARGET_TYPES = new Set(["system", "class", "course", "single_user"]);
const AUDIENCE_ROLES = new Set(["student", "teacher", "admin", "all"]);
const trimText = (value = "") => String(value || "").trim();

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeAnnouncementDoc = (doc) => {
  const data = doc.data() || {};
  return {
    id: doc.id,
    ...data,
    createdAt: toDate(data.createdAt)?.toISOString() || null,
    updatedAt: toDate(data.updatedAt)?.toISOString() || null,
  };
};

const getUserProfile = async (uid) => {
  const userSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
  if (!userSnap.exists) return null;

  const userData = userSnap.data() || {};
  const role = userData.role || "";
  let fullName = "";

  const roleCollection =
    role === "student"
      ? COLLECTIONS.STUDENTS
      : role === "teacher"
      ? COLLECTIONS.TEACHERS
      : role === "admin"
      ? COLLECTIONS.ADMINS
      : null;

  if (roleCollection) {
    const roleSnap = await db.collection(roleCollection).doc(uid).get();
    if (roleSnap.exists) {
      const roleData = roleSnap.data() || {};
      fullName = roleData.fullName || roleData.name || "";
    }
  }

  if (!fullName) {
    fullName = userData.fullName || (userData.email || "").split("@")[0] || "User";
  }

  return {
    uid,
    role,
    email: userData.email || "",
    fullName,
  };
};

const getPosterName = async (uid) => {
  if (!uid) return "Admin";
  const adminSnap = await db.collection(COLLECTIONS.ADMINS).doc(uid).get();
  if (adminSnap.exists) {
    return adminSnap.data()?.fullName || "Admin";
  }
  const profile = await getUserProfile(uid);
  return profile?.fullName || "Admin";
};

const extractStudentIdsFromClass = (classData) => {
  const students = Array.isArray(classData?.students) ? classData.students : [];
  const ids = students
    .map((entry) => (typeof entry === "string" ? entry : entry?.studentId))
    .filter(Boolean);
  return [...new Set(ids)];
};

const getUsersByRole = async (role) => {
  const usersSnap = await db.collection(COLLECTIONS.USERS).get();
  if (role === "all") {
    return usersSnap.docs.map((doc) => doc.id);
  }

  const normalizedRole = String(role || "").toLowerCase();
  return usersSnap.docs
    .filter(
      (doc) => String(doc.data()?.role || "").toLowerCase() === normalizedRole
    )
    .map((doc) => doc.id);
};

const isTeacherAssignedToCourse = (courseData = {}, teacherUid = "") => {
  const uid = trimText(teacherUid);
  if (!uid) return false;

  if (trimText(courseData?.teacherId) === uid) return true;
  const subjects = Array.isArray(courseData?.subjects) ? courseData.subjects : [];
  return subjects.some((subject) => trimText(subject?.teacherId) === uid);
};

const getTeacherAssignedCourseIds = async (teacherUid = "") => {
  const uid = trimText(teacherUid);
  if (!uid) return [];

  const coursesSnap = await db.collection(COLLECTIONS.COURSES).get();
  return coursesSnap.docs
    .filter((doc) => isTeacherAssignedToCourse(doc.data() || {}, uid))
    .map((doc) => doc.id);
};

const getTargetedRecipientIds = async ({ targetType, targetId, audienceRole }) => {
  let targetName = "All Users";
  let recipientIds = [];
  let resolvedAudienceRole = audienceRole;

  if (targetType === "system") {
    recipientIds = await getUsersByRole(audienceRole);
    if (audienceRole === "student") targetName = "All Students";
    if (audienceRole === "teacher") targetName = "All Teachers";
    if (audienceRole === "admin") targetName = "All Admins";
    if (audienceRole === "all") targetName = "All Users";
    return { targetName, recipientIds, resolvedAudienceRole };
  }

  if (targetType === "class") {
    const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(targetId).get();
    if (!classSnap.exists) {
      throw new Error("CLASS_NOT_FOUND");
    }
    targetName = classSnap.data()?.name || "Class";
    recipientIds = extractStudentIdsFromClass(classSnap.data() || {});
    return { targetName, recipientIds, resolvedAudienceRole };
  }

  if (targetType === "course") {
    const courseSnap = await db.collection(COLLECTIONS.COURSES).doc(targetId).get();
    if (!courseSnap.exists) {
      throw new Error("COURSE_NOT_FOUND");
    }
    targetName = courseSnap.data()?.title || "Course";

    const enrollmentSnap = await db
      .collection(COLLECTIONS.ENROLLMENTS)
      .where("courseId", "==", targetId)
      .get();

    recipientIds = [
      ...new Set(
        enrollmentSnap.docs
          .map((doc) => doc.data()?.studentId)
          .filter(Boolean)
      ),
    ];
    return { targetName, recipientIds, resolvedAudienceRole };
  }

  if (targetType === "single_user") {
    const normalizedUserId = String(targetId || "").trim();
    if (!normalizedUserId) {
      throw new Error("USER_ID_REQUIRED");
    }

    const profile = await getUserProfile(normalizedUserId);
    if (!profile) {
      throw new Error("USER_NOT_FOUND");
    }

    targetName = profile.fullName || profile.email || "User";
    recipientIds = [profile.uid];
    resolvedAudienceRole = profile.role || "all";

    return { targetName, recipientIds, resolvedAudienceRole };
  }

  return { targetName, recipientIds, resolvedAudienceRole };
};

const sendAnnouncementEmails = async ({
  recipientIds,
  title,
  message,
  targetName,
}) => {
  if (!Array.isArray(recipientIds) || recipientIds.length < 1) {
    return { sent: 0 };
  }

  const users = [];
  for (const uid of recipientIds) {
    const profile = await getUserProfile(uid);
    if (profile?.email) {
      users.push(profile);
    }
  }

  const results = await Promise.allSettled(
    users.map((profile) =>
      sendAnnouncementEmail(
        profile.email,
        profile.fullName || "Student",
        title,
        message,
        targetName
      )
    )
  );

  const sent = results.filter((result) => result.status === "fulfilled").length;
  return { sent };
};

const resolveTargetName = async (targetType, targetId, fallbackTargetName = "") => {
  if (fallbackTargetName) return fallbackTargetName;
  if (!targetId) return targetType === "system" ? "All Users" : "";

  if (targetType === "class") {
    const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(targetId).get();
    return classSnap.exists ? classSnap.data()?.name || "Class" : "Class";
  }

  if (targetType === "course") {
    const courseSnap = await db.collection(COLLECTIONS.COURSES).doc(targetId).get();
    return courseSnap.exists ? courseSnap.data()?.title || "Course" : "Course";
  }

  if (targetType === "single_user") {
    const profile = await getUserProfile(targetId);
    return profile?.fullName || profile?.email || "User";
  }

  return "All Users";
};

const getStudentClassIds = async (studentId) => {
  const classSnap = await db.collection(COLLECTIONS.CLASSES).get();
  return classSnap.docs
    .filter((doc) => {
      const ids = extractStudentIdsFromClass(doc.data() || {});
      return ids.includes(studentId);
    })
    .map((doc) => doc.id);
};

const getStudentCourseIds = async (studentId) => {
  const enrollmentSnap = await db
    .collection(COLLECTIONS.ENROLLMENTS)
    .where("studentId", "==", studentId)
    .get();

  return [
    ...new Set(
      enrollmentSnap.docs
        .map((doc) => doc.data()?.courseId)
        .filter(Boolean)
    ),
  ];
};

const getViewerContext = async (uid, role) => {
  let classIds = [];
  let courseIds = [];

  if (role === "student") {
    [classIds, courseIds] = await Promise.all([
      getStudentClassIds(uid),
      getStudentCourseIds(uid),
    ]);
  }

  return { uid, role, classIds, courseIds };
};

const isAnnouncementVisibleToUser = (announcement, context) => {
  const { uid, role, classIds, courseIds } = context;
  const isSingleUserTarget = announcement.targetType === "single_user";
  const audienceRole = String(announcement.audienceRole || "student").toLowerCase();
  const isAudienceMatch =
    isSingleUserTarget || audienceRole === "all" || audienceRole === role;
  if (!isAudienceMatch) return false;

  if (isSingleUserTarget) {
    if (role === "teacher") return false;
    const recipientIds = Array.isArray(announcement.recipientIds)
      ? announcement.recipientIds
      : [];
    return announcement.targetId === uid || recipientIds.includes(uid);
  }

  if (role !== "student") {
    if (announcement.targetType !== "system") return false;
    if (role === "teacher") {
      if (!["teacher", "all"].includes(audienceRole)) return false;
      const postedByRole = trimText(announcement.postedByRole).toLowerCase();
      if (postedByRole && postedByRole !== "admin") return false;
    }
    return announcement.targetType === "system";
  }

  if (announcement.targetType === "system") return true;
  if (announcement.targetType === "class") {
    return classIds.includes(announcement.targetId);
  }
  if (announcement.targetType === "course") {
    return courseIds.includes(announcement.targetId);
  }

  return false;
};

const withReadState = (announcement, uid) => {
  const readBy = Array.isArray(announcement.readBy) ? announcement.readBy : [];
  return {
    ...announcement,
    isRead: readBy.includes(uid),
  };
};

export const getAnnouncements = async (req, res) => {
  try {
    const snap = await db
      .collection(COLLECTIONS.ANNOUNCEMENTS)
      .orderBy("createdAt", "desc")
      .get();

    const merged = await Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data() || {};
        const targetName = await resolveTargetName(
          data.targetType || "system",
          data.targetId || null,
          data.targetName || ""
        );
        const postedByName =
          data.postedByName || (await getPosterName(data.postedBy || ""));

        return {
          id: doc.id,
          ...data,
          targetName,
          postedByName,
          createdAt: toDate(data.createdAt)?.toISOString() || null,
          updatedAt: toDate(data.updatedAt)?.toISOString() || null,
        };
      })
    );

    return successResponse(res, merged, "Announcements fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch announcements", 500);
  }
};

export const createAnnouncement = async (req, res) => {
  try {
    const {
      title,
      message,
      targetType = "system",
      targetId = null,
      sendEmail = false,
      isPinned = false,
      audienceRole = "student",
    } = req.body || {};

    const normalizedTitle = String(title || "").trim();
    const normalizedMessage = String(message || "").trim();
    const normalizedTargetType = String(targetType || "system").trim().toLowerCase();
    const normalizedAudienceRole = String(audienceRole || "student")
      .trim()
      .toLowerCase();

    if (!normalizedTitle || normalizedTitle.length < 5 || normalizedTitle.length > 100) {
      return errorResponse(res, "Title must be between 5 and 100 characters", 400);
    }
    if (!normalizedMessage || normalizedMessage.length < 10) {
      return errorResponse(res, "Message must be at least 10 characters", 400);
    }
    if (!TARGET_TYPES.has(normalizedTargetType)) {
      return errorResponse(
        res,
        "targetType must be system, class, course, or single_user",
        400
      );
    }
    if (!AUDIENCE_ROLES.has(normalizedAudienceRole)) {
      return errorResponse(
        res,
        "audienceRole must be student, teacher, admin, or all",
        400
      );
    }

    if (
      (normalizedTargetType === "class" ||
        normalizedTargetType === "course" ||
        normalizedTargetType === "single_user") &&
      !targetId
    ) {
      return errorResponse(
        res,
        "targetId is required for class/course/single_user target",
        400
      );
    }

    if (
      (normalizedTargetType === "class" || normalizedTargetType === "course") &&
      !["student", "all"].includes(normalizedAudienceRole)
    ) {
      return errorResponse(
        res,
        "Class/Course announcements can only target students or all",
        400
      );
    }

    const { targetName, recipientIds, resolvedAudienceRole } = await getTargetedRecipientIds({
      targetType: normalizedTargetType,
      targetId,
      audienceRole: normalizedAudienceRole,
    });

    const postedByName = await getPosterName(req.user?.uid || "");
    const payload = {
      title: normalizedTitle,
      message: normalizedMessage,
      targetType: normalizedTargetType,
      targetId: targetId || null,
      targetName,
      audienceRole: resolvedAudienceRole || normalizedAudienceRole,
      postedBy: req.user.uid,
      postedByName,
      postedByRole: trimText(req.user?.role || "admin").toLowerCase() || "admin",
      sendEmail: Boolean(sendEmail),
      isPinned: Boolean(isPinned),
      studentsReached: recipientIds.length,
      recipientIds,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection(COLLECTIONS.ANNOUNCEMENTS).add(payload);

    let emailsSent = 0;
    if (payload.sendEmail) {
      const result = await sendAnnouncementEmails({
        recipientIds,
        title: payload.title,
        message: payload.message,
        targetName: payload.targetName,
      });
      emailsSent = result.sent;
    }

    return successResponse(
      res,
      {
        id: ref.id,
        ...payload,
        emailsSent,
      },
      "Announcement posted",
      201
    );
  } catch (error) {
    if (error.message === "CLASS_NOT_FOUND") {
      return errorResponse(res, "Class not found", 404);
    }
    if (error.message === "COURSE_NOT_FOUND") {
      return errorResponse(res, "Course not found", 404);
    }
    if (error.message === "USER_ID_REQUIRED") {
      return errorResponse(res, "User is required", 400);
    }
    if (error.message === "USER_NOT_FOUND") {
      return errorResponse(res, "Selected user not found", 404);
    }
    return errorResponse(res, "Failed to post announcement", 500);
  }
};

export const createTeacherAnnouncement = async (req, res) => {
  try {
    const teacherUid = trimText(req.user?.uid);
    if (!teacherUid) {
      return errorResponse(res, "Unauthorized", 401);
    }

    const {
      title,
      message,
      targetType = "course",
      targetId,
      sendEmail = false,
      isPinned = false,
    } = req.body || {};

    const normalizedTitle = trimText(title);
    const normalizedMessage = trimText(message);
    const normalizedTargetType = trimText(targetType).toLowerCase();
    const normalizedTargetId = trimText(targetId);

    if (!normalizedTitle || normalizedTitle.length < 5 || normalizedTitle.length > 100) {
      return errorResponse(res, "Title must be between 5 and 100 characters", 400);
    }
    if (!normalizedMessage || normalizedMessage.length < 10) {
      return errorResponse(res, "Message must be at least 10 characters", 400);
    }
    if (!["course", "single_user"].includes(normalizedTargetType)) {
      return errorResponse(
        res,
        "targetType must be course or single_user",
        400
      );
    }
    if (!normalizedTargetId) {
      return errorResponse(res, "targetId is required", 400);
    }

    const teacherCourseIds = await getTeacherAssignedCourseIds(teacherUid);
    if (!teacherCourseIds.length) {
      return errorResponse(res, "You are not assigned to any course", 403);
    }

    let payloadTargetType = "course";
    let payloadTargetId = normalizedTargetId;
    let targetName = "";
    let recipientIds = [];

    if (normalizedTargetType === "course") {
      const courseSnap = await db
        .collection(COLLECTIONS.COURSES)
        .doc(normalizedTargetId)
        .get();
      if (!courseSnap.exists) {
        return errorResponse(res, "Course not found", 404);
      }

      const courseData = courseSnap.data() || {};
      if (!isTeacherAssignedToCourse(courseData, teacherUid)) {
        return errorResponse(
          res,
          "You can only send announcements to your assigned course students",
          403
        );
      }

      const enrollmentsSnap = await db
        .collection(COLLECTIONS.ENROLLMENTS)
        .where("courseId", "==", normalizedTargetId)
        .get();

      recipientIds = [
        ...new Set(
          enrollmentsSnap.docs
            .map((doc) => trimText(doc.data()?.studentId))
            .filter(Boolean)
        ),
      ];
      if (recipientIds.length < 1) {
        return errorResponse(
          res,
          "No enrolled students found in this course",
          400
        );
      }

      targetName = trimText(courseData.title) || "Course";
    } else {
      const userProfile = await getUserProfile(normalizedTargetId);
      if (!userProfile) {
        return errorResponse(res, "Student not found", 404);
      }
      if (trimText(userProfile.role).toLowerCase() !== "student") {
        return errorResponse(res, "Only students can be targeted", 400);
      }

      const studentEnrollmentsSnap = await db
        .collection(COLLECTIONS.ENROLLMENTS)
        .where("studentId", "==", normalizedTargetId)
        .get();
      const studentCourseIds = new Set(
        studentEnrollmentsSnap.docs
          .map((doc) => trimText(doc.data()?.courseId))
          .filter(Boolean)
      );
      const isMyStudent = teacherCourseIds.some((courseId) =>
        studentCourseIds.has(courseId)
      );
      if (!isMyStudent) {
        return errorResponse(
          res,
          "You can only send to students from your assigned courses",
          403
        );
      }

      payloadTargetType = "single_user";
      targetName = trimText(userProfile.fullName || userProfile.email || "Student");
      recipientIds = [normalizedTargetId];
    }

    const postedByName = await getPosterName(teacherUid);
    const payload = {
      title: normalizedTitle,
      message: normalizedMessage,
      targetType: payloadTargetType,
      targetId: payloadTargetId,
      targetName,
      audienceRole: "student",
      postedBy: teacherUid,
      postedByName,
      postedByRole: "teacher",
      sendEmail: Boolean(sendEmail),
      isPinned: Boolean(isPinned),
      studentsReached: recipientIds.length,
      recipientIds,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection(COLLECTIONS.ANNOUNCEMENTS).add(payload);

    let emailsSent = 0;
    if (payload.sendEmail) {
      const result = await sendAnnouncementEmails({
        recipientIds,
        title: payload.title,
        message: payload.message,
        targetName: payload.targetName,
      });
      emailsSent = result.sent;
    }

    return successResponse(
      res,
      {
        id: ref.id,
        ...payload,
        emailsSent,
      },
      "Announcement posted",
      201
    );
  } catch (error) {
    return errorResponse(res, "Failed to post announcement", 500);
  }
};

export const getTeacherOutgoingAnnouncements = async (req, res) => {
  try {
    const teacherUid = trimText(req.user?.uid);
    if (!teacherUid) {
      return errorResponse(res, "Unauthorized", 401);
    }

    const snap = await db
      .collection(COLLECTIONS.ANNOUNCEMENTS)
      .where("postedBy", "==", teacherUid)
      .get();

    const rows = await Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data() || {};
        const targetName = await resolveTargetName(
          data.targetType || "system",
          data.targetId || null,
          data.targetName || ""
        );
        return {
          ...normalizeAnnouncementDoc(doc),
          targetName,
        };
      })
    );

    const outgoing = rows
      .filter((item) => ["course", "single_user"].includes(trimText(item.targetType)))
      .sort((a, b) => {
        const aTime = toDate(a.createdAt)?.getTime() || 0;
        const bTime = toDate(b.createdAt)?.getTime() || 0;
        return bTime - aTime;
      });

    return successResponse(res, outgoing, "Teacher outgoing announcements fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch teacher outgoing announcements", 500);
  }
};

export const updateAnnouncement = async (req, res) => {
  try {
    const announcementId = req.params.id || req.params.announcementId;
    const { title, message, isPinned } = req.body || {};

    const ref = db.collection(COLLECTIONS.ANNOUNCEMENTS).doc(announcementId);
    const snap = await ref.get();
    if (!snap.exists) {
      return errorResponse(res, "Announcement not found", 404);
    }

    const updates = {};
    if (title !== undefined) {
      const value = String(title || "").trim();
      if (value.length < 5 || value.length > 100) {
        return errorResponse(res, "Title must be between 5 and 100 characters", 400);
      }
      updates.title = value;
    }
    if (message !== undefined) {
      const value = String(message || "").trim();
      if (value.length < 10) {
        return errorResponse(res, "Message must be at least 10 characters", 400);
      }
      updates.message = value;
    }
    if (isPinned !== undefined) {
      updates.isPinned = Boolean(isPinned);
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await ref.update(updates);
    const updated = await ref.get();

    return successResponse(
      res,
      normalizeAnnouncementDoc(updated),
      "Announcement updated"
    );
  } catch (error) {
    return errorResponse(res, "Failed to update announcement", 500);
  }
};

export const deleteAnnouncement = async (req, res) => {
  try {
    const announcementId = req.params.id || req.params.announcementId;
    const ref = db.collection(COLLECTIONS.ANNOUNCEMENTS).doc(announcementId);
    const snap = await ref.get();
    if (!snap.exists) {
      return errorResponse(res, "Announcement not found", 404);
    }

    await ref.delete();
    return successResponse(res, {}, "Announcement deleted");
  } catch (error) {
    return errorResponse(res, "Failed to delete announcement", 500);
  }
};

export const togglePin = async (req, res) => {
  try {
    const announcementId = req.params.id || req.params.announcementId;
    const ref = db.collection(COLLECTIONS.ANNOUNCEMENTS).doc(announcementId);
    const snap = await ref.get();
    if (!snap.exists) {
      return errorResponse(res, "Announcement not found", 404);
    }

    const current = snap.data() || {};
    const nextValue =
      typeof req.body?.isPinned === "boolean"
        ? req.body.isPinned
        : !Boolean(current.isPinned);

    await ref.update({
      isPinned: nextValue,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(
      res,
      { id: announcementId, isPinned: nextValue },
      `Announcement ${nextValue ? "pinned" : "unpinned"}`
    );
  } catch (error) {
    return errorResponse(res, "Failed to toggle pin", 500);
  }
};

export const getStudentAnnouncements = async (req, res) => {
  try {
    const uid = req.user?.uid || "";
    const role = String(req.user?.role || "").toLowerCase();
    if (!uid || !role) {
      return errorResponse(res, "Unauthorized", 401);
    }

    const viewerContext = await getViewerContext(uid, role);
    const snap = await db
      .collection(COLLECTIONS.ANNOUNCEMENTS)
      .orderBy("createdAt", "desc")
      .get();

    const docs = snap.docs
      .map((doc) => normalizeAnnouncementDoc(doc))
      .filter((announcement) =>
        isAnnouncementVisibleToUser(announcement, viewerContext)
      )
      .map((announcement) => withReadState(announcement, uid))
      .sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
          return a.isPinned ? -1 : 1;
        }
        const aTime = toDate(a.createdAt)?.getTime() || 0;
        const bTime = toDate(b.createdAt)?.getTime() || 0;
        return bTime - aTime;
      });

    return successResponse(res, docs, "Announcements fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch announcements", 500);
  }
};

export const markAnnouncementRead = async (req, res) => {
  try {
    const uid = req.user?.uid || "";
    const role = String(req.user?.role || "").toLowerCase();
    const announcementId = String(req.params.id || "").trim();

    if (!uid || !role) {
      return errorResponse(res, "Unauthorized", 401);
    }
    if (!announcementId) {
      return errorResponse(res, "Announcement id is required", 400);
    }

    const ref = db.collection(COLLECTIONS.ANNOUNCEMENTS).doc(announcementId);
    const snap = await ref.get();
    if (!snap.exists) {
      return errorResponse(res, "Announcement not found", 404);
    }

    const announcement = normalizeAnnouncementDoc(snap);
    const viewerContext = await getViewerContext(uid, role);
    if (!isAnnouncementVisibleToUser(announcement, viewerContext)) {
      return errorResponse(res, "Announcement not found", 404);
    }

    const readBy = Array.isArray(announcement.readBy) ? announcement.readBy : [];
    if (!readBy.includes(uid)) {
      await ref.update({
        readBy: admin.firestore.FieldValue.arrayUnion(uid),
      });
    }

    return successResponse(
      res,
      { id: announcementId, isRead: true },
      "Announcement marked as read"
    );
  } catch (error) {
    return errorResponse(res, "Failed to mark announcement as read", 500);
  }
};

export const markAllAnnouncementsRead = async (req, res) => {
  try {
    const uid = req.user?.uid || "";
    const role = String(req.user?.role || "").toLowerCase();

    if (!uid || !role) {
      return errorResponse(res, "Unauthorized", 401);
    }

    const viewerContext = await getViewerContext(uid, role);
    const snap = await db
      .collection(COLLECTIONS.ANNOUNCEMENTS)
      .orderBy("createdAt", "desc")
      .get();

    const batch = db.batch();
    let updated = 0;

    snap.docs.forEach((doc) => {
      const announcement = normalizeAnnouncementDoc(doc);
      if (!isAnnouncementVisibleToUser(announcement, viewerContext)) return;

      const readBy = Array.isArray(announcement.readBy) ? announcement.readBy : [];
      if (readBy.includes(uid)) return;

      batch.update(doc.ref, {
        readBy: admin.firestore.FieldValue.arrayUnion(uid),
      });
      updated += 1;
    });

    if (updated > 0) {
      await batch.commit();
    }

    return successResponse(
      res,
      { updated },
      updated > 0
        ? "All notifications marked as read"
        : "No unread notifications found"
    );
  } catch (error) {
    return errorResponse(res, "Failed to mark all announcements as read", 500);
  }
};
