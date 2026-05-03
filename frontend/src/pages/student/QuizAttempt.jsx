import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import { Skeleton } from "../../components/Skeleton.jsx";
import QuizResultCard from "../../components/QuizResultCard.jsx";
import {
  getQuizById,
  getScheduledQuizById,
  reportStudentSecurityViolation,
  fetchProtectedImage,
  submitQuizAttempt,
  submitScheduledQuizAttempt,
} from "../../services/student.service.js";
import { useAuth } from "../../hooks/useAuth.js";
import { WatermarkOverlay } from "../../utils/security.js";
import {
  setupMaxProtection,
  getViolationCount,
  blurContent,
  unblurContent,
} from "../../utils/maxProtection.js";
const TAB_SWITCH_LIMIT = 3;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatSeconds = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(toNumber(seconds, 0)));
  const minutes = Math.floor(safe / 60);
  const remSeconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remSeconds).padStart(2, "0")}`;
};

const normalizeQuestionType = (value = "") => {
  const type = String(value || "").trim().toLowerCase();
  if (type === "truefalse") return "true_false";
  return type || "mcq";
};

const normalizeQuizPayload = (payload = {}) => {
  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  const normalizedQuestions = questions.map((question, index) => ({
    questionId: question.questionId || question.id || `q-${index + 1}`,
    type: normalizeQuestionType(question.questionType || question.type),
    questionText: question.questionText || "Question",
    imageUrl: question.imageUrl || null,
    imagePath: question.imagePath || null,
    options: Array.isArray(question.options)
      ? question.options
          .map((option) =>
            typeof option === "string"
              ? option
              : String(option?.label || option?.text || option?.value || "").trim()
          )
          .filter(Boolean)
      : question.options && typeof question.options === "object"
        ? [question.options.A, question.options.B, question.options.C, question.options.D]
            .map((option) => String(option || "").trim())
            .filter(Boolean)
        : [],
    marks: Math.max(1, toNumber(question.marks, 1)),
    order: toNumber(question.order, index + 1),
  }));

  return {
    id: payload.id || "",
    title: payload.title || "Quiz",
    courseName: payload.courseName || "Course",
    totalMarks: Math.max(
      0,
      toNumber(
        payload.totalMarks,
        normalizedQuestions.reduce((sum, question) => sum + question.marks, 0)
      )
    ),
    passScore: toNumber(payload.passScore, 50),
    timeLimit: Math.max(0, toNumber(payload.timeLimit, 0)),
    questions: normalizedQuestions.sort((a, b) => a.order - b.order),
  };
};

function StudentQuizAttempt() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile } = useAuth();
  const submitLockRef = useRef(false);
  const autoSubmitQueuedRef = useRef(false);
  const answersRef = useRef({});
  const questionsRef = useRef([]);
  const violationsRef = useRef(0);
  const cleanupRef = useRef(null);
  const quizStartedAtRef = useRef(0);
  const quizDeadlineMsRef = useRef(0);

  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submittedResult, setSubmittedResult] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const [securityDeactivatedInfo, setSecurityDeactivatedInfo] = useState(null);
  const lastReportedViolationRef = useRef({
    reason: "",
    count: 0,
    at: 0,
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student-quiz-by-id", quizId, location.pathname.includes("/scheduled-quizzes/") ? "scheduled" : "classic"],
    queryFn: () =>
      location.pathname.includes("/scheduled-quizzes/")
        ? getScheduledQuizById(quizId)
        : getQuizById(quizId),
    enabled: Boolean(quizId),
    staleTime: 30000,
  });

  const isScheduled = location.pathname.includes("/scheduled-quizzes/");
  const quiz = useMemo(() => normalizeQuizPayload(data || {}), [data]);
  const questions = quiz.questions;
  const currentQuestion = questions[currentIndex] || null;
  const [imageBlobUrls, setImageBlobUrls] = useState({});
  const canAttempt = isScheduled ? Boolean(data?.canAttempt) : true;
  const quizWindowStatus = isScheduled ? String(data?.status || "").toLowerCase() : "";
  const startAtLabel = isScheduled && data?.startAt ? new Date(data.startAt).toLocaleString() : "";
  const endAtLabel = isScheduled && data?.endAt ? new Date(data.endAt).toLocaleString() : "";

  useEffect(() => {
    if (!isScheduled) return;
    if (submittedResult) return;
    if (started) return;
    if (!data?.lastAttempt) return;
    const last = data.lastAttempt || {};
    setSubmittedResult({
      ...last,
      autoScore: toNumber(last?.autoScore ?? last?.score ?? last?.totalScore, 0),
      totalMarks: toNumber(last?.totalMarks, 0),
      percentage: toNumber(last?.percentage ?? last?.scorePercent, 0),
      isPassed: Boolean(last?.isPassed ?? (toNumber(last?.percentage, 0) >= toNumber(quiz.passScore, 50))),
      totalAttempts: toNumber(last?.totalAttempts ?? last?.totalStudents, 0),
    });
  }, [data, isScheduled, quiz.passScore, started, submittedResult]);

  const initialDurationSeconds = useMemo(() => {
    if (quiz.timeLimit > 0) return quiz.timeLimit * 60;
    return Math.max(questions.length * 90, 10 * 60);
  }, [quiz.timeLimit, questions.length]);

  const answeredCount = useMemo(
    () =>
      questions.filter((question) => {
        const value = answers[question.questionId];
        if (question.type === "short_answer") return String(value || "").trim().length > 0;
        return value !== undefined;
      }).length,
    [answers, questions]
  );

  const unansweredCount = Math.max(questions.length - answeredCount, 0);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    return () => {
      try {
        Object.values(imageBlobUrls || {}).forEach((url) => URL.revokeObjectURL(url));
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const path = currentQuestion?.imagePath;
    const qid = currentQuestion?.questionId;
    if (!qid || !path) return;
    if (imageBlobUrls[qid]) return;

    let cancelled = false;
    fetchProtectedImage(path)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setImageBlobUrls((prev) => ({ ...prev, [qid]: url }));
      })
      .catch(() => {
        // If protected fetch fails, fallback to direct URL (may still work if Storage tokens allowed)
      });

    return () => {
      cancelled = true;
    };
  }, [currentQuestion?.imagePath, currentQuestion?.questionId, imageBlobUrls]);

  const submitMutation = useMutation({
    mutationFn: (payloadAnswers) =>
      isScheduled
        ? submitScheduledQuizAttempt(quizId, payloadAnswers)
        : submitQuizAttempt(quizId, payloadAnswers),
    onSuccess: (response) => {
      const result = response?.data || response;
      const normalizedResult = isScheduled
        ? {
            ...result,
            autoScore: toNumber(result?.autoScore ?? result?.score ?? result?.totalScore, 0),
            totalMarks: toNumber(result?.totalMarks, 0),
            percentage: toNumber(result?.percentage ?? result?.scorePercent, 0),
            isPassed: Boolean(result?.isPassed ?? (toNumber(result?.percentage, 0) >= toNumber(quiz.passScore, 50))),
            totalAttempts: toNumber(result?.totalAttempts ?? result?.totalStudents, 0),
          }
        : result;
      setAnimatedPercent(0);
      setSubmittedResult(normalizedResult);
      setShowSubmitModal(false);
    },
    onError: (mutationError) => {
      submitLockRef.current = false;
      autoSubmitQueuedRef.current = false;
      toast.error(
        mutationError?.response?.data?.message || "Failed to submit quiz attempt"
      );
    },
  });

  const finalizeSubmit = useCallback((reason = "manual") => {
    if (submitLockRef.current || submitMutation.isPending || submittedResult) return;
    submitLockRef.current = true;

    const latestQuestions = Array.isArray(questionsRef.current) ? questionsRef.current : [];
    const latestAnswers = answersRef.current || {};
    const payloadAnswers = latestQuestions.map((question) => ({
      questionId: question.questionId,
      answer: latestAnswers[question.questionId] === undefined ? "" : latestAnswers[question.questionId],
    }));

    if (reason === "timeout") {
      toast.error("Time is up. Quiz submitted automatically.");
    }
    if (reason === "tab_limit") {
      toast.error("Quiz auto-submitted after 3 tab switch warnings.");
    }

    submitMutation.mutate(payloadAnswers);
  }, [submitMutation, submittedResult]);

  const getViolationMessage = (reason) => {
    const messages = {
      tab_switch: "Do not switch tabs during quiz",
      window_blur: "Do not minimize or switch windows",
      printscreen: "Screenshots are not allowed",
      devtools: "Developer tools are not allowed",
      screenshot: "Screenshots are not allowed",
      screen_record: "Screen recording is blocked",
    };
    return messages[reason] || "Security violation detected";
  };

  const reportViolationToBackend = useCallback(
    async (count, reason) => {
      const now = Date.now();
      if (securityDeactivatedInfo?.deactivated) return;
      if (
        lastReportedViolationRef.current.reason === reason &&
        lastReportedViolationRef.current.count === count &&
        now - lastReportedViolationRef.current.at < 1200
      ) {
        return;
      }
      lastReportedViolationRef.current = { reason, count, at: now };

      try {
        const result = await reportStudentSecurityViolation({
          reason,
          page: "quiz",
          details: `Quiz violation ${count}/${TAB_SWITCH_LIMIT}`,
        });
        if (result?.deactivated) {
          setSecurityDeactivatedInfo({
            deactivated: true,
            count: Number(result.count || TAB_SWITCH_LIMIT),
            limit: Number(result.limit || TAB_SWITCH_LIMIT),
            reason: result.reason || reason,
          });
          toast.error("Account deactivated due to repeated violations.");
        }
      } catch (violationError) {
        const errCode =
          violationError?.response?.data?.errors?.code ||
          violationError?.response?.data?.code;
        if (errCode === "ACCOUNT_DEACTIVATED") {
          setSecurityDeactivatedInfo({
            deactivated: true,
            count: TAB_SWITCH_LIMIT,
            limit: TAB_SWITCH_LIMIT,
            reason: reason || "security_violation",
          });
        }
      }
    },
    [securityDeactivatedInfo?.deactivated]
  );

  useEffect(() => {
    if (!started || submittedResult || submitMutation.isPending) return undefined;
    const tick = () => {
      const deadlineMs = Number(quizDeadlineMsRef.current || 0);
      if (!deadlineMs) return;
      const remain = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
      setTimeLeft(remain);
      if (remain > 0 || autoSubmitQueuedRef.current) return;
      autoSubmitQueuedRef.current = true;
      finalizeSubmit("timeout");
    };
    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [started, submittedResult, submitMutation.isPending, finalizeSubmit]);

  useEffect(() => {
    if (!started || submittedResult) return undefined;
    autoSubmitQueuedRef.current = false;

    const cleanup = setupMaxProtection({
      quizMode: true,
      maxViolations: TAB_SWITCH_LIMIT,
      onViolation: (count, reason) => {
        const actionableReasons = new Set([
          "tab_switch",
          "window_blur",
          "printscreen",
          "devtools",
          "screenshot",
          "screen_record",
        ]);
        if (!actionableReasons.has(reason)) return;
        const elapsedSinceStart = Date.now() - Number(quizStartedAtRef.current || 0);
        if (
          elapsedSinceStart > 0 &&
          elapsedSinceStart < 6000 &&
          ["tab_switch", "window_blur", "devtools"].includes(reason)
        ) {
          return;
        }
        violationsRef.current = count;
        setTabSwitchCount(count);
        void reportViolationToBackend(count, reason);
        blurContent();
        setTimeout(() => {
          unblurContent();
        }, 1200);

        if (count < TAB_SWITCH_LIMIT) {
          toast.error(`Warning ${count}/3: ${getViolationMessage(reason)}`, {
            duration: 4000,
          });
        }
      },
      onMaxViolation: (count, reason) => {
        if (autoSubmitQueuedRef.current || submitMutation.isPending || submittedResult) return;
        autoSubmitQueuedRef.current = true;
        void reportViolationToBackend(count || TAB_SWITCH_LIMIT, reason || "default");
        toast.error("3 violations detected. Account is being deactivated.");
        setTimeout(() => {
          finalizeSubmit("tab_limit");
        }, 500);
      },
    });

    cleanupRef.current = cleanup;
    setTabSwitchCount(getViolationCount());

    return () => {
      if (cleanupRef.current) cleanupRef.current();
      cleanupRef.current = null;
    };
  }, [
    finalizeSubmit,
    reportViolationToBackend,
    started,
    submittedResult,
    submitMutation.isPending,
  ]);

  const startQuiz = async () => {
    if (started) return;
    if (isScheduled && !canAttempt) {
      toast.error(
        quizWindowStatus === "upcoming"
          ? "This quiz has not started yet."
          : quizWindowStatus === "missed"
            ? "This quiz has ended and is marked as missed."
            : "You cannot attempt this quiz right now."
      );
      return;
    }
    if (!Array.isArray(questions) || questions.length < 1) {
      toast.error("Quiz questions are not available yet.");
      return;
    }
    const startedAtMs = Date.now();
    quizStartedAtRef.current = startedAtMs;
    const defaultDeadline = startedAtMs + initialDurationSeconds * 1000;
    const scheduledEndMs = isScheduled && data?.endAt ? new Date(data.endAt).getTime() : 0;
    const deadlineMs =
      scheduledEndMs && !Number.isNaN(scheduledEndMs)
        ? Math.min(defaultDeadline, scheduledEndMs)
        : defaultDeadline;
    quizDeadlineMsRef.current = deadlineMs;
    setTimeLeft(Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000)));
    setStarted(true);
  };

  useEffect(() => {
    if (!submittedResult) return;
    const target = Math.round(toNumber(submittedResult.percentage, 0));
    let value = 0;
    const intervalId = window.setInterval(() => {
      value += 2;
      if (value >= target) {
        setAnimatedPercent(target);
        window.clearInterval(intervalId);
      } else {
        setAnimatedPercent(value);
      }
    }, 18);
    return () => window.clearInterval(intervalId);
  }, [submittedResult]);

  const onSelectMcq = (option) => {
    if (!currentQuestion) return;
    setAnswers((previous) => ({
      ...previous,
      [currentQuestion.questionId]: option,
    }));
  };

  const onSelectBoolean = (value) => {
    if (!currentQuestion) return;
    setAnswers((previous) => ({
      ...previous,
      [currentQuestion.questionId]: value,
    }));
  };

  const onShortAnswerChange = (value) => {
    if (!currentQuestion) return;
    setAnswers((previous) => ({
      ...previous,
      [currentQuestion.questionId]: value,
    }));
  };

  const toggleFlag = () => {
    if (!currentQuestion) return;
    setFlagged((previous) => ({
      ...previous,
      [currentQuestion.questionId]: !previous[currentQuestion.questionId],
    }));
  };

  const getQuestionState = (question) => {
    const answer = answers[question.questionId];
    const isAnswered =
      question.type === "short_answer"
        ? String(answer || "").trim().length > 0
        : answer !== undefined;
    const isFlagged = Boolean(flagged[question.questionId]);
    return { isAnswered, isFlagged };
  };

  const resultSummary = useMemo(() => {
    if (!submittedResult) return null;
    const rows = Array.isArray(submittedResult.answers) ? submittedResult.answers : [];
    const correct = rows.filter((row) => row.isCorrect === true).length;
    const wrong = rows.filter((row) => row.isCorrect === false).length;
    const pending = rows.filter((row) => row.status === "pending_review").length;
    const totalScore = toNumber(submittedResult.autoScore, 0);
    const totalMarks = Math.max(0, toNumber(submittedResult.totalMarks, 0));
    const percentage = Math.max(0, toNumber(submittedResult.percentage, 0));
    return {
      rows,
      correct,
      wrong,
      pending,
      totalScore,
      totalMarks,
      percentage,
    };
  }, [submittedResult]);

  if (submittedResult && resultSummary) {
    const studentName =
      userProfile?.fullName ||
      userProfile?.name ||
      userProfile?.displayName ||
      "Student";
    return (
      <div
        className="protected-zone quiz-content relative min-h-screen bg-slate-950 px-4 py-8 protected-content"
        style={{ position: "relative" }}
      >
        <Toaster position="top-right" />
        <WatermarkOverlay
          studentName={
            userProfile?.fullName ||
            userProfile?.name ||
            userProfile?.displayName ||
            "Student"
          }
          email={String(userProfile?.email || "")}
        />
        <div className="mx-auto max-w-4xl">
          <Motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <QuizResultCard result={submittedResult} quiz={quiz} studentName={studentName} />
            <div className="mt-6 flex justify-center">
              <Link
                className="inline-flex rounded-full bg-[#4a63f5] px-6 py-2 text-sm font-semibold text-white"
                to="/student/quizzes"
              >
                Back to Quizzes
              </Link>
            </div>
          </Motion.div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="protected-zone relative min-h-screen bg-[#0f172a] font-sans text-slate-200 selection:bg-indigo-500/30 protected-content"
      style={{ position: "relative" }}
    >
      <Toaster position="top-right" />
      <WatermarkOverlay
        studentName={
          userProfile?.fullName ||
          userProfile?.name ||
          userProfile?.displayName ||
          "Student"
        }
        email={String(userProfile?.email || "")}
      />

      {/* Security Overlay */}
      <AnimatePresence>
        {securityDeactivatedInfo?.deactivated && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/95 px-4 backdrop-blur-md"
          >
            <Motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-lg rounded-[2rem] border border-rose-500/30 bg-slate-900 p-8 shadow-2xl"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m11 3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-400">Security Access Revoked</p>
              <h2 className="mt-2 text-3xl font-bold text-white">Account Deactivated</h2>
              <p className="mt-4 text-slate-400">
                Multiple violations detected ({securityDeactivatedInfo.count}/{securityDeactivatedInfo.limit}). 
                Reason: <span className="text-rose-300">{securityDeactivatedInfo.reason || "Security policy violation"}</span>.
                Please contact the Sum Academy administration to reactivate your account.
              </p>
              <button
                type="button"
                className="mt-8 w-full rounded-2xl bg-white py-4 font-bold text-slate-900 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => navigate("/login")}
              >
                Return to Login
              </button>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex min-h-screen items-center justify-center">
          <div className="w-full max-w-4xl space-y-6 px-4">
            <Skeleton className="h-16 w-3/4 rounded-2xl bg-slate-800" />
            <Skeleton className="h-[400px] w-full rounded-3xl bg-slate-800" />
          </div>
        </div>
      ) : isError ? (
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="max-w-xl rounded-3xl border border-rose-500/20 bg-rose-500/5 p-8 text-center backdrop-blur-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-rose-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Error Loading Quiz</h2>
            <p className="mt-2 text-slate-400">
              {error?.response?.data?.message || error?.message || "Something went wrong while fetching the quiz."}
            </p>
            <button 
              onClick={() => navigate("/student/quizzes")}
              className="mt-6 rounded-xl bg-slate-800 px-6 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Go Back
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-[1400px]">
          {!started ? (
            <div className="flex min-h-screen items-center justify-center px-4 py-12">
              <Motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-900/50 shadow-2xl backdrop-blur-xl"
              >
                <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 p-10 text-center">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight text-white">{quiz.title}</h1>
                  <p className="mt-3 text-lg font-medium text-indigo-300">{quiz.courseName}</p>
                </div>
                
                <div className="space-y-6 p-10">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-slate-800/50 p-4 border border-slate-800">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Duration</p>
                      <p className="mt-1 text-xl font-semibold text-white">{quiz.timeLimit || questions.length * 1.5} Minutes</p>
                    </div>
                    <div className="rounded-2xl bg-slate-800/50 p-4 border border-slate-800">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Questions</p>
                      <p className="mt-1 text-xl font-semibold text-white">{questions.length}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 rounded-lg bg-amber-500/20 p-2 text-amber-500">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-amber-200">Security Protocol Active</h4>
                        <p className="mt-1 text-sm leading-relaxed text-amber-200/60">
                          This quiz uses AI monitoring. Switching tabs, minimizing windows, or taking screenshots will trigger security violations. Multiple violations will result in account deactivation.
                        </p>
                      </div>
                    </div>
                  </div>

                  {isScheduled && (
                    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5">
                      <div className="flex flex-col gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Scheduled Start</span>
                          <span className="font-medium text-white">{startAtLabel || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Deadline</span>
                          <span className="font-medium text-white">{endAtLabel || "N/A"}</span>
                        </div>
                        {!canAttempt && quizWindowStatus && (
                          <div className="mt-2 flex items-center gap-2 font-bold text-rose-400">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                            Status: {quizWindowStatus.toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    className={`group relative w-full overflow-hidden rounded-2xl bg-indigo-600 px-8 py-5 font-bold text-white shadow-xl transition-all hover:bg-indigo-500 hover:shadow-indigo-500/20 active:scale-[0.98] ${isScheduled && !canAttempt ? "cursor-not-allowed opacity-50" : ""}`}
                    onClick={startQuiz}
                    disabled={isScheduled && !canAttempt}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Start Quiz Attempt
                      <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  </button>
                </div>
              </Motion.div>
            </div>
          ) : (
            <div className="flex min-h-screen flex-col">
              {/* Top Navigation Bar */}
              <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#0f172a]/80 py-4 backdrop-blur-md">
                <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6">
                  <div className="flex items-center gap-4">
                    <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white sm:flex">
                      Q
                    </div>
                    <div>
                      <h1 className="text-lg font-bold text-white line-clamp-1">{quiz.title}</h1>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <span>{quiz.courseName}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-700" />
                        <span>Question {currentIndex + 1} of {questions.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-6">
                    <div className="flex items-center gap-3">
                      <div className="hidden flex-col items-end sm:flex">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Time Remaining</span>
                        <span className={`text-lg font-mono font-bold leading-none ${timeLeft <= 60 ? "animate-pulse text-rose-500" : "text-white"}`}>
                          {formatSeconds(timeLeft)}
                        </span>
                      </div>
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 sm:h-14 sm:w-14 ${timeLeft <= 60 ? "border-rose-500/50 bg-rose-500/10 text-rose-500" : "border-indigo-500/30 bg-indigo-500/10 text-indigo-400"}`}>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowExitModal(true)}
                      className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-400 transition-colors hover:border-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      Exit
                    </button>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 h-[2px] w-full bg-slate-800">
                  <Motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                    className="h-full bg-indigo-500"
                  />
                </div>
              </header>

              <main className="flex-1 px-6 py-8">
                <div className="mx-auto grid max-w-[1400px] gap-8 lg:grid-cols-[1fr_350px]">
                  {/* Left Column: Question Area */}
                  <div className="space-y-6">
                    <Motion.div
                      key={currentQuestion?.questionId}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/40 shadow-xl backdrop-blur-sm"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-800/30 px-8 py-5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold text-white">
                            {currentIndex + 1}
                          </span>
                          <span className="text-sm font-bold tracking-wide text-slate-400 uppercase">Question Details</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-bold text-slate-400">
                             {currentQuestion?.marks || 1} Marks
                           </span>
                        </div>
                      </div>

                      <div className="p-8 sm:p-10">
                        {currentQuestion?.imageUrl || currentQuestion?.imagePath ? (
                          <div className="mb-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-2 shadow-inner">
                            <img
                              src={imageBlobUrls[currentQuestion.questionId] || currentQuestion.imageUrl || ""}
                              alt="Question"
                              className="mx-auto max-h-[350px] w-full object-contain"
                              onContextMenu={(e) => e.preventDefault()}
                              draggable={false}
                            />
                          </div>
                        ) : null}

                        <div
                          className="question-body text-xl font-semibold leading-relaxed text-white sm:text-2xl"
                          dangerouslySetInnerHTML={{ __html: currentQuestion?.questionText || "" }}
                        />

                        <div className="mt-10 grid gap-4">
                          {currentQuestion?.type === "mcq" &&
                            currentQuestion.options.map((option, index) => {
                              const selected = answers[currentQuestion.questionId] === option;
                              const letters = ["A", "B", "C", "D", "E", "F"];
                              return (
                                <button
                                  key={`${currentQuestion.questionId}-option-${index}`}
                                  onClick={() => onSelectMcq(option)}
                                  className={`group relative flex items-center gap-5 rounded-2xl border-2 p-5 text-left transition-all duration-200 ${
                                    selected
                                      ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                                      : "border-slate-800 bg-slate-800/30 hover:border-slate-700 hover:bg-slate-800/50"
                                  }`}
                                >
                                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition-colors ${
                                    selected ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-500 group-hover:text-slate-400"
                                  }`}>
                                    {letters[index] || index + 1}
                                  </div>
                                  <span
                                    className={`flex-1 font-medium transition-colors ${selected ? "text-white" : "text-slate-300"}`}
                                    dangerouslySetInnerHTML={{ __html: option || "" }}
                                  />
                                  {selected && (
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-white">
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )}
                                </button>
                              );
                            })}

                          {currentQuestion?.type === "true_false" && (
                            <div className="grid gap-4 sm:grid-cols-2">
                              {["TRUE", "FALSE"].map((val) => {
                                const selected = answers[currentQuestion.questionId] === val;
                                const isTrue = val === "TRUE";
                                return (
                                  <button
                                    key={val}
                                    onClick={() => onSelectBoolean(val)}
                                    className={`flex h-32 flex-col items-center justify-center rounded-2xl border-2 transition-all duration-200 ${
                                      selected
                                        ? isTrue ? "border-emerald-500 bg-emerald-500/10" : "border-rose-500 bg-rose-500/10"
                                        : "border-slate-800 bg-slate-800/30 hover:border-slate-700"
                                    }`}
                                  >
                                    <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
                                      selected 
                                        ? isTrue ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                                        : "bg-slate-800 text-slate-500"
                                    }`}>
                                      {isTrue ? (
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : (
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      )}
                                    </div>
                                    <span className={`font-bold tracking-widest ${selected ? "text-white" : "text-slate-400"}`}>{val}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {currentQuestion?.type === "short_answer" && (
                            <div className="space-y-3">
                              <label className="text-sm font-bold uppercase tracking-wider text-slate-500">Your Answer</label>
                              <textarea
                                value={String(answers[currentQuestion.questionId] || "")}
                                onChange={(event) => onShortAnswerChange(event.target.value)}
                                onPaste={(event) => event.preventDefault()}
                                placeholder="Write your detailed response here..."
                                rows={8}
                                className="w-full rounded-2xl border-2 border-slate-800 bg-slate-800/30 p-6 text-lg text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none transition-colors"
                                style={{ userSelect: "text", WebkitUserSelect: "text" }}
                              />
                              <p className="text-right text-xs text-slate-600 italic">Copy-paste is disabled for security</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Control Bar */}
                      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-800/20 px-8 py-6">
                        <button
                          className="flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-3 font-bold text-white transition-all hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                          onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
                          disabled={currentIndex === 0}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                          </svg>
                          Previous
                        </button>

                        <button
                          className={`flex items-center gap-2 rounded-xl px-6 py-3 font-bold transition-all ${
                            flagged[currentQuestion?.questionId]
                              ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                              : "bg-slate-800 text-amber-500 hover:bg-amber-500/10"
                          }`}
                          onClick={toggleFlag}
                        >
                          <svg className={`h-5 w-5 ${flagged[currentQuestion?.questionId] ? "fill-current" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                          {flagged[currentQuestion?.questionId] ? "Flagged" : "Flag for Review"}
                        </button>

                        <button
                          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-30"
                          onClick={() =>
                            setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1))
                          }
                          disabled={currentIndex >= questions.length - 1}
                        >
                          Next
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </Motion.div>
                    
                    {/* Mobile Only Submit */}
                    <div className="lg:hidden">
                       <button
                        className="w-full rounded-2xl bg-indigo-600 py-5 text-lg font-bold text-white shadow-xl shadow-indigo-600/20 transition-transform active:scale-[0.98]"
                        onClick={() => setShowSubmitModal(true)}
                      >
                        Finish & Submit Quiz
                      </button>
                      {unansweredCount > 0 && (
                        <p className="mt-3 text-center text-sm font-medium text-amber-400">
                          {unansweredCount} questions left to answer
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Status Panel */}
                  <aside className="hidden lg:block">
                    <div className="sticky top-[100px] space-y-6">
                      {/* Violation Counter */}
                      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-sm">
                         <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Security Guard</span>
                            <span className="flex h-6 w-6 animate-pulse items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
                              <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                         </div>
                         <div className="mt-4 flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
                              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <div>
                               <p className="text-sm font-bold text-white">Violations: {tabSwitchCount}/3</p>
                               <p className="text-xs text-slate-500">3 marks account as restricted</p>
                            </div>
                         </div>
                      </div>

                      {/* Question Navigator */}
                      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="font-bold text-white uppercase tracking-wider text-xs">Question Grid</h3>
                          <div className="flex items-center gap-4 text-[10px] font-bold uppercase">
                             <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-blue-500" />Done</div>
                             <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-amber-500" />Flag</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-5 gap-3">
                          {questions.map((question, index) => {
                            const state = getQuestionState(question);
                            const isCurrent = index === currentIndex;
                            
                            let baseStyle = "flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold transition-all duration-200 border-2 ";
                            if (isCurrent) {
                              baseStyle += "border-indigo-500 bg-indigo-500 text-white scale-110 shadow-lg shadow-indigo-500/30";
                            } else if (state.isFlagged) {
                              baseStyle += "border-amber-500 bg-amber-500/20 text-amber-500 hover:bg-amber-500/30";
                            } else if (state.isAnswered) {
                              baseStyle += "border-blue-500 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30";
                            } else {
                              baseStyle += "border-slate-800 bg-slate-800/40 text-slate-500 hover:border-slate-700";
                            }

                            return (
                              <button
                                key={`nav-${question.questionId}`}
                                onClick={() => setCurrentIndex(index)}
                                className={baseStyle}
                              >
                                {index + 1}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-800">
                           <button
                            disabled={submitMutation.isPending}
                            onClick={() => setShowSubmitModal(true)}
                            className="group relative w-full overflow-hidden rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-xl transition-all hover:bg-indigo-500 disabled:opacity-50"
                          >
                             <span className="relative z-10 flex items-center justify-center gap-2">
                                {submitMutation.isPending ? "Submitting..." : "Submit Quiz"}
                                <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                             </span>
                          </button>
                          {unansweredCount > 0 && (
                            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-amber-500/10 p-3 text-xs font-bold text-amber-500 border border-amber-500/20">
                               <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                               </svg>
                               {unansweredCount} Questions Pending
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </main>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showExitModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExitModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <Motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
                 <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                 </svg>
              </div>
              <h3 className="text-2xl font-bold text-white">Exit Quiz?</h3>
              <p className="mt-3 text-slate-400">
                Are you sure you want to exit? Your current progress will be lost and this attempt will be invalidated.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <button
                  className="rounded-2xl border border-slate-700 py-4 font-bold text-slate-400 transition-colors hover:bg-slate-800"
                  onClick={() => setShowExitModal(false)}
                >
                  Go Back
                </button>
                <button
                  className="rounded-2xl bg-rose-500 py-4 font-bold text-white transition-all hover:bg-rose-600 shadow-lg shadow-rose-500/20"
                  onClick={() => navigate("/student/quizzes")}
                >
                  Yes, Exit
                </button>
              </div>
            </Motion.div>
          </div>
        )}

        {showSubmitModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSubmitModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <Motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                 <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
              </div>
              <h3 className="text-2xl font-bold text-white">Submit Quiz?</h3>
              <p className="mt-3 text-slate-400">
                {unansweredCount > 0 
                  ? `You have ${unansweredCount} unanswered questions. Are you sure you want to finish the quiz now?`
                  : "Excellent! You have answered all questions. Ready to see your results?"}
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <button
                  className="rounded-2xl border border-slate-700 py-4 font-bold text-slate-400 transition-colors hover:bg-slate-800"
                  onClick={() => setShowSubmitModal(false)}
                >
                  Review
                </button>
                <button
                  className="rounded-2xl bg-indigo-600 py-4 font-bold text-white transition-all hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
                  onClick={() => finalizeSubmit("manual")}
                >
                  Submit Now
                </button>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default StudentQuizAttempt;
