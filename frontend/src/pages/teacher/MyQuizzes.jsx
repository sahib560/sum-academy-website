import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../../components/Skeleton.jsx";
import {
  getTeacherQuizzes,
  getTeacherQuizById,
  getTeacherQuizAnalytics,
  getTeacherQuizSubmissions,
} from "../../services/teacher.service.js";

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

const normalizeStatus = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");

const getQuestionOptions = (question = {}) => {
  if (Array.isArray(question.options)) {
    return question.options.filter(Boolean);
  }
  if (question.options && typeof question.options === "object") {
    return ["A", "B", "C", "D", "E", "F"]
      .map((key) => question.options[key])
      .filter(Boolean);
  }
  return [
    question.optionA,
    question.optionB,
    question.optionC,
    question.optionD,
    question.optionE,
    question.optionF,
  ].filter(Boolean);
};

function TeacherMyQuizzes() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeBase = location.pathname.startsWith("/admin") ? "/admin/quizzes" : "/teacher/quizzes";
  const [search, setSearch] = useState("");
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!detailsOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detailsOpen]);

  const quizzesQuery = useQuery({
    queryKey: ["teacher-quizzes"],
    queryFn: getTeacherQuizzes,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
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

  const selectedQuizSummary = useMemo(
    () => quizzes.find((quiz) => quiz.id === selectedQuizId) || null,
    [quizzes, selectedQuizId]
  );

  const quizDetailQuery = useQuery({
    queryKey: ["teacher-quiz-by-id", selectedQuizId, "my-quizzes-modal"],
    queryFn: () => getTeacherQuizById(selectedQuizId),
    enabled: Boolean(detailsOpen && selectedQuizId),
    staleTime: 30 * 1000,
  });

  const analyticsQuery = useQuery({
    queryKey: ["teacher-quiz-analytics", selectedQuizId, "my-quizzes-modal"],
    queryFn: () => getTeacherQuizAnalytics(selectedQuizId),
    enabled: Boolean(detailsOpen && selectedQuizId),
    staleTime: 30 * 1000,
  });

  const submissionsQuery = useQuery({
    queryKey: ["teacher-quiz-submissions", selectedQuizId, "my-quizzes-modal"],
    queryFn: () => getTeacherQuizSubmissions(selectedQuizId),
    enabled: Boolean(detailsOpen && selectedQuizId),
    staleTime: 30 * 1000,
  });

  const selectedQuiz = quizDetailQuery.data || selectedQuizSummary;
  const analyticsData = analyticsQuery.data || null;
  const assignment = analyticsData?.assignment || selectedQuiz?.assignment || {};
  const assignedStudents = Array.isArray(analyticsData?.assignedStudents)
    ? analyticsData.assignedStudents
    : Array.isArray(assignment?.students)
      ? assignment.students
      : [];
  const questions = Array.isArray(selectedQuiz?.questions) ? selectedQuiz.questions : [];
  const submissions = Array.isArray(submissionsQuery.data) ? submissionsQuery.data : [];

  const handleOpenDetails = (quizId) => {
    setSelectedQuizId(quizId);
    setDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
  };

  const isDetailsLoading =
    quizDetailQuery.isLoading || analyticsQuery.isLoading || submissionsQuery.isLoading;

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
              Open full quiz model to see questions, answers, assigned students, and total results.
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
              <Skeleton key={index} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredQuizzes.length < 1 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No quizzes found.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{quiz.title}</p>
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
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => handleOpenDetails(quiz.id)}
                    >
                      View Full Model
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => navigate(`${routeBase}/detail/${quiz.id}`)}
                    >
                      Open Assignment Page
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Motion.section>

      {detailsOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={handleCloseDetails}
          />
          <div className="relative z-[81] h-[94vh] w-full max-w-7xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="font-heading text-2xl text-slate-900">
                  {selectedQuiz?.title || "Quiz Details"}
                </h3>
                <p className="text-sm text-slate-500">
                  {selectedQuiz?.courseName || "Course"} | {selectedQuiz?.subjectName || "Subject"}
                  {selectedQuiz?.chapterTitle ? ` | ${selectedQuiz.chapterTitle}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedQuizId ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => navigate(`${routeBase}/detail/${selectedQuizId}`)}
                  >
                    Assignment & Grading Page
                  </button>
                ) : null}
                <button type="button" className="btn-outline" onClick={handleCloseDetails}>
                  Close
                </button>
              </div>
            </div>

            <div className="h-[calc(94vh-84px)] overflow-y-auto p-5">
              {isDetailsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-60 w-full rounded-2xl" />
                  <Skeleton className="h-60 w-full rounded-2xl" />
                </div>
              ) : !selectedQuiz ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  Quiz details not found.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-5">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Assigned</p>
                      <p className="mt-1 text-xl font-semibold text-slate-900">
                        {analyticsData?.summary?.totalAssigned ?? assignment?.totalAssigned ?? 0}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Attempted</p>
                      <p className="mt-1 text-xl font-semibold text-slate-900">
                        {analyticsData?.summary?.attemptedCount ?? 0}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Not Attempted</p>
                      <p className="mt-1 text-xl font-semibold text-slate-900">
                        {analyticsData?.summary?.notAttempted ?? 0}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Average Score</p>
                      <p className="mt-1 text-xl font-semibold text-slate-900">
                        {analyticsData?.summary?.averageScore ?? 0}%
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Pass Rate</p>
                      <p className="mt-1 text-xl font-semibold text-slate-900">
                        {analyticsData?.summary?.passRate ?? 0}%
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="text-sm font-semibold text-slate-800">Quiz Questions & Answers</h4>
                    {questions.length < 1 ? (
                      <p className="mt-2 text-sm text-slate-500">No questions found.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {questions.map((question, index) => {
                          const options = getQuestionOptions(question);
                          return (
                            <div
                              key={question.questionId || question.id || `question-${index}`}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-900">
                                  Q{index + 1}. {question.questionText || question.text || "Question"}
                                </p>
                                <span className="rounded-full bg-indigo-100 px-2 py-1 text-[11px] font-semibold text-indigo-700">
                                  {question.marks || 1} marks
                                </span>
                              </div>
                              {options.length > 0 ? (
                                <div className="mt-2 grid gap-1">
                                  {options.map((option, optionIndex) => (
                                    <p key={`${question.questionId || index}-${optionIndex}`} className="text-xs text-slate-700">
                                      {String.fromCharCode(65 + optionIndex)}. {option}
                                    </p>
                                  ))}
                                </div>
                              ) : null}
                              <p className="mt-2 text-xs font-semibold text-emerald-700">
                                Correct Answer: {question.correctAnswer || question.expectedAnswer || "-"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="text-sm font-semibold text-slate-800">Assigned To (Students)</h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Target: {assignment?.targetType || "students"} | Due: {formatDateTime(assignment?.dueAt)}
                    </p>
                    {assignedStudents.length < 1 ? (
                      <p className="mt-2 text-sm text-slate-500">No assigned students found.</p>
                    ) : (
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="px-2 py-2 font-semibold">Student</th>
                              <th className="px-2 py-2 font-semibold">Email</th>
                              <th className="px-2 py-2 font-semibold">Status</th>
                              <th className="px-2 py-2 font-semibold">Score</th>
                              <th className="px-2 py-2 font-semibold">Submitted</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assignedStudents.map((row, idx) => (
                              <tr
                                key={`${row.studentId || row.id || idx}-${row.submittedAt || "none"}`}
                                className="border-b border-slate-100"
                              >
                                <td className="px-2 py-2 text-slate-900">
                                  {row.fullName || row.studentName || "Student"}
                                </td>
                                <td className="px-2 py-2 text-slate-600">{row.email || row.studentEmail || "-"}</td>
                                <td className="px-2 py-2 text-slate-700">
                                  {normalizeStatus(row.status || row.resultStatus || "not_attempted") || "-"}
                                </td>
                                <td className="px-2 py-2 text-slate-700">
                                  {Number.isFinite(Number(row.scorePercent))
                                    ? `${Math.round(Number(row.scorePercent))}%`
                                    : "-"}
                                </td>
                                <td className="px-2 py-2 text-slate-600">{formatDateTime(row.submittedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="text-sm font-semibold text-slate-800">Submission Results</h4>
                    {submissions.length < 1 ? (
                      <p className="mt-2 text-sm text-slate-500">No submissions found yet.</p>
                    ) : (
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="px-2 py-2 font-semibold">Student</th>
                              <th className="px-2 py-2 font-semibold">Status</th>
                              <th className="px-2 py-2 font-semibold">Attempts</th>
                              <th className="px-2 py-2 font-semibold">Score</th>
                              <th className="px-2 py-2 font-semibold">Submitted</th>
                            </tr>
                          </thead>
                          <tbody>
                            {submissions.slice(0, 50).map((row) => (
                              <tr key={row.id} className="border-b border-slate-100">
                                <td className="px-2 py-2 text-slate-900">{row.studentName || "Student"}</td>
                                <td className="px-2 py-2 text-slate-700">{normalizeStatus(row.status || "attempted")}</td>
                                <td className="px-2 py-2 text-slate-700">{row.attemptsCount || 1}</td>
                                <td className="px-2 py-2 text-slate-700">
                                  {row.status === "not_attempted"
                                    ? "-"
                                    : `${Math.round(Number(row.scorePercent || 0))}% (${row.totalScore || 0}/${row.totalMarks || 0})`}
                                </td>
                                <td className="px-2 py-2 text-slate-600">{formatDateTime(row.submittedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default TeacherMyQuizzes;
