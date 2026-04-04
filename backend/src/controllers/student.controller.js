import { admin, auth, db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import {
  sendCertificateIssued,
  sendStudentHelpSupportEmail,
} from "../services/email.service.js";
import { errorResponse, successResponse } from "../utils/response.utils.js";
import {
  isPakistanPhone,
  normalizePakistanPhone,
} from "../utils/phone.utils.js";

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const SETTINGS_DOC_ID = "siteSettings";
const trimText = (value = "") => String(value || "").trim();
const lowerText = (value = "") => trimText(value).toLowerCase();
const clampPercent = (value) => Math.max(0, Math.min(100, Number(value || 0)));
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const isValidEmail = (value = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimText(value));
const normalizeEmailAddress = (value = "") => {
  const raw = trimText(value);
  if (!raw) return "";
  const match = raw.match(/<([^>]+)>/);
  return trimText(match?.[1] || raw).toLowerCase();
};

const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIso = (value) => {
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString() : null;
};

const formatSessionDate = (value) => {
  const text = trimText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10);
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : "";
};

const toDateOnly = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return null;
  const date = new Date(parsed);
  date.setHours(0, 0, 0, 0);
  return date;
};

const maxDate = (dates = []) =>
  dates.filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0] || null;

const minDate = (dates = []) =>
  dates.filter(Boolean).sort((a, b) => a.getTime() - b.getTime())[0] || null;

const isDateInRange = (date, start, end) => {
  if (!date) return false;
  if (start && date.getTime() < start.getTime()) return false;
  if (end && date.getTime() > end.getTime()) return false;
  return true;
};

const daysInclusive = (start, end) => {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  if (endDate.getTime() < startDate.getTime()) return 0;
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
};

const getCurrentAndLongestStreak = (sessions = []) => {
  if (!Array.isArray(sessions) || !sessions.length) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const sorted = [...sessions].sort(
    (a, b) => (toDateOnly(a.date)?.getTime() || 0) - (toDateOnly(b.date)?.getTime() || 0)
  );
  const isPresentLike = (status) => ["present", "late"].includes(lowerText(status));

  let longest = 0;
  let running = 0;
  sorted.forEach((row) => {
    if (isPresentLike(row.status)) {
      running += 1;
      if (running > longest) longest = running;
    } else {
      running = 0;
    }
  });

  let current = 0;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    if (!isPresentLike(sorted[index].status)) break;
    current += 1;
  }

  return { currentStreak: current, longestStreak: longest };
};

const getNameFromEmail = (email = "") => trimText(email).split("@")[0] || "Student";

const chunkArray = (items = [], size = 10) => {
  const rows = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
};

const getStudentAndUser = async (uid) => {
  const [studentSnap, userSnap] = await Promise.all([
    db.collection(COLLECTIONS.STUDENTS).doc(uid).get(),
    db.collection(COLLECTIONS.USERS).doc(uid).get(),
  ]);
  return {
    studentExists: studentSnap.exists,
    userExists: userSnap.exists,
    studentData: studentSnap.exists ? studentSnap.data() || {} : {},
    userData: userSnap.exists ? userSnap.data() || {} : {},
  };
};

const getEnrolledRows = async (uid) => {
  const snap = await db
    .collection(COLLECTIONS.ENROLLMENTS)
    .where("studentId", "==", uid)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
};

const getStudentClassMembershipRows = async (uid) => {
  const classesSnap = await db.collection(COLLECTIONS.CLASSES).get();
  return classesSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((row) => {
      const students = Array.isArray(row.students) ? row.students : [];
      return students.some((entry) => {
        if (typeof entry === "string") return trimText(entry) === uid;
        return trimText(entry?.studentId || entry?.id || entry?.uid) === uid;
      });
    });
};

const getStudentCourseIdsFromClassRow = (classData = {}, uid = "") => {
  const courseIds = new Set();
  const students = Array.isArray(classData.students) ? classData.students : [];
  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  const shiftCourseMap = shifts.reduce((acc, shift) => {
    const shiftId = trimText(shift?.id);
    const shiftCourseId = trimText(shift?.courseId);
    if (shiftId && shiftCourseId) acc[shiftId] = shiftCourseId;
    return acc;
  }, {});

  const assignedCourseIds = (Array.isArray(classData.assignedCourses)
    ? classData.assignedCourses
    : []
  )
    .map((entry) => {
      if (typeof entry === "string") return trimText(entry);
      return trimText(entry?.courseId || entry?.id);
    })
    .filter(Boolean);

  const matchingEntries = students
    .map((entry) =>
      typeof entry === "string"
        ? { studentId: trimText(entry), shiftId: "", courseId: "" }
        : {
            studentId: trimText(entry?.studentId || entry?.id || entry?.uid),
            shiftId: trimText(entry?.shiftId),
            courseId: trimText(entry?.courseId),
          }
    )
    .filter((entry) => entry.studentId === uid);

  if (matchingEntries.length < 1) return [];

  assignedCourseIds.forEach((courseId) => {
    if (courseId) courseIds.add(courseId);
  });

  matchingEntries.forEach((entry) => {
    if (entry.courseId) courseIds.add(entry.courseId);
    if (entry.shiftId && shiftCourseMap[entry.shiftId]) {
      courseIds.add(shiftCourseMap[entry.shiftId]);
    }
  });

  if (!courseIds.size) {
    const classCourseId = trimText(classData.courseId);
    if (classCourseId) {
      courseIds.add(classCourseId);
    } else if (assignedCourseIds.length === 1) {
      courseIds.add(assignedCourseIds[0]);
    }
  }

  return [...courseIds];
};

const getStudentEnrolledCourseIds = async (uid) => {
  const enrollments = await getEnrolledRows(uid);

  const enrollmentIds = enrollments
    .filter((row) =>
      ["active", "upcoming", "completed", "pending_review", ""].includes(
        lowerText(row.status || "active")
      )
    )
    .filter((row) => trimText(row.classId))
    .map((row) => trimText(row.courseId))
    .filter(Boolean);

  const classMembershipRows = await getStudentClassMembershipRows(uid);
  const classCourseIds = classMembershipRows.flatMap((row) =>
    getStudentCourseIdsFromClassRow(row, uid)
  );

  return [...new Set([...classCourseIds, ...enrollmentIds])];
};

const getStudentClassIds = async (uid, enrollments = null) => {
  const enrollmentRows = Array.isArray(enrollments) ? enrollments : await getEnrolledRows(uid);
  const classFromEnrollments = enrollmentRows
    .map((row) => trimText(row.classId))
    .filter(Boolean);

  const fromClassMembership = (await getStudentClassMembershipRows(uid)).map((row) => row.id);

  return [...new Set([...classFromEnrollments, ...fromClassMembership])];
};

