import PDFDocument from "pdfkit";
import { admin, db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const trimText = (value = "") => String(value || "").trim();
const lowerText = (value = "") => trimText(value).toLowerCase();
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  if (typeof value?._seconds === "number") return new Date(value._seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const toIso = (value) => {
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString() : null;
};
const makeId = (prefix = "id") =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const chunkArray = (items = [], size = 10) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const getTestStatus = (testData = {}, now = new Date()) => {
  const startAt = parseDate(testData.startAt);
  const endAt = parseDate(testData.endAt);
  if (!startAt || !endAt) return "scheduled";
  if (now.getTime() < startAt.getTime()) return "scheduled";
  if (now.getTime() > endAt.getTime()) return "ended";
  return "active";
};

const normalizeOptions = (question = {}) => {
  const fromArray = Array.isArray(question.options) ? question.options : [];
  const fromFields = [
    question.optionA,
    question.optionB,
    question.optionC,
    question.optionD,
    question.optionE,
    question.optionF,
  ];
  return [...fromArray, ...fromFields]
    .map((option) => trimText(option))
    .filter(Boolean);
};

const normalizeCorrectAnswer = (rawCorrect = "", options = []) => {
  const answer = trimText(rawCorrect);
  if (!answer) return "";
  const upper = answer.toUpperCase();
  const byLetter = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };
  if (byLetter[upper] !== undefined && options[byLetter[upper]]) {
    return upper;
  }
  const byIndex = Number(answer);
  if (Number.isFinite(byIndex) && options[byIndex]) {
    return Object.keys(byLetter)[byIndex] || "";
  }
  const matchedIndex = options.findIndex(
    (option) => lowerText(option) === lowerText(answer)
  );
  if (matchedIndex >= 0) {
    return Object.keys(byLetter)[matchedIndex] || "";
  }
  return "";
};

const toAnswerLetter = (rawAnswer = "", options = []) => {
  const clean = trimText(rawAnswer);
  if (!clean) return "";
  const upper = clean.toUpperCase();
  const byLetter = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };
  if (byLetter[upper] !== undefined) return upper;
  const byIndex = Number(clean);
  if (Number.isFinite(byIndex) && byIndex >= 0 && byIndex < options.length) {
    return Object.keys(byLetter)[byIndex] || "";
  }
  const matchedIndex = options.findIndex(
    (option) => lowerText(option) === lowerText(clean)
  );
  if (matchedIndex >= 0) {
    return Object.keys(byLetter)[matchedIndex] || "";
  }
  return "";
};

const normalizeQuestions = (questions = []) => {
  if (!Array.isArray(questions) || questions.length < 1) {
    throw new Error("At least one question is required");
  }
  return questions.map((question, index) => {
    const questionText = trimText(question?.questionText || question?.text || question?.question);
    if (questionText.length < 3) {
      throw new Error(`Question ${index + 1}: text is too short`);
    }
    const options = normalizeOptions(question);
    if (options.length < 2) {
      throw new Error(`Question ${index + 1}: at least 2 options are required`);
    }
    const correctAnswer = normalizeCorrectAnswer(
      question?.correctAnswer || question?.answer,
      options
    );
    if (!correctAnswer) {
      throw new Error(`Question ${index + 1}: correct answer does not match options`);
    }
    const marks = Math.max(1, toNumber(question?.marks, 1));
    return {
      questionId: trimText(question?.questionId) || makeId("q"),
      order: index + 1,
      questionText,
      options,
      correctAnswer,
      marks,
    };
  });
};

const sanitizeQuestionsForStudent = (questions = []) =>
  questions.map((question) => ({
    questionId: trimText(question.questionId),
    order: toNumber(question.order, 0),
    questionText: trimText(question.questionText),
    options: Array.isArray(question.options) ? question.options : [],
    marks: Math.max(1, toNumber(question.marks, 1)),
  }));

const computeScore = (questions = [], answers = []) => {
  const byQuestion = questions.reduce((acc, question) => {
    acc[trimText(question.questionId)] = question;
    return acc;
  }, {});
  let score = 0;
  const normalized = (Array.isArray(answers) ? answers : []).map((answer) => {
    const questionId = trimText(answer.questionId);
    const question = byQuestion[questionId];
    const selectedAnswer = trimText(answer.selectedAnswer);
    const selectedLetter = toAnswerLetter(selectedAnswer, question?.options || []);
    const correctLetter = toAnswerLetter(question?.correctAnswer, question?.options || []);
    const marks = Math.max(1, toNumber(question?.marks, 1));
    const isCorrect = question && selectedLetter && correctLetter
      ? selectedLetter === correctLetter
      : question && lowerText(selectedAnswer) === lowerText(question.correctAnswer);
    const marksObtained = isCorrect ? marks : 0;
    score += marksObtained;
    return {
      questionId,
      selectedAnswer,
      selectedLetter,
      correctAnswer: trimText(question?.correctAnswer),
      correctLetter,
      marks,
      marksObtained,
      isCorrect,
      answeredAt: answer.answeredAt || null,
    };
  });
  const totalMarks = questions.reduce(
    (sum, question) => sum + Math.max(1, toNumber(question.marks, 1)),
    0
  );
  const percentage = totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(2)) : 0;
  return { score, totalMarks, percentage, answers: normalized };
};

