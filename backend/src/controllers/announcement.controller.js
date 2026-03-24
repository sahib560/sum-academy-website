import { admin, db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { errorResponse, successResponse } from "../utils/response.utils.js";
import { sendAnnouncementEmail } from "../services/email.service.js";

const TARGET_TYPES = new Set(["system", "class", "course"]);
const AUDIENCE_ROLES = new Set(["student", "teacher", "admin", "all"]);

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
  if (role === "all") {
    const usersSnap = await db.collection(COLLECTIONS.USERS).get();
    return usersSnap.docs.map((doc) => doc.id);
  }

  const usersSnap = await db
    .collection(COLLECTIONS.USERS)
    .where("role", "==", role)
    .get();
  return usersSnap.docs.map((doc) => doc.id);
};

const getTargetedRecipientIds = async ({ targetType, targetId, audienceRole }) => {
  let targetName = "All Users";
  let recipientIds = [];

  if (targetType === "system") {
    recipientIds = await getUsersByRole(audienceRole);
    if (audienceRole === "student") targetName = "All Students";
    if (audienceRole === "teacher") targetName = "All Teachers";
    if (audienceRole === "admin") targetName = "All Admins";
    if (audienceRole === "all") targetName = "All Users";
    return { targetName, recipientIds };
  }

  if (targetType === "class") {
    const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(targetId).get();
    if (!classSnap.exists) {
      throw new Error("CLASS_NOT_FOUND");
    }
    targetName = classSnap.data()?.name || "Class";
    recipientIds = extractStudentIdsFromClass(classSnap.data() || {});
    return { targetName, recipientIds };
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
    return { targetName, recipientIds };
  }

  return { targetName, recipientIds };
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
      return errorResponse(res, "targetType must be system, class, or course", 400);
    }
    if (!AUDIENCE_ROLES.has(normalizedAudienceRole)) {
      return errorResponse(
        res,
        "audienceRole must be student, teacher, admin, or all",
        400
      );
    }

    if (
      (normalizedTargetType === "class" || normalizedTargetType === "course") &&
      !targetId
    ) {
      return errorResponse(res, "targetId is required for class/course target", 400);
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

    const { targetName, recipientIds } = await getTargetedRecipientIds({
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
      audienceRole: normalizedAudienceRole,
      postedBy: req.user.uid,
      postedByName,
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
    return errorResponse(res, "Failed to post announcement", 500);
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

    const snap = await db
      .collection(COLLECTIONS.ANNOUNCEMENTS)
      .orderBy("createdAt", "desc")
      .get();

    let classIds = [];
    let courseIds = [];
    if (role === "student") {
      [classIds, courseIds] = await Promise.all([
        getStudentClassIds(uid),
        getStudentCourseIds(uid),
      ]);
    }

    const docs = snap.docs
      .map((doc) => normalizeAnnouncementDoc(doc))
      .filter((announcement) => {
        const audienceRole = String(announcement.audienceRole || "student").toLowerCase();
        const isAudienceMatch =
          audienceRole === "all" || audienceRole === role;
        if (!isAudienceMatch) return false;

        if (role !== "student") {
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
      })
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