const getClassStatus = (classData = {}) => {
  const explicitStatus = lowerText(classData.status || "");
  if (explicitStatus) return explicitStatus;
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

const buildStudentClassAndCourseData = ({
  uid = "",
  classRows = [],
  enrollments = [],
  courseMap = {},
  progressRows = [],
}) => {
  const classes = [];
  const courseRows = [];

  classRows.forEach((classData = {}) => {
    const classId = trimText(classData.id);
    if (!classId) return;

    const classCourseIds = getStudentCourseIdsFromClassRow(classData, uid);
    const enrollmentCourseIds = enrollments
      .filter(
        (row) =>
          trimText(row.studentId) === uid &&
          trimText(row.classId) === classId &&
          trimText(row.courseId)
      )
      .map((row) => trimText(row.courseId));
    const resolvedCourseIds =
      classCourseIds.length > 0
        ? classCourseIds
        : [...new Set(enrollmentCourseIds)];
    const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
    const students = Array.isArray(classData.students) ? classData.students : [];
    const studentEntry = students
      .map((entry) =>
        typeof entry === "string"
          ? { studentId: trimText(entry), shiftId: "", enrolledAt: null }
          : {
              studentId: trimText(entry?.studentId || entry?.id || entry?.uid),
              shiftId: trimText(entry?.shiftId),
              enrolledAt: entry?.enrolledAt || null,
            }
      )
      .find((entry) => entry.studentId === uid);
    const shift = shifts.find(
      (row) => trimText(row?.id) === trimText(studentEntry?.shiftId)
    );

    const classCourses = resolvedCourseIds.map((courseId) => {
      const cleanCourseId = trimText(courseId);
      const course = courseMap[cleanCourseId] || {};
      const enrollment = enrollments.find((row) => {
        const rowClassId = trimText(row.classId);
        const rowCourseId = trimText(row.courseId);
        return rowCourseId === cleanCourseId && (!rowClassId || rowClassId === classId);
      });
      const subjects = Array.isArray(course.subjects) ? course.subjects : [];
      const teacherName =
        trimText(course.teacherName) ||
        trimText(subjects[0]?.teacherName) ||
        trimText(shift?.teacherName) ||
        "Teacher";
      const progress = normalizeProgressPercent(
        progressRows,
        cleanCourseId,
        enrollment?.progress
      );
      const latestActivity = progressRows
        .filter(
          (row) =>
            trimText(row.courseId) === cleanCourseId || !trimText(row.courseId)
        )
        .map(
          (row) =>
            parseDate(row.updatedAt || row.completedAt || row.createdAt)?.getTime() || 0
        )
        .sort((a, b) => b - a)[0] || 0;

      const payload = {
        id: `${classId}_${cleanCourseId}`,
        classId,
        className: trimText(classData.name) || "Class",
        batchCode: trimText(classData.batchCode),
        courseId: cleanCourseId,
        title: trimText(course.title) || "Course",
        description: trimText(course.description || course.shortDescription),
        thumbnail: course.thumbnail || null,
        category: trimText(course.category),
        level: trimText(course.level || "beginner"),
        teacherName,
        subjects: subjects.map((subject) => ({
          id: trimText(subject?.id || subject?.subjectId),
          name: trimText(subject?.name || subject?.subjectName) || "Subject",
          teacherId: trimText(subject?.teacherId),
          teacherName: trimText(subject?.teacherName) || "Teacher",
        })),
        progress,
        isCompleted: clampPercent(progress) >= 100,
        enrolledAt:
          enrollment?.createdAt ||
          enrollment?.enrolledAt ||
          studentEntry?.enrolledAt ||
          null,
        latestActivity,
      };

      courseRows.push(payload);
      return payload;
    });

    const overallProgress =
      classCourses.length > 0
        ? Number(
            (
              classCourses.reduce((sum, row) => sum + clampPercent(row.progress), 0) /
              classCourses.length
            ).toFixed(2)
          )
        : 0;

    classes.push({
      classId,
      id: classId,
      name: trimText(classData.name) || "Class",
      batchCode: trimText(classData.batchCode),
      description: trimText(classData.description),
      status: getClassStatus(classData),
      teacherName:
        trimText(classData.teacherName) ||
        trimText(classData.teachers?.[0]?.teacherName) ||
        trimText(shift?.teacherName) ||
        "Teacher",
      capacity: Math.max(1, toNumber(classData.capacity, 30)),
      enrolledCount: Array.isArray(classData.students) ? classData.students.length : 0,
      startDate: toIso(classData.startDate),
      endDate: toIso(classData.endDate),
      shiftId: trimText(shift?.id),
      shiftName: trimText(shift?.name),
      shiftDays: Array.isArray(shift?.days) ? shift.days : [],
      shiftStartTime: trimText(shift?.startTime),
      shiftEndTime: trimText(shift?.endTime),
      courses: classCourses,
      overallProgress,
    });
  });

  return { classes, courseRows };
};

const getCourseDocsByIds = async (courseIds = []) => {
  const uniqueIds = [...new Set(courseIds.map((id) => trimText(id)).filter(Boolean))];
  if (!uniqueIds.length) return {};

  const snaps = await Promise.all(
    uniqueIds.map((courseId) => db.collection(COLLECTIONS.COURSES).doc(courseId).get())
  );
  return snaps.reduce((acc, snap) => {
    if (snap.exists) acc[snap.id] = snap.data() || {};
    return acc;
  }, {});
};

const getProgressRowsForStudent = async (uid, courseId = "") => {
  const snap = await db
    .collection(COLLECTIONS.PROGRESS)
    .where("studentId", "==", uid)
    .get();

  const rows = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  const cleanCourseId = trimText(courseId);
  if (!cleanCourseId) return rows;
  return rows.filter(
    (row) => trimText(row.courseId) === cleanCourseId || !trimText(row.courseId)
  );
};

const getCourseLectures = async (courseId) => {
  const byCourseSnap = await db
    .collection(COLLECTIONS.LECTURES)
    .where("courseId", "==", courseId)
    .get();
  const byCourse = byCourseSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  if (byCourse.length > 0) return byCourse;

  const chaptersSnap = await db
    .collection(COLLECTIONS.CHAPTERS)
    .where("courseId", "==", courseId)
    .get();
  const chapterIds = chaptersSnap.docs.map((doc) => doc.id);
  if (!chapterIds.length) return [];

  const lectureChunks = await Promise.all(
    chunkArray(chapterIds, 10).map((ids) =>
      db.collection(COLLECTIONS.LECTURES).where("chapterId", "in", ids).get()
    )
  );
  return lectureChunks.flatMap((snap) =>
    snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
  );
};

const normalizeProgressPercent = (progressRows = [], courseId = "", fallback = 0) => {
  const cleanCourseId = trimText(courseId);
  const direct = progressRows.find((row) => trimText(row.courseId) === cleanCourseId);
  const directPercent = Number(
    direct?.progress ?? direct?.progressPercent ?? direct?.completionPercent
  );
  if (Number.isFinite(directPercent)) return clampPercent(directPercent);

  const lectureRows = progressRows.filter(
    (row) =>
      trimText(row.lectureId) &&
      (!trimText(row.courseId) || trimText(row.courseId) === cleanCourseId)
  );
  if (lectureRows.length > 0) {
    const completed = lectureRows.filter(
      (row) =>
        row.isCompleted ||
        row.completed ||
        toNumber(row.progress, 0) >= 100 ||
        toNumber(row.progressPercent, 0) >= 100 ||
        toNumber(row.completionPercent, 0) >= 100
    ).length;
    return clampPercent((completed / lectureRows.length) * 100);
  }

  return clampPercent(fallback);
};

const buildLectureProgressMap = (progressRows = [], courseId = "") => {
  const cleanCourseId = trimText(courseId);
  const map = {};
  progressRows.forEach((row) => {
    const lectureId = trimText(row.lectureId);
    if (!lectureId) return;
    if (trimText(row.courseId) && trimText(row.courseId) !== cleanCourseId) return;
    map[lectureId] = {
      isCompleted: Boolean(
        row.isCompleted ||
          row.completed ||
          toNumber(row.progress, 0) >= 100 ||
          toNumber(row.progressPercent, 0) >= 100 ||
          toNumber(row.completionPercent, 0) >= 100
      ),
      completedAt: toIso(row.completedAt),
    };
  });
  return map;
};

const parseAnnouncementDate = (value) => parseDate(value)?.getTime() || 0;

const sanitizeQuestionForStudent = (question = {}) => {
  const type = lowerText(question.type || question.questionType);
  const optionsRaw = Array.isArray(question.options)
    ? question.options
    : question.options && typeof question.options === "object"
      ? [question.options.A, question.options.B, question.options.C, question.options.D].filter(Boolean)
      : [];
  const options = optionsRaw.map((option) => trimText(option)).filter(Boolean);

  return {
    questionId: trimText(question.questionId || question.id),
    type: type || "mcq",
    questionType: type || "mcq",
    questionText: trimText(question.questionText || question.text),
    options: type === "short_answer" ? [] : options,
    marks: Math.max(1, toNumber(question.marks, 1)),
    order: toNumber(question.order, 0),
  };
};

const normalizeSubmittedAnswers = (answers = []) => {
  if (Array.isArray(answers)) {
    return answers.reduce((acc, row) => {
      const questionId = trimText(row?.questionId);
      if (!questionId) return acc;
      acc[questionId] = row?.answer;
      return acc;
    }, {});
  }
  if (answers && typeof answers === "object") return { ...answers };
  return {};
};

const gradeObjectiveAnswer = (question = {}, rawAnswer) => {
  const type = lowerText(question.type || question.questionType);
  const marks = Math.max(1, toNumber(question.marks, 1));

  if (type === "short_answer") {
    return {
      isCorrect: null,
      marksObtained: null,
      status: "pending_review",
      pending: true,
    };
  }

  if (type === "true_false") {
    const answer = lowerText(rawAnswer);
    const submitted =
      answer === "true" || answer === "t" || answer === "1" || answer === "yes";
    const submittedKnown =
      ["true", "t", "1", "yes", "false", "f", "0", "no"].includes(answer);
    const correctRaw = question.correctAnswer;
    const correctBool =
      typeof correctRaw === "boolean"
        ? correctRaw
        : ["true", "t", "1", "yes"].includes(lowerText(correctRaw));
    const isCorrect = submittedKnown && submitted === correctBool;
    return {
      isCorrect,
      marksObtained: isCorrect ? marks : 0,
      status: "graded",
      pending: false,
    };
  }

  const optionsRaw = Array.isArray(question.options)
    ? question.options
    : question.options && typeof question.options === "object"
      ? [question.options.A, question.options.B, question.options.C, question.options.D].filter(Boolean)
      : [];
  const options = optionsRaw.map((option) => trimText(option));
  const correctRaw = trimText(question.correctAnswer);
  const answerText = trimText(rawAnswer);
  const letterMap = { A: 0, B: 1, C: 2, D: 3 };
  const answerUpper = answerText.toUpperCase();
  const selectedByLetter =
    letterMap[answerUpper] !== undefined ? trimText(options[letterMap[answerUpper]]) : "";
  const normalizedSubmitted = lowerText(selectedByLetter || answerText);
  const normalizedCorrect = lowerText(correctRaw);
  const isCorrect = Boolean(normalizedSubmitted) && normalizedSubmitted === normalizedCorrect;

  return {
    isCorrect,
    marksObtained: isCorrect ? marks : 0,
    status: "graded",
    pending: false,
  };
};

const generateCertificateId = () => {
  const year = new Date().getFullYear();
  const token = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `SUM-${year}-${token.padEnd(8, "X").slice(0, 8)}`;
};

const ensureCertificateForCompletion = async ({
  studentId,
  studentData,
  userData,
  courseId,
  courseData,
}) => {
  const existingSnap = await db
    .collection(COLLECTIONS.CERTIFICATES)
    .where("studentId", "==", studentId)
    .where("courseId", "==", courseId)
    .limit(1)
    .get();
  if (!existingSnap.empty) return { created: false, certificateId: existingSnap.docs[0].id };

  const certRef = db.collection(COLLECTIONS.CERTIFICATES).doc();
  const certId = generateCertificateId();
  const studentName =
    trimText(studentData.fullName) ||
    trimText(studentData.name) ||
    trimText(userData.fullName) ||
    getNameFromEmail(userData.email || "");
  const courseName = trimText(courseData.title) || "Course";
  const verificationUrl = `${process.env.CLIENT_URL || ""}/verify/${certId}`;

  await certRef.set({
    studentId,
    studentName,
    courseId,
    courseName,
    certId,
    verificationUrl,
    issuedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    isRevoked: false,
  });

  await db.collection(COLLECTIONS.STUDENTS).doc(studentId).set(
    {
      certificates: admin.firestore.FieldValue.arrayUnion({
        certId,
        courseId,
        courseName,
        issuedAt: new Date().toISOString(),
      }),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  try {
    const email = trimText(userData.email);
    if (email) {
      await sendCertificateIssued(email, studentName, courseName, verificationUrl);
    }
  } catch (error) {
    console.error("sendCertificateIssued error:", error?.message || error);
  }

  return { created: true, certificateId: certRef.id, certId };
};

export const getStudentDashboard = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const [
      profile,
      enrollments,
      announcementsSnap,
      sessionsSnap,
      installmentsSnap,
      classMembershipRows,
      progressRows,
    ] =
      await Promise.all([
        getStudentAndUser(uid),
        getEnrolledRows(uid),
        db.collection(COLLECTIONS.ANNOUNCEMENTS).orderBy("createdAt", "desc").get(),
        db.collection(COLLECTIONS.SESSIONS).get(),
        db.collection(COLLECTIONS.INSTALLMENTS).where("studentId", "==", uid).get(),
        getStudentClassMembershipRows(uid),
        getProgressRowsForStudent(uid),
      ]);

    const studentData = profile.studentData;
    const userData = profile.userData;
    const enrollmentClassIds = enrollments
      .map((row) => trimText(row.classId))
      .filter(Boolean);
    const classMap = classMembershipRows.reduce((acc, row) => {
      acc[trimText(row.id)] = row;
      return acc;
    }, {});
    const missingClassIds = [...new Set(enrollmentClassIds)].filter(
      (classId) => !classMap[classId]
    );
    const missingClassRows = await Promise.all(
      missingClassIds.map(async (classId) => {
        const snap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
        return snap.exists ? { id: snap.id, ...(snap.data() || {}) } : null;
      })
    );
    const allClassRows = [
      ...classMembershipRows,
      ...missingClassRows.filter(Boolean),
    ].map((row) => ({
      ...(row || {}),
      id: trimText(row?.id),
    }));

    const enrolledCourseIds = [
      ...new Set(
        allClassRows
          .flatMap((row) => getStudentCourseIdsFromClassRow(row, uid))
          .concat(enrollments.map((row) => trimText(row.courseId)))
          .filter(Boolean)
      ),
    ];
    const courseMap = await getCourseDocsByIds(enrolledCourseIds);
    const learningData = buildStudentClassAndCourseData({
      uid,
      classRows: allClassRows,
      enrollments,
      courseMap,
      progressRows,
    });
    const classRows = learningData.classes;
    const courseRows = [...learningData.courseRows].sort(
      (a, b) => toNumber(b.latestActivity, 0) - toNumber(a.latestActivity, 0)
    );
    const attendancePayload = await buildStudentAttendancePayload(uid);

    const completedCount = courseRows.filter((row) => clampPercent(row.progress) >= 100).length;
    const lastAccessed = courseRows.sort((a, b) => b.latestActivity - a.latestActivity)[0] || null;

    const courseIdSet = new Set(courseRows.map((row) => trimText(row.courseId)).filter(Boolean));
    const classIdSet = new Set(classRows.map((row) => trimText(row.classId)).filter(Boolean));
    const classNameById = classRows.reduce((acc, row) => {
      acc[trimText(row.classId)] = trimText(row.name);
      return acc;
    }, {});
    const latestAnnouncements = announcementsSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => {
        const targetType = lowerText(row.targetType || "system");
        const targetId = trimText(row.targetId);
        const audienceRole = lowerText(row.audienceRole || "student");
        if (!(audienceRole === "student" || audienceRole === "all")) return false;
        if (targetType === "system") return true;
        if (targetType === "course") return courseIdSet.has(targetId);
        if (targetType === "class") return classIdSet.has(targetId);
        return false;
      })
      .sort((a, b) => parseAnnouncementDate(b.createdAt) - parseAnnouncementDate(a.createdAt))
      .slice(0, 3)
      .map((row) => ({
        id: row.id,
        title: trimText(row.title) || "Announcement",
        message: trimText(row.message),
        targetType: lowerText(row.targetType || "system"),
        targetId: trimText(row.targetId),
        isPinned: Boolean(row.isPinned),
        createdAt: toIso(row.createdAt),
        isRead: Array.isArray(row.readBy) ? row.readBy.includes(uid) : false,
      }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingSessions = sessionsSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => classIdSet.has(trimText(row.classId)))
      .filter((row) => {
        const parsedDate = parseDate(row.date);
        if (!parsedDate) return false;
        parsedDate.setHours(0, 0, 0, 0);
        return parsedDate >= today;
      })
      .sort((a, b) => parseAnnouncementDate(a.date) - parseAnnouncementDate(b.date))
      .slice(0, 3)
      .map((row) => ({
        id: row.id,
        classId: trimText(row.classId),
        className: classNameById[trimText(row.classId)] || "Class",
        topic: trimText(row.topic) || "Session",
        date: toIso(row.date),
        startTime: trimText(row.startTime),
        endTime: trimText(row.endTime),
        platform: trimText(row.platform),
        meetingLink: trimText(row.meetingLink),
        status: lowerText(row.status || "upcoming"),
      }));

    const nextInstallment = installmentsSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => lowerText(row.status) === "active")
      .flatMap((plan) => {
        const installments = Array.isArray(plan.installments) ? plan.installments : [];
        return installments
          .filter((item) => lowerText(item.status) !== "paid")
          .map((item) => ({
            planId: plan.id,
            courseId: trimText(plan.courseId),
            courseName: trimText(plan.courseName),
            installmentNumber: toNumber(item.number, 0),
            amount: toNumber(item.amount, 0),
            dueDate: trimText(item.dueDate),
            status: lowerText(item.status || "pending"),
          }));
      })
      .sort((a, b) => {
        const aTime = parseDate(a.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        const bTime = parseDate(b.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })[0] || null;

    return successResponse(
      res,
      {
        profile: {
          uid,
          fullName:
            trimText(studentData.fullName) ||
            trimText(studentData.name) ||
            trimText(userData.fullName) ||
            getNameFromEmail(userData.email || ""),
          email: trimText(userData.email),
          phoneNumber: trimText(studentData.phoneNumber || studentData.phone || userData.phoneNumber),
          fatherName: trimText(studentData.fatherName),
          fatherPhone: trimText(studentData.fatherPhone),
          fatherOccupation: trimText(studentData.fatherOccupation),
          address: trimText(studentData.address),
          district: trimText(studentData.district),
          domicile: trimText(studentData.domicile),
          caste: trimText(studentData.caste),
          createdAt: toIso(userData.createdAt || studentData.createdAt),
          lastLoginAt: toIso(userData.lastLoginAt),
        },
        stats: {
          enrolledCount: classRows.length,
          enrolledClassesCount: classRows.length,
          enrolledCoursesCount: courseRows.length,
          completedCount,
          certificatesCount: Array.isArray(studentData.certificates)
            ? studentData.certificates.length
            : 0,
        },
        classes: classRows,
        courses: courseRows.map((row) => ({
          id: row.id,
          classId: row.classId,
          className: row.className,
          batchCode: row.batchCode,
          courseId: row.courseId,
          title: row.title,
          thumbnail: row.thumbnail,
          teacherName: row.teacherName,
          progress: row.progress,
        })),
        lastAccessedCourse: lastAccessed
          ? {
              id: lastAccessed.id,
              classId: lastAccessed.classId,
              className: lastAccessed.className,
              batchCode: lastAccessed.batchCode,
              courseId: lastAccessed.courseId,
              title: lastAccessed.title,
              thumbnail: lastAccessed.thumbnail,
              teacherName: lastAccessed.teacherName,
              progress: lastAccessed.progress,
            }
          : null,
        attendanceSummary: attendancePayload.summary || {
          totalSessions: 0,
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          attendancePercent: 0,
          currentStreak: 0,
          longestStreak: 0,
          learningDaysElapsed: 0,
          courseDurationDays: 0,
          learningDayProgress: null,
        },
        announcements: latestAnnouncements,
        upcomingSessions,
        nextInstallment,
      },
      "Student dashboard fetched"
    );
  } catch (error) {
    console.error("getStudentDashboard error:", error);
    return errorResponse(res, "Failed to fetch student dashboard", 500);
  }
};

export const getStudentCourses = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const [enrollments, classMembershipRows, progressRows] = await Promise.all([
      getEnrolledRows(uid),
      getStudentClassMembershipRows(uid),
      getProgressRowsForStudent(uid),
    ]);
    const enrollmentClassIds = enrollments
      .map((row) => trimText(row.classId))
      .filter(Boolean);
    const classMap = classMembershipRows.reduce((acc, row) => {
      acc[trimText(row.id)] = row;
      return acc;
    }, {});
    const missingClassIds = [...new Set(enrollmentClassIds)].filter(
      (classId) => !classMap[classId]
    );
    const missingClassRows = await Promise.all(
      missingClassIds.map(async (classId) => {
        const snap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
        return snap.exists ? { id: snap.id, ...(snap.data() || {}) } : null;
      })
    );
    const classRows = [
      ...classMembershipRows,
      ...missingClassRows.filter(Boolean),
    ].map((row) => ({
      ...(row || {}),
      id: trimText(row?.id),
    }));

    const courseIds = [
      ...new Set(
        classRows
          .flatMap((row) => getStudentCourseIdsFromClassRow(row, uid))
          .concat(enrollments.map((row) => trimText(row.courseId)))
          .filter(Boolean)
      ),
    ];
    const courseMap = await getCourseDocsByIds(courseIds);
    const data = buildStudentClassAndCourseData({
      uid,
      classRows,
      enrollments,
      courseMap,
      progressRows,
    }).courseRows.sort((a, b) => {
      const classCompare = trimText(a.className).localeCompare(trimText(b.className));
      if (classCompare !== 0) return classCompare;
      return trimText(a.title).localeCompare(trimText(b.title));
    });

    return successResponse(res, data, "Student courses fetched");
  } catch (error) {
    console.error("getStudentCourses error:", error);
    return errorResponse(res, "Failed to fetch student courses", 500);
  }
};

