import { v4 as uuidv4 } from "uuid";
import { admin, db } from "../config/firebase.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const trimText = (value = "") => String(value || "").trim();
const lowerText = (value = "") => trimText(value).toLowerCase();
const INVALID_DISPLAY_VALUES = new Set(["nan", "undefined", "null", "-", "--"]);
const sanitizeDisplayText = (value, fallback = "") => {
  const text = trimText(value);
  if (!text) return fallback;
  return INVALID_DISPLAY_VALUES.has(lowerText(text)) ? fallback : text;
};
const normalizeVideoMode = (value) =>
  lowerText(value) === "live_session" ? "live_session" : "recorded";
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  if (typeof value?._seconds === "number") return new Date(value._seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const toIso = (value) => {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : null;
};
const PERMANENT_COMPLETION_MESSAGE =
  "This class or subject is completed. Your certificate is generated. Thank you for joining us. Keep exploring our other subjects and classes. Thank you.";
const isMarkedCompletedState = (row = {}) => {
  const normalizedStatus = lowerText(
    row?.status || row?.lifecycleStatus || row?.state || ""
  );
  if (["completed", "permanently_completed", "closed"].includes(normalizedStatus)) {
    return true;
  }
  return (
    row?.isCompleted === true ||
    row?.completed === true ||
    row?.permanentlyCompleted === true ||
    row?.completionLocked === true ||
    row?.lockedAfterCompletion === true ||
    row?.isLockedAfterCompletion === true
  );
};
const toMillis = (value) => {
  const parsed = toDate(value);
  return parsed ? parsed.getTime() : 0;
};
const sortByOrderThenCreated = (a = {}, b = {}) => {
  const orderDiff = toNumber(a.order, 0) - toNumber(b.order, 0);
  if (orderDiff !== 0) return orderDiff;
  return toMillis(a.createdAt) - toMillis(b.createdAt);
};

const parseDurationToSeconds = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value > 0 ? Math.round(value) : 0;
  const raw = trimText(value);
  if (!raw) return 0;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) return Math.round(numeric);
  const hhmmss = raw.match(/^(\d{1,2}):([0-5]?\d):([0-5]?\d)$/);
  if (hhmmss) {
    const h = Number(hhmmss[1]);
    const m = Number(hhmmss[2]);
    const s = Number(hhmmss[3]);
    return h * 3600 + m * 60 + s;
  }
  const mmss = raw.match(/^([0-5]?\d):([0-5]?\d)$/);
  if (mmss) {
    const m = Number(mmss[1]);
    const s = Number(mmss[2]);
    return m * 60 + s;
  }
  return 0;
};

const formatDurationLabel = (seconds) => {
  const safe = Math.max(0, Math.floor(toNumber(seconds, 0)));
  if (safe <= 0) return "N/A";
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const normalizeLectureVideoMeta = (lecture = {}) => ({
  videoUrl:
    trimText(lecture.videoUrl) ||
    trimText(lecture.streamUrl) ||
    trimText(lecture.playbackUrl) ||
    trimText(lecture.signedUrl) ||
    trimText(lecture.signedVideoUrl) ||
    trimText(lecture.videoSignedUrl) ||
    null,
  videoMode: normalizeVideoMode(lecture.videoMode),
  isLiveSession: Boolean(lecture.isLiveSession),
  videoTitle: sanitizeDisplayText(lecture.videoTitle) || null,
  premiereEndedAt: toIso(lecture.premiereEndedAt),
  videoDuration:
    lecture.videoDuration === null || lecture.videoDuration === undefined
      ? null
      : lecture.videoDuration,
});

const getCourseEnrollmentRows = async (studentId, courseId) => {
  const snap = await db.collection("enrollments").where("studentId", "==", studentId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ref: doc.ref, ...(doc.data() || {}) }))
    .filter((row) => trimText(row.subjectId || row.courseId) === courseId);
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const PK_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const toPkDateKey = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const clean = trimText(value);
    if (DATE_ONLY_RE.test(clean)) return clean;
  }
  const parsed = toDate(value);
  if (!parsed) return null;
  const parts = PK_DATE_PARTS_FORMATTER.formatToParts(parsed);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
};

const evaluateEnrollmentWindow = (row = {}) => {
  const startDateKey = toPkDateKey(row.classStartDate);
  const endDateKey = toPkDateKey(row.classEndDate);
  const todayKey = toPkDateKey(new Date());

  if (startDateKey && todayKey && todayKey < startDateKey) {
    return {
      allowed: false,
      code: "CLASS_NOT_STARTED",
      message: "Class has not started yet. Access opens on the class start date.",
      meta: {
        classStartDate: toIso(row.classStartDate),
        classEndDate: toIso(row.classEndDate),
        todayDatePk: todayKey,
      },
    };
  }

  if (endDateKey && todayKey && todayKey > endDateKey) {
    return {
      allowed: false,
      code: "CLASS_EXPIRED",
      message: "Class has ended. Learning access is closed.",
      meta: {
        classStartDate: toIso(row.classStartDate),
        classEndDate: toIso(row.classEndDate),
        todayDatePk: todayKey,
      },
    };
  }

  return { allowed: true, code: "", message: "", meta: {} };
};

const resolveClassStatusByWindow = (row = {}) => {
  const explicitStatus = lowerText(row.classStatus || "");
  if (["completed", "permanently_completed", "closed"].includes(explicitStatus)) {
    return "completed";
  }
  if (row.classMarkedCompleted === true || isMarkedCompletedState(row)) {
    return "completed";
  }
  const windowState = evaluateEnrollmentWindow(row);

  if (windowState.code === "CLASS_NOT_STARTED") return "upcoming";
  if (windowState.code === "CLASS_EXPIRED") return "expired";

  if (["active", "expired", "upcoming", "full"].includes(explicitStatus)) {
    return explicitStatus;
  }

  return "active";
};

const enrichEnrollmentRowsWithClassWindow = async (rows = []) => {
  const classIds = [...new Set(rows.map((row) => trimText(row.classId)).filter(Boolean))];
  if (!classIds.length) return rows;

  const classSnaps = await Promise.all(
    classIds.map(async (classId) => {
      try {
        const snap = await db.collection("classes").doc(classId).get();
        return {
          classId,
          classData: snap.exists ? snap.data() || {} : {},
        };
      } catch {
        return { classId, classData: {} };
      }
    })
  );

  const classMap = classSnaps.reduce((acc, row) => {
    acc[row.classId] = row.classData || {};
    return acc;
  }, {});

  return rows.map((row) => {
    const classId = trimText(row.classId);
    const classData = classMap[classId] || {};
    const classMarkedCompleted = isMarkedCompletedState(classData);
    const classStartDate =
      classData.startDate ||
      classData.classStartDate ||
      row.classStartDate ||
      row.startDate ||
      null;
    const classEndDate =
      classData.endDate ||
      classData.classEndDate ||
      row.classEndDate ||
      row.endDate ||
      null;
    const classStatus = resolveClassStatusByWindow({
      classStatus: lowerText(row.classStatus || classData.status || ""),
      classMarkedCompleted,
      classStartDate,
      classEndDate,
    });

    return {
      ...row,
      classStartDate,
      classEndDate,
      classStatus,
      classMarkedCompleted,
      classCompletionMessage: classMarkedCompleted
        ? PERMANENT_COMPLETION_MESSAGE
        : "",
    };
  });
};

const ensureStudentEnrolled = async (studentId, courseId) => {
  const rows = await getCourseEnrollmentRows(studentId, courseId);
  const eligibleRows = rows.filter((row) =>
    ["active", "completed", "upcoming", "pending_review", "pending_completion_review", ""].includes(
      lowerText(row.status || "active")
    )
  );
  if (!eligibleRows.length) return { enrolled: false, rows: [] };
  const enrichedRows = await enrichEnrollmentRowsWithClassWindow(eligibleRows);
  const classLinkedRows = enrichedRows.filter((row) => Boolean(trimText(row.classId)));
  const candidateRows = classLinkedRows.length > 0 ? classLinkedRows : enrichedRows;

  const checks = candidateRows.map((row) => {
    const status = lowerText(row.status || "active");
    const windowState = evaluateEnrollmentWindow(row);

    if (
      status === "completed" ||
      lowerText(row.classStatus || "") === "completed" ||
      row.classMarkedCompleted === true
    ) {
      return {
        row,
        allowed: false,
        code: "CLASS_COMPLETED",
        message: row.classCompletionMessage || PERMANENT_COMPLETION_MESSAGE,
        meta: {
          classStartDate: toIso(row.classStartDate),
          classEndDate: toIso(row.classEndDate),
          classId: trimText(row.classId),
        },
      };
    }

    if (
      (status === "upcoming" || row.classStatus === "upcoming") &&
      windowState.code === "CLASS_NOT_STARTED"
    ) {
      return {
        row,
        allowed: false,
        code: "CLASS_NOT_STARTED",
        message: "Class has not started yet. Access opens on the class start date.",
        meta: {
          classStartDate: toIso(row.classStartDate),
          classEndDate: toIso(row.classEndDate),
          todayDatePk: toPkDateKey(new Date()),
        },
      };
    }

    if (
      ["pending_review", "awaiting_payment", "awaiting_receipt", "pending_verification"].includes(
        status
      )
    ) {
      return {
        row,
        allowed: false,
        code: "PAYMENT_PENDING",
        message: "Payment verification is pending. Learning access will open after approval.",
        meta: {},
      };
    }

    return { row, ...windowState };
  });

  const learningRows = checks.filter((item) => item.allowed).map((item) => item.row);
  if (learningRows.length > 0) {
    return { enrolled: true, rows: learningRows };
  }

  const preferredError =
    checks.find((item) => item.code === "PAYMENT_PENDING") ||
    checks.find((item) => item.code === "CLASS_COMPLETED") ||
    checks.find((item) => item.code === "CLASS_NOT_STARTED") ||
    checks.find((item) => item.code === "CLASS_EXPIRED") ||
    checks[0];

  return {
    enrolled: true,
    rows: candidateRows,
    accessDenied: true,
    error: preferredError?.message || "Learning access is not available for this class.",
    status: 403,
    code: preferredError?.code || "ACCESS_DENIED",
    meta: preferredError?.meta || {},
  };
};

