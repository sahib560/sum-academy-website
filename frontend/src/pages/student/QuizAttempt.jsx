import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import { Skeleton } from "../../components/Skeleton.jsx";
import {
  getQuizById,
  reportStudentSecurityViolation,
  submitQuizAttempt,
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
  const { userProfile } = useAuth();
  const submitLockRef = useRef(false);
  const autoSubmitQueuedRef = useRef(false);
  const answersRef = useRef({});
  const questionsRef = useRef([]);
  const violationsRef = useRef(0);
  const cleanupRef = useRef(null);

  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
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
    queryKey: ["student-quiz-by-id", quizId],
    queryFn: () => getQuizById(quizId),
    enabled: Boolean(quizId),
    staleTime: 30000,
  });

  const quiz = useMemo(() => normalizeQuizPayload(data || {}), [data]);
  const questions = quiz.questions;
  const currentQuestion = questions[currentIndex] || null;

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

  const submitMutation = useMutation({
    mutationFn: (payloadAnswers) => submitQuizAttempt(quizId, payloadAnswers),
    onSuccess: (response) => {
      const result = response?.data || response;
      setAnimatedPercent(0);
      setSubmittedResult(result);
      setShowSubmitModal(false);
      document.exitFullscreen?.().catch(() => {});
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
    const intervalId = window.setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(intervalId);
          finalizeSubmit("timeout");
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [started, submittedResult, submitMutation.isPending, finalizeSubmit]);

  useEffect(() => {
    if (!started || submittedResult) return undefined;
    autoSubmitQueuedRef.current = false;

    const cleanup = setupMaxProtection({
      enforceFullscreenMode: true,
      quizMode: true,
      maxViolations: TAB_SWITCH_LIMIT,
      onViolation: (count, reason) => {
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

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!started || submittedResult) return;
      if (!document.fullscreenElement) {
        setShowFullscreenWarning(true);
      } else {
        setShowFullscreenWarning(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [started, submittedResult]);

  const requestQuizFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setShowFullscreenWarning(false);
    } catch {
      toast.error("Fullscreen permission was denied");
    }
  };

  const startQuiz = async () => {
    if (started) return;
    await requestQuizFullscreen();
    setTimeLeft(initialDurationSeconds);
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
    return (
      <div
        className="protected-zone quiz-content relative min-h-screen bg-slate-50 px-4 py-8 protected-content"
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
        <div className="mx-auto max-w-3xl space-y-6">
          <Motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"
          >
            <div className="pointer-events-none absolute inset-0">
              {Array.from({ length: 28 }).map((_, index) => (
                <span
                  key={`result-confetti-${index}`}
                  className="absolute h-2 w-2 animate-bounce rounded-full"
                  style={{
                    left: `${(index * 13) % 95}%`,
                    top: `${(index * 17) % 90}%`,
                    backgroundColor: "#4a63f5",
                    opacity: 0.7,
                    animationDelay: `${(index % 7) * 0.08}s`,
                  }}
                />
              ))}
            </div>

            <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border-[10px] border-primary/20">
              <span className="text-3xl font-semibold text-slate-900">
                {animatedPercent}%
              </span>
            </div>

            <p className="mt-4 text-lg font-semibold text-primary">Result Summary</p>
            <p className="mt-2 text-sm text-slate-600">
              Score: {resultSummary.totalScore} / {resultSummary.totalMarks} marks (
              {Math.round(resultSummary.percentage)}%)
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Correct</p>
                <p className="mt-1 text-xl font-semibold text-emerald-600">
                  {resultSummary.correct}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Wrong</p>
                <p className="mt-1 text-xl font-semibold text-rose-600">
                  {resultSummary.wrong}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Pending Review</p>
                <p className="mt-1 text-xl font-semibold text-amber-600">
                  {resultSummary.pending}
                </p>
              </div>
            </div>

            {resultSummary.pending > 0 && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Your short answer questions are pending teacher review. Final score may
                change.
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button className="btn-outline" onClick={() => setShowReview((prev) => !prev)}>
                {showReview ? "Hide Review" : "Review Answers"}
              </button>
              <Link className="btn-primary" to="/student/quizzes">
                Back to Quizzes
              </Link>
            </div>
          </Motion.section>

          {showReview && (
            <Motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {questions.map((question, index) => {
                const row = resultSummary.rows.find(
                  (item) => item.questionId === question.questionId
                );
                const answerValue = answers[question.questionId];
                const isShort = question.type === "short_answer";
                const statusText = isShort
                  ? "Pending teacher review"
                  : row?.isCorrect === true
                    ? "Correct"
                    : row?.isCorrect === false
                      ? "Wrong"
                      : "Not answered";
                const statusClass = isShort
                  ? "bg-amber-50 text-amber-700"
                  : row?.isCorrect === true
                    ? "bg-emerald-50 text-emerald-600"
                    : row?.isCorrect === false
                      ? "bg-rose-50 text-rose-600"
                      : "bg-slate-100 text-slate-600";

                return (
                  <div
                    key={question.questionId}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold text-slate-900">
                        Q{index + 1}. {question.questionText}
                      </p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                        {statusText}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Your answer: {answerValue === undefined ? "Not answered" : String(answerValue)}
                    </p>
                  </div>
                );
              })}
            </Motion.section>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="protected-zone quiz-content relative min-h-screen bg-slate-50 px-4 py-6 protected-content"
      style={{ position: "relative" }}
    >
      <Toaster position="top-right" />

      {securityDeactivatedInfo?.deactivated ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/95 px-4 text-center text-white">
          <div className="w-full max-w-lg rounded-3xl border border-rose-400/40 bg-slate-900/90 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-rose-300">Account Deactivated</p>
            <h2 className="mt-2 font-heading text-2xl">
              Access blocked after {securityDeactivatedInfo.count}/{securityDeactivatedInfo.limit} violations
            </h2>
            <p className="mt-3 text-sm text-slate-200">
              Reason: {securityDeactivatedInfo.reason || "Security policy violation"}.
              Please contact admin or teacher to review and reactivate your account.
            </p>
            <button
              type="button"
              className="mt-5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900"
              onClick={() => navigate("/login")}
            >
              Go To Login
            </button>
          </div>
        </div>
      ) : null}
      <WatermarkOverlay
        studentName={
          userProfile?.fullName ||
          userProfile?.name ||
          userProfile?.displayName ||
          "Student"
        }
        email={String(userProfile?.email || "")}
      />

      {isLoading ? (
        <div className="mx-auto max-w-4xl">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="mt-4 h-80 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error?.response?.data?.message || error?.message || "Failed to load quiz"}
        </div>
      ) : (
        <div className="mx-auto max-w-7xl space-y-5">
          {!started ? (
            <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h1 className="font-heading text-2xl text-slate-900">{quiz.title}</h1>
              <p className="mt-2 text-sm text-slate-500">{quiz.courseName}</p>
              <p className="mt-4 text-sm text-slate-600">
                This quiz requires fullscreen mode and active tab monitoring.
              </p>
              <button className="btn-primary mt-6" onClick={startQuiz}>
                Start Quiz
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="font-heading text-xl text-slate-900">{quiz.title}</h1>
                    <p className="text-sm text-slate-500">{quiz.courseName}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${
                        timeLeft <= 300 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {formatSeconds(timeLeft)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      Question {currentIndex + 1} of {questions.length}
                    </span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">
                      Security warnings: {tabSwitchCount}/{TAB_SWITCH_LIMIT}
                    </span>
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                      onClick={() => setShowExitModal(true)}
                    >
                      Exit
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                <section className="flex justify-center">
                  <div className="w-full max-w-[680px] rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      Question {currentIndex + 1}
                    </span>
                    <h2 className="mt-4 text-2xl font-semibold text-slate-900">
                      {currentQuestion?.questionText}
                    </h2>

                    <div className="mt-5 space-y-3">
                      {currentQuestion?.type === "mcq" &&
                        currentQuestion.options.map((option, index) => {
                          const selected = answers[currentQuestion.questionId] === option;
                          return (
                            <button
                              key={`${currentQuestion.questionId}-option-${index}`}
                              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                                selected
                                  ? "border-primary bg-primary/10"
                                  : "border-slate-200 hover:bg-slate-50"
                              }`}
                              onClick={() => onSelectMcq(option)}
                            >
                              {option}
                            </button>
                          );
                        })}

                      {currentQuestion?.type === "true_false" && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <button
                            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                              answers[currentQuestion.questionId] === "TRUE"
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-emerald-200 text-emerald-700"
                            }`}
                            onClick={() => onSelectBoolean("TRUE")}
                          >
                            TRUE
                          </button>
                          <button
                            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                              answers[currentQuestion.questionId] === "FALSE"
                                ? "border-rose-600 bg-rose-600 text-white"
                                : "border-rose-200 text-rose-700"
                            }`}
                            onClick={() => onSelectBoolean("FALSE")}
                          >
                            FALSE
                          </button>
                        </div>
                      )}

                      {currentQuestion?.type === "short_answer" && (
                        <textarea
                          value={String(answers[currentQuestion.questionId] || "")}
                          onChange={(event) => onShortAnswerChange(event.target.value)}
                          onPaste={(event) => event.preventDefault()}
                          placeholder="Type your answer here..."
                          rows={5}
                          className="w-full rounded-2xl border border-slate-200 p-3 text-sm text-slate-700"
                          style={{ userSelect: "text", WebkitUserSelect: "text" }}
                        />
                      )}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                      <button
                        className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
                        disabled={currentIndex === 0}
                      >
                        Previous
                      </button>

                      <button
                        className={`rounded-full px-4 py-2 text-xs font-semibold ${
                          flagged[currentQuestion?.questionId]
                            ? "bg-amber-500 text-white"
                            : "border border-amber-300 text-amber-700"
                        }`}
                        onClick={toggleFlag}
                      >
                        {flagged[currentQuestion?.questionId] ? "Flagged" : "Flag Question"}
                      </button>

                      <button
                        className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() =>
                          setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1))
                        }
                        disabled={currentIndex >= questions.length - 1}
                      >
                        Next
                      </button>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                      {questions.map((question, index) => {
                        const state = getQuestionState(question);
                        const isCurrent = index === currentIndex;
                        const className = isCurrent
                          ? "bg-primary text-white"
                          : state.isFlagged
                            ? "bg-amber-400 text-white"
                            : state.isAnswered
                              ? "bg-blue-500 text-white"
                              : "bg-slate-200 text-slate-600";
                        return (
                          <button
                            key={question.questionId}
                            className={`h-8 w-8 rounded-full text-xs font-semibold ${className}`}
                            onClick={() => setCurrentIndex(index)}
                          >
                            {index + 1}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      className="mt-6 w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white lg:hidden"
                      onClick={() => setShowSubmitModal(true)}
                    >
                      Submit Quiz
                    </button>
                    {unansweredCount > 0 && (
                      <p className="mt-2 text-center text-xs text-amber-700 lg:hidden">
                        {unansweredCount} unanswered question(s)
                      </p>
                    )}
                  </div>
                </section>

                <aside className="hidden lg:block">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="font-heading text-lg text-slate-900">Question Overview</h3>
                    <div className="mt-4 grid grid-cols-5 gap-2">
                      {questions.map((question, index) => {
                        const state = getQuestionState(question);
                        const className = state.isFlagged
                          ? "bg-amber-400 text-white"
                          : state.isAnswered
                            ? "bg-blue-500 text-white"
                            : "bg-slate-200 text-slate-600";
                        return (
                          <button
                            key={`overview-${question.questionId}`}
                            className={`h-8 w-8 rounded-full text-xs font-semibold ${className}`}
                            onClick={() => setCurrentIndex(index)}
                          >
                            {index + 1}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      className="mt-5 w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => setShowSubmitModal(true)}
                      disabled={submitMutation.isPending}
                    >
                      {submitMutation.isPending ? "Submitting..." : "Submit Quiz"}
                    </button>
                    {unansweredCount > 0 && (
                      <p className="mt-2 text-xs text-amber-700">
                        {unansweredCount} unanswered question(s)
                      </p>
                    )}
                  </div>
                </aside>
              </div>
            </>
          )}
        </div>
      )}

      <AnimatePresence>
        {showExitModal && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
            <button
              className="absolute inset-0 bg-slate-900/50"
              onClick={() => setShowExitModal(false)}
              aria-label="Close exit modal"
            />
            <Motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl"
            >
              <h3 className="font-heading text-xl text-slate-900">Exit quiz?</h3>
              <p className="mt-2 text-sm text-slate-500">
                You will lose this attempt if you exit now.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  onClick={() => setShowExitModal(false)}
                >
                  Stay
                </button>
                <button
                  className="flex-1 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => {
                    document.exitFullscreen?.().catch(() => {});
                    navigate("/student/quizzes");
                  }}
                >
                  Exit
                </button>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSubmitModal && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
            <button
              className="absolute inset-0 bg-slate-900/50"
              onClick={() => setShowSubmitModal(false)}
              aria-label="Close submit modal"
            />
            <Motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl"
            >
              <h3 className="font-heading text-xl text-slate-900">Submit quiz?</h3>
              <p className="mt-2 text-sm text-slate-500">
                Are you sure? {unansweredCount} question(s) are still unanswered.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  onClick={() => setShowSubmitModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => finalizeSubmit("manual")}
                >
                  Confirm Submit
                </button>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFullscreenWarning && (
          <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/85 px-4 text-center text-white">
            <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h3 className="font-heading text-2xl">Please stay in fullscreen during quiz</h3>
              <button
                className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900"
                onClick={requestQuizFullscreen}
              >
                Resume Fullscreen
              </button>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default StudentQuizAttempt;