export const getStudentCourseProgress = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const courseId = trimText(req.params?.courseId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!courseId) return errorResponse(res, "courseId is required", 400);

    const enrolledIds = await getStudentEnrolledCourseIds(uid);
    if (!enrolledIds.includes(courseId)) {
      return errorResponse(res, "You are not enrolled in this course", 403);
    }

    const courseSnap = await db.collection(COLLECTIONS.COURSES).doc(courseId).get();
    if (!courseSnap.exists) return errorResponse(res, "Course not found", 404);
    const courseData = courseSnap.data() || {};

    const [chaptersSnap, lectures, progressRows, videoAccessSnap] = await Promise.all([
      db.collection(COLLECTIONS.CHAPTERS).where("courseId", "==", courseId).get(),
      getCourseLectures(courseId),
      getProgressRowsForStudent(uid, courseId),
      db.collection("videoAccess").where("studentId", "==", uid).get(),
    ]);

    const lectureByChapter = {};
    lectures.forEach((lecture) => {
      const chapterId = trimText(lecture.chapterId);
      if (!lectureByChapter[chapterId]) lectureByChapter[chapterId] = [];
      lectureByChapter[chapterId].push(lecture);
    });

    const lectureProgressMap = buildLectureProgressMap(progressRows, courseId);
    const accessMap = videoAccessSnap.docs.reduce((acc, doc) => {
      const data = doc.data() || {};
      const lectureId = trimText(data.lectureId);
      if (!lectureId) return acc;
      acc[lectureId] = Boolean(data.hasAccess);
      return acc;
    }, {});

    const chapters = chaptersSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .sort((a, b) => toNumber(a.order, 0) - toNumber(b.order, 0))
      .map((chapter) => {
        const chapterLectures = (lectureByChapter[chapter.id] || [])
          .sort((a, b) => toNumber(a.order, 0) - toNumber(b.order, 0))
          .map((lecture) => {
            const progress = lectureProgressMap[lecture.id] || {};
            const hasAccess =
              accessMap[lecture.id] !== undefined ? accessMap[lecture.id] : true;
            return {
              lectureId: lecture.id,
              title: trimText(lecture.title) || "Lecture",
              isCompleted: Boolean(progress.isCompleted),
              completedAt: progress.completedAt || null,
              hasAccess,
            };
          });

        const totalLectures = chapterLectures.length;
        const completedLectures = chapterLectures.filter((row) => row.isCompleted).length;

        return {
          chapterId: chapter.id,
          title: trimText(chapter.title) || "Chapter",
          order: toNumber(chapter.order, 0),
          totalLectures,
          completedLectures,
          lectures: chapterLectures,
        };
      });

    const allLectures = chapters.flatMap((row) => row.lectures);
    const totalLectures = allLectures.length;
    const completedLectures = allLectures.filter((row) => row.isCompleted).length;
    const overallPercent =
      totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0;

    return successResponse(
      res,
      {
        course: {
          id: courseId,
          title: trimText(courseData.title) || "Course",
          description: trimText(courseData.description || courseData.shortDescription),
          teacherName: trimText(courseData.teacherName) || "Teacher",
        },
        progress: {
          completedLectures,
          totalLectures,
          completionPercent: clampPercent(overallPercent),
        },
        chapters,
      },
      "Course progress fetched"
    );
  } catch (error) {
    console.error("getStudentCourseProgress error:", error);
    return errorResponse(res, "Failed to fetch course progress", 500);
  }
};

