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
    const { studentId, courseId } = req.body || {};
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

    const progress = await getProgressRecord(studentId, courseId);
    if (!progress?.completed) {
      return errorResponse(res, "Student has not completed this course", 400);
    }

    const existingSnap = await db
      .collection(COLLECTIONS.CERTIFICATES)
      .where("studentId", "==", studentId)
      .get();
    const existing = existingSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .find((row) => row.courseId === courseId && !row.isRevoked);
    if (existing) {
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
      studentSnap.data()?.fullName ||
      (userSnap.data()?.email
        ? String(userSnap.data().email).split("@")[0]
        : "Student");
    const courseName = courseSnap.data()?.title || "Course";
    const verificationUrl = `${process.env.CLIENT_URL}/verify/${certId}`;

    const certRef = db.collection(COLLECTIONS.CERTIFICATES).doc();
    const payload = {
      studentId,
      studentName,
      courseId,
      courseName,
      certId,
      verificationUrl,
      issuedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isRevoked: false,
      revokedAt: null,
      createdBy: req.user.uid,
    };

    await certRef.set(payload);

    await db.collection(COLLECTIONS.STUDENTS).doc(studentId).set(
      {
        certificates: admin.firestore.FieldValue.arrayUnion({
          certId,
          courseId,
          courseName,
          issuedAt: new Date().toISOString(),
        }),
      },
      { merge: true }
    );

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