const isTeacherAssignedToClass = (uid = "", classData = {}) => {
  const cleanUid = trimText(uid);
  if (!cleanUid) return false;
  if (trimText(classData.teacherId) === cleanUid) return true;

  const teachers = Array.isArray(classData.teachers) ? classData.teachers : [];
  if (
    teachers.some(
      (teacher) => trimText(teacher?.teacherId || teacher?.id || teacher?.uid) === cleanUid
    )
  ) {
    return true;
  }

  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  return shifts.some((shift) => trimText(shift?.teacherId) === cleanUid);
};

const isStudentInClass = (uid = "", classData = {}) => {
  const cleanUid = trimText(uid);
  if (!cleanUid) return false;
  const students = Array.isArray(classData.students) ? classData.students : [];
  return students.some((entry) => {
    if (typeof entry === "string") return trimText(entry) === cleanUid;
    return trimText(entry?.studentId || entry?.id || entry?.uid) === cleanUid;
  });
};

const ensureStudentProfile = async (uid = "") => {
  const [studentSnap, userSnap] = await Promise.all([
    db.collection(COLLECTIONS.STUDENTS).doc(uid).get(),
    db.collection(COLLECTIONS.USERS).doc(uid).get(),
  ]);
  const studentData = studentSnap.exists ? studentSnap.data() || {} : {};
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  return {
    fullName:
      trimText(studentData.fullName) ||
      trimText(studentData.name) ||
      trimText(userData.fullName) ||
      trimText(userData.name) ||
      trimText(userData.displayName) ||
      trimText(userData.email).split("@")[0] ||
      "Student",
    email: trimText(studentData.email) || trimText(userData.email),
  };
};

const getStudentAttemptsByTest = async (uid = "") => {
  const snap = await db
    .collection(COLLECTIONS.TEST_ATTEMPTS)
    .where("studentId", "==", uid)
    .get();
  const map = {};
  snap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const testId = trimText(data.testId);
    if (!testId) return;
    if (!map[testId]) map[testId] = [];
    map[testId].push({ id: doc.id, ref: doc.ref, ...data });
  });
  return map;
};

const getLatestAttempt = (attempts = []) =>
  [...(Array.isArray(attempts) ? attempts : [])].sort((a, b) => {
    const aTs = parseDate(a.submittedAt || a.updatedAt || a.startedAt || a.createdAt)?.getTime() || 0;
    const bTs = parseDate(b.submittedAt || b.updatedAt || b.startedAt || b.createdAt)?.getTime() || 0;
    return bTs - aTs;
  })[0] || null;

const getInProgressAttempt = (attempts = []) =>
  [...(Array.isArray(attempts) ? attempts : [])]
    .filter((attempt) => lowerText(attempt.status) === "in_progress")
    .sort((a, b) => {
      const aTs = parseDate(a.updatedAt || a.startedAt || a.createdAt)?.getTime() || 0;
      const bTs = parseDate(b.updatedAt || b.startedAt || b.createdAt)?.getTime() || 0;
      return bTs - aTs;
    })[0] || null;

const getSubmittedAttempt = (attempts = []) =>
  [...(Array.isArray(attempts) ? attempts : [])]
    .filter((attempt) => ["submitted", "auto_submitted"].includes(lowerText(attempt.status)))
    .sort((a, b) => {
      const aTs = parseDate(a.submittedAt || a.updatedAt || a.createdAt)?.getTime() || 0;
      const bTs = parseDate(b.submittedAt || b.updatedAt || b.createdAt)?.getTime() || 0;
      return bTs - aTs;
    })[0] || null;

const ensureTestManageAccess = async ({ testId = "", uid = "", role = "" }) => {
  const testSnap = await db.collection(COLLECTIONS.TESTS).doc(testId).get();
  if (!testSnap.exists) return { error: "Test not found", status: 404 };
  const testData = testSnap.data() || {};
  if (lowerText(role) !== "admin" && trimText(testData.createdBy) !== trimText(uid)) {
    return { error: "You do not have access to this test", status: 403 };
  }
  return { testRef: testSnap.ref, testData };
};

