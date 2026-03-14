import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "../../components/Skeleton.jsx";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const studentsData = [
  {
    id: 1,
    name: "Ayesha Noor",
    email: "ayesha.noor@sumacademy.pk",
    course: "Biology Masterclass XI",
    progress: 92,
    lastActiveDays: 0,
    enrolledDate: "2026-01-20",
    coursesProgress: [
      {
        id: "bio-1",
        title: "Biology Masterclass XI",
        progress: 92,
        chapters: [
          {
            id: "bio-ch-1",
            title: "Cells & Genetics",
            lectures: [
              { id: "bio-l-1", title: "Cell Structure", completed: true },
              { id: "bio-l-2", title: "DNA Basics", completed: true },
              { id: "bio-l-3", title: "Genetic Variation", completed: false },
            ],
          },
          {
            id: "bio-ch-2",
            title: "Physiology",
            lectures: [
              {
                id: "bio-l-4",
                title: "Circulatory System",
                completed: false,
                locked: true,
              },
              {
                id: "bio-l-5",
                title: "Respiration",
                completed: false,
                locked: true,
              },
            ],
          },
        ],
      },
    ],
    quizResults: [
      {
        id: 1,
        name: "Genetics Quiz",
        score: 82,
        status: "Pass",
        date: "Mar 08, 2026",
      },
      {
        id: 2,
        name: "Cell Biology Quiz",
        score: 74,
        status: "Pass",
        date: "Mar 02, 2026",
      },
    ],
    attendance: {
      percent: 88,
      sessions: [
        { id: 1, date: "Mar 10", status: "Present" },
        { id: 2, date: "Mar 08", status: "Present" },
        { id: 3, date: "Mar 06", status: "Leave" },
        { id: 4, date: "Mar 04", status: "Present" },
        { id: 5, date: "Mar 01", status: "Absent" },
      ],
    },
  },
  {
    id: 2,
    name: "Bilal Khan",
    email: "bilal.khan@sumacademy.pk",
    course: "Chemistry Quick Revision",
    progress: 68,
    lastActiveDays: 2,
    enrolledDate: "2026-02-11",
    coursesProgress: [
      {
        id: "chem-1",
        title: "Chemistry Quick Revision",
        progress: 68,
        chapters: [
          {
            id: "chem-ch-1",
            title: "Organic Chemistry",
            lectures: [
              { id: "chem-l-1", title: "Hydrocarbons", completed: true },
              {
                id: "chem-l-2",
                title: "Functional Groups",
                completed: false,
              },
              {
                id: "chem-l-3",
                title: "Reaction Mechanisms",
                completed: false,
                locked: true,
              },
            ],
          },
        ],
      },
    ],
    quizResults: [
      {
        id: 1,
        name: "Organic Basics",
        score: 61,
        status: "Pass",
        date: "Mar 05, 2026",
      },
    ],
  },
  {
    id: 3,
    name: "Hina Sheikh",
    email: "hina.sheikh@sumacademy.pk",
    course: "Physics Practice Lab",
    progress: 100,
    lastActiveDays: 1,
    enrolledDate: "2025-12-18",
    coursesProgress: [
      {
        id: "phy-1",
        title: "Physics Practice Lab",
        progress: 100,
        chapters: [
          {
            id: "phy-ch-1",
            title: "Mechanics",
            lectures: [
              { id: "phy-l-1", title: "Motion", completed: true },
              { id: "phy-l-2", title: "Energy", completed: true },
            ],
          },
          {
            id: "phy-ch-2",
            title: "Waves",
            lectures: [
              { id: "phy-l-3", title: "Sound Waves", completed: true },
              { id: "phy-l-4", title: "Light Waves", completed: true },
            ],
          },
        ],
      },
    ],
    quizResults: [
      {
        id: 1,
        name: "Mechanics Final",
        score: 92,
        status: "Pass",
        date: "Feb 28, 2026",
      },
    ],
    attendance: {
      percent: 96,
      sessions: [
        { id: 1, date: "Mar 09", status: "Present" },
        { id: 2, date: "Mar 07", status: "Present" },
        { id: 3, date: "Mar 05", status: "Present" },
        { id: 4, date: "Mar 03", status: "Present" },
        { id: 5, date: "Mar 01", status: "Present" },
      ],
    },
  },
  {
    id: 4,
    name: "Usman Raza",
    email: "usman.raza@sumacademy.pk",
    course: "English Essay Clinic",
    progress: 34,
    lastActiveDays: 5,
    enrolledDate: "2026-01-30",
    coursesProgress: [
      {
        id: "eng-1",
        title: "English Essay Clinic",
        progress: 34,
        chapters: [
          {
            id: "eng-ch-1",
            title: "Essay Structure",
            lectures: [
              { id: "eng-l-1", title: "Introductions", completed: true },
              {
                id: "eng-l-2",
                title: "Body Paragraphs",
                completed: false,
              },
              {
                id: "eng-l-3",
                title: "Conclusions",
                completed: false,
                locked: true,
              },
            ],
          },
        ],
      },
    ],
    quizResults: [],
  },
  {
    id: 5,
    name: "Mariam Bukhari",
    email: "mariam.bukhari@sumacademy.pk",
    course: "Entrance Test Sprint",
    progress: 0,
    lastActiveDays: 14,
    enrolledDate: "2026-02-25",
    coursesProgress: [
      {
        id: "entry-1",
        title: "Entrance Test Sprint",
        progress: 0,
        chapters: [
          {
            id: "entry-ch-1",
            title: "Starter Pack",
            lectures: [
              { id: "entry-l-1", title: "Orientation", completed: false },
              {
                id: "entry-l-2",
                title: "Diagnostic Test",
                completed: false,
                locked: true,
              },
            ],
          },
        ],
      },
    ],
    quizResults: [],
  },
  {
    id: 6,
    name: "Sana Ahmed",
    email: "sana.ahmed@sumacademy.pk",
    course: "Biology Masterclass XI",
    progress: 76,
    lastActiveDays: 3,
    enrolledDate: "2026-01-14",
    coursesProgress: [
      {
        id: "bio-2",
        title: "Biology Masterclass XI",
        progress: 76,
        chapters: [
          {
            id: "bio2-ch-1",
            title: "Genetics",
            lectures: [
              { id: "bio2-l-1", title: "Inheritance", completed: true },
              { id: "bio2-l-2", title: "Punnett Squares", completed: true },
              { id: "bio2-l-3", title: "Mutation", completed: false },
            ],
          },
        ],
      },
    ],
    quizResults: [
      {
        id: 1,
        name: "Inheritance Quiz",
        score: 69,
        status: "Pass",
        date: "Mar 06, 2026",
      },
    ],
  },
];

