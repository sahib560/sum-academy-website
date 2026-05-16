import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import { AnimatePresence, motion as Motion } from "framer-motion";
import {
  downloadStudentTestRankingPdf,
  downloadStudentTestResultPdf,
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

const Skeleton = ({ className }) => <div className={`animate-pulse bg-slate-200 ${className}`} />;
const trimText = (v = "") => String(v || "").trim();
const toNumber = (v, f = 0) => { const p = Number(v); return Number.isFinite(p) ? p : f; };
const ordinal = (v = 0) => {
  const n = Number(v) || 0;
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n}st`;
  if (m10 === 2 && m100 !== 12) return `${n}nd`;
  if (m10 === 3 && m100 !== 13) return `${n}rd`;
  return `${n}th`;
};
const sanitizeQuestionHtml = (html = "") => {
  if (!html) return "";
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
             .replace(/on\w+="[^"]*"/g, "");
};

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
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const autoFinishRef = useRef(false);
  const autoAdvanceRef = useRef({ questionId: "", fired: false });
  const warnedTenRef = useRef({ questionId: "", fired: false });
  const serverOffsetMsRef = useRef(0);
  const [securityDeactivatedInfo, setSecurityDeactivatedInfo] = useState(null);
  const lastViolationRef = useRef({ reason: "", count: 0, at: 0 });
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());

  const detailQuery = useQuery({
    queryKey: ["student-test-by-id", testId],
    queryFn: () => getStudentTestById(testId),
    enabled: Boolean(testId),
    staleTime: 10000,
    refetchInterval: 30000, // Re-sync every 30s
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
    setIsFlagged(prev => {
      const next = !prev;
      if (attempt && currentQuestion) {
        setAttempt(p => {
          if (!p) return p;
          const qid = currentQuestion.questionId || currentQuestion._id;
          let newFlagged = Array.isArray(p.flagged) ? [...p.flagged] : [];
          if (next) {
            if (!newFlagged.includes(qid)) newFlagged.push(qid);
          } else {
            newFlagged = newFlagged.filter(id => id !== qid);
          }
          return { ...p, flagged: newFlagged };
        });
      }
      return next;
    });
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
    if (!currentQuestion) return;
    const qid = currentQuestion.questionId || currentQuestion._id;
    const answers = Array.isArray(attempt?.answers) ? attempt.answers : [];
    
    // Match by questionId or questionOrder for robust restoring
    const existing = answers.find(a => {
      const byOrder = a.questionOrder === (Number(attempt?.currentIndex) + 1);
      const byId = qid && String(a.questionId || "").trim() === String(qid).trim();
      return byId || byOrder;
    });

    const flagged = Array.isArray(attempt?.flagged) ? attempt.flagged : [];
    
    setSelectedAnswer(existing?.selectedAnswer || "");
    setIsFlagged(qid ? flagged.includes(qid) : false);
  }, [attempt?.answers, attempt?.flagged, attempt?.currentIndex, currentQuestion]);

  const handleOptionSelect = (option) => {
    const cleanOption = trimText(option);
    setSelectedAnswer(cleanOption);

    if (attempt && currentQuestion) {
      setAttempt((prev) => {
        if (!prev) return prev;
        const newAnswers = [...(prev.answers || [])];
        const qid = currentQuestion.questionId || currentQuestion._id;
        const qOrder = Number(prev.currentIndex || 0) + 1;
        
        const existingIdx = newAnswers.findIndex(a => {
          const byOrder = a.questionOrder === qOrder;
          const byId = qid && String(a.questionId || "").trim() === String(qid).trim();
          return byId || byOrder;
        });

        if (existingIdx >= 0) {
          newAnswers[existingIdx] = { ...newAnswers[existingIdx], selectedAnswer: cleanOption };
        } else {
          newAnswers.push({
            questionId: qid,
            questionOrder: qOrder,
            selectedAnswer: cleanOption,
          });
        }

        return { ...prev, answers: newAnswers };
      });
    }
  };

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

  const downloadReportCard = async () => {
    try {
      const { blob, filename } = await downloadStudentTestResultPdf(testId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "test-report-card.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to download report card PDF");
    }
  };

  const now = currentTimeMs + serverOffsetMsRef.current;
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
    <div className="protected-zone flex min-h-screen flex-col bg-slate-50 text-slate-800">
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

      <div className="flex-1 flex flex-col mx-auto w-full max-w-7xl px-4 py-2 sm:px-6 sm:py-4">
        {/* Header Section */}
        <section className="mb-4 shrink-0 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:p-6 shadow-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-800">{test?.title || "Standardized Test"}</h1>
              <p className="mt-1 text-slate-500 font-medium">{headerMeta}</p>
            </div>
            
            {inProgress && (
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Question Timer</span>
                <div className="flex items-center gap-3">
                   <span className={`font-mono text-2xl sm:text-3xl font-bold ${questionTimeLeft <= 10 ? "animate-pulse text-rose-500" : "text-indigo-400"}`}>
                    {formatSeconds(questionTimeLeft)}
                   </span>
                   <div className="h-10 sm:h-12 w-1.5 rounded-full bg-slate-800 overflow-hidden">
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
          <div className="mb-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            {/* Legend */}
            <div className="mb-2 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-emerald-500"/> Answered</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-red-400"/> Not Answered</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-amber-400"/> Flagged</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-indigo-500"/> Current</span>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15 gap-1.5 overflow-y-auto max-h-[130px] custom-scrollbar">
            {Array.from({ length: totalQuestions }).map((ignore, idx) => {
              const qid = test?.questions?.[idx]?.questionId;
              const hasAnswer = (attempt?.answers || []).some(a => {
                const byOrder = a.questionOrder === idx + 1 && a.selectedAnswer;
                const byId = qid && String(a.questionId || "").trim() === String(qid).trim() && a.selectedAnswer;
                return byOrder || byId;
              });
              const isFlaggedQ = qid ? (attempt?.flagged || []).includes(qid) : false;
              const isActive = currentIndex === idx;

              let cls = "bg-red-100 border-red-300 text-red-600";
              if (isActive) cls = "bg-indigo-600 border-indigo-600 text-white shadow shadow-indigo-300";
              else if (isFlaggedQ) cls = "bg-amber-100 border-amber-400 text-amber-700";
              else if (hasAnswer) cls = "bg-emerald-100 border-emerald-400 text-emerald-700";

              return (
                <button
                  key={`nav-${idx}`}
                  onClick={() => saveAndNavigate("jump", idx)}
                  disabled={submitMutation.isPending}
                  title={isFlaggedQ ? "Flagged" : hasAnswer ? "Answered" : "Not answered"}
                  className={`flex h-9 items-center justify-center rounded-lg border text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${cls}`}
                >
                  {idx + 1}
                </button>
              );
            })}
            </div>
          </div>
        )}

        {!attempt && !submitted ? (
          <Motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-10 shadow-lg"
          >
            <div className="max-w-2xl">
               <h2 className="text-2xl font-bold text-slate-800">Instructions & Guidelines</h2>
               <ul className="mt-6 space-y-4 text-slate-600">
                  <li className="flex items-start gap-3">
                    <div className="mt-1 h-5 w-5 shrink-0 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 01-1.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>
                    </div>
                    <span>Each question has a strict time limit of <span className="font-bold text-slate-800">{perQuestionLimitSeconds} seconds</span>.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 h-5 w-5 shrink-0 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 01-1.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>
                    </div>
                    <span>You can navigate between questions, but the timer resets on every transition.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 h-5 w-5 shrink-0 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" /></svg>
                    </div>
                    <span className="font-medium text-red-600">Active monitoring: Switching tabs or taking screenshots will lead to instant disqualification.</span>
                  </li>
               </ul>
               
               <button
                type="button"
                className="group mt-10 flex items-center gap-3 rounded-2xl bg-indigo-600 px-8 py-4 font-bold text-white shadow-xl transition-all hover:bg-indigo-500 hover:text-white hover:shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600 disabled:hover:shadow-none"
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
            className="flex-1 flex flex-col quiz-content protected-zone overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 bg-white shadow-xl"
          >
            <WatermarkOverlay
              user={{
                uid: userProfile?.uid,
                email: userProfile?.email,
                fullName: userProfile?.fullName || userProfile?.name,
              }}
            />
            
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-10 sm:py-5">
               <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500">
                Question {currentIndex + 1} of {totalQuestions}
               </span>
               <div className="flex h-1.5 sm:h-2 w-32 sm:w-48 overflow-hidden rounded-full bg-slate-200">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-500" 
                    style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
                  />
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-10 custom-scrollbar">
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
                className="text-xl font-bold leading-relaxed text-slate-800 sm:text-2xl"
                dangerouslySetInnerHTML={{ __html: currentQuestion.questionText || "" }}
              />

              <div className="mt-8 grid gap-3">
                {(currentQuestion.options || []).map((option, idx) => {
                  const letters = ["A", "B", "C", "D", "E", "F"];
                  const selected = trimText(selectedAnswer) === trimText(option);

                  return (
                    <button
                      key={`${currentQuestion.questionId || currentQuestion._id}-${option}`}
                      onClick={() => handleOptionSelect(option)}
                      className={`group flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                        selected
                          ? "border-indigo-500 bg-indigo-50 shadow-md"
                          : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50"
                      }`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold ${
                        selected ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
                      }`}>
                        {letters[idx] || idx + 1}
                      </div>
                      <span className={`text-base font-medium ${selected ? "text-indigo-700" : "text-slate-700"}`} dangerouslySetInnerHTML={{ __html: option || "" }} />
                      {selected && (
                        <div className="ml-auto h-5 w-5 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                           <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50 p-4 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-4">
                <button
                  type="button"
                  onClick={() => saveAndNavigate("prev")}
                  disabled={submitMutation.isPending || currentIndex <= 0}
                  className="flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-30 sm:px-6 sm:py-3 sm:text-base"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={toggleFlag}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all sm:px-6 sm:py-3 sm:text-base ${
                    isFlagged 
                      ? "border-amber-400 bg-amber-50 text-amber-600" 
                      : "border-slate-300 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <svg className={`h-4 w-4 ${isFlagged ? "fill-amber-400" : "fill-none"}`} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  {isFlagged ? "Flagged" : "Flag"}
                </button>
                <button
                  type="button"
                  onClick={() => saveAndNavigate("next")}
                  disabled={submitMutation.isPending}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow transition-all hover:bg-indigo-500 disabled:opacity-30 sm:col-auto sm:px-8 sm:py-3 sm:text-base"
                >
                  {submitMutation.isPending ? "Saving..." : isLastQuestion ? "Finish" : "Save & Next"}
                  {!isLastQuestion && (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
                disabled={finishMutation.isPending || !hasReachedLast}
                className={`w-full lg:w-auto rounded-xl border px-6 py-2.5 text-sm font-bold transition-all sm:px-8 sm:py-3 sm:text-base ${
                  hasReachedLast
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-slate-200 text-slate-400 cursor-not-allowed"
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
            <div className="overflow-hidden rounded-[2.5rem] border border-emerald-200 bg-emerald-50 p-10 shadow-lg">
              <div className="flex flex-col items-center text-center">
                 <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-emerald-500 text-white shadow-lg shadow-emerald-200">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 </div>
                 <h2 className="text-4xl font-bold text-slate-800">Test Completed</h2>
                 <p className="mt-2 text-xl font-medium text-emerald-600">
                   Score: {attempt?.score || 0} / {attempt?.totalMarks || 0} ({attempt?.percentage || 0}%)
                 </p>
                 {myResult && (
                    <div className="mt-6 rounded-2xl bg-white px-6 py-3 border border-emerald-200 shadow-sm">
                       <span className="text-sm font-bold uppercase tracking-widest text-slate-500">Current Standing</span>
                       <p className="text-2xl font-bold text-slate-800">#{myResult.position} <span className="text-slate-400">/ {ranking.totalParticipants}</span></p>
                    </div>
                 )}
              </div>

              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <button
                  type="button"
                  onClick={() => rankingQuery.refetch()}
                  className="rounded-2xl border border-slate-300 bg-white px-8 py-4 font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Refresh Ranking
                </button>
                <button
                  type="button"
                  onClick={downloadReportCard}
                  className="rounded-2xl border border-indigo-300 bg-indigo-50 px-8 py-4 font-bold text-indigo-600 transition-all hover:bg-indigo-100"
                >
                  Download Report Card (PDF)
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
            <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-200 bg-slate-50 px-10 py-6">
                 <h3 className="text-xl font-bold text-slate-800">Student Leaderboard</h3>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-[400px] p-2 custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      <th className="px-8 py-4">Rank</th>
                      <th className="px-8 py-4">Student</th>
                      <th className="px-8 py-4">Class</th>
                      <th className="px-8 py-4 text-right">Score</th>
                      <th className="px-8 py-4 text-right">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(ranking.ranking || []).slice(0, 30).map((row) => (
                      <tr
                        key={`${row.studentId}-${row.attemptId}`}
                        className={`group transition-colors ${row.studentId === userProfile?.uid ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                      >
                        <td className="px-8 py-5">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold text-sm ${
                            row.position === 1 ? "bg-amber-400 text-white" :
                            row.position === 2 ? "bg-slate-300 text-slate-700" :
                            row.position === 3 ? "bg-orange-300 text-white" :
                            "bg-slate-100 text-slate-500"
                          }`}>
                            {row.position}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{row.studentName}</div>
                          <div className="text-xs text-slate-400">{row.studentId === userProfile?.uid ? "You" : "Verified Student"}</div>
                        </td>
                        <td className="px-8 py-5 text-sm font-medium text-slate-500">{row.className}</td>
                        <td className="px-8 py-5 text-right font-mono font-bold text-slate-800">{row.obtainedMarks}/{row.totalMarks}</td>
                        <td className="px-8 py-5 text-right">
                          <span className={`rounded-lg px-3 py-1 text-sm font-bold ${
                            row.percentage >= 75 ? "bg-emerald-100 text-emerald-700" :
                            row.percentage >= 40 ? "bg-indigo-100 text-indigo-700" :
                            "bg-red-100 text-red-600"
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
            
            {/* Detailed Performance Analysis */}
            <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-200 bg-slate-50 px-10 py-6">
                <h3 className="text-xl font-bold text-slate-800">Detailed Performance Analysis</h3>
                <p className="text-sm text-slate-500 mt-1">Review your answers and compare with correct solutions.</p>
              </div>
              
              <div className="p-10 space-y-6">
                {(attempt?.evaluatedAnswers || []).length > 0 ? (
                  (attempt.evaluatedAnswers).map((ans, idx) => {
                    const questions = detailQuery.data?.questions || [];
                    const qObj = questions.find(q => 
                      (trimText(q.questionId) === trimText(ans.questionId)) || 
                      (toNumber(q.order) === toNumber(ans.questionOrder))
                    );
                    
                    const getOptionText = (q, letter) => {
                      if (!q || !letter) return "";
                      const lIdx = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 }[letter.toUpperCase()];
                      if (Array.isArray(q.options) && lIdx !== undefined && q.options[lIdx]) return q.options[lIdx];
                      return q[`option${letter.toUpperCase()}`] || "";
                    };

                    const studentOptText = qObj && ans.selectedLetter ? getOptionText(qObj, ans.selectedLetter) : "Not Answered";
                    const correctOptText = qObj && ans.correctLetter ? getOptionText(qObj, ans.correctLetter) : "";

                    return (
                      <div key={ans.questionId || idx} className={`rounded-2xl border p-6 transition-all ${ans.isCorrect ? 'border-emerald-100 bg-emerald-50/30' : 'border-rose-100 bg-rose-50/30'}`}>
                        <div className="flex flex-col lg:flex-row justify-between gap-6">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-4">
                              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                                {idx + 1}
                              </span>
                              <span className={`rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wider ${ans.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {ans.isCorrect ? 'Correct' : ans.selectedLetter ? 'Incorrect' : 'Unanswered'}
                              </span>
                            </div>

                            {qObj?.imageUrl && (
                              <div className="mb-4">
                                <img 
                                  src={qObj.imageUrl} 
                                  alt="Question figure" 
                                  className="max-h-[200px] rounded-xl border border-slate-200 bg-white p-2 shadow-sm" 
                                />
                              </div>
                            )}

                            <div 
                              className="text-lg font-medium text-slate-800 mb-6 leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: sanitizeQuestionHtml(qObj?.questionText || "Question text not available") }}
                            />

                            <div className="grid sm:grid-cols-2 gap-4 mt-4">
                              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Your Answer</p>
                                <div className="flex items-start gap-2">
                                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-bold text-xs ${ans.isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                    {ans.selectedLetter || '-'}
                                  </span>
                                  <div className="text-sm font-medium text-slate-700" dangerouslySetInnerHTML={{ __html: sanitizeQuestionHtml(studentOptText) }} />
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Correct Answer</p>
                                <div className="flex items-start gap-2">
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500 font-bold text-xs text-white">
                                    {ans.correctLetter || '?'}
                                  </span>
                                  <div className="text-sm font-medium text-slate-700" dangerouslySetInnerHTML={{ __html: sanitizeQuestionHtml(correctOptText) }} />
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="lg:w-32 flex lg:flex-col items-center lg:items-end justify-between lg:justify-start">
                             <div className="text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Marks</p>
                                <p className="text-xl font-mono font-bold text-slate-800">{ans.marksObtained}/{ans.marks}</p>
                             </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <p className="text-slate-500 font-medium">Detailed analysis is not available for this attempt.</p>
                  </div>
                )}
              </div>
            </div>
          </Motion.section>
        ) : null}
      </div>
      {/* Submit Confirmation Dialog */}
      <AnimatePresence>
        {showSubmitConfirm && (() => {
          const allAnswers = attempt?.answers || [];
          const allFlagged = attempt?.flagged || [];
          
          // Calculate missed questions: questions that are in the test but not in the answers array
          const missed = (test?.questions || []).filter((q, idx) => {
            const qid = q.questionId;
            const hasAns = allAnswers.some(a => {
               const byOrder = a.questionOrder === idx + 1 && a.selectedAnswer;
               const byId = qid && String(a.questionId || "").trim() === String(qid).trim() && a.selectedAnswer;
               return byOrder || byId;
            });
            return !hasAns;
          });

          const flaggedCount = allFlagged.length;
          const hasMissed = missed.length > 0;
          const hasFlagged = flaggedCount > 0;
          
          return (
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
            >
              <Motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-10 shadow-2xl"
              >
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-inner">
                  <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                
                <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Final Submission</h3>
                <p className="mt-2 text-lg text-slate-500">Please review your test status before finishing.</p>

                {(hasMissed || hasFlagged) ? (
                  <div className="mt-8 space-y-4">
                    {hasMissed && (
                      <div className="flex flex-col gap-1 rounded-2xl bg-rose-50 border border-rose-100 p-5">
                        <div className="flex items-center gap-2 text-rose-700 font-bold">
                          <span className="h-3 w-3 rounded-full bg-rose-500 animate-pulse" />
                          {missed.length} Questions Unanswered
                        </div>
                        <p className="text-sm text-rose-600/80">Missing questions will be scored as <span className="font-bold">0 marks</span>. We recommend going back to complete them.</p>
                      </div>
                    )}
                    {hasFlagged && (
                      <div className="flex flex-col gap-1 rounded-2xl bg-amber-50 border border-amber-100 p-5">
                        <div className="flex items-center gap-2 text-amber-700 font-bold">
                          <span className="h-3 w-3 rounded-full bg-amber-400" />
                          {flaggedCount} Questions Flagged
                        </div>
                        <p className="text-sm text-amber-600/80">You marked these for review. If you submit now, the currently selected answers will be finalized.</p>
                      </div>
                    )}
                    
                    <div className="mt-6 rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Important Notice</p>
                      <p className="text-sm text-slate-600 text-center leading-relaxed">
                        Unanswered and flagged questions might impact your final score. 
                        Do you want to <span className="font-bold text-slate-800">Return</span> and complete them, 
                        or <span className="font-bold text-slate-800">Force Submit</span> your current attempt?
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-8 rounded-2xl bg-emerald-50 border border-emerald-100 p-6 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                       <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h4 className="font-bold text-emerald-900 text-lg">Great Work!</h4>
                    <p className="mt-1 text-emerald-700">All questions have been answered. You are ready to submit.</p>
                  </div>
                )}

                <div className="mt-10 flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => setShowSubmitConfirm(false)}
                    className="flex-1 order-2 sm:order-1 rounded-2xl border-2 border-slate-200 bg-white py-4 text-base font-bold text-slate-600 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]"
                  >
                    Return to Test
                  </button>
                  <button
                    onClick={() => { setShowSubmitConfirm(false); finishMutation.mutate("manual"); }}
                    disabled={finishMutation.isPending}
                    className={`flex-1 order-1 sm:order-2 rounded-2xl py-4 text-base font-bold text-white shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 ${
                      hasMissed || hasFlagged 
                        ? "bg-rose-600 shadow-rose-600/20 hover:bg-rose-500" 
                        : "bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-500"
                    }`}
                  >
                    {finishMutation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                        Submitting...
                      </span>
                    ) : (hasMissed || hasFlagged ? "Force Submit" : "Confirm Submit")}
                  </button>
                </div>
              </Motion.div>
            </Motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

export default StudentTestAttempt;