const getCourseChapters = async (courseId) => {
  const byCourseSnap = await db.collection("chapters").where("courseId", "==", courseId).get();
  const bySubjectSnap = await db.collection("chapters").where("subjectId", "==", courseId).get();
  return [...byCourseSnap.docs, ...bySubjectSnap.docs]
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(
      (row, index, arr) => arr.findIndex((entry) => trimText(entry.id) === trimText(row.id)) === index
    )
    .sort(sortByOrderThenCreated);
};

const getCourseLectures = async (courseId, chapterIds = []) => {
  const [byCourseSnap, bySubjectSnap] = await Promise.all([
    db.collection("lectures").where("courseId", "==", courseId).get(),
    db.collection("lectures").where("subjectId", "==", courseId).get(),
  ]);
  const byCourseRows = [...byCourseSnap.docs, ...bySubjectSnap.docs]
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(
      (row, index, arr) => arr.findIndex((entry) => trimText(entry.id) === trimText(row.id)) === index
    );
  if (byCourseRows.length > 0) return byCourseRows;

  if (!chapterIds.length) return [];

  const chunks = [];
  for (let index = 0; index < chapterIds.length; index += 10) {
    chunks.push(chapterIds.slice(index, index + 10));
  }

  const snaps = await Promise.all(
    chunks.map((ids) => db.collection("lectures").where("chapterId", "in", ids).get())
  );
  return snaps.flatMap((snap) => snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })));
};

const getCourseQuizzes = async (courseId) => {
  const [byCourseSnap, bySubjectSnap] = await Promise.all([
    db.collection("quizzes").where("courseId", "==", courseId).get(),
    db.collection("quizzes").where("subjectId", "==", courseId).get(),
  ]);
  return [...byCourseSnap.docs, ...bySubjectSnap.docs]
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(
      (row, index, arr) => arr.findIndex((entry) => trimText(entry.id) === trimText(row.id)) === index
    )
    .filter((row) => !["draft", "inactive", "deleted", "archived"].includes(lowerText(row.status)))
    .sort(sortByOrderThenCreated);
};

const uniqueById = (rows = []) => {
  const seen = new Set();
  const out = [];
  rows.forEach((row) => {
    const id = trimText(row?.id);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(row);
  });
  return out;
};

const getStudentProgressRows = async (studentId, lectureIdSet = new Set(), courseId = "") => {
  const cleanCourseId = trimText(courseId);
  if (!cleanCourseId) return [];

  // IMPORTANT (billing):
  // Never read the whole progress collection for a student. Always scope to this courseId/subjectId.
  const [byCourseSnap, bySubjectSnap] = await Promise.all([
    db
      .collection("progress")
      .where("studentId", "==", studentId)
      .where("courseId", "==", cleanCourseId)
      .get()
      .catch(() => ({ docs: [] })),
    db
      .collection("progress")
      .where("studentId", "==", studentId)
      .where("subjectId", "==", cleanCourseId)
      .get()
      .catch(() => ({ docs: [] })),
  ]);

  const rows = [...byCourseSnap.docs, ...bySubjectSnap.docs].map((doc) => ({
    id: doc.id,
    ref: doc.ref,
    ...(doc.data() || {}),
  }));

  const filtered = rows.filter((row) => {
    const rowLectureId = trimText(row.lectureId);
    if (!rowLectureId) return false;
    if (lectureIdSet.size && !lectureIdSet.has(rowLectureId)) return false;
    return true;
  });

  return uniqueById(filtered);
};

const getStudentQuizResultRows = async (studentId, courseId = "", quizIdSet = new Set()) => {
  const cleanCourseId = trimText(courseId);
  if (!cleanCourseId) return [];

  const [byCourseSnap, bySubjectSnap] = await Promise.all([
    db
      .collection("quizResults")
      .where("studentId", "==", studentId)
      .where("courseId", "==", cleanCourseId)
      .get()
      .catch(() => ({ docs: [] })),
    db
      .collection("quizResults")
      .where("studentId", "==", studentId)
      .where("subjectId", "==", cleanCourseId)
      .get()
      .catch(() => ({ docs: [] })),
  ]);

  const rows = [...byCourseSnap.docs, ...bySubjectSnap.docs]
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((row) => {
      const rowQuizId = trimText(row.quizId);
      if (!rowQuizId) return false;
      if (quizIdSet.size && !quizIdSet.has(rowQuizId)) return false;
      return true;
    });

  return uniqueById(rows);
};

const getStudentVideoAccessRows = async (studentId, courseId = "", lectureIdSet = new Set()) => {
  const cleanCourseId = trimText(courseId);
  if (!cleanCourseId) return [];

  const [byCourseSnap, bySubjectSnap] = await Promise.all([
    db
      .collection("videoAccess")
      .where("studentId", "==", studentId)
      .where("courseId", "==", cleanCourseId)
      .get()
      .catch(() => ({ docs: [] })),
    db
      .collection("videoAccess")
      .where("studentId", "==", studentId)
      .where("subjectId", "==", cleanCourseId)
      .get()
      .catch(() => ({ docs: [] })),
  ]);

  const rows = [...byCourseSnap.docs, ...bySubjectSnap.docs]
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((row) => {
      const lectureId = trimText(row.lectureId);
      if (!lectureId) return false;
      if (lectureIdSet.size && !lectureIdSet.has(lectureId)) return false;
      return true;
    });

  return uniqueById(rows);
};

const buildProgressMap = (progressRows = []) => {
  const map = {};
  progressRows.forEach((row) => {
    const lectureId = trimText(row.lectureId);
    if (!lectureId) return;
    const resumeAtSeconds = Math.max(
      toNumber(map[lectureId]?.resumeAtSeconds, 0),
      toNumber(
        row.currentTimeSec ??
          row.resumeAtSeconds ??
          row.lastPositionSec ??
          row.playbackPositionSec,
        0
      )
    );
    const durationSec = Math.max(
      toNumber(map[lectureId]?.durationSec, 0),
      toNumber(
        row.durationSec ?? row.videoDurationSec ?? row.totalDurationSec,
        0
      )
    );
    const watchedPercent = Math.max(
      toNumber(map[lectureId]?.watchedPercent, 0),
      toNumber(row.watchedPercent ?? row.progress ?? row.progressPercent, 0)
    );
    const isCompleted =
      Boolean(row.isCompleted || row.completed) ||
      toNumber(row.progress, 0) >= 100 ||
      toNumber(row.progressPercent, 0) >= 100 ||
      toNumber(row.completionPercent, 0) >= 100;
    map[lectureId] = {
      isCompleted,
      completedAt: toIso(row.completedAt),
      watchedPercent,
      resumeAtSeconds: isCompleted ? Math.max(resumeAtSeconds, durationSec) : resumeAtSeconds,
      durationSec,
    };
  });
  return map;
};

const buildQuizResultsMap = (quizRows = []) => {
  const map = {};
  quizRows.forEach((row) => {
    const quizId = trimText(row.quizId);
    if (!quizId) return;
    const rowMs = Math.max(toMillis(row.submittedAt), toMillis(row.createdAt));
    const existingMs = Math.max(
      toMillis(map[quizId]?.submittedAt),
      toMillis(map[quizId]?.createdAt)
    );
    if (!map[quizId] || rowMs >= existingMs) {
      const autoScore = toNumber(row.autoScore, toNumber(row.totalScore, 0));
      const totalMarks = Math.max(0, toNumber(row.totalMarks, 0));
      const percentage = toNumber(
        row.percentage,
        toNumber(row.scorePercent, totalMarks > 0 ? (autoScore / totalMarks) * 100 : 0)
      );
      map[quizId] = {
        resultId: row.id,
        score: autoScore,
        total: totalMarks,
        percentage: Math.max(0, Math.min(100, percentage)),
        isPassed: Boolean(row.isPassed),
        status: lowerText(row.status || "completed"),
        submittedAt: row.submittedAt || row.createdAt || null,
        createdAt: row.createdAt || null,
      };
    }
  });
  return map;
};

