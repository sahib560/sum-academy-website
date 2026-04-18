import crypto from "crypto";
import { admin, db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const trimText = (value = "") => String(value ?? "").trim();
const lowerText = (value = "") => trimText(value).toLowerCase();
const toPositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const getActorRole = (req) => lowerText(req.user?.role || "");
const isAdminActor = (req) => getActorRole(req) === "admin";

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

const normalizeIdList = (value) => {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((entry) => (typeof entry === "string" ? trimText(entry) : trimText(entry?.id)))
        .filter(Boolean)
    ),
  ];
};

const normalizeAssignedIdList = (value) => {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((entry) =>
          typeof entry === "string"
            ? trimText(entry)
            : trimText(entry?.id || entry?.classId || entry?.subjectId || entry?.courseId)
        )
        .filter(Boolean)
    ),
  ];
};

const getTeacherAssignmentSets = async (uid) => {
  const teacherSnap = await db.collection(COLLECTIONS.TEACHERS).doc(uid).get();
  const teacherData = teacherSnap.exists ? teacherSnap.data() || {} : {};
  return {
    classIdSet: new Set(normalizeAssignedIdList(teacherData.assignedClasses)),
    subjectIdSet: new Set(normalizeAssignedIdList(teacherData.assignedSubjects)),
  };
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

const makeAttemptDocId = (quizId, studentId) => `${trimText(quizId)}__${trimText(studentId)}`;

const sanitizeAttemptQuestions = (questions = []) =>
  questions.map((question) => ({
    questionId: trimText(question.questionId || question.id),
    subjectId: trimText(question.subjectId),
    questionText: trimText(question.questionText || question.text),
    options: Array.isArray(question.options) ? question.options : [],
    marks: Math.max(1, toPositiveNumber(question.marks, 1)),
    type: "mcq",
    questionType: "mcq",
  }));

const shuffleInPlace = (items) => {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(0, index + 1);
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
};

const normalizeSubmittedAnswers = (answers) => {
  if (Array.isArray(answers)) {
    return answers.reduce((acc, row) => {
      const key = trimText(row?.questionId);
      if (!key) return acc;
      acc[key] = row?.answer;
      return acc;
    }, {});
  }

  if (answers && typeof answers === "object") {
    return { ...answers };
  }

  return {};
};

const normalizeMcqCorrectAnswer = (rawAnswer, options = []) => {
  const answer = trimText(rawAnswer);
  if (!answer) return "";
  const upper = answer.toUpperCase();
  const letterMap = { A: 0, B: 1, C: 2, D: 3 };
  if (letterMap[upper] !== undefined && options[letterMap[upper]]) {
    return upper;
  }
  const exactIndex = options.findIndex((option) => lowerText(option) === lowerText(answer));
  if (exactIndex >= 0 && exactIndex <= 3) {
    return ["A", "B", "C", "D"][exactIndex];
  }
  return "";
};

const fetchQuestionBankPool = async ({ subjectIds = [], classId = "all" }) => {
  const cleanSubjectIds = normalizeIdList(subjectIds);
  if (cleanSubjectIds.length < 1) return [];
  if (cleanSubjectIds.length > 10) {
    throw new Error("subjectIds cannot exceed 10 (Firestore in-query limit)");
  }

  // Avoid composite-index requirements by only querying on a single field,
  // then filtering in-memory for classId/status.
  const snap = await db
    .collection(COLLECTIONS.QUESTION_BANK)
    .where("subjectId", "in", cleanSubjectIds)
    .get();

  const byId = new Map();
  snap.docs.forEach((doc) => {
    const data = doc.data() || {};
    if (lowerText(data.status || "active") !== "active") return;
    const rowClassId = trimText(data.classId || "all") || "all";
    if (rowClassId !== "all" && classId && classId !== "all" && rowClassId !== classId) return;
    if (rowClassId !== "all" && (!classId || classId === "all")) return;
    byId.set(doc.id, { id: doc.id, ...(data || {}) });
  });

  return [...byId.values()];
};

const buildRandomAttemptQuestions = async ({ subjectIds, classId, questionCount }) => {
  const pool = await fetchQuestionBankPool({ subjectIds, classId });
  const normalizedPool = pool
    .map((row) => {
      const options = Array.isArray(row.options) ? row.options.map((opt) => trimText(opt)).filter(Boolean) : [];
      const correctAnswer = normalizeMcqCorrectAnswer(row.correctAnswer, options);
      return {
        questionId: trimText(row.id),
        id: trimText(row.id),
        type: "mcq",
        questionType: "mcq",
        subjectId: trimText(row.subjectId),
        questionText: trimText(row.questionText),
        options,
        correctAnswer,
        marks: Math.max(1, toPositiveNumber(row.marks, 1)),
      };
    })
    .filter((row) => row.questionId && row.questionText && row.options.length === 4 && row.correctAnswer);

  if (normalizedPool.length < questionCount) {
    throw new Error(
      `Not enough questions in question bank (needed ${questionCount}, found ${normalizedPool.length})`
    );
  }

  const shuffled = shuffleInPlace([...normalizedPool]);
  return shuffled.slice(0, questionCount);
};

const resolveQuizWindowStatus = ({ now, startAt, endAt, attempt }) => {
  if (attempt?.submittedAt) return "completed";
  const start = parseDate(startAt);
  const end = parseDate(endAt);
  const nowTime = now.getTime();
  if (start && nowTime < start.getTime()) return "upcoming";
  if (end && nowTime > end.getTime()) return "missed";
  return "active";
};

export const createScheduledQuiz = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    if (!uid) return errorResponse(res, "Missing user uid", 400);
    if (!(role === "admin" || role === "teacher")) {
      return errorResponse(res, "Access denied", 403);
    }

    const title = trimText(req.body?.title) || "Quiz";
    const description = trimText(req.body?.description);
    const subjectIds = normalizeIdList(req.body?.subjectIds);
    const classIds = normalizeIdList(req.body?.classIds);
    const questionCount = Math.max(1, Math.min(200, toPositiveNumber(req.body?.questionCount, 20)));
    const passScore = Math.max(1, Math.min(100, toPositiveNumber(req.body?.passScore, 50)));

    const startAtDate = parseDate(req.body?.startAt);
    const endAtDate = parseDate(req.body?.endAt);
    if (!startAtDate) return errorResponse(res, "startAt is required", 400);
    if (!endAtDate) return errorResponse(res, "endAt is required", 400);
    if (endAtDate.getTime() <= startAtDate.getTime()) {
      return errorResponse(res, "endAt must be after startAt", 400);
    }
    if (!subjectIds.length) return errorResponse(res, "subjectIds is required", 400);
    if (!classIds.length) return errorResponse(res, "classIds is required", 400);
    if (subjectIds.length > 10) {
      return errorResponse(res, "subjectIds cannot exceed 10", 400);
    }

    if (!isAdminActor(req)) {
      const assignment = await getTeacherAssignmentSets(uid);
      if (assignment.classIdSet.size < 1) {
        return errorResponse(
          res,
          "No assigned classes found for your teacher account. Contact admin to assign classes.",
          403
        );
      }
      if (assignment.subjectIdSet.size < 1) {
        return errorResponse(
          res,
          "No assigned subjects found for your teacher account. Contact admin to assign subjects.",
          403
        );
      }

      const disallowedClassIds = classIds.filter((id) => !assignment.classIdSet.has(id));
      if (disallowedClassIds.length) {
        return errorResponse(res, "You can only create quizzes for your assigned classes", 403, {
          disallowedClassIds,
        });
      }
      const disallowedSubjectIds = subjectIds.filter((id) => !assignment.subjectIdSet.has(id));
      if (disallowedSubjectIds.length) {
        return errorResponse(res, "You can only create quizzes for your assigned subjects", 403, {
          disallowedSubjectIds,
        });
      }
    }

    const [userSnap, subjectSnaps, classSnaps] = await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(uid).get(),
      Promise.all(subjectIds.map((id) => db.collection(COLLECTIONS.SUBJECTS).doc(id).get())),
      Promise.all(classIds.map((id) => db.collection(COLLECTIONS.CLASSES).doc(id).get())),
    ]);
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const subjectNames = subjectSnaps.map((snap, index) => {
      if (!snap.exists) return trimText(req.body?.subjectNames?.[index]) || "";
      const data = snap.data() || {};
      return trimText(data.title || data.name || data.subjectName);
    });
    const classNames = classSnaps.map((snap, index) => {
      if (!snap.exists) return trimText(req.body?.classNames?.[index]) || "";
      const data = snap.data() || {};
      return trimText(data.name);
    });

    // Guardrail: ensure each selected class can build a question set.
    // (Students in different classes pull questions filtered by their classId.)
    await Promise.all(
      classIds.map(async (classId) => {
        await buildRandomAttemptQuestions({ subjectIds, classId, questionCount });
      })
    );

    const payload = {
      kind: "scheduled_subject_random",
      title,
      description,
      subjectIds,
      subjectNames,
      classIds,
      classNames,
      questionCount,
      passScore,
      startAt: startAtDate.toISOString(),
      endAt: endAtDate.toISOString(),
      status: "active",
      createdBy: uid,
      createdByRole: role,
      createdByName: trimText(userData.fullName || userData.name || userData.displayName),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const ref = await db.collection(COLLECTIONS.SCHEDULED_QUIZZES).add(payload);
    return successResponse(res, { id: ref.id }, "Scheduled quiz created", 201);
  } catch (error) {
    console.error("createScheduledQuiz error:", error);
    return errorResponse(res, error?.message || "Failed to create scheduled quiz", 500);
  }
};

