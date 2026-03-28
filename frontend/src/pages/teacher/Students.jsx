import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Toaster, toast } from "react-hot-toast";
import { jsPDF } from "jspdf";
import { Skeleton } from "../../components/Skeleton.jsx";
import {
  getStudentAttendance,
  getStudentProgress,
  getTeacherStudentById,
  getTeacherStudents,
  updateStudentVideoAccess,
} from "../../services/teacher.service.js";

const QUERY_STALE_TIME = 30000;
const NOW_TS = Date.now();

const PROGRESS_FILTER_OPTIONS = [
  { id: "all", label: "All" },
  { id: "not_started", label: "Not Started" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
];

const SORT_OPTIONS = [
  { id: "name", label: "Name A-Z" },
  { id: "most_progress", label: "Most Progress" },
  { id: "least_progress", label: "Least Progress" },
  { id: "recent_active", label: "Recently Active" },
  { id: "newest_enrolled", label: "Newest Enrolled" },
];

const PROFILE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "progress", label: "Course Progress" },
  { id: "quiz", label: "Quiz Results" },
  { id: "attendance", label: "Attendance" },
];

const clampPercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const asDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toYmd = (value) => {
  const date = asDate(value);
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatNumber = (value) => Number(value || 0).toLocaleString("en-US");

const getInitials = (name = "") =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "S";

const formatRelativeTime = (value) => {
  const date = asDate(value);
  if (!date) return "Never";

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
};

const formatReadableDate = (value) => {
  const date = asDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const getProgressTone = (value) => {
  const percent = clampPercent(value);
  if (percent >= 75) return "bg-emerald-500";
  if (percent >= 25) return "bg-amber-500";
  return "bg-rose-500";
};

const getProgressTextTone = (value) => {
  const percent = clampPercent(value);
  if (percent >= 75) return "text-emerald-600";
  if (percent >= 25) return "text-amber-600";
  return "text-rose-600";
};

const getStatusBadgeClass = (isActive) =>
  isActive
    ? "bg-emerald-50 text-emerald-700"
    : "bg-rose-50 text-rose-700";

const getLatestEnrollmentDate = (student = {}) => {
  const courses = Array.isArray(student.enrolledCourses) ? student.enrolledCourses : [];
  return courses
    .map((course) => asDate(course.enrolledAt))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;
};

const buildCalendarGrid = (monthDate, sessions = []) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  const statusByDate = {};
  sessions.forEach((session) => {
    const key = toYmd(session.date);
    if (!key) return;
    statusByDate[key] = String(session.status || "").toLowerCase();
  });

  const days = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = toYmd(date);
    days.push({
      key,
      date,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      status: statusByDate[key] || "none",
    });
  }
  return days;
};

const statusColorByAttendance = {
  present: "bg-emerald-500",
  absent: "bg-rose-500",
  late: "bg-amber-500",
  none: "bg-slate-200",
};

const getLectureMetaMap = (profile = null) => {
  const lectures = Array.isArray(profile?.teacherLectures) ? profile.teacherLectures : [];
  return Object.fromEntries(
    lectures.map((lecture) => [lecture.lectureId, lecture])
  );
};

const IconBase = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const EyeIcon = () => (
  <IconBase>
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
    <circle cx="12" cy="12" r="3" />
  </IconBase>
);

const LockIcon = () => (
  <IconBase>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 1 1 8 0v3" />
  </IconBase>
);

const MessageIcon = () => (
  <IconBase>
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
  </IconBase>
);

const UsersIcon = () => (
  <IconBase>
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <path d="M20 8v6M23 11h-6" />
  </IconBase>
);

const CheckIcon = () => (
  <IconBase>
    <path d="m5 12 4 4 10-10" />
  </IconBase>
);

