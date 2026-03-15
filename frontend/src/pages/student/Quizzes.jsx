import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Skeleton } from "../../components/Skeleton.jsx";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const tabs = ["All", "Available", "In Progress", "Completed", "Missed"];

const quizzes = [
  {
    id: 1,
    title: "Genetics Quiz",
    course: "Biology Masterclass XI",
    questions: 20,
    time: "25 min",
    passScore: 60,
    due: "2026-03-18",
    status: "Available",
  },
  {
    id: 2,
    title: "Organic Chemistry Drill",
    course: "Chemistry Quick Revision",
    questions: 15,
    time: "20 min",
    passScore: 55,
    due: "2026-03-14",
    status: "In Progress",
  },
  {
    id: 3,
    title: "Mechanics Test",
    course: "Physics Practice Lab",
    questions: 18,
    time: "22 min",
    passScore: 65,
    due: "2026-03-10",
    status: "Completed",
    score: 85,
    correct: 15,
    wrong: 2,
    skipped: 1,
    timeTaken: "18 min",
  },
  {
    id: 4,
    title: "Grammar Check",
    course: "English Essay Clinic",
    questions: 12,
    time: "15 min",
    passScore: 50,
    due: "2026-03-08",
    status: "Missed",
    score: 0,
  },
];

const statusStyles = {
  Available: {
    bar: "bg-blue-500",
    badge: "bg-blue-50 text-blue-600",
  },
  "In Progress": {
    bar: "bg-amber-400",
    badge: "bg-amber-50 text-amber-600",
  },
  Completed: {
    bar: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-600",
  },
  Missed: {
    bar: "bg-rose-500",
    badge: "bg-rose-50 text-rose-600",
  },
};

function StudentQuizzes() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [resultQuiz, setResultQuiz] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const counts = useMemo(() => {
    return {
      All: quizzes.length,
      Available: quizzes.filter((q) => q.status === "Available").length,
      "In Progress": quizzes.filter((q) => q.status === "In Progress").length,
      Completed: quizzes.filter((q) => q.status === "Completed").length,
      Missed: quizzes.filter((q) => q.status === "Missed").length,
    };
  }, []);

  const filtered = useMemo(() => {
    if (activeTab === "All") return quizzes;
    return quizzes.filter((quiz) => quiz.status === activeTab);
  }, [activeTab]);

  const isDueSoon = (dateStr) => {
    const dueDate = new Date(dateStr);
    const now = new Date();
    const diff = (dueDate - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  };

  const isOverdue = (dateStr) => new Date(dateStr) < new Date();

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Quizzes</h1>
      </motion.section>

      <motion.section {...fadeUp} className="flex flex-wrap items-center gap-3">
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
      </motion.section>

      <motion.section {...fadeUp} className="space-y-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`quiz-skel-${index}`}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-4 h-4 w-2/3" />
              <Skeleton className="mt-4 h-10 w-full" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No quizzes found in this tab.
          </div>
        ) : (
          filtered.map((quiz) => {
            const statusStyle = statusStyles[quiz.status];
            const overdue = quiz.status !== "Completed" && isOverdue(quiz.due);
            return (
              <div
                key={quiz.id}
                className="flex flex-wrap items-start gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <span className={`h-full w-1 rounded-full ${statusStyle.bar}`} />
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-heading text-lg text-slate-900">
                      {quiz.title}
                    </h3>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                      {quiz.course}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span>{quiz.questions} questions</span>
                    <span>{quiz.time}</span>
                    <span>Pass {quiz.passScore}%</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span
                      className={`rounded-full px-3 py-1 ${
                        overdue
                          ? "bg-rose-50 text-rose-600"
                          : isDueSoon(quiz.due)
                            ? "bg-amber-50 text-amber-600"
                            : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      Due {quiz.due}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle.badge}`}
                    >
                      {quiz.status}
                    </span>
                    {quiz.status === "Completed" && (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          quiz.score >= quiz.passScore
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        {quiz.score}% — {quiz.score >= quiz.passScore ? "Passed" : "Failed"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {quiz.status === "Available" && (
                    <Link className="btn-primary" to="/student/quiz-attempt">
                      Start Quiz
                    </Link>
                  )}
                  {quiz.status === "In Progress" && (
                    <Link className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white" to="/student/quiz-attempt">
                      Continue Quiz
                    </Link>
                  )}
                  {quiz.status === "Completed" && (
                    <button
                      className="btn-outline"
                      onClick={() => setResultQuiz(quiz)}
                    >
                      View Results
                    </button>
                  )}
                  {quiz.status === "Missed" && (
                    <button
                      className="rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-white opacity-60"
                      disabled
                    >
                      Missed
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </motion.section>

      {resultQuiz && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setResultQuiz(null)}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-2xl text-slate-900">
                  {resultQuiz.title}
                </h3>
                <p className="text-sm text-slate-500">{resultQuiz.course}</p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                onClick={() => setResultQuiz(null)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary/20">
                <span className="text-xl font-semibold text-slate-900">
                  {resultQuiz.score}%
                </span>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  resultQuiz.score >= resultQuiz.passScore
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {resultQuiz.score >= resultQuiz.passScore ? "Passed" : "Failed"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-slate-500">Correct</p>
                <p className="text-lg font-semibold text-slate-900">
                  {resultQuiz.correct}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-slate-500">Wrong</p>
                <p className="text-lg font-semibold text-slate-900">
                  {resultQuiz.wrong}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-slate-500">Skipped</p>
                <p className="text-lg font-semibold text-slate-900">
                  {resultQuiz.skipped}
                </p>
              </div>
            </div>
            <div className="mt-4 text-sm text-slate-500">
              Time taken: {resultQuiz.timeTaken}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button className="btn-outline">Review Answers</button>
              <button className="btn-primary" onClick={() => setResultQuiz(null)}>
                Back to Quizzes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default StudentQuizzes;