export const getTeacherScheduledQuizzes = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    if (!uid) return errorResponse(res, "Missing user uid", 400);
    if (!(role === "admin" || role === "teacher")) {
      return errorResponse(res, "Access denied", 403);
    }

    let query = db.collection(COLLECTIONS.SCHEDULED_QUIZZES).where("status", "==", "active");
    if (!isAdminActor(req)) query = query.where("createdBy", "==", uid);

    const snap = await query.get();
    const rows = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .sort((a, b) => (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0))
      .map((row) => ({
        id: row.id,
        kind: trimText(row.kind) || "scheduled_subject_random",
        title: trimText(row.title) || "Quiz",
        description: trimText(row.description),
        subjectIds: Array.isArray(row.subjectIds) ? row.subjectIds : [],
        subjectNames: Array.isArray(row.subjectNames) ? row.subjectNames : [],
        classIds: Array.isArray(row.classIds) ? row.classIds : [],
        classNames: Array.isArray(row.classNames) ? row.classNames : [],
        questionCount: Math.max(0, toPositiveNumber(row.questionCount, 0)),
        passScore: Math.max(0, toPositiveNumber(row.passScore, 0)),
        startAt: toIso(row.startAt),
        endAt: toIso(row.endAt),
        createdBy: trimText(row.createdBy),
        createdByRole: trimText(row.createdByRole),
        createdByName: trimText(row.createdByName),
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      }));

    return successResponse(res, rows, "Scheduled quizzes fetched");
  } catch (error) {
    console.error("getTeacherScheduledQuizzes error:", error);
    return errorResponse(res, "Failed to fetch scheduled quizzes", 500);
  }
};