const progressFilters = ["All", "In Progress", "Completed", "Not Started"];
const sortOptions = ["Name", "Progress", "Last Active", "Enrolled Date"];

const formatRelative = (days) => {
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
};

const getInitials = (name) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

const progressColor = (value) => {
  if (value === 0) return "bg-slate-200";
  if (value >= 100) return "bg-emerald-500";
  return "bg-blue-500";
};

const attendanceBadge = (percent) => {
  if (percent >= 75) return "bg-emerald-50 text-emerald-600";
  if (percent >= 50) return "bg-amber-50 text-amber-600";
  return "bg-rose-50 text-rose-600";
};

const sessionStatusStyles = {
  Present: "bg-emerald-50 text-emerald-600",
  Absent: "bg-rose-50 text-rose-500",
  Leave: "bg-slate-100 text-slate-500",
};

function TeacherStudents() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("All");
  const [progressFilter, setProgressFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Name");
  const [page, setPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [unlockCourse, setUnlockCourse] = useState("");
  const [unlockState, setUnlockState] = useState({});
  const [savingAccess, setSavingAccess] = useState(false);
  const [attendanceState, setAttendanceState] = useState({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!selectedStudent) return;
    const firstCourse = selectedStudent.coursesProgress?.[0]?.title || "";
    setUnlockCourse(firstCourse);
    const initialUnlock = {};
    selectedStudent.coursesProgress?.forEach((course) => {
      course.chapters.forEach((chapter) => {
        chapter.lectures.forEach((lecture) => {
          initialUnlock[lecture.id] = lecture.completed;
        });
      });
    });
    setUnlockState(initialUnlock);
    const initialAttendance = {};
    if (selectedStudent.attendance) {
      selectedStudent.attendance.sessions.forEach((session) => {
        initialAttendance[session.id] = session.status;
      });
    }
    setAttendanceState(initialAttendance);
  }, [selectedStudent]);

  useEffect(() => {
    setPage(1);
  }, [search, courseFilter, progressFilter, sortBy]);

  const courseOptions = useMemo(() => {
    const unique = new Set(studentsData.map((student) => student.course));
    return ["All", ...Array.from(unique)];
  }, []);

  const stats = useMemo(() => {
    const total = studentsData.length;
    const active = studentsData.filter(
      (student) => student.lastActiveDays <= 7
    ).length;
    const avg = Math.round(
      studentsData.reduce((sum, student) => sum + student.progress, 0) / total
    );
    return { total, active, avg };
  }, []);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return studentsData.filter((student) => {
      const matchesSearch =
        !query || student.name.toLowerCase().includes(query);
      const matchesCourse =
        courseFilter === "All" || student.course === courseFilter;
      const matchesProgress =
        progressFilter === "All" ||
        (progressFilter === "Completed" && student.progress >= 100) ||
        (progressFilter === "Not Started" && student.progress === 0) ||
        (progressFilter === "In Progress" &&
          student.progress > 0 &&
          student.progress < 100);
      return matchesSearch && matchesCourse && matchesProgress;
    });
  }, [courseFilter, progressFilter, search]);

  const sortedStudents = useMemo(() => {
    const list = [...filteredStudents];
    switch (sortBy) {
      case "Progress":
        return list.sort((a, b) => b.progress - a.progress);
      case "Last Active":
        return list.sort((a, b) => a.lastActiveDays - b.lastActiveDays);
      case "Enrolled Date":
        return list.sort(
          (a, b) => new Date(b.enrolledDate) - new Date(a.enrolledDate)
        );
      default:
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [filteredStudents, sortBy]);

  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(sortedStudents.length / pageSize));
  const paginatedStudents = sortedStudents.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const selectedCourse = useMemo(() => {
    if (!selectedStudent) return null;
    return selectedStudent.coursesProgress.find(
      (course) => course.title === unlockCourse
    );
  }, [selectedStudent, unlockCourse]);

  const lectureList = useMemo(() => {
    if (!selectedCourse) return [];
    return selectedCourse.chapters.flatMap((chapter) =>
      chapter.lectures.map((lecture) => ({
        ...lecture,
        chapterTitle: chapter.title,
      }))
    );
  }, [selectedCourse]);

  const avgQuizScore = useMemo(() => {
    if (!selectedStudent || selectedStudent.quizResults.length === 0) return null;
    const total = selectedStudent.quizResults.reduce(
      (sum, quiz) => sum + quiz.score,
      0
    );
    return Math.round(total / selectedStudent.quizResults.length);
  }, [selectedStudent]);

  const attendancePercent = useMemo(() => {
    if (!selectedStudent?.attendance) return null;
    const sessions = selectedStudent.attendance.sessions;
    if (sessions.length === 0) return 0;
    const presentCount = sessions.filter(
      (session) => attendanceState[session.id] === "Present"
    ).length;
    return Math.round((presentCount / sessions.length) * 100);
  }, [attendanceState, selectedStudent]);

  const displayAttendancePercent =
    attendancePercent ?? selectedStudent?.attendance?.percent ?? 0;

  const handleSaveAccess = () => {
    setSavingAccess(true);
    setTimeout(() => {
      setSavingAccess(false);
      setToast({ type: "success", message: "Rewatch access saved." });
    }, 900);
  };

  const handleSaveAttendance = () => {
    setSavingAttendance(true);
    setTimeout(() => {
      setSavingAttendance(false);
      setToast({ type: "success", message: "Attendance updated." });
    }, 900);
  };

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Students</h1>
      </motion.section>

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`stat-skeleton-${index}`}
                className="glass-card border border-slate-200"
              >
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-4 h-8 w-1/2" />
              </div>
            ))
          : [
              { label: "Total Students", value: stats.total },
              { label: "Active This Week", value: stats.active },
              { label: "Avg Completion Rate", value: `${stats.avg}%` },
            ].map((card) => (
              <div
                key={card.label}
                className="glass-card border border-slate-200"
              >
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {card.value}
                </p>
              </div>
            ))}
      </motion.section>

      <motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <select
            value={courseFilter}
            onChange={(event) => setCourseFilter(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
          >
            {courseOptions.map((course) => (
              <option key={course} value={course}>
                {course === "All" ? "Course: All" : course}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            {progressFilters.map((filter) => (
              <button
                key={filter}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  progressFilter === filter
                    ? "bg-primary text-white"
                    : "border border-slate-200 text-slate-600"
                }`}
                onClick={() => setProgressFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
          >
            {sortOptions.map((option) => (
              <option key={option} value={option}>
                Sort: {option}
              </option>
            ))}
          </select>
        </div>
      </motion.section>

      <motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                <th className="px-3 py-3">Avatar + Name</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Enrolled Course</th>
                <th className="px-3 py-3">Progress</th>
                <th className="px-3 py-3">Last Active</th>
                <th className="px-3 py-3">Completed</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <tr
                      key={`row-skeleton-${index}`}
                      className="border-b border-slate-100"
                    >
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <Skeleton className="h-4 w-28" />
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <Skeleton className="h-3 w-40" />
                      </td>
                      <td className="px-3 py-4">
                        <Skeleton className="h-3 w-32" />
                      </td>
                      <td className="px-3 py-4">
                        <Skeleton className="h-3 w-28" />
                      </td>
                      <td className="px-3 py-4">
                        <Skeleton className="h-3 w-20" />
                      </td>
                      <td className="px-3 py-4">
                        <Skeleton className="h-4 w-10" />
                      </td>
                      <td className="px-3 py-4">
                        <Skeleton className="h-8 w-24 rounded-full" />
                      </td>
                    </tr>
                  ))
                : paginatedStudents.map((student) => (
                    <tr key={student.id} className="border-b border-slate-100">
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {getInitials(student.name)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {student.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        {student.email}
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        {student.course}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-slate-100">
                            <div
                              className={`h-2 rounded-full ${progressColor(
                                student.progress
                              )}`}
                              style={{ width: `${student.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">
                            {student.progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-slate-500">
                        {formatRelative(student.lastActiveDays)}
                      </td>
                      <td className="px-3 py-4">
                        {student.progress >= 100 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">
                            <svg
                              viewBox="0 0 24 24"
                              className="h-3 w-3"
                              fill="currentColor"
                            >
                              <path d="M9 16.2 5.5 12.7l-1.4 1.4L9 19 20.3 7.7l-1.4-1.4z" />
                            </svg>
                            Done
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <button
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-primary hover:text-primary"
                          onClick={() => setSelectedStudent(student)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="currentColor"
                          >
                            <path d="M12 5c-5 0-9 5-9 7s4 7 9 7 9-5 9-7-4-7-9-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
                          </svg>
                          View Progress
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!loading && paginatedStudents.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">
            No students found yet.
          </div>
        )}
        {!loading && sortedStudents.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              >
                Prev
              </button>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                disabled={page === totalPages}
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </motion.section>

      {selectedStudent && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setSelectedStudent(null)}
            aria-label="Close panel"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            className="absolute right-0 top-0 h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-2xl"
          >
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {getInitials(selectedStudent.name)}
                    </div>
                    <div>
                      <h2 className="font-heading text-2xl text-slate-900">
                        {selectedStudent.name}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {selectedStudent.email}
                      </p>
                      <p className="text-xs text-slate-400">
                        Enrolled: {selectedStudent.enrolledDate}
                      </p>
                    </div>
                  </div>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500"
                    onClick={() => setSelectedStudent(null)}
                  >
                    Close
                  </button>
                </div>

                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="font-heading text-xl text-slate-900">
                    Course Progress
                  </h3>
                  <div className="mt-4 space-y-4">
                    {selectedStudent.coursesProgress.map((course) => (
                      <div
                        key={course.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {course.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {course.progress}% complete
                            </p>
                          </div>
                          <div className="h-2 w-24 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          {course.chapters.map((chapter) => (
                            <details
                              key={chapter.id}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                            >
                              <summary className="cursor-pointer font-semibold text-slate-700">
                                {chapter.title}
                              </summary>
                              <div className="mt-3 space-y-2">
                                {chapter.lectures.map((lecture) => (
                                  <div
                                    key={lecture.id}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <span
                                      className={
                                        lecture.locked
                                          ? "text-slate-400"
                                          : "text-slate-600"
                                      }
                                    >
                                      {lecture.title}
                                    </span>
                                    {lecture.locked ? (
                                      <span className="text-slate-400">
                                        <svg
                                          viewBox="0 0 24 24"
                                          className="h-3 w-3"
                                          fill="currentColor"
                                        >
                                          <path d="M6 10V8a6 6 0 1 1 12 0v2h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h1zm2 0h8V8a4 4 0 1 0-8 0v2z" />
                                        </svg>
                                      </span>
                                    ) : lecture.completed ? (
                                      <span className="text-emerald-500">
                                        <svg
                                          viewBox="0 0 24 24"
                                          className="h-3 w-3"
                                          fill="currentColor"
                                        >
                                          <path d="M9 16.2 5.5 12.7l-1.4 1.4L9 19 20.3 7.7l-1.4-1.4z" />
                                        </svg>
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">○</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-xl text-slate-900">
                      Quiz Results
                    </h3>
                    {avgQuizScore !== null && (
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        Avg Score: {avgQuizScore}%
                      </span>
                    )}
                  </div>
                  {selectedStudent.quizResults.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">
                      No quiz attempts yet.
                    </p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                            <th className="py-2">Quiz</th>
                            <th className="py-2">Score</th>
                            <th className="py-2">Result</th>
                            <th className="py-2">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedStudent.quizResults.map((quiz) => (
                            <tr key={quiz.id} className="border-t border-slate-100">
                              <td className="py-2 text-slate-600">
                                {quiz.name}
                              </td>
                              <td className="py-2 text-slate-600">
                                {quiz.score}%
                              </td>
                              <td className="py-2">
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                    quiz.status === "Pass"
                                      ? "bg-emerald-50 text-emerald-600"
                                      : "bg-rose-50 text-rose-500"
                                  }`}
                                >
                                  {quiz.status}
                                </span>
                              </td>
                              <td className="py-2 text-slate-500">{quiz.date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <h3 className="font-heading text-xl text-slate-900">
                    Manage Rewatch Access
                  </h3>
                  <p className="text-sm text-slate-500">
                    Videos auto-lock after course completion.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <select
                      value={unlockCourse}
                      onChange={(event) => setUnlockCourse(event.target.value)}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
                    >
                      {selectedStudent.coursesProgress.map((course) => (
                        <option key={course.id} value={course.title}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-4 space-y-2">
                    {lectureList.map((lecture) => (
                      <div
                        key={lecture.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm"
                      >
                        <span className="text-slate-600">
                          {lecture.title}
                          <span className="ml-2 text-xs text-slate-400">
                            ({lecture.chapterTitle})
                          </span>
                        </span>
                        <button
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            unlockState[lecture.id]
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-slate-200 text-slate-500"
                          }`}
                          onClick={() =>
                            setUnlockState((prev) => ({
                              ...prev,
                              [lecture.id]: !prev[lecture.id],
                            }))
                          }
                        >
                          {unlockState[lecture.id] ? "Unlocked" : "Locked"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn-primary mt-4"
                    onClick={handleSaveAccess}
                    disabled={savingAccess}
                  >
                    {savingAccess ? "Saving..." : "Save Access"}
                  </button>
                </section>

                {selectedStudent.attendance && (
                  <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-heading text-xl text-slate-900">
                        Attendance Summary
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${attendanceBadge(
                          displayAttendancePercent
                        )}`}
                      >
                        {displayAttendancePercent}% Attendance
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm">
                      {selectedStudent.attendance.sessions.map((session) => {
                        const currentStatus =
                          attendanceState[session.id] || session.status;
                        return (
                          <div
                            key={session.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                          >
                            <span className="text-slate-600">{session.date}</span>
                            <div className="flex flex-wrap items-center gap-2">
                              {["Present", "Absent", "Leave"].map((status) => (
                                <button
                                  key={status}
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    currentStatus === status
                                      ? sessionStatusStyles[status]
                                      : "border border-slate-200 text-slate-500"
                                  }`}
                                  onClick={() =>
                                    setAttendanceState((prev) => ({
                                      ...prev,
                                      [session.id]: status,
                                    }))
                                  }
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        className="btn-primary"
                        onClick={handleSaveAttendance}
                        disabled={savingAttendance}
                      >
                        {savingAttendance ? "Saving..." : "Save Attendance"}
                      </button>
                    </div>
                  </section>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {toast && (
        <div className="fixed right-6 top-6 z-[70] rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default TeacherStudents;
