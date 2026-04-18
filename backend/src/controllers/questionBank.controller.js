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

export const createQuestionBankQuestion = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    if (!uid) return errorResponse(res, "Missing user uid", 400);
    if (!(role === "admin" || role === "teacher")) {
      return errorResponse(res, "Access denied", 403);
    }

    const subjectId = trimText(req.body?.subjectId);
    const classIdRaw = trimText(req.body?.classId || "all");
    const classId = classIdRaw ? classIdRaw : "all";
    const questionText = trimText(req.body?.questionText || req.body?.question || req.body?.text);
    const marks = Math.max(1, toPositiveNumber(req.body?.marks, 1));

    const optionsRaw = req.body?.options;
    const options =
      Array.isArray(optionsRaw) && optionsRaw.length
        ? optionsRaw
        : [
            req.body?.optionA,
            req.body?.optionB,
            req.body?.optionC,
            req.body?.optionD,
          ];
    const cleanOptions = options.map((opt) => trimText(opt)).filter(Boolean);

    if (!subjectId) return errorResponse(res, "subjectId is required", 400);
    if (questionText.length < 3) return errorResponse(res, "questionText too short", 400);
    if (cleanOptions.length !== 4) {
      return errorResponse(res, "options must have exactly 4 entries", 400);
    }

    const correctAnswer = normalizeMcqCorrectAnswer(req.body?.correctAnswer, cleanOptions);
    if (!correctAnswer) return errorResponse(res, "Invalid correctAnswer", 400);

    if (!isAdminActor(req)) {
      const assignment = await getTeacherAssignmentSets(uid);
      if (assignment.subjectIdSet.size < 1) {
        return errorResponse(
          res,
          "No assigned subjects found for your teacher account. Contact admin to assign subjects.",
          403
        );
      }
      if (!assignment.subjectIdSet.has(subjectId)) {
        return errorResponse(res, "You can only add questions for your assigned subjects", 403);
      }
      if (classId !== "all" && assignment.classIdSet.size < 1) {
        return errorResponse(
          res,
          "No assigned classes found for your teacher account. Contact admin to assign classes.",
          403
        );
      }
      if (classId !== "all" && !assignment.classIdSet.has(classId)) {
        return errorResponse(res, "You can only add questions for your assigned classes", 403);
      }
    }

    const [subjectSnap, classSnap, userSnap] = await Promise.all([
      db.collection(COLLECTIONS.SUBJECTS).doc(subjectId).get(),
      classId !== "all" ? db.collection(COLLECTIONS.CLASSES).doc(classId).get() : Promise.resolve(null),
      db.collection(COLLECTIONS.USERS).doc(uid).get(),
    ]);
    const subjectData = subjectSnap.exists ? subjectSnap.data() || {} : {};
    const classData = classSnap?.exists ? classSnap.data() || {} : {};
    const userData = userSnap.exists ? userSnap.data() || {} : {};

    const payload = {
      type: "mcq",
      subjectId,
      subjectName: trimText(subjectData.title || subjectData.name || subjectData.subjectName),
      classId,
      className: classId === "all" ? "All Classes" : trimText(classData.name),
      questionText,
      options: cleanOptions,
      correctAnswer,
      marks,
      status: "active",
      createdBy: uid,
      createdByRole: role,
      createdByName: trimText(userData.fullName || userData.name || userData.displayName),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      search: {
        subjectId,
        classId,
        subjectName: lowerText(subjectData.title || subjectData.name || subjectData.subjectName),
        className: lowerText(classData.name),
        questionText: lowerText(questionText),
      },
    };

    const ref = await db.collection(COLLECTIONS.QUESTION_BANK).add(payload);
    return successResponse(res, { id: ref.id }, "Question saved", 201);
  } catch (error) {
    console.error("createQuestionBankQuestion error:", error);
    return errorResponse(res, "Failed to create question", 500);
  }
};

export const getQuestionBankQuestions = async (req, res) => {
  try {
    const uid = trimText(req.user?.uid);
    const role = getActorRole(req);
    if (!uid) return errorResponse(res, "Missing user uid", 400);
    if (!(role === "admin" || role === "teacher")) {
      return errorResponse(res, "Access denied", 403);
    }

    const subjectId = trimText(req.query?.subjectId);
    const classId = trimText(req.query?.classId);
    const status = trimText(req.query?.status || "active");
    const limit = Math.max(1, Math.min(200, toPositiveNumber(req.query?.limit, 100)));

    let query = db.collection(COLLECTIONS.QUESTION_BANK);
    if (subjectId) query = query.where("subjectId", "==", subjectId);
    if (classId) query = query.where("classId", "==", classId);
    if (status) query = query.where("status", "==", status);

    if (!isAdminActor(req)) {
      query = query.where("createdBy", "==", uid);
    }

    const snap = await query.limit(limit).get();
    const rows = snap.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        type: trimText(data.type) || "mcq",
        subjectId: trimText(data.subjectId),
        subjectName: trimText(data.subjectName),
        classId: trimText(data.classId) || "all",
        className: trimText(data.className),
        questionText: trimText(data.questionText),
        options: Array.isArray(data.options) ? data.options : [],
        correctAnswer: trimText(data.correctAnswer),
        marks: toPositiveNumber(data.marks, 1),
        status: trimText(data.status) || "active",
        createdBy: trimText(data.createdBy),
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
      };
    });

    return successResponse(res, rows, "Question bank fetched");
  } catch (error) {
    console.error("getQuestionBankQuestions error:", error);
    return errorResponse(res, "Failed to fetch question bank", 500);
  }
};