export const getTeacherScheduledQuizById = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    const quizId = trimText(req.params?.quizId);
    if (!uid) return errorResponse(res, "Missing user uid", 400);
    if (!quizId) return errorResponse(res, "quizId is required", 400);
    if (!(role === "admin" || role === "teacher")) {
      return errorResponse(res, "Access denied", 403);
    }

    const snap = await db.collection(COLLECTIONS.SCHEDULED_QUIZZES).doc(quizId).get();
    if (!snap.exists) return errorResponse(res, "Scheduled quiz not found", 404);
    const data = snap.data() || {};
    if (!isAdminActor(req) && trimText(data.createdBy) !== uid) {
      return errorResponse(res, "Access denied", 403);
    }

    return successResponse(
      res,
      {
        id: snap.id,
        kind: trimText(data.kind) || "scheduled_subject_random",
        title: trimText(data.title) || "Quiz",
        description: trimText(data.description),
        subjectIds: Array.isArray(data.subjectIds) ? data.subjectIds : [],
        subjectNames: Array.isArray(data.subjectNames) ? data.subjectNames : [],
        classIds: Array.isArray(data.classIds) ? data.classIds : [],
        classNames: Array.isArray(data.classNames) ? data.classNames : [],
        questionCount: Math.max(0, toPositiveNumber(data.questionCount, 0)),
        passScore: Math.max(0, toPositiveNumber(data.passScore, 0)),
        startAt: toIso(data.startAt),
        endAt: toIso(data.endAt),
        createdBy: trimText(data.createdBy),
        createdByRole: trimText(data.createdByRole),
        createdByName: trimText(data.createdByName),
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
      },
      "Scheduled quiz fetched"
    );
  } catch (error) {
    console.error("getTeacherScheduledQuizById error:", error);
    return errorResponse(res, "Failed to fetch scheduled quiz", 500);
  }
};