export const markLectureComplete = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const courseId = trimText(req.params?.courseId || req.body?.courseId);
    const lectureId = trimText(req.params?.lectureId || req.body?.lectureId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!courseId || !lectureId) {
      return errorResponse(res, "courseId and lectureId are required", 400);
    }

    const enrolledIds = await getStudentEnrolledCourseIds(uid);
    if (!enrolledIds.includes(courseId)) {
      return errorResponse(res, "You are not enrolled in this course", 403);
    }

    const [courseSnap, lectureSnap] = await Promise.all([
      db.collection(COLLECTIONS.COURSES).doc(courseId).get(),
      db.collection(COLLECTIONS.LECTURES).doc(lectureId).get(),
    ]);
    if (!courseSnap.exists) return errorResponse(res, "Course not found", 404);
    if (!lectureSnap.exists) return errorResponse(res, "Lecture not found", 404);

    const progressSnap = await db
      .collection(COLLECTIONS.PROGRESS)
      .where("studentId", "==", uid)
      .where("courseId", "==", courseId)
      .where("lectureId", "==", lectureId)
      .limit(1)
      .get();

    if (progressSnap.empty) {
      await db.collection(COLLECTIONS.PROGRESS).add({
        studentId: uid,
        courseId,
        lectureId,
        isCompleted: true,
        progress: 100,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    } else {
      await progressSnap.docs[0].ref.set(
        {
          studentId: uid,
          courseId,
          lectureId,
          isCompleted: true,
          progress: 100,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    const [courseLectures, allProgressRows, enrollmentSnap, profile] = await Promise.all([
      getCourseLectures(courseId),
      getProgressRowsForStudent(uid, courseId),
      db
        .collection(COLLECTIONS.ENROLLMENTS)
        .where("studentId", "==", uid)
        .where("courseId", "==", courseId)
        .get(),
      getStudentAndUser(uid),
    ]);

    const totalLectures = courseLectures.length;
    const progressMap = buildLectureProgressMap(allProgressRows, courseId);
    const completedCount = courseLectures.filter(
      (lecture) => progressMap[lecture.id]?.isCompleted
    ).length;
    const completionPercent =
      totalLectures > 0 ? Math.round((completedCount / totalLectures) * 100) : 0;
    const isCompleted = totalLectures > 0 && completedCount >= totalLectures;

    if (!enrollmentSnap.empty) {
      const batch = db.batch();
      enrollmentSnap.docs.forEach((doc) =>
        batch.update(doc.ref, {
          progress: clampPercent(completionPercent),
          status: isCompleted ? "completed" : "active",
          completedAt: isCompleted ? serverTimestamp() : null,
          updatedAt: serverTimestamp(),
        })
      );
      await batch.commit();
    }

    let certificate = null;
    if (isCompleted) {
      certificate = await ensureCertificateForCompletion({
        studentId: uid,
        studentData: profile.studentData,
        userData: profile.userData,
        courseId,
        courseData: courseSnap.data() || {},
      });
    }

    return successResponse(
      res,
      {
        courseId,
        lectureId,
        completedLectures: completedCount,
        totalLectures,
        completionPercent: clampPercent(completionPercent),
        courseCompleted: isCompleted,
        certificateIssued: Boolean(certificate?.created),
      },
      "Lecture marked as complete"
    );
  } catch (error) {
    console.error("markLectureComplete error:", error);
    return errorResponse(res, "Failed to update lecture progress", 500);
  }
};

export const exploreCourses = async (req, res) => {
  try {
    const category = trimText(req.query?.category).toLowerCase();
    const level = trimText(req.query?.level).toLowerCase();
    const search = trimText(req.query?.search).toLowerCase();

    let uid = "";
    const tokenHeader = trimText(req.headers?.authorization);
    if (tokenHeader.toLowerCase().startsWith("bearer ")) {
      const token = tokenHeader.split(" ").slice(1).join(" ").trim();
      if (token) {
        try {
          const decoded = await admin.auth().verifyIdToken(token);
          uid = trimText(decoded.uid);
        } catch {
          uid = "";
        }
      }
    }

    const [coursesSnap, enrolledCourseIds] = await Promise.all([
      db.collection(COLLECTIONS.COURSES).where("status", "==", "published").get(),
      uid ? getStudentEnrolledCourseIds(uid) : Promise.resolve([]),
    ]);
    const enrolledSet = new Set(enrolledCourseIds);

    let courses = coursesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    if (category) {
      courses = courses.filter((row) => lowerText(row.category) === category);
    }
    if (level) {
      courses = courses.filter((row) => lowerText(row.level) === level);
    }
    if (search) {
      courses = courses.filter((row) => lowerText(row.title).includes(search));
    }

    const payload = courses.map((course) => ({
      originalPrice: toNumber(course.price, 0),
      discountPercent: toNumber(course.discountPercent, 0),
      discountAmount: Number(
        (
          (toNumber(course.price, 0) *
            Math.max(0, Math.min(100, toNumber(course.discountPercent, 0)))) /
          100
        ).toFixed(2)
      ),
      id: course.id,
      title: trimText(course.title),
      description: trimText(course.description || course.shortDescription),
      thumbnail: course.thumbnail || null,
      category: trimText(course.category),
      level: trimText(course.level),
      price: toNumber(course.price, 0),
      discountedPrice: Number(
        Math.max(
          toNumber(course.price, 0) -
            (
              (toNumber(course.price, 0) *
                Math.max(0, Math.min(100, toNumber(course.discountPercent, 0)))) /
              100
            ),
          0
        ).toFixed(2)
      ),
      teacherName: trimText(course.teacherName) || "Teacher",
      enrollmentCount: toNumber(course.enrollmentCount, 0),
      rating: toNumber(course.rating, 0),
      subjects: Array.isArray(course.subjects) ? course.subjects : [],
      hasCertificate: course.hasCertificate !== false,
      isEnrolled: enrolledSet.has(course.id),
    }));

    return successResponse(res, payload, "Explore courses fetched");
  } catch (error) {
    console.error("exploreCourses error:", error);
    return errorResponse(res, "Failed to fetch courses", 500);
  }
};

export const getStudentCertificates = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const studentSnap = await db.collection(COLLECTIONS.STUDENTS).doc(uid).get();
    if (!studentSnap.exists) return successResponse(res, [], "Certificates fetched");
    const studentData = studentSnap.data() || {};
    const certRefs = Array.isArray(studentData.certificates) ? studentData.certificates : [];
    const certIds = certRefs
      .map((entry) => trimText(entry?.certId || entry?.id))
      .filter(Boolean);

    if (!certIds.length) return successResponse(res, [], "Certificates fetched");

    const certDocs = await Promise.all(
      certIds.map(async (certId) => {
        const byCertIdSnap = await db
          .collection(COLLECTIONS.CERTIFICATES)
          .where("certId", "==", certId)
          .limit(1)
          .get();
        if (!byCertIdSnap.empty) {
          const row = byCertIdSnap.docs[0];
          return { id: row.id, ...(row.data() || {}) };
        }
        const docSnap = await db.collection(COLLECTIONS.CERTIFICATES).doc(certId).get();
        return docSnap.exists ? { id: docSnap.id, ...(docSnap.data() || {}) } : null;
      })
    );

    const payload = certDocs
      .filter(Boolean)
      .map((cert) => ({
        ...cert,
        issuedAt: toIso(cert.issuedAt),
        createdAt: toIso(cert.createdAt),
        revokedAt: toIso(cert.revokedAt),
      }))
      .sort(
        (a, b) =>
          (parseDate(b.issuedAt || b.createdAt)?.getTime() || 0) -
          (parseDate(a.issuedAt || a.createdAt)?.getTime() || 0)
      );

    return successResponse(res, payload, "Certificates fetched");
  } catch (error) {
    console.error("getStudentCertificates error:", error);
    return errorResponse(res, "Failed to fetch certificates", 500);
  }
};

const getActiveQuizzesForCourseIds = async (courseIds = []) => {
  const cleanIds = [...new Set(courseIds.map((id) => trimText(id)).filter(Boolean))];
  if (!cleanIds.length) return [];

  const rows = [];
  for (const idsChunk of chunkArray(cleanIds, 10)) {
    if (!idsChunk.length) continue;
    try {
      const snap = await db
        .collection(COLLECTIONS.QUIZZES)
        .where("status", "==", "active")
        .where("courseId", "in", idsChunk)
        .get();
      rows.push(
        ...snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() || {}),
        }))
      );
    } catch {
      const snap = await db
        .collection(COLLECTIONS.QUIZZES)
        .where("courseId", "in", idsChunk)
        .get();
      rows.push(
        ...snap.docs
          .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
          .filter((row) => lowerText(row.status || "active") === "active")
      );
    }
  }

  const seen = new Set();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
};

