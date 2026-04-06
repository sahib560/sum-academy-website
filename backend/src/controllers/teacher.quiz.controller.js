import { db, admin } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const trimText = (value = "") => String(value || "").trim();
const lowerText = (value = "") => trimText(value).toLowerCase();
const toIso = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};
const toPositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
const makeId = () => {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const QUIZ_SCOPE = new Set(["chapter", "subject"]);
const QUESTION_TYPES = new Set(["mcq"]);
const ASSIGNMENT_TARGET_TYPES = new Set(["students", "course", "class"]);
const CSV_HEADERS = [
  "scope",
  "courseid",
  "subjectid",
  "chapterid",
  "title",
  "description",
  "questiontype",
  "questiontext",
  "optiona",
  "optionb",
  "optionc",
  "optiond",
  "correctanswer",
  "expectedanswer",
  "marks",
];

const parseBooleanLike = (value) => {
  if (typeof value === "boolean") return value;
  const normalized = lowerText(value);
  if (["true", "t", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "f", "no", "n", "0"].includes(normalized)) return false;
  return null;
};

const getTeacherDisplayName = async (uid, fallbackEmail = "") => {
  const [teacherSnap, userSnap] = await Promise.all([
    db.collection(COLLECTIONS.TEACHERS).doc(uid).get(),
    db.collection(COLLECTIONS.USERS).doc(uid).get(),
  ]);

  const teacherData = teacherSnap.exists ? teacherSnap.data() || {} : {};
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  return (
    trimText(teacherData.fullName) ||
    trimText(teacherData.name) ||
    trimText(userData.fullName) ||
    trimText(userData.name) ||
    trimText(userData.displayName) ||
    trimText(userData.email).split("@")[0] ||
    trimText(fallbackEmail).split("@")[0] ||
    "Teacher"
  );
};

const parseCsvLine = (line = "") => {
  const row = [];
  let current = "";
  let insideQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }
    if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  row.push(current);
  return row.map((cell) => trimText(cell));
};

const parseCsvToRows = (csvText = "") => {
  const rawLines = String(csvText || "").split(/\r?\n/);
  if (!rawLines.length) {
    return { headers: [], rows: [], commentRows: [] };
  }

  let headers = [];
  let headerFound = false;
  const rows = [];
  const commentRows = [];

  rawLines.forEach((rawLine, index) => {
    const lineNo = index + 1;
    const trimmedLine = trimText(rawLine);
    if (!trimmedLine) return;

    if (trimmedLine.startsWith("#")) {
      commentRows.push(lineNo);
      return;
    }

    if (!headerFound) {
      headers = parseCsvLine(rawLine).map((header) => lowerText(header));
      headerFound = true;
      return;
    }

    const values = parseCsvLine(rawLine);
    const row = { __row: lineNo };
    headers.forEach((header, cellIndex) => {
      row[header] = values[cellIndex] ?? "";
    });

    const hasAnyValue = headers.some((header) => trimText(row[header]));
    if (!hasAnyValue) return;
    rows.push(row);
  });

  return { headers, rows, commentRows };
};