export const getStudentScheduledQuizzes = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (role !== "student") return errorResponse(res, "Access denied", 403);

    const classRows = await getStudentClassMembershipRows(uid);
    const studentClassIds = classRows.map((row) => trimText(row.id)).filter(Boolean);
    if (!studentClassIds.length) {
      return successResponse(res, [], "Scheduled quizzes fetched");
    }

    const limitedClassIds = studentClassIds.slice(0, 10);
    const quizSnap = await db
      .collection(COLLECTIONS.SCHEDULED_QUIZZES)
      .where("status", "==", "active")
      .where("classIds", "array-contains-any", limitedClassIds)
      .get();

    const quizzes = quizSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    const quizIds = quizzes.map((row) => trimText(row.id)).filter(Boolean);

    const attemptRefs = quizIds.map((quizId) =>
      db.collection(COLLECTIONS.SCHEDULED_QUIZ_ATTEMPTS).doc(makeAttemptDocId(quizId, uid)).get()
    );
    const attemptSnaps = await Promise.all(attemptRefs);
    const attemptMap = {};
    attemptSnaps.forEach((snap, index) => {
      if (!snap.exists) return;
      attemptMap[quizIds[index]] = snap.data() || {};
    });

    const resultRefs = quizIds
      .map((id) => ({ quizId: id, resultId: trimText(attemptMap[id]?.resultId) }))
      .filter((row) => row.resultId)
      .map((row) => ({ quizId: row.quizId, ref: db.collection(COLLECTIONS.QUIZ_RESULTS).doc(row.resultId) }));
    const resultSnaps = await Promise.all(resultRefs.map((row) => row.ref.get()));
    const resultByQuizId = {};
    resultSnaps.forEach((snap, index) => {
      const quizId = resultRefs[index]?.quizId;
      if (!quizId || !snap.exists) return;
      resultByQuizId[quizId] = { id: snap.id, ...(snap.data() || {}) };
    });

    const now = new Date();
    const payload = quizzes
      .map((quiz) => {
        const attempt = attemptMap[quiz.id] || null;
        const result = resultByQuizId[quiz.id] || null;
        const status = resolveQuizWindowStatus({
          now,
          startAt: quiz.startAt,
          endAt: quiz.endAt,
          attempt,
        });
        return {
          id: quiz.id,
          kind: trimText(quiz.kind) || "scheduled_subject_random",
          title: trimText(quiz.title) || "Quiz",
          description: trimText(quiz.description),
          subjectIds: Array.isArray(quiz.subjectIds) ? quiz.subjectIds : [],
          subjectNames: Array.isArray(quiz.subjectNames) ? quiz.subjectNames : [],
          classIds: Array.isArray(quiz.classIds) ? quiz.classIds : [],
          classNames: Array.isArray(quiz.classNames) ? quiz.classNames : [],
          questionCount: Math.max(0, toPositiveNumber(quiz.questionCount, 0)),
          passScore: Math.max(0, toPositiveNumber(quiz.passScore, 0)),
          startAt: toIso(quiz.startAt),
          endAt: toIso(quiz.endAt),
          status,
          canAttempt: status === "active",
          attempted: Boolean(attempt),
          submitted: Boolean(attempt?.submittedAt),
          lastAttempt: result
            ? {
                id: trimText(result.id),
                status: trimText(result.status) || "completed",
                percentage: toPositiveNumber(result.percentage ?? result.scorePercent, 0),
                isPassed: result.isPassed === true,
                autoScore: toPositiveNumber(result.autoScore ?? result.totalScore ?? 0, 0),
                totalMarks: toPositiveNumber(result.totalMarks, 0),
                rank: result.rank ?? null,
                totalAttempts: result.totalStudents ?? result.totalAttempts ?? null,
                submittedAt: toIso(result.submittedAt || result.createdAt),
              }
            : null,
        };
      })
      .sort((a, b) => (parseDate(a.startAt)?.getTime() || 0) - (parseDate(b.startAt)?.getTime() || 0));

    return successResponse(res, payload, "Scheduled quizzes fetched");
  } catch (error) {
    console.error("getStudentScheduledQuizzes error:", error);
    return errorResponse(res, "Failed to fetch scheduled quizzes", 500);
  }
};