const ensureStudentCanAccessTest = async ({ testId = "", uid = "" }) => {
  const testSnap = await db.collection(COLLECTIONS.TESTS).doc(testId).get();
  if (!testSnap.exists) return { error: "Test not found", status: 404 };
  const testData = testSnap.data() || {};
  const scope = lowerText(testData.scope || "class");
  let classData = null;
  let classId = trimText(testData.classId);
  let className = trimText(testData.className);

  if (scope === "class") {
    if (!classId) return { error: "Class test is missing classId", status: 500 };
    const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
    if (!classSnap.exists) return { error: "Assigned class not found", status: 404 };
    classData = classSnap.data() || {};
    className = className || trimText(classData.name) || "Class";
    if (!isStudentInClass(uid, classData)) {
      return { error: "You are not assigned to this class test", status: 403 };
    }
  } else {
    classId = "";
    className = "Entire Center";
  }

  return { testRef: testSnap.ref, testData, classId, className, classData };
};

const buildRankingRows = async (testId = "") => {
  const cleanTestId = trimText(testId);
  if (!cleanTestId) return [];
  const snap = await db
    .collection(COLLECTIONS.TEST_ATTEMPTS)
    .where("testId", "==", cleanTestId)
    .get();

  const rows = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((row) => ["submitted", "auto_submitted"].includes(lowerText(row.status)))
    .map((row) => ({
      attemptId: row.id,
      studentId: trimText(row.studentId),
      studentName: trimText(row.studentName) || "Student",
      className: trimText(row.className) || "Center",
      obtainedMarks: toNumber(row.score, 0),
      totalMarks: Math.max(0, toNumber(row.totalMarks, 0)),
      percentage: toNumber(row.percentage, 0),
      submittedAt: toIso(row.submittedAt || row.updatedAt || row.createdAt),
    }))
    .sort((a, b) => {
      const marksDiff = b.obtainedMarks - a.obtainedMarks;
      if (marksDiff !== 0) return marksDiff;
      const pctDiff = b.percentage - a.percentage;
      if (pctDiff !== 0) return pctDiff;
      const aTs = parseDate(a.submittedAt)?.getTime() || 0;
      const bTs = parseDate(b.submittedAt)?.getTime() || 0;
      return aTs - bTs;
    });

  let lastMarks = null;
  let lastPct = null;
  let lastPosition = 1;
  return rows.map((row, index) => {
    let position = index + 1;
    if (lastMarks !== null && row.obtainedMarks === lastMarks && row.percentage === lastPct) {
      position = lastPosition;
    } else {
      lastPosition = position;
      lastMarks = row.obtainedMarks;
      lastPct = row.percentage;
    }
    return { ...row, position };
  });
};

const serializeTestSummary = (testId, testData = {}, latestAttempt = null) => {
  const now = new Date();
  const status = getTestStatus(testData, now);
  const startAt = toIso(testData.startAt);
  const endAt = toIso(testData.endAt);
  const totalMarks = Math.max(0, toNumber(testData.totalMarks, 0));
  const questionsCount = Array.isArray(testData.questions) ? testData.questions.length : 0;
  const hasSubmittedAttempt = Boolean(
    latestAttempt && ["submitted", "auto_submitted"].includes(lowerText(latestAttempt.status))
  );
  const inProgress = Boolean(latestAttempt && lowerText(latestAttempt.status) === "in_progress");
  const withinWindow = status === "active";

  return {
    id: testId,
    title: trimText(testData.title) || "Test",
    description: trimText(testData.description),
    scope: lowerText(testData.scope) || "class",
    classId: trimText(testData.classId),
    className: trimText(testData.className) || "Entire Center",
    startAt,
    endAt,
    durationMinutes: Math.max(1, toNumber(testData.durationMinutes, 30)),
    totalMarks,
    questionsCount,
    status,
    canAttempt: withinWindow && !hasSubmittedAttempt,
    hasSubmittedAttempt,
    inProgress,
    obtainedMarks: hasSubmittedAttempt ? toNumber(latestAttempt.score, 0) : null,
    percentage: hasSubmittedAttempt ? toNumber(latestAttempt.percentage, 0) : null,
    submittedAt: hasSubmittedAttempt ? toIso(latestAttempt.submittedAt || latestAttempt.updatedAt) : null,
  };
};

const ordinal = (value = 0) => {
  const number = Number(value) || 0;
  const mod10 = number % 10;
  const mod100 = number % 100;
  if (mod10 === 1 && mod100 !== 11) return `${number}st`;
  if (mod10 === 2 && mod100 !== 12) return `${number}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${number}rd`;
  return `${number}th`;
};

const getActorDisplayName = async (uid = "", fallback = "User") => {
  const [userSnap, teacherSnap, adminSnap] = await Promise.all([
    db.collection(COLLECTIONS.USERS).doc(uid).get(),
    db.collection(COLLECTIONS.TEACHERS).doc(uid).get(),
    db.collection(COLLECTIONS.ADMINS).doc(uid).get(),
  ]);
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const teacherData = teacherSnap.exists ? teacherSnap.data() || {} : {};
  const adminData = adminSnap.exists ? adminSnap.data() || {} : {};
  return (
    trimText(userData.fullName) ||
    trimText(userData.name) ||
    trimText(userData.displayName) ||
    trimText(teacherData.fullName) ||
    trimText(teacherData.name) ||
    trimText(adminData.fullName) ||
    trimText(adminData.name) ||
    trimText(userData.email).split("@")[0] ||
    fallback
  );
};

