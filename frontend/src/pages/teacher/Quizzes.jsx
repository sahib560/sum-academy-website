import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "react-hot-toast";
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
  getTeacherCourses,
  getTeacherStudents,
  getTeacherClasses,
  getTeacherQuizzes,
  getTeacherQuizAnalytics,
  assignTeacherQuiz,
  createTeacherQuiz,
  bulkUploadTeacherQuiz,
  downloadTeacherQuizTemplate,
  getTeacherQuizSubmissions,
  gradeTeacherShortAnswers,
  getChapters,
} from "../../services/teacher.service.js";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.35 },
};

const previewHeaders = [
  "scope",
  "courseid",
  "subjectid",
  "chapterid",
  "title",
  "description",
  "questiontype",
  "questiontext",
  "optiona",
  "optionb",
  "optionc",
  "optiond",
  "correctanswer",
  "expectedanswer",
  "marks",
];

const scoreColors = ["#4a63f5", "#8090ff", "#a3b0ff", "#c8d0ff", "#e2e7ff"];

const createDefaultQuestion = () => ({
  questionText: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctAnswer: "A",
  marks: 1,
});

const createDefaultQuizMeta = () => ({
  scope: "subject",
  courseId: "",
  subjectId: "",
  chapterId: "",
  title: "",
  description: "",
});

const createDefaultBulkTarget = () => ({
  scope: "chapter",
  courseId: "",
  subjectId: "",
  chapterId: "",
});

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const formatBytes = (size = 0) => {
  const bytes = Number(size || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

const lowerText = (value = "") => String(value || "").trim().toLowerCase();
const trimText = (value = "") => String(value || "").trim();

const mapQuestionType = (value = "") => {
  const normalized = lowerText(value);
  if (["mcq", "multiple_choice", "multiple-choice", "quiz"].includes(normalized)) {
    return "mcq";
  }
  return normalized;
};

const parseCsvLine = (line = "") => {
  const row = [];
  let current = "";
  let insideQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }
    if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  row.push(current);
  return row.map((cell) => trimText(cell));
};

const parseCsvForPreview = (csvText = "") => {
  const rawLines = String(csvText || "").split(/\r?\n/);
  let commentRowsDetected = false;
  let headers = [];
  let headerFound = false;
  const rows = [];

  rawLines.forEach((rawLine, index) => {
    const lineNo = index + 1;
    const trimmed = trimText(rawLine);
    if (!trimmed) return;
    if (trimmed.startsWith("#")) {
      commentRowsDetected = true;
      return;
    }
    if (!headerFound) {
      headers = parseCsvLine(rawLine).map((cell) => lowerText(cell));
      headerFound = true;
      return;
    }
    const values = parseCsvLine(rawLine);
    const row = { __row: lineNo };
    headers.forEach((header, cellIndex) => {
      row[header] = values[cellIndex] ?? "";
    });
    const hasData = headers.some((header) => trimText(row[header]));
    if (!hasData) return;
    rows.push(row);
  });

  const globalErrors = [];
  if (!headers.length) {
    globalErrors.push("CSV header row not found.");
  }

  const missingHeaders = previewHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    globalErrors.push(`Missing columns: ${missingHeaders.join(", ")}`);
  }

  const normalizedRows = rows.map((row) => ({
    rowNo: row.__row,
    scope: lowerText(row.scope),
    courseId: trimText(row.courseid),
    subjectId: trimText(row.subjectid),
    chapterId: trimText(row.chapterid),
    title: trimText(row.title),
    description: trimText(row.description),
    questionType: trimText(row.questiontype),
    questionText: trimText(row.questiontext),
    optionA: trimText(row.optiona),
    optionB: trimText(row.optionb),
    optionC: trimText(row.optionc),
    optionD: trimText(row.optiond),
    correctAnswer: trimText(row.correctanswer),
    expectedAnswer: trimText(row.expectedanswer),
    marks: trimText(row.marks),
  }));

  if (normalizedRows.length === 0) {
    globalErrors.push("CSV must have at least 1 question row");
  }

  const uniqueCourseIds = new Set(normalizedRows.map((row) => row.courseId).filter(Boolean));
  const uniqueSubjectIds = new Set(
    normalizedRows.map((row) => row.subjectId).filter(Boolean)
  );
  const uniqueScopes = new Set(normalizedRows.map((row) => row.scope).filter(Boolean));

  if (normalizedRows.some((row) => !row.courseId) || uniqueCourseIds.size > 1) {
    globalErrors.push(
      "Error: Rows belong to different courses/subjects. Please download a fresh template."
    );
  }
  if (normalizedRows.some((row) => !row.subjectId) || uniqueSubjectIds.size > 1) {
    globalErrors.push(
      "Error: Rows belong to different courses/subjects. Please download a fresh template."
    );
  }
  if (normalizedRows.some((row) => !["chapter", "subject"].includes(row.scope))) {
    globalErrors.push("All rows must have valid scope: chapter or subject.");
  }
  if (uniqueScopes.size > 1) {
    globalErrors.push("Rows have mixed scope values. Download a fresh template.");
  }

  const activeScope = normalizedRows[0]?.scope;
  if (activeScope === "chapter") {
    const uniqueChapterIds = new Set(
      normalizedRows.map((row) => row.chapterId).filter(Boolean)
    );
    if (normalizedRows.some((row) => !row.chapterId) || uniqueChapterIds.size > 1) {
      globalErrors.push("Rows have mixed chapter values. Download a fresh template.");
    }
  }

  const rowPreviews = normalizedRows.map((row) => {
    const rowErrors = [];
    const questionType = mapQuestionType(row.questionType);
    const marksNumber = Number(row.marks);

    if (!row.questionText) rowErrors.push("questionText is required");
    if (!questionType) rowErrors.push("questionType is required");
    if (questionType !== "mcq") {
      rowErrors.push("questionType must be mcq");
    }
    if (!row.marks || !Number.isFinite(marksNumber) || marksNumber <= 0) {
      rowErrors.push("marks must be a positive number");
    }

    if (questionType === "mcq") {
      if (!row.optionA || !row.optionB) {
        rowErrors.push("MCQ requires at least optionA and optionB");
      }
      if (!["A", "B", "C", "D"].includes(row.correctAnswer.toUpperCase())) {
        rowErrors.push("MCQ correctAnswer must be A, B, C, or D");
      }
    }

    return {
      rowNo: row.rowNo,
      questionType: questionType || row.questionType,
      questionText: row.questionText,
      marks: row.marks,
      errors: rowErrors,
    };
  });

  const uniqueGlobalErrors = [...new Set(globalErrors)];
  const hasRowErrors = rowPreviews.some((row) => row.errors.length > 0);
  const isValid = uniqueGlobalErrors.length === 0 && !hasRowErrors && rowPreviews.length > 0;

  return {
    rowPreviews,
    questionCount: rowPreviews.length,
    commentRowsDetected,
    globalErrors: uniqueGlobalErrors,
    isValid,
  };
};