export const getStudentScheduledQuizById = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    const quizId = trimText(req.params?.quizId);
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (role !== "student") return errorResponse(res, "Access denied", 403);
    if (!quizId) return errorResponse(res, "quizId is required", 400);

    const quizSnap = await db.collection(COLLECTIONS.SCHEDULED_QUIZZES).doc(quizId).get();
    if (!quizSnap.exists) return errorResponse(res, "Scheduled quiz not found", 404);
    const quiz = quizSnap.data() || {};

    const classRows = await getStudentClassMembershipRows(uid);
    const studentClassIds = classRows.map((row) => trimText(row.id)).filter(Boolean);
    const quizClassIds = Array.isArray(quiz.classIds) ? quiz.classIds.map((id) => trimText(id)).filter(Boolean) : [];
    const matchedClassId = studentClassIds.find((classId) => quizClassIds.includes(classId)) || "";
    if (!matchedClassId) {
      return errorResponse(res, "This quiz is not assigned to your class", 403);
    }

    const attemptId = makeAttemptDocId(quizId, uid);
    const attemptRef = db.collection(COLLECTIONS.SCHEDULED_QUIZ_ATTEMPTS).doc(attemptId);
    const attemptSnap = await attemptRef.get();
    const attempt = attemptSnap.exists ? attemptSnap.data() || {} : null;

    const now = new Date();
    const status = resolveQuizWindowStatus({
      now,
      startAt: quiz.startAt,
      endAt: quiz.endAt,
      attempt,
    });

    const basePayload = {
      id: quizId,
      kind: trimText(quiz.kind) || "scheduled_subject_random",
      title: trimText(quiz.title) || "Quiz",
      description: trimText(quiz.description),
      subjectIds: Array.isArray(quiz.subjectIds) ? quiz.subjectIds : [],
      subjectNames: Array.isArray(quiz.subjectNames) ? quiz.subjectNames : [],
      classIds: Array.isArray(quiz.classIds) ? quiz.classIds : [],
      classNames: Array.isArray(quiz.classNames) ? quiz.classNames : [],
      questionCount: Math.max(0, toPositiveNumber(quiz.questionCount, 0)),
      passScore: Math.max(0, toPositiveNumber(quiz.passScore, 0)),
      startAt: toIso(quiz.startAt),
      endAt: toIso(quiz.endAt),
      status,
      canAttempt: status === "active" && !attempt?.submittedAt,
      matchedClassId,
      attemptId: attemptId,
    };

    if (status !== "active") {
      return successResponse(res, basePayload, "Scheduled quiz fetched");
    }

    if (attempt?.submittedAt) {
      let lastAttempt = null;
      try {
        const resultId = trimText(attempt?.resultId);
        if (resultId) {
          const resultSnap = await db.collection(COLLECTIONS.QUIZ_RESULTS).doc(resultId).get();
          if (resultSnap.exists) {
            const result = resultSnap.data() || {};
            lastAttempt = {
              id: resultSnap.id,
              status: trimText(result.status) || "completed",
              percentage: toPositiveNumber(result.percentage ?? result.scorePercent, 0),
              isPassed: result.isPassed === true,
              autoScore: toPositiveNumber(result.autoScore ?? result.totalScore ?? 0, 0),
              totalMarks: toPositiveNumber(result.totalMarks, 0),
              rank: result.rank ?? null,
              totalAttempts: result.totalStudents ?? result.totalAttempts ?? null,
              submittedAt: toIso(result.submittedAt || result.createdAt),
            };
          }
        }
      } catch (resultError) {
        console.error("getStudentScheduledQuizById result fetch error:", resultError);
      }

      return successResponse(res, { ...basePayload, lastAttempt }, "Scheduled quiz fetched");
    }

    if (attemptSnap.exists && Array.isArray(attempt.questions) && attempt.questions.length) {
      return successResponse(
        res,
        {
          ...basePayload,
          questions: sanitizeAttemptQuestions(attempt.questions),
        },
        "Scheduled quiz fetched"
      );
    }

    const subjectIds = Array.isArray(quiz.subjectIds) ? quiz.subjectIds : [];
    const questionCount = Math.max(1, toPositiveNumber(quiz.questionCount, 20));
    const attemptQuestions = await buildRandomAttemptQuestions({
      subjectIds,
      classId: matchedClassId,
      questionCount,
    });

    await attemptRef.set(
      {
        quizId,
        studentId: uid,
        classId: matchedClassId,
        subjectIds: subjectIds.map((id) => trimText(id)).filter(Boolean),
        questionCount,
        questions: attemptQuestions,
        startedAt: serverTimestamp(),
        submittedAt: null,
        status: "in_progress",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return successResponse(
      res,
      {
        ...basePayload,
        questions: sanitizeAttemptQuestions(attemptQuestions),
      },
      "Scheduled quiz fetched"
    );
  } catch (error) {
    console.error("getStudentScheduledQuizById error:", error);
    return errorResponse(res, error?.message || "Failed to fetch scheduled quiz", 500);
  }
};