const getLatestQuizAttemptMap = async (studentId) => {
  const snap = await db
    .collection(COLLECTIONS.QUIZ_RESULTS)
    .where("studentId", "==", studentId)
    .get();

  const byQuiz = {};
  snap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const quizId = trimText(data.quizId);
    if (!quizId) return;
    const submittedAt = parseDate(data.submittedAt || data.createdAt)?.getTime() || 0;
    const current = byQuiz[quizId];
    const currentTime =
      parseDate(current?.submittedAt || current?.createdAt)?.getTime() || -1;
    if (!current || submittedAt >= currentTime) {
      byQuiz[quizId] = { id: doc.id, ...(data || {}) };
    }
  });

  return byQuiz;
};

const parseQuizAssignmentStudents = (assignment = {}) => {
  const students = Array.isArray(assignment.students) ? assignment.students : [];
  return students
    .map((entry) => trimText(entry?.studentId || entry?.id || entry))
    .filter(Boolean);
};

const getQuizAssignmentDueAt = (quiz = {}) => {
  const assignment = quiz?.assignment || {};
  return parseDate(assignment.dueAt || quiz?.dueAt || null);
};

const isQuizAssignedToStudent = (quiz = {}, uid = "") => {
  const assignmentStudents = parseQuizAssignmentStudents(quiz.assignment || {});
  if (!assignmentStudents.length) return false;
  return assignmentStudents.includes(uid);
};

const isAnnouncementVisibleToStudent = (
  announcement = {},
  uid = "",
  courseIdSet = new Set(),
  classIdSet = new Set()
) => {
  const targetType = lowerText(announcement.targetType || "system");
  const targetId = trimText(announcement.targetId);
  const audienceRole = lowerText(announcement.audienceRole || "student");
  const recipientIds = Array.isArray(announcement.recipientIds)
    ? announcement.recipientIds.map((entry) => trimText(entry)).filter(Boolean)
    : [];

  if (targetType === "single_user") {
    return targetId === uid || recipientIds.includes(uid);
  }

  if (!(audienceRole === "student" || audienceRole === "all")) return false;
  if (targetType === "system") return true;
  if (targetType === "course") return courseIdSet.has(targetId);
  if (targetType === "class") return classIdSet.has(targetId);
  return false;
};

export const getStudentQuizzes = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const enrolledCourseIds = await getStudentEnrolledCourseIds(uid);
    if (!enrolledCourseIds.length) {
      return successResponse(res, [], "Student quizzes fetched");
    }

    const [quizzes, latestAttemptMap, courseMap] = await Promise.all([
      getActiveQuizzesForCourseIds(enrolledCourseIds),
      getLatestQuizAttemptMap(uid),
      getCourseDocsByIds(enrolledCourseIds),
    ]);

    const nowTime = Date.now();
    const payload = quizzes
      .filter((quiz) => isQuizAssignedToStudent(quiz, uid))
      .map((quiz) => {
        const courseId = trimText(quiz.courseId);
        const courseData = courseMap[courseId] || {};
        const subjectId = trimText(quiz.subjectId);
        const subject = (Array.isArray(courseData.subjects) ? courseData.subjects : []).find(
          (row) => trimText(row?.id || row?.subjectId) === subjectId
        );
        const passScore = toNumber(quiz.passScore, 50);
        const latest = latestAttemptMap[quiz.id];
        const dueAtDate = getQuizAssignmentDueAt(quiz);
        const dueAt = dueAtDate ? dueAtDate.toISOString() : null;
        const isPastDue = dueAtDate ? dueAtDate.getTime() < nowTime : false;
        const percentage = toNumber(
          latest?.percentage ?? latest?.scorePercent,
          0
        );
        let status = "available";
        if (latest) {
          if (
            ["partial", "pending_review"].includes(lowerText(latest.status))
          ) {
            status = "attempted";
          } else if (latest.isPassed === true || percentage >= passScore) {
            status = "passed";
          } else {
            status = "failed";
          }
        }

        return {
          id: quiz.id,
          title: trimText(quiz.title) || "Quiz",
          courseId,
          courseName: trimText(quiz.courseName || courseData.title) || "Course",
          subjectId,
          subjectName:
            trimText(quiz.subjectName || subject?.subjectName || subject?.name) ||
            "Subject",
          scope: lowerText(quiz.scope || "subject"),
          chapterId: trimText(quiz.chapterId),
          chapterName: trimText(quiz.chapterName || quiz.chapterTitle),
          totalMarks: Math.max(0, toNumber(quiz.totalMarks, 0)),
          questionsCount: Math.max(
            0,
            toNumber(quiz.questionCount, Array.isArray(quiz.questions) ? quiz.questions.length : 0)
          ),
          timeLimit: Math.max(0, toNumber(quiz.timeLimit, 0)),
          passScore,
          status,
          dueAt,
          isPastDue,
          lastAttempt: latest
            ? {
                score: toNumber(
                  latest.totalScore ?? latest.autoScore ?? latest.objectiveScore,
                  0
                ),
                percentage: toNumber(
                  latest.percentage ?? latest.scorePercent ?? latest.totalScore,
                  0
                ),
                submittedAt: toIso(latest.submittedAt || latest.createdAt),
              }
            : null,
        };
      })
      .filter((row) => row.lastAttempt || !row.isPastDue)
      .map(({ isPastDue, ...row }) => row)
      .sort(
        (a, b) =>
          (parseDate(b.lastAttempt?.submittedAt)?.getTime() || 0) -
          (parseDate(a.lastAttempt?.submittedAt)?.getTime() || 0)
      );

    return successResponse(res, payload, "Student quizzes fetched");
  } catch (error) {
    console.error("getStudentQuizzes error:", error);
    return errorResponse(res, "Failed to fetch quizzes", 500);
  }
};

export const getQuizById = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const quizId = trimText(req.params?.quizId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!quizId) return errorResponse(res, "quizId is required", 400);

    const quizSnap = await db.collection(COLLECTIONS.QUIZZES).doc(quizId).get();
    if (!quizSnap.exists) return errorResponse(res, "Quiz not found", 404);
    const quizData = quizSnap.data() || {};
    const courseId = trimText(quizData.courseId);

    const enrolledIds = await getStudentEnrolledCourseIds(uid);
    if (!courseId || !enrolledIds.includes(courseId)) {
      return errorResponse(res, "You are not enrolled in this quiz course", 403);
    }

    if (!isQuizAssignedToStudent(quizData, uid)) {
      return errorResponse(res, "This quiz is not assigned to you", 403);
    }
    const dueAtDate = getQuizAssignmentDueAt(quizData);
    if (dueAtDate && dueAtDate.getTime() < Date.now()) {
      return errorResponse(res, "Quiz deadline has passed", 403);
    }

    const questions = Array.isArray(quizData.questions) ? quizData.questions : [];
    const sanitizedQuestions = questions
      .map((question) => sanitizeQuestionForStudent(question))
      .filter((row) => row.questionId);

    return successResponse(
      res,
      {
        id: quizId,
        title: trimText(quizData.title) || "Quiz",
        description: trimText(quizData.description),
        courseId,
        courseName: trimText(quizData.courseName) || "Course",
        subjectId: trimText(quizData.subjectId),
        subjectName: trimText(quizData.subjectName) || "Subject",
        chapterId: trimText(quizData.chapterId),
        chapterName: trimText(quizData.chapterName || quizData.chapterTitle),
        scope: lowerText(quizData.scope || "subject"),
        totalMarks: Math.max(
          0,
          toNumber(
            quizData.totalMarks,
            sanitizedQuestions.reduce(
              (sum, question) => sum + Math.max(1, toNumber(question.marks, 1)),
              0
            )
          )
        ),
        passScore: toNumber(quizData.passScore, 50),
        timeLimit: Math.max(0, toNumber(quizData.timeLimit, 0)),
        questions: sanitizedQuestions,
      },
      "Quiz fetched"
    );
  } catch (error) {
    console.error("getQuizById error:", error);
    return errorResponse(res, "Failed to fetch quiz", 500);
  }
};

