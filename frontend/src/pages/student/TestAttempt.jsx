import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  downloadStudentTestRankingPdf,
  finishStudentTest,
  getStudentTestById,
  getStudentTestRanking,
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

function StudentTestAttempt() {
  const { testId } = useParams();
  const { userProfile } = useAuth();
  const [attempt, setAttempt] = useState(null);
  const [test, setTest] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const autoFinishRef = useRef(false);
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
      setSelectedAnswer("");
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
      toast.error(error?.response?.data?.message || "Could not save answer");
    },
  });

  const submitCurrentAnswer = () => {
    if (!currentQuestion || !selectedAnswer || submitMutation.isPending) return;
    submitMutation.mutate({
      questionId: currentQuestion.questionId,
      selectedAnswer,
    });
  };

  const inProgress =
    attempt && String(attempt.status || "").toLowerCase() === "in_progress";
  const submitted =
    attempt &&
    ["submitted", "auto_submitted"].includes(
      String(attempt.status || "").toLowerCase()
    );

  useEffect(() => {
    if (!inProgress || !test) return;
    const toMs = (value) => {
      if (!value) return 0;
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    const explicitEndMs = toMs(attempt?.expiresAt) || toMs(test.endAt);
    const durationMinutes = Math.max(0, Number(test.durationMinutes || 0));
    const startedAtMs = toMs(attempt?.startedAt);
    const derivedEndMs =
      startedAtMs && durationMinutes
        ? startedAtMs + durationMinutes * 60 * 1000
        : 0;
    const endTime = explicitEndMs || derivedEndMs;
    if (!endTime) return;

    const tick = () => {
      const now = Date.now() + (serverOffsetMsRef.current || 0);
      const remain = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(remain);
      if (remain > 0 || autoFinishRef.current) return;
      autoFinishRef.current = true;
      finishMutation.mutate("timeout");
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [
    attempt?.expiresAt,
    attempt?.startedAt,
    finishMutation,
    inProgress,
    test?.endAt,
    test?.durationMinutes,
  ]);

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
    return `${test.className || "Entire Center"} | ${test.questionsCount || 0} questions | ${
      test.totalMarks || 0
    } marks`;
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

  if (detailQuery.isLoading && !test) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        Loading test...
      </div>
    );
  }

  if (detailQuery.isError && !test) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        {detailQuery.error?.response?.data?.message || "Failed to load test"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {securityDeactivatedInfo?.deactivated ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Access blocked after {securityDeactivatedInfo.count}/{securityDeactivatedInfo.limit} violations.
          Reason: {securityDeactivatedInfo.reason || "Security policy violation"}.
        </div>
      ) : null}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="font-heading text-2xl text-slate-900">{test?.title || "Test"}</h1>
        <p className="mt-1 text-sm text-slate-500">{headerMeta}</p>
        {inProgress ? (
          <p className="mt-2 text-sm font-semibold text-primary">
            Time left: {formatSeconds(timeLeft)}
          </p>
        ) : null}
      </section>

      {!attempt && !submitted ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">
            Start this test during the scheduled window. You cannot go back to previous
            questions once answered.
          </p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
          >
            {startMutation.isPending ? "Starting..." : "Start Test"}
          </button>
        </section>
      ) : null}

      {inProgress && currentQuestion ? (
        <section className="quiz-content protected-zone rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <WatermarkOverlay
            user={{
              uid: userProfile?.uid,
              email: userProfile?.email,
              fullName: userProfile?.fullName || userProfile?.name,
            }}
          />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Question {Number(attempt?.currentIndex || 0) + 1} of {attempt?.totalQuestions || 0}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            {currentQuestion.questionText}
          </h2>
          <div className="mt-4 space-y-2">
            {(currentQuestion.options || []).map((option) => (
              <label
                key={`${currentQuestion.questionId}-${option}`}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  selectedAnswer === option
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-slate-200 text-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name={currentQuestion.questionId}
                  value={option}
                  checked={selectedAnswer === option}
                  onChange={() => setSelectedAnswer(option)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={submitCurrentAnswer}
              disabled={!selectedAnswer || submitMutation.isPending}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitMutation.isPending ? "Saving..." : "Next Question"}
            </button>
            <button
              type="button"
              onClick={() => finishMutation.mutate("manual")}
              disabled={finishMutation.isPending}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Submit Test
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            One-way progression enabled: previous questions cannot be reopened.
          </p>
        </section>
      ) : null}

      {submitted ? (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h2 className="font-heading text-xl text-emerald-800">Test Submitted</h2>
          <p className="mt-1 text-sm text-emerald-700">
            Obtained: {attempt?.score || 0}/{attempt?.totalMarks || 0} (
            {attempt?.percentage || 0}%)
          </p>
          {myResult ? (
            <p className="mt-1 text-sm font-semibold text-emerald-800">
              Rank: {myResult.ordinalPosition} out of {ranking.totalParticipants || 0}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => rankingQuery.refetch()}
              className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800"
            >
              Refresh Ranking
            </button>
            <button
              type="button"
              onClick={downloadRanking}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Download Ranking PDF
            </button>
            <Link
              to="/student/tests"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Back to Tests
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-emerald-100 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-emerald-50 text-emerald-700">
                <tr>
                  <th className="px-3 py-2">Pos</th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Marks</th>
                  <th className="px-3 py-2">%</th>
                </tr>
              </thead>
              <tbody>
                {(ranking.ranking || []).slice(0, 30).map((row) => (
                  <tr
                    key={`${row.studentId}-${row.attemptId}`}
                    className={`border-t border-emerald-100 ${
                      row.studentId === userProfile?.uid ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2">{row.position}</td>
                    <td className="px-3 py-2">{row.studentName}</td>
                    <td className="px-3 py-2">{row.className}</td>
                    <td className="px-3 py-2">
                      {row.obtainedMarks}/{row.totalMarks}
                    </td>
                    <td className="px-3 py-2">{row.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default StudentTestAttempt;
