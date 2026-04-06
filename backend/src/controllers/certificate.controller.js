import { admin, db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";
import { sendCertificateIssued } from "../services/email.service.js";

const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const certIdRegex = /^SUM-\d{4}-[A-Z0-9]{8}$/;
const ACTIVE_ENROLLMENT_STATUSES = new Set([
  "active",
  "completed",
  "pending_review",
  "",
]);

const generateCertId = () => {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const token = Array.from({ length: 8 })
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join("");
  return `SUM-${year}-${token}`;
};

const findCertificateByCertKey = async (certKey) => {
  const normalized = String(certKey || "").trim().toUpperCase();
  if (!normalized) return null;

  if (certIdRegex.test(normalized)) {
    const byCertId = await db
      .collection(COLLECTIONS.CERTIFICATES)
      .where("certId", "==", normalized)
      .limit(1)
      .get();
    if (!byCertId.empty) {
      return {
        id: byCertId.docs[0].id,
        ...(byCertId.docs[0].data() || {}),
      };
    }
  }

  const docSnap = await db.collection(COLLECTIONS.CERTIFICATES).doc(certKey).get();
  if (!docSnap.exists) return null;
  return { id: docSnap.id, ...(docSnap.data() || {}) };
};

const getProgressRecord = async (studentId, courseId) => {
  const progressSnap = await db
    .collection(COLLECTIONS.PROGRESS)
    .where("studentId", "==", studentId)
    .get();

  const record = progressSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .find((row) => row.courseId === courseId);

  if (!record) return null;
  const progressValue = Number(
    record.progress ??
      record.progressPercent ??
      record.completionPercent ??
      0
  );
  const completed =
    progressValue >= 100 || Boolean(record.completedAt) || Boolean(record.isCompleted);
  return { ...record, progressValue, completed };
};

const normalizeProfileCourseIds = (studentData = {}) => {
  const profileCourses = Array.isArray(studentData.enrolledCourses)
    ? studentData.enrolledCourses
    : [];
  return profileCourses
    .map((entry) =>
      typeof entry === "string"
        ? String(entry || "").trim()
        : String(entry?.courseId || entry?.id || "").trim()
    )
    .filter(Boolean);
};

const normalizeClassStudentEntry = (entry) =>
  typeof entry === "string"
    ? {
        studentId: String(entry || "").trim(),
        shiftId: "",
        courseId: "",
      }
    : {
        studentId: String(entry?.studentId || entry?.id || entry?.uid || "").trim(),
        shiftId: String(entry?.shiftId || "").trim(),
        courseId: String(entry?.courseId || "").trim(),
      };

const getClassDerivedCourseIdsForStudent = (classData = {}, studentId = "") => {
  const cleanStudentId = String(studentId || "").trim();
  if (!cleanStudentId) return [];

  const courseIds = new Set();
  const students = Array.isArray(classData.students) ? classData.students : [];
  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  const assignedCourses = Array.isArray(classData.assignedCourses)
    ? classData.assignedCourses
    : [];

  const shiftCourseMap = shifts.reduce((acc, shift) => {
    const shiftId = String(shift?.id || "").trim();
    const shiftCourseId = String(shift?.courseId || "").trim();
    if (shiftId && shiftCourseId) acc[shiftId] = shiftCourseId;
    return acc;
  }, {});

  const assignedCourseIds = assignedCourses
    .map((entry) =>
      typeof entry === "string"
        ? String(entry || "").trim()
        : String(entry?.courseId || entry?.id || "").trim()
    )
    .filter(Boolean);

  const matchingEntries = students
    .map((entry) => normalizeClassStudentEntry(entry))
    .filter((entry) => entry.studentId === cleanStudentId);

  matchingEntries.forEach((entry) => {
    if (entry.courseId) courseIds.add(entry.courseId);
    if (entry.shiftId && shiftCourseMap[entry.shiftId]) {
      courseIds.add(shiftCourseMap[entry.shiftId]);
    }
  });

  if (!courseIds.size && matchingEntries.length > 0) {
    const classCourseId = String(classData.courseId || "").trim();
    if (classCourseId) {
      courseIds.add(classCourseId);
    } else if (assignedCourseIds.length === 1) {
      courseIds.add(assignedCourseIds[0]);
    } else if (assignedCourseIds.length > 1) {
      assignedCourseIds.forEach((courseId) => courseIds.add(courseId));
    }
  }

  return [...courseIds];
};

const getEnrolledCourseIds = async (studentId, studentData = {}) => {
  const cleanStudentId = String(studentId || "").trim();
  if (!cleanStudentId) return [];

  const [enrollmentSnap, classesSnap] = await Promise.all([
    db.collection(COLLECTIONS.ENROLLMENTS).where("studentId", "==", cleanStudentId).get(),
    db.collection(COLLECTIONS.CLASSES).get(),
  ]);

  const profileCourseIds = normalizeProfileCourseIds(studentData);
  const enrollmentCourseIds = enrollmentSnap.docs
    .map((doc) => doc.data() || {})
    .filter((row) =>
      ACTIVE_ENROLLMENT_STATUSES.has(String(row.status || "active").trim().toLowerCase())
    )
    .map((row) => String(row.courseId || "").trim())
    .filter(Boolean);

  const classCourseIds = classesSnap.docs.flatMap((doc) =>
    getClassDerivedCourseIdsForStudent(doc.data() || {}, cleanStudentId)
  );

  return [...new Set([...profileCourseIds, ...enrollmentCourseIds, ...classCourseIds])];
};

const getClassStatus = (classData = {}) => {
  const explicit = String(classData.status || "").trim().toLowerCase();
  if (explicit) return explicit;
  const start = parseDate(classData.startDate);
  const end = parseDate(classData.endDate);
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

const getClassCompletionStateForStudent = ({
  studentId = "",
  classData = {},
  enrollmentRows = [],
  progressRows = [],
}) => {
  const cleanStudentId = String(studentId || "").trim();
  const classId = String(classData.id || "").trim();
  const classCourseIds = getClassDerivedCourseIdsForStudent(classData, cleanStudentId);
  const enrollmentCourseIds = enrollmentRows
    .filter((row) => String(row.classId || "").trim() === classId)
    .map((row) => String(row.courseId || "").trim())
    .filter(Boolean);
  const courseIds = [...new Set([...classCourseIds, ...enrollmentCourseIds])];

  const courseStates = courseIds.map((courseId) => {
    const enrollment = enrollmentRows.find(
      (row) =>
        String(row.courseId || "").trim() === courseId &&
        (!String(row.classId || "").trim() || String(row.classId || "").trim() === classId)
    );
    const progressRow = progressRows.find(
      (row) => String(row.courseId || "").trim() === courseId
    );
    const progressValue = Number(
      progressRow?.progress ??
        progressRow?.progressPercent ??
        progressRow?.completionPercent ??
        enrollment?.progress ??
        0
    );
    const completed =
      progressValue >= 100 ||
      Boolean(progressRow?.completedAt) ||
      Boolean(enrollment?.completedAt) ||
      String(enrollment?.status || "").trim().toLowerCase() === "completed";
    return { courseId, completed };
  });

  const allCoursesCompleted =
    courseStates.length > 0 && courseStates.every((row) => row.completed);
  const status = getClassStatus(classData);
  const manualCompleted =
    String(classData.completionStatus || "").trim().toLowerCase() === "completed" ||
    String(classData.status || "").trim().toLowerCase() === "completed" ||
    Boolean(classData.completedByTeacher) ||
    Boolean(classData.isCompleted);
  const endedByDate = status === "completed";
  const completed = manualCompleted || endedByDate || allCoursesCompleted;

  return {
    classId,
    className: String(classData.name || "").trim() || "Class",
    batchCode: String(classData.batchCode || "").trim(),
    courseIds,
    completed,
  };
};

const checkCertificateWindowOpen = async ({ studentId, courseId }) => {
  const cleanStudentId = String(studentId || "").trim();
  const cleanCourseId = String(courseId || "").trim();
  if (!cleanStudentId || !cleanCourseId) return { eligible: true, hasClassContext: false };

  const [classesSnap, enrollmentSnap, progressSnap] = await Promise.all([
    db.collection(COLLECTIONS.CLASSES).get(),
    db.collection(COLLECTIONS.ENROLLMENTS).where("studentId", "==", cleanStudentId).get(),
    db.collection(COLLECTIONS.PROGRESS).where("studentId", "==", cleanStudentId).get(),
  ]);

  const enrollmentRows = enrollmentSnap.docs.map((doc) => doc.data() || {});
  const progressRows = progressSnap.docs.map((doc) => doc.data() || {});
  const matchingClasses = classesSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((row) =>
      getClassDerivedCourseIdsForStudent(row, cleanStudentId).includes(cleanCourseId)
    );

  if (!matchingClasses.length) {
    return { eligible: true, hasClassContext: false };
  }

  const contexts = matchingClasses.map((row) =>
    getClassCompletionStateForStudent({
      studentId: cleanStudentId,
      classData: row,
      enrollmentRows,
      progressRows,
    })
  );
  const eligible = contexts.some((row) => row.completed);
  const preferredContext = contexts.find((row) => row.completed) || contexts[0] || null;

  return {
    eligible,
    hasClassContext: true,
    classCount: contexts.length,
    preferredClassContext: preferredContext
      ? {
          classId: preferredContext.classId,
          className: preferredContext.className,
          batchCode: preferredContext.batchCode,
        }
      : null,
  };
};

const syncCertificateRefToStudent = async ({
  studentId,
  certId,
  courseId,
  courseName,
  classId,
  className,
  batchCode,
  completionScope,
  completionTitle,
  issuedAt,
}) => {
  if (!studentId || !certId || !courseId) return;
  await db.collection(COLLECTIONS.STUDENTS).doc(studentId).set(
    {
      certificates: admin.firestore.FieldValue.arrayUnion({
        certId,
        courseId,
        courseName: courseName || "",
        classId: classId || null,
        className: className || null,
        batchCode: batchCode || null,
        completionScope: completionScope || (className ? "class" : "course"),
        completionTitle:
          completionTitle ||
          (className
            ? `${className}${courseName ? ` - ${courseName}` : ""}`
            : courseName || ""),
        issuedAt: parseDate(issuedAt)?.toISOString() || new Date().toISOString(),
      }),
    },
    { merge: true }
  );
};

export const getCertificates = async (req, res) => {
  try {
    let certDocs = [];
    try {
      const snap = await db
        .collection(COLLECTIONS.CERTIFICATES)
        .orderBy("createdAt", "desc")
        .get();
      certDocs = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    } catch {
      const fallback = await db.collection(COLLECTIONS.CERTIFICATES).get();
      certDocs = fallback.docs
        .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
        .sort(
          (a, b) =>
            (parseDate(b.createdAt)?.getTime() || 0) -
            (parseDate(a.createdAt)?.getTime() || 0)
        );
    }

    const studentIds = [...new Set(certDocs.map((c) => c.studentId).filter(Boolean))];
    const courseIds = [...new Set(certDocs.map((c) => c.courseId).filter(Boolean))];

    const [studentSnaps, userSnaps, courseSnaps] = await Promise.all([
      Promise.all(
        studentIds.map((studentId) =>
          db.collection(COLLECTIONS.STUDENTS).doc(studentId).get()
        )
      ),
      Promise.all(
        studentIds.map((studentId) =>
          db.collection(COLLECTIONS.USERS).doc(studentId).get()
        )
      ),
      Promise.all(
        courseIds.map((courseId) =>
          db.collection(COLLECTIONS.COURSES).doc(courseId).get()
        )
      ),
    ]);

    const studentsMap = {};
    studentSnaps.forEach((snap) => {
      if (snap.exists) studentsMap[snap.id] = snap.data() || {};
    });
    const usersMap = {};
    userSnaps.forEach((snap) => {
      if (snap.exists) usersMap[snap.id] = snap.data() || {};
    });
    const coursesMap = {};
    courseSnaps.forEach((snap) => {
      if (snap.exists) coursesMap[snap.id] = snap.data() || {};
    });

    const data = certDocs.map((cert) => ({
      ...cert,
      studentName:
        cert.studentName ||
        studentsMap[cert.studentId]?.fullName ||
        (usersMap[cert.studentId]?.email
          ? String(usersMap[cert.studentId].email).split("@")[0]
          : "Student"),
      studentEmail: usersMap[cert.studentId]?.email || "",
      courseName: cert.courseName || coursesMap[cert.courseId]?.title || "",
      createdAt: parseDate(cert.createdAt)?.toISOString() || null,
      issuedAt: parseDate(cert.issuedAt)?.toISOString() || null,
      revokedAt: parseDate(cert.revokedAt)?.toISOString() || null,
    }));

    return successResponse(res, data, "Certificates fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch certificates", 500);
  }
};

export const generateCertificate = async (req, res) => {
  try {
    const { studentId, courseId, allowIncomplete, forceGenerate } = req.body || {};
    const allowIncompleteOverride = Boolean(
      allowIncomplete === true || forceGenerate === true
    );
    if (!studentId || !courseId) {
      return errorResponse(res, "studentId and courseId are required", 400);
    }

    const [studentSnap, userSnap, courseSnap] = await Promise.all([
      db.collection(COLLECTIONS.STUDENTS).doc(studentId).get(),
      db.collection(COLLECTIONS.USERS).doc(studentId).get(),
      db.collection(COLLECTIONS.COURSES).doc(courseId).get(),
    ]);

    if (!studentSnap.exists || !courseSnap.exists) {
      return errorResponse(res, "Student or course not found", 404);
    }

    const studentData = studentSnap.data() || {};
    const enrolledCourseIds = await getEnrolledCourseIds(studentId, studentData);
    if (!enrolledCourseIds.includes(String(courseId).trim())) {
      return errorResponse(
        res,
        "Student is not enrolled in this course",
        400
      );
    }

    const progress = await getProgressRecord(studentId, courseId);
    if (!progress?.completed && !allowIncompleteOverride) {
      return errorResponse(
        res,
        "Student has not completed this course. Confirm override to generate anyway.",
        409,
        {
          code: "INCOMPLETE_COURSE",
          requiresConfirmation: true,
          canOverride: true,
          progressPercent: Number(progress?.progressValue || 0),
        }
      );
    }

    const classWindow = await checkCertificateWindowOpen({ studentId, courseId });
    if (!classWindow.eligible && !allowIncompleteOverride) {
      return errorResponse(
        res,
        "Certificate will be available after class completion, class end date, or teacher completion mark.",
        409,
        {
          code: "CLASS_NOT_COMPLETED",
          requiresConfirmation: true,
          canOverride: true,
          hasClassContext: classWindow.hasClassContext,
          classCount: Number(classWindow.classCount || 0),
        }
      );
    }

    const existingSnap = await db
      .collection(COLLECTIONS.CERTIFICATES)
      .where("studentId", "==", studentId)
      .get();
    const existing = existingSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .find((row) => row.courseId === courseId && !row.isRevoked);
    if (existing) {
      await syncCertificateRefToStudent({
        studentId,
        certId: existing.certId || existing.id,
        courseId,
        courseName: existing.courseName || courseSnap.data()?.title || "Course",
        classId: existing.classId || null,
        className: existing.className || null,
        batchCode: existing.batchCode || null,
        completionScope: existing.completionScope || null,
        completionTitle: existing.completionTitle || null,
        issuedAt: existing.issuedAt || existing.createdAt || new Date().toISOString(),
      });
      return successResponse(res, existing, "Certificate already exists");
    }

    let certId = generateCertId();
    let retries = 0;
    while (retries < 5) {
      const collision = await db
        .collection(COLLECTIONS.CERTIFICATES)
        .where("certId", "==", certId)
        .limit(1)
        .get();
      if (collision.empty) break;
      certId = generateCertId();
      retries += 1;
    }

    const studentName =
      studentData.fullName ||
      (userSnap.data()?.email
        ? String(userSnap.data().email).split("@")[0]
        : "Student");
    const courseName = courseSnap.data()?.title || "Course";
    const classContext = classWindow.preferredClassContext || null;
    const className = String(classContext?.className || "").trim();
    const batchCode = String(classContext?.batchCode || "").trim();
    const classId = String(classContext?.classId || "").trim();
    const completionScope = className ? "class" : "course";
    const completionTitle = className
      ? [className, batchCode ? `(${batchCode})` : "", courseName ? `- ${courseName}` : ""]
          .filter(Boolean)
          .join(" ")
      : courseName;
    const verificationUrl = `${process.env.CLIENT_URL}/verify/${certId}`;
    const issuedWithoutCompletion = !progress?.completed;

    const certRef = db.collection(COLLECTIONS.CERTIFICATES).doc();
    const payload = {
      studentId,
      studentName,
      courseId,
      courseName,
      classId: classId || null,
      className: className || null,
      batchCode: batchCode || null,
      completionScope,
      completionTitle,
      certId,
      verificationUrl,
      issuedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isRevoked: false,
      revokedAt: null,
      createdBy: req.user.uid,
      issuedWithoutCompletion,
    };

    await certRef.set(payload);

    await syncCertificateRefToStudent({
      studentId,
      certId,
      courseId,
      courseName,
      classId: classId || null,
      className: className || null,
      batchCode: batchCode || null,
      completionScope,
      completionTitle,
      issuedAt: new Date().toISOString(),
    });

    try {
      const email = userSnap.data()?.email || "";
      if (email) {
        await sendCertificateIssued(email, studentName, courseName, verificationUrl);
      }
    } catch (emailError) {
      console.error("sendCertificateIssued error:", emailError.message);
    }

    return successResponse(
      res,
      {
        id: certRef.id,
        ...payload,
        issuedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      "Certificate generated",
      201
    );
  } catch (error) {
    return errorResponse(res, "Failed to generate certificate", 500);
  }
};

export const revokeCertificate = async (req, res) => {
  try {
    const certKey = req.params.certId;
    const certData = await findCertificateByCertKey(certKey);
    if (!certData) {
      return errorResponse(res, "Certificate not found", 404);
    }

    await db.collection(COLLECTIONS.CERTIFICATES).doc(certData.id).update({
      isRevoked: true,
      revokedAt: admin.firestore.FieldValue.serverTimestamp(),
      revokedBy: req.user.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(
      res,
      { id: certData.id, certId: certData.certId, isRevoked: true },
      "Certificate revoked"
    );
  } catch (error) {
    return errorResponse(res, "Failed to revoke certificate", 500);
  }
};

export const unrevokeCertificate = async (req, res) => {
  try {
    const certKey = req.params.certId;
    const certData = await findCertificateByCertKey(certKey);
    if (!certData) {
      return errorResponse(res, "Certificate not found", 404);
    }

    if (!certData.isRevoked) {
      return successResponse(
        res,
        { id: certData.id, certId: certData.certId, isRevoked: false },
        "Certificate is already active"
      );
    }

    await db.collection(COLLECTIONS.CERTIFICATES).doc(certData.id).update({
      isRevoked: false,
      revokedAt: null,
      revokedBy: null,
      unrevokedAt: admin.firestore.FieldValue.serverTimestamp(),
      unrevokedBy: req.user.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(
      res,
      { id: certData.id, certId: certData.certId, isRevoked: false },
      "Certificate unrevoked"
    );
  } catch (error) {
    return errorResponse(res, "Failed to unrevoke certificate", 500);
  }
};

export const verifyCertificate = async (req, res) => {
  try {
    const certKey = req.params.certId;
    const certData = await findCertificateByCertKey(certKey);
    if (!certData) {
      return errorResponse(res, "Certificate not found", 404);
    }
    if (certData.isRevoked) {
      return errorResponse(res, "Certificate has been revoked", 400);
    }

    return successResponse(
      res,
      {
        ...certData,
        issuedAt: parseDate(certData.issuedAt)?.toISOString() || null,
        createdAt: parseDate(certData.createdAt)?.toISOString() || null,
      },
      "Certificate verified"
    );
  } catch (error) {
    return errorResponse(res, "Failed to verify certificate", 500);
  }
};
