import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import { AnimatePresence, motion as Motion } from "framer-motion";
import {
  downloadStudentTestRankingPdf,
  finishStudentTest,
  getStudentTestById,
  getStudentTestRanking,
  fetchProtectedImage,
  reportStudentSecurityViolation,
  startStudentTest,
  submitStudentTestAnswer,
} from "../../services/student.service.js";
import { setupMaxProtection } from "../../utils/maxProtection.js";
import { WatermarkOverlay } from "../../utils/security.js";
import { useAuth } from "../../hooks/useAuth.js";

const formatSeconds = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
};

const Skeleton = ({ className }) => <div className={`animate-pulse bg-slate-800 ${className}`} />;

function StudentTestAttempt() {
  const { testId } = useParams();
  const { userProfile } = useAuth();
  
  const [attempt, setAttempt] = useState(null);
  const [test, setTest] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [isFlagged, setIsFlagged] = useState(false);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(0);
  const [hasReachedLast, setHasReachedLast] = useState(false);
  const [imageBlobUrls, setImageBlobUrls] = useState({});
  const autoFinishRef = useRef(false);
  const autoAdvanceRef = useRef({ questionId: "", fired: false });
  const warnedTenRef = useRef({ questionId: "", fired: false });
  const serverOffsetMsRef = useRef(0);
  const [securityDeactivatedInfo, setSecurityDeactivatedInfo] = useState(null);
  const lastViolationRef = useRef({ reason: "", count: 0, at: 0 });

  const detailQuery = useQuery({
    queryKey: ["student-test-by-id", testId],
    queryFn: () => getStudentTestById(testId),
    enabled: Boolean(testId),
    staleTime: 10000,
    refetchInterval: false,
  });

  useEffect(() => {
    const payload = detailQuery.data || {};
    if (!payload?.test) return;
    if (payload?.serverNow) {
      const serverMs = new Date(payload.serverNow).getTime();
      if (!Number.isNaN(serverMs)) {
        serverOffsetMsRef.current = serverMs - Date.now();
      }
    }
    setTest(payload.test);
    setAttempt(payload.attempt || null);
    setCurrentQuestion(payload.currentQuestion || null);
  }, [detailQuery.data]);

  const rankingQuery = useQuery({
    queryKey: ["student-test-ranking", testId],
    queryFn: () => getStudentTestRanking(testId),
    enabled: Boolean(
      attempt?.status &&
        ["submitted", "auto_submitted"].includes(String(attempt.status).toLowerCase())
    ),
    staleTime: 10000,
  });

  const startMutation = useMutation({
    mutationFn: () => startStudentTest(testId),
    onSuccess: (data) => {
      if (data?.serverNow) {
        const serverMs = new Date(data.serverNow).getTime();
        if (!Number.isNaN(serverMs)) {
          serverOffsetMsRef.current = serverMs - Date.now();
        }
      }
      setAttempt(data.attempt || null);
      setCurrentQuestion(data.currentQuestion || null);
      setSelectedAnswer("");
      toast.success("Test started");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to start test");
    },
  });

  const finishMutation = useMutation({
    mutationFn: (reason) => finishStudentTest(testId, { reason }),
    onSuccess: (data) => {
      setAttempt(data.attempt || null);
      setCurrentQuestion(null);
      setSelectedAnswer("");
      rankingQuery.refetch();
      toast.success("Test submitted");
    },
    onError: (error) => {
      autoFinishRef.current = false;
      const code = error?.response?.data?.errors?.code || error?.response?.data?.code;
      const serverNow = error?.response?.data?.errors?.serverNow || error?.response?.data?.serverNow;
      if (code === "TEST_NOT_EXPIRED" && serverNow) {
        const serverMs = new Date(serverNow).getTime();
        if (!Number.isNaN(serverMs)) {
          serverOffsetMsRef.current = serverMs - Date.now();
        }
        toast.error("Time sync updated. Test is still active.");
        return;
      }
      toast.error(error?.response?.data?.message || "Failed to submit test");
    },
  });

  const submitMutation = useMutation({
    mutationFn: (payload) => submitStudentTestAnswer(testId, payload),
    onSuccess: (data) => {
      // Removed setSelectedAnswer("") to preserve answer persistence during navigation
      if (data.completed) {
        setAttempt(data.attempt || null);
        setCurrentQuestion(null);
        rankingQuery.refetch();
        toast.success("Test submitted successfully");
        return;
      }
      setAttempt(data.attempt || null);
      setCurrentQuestion(data.currentQuestion || null);
    },
    onError: (error) => {
      const code = error?.response?.data?.errors?.code || error?.response?.data?.code;
      if (code === "TEST_EXPIRED" && !autoFinishRef.current) {
        autoFinishRef.current = true;
        toast.error("Test time is over. Submitting...", { duration: 2000 });
        finishMutation.mutate("timeout");
        return;
      }
      toast.error(error?.response?.data?.message || "Could not save answer");
    },
  });

  const saveAndNavigate = (direction, targetIdx = null) => {
    if (!currentQuestion || submitMutation.isPending) return;
    submitMutation.mutate({
      questionId: currentQuestion.questionId,
      selectedAnswer: selectedAnswer || "",
      direction,
      targetIndex: targetIdx,
      flagged: isFlagged,
    });
  };

  const toggleFlag = () => {
    setIsFlagged(prev => !prev);
  };

  const inProgress =
    attempt && String(attempt.status || "").toLowerCase() === "in_progress";
  const submitted =
    attempt &&
    ["submitted", "auto_submitted"].includes(
      String(attempt.status || "").toLowerCase()
    );

  const currentIndex = Number(attempt?.currentIndex || 0);
  const totalQuestions = Number(attempt?.totalQuestions || 0);
  const isLastQuestion = totalQuestions > 0 && currentIndex >= totalQuestions - 1;

  useEffect(() => {
    if (isLastQuestion) setHasReachedLast(true);
  }, [isLastQuestion]);

  useEffect(() => {
    if (!currentQuestion?.questionId) return;
    const answers = Array.isArray(attempt?.answers) ? attempt.answers : [];
    const existing = answers.find(
      (row) => String(row?.questionId || "").trim() === currentQuestion.questionId
    );
    const flagged = Array.isArray(attempt?.flagged) ? attempt.flagged : [];
    
    setSelectedAnswer(existing?.selectedAnswer || "");
    setIsFlagged(flagged.includes(currentQuestion.questionId));
  }, [attempt?.answers, attempt?.flagged, currentQuestion?.questionId]);

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
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [currentQuestion?.imagePath, currentQuestion?.questionId, imageBlobUrls]);

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

  const perQuestionLimitSeconds = useMemo(() => {
    const raw = Number(test?.perQuestionTimeLimit || 60);
    return Number.isFinite(raw) ? Math.max(10, Math.min(600, raw)) : 60;
  }, [test?.perQuestionTimeLimit]);

  useEffect(() => {
    if (!inProgress || !currentQuestion?.questionId) return;
    setQuestionTimeLeft(perQuestionLimitSeconds);
    autoAdvanceRef.current = { questionId: currentQuestion.questionId, fired: false };
    warnedTenRef.current = { questionId: currentQuestion.questionId, fired: false };
  }, [currentQuestion?.questionId, inProgress, perQuestionLimitSeconds]);

  useEffect(() => {
    if (!inProgress || !currentQuestion?.questionId) return undefined;

    const tick = () => {
      setQuestionTimeLeft((prev) => {
        const next = Math.max(0, Number(prev || 0) - 1);
        if (next === 10) {
          if (
            warnedTenRef.current.questionId === currentQuestion.questionId &&
            !warnedTenRef.current.fired
          ) {
            warnedTenRef.current.fired = true;
            toast.error("10 seconds remaining for this question", { duration: 2500 });
          }
        }
        if (next <= 0) {
          if (
            autoAdvanceRef.current.questionId === currentQuestion.questionId &&
            !autoAdvanceRef.current.fired
          ) {
            autoAdvanceRef.current.fired = true;
            toast("Time up! Moving to next question...", { duration: 1800 });
            saveAndNavigate("next");
          }
        }
        return next;
      });
    };

    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [currentQuestion?.questionId, inProgress]);

  useEffect(() => {
    if (!inProgress) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [inProgress]);

  const reportViolation = useCallback(async (count, reason) => {
    try {
      const now = Date.now();
      if (
        lastViolationRef.current.reason === reason &&
        lastViolationRef.current.count === count &&
        now - lastViolationRef.current.at < 1200
      ) {
        return;
      }
      lastViolationRef.current = { reason, count, at: now };
      const result = await reportStudentSecurityViolation({
        reason,
        page: "test",
        details: `Test violation ${count}/3`,
      });
      if (result?.deactivated) {
        setSecurityDeactivatedInfo({
          deactivated: true,
          count: Number(result.count || 3),
          limit: Number(result.limit || 3),
          reason: result.reason || reason,
        });
        toast.error("Account deactivated due to repeated violations.");
      }
    } catch {
      // best-effort logging
    }
  }, []);

  useEffect(() => {
    if (!inProgress) return undefined;
    const cleanup = setupMaxProtection({
      quizMode: true,
      maxViolations: 3,
      onViolation: (count, reason) => {
        const messages = {
          tab_switch: "Do not switch tabs during test",
          window_blur: "Do not minimize or switch windows",
          printscreen: "Screenshots are not allowed",
          screenshot: "Screenshots are not allowed",
          devtools: "Developer tools are not allowed",
          screen_record: "Screen recording is blocked",
        };
        reportViolation(count, reason);
        if (count < 3) {
          toast.error(`Warning ${count}/3: ${messages[reason] || "Security violation detected"}`, {
            duration: 4200,
          });
        }
        if (count >= 3 && !autoFinishRef.current) {
          autoFinishRef.current = true;
          finishMutation.mutate("violation");
        }
      },
      onMaxViolation: (count, reason) => {
        if (autoFinishRef.current) return;
        autoFinishRef.current = true;
        void reportViolation(count || 3, reason || "default");
        toast.error("3 violations detected. Test will be submitted automatically.");
        finishMutation.mutate("violation");
      },
    });
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [finishMutation, inProgress, reportViolation]);

  const ranking = rankingQuery.data || {};
  const myResult = ranking.myResult || null;

  const headerMeta = useMemo(() => {
    if (!test) return "";
    return `${test.className || "Entire Center"} | ${test.questionsCount || 0} Questions | ${
      test.totalMarks || 0
    } Marks`;
  }, [test]);

  const downloadRanking = async () => {
    try {
      const { blob, filename } = await downloadStudentTestRankingPdf(testId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "test-ranking.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to download ranking PDF");
    }
  };

  const now = Date.now() + serverOffsetMsRef.current;
  const startAt = test?.startAt ? new Date(test.startAt).getTime() : 0;
  const endAt = test?.endAt ? new Date(test.endAt).getTime() : 0;
  
  const isScheduled = startAt > now;
  const isEnded = endAt > 0 && now > endAt;
  const isAvailable = !isScheduled && !isEnded;

  if (detailQuery.isLoading && !test) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        <p className="text-slate-400 font-medium">Preparing test environment...</p>
      </div>
    );
  }

  return (
    <div className="protected-zone flex h-screen flex-col bg-[#0f172a] text-slate-200 overflow-hidden">
      <Toaster position="top-right" />
      
      {/* Security Overlay */}
      <AnimatePresence>
        {securityDeactivatedInfo?.deactivated && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/95 px-4 backdrop-blur-xl"
          >
            <Motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-lg rounded-[2.5rem] border border-rose-500/30 bg-slate-900 p-10 text-center shadow-2xl"
            >
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-rose-500/10 text-rose-500">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m11 3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white">Access Denied</h2>
              <p className="mt-4 leading-relaxed text-slate-400">
                Your account has been deactivated due to multiple security violations ({securityDeactivatedInfo.count}/{securityDeactivatedInfo.limit}).
                <br />Reason: <span className="text-rose-300">{securityDeactivatedInfo.reason}</span>
              </p>
              <button
                className="mt-8 w-full rounded-2xl bg-white py-4 font-bold text-slate-900 transition-transform hover:scale-[1.02]"
                onClick={() => window.location.href = "/login"}
              >
                Back to Login
              </button>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col mx-auto w-full max-w-7xl px-6 py-4 overflow-hidden">
        {/* Header Section */}
        <section className="mb-4 shrink-0 overflow-hidden rounded-[1.5rem] border border-slate-800 bg-slate-900/40 p-6 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">{test?.title || "Standardized Test"}</h1>
              <p className="mt-1 text-slate-400 font-medium">{headerMeta}</p>
            </div>
            
            {inProgress && (
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Question Timer</span>
                <div className="flex items-center gap-4">
                   <span className={`font-mono text-3xl font-bold ${questionTimeLeft <= 10 ? "animate-pulse text-rose-500" : "text-indigo-400"}`}>
                    {formatSeconds(questionTimeLeft)}
                   </span>
                   <div className="h-12 w-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <Motion.div 
                        initial={{ height: "100%" }}
                        animate={{ height: `${(questionTimeLeft / perQuestionLimitSeconds) * 100}%` }}
                        className={`w-full rounded-full transition-colors ${questionTimeLeft <= 10 ? "bg-rose-500" : "bg-indigo-500"}`}
                      />
                   </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {inProgress && (
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10 xl:grid-cols-12 gap-2 overflow-y-auto max-h-[120px] rounded-2xl border border-slate-800 bg-slate-900/40 p-3 custom-scrollbar">
            {Array.from({ length: totalQuestions }).map((_, idx) => {
              const qid = test?.questions?.[idx]?.questionId;
              const hasAnswer = (attempt?.answers || []).some(a => a.questionOrder === idx + 1 && a.selectedAnswer);
              const flagged = (attempt?.flagged || []).includes(qid);
              const isActive = currentIndex === idx;

              let bgColor = "bg-slate-800/40 border-slate-800 text-slate-500";
              if (isActive) bgColor = "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20";
              else if (flagged) bgColor = "bg-amber-500/20 border-amber-500/50 text-amber-500";
              else if (hasAnswer) bgColor = "bg-emerald-500/20 border-emerald-500/50 text-emerald-400";

              return (
                <button
                  key={`nav-${idx}`}
                  onClick={() => saveAndNavigate("jump", idx)}
                  disabled={submitMutation.isPending}
                  className={`flex h-10 items-center justify-center rounded-xl border text-sm font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${bgColor}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        )}

        {!attempt && !submitted ? (
          <Motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 overflow-y-auto rounded-[2rem] border border-slate-800 bg-slate-900/40 p-10 shadow-xl backdrop-blur-sm"
          >
            <div className="max-w-2xl">
               <h2 className="text-2xl font-bold text-white">Instructions & Guidelines</h2>
               <ul className="mt-6 space-y-4 text-slate-400">
                  <li className="flex items-start gap-3">
                    <div className="mt-1 h-5 w-5 shrink-0 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 01-1.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>
                    </div>
                    <span>Each question has a strict time limit of <span className="font-bold text-white">{perQuestionLimitSeconds} seconds</span>.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 h-5 w-5 shrink-0 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 01-1.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>
                    </div>
                    <span>You can navigate between questions, but the timer resets on every transition.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 h-5 w-5 shrink-0 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" /></svg>
                    </div>
                    <span className="font-medium text-rose-300">Active monitoring: Switching tabs or taking screenshots will lead to instant disqualification.</span>
                  </li>
               </ul>
               
               <button
                type="button"
                className="group mt-10 flex items-center gap-3 rounded-2xl bg-indigo-600 px-8 py-4 font-bold text-white shadow-xl transition-all hover:bg-indigo-500 hover:text-white hover:shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending || !isAvailable}
              >
                {startMutation.isPending ? "Initializing..." : isScheduled ? `Starts at ${new Date(test.startAt).toLocaleTimeString()}` : isEnded ? "Test Period Ended" : "Start Official Test"}
                <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </Motion.section>
        ) : null}

        {inProgress && currentQuestion ? (
          <Motion.section 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col quiz-content protected-zone overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/40 shadow-2xl backdrop-blur-sm"
          >
            <WatermarkOverlay
              user={{
                uid: userProfile?.uid,
                email: userProfile?.email,
                fullName: userProfile?.fullName || userProfile?.name,
              }}
            />
            
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-800/30 px-10 py-5">
               <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Question {currentIndex + 1} of {totalQuestions}
               </span>
               <div className="flex h-2 w-48 overflow-hidden rounded-full bg-slate-800">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-500" 
                    style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
                  />
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 sm:p-10 custom-scrollbar">
              {currentQuestion.imageUrl || currentQuestion.imagePath ? (
                <div className="mb-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-3">
                  <img
                    src={imageBlobUrls[currentQuestion.questionId] || currentQuestion.imageUrl || ""}
                    alt="Question visual"
                    className="mx-auto max-h-[250px] object-contain"
                    onContextMenu={(e) => e.preventDefault()}
                    draggable={false}
                  />
                </div>
              ) : null}

              <div
                className="text-xl font-bold leading-relaxed text-white sm:text-2xl"
                dangerouslySetInnerHTML={{ __html: currentQuestion.questionText || "" }}
              />

              <div className="mt-8 grid gap-3">
                {(currentQuestion.options || []).map((option, idx) => {
                  const letters = ["A", "B", "C", "D", "E", "F"];
                  const selected = selectedAnswer === option;
                  return (
                    <button
                      key={`${currentQuestion.questionId}-${option}`}
                      onClick={() => setSelectedAnswer(option)}
                      className={`group flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                        selected
                          ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                          : "border-slate-800 bg-slate-800/20 hover:border-slate-700 hover:bg-slate-800/40"
                      }`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold ${
                        selected ? "bg-indigo-50 text-indigo-600" : "bg-slate-800 text-slate-500"
                      }`}>
                        {letters[idx] || idx + 1}
                      </div>
                      <span className={`text-base font-medium ${selected ? "text-white" : "text-slate-300"}`} dangerouslySetInnerHTML={{ __html: option || "" }} />
                      {selected && (
                        <div className="ml-auto h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                           <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex flex-wrap items-center justify-between border-t border-slate-800 bg-slate-800/20 px-10 py-8">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => saveAndNavigate("prev")}
                  disabled={submitMutation.isPending || currentIndex <= 0}
                  className="rounded-xl border border-slate-700 px-6 py-3 font-bold text-slate-400 transition-colors hover:bg-slate-800 disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={toggleFlag}
                  className={`flex items-center gap-2 rounded-xl border px-6 py-3 font-bold transition-all ${
                    isFlagged 
                      ? "border-amber-500 bg-amber-500/10 text-amber-500" 
                      : "border-slate-700 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <svg className={`h-4 w-4 ${isFlagged ? "fill-amber-500" : "fill-none"}`} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  {isFlagged ? "Flagged" : "Flag"}
                </button>
                <button
                  type="button"
                  onClick={() => saveAndNavigate("next")}
                  disabled={submitMutation.isPending}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-500 disabled:opacity-30"
                >
                  {submitMutation.isPending ? "Saving..." : isLastQuestion ? "Finish" : "Save & Next"}
                  {!isLastQuestion && (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => finishMutation.mutate("manual")}
                disabled={finishMutation.isPending || !hasReachedLast}
                className={`rounded-xl border px-8 py-3 font-bold transition-all ${
                  hasReachedLast
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    : "border-slate-800 text-slate-600 cursor-not-allowed"
                }`}
              >
                {hasReachedLast ? "Finalize Test" : "Finish Review First"}
              </button>
            </div>
          </Motion.section>
        ) : null}

        {submitted ? (
          <Motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="overflow-hidden rounded-[2.5rem] border border-emerald-500/20 bg-emerald-500/5 p-10 shadow-xl backdrop-blur-sm">
              <div className="flex flex-col items-center text-center">
                 <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 </div>
                 <h2 className="text-4xl font-bold text-white">Test Completed</h2>
                 <p className="mt-2 text-xl font-medium text-emerald-400">
                   Score: {attempt?.score || 0} / {attempt?.totalMarks || 0} ({attempt?.percentage || 0}%)
                 </p>
                 {myResult && (
                    <div className="mt-6 rounded-2xl bg-white/5 px-6 py-3 border border-white/10">
                       <span className="text-sm font-bold uppercase tracking-widest text-slate-400">Current Standing</span>
                       <p className="text-2xl font-bold text-white">#{myResult.position} <span className="text-slate-500">/ {ranking.totalParticipants}</span></p>
                    </div>
                 )}
              </div>

              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <button
                  type="button"
                  onClick={() => rankingQuery.refetch()}
                  className="rounded-2xl border border-slate-700 bg-slate-800/50 px-8 py-4 font-bold text-white transition-colors hover:bg-slate-700"
                >
                  Refresh Ranking
                </button>
                <Link
                  to="/student/tests"
                  className="rounded-2xl bg-indigo-600 px-8 py-4 font-bold text-white shadow-lg transition-all hover:bg-indigo-500 hover:text-white"
                >
                  Explore Other Tests
                </Link>
              </div>
            </div>

            {/* Ranking Table */}
            <div className="overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-900/40 shadow-xl backdrop-blur-sm">
              <div className="border-b border-slate-800 bg-slate-800/30 px-10 py-6">
                 <h3 className="text-xl font-bold text-white">Student Leaderboard</h3>
              </div>
              <div className="overflow-x-auto p-2">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      <th className="px-8 py-4">Rank</th>
                      <th className="px-8 py-4">Student</th>
                      <th className="px-8 py-4">Class</th>
                      <th className="px-8 py-4 text-right">Score</th>
                      <th className="px-8 py-4 text-right">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {(ranking.ranking || []).slice(0, 30).map((row) => (
                      <tr
                        key={`${row.studentId}-${row.attemptId}`}
                        className={`group transition-colors ${row.studentId === userProfile?.uid ? "bg-indigo-500/10" : "hover:bg-white/5"}`}
                      >
                        <td className="px-8 py-5">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold ${
                            row.position === 1 ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" :
                            row.position === 2 ? "bg-slate-300 text-slate-900" :
                            row.position === 3 ? "bg-amber-700 text-white" :
                            "bg-slate-800 text-slate-400"
                          }`}>
                            {row.position}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="font-bold text-white group-hover:text-indigo-400 transition-colors">{row.studentName}</div>
                          <div className="text-xs text-slate-500">{row.studentId === userProfile?.uid ? "You" : "Verified Student"}</div>
                        </td>
                        <td className="px-8 py-5 text-sm font-medium text-slate-400">{row.className}</td>
                        <td className="px-8 py-5 text-right font-mono font-bold text-white">{row.obtainedMarks}/{row.totalMarks}</td>
                        <td className="px-8 py-5 text-right">
                          <span className={`rounded-lg px-3 py-1 text-sm font-bold ${
                            row.percentage >= 75 ? "bg-emerald-500/10 text-emerald-400" :
                            row.percentage >= 40 ? "bg-indigo-500/10 text-indigo-400" :
                            "bg-rose-500/10 text-rose-400"
                          }`}>
                            {row.percentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Motion.section>
        ) : null}
      </div>
    </div>
  );
}

export default StudentTestAttempt;