export const submitStudentScheduledQuizAttempt = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    const quizId = trimText(req.params?.quizId);
    const answersRaw = req.body?.answers;
    if (!uid) return errorResponse(res, "Missing student uid", 400);
    if (role !== "student") return errorResponse(res, "Access denied", 403);
    if (!quizId) return errorResponse(res, "quizId is required", 400);

    const answers = normalizeSubmittedAnswers(answersRaw);
    if (!answers || Object.keys(answers).length < 1) {
      return errorResponse(res, "answers are required", 400);
    }

    const quizSnap = await db.collection(COLLECTIONS.SCHEDULED_QUIZZES).doc(quizId).get();
    if (!quizSnap.exists) return errorResponse(res, "Scheduled quiz not found", 404);
    const quiz = quizSnap.data() || {};

    const now = new Date();
    const startAt = parseDate(quiz.startAt);
    const endAt = parseDate(quiz.endAt);
    if (startAt && now.getTime() < startAt.getTime()) {
      return errorResponse(res, "Quiz has not started yet", 403, { code: "QUIZ_NOT_STARTED" });
    }
    if (endAt && now.getTime() > endAt.getTime()) {
      return errorResponse(res, "Quiz has ended", 403, { code: "QUIZ_ENDED" });
    }

    const attemptId = makeAttemptDocId(quizId, uid);
    const attemptRef = db.collection(COLLECTIONS.SCHEDULED_QUIZ_ATTEMPTS).doc(attemptId);
    const attemptSnap = await attemptRef.get();
    if (!attemptSnap.exists) {
      return errorResponse(res, "Start the quiz first to get your questions", 400, {
        code: "QUIZ_NOT_STARTED_BY_STUDENT",
      });
    }

    const attempt = attemptSnap.data() || {};
    if (attempt.submittedAt) {
      return errorResponse(res, "Quiz already submitted", 409, { code: "QUIZ_ALREADY_SUBMITTED" });
    }

    const questions = Array.isArray(attempt.questions) ? attempt.questions : [];
    if (!questions.length) return errorResponse(res, "Quiz attempt has no questions", 400);

    const letterMap = { A: 0, B: 1, C: 2, D: 3 };
    const normalizeOptionText = (value = "") => lowerText(trimText(value));

    let totalMarks = 0;
    let score = 0;
    const gradedAnswers = questions.map((question) => {
      const questionId = trimText(question.questionId || question.id);
      const maxMarks = Math.max(1, toPositiveNumber(question.marks, 1));
      totalMarks += maxMarks;

      const options = Array.isArray(question.options) ? question.options.map((opt) => trimText(opt)) : [];
      const expectedLetter = trimText(question.correctAnswer).toUpperCase();
      const expectedIndex = letterMap[expectedLetter];
      const expectedText = expectedIndex !== undefined ? trimText(options[expectedIndex]) : "";

      const submittedRaw = answers[questionId];
      const submittedText = trimText(submittedRaw);
      const submittedUpper = submittedText.toUpperCase();
      const submittedIndex = letterMap[submittedUpper];
      const submittedByLetter =
        submittedIndex !== undefined ? trimText(options[submittedIndex]) : "";

      const isCorrect =
        (submittedIndex !== undefined &&
          expectedIndex !== undefined &&
          submittedUpper === expectedLetter) ||
        (normalizeOptionText(submittedByLetter || submittedText) &&
          normalizeOptionText(submittedByLetter || submittedText) ===
            normalizeOptionText(expectedText || expectedLetter));

      const marksAwarded = isCorrect ? maxMarks : 0;
      score += marksAwarded;

      return {
        questionId,
        subjectId: trimText(question.subjectId),
        questionText: trimText(question.questionText),
        submittedAnswer: submittedText,
        correctAnswer: expectedLetter,
        correctAnswerText: expectedText,
        isCorrect,
        marksAwarded,
        maxMarks,
        type: "mcq",
        questionType: "mcq",
        status: "completed",
      };
    });

    const percentage = totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(2)) : 0;
    const passScore = Math.max(1, Math.min(100, toPositiveNumber(quiz.passScore, 50)));
    const isPassed = percentage >= passScore;

    const resultRef = await db.collection(COLLECTIONS.QUIZ_RESULTS).add({
      kind: "scheduled_subject_random",
      quizKind: "scheduled_subject_random",
      quizId,
      studentId: uid,
      classId: trimText(attempt.classId),
      subjectIds: Array.isArray(quiz.subjectIds) ? quiz.subjectIds : [],
      title: trimText(quiz.title),
      totalMarks,
      autoScore: score,
      objectiveScore: score,
      manualScore: 0,
      totalScore: score,
      percentage,
      scorePercent: percentage,
      passScore,
      isPassed,
      status: "completed",
      answers: gradedAnswers,
      startedAt: attempt.startedAt || null,
      submittedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await attemptRef.set(
      {
        submittedAt: serverTimestamp(),
        status: "completed",
        resultId: resultRef.id,
        score,
        totalMarks,
        percentage,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Ranking: among all students in selected classes (missed => 0 score).
    let rank = null;
    let totalStudents = null;
    let rankAmongAttempts = null;
    let totalAttempts = null;
    try {
      const classIds = Array.isArray(quiz.classIds) ? quiz.classIds.map((id) => trimText(id)).filter(Boolean) : [];
      const classSnaps = await Promise.all(
        classIds.map((classId) => db.collection(COLLECTIONS.CLASSES).doc(classId).get())
      );
      const allStudentIds = new Set();
      classSnaps.forEach((snap) => {
        if (!snap.exists) return;
        const classData = snap.data() || {};
        const students = Array.isArray(classData.students) ? classData.students : [];
        students.forEach((entry) => {
          const studentId =
            typeof entry === "string"
              ? trimText(entry)
              : trimText(entry?.studentId || entry?.id || entry?.uid);
          if (studentId) allStudentIds.add(studentId);
        });
      });
      totalStudents = allStudentIds.size;

      const resultsSnap = await db.collection(COLLECTIONS.QUIZ_RESULTS).where("quizId", "==", quizId).get();
      const resultRows = resultsSnap.docs
        .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
        .filter((row) => lowerText(row.kind || row.quizKind) === "scheduled_subject_random");

      const attemptScoreMap = new Map();
      resultRows.forEach((row) => {
        const studentId = trimText(row.studentId);
        if (!studentId) return;
        const pct = Number(row.percentage ?? row.scorePercent ?? 0);
        const submittedAtRaw = row.submittedAt || row.createdAt || null;
        attemptScoreMap.set(studentId, {
          percentage: Number.isFinite(pct) ? pct : 0,
          submittedAt: parseDate(submittedAtRaw)?.getTime() || Number.MAX_SAFE_INTEGER,
        });
      });

      const attemptScores = [...attemptScoreMap.values()].map((v) => v.percentage).sort((a, b) => b - a);
      totalAttempts = attemptScores.length;
      const foundIndex = attemptScores.findIndex((s) => s <= Number(percentage || 0));
      rankAmongAttempts = foundIndex >= 0 ? foundIndex + 1 : attemptScores.length + 1;

      const allRows = [...allStudentIds].map((studentId) => {
        const record = attemptScoreMap.get(studentId);
        return {
          studentId,
          percentage: record ? record.percentage : 0,
          submittedAt: record ? record.submittedAt : Number.MAX_SAFE_INTEGER,
        };
      });
      allRows.sort((a, b) => {
        if (b.percentage !== a.percentage) return b.percentage - a.percentage;
        return a.submittedAt - b.submittedAt;
      });
      const foundAllIndex = allRows.findIndex((row) => row.studentId === uid);
      rank = foundAllIndex >= 0 ? foundAllIndex + 1 : null;

      await resultRef.set(
        {
          rank,
          totalStudents,
          rankAmongAttempts,
          totalAttempts,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (rankError) {
      console.error("submitStudentScheduledQuizAttempt ranking error:", rankError);
      rank = null;
      totalStudents = null;
      rankAmongAttempts = null;
      totalAttempts = null;
    }

    return successResponse(
      res,
      {
        resultId: resultRef.id,
        score,
        totalMarks,
        percentage,
        passScore,
        isPassed,
        rank,
        totalStudents,
        rankAmongAttempts,
        totalAttempts,
      },
      "Quiz submitted"
    );
  } catch (error) {
    console.error("submitStudentScheduledQuizAttempt error:", error);
    return errorResponse(res, error?.message || "Failed to submit quiz", 500);
  }
};
