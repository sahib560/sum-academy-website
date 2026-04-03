import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../../components/Skeleton.jsx";
import { getTeacherQuizzes } from "../../services/teacher.service.js";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.35 },
};

const formatDateTime = (value) => {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleString();
};

function TeacherMyQuizzes() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeBase = location.pathname.startsWith("/admin") ? "/admin/quizzes" : "/teacher/quizzes";
  const [search, setSearch] = useState("");

  const quizzesQuery = useQuery({
    queryKey: ["teacher-quizzes"],
    queryFn: getTeacherQuizzes,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const quizzes = Array.isArray(quizzesQuery.data) ? quizzesQuery.data : [];

  const filteredQuizzes = useMemo(() => {
    const needle = String(search || "").trim().toLowerCase();
    if (!needle) return quizzes;
    return quizzes.filter((quiz) =>
      [
        quiz.title,
        quiz.courseName,
        quiz.subjectName,
        quiz.chapterTitle,
        quiz.scope,
      ]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(needle))
    );
  }, [quizzes, search]);

  return (
    <div className="space-y-6">
      <Motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl text-slate-900">My Quizzes</h2>
            <p className="mt-1 text-sm text-slate-500">
              Open any quiz to manage assignment, analytics, and grading.
            </p>
          </div>
          <Link to={routeBase} className="btn-primary">
            Create Quiz
          </Link>
        </div>

        <div className="mt-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by quiz title, course, subject..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </Motion.section>

      <Motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {quizzesQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredQuizzes.length < 1 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No quizzes found.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuizzes.map((quiz) => (
              <button
                key={quiz.id}
                type="button"
                onClick={() => navigate(`${routeBase}/detail/${quiz.id}`)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{quiz.title}</p>
                  <span className="text-xs text-slate-500">
                    {quiz.scope === "chapter" ? "Chapter-wise" : "Subject-wise"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {quiz.courseName} | {quiz.subjectName}
                  {quiz.chapterTitle ? ` | ${quiz.chapterTitle}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    {quiz.questionCount || 0} questions
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    {quiz.totalMarks || 0} marks
                  </span>
                  <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-600">
                    Due: {formatDateTime(quiz.assignment?.dueAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Motion.section>
    </div>
  );
}

export default TeacherMyQuizzes;