function Students() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [activeProfileTab, setActiveProfileTab] = useState("overview");
  const [selectedProgressCourseId, setSelectedProgressCourseId] = useState("");
  const [selectedAttendanceClassId, setSelectedAttendanceClassId] = useState("");
  const [attendanceMonth, setAttendanceMonth] = useState(new Date());
  const [profileAccessDraft, setProfileAccessDraft] = useState({});

  const [quickAccessStudentId, setQuickAccessStudentId] = useState("");
  const [quickAccessCourseId, setQuickAccessCourseId] = useState("");
  const [quickAccessDraft, setQuickAccessDraft] = useState({});

  const studentsQuery = useQuery({
    queryKey: ["teacher-students"],
    queryFn: getTeacherStudents,
    staleTime: QUERY_STALE_TIME,
  });

  const profileQuery = useQuery({
    queryKey: ["teacher-student-profile", selectedStudentId],
    queryFn: () => getTeacherStudentById(selectedStudentId),
    enabled: Boolean(selectedStudentId),
    staleTime: QUERY_STALE_TIME,
  });

  const profileProgressQuery = useQuery({
    queryKey: ["teacher-student-progress", selectedStudentId, selectedProgressCourseId],
    queryFn: () => getStudentProgress(selectedStudentId, selectedProgressCourseId),
    enabled: Boolean(selectedStudentId && selectedProgressCourseId),
    staleTime: QUERY_STALE_TIME,
  });

  const attendanceQuery = useQuery({
    queryKey: ["teacher-student-attendance", selectedStudentId, selectedAttendanceClassId],
    queryFn: () => getStudentAttendance(selectedStudentId, selectedAttendanceClassId),
    enabled: Boolean(selectedStudentId && selectedAttendanceClassId && activeProfileTab === "attendance"),
    staleTime: QUERY_STALE_TIME,
  });

  const quickProfileQuery = useQuery({
    queryKey: ["teacher-quick-student", quickAccessStudentId],
    queryFn: () => getTeacherStudentById(quickAccessStudentId),
    enabled: Boolean(quickAccessStudentId),
    staleTime: QUERY_STALE_TIME,
  });

  const quickProgressQuery = useQuery({
    queryKey: ["teacher-quick-progress", quickAccessStudentId, quickAccessCourseId],
    queryFn: () => getStudentProgress(quickAccessStudentId, quickAccessCourseId),
    enabled: Boolean(quickAccessStudentId && quickAccessCourseId),
    staleTime: QUERY_STALE_TIME,
  });

  const profileVideoAccessMutation = useMutation({
    mutationFn: ({ studentId, lectureAccess }) =>
      updateStudentVideoAccess(studentId, { lectureAccess }),
  });

  const quickVideoAccessMutation = useMutation({
    mutationFn: ({ studentId, lectureAccess }) =>
      updateStudentVideoAccess(studentId, { lectureAccess }),
  });

  const students = useMemo(
    () => (Array.isArray(studentsQuery.data) ? studentsQuery.data : []),
    [studentsQuery.data]
  );

  const profileProgressLectures = profileProgressQuery.data?.lectures;
  const quickProgressLectures = quickProgressQuery.data?.lectures;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!profileQuery.data) {
      setSelectedProgressCourseId("");
      setSelectedAttendanceClassId("");
      setProfileAccessDraft({});
      return;
    }

    const courses = Array.isArray(profileQuery.data.enrolledCourses)
      ? profileQuery.data.enrolledCourses
      : [];
    if (!selectedProgressCourseId && courses.length > 0) {
      setSelectedProgressCourseId(courses[0].courseId);
    }

    const classes = Array.isArray(profileQuery.data.availableClasses)
      ? profileQuery.data.availableClasses
      : [];
    if (!selectedAttendanceClassId && classes.length > 0) {
      setSelectedAttendanceClassId(classes[0].classId);
    }
  }, [profileQuery.data, selectedProgressCourseId, selectedAttendanceClassId]);

  useEffect(() => {
    const lectures = Array.isArray(profileProgressLectures)
      ? profileProgressLectures
      : [];
    if (!lectures.length) return;
    const draft = {};
    lectures.forEach((lecture) => {
      draft[lecture.lectureId] = Boolean(lecture.hasVideoAccess);
    });
    setProfileAccessDraft(draft);
  }, [profileProgressQuery.data?.courseId, profileProgressLectures]);

  useEffect(() => {
    if (!quickProfileQuery.data) {
      setQuickAccessCourseId("");
      setQuickAccessDraft({});
      return;
    }
    const courses = Array.isArray(quickProfileQuery.data.enrolledCourses)
      ? quickProfileQuery.data.enrolledCourses
      : [];
    if (!quickAccessCourseId && courses.length > 0) {
      setQuickAccessCourseId(courses[0].courseId);
    }
  }, [quickProfileQuery.data, quickAccessCourseId]);

  useEffect(() => {
    const lectures = Array.isArray(quickProgressLectures)
      ? quickProgressLectures
      : [];
    if (!lectures.length) return;
    const draft = {};
    lectures.forEach((lecture) => {
      draft[lecture.lectureId] = Boolean(lecture.hasVideoAccess);
    });
    setQuickAccessDraft(draft);
  }, [quickProgressQuery.data?.courseId, quickProgressLectures]);

  const stats = useMemo(() => {
    const totalMyStudents = students.length;
    const activeThisWeek = students.filter((student) => {
      const date = asDate(student.lastLoginAt);
      if (!date) return false;
      return NOW_TS - date.getTime() <= 7 * 24 * 60 * 60 * 1000;
    }).length;
    const avgCompletionRate =
      students.length > 0
        ? Math.round(
            students.reduce((sum, student) => sum + clampPercent(student.avgProgress), 0) /
              students.length
          )
        : 0;
    const completedCourses = students.reduce(
      (sum, student) => sum + Number(student.completedCourses || 0),
      0
    );
    return { totalMyStudents, activeThisWeek, avgCompletionRate, completedCourses };
  }, [students]);

  const courseOptions = useMemo(() => {
    const map = new Map();
    students.forEach((student) => {
      (student.enrolledCourses || []).forEach((course) => {
        const courseId = String(course.courseId || "");
        if (!courseId) return;
        map.set(courseId, course.courseName || "Course");
      });
    });
    return [{ id: "all", name: "All Courses" }, ...Array.from(map.entries()).map(([id, name]) => ({ id, name }))];
  }, [students]);

  const filteredStudents = useMemo(() => {
    const rows = students.filter((student) => {
      const fullName = String(student.fullName || "").toLowerCase();
      const email = String(student.email || "").toLowerCase();
      const searchMatch = !debouncedSearch || fullName.includes(debouncedSearch) || email.includes(debouncedSearch);

      const courseMatch =
        courseFilter === "all" ||
        (Array.isArray(student.enrolledCourses)
          ? student.enrolledCourses.some((course) => String(course.courseId) === courseFilter)
          : false);

      const progress = clampPercent(student.avgProgress);
      const progressMatch =
        progressFilter === "all" ||
        (progressFilter === "not_started" && progress === 0) ||
        (progressFilter === "in_progress" && progress > 0 && progress < 100) ||
        (progressFilter === "completed" && progress === 100);

      return searchMatch && courseMatch && progressMatch;
    });

    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (sortBy === "name") return String(a.fullName || "").localeCompare(String(b.fullName || ""));
      if (sortBy === "most_progress") return clampPercent(b.avgProgress) - clampPercent(a.avgProgress);
      if (sortBy === "least_progress") return clampPercent(a.avgProgress) - clampPercent(b.avgProgress);
      if (sortBy === "recent_active") {
        const aDate = asDate(a.lastLoginAt);
        const bDate = asDate(b.lastLoginAt);
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return bDate.getTime() - aDate.getTime();
      }
      const aEnroll = getLatestEnrollmentDate(a);
      const bEnroll = getLatestEnrollmentDate(b);
      if (!aEnroll && !bEnroll) return 0;
      if (!aEnroll) return 1;
      if (!bEnroll) return -1;
      return bEnroll.getTime() - aEnroll.getTime();
    });

    return sorted;
  }, [students, debouncedSearch, courseFilter, progressFilter, sortBy]);

  const exportStudentsPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("SUM Academy - Teacher Students", 14, 16);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);

    let y = 32;
    doc.setFillColor(74, 99, 245);
    doc.rect(14, y, 268, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.text("Name", 16, y + 5.5);
    doc.text("Email", 80, y + 5.5);
    doc.text("Courses", 160, y + 5.5);
    doc.text("Avg Progress", 210, y + 5.5);
    doc.text("Status", 245, y + 5.5);

    doc.setTextColor(40, 40, 40);
    y += 12;

    filteredStudents.forEach((student, index) => {
      if (y > 190) {
        doc.addPage();
        y = 20;
      }
      const coursesCount = Array.isArray(student.enrolledCourses)
        ? student.enrolledCourses.length
        : 0;
      doc.text(String(student.fullName || "-").slice(0, 26), 16, y);
      doc.text(String(student.email || "-").slice(0, 34), 80, y);
      doc.text(String(coursesCount), 166, y);
      doc.text(`${clampPercent(student.avgProgress)}%`, 212, y);
      doc.text(student.isActive === false ? "Inactive" : "Active", 246, y);
      y += 7;

      if (index === 199) return;
    });

    doc.save(`sum-academy-students-${Date.now()}.pdf`);
    toast.success("Student list exported");
  };

  const profileData = profileQuery.data || null;
  const profileLectureMetaMap = useMemo(
    () => getLectureMetaMap(profileData),
    [profileData]
  );

  const progressGroupedBySubject = useMemo(() => {
    const lectures = Array.isArray(profileProgressQuery.data?.lectures)
      ? profileProgressQuery.data.lectures
      : [];
    const groups = {};
    lectures.forEach((lecture) => {
      const meta = profileLectureMetaMap[lecture.lectureId] || {};
      const subjectName = meta.subjectName || "Subject";
      if (!groups[subjectName]) groups[subjectName] = [];
      groups[subjectName].push({ ...lecture, meta });
    });
    return groups;
  }, [profileProgressQuery.data?.lectures, profileLectureMetaMap]);

  const saveProfileVideoAccess = async () => {
    if (!selectedStudentId || !profileProgressQuery.data?.lectures) return;
    const lectureAccess = profileProgressQuery.data.lectures.map((lecture) => ({
      lectureId: lecture.lectureId,
      hasAccess: Boolean(profileAccessDraft[lecture.lectureId]),
    }));
    try {
      await profileVideoAccessMutation.mutateAsync({ studentId: selectedStudentId, lectureAccess });
      toast.success(`Access updated for ${profileData?.fullName || "student"}`);
      profileProgressQuery.refetch();
      profileQuery.refetch();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update access");
    }
  };

  const quickProfileData = quickProfileQuery.data || null;
  const quickLectureMetaMap = useMemo(
    () => getLectureMetaMap(quickProfileData),
    [quickProfileData]
  );

  const quickGroupedBySubject = useMemo(() => {
    const lectures = Array.isArray(quickProgressQuery.data?.lectures)
      ? quickProgressQuery.data.lectures
      : [];
    const groups = {};
    lectures.forEach((lecture) => {
      const meta = quickLectureMetaMap[lecture.lectureId] || {};
      const subjectName = meta.subjectName || "Subject";
      if (!groups[subjectName]) groups[subjectName] = [];
      groups[subjectName].push({ ...lecture, meta });
    });
    return groups;
  }, [quickProgressQuery.data?.lectures, quickLectureMetaMap]);

  const saveQuickAccess = async () => {
    if (!quickAccessStudentId || !quickProgressQuery.data?.lectures) return;
    const lectureAccess = quickProgressQuery.data.lectures.map((lecture) => ({
      lectureId: lecture.lectureId,
      hasAccess: Boolean(quickAccessDraft[lecture.lectureId]),
    }));
    try {
      await quickVideoAccessMutation.mutateAsync({ studentId: quickAccessStudentId, lectureAccess });
      toast.success(`Access updated for ${quickProfileData?.fullName || "student"}`);
      setQuickAccessStudentId("");
      setQuickAccessCourseId("");
      setQuickAccessDraft({});
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update access");
    }
  };

  const attendanceCalendarDays = useMemo(() => {
    if (!attendanceQuery.data) return [];
    return buildCalendarGrid(attendanceMonth, attendanceQuery.data.sessions || []);
  }, [attendanceMonth, attendanceQuery.data]);

  return (
    <div className="space-y-6">
      <Toaster position="top-left" toastOptions={{ style: { borderRadius: "12px", fontFamily: "DM Sans, sans-serif" } }} />

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl text-slate-900">Students</h1>
          <p className="text-sm text-slate-500">Manage students enrolled in your assigned courses.</p>
        </div>
        <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={exportStudentsPdf} disabled={studentsQuery.isLoading}>
          Export Students PDF
        </button>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        You can only manage access for lectures in your assigned subjects.
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: "Total My Students", value: stats.totalMyStudents }, { label: "Active This Week", value: stats.activeThisWeek }, { label: "Avg Completion Rate", value: `${stats.avgCompletionRate}%` }, { label: "Completed Courses", value: stats.completedCourses }].map((card) => (
          <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{card.label}</p>
            {studentsQuery.isLoading ? <Skeleton className="mt-2 h-8 w-24" /> : <p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(card.value)}</p>}
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm" />
          <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm">{courseOptions.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select>
          <select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm">{PROGRESS_FILTER_OPTIONS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm">{SORT_OPTIONS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</select>
          <div className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-500">{formatNumber(filteredStudents.length)} students</div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Avatar + Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Enrolled Courses</th>
              <th className="px-4 py-3">Avg Progress</th>
              <th className="px-4 py-3">Last Active</th>
              <th className="px-4 py-3">Completed</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {studentsQuery.isLoading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <tr key={`skeleton-row-${index}`} className="border-t border-slate-100">
                    <td className="px-4 py-3" colSpan={8}><Skeleton className="h-10 w-full" /></td>
                  </tr>
                ))
              : filteredStudents.length === 0
                ? <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500"><UsersIcon /></div><p className="mt-2 text-base font-semibold text-slate-700">No students yet</p><p className="mt-1 text-sm">Students will appear here once they enroll in your courses</p></td></tr>
                : filteredStudents.map((student) => {
                    const courses = Array.isArray(student.enrolledCourses) ? student.enrolledCourses : [];
                    const progress = clampPercent(student.avgProgress);
                    const courseNames = courses.map((course) => course.courseName).filter(Boolean).join(", ");
                    return (
                      <tr key={student.uid} className="border-t border-slate-100">
                        <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">{getInitials(student.fullName)}</span><div><p className="font-semibold text-slate-900">{student.fullName || "Student"}</p></div></div></td>
                        <td className="px-4 py-3 text-slate-600">{student.email || "-"}</td>
                        <td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary" title={courseNames || "No courses"}>{formatNumber(courses.length)} Courses</span></td>
                        <td className="px-4 py-3"><div className="w-32"><div className="h-2 rounded-full bg-slate-200"><div className={`h-2 rounded-full ${getProgressTone(progress)}`} style={{ width: `${progress}%` }} /></div><p className={`mt-1 text-xs font-semibold ${getProgressTextTone(progress)}`}>{progress}%</p></div></td>
                        <td className="px-4 py-3 text-slate-500">{formatRelativeTime(student.lastLoginAt)}</td>
                        <td className="px-4 py-3">{Number(student.completedCourses || 0) > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"><CheckIcon /> {formatNumber(student.completedCourses)}</span> : <span className="text-slate-400">-</span>}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(student.isActive !== false)}`}>{student.isActive === false ? "Inactive" : "Active"}</span></td>
                        <td className="px-4 py-3"><div className="flex items-center gap-1"><button className="rounded-full border border-slate-200 p-2 text-slate-600 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { setSelectedStudentId(student.uid); setActiveProfileTab("overview"); }} disabled={studentsQuery.isFetching} title="View Profile"><EyeIcon /></button><button className="rounded-full border border-slate-200 p-2 text-slate-600 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setQuickAccessStudentId(student.uid)} disabled={studentsQuery.isFetching} title="Quick Video Access"><LockIcon /></button><button className="rounded-full border border-slate-200 p-2 text-slate-300" disabled title="Coming soon"><MessageIcon /></button></div></td>
                      </tr>
                    );
                  })}
          </tbody>
        </table>
      </section>

      <AnimatePresence>
        {selectedStudentId ? (
          <div className="fixed inset-0 z-[80]">
            <Motion.button className="absolute inset-0 bg-slate-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStudentId("")} disabled={profileVideoAccessMutation.isPending} />
            <Motion.aside className="absolute right-0 top-0 h-full w-full max-w-[480px] overflow-y-auto bg-white p-5 shadow-2xl" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}>
              {profileQuery.isLoading || !profileData ? (
                <div className="space-y-4"><Skeleton className="h-20 w-20 rounded-full" /><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /><Skeleton className="h-28 w-full" /></div>
              ) : (
                <div className="space-y-5">
                  <div className="flex justify-end"><button className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-600" onClick={() => setSelectedStudentId("")} disabled={profileVideoAccessMutation.isPending}>Close</button></div>
                  <div className="text-center"><span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">{getInitials(profileData.fullName)}</span><h2 className="mt-3 font-heading text-3xl text-slate-900">{profileData.fullName}</h2><p className="text-sm text-slate-500">{profileData.email || "-"}</p><p className="text-sm text-slate-500">{profileData.phoneNumber || "-"}</p><div className="mt-2 flex justify-center gap-2"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Student</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(profileData.isActive !== false)}`}>{profileData.isActive === false ? "Inactive" : "Active"}</span></div><p className="mt-1 text-xs text-slate-400">Joined {formatReadableDate(profileData.joinedAt)}</p></div>
                  <div className="grid grid-cols-4 gap-2">{PROFILE_TABS.map((tab) => <button key={tab.id} className={`rounded-xl px-2 py-2 text-xs font-semibold ${activeProfileTab === tab.id ? "bg-primary text-white" : "border border-slate-200 text-slate-600"}`} onClick={() => setActiveProfileTab(tab.id)} disabled={false}>{tab.label}</button>)}</div>

                  {activeProfileTab === "overview" ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-2xl border border-slate-200 p-3"><p className="text-slate-500">Courses Enrolled</p><p className="text-lg font-bold">{formatNumber(profileData.enrolledCourses?.length || 0)}</p></div><div className="rounded-2xl border border-slate-200 p-3"><p className="text-slate-500">Avg Progress</p><p className="text-lg font-bold">{clampPercent(profileData.avgProgress)}%</p></div><div className="rounded-2xl border border-slate-200 p-3"><p className="text-slate-500">Completed</p><p className="text-lg font-bold">{formatNumber(profileData.completedCourses)}</p></div><div className="rounded-2xl border border-slate-200 p-3"><p className="text-slate-500">Certificates</p><p className="text-lg font-bold">{formatNumber(profileData.studentProfile?.certificatesEarned || 0)}</p></div></div>
                      <div className="space-y-2">{(profileData.enrolledCourses || []).map((course) => { const progress = clampPercent(course.progress); return <div key={course.courseId} className="rounded-2xl border border-slate-200 p-3"><p className="font-semibold text-slate-800">{course.courseName}</p><div className="mt-2 h-2 rounded-full bg-slate-200"><div className={`h-2 rounded-full ${getProgressTone(progress)}`} style={{ width: `${progress}%` }} /></div><p className={`mt-1 text-xs font-semibold ${getProgressTextTone(progress)}`}>{progress}%</p><button className="mt-2 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600" onClick={() => { setSelectedProgressCourseId(course.courseId); setActiveProfileTab("progress"); }} disabled={false}>View Progress</button></div>; })}</div>
                      <div className="rounded-2xl border border-slate-200 p-3 text-sm"><p><span className="font-semibold">Last Login:</span> {formatRelativeTime(profileData.lastLoginAt)}</p><p><span className="font-semibold">Device:</span> {profileData.assignedWebDevice || "Unknown"}</p><p><span className="font-semibold">Member Since:</span> {formatReadableDate(profileData.joinedAt)}</p></div>
                    </div>
                  ) : null}

                  {activeProfileTab === "progress" ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">{(profileData.enrolledCourses || []).map((course) => <button key={course.courseId} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selectedProgressCourseId === course.courseId ? "bg-primary text-white" : "border border-slate-200 text-slate-600"}`} onClick={() => setSelectedProgressCourseId(course.courseId)} disabled={false}>{course.courseName}</button>)}</div>
                      {profileProgressQuery.isLoading ? <Skeleton className="h-40 w-full" /> : profileProgressQuery.data ? <div className="space-y-3"><div className="rounded-2xl border border-slate-200 p-4 text-center"><p className="text-xs uppercase tracking-wide text-slate-500">Overall Progress</p><p className="mt-1 text-4xl font-bold text-primary">{clampPercent(profileProgressQuery.data.progressPercent)}%</p><p className="mt-1 text-sm text-slate-500">{formatNumber(profileProgressQuery.data.completedLectures)} / {formatNumber(profileProgressQuery.data.totalLectures)} lectures completed</p></div>{Object.entries(progressGroupedBySubject).map(([subjectName, lectures]) => <div key={subjectName} className="rounded-2xl border border-slate-200 p-3"><p className="font-semibold text-slate-800">{subjectName}</p><div className="mt-2 space-y-2">{lectures.map((lecture) => <div key={lecture.lectureId} className="flex items-center justify-between rounded-xl border border-slate-200 p-2"><div><p className="text-sm font-semibold text-slate-800">{lecture.title}</p><p className="text-xs text-slate-500">{lecture.isCompleted ? `Completed ${formatReadableDate(lecture.completedAt)}` : "Not completed"}</p></div><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={Boolean(profileAccessDraft[lecture.lectureId])} onChange={(event) => setProfileAccessDraft((prev) => ({ ...prev, [lecture.lectureId]: event.target.checked }))} />{profileAccessDraft[lecture.lectureId] ? "Unlocked" : "Locked"}</label></div>)}</div></div>)}<button className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={saveProfileVideoAccess} disabled={profileVideoAccessMutation.isPending}>{profileVideoAccessMutation.isPending ? "Saving..." : `Save Video Access`}</button></div> : <p className="text-sm text-slate-500">No progress data available.</p>}
                    </div>
                  ) : null}

                  {activeProfileTab === "quiz" ? (
                    <div className="space-y-4">{(profileData.quizResults || []).length === 0 ? <p className="text-sm text-slate-500">No quizzes taken yet</p> : <><div className="grid grid-cols-2 gap-2"><div className="rounded-2xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Average Score</p><p className="text-2xl font-bold text-primary">{Math.round((profileData.quizResults || []).reduce((sum, row) => sum + Number(row.score || row.scorePercent || 0), 0) / (profileData.quizResults.length || 1))}%</p></div><div className="rounded-2xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Pass Rate</p><p className="text-2xl font-bold text-emerald-600">{Math.round(((profileData.quizResults || []).filter((row) => Number(row.score || row.scorePercent || 0) >= 40).length / (profileData.quizResults.length || 1)) * 100)}%</p></div></div><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Quiz</th><th className="px-3 py-2">Course</th><th className="px-3 py-2">Score</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">Submitted</th></tr></thead><tbody>{profileData.quizResults.map((quiz) => { const score = Number(quiz.score || quiz.scorePercent || 0); return <tr key={quiz.id} className="border-t border-slate-100"><td className="px-3 py-2">{quiz.quizName || quiz.title || "Quiz"}</td><td className="px-3 py-2">{quiz.courseName || "Course"}</td><td className={`px-3 py-2 font-semibold ${score >= 70 ? "text-emerald-600" : score >= 40 ? "text-amber-600" : "text-rose-600"}`}>{score}%</td><td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${score >= 40 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{score >= 40 ? "Pass" : "Fail"}</span></td><td className="px-3 py-2 text-slate-500">{formatReadableDate(quiz.submittedAt || quiz.createdAt)}</td></tr>; })}</tbody></table></div></>}
                    </div>
                  ) : null}

                  {activeProfileTab === "attendance" ? (
                    <div className="space-y-4">
                      <select
                        value={selectedAttendanceClassId}
                        onChange={(event) => setSelectedAttendanceClassId(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                      >
                        {(profileData.availableClasses || []).length === 0 ? (
                          <option value="">No class available</option>
                        ) : (
                          (profileData.availableClasses || []).map((row) => (
                            <option key={row.classId} value={row.classId}>
                              {row.className}
                            </option>
                          ))
                        )}
                      </select>

                      {(profileData.availableClasses || []).length === 0 ? (
                        <p className="text-sm text-slate-500">Student is not in any of your classes</p>
                      ) : attendanceQuery.isLoading ? (
                        <Skeleton className="h-48 w-full" />
                      ) : attendanceQuery.data ? (
                        <>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-2xl border border-slate-200 p-3">
                              <p className="text-slate-500">Total Sessions</p>
                              <p className="text-xl font-bold">{formatNumber(attendanceQuery.data.totalSessions)}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 p-3">
                              <p className="text-slate-500">Present</p>
                              <p className="text-xl font-bold text-emerald-600">{formatNumber(attendanceQuery.data.presentCount)}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 p-3">
                              <p className="text-slate-500">Absent</p>
                              <p className="text-xl font-bold text-rose-600">{formatNumber(attendanceQuery.data.absentCount)}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 p-3">
                              <p className="text-slate-500">Late</p>
                              <p className="text-xl font-bold text-amber-600">{formatNumber(attendanceQuery.data.lateCount)}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                              <p className="text-blue-700">Current Streak</p>
                              <p className="text-xl font-bold text-blue-900">{formatNumber(attendanceQuery.data.currentStreak)} days</p>
                            </div>
                            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
                              <p className="text-indigo-700">Longest Streak</p>
                              <p className="text-xl font-bold text-indigo-900">{formatNumber(attendanceQuery.data.longestStreak)} days</p>
                            </div>
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                              <p className="text-emerald-700">Learning Days</p>
                              <p className="text-lg font-bold text-emerald-900">
                                {Number(attendanceQuery.data.courseDurationDays || 0) > 0
                                  ? `${formatNumber(attendanceQuery.data.learningDaysElapsed)}/${formatNumber(attendanceQuery.data.courseDurationDays)}`
                                  : formatNumber(attendanceQuery.data.learningDaysElapsed)}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 p-3">
                              <p className="text-slate-500">Course Window</p>
                              <p className="text-xs font-semibold text-slate-700">
                                {formatReadableDate(attendanceQuery.data.courseWindowStart)} - {formatReadableDate(attendanceQuery.data.courseWindowEnd)}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 p-3">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-slate-800">Attendance %</p>
                              <p className={`text-lg font-bold ${attendanceQuery.data.attendancePercent < 75 ? "text-amber-600" : "text-emerald-600"}`}>
                                {attendanceQuery.data.attendancePercent}%
                              </p>
                            </div>
                            {attendanceQuery.data.attendancePercent < 75 ? (
                              <p className="mt-1 text-xs text-amber-700">Student attendance is below 75%</p>
                            ) : null}
                          </div>

                          <div className="rounded-2xl border border-slate-200 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <button
                                className="rounded-full border border-slate-300 px-3 py-1 text-xs"
                                onClick={() => {
                                  const next = new Date(attendanceMonth);
                                  next.setMonth(next.getMonth() - 1);
                                  setAttendanceMonth(next);
                                }}
                                disabled={false}
                              >
                                Prev
                              </button>
                              <p className="text-sm font-semibold text-slate-700">
                                {attendanceMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                              </p>
                              <button
                                className="rounded-full border border-slate-300 px-3 py-1 text-xs"
                                onClick={() => {
                                  const next = new Date(attendanceMonth);
                                  next.setMonth(next.getMonth() + 1);
                                  setAttendanceMonth(next);
                                }}
                                disabled={false}
                              >
                                Next
                              </button>
                            </div>
                            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500">
                              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                                <span key={day}>{day}</span>
                              ))}
                            </div>
                            <div className="mt-2 grid grid-cols-7 gap-1">
                              {attendanceCalendarDays.map((day) => (
                                <div
                                  key={day.key}
                                  className={`flex h-8 items-center justify-center rounded-md text-xs ${day.inMonth ? "text-slate-700" : "text-slate-300"}`}
                                >
                                  <span
                                    className={`flex h-6 w-6 items-center justify-center rounded-full ${statusColorByAttendance[day.status] || statusColorByAttendance.none} ${day.status === "none" ? "text-slate-500" : "text-white"}`}
                                  >
                                    {day.day}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            {(attendanceQuery.data.sessions || []).map((session) => (
                              <div key={session.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
                                <div className="flex items-center justify-between">
                                  <p className="font-semibold text-slate-800">{formatReadableDate(session.date)}</p>
                                  <span
                                    className={`rounded-full px-2 py-1 text-xs font-semibold ${session.status === "present" ? "bg-emerald-50 text-emerald-700" : session.status === "late" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}
                                  >
                                    {session.status || "absent"}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500">{session.topic || "No topic"}</p>
                                <p className="text-xs text-slate-400">{session.remarks || "No remarks"}</p>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </Motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {quickAccessStudentId ? (
          <div className="fixed inset-0 z-[82] flex items-center justify-center px-4">
            <Motion.button className="absolute inset-0 bg-slate-900/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQuickAccessStudentId("")} disabled={quickVideoAccessMutation.isPending} />
            <Motion.div className="relative z-[1] w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
              <h3 className="font-heading text-2xl text-slate-900">Video Access - {quickProfileData?.fullName || "Student"}</h3>
              {quickProfileQuery.isLoading ? <Skeleton className="mt-4 h-32 w-full" /> : <><select value={quickAccessCourseId} onChange={(event) => setQuickAccessCourseId(event.target.value)} className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm">{(quickProfileData?.enrolledCourses || []).map((course) => <option key={course.courseId} value={course.courseId}>{course.courseName}</option>)}</select><p className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">These are lectures from your assigned subjects. Locked videos are for students who completed the course.</p>{quickProgressQuery.isLoading ? <Skeleton className="mt-4 h-36 w-full" /> : <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">{Object.entries(quickGroupedBySubject).map(([subjectName, lectures]) => <div key={subjectName} className="rounded-2xl border border-slate-200 p-3"><p className="font-semibold text-slate-800">{subjectName}</p><div className="mt-2 space-y-2">{lectures.map((lecture) => <div key={lecture.lectureId} className="flex items-center justify-between rounded-xl border border-slate-200 p-2"><div><p className="text-sm font-semibold text-slate-800">{lecture.title}</p><p className="text-xs text-slate-500">{quickAccessDraft[lecture.lectureId] ? "Access granted" : "Locked after completion"}</p></div><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={Boolean(quickAccessDraft[lecture.lectureId])} onChange={(event) => setQuickAccessDraft((prev) => ({ ...prev, [lecture.lectureId]: event.target.checked }))} />{quickAccessDraft[lecture.lectureId] ? "Unlock" : "Lock"}</label></div>)}</div></div>)}</div>}<div className="mt-6 flex justify-end gap-2"><button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600" onClick={() => setQuickAccessStudentId("")} disabled={quickVideoAccessMutation.isPending}>Cancel</button><button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={saveQuickAccess} disabled={quickVideoAccessMutation.isPending}>{quickVideoAccessMutation.isPending ? "Saving..." : "Save Access"}</button></div></>}
            </Motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default Students;