const buildVideoAccessMap = (rows = []) => {
  const map = {};
  rows.forEach((row) => {
    const lectureId = trimText(row.lectureId);
    if (!lectureId) return;
    const hasAccess = row.hasAccess !== false;
    const rowTs = Math.max(toMillis(row.updatedAt), toMillis(row.grantedAt), toMillis(row.createdAt));
    const existing = map[lectureId];
    const existingTs = existing
      ? Math.max(toMillis(existing.updatedAt), toMillis(existing.grantedAt), toMillis(existing.createdAt))
      : -1;
    if (!existing || rowTs >= existingTs) {
      map[lectureId] = {
        hasAccess,
        grantedAt: row.grantedAt || null,
        updatedAt: row.updatedAt || null,
        createdAt: row.createdAt || null,
        grantedBy: trimText(row.grantedBy),
      };
      return;
    }
    map[lectureId] = existing;
  });
  return map;
};

const toChapterLectureList = (lectures = [], chapterId = "") =>
  lectures
    .filter((lecture) => trimText(lecture.chapterId) === chapterId)
    .sort(sortByOrderThenCreated);

const toChapterQuizList = (quizzes = [], chapterId = "") =>
  quizzes.filter((quiz) => {
    const quizChapterId = trimText(quiz.chapterId);
    const scope = lowerText(quiz.scope || "");
    if (!quizChapterId) return false;
    if (quizChapterId !== chapterId) return false;
    return scope === "chapter" || !scope;
  });

const toSubjectQuizList = (quizzes = []) =>
  quizzes.filter((quiz) => {
    const scope = lowerText(quiz.scope || "");
    const hasChapter = Boolean(trimText(quiz.chapterId));
    return scope === "subject" || !hasChapter;
  });

