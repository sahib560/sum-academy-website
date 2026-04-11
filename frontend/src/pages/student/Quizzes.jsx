import { useMemo, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../../components/Skeleton.jsx";
import { getStudentQuizzes } from "../../services/student.service.js";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const tabs = ["Available", "Attempted", "Expired"];

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeStatus = (value = "") => {
  const status = String(value || "").trim().toLowerCase();
  if (!status) return "available";
  return status;
};

const toTitle = (value = "") => {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "Unknown";
  return `${text[0].toUpperCase()}${text.slice(1)}`;
};

const resolveDisplayStatus = (quiz = {}) => {
  const raw = normalizeStatus(quiz.status);
  if (raw === "expired") return "expired";
  if (raw === "partial" || raw === "pending_review") return "partial";
  if (["attempted", "passed", "failed"].includes(raw)) return "attempted";
  if (raw === "available") return "available";
  return "available";
};

const statusStyles = {
  available: {
    bar: "bg-blue-500",
    badge: "bg-blue-50 text-blue-600",
  },
  attempted: {
    bar: "bg-slate-500",
    badge: "bg-slate-100 text-slate-700",
  },
  partial: {
    bar: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700",
  },
  expired: {
    bar: "bg-rose-400",
    badge: "bg-rose-50 text-rose-700",
  },
};

function StudentQuizzes() {
  const [activeTab, setActiveTab] = useState("Available");
  const [resultPreview, setResultPreview] = useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student-quizzes"],
    queryFn: () => getStudentQuizzes(),
    staleTime: 30000,
  });

  const quizzes = useMemo(
    () =>
      (Array.isArray(data) ? data : []).map((quiz, index) => {
        const now = new Date();
        const dueDateRaw =
          quiz?.dueDate || quiz?.dueAt || quiz?.assignment?.dueAt || quiz?.lastAttempt?.dueAt || "";
        const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
        const dueExpired = dueDate && !Number.isNaN(dueDate.getTime()) && now > dueDate;
        const displayStatus = dueExpired ? "expired" : resolveDisplayStatus(quiz);
        const lastScore = toNumber(quiz.lastAttempt?.score, 0);
        const passScore = toNumber(quiz.passScore, 50);
        const scorePercent = toNumber(quiz.lastAttempt?.percentage, lastScore);
        return {
          id: quiz.id || `quiz-${index}`,
          title: quiz.title || "Quiz",
          courseName: quiz.courseName || "Course",
          subjectName: quiz.subjectName || "Subject",
          scope: String(quiz.scope || "subject").toLowerCase(),
          questionsCount: Math.max(0, toNumber(quiz.questionsCount, 0)),
          totalMarks: Math.max(0, toNumber(quiz.totalMarks, 0)),
          passScore,
          displayStatus,
          dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toISOString() : null,
          isPastDue: Boolean(quiz.isPastDue),
          lastAttempt: quiz.lastAttempt || null,
          scorePercent,
        };
      }),
    [data]
  );

  const counts = useMemo(
    () => ({
      Available: quizzes.filter((quiz) => quiz.displayStatus === "available").length,
      Attempted: quizzes.filter(
        (quiz) => quiz.displayStatus === "attempted" || quiz.displayStatus === "partial"
      ).length,
      Expired: quizzes.filter((quiz) => quiz.displayStatus === "expired").length,
    }),
    [quizzes]
  );

  const filtered = useMemo(() => {
    if (activeTab === "Available") {
      return quizzes.filter((quiz) => quiz.displayStatus === "available");
    }
    if (activeTab === "Expired") {
      return quizzes.filter((quiz) => quiz.displayStatus === "expired");
    }
    return quizzes.filter(
      (quiz) => quiz.displayStatus === "attempted" || quiz.displayStatus === "partial"
    );
  }, [activeTab, quizzes]);

  return (
    <div className="space-y-6">
      <Motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Quizzes</h1>
      </Motion.section>

      {isError && (
        <Motion.section
          {...fadeUp}
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error?.response?.data?.message || error?.message || "Failed to load quizzes"}
        </Motion.section>
      )}

      <Motion.section {...fadeUp} className="flex flex-wrap items-center gap-3">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              activeTab === tab
                ? "bg-primary text-white"
                : "border border-slate-200 text-slate-600"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
              {counts[tab]}
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
            No quizzes available yet
          </div>
        ) : (
          filtered.map((quiz) => {
            const style = statusStyles[quiz.displayStatus] || statusStyles.available;
            const isPartial = quiz.displayStatus === "partial";
            const isAvailable = quiz.displayStatus === "available";
            const isAttempted = quiz.displayStatus === "attempted";
            const isExpired = quiz.displayStatus === "expired";
            return (
              <article
                key={quiz.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex">
                  <span className={`w-1.5 ${style.bar}`} />
                  <div className="flex-1 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-heading text-lg font-semibold text-slate-900">
                        {quiz.title}
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}
                      >
                        {isPartial
                          ? "Partial"
                          : isExpired
                            ? "Expired"
                          : quiz.displayStatus === "attempted"
                            ? "Attempted"
                            : toTitle(quiz.displayStatus)}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                        {quiz.courseName}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                        {quiz.subjectName}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                        {quiz.scope === "chapter" ? "Chapter" : "Full Subject"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span>{quiz.questionsCount} Questions</span>
                      <span>{quiz.totalMarks} Marks</span>
                    </div>

                    {(isAttempted || isPartial) && (
                      <div className="mt-3">
                        {isPartial ? (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            Awaiting teacher review
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {Math.round(quiz.scorePercent)}%
                          </span>
                        )}
                      </div>
                    )}
                    {isExpired && !quiz.lastAttempt ? (
                      <div className="mt-3">
                        <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                          Quiz ended {quiz.dueDate ? new Date(quiz.dueDate).toLocaleString() : "already"}
                        </span>
                      </div>
                    ) : null}

                    <div className="mt-4">
                      {isAvailable ? (
                        <Link
                          className="inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white"
                          to={`/student/quizzes/${quiz.id}/attempt`}
                        >
                          Start Quiz
                        </Link>
                      ) : isPartial ? (
                        <button
                          className="inline-flex cursor-not-allowed rounded-full bg-amber-200 px-4 py-2 text-xs font-semibold text-amber-800"
                          disabled
                        >
                          Pending Review
                        </button>
                      ) : isExpired ? (
                        quiz.lastAttempt ? (
                          <button
                            className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                            onClick={() => setResultPreview(quiz)}
                          >
                            View Result
                          </button>
                        ) : (
                          <button
                            className="inline-flex cursor-not-allowed rounded-full bg-rose-100 px-4 py-2 text-xs font-semibold text-rose-700"
                            disabled
                          >
                            Expired
                          </button>
                        )
                      ) : (
                        <button
                          className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                          onClick={() => setResultPreview(quiz)}
                        >
                          View Result
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </Motion.section>

      <AnimatePresence>
        {resultPreview && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
            <button
              className="absolute inset-0 bg-slate-900/50"
              onClick={() => setResultPreview(null)}
              aria-label="Close results preview"
            />
            <Motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            >
              <h3 className="font-heading text-xl text-slate-900">{resultPreview.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{resultPreview.courseName}</p>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-600">
                  Score: {Math.round(resultPreview.scorePercent)}%
                </p>
                {resultPreview.lastAttempt?.submittedAt && (
                  <p className="mt-2 text-xs text-slate-500">
                    Submitted {new Date(resultPreview.lastAttempt.submittedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="mt-5 flex justify-end">
                <button className="btn-outline" onClick={() => setResultPreview(null)}>
                  Close
                </button>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default StudentQuizzes;
