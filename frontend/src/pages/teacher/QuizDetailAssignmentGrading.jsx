import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
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
  getTeacherClasses,
  gradeTeacherShortAnswers,
  fetchProtectedImage,
  deleteTeacherQuiz,
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

const sanitizeQuestionHtml = (html = "") => {
  if (!html) return "";
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
             .replace(/on\w+="[^"]*"/g, "");
};

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};


function TeacherQuizDetailAssignmentGrading() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const routeBase = location.pathname.startsWith("/admin") ? "/admin/quizzes" : "/teacher/quizzes";
  const { quizId = "" } = useParams();

  const [assignmentDueAt, setAssignmentDueAt] = useState("");
  const [assignmentTargetType, setAssignmentTargetType] = useState("students");
  const [assignmentClassId, setAssignmentClassId] = useState("");
  const [assignmentStudentIds, setAssignmentStudentIds] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [gradeDrafts, setGradeDrafts] = useState({});
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);


  const quizzesQuery = useQuery({
    queryKey: ["teacher-quizzes"],
    queryFn: getTeacherQuizzes,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const submissionsQuery = useQuery({
    queryKey: ["teacher-quiz-submissions", quizId],
    queryFn: () => getTeacherQuizSubmissions(quizId),
    enabled: Boolean(quizId),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const teacherStudentsQuery = useQuery({
    queryKey: ["teacher-students-for-quiz-assign"],
    queryFn: getTeacherStudents,
    staleTime: 5 * 60 * 1000,
  });

  const teacherClassesQuery = useQuery({
    queryKey: ["teacher-classes-for-quiz-assign"],
    queryFn: getTeacherClasses,
    staleTime: 5 * 60 * 1000,
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, payload }) => assignTeacherQuiz(id, payload),
    onSuccess: (response) => {
      const total = Number(
        response?.data?.studentsCount ?? response?.data?.assignment?.totalAssigned ?? 0
      );
      toast.success(`Quiz assigned to ${total || "selected"} students`);
      queryClient.invalidateQueries({ queryKey: ["teacher-quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-quiz-by-id", quizId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-quiz-analytics", quizId] });
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message || error?.response?.data?.error || "Failed to assign quiz"
      );
    },
  });

  const gradeMutation = useMutation({
    mutationFn: ({ id, resultId, payload }) =>
      gradeTeacherShortAnswers(id, resultId, payload),
    onSuccess: () => {
      toast.success("Manual grades saved");
      queryClient.invalidateQueries({ queryKey: ["teacher-quiz-submissions", quizId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-quiz-analytics", quizId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-quizzes"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to save grades");
    },
  });

  const deleteQuizMutation = useMutation({
    mutationFn: deleteTeacherQuiz,
    onSuccess: () => {
      toast.success("Quiz deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["teacher-quizzes"] });
      navigate(routeBase);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to delete quiz");
    },
  });

  const handleDeleteQuiz = () => {
    if (!quizId) return;
    if (window.confirm("Are you sure you want to completely delete this quiz and its images? This cannot be undone.")) {
      deleteQuizMutation.mutate(quizId);
    }
  };

  const [imageBlobUrls, setImageBlobUrls] = useState({});

  const quizzes = Array.isArray(quizzesQuery.data) ? quizzesQuery.data : [];
  const selectedQuiz =
    quizDetailQuery.data || quizzes.find((quiz) => quiz.id === quizId) || null;

  useEffect(() => {
    const questions = selectedQuiz?.questions || [];
    if (!questions.length) return;
    questions.forEach((q) => {
      const path = q.imagePath || q.imageUrl;
      const qid = q.questionId || q.id;
      if (!path || !qid || imageBlobUrls[qid]) return;

      fetchProtectedImage(path)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          setImageBlobUrls((prev) => ({ ...prev, [qid]: url }));
        })
        .catch(() => {});
    });
  }, [selectedQuiz?.questions, imageBlobUrls]);

  const analyticsData = analyticsQuery.data || null;
  const assignmentSummary = analyticsData?.assignment || selectedQuiz?.assignment || null;
  const classOptions = useMemo(() => {
    const rows = Array.isArray(teacherClassesQuery.data) ? teacherClassesQuery.data : [];
    const targetCourseId = selectedQuiz?.courseId || "";
    if (!targetCourseId) return rows;
    return rows.filter((row) =>
      [
        ...(Array.isArray(row.assignedCourses) ? row.assignedCourses : []),
        ...(Array.isArray(row.assignedSubjects) ? row.assignedSubjects : []),
      ].some((entry) => {
        const courseId =
          (typeof entry === "string"
            ? entry
            : entry?.subjectId || entry?.courseId || entry?.id || "")
            .toString()
            .trim();
        return courseId === targetCourseId;
      })
    );
  }, [teacherClassesQuery.data, selectedQuiz?.courseId]);

  const teacherStudents = useMemo(() => {
    const rows = Array.isArray(teacherStudentsQuery.data) ? teacherStudentsQuery.data : [];
    return rows
      .map((student) => ({
        studentId: student.uid || student.id || student.studentId || "",
        fullName: student.fullName || student.name || "Student",
        email: student.email || "",
        enrolledCourseIds: Array.isArray(student.enrolledCourses)
          ? student.enrolledCourses
              .map((course) => course.courseId || course.id)
              .filter(Boolean)
          : [],
      }))
      .filter((student) => Boolean(student.studentId));
  }, [teacherStudentsQuery.data]);

  const filteredStudents = useMemo(() => {
    const needle = lowerText(studentSearch);
    const courseId = selectedQuiz?.courseId || "";
    const eligible = courseId
      ? teacherStudents.filter((student) =>
          student.enrolledCourseIds.includes(courseId)
        )
      : teacherStudents;
    if (!needle) return eligible;
    return eligible.filter(
      (student) =>
        lowerText(student.fullName).includes(needle) ||
        lowerText(student.email).includes(needle)
    );
  }, [teacherStudents, studentSearch, selectedQuiz?.courseId]);

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
    setAssignmentTargetType(
      ["students", "course", "class"].includes(
        lowerText(selectedQuiz?.assignment?.targetType || "")
      )
        ? lowerText(selectedQuiz.assignment.targetType)
        : "students"
    );
    setAssignmentClassId(String(selectedQuiz?.assignment?.classId || "").trim());
  }, [selectedQuiz?.id, selectedQuiz?.assignment?.dueAt, selectedQuiz?.assignment?.students, selectedQuiz?.assignment?.targetType, selectedQuiz?.assignment?.classId]);

  const submissions = Array.isArray(submissionsQuery.data) ? submissionsQuery.data : [];
  const pendingSubmissions = submissions.filter((row) => {
    const status = lowerText(row?.status);
    if (!["pending_review", "partial"].includes(status)) return false;
    const shortAnswers = Array.isArray(row?.shortAnswers) ? row.shortAnswers : [];
    return shortAnswers.some(
      (answer) => answer?.marksAwarded === null || answer?.marksAwarded === undefined
    );
  });

  const latestSubmissionByStudent = useMemo(() => {
    const map = new Map();
    submissions.forEach((row) => {
      const studentId = String(row?.studentId || "").trim();
      if (!studentId) return;
      const submittedAtValue = row?.submittedAt ? new Date(row.submittedAt).getTime() : 0;
      const existing = map.get(studentId);
      const existingValue = existing?.submittedAt ? new Date(existing.submittedAt).getTime() : 0;
      if (!existing || submittedAtValue >= existingValue) {
        map.set(studentId, row);
      }
    });
    return map;
  }, [submissions]);

  const assignedStudentRows = useMemo(() => {
    const source =
      Array.isArray(analyticsData?.assignedStudents) && analyticsData.assignedStudents.length > 0
        ? analyticsData.assignedStudents
        : Array.isArray(assignmentSummary?.students)
          ? assignmentSummary.students
          : [];
    return source.map((student) => {
      const studentId = String(student?.studentId || "").trim();
      const latest = latestSubmissionByStudent.get(studentId) || null;
      const statusRaw = latest
        ? String(latest.status || student?.resultStatus || "attempted").trim().toLowerCase()
        : String(student?.status || "not_attempted").trim().toLowerCase();
      const status =
        statusRaw === "not_attempted" || statusRaw === "notattempted"
          ? "not_attempted"
          : statusRaw || "attempted";
      return {
        studentId,
        fullName: student?.fullName || student?.studentName || "Student",
        email: student?.email || student?.studentEmail || "",
        status,
        attemptsCount: Number(
          latest?.attemptsCount ?? student?.attemptsCount ?? (latest ? 1 : 0)
        ),
        scorePercent: Number(latest?.scorePercent ?? student?.scorePercent ?? 0),
        totalScore: Number(latest?.totalScore ?? student?.totalScore ?? 0),
        totalMarks: Number(latest?.totalMarks ?? student?.totalMarks ?? 0),
        submittedAt: latest?.submittedAt || student?.submittedAt || null,
      };
    });
  }, [
    analyticsData?.assignedStudents,
    assignmentSummary?.students,
    latestSubmissionByStudent,
  ]);

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
    if (assignmentTargetType === "class" && !assignmentClassId) {
      toast.error("Select a class for class assignment");
      return;
    }
    if (assignmentTargetType === "subject" && !selectedQuiz?.subjectId) {
      toast.error("This quiz is missing subject info");
      return;
    }
    if (assignmentTargetType === "students" && !assignmentStudentIds.length) {
      toast.error("Select at least one student");
      return;
    }

    const dueDate = new Date(assignmentDueAt).toISOString();
    const payload =
      assignmentTargetType === "class"
        ? { assignTo: "all_class", classId: assignmentClassId, dueDate }
        : assignmentTargetType === "students"
          ? { assignTo: "specific", studentIds: assignmentStudentIds, dueDate }
          : assignmentTargetType === "subject"
            ? { assignTo: "all_subject", subjectId: selectedQuiz?.subjectId || "", dueDate }
            : { assignTo: "all_enrolled", dueDate };

    assignMutation.mutate({
      id: quizId,
      payload,
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
      
      {selectedStudentDetail && (
        <StudentDetailModal 
          data={selectedStudentDetail} 
          quiz={selectedQuiz} 
          onClose={() => setSelectedStudentDetail(null)} 
        />
      )}


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
              Assign MCQ quizzes by course, class, or selected students and track results.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={`${routeBase}/my`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              My Quizzes
            </Link>
            <Link to={routeBase} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
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
              navigate(`${routeBase}/detail/${nextId}`);
            }}
          >
            <option value="">Select Quiz</option>
            {quizzes.map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title} | {quiz.courseName}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-outline"
              onClick={() => quizzesQuery.refetch()}
            >
              Refresh
            </button>
            {quizId && (
              <button
                type="button"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                onClick={handleDeleteQuiz}
                disabled={deleteQuizMutation.isPending}
              >
                {deleteQuizMutation.isPending ? "Deleting..." : "Delete Quiz"}
              </button>
            )}
          </div>
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
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "course", label: "Whole Course" },
                    { key: "subject", label: "Whole Subject" },
                    { key: "class", label: "By Class" },
                    { key: "students", label: "Selected Students" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        assignmentTargetType === item.key
                          ? "bg-[#4a63f5] text-white"
                          : "border border-slate-200 text-slate-600"
                      }`}
                      onClick={() => {
                        setAssignmentTargetType(item.key);
                        if (item.key !== "class") setAssignmentClassId("");
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {assignmentTargetType === "class" ? (
                  <select
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={assignmentClassId}
                    onChange={(event) => setAssignmentClassId(event.target.value)}
                  >
                    <option value="">Select Class</option>
                    {classOptions.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name} {row.batchCode ? `(${row.batchCode})` : ""}
                      </option>
                    ))}
                  </select>
                ) : null}
                {assignmentTargetType === "course" ? (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    This will assign the quiz to all students enrolled in{" "}
                    <span className="font-semibold">{selectedQuiz?.courseName || "course"}</span>.
                  </p>
                ) : null}
                {assignmentTargetType === "subject" ? (
                  <p className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
                    This will assign the quiz to all students enrolled in{" "}
                    <span className="font-semibold">{selectedQuiz?.subjectName || "subject"}</span>.
                  </p>
                ) : null}
                {assignmentTargetType === "students" ? (
                  <>
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
                  </>
                ) : null}
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-indigo-100 hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Attempted</p>
                        <p className="text-xl font-bold text-slate-900">{analyticsData.summary?.attemptedCount || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-amber-100 hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending</p>
                        <p className="text-xl font-bold text-slate-900">{analyticsData.summary?.notAttempted || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-emerald-100 hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg. Score</p>
                        <p className="text-xl font-bold text-slate-900">{analyticsData.summary?.averageScore || 0}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-violet-100 hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pass Rate</p>
                        <p className="text-xl font-bold text-slate-900">{analyticsData.summary?.passRate || 0}%</p>
                      </div>
                    </div>
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
              Assigned Students And Results
            </h4>
            {assignedStudentRows.length < 1 ? (
              <p className="mt-3 text-sm text-slate-500">
                No assigned students found for this quiz.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="px-2 py-2 font-semibold">Student</th>
                      <th className="px-2 py-2 font-semibold">Email</th>
                      <th className="px-2 py-2 font-semibold">Status</th>
                      <th className="px-2 py-2 font-semibold">Attempts</th>
                      <th className="px-2 py-2 font-semibold">Score</th>
                      <th className="px-2 py-2 font-semibold">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedStudentRows.map((row) => (
                      <tr 
                        key={`${row.studentId}-${row.submittedAt || "none"}`} 
                        className="group border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => {
                          if (row.status !== "not_attempted") {
                            const submission = latestSubmissionByStudent.get(row.studentId);
                            if (submission) setSelectedStudentDetail({ ...row, submission });
                          }
                        }}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                              {row.fullName.charAt(0)}
                            </div>
                            <span className="font-medium text-slate-900">{row.fullName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-600">{row.email || "-"}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                              row.status === "not_attempted"
                                ? "bg-slate-100 text-slate-500"
                                : row.status === "completed"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : row.status === "pending_review"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-indigo-100 text-indigo-700"
                            }`}
                          >
                            {row.status === "not_attempted"
                              ? "Not Attempted"
                              : row.status.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-600 font-medium">{row.attemptsCount}</td>
                        <td className="px-4 py-4">
                          {row.status === "not_attempted" ? (
                            <span className="text-slate-300">-</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                                <div 
                                  className={`h-full rounded-full ${row.scorePercent >= 40 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                  style={{ width: `${Math.min(100, row.scorePercent)}%` }}
                                />
                              </div>
                              <span className="text-sm font-bold text-slate-700">
                                {Math.round(row.scorePercent)}%
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-500 text-[11px]">{formatDateTime(row.submittedAt)}</td>
                      </tr>
                    ))}

                  </tbody>
                </table>
              </div>
            )}
          </Motion.section>

          <Motion.section
            {...fadeUp}
            className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h4 className="text-sm font-semibold text-slate-800">
              Manual Grading (Legacy Non-MCQ Quizzes)
            </h4>
            {submissionsQuery.isLoading ? (
              <div className="mt-4 space-y-2">
                {Array.from({ length: 3 }).map((ignore, index) => (
                  <Skeleton key={index} className="h-20 w-full" />
                ))}
              </div>
            ) : pendingSubmissions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No manual grading required for MCQ quizzes.
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

          <Motion.section
            {...fadeUp}
            className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h4 className="text-sm font-semibold text-slate-800">
              Quiz Questions & Answers
            </h4>
            <div className="mt-4 space-y-6">
              {(selectedQuiz?.questions || []).map((q, idx) => (
                <div key={q.questionId || q.id || idx} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-500">
                      Q{idx + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900" dangerouslySetInnerHTML={{ __html: q.questionText }} />
                      
                      {(q.imagePath || q.imageUrl) && (
                        <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                          <img 
                            src={imageBlobUrls[q.questionId || q.id] || q.imageUrl} 
                            alt="" 
                            className="max-h-[300px] w-full object-contain"
                          />
                        </div>
                      )}

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {Object.entries(q.options || {}).map(([key, val]) => (
                          <div 
                            key={key}
                            className={`flex items-center gap-2 rounded-xl border p-2 text-xs ${
                              q.correctAnswer === key 
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700" 
                                : "border-slate-100 bg-white text-slate-600"
                            }`}
                          >
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded font-bold ${
                              q.correctAnswer === key ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                            }`}>
                              {key}
                            </span>
                            <span dangerouslySetInnerHTML={{ __html: val }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Motion.section>
        </div>
      )}
    </div>
  );
}

function StudentDetailModal({ data, quiz, onClose }) {
  const submission = data?.submission || {};
  const answers = Array.isArray(submission.answers) ? submission.answers : [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <Motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative h-[90vh] w-full max-w-4xl overflow-hidden rounded-[2.5rem] bg-white shadow-2xl"
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{data.fullName}</h3>
                <p className="text-sm text-slate-500">Quiz Performance Review</p>
              </div>
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Score</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{Math.round(data.scorePercent)}%</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Marks</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{data.totalScore}/{data.totalMarks}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</p>
                  <p className={`mt-1 text-sm font-bold uppercase ${data.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {data.status.replace('_', ' ')}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Submitted</p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">{new Date(data.submittedAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="space-y-6">
                {answers.map((ans, idx) => {
                  const qObj = (quiz?.questions || []).find(q => q.questionId === ans.questionId);
                  return (
                    <div key={ans.questionId || idx} className={`rounded-2xl border p-6 transition-all ${ans.isCorrect ? 'border-emerald-100 bg-emerald-50/20' : 'border-rose-100 bg-rose-50/20'}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm text-xs font-bold text-slate-600">
                          {idx + 1}
                        </span>
                        <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${ans.isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                          {ans.isCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                      </div>

                      <div 
                        className="text-sm font-medium text-slate-800 mb-6"
                        dangerouslySetInnerHTML={{ __html: sanitizeQuestionHtml(qObj?.questionText || "Question text not available") }}
                      />

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="bg-white/60 p-3 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Student's Answer</p>
                          <div className="text-sm font-semibold text-slate-700" dangerouslySetInnerHTML={{ __html: sanitizeQuestionHtml(ans.selectedAnswer || "No Answer") }} />
                        </div>
                        <div className="bg-white/60 p-3 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Correct Answer</p>
                          <div className="text-sm font-semibold text-emerald-600" dangerouslySetInnerHTML={{ __html: sanitizeQuestionHtml(ans.correctAnswer || "Not provided") }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Motion.div>
      </div>
    </AnimatePresence>
  );
}


export default TeacherQuizDetailAssignmentGrading;