export const submitQuizAttempt = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const quizId = trimText(req.params?.quizId);
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!quizId) return errorResponse(res, "quizId is required", 400);
    if (!answers.length) return errorResponse(res, "answers are required", 400);

    const quizSnap = await db.collection(COLLECTIONS.QUIZZES).doc(quizId).get();
    if (!quizSnap.exists) return errorResponse(res, "Quiz not found", 404);
    const quizData = quizSnap.data() || {};
    const courseId = trimText(quizData.courseId);
    const enrolledIds = await getStudentEnrolledCourseIds(uid);
    if (!courseId || !enrolledIds.includes(courseId)) {
      return errorResponse(res, "You are not enrolled in this quiz course", 403);
    }

    if (!isQuizAssignedToStudent(quizData, uid)) {
      return errorResponse(res, "This quiz is not assigned to you", 403);
    }
    const dueAtDate = getQuizAssignmentDueAt(quizData);
    if (dueAtDate && dueAtDate.getTime() < Date.now()) {
      return errorResponse(res, "Quiz deadline has passed", 403);
    }

    const questions = Array.isArray(quizData.questions) ? quizData.questions : [];
    if (!questions.length) return errorResponse(res, "Quiz has no questions", 400);

    const answerMap = normalizeSubmittedAnswers(answers);
    let autoScore = 0;
    let shortAnswerPending = 0;
    const gradedAnswers = questions.map((question) => {
      const questionId = trimText(question.questionId || question.id);
      const questionType = lowerText(question.type || question.questionType || "mcq");
      const questionText = trimText(question.questionText || question.text);
      const maxMarks = Math.max(1, toNumber(question.marks, 1));
      const studentAnswerRaw = answerMap[questionId];
      const studentAnswer =
        studentAnswerRaw === undefined || studentAnswerRaw === null
          ? ""
          : String(studentAnswerRaw);

      const grading = gradeObjectiveAnswer(question, studentAnswerRaw);
      if (grading.pending) {
        shortAnswerPending += 1;
      } else {
        autoScore += Math.max(0, toNumber(grading.marksObtained, 0));
      }

      const marksValue =
        grading.marksObtained === null || grading.marksObtained === undefined
          ? null
          : Math.max(0, toNumber(grading.marksObtained, 0));

      return {
        questionId,
        type: questionType,
        questionType,
        questionText,
        submittedAnswer: studentAnswer,
        studentAnswer,
        expectedAnswer:
          questionType === "short_answer"
            ? trimText(question.expectedAnswer || "")
            : "",
        correctAnswer:
          questionType === "short_answer"
            ? null
            : questionType === "true_false"
              ? question.correctAnswer === true ||
                ["true", "1", "yes", "t"].includes(lowerText(question.correctAnswer))
              : trimText(question.correctAnswer),
        isCorrect: grading.isCorrect,
        marksAwarded: marksValue,
        marksObtained: marksValue,
        maxMarks,
        requiresManualReview: questionType === "short_answer",
        feedback: "",
        status: grading.status,
      };
    });

    const totalMarks = Math.max(
      0,
      toNumber(
        quizData.totalMarks,
        questions.reduce(
          (sum, question) => sum + Math.max(1, toNumber(question.marks, 1)),
          0
        )
      )
    );
    const percentage = totalMarks > 0 ? Number(((autoScore / totalMarks) * 100).toFixed(2)) : 0;
    const passScore = toNumber(quizData.passScore, 50);
    const status = shortAnswerPending > 0 ? "pending_review" : "completed";
    const isPassed = percentage >= passScore;

    const studentProfile = await getStudentAndUser(uid);
    const studentName =
      trimText(studentProfile.studentData.fullName) ||
      trimText(studentProfile.studentData.name) ||
      trimText(studentProfile.userData.fullName) ||
      getNameFromEmail(studentProfile.userData.email || "");

    const resultRef = await db.collection(COLLECTIONS.QUIZ_RESULTS).add({
      studentId: uid,
      studentName,
      quizId,
      quizTitle: trimText(quizData.title),
      teacherId: trimText(quizData.teacherId),
      courseId,
      courseName: trimText(quizData.courseName),
      subjectId: trimText(quizData.subjectId),
      subjectName: trimText(quizData.subjectName),
      chapterId: trimText(quizData.chapterId),
      chapterTitle: trimText(quizData.chapterTitle || quizData.chapterName),
      answers: gradedAnswers,
      autoScore,
      objectiveScore: autoScore,
      manualScore: 0,
      totalScore: autoScore,
      totalMarks,
      shortAnswerPending,
      pendingManualMarks: gradedAnswers
        .filter((row) => row.status === "pending_review")
        .reduce((sum, row) => sum + Math.max(1, toNumber(row.maxMarks, 1)), 0),
      status,
      percentage,
      scorePercent: percentage,
      isPassed,
      submittedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return successResponse(
      res,
      {
        resultId: resultRef.id,
        quizId,
        autoScore,
        totalMarks,
        shortAnswerPending,
        status,
        percentage,
        isPassed,
        answers: gradedAnswers.map((row) => ({
          questionId: row.questionId,
          questionType: row.questionType,
          status: row.status,
          isCorrect: row.isCorrect,
          marksObtained: row.marksObtained,
        })),
      },
      "Quiz submitted successfully",
      201
    );
  } catch (error) {
    console.error("submitQuizAttempt error:", error);
    return errorResponse(res, "Failed to submit quiz attempt", 500);
  }
};

export const getStudentAnnouncements = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const [courseIds, classIds] = await Promise.all([
      getStudentEnrolledCourseIds(uid),
      getStudentClassIds(uid),
    ]);
    const courseIdSet = new Set(courseIds);
    const classIdSet = new Set(classIds);

    let rows = [];
    try {
      const snap = await db
        .collection(COLLECTIONS.ANNOUNCEMENTS)
        .orderBy("isPinned", "desc")
        .orderBy("createdAt", "desc")
        .get();
      rows = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    } catch {
      const snap = await db
        .collection(COLLECTIONS.ANNOUNCEMENTS)
        .orderBy("createdAt", "desc")
        .get();
      rows = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    }

    const payload = rows
      .filter((row) => isAnnouncementVisibleToStudent(row, uid, courseIdSet, classIdSet))
      .sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
          return a.isPinned ? -1 : 1;
        }
        return parseAnnouncementDate(b.createdAt) - parseAnnouncementDate(a.createdAt);
      })
      .map((row) => {
        const readBy = Array.isArray(row.readBy) ? row.readBy : [];
        return {
          id: row.id,
          title: trimText(row.title) || "Announcement",
          message: trimText(row.message),
          targetType: lowerText(row.targetType || "system"),
          targetId: trimText(row.targetId),
          audienceRole: lowerText(row.audienceRole || "student"),
          isPinned: Boolean(row.isPinned),
          createdAt: toIso(row.createdAt),
          updatedAt: toIso(row.updatedAt),
          postedBy: trimText(row.postedBy),
          postedByName: trimText(row.postedByName),
          isRead: readBy.includes(uid),
        };
      });

    return successResponse(res, payload, "Student announcements fetched");
  } catch (error) {
    console.error("getStudentAnnouncements error:", error);
    return errorResponse(res, "Failed to fetch announcements", 500);
  }
};

export const markAnnouncementRead = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const announcementId = trimText(req.params?.id || req.params?.announcementId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (!announcementId) return errorResponse(res, "announcement id is required", 400);

    const ref = db.collection(COLLECTIONS.ANNOUNCEMENTS).doc(announcementId);
    const snap = await ref.get();
    if (!snap.exists) return errorResponse(res, "Announcement not found", 404);
    const data = snap.data() || {};

    const [courseIds, classIds] = await Promise.all([
      getStudentEnrolledCourseIds(uid),
      getStudentClassIds(uid),
    ]);
    if (
      !isAnnouncementVisibleToStudent(data, uid, new Set(courseIds), new Set(classIds))
    ) {
      return errorResponse(res, "Announcement not found", 404);
    }

    const readBy = Array.isArray(data.readBy) ? data.readBy : [];
    if (!readBy.includes(uid)) {
      await ref.set(
        { readBy: admin.firestore.FieldValue.arrayUnion(uid), updatedAt: serverTimestamp() },
        { merge: true }
      );
    }

    return successResponse(
      res,
      { id: announcementId, isRead: true },
      "Announcement marked as read"
    );
  } catch (error) {
    console.error("markAnnouncementRead error:", error);
    return errorResponse(res, "Failed to mark announcement as read", 500);
  }
};