const getTestAttemptRowsForStudent = async (studentId = "", testId = "") => {
  const snap = await db
    .collection(COLLECTIONS.TEST_ATTEMPTS)
    .where("studentId", "==", trimText(studentId))
    .get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ref: doc.ref, ...(doc.data() || {}) }))
    .filter((row) => trimText(row.testId) === trimText(testId));
};

const getCurrentQuestionForAttempt = (testData = {}, attemptData = {}) => {
  const questions = sanitizeQuestionsForStudent(testData.questions || []).sort(
    (a, b) => toNumber(a.order, 0) - toNumber(b.order, 0)
  );
  const currentIndex = Math.max(0, toNumber(attemptData.currentIndex, 0));
  return questions[currentIndex] || null;
};

const normalizeAttemptPayload = (row = {}) => ({
  id: trimText(row.id),
  testId: trimText(row.testId),
  status: lowerText(row.status) || "in_progress",
  currentIndex: Math.max(0, toNumber(row.currentIndex, 0)),
  totalQuestions: Math.max(0, toNumber(row.totalQuestions, 0)),
  answersCount: Array.isArray(row.answers) ? row.answers.length : 0,
  score: toNumber(row.score, 0),
  totalMarks: toNumber(row.totalMarks, 0),
  percentage: toNumber(row.percentage, 0),
  startedAt: toIso(row.startedAt),
  updatedAt: toIso(row.updatedAt),
  submittedAt: toIso(row.submittedAt),
  expiresAt: toIso(row.expiresAt),
});

const ensureActiveScheduleWindow = (testData = {}) => {
  const status = getTestStatus(testData, new Date());
  if (status === "scheduled") return { error: "Test has not started yet", status: 400 };
  if (status === "ended") return { error: "Test schedule has ended", status: 400 };
  return { ok: true };
};

export const createTest = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = lowerText(req.user?.role || "teacher");
    const {
      title,
      description = "",
      scope = "class",
      classId = "",
      startAt,
      endAt,
      durationMinutes = 60,
      questions = [],
      maxViolations = 3,
    } = req.body || {};

    if (!uid) return errorResponse(res, "Missing user uid", 400);

    const cleanTitle = trimText(title);
    if (cleanTitle.length < 3) {
      return errorResponse(res, "title is required (min 3 chars)", 400);
    }

    const cleanScope = lowerText(scope || "class");
    if (!["class", "center"].includes(cleanScope)) {
      return errorResponse(res, "scope must be class or center", 400);
    }

    const parsedStart = parseDate(startAt);
    const parsedEnd = parseDate(endAt);
    if (!parsedStart || !parsedEnd) {
      return errorResponse(res, "startAt and endAt are required", 400);
    }
    if (parsedEnd.getTime() <= parsedStart.getTime()) {
      return errorResponse(res, "endAt must be after startAt", 400);
    }

    const normalizedQuestions = normalizeQuestions(questions);
    const totalMarks = normalizedQuestions.reduce(
      (sum, question) => sum + Math.max(1, toNumber(question.marks, 1)),
      0
    );

    let resolvedClassId = "";
    let resolvedClassName = "Entire Center";

    if (cleanScope === "class") {
      const cleanClassId = trimText(classId);
      if (!cleanClassId) return errorResponse(res, "classId is required for class scope", 400);

      const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(cleanClassId).get();
      if (!classSnap.exists) return errorResponse(res, "Class not found", 404);
      const classData = classSnap.data() || {};

      if (role !== "admin" && !isTeacherAssignedToClass(uid, classData)) {
        return errorResponse(res, "You are not assigned to this class", 403);
      }

      resolvedClassId = cleanClassId;
      resolvedClassName = trimText(classData.name) || "Class";
    }

    const createdByName = await getActorDisplayName(uid, req.user?.name || "Teacher");
    const testRef = db.collection(COLLECTIONS.TESTS).doc();

    await testRef.set({
      title: cleanTitle,
      description: trimText(description),
      scope: cleanScope,
      classId: resolvedClassId,
      className: resolvedClassName,
      startAt: parsedStart,
      endAt: parsedEnd,
      durationMinutes: Math.max(5, toNumber(durationMinutes, 60)),
      maxViolations: Math.max(1, toNumber(maxViolations, 3)),
      questions: normalizedQuestions,
      totalMarks,
      questionsCount: normalizedQuestions.length,
      createdBy: uid,
      createdByRole: role,
      createdByName,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return successResponse(
      res,
      {
        id: testRef.id,
        title: cleanTitle,
        scope: cleanScope,
        classId: resolvedClassId,
        className: resolvedClassName,
        totalMarks,
        questionsCount: normalizedQuestions.length,
        startAt: parsedStart.toISOString(),
        endAt: parsedEnd.toISOString(),
      },
      "Test created successfully",
      201
    );
  } catch (error) {
    console.error("createTest error:", error);
    return errorResponse(res, error.message || "Failed to create test", 400);
  }
};

