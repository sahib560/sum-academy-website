import { v4 as uuidv4 } from "uuid";
import { admin, db } from "../config/firebase.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const trimText = (value = "") => String(value || "").trim();
const lowerText = (value = "") => trimText(value).toLowerCase();
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
const toMillis = (value) => {
  const parsed = toDate(value);
  return parsed ? parsed.getTime() : 0;
};
const sortByOrderThenCreated = (a = {}, b = {}) => {
  const orderDiff = toNumber(a.order, 0) - toNumber(b.order, 0);
  if (orderDiff !== 0) return orderDiff;
  return toMillis(a.createdAt) - toMillis(b.createdAt);
};

const normalizeLectureVideoMeta = (lecture = {}) => ({
  videoUrl:
    trimText(lecture.videoUrl) ||
    trimText(lecture.streamUrl) ||
    trimText(lecture.playbackUrl) ||
    trimText(lecture.signedUrl) ||
    trimText(lecture.signedVideoUrl) ||
    trimText(lecture.videoSignedUrl) ||
    "",
  videoMode: trimText(lecture.videoMode) || "recorded",
  isLiveSession: Boolean(lecture.isLiveSession),
  videoTitle: trimText(lecture.videoTitle),
  videoDuration:
    lecture.videoDuration === null || lecture.videoDuration === undefined
      ? null
      : lecture.videoDuration,
});

const getCourseEnrollmentRows = async (studentId, courseId) => {
  const snap = await db.collection("enrollments").where("studentId", "==", studentId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ref: doc.ref, ...(doc.data() || {}) }))
    .filter((row) => trimText(row.courseId) === courseId);
};

const startOfDay = (value) => {
  const parsed = toDate(value);
  if (!parsed) return null;
  const clone = new Date(parsed);
  clone.setHours(0, 0, 0, 0);
  return clone;
};

const evaluateEnrollmentWindow = (row = {}) => {
  const startDate = startOfDay(row.classStartDate);
  const endDate = startOfDay(row.classEndDate);
  const today = startOfDay(new Date());

  if (startDate && today && today.getTime() < startDate.getTime()) {
    return {
      allowed: false,
      code: "CLASS_NOT_STARTED",
      message: "Class has not started yet. Access opens on the class start date.",
      meta: {
        classStartDate: toIso(row.classStartDate),
        classEndDate: toIso(row.classEndDate),
      },
    };
  }

  if (endDate && today && today.getTime() > endDate.getTime()) {
    return {
      allowed: false,
      code: "CLASS_ENDED",
      message: "Class has ended. Learning access is closed.",
      meta: {
        classStartDate: toIso(row.classStartDate),
        classEndDate: toIso(row.classEndDate),
      },
    };
  }

  return { allowed: true, code: "", message: "", meta: {} };
};