const buildStudentAttendancePayload = async (uid = "") => {
  const cleanUid = trimText(uid);
  const emptySummary = {
    totalSessions: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    attendancePercent: 0,
    currentStreak: 0,
    longestStreak: 0,
    learningDaysElapsed: 0,
    courseDurationDays: 0,
    learningDayProgress: null,
  };
  const emptyPayload = { classes: [], summary: emptySummary };
  if (!cleanUid) return emptyPayload;

  const [enrolledCourseIds, enrollmentRows] = await Promise.all([
    getStudentEnrolledCourseIds(cleanUid),
    getEnrolledRows(cleanUid),
  ]);
  const enrolledCourseSet = new Set(
    enrolledCourseIds.map((id) => trimText(id)).filter(Boolean)
  );
  if (!enrolledCourseSet.size) return emptyPayload;

  const classIds = await getStudentClassIds(cleanUid, enrollmentRows);
  if (!classIds.length) return emptyPayload;

  const [classSnaps, attendanceSnap, courseMap] = await Promise.all([
    Promise.all(
      classIds.map(async (classId) => {
        const snap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
        return [classId, snap.exists ? snap.data() || {} : null];
      })
    ),
    db.collection(COLLECTIONS.ATTENDANCE).where("studentId", "==", cleanUid).get(),
    getCourseDocsByIds(enrolledCourseIds),
  ]);

  const classMap = Object.fromEntries(classSnaps.filter(([, row]) => Boolean(row)));
  const normalizeCourseIdsFromClass = (classData = {}) => {
    const ids = [];
    if (trimText(classData.courseId)) ids.push(trimText(classData.courseId));
    const assigned = Array.isArray(classData.assignedCourses) ? classData.assignedCourses : [];
    assigned.forEach((entry) => {
      const candidate =
        typeof entry === "string"
          ? trimText(entry)
          : trimText(entry?.courseId || entry?.id);
      if (candidate) ids.push(candidate);
    });
    const courses = Array.isArray(classData.courses) ? classData.courses : [];
    courses.forEach((entry) => {
      const candidate =
        typeof entry === "string"
          ? trimText(entry)
          : trimText(entry?.courseId || entry?.id);
      if (candidate) ids.push(candidate);
    });
    return [...new Set(ids)];
  };

  const filteredClassIds = classIds.filter((classId) => {
    const classData = classMap[classId];
    if (!classData) return false;
    const classCourseIds = getStudentCourseIdsFromClassRow(classData, cleanUid);
    const fallbackCourseIds = normalizeCourseIdsFromClass(classData);
    const resolvedCourseIds = classCourseIds.length ? classCourseIds : fallbackCourseIds;
    if (!resolvedCourseIds.length) return false;
    return resolvedCourseIds.some((courseId) => enrolledCourseSet.has(courseId));
  });
  if (!filteredClassIds.length) return emptyPayload;

  const sessionRows = [];
  for (const chunk of chunkArray(filteredClassIds, 10)) {
    if (!chunk.length) continue;
    try {
      const snap = await db
        .collection(COLLECTIONS.SESSIONS)
        .where("classId", "in", chunk)
        .get();
      sessionRows.push(...snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })));
    } catch {
      const fallbackRows = await Promise.all(
        chunk.map(async (classId) => {
          const snap = await db
            .collection(COLLECTIONS.SESSIONS)
            .where("classId", "==", classId)
            .get();
          return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
        })
      );
      sessionRows.push(...fallbackRows.flat());
    }
  }

  const sessionByClass = {};
  sessionRows.forEach((row) => {
    const classId = trimText(row.classId);
    if (!classId) return;
    if (!sessionByClass[classId]) sessionByClass[classId] = [];
    if (lowerText(row.status) === "cancelled" || row.cancelledAt) return;
    sessionByClass[classId].push(row);
  });

  const attendanceRows = attendanceSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  const attendanceBySession = attendanceRows.reduce((acc, row) => {
    const sessionId = trimText(row.sessionId);
    if (!sessionId) return acc;
    acc[sessionId] = row;
    return acc;
  }, {});

  const today = toDateOnly(new Date());
  const classes = filteredClassIds.map((classId) => {
    const classData = classMap[classId] || {};
    const classCourseIds = getStudentCourseIdsFromClassRow(classData, cleanUid);
    const fallbackCourseIds = normalizeCourseIdsFromClass(classData);
    const resolvedCourseIds = (classCourseIds.length ? classCourseIds : fallbackCourseIds).filter(
      (courseId) => enrolledCourseSet.has(courseId)
    );

    const matchingEnrollments = enrollmentRows.filter(
      (row) =>
        trimText(row.studentId) === cleanUid &&
        trimText(row.classId) === classId &&
        (!resolvedCourseIds.length || resolvedCourseIds.includes(trimText(row.courseId)))
    );

    const windowStart = maxDate([
      toDateOnly(classData.startDate),
      ...matchingEnrollments.map((row) => toDateOnly(row.createdAt || row.enrolledAt)),
      ...resolvedCourseIds.map((courseId) => toDateOnly(courseMap[courseId]?.startDate)),
    ]);
    let windowEnd = minDate([
      toDateOnly(classData.endDate),
      ...matchingEnrollments.map((row) => toDateOnly(row.completedAt)),
      ...resolvedCourseIds.map((courseId) => toDateOnly(courseMap[courseId]?.endDate)),
    ]);
    if (windowStart && windowEnd && windowEnd.getTime() < windowStart.getTime()) {
      windowEnd = null;
    }

    const sessions = (sessionByClass[classId] || [])
      .filter((session) => {
        const sessionDate = toDateOnly(session.date);
        if (!sessionDate) return false;
        const sessionCourseId = trimText(session.courseId);
        if (
          resolvedCourseIds.length &&
          sessionCourseId &&
          !resolvedCourseIds.includes(sessionCourseId)
        ) {
          return false;
        }
        return isDateInRange(sessionDate, windowStart, windowEnd);
      })
      .sort(
        (a, b) => (toDateOnly(a.date)?.getTime() || 0) - (toDateOnly(b.date)?.getTime() || 0)
      );

    const normalizedSessions = sessions.map((session, index) => {
      const attendance = attendanceBySession[session.id] || null;
      const rawDate = toDateOnly(session.date);
      const normalizedDate = formatSessionDate(session.date);
      const startTime = trimText(session.startTime);
      const endTime = trimText(session.endTime);
      const startsAt = rawDate
        ? (() => {
            const date = new Date(rawDate);
            const timeMatch = /^(\d{2}):(\d{2})$/.exec(startTime);
            if (timeMatch) {
              date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
            } else {
              date.setHours(23, 59, 59, 999);
            }
            return date;
          })()
        : null;
      const isUpcoming = startsAt
        ? startsAt.getTime() > Date.now()
        : rawDate
          ? rawDate.getTime() > Date.now()
          : false;

      let status = "absent";
      if (isUpcoming) {
        status = "upcoming";
      } else if (attendance) {
        const normalizedStatus = lowerText(attendance.status);
        if (["present", "absent", "late"].includes(normalizedStatus)) {
          status = normalizedStatus;
        }
      }

      return {
        sessionId: session.id,
        sessionNumber: index + 1,
        date: normalizedDate,
        startTime,
        endTime,
        topic: trimText(session.topic) || "Session",
        courseId: trimText(session.courseId),
        courseName: trimText(session.courseName),
        subjectId: trimText(session.subjectId),
        subjectName: trimText(session.subjectName),
        status,
        remarks: trimText(attendance?.remarks || attendance?.note || session.remarks || ""),
        isUpcoming,
        markedBy: trimText(attendance?.markedBy),
        markedAt: toIso(attendance?.markedAt),
      };
    });

    const conductedSessions = normalizedSessions.filter((row) => !row.isUpcoming);
    const totalSessions = conductedSessions.length;
    const presentCount = conductedSessions.filter((row) => row.status === "present").length;
    const lateCount = conductedSessions.filter((row) => row.status === "late").length;
    const absentCount = conductedSessions.filter((row) => row.status === "absent").length;
    const attendancePercent =
      totalSessions > 0
        ? Number((((presentCount + lateCount) / totalSessions) * 100).toFixed(2))
        : 0;

    const { currentStreak, longestStreak } = getCurrentAndLongestStreak(conductedSessions);
    const learningStart =
      windowStart || toDateOnly(conductedSessions[0]?.date || normalizedSessions[0]?.date);
    const learningEnd = learningStart ? minDate([windowEnd, today]) || today : null;
    const learningDaysElapsed =
      learningStart && learningEnd ? daysInclusive(learningStart, learningEnd) : 0;
    const courseDurationDays =
      windowStart && windowEnd ? daysInclusive(windowStart, windowEnd) : 0;
    const learningDayProgress =
      courseDurationDays > 0
        ? Number(Math.min(100, ((learningDaysElapsed / courseDurationDays) * 100).toFixed(2)))
        : null;

    return {
      classId,
      className: trimText(classData.name) || "Class",
      batchCode: trimText(classData.batchCode),
      teacherName: trimText(classData.teacherName) || "Teacher",
      courseWindowStart: windowStart ? windowStart.toISOString().slice(0, 10) : null,
      courseWindowEnd: windowEnd ? windowEnd.toISOString().slice(0, 10) : null,
      learningDaysElapsed,
      courseDurationDays,
      learningDayProgress,
      currentStreak,
      longestStreak,
      totalSessions,
      presentCount,
      absentCount,
      lateCount,
      attendancePercent,
      sessions: normalizedSessions,
    };
  });

  const summary = classes.reduce(
    (acc, row) => {
      acc.totalSessions += row.totalSessions;
      acc.presentCount += row.presentCount;
      acc.absentCount += row.absentCount;
      acc.lateCount += row.lateCount;
      acc.learningDaysElapsed += toNumber(row.learningDaysElapsed, 0);
      acc.courseDurationDays += toNumber(row.courseDurationDays, 0);
      acc.currentStreak = Math.max(acc.currentStreak, toNumber(row.currentStreak, 0));
      acc.longestStreak = Math.max(acc.longestStreak, toNumber(row.longestStreak, 0));
      return acc;
    },
    {
      totalSessions: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      currentStreak: 0,
      longestStreak: 0,
      learningDaysElapsed: 0,
      courseDurationDays: 0,
    }
  );
  summary.attendancePercent =
    summary.totalSessions > 0
      ? Number((((summary.presentCount + summary.lateCount) / summary.totalSessions) * 100).toFixed(2))
      : 0;
  summary.learningDayProgress =
    summary.courseDurationDays > 0
      ? Number(
          Math.min(100, ((summary.learningDaysElapsed / summary.courseDurationDays) * 100).toFixed(2))
        )
      : null;

  return { classes, summary };
};