export const getManagedTests = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = lowerText(req.user?.role || "teacher");
    if (!uid) return errorResponse(res, "Missing user uid", 400);

    let snap = null;
    if (role === "admin") {
      snap = await db.collection(COLLECTIONS.TESTS).get();
    } else {
      snap = await db.collection(COLLECTIONS.TESTS).where("createdBy", "==", uid).get();
    }

    const rows = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .sort((a, b) => {
        const aTs = parseDate(a.createdAt)?.getTime() || 0;
        const bTs = parseDate(b.createdAt)?.getTime() || 0;
        return bTs - aTs;
      })
      .map((row) => ({
        ...serializeTestSummary(row.id, row, null),
        createdBy: trimText(row.createdBy),
        createdByName: trimText(row.createdByName) || "Teacher",
        createdByRole: lowerText(row.createdByRole || "teacher"),
        maxViolations: Math.max(1, toNumber(row.maxViolations, 3)),
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      }));

    return successResponse(res, rows, "Tests fetched");
  } catch (error) {
    console.error("getManagedTests error:", error);
    return errorResponse(res, "Failed to fetch tests", 500);
  }
};

export const getManagedTestById = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = lowerText(req.user?.role || "teacher");
    const testId = trimText(req.params?.testId);

    const access = await ensureTestManageAccess({ testId, uid, role });
    if (access.error) return errorResponse(res, access.error, access.status || 403);

    const { testData } = access;
    const ranking = await buildRankingRows(testId);

    return successResponse(
      res,
      {
        ...serializeTestSummary(testId, testData, null),
        description: trimText(testData.description),
        maxViolations: Math.max(1, toNumber(testData.maxViolations, 3)),
        questions: sanitizeQuestionsForStudent(testData.questions || []),
        ranking: ranking.slice(0, 100),
      },
      "Test details fetched"
    );
  } catch (error) {
    console.error("getManagedTestById error:", error);
    return errorResponse(res, "Failed to fetch test details", 500);
  }
};

export const getManagedTestRanking = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = lowerText(req.user?.role || "teacher");
    const testId = trimText(req.params?.testId);

    const access = await ensureTestManageAccess({ testId, uid, role });
    if (access.error) return errorResponse(res, access.error, access.status || 403);

    const ranking = await buildRankingRows(testId);
    return successResponse(
      res,
      {
        testId,
        title: trimText(access.testData.title) || "Test",
        className: trimText(access.testData.className) || "Entire Center",
        totalParticipants: ranking.length,
        ranking,
      },
      "Ranking fetched"
    );
  } catch (error) {
    console.error("getManagedTestRanking error:", error);
    return errorResponse(res, "Failed to fetch ranking", 500);
  }
};

export const getStudentTests = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    if (!uid) return errorResponse(res, "Missing student uid", 400);

    const [testsSnap, attemptsByTest] = await Promise.all([
      db.collection(COLLECTIONS.TESTS).get(),
      getStudentAttemptsByTest(uid),
    ]);

    const classIds = [
      ...new Set(
        testsSnap.docs
          .map((doc) => trimText(doc.data()?.classId))
          .filter(Boolean)
      ),
    ];

    const classDocs = await Promise.all(
      classIds.map(async (classId) => {
        const snap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
        return snap.exists ? [classId, snap.data() || {}] : [classId, null];
      })
    );
    const classMap = classDocs.reduce((acc, [classId, classData]) => {
      acc[classId] = classData;
      return acc;
    }, {});

    const rows = testsSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => {
        const scope = lowerText(row.scope || "class");
        if (scope === "center") return true;
        const classId = trimText(row.classId);
        const classData = classMap[classId];
        if (!classData) return false;
        return isStudentInClass(uid, classData);
      })
      .sort((a, b) => {
        const aTs = parseDate(a.startAt)?.getTime() || 0;
        const bTs = parseDate(b.startAt)?.getTime() || 0;
        return aTs - bTs;
      })
      .map((row) => {
        const latestAttempt = getLatestAttempt(attemptsByTest[row.id] || []);
        return {
          ...serializeTestSummary(row.id, row, latestAttempt),
          durationMinutes: Math.max(1, toNumber(row.durationMinutes, 30)),
          maxViolations: Math.max(1, toNumber(row.maxViolations, 3)),
          questionsCount: Math.max(0, toNumber(row.questionsCount, row.questions?.length || 0)),
          totalMarks: Math.max(0, toNumber(row.totalMarks, 0)),
          attempt: latestAttempt ? normalizeAttemptPayload({ id: latestAttempt.id, ...latestAttempt }) : null,
        };
      });

    return successResponse(res, rows, "Student tests fetched");
  } catch (error) {
    console.error("getStudentTests error:", error);
    return errorResponse(res, "Failed to fetch tests", 500);
  }
};