const csvEscapeCell = (value = "") => {
  const raw = String(value ?? "");
  if (!/[",\r\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
};

const makeCsv = (rows = []) =>
  rows.map((row) => row.map((cell) => csvEscapeCell(cell)).join(",")).join("\n");

const safeFilePart = (value = "") =>
  trimText(value)
    .replace(/[^\w\- ]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80) || "Template";

const mapQuestionType = (value = "") => {
  const normalized = lowerText(value);
  if (["mcq", "multiple_choice", "multiple-choice", "quiz"].includes(normalized)) {
    return "mcq";
  }
  return normalized;
};

const normalizeMcqCorrectAnswer = (rawAnswer, options = []) => {
  const answer = trimText(rawAnswer);
  if (!answer) return "";
  const upper = answer.toUpperCase();
  const letterMap = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };
  if (letterMap[upper] !== undefined && options[letterMap[upper]]) {
    return options[letterMap[upper]];
  }

  const index = Number(answer);
  if (Number.isFinite(index) && options[index]) return options[index];

  const exact = options.find((option) => lowerText(option) === lowerText(answer));
  return exact || "";
};

const normalizeQuestionInput = (questionInput = {}, rowRef = 1) => {
  const type = mapQuestionType(questionInput.type || questionInput.questionType);
  const questionText = trimText(
    questionInput.questionText || questionInput.question || questionInput.text
  );
  const marks = Math.max(1, toPositiveNumber(questionInput.marks, 1));
  const rowLabel = Number.isFinite(Number(rowRef)) ? Number(rowRef) : rowRef;

  if (!QUESTION_TYPES.has(type)) {
    throw new Error(`Only mcq questionType is allowed (row ${rowLabel})`);
  }
  if (questionText.length < 3) {
    throw new Error(`Question text too short at row ${rowLabel}`);
  }

  if (type === "mcq") {
    const optionsFromArray = Array.isArray(questionInput.options)
      ? questionInput.options
      : [];
    const optionsFromObject =
      questionInput.options && typeof questionInput.options === "object"
        ? [
            questionInput.options.A,
            questionInput.options.B,
            questionInput.options.C,
            questionInput.options.D,
          ]
        : [];
    const optionsFromFields = [
      questionInput.optionA,
      questionInput.optionB,
      questionInput.optionC,
      questionInput.optionD,
      questionInput.optionE,
      questionInput.optionF,
    ];
    const options = [...optionsFromArray, ...optionsFromObject, ...optionsFromFields]
      .map((option) => trimText(option))
      .filter(Boolean);

    if (options.length < 2) {
      throw new Error(`MCQ requires at least 2 options at row ${rowLabel}`);
    }

    const correctAnswer = normalizeMcqCorrectAnswer(
      questionInput.correctAnswer,
      options
    );
    if (!correctAnswer) {
      throw new Error(`MCQ correct answer mismatch at row ${rowLabel}`);
    }

    return {
      questionId: trimText(questionInput.questionId) || makeId(),
      type: "mcq",
      questionType: "mcq",
      questionText,
      options,
      correctAnswer,
      expectedAnswer: "",
      marks,
      requiresManualReview: false,
      order: Number.isFinite(Number(rowRef)) ? Number(rowRef) : 1,
    };
  }

  throw new Error(`Invalid mcq row ${rowLabel}`);
};

const getTeacherCourseSubjectContext = async (
  uid,
  courseId,
  subjectId,
  chapterId = "",
  role = "teacher"
) => {
  const courseSnap = await db.collection(COLLECTIONS.COURSES).doc(courseId).get();
  if (!courseSnap.exists) return { error: "Course not found", status: 404 };
  const courseData = courseSnap.data() || {};

  const subjects = Array.isArray(courseData.subjects) ? courseData.subjects : [];
  const subject = subjects.find(
    (entry) =>
      trimText(entry.subjectId || entry.id) === subjectId ||
      trimText(entry.id) === subjectId
  );
  if (!subject) return { error: "Subject not found in this course", status: 404 };

  if (role !== "admin") {
    const subjectTeacherId = trimText(subject.teacherId);
    const courseTeacherId = trimText(courseData.teacherId);
    const assigned = subjectTeacherId === uid || courseTeacherId === uid;
    if (!assigned) return { error: "You are not assigned to this subject", status: 403 };
  }

  let chapterData = null;
  if (chapterId) {
    const chapterSnap = await db.collection(COLLECTIONS.CHAPTERS).doc(chapterId).get();
    if (!chapterSnap.exists) return { error: "Chapter not found", status: 404 };
    chapterData = chapterSnap.data() || {};
    if (trimText(chapterData.courseId) !== courseId) {
      return { error: "Chapter does not belong to this course", status: 400 };
    }
    if (trimText(chapterData.subjectId) !== subjectId) {
      return { error: "Chapter does not belong to this subject", status: 400 };
    }
  }

  return {
    courseData,
    subjectData: subject,
    chapterData,
  };
};

const getActorRole = (req = {}) => lowerText(req.user?.role || "teacher");
const isAdminActor = (req = {}) => getActorRole(req) === "admin";

const isTeacherAssignedToClass = (classData = {}, uid = "") => {
  if (!uid) return false;
  if (trimText(classData.teacherId) === uid) return true;

  const teachers = Array.isArray(classData.teachers) ? classData.teachers : [];
  if (
    teachers.some((entry) => {
      if (typeof entry === "string") return trimText(entry) === uid;
      return (
        trimText(entry?.teacherId) === uid ||
        trimText(entry?.id) === uid ||
        trimText(entry?.uid) === uid
      );
    })
  ) {
    return true;
  }

  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  return shifts.some((shift) => trimText(shift?.teacherId) === uid);
};

const getClassStudentIds = (classData = {}) => {
  const raw = Array.isArray(classData.students) ? classData.students : [];
  return [
    ...new Set(
      raw
        .map((entry) =>
          typeof entry === "string"
            ? trimText(entry)
            : trimText(entry?.studentId || entry?.id || entry?.uid)
        )
        .filter(Boolean)
    ),
  ];
};

const getClassAssignedCourseIds = (classData = {}) => {
  const assigned = Array.isArray(classData.assignedCourses) ? classData.assignedCourses : [];
  const ids = assigned
    .map((entry) =>
      typeof entry === "string" ? trimText(entry) : trimText(entry?.courseId || entry?.id)
    )
    .filter(Boolean);
  const fallbackCourseId = trimText(classData.courseId);
  if (fallbackCourseId) ids.push(fallbackCourseId);
  return [...new Set(ids)];
};

const getStudentIdsForCourse = async (courseId = "") => {
  const cleanCourseId = trimText(courseId);
  if (!cleanCourseId) return [];

  const statuses = new Set(["", "active", "completed", "pending_review"]);
  const enrollmentSnap = await db
    .collection(COLLECTIONS.ENROLLMENTS)
    .where("courseId", "==", cleanCourseId)
    .get();
  const fromEnrollments = enrollmentSnap.docs
    .map((doc) => doc.data() || {})
    .filter((row) => statuses.has(lowerText(row.status || "active")))
    .map((row) => trimText(row.studentId))
    .filter(Boolean);

  const classesSnap = await db.collection(COLLECTIONS.CLASSES).get();
  const fromClasses = classesSnap.docs.flatMap((doc) => {
    const classData = doc.data() || {};
    const classCourseIds = getClassAssignedCourseIds(classData);
    if (!classCourseIds.includes(cleanCourseId)) return [];
    return getClassStudentIds(classData);
  });

  return [...new Set([...fromEnrollments, ...fromClasses])];
};

const createCourseQuizAnnouncement = async ({
  courseId = "",
  courseName = "",
  quizId = "",
  quizTitle = "",
  postedBy = "",
  postedByName = "Teacher",
  postedByRole = "teacher",
}) => {
  const cleanCourseId = trimText(courseId);
  const cleanQuizTitle = trimText(quizTitle);
  if (!cleanCourseId || !cleanQuizTitle) return;

  const recipientIds = await getStudentIdsForCourse(cleanCourseId);
  if (recipientIds.length < 1) return;

  await db.collection(COLLECTIONS.ANNOUNCEMENTS).add({
    title: `New Quiz Available: ${cleanQuizTitle}`,
    message: `A new quiz "${cleanQuizTitle}" has been added in ${
      trimText(courseName) || "your course"
    }. Please attempt it on time.`,
    targetType: "course",
    targetId: cleanCourseId,
    targetName: trimText(courseName) || "Course",
    audienceRole: "student",
    postedBy: trimText(postedBy),
    postedByName: trimText(postedByName) || "Teacher",
    postedByRole: trimText(postedByRole) || "teacher",
    sendEmail: false,
    isPinned: false,
    studentsReached: recipientIds.length,
    recipientIds,
    meta: {
      kind: "quiz",
      quizId: trimText(quizId),
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

const normalizeAssignmentInfo = (assignment = {}) => {
  const students = Array.isArray(assignment.students) ? assignment.students : [];
  const normalizedStudents = students
    .map((student) => ({
      studentId: trimText(student.studentId || student.id),
      fullName: trimText(student.fullName || student.name) || "Student",
      email: trimText(student.email),
    }))
    .filter((student) => student.studentId);

  return {
    targetType: ASSIGNMENT_TARGET_TYPES.has(lowerText(assignment.targetType))
      ? lowerText(assignment.targetType)
      : "students",
    classId: trimText(assignment.classId),
    courseId: trimText(assignment.courseId),
    assignedAt: toIso(assignment.assignedAt),
    dueAt: toIso(assignment.dueAt),
    assignedBy: trimText(assignment.assignedBy),
    totalAssigned: Math.max(
      0,
      toPositiveNumber(assignment.totalAssigned, normalizedStudents.length)
    ),
    students: normalizedStudents,
  };
};

const normalizeResultStatus = (value = "") => {
  const raw = lowerText(value || "completed");
  if (["partial", "pending", "pending_review"].includes(raw)) {
    return "pending_review";
  }
  return raw || "completed";
};

const isShortAnswerRow = (answer = {}) =>
  lowerText(answer?.type || answer?.questionType) === "short_answer";

const getMarksAwardedValue = (answer = {}) => {
  const raw = answer?.marksAwarded ?? answer?.marksObtained;
  if (raw === null || raw === undefined) return null;
  return toPositiveNumber(raw, 0);
};

const normalizeQuizSummary = (quizId, data = {}) => ({
  id: quizId,
  title: trimText(data.title) || "Quiz",
  description: trimText(data.description),
  scope: lowerText(data.scope) || "subject",
  courseId: trimText(data.courseId),
  courseName: trimText(data.courseName) || "Course",
  subjectId: trimText(data.subjectId),
  subjectName: trimText(data.subjectName) || "Subject",
  chapterId: trimText(data.chapterId),
  chapterTitle: trimText(data.chapterTitle),
  questionCount: toPositiveNumber(data.questionCount, 0),
  totalMarks: toPositiveNumber(data.totalMarks, 0),
  createdAt: toIso(data.createdAt),
  updatedAt: toIso(data.updatedAt),
  teacherId: trimText(data.teacherId),
  teacherName: trimText(data.teacherName),
  assignment: normalizeAssignmentInfo(data.assignment || {}),
  isFinalQuiz: data.isFinalQuiz === true,
  isPublished: data.isPublished !== false,
});

const buildQuizDocument = ({
  teacherId,
  teacherName,
  createdBy,
  createdByName,
  createdByRole,
  scope,
  title,
  description,
  courseId,
  courseName,
  subjectId,
  subjectName,
  chapterId,
  chapterTitle,
  questions,
  isFinalQuiz = false,
}) => {
  const normalizedQuestions = questions.map((question, index) => ({
    ...question,
    order: index + 1,
  }));
  const totalMarks = normalizedQuestions.reduce(
    (sum, question) => sum + Math.max(1, toPositiveNumber(question.marks, 1)),
    0
  );

  return {
    teacherId,
    teacherName,
    createdBy,
    createdByName,
    createdByRole,
    scope,
    status: "active",
    title,
    description,
    courseId,
    courseName,
    subjectId,
    subjectName,
    chapterId: scope === "chapter" ? chapterId : "",
    chapterTitle: scope === "chapter" ? chapterTitle : "",
    isFinalQuiz: Boolean(isFinalQuiz),
    questionCount: normalizedQuestions.length,
    totalMarks,
    questions: normalizedQuestions,
    isPublished: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
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

const evaluateQuizAnswersInternal = (quizData = {}, submittedAnswers = {}) => {
  const questions = Array.isArray(quizData.questions) ? quizData.questions : [];
  const normalizedAnswers = normalizeSubmittedAnswers(submittedAnswers);

  let objectiveScore = 0;
  let pendingManualMarks = 0;
  const answerRows = questions.map((question) => {
    const questionId = trimText(question.questionId);
    const type = mapQuestionType(question.type);
    const marks = Math.max(1, toPositiveNumber(question.marks, 1));
    const submittedRaw = normalizedAnswers[questionId];

    if (type === "short_answer") {
      pendingManualMarks += marks;
      return {
        questionId,
        type,
        questionText: trimText(question.questionText),
        submittedAnswer:
          submittedRaw === undefined || submittedRaw === null
            ? ""
            : String(submittedRaw),
        expectedAnswer: trimText(question.expectedAnswer),
        correctAnswer: null,
        isCorrect: null,
        marksAwarded: null,
        maxMarks: marks,
        requiresManualReview: true,
        feedback: "",
      };
    }

    if (type === "true_false") {
      const correct = Boolean(question.correctAnswer);
      const submitted = parseBooleanLike(submittedRaw);
      const isCorrect = submitted !== null && submitted === correct;
      const marksAwarded = isCorrect ? marks : 0;
      objectiveScore += marksAwarded;
      return {
        questionId,
        type,
        questionText: trimText(question.questionText),
        submittedAnswer: submitted,
        expectedAnswer: "",
        correctAnswer: correct,
        isCorrect,
        marksAwarded,
        maxMarks: marks,
        requiresManualReview: false,
        feedback: "",
      };
    }

    const correctAnswer = trimText(question.correctAnswer);
    const submitted = trimText(submittedRaw);
    const isCorrect = lowerText(submitted) === lowerText(correctAnswer);
    const marksAwarded = isCorrect ? marks : 0;
    objectiveScore += marksAwarded;
    return {
      questionId,
      type: "mcq",
      questionText: trimText(question.questionText),
      submittedAnswer: submitted,
      expectedAnswer: "",
      correctAnswer,
      isCorrect,
      marksAwarded,
      maxMarks: marks,
      requiresManualReview: false,
      feedback: "",
    };
  });

  const totalMarks = toPositiveNumber(
    quizData.totalMarks,
    questions.reduce((sum, question) => sum + Math.max(1, toPositiveNumber(question.marks, 1)), 0)
  );
  const manualScore = answerRows
    .filter((row) => row.requiresManualReview && Number.isFinite(row.marksAwarded))
    .reduce((sum, row) => sum + toPositiveNumber(row.marksAwarded, 0), 0);

  const totalScore = objectiveScore + manualScore;
  const status = pendingManualMarks > 0 ? "pending_review" : "completed";

  return {
    answers: answerRows,
    objectiveScore,
    manualScore,
    totalScore,
    totalMarks,
    pendingManualMarks,
    scorePercent: totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : 0,
    status,
  };
};

const getOwnedQuiz = async (quizId, teacherId, role = "teacher") => {
  const quizRef = db.collection(COLLECTIONS.QUIZZES).doc(quizId);
  const quizSnap = await quizRef.get();
  if (!quizSnap.exists) return { error: "Quiz not found", status: 404 };
  const quizData = quizSnap.data() || {};
  if (role !== "admin" && trimText(quizData.teacherId) !== teacherId) {
    return { error: "Forbidden", status: 403 };
  }
  return { quizRef, quizSnap, quizData };
};

const getStudentAssignmentProfile = async (studentId) => {
  const [studentSnap, userSnap] = await Promise.all([
    db.collection(COLLECTIONS.STUDENTS).doc(studentId).get(),
    db.collection(COLLECTIONS.USERS).doc(studentId).get(),
  ]);

  if (!studentSnap.exists && !userSnap.exists) return null;

  const studentData = studentSnap.exists ? studentSnap.data() || {} : {};
  const userData = userSnap.exists ? userSnap.data() || {} : {};

  const fullName =
    trimText(studentData.fullName) ||
    trimText(studentData.name) ||
    trimText(userData.fullName) ||
    trimText(userData.name) ||
    trimText(userData.displayName) ||
    "Student";

  const email = trimText(studentData.email) || trimText(userData.email);

  return {
    studentId,
    fullName,
    email,
  };
};

export const getTeacherQuizzes = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    if (!uid) return errorResponse(res, "Missing user uid", 400);

    let rows = [];
    if (role === "admin") {
      try {
        const snap = await db
          .collection(COLLECTIONS.QUIZZES)
          .orderBy("createdAt", "desc")
          .get();
        rows = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
      } catch {
        const snap = await db.collection(COLLECTIONS.QUIZZES).get();
        rows = snap.docs
          .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
          .sort(
            (a, b) =>
              (new Date(toIso(b.data.createdAt) || 0).getTime() || 0) -
              (new Date(toIso(a.data.createdAt) || 0).getTime() || 0)
          );
      }
    } else {
      try {
        const snap = await db
          .collection(COLLECTIONS.QUIZZES)
          .where("teacherId", "==", uid)
          .orderBy("createdAt", "desc")
          .get();
        rows = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
      } catch {
        const snap = await db
          .collection(COLLECTIONS.QUIZZES)
          .where("teacherId", "==", uid)
          .get();
        rows = snap.docs
          .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
          .sort(
            (a, b) =>
              (new Date(toIso(b.data.createdAt) || 0).getTime() || 0) -
              (new Date(toIso(a.data.createdAt) || 0).getTime() || 0)
          );
      }
    }

    const payload = rows.map((row) => normalizeQuizSummary(row.id, row.data));
    return successResponse(res, payload, "Teacher quizzes fetched");
  } catch (error) {
    console.error("getTeacherQuizzes error:", error);
    return errorResponse(res, "Failed to fetch quizzes", 500);
  }
};

export const getTeacherQuizById = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    const quizId = trimText(req.params?.quizId);
    if (!uid) return errorResponse(res, "Missing user uid", 400);
    if (!quizId) return errorResponse(res, "quizId is required", 400);

    const owned = await getOwnedQuiz(quizId, uid, role);
    if (owned.error) return errorResponse(res, owned.error, owned.status);

    const quiz = normalizeQuizSummary(quizId, owned.quizData);
    const questions = Array.isArray(owned.quizData.questions)
      ? owned.quizData.questions
      : [];

    return successResponse(
      res,
      {
        ...quiz,
        questions,
      },
      "Quiz fetched"
    );
  } catch (error) {
    console.error("getTeacherQuizById error:", error);
    return errorResponse(res, "Failed to fetch quiz", 500);
  }
};

export const assignQuizToStudents = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    const quizId = trimText(req.params?.quizId);
    const dueAtRaw = trimText(req.body?.dueAt);
    const targetType = ASSIGNMENT_TARGET_TYPES.has(lowerText(req.body?.targetType))
      ? lowerText(req.body?.targetType)
      : "students";
    const classId = trimText(req.body?.classId);
    const requestedCourseId = trimText(req.body?.courseId);
    const studentIds = [
      ...new Set(
        (Array.isArray(req.body?.studentIds) ? req.body.studentIds : [])
          .map((value) => trimText(value))
          .filter(Boolean)
      ),
    ];

    if (!uid) return errorResponse(res, "Missing user uid", 400);
    if (!quizId) return errorResponse(res, "quizId is required", 400);
    if (!dueAtRaw) {
      return errorResponse(res, "dueAt is required", 400);
    }

    const dueDate = new Date(dueAtRaw);
    if (Number.isNaN(dueDate.getTime())) {
      return errorResponse(res, "Invalid dueAt date/time", 400);
    }
    if (dueDate.getTime() < Date.now() - 60 * 1000) {
      return errorResponse(res, "dueAt must be in the future", 400);
    }

    const owned = await getOwnedQuiz(quizId, uid, role);
    if (owned.error) return errorResponse(res, owned.error, owned.status);
    const quizData = owned.quizData || {};
    const quizCourseId = trimText(quizData.courseId);
    const quizSubjectId = trimText(quizData.subjectId);
    const quizChapterId = trimText(quizData.chapterId);

    if (!quizCourseId || !quizSubjectId) {
      return errorResponse(res, "Quiz is missing course/subject linkage", 400);
    }

    if (!isAdminActor(req)) {
      const teacherContext = await getTeacherCourseSubjectContext(
        uid,
        quizCourseId,
        quizSubjectId,
        quizChapterId,
        role
      );
      if (teacherContext.error) {
        return errorResponse(res, teacherContext.error, teacherContext.status);
      }
    }

    const effectiveCourseId = requestedCourseId || quizCourseId;
    if (effectiveCourseId !== quizCourseId) {
      return errorResponse(res, "Quiz can only be assigned within its own course", 400);
    }

    let targetStudentIds = [];
    if (targetType === "course") {
      targetStudentIds = await getStudentIdsForCourse(quizCourseId);
      if (!targetStudentIds.length) {
        return errorResponse(res, "No students found in this course", 400);
      }
    } else if (targetType === "class") {
      if (!classId) {
        return errorResponse(res, "classId is required for class assignment", 400);
      }

      const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
      if (!classSnap.exists) return errorResponse(res, "Class not found", 404);
      const classData = classSnap.data() || {};

      const classCourseIds = getClassAssignedCourseIds(classData);
      if (!classCourseIds.includes(quizCourseId)) {
        return errorResponse(
          res,
          "Selected class is not assigned to this quiz course",
          400
        );
      }

      if (!isAdminActor(req) && !isTeacherAssignedToClass(classData, uid)) {
        return errorResponse(
          res,
          "You can only assign to your assigned classes",
          403
        );
      }

      targetStudentIds = getClassStudentIds(classData);
      if (!targetStudentIds.length) {
        return errorResponse(res, "No students found in selected class", 400);
      }
    } else {
      if (!studentIds.length) {
        return errorResponse(res, "Select at least one student", 400);
      }
      const eligibleCourseStudents = new Set(await getStudentIdsForCourse(quizCourseId));
      const invalidStudentIds = studentIds.filter((studentId) => !eligibleCourseStudents.has(studentId));
      if (invalidStudentIds.length) {
        return errorResponse(
          res,
          `Some students are not enrolled in this quiz course: ${invalidStudentIds.join(", ")}`,
          400
        );
      }
      targetStudentIds = studentIds;
    }

    const uniqueStudentIds = [...new Set(targetStudentIds.map((id) => trimText(id)).filter(Boolean))];
    if (!uniqueStudentIds.length) {
      return errorResponse(res, "No valid students found for assignment", 400);
    }

    const profiles = await Promise.all(
      uniqueStudentIds.map((studentId) => getStudentAssignmentProfile(studentId))
    );
    const missingIds = uniqueStudentIds.filter((_, index) => !profiles[index]);
    if (missingIds.length) {
      return errorResponse(
        res,
        `Some students were not found: ${missingIds.join(", ")}`,
        404
      );
    }

    const students = profiles.filter(Boolean).map((profile) => ({
      studentId: profile.studentId,
      fullName: profile.fullName,
      email: profile.email,
    }));

    await owned.quizRef.update({
      assignment: {
        assignedBy: uid,
        assignedAt: serverTimestamp(),
        dueAt: dueDate.toISOString(),
        targetType,
        classId: targetType === "class" ? classId : "",
        courseId: quizCourseId,
        totalAssigned: students.length,
        students,
      },
      updatedAt: serverTimestamp(),
    });

    const updatedSnap = await owned.quizRef.get();
    const updatedData = updatedSnap.data() || {};

    return successResponse(
      res,
      {
        id: quizId,
        assignment: normalizeAssignmentInfo(updatedData.assignment || {}),
      },
      "Quiz assigned successfully"
    );
  } catch (error) {
    console.error("assignQuizToStudents error:", error);
    return errorResponse(res, "Failed to assign quiz", 500);
  }
};

export const getQuizAnalytics = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    const quizId = trimText(req.params?.quizId);

    if (!uid) return errorResponse(res, "Missing user uid", 400);
    if (!quizId) return errorResponse(res, "quizId is required", 400);

    const owned = await getOwnedQuiz(quizId, uid, role);
    if (owned.error) return errorResponse(res, owned.error, owned.status);

    const assignment = normalizeAssignmentInfo(owned.quizData.assignment || {});

    let resultRows = [];
    try {
      const snap = await db
        .collection(COLLECTIONS.QUIZ_RESULTS)
        .where("quizId", "==", quizId)
        .orderBy("submittedAt", "desc")
        .get();
      resultRows = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
    } catch {
      const snap = await db
        .collection(COLLECTIONS.QUIZ_RESULTS)
        .where("quizId", "==", quizId)
        .get();
      resultRows = snap.docs
        .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
        .sort(
          (a, b) =>
            (new Date(toIso(b.data.submittedAt) || 0).getTime() || 0) -
            (new Date(toIso(a.data.submittedAt) || 0).getTime() || 0)
        );
    }

    const latestByStudent = new Map();
    const timelineMap = {};

    resultRows.forEach((row) => {
      const data = row.data || {};
      const studentId = trimText(data.studentId);
      const submittedAt = toIso(data.submittedAt) || toIso(data.createdAt);
      if (submittedAt) {
        const dayKey = submittedAt.slice(0, 10);
        timelineMap[dayKey] = (timelineMap[dayKey] || 0) + 1;
      }
      if (!studentId) return;
      if (latestByStudent.has(studentId)) return;
      latestByStudent.set(studentId, {
        studentId,
        studentName: trimText(data.studentName) || "Student",
        status: normalizeResultStatus(data.status),
        scorePercent: toPositiveNumber(data.scorePercent, 0),
        submittedAt,
      });
    });

    const latestResults = [...latestByStudent.values()];
    const attemptedCount = latestResults.length;
    const pendingReviewCount = latestResults.filter(
      (row) => normalizeResultStatus(row.status) === "pending_review"
    ).length;
    const completedCount = latestResults.filter(
      (row) => normalizeResultStatus(row.status) === "completed"
    ).length;
    const avgScore =
      latestResults.length > 0
        ? Math.round(
            latestResults.reduce((sum, row) => sum + row.scorePercent, 0) /
              latestResults.length
          )
        : 0;

    const passThreshold = 50;
    const passCount = latestResults.filter(
      (row) => row.scorePercent >= passThreshold
    ).length;
    const passRate = attemptedCount > 0 ? Math.round((passCount / attemptedCount) * 100) : 0;

    const distribution = [
      { range: "0-20", min: 0, max: 20, count: 0 },
      { range: "21-40", min: 21, max: 40, count: 0 },
      { range: "41-60", min: 41, max: 60, count: 0 },
      { range: "61-80", min: 61, max: 80, count: 0 },
      { range: "81-100", min: 81, max: 100, count: 0 },
    ];
    latestResults.forEach((row) => {
      const bucket = distribution.find(
        (entry) => row.scorePercent >= entry.min && row.scorePercent <= entry.max
      );
      if (bucket) bucket.count += 1;
    });

    const submissionTrend = Object.keys(timelineMap)
      .sort()
      .map((date) => ({
        date,
        submissions: timelineMap[date],
      }));

    const totalAssigned = Math.max(assignment.totalAssigned, attemptedCount);
    const notAttempted = Math.max(0, totalAssigned - attemptedCount);

    const assignedStudents = assignment.students.map((student) => {
      const latest = latestByStudent.get(student.studentId);
      return {
        ...student,
        status: latest ? "attempted" : "not_attempted",
        scorePercent: latest ? latest.scorePercent : null,
        submittedAt: latest ? latest.submittedAt : null,
      };
    });

    return successResponse(
      res,
      {
        quizId,
        title: trimText(owned.quizData.title) || "Quiz",
        assignment,
        summary: {
          totalAssigned,
          attemptedCount,
          notAttempted,
          completedCount,
          pendingReviewCount,
          averageScore: avgScore,
          passRate,
        },
        scoreDistribution: distribution.map((row) => ({
          range: row.range,
          count: row.count,
        })),
        submissionTrend,
        latestResults: latestResults
          .sort((a, b) => b.scorePercent - a.scorePercent)
          .slice(0, 10),
        assignedStudents,
      },
      "Quiz analytics fetched"
    );
  } catch (error) {
    console.error("getQuizAnalytics error:", error);
    return errorResponse(res, "Failed to fetch quiz analytics", 500);
  }
};

