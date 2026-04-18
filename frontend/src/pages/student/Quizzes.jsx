import { useMemo, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../../components/Skeleton.jsx";
import { getStudentQuizzes, getStudentScheduledQuizzes } from "../../services/student.service.js";
import { useAuth } from "../../hooks/useAuth.js";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const tabs = ["Available", "Upcoming", "Attempted", "Missed"];

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeStatus = (value = "") => {
  const status = String(value || "").trim().toLowerCase();
  return status || "available";
};

const normalizeQuizKind = (quiz = {}) => {
  const kind = String(quiz?.kind || quiz?.quizKind || quiz?.type || "").trim().toLowerCase();
  if (kind.includes("scheduled")) return "scheduled";
  return "classic";
};

const formatDate = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const isWithinDays = (dateIso, days = 3) => {
  if (!dateIso) return false;
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return false;
  const diffMs = parsed.getTime() - Date.now();
  return diffMs > 0 && diffMs <= days * 24 * 60 * 60 * 1000;
};

const QuizResultCard = ({ result, quiz, studentName }) => {
  const isPassed = Boolean(result?.isPassed);
  const rank = toNumber(result?.rank, 0) || 1;
  const total = toNumber(result?.totalAttempts, 0) || 1;

  const getRankSuffix = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  const getRankColor = (rankValue, totalValue) => {
    const pct = rankValue / Math.max(totalValue, 1);
    if (rankValue === 1) return "#FFD700";
    if (rankValue === 2) return "#C0C0C0";
    if (rankValue === 3) return "#CD7F32";
    if (pct <= 0.1) return "#4a63f5";
    if (pct <= 0.25) return "#16a34a";
    return "#64748b";
  };

  const rankColor = getRankColor(rank, total);
  const percentage = Math.round(toNumber(result?.percentage, 0));

  return (
    <div
      style={{
        background: "#0d0f1a",
        borderRadius: "24px",
        padding: "0",
        maxWidth: "520px",
        margin: "0 auto",
        overflow: "hidden",
        border: `1px solid ${isPassed ? "#16a34a33" : "#dc262633"}`,
        boxShadow: `0 0 40px ${
          isPassed ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)"
        }`,
      }}
    >
      <div
        style={{
          background: isPassed
            ? "linear-gradient(135deg, #16a34a22, #16a34a11)"
            : "linear-gradient(135deg, #dc262622, #dc262611)",
          padding: "28px 32px 24px",
          textAlign: "center",
          borderBottom: `1px solid ${isPassed ? "#16a34a22" : "#dc262622"}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-40px",
            right: "-40px",
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            background: isPassed ? "#16a34a" : "#dc2626",
            opacity: 0.06,
          }}
        />

        <div
          style={{
            width: "40px",
            height: "40px",
            background: "#4a63f5",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <span
            style={{
              color: "#fff",
              fontWeight: "800",
              fontSize: "18px",
              fontFamily: "Georgia",
            }}
          >
            S
          </span>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: isPassed ? "rgba(22,163,74,0.15)" : "rgba(220,38,38,0.15)",
            color: isPassed ? "#4ade80" : "#f87171",
            padding: "5px 18px",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: "700",
            border: `1px solid ${isPassed ? "#16a34a44" : "#dc262644"}`,
            marginBottom: "12px",
            letterSpacing: "1px",
          }}
        >
          {isPassed ? "PASSED" : "FAILED"}
        </div>

        <h2
          style={{
            color: "#fff",
            fontSize: "20px",
            fontWeight: "700",
            margin: "0 0 4px",
          }}
        >
          {studentName}
        </h2>
        <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>{quiz?.title}</p>
      </div>

      <div
        style={{
          padding: "28px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "32px",
          borderBottom: "1px solid #1e293b",
        }}
      >
        <div style={{ position: "relative", width: "120px", height: "120px" }}>
          <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="#1e293b" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke={isPassed ? "#16a34a" : "#dc2626"}
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={`${2 * Math.PI * 52 * (1 - percentage / 100)}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1.5s ease" }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#fff", fontSize: "26px", fontWeight: "800", lineHeight: 1 }}>
              {percentage}%
            </span>
            <span style={{ color: "#64748b", fontSize: "10px", marginTop: "2px" }}>
              SCORE
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[
            {
              label: "Marks",
              value: `${toNumber(result?.autoScore, 0)} / ${toNumber(result?.totalMarks, 0)}`,
              color: "#fff",
            },
            {
              label: "Pass Mark",
              value: `${toNumber(quiz?.passScore, 70)}%`,
              color: "#64748b",
            },
            {
              label: "Time Limit",
              value: quiz?.timeLimit ? `${quiz.timeLimit} mins` : "-",
              color: "#64748b",
            },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: "left" }}>
              <div
                style={{
                  color: "#475569",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {label}
              </div>
              <div style={{ color, fontSize: "16px", fontWeight: "700" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 32px", borderBottom: "1px solid #1e293b" }}>
        <p
          style={{
            color: "#475569",
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "16px",
            textAlign: "center",
          }}
        >
          Your Ranking
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "24px" }}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: `${rankColor}22`,
                border: `3px solid ${rankColor}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 8px",
              }}
            >
              <span style={{ color: rankColor, fontSize: "24px", fontWeight: "800", lineHeight: 1 }}>
                {rank}
              </span>
              <span style={{ color: rankColor, fontSize: "11px", fontWeight: "600" }}>
                {getRankSuffix(rank)}
              </span>
            </div>
            <span style={{ color: "#64748b", fontSize: "11px" }}>Your Rank</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { label: "Total Students", value: total, color: "#94a3b8" },
              { label: "Top Score", value: `${Math.round(toNumber(result?.topScore, 0))}%`, color: "#4a63f5" },
              { label: "Class Average", value: `${Math.round(toNumber(result?.avgScore, 0))}%`, color: "#ff6f0f" },
              { label: "Passed", value: toNumber(result?.passingCount, 0), color: "#16a34a" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#475569", fontSize: "11px", minWidth: "90px" }}>{label}:</span>
                <span style={{ color, fontSize: "12px", fontWeight: "700" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "10px",
              color: "#475569",
              marginBottom: "6px",
            }}
          >
            <span>Rank #{rank}</span>
            <span>of {total} students</span>
          </div>
          <div style={{ height: "6px", background: "#1e293b", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: "3px",
                background: rankColor,
                width: `${100 - ((rank - 1) / Math.max(total - 1, 1)) * 100}%`,
                transition: "width 1s ease",
              }}
            />
          </div>
        </div>
      </div>

      {toNumber(result?.shortAnswerPending, 0) > 0 ? (
        <div
          style={{
            margin: "16px 20px 0",
            background: "rgba(255,111,15,0.08)",
            border: "1px solid #ff6f0f33",
            borderRadius: "12px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#ff6f0f",
              animation: "pulse 1.5s infinite",
            }}
          />
          <p style={{ color: "#ff6f0f", fontSize: "12px", margin: 0 }}>
            {toNumber(result?.shortAnswerPending, 0)} short answer(s) pending teacher review. Score may increase.
          </p>
        </div>
      ) : null}

      <style>{`
        @keyframes pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
};

function StudentQuizzes() {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("Available");
  const [resultPreview, setResultPreview] = useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student-quizzes", "unified"],
    queryFn: async () => {
      const [classic, scheduled] = await Promise.all([
        getStudentQuizzes().catch(() => []),
        getStudentScheduledQuizzes().catch(() => []),
      ]);
      return {
        classic: Array.isArray(classic) ? classic : [],
        scheduled: Array.isArray(scheduled) ? scheduled : [],
      };
    },
    staleTime: 30000,
  });

  const quizzes = useMemo(() => {
    const classicRows = Array.isArray(data?.classic) ? data.classic : [];
    const scheduledRows = Array.isArray(data?.scheduled) ? data.scheduled : [];

    const mappedClassic = classicRows.map((quiz, index) => {
      const dueRaw = quiz?.dueDate || quiz?.dueAt || quiz?.assignment?.dueAt || "";
      const due = dueRaw ? new Date(dueRaw) : null;
      const dueIso = due && !Number.isNaN(due.getTime()) ? due.toISOString() : null;
      const expired = Boolean(quiz?.isPastDue) || (due && due.getTime() < Date.now());
      const status = normalizeStatus(quiz.status);
      const attempted = Boolean(quiz.lastAttempt);
      const lastAttemptStatus = normalizeStatus(quiz.lastAttempt?.status);
      const isPartial = attempted && ["pending_review", "partial"].includes(lastAttemptStatus);

      const displayStatus = attempted ? (isPartial ? "partial" : "attempted") : expired ? "missed" : "available";
      const assignmentBadge = String(quiz.assignmentBadge || "");

      return {
        kind: normalizeQuizKind(quiz),
        id: quiz.id || `quiz-${index}`,
        title: quiz.title || "Quiz",
        courseName: quiz.courseName || "Course",
        subjectName: quiz.subjectName || "Subject",
        questionsCount: Math.max(0, toNumber(quiz.questionsCount, 0)),
        totalMarks: Math.max(0, toNumber(quiz.totalMarks, 0)),
        passScore: toNumber(quiz.passScore, 50),
        timeLimit: Math.max(0, toNumber(quiz.timeLimit, 0)),
        startAtIso: null,
        endAtIso: dueIso,
        dueIso,
        canAttempt: displayStatus === "available",
        assignmentBadge,
        assignedTo: quiz.assignedTo || null,
        isAssignedToYou: Boolean(quiz.isAssignedToYou),
        displayStatus,
        lastAttempt: quiz.lastAttempt || null,
      };
    });

    const mappedScheduled = scheduledRows.map((quiz, index) => {
      const startAt = quiz?.startAt ? new Date(quiz.startAt) : null;
      const endAt = quiz?.endAt ? new Date(quiz.endAt) : null;
      const startAtIso = startAt && !Number.isNaN(startAt.getTime()) ? startAt.toISOString() : null;
      const endAtIso = endAt && !Number.isNaN(endAt.getTime()) ? endAt.toISOString() : null;
      const status = normalizeStatus(quiz.status);
      const attempted = Boolean(quiz.lastAttempt) || Boolean(quiz.submitted);
      const lastAttemptStatus = normalizeStatus(quiz.lastAttempt?.status);
      const isPartial = attempted && ["pending_review", "partial"].includes(lastAttemptStatus);

      let displayStatus = "available";
      if (attempted) displayStatus = isPartial ? "partial" : "attempted";
      else if (status === "upcoming") displayStatus = "upcoming";
      else if (status === "missed") displayStatus = "missed";
      else if (status === "completed") displayStatus = "attempted";
      else displayStatus = "available";

      const subjectNames = Array.isArray(quiz.subjectNames) ? quiz.subjectNames.filter(Boolean) : [];
      const subjectName = subjectNames.length > 1 ? `${subjectNames[0]} +${subjectNames.length - 1}` : subjectNames[0] || "Subjects";
      const courseName = "Scheduled Quiz";

      const questionCount = Math.max(0, toNumber(quiz.questionCount, 0));
      const marksPerQuestion = 1;
      const totalMarks = questionCount * marksPerQuestion;

      return {
        kind: "scheduled",
        id: quiz.id || `scheduled-${index}`,
        title: quiz.title || "Scheduled Quiz",
        courseName,
        subjectName,
        questionsCount: questionCount,
        totalMarks,
        passScore: toNumber(quiz.passScore, 50),
        timeLimit: 0,
        startAtIso,
        endAtIso,
        dueIso: endAtIso,
        canAttempt: Boolean(quiz.canAttempt) && displayStatus === "available",
        assignmentBadge: "scheduled",
        assignedTo: "scheduled",
        isAssignedToYou: true,
        displayStatus,
        lastAttempt: quiz.lastAttempt || null,
      };
    });

    return [...mappedScheduled, ...mappedClassic].sort((a, b) => {
      const aTime = a.startAtIso ? new Date(a.startAtIso).getTime() : a.dueIso ? new Date(a.dueIso).getTime() : 0;
      const bTime = b.startAtIso ? new Date(b.startAtIso).getTime() : b.dueIso ? new Date(b.dueIso).getTime() : 0;
      return bTime - aTime;
    });
  }, [data]);

  const counts = useMemo(
    () => ({
      Available: quizzes.filter((q) => q.displayStatus === "available").length,
      Upcoming: quizzes.filter((q) => q.displayStatus === "upcoming").length,
      Attempted: quizzes.filter((q) => q.displayStatus === "attempted" || q.displayStatus === "partial").length,
      Missed: quizzes.filter((q) => q.displayStatus === "missed").length,
    }),
    [quizzes]
  );

  const filtered = useMemo(() => {
    if (activeTab === "Available") return quizzes.filter((q) => q.displayStatus === "available");
    if (activeTab === "Upcoming") return quizzes.filter((q) => q.displayStatus === "upcoming");
    if (activeTab === "Missed") return quizzes.filter((q) => q.displayStatus === "missed");
    return quizzes.filter((q) => q.displayStatus === "attempted" || q.displayStatus === "partial");
  }, [activeTab, quizzes]);

  const resolveAssignmentPill = (quiz) => {
    if (quiz.assignmentBadge === "scheduled" || quiz.kind === "scheduled") {
      return { label: "Scheduled", className: "bg-violet-50 text-violet-700 border-violet-200" };
    }
    if (quiz.assignmentBadge === "assigned_to_you" || quiz.isAssignedToYou) {
      return { label: "Assigned to you", className: "bg-blue-50 text-blue-700 border-blue-200" };
    }
    if (quiz.assignmentBadge === "class_assignment" || quiz.assignedTo === "all_class") {
      return { label: "Class Assignment", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    }
    return { label: "Assignment", className: "bg-slate-100 text-slate-700 border-slate-200" };
  };

  return (
    <div className="space-y-6">
      <Motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Quizzes</h1>
      </Motion.section>

      {isError ? (
        <Motion.section
          {...fadeUp}
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error?.response?.data?.message || error?.message || "Failed to load quizzes"}
        </Motion.section>
      ) : null}

      <Motion.section {...fadeUp} className="flex flex-wrap items-center gap-3">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab ? "bg-primary text-white" : "bg-white text-slate-700 shadow-sm"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}{" "}
            <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {counts[tab] ?? 0}
            </span>
          </button>
        ))}
      </Motion.section>

      <Motion.section {...fadeUp} className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`quiz-skel-${index}`}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-4 h-4 w-2/3" />
              <Skeleton className="mt-3 h-10 w-full rounded-xl" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No quizzes found
          </div>
        ) : (
          filtered.map((quiz) => {
            const isPartial = quiz.displayStatus === "partial";
            const isAvailable = quiz.displayStatus === "available";
            const isUpcoming = quiz.displayStatus === "upcoming";
            const isAttempted = quiz.displayStatus === "attempted";
            const isMissed = quiz.displayStatus === "missed";

            const dueText = quiz.dueIso ? formatDate(quiz.dueIso) : "";
            const dueColor = isMissed
              ? "text-rose-700"
              : isWithinDays(quiz.dueIso, 3)
                ? "text-amber-700"
                : "text-slate-500";

            const assignmentPill = resolveAssignmentPill(quiz);
            const last = quiz.lastAttempt || {};

            return (
              <article key={quiz.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-slate-900">{quiz.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {quiz.courseName} | {quiz.subjectName}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${assignmentPill.className}`}>
                        {assignmentPill.label}
                      </span>
                      {quiz.timeLimit ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                          {quiz.timeLimit} mins
                        </span>
                      ) : null}
                      {quiz.dueIso ? (
                        <span className={`rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold ${dueColor}`}>
                          {isUpcoming
                            ? `Starts: ${formatDate(quiz.startAtIso || quiz.dueIso)}`
                            : isMissed
                              ? "Missed"
                              : `Due: ${dueText}`}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                          No due date
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isAvailable ? (
                      quiz.kind === "scheduled" ? (
                        <Link
                          className="inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white"
                          to={`/student/scheduled-quizzes/${quiz.id}/attempt`}
                        >
                          Start Quiz
                        </Link>
                      ) : (
                        <Link
                          className="inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white"
                          to={`/student/quizzes/${quiz.id}/attempt`}
                        >
                          Start Quiz
                        </Link>
                      )
                    ) : (isMissed || isUpcoming) && !quiz.lastAttempt ? (
                      <button
                        type="button"
                        className="inline-flex cursor-not-allowed rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500"
                        disabled
                      >
                        {isUpcoming ? "Upcoming" : "Missed"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                        onClick={() => setResultPreview(quiz)}
                      >
                        View Results
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
                  <span className="rounded-full bg-slate-50 px-3 py-1">
                    {quiz.questionsCount} questions
                  </span>
                  <span className="rounded-full bg-slate-50 px-3 py-1">{quiz.totalMarks} marks</span>
                  <span className="rounded-full bg-slate-50 px-3 py-1">Pass {quiz.passScore}%</span>
                </div>

                {isAttempted || isPartial ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900">
                        {isPartial ? "Pending Review" : "Your Result"}
                      </div>
                      {isPartial ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          Pending Review
                        </span>
                      ) : (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            last.isPassed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {last.isPassed ? "Passed" : "Failed"}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                      <span>Score: {Math.round(toNumber(last.percentage, 0))}%</span>
                      <span>Rank: #{toNumber(last.rank, 0) || "-"}</span>
                      {last.submittedAt ? <span>Submitted: {formatDate(last.submittedAt)}</span> : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </Motion.section>

      <AnimatePresence>
        {resultPreview ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
            <button
              className="absolute inset-0 bg-slate-900/60"
              onClick={() => setResultPreview(null)}
              aria-label="Close results preview"
            />
            <Motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="relative z-10 w-full max-w-xl"
            >
              <QuizResultCard
                result={resultPreview.lastAttempt || {}}
                quiz={resultPreview}
                studentName={
                  userProfile?.fullName ||
                  userProfile?.name ||
                  userProfile?.displayName ||
                  "Student"
                }
              />
              <div className="mt-4 flex justify-center">
                <button className="btn-outline" onClick={() => setResultPreview(null)}>
                  Close
                </button>
              </div>
            </Motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default StudentQuizzes;