export const getStudentTestById = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const testId = trimText(req.params?.testId);
    const access = await ensureStudentCanAccessTest({ testId, uid });
    if (access.error) return errorResponse(res, access.error, access.status || 403);

    const { testData } = access;
    const attempts = await getTestAttemptRowsForStudent(uid, testId);
    const inProgress = getInProgressAttempt(attempts);
    const submitted = getSubmittedAttempt(attempts);

    const test = {
      ...serializeTestSummary(testId, testData, submitted || inProgress),
      description: trimText(testData.description),
      maxViolations: Math.max(1, toNumber(testData.maxViolations, 3)),
      questionsCount: Math.max(0, toNumber(testData.questionsCount, testData.questions?.length || 0)),
      totalMarks: Math.max(0, toNumber(testData.totalMarks, 0)),
      durationMinutes: Math.max(1, toNumber(testData.durationMinutes, 30)),
    };

    let rankingPreview = null;
    if (submitted) {
      const rows = await buildRankingRows(testId);
      const mine = rows.find((row) => trimText(row.studentId) === uid) || null;
      rankingPreview = mine
        ? {
            position: mine.position,
            ordinalPosition: ordinal(mine.position),
            totalParticipants: rows.length,
            obtainedMarks: mine.obtainedMarks,
            totalMarks: mine.totalMarks,
            percentage: mine.percentage,
          }
        : null;
    }

    return successResponse(
      res,
      {
        test,
        questions: sanitizeQuestionsForStudent(testData.questions || []),
        attempt: inProgress
          ? normalizeAttemptPayload({ id: inProgress.id, ...inProgress })
          : submitted
            ? normalizeAttemptPayload({ id: submitted.id, ...submitted })
            : null,
        currentQuestion: inProgress ? getCurrentQuestionForAttempt(testData, inProgress) : null,
        rankingPreview,
      },
      "Test fetched"
    );
  } catch (error) {
    console.error("getStudentTestById error:", error);
    return errorResponse(res, "Failed to fetch test", 500);
  }
};

export const startStudentTest = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const testId = trimText(req.params?.testId);
    const access = await ensureStudentCanAccessTest({ testId, uid });
    if (access.error) return errorResponse(res, access.error, access.status || 403);
    const { testData, classId, className } = access;

    const scheduleGate = ensureActiveScheduleWindow(testData);
    if (scheduleGate.error) return errorResponse(res, scheduleGate.error, scheduleGate.status || 400);

    const attempts = await getTestAttemptRowsForStudent(uid, testId);
    const submitted = getSubmittedAttempt(attempts);
    if (submitted) {
      return errorResponse(res, "Test already submitted", 409, { code: "ALREADY_SUBMITTED" });
    }

    const inProgress = getInProgressAttempt(attempts);
    if (inProgress) {
      return successResponse(
        res,
        {
          testId,
          attempt: normalizeAttemptPayload({ id: inProgress.id, ...inProgress }),
          currentQuestion: getCurrentQuestionForAttempt(testData, inProgress),
        },
        "Resuming your test attempt"
      );
    }

    const studentProfile = await ensureStudentProfile(uid);
    const testQuestions = sanitizeQuestionsForStudent(testData.questions || []).sort(
      (a, b) => toNumber(a.order, 0) - toNumber(b.order, 0)
    );
    const attemptRef = db.collection(COLLECTIONS.TEST_ATTEMPTS).doc();
    const now = new Date();
    await attemptRef.set({
      testId,
      studentId: uid,
      studentName: studentProfile.fullName,
      studentEmail: studentProfile.email,
      classId: classId || "",
      className: className || trimText(testData.className) || "Entire Center",
      status: "in_progress",
      currentIndex: 0,
      totalQuestions: testQuestions.length,
      totalMarks: Math.max(0, toNumber(testData.totalMarks, 0)),
      score: 0,
      percentage: 0,
      answers: [],
      violations: 0,
      maxViolations: Math.max(1, toNumber(testData.maxViolations, 3)),
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiresAt: parseDate(testData.endAt) || now,
    });

    return successResponse(
      res,
      {
        testId,
        attempt: {
          id: attemptRef.id,
          status: "in_progress",
          currentIndex: 0,
          totalQuestions: testQuestions.length,
          answersCount: 0,
          startedAt: now.toISOString(),
          expiresAt: toIso(testData.endAt),
        },
        currentQuestion: testQuestions[0] || null,
      },
      "Test started successfully"
    );
  } catch (error) {
    console.error("startStudentTest error:", error);
    return errorResponse(res, "Failed to start test", 500);
  }
};