export const buildCourseContentForStudent = async (
  studentId,
  courseId,
  options = {}
) => {
  const { ignoreAccessWindow = false } = options;
  const cleanCourseId = trimText(courseId);
  const [subjectSnap, courseSnap] = await Promise.all([
    db.collection("subjects").doc(cleanCourseId).get(),
    db.collection("courses").doc(cleanCourseId).get(),
  ]);
  const contentSnap = subjectSnap.exists ? subjectSnap : courseSnap;
  if (!contentSnap.exists) {
    return { error: "Subject not found", status: 404 };
  }

  const enrollmentState = await ensureStudentEnrolled(studentId, cleanCourseId);
  if (!enrollmentState.enrolled) {
    return { error: "Not enrolled in this course", status: 403 };
  }
  if (enrollmentState.accessDenied && !ignoreAccessWindow) {
    return {
      error: enrollmentState.error || "Learning access is currently unavailable.",
      status: enrollmentState.status || 403,
      code: enrollmentState.code || "ACCESS_DENIED",
      meta: enrollmentState.meta || {},
    };
  }

  const chapters = await getCourseChapters(cleanCourseId);
  const chapterIds = chapters.map((chapter) => chapter.id);
  const lectures = await getCourseLectures(cleanCourseId, chapterIds);
  const lectureIds = new Set(lectures.map((lecture) => trimText(lecture.id)).filter(Boolean));
  const quizzes = await getCourseQuizzes(cleanCourseId);
  const quizIds = new Set(quizzes.map((quiz) => trimText(quiz.id)).filter(Boolean));

  const [progressRows, quizResultsRows, accessRows] = await Promise.all([
    getStudentProgressRows(studentId, lectureIds, cleanCourseId),
    getStudentQuizResultRows(studentId, cleanCourseId, quizIds),
    getStudentVideoAccessRows(studentId, cleanCourseId, lectureIds),
  ]);

  const progressMap = buildProgressMap(progressRows);
  const quizResultsMap = buildQuizResultsMap(quizResultsRows);
  const videoAccessMap = buildVideoAccessMap(accessRows);

  const enrollmentCompleted = enrollmentState.rows.some(
    (row) => lowerText(row.status || "active") === "completed"
  );
  const adminCompletedEnrollment = enrollmentState.rows.some(
    (row) =>
      lowerText(row.status || "active") === "completed" &&
      lowerText(row.completionApprovedRole || "") === "admin"
  );
  const subjectPermanentlyCompleted = isMarkedCompletedState(contentSnap.data() || {});
  const classPermanentlyCompleted = enrollmentState.rows.some(
    (row) =>
      row.classMarkedCompleted === true ||
      lowerText(row.classStatus || "") === "completed"
  );
  const permanentlyCompleted =
    subjectPermanentlyCompleted ||
    classPermanentlyCompleted ||
    adminCompletedEnrollment;
  const completionLockMessage = permanentlyCompleted
    ? PERMANENT_COMPLETION_MESSAGE
    : "Course completed. Contact teacher to rewatch.";
  const accessDeniedCode = trimText(enrollmentState.code);
  const isPaymentLockedByState = accessDeniedCode === "PAYMENT_PENDING";
  const isClassNotStarted = accessDeniedCode === "CLASS_NOT_STARTED";
  const isClassEnded = accessDeniedCode === "CLASS_EXPIRED";
  const isClassLockedByState = isClassNotStarted || isClassEnded;
  const classLockReason = isClassNotStarted
    ? "Class has not started yet"
    : isClassEnded
      ? "Class has ended"
      : "";
  const nowMs = Date.now();

  const chapterRows = [];
  let previousChapterComplete = true;

  chapters.forEach((chapter) => {
    const chapterLectures = toChapterLectureList(lectures, chapter.id);
    const chapterQuizzes = toChapterQuizList(quizzes, chapter.id);

    const lecturesWithStatus = [];
    let previousLectureCompleted = previousChapterComplete;

    chapterLectures.forEach((lecture, index) => {
      const lectureId = trimText(lecture.id);
      const lectureProgress = progressMap[lectureId] || {};
      const isCompleted = Boolean(lectureProgress.isCompleted);
      const configuredVideoMode = normalizeVideoMode(lecture.videoMode);
      const isLiveConfigured =
        Boolean(lecture.isLiveSession) || configuredVideoMode === "live_session";
      const premiereEndedAt = toIso(lecture.premiereEndedAt);
      const isPremiereLive = isLiveConfigured && !premiereEndedAt;
      const lectureDurationSec = Math.max(
        0,
        parseDurationToSeconds(
          lecture.durationSec ??
            lecture.videoDurationSec ??
            lecture.videoDuration ??
            lecture.duration
        )
      );
      const explicitDurationLabel =
        sanitizeDisplayText(lecture.durationLabel) ||
        sanitizeDisplayText(typeof lecture.duration === "string" ? lecture.duration : "") ||
        sanitizeDisplayText(typeof lecture.videoDuration === "string" ? lecture.videoDuration : "");
      const durationLabel = isPremiereLive
        ? "Live"
        : explicitDurationLabel || formatDurationLabel(lectureDurationSec);
      const watchedPercent = Math.max(
        0,
        Math.min(100, toNumber(lectureProgress.watchedPercent, 0))
      );
      const videoAccessMeta = videoAccessMap[lectureId] || null;
      const manualAccess = Boolean(videoAccessMeta?.hasAccess === true);
      const manualLock = Boolean(videoAccessMeta?.hasAccess === false);
      const lectureVideoMeta = normalizeLectureVideoMeta(lecture);
      const hasVideoSource = Boolean(trimText(lectureVideoMeta.videoUrl));

      // Product requirement:
      // Do not lock lectures based on sequential progress (previous lecture/chapter completion).
      // Only lock when payment/class completion/manual lock/missing video/live session rules apply.
      const progressLocked = false;
      const progressLockReason = "";
      const completionLocked = false;
      const completedLectureLocked = false;
      const missingVideoLocked = !hasVideoSource;
      const livePremiereLocked = isPremiereLive;
      const permanentlyLocked = permanentlyCompleted;
      const globalLock =
        Boolean(
          lecture.isLocked === true ||
          lecture.locked === true ||
          lecture.isLockedByAdmin === true ||
          lecture.isLockedByTeacher === true
        );

      let isLocked = false;
      let lockReason = "";
      if (isPaymentLockedByState) {
        isLocked = true;
        lockReason = "Payment verification is pending";
      } else if (permanentlyLocked) {
        isLocked = true;
        lockReason = completionLockMessage;
      } else if (isClassLockedByState) {
        isLocked = true;
        lockReason = classLockReason;
      } else if (manualLock || globalLock) {
        isLocked = true;
        lockReason = "Locked by teacher/admin";
      } else if (livePremiereLocked) {
        isLocked = true;
        lockReason = "This is a scheduled live session. Join it from the Live page during class time.";
      } else if (missingVideoLocked) {
        isLocked = true;
        lockReason = "Lecture video is not uploaded yet";
      } else if (progressLocked) {
        isLocked = true;
        lockReason = progressLockReason;
      }

      const unlocked = !isLocked;
      const unlockedAtIso = toIso(videoAccessMeta?.updatedAt || videoAccessMeta?.grantedAt);
      const unlockedBy = trimText(videoAccessMeta?.grantedBy) || null;
      const rewatchAllowed = enrollmentCompleted && manualAccess && !permanentlyCompleted;
      const videoTitle = sanitizeDisplayText(lecture.videoTitle) || null;
      const videoDuration = isPremiereLive
        ? "Live"
        : explicitDurationLabel || (lectureDurationSec > 0 ? formatDurationLabel(lectureDurationSec) : null);

      lecturesWithStatus.push({
        id: lectureId,
        lectureId,
        chapterId: trimText(lecture.chapterId),
        courseId: cleanCourseId,
        title:
          sanitizeDisplayText(lecture.title) ||
          sanitizeDisplayText(lecture.videoTitle) ||
          "Lecture",
        order: toNumber(lecture.order, 0),
        duration: durationLabel,
        durationLabel,
        ...lectureVideoMeta,
        videoTitle,
        videoDuration,
        pdfNotes: Array.isArray(lecture.pdfNotes) ? lecture.pdfNotes : [],
        books: Array.isArray(lecture.books) ? lecture.books : [],
        notes: sanitizeDisplayText(lecture.notes || lecture.description),
        isCompleted,
        completedAt: lectureProgress.completedAt || null,
        watchedPercent,
        resumeAtSeconds: Math.max(0, toNumber(lectureProgress.resumeAtSeconds, 0)),
        durationSec: Math.max(
          lectureDurationSec,
          toNumber(lectureProgress.durationSec, 0)
        ),
        isPremiereLive,
        livePlaybackMode: isPremiereLive ? "live" : "recorded",
        disableSeeking: isPremiereLive,
        isLocked,
        lockReason,
        unlocked,
        access: {
          canWatch: unlocked,
          canSeekForward: false,
          isPaymentLocked: isPaymentLockedByState,
          isProgressLocked:
            (progressLocked || completedLectureLocked) &&
            !isPaymentLockedByState &&
            !isClassLockedByState &&
            !permanentlyLocked,
          isClassLocked: isClassLockedByState || classPermanentlyCompleted,
          isCompletionLocked:
            (completionLocked || permanentlyLocked) &&
            !isPaymentLockedByState &&
            !isClassLockedByState,
          isLiveLocked: livePremiereLocked,
          manuallyUnlocked: manualAccess && !permanentlyLocked,
        },
        lockAfterCompletion: false,
        rewatch: {
          isAllowed: true,
          unlockedByTeacher: rewatchAllowed,
          unlockedAt: rewatchAllowed ? unlockedAtIso : null,
          unlockedBy: rewatchAllowed ? unlockedBy : null,
        },
        manuallyUnlocked: manualAccess && !permanentlyLocked,
      });

      previousLectureCompleted = isCompleted;
    });

    const allLecturesDone =
      lecturesWithStatus.length > 0 && lecturesWithStatus.every((lecture) => lecture.isCompleted);
    const quizzesWithStatus = chapterQuizzes.map((quiz) => {
      const quizId = trimText(quiz.id);
      const result = quizResultsMap[quizId] || null;
      const dueAtDate = toDate(quiz.dueAt || quiz.assignmentDueAt || null);
      const dueAt = dueAtDate ? dueAtDate.toISOString() : null;
      const isExpired = Boolean(dueAtDate && dueAtDate.getTime() < nowMs && !result);
      // Quizzes are attemptable even if previous videos are not completed (per product requirement).
      const quizLocked =
        isExpired ||
        isPaymentLockedByState ||
        isClassLockedByState ||
        permanentlyCompleted;
      return {
        id: quizId,
        quizId,
        title: sanitizeDisplayText(quiz.title) || "Chapter Quiz",
        chapterId: trimText(quiz.chapterId),
        scope: lowerText(quiz.scope || "chapter"),
        passScore: toNumber(quiz.passScore, 50),
        isLocked: quizLocked,
        lockReason: isPaymentLockedByState
          ? "Payment verification is pending"
          : permanentlyCompleted
            ? completionLockMessage
          : isClassLockedByState
            ? classLockReason
            : isExpired
              ? "Quiz deadline has passed"
              : quizLocked
                ? "Complete all chapter videos to unlock quiz"
                : "",
        dueAt,
        isExpired,
        result,
        isAttempted: Boolean(result),
        isPassed: Boolean(result?.isPassed),
      };
    });

    const allQuizzesPassed =
      quizzesWithStatus.length === 0 || quizzesWithStatus.every((quiz) => quiz.isPassed);
    const isChapterComplete = allLecturesDone && allQuizzesPassed;

    previousChapterComplete = isChapterComplete;

    chapterRows.push({
      id: trimText(chapter.id),
      chapterId: trimText(chapter.id),
      title: sanitizeDisplayText(chapter.title) || "Chapter",
      order: toNumber(chapter.order, 0),
      lectures: lecturesWithStatus,
      quizzes: quizzesWithStatus,
      allLecturesDone,
      isChapterComplete,
      completedLectures: lecturesWithStatus.filter((lecture) => lecture.isCompleted).length,
      totalLectures: lecturesWithStatus.length,
    });
  });

  const allChaptersComplete =
    chapterRows.length > 0 && chapterRows.every((chapter) => chapter.isChapterComplete);
  const subjectQuizzes = toSubjectQuizList(quizzes).map((quiz) => {
    const quizId = trimText(quiz.id);
    const result = quizResultsMap[quizId] || null;
    const dueAtDate = toDate(quiz.dueAt || quiz.assignmentDueAt || null);
    const dueAt = dueAtDate ? dueAtDate.toISOString() : null;
    const isExpired = Boolean(dueAtDate && dueAtDate.getTime() < nowMs && !result);
    // Quizzes are attemptable even if previous chapters are not completed (per product requirement).
    const quizLocked =
      isExpired ||
      isPaymentLockedByState ||
      isClassLockedByState ||
      permanentlyCompleted;
    return {
      id: quizId,
      quizId,
      title: sanitizeDisplayText(quiz.title) || "Final Quiz",
      scope: lowerText(quiz.scope || "subject"),
      isLocked: quizLocked,
      lockReason: isPaymentLockedByState
        ? "Payment verification is pending"
        : permanentlyCompleted
          ? completionLockMessage
        : isClassLockedByState
          ? classLockReason
          : isExpired
            ? "Quiz deadline has passed"
            : quizLocked
              ? "Complete all chapters to unlock final quiz"
              : "",
      dueAt,
      isExpired,
      result,
      isAttempted: Boolean(result),
      isPassed: Boolean(result?.isPassed),
    };
  });

  const allLecturesFlat = chapterRows.flatMap((chapter) => chapter.lectures || []);
  const totalLectures = allLecturesFlat.length;
  const completedLectures = allLecturesFlat.filter((lecture) => lecture.isCompleted).length;
  const watchedScore = allLecturesFlat.reduce((sum, lecture) => {
    if (lecture.isCompleted) return sum + 100;
    return sum + Math.max(0, Math.min(100, toNumber(lecture.watchedPercent, 0)));
  }, 0);
  const overallProgress =
    totalLectures > 0 ? Math.round(watchedScore / totalLectures) : 0;

  const allQuizzes = [
    ...chapterRows.flatMap((chapter) => chapter.quizzes),
    ...subjectQuizzes,
  ];
  const allQuizzesPassed = allQuizzes.length === 0 || allQuizzes.every((quiz) => quiz.isPassed);
  const fullyCompleted =
    (totalLectures === 0 ? false : completedLectures >= totalLectures) && allQuizzesPassed;

  return {
    course: { id: cleanCourseId, ...(contentSnap.data() || {}) },
    subject: { id: cleanCourseId, ...(contentSnap.data() || {}) },
    enrollmentRows: enrollmentState.rows,
    isCourseCompleted: enrollmentCompleted || permanentlyCompleted,
    isPermanentlyCompleted: permanentlyCompleted,
    completionLockMessage,
    fullyCompleted,
    overallProgress,
    totalLectures,
    completedLectures,
    chapters: chapterRows,
    subjectQuizzes,
    progressMap,
  };
};