export const createTeacherQuiz = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    if (!uid) return errorResponse(res, "Missing user uid", 400);

    const scope = lowerText(req.body?.scope || "subject");
    const title = trimText(req.body?.title);
    const description = trimText(req.body?.description);
    const courseId = trimText(req.body?.courseId);
    const subjectId = trimText(req.body?.subjectId);
    const chapterId = trimText(req.body?.chapterId);
    const questionInput = Array.isArray(req.body?.questions) ? req.body.questions : [];
    const isFinalQuiz = req.body?.isFinalQuiz === true;
    const createTargetType = lowerText(
      req.body?.assignmentTargetType || req.body?.targetType || ""
    );
    const assignClassId = trimText(req.body?.assignToClassId || req.body?.classId);
    const assignDueAtRaw = trimText(req.body?.dueAt);

    if (!QUIZ_SCOPE.has(scope)) {
      return errorResponse(res, "scope must be chapter or subject", 400);
    }
    if (!title || title.length < 3) {
      return errorResponse(res, "title must be at least 3 characters", 400);
    }
    if (!courseId || !subjectId) {
      return errorResponse(res, "courseId and subjectId are required", 400);
    }
    if (scope === "chapter" && !chapterId) {
      return errorResponse(res, "chapterId is required for chapter quiz", 400);
    }
    if (!questionInput.length) {
      return errorResponse(res, "At least one question is required", 400);
    }

    const context = await getTeacherCourseSubjectContext(
      uid,
      courseId,
      subjectId,
      scope === "chapter" ? chapterId : "",
      role
    );
    if (context.error) return errorResponse(res, context.error, context.status);

    const questions = questionInput.map((row, index) =>
      normalizeQuestionInput(row, index + 1)
    );

    const actorName = await getTeacherDisplayName(uid, req.user?.email || "");
    const payload = buildQuizDocument({
      teacherId: role === "teacher" ? uid : "",
      teacherName: role === "teacher" ? actorName : "",
      createdBy: uid,
      createdByName: actorName,
      createdByRole: role || "teacher",
      scope,
      title,
      description,
      courseId,
      courseName: trimText(context.courseData.title) || "Course",
      subjectId,
      subjectName:
        trimText(context.subjectData.subjectName || context.subjectData.name) || "Subject",
      chapterId,
      chapterTitle: trimText(context.chapterData?.title),
      questions,
      isFinalQuiz,
    });

    const shouldAssignToClass =
      createTargetType === "class" || Boolean(assignClassId);
    if (shouldAssignToClass) {
      if (!assignClassId) {
        return errorResponse(res, "classId is required for class assignment", 400);
      }
      if (!assignDueAtRaw) {
        return errorResponse(res, "dueAt is required for class assignment", 400);
      }

      const dueDate = new Date(assignDueAtRaw);
      if (Number.isNaN(dueDate.getTime())) {
        return errorResponse(res, "Invalid dueAt date/time", 400);
      }
      if (dueDate.getTime() < Date.now() - 60 * 1000) {
        return errorResponse(res, "dueAt must be in the future", 400);
      }

      const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(assignClassId).get();
      if (!classSnap.exists) return errorResponse(res, "Class not found", 404);
      const classData = classSnap.data() || {};

      const classCourseIds = getClassAssignedCourseIds(classData);
      if (!classCourseIds.includes(courseId)) {
        return errorResponse(
          res,
          "Selected class is not assigned to this quiz course",
          400
        );
      }

      if (!isAdminActor(req) && !isTeacherAssignedToClass(classData, uid)) {
        return errorResponse(
          res,
          "You can only add quizzes for your assigned classes",
          403
        );
      }

      const targetStudentIds = getClassStudentIds(classData);
      if (!targetStudentIds.length) {
        return errorResponse(res, "No students found in selected class", 400);
      }

      const profiles = await Promise.all(
        targetStudentIds.map((studentId) => getStudentAssignmentProfile(studentId))
      );
      const students = profiles
        .filter(Boolean)
        .map((profile) => ({
          studentId: profile.studentId,
          fullName: profile.fullName,
          email: profile.email,
        }));

      payload.assignment = {
        assignedBy: uid,
        assignedAt: serverTimestamp(),
        dueAt: dueDate.toISOString(),
        targetType: "class",
        classId: assignClassId,
        courseId,
        totalAssigned: students.length,
        students,
      };
    }

    const quizRef = await db.collection(COLLECTIONS.QUIZZES).add(payload);
    const createdSnap = await quizRef.get();
    const createdData = createdSnap.data() || payload;

    try {
      await createCourseQuizAnnouncement({
        courseId,
        courseName: trimText(context.courseData.title) || "Course",
        quizId: quizRef.id,
        quizTitle: title,
        postedBy: uid,
        postedByName: actorName,
        postedByRole: role || "teacher",
      });
    } catch (announcementError) {
      console.error("createTeacherQuiz announcement error:", announcementError);
    }

    return successResponse(
      res,
      {
        ...normalizeQuizSummary(quizRef.id, createdData),
        questions: createdData.questions || [],
      },
      "Quiz created",
      201
    );
  } catch (error) {
    console.error("createTeacherQuiz error:", error);
    return errorResponse(res, error?.message || "Failed to create quiz", 500);
  }
};