const ensureStudentEnrolled = async (studentId, courseId) => {
  const rows = await getCourseEnrollmentRows(studentId, courseId);
  const eligibleRows = rows.filter((row) =>
    ["active", "completed", "upcoming", "pending_review", ""].includes(
      lowerText(row.status || "active")
    )
  );
  if (!eligibleRows.length) return { enrolled: false, rows: [] };

  const checks = eligibleRows.map((row) => {
    const status = lowerText(row.status || "active");
    if (status === "upcoming") {
      return {
        row,
        allowed: false,
        code: "CLASS_NOT_STARTED",
        message: "Class has not started yet. Access opens on the class start date.",
        meta: {
          classStartDate: toIso(row.classStartDate),
          classEndDate: toIso(row.classEndDate),
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

    const windowState = evaluateEnrollmentWindow(row);
    return { row, ...windowState };
  });

  const learningRows = checks.filter((item) => item.allowed).map((item) => item.row);
  if (learningRows.length > 0) {
    return { enrolled: true, rows: learningRows };
  }

  const preferredError =
    checks.find((item) => item.code === "PAYMENT_PENDING") ||
    checks.find((item) => item.code === "CLASS_NOT_STARTED") ||
    checks.find((item) => item.code === "CLASS_ENDED") ||
    checks[0];

  return {
    enrolled: true,
    rows: eligibleRows,
    accessDenied: true,
    error: preferredError?.message || "Learning access is not available for this class.",
    status: 403,
    code: preferredError?.code || "ACCESS_DENIED",
    meta: preferredError?.meta || {},
  };
};

const getCourseChapters = async (courseId) => {
  const chaptersSnap = await db.collection("chapters").where("courseId", "==", courseId).get();
  return chaptersSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .sort(sortByOrderThenCreated);
};

const getCourseLectures = async (courseId, chapterIds = []) => {
  const byCourseSnap = await db.collection("lectures").where("courseId", "==", courseId).get();
  const byCourseRows = byCourseSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
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
  const snap = await db.collection("quizzes").where("courseId", "==", courseId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((row) => !["draft", "inactive", "deleted", "archived"].includes(lowerText(row.status)))
    .sort(sortByOrderThenCreated);
};

const getStudentProgressRows = async (studentId, lectureIdSet = new Set(), courseId = "") => {
  const snap = await db.collection("progress").where("studentId", "==", studentId).get();
  const cleanCourseId = trimText(courseId);
  const rows = snap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, ...(doc.data() || {}) }));
  return rows.filter((row) => {
    const rowLectureId = trimText(row.lectureId);
    if (!rowLectureId) return false;
    if (lectureIdSet.size && !lectureIdSet.has(rowLectureId)) return false;
    const rowCourseId = trimText(row.courseId);
    if (!rowCourseId) return true;
    return rowCourseId === cleanCourseId;
  });
};

const getStudentQuizResultRows = async (studentId, courseId = "", quizIdSet = new Set()) => {
  const snap = await db.collection("quizResults").where("studentId", "==", studentId).get();
  const cleanCourseId = trimText(courseId);
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((row) => {
      const rowQuizId = trimText(row.quizId);
      if (!rowQuizId) return false;
      if (quizIdSet.size && !quizIdSet.has(rowQuizId)) return false;
      const rowCourseId = trimText(row.courseId);
      if (!rowCourseId) return true;
      return rowCourseId === cleanCourseId;
    });
};

const getStudentVideoAccessRows = async (studentId, courseId = "", lectureIdSet = new Set()) => {
  const snap = await db.collection("videoAccess").where("studentId", "==", studentId).get();
  const cleanCourseId = trimText(courseId);
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((row) => {
      const lectureId = trimText(row.lectureId);
      if (!lectureId) return false;
      if (lectureIdSet.size && !lectureIdSet.has(lectureId)) return false;
      const rowCourseId = trimText(row.courseId);
      if (!rowCourseId) return true;
      return rowCourseId === cleanCourseId;
    });
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
    if (map[lectureId] === undefined) {
      map[lectureId] = hasAccess;
      return;
    }
    map[lectureId] = Boolean(map[lectureId]) || hasAccess;
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
  const courseSnap = await db.collection("courses").doc(cleanCourseId).get();
  if (!courseSnap.exists) {
    return { error: "Course not found", status: 404 };
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
      const watchedPercent = Math.max(
        0,
        Math.min(100, toNumber(lectureProgress.watchedPercent, 0))
      );
      const manualAccess = videoAccessMap[lectureId] === true;

      let isLocked = false;
      let lockReason = "";

      if (enrollmentCompleted) {
        isLocked = !manualAccess;
        if (isLocked) {
          lockReason = "Course completed. Contact teacher/admin to unlock rewatch.";
        }
      } else if (manualAccess) {
        isLocked = false;
      } else if (index === 0) {
        isLocked = !previousChapterComplete;
        if (isLocked) lockReason = "Pass previous chapter quiz to unlock this lecture.";
      } else {
        isLocked = !previousLectureCompleted;
        if (isLocked) lockReason = "Complete the previous lecture first.";
      }

      lecturesWithStatus.push({
        id: lectureId,
        lectureId,
        chapterId: trimText(lecture.chapterId),
        title: trimText(lecture.title) || "Lecture",
        order: toNumber(lecture.order, 0),
        duration: lecture.duration || lecture.videoDuration || "--",
        ...normalizeLectureVideoMeta(lecture),
        pdfNotes: Array.isArray(lecture.pdfNotes) ? lecture.pdfNotes : [],
        books: Array.isArray(lecture.books) ? lecture.books : [],
        notes: trimText(lecture.notes || lecture.description),
        isCompleted,
        completedAt: lectureProgress.completedAt || null,
        watchedPercent,
        resumeAtSeconds: Math.max(0, toNumber(lectureProgress.resumeAtSeconds, 0)),
        durationSec: Math.max(0, toNumber(lectureProgress.durationSec, 0)),
        isLocked,
        lockReason,
        manuallyUnlocked: manualAccess,
      });

      previousLectureCompleted = isCompleted;
    });

    const allLecturesDone =
      lecturesWithStatus.length === 0 || lecturesWithStatus.every((lecture) => lecture.isCompleted);
    const quizzesWithStatus = chapterQuizzes.map((quiz) => {
      const quizId = trimText(quiz.id);
      const result = quizResultsMap[quizId] || null;
      const quizLocked = !enrollmentCompleted && !allLecturesDone;
      return {
        id: quizId,
        quizId,
        title: trimText(quiz.title) || "Chapter Quiz",
        chapterId: trimText(quiz.chapterId),
        scope: lowerText(quiz.scope || "chapter"),
        passScore: toNumber(quiz.passScore, 50),
        isLocked: quizLocked,
        lockReason: quizLocked ? "Complete all chapter videos to unlock quiz." : "",
        result,
        isAttempted: Boolean(result),
        isPassed: Boolean(result?.isPassed),
      };
    });

    const allQuizzesPassed =
      quizzesWithStatus.length === 0 || quizzesWithStatus.every((quiz) => quiz.isPassed);
    const isChapterComplete =
      (lecturesWithStatus.length === 0 ? true : allLecturesDone) && allQuizzesPassed;

    previousChapterComplete = isChapterComplete;

    chapterRows.push({
      id: trimText(chapter.id),
      chapterId: trimText(chapter.id),
      title: trimText(chapter.title) || "Chapter",
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
    const quizLocked = !allChaptersComplete;
    return {
      id: quizId,
      quizId,
      title: trimText(quiz.title) || "Final Quiz",
      scope: lowerText(quiz.scope || "subject"),
      isLocked: quizLocked,
      lockReason: quizLocked ? "Complete all chapters to unlock final quiz." : "",
      result,
      isAttempted: Boolean(result),
      isPassed: Boolean(result?.isPassed),
    };
  });

  const totalLectures = chapterRows.reduce((sum, chapter) => sum + chapter.totalLectures, 0);
  const completedLectures = chapterRows.reduce(
    (sum, chapter) => sum + chapter.completedLectures,
    0
  );
  const overallProgress =
    totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0;

  const allQuizzes = [
    ...chapterRows.flatMap((chapter) => chapter.quizzes),
    ...subjectQuizzes,
  ];
  const allQuizzesPassed = allQuizzes.length === 0 || allQuizzes.every((quiz) => quiz.isPassed);
  const fullyCompleted =
    (totalLectures === 0 ? false : completedLectures >= totalLectures) && allQuizzesPassed;

  return {
    course: { id: cleanCourseId, ...(courseSnap.data() || {}) },
    enrollmentRows: enrollmentState.rows,
    isCourseCompleted: enrollmentCompleted,
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
  const courseSnap = await db.collection("courses").doc(courseId).get();
  if (!courseSnap.exists) return { allowed: false, status: 404, error: "Course not found" };
  const courseData = courseSnap.data() || {};

  const directMatch = trimText(courseData.teacherId) === requesterId;
  const subjectMatch = Array.isArray(courseData.subjects)
    ? courseData.subjects.some((row) => trimText(row?.teacherId) === requesterId)
    : false;
  const teachersMatch = Array.isArray(courseData.assignedTeacherIds)
    ? courseData.assignedTeacherIds.some((row) => trimText(row) === requesterId)
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
    const rowCourseId = trimText(row.courseId);
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
    .where("courseId", "==", courseId)
    .limit(1)
    .get();

  if (!certSnap.empty) return { created: false, certId: trimText(certSnap.docs[0].data()?.certId) };

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
  const courseName = trimText(courseData.title) || "Course";
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
    const courseId = trimText(req.params?.courseId);
    const studentId = trimText(req.user?.uid);

    if (!courseId) return errorResponse(res, "courseId is required", 400);
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
        courseId,
        courseName: trimText(built.course.title) || "Course",
        isCourseCompleted: Boolean(built.isCourseCompleted),
        overallProgress: Math.max(0, Math.min(100, toNumber(built.overallProgress, 0))),
        totalLectures: built.totalLectures,
        completedLectures: built.completedLectures,
        chapters: built.chapters,
        subjectQuizzes: built.subjectQuizzes,
      },
      "Course content fetched"
    );
  } catch (error) {
    console.error("getCourseContent error:", error);
    return errorResponse(res, "Failed to fetch course content", 500);
  }
};
export const markLectureComplete = async (req, res) => {
  try {
    const courseId = trimText(req.params?.courseId);
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
      return errorResponse(res, "courseId and lectureId are required", 400);
    }
    if (!studentId) return errorResponse(res, "Missing student uid", 400);

    const builtBefore = await buildCourseContentForStudent(studentId, courseId);
    if (builtBefore.error) {
      return errorResponse(res, builtBefore.error, builtBefore.status || 400, {
        ...(builtBefore.meta || {}),
        ...(builtBefore.code ? { code: builtBefore.code } : {}),
      });
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

    const builtAfter = await buildCourseContentForStudent(studentId, courseId);
    if (builtAfter.error) {
      return errorResponse(res, builtAfter.error, builtAfter.status || 400, {
        ...(builtAfter.meta || {}),
        ...(builtAfter.code ? { code: builtAfter.code } : {}),
      });
    }

    const courseCompleted = Boolean(builtAfter.fullyCompleted);
    let certificateGenerated = false;

    if (builtAfter.enrollmentRows.length > 0) {
      const batch = db.batch();
      builtAfter.enrollmentRows.forEach((row) => {
        batch.update(row.ref, {
          progress: courseCompleted ? 100 : toNumber(builtAfter.overallProgress, 0),
          status: courseCompleted ? "completed" : "active",
          completedAt: courseCompleted ? serverTimestamp() : null,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }

    if (courseCompleted) {
      let classContext = null;
      const preferredEnrollment = builtAfter.enrollmentRows.find((row) => trimText(row.classId));
      const classId = trimText(preferredEnrollment?.classId);
      if (classId) {
        const classSnap = await db.collection("classes").doc(classId).get();
        if (classSnap.exists) {
          const classData = classSnap.data() || {};
          classContext = {
            classId,
            className: trimText(classData.name),
            batchCode: trimText(classData.batchCode),
          };
        }
      }
      const certResult = await ensureCertificateForCourse(
        studentId,
        courseId,
        builtAfter.course,
        classContext
      );
      certificateGenerated = Boolean(certResult.created);
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
        courseCompleted,
        certificateGenerated,
        nextAction: courseCompleted ? "course_complete" : "continue",
      },
      courseCompleted
        ? "Course completed! Certificate generated."
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
    const courseId = trimText(req.params?.courseId);
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
      return errorResponse(res, "courseId and lectureId are required", 400);
    }
    if (!studentId) return errorResponse(res, "Missing student uid", 400);

    const built = await buildCourseContentForStudent(studentId, courseId);
    if (built.error) {
      return errorResponse(res, built.error, built.status || 400, {
        ...(built.meta || {}),
        ...(built.code ? { code: built.code } : {}),
      });
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
    const courseId = trimText(req.params?.courseId);
    const studentId = trimText(req.params?.studentId);
    const lectureAccess = Array.isArray(req.body?.lectureAccess) ? req.body.lectureAccess : [];
    const requesterId = trimText(req.user?.uid);
    const requesterRole = lowerText(req.user?.role);

    if (!courseId || !studentId) {
      return errorResponse(res, "courseId and studentId are required", 400);
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
    const courseId = trimText(req.params?.courseId);
    const studentId = trimText(req.params?.studentId);
    const requesterId = trimText(req.user?.uid);
    const requesterRole = lowerText(req.user?.role);

    if (!courseId || !studentId) {
      return errorResponse(res, "courseId and studentId are required", 400);
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
export const getStudentCourseProgress = async (req, res) => {
  try {
    const courseId = trimText(req.params?.courseId);
    const studentId = trimText(req.params?.studentId);
    const requesterId = trimText(req.user?.uid);
    const requesterRole = lowerText(req.user?.role);

    if (!courseId || !studentId) {
      return errorResponse(res, "courseId and studentId are required", 400);
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