export const submitStudentTestAnswer = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const testId = trimText(req.params?.testId);
    const { questionId = "", selectedAnswer = "" } = req.body || {};

    const access = await ensureStudentCanAccessTest({ testId, uid });
    if (access.error) return errorResponse(res, access.error, access.status || 403);
    const { testData } = access;

    const scheduleGate = ensureActiveScheduleWindow(testData);
    if (scheduleGate.error) return errorResponse(res, scheduleGate.error, scheduleGate.status || 400);

    const attempts = await getTestAttemptRowsForStudent(uid, testId);
    const inProgress = getInProgressAttempt(attempts);
    if (!inProgress) {
      return errorResponse(res, "No active test attempt found", 404, { code: "ATTEMPT_NOT_FOUND" });
    }

    const questions = (Array.isArray(testData.questions) ? testData.questions : [])
      .slice()
      .sort((a, b) => toNumber(a.order, 0) - toNumber(b.order, 0));
    const currentIndex = Math.max(0, toNumber(inProgress.currentIndex, 0));
    const expected = questions[currentIndex];
    if (!expected) {
      return errorResponse(res, "Test already completed. Submit finalization instead.", 409);
    }

    const expectedQuestionId = trimText(expected.questionId);
    const cleanQuestionId = trimText(questionId);
    if (!cleanQuestionId || cleanQuestionId !== expectedQuestionId) {
      return errorResponse(
        res,
        "Invalid question order. You can only answer the current question.",
        409,
        { code: "STRICT_PROGRESS_ENFORCED", expectedQuestionId }
      );
    }

    const cleanSelected = trimText(selectedAnswer);
    if (!cleanSelected) return errorResponse(res, "selectedAnswer is required", 400);

    const existingAnswers = Array.isArray(inProgress.answers) ? inProgress.answers : [];
    if (existingAnswers.some((row) => trimText(row.questionId) === expectedQuestionId)) {
      return errorResponse(res, "Question already answered", 409);
    }

    const newAnswer = {
      questionId: expectedQuestionId,
      selectedAnswer: cleanSelected,
      answeredAt: new Date().toISOString(),
      questionOrder: currentIndex + 1,
    };
    const updatedAnswers = [...existingAnswers, newAnswer];
    const nextIndex = currentIndex + 1;
    const nowIso = new Date().toISOString();

    if (nextIndex >= questions.length) {
      const evaluated = computeScore(questions, updatedAnswers);
      await inProgress.ref.update({
        answers: updatedAnswers,
        currentIndex: nextIndex,
        status: "submitted",
        score: evaluated.score,
        totalMarks: evaluated.totalMarks,
        percentage: evaluated.percentage,
        evaluatedAnswers: evaluated.answers,
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const ranking = await buildRankingRows(testId);
      const myRow = ranking.find((row) => trimText(row.studentId) === uid) || null;
      return successResponse(
        res,
        {
          completed: true,
          attempt: {
            id: inProgress.id,
            status: "submitted",
            currentIndex: nextIndex,
            totalQuestions: questions.length,
            answersCount: updatedAnswers.length,
            score: evaluated.score,
            totalMarks: evaluated.totalMarks,
            percentage: evaluated.percentage,
            submittedAt: nowIso,
          },
          result: {
            obtainedMarks: evaluated.score,
            totalMarks: evaluated.totalMarks,
            percentage: evaluated.percentage,
          },
          ranking: myRow
            ? {
                position: myRow.position,
                ordinalPosition: ordinal(myRow.position),
                totalParticipants: ranking.length,
              }
            : {
                position: null,
                ordinalPosition: null,
                totalParticipants: ranking.length,
              },
        },
        "Test submitted successfully"
      );
    }

    await inProgress.ref.update({
      answers: updatedAnswers,
      currentIndex: nextIndex,
      updatedAt: serverTimestamp(),
    });

    return successResponse(
      res,
      {
        completed: false,
        attempt: {
          id: inProgress.id,
          status: "in_progress",
          currentIndex: nextIndex,
          totalQuestions: questions.length,
          answersCount: updatedAnswers.length,
          updatedAt: nowIso,
        },
        currentQuestion: sanitizeQuestionsForStudent([questions[nextIndex]])[0] || null,
      },
      "Answer saved"
    );
  } catch (error) {
    console.error("submitStudentTestAnswer error:", error);
    return errorResponse(res, "Failed to submit answer", 500);
  }
};