const ensureTeacherCanManageCourse = async (requesterRole, requesterId, courseId) => {
  if (requesterRole === "admin") return { allowed: true };
  const [subjectSnap, courseSnap] = await Promise.all([
    db.collection("subjects").doc(courseId).get(),
    db.collection("courses").doc(courseId).get(),
  ]);
  const contentSnap = subjectSnap.exists ? subjectSnap : courseSnap;
  if (!contentSnap.exists) {
    return { allowed: false, status: 404, error: "Subject not found" };
  }
  const courseData = contentSnap.data() || {};

  const directMatch = trimText(courseData.teacherId) === requesterId;
  const teacherIds = Array.isArray(courseData.teacherIds) ? courseData.teacherIds : [];
  const teachers = Array.isArray(courseData.teachers) ? courseData.teachers : [];
  const teachersMatch =
    teacherIds.some((row) => trimText(row) === requesterId) ||
    teachers.some(
      (row) => trimText(row?.teacherId || row?.id || row?.uid) === requesterId
    ) ||
    (Array.isArray(courseData.assignedTeacherIds)
      ? courseData.assignedTeacherIds.some((row) => trimText(row) === requesterId)
      : false);
  const subjectMatch = Array.isArray(courseData.subjects)
    ? courseData.subjects.some((row) => {
        if (trimText(row?.teacherId) === requesterId) return true;
        const rowTeacherIds = Array.isArray(row?.teacherIds) ? row.teacherIds : [];
        if (rowTeacherIds.some((id) => trimText(id) === requesterId)) return true;
        const rowTeachers = Array.isArray(row?.teachers) ? row.teachers : [];
        return rowTeachers.some(
          (t) => trimText(t?.teacherId || t?.id || t?.uid) === requesterId
        );
      })
    : false;

  if (directMatch || subjectMatch || teachersMatch) {
    return { allowed: true, courseData };
  }
  return {
    allowed: false,
    status: 403,
    error: "You are not assigned to this course",
  };
};

