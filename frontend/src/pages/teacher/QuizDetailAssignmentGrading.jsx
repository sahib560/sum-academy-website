import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast, Toaster } from "react-hot-toast";
import { Skeleton } from "../../components/Skeleton.jsx";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  assignTeacherQuiz,
  getTeacherQuizAnalytics,
  getTeacherQuizById,
  getTeacherQuizzes,
  getTeacherQuizSubmissions,
  getTeacherStudents,
  gradeTeacherShortAnswers,
} from "../../services/teacher.service.js";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.35 },
};

const scoreColors = ["#4a63f5", "#8090ff", "#a3b0ff", "#c8d0ff", "#e2e7ff"];

const lowerText = (value = "") => String(value || "").trim().toLowerCase();

const formatDateTime = (value) => {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleString();
};

const toDateTimeLocalValue = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

function TeacherQuizDetailAssignmentGrading() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { quizId = "" } = useParams();

  const [assignmentDueAt, setAssignmentDueAt] = useState("");
  const [assignmentStudentIds, setAssignmentStudentIds] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [gradeDrafts, setGradeDrafts] = useState({});

  const quizzesQuery = useQuery({
    queryKey: ["teacher-quizzes"],
    queryFn: getTeacherQuizzes,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const quizDetailQuery = useQuery({
    queryKey: ["teacher-quiz-by-id", quizId],
    queryFn: () => getTeacherQuizById(quizId),
    enabled: Boolean(quizId),
    staleTime: 30 * 1000,
  });

  const analyticsQuery = useQuery({
    queryKey: ["teacher-quiz-analytics", quizId],
    queryFn: () => getTeacherQuizAnalytics(quizId),
    enabled: Boolean(quizId),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const submissionsQuery = useQuery({
    queryKey: ["teacher-quiz-submissions", quizId],
    queryFn: () => getTeacherQuizSubmissions(quizId),
    enabled: Boolean(quizId),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const teacherStudentsQuery = useQuery({
    queryKey: ["teacher-students-for-quiz-assign"],
    queryFn: getTeacherStudents,
    staleTime: 60 * 1000,
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, payload }) => assignTeacherQuiz(id, payload),
    onSuccess: (response) => {
      const total = Number(response?.data?.assignment?.totalAssigned || 0);
      toast.success(`Quiz assigned to ${total} students`);
      queryClient.invalidateQueries({ queryKey: ["teacher-quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-quiz-by-id", quizId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-quiz-analytics", quizId] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to assign quiz");
    },
  });

  const gradeMutation = useMutation({
    mutationFn: ({ id, resultId, payload }) =>
      gradeTeacherShortAnswers(id, resultId, payload),
    onSuccess: () => {
      toast.success("Short answers graded");
      queryClient.invalidateQueries({ queryKey: ["teacher-quiz-submissions", quizId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-quiz-analytics", quizId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-quizzes"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to save grades");
    },
  });

  const quizzes = Array.isArray(quizzesQuery.data) ? quizzesQuery.data : [];
  const selectedQuiz =
    quizDetailQuery.data || quizzes.find((quiz) => quiz.id === quizId) || null;

  const analyticsData = analyticsQuery.data || null;
  const assignmentSummary = analyticsData?.assignment || selectedQuiz?.assignment || null;

  const teacherStudents = useMemo(() => {
    const rows = Array.isArray(teacherStudentsQuery.data) ? teacherStudentsQuery.data : [];
    return rows
      .map((student) => ({
        studentId: student.id || student.studentId || "",
        fullName: student.fullName || student.name || "Student",
        email: student.email || "",
      }))
      .filter((student) => Boolean(student.studentId));
  }, [teacherStudentsQuery.data]);

  const filteredStudents = useMemo(() => {
    const needle = lowerText(studentSearch);
    if (!needle) return teacherStudents;
    return teacherStudents.filter(
      (student) =>
        lowerText(student.fullName).includes(needle) ||
        lowerText(student.email).includes(needle)
    );
  }, [teacherStudents, studentSearch]);

  useEffect(() => {
    if (!selectedQuiz) return;
    const assignedStudents = Array.isArray(selectedQuiz?.assignment?.students)
      ? selectedQuiz.assignment.students
      : [];
    setAssignmentStudentIds(
      assignedStudents
        .map((row) => row.studentId || row.id)
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    );
    setAssignmentDueAt(toDateTimeLocalValue(selectedQuiz?.assignment?.dueAt));
  }, [selectedQuiz?.id, selectedQuiz?.assignment?.dueAt, selectedQuiz?.assignment?.students]);

  const submissions = Array.isArray(submissionsQuery.data) ? submissionsQuery.data : [];
  const pendingSubmissions = submissions.filter((row) => {
    const status = lowerText(row?.status);
    if (!["pending_review", "partial"].includes(status)) return false;
    const shortAnswers = Array.isArray(row?.shortAnswers) ? row.shortAnswers : [];
    return shortAnswers.some(
      (answer) => answer?.marksAwarded === null || answer?.marksAwarded === undefined
    );
  });

  const toggleAssignStudent = (studentId) => {
    setAssignmentStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleAssignQuiz = () => {
    if (!quizId) {
      toast.error("Select a quiz first");
      return;
    }
    if (!assignmentDueAt) {
      toast.error("Select due date and time");
      return;
    }
    if (!assignmentStudentIds.length) {
      toast.error("Select at least one student");
      return;
    }
    assignMutation.mutate({
      id: quizId,
      payload: {
        dueAt: new Date(assignmentDueAt).toISOString(),
        studentIds: assignmentStudentIds,
      },
    });
  };

  const handleSaveSubmissionGrade = (resultId, shortAnswers = []) => {
    if (!quizId) return;
    const gradedAnswers = shortAnswers.map((row) => {
      const key = `${resultId}:${row.questionId}`;
      const draft = gradeDrafts[key] || {
        marks:
          row.marksAwarded === null || row.marksAwarded === undefined
            ? ""
            : row.marksAwarded,
        feedback: row.feedback || "",
      };
      const maxMarks = Number(row.maxMarks || 0);
      const marks = Number(draft.marks || 0);
      return {
        questionId: row.questionId,
        marks: Math.max(0, Math.min(maxMarks || marks, marks)),
        feedback: draft.feedback || "",
      };
    });

    gradeMutation.mutate({
      id: quizId,
      resultId,
      payload: { gradedAnswers },
    });
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <Motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl text-slate-900">
              Quiz Detail, Assignment & Grading
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Assign quizzes to students, track results, and manually grade short answers.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/teacher/quizzes/my" className="btn-outline">
              My Quizzes
            </Link>
            <Link to="/teacher/quizzes" className="btn-primary">
              Quiz Builder
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={quizId}
            onChange={(event) => {
              const nextId = event.target.value;
              if (!nextId) return;
              navigate(`/teacher/quizzes/detail/${nextId}`);
            }}
          >
            <option value="">Select Quiz</option>
            {quizzes.map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title} | {quiz.courseName}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-outline"
            onClick={() => quizzesQuery.refetch()}
          >
            Refresh
          </button>
        </div>
      </Motion.section>

      {!quizId ? (
        <Motion.section
          {...fadeUp}
          className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500"
        >
          Select a quiz to open details.
        </Motion.section>
      ) : quizDetailQuery.isLoading ? (
        <Motion.section
          {...fadeUp}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
        </Motion.section>
      ) : !selectedQuiz ? (
        <Motion.section
          {...fadeUp}
          className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500"
        >
          Quiz not found.
        </Motion.section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Motion.section
            {...fadeUp}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-lg font-semibold text-slate-900">{selectedQuiz.title}</p>
              <p className="mt-1 text-xs text-slate-600">
                {selectedQuiz.courseName} | {selectedQuiz.subjectName}
                {selectedQuiz.chapterTitle ? ` | ${selectedQuiz.chapterTitle}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700">
                  {selectedQuiz.questionCount || 0} Questions
                </span>
                <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700">
                  {selectedQuiz.totalMarks || 0} Marks
                </span>
                <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700">
                  Assigned: {assignmentSummary?.totalAssigned || 0}
                </span>
                <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700">
                  Due:{" "}
                  {assignmentSummary?.dueAt
                    ? formatDateTime(assignmentSummary.dueAt)
                    : "Not set"}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-800">Assign Quiz To Students</p>
              <div className="mt-3 grid gap-3">
                <input
                  type="datetime-local"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={assignmentDueAt}
                  onChange={(event) => setAssignmentDueAt(event.target.value)}
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Search student by name/email"
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() =>
                      setAssignmentStudentIds(
                        filteredStudents.map((student) => student.studentId)
                      )
                    }
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setAssignmentStudentIds([])}
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-56 space-y-2 overflow-auto rounded-xl border border-slate-200 p-2">
                  {filteredStudents.map((student) => {
                    const checked = assignmentStudentIds.includes(student.studentId);
                    return (
                      <label
                        key={student.studentId}
                        className={`flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-xs ${
                          checked ? "bg-[#4a63f5]/10" : "bg-slate-50"
                        }`}
                      >
                        <span>
                          <span className="block font-semibold text-slate-800">
                            {student.fullName}
                          </span>
                          <span className="text-slate-500">{student.email || "-"}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAssignStudent(student.studentId)}
                        />
                      </label>
                    );
                  })}
                  {filteredStudents.length < 1 ? (
                    <p className="text-xs text-slate-500">No students found.</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleAssignQuiz}
                  disabled={assignMutation.isPending}
                >
                  {assignMutation.isPending ? "Assigning..." : "Assign Quiz"}
                </button>
              </div>
            </div>
          </Motion.section>

          <Motion.section
            {...fadeUp}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-800">Result Analytics</p>
            {analyticsQuery.isLoading ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-36 w-full" />
              </div>
            ) : analyticsData ? (
              <div className="mt-3 space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3 text-xs">
                    <p className="text-slate-500">Attempted</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {analyticsData.summary?.attemptedCount || 0}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-xs">
                    <p className="text-slate-500">Not Attempted</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {analyticsData.summary?.notAttempted || 0}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-xs">
                    <p className="text-slate-500">Average Score</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {analyticsData.summary?.averageScore || 0}%
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-xs">
                    <p className="text-slate-500">Pass Rate</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {analyticsData.summary?.passRate || 0}%
                    </p>
                  </div>
                </div>

                <div className="h-56 rounded-xl border border-slate-200 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.scoreDistribution || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {(analyticsData.scoreDistribution || []).map((entry, index) => (
                          <Cell
                            key={`cell-${entry.range}-${index}`}
                            fill={scoreColors[index % scoreColors.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="h-44 rounded-xl border border-slate-200 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            {
                              name: "Attempted",
                              value: analyticsData.summary?.attemptedCount || 0,
                            },
                            {
                              name: "Not Attempted",
                              value: analyticsData.summary?.notAttempted || 0,
                            },
                          ]}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={60}
                          label
                        >
                          <Cell fill="#4a63f5" />
                          <Cell fill="#e2e8f0" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-44 rounded-xl border border-slate-200 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analyticsData.submissionTrend || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" hide />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="submissions"
                          stroke="#4a63f5"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">No analytics available yet.</p>
            )}
          </Motion.section>

          <Motion.section
            {...fadeUp}
            className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h4 className="text-sm font-semibold text-slate-800">
              Manual Grading (Short Answers)
            </h4>
            {submissionsQuery.isLoading ? (
              <div className="mt-4 space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full" />
                ))}
              </div>
            ) : pendingSubmissions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No pending short-answer submissions.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {pendingSubmissions.map((submission) => (
                  <div key={submission.id} className="rounded-2xl border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {submission.studentName}
                    </p>
                    <p className="text-xs text-slate-500">
                      Submitted: {formatDateTime(submission.submittedAt)}
                    </p>
                    <div className="mt-3 space-y-3">
                      {(submission.shortAnswers || []).map((row) => {
                        const key = `${submission.id}:${row.questionId}`;
                        const draft = gradeDrafts[key] || { marks: "", feedback: "" };
                        return (
                          <div
                            key={row.questionId}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-2"
                          >
                            <p className="text-xs font-semibold text-slate-700">
                              {row.questionText}
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              Student: {row.submittedAnswer || "-"}
                            </p>
                            {row.expectedAnswer ? (
                              <p className="mt-1 text-xs text-slate-500">
                                Expected: {row.expectedAnswer}
                              </p>
                            ) : null}
                            <div className="mt-2 grid gap-2 sm:grid-cols-[120px_1fr]">
                              <input
                                type="number"
                                min="0"
                                max={row.maxMarks}
                                className="rounded-xl border border-slate-200 px-2 py-1 text-xs"
                                placeholder={`Marks / ${row.maxMarks}`}
                                value={draft.marks}
                                onChange={(event) =>
                                  setGradeDrafts((prev) => ({
                                    ...prev,
                                    [key]: { ...draft, marks: event.target.value },
                                  }))
                                }
                              />
                              <input
                                className="rounded-xl border border-slate-200 px-2 py-1 text-xs"
                                placeholder="Feedback (optional)"
                                value={draft.feedback}
                                onChange={(event) =>
                                  setGradeDrafts((prev) => ({
                                    ...prev,
                                    [key]: { ...draft, feedback: event.target.value },
                                  }))
                                }
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className="btn-primary mt-3"
                      onClick={() =>
                        handleSaveSubmissionGrade(submission.id, submission.shortAnswers || [])
                      }
                      disabled={gradeMutation.isPending}
                    >
                      {gradeMutation.isPending ? "Saving..." : "Save Grades"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Motion.section>
        </div>
      )}
    </div>
  );
}

export default TeacherQuizDetailAssignmentGrading;