const normalizeUploadError = (rawError = "") => {
  const message = trimText(rawError);
  if (!message) return "Upload failed";
  if (message === "All rows must belong to same course") {
    return "Your CSV has mixed courses. Download a fresh template and try again.";
  }
  if (
    message === "Not your subject" ||
    message === "You are not assigned to this subject"
  ) {
    return "You are not assigned to this subject. Download a fresh template for your subjects.";
  }
  return message;
};

function TeacherQuizzes() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
  const routeBase = location.pathname.startsWith("/admin") ? "/admin/quizzes" : "/teacher/quizzes";

  const [createMeta, setCreateMeta] = useState(createDefaultQuizMeta());
  const [questions, setQuestions] = useState([createDefaultQuestion()]);
  const [bulkTarget, setBulkTarget] = useState(createDefaultBulkTarget());
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkPreview, setBulkPreview] = useState(null);
  const [templateDownloaded, setTemplateDownloaded] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [showQuizPanel, setShowQuizPanel] = useState(false);
  const [gradeDrafts, setGradeDrafts] = useState({});
  const [assignmentDueAt, setAssignmentDueAt] = useState("");
  const [assignmentTargetType, setAssignmentTargetType] = useState("students");
  const [assignmentClassId, setAssignmentClassId] = useState("");
  const [assignmentStudentIds, setAssignmentStudentIds] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [createAssignClassId, setCreateAssignClassId] = useState("");
  const [createAssignDueAt, setCreateAssignDueAt] = useState("");

  const coursesQuery = useQuery({
    queryKey: ["teacher-courses-for-quiz"],
    queryFn: getTeacherCourses,
    staleTime: 60 * 1000,
  });

  const quizzesQuery = useQuery({
    queryKey: ["teacher-quizzes"],
    queryFn: getTeacherQuizzes,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const teacherStudentsQuery = useQuery({
    queryKey: ["teacher-students-for-quiz-assign"],
    queryFn: getTeacherStudents,
    staleTime: 60 * 1000,
  });

  const teacherClassesQuery = useQuery({
    queryKey: ["teacher-classes-for-quiz-assign"],
    queryFn: getTeacherClasses,
    staleTime: 60 * 1000,
  });

  const createSubjectOptions = useMemo(() => {
    const course = (coursesQuery.data || []).find(
      (item) => item.id === createMeta.courseId
    );
    return Array.isArray(course?.mySubjects) ? course.mySubjects : [];
  }, [coursesQuery.data, createMeta.courseId]);

  const bulkSubjectOptions = useMemo(() => {
    const course = (coursesQuery.data || []).find(
      (item) => item.id === bulkTarget.courseId
    );
    return Array.isArray(course?.mySubjects) ? course.mySubjects : [];
  }, [coursesQuery.data, bulkTarget.courseId]);

  const selectedBulkCourse = useMemo(
    () => (coursesQuery.data || []).find((course) => course.id === bulkTarget.courseId),
    [coursesQuery.data, bulkTarget.courseId]
  );

  const selectedBulkSubject = useMemo(
    () =>
      bulkSubjectOptions.find(
        (subject) =>
          subject.subjectId === bulkTarget.subjectId ||
          subject.id === bulkTarget.subjectId
      ),
    [bulkSubjectOptions, bulkTarget.subjectId]
  );

  const createChaptersQuery = useQuery({
    queryKey: [
      "teacher-quiz-chapters-create",
      createMeta.courseId,
      createMeta.subjectId,
    ],
    queryFn: () => getChapters(createMeta.courseId, createMeta.subjectId),
    enabled: Boolean(createMeta.courseId && createMeta.subjectId),
    staleTime: 60 * 1000,
  });

  const bulkChaptersQuery = useQuery({
    queryKey: ["teacher-quiz-chapters-bulk", bulkTarget.courseId, bulkTarget.subjectId],
    queryFn: () => getChapters(bulkTarget.courseId, bulkTarget.subjectId),
    enabled: Boolean(bulkTarget.courseId && bulkTarget.subjectId),
    staleTime: 60 * 1000,
  });

  const selectedBulkChapter = useMemo(
    () => (bulkChaptersQuery.data || []).find((chapter) => chapter.id === bulkTarget.chapterId),
    [bulkChaptersQuery.data, bulkTarget.chapterId]
  );

  const submissionsQuery = useQuery({
    queryKey: ["teacher-quiz-submissions", selectedQuizId],
    queryFn: () => getTeacherQuizSubmissions(selectedQuizId),
    enabled: Boolean(selectedQuizId),
    staleTime: 30 * 1000,
  });

  const analyticsQuery = useQuery({
    queryKey: ["teacher-quiz-analytics", selectedQuizId],
    queryFn: () => getTeacherQuizAnalytics(selectedQuizId),
    enabled: Boolean(selectedQuizId),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const createQuizMutation = useMutation({
    mutationFn: createTeacherQuiz,
    onSuccess: () => {
      toast.success("Quiz created");
      setCreateMeta(createDefaultQuizMeta());
      setQuestions([createDefaultQuestion()]);
      setCreateAssignClassId("");
      setCreateAssignDueAt("");
      queryClient.invalidateQueries({ queryKey: ["teacher-quizzes"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to create quiz");
    },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: ({ file }) =>
      bulkUploadTeacherQuiz(file, (event) => {
        const total = Number(event?.total || 0);
        const loaded = Number(event?.loaded || 0);
        if (!total || loaded < 0) return;
        const percent = Math.min(100, Math.round((loaded / total) * 100));
        setUploadProgress(percent);
      }),
    onMutate: () => {
      setUploadProgress(0);
    },
    onSuccess: (response) => {
      const data = response?.data || {};
      const quizzesCreated = Number(data.quizzesCreated || 0);
      const questionsCreated = Number(data.questionsCreated || 0);
      toast.success(`${quizzesCreated} quizzes created with ${questionsCreated} questions!`);
      setUploadProgress(100);
      setUploadResult(data);
      queryClient.invalidateQueries({ queryKey: ["teacher-quizzes"] });
      if (Array.isArray(data.quizzes) && data.quizzes[0]?.id) {
        setSelectedQuizId(data.quizzes[0].id);
        setShowQuizPanel(true);
      }
    },
    onError: (error) => {
      const message = normalizeUploadError(error?.response?.data?.error || "");
      toast.error(message || "Upload failed");
      setUploadProgress(0);
    },
  });

  const gradeMutation = useMutation({
    mutationFn: ({ quizId, resultId, payload }) =>
      gradeTeacherShortAnswers(quizId, resultId, payload),
    onSuccess: () => {
      toast.success("Manual grades saved");
      queryClient.invalidateQueries({
        queryKey: ["teacher-quiz-submissions", selectedQuizId],
      });
      queryClient.invalidateQueries({ queryKey: ["teacher-quizzes"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to save grades");
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ quizId, payload }) => assignTeacherQuiz(quizId, payload),
    onSuccess: (response) => {
      const total = Number(response?.data?.assignment?.totalAssigned || 0);
      toast.success(`Quiz assigned to ${total} students`);
      queryClient.invalidateQueries({ queryKey: ["teacher-quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-quiz-analytics", selectedQuizId] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to assign quiz");
    },
  });

  const bulkTargetReady =
    Boolean(bulkTarget.courseId) &&
    Boolean(bulkTarget.subjectId) &&
    (bulkTarget.scope === "subject" || Boolean(bulkTarget.chapterId));

  const quizzes = Array.isArray(quizzesQuery.data) ? quizzesQuery.data : [];
  const selectedQuiz = quizzes.find((quiz) => quiz.id === selectedQuizId) || null;
  const analyticsData = analyticsQuery.data || null;

  const teacherStudents = useMemo(() => {
    const rows = Array.isArray(teacherStudentsQuery.data) ? teacherStudentsQuery.data : [];
    return rows.map((student) => ({
      studentId: student.uid || student.id || student.studentId || "",
      fullName: student.fullName || student.name || "Student",
      email: student.email || "",
      enrolledCourseIds: Array.isArray(student.enrolledCourses)
        ? student.enrolledCourses
            .map((course) => course.courseId || course.id)
            .filter(Boolean)
        : [],
    }));
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

  const assignmentSummary = analyticsData?.assignment || selectedQuiz?.assignment || null;
  const classOptions = useMemo(() => {
    const rows = Array.isArray(teacherClassesQuery.data) ? teacherClassesQuery.data : [];
    const targetCourseId = selectedQuiz?.courseId || "";
    if (!targetCourseId) return rows;
    return rows.filter((row) =>
      (Array.isArray(row.assignedCourses) ? row.assignedCourses : []).some((entry) => {
        const courseId = trimText(
          typeof entry === "string" ? entry : entry?.courseId || entry?.id
        );
        return courseId === targetCourseId;
      })
    );
  }, [teacherClassesQuery.data, selectedQuiz?.courseId]);

  const createClassOptions = useMemo(() => {
    const rows = Array.isArray(teacherClassesQuery.data) ? teacherClassesQuery.data : [];
    if (!createMeta.courseId) return rows;
    return rows.filter((row) =>
      (Array.isArray(row.assignedCourses) ? row.assignedCourses : []).some((entry) => {
        const courseId = trimText(
          typeof entry === "string" ? entry : entry?.courseId || entry?.id
        );
        return courseId === createMeta.courseId;
      })
    );
  }, [teacherClassesQuery.data, createMeta.courseId]);

  const onAddQuestion = () => {
    setQuestions((prev) => [...prev, createDefaultQuestion()]);
  };

  const onRemoveQuestion = (index) => {
    setQuestions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const onUpdateQuestion = (index, key, value) => {
    setQuestions((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    );
  };

  const openQuizPanel = (quiz) => {
    setSelectedQuizId(quiz.id);
    setShowQuizPanel(true);
    const assignedStudents = Array.isArray(quiz?.assignment?.students)
      ? quiz.assignment.students
      : [];
    setAssignmentStudentIds(
      assignedStudents
        .map((row) => row.studentId || row.id)
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    );
    setAssignmentDueAt(toDateTimeLocalValue(quiz?.assignment?.dueAt));
    setAssignmentTargetType(
      ["students", "course", "class"].includes(
        lowerText(quiz?.assignment?.targetType || "")
      )
        ? lowerText(quiz.assignment.targetType)
        : "students"
    );
    setAssignmentClassId(trimText(quiz?.assignment?.classId));
  };

  const toggleAssignStudent = (studentId) => {
    setAssignmentStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleAssignQuiz = () => {
    if (!selectedQuizId) {
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
    if (assignmentTargetType === "students" && !assignmentStudentIds.length) {
      toast.error("Select at least one student");
      return;
    }
    assignMutation.mutate({
      quizId: selectedQuizId,
      payload: {
        dueAt: new Date(assignmentDueAt).toISOString(),
        targetType: assignmentTargetType,
        classId: assignmentTargetType === "class" ? assignmentClassId : "",
        courseId: assignmentTargetType === "course" ? selectedQuiz?.courseId || "" : "",
        studentIds: assignmentTargetType === "students" ? assignmentStudentIds : [],
      },
    });
  };

  const validateCreateForm = () => {
    if (!createMeta.title.trim() || createMeta.title.trim().length < 3) {
      toast.error("Quiz title must be at least 3 characters");
      return false;
    }
    if (!createMeta.courseId || !createMeta.subjectId) {
      toast.error("Select course and subject");
      return false;
    }
    if (createMeta.scope === "chapter" && !createMeta.chapterId) {
      toast.error("Select chapter for chapter quiz");
      return false;
    }
    if (!questions.length) {
      toast.error("Add at least one question");
      return false;
    }
    if (createAssignClassId && !createAssignDueAt) {
      toast.error("Select due date/time for class assignment");
      return false;
    }
    let rowError = "";
    for (let index = 0; index < questions.length; index += 1) {
      const row = questions[index];
      const rowNo = index + 1;
      if (!trimText(row.questionText)) {
        rowError = `Question ${rowNo}: question text is required`;
        break;
      }
      const marks = Number(row.marks);
      if (!Number.isFinite(marks) || marks <= 0) {
        rowError = `Question ${rowNo}: marks must be greater than 0`;
        break;
      }
      if (!trimText(row.optionA) || !trimText(row.optionB)) {
        rowError = `Question ${rowNo}: option A and option B are required`;
        break;
      }
      const correctLetter = String(row.correctAnswer || "").toUpperCase();
      if (!["A", "B", "C", "D"].includes(correctLetter)) {
        rowError = `Question ${rowNo}: correct answer must be A, B, C, or D`;
        break;
      }
      const optionMap = {
        A: trimText(row.optionA),
        B: trimText(row.optionB),
        C: trimText(row.optionC),
        D: trimText(row.optionD),
      };
      if (!optionMap[correctLetter]) {
        rowError = `Question ${rowNo}: selected correct option ${correctLetter} is empty`;
        break;
      }
    }
    if (rowError) {
      toast.error(rowError);
      return false;
    }
    return true;
  };

  const handleCreateQuiz = () => {
    if (!validateCreateForm()) return;

    const payloadQuestions = questions.map((row) => {
      const options = [row.optionA, row.optionB, row.optionC, row.optionD]
        .map((option) => option.trim())
        .filter(Boolean);
      const optionMap = {
        A: options[0],
        B: options[1],
        C: options[2],
        D: options[3],
      };
      return {
        type: "mcq",
        questionText: row.questionText,
        options,
        correctAnswer: optionMap[String(row.correctAnswer || "A").toUpperCase()] || "",
        marks: Number(row.marks) || 1,
      };
    });

    createQuizMutation.mutate({
      ...createMeta,
      assignmentTargetType: createAssignClassId ? "class" : "",
      assignToClassId: createAssignClassId || "",
      dueAt: createAssignClassId ? new Date(createAssignDueAt).toISOString() : "",
      questions: payloadQuestions,
    });
  };

  const handleTemplateDownload = async () => {
    if (!bulkTargetReady) {
      toast.error("Select course, subject, scope, and chapter (if required)");
      return;
    }
    try {
      const { blob, filename } = await downloadTeacherQuizTemplate({
        courseId: bulkTarget.courseId,
        subjectId: bulkTarget.subjectId,
        scope: bulkTarget.scope,
        chapterId: bulkTarget.scope === "chapter" ? bulkTarget.chapterId : "",
        courseName: selectedBulkCourse?.title || "",
        subjectName:
          selectedBulkSubject?.subjectName || selectedBulkSubject?.name || "",
        chapterName: selectedBulkChapter?.title || "",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "quiz_template.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setTemplateDownloaded(true);
      toast.success("Template downloaded! Fill questions and upload.");
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to download template");
    }
  };

  const resetBulkFlow = () => {
    setBulkTarget(createDefaultBulkTarget());
    setBulkFile(null);
    setBulkPreview(null);
    setTemplateDownloaded(false);
    setUploadResult(null);
    setUploadProgress(0);
    setDragActive(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCsvSelection = async (file) => {
    if (!file) return;
    const isCsv =
      lowerText(file?.type).includes("csv") || lowerText(file?.name).endsWith(".csv");
    if (!isCsv) {
      toast.error("Please upload a CSV file only");
      return;
    }

    try {
      const text = await file.text();
      const preview = parseCsvForPreview(text);
      setBulkFile(file);
      setBulkPreview(preview);
      setUploadResult(null);
      setUploadProgress(0);

      if (preview.globalErrors.length || !preview.isValid) {
        toast.error("Fix errors in CSV before uploading");
      } else {
        toast.success("CSV looks good. Ready to upload.");
      }
    } catch {
      toast.error("Unable to read CSV file");
    }
  };

  const handleFileInputChange = (event) => {
    const file = event.target.files?.[0];
    handleCsvSelection(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const file = event.dataTransfer?.files?.[0];
    handleCsvSelection(file);
  };

  const handleBulkUpload = () => {
    if (!bulkFile || !bulkPreview?.isValid) {
      toast.error("Fix errors in CSV before uploading");
      return;
    }
    bulkUploadMutation.mutate({ file: bulkFile });
  };

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

  const handleSaveSubmissionGrade = (resultId, shortAnswers = []) => {
    if (!selectedQuizId) return;
    const gradedAnswers = shortAnswers.map((row) => {
      const key = `${resultId}:${row.questionId}`;
      const draft = gradeDrafts[key] || {
        marks:
          row.marksAwarded === null || row.marksAwarded === undefined
            ? ""
            : row.marksAwarded,
        feedback: row.feedback || "",
      };
      return {
        questionId: row.questionId,
        marks: Number(draft.marks || 0),
        feedback: draft.feedback || "",
      };
    });

    gradeMutation.mutate({
      quizId: selectedQuizId,
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
            <h2 className="font-heading text-2xl text-slate-900">Quiz Builder</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create chapter-wise or full subject quizzes and bulk-upload from a prefilled CSV
              template.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-outline"
              onClick={() => navigate(`${routeBase}/my`)}
            >
              My Quizzes
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => navigate(`${routeBase}/detail`)}
            >
              Assignment & Grading
            </button>
          </div>
        </div>
      </Motion.section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Motion.section
          {...fadeUp}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 className="font-heading text-xl text-slate-900">Create Quiz Manually</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Quiz title"
              value={createMeta.title}
              onChange={(event) =>
                setCreateMeta((prev) => ({ ...prev, title: event.target.value }))
              }
            />

            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={createMeta.courseId}
              onChange={(event) =>
                setCreateMeta((prev) => ({
                  ...prev,
                  courseId: event.target.value,
                  subjectId: "",
                  chapterId: "",
                }))
              }
            >
              <option value="">Select Course</option>
              {(coursesQuery.data || []).map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={createMeta.subjectId}
              onChange={(event) =>
                setCreateMeta((prev) => ({
                  ...prev,
                  subjectId: event.target.value,
                  chapterId: "",
                }))
              }
            >
              <option value="">Select Subject</option>
              {createSubjectOptions.map((subject) => (
                <option key={subject.subjectId || subject.id} value={subject.subjectId || subject.id}>
                  {subject.subjectName || subject.name}
                </option>
              ))}
            </select>

            <div className="sm:col-span-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Scope
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    createMeta.scope === "chapter"
                      ? "bg-[#4a63f5] text-white"
                      : "border border-slate-200 text-slate-600"
                  }`}
                  onClick={() =>
                    setCreateMeta((prev) => ({ ...prev, scope: "chapter", chapterId: "" }))
                  }
                >
                  Chapter Quiz
                </button>
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    createMeta.scope === "subject"
                      ? "bg-[#4a63f5] text-white"
                      : "border border-slate-200 text-slate-600"
                  }`}
                  onClick={() =>
                    setCreateMeta((prev) => ({ ...prev, scope: "subject", chapterId: "" }))
                  }
                >
                  Full Subject Quiz
                </button>
              </div>
            </div>

            {createMeta.scope === "chapter" ? (
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
                value={createMeta.chapterId}
                onChange={(event) =>
                  setCreateMeta((prev) => ({ ...prev, chapterId: event.target.value }))
                }
              >
                <option value="">Select Chapter</option>
                {(createChaptersQuery.data || []).map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.title}
                  </option>
                ))}
              </select>
            ) : null}

            <textarea
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              rows={2}
              placeholder="Description (optional)"
              value={createMeta.description}
              onChange={(event) =>
                setCreateMeta((prev) => ({ ...prev, description: event.target.value }))
              }
            />

            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              value={createAssignClassId}
              onChange={(event) => setCreateAssignClassId(event.target.value)}
            >
              <option value="">Assign later (optional)</option>
              {createClassOptions.map((classRow) => (
                <option key={classRow.id} value={classRow.id}>
                  {classRow.name}
                  {classRow.batchCode ? ` (${classRow.batchCode})` : ""}
                </option>
              ))}
            </select>

            {createAssignClassId ? (
              <input
                type="datetime-local"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
                value={createAssignDueAt}
                onChange={(event) => setCreateAssignDueAt(event.target.value)}
              />
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {questions.map((question, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">Question {index + 1}</p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose-600"
                    onClick={() => onRemoveQuestion(index)}
                  >
                    Remove
                  </button>
                </div>
                <div className="grid gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    MCQ Question
                  </p>
                  <input
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Question text"
                    value={question.questionText}
                    onChange={(event) =>
                      onUpdateQuestion(index, "questionText", event.target.value)
                    }
                  />
                  <input
                    type="number"
                    min="1"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Marks"
                    value={question.marks}
                    onChange={(event) => onUpdateQuestion(index, "marks", event.target.value)}
                  />
                  <input
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Option A"
                    value={question.optionA}
                    onChange={(event) =>
                      onUpdateQuestion(index, "optionA", event.target.value)
                    }
                  />
                  <input
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Option B"
                    value={question.optionB}
                    onChange={(event) =>
                      onUpdateQuestion(index, "optionB", event.target.value)
                    }
                  />
                  <input
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Option C"
                    value={question.optionC}
                    onChange={(event) =>
                      onUpdateQuestion(index, "optionC", event.target.value)
                    }
                  />
                  <input
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Option D"
                    value={question.optionD}
                    onChange={(event) =>
                      onUpdateQuestion(index, "optionD", event.target.value)
                    }
                  />
                  <select
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={String(question.correctAnswer || "A").toUpperCase()}
                    onChange={(event) =>
                      onUpdateQuestion(index, "correctAnswer", event.target.value)
                    }
                  >
                    <option value="A">Correct: A</option>
                    <option value="B">Correct: B</option>
                    <option value="C">Correct: C</option>
                    <option value="D">Correct: D</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-outline" onClick={onAddQuestion}>
              Add Question
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleCreateQuiz}
              disabled={createQuizMutation.isPending}
            >
              {createQuizMutation.isPending ? "Creating..." : "Create Quiz"}
            </button>
          </div>
        </Motion.section>

        <Motion.section
          {...fadeUp}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 className="font-heading text-xl text-slate-900">Bulk Upload (CSV)</h3>
          <p className="mt-1 text-sm text-slate-500">
            Select target first, then download a prefilled template and upload your filled CSV.
          </p>

          <Motion.div
            key={`${bulkTarget.courseId}-${bulkTarget.subjectId}-${bulkTarget.scope}-${bulkTarget.chapterId}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-4 space-y-4"
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Step 1 - Select Target
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={bulkTarget.courseId}
                  onChange={(event) =>
                    setBulkTarget((prev) => ({
                      ...prev,
                      courseId: event.target.value,
                      subjectId: "",
                      chapterId: "",
                    }))
                  }
                >
                  <option value="">Select Course</option>
                  {(coursesQuery.data || []).map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>

                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={bulkTarget.subjectId}
                  onChange={(event) =>
                    setBulkTarget((prev) => ({
                      ...prev,
                      subjectId: event.target.value,
                      chapterId: "",
                    }))
                  }
                  disabled={!bulkTarget.courseId}
                >
                  <option value="">Select Subject</option>
                  {bulkSubjectOptions.map((subject) => (
                    <option key={subject.subjectId || subject.id} value={subject.subjectId || subject.id}>
                      {subject.subjectName || subject.name}
                    </option>
                  ))}
                </select>

                <div className="sm:col-span-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`rounded-full px-4 py-2 text-xs font-semibold ${
                        bulkTarget.scope === "chapter"
                          ? "bg-[#4a63f5] text-white"
                          : "border border-slate-200 text-slate-600"
                      }`}
                      onClick={() =>
                        setBulkTarget((prev) => ({ ...prev, scope: "chapter", chapterId: "" }))
                      }
                    >
                      Chapter Quiz
                    </button>
                    <button
                      type="button"
                      className={`rounded-full px-4 py-2 text-xs font-semibold ${
                        bulkTarget.scope === "subject"
                          ? "bg-[#4a63f5] text-white"
                          : "border border-slate-200 text-slate-600"
                      }`}
                      onClick={() =>
                        setBulkTarget((prev) => ({ ...prev, scope: "subject", chapterId: "" }))
                      }
                    >
                      Full Subject Quiz
                    </button>
                  </div>
                </div>

                {bulkTarget.scope === "chapter" ? (
                  <select
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
                    value={bulkTarget.chapterId}
                    onChange={(event) =>
                      setBulkTarget((prev) => ({ ...prev, chapterId: event.target.value }))
                    }
                    disabled={!bulkTarget.courseId || !bulkTarget.subjectId}
                  >
                    <option value="">Select Chapter</option>
                    {(bulkChaptersQuery.data || []).map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.title}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Step 2 - Download Template
              </p>
              <button
                type="button"
                className="btn-primary mt-3"
                onClick={handleTemplateDownload}
                disabled={!bulkTargetReady}
              >
                Download Template
              </button>

              {templateDownloaded ? (
                <p className="mt-3 text-xs font-semibold text-emerald-600">
                  Template downloaded! Open in Excel, fill your questions, then upload below.
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Step 3 - Upload Filled CSV
              </p>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                }}
                onDrop={handleDrop}
                className={`mt-3 rounded-2xl border-2 border-dashed p-5 text-center text-sm ${
                  dragActive
                    ? "border-[#4a63f5] bg-[#4a63f5]/5"
                    : "border-slate-300 bg-slate-50"
                }`}
              >
                Drop your filled CSV here or click to browse
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileInputChange}
              />

              {bulkFile ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs">
                  <p className="font-semibold text-emerald-700">
                    {bulkFile.name} ({formatBytes(bulkFile.size)}) - valid CSV
                  </p>
                </div>
              ) : null}

              {bulkPreview?.commentRowsDetected ? (
                <p className="mt-3 text-xs font-semibold text-amber-600">
                  Comment row detected - will be skipped.
                </p>
              ) : null}

              {bulkPreview?.globalErrors?.length ? (
                <div className="mt-3 space-y-1 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  {bulkPreview.globalErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : null}

              {bulkPreview ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">
                    {bulkPreview.questionCount} questions found in file
                  </p>
                  {bulkPreview.rowPreviews.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600">
                          <tr>
                            <th className="px-3 py-2">Row</th>
                            <th className="px-3 py-2">questionType</th>
                            <th className="px-3 py-2">questionText</th>
                            <th className="px-3 py-2">marks</th>
                            <th className="px-3 py-2">errors</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkPreview.rowPreviews.slice(0, 5).map((row) => (
                            <tr
                              key={row.rowNo}
                              className={
                                row.errors.length
                                  ? "border-t border-rose-200 bg-rose-50"
                                  : "border-t border-slate-200"
                              }
                            >
                              <td className="px-3 py-2 text-slate-500">{row.rowNo}</td>
                              <td className="px-3 py-2 text-slate-700">{row.questionType}</td>
                              <td className="px-3 py-2 text-slate-700">{row.questionText}</td>
                              <td className="px-3 py-2 text-slate-700">{row.marks}</td>
                              <td className="px-3 py-2 text-rose-600">
                                {row.errors.join(", ") || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {bulkUploadMutation.isPending ? (
                <div className="mt-3">
                  <p className="text-xs text-slate-500">Uploading... {uploadProgress}%</p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-[#4a63f5] transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleBulkUpload}
                  disabled={!bulkFile || !bulkPreview?.isValid || bulkUploadMutation.isPending}
                >
                  {bulkUploadMutation.isPending ? "Uploading..." : "Upload CSV"}
                </button>
                <button type="button" className="btn-outline" onClick={resetBulkFlow}>
                  Start Over
                </button>
              </div>

              <AnimatePresence>
                {uploadResult ? (
                  <Motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm"
                  >
                    <p className="font-semibold text-emerald-700">Upload successful!</p>
                    <p className="mt-1 text-emerald-700">
                      {uploadResult.quizzesCreated || 0} quizzes created
                    </p>
                    <p className="text-emerald-700">
                      {uploadResult.questionsCreated || 0} questions added
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-emerald-800">
                      {(uploadResult.quizzes || []).map((quiz) => (
                        <p key={quiz.id}>
                          {quiz.title} ({quiz.questionsCount} questions)
                        </p>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn-outline mt-3"
                      onClick={() => navigate(`${routeBase}/my`)}
                    >
                      View Quizzes
                    </button>
                  </Motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </Motion.div>
        </Motion.section>
      </div>

      <div className="hidden grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Motion.section
          id="teacher-quiz-list"
          {...fadeUp}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 className="font-heading text-xl text-slate-900">My Quizzes</h3>
          {quizzesQuery.isLoading ? (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {(quizzesQuery.data || []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No quizzes yet.
                </div>
              ) : (
                (quizzesQuery.data || []).map((quiz) => (
                  <button
                    key={quiz.id}
                    type="button"
                    onClick={() => openQuizPanel(quiz)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm ${
                      selectedQuizId === quiz.id
                        ? "border-[#4a63f5] bg-[#4a63f5]/5"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
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
                    <p className="mt-1 text-xs text-slate-500">
                      {quiz.questionCount} questions | {quiz.totalMarks} marks
                    </p>
                    {quiz.assignment?.dueAt ? (
                      <p className="mt-1 text-xs font-semibold text-indigo-600">
                        Due: {formatDateTime(quiz.assignment.dueAt)}
                      </p>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          )}
        </Motion.section>

        <Motion.section
          {...fadeUp}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 className="font-heading text-xl text-slate-900">
            Quiz Detail, Assignment & Grading
          </h3>
          {!selectedQuizId ? (
            <p className="mt-3 text-sm text-slate-500">
              Select a quiz from My Quizzes to open details, assign students with due date/time,
              and view results.
            </p>
          ) : (
            <div className="mt-4 space-y-5">
              <AnimatePresence mode="wait">
                {showQuizPanel ? (
                  <Motion.div
                    key={selectedQuizId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="space-y-4"
                  >
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                      <p className="text-lg font-semibold text-slate-900">
                        {selectedQuiz?.title || "Quiz"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {selectedQuiz?.courseName} | {selectedQuiz?.subjectName}
                        {selectedQuiz?.chapterTitle ? ` | ${selectedQuiz.chapterTitle}` : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700">
                          {selectedQuiz?.questionCount || 0} Questions
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700">
                          {selectedQuiz?.totalMarks || 0} Marks
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700">
                          Assigned: {assignmentSummary?.totalAssigned || 0}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700">
                          Due: {assignmentSummary?.dueAt ? formatDateTime(assignmentSummary.dueAt) : "Not set"}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-semibold text-slate-800">
                        Assign Quiz To Students
                      </p>
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
                            <div className="max-h-52 space-y-2 overflow-auto rounded-xl border border-slate-200 p-2">
                              {(filteredStudents || []).map((student) => {
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
                              {filteredStudents.length === 0 ? (
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

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-semibold text-slate-800">Result Analytics</p>
                      {analyticsQuery.isLoading ? (
                        <div className="mt-3 space-y-2">
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-36 w-full" />
                        </div>
                      ) : analyticsData ? (
                        <Motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 space-y-4"
                        >
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

                          <div className="h-52 rounded-xl border border-slate-200 p-2">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={analyticsData.scoreDistribution || []}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="range" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                  {(analyticsData.scoreDistribution || []).map((entry, index) => (
                                    <Cell key={`cell-${entry.range}`} fill={scoreColors[index % scoreColors.length]} />
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
                        </Motion.div>
                      ) : (
                        <p className="mt-3 text-xs text-slate-500">No analytics available yet.</p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-semibold text-slate-800">
                        Assigned Students And Results
                      </p>
                      {assignedStudentRows.length < 1 ? (
                        <p className="mt-3 text-xs text-slate-500">
                          No assigned students found for this quiz.
                        </p>
                      ) : (
                        <div className="mt-3 overflow-x-auto">
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
                                  className="border-b border-slate-100"
                                >
                                  <td className="px-2 py-2 text-slate-900">{row.fullName}</td>
                                  <td className="px-2 py-2 text-slate-600">{row.email || "-"}</td>
                                  <td className="px-2 py-2">
                                    <span
                                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                        row.status === "not_attempted"
                                          ? "bg-slate-100 text-slate-600"
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
                                  <td className="px-2 py-2 text-slate-700">{row.attemptsCount}</td>
                                  <td className="px-2 py-2 text-slate-700">
                                    {row.status === "not_attempted"
                                      ? "-"
                                      : `${Math.round(row.scorePercent)}% (${row.totalScore}/${row.totalMarks})`}
                                  </td>
                                  <td className="px-2 py-2 text-slate-600">
                                    {formatDateTime(row.submittedAt)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </Motion.div>
                ) : null}
              </AnimatePresence>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-semibold text-slate-800">
                  Manual Grading (Legacy Non-MCQ Quizzes)
                </h4>
                {submissionsQuery.isLoading ? (
                  <div className="mt-4 space-y-2">
                    {Array.from({ length: 3 }).map((_, index) => (
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
                        <p className="text-sm font-semibold text-slate-900">{submission.studentName}</p>
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
              </div>
            </div>
          )}
        </Motion.section>
      </div>
    </div>
  );
}

export default TeacherQuizzes;