const upsertStudentProgressRow = async ({
  studentId,
  courseId,
  lectureId,
  markCompleted = false,
  watchedPercent = null,
  currentTimeSec = null,
  durationSec = null,
}) => {
  const normalizedDuration = Math.max(0, toNumber(durationSec, 0));
  const normalizedCurrentTimeRaw = Math.max(0, toNumber(currentTimeSec, 0));
  const normalizedCurrentTime =
    normalizedDuration > 0
      ? Math.min(normalizedCurrentTimeRaw, normalizedDuration)
      : normalizedCurrentTimeRaw;
  const snap = await db.collection("progress").where("studentId", "==", studentId).get();
  const existing = snap.docs.find((doc) => {
    const row = doc.data() || {};
    if (trimText(row.lectureId) !== lectureId) return false;
    const rowCourseId = trimText(row.subjectId || row.courseId);
    return !rowCourseId || rowCourseId === courseId;
  });

  if (!existing) {
    const createdWatchedPercent = markCompleted
      ? 100
      : Math.max(0, toNumber(watchedPercent, 0));
    const createdCurrentTime = markCompleted
      ? normalizedDuration
      : normalizedCurrentTime;
    const payload = {
      studentId,
      subjectId: courseId,
      courseId,
      lectureId,
      isCompleted: Boolean(markCompleted),
      watchedPercent: createdWatchedPercent,
      currentTimeSec: Math.max(0, createdCurrentTime),
      durationSec: normalizedDuration,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (markCompleted) payload.completedAt = serverTimestamp();
    await db.collection("progress").add(payload);
    return;
  }

  const existingRow = existing.data() || {};
  const existingCurrentTime = Math.max(
    0,
    toNumber(
      existingRow.currentTimeSec ??
        existingRow.resumeAtSeconds ??
        existingRow.lastPositionSec,
      0
    )
  );
  const existingDuration = Math.max(
    0,
    toNumber(existingRow.durationSec ?? existingRow.videoDurationSec, 0)
  );
  const updatePayload = { updatedAt: serverTimestamp() };
  if (markCompleted) {
    updatePayload.isCompleted = true;
    updatePayload.watchedPercent = 100;
    updatePayload.durationSec = Math.max(existingDuration, normalizedDuration);
    updatePayload.currentTimeSec = Math.max(
      existingCurrentTime,
      updatePayload.durationSec
    );
    updatePayload.completedAt = serverTimestamp();
  } else if (!existingRow.isCompleted) {
    updatePayload.watchedPercent = Math.max(
      toNumber(existingRow.watchedPercent ?? existingRow.progress ?? existingRow.progressPercent, 0),
      Math.max(0, toNumber(watchedPercent, 0))
    );
    updatePayload.durationSec = Math.max(existingDuration, normalizedDuration);
    updatePayload.currentTimeSec = Math.max(existingCurrentTime, normalizedCurrentTime);
  }
  await existing.ref.set(updatePayload, { merge: true });
};

const ensureCertificateForCourse = async (
  studentId,
  courseId,
  courseData = {},
  classContext = null
) => {
  const certSnap = await db
    .collection("certificates")
    .where("studentId", "==", studentId)
    .get();
  const existing = certSnap.docs.find((doc) => {
    const row = doc.data() || {};
    return (
      trimText(row.subjectId || row.courseId) === courseId ||
      trimText(row.courseId) === courseId
    );
  });
  if (existing) {
    return { created: false, certId: trimText(existing.data()?.certId) };
  }

  const [studentSnap, userSnap] = await Promise.all([
    db.collection("students").doc(studentId).get(),
    db.collection("users").doc(studentId).get(),
  ]);
  const studentData = studentSnap.exists ? studentSnap.data() || {} : {};
  const userData = userSnap.exists ? userSnap.data() || {} : {};

  const certId = `SUM-${new Date().getFullYear()}-${uuidv4().toUpperCase().slice(0, 8)}`;
  const studentName =
    trimText(studentData.fullName) ||
    trimText(studentData.name) ||
    trimText(userData.fullName) ||
    trimText(userData.name) ||
    trimText(userData.email).split("@")[0] ||
    "Student";
  const courseName = trimText(courseData.title) || "Subject";
  const className = trimText(classContext?.className);
  const batchCode = trimText(classContext?.batchCode);
  const classId = trimText(classContext?.classId);
  const completionScope = className ? "class" : "course";
  const completionTitle = className
    ? [className, batchCode ? `(${batchCode})` : "", courseName ? `- ${courseName}` : ""]
        .filter(Boolean)
        .join(" ")
    : courseName;

  await db.collection("certificates").add({
    studentId,
    studentName,
    subjectId: courseId,
    courseId,
    courseName,
    classId: classId || null,
    className: className || null,
    batchCode: batchCode || null,
    completionScope,
    completionTitle,
    certId,
    verificationUrl: `https://sumacademy.net/verify/${certId}`,
    isRevoked: false,
    issuedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (studentSnap.exists) {
    await studentSnap.ref.set(
      {
        certificates: admin.firestore.FieldValue.arrayUnion({
          certId,
          subjectId: courseId,
          courseId,
          courseName,
          classId: classId || null,
          className: className || null,
          batchCode: batchCode || null,
          completionScope,
          completionTitle,
          issuedAt: new Date().toISOString(),
        }),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return { created: true, certId };
};

export const getCourseContent = async (req, res) => {
  try {
    const courseId = trimText(req.params?.courseId || req.params?.subjectId);
    const studentId = trimText(req.user?.uid);

    if (!courseId) return errorResponse(res, "subjectId/courseId is required", 400);
    if (!studentId) return errorResponse(res, "Missing student uid", 400);

    const built = await buildCourseContentForStudent(studentId, courseId, {
      ignoreAccessWindow: true,
    });
    if (built.error) {
      return errorResponse(res, built.error, built.status || 400, {
        ...(built.meta || {}),
        ...(built.code ? { code: built.code } : {}),
      });
    }

    return successResponse(
      res,
      {
        subjectId: courseId,
        subjectName: trimText(built.course.title) || "Subject",
        courseId,
        courseName: trimText(built.course.title) || "Course",
        courseDescription:
          trimText(built.course.shortDescription) ||
          trimText(built.course.description) ||
          "",
        teacherName: trimText(built.course.teacherName) || "Teacher",
        isCourseCompleted: Boolean(built.isCourseCompleted),
        isPermanentlyCompleted: Boolean(built.isPermanentlyCompleted),
        completionMessage: built.completionLockMessage || "",
        overallProgress: Math.max(0, Math.min(100, toNumber(built.overallProgress, 0))),
        totalLectures: built.totalLectures,
        completedLectures: built.completedLectures,
        chapters: built.chapters,
        subjectQuizzes: built.subjectQuizzes,
      },
      "Subject content fetched"
    );
  } catch (error) {
    console.error("getCourseContent error:", error);
    return errorResponse(res, "Failed to fetch course content", 500);
  }
};
export const markLectureComplete = async (req, res) => {
  try {
    const courseId = trimText(req.params?.courseId || req.params?.subjectId);
    const lectureId = trimText(req.params?.lectureId);
    const studentId = trimText(req.user?.uid);
    const requestedWatchedPercent = Math.max(
      0,
      Math.min(100, toNumber(req.body?.watchedPercent, 0))
    );
    const requestedCurrentTimeSec = Math.max(
      0,
      toNumber(req.body?.currentTimeSec, 0)
    );
    const requestedDurationSec = Math.max(
      0,
      toNumber(req.body?.durationSec ?? req.body?.duration, 0)
    );

    if (!courseId || !lectureId) {
      return errorResponse(res, "subjectId/courseId and lectureId are required", 400);
    }
    if (!studentId) return errorResponse(res, "Missing student uid", 400);

    const builtBefore = await buildCourseContentForStudent(studentId, courseId);
    if (builtBefore.error) {
      return errorResponse(res, builtBefore.error, builtBefore.status || 400, {
        ...(builtBefore.meta || {}),
        ...(builtBefore.code ? { code: builtBefore.code } : {}),
      });
    }

    if (builtBefore.isPermanentlyCompleted) {
      return errorResponse(
        res,
        builtBefore.completionLockMessage || PERMANENT_COMPLETION_MESSAGE,
        403,
        { code: "CLASS_OR_SUBJECT_COMPLETED" }
      );
    }

    if (builtBefore.isCourseCompleted) {
      return errorResponse(res, "Course is already completed", 400, {
        code: "COURSE_COMPLETED",
      });
    }

    const lectureRow = builtBefore.chapters
      .flatMap((chapter) => chapter.lectures)
      .find((lecture) => lecture.lectureId === lectureId);

    if (!lectureRow) return errorResponse(res, "Lecture not found in this course", 404);
    if (lectureRow.isLocked) {
      return errorResponse(
        res,
        lectureRow.lockReason || "Complete previous content first",
        403,
        { code: "LECTURE_LOCKED", lockReason: lectureRow.lockReason || "" }
      );
    }

    const dbWatchedPercent = Math.max(0, Math.min(100, toNumber(lectureRow.watchedPercent, 0)));
    const effectiveWatchedPercent = Math.max(dbWatchedPercent, requestedWatchedPercent);

    if (!lectureRow.isCompleted && requestedWatchedPercent > dbWatchedPercent) {
      await upsertStudentProgressRow({
        studentId,
        courseId,
        lectureId,
        markCompleted: false,
        watchedPercent: requestedWatchedPercent,
        currentTimeSec: requestedCurrentTimeSec,
        durationSec: requestedDurationSec,
      });
    }

    if (!lectureRow.isCompleted && effectiveWatchedPercent < 80) {
      return errorResponse(
        res,
        "Watch at least 80% of the lecture before marking complete",
        400,
        {
          code: "WATCH_REQUIREMENT_NOT_MET",
          watchedPercent: effectiveWatchedPercent,
          requiredPercent: 80,
        }
      );
    }

    await upsertStudentProgressRow({
      studentId,
      courseId,
      lectureId,
      markCompleted: true,
      currentTimeSec: requestedCurrentTimeSec,
      durationSec: requestedDurationSec,
    });

    if (
      Boolean(lectureRow.isLiveSession) &&
      lowerText(lectureRow.videoMode || "") === "live_session" &&
      !lectureRow.premiereEndedAt
    ) {
      try {
        await db.collection("lectures").doc(lectureId).set(
          {
            premiereEndedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (premiereError) {
        console.error("markLectureComplete premiere update error:", premiereError);
      }
    }

    const builtAfter = await buildCourseContentForStudent(studentId, courseId);
    if (builtAfter.error) {
      return errorResponse(res, builtAfter.error, builtAfter.status || 400, {
        ...(builtAfter.meta || {}),
        ...(builtAfter.code ? { code: builtAfter.code } : {}),
      });
    }

    const chaptersAfter = Array.isArray(builtAfter.chapters) ? builtAfter.chapters : [];
    const lecturesAfter = chaptersAfter.flatMap((chapter) =>
      Array.isArray(chapter.lectures) ? chapter.lectures : []
    );
    const totalLecturesAfter = lecturesAfter.length;
    const allLecturesCompleted =
      totalLecturesAfter > 0 && lecturesAfter.every((lecture) => Boolean(lecture.isCompleted));
    const allChaptersCompleted =
      chaptersAfter.length > 0 && chaptersAfter.every((chapter) => Boolean(chapter.isChapterComplete));
    const finalQuizzesAfter = Array.isArray(builtAfter.subjectQuizzes)
      ? builtAfter.subjectQuizzes
      : [];
    const requiresFinalQuiz = finalQuizzesAfter.length > 0;
    const finalQuizPassed =
      !requiresFinalQuiz || finalQuizzesAfter.every((quiz) => Boolean(quiz.isPassed));
    const readyForCompletionApproval =
      allLecturesCompleted && allChaptersCompleted && finalQuizPassed;
    let courseCompleted = false;
    let certificateGenerated = false;

    if (builtAfter.enrollmentRows.length > 0) {
      const batch = db.batch();
      builtAfter.enrollmentRows.forEach((row) => {
        const currentStatus = lowerText(row.status || "active");
        // Do not auto-change enrollment status based on current uploaded content completion.
        // Completion is a staff-only action; students should never be locked out when new
        // lectures are uploaded later.
        const normalizedStatus =
          currentStatus && currentStatus !== "pending_completion_review" ? currentStatus : "active";
        const nextStatus = currentStatus === "completed" ? "completed" : normalizedStatus;
        const progressValue =
          currentStatus === "completed" ? 100 : toNumber(builtAfter.overallProgress, 0);
        if (currentStatus === "completed") courseCompleted = true;
        batch.update(row.ref, {
          progress: progressValue,
          status: nextStatus,
          readyForCompletionApproval,
          completedAt: currentStatus === "completed" ? row.completedAt || null : null,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }

    const lectureChapter = builtAfter.chapters.find((chapter) =>
      chapter.lectures.some((lecture) => lecture.lectureId === lectureId)
    );
    const chapterCompleted = Boolean(lectureChapter?.isChapterComplete);
    const chapterQuizUnlocked =
      Array.isArray(lectureChapter?.quizzes) &&
      lectureChapter.quizzes.length > 0 &&
      lectureChapter.quizzes.every((quiz) => !quiz.isLocked);

    return successResponse(
      res,
      {
        lectureId,
        completedCount: builtAfter.completedLectures,
        totalLectures: builtAfter.totalLectures,
        progressPercent: toNumber(builtAfter.overallProgress, 0),
        chapterCompleted,
        chapterQuizUnlocked,
        readyForCompletionApproval,
        courseCompleted,
        certificateGenerated,
        nextAction: courseCompleted
          ? "course_complete"
          : readyForCompletionApproval
            ? "await_teacher_approval"
            : "continue",
      },
      courseCompleted
        ? "Course completed by teacher/admin."
        : readyForCompletionApproval
          ? "Lecture completed! Course is ready for teacher/admin completion approval."
          : chapterCompleted && chapterQuizUnlocked
          ? "Chapter completed! Quiz unlocked."
          : "Lecture completed! Keep going."
    );
  } catch (error) {
    console.error("markLectureComplete error:", error);
    return errorResponse(res, "Failed to mark complete", 500);
  }
};
export const saveWatchProgress = async (req, res) => {
  try {
    const courseId = trimText(req.params?.courseId || req.params?.subjectId);
    const lectureId = trimText(req.params?.lectureId);
    const studentId = trimText(req.user?.uid);
    const watchedPercent = Math.max(0, Math.min(100, toNumber(req.body?.watchedPercent, 0)));
    const currentTimeSec = Math.max(0, toNumber(req.body?.currentTimeSec, 0));
    const durationSec = Math.max(0, toNumber(req.body?.durationSec ?? req.body?.duration, 0));
    const inferredPercent =
      watchedPercent > 0
        ? watchedPercent
        : durationSec > 0
          ? Math.max(0, Math.min(100, (currentTimeSec / durationSec) * 100))
          : 0;

    if (!courseId || !lectureId) {
      return errorResponse(res, "subjectId/courseId and lectureId are required", 400);
    }
    if (!studentId) return errorResponse(res, "Missing student uid", 400);

    const built = await buildCourseContentForStudent(studentId, courseId);
    if (built.error) {
      return errorResponse(res, built.error, built.status || 400, {
        ...(built.meta || {}),
        ...(built.code ? { code: built.code } : {}),
      });
    }
    if (built.isPermanentlyCompleted) {
      return errorResponse(
        res,
        built.completionLockMessage || PERMANENT_COMPLETION_MESSAGE,
        403,
        { code: "CLASS_OR_SUBJECT_COMPLETED" }
      );
    }

    const lectureRow = built.chapters
      .flatMap((chapter) => chapter.lectures)
      .find((lecture) => lecture.lectureId === lectureId);

    if (!lectureRow) return errorResponse(res, "Lecture not found in this course", 404);
    if (lectureRow.isLocked) {
      return errorResponse(
        res,
        lectureRow.lockReason || "Complete previous content first",
        403,
        { code: "LECTURE_LOCKED" }
      );
    }

    await upsertStudentProgressRow({
      studentId,
      courseId,
      lectureId,
      markCompleted: false,
      watchedPercent: inferredPercent,
      currentTimeSec,
      durationSec,
    });

    return successResponse(
      res,
      {
        lectureId,
        watchedPercent: Math.round(inferredPercent),
        currentTimeSec: Math.round(currentTimeSec),
        durationSec: Math.round(durationSec),
      },
      "Progress saved"
    );
  } catch (error) {
    console.error("saveWatchProgress error:", error);
    return errorResponse(res, "Failed to save progress", 500);
  }
};
export const updateVideoAccess = async (req, res) => {
  try {
    const courseId = trimText(req.params?.courseId || req.params?.subjectId);
    const studentId = trimText(req.params?.studentId);
    const lectureAccess = Array.isArray(req.body?.lectureAccess) ? req.body.lectureAccess : [];
    const requesterId = trimText(req.user?.uid);
    const requesterRole = lowerText(req.user?.role);

    if (!courseId || !studentId) {
      return errorResponse(res, "subjectId/courseId and studentId are required", 400);
    }
    if (!requesterId) return errorResponse(res, "Missing requester uid", 400);
    if (!["teacher", "admin"].includes(requesterRole)) {
      return errorResponse(res, "Only teachers and admins can manage video access", 403);
    }
    if (!lectureAccess.length) {
      return errorResponse(res, "lectureAccess array required", 400);
    }

    const permission = await ensureTeacherCanManageCourse(requesterRole, requesterId, courseId);
    if (!permission.allowed) {
      return errorResponse(res, permission.error, permission.status || 403);
    }

    const lectures = await getCourseLectures(courseId);
    const lectureIdSet = new Set(lectures.map((lecture) => trimText(lecture.id)).filter(Boolean));
    const normalizedRows = lectureAccess
      .map((row) => ({
        lectureId: trimText(row?.lectureId),
        hasAccess: row?.hasAccess === true,
      }))
      .filter((row) => row.lectureId);

    if (!normalizedRows.length) {
      return errorResponse(res, "No valid lectureId provided", 400);
    }

    const invalidLecture = normalizedRows.find((row) => !lectureIdSet.has(row.lectureId));
    if (invalidLecture) {
      return errorResponse(
        res,
        `Lecture ${invalidLecture.lectureId} does not belong to this course`,
        400
      );
    }

    const batch = db.batch();
    normalizedRows.forEach((row) => {
      const docRef = db
        .collection("videoAccess")
        .doc(`${courseId}_${studentId}_${row.lectureId}`);
      batch.set(
        docRef,
        {
          studentId,
          courseId,
          lectureId: row.lectureId,
          hasAccess: row.hasAccess,
          grantedBy: requesterId,
          grantedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();

    return successResponse(
      res,
      { updatedCount: normalizedRows.length },
      "Video access updated successfully"
    );
  } catch (error) {
    console.error("updateVideoAccess error:", error);
    return errorResponse(res, "Failed to update video access", 500);
  }
};
export const unlockAllVideosForStudent = async (req, res) => {
  try {
    const courseId = trimText(req.params?.courseId || req.params?.subjectId);
    const studentId = trimText(req.params?.studentId);
    const requesterId = trimText(req.user?.uid);
    const requesterRole = lowerText(req.user?.role);

    if (!courseId || !studentId) {
      return errorResponse(res, "subjectId/courseId and studentId are required", 400);
    }
    if (!requesterId) return errorResponse(res, "Missing requester uid", 400);
    if (!["teacher", "admin"].includes(requesterRole)) {
      return errorResponse(res, "Only teachers and admins can unlock videos", 403);
    }

    const permission = await ensureTeacherCanManageCourse(requesterRole, requesterId, courseId);
    if (!permission.allowed) {
      return errorResponse(res, permission.error, permission.status || 403);
    }

    const lectures = await getCourseLectures(courseId);
    const batch = db.batch();

    lectures.forEach((lecture) => {
      const lectureId = trimText(lecture.id);
      if (!lectureId) return;
      const docRef = db.collection("videoAccess").doc(`${courseId}_${studentId}_${lectureId}`);
      batch.set(
        docRef,
        {
          studentId,
          courseId,
          lectureId,
          hasAccess: true,
          grantedBy: requesterId,
          grantedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    const enrollmentRows = await getCourseEnrollmentRows(studentId, courseId);
    enrollmentRows.forEach((row) => {
      batch.update(row.ref, {
        rewatchGrantedBy: requesterId,
        rewatchGrantedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();

    return successResponse(
      res,
      { unlockedCount: lectures.length },
      `All ${lectures.length} videos unlocked for student`
    );
  } catch (error) {
    console.error("unlockAllVideosForStudent error:", error);
    return errorResponse(res, "Failed to unlock videos", 500);
  }
};

export const setLectureLock = async (req, res) => {
  try {
    const courseId = trimText(req.params?.courseId || req.params?.subjectId);
    const lectureId = trimText(req.params?.lectureId);
    const requesterId = trimText(req.user?.uid);
    const requesterRole = lowerText(req.user?.role);
    const isLocked = req.body?.isLocked !== false;

    if (!courseId || !lectureId) {
      return errorResponse(res, "subjectId/courseId and lectureId are required", 400);
    }
    if (!requesterId) return errorResponse(res, "Missing requester uid", 400);
    if (!["teacher", "admin"].includes(requesterRole)) {
      return errorResponse(res, "Only teachers and admins can lock videos", 403);
    }

    const permission = await ensureTeacherCanManageCourse(requesterRole, requesterId, courseId);
    if (!permission.allowed) {
      return errorResponse(res, permission.error, permission.status || 403);
    }

    const lectures = await getCourseLectures(courseId);
    const lectureIdSet = new Set(lectures.map((lecture) => trimText(lecture.id)).filter(Boolean));
    if (!lectureIdSet.has(lectureId)) {
      return errorResponse(res, "Lecture not found in this course", 404);
    }

    const updates = {
      isLocked,
      lockedAt: isLocked ? serverTimestamp() : null,
      unlockedAt: !isLocked ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    };
    if (requesterRole === "admin") {
      updates.isLockedByAdmin = isLocked;
    } else {
      updates.isLockedByTeacher = isLocked;
    }

    await db.collection("lectures").doc(lectureId).set(updates, { merge: true });

    return successResponse(
      res,
      { lectureId, isLocked },
      isLocked ? "Lecture locked" : "Lecture unlocked"
    );
  } catch (error) {
    console.error("setLectureLock error:", error);
    return errorResponse(res, "Failed to update lecture lock", 500);
  }
};
export const getStudentCourseProgress = async (req, res) => {
  try {
    const courseId = trimText(req.params?.courseId || req.params?.subjectId);
    const studentId = trimText(req.params?.studentId);
    const requesterId = trimText(req.user?.uid);
    const requesterRole = lowerText(req.user?.role);

    if (!courseId || !studentId) {
      return errorResponse(res, "subjectId/courseId and studentId are required", 400);
    }
    if (!requesterId) return errorResponse(res, "Missing requester uid", 400);
    if (!["teacher", "admin"].includes(requesterRole)) {
      return errorResponse(res, "Only teachers and admins can view student progress", 403);
    }

    const permission = await ensureTeacherCanManageCourse(requesterRole, requesterId, courseId);
    if (!permission.allowed) {
      return errorResponse(res, permission.error, permission.status || 403);
    }

    const built = await buildCourseContentForStudent(studentId, courseId);
    if (built.error) {
      return errorResponse(res, built.error, built.status || 400, {
        ...(built.meta || {}),
        ...(built.code ? { code: built.code } : {}),
      });
    }

    const lectures = built.chapters.flatMap((chapter) =>
      chapter.lectures.map((lecture) => ({
        id: lecture.lectureId,
        lectureId: lecture.lectureId,
        title: lecture.title,
        chapterId: chapter.chapterId,
        order: toNumber(lecture.order, 0),
        isCompleted: Boolean(lecture.isCompleted),
        watchedPercent: toNumber(lecture.watchedPercent, 0),
        currentTimeSec: Math.max(0, toNumber(lecture.resumeAtSeconds, 0)),
        durationSec: Math.max(0, toNumber(lecture.durationSec, 0)),
        hasManualAccess: Boolean(lecture.manuallyUnlocked),
        isLocked: Boolean(lecture.isLocked),
      }))
    );

    const quizzes = [
      ...built.chapters.flatMap((chapter) =>
        chapter.quizzes.map((quiz) => ({
          id: quiz.quizId,
          title: quiz.title,
          chapterId: chapter.chapterId,
          scope: "chapter",
          result: quiz.result || null,
          isPassed: Boolean(quiz.isPassed),
          isLocked: Boolean(quiz.isLocked),
        }))
      ),
      ...built.subjectQuizzes.map((quiz) => ({
        id: quiz.quizId,
        title: quiz.title,
        chapterId: "",
        scope: "subject",
        result: quiz.result || null,
        isPassed: Boolean(quiz.isPassed),
        isLocked: Boolean(quiz.isLocked),
      })),
    ];

    return successResponse(
      res,
      {
        subjectId: courseId,
        courseId,
        studentId,
        progressPercent: toNumber(built.overallProgress, 0),
        totalLectures: built.totalLectures,
        completedLectures: built.completedLectures,
        lectures,
        quizzes,
      },
      "Progress fetched"
    );
  } catch (error) {
    console.error("getStudentCourseProgress error:", error);
    return errorResponse(res, "Failed to fetch progress", 500);
  }
};

const resolveCourseContentSnapshot = async (courseId) => {
  const cleanCourseId = trimText(courseId);
  const [subjectSnap, courseSnap] = await Promise.all([
    db.collection("subjects").doc(cleanCourseId).get(),
    db.collection("courses").doc(cleanCourseId).get(),
  ]);
  const contentSnap = subjectSnap.exists ? subjectSnap : courseSnap;
  return contentSnap.exists
    ? { exists: true, data: { id: contentSnap.id, ...(contentSnap.data() || {}) } }
    : { exists: false, data: null };
};

const resolveClassContextById = async (classId) => {
  const cleanClassId = trimText(classId);
  if (!cleanClassId) return null;
  const classSnap = await db.collection("classes").doc(cleanClassId).get();
  if (!classSnap.exists) return null;
  const classData = classSnap.data() || {};
  return {
    classId: cleanClassId,
    className: trimText(classData.name),
    batchCode: trimText(classData.batchCode),
  };
};

const resolveCompletionReadiness = (built = {}) => {
  const chapters = Array.isArray(built.chapters) ? built.chapters : [];
  const lectures = chapters.flatMap((chapter) =>
    Array.isArray(chapter.lectures) ? chapter.lectures : []
  );
  const totalLectures = lectures.length;
  const completedLectures = lectures.filter((lecture) => Boolean(lecture.isCompleted)).length;
  const allLecturesCompleted =
    totalLectures > 0 && completedLectures >= totalLectures;
  const allChaptersCompleted =
    chapters.length > 0 && chapters.every((chapter) => Boolean(chapter.isChapterComplete));
  const finalQuizzes = Array.isArray(built.subjectQuizzes) ? built.subjectQuizzes : [];
  const requiresFinalQuiz = finalQuizzes.length > 0;
  const finalQuizPassed =
    !requiresFinalQuiz || finalQuizzes.every((quiz) => Boolean(quiz.isPassed));

  return {
    totalLectures,
    completedLectures,
    requiresFinalQuiz,
    finalQuizPassed,
    allLecturesCompleted,
    allChaptersCompleted,
    readyForCompletion: allLecturesCompleted && allChaptersCompleted && finalQuizPassed,
  };
};

const finalizeStudentCourseByStaff = async ({
  studentId,
  courseId,
  requesterId,
  requesterRole,
  force = false,
  classId = "",
}) => {
  const cleanStudentId = trimText(studentId);
  const cleanCourseId = trimText(courseId);
  const cleanClassId = trimText(classId);

  const permission = await ensureTeacherCanManageCourse(
    requesterRole,
    requesterId,
    cleanCourseId
  );
  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.status || 403,
      error: permission.error || "Access denied",
      code: "ACCESS_DENIED",
    };
  }

  const allRows = await getCourseEnrollmentRows(cleanStudentId, cleanCourseId);
  const enrollmentRows = allRows.filter((row) => {
    if (cleanClassId && trimText(row.classId) !== cleanClassId) return false;
    return [
      "active",
      "upcoming",
      "pending_review",
      "pending_completion_review",
      "completed",
      "",
    ].includes(lowerText(row.status || "active"));
  });

  if (!enrollmentRows.length) {
    return {
      ok: false,
      status: 404,
      error: "No enrollment found for this student in this subject",
      code: "ENROLLMENT_NOT_FOUND",
    };
  }

  const built = await buildCourseContentForStudent(cleanStudentId, cleanCourseId, {
    ignoreAccessWindow: true,
  });
  if (built.error) {
    return {
      ok: false,
      status: built.status || 400,
      error: built.error || "Failed to resolve subject content",
      code: trimText(built.code) || "CONTENT_BUILD_FAILED",
    };
  }

  const readiness = resolveCompletionReadiness(built);
  if (!readiness.readyForCompletion && !force) {
    return {
      ok: false,
      status: 400,
      error: "Student has not completed all lectures/quizzes for this subject",
      code: "NOT_READY_FOR_COMPLETION",
      details: readiness,
    };
  }

  if (force && requesterRole !== "admin") {
    return {
      ok: false,
      status: 403,
      error: "Only admin can force completion/certificate generation",
      code: "ADMIN_FORCE_REQUIRED",
    };
  }

  let classContext = null;
  if (cleanClassId) {
    classContext = await resolveClassContextById(cleanClassId);
  } else {
    const firstClassId = trimText(enrollmentRows[0]?.classId);
    classContext = firstClassId ? await resolveClassContextById(firstClassId) : null;
  }

  const contentDoc = await resolveCourseContentSnapshot(cleanCourseId);
  const courseData = built.course || contentDoc.data || {};
  const certResult = await ensureCertificateForCourse(
    cleanStudentId,
    cleanCourseId,
    courseData,
    classContext
  );

  const batch = db.batch();
  enrollmentRows.forEach((row) => {
    batch.update(row.ref, {
      status: "completed",
      progress: 100,
      readyForCompletionApproval: false,
      completionApprovedBy: requesterId,
      completionApprovedRole: requesterRole,
      completionApprovedAt: serverTimestamp(),
      completedAt: row.completedAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();

  return {
    ok: true,
    subjectId: cleanCourseId,
    courseId: cleanCourseId,
    classId: classContext?.classId || cleanClassId || null,
    completionScope: classContext?.classId ? "class" : "subject",
    forced: force,
    certificateGenerated: Boolean(certResult.created),
    certId: trimText(certResult.certId) || null,
    readiness,
  };
};

export const completeStudentSubjectByStaff = async (req, res) => {
  try {
    const courseId = trimText(req.params?.courseId || req.params?.subjectId);
    const studentId = trimText(req.params?.studentId);
    const requesterId = trimText(req.user?.uid);
    const requesterRole = lowerText(req.user?.role);
    const force = req.body?.force === true;
    const classId = trimText(req.body?.classId);

    if (!courseId || !studentId) {
      return errorResponse(res, "subjectId/courseId and studentId are required", 400);
    }
    if (!requesterId) return errorResponse(res, "Missing requester uid", 400);
    if (!["teacher", "admin"].includes(requesterRole)) {
      return errorResponse(res, "Only teachers and admins can complete subjects", 403);
    }

    const result = await finalizeStudentCourseByStaff({
      studentId,
      courseId,
      requesterId,
      requesterRole,
      force,
      classId,
    });

    if (!result.ok) {
      return errorResponse(
        res,
        result.error || "Failed to complete subject",
        result.status || 400,
        {
          ...(result.code ? { code: result.code } : {}),
          ...(result.details ? { details: result.details } : {}),
        }
      );
    }

    return successResponse(
      res,
      result,
      result.forced
        ? "Subject marked completed by admin (forced) and certificate issued."
        : "Subject marked completed and certificate issued."
    );
  } catch (error) {
    console.error("completeStudentSubjectByStaff error:", error);
    return errorResponse(res, "Failed to complete subject", 500);
  }
};

export const completeStudentClassByStaff = async (req, res) => {
  try {
    const classId = trimText(req.params?.classId);
    const studentId = trimText(req.params?.studentId);
    const requesterId = trimText(req.user?.uid);
    const requesterRole = lowerText(req.user?.role);
    const force = req.body?.force === true;

    if (!classId || !studentId) {
      return errorResponse(res, "classId and studentId are required", 400);
    }
    if (!requesterId) return errorResponse(res, "Missing requester uid", 400);
    if (!["teacher", "admin"].includes(requesterRole)) {
      return errorResponse(res, "Only teachers and admins can complete classes", 403);
    }
    if (force && requesterRole !== "admin") {
      return errorResponse(
        res,
        "Only admin can force completion/certificate generation",
        403,
        { code: "ADMIN_FORCE_REQUIRED" }
      );
    }

    const classSnap = await db.collection("classes").doc(classId).get();
    if (!classSnap.exists) return errorResponse(res, "Class not found", 404);

    const enrollmentSnap = await db
      .collection("enrollments")
      .where("studentId", "==", studentId)
      .where("classId", "==", classId)
      .get();

    if (enrollmentSnap.empty) {
      return errorResponse(res, "No class enrollments found for this student", 404);
    }

    const courseIds = [
      ...new Set(
        enrollmentSnap.docs
          .map((doc) => trimText(doc.data()?.subjectId || doc.data()?.courseId))
          .filter(Boolean)
      ),
    ];

    const results = [];
    for (const courseId of courseIds) {
      const finalized = await finalizeStudentCourseByStaff({
        studentId,
        courseId,
        requesterId,
        requesterRole,
        force,
        classId,
      });
      results.push({
        subjectId: courseId,
        ...(finalized.ok
          ? {
              completed: true,
              certificateGenerated: finalized.certificateGenerated,
              certId: finalized.certId,
              forced: finalized.forced,
            }
          : {
              completed: false,
              error: finalized.error,
              code: finalized.code,
            }),
      });
    }

    const completedCount = results.filter((row) => row.completed).length;
    if (completedCount === 0) {
      return errorResponse(
        res,
        "No subjects were completed for this class",
        400,
        { code: "CLASS_COMPLETION_FAILED", results }
      );
    }

    return successResponse(
      res,
      {
        classId,
        studentId,
        completedSubjects: completedCount,
        totalSubjects: courseIds.length,
        results,
      },
      completedCount === courseIds.length
        ? "Class completion updated and certificates processed."
        : "Class completion partially updated. Check per-subject results."
    );
  } catch (error) {
    console.error("completeStudentClassByStaff error:", error);
    return errorResponse(res, "Failed to complete class", 500);
  }
};