export const downloadQuizBulkTemplate = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    if (!uid) return errorResponse(res, "Missing user uid", 400);

    const scope = lowerText(req.query?.scope || "subject");
    const courseId = trimText(req.query?.courseId);
    const subjectId = trimText(req.query?.subjectId);
    const chapterId = trimText(req.query?.chapterId);
    const requestedCourseName = trimText(req.query?.courseName);
    const requestedSubjectName = trimText(req.query?.subjectName);
    const requestedChapterName = trimText(req.query?.chapterName);

    if (!QUIZ_SCOPE.has(scope)) {
      return errorResponse(res, "scope must be chapter or subject", 400);
    }
    if (!courseId || !subjectId) {
      return errorResponse(res, "courseId and subjectId are required", 400);
    }
    if (scope === "chapter" && !chapterId) {
      return errorResponse(res, "chapterId is required for chapter scope", 400);
    }

    const context = await getTeacherCourseSubjectContext(
      uid,
      courseId,
      subjectId,
      scope === "chapter" ? chapterId : "",
      role
    );
    if (context.error) return errorResponse(res, context.error, context.status);

    const courseName = requestedCourseName || trimText(context.courseData.title) || "Course";
    const subjectName =
      requestedSubjectName ||
      trimText(context.subjectData.subjectName || context.subjectData.name) ||
      "Subject";
    const chapterName =
      requestedChapterName || trimText(context.chapterData?.title) || "Chapter";
    const chapterValue = scope === "chapter" ? chapterId : "";
    const quizTitle = scope === "chapter" ? "Chapter Quiz Sample" : "Subject Quiz Sample";
    const description =
      scope === "chapter" ? "Practice for this chapter" : "Practice for this subject";

    const csvRows = [
      [
        scope,
        courseId,
        subjectId,
        chapterValue,
        quizTitle,
        description,
        "mcq",
        "What is 2 + 2?",
        "3",
        "4",
        "5",
        "6",
        "B",
        "",
        "1",
      ],
      [
        scope,
        courseId,
        subjectId,
        chapterValue,
        quizTitle,
        description,
        "mcq",
        "Sun rises from the east.",
        "True",
        "False",
        "",
        "",
        "A",
        "",
        "1",
      ],
      [
        scope,
        courseId,
        subjectId,
        chapterValue,
        quizTitle,
        description,
        "mcq",
        "Define osmosis.",
        "Movement of water",
        "Cell division",
        "Gravity",
        "Mitosis",
        "A",
        "",
        "2",
      ],
      [
        scope,
        courseId,
        subjectId,
        chapterValue,
        quizTitle,
        description,
        "mcq",
        "Which option is correct?",
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4",
        "A",
        "",
        "2",
      ],
      [
        scope,
        courseId,
        subjectId,
        chapterValue,
        quizTitle,
        description,
        "mcq",
        "Water boils at 100C at sea level.",
        "True",
        "False",
        "",
        "",
        "A",
        "",
        "1",
      ],
    ];

    const headerRow = [
      "scope",
      "courseId",
      "subjectId",
      "chapterId",
      "title",
      "description",
      "questionType",
      "questionText",
      "optionA",
      "optionB",
      "optionC",
      "optionD",
      "correctAnswer",
      "expectedAnswer",
      "marks",
    ];

    const commentRow =
      "# scope: chapter or subject | courseId/subjectId/chapterId: DO NOT EDIT | questionType: mcq only | correctAnswer for mcq: A B C or D | marks: number of marks for this question";
    const guidanceRow =
      "# DO NOT EDIT columns A-D (scope courseId subjectId chapterId). Fill questions from column E onwards. Delete comment rows before uploading.";

    const csvContent = [
      commentRow,
      guidanceRow,
      makeCsv([headerRow, ...csvRows]),
    ].join("\n");

    const fileName =
      scope === "chapter"
        ? `Quiz_Template_Chapter_${safeFilePart(chapterName)}.csv`
        : `Quiz_Template_Subject_${safeFilePart(subjectName)}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("X-Template-Course", courseName);
    res.setHeader("X-Template-Subject", subjectName);
    if (scope === "chapter") res.setHeader("X-Template-Chapter", chapterName);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("downloadQuizBulkTemplate error:", error);
    return errorResponse(res, "Failed to download template", 500);
  }
};

export const bulkUploadTeacherQuiz = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    if (!uid) return errorResponse(res, "Missing user uid", 400);
    const fileBuffer = req.file?.buffer;
    const csvText = fileBuffer
      ? fileBuffer.toString("utf8")
      : trimText(req.body?.csvText || "");
    if (!csvText) {
      return errorResponse(res, "CSV file is required", 400);
    }

    const parsedCsv = parseCsvToRows(csvText);
    if (!parsedCsv.headers.length) {
      return errorResponse(res, "CSV header row not found", 400);
    }

    const missingHeaders = CSV_HEADERS.filter(
      (header) => !parsedCsv.headers.includes(header)
    );
    if (missingHeaders.length) {
      return errorResponse(
        res,
        `CSV missing required columns: ${missingHeaders.join(", ")}`,
        400
      );
    }
    if (!parsedCsv.rows.length) {
      return errorResponse(res, "No question rows found in CSV", 400);
    }

    const normalizedRows = parsedCsv.rows.map((row) => ({
      __row: row.__row,
      scope: lowerText(row.scope),
      courseId: trimText(row.courseid),
      subjectId: trimText(row.subjectid),
      chapterId: trimText(row.chapterid),
      title: trimText(row.title),
      description: trimText(row.description),
      questionType: row.questiontype,
      questionText: row.questiontext,
      optionA: row.optiona,
      optionB: row.optionb,
      optionC: row.optionc,
      optionD: row.optiond,
      correctAnswer: row.correctanswer,
      expectedAnswer: row.expectedanswer,
      marks: row.marks,
    }));

    if (normalizedRows.some((row) => !row.courseId)) {
      return errorResponse(res, "courseId is required in every row", 400);
    }
    if (normalizedRows.some((row) => !row.subjectId)) {
      return errorResponse(res, "subjectId is required in every row", 400);
    }
    if (normalizedRows.some((row) => !QUIZ_SCOPE.has(row.scope))) {
      return errorResponse(res, "scope must be chapter or subject", 400);
    }

    const courseIds = [...new Set(normalizedRows.map((row) => row.courseId))];
    const subjectIds = [...new Set(normalizedRows.map((row) => row.subjectId))];
    const scopes = [...new Set(normalizedRows.map((row) => row.scope))];

    if (courseIds.length !== 1) {
      return errorResponse(res, "All rows must belong to same course", 400);
    }
    if (subjectIds.length !== 1) {
      return errorResponse(res, "All rows must belong to same subject", 400);
    }
    if (scopes.length !== 1) {
      return errorResponse(res, "All rows must have same scope", 400);
    }

    const scope = scopes[0];
    if (scope === "chapter") {
      if (normalizedRows.some((row) => !row.chapterId)) {
        return errorResponse(
          res,
          "chapterId is required in every row for chapter scope",
          400
        );
      }
      const chapterIds = [...new Set(normalizedRows.map((row) => row.chapterId))];
      if (chapterIds.length !== 1) {
        return errorResponse(res, "All rows must belong to same chapter", 400);
      }
    }

    const courseId = courseIds[0];
    const subjectId = subjectIds[0];
    const chapterId =
      scope === "chapter" ? trimText(normalizedRows[0]?.chapterId) : "";

    const context = await getTeacherCourseSubjectContext(
      uid,
      courseId,
      subjectId,
      chapterId,
      role
    );
    if (context.error) return errorResponse(res, context.error, context.status);

    const groupedByTitle = new Map();
    const rowErrors = [];

    normalizedRows.forEach((row, rowIndex) => {
      if (!row.title || row.title.length < 3) {
        rowErrors.push({
          row: row.__row || rowIndex + 2,
          message: "Quiz title must be at least 3 characters",
        });
        return;
      }

      try {
        const question = normalizeQuestionInput(
          {
            type: row.questionType,
            questionText: row.questionText,
            optionA: row.optionA,
            optionB: row.optionB,
            optionC: row.optionC,
            optionD: row.optionD,
            correctAnswer: row.correctAnswer,
            expectedAnswer: row.expectedAnswer,
            marks: row.marks,
          },
          row.__row || rowIndex + 2
        );

        const titleKey = lowerText(row.title);
        const existing = groupedByTitle.get(titleKey) || {
          title: row.title,
          description: row.description,
          questions: [],
        };

        if (!existing.description && row.description) {
          existing.description = row.description;
        }
        existing.questions.push(question);
        groupedByTitle.set(titleKey, existing);
      } catch (error) {
        rowErrors.push({
          row: row.__row || rowIndex + 2,
          message: error?.message || "Invalid row",
        });
      }
    });

    if (rowErrors.length) {
      return errorResponse(res, "Validation failed for CSV rows", 400, rowErrors);
    }
    if (!groupedByTitle.size) {
      return errorResponse(res, "No valid questions found in CSV", 400);
    }

    const actorName = await getTeacherDisplayName(uid, req.user?.email || "");
    const courseName = trimText(context.courseData.title) || "Course";
    const subjectName =
      trimText(context.subjectData.subjectName || context.subjectData.name) || "Subject";
    const chapterTitle = trimText(context.chapterData?.title);

    let questionsCreated = 0;
    const createdQuizzes = [];

    for (const group of groupedByTitle.values()) {
      const payload = buildQuizDocument({
        teacherId: role === "teacher" ? uid : "",
        teacherName: role === "teacher" ? actorName : "",
        createdBy: uid,
        createdByName: actorName,
        createdByRole: role || "teacher",
        scope,
        title: group.title,
        description: group.description,
        courseId,
        courseName,
        subjectId,
        subjectName,
        chapterId,
        chapterTitle,
        questions: group.questions,
      });
      const quizRef = await db.collection(COLLECTIONS.QUIZZES).add(payload);
      createdQuizzes.push({
        id: quizRef.id,
        title: group.title,
        questionsCount: group.questions.length,
      });
      questionsCreated += group.questions.length;
    }

    return successResponse(
      res,
      {
        quizzesCreated: createdQuizzes.length,
        questionsCreated,
        quizzes: createdQuizzes,
        commentRowsSkipped: parsedCsv.commentRows.length,
      },
      "Bulk quiz upload completed",
      201
    );
  } catch (error) {
    console.error("bulkUploadTeacherQuiz error:", error);
    return errorResponse(res, error?.message || "Failed to bulk upload quiz", 500);
  }
};

export const previewQuizEvaluation = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    const quizId = trimText(req.params?.quizId);
    const answers = req.body?.answers;

    if (!uid) return errorResponse(res, "Missing user uid", 400);
    if (!quizId) return errorResponse(res, "quizId is required", 400);

    const owned = await getOwnedQuiz(quizId, uid, role);
    if (owned.error) return errorResponse(res, owned.error, owned.status);

    const evaluation = evaluateQuizAnswersInternal(owned.quizData, answers);
    return successResponse(res, evaluation, "Quiz evaluated");
  } catch (error) {
    console.error("previewQuizEvaluation error:", error);
    return errorResponse(res, "Failed to evaluate quiz answers", 500);
  }
};

export const submitQuizAttempt = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    const quizId = trimText(req.params?.quizId);
    const studentId = trimText(req.body?.studentId);
    const studentName = trimText(req.body?.studentName);
    const answers = req.body?.answers;

    if (!uid) return errorResponse(res, "Missing user uid", 400);
    if (!quizId) return errorResponse(res, "quizId is required", 400);
    if (!studentId) return errorResponse(res, "studentId is required", 400);

    const owned = await getOwnedQuiz(quizId, uid, role);
    if (owned.error) return errorResponse(res, owned.error, owned.status);

    const evaluation = evaluateQuizAnswersInternal(owned.quizData, answers);
    const resultDoc = {
      quizId,
      quizTitle: trimText(owned.quizData.title),
      teacherId: uid,
      courseId: trimText(owned.quizData.courseId),
      courseName: trimText(owned.quizData.courseName),
      subjectId: trimText(owned.quizData.subjectId),
      subjectName: trimText(owned.quizData.subjectName),
      chapterId: trimText(owned.quizData.chapterId),
      chapterTitle: trimText(owned.quizData.chapterTitle),
      studentId,
      studentName: studentName || "Student",
      answers: evaluation.answers,
      objectiveScore: evaluation.objectiveScore,
      manualScore: evaluation.manualScore,
      totalScore: evaluation.totalScore,
      totalMarks: evaluation.totalMarks,
      pendingManualMarks: evaluation.pendingManualMarks,
      scorePercent: evaluation.scorePercent,
      status: evaluation.status,
      submittedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const resultRef = await db.collection(COLLECTIONS.QUIZ_RESULTS).add(resultDoc);

    return successResponse(
      res,
      {
        resultId: resultRef.id,
        ...evaluation,
      },
      evaluation.status === "pending_review"
        ? "Submitted. Awaiting short answer review"
        : "Submitted and auto-checked",
      201
    );
  } catch (error) {
    console.error("submitQuizAttempt error:", error);
    return errorResponse(res, "Failed to submit quiz attempt", 500);
  }
};

export const getQuizSubmissions = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    const quizId = trimText(req.params?.quizId);

    if (!uid) return errorResponse(res, "Missing user uid", 400);
    if (!quizId) return errorResponse(res, "quizId is required", 400);

    const owned = await getOwnedQuiz(quizId, uid, role);
    if (owned.error) return errorResponse(res, owned.error, owned.status);

    let rows = [];
    try {
      const snap = await db
        .collection(COLLECTIONS.QUIZ_RESULTS)
        .where("quizId", "==", quizId)
        .orderBy("submittedAt", "desc")
        .get();
      rows = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
    } catch {
      const snap = await db
        .collection(COLLECTIONS.QUIZ_RESULTS)
        .where("quizId", "==", quizId)
        .get();
      rows = snap.docs
        .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
        .sort(
          (a, b) =>
            (new Date(toIso(b.data.submittedAt) || 0).getTime() || 0) -
            (new Date(toIso(a.data.submittedAt) || 0).getTime() || 0)
        );
    }

    const questionRows = Array.isArray(owned.quizData.questions)
      ? owned.quizData.questions
      : [];
    const questionById = questionRows.reduce((acc, question) => {
      const questionId = trimText(question.questionId || question.id);
      if (!questionId) return acc;
      acc[questionId] = question;
      return acc;
    }, {});

    const payload = rows.map((row) => {
      const data = row.data || {};
      const answerRows = Array.isArray(data.answers) ? data.answers : [];
      return {
        id: row.id,
        studentId: trimText(data.studentId),
        studentName: trimText(data.studentName) || "Student",
        status: normalizeResultStatus(data.status),
        objectiveScore: toPositiveNumber(data.objectiveScore, 0),
        manualScore: toPositiveNumber(data.manualScore, 0),
        totalScore: toPositiveNumber(data.totalScore, 0),
        totalMarks: toPositiveNumber(data.totalMarks, 0),
        scorePercent: toPositiveNumber(data.scorePercent, 0),
        pendingManualMarks: toPositiveNumber(data.pendingManualMarks, 0),
        submittedAt: toIso(data.submittedAt) || toIso(data.createdAt),
        reviewedAt: toIso(data.reviewedAt),
        shortAnswers: answerRows
          .filter((answer) => isShortAnswerRow(answer))
          .map((answer) => ({
            questionId: trimText(answer.questionId || answer.id),
            questionText: trimText(
              answer.questionText ||
                questionById[trimText(answer.questionId || answer.id)]?.questionText ||
                questionById[trimText(answer.questionId || answer.id)]?.text
            ),
            submittedAnswer: trimText(answer.submittedAnswer || answer.studentAnswer),
            expectedAnswer: trimText(
              answer.expectedAnswer ||
                questionById[trimText(answer.questionId || answer.id)]?.expectedAnswer
            ),
            marksAwarded: getMarksAwardedValue(answer),
            maxMarks: Math.max(
              1,
              toPositiveNumber(
                answer.maxMarks,
                questionById[trimText(answer.questionId || answer.id)]?.marks || 1
              )
            ),
            feedback: trimText(answer.feedback),
          })),
      };
    });

    return successResponse(res, payload, "Quiz submissions fetched");
  } catch (error) {
    console.error("getQuizSubmissions error:", error);
    return errorResponse(res, "Failed to fetch quiz submissions", 500);
  }
};

export const gradeShortAnswerSubmission = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    const quizId = trimText(req.params?.quizId);
    const resultId = trimText(req.params?.resultId);
    const gradedAnswers = Array.isArray(req.body?.gradedAnswers)
      ? req.body.gradedAnswers
      : [];

    if (!uid) return errorResponse(res, "Missing user uid", 400);
    if (!quizId || !resultId) {
      return errorResponse(res, "quizId and resultId are required", 400);
    }

    const owned = await getOwnedQuiz(quizId, uid, role);
    if (owned.error) return errorResponse(res, owned.error, owned.status);

    const resultRef = db.collection(COLLECTIONS.QUIZ_RESULTS).doc(resultId);
    const resultSnap = await resultRef.get();
    if (!resultSnap.exists) return errorResponse(res, "Result not found", 404);

    const resultData = resultSnap.data() || {};
    if (trimText(resultData.quizId) !== quizId) {
      return errorResponse(res, "Result does not belong to this quiz", 400);
    }

    const gradingMap = {};
    gradedAnswers.forEach((row) => {
      const questionId = trimText(row?.questionId);
      if (!questionId) return;
      gradingMap[questionId] = {
        marks: toPositiveNumber(row?.marks, 0),
        feedback: trimText(row?.feedback),
      };
    });

    const answerRows = Array.isArray(resultData.answers) ? resultData.answers : [];
    const updatedAnswers = answerRows.map((answer) => {
      if (!isShortAnswerRow(answer)) return answer;
      const questionId = trimText(answer.questionId);
      const incoming = gradingMap[questionId];
      if (!incoming) return answer;

      const maxMarks = Math.max(1, toPositiveNumber(answer.maxMarks, 1));
      return {
        ...answer,
        type: "short_answer",
        questionType: "short_answer",
        marksAwarded: Math.max(0, Math.min(maxMarks, incoming.marks)),
        marksObtained: Math.max(0, Math.min(maxMarks, incoming.marks)),
        feedback: incoming.feedback,
        status: "graded",
      };
    });

    const objectiveScore = updatedAnswers
      .filter((answer) => !isShortAnswerRow(answer))
      .reduce((sum, answer) => {
        const marks = getMarksAwardedValue(answer);
        return sum + (marks === null ? 0 : marks);
      }, 0);
    const manualScore = updatedAnswers
      .filter((answer) => isShortAnswerRow(answer))
      .reduce((sum, answer) => {
        const marks = getMarksAwardedValue(answer);
        return sum + (marks === null ? 0 : marks);
      }, 0);
    const pendingManualMarks = updatedAnswers
      .filter((answer) => isShortAnswerRow(answer))
      .filter((answer) => getMarksAwardedValue(answer) === null)
      .reduce((sum, answer) => sum + toPositiveNumber(answer.maxMarks, 0), 0);

    const totalMarks = toPositiveNumber(
      resultData.totalMarks,
      updatedAnswers.reduce((sum, answer) => sum + toPositiveNumber(answer.maxMarks, 0), 0)
    );
    const totalScore = objectiveScore + manualScore;
    const scorePercent = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : 0;
    const status = pendingManualMarks > 0 ? "pending_review" : "completed";

    await resultRef.update({
      answers: updatedAnswers,
      objectiveScore,
      manualScore,
      totalScore,
      totalMarks,
      pendingManualMarks,
      scorePercent,
      status,
      reviewedBy: uid,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return successResponse(
      res,
      {
        resultId,
        objectiveScore,
        manualScore,
        totalScore,
        totalMarks,
        pendingManualMarks,
        scorePercent,
        status,
      },
      "Short answers graded"
    );
  } catch (error) {
    console.error("gradeShortAnswerSubmission error:", error);
    return errorResponse(res, "Failed to grade short answers", 500);
  }
};