export const finishStudentTest = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const testId = trimText(req.params?.testId);
    const reason = lowerText(req.body?.reason || "manual");

    const access = await ensureStudentCanAccessTest({ testId, uid });
    if (access.error) return errorResponse(res, access.error, access.status || 403);
    const { testData } = access;

    const attempts = await getTestAttemptRowsForStudent(uid, testId);
    const inProgress = getInProgressAttempt(attempts);
    if (!inProgress) {
      const submitted = getSubmittedAttempt(attempts);
      if (submitted) {
        return successResponse(
          res,
          { attempt: normalizeAttemptPayload({ id: submitted.id, ...submitted }) },
          "Test already submitted"
        );
      }
      return errorResponse(res, "No active attempt found", 404);
    }

    const questions = (Array.isArray(testData.questions) ? testData.questions : [])
      .slice()
      .sort((a, b) => toNumber(a.order, 0) - toNumber(b.order, 0));
    const existingAnswers = Array.isArray(inProgress.answers) ? inProgress.answers : [];
    const evaluated = computeScore(questions, existingAnswers);
    const finalStatus = ["timeout", "violation", "auto"].includes(reason)
      ? "auto_submitted"
      : "submitted";

    await inProgress.ref.update({
      status: finalStatus,
      currentIndex: existingAnswers.length,
      score: evaluated.score,
      totalMarks: evaluated.totalMarks,
      percentage: evaluated.percentage,
      evaluatedAnswers: evaluated.answers,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const ranking = await buildRankingRows(testId);
    const myRow = ranking.find((row) => trimText(row.studentId) === uid) || null;

    return successResponse(
      res,
      {
        completed: true,
        attempt: {
          id: inProgress.id,
          status: finalStatus,
          currentIndex: existingAnswers.length,
          totalQuestions: questions.length,
          answersCount: existingAnswers.length,
          score: evaluated.score,
          totalMarks: evaluated.totalMarks,
          percentage: evaluated.percentage,
        },
        result: {
          obtainedMarks: evaluated.score,
          totalMarks: evaluated.totalMarks,
          percentage: evaluated.percentage,
        },
        ranking: myRow
          ? {
              position: myRow.position,
              ordinalPosition: ordinal(myRow.position),
              totalParticipants: ranking.length,
            }
          : {
              position: null,
              ordinalPosition: null,
              totalParticipants: ranking.length,
            },
      },
      "Test submitted"
    );
  } catch (error) {
    console.error("finishStudentTest error:", error);
    return errorResponse(res, "Failed to submit test", 500);
  }
};

export const getStudentTestRanking = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const testId = trimText(req.params?.testId);

    const access = await ensureStudentCanAccessTest({ testId, uid });
    if (access.error) return errorResponse(res, access.error, access.status || 403);

    const attempts = await getTestAttemptRowsForStudent(uid, testId);
    const submitted = getSubmittedAttempt(attempts);
    if (!submitted) {
      return errorResponse(res, "Submit the test first to view ranking", 403, {
        code: "RANKING_LOCKED",
      });
    }

    const ranking = await buildRankingRows(testId);
    const mine = ranking.find((row) => trimText(row.studentId) === uid) || null;

    return successResponse(
      res,
      {
        testId,
        title: trimText(access.testData.title) || "Test",
        className: trimText(access.testData.className) || "Entire Center",
        totalParticipants: ranking.length,
        myResult: mine
          ? {
              position: mine.position,
              ordinalPosition: ordinal(mine.position),
              obtainedMarks: mine.obtainedMarks,
              totalMarks: mine.totalMarks,
              percentage: mine.percentage,
            }
          : null,
        ranking,
      },
      "Ranking fetched"
    );
  } catch (error) {
    console.error("getStudentTestRanking error:", error);
    return errorResponse(res, "Failed to fetch ranking", 500);
  }
};

export const downloadStudentTestRankingPdf = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const testId = trimText(req.params?.testId);
    const access = await ensureStudentCanAccessTest({ testId, uid });
    if (access.error) return errorResponse(res, access.error, access.status || 403);

    const attempts = await getTestAttemptRowsForStudent(uid, testId);
    const submitted = getSubmittedAttempt(attempts);
    if (!submitted) {
      return errorResponse(res, "Submit the test first to download ranking", 403, {
        code: "RANKING_LOCKED",
      });
    }

    const ranking = await buildRankingRows(testId);
    const title = trimText(access.testData.title) || "Test";
    const className = trimText(access.testData.className) || "Entire Center";
    const filename = `SUM_Test_Ranking_${trimText(title).replace(/[^\w-]+/g, "_") || "test"}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(res);

    doc.fontSize(18).text("SUM Academy - Test Ranking", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Test: ${title}`);
    doc.fontSize(11).fillColor("#475569").text(`Class: ${className}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown(0.8);

    let y = doc.y;
    doc.fontSize(10).fillColor("#0f172a");
    doc.text("Pos", 40, y);
    doc.text("Student", 80, y);
    doc.text("Marks", 290, y);
    doc.text("Percentage", 360, y);
    doc.moveTo(40, y + 14).lineTo(555, y + 14).stroke("#cbd5e1");
    y += 20;

    ranking.slice(0, 100).forEach((row) => {
      if (y > 760) {
        doc.addPage();
        y = 50;
      }
      doc.fillColor("#0f172a").fontSize(10).text(ordinal(row.position), 40, y);
      doc.text(row.studentName || "Student", 80, y, { width: 190 });
      doc.text(`${row.obtainedMarks}/${row.totalMarks}`, 290, y);
      doc.text(`${row.percentage}%`, 360, y);
      y += 18;
    });

    doc.end();
  } catch (error) {
    console.error("downloadStudentTestRankingPdf error:", error);
    return errorResponse(res, "Failed to download ranking PDF", 500);
  }
};