export const getStudentAttendance = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    const payload = await buildStudentAttendancePayload(uid);
    return successResponse(res, payload, "Student attendance fetched");
  } catch (error) {
    console.error("getStudentAttendance error:", error);
    return errorResponse(res, "Failed to fetch attendance", 500);
  }
};

export const submitHelpSupportMessage = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const category = trimText(req.body?.category) || "General";
    const subject = trimText(req.body?.subject);
    const message = trimText(req.body?.message);
    if (subject.length < 3) {
      return errorResponse(res, "Subject must be at least 3 characters", 400);
    }
    if (message.length < 10) {
      return errorResponse(res, "Message must be at least 10 characters", 400);
    }

    const [studentSnap, userSnap, settingsSnap] = await Promise.all([
      db.collection(COLLECTIONS.STUDENTS).doc(uid).get(),
      db.collection(COLLECTIONS.USERS).doc(uid).get(),
      db.collection(COLLECTIONS.SETTINGS).doc(SETTINGS_DOC_ID).get(),
    ]);

    const studentData = studentSnap.exists ? studentSnap.data() || {} : {};
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const studentName =
      trimText(req.body?.name) ||
      trimText(studentData.fullName) ||
      trimText(studentData.name) ||
      trimText(userData.fullName) ||
      getNameFromEmail(userData.email || "");
    const studentEmail = trimText(userData.email || req.body?.email);
    if (!isValidEmail(studentEmail)) {
      return errorResponse(res, "Student email is invalid", 400);
    }

    const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};
    const adminEmail =
      normalizeEmailAddress(settings.contact?.email) ||
      normalizeEmailAddress(settings.general?.contactEmail) ||
      normalizeEmailAddress(process.env.SMTP_EMAIL) ||
      normalizeEmailAddress(process.env.EMAIL_FROM);
    if (!isValidEmail(adminEmail)) {
      return errorResponse(res, "Support email is not configured", 500);
    }

    const messageRef = db.collection(COLLECTIONS.SUPPORT_MESSAGES).doc();
    await messageRef.set({
      source: "student",
      userRole: "student",
      userId: uid,
      name: studentName || "Student",
      email: studentEmail,
      category,
      subject,
      message,
      isRead: false,
      status: "unread",
      replyMessage: "",
      repliedAt: null,
      repliedBy: null,
      readAt: null,
      readBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await sendStudentHelpSupportEmail(adminEmail, {
      requestSource: "student",
      studentName: studentName || "Student",
      studentEmail,
      category,
      subject,
      message,
    });

    return successResponse(
      res,
      { submitted: true, ticketId: messageRef.id },
      "Help support message sent"
    );
  } catch (error) {
    console.error("submitHelpSupportMessage error:", error);
    return errorResponse(res, "Failed to send support message", 500);
  }
};

export const getStudentSettings = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const [userSnap, studentSnap] = await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(uid).get(),
      db.collection(COLLECTIONS.STUDENTS).doc(uid).get(),
    ]);
    if (!userSnap.exists && !studentSnap.exists) {
      return errorResponse(res, "Student profile not found", 404);
    }

    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const studentData = studentSnap.exists ? studentSnap.data() || {} : {};
    const payload = {
      uid,
      email: trimText(userData.email || studentData.email),
      role: "student",
      fullName:
        trimText(studentData.fullName) ||
        trimText(studentData.name) ||
        trimText(userData.fullName) ||
        getNameFromEmail(userData.email || ""),
      phoneNumber:
        normalizePakistanPhone(
          trimText(studentData.phoneNumber || userData.phoneNumber || studentData.phone)
        ) ||
        trimText(studentData.phoneNumber || userData.phoneNumber || studentData.phone),
      fatherName: trimText(studentData.fatherName),
      fatherPhone:
        normalizePakistanPhone(trimText(studentData.fatherPhone)) ||
        trimText(studentData.fatherPhone),
      fatherOccupation: trimText(studentData.fatherOccupation),
      address: trimText(studentData.address),
      district: trimText(studentData.district),
      domicile: trimText(studentData.domicile),
      caste: trimText(studentData.caste),
      profilePicture: studentData.profilePicture || userData.profilePicture || null,
      createdAt: toIso(studentData.createdAt || userData.createdAt),
      lastLoginAt: toIso(userData.lastLoginAt),
      enrolledCourses: Array.isArray(studentData.enrolledCourses)
        ? studentData.enrolledCourses
        : [],
      certificates: Array.isArray(studentData.certificates) ? studentData.certificates : [],
    };

    return successResponse(res, payload, "Student settings fetched");
  } catch (error) {
    console.error("getStudentSettings error:", error);
    return errorResponse(res, "Failed to fetch student settings", 500);
  }
};

export const updateStudentSettings = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const fullName = trimText(req.body?.fullName);
    const phoneNumberRaw = trimText(req.body?.phoneNumber);
    const phoneNumber = phoneNumberRaw
      ? normalizePakistanPhone(phoneNumberRaw)
      : "";
    const fatherName = trimText(req.body?.fatherName);
    const fatherPhoneRaw = trimText(req.body?.fatherPhone);
    const fatherPhone = fatherPhoneRaw
      ? normalizePakistanPhone(fatherPhoneRaw)
      : "";
    const fatherOccupation = trimText(req.body?.fatherOccupation);
    const address = trimText(req.body?.address);
    const district = trimText(req.body?.district);
    const domicile = trimText(req.body?.domicile);
    const caste = trimText(req.body?.caste);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (fullName.length < 2) {
      return errorResponse(res, "fullName must be at least 2 characters", 400);
    }
    if (fullName.length > 120) {
      return errorResponse(res, "fullName cannot exceed 120 characters", 400);
    }
    if (phoneNumberRaw && !isPakistanPhone(phoneNumber)) {
      return errorResponse(
        res,
        "phoneNumber must be 03001234567 or +923001234567 format",
        400
      );
    }
    if (fatherName.length > 120) {
      return errorResponse(res, "fatherName cannot exceed 120 characters", 400);
    }
    if (fatherPhoneRaw && !isPakistanPhone(fatherPhone)) {
      return errorResponse(
        res,
        "fatherPhone must be 03001234567 or +923001234567 format",
        400
      );
    }
    if (fatherOccupation.length > 120) {
      return errorResponse(res, "fatherOccupation cannot exceed 120 characters", 400);
    }
    if (district.length > 120) {
      return errorResponse(res, "district cannot exceed 120 characters", 400);
    }
    if (domicile.length > 120) {
      return errorResponse(res, "domicile cannot exceed 120 characters", 400);
    }
    if (caste.length > 120) {
      return errorResponse(res, "caste cannot exceed 120 characters", 400);
    }
    if (address.length > 300) {
      return errorResponse(res, "address cannot exceed 300 characters", 400);
    }

    const userRef = db.collection(COLLECTIONS.USERS).doc(uid);
    const studentRef = db.collection(COLLECTIONS.STUDENTS).doc(uid);
    const batch = db.batch();
    batch.set(
      userRef,
      {
        fullName,
        name: fullName,
        phoneNumber: phoneNumber || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    batch.set(
      studentRef,
      {
        uid,
        email: trimText(req.user?.email),
        fullName,
        name: fullName,
        phoneNumber: phoneNumber || "",
        phone: phoneNumber || "",
        fatherName: fatherName || "",
        fatherPhone: fatherPhone || "",
        fatherOccupation: fatherOccupation || "",
        address: address || "",
        district: district || "",
        domicile: domicile || "",
        caste: caste || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();

    try {
      await auth.updateUser(uid, { displayName: fullName });
    } catch (authError) {
      console.error("updateStudentSettings auth.updateUser error:", authError?.message || authError);
    }

    const [updatedUserSnap, updatedStudentSnap] = await Promise.all([
      userRef.get(),
      studentRef.get(),
    ]);
    const userData = updatedUserSnap.exists ? updatedUserSnap.data() || {} : {};
    const studentData = updatedStudentSnap.exists ? updatedStudentSnap.data() || {} : {};

    return successResponse(
      res,
      {
        uid,
        fullName:
          trimText(studentData.fullName) ||
          trimText(userData.fullName) ||
          fullName,
        phoneNumber:
          normalizePakistanPhone(
            trimText(studentData.phoneNumber || userData.phoneNumber || "")
          ) || trimText(studentData.phoneNumber || userData.phoneNumber || ""),
        email: trimText(userData.email || studentData.email),
        fatherName: trimText(studentData.fatherName),
        fatherPhone:
          normalizePakistanPhone(trimText(studentData.fatherPhone)) ||
          trimText(studentData.fatherPhone),
        fatherOccupation: trimText(studentData.fatherOccupation),
        address: trimText(studentData.address),
        district: trimText(studentData.district),
        domicile: trimText(studentData.domicile),
        caste: trimText(studentData.caste),
      },
      "Student settings updated"
    );
  } catch (error) {
    console.error("updateStudentSettings error:", error);
    return errorResponse(res, "Failed to update student settings", 500);
  }
};
