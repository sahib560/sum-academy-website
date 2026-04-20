
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "react-hot-toast";
import { FiCalendar } from "react-icons/fi";
import { Skeleton } from "../../components/Skeleton.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import {
  getTeacherSessions as getTeacherSessionsApi,
  getSessionById as getSessionByIdApi,
  createSession as createSessionApi,
  updateSession as updateSessionApi,
  cancelSession as cancelSessionApi,
  markSessionComplete as markSessionCompleteApi,
  getSessionAttendance as getSessionAttendanceApi,
  saveSessionAttendance as saveSessionAttendanceApi,
  getTeacherClasses as getTeacherClassesApi,
  getTeacherCourses,
} from "../../services/teacher.service.js";

const FILTER_TABS = ["all", "upcoming", "today", "completed", "cancelled"];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PLATFORM_OPTIONS = [
  { key: "zoom", label: "Zoom", placeholder: "https://zoom.us/j/..." },
  {
    key: "google_meet",
    label: "Google Meet",
    placeholder: "https://meet.google.com/...",
  },
  {
    key: "microsoft_teams",
    label: "Microsoft Teams",
    placeholder: "https://teams.microsoft.com/...",
  },
  { key: "other", label: "Other", placeholder: "https://..." },
];

const modalMotion = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 14, scale: 0.98 },
  transition: { duration: 0.2 },
};
const MotionDiv = motion.div;
const MotionButton = motion.button;

const emptyScheduleForm = {
  classId: "",
  courseId: "",
  topic: "",
  description: "",
  date: "",
  startTime: "",
  endTime: "",
  platform: "Zoom",
  meetingLink: "",
  notifyStudents: true,
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.response?.data?.error || fallback;

const todayDateString = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseDateOnly = (value) => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const parseSessionDateTime = (date, time) => {
  const day = parseDateOnly(date);
  const safeTime = String(time || "").trim();
  if (!day || !safeTime) return null;
  const [h, m] = safeTime.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const parsed = new Date(day);
  parsed.setHours(h, m, 0, 0);
  return parsed;
};

const isValidUrl = (value) => {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const durationMinutes = (startTime, endTime) => {
  const [sh, sm] = String(startTime || "").split(":").map(Number);
  const [eh, em] = String(endTime || "").split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return end > start ? end - start : 0;
};

const formatDuration = (minutes) => {
  const safe = Number(minutes || 0);
  if (!safe) return "0 minutes";
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (!hours) return `${mins} minute${mins === 1 ? "" : "s"}`;
  if (!mins) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"} ${mins} minute${mins === 1 ? "" : "s"}`;
};

const formatLongDate = (date) => {
  const parsed = parseDateOnly(date);
  if (!parsed) return "-";
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatTimeLabel = (time) => {
  const safeTime = String(time || "").trim();
  if (!safeTime) return "-";
  const [h, m] = safeTime.split(":").map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatMonthLabel = (date) =>
  date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

const resolveStatus = (session) => {
  const explicit = String(session?.status || "").toLowerCase();
  if (explicit === "cancelled") return "cancelled";
  if (explicit === "completed") return "completed";

  const start = parseSessionDateTime(session?.date, session?.startTime);
  if (!start) return "upcoming";

  const now = new Date();
  if (start > now) return "upcoming";
  const liveEnd = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  if (now <= liveEnd) return "live";
  return "completed";
};

const statusMeta = (status) => {
  if (status === "live") {
    return {
      border: "border-emerald-500",
      badge: "bg-emerald-50 text-emerald-700",
      text: "Live Now",
    };
  }
  if (status === "completed") {
    return {
      border: "border-slate-300",
      badge: "bg-slate-100 text-slate-600",
      text: "Completed",
    };
  }
  if (status === "cancelled") {
    return {
      border: "border-rose-500",
      badge: "bg-rose-50 text-rose-700",
      text: "Cancelled",
    };
  }
  return {
    border: "border-blue-500",
    badge: "bg-blue-50 text-blue-700",
    text: "Upcoming",
  };
};

const platformMeta = (platform) => {
  const value = String(platform || "").toLowerCase();
  if (value.includes("zoom")) return { label: "Zoom", icon: "Z" };
  if (value.includes("meet")) return { label: "Google Meet", icon: "M" };
  if (value.includes("team")) return { label: "Microsoft Teams", icon: "T" };
  return { label: platform || "Other", icon: "O" };
};

const startOfMonth = (value = new Date()) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const buildCalendarDays = (monthDate) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const days = [];

  for (let i = 0; i < startOffset; i += 1) days.push(null);
  for (let day = 1; day <= totalDays; day += 1) {
    days.push(new Date(year, month, day));
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
};

const createScheduleFormFromSession = (session, classes = []) => ({
  classId: session?.classId || classes[0]?.id || "",
  courseId: session?.courseId || "",
  topic: session?.topic || "",
  description: session?.description || "",
  date: session?.date || "",
  startTime: session?.startTime || "",
  endTime: session?.endTime || "",
  platform: session?.platform || "Zoom",
  meetingLink: session?.meetingLink || "",
  notifyStudents: session?.notifyStudents !== false,
});

const validateSchedule = (form, classes) => {
  const errors = {};
  if (!classes.length) {
    errors.classId =
      "You have no assigned classes. Contact admin to be assigned to a class.";
  }
  if (!String(form.classId || "").trim()) errors.classId = "Class is required";
  const topic = String(form.topic || "").trim();
  if (!topic) errors.topic = "Topic is required";
  if (topic && topic.length < 5) errors.topic = "Topic must be at least 5 characters";
  if (topic.length > 150) errors.topic = "Topic cannot exceed 150 characters";
  if (String(form.description || "").length > 500) {
    errors.description = "Description cannot exceed 500 characters";
  }
  if (!form.date) {
    errors.date = "Date is required";
  } else {
    const date = parseDateOnly(form.date);
    const today = parseDateOnly(todayDateString());
    if (!date || date < today) errors.date = "Date must be today or future";
  }
  if (!form.startTime) errors.startTime = "Start time is required";
  if (!form.endTime) errors.endTime = "End time is required";
  if (form.startTime && form.endTime && !durationMinutes(form.startTime, form.endTime)) {
    errors.endTime = "End time must be after start time";
  }
  if (!String(form.platform || "").trim()) errors.platform = "Platform is required";
  if (!String(form.meetingLink || "").trim()) {
    errors.meetingLink = "Meeting link is required";
  } else if (!isValidUrl(form.meetingLink)) {
    errors.meetingLink = "Enter a valid URL";
  }
  return errors;
};

const attendancePillClass = (status, active) => {
  if (!active) return "border-slate-300 text-slate-500";
  if (status === "present") return "border-emerald-500 bg-emerald-500 text-white";
  if (status === "late") return "border-amber-500 bg-amber-500 text-white";
  return "border-rose-500 bg-rose-500 text-white";
};

function ModalShell({ open, onClose, title, children, width = "max-w-3xl" }) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
          <MotionButton
            type="button"
            className="absolute inset-0 bg-slate-900/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <MotionDiv
            {...modalMotion}
            className={`relative z-[1] w-full ${width} max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-2xl text-slate-900">{title}</h3>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                onClick={onClose}
              >
                Close
              </button>
            </div>
            {children}
          </MotionDiv>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
function TeacherSessions() {
  const queryClient = useQueryClient();
  const { userProfile } = useAuth();

  const [view, setView] = useState("list");
  const [tab, setTab] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));

  const [scheduleModal, setScheduleModal] = useState({
    open: false,
    mode: "create",
    session: null,
  });
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);
  const [cancelModalSession, setCancelModalSession] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNotify, setCancelNotify] = useState(true);
  const [completeModalSession, setCompleteModalSession] = useState(null);
  const [completeNotes, setCompleteNotes] = useState("");
  const [attendanceModalSession, setAttendanceModalSession] = useState(null);
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [attendanceDraft, setAttendanceDraft] = useState({});
  const [calendarDetailSession, setCalendarDetailSession] = useState(null);

  const sessionsQuery = useQuery({
    queryKey: ["teacher-sessions"],
    queryFn: getTeacherSessionsApi,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const classesQuery = useQuery({
    queryKey: ["teacher-classes"],
    queryFn: getTeacherClassesApi,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const coursesQuery = useQuery({
    queryKey: ["teacher-courses", "for-session-form"],
    queryFn: getTeacherCourses,
    staleTime: 5 * 60 * 1000,
  });

  const detailQuery = useQuery({
    queryKey: ["teacher-session-detail", calendarDetailSession?.id],
    queryFn: () => getSessionByIdApi(calendarDetailSession.id),
    enabled: Boolean(calendarDetailSession?.id),
    retry: false,
    staleTime: 15000,
  });

  const attendanceQuery = useQuery({
    queryKey: ["teacher-session-attendance", attendanceModalSession?.id],
    queryFn: () => getSessionAttendanceApi(attendanceModalSession.id),
    enabled: Boolean(attendanceModalSession?.id),
    staleTime: 10000,
  });

  const sessions = useMemo(() => {
    const rows = Array.isArray(sessionsQuery.data) ? sessionsQuery.data : [];
    return rows
      .map((row) => {
        const status = resolveStatus(row);
        const startAt = parseSessionDateTime(row.date, row.startTime);
        return { ...row, status, startAt };
      })
      .sort((a, b) => {
        const aTime = a.startAt ? a.startAt.getTime() : 0;
        const bTime = b.startAt ? b.startAt.getTime() : 0;
        return bTime - aTime;
      });
  }, [sessionsQuery.data]);

  const classes = useMemo(
    () => (Array.isArray(classesQuery.data) ? classesQuery.data : []),
    [classesQuery.data]
  );

  const courses = useMemo(
    () => (Array.isArray(coursesQuery.data) ? coursesQuery.data : []),
    [coursesQuery.data]
  );

  const scheduleErrors = useMemo(
    () => validateSchedule(scheduleForm, classes),
    [scheduleForm, classes]
  );

  const selectedClassMeta = useMemo(
    () => classes.find((row) => row.id === scheduleForm.classId),
    [classes, scheduleForm.classId]
  );

  const invalidateSessions = () => {
    queryClient.invalidateQueries({ queryKey: ["teacher-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["teacher-session-detail"] });
    queryClient.invalidateQueries({ queryKey: ["teacher-session-attendance"] });
  };

  const createMutation = useMutation({
    mutationFn: createSessionApi,
    onSuccess: (result) => {
      const notified = Number(result?.data?.studentsNotified || 0);
      toast.success("Session scheduled successfully!");
      if (notified > 0) toast.success(`${notified} students notified via email`);
      setScheduleModal({ open: false, mode: "create", session: null });
      setScheduleForm(emptyScheduleForm);
      invalidateSessions();
    },
    onError: (error) => {
      const code =
        error?.response?.data?.errors?.code || error?.response?.data?.code;
      if (code === "SESSION_CONFLICT") {
        const conflict = error?.response?.data?.errors?.conflictingSession || {};
        toast.error(
          `Time conflict with "${conflict.topic || "session"}" (${conflict.startTime || "-"} - ${conflict.endTime || "-"})`,
          { duration: 6000 }
        );
        return;
      }
      if (code === "TEACHER_CONFLICT") {
        toast.error("You have another session scheduled at this time", {
          duration: 6000,
        });
        return;
      }
      toast.error(getErrorMessage(error, "Failed to schedule session"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ sessionId, data }) => updateSessionApi(sessionId, data),
    onSuccess: () => {
      toast.success("Session updated");
      setScheduleModal({ open: false, mode: "create", session: null });
      invalidateSessions();
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Failed to update session")),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ sessionId, data }) => cancelSessionApi(sessionId, data),
    onSuccess: () => {
      toast.success("Session cancelled");
      setCancelModalSession(null);
      setCancelReason("");
      setCancelNotify(true);
      invalidateSessions();
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Failed to cancel session")),
  });

  const completeMutation = useMutation({
    mutationFn: ({ sessionId, data }) => markSessionCompleteApi(sessionId, data),
    onSuccess: () => {
      toast.success("Session marked as complete");
      setCompleteModalSession(null);
      setCompleteNotes("");
      invalidateSessions();
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Failed to mark complete")),
  });

  const saveAttendanceMutation = useMutation({
    mutationFn: ({ sessionId, data }) => saveSessionAttendanceApi(sessionId, data),
    onSuccess: (_result, vars) => {
      const count = Array.isArray(vars?.data?.attendance)
        ? vars.data.attendance.length
        : 0;
      toast.success(`Attendance saved for ${count} students`);
      setAttendanceModalSession(null);
      setAttendanceSearch("");
      setAttendanceDraft({});
      invalidateSessions();
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Failed to save attendance")),
  });

  const openScheduleModal = (mode = "create", session = null) => {
    const nextForm =
      mode === "create"
        ? {
            ...emptyScheduleForm,
            classId: classes[0]?.id || "",
            notifyStudents: true,
          }
        : createScheduleFormFromSession(session, classes);
    setScheduleForm(nextForm);
    setScheduleModal({ open: true, mode, session });
  };

  const submitSchedule = () => {
    const errors = validateSchedule(scheduleForm, classes);
    if (Object.keys(errors).length) {
      toast.error(Object.values(errors)[0]);
      return;
    }

    const payload = {
      classId: scheduleForm.classId,
      courseId: scheduleForm.courseId || "",
      topic: scheduleForm.topic.trim(),
      description: scheduleForm.description.trim(),
      date: scheduleForm.date,
      startTime: scheduleForm.startTime,
      endTime: scheduleForm.endTime,
      platform: scheduleForm.platform,
      meetingLink: scheduleForm.meetingLink.trim(),
      notifyStudents: Boolean(scheduleForm.notifyStudents),
    };

    if (scheduleModal.mode === "edit" && scheduleModal.session?.id) {
      updateMutation.mutate({ sessionId: scheduleModal.session.id, data: payload });
      return;
    }
    createMutation.mutate(payload);
  };

  const filteredSessions = useMemo(() => {
    const today = parseDateOnly(todayDateString());
    const rows = sessions.filter((session) => {
      if (classFilter !== "all" && session.classId !== classFilter) return false;
      if (
        platformFilter !== "all" &&
        !String(session.platform || "").toLowerCase().includes(platformFilter)
      ) {
        return false;
      }

      if (tab === "upcoming") return session.status === "upcoming";
      if (tab === "today") {
        const date = parseDateOnly(session.date);
        return Boolean(date && today && date.getTime() === today.getTime());
      }
      if (tab === "completed") return session.status === "completed";
      if (tab === "cancelled") return session.status === "cancelled";
      return true;
    });

    const live = rows.filter((row) => row.status === "live");
    const rest = rows.filter((row) => row.status !== "live");
    return [...live, ...rest];
  }, [sessions, tab, classFilter, platformFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      upcoming: sessions.filter((s) => s.status === "upcoming").length,
      completedThisMonth: sessions.filter((s) => {
        if (s.status !== "completed" || !s.startAt) return false;
        return (
          s.startAt.getMonth() === now.getMonth() &&
          s.startAt.getFullYear() === now.getFullYear()
        );
      }).length,
      total: sessions.length,
    };
  }, [sessions]);

  const tabCounts = useMemo(() => {
    const today = parseDateOnly(todayDateString());
    return {
      all: sessions.length,
      upcoming: sessions.filter((s) => s.status === "upcoming").length,
      today: sessions.filter((s) => {
        const date = parseDateOnly(s.date);
        return Boolean(date && today && date.getTime() === today.getTime());
      }).length,
      completed: sessions.filter((s) => s.status === "completed").length,
      cancelled: sessions.filter((s) => s.status === "cancelled").length,
    };
  }, [sessions]);

  const sessionsByDate = useMemo(() => {
    const map = new Map();
    sessions.forEach((session) => {
      const key = session.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(session);
    });
    return map;
  }, [sessions]);

  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const detailSession = detailQuery.data || calendarDetailSession;

  const attendanceStudents = useMemo(
    () => attendanceQuery.data?.students || [],
    [attendanceQuery.data?.students]
  );
  const attendanceCounts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let notMarked = 0;

    attendanceStudents.forEach((student) => {
      const status = attendanceDraft[student.studentId] || student.status || "not_marked";
      if (status === "present") present += 1;
      else if (status === "absent") absent += 1;
      else if (status === "late") late += 1;
      else notMarked += 1;
    });

    return {
      total: attendanceStudents.length,
      present,
      absent,
      late,
      notMarked,
    };
  }, [attendanceStudents, attendanceDraft]);

  const searchedAttendanceStudents = useMemo(() => {
    const q = attendanceSearch.trim().toLowerCase();
    if (!q) return attendanceStudents;
    return attendanceStudents.filter(
      (row) =>
        String(row.fullName || "").toLowerCase().includes(q) ||
        String(row.email || "").toLowerCase().includes(q)
    );
  }, [attendanceStudents, attendanceSearch]);

  const scheduleBusy = createMutation.isPending || updateMutation.isPending;
  const scheduleLocked =
    scheduleModal.mode === "edit" &&
    ["completed", "cancelled"].includes(resolveStatus(scheduleModal.session || {}));
  return (
    <div className="space-y-6">
      <Toaster
        position="top-left"
        toastOptions={{
          style: { borderRadius: "12px", fontFamily: "DM Sans, sans-serif" },
        }}
      />

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl text-slate-900">Sessions</h1>
          <p className="text-sm text-slate-500">
            Dynamic live sessions synced with backend
          </p>
        </div>
        <button className="btn-primary" onClick={() => openScheduleModal("create")}>Schedule Session</button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {(sessionsQuery.isLoading ? Array.from({ length: 3 }) : [1, 2, 3]).map((item, idx) => (
          <div key={`${item}-${idx}`} className="glass-card border border-slate-200">
            {sessionsQuery.isLoading ? (
              <>
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-3 h-8 w-1/2" />
              </>
            ) : (
              <>
                <p className="text-sm text-slate-500">
                  {idx === 0
                    ? "Upcoming Sessions"
                    : idx === 1
                      ? "Completed This Month"
                      : "Total Sessions"}
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {idx === 0 ? stats.upcoming : idx === 1 ? stats.completedThisMonth : stats.total}
                </p>
              </>
            )}
          </div>
        ))}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              view === "list"
                ? "bg-primary text-white"
                : "border border-slate-200 text-slate-600"
            }`}
            onClick={() => setView("list")}
          >
            List View
          </button>
          <button
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              view === "calendar"
                ? "bg-primary text-white"
                : "border border-slate-200 text-slate-600"
            }`}
            onClick={() => setView("calendar")}
          >
            Calendar View
          </button>
        </div>
      </section>

      {sessionsQuery.isLoading ? (
        view === "list" ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-slate-200 bg-white p-5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-3 h-6 w-2/3" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-5/6" />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <Skeleton className="h-8 w-48" />
            <div className="mt-4 grid grid-cols-7 gap-3">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </div>
        )
      ) : sessions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FiCalendar className="h-7 w-7" />
          </div>
          <h3 className="mt-4 font-heading text-2xl text-slate-900">No sessions yet</h3>
          <p className="mt-2 text-sm text-slate-500">Schedule your first session to get started.</p>
          <button className="btn-primary mt-5" onClick={() => openScheduleModal("create")}>Schedule your first session</button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {view === "list" ? (
            <MotionDiv
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {FILTER_TABS.map((item) => (
                    <button
                      key={item}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        tab === item
                          ? "bg-primary text-white"
                          : "border border-slate-200 text-slate-600"
                      }`}
                      onClick={() => setTab(item)}
                    >
                      {item.charAt(0).toUpperCase() + item.slice(1)} ({tabCounts[item] || 0})
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <select
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                  >
                    <option value="all">All Classes</option>
                    {classes.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name} {row.batchCode ? `(${row.batchCode})` : ""}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={platformFilter}
                    onChange={(e) => setPlatformFilter(e.target.value)}
                  >
                    <option value="all">All Platforms</option>
                    <option value="zoom">Zoom</option>
                    <option value="meet">Meet</option>
                    <option value="team">Teams</option>
                  </select>
                </div>
              </div>

              {filteredSessions.map((session) => {
                const meta = statusMeta(session.status);
                const platform = platformMeta(session.platform);
                const ownedByCurrentTeacher =
                  !session.teacherId || session.teacherId === userProfile?.uid;

                return (
                  <div
                    key={session.id}
                    className={`rounded-3xl border-l-4 ${meta.border} border-r border-t border-b border-slate-200 bg-white p-5`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          {session.className || "Class"}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold">
                            {platform.icon}
                          </span>
                          {platform.label}
                        </span>
                        {session.status === "live" ? (
                          <span className="animate-pulse rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            LIVE NOW
                          </span>
                        ) : null}
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.badge}`}>
                        {meta.text}
                      </span>
                    </div>

                    <h3 className="mt-3 text-xl font-bold text-slate-900">{session.topic || "Untitled Session"}</h3>

                    <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                      <p>Calendar: {formatLongDate(session.date)}</p>
                      <p>Clock: {formatTimeLabel(session.startTime)} - {formatTimeLabel(session.endTime)}</p>
                      <p>Timer: {formatDuration(session.duration || durationMinutes(session.startTime, session.endTime))}</p>
                    </div>

                    <p className="mt-2 text-sm text-slate-500">{session.courseName || "No related course"}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                      <span>Students: {session.studentsCount || 0}</span>
                      {session.status === "completed" ? <span>Attendance: {session.attendanceCount || 0}</span> : null}
                    </div>
                    {(session.status === "upcoming" || session.status === "live") && session.meetingLink ? (
                      <a
                        href={session.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/40 px-4 py-2 text-sm font-semibold text-primary"
                      >
                        {session.status === "live" ? "Join Session" : "Meeting Link"}
                      </a>
                    ) : null}

                    {session.status === "cancelled" ? (
                      <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        Cancelled - {session.cancelReason || "No reason provided"}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {session.status === "upcoming" && ownedByCurrentTeacher ? (
                        <>
                          <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold" onClick={() => openScheduleModal("edit", session)}>Edit</button>
                          <button className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600" onClick={() => { setCancelModalSession(session); setCancelReason(""); setCancelNotify(true); }}>Cancel</button>
                          <button className="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700" onClick={() => { setCompleteModalSession(session); setCompleteNotes(session.sessionNotes || ""); }}>Mark Complete</button>
                        </>
                      ) : null}

                      {session.status === "live" && ownedByCurrentTeacher ? (
                        <>
                          <a href={session.meetingLink} target="_blank" rel="noreferrer" className="animate-pulse rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white">Join Session</a>
                          <button className="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700" onClick={() => { setCompleteModalSession(session); setCompleteNotes(session.sessionNotes || ""); }}>Mark Complete</button>
                        </>
                      ) : null}

                      {session.status === "completed" && ownedByCurrentTeacher ? (
                        <>
                          <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold" onClick={() => { setAttendanceModalSession(session); setAttendanceSearch(""); }}>View Attendance</button>
                          <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500" title={session.sessionNotes || "No notes"}>Session Notes</button>
                        </>
                      ) : null}

                      {session.status === "cancelled" && ownedByCurrentTeacher ? (
                        <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold" onClick={() => openScheduleModal("reschedule", session)}>Reschedule</button>
                      ) : null}

                      {!ownedByCurrentTeacher ? (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">Owned by another teacher</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </MotionDiv>
          ) : (
            <MotionDiv
              key="calendar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-3xl border border-slate-200 bg-white p-4"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs" onClick={() => setCurrentMonth((prev) => startOfMonth(new Date(prev.getFullYear(), prev.getMonth() - 1, 1)))}>Prev</button>
                  <h3 className="font-heading text-2xl text-slate-900">{formatMonthLabel(currentMonth)}</h3>
                  <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs" onClick={() => setCurrentMonth((prev) => startOfMonth(new Date(prev.getFullYear(), prev.getMonth() + 1, 1)))}>Next</button>
                </div>
                <button className="rounded-full border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary" onClick={() => setCurrentMonth(startOfMonth(new Date()))}>Today</button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                {WEEKDAY_LABELS.map((label) => <div key={label}>{label}</div>)}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => {
                  const key = day ? `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}` : `empty-${index}`;
                  const y = day ? day.getFullYear() : 0;
                  const m = day ? String(day.getMonth() + 1).padStart(2, "0") : "00";
                  const d = day ? String(day.getDate()).padStart(2, "0") : "00";
                  const dateKey = `${y}-${m}-${d}`;
                  const daySessions = day ? sessionsByDate.get(dateKey) || [] : [];
                  const isToday = day ? dateKey === todayDateString() : false;

                  return (
                    <div key={key} className="min-h-[120px] rounded-xl border border-slate-200 p-2">
                      {day ? (
                        <>
                          <div className="mb-2 flex justify-end">
                            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-primary text-white" : "text-slate-600"}`}>{day.getDate()}</span>
                          </div>
                          <div className="space-y-1">
                            {daySessions.slice(0, 4).map((session) => {
                              const status = resolveStatus(session);
                              const tone = status === "cancelled" ? "bg-rose-100 text-rose-700" : status === "completed" ? "bg-slate-200 text-slate-700" : status === "live" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700";
                              return (
                                <button key={session.id} className={`w-full truncate rounded-md px-2 py-1 text-left text-[11px] font-semibold ${tone}`} onClick={() => setCalendarDetailSession(session)} title={session.topic}>{session.topic}</button>
                              );
                            })}
                          </div>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
      )}
      <ModalShell
        open={scheduleModal.open}
        onClose={() => !scheduleBusy && setScheduleModal({ open: false, mode: "create", session: null })}
        title={scheduleModal.mode === "edit" ? "Edit Session" : "Schedule Session"}
      >
        {scheduleLocked ? <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">This session cannot be edited</p> : null}
        {classes.length === 0 ? (
          <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">You have no assigned classes. Contact admin to be assigned to a class.</p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Class *</label>
            <select disabled={scheduleLocked} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={scheduleForm.classId} onChange={(e) => setScheduleForm((prev) => ({ ...prev, classId: e.target.value }))}>
              <option value="">Select class</option>
              {classes.map((row) => <option key={row.id} value={row.id}>{row.name} {row.batchCode ? `(${row.batchCode})` : ""}</option>)}
            </select>
            {scheduleErrors.classId ? <p className="mt-1 text-xs text-rose-600">{scheduleErrors.classId}</p> : null}
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Topic *</label>
            <input disabled={scheduleLocked} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={scheduleForm.topic} onChange={(e) => setScheduleForm((prev) => ({ ...prev, topic: e.target.value.slice(0, 150) }))} placeholder="Enter session topic" />
            <div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>{scheduleErrors.topic ? <span className="text-rose-600">{scheduleErrors.topic}</span> : ""}</span><span>{scheduleForm.topic.length}/150</span></div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Description (optional)</label>
            <textarea disabled={scheduleLocked} className="min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={scheduleForm.description} onChange={(e) => setScheduleForm((prev) => ({ ...prev, description: e.target.value.slice(0, 500) }))} />
            <div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>{scheduleErrors.description ? <span className="text-rose-600">{scheduleErrors.description}</span> : ""}</span><span>{scheduleForm.description.length}/500</span></div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Date *</label>
            <input disabled={scheduleLocked} type="date" min={todayDateString()} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={scheduleForm.date} onChange={(e) => setScheduleForm((prev) => ({ ...prev, date: e.target.value }))} />
            {scheduleErrors.date ? <p className="mt-1 text-xs text-rose-600">{scheduleErrors.date}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Course (optional)</label>
            <select disabled={scheduleLocked} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={scheduleForm.courseId} onChange={(e) => setScheduleForm((prev) => ({ ...prev, courseId: e.target.value }))}>
              <option value="">Select related course (optional)</option>
              {courses.map((row) => <option key={row.id} value={row.id}>{row.title || row.name || "Course"}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Start Time *</label>
            <input disabled={scheduleLocked} type="time" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={scheduleForm.startTime} onChange={(e) => setScheduleForm((prev) => ({ ...prev, startTime: e.target.value }))} />
            {scheduleErrors.startTime ? <p className="mt-1 text-xs text-rose-600">{scheduleErrors.startTime}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">End Time *</label>
            <input disabled={scheduleLocked} type="time" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={scheduleForm.endTime} onChange={(e) => setScheduleForm((prev) => ({ ...prev, endTime: e.target.value }))} />
            {scheduleErrors.endTime ? <p className="mt-1 text-xs text-rose-600">{scheduleErrors.endTime}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Platform *</label>
            <select disabled={scheduleLocked} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={scheduleForm.platform} onChange={(e) => setScheduleForm((prev) => ({ ...prev, platform: e.target.value }))}>
              {PLATFORM_OPTIONS.map((item) => <option key={item.key} value={item.label}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Meeting Link *</label>
            <input disabled={scheduleLocked} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={scheduleForm.meetingLink} placeholder={(PLATFORM_OPTIONS.find((p) => p.label === scheduleForm.platform) || PLATFORM_OPTIONS[3]).placeholder} onChange={(e) => setScheduleForm((prev) => ({ ...prev, meetingLink: e.target.value }))} />
            {scheduleErrors.meetingLink ? <p className="mt-1 text-xs text-rose-600">{scheduleErrors.meetingLink}</p> : null}
          </div>
          <div className="md:col-span-2">
            <p className="text-xs font-semibold text-slate-500">Duration: {formatDuration(durationMinutes(scheduleForm.startTime, scheduleForm.endTime))}</p>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-600"><input disabled={scheduleLocked} type="checkbox" checked={Boolean(scheduleForm.notifyStudents)} onChange={(e) => setScheduleForm((prev) => ({ ...prev, notifyStudents: e.target.checked }))} />Send email notification to all enrolled students</label>
            {scheduleForm.notifyStudents ? <p className="mt-1 text-xs text-slate-500">{selectedClassMeta?.enrolledCount || selectedClassMeta?.studentsCount || 0} students will be notified</p> : null}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600" disabled={scheduleBusy} onClick={() => setScheduleModal({ open: false, mode: "create", session: null })}>Cancel</button>
          <button className="btn-primary" disabled={scheduleBusy || scheduleLocked || classes.length === 0} onClick={submitSchedule}>{scheduleBusy ? "Saving..." : scheduleModal.mode === "edit" ? "Update Session" : "Schedule Session"}</button>
        </div>
      </ModalShell>

      <ModalShell open={Boolean(cancelModalSession)} onClose={() => !cancelMutation.isPending && setCancelModalSession(null)} title="Cancel this session?" width="max-w-xl">
        <p className="text-sm text-slate-600">{cancelModalSession?.topic} - {formatLongDate(cancelModalSession?.date)}</p>
        <textarea className="mt-4 min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Reason for cancellation" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        {cancelReason.trim().length > 0 && cancelReason.trim().length < 10 ? <p className="mt-1 text-xs text-rose-600">Cancel reason must be at least 10 characters</p> : null}
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={cancelNotify} onChange={(e) => setCancelNotify(e.target.checked)} />Send cancellation email to all students</label>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold" onClick={() => setCancelModalSession(null)} disabled={cancelMutation.isPending}>Go Back</button>
          <button className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white" disabled={cancelMutation.isPending || cancelReason.trim().length < 10} onClick={() => cancelMutation.mutate({ sessionId: cancelModalSession.id, data: { cancelReason: cancelReason.trim(), notifyStudents: cancelNotify } })}>{cancelMutation.isPending ? "Cancelling..." : "Confirm Cancel"}</button>
        </div>
      </ModalShell>

      <ModalShell open={Boolean(completeModalSession)} onClose={() => !completeMutation.isPending && setCompleteModalSession(null)} title="Mark Session as Complete" width="max-w-xl">
        <p className="text-sm text-slate-600">{completeModalSession?.topic}</p>
        <textarea className="mt-4 min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Add notes about this session" value={completeNotes} onChange={(e) => setCompleteNotes(e.target.value.slice(0, 1000))} />
        <p className="mt-1 text-[11px] text-slate-500">{completeNotes.length}/1000</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold" disabled={completeMutation.isPending} onClick={() => setCompleteModalSession(null)}>Cancel</button>
          <button className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" disabled={completeMutation.isPending} onClick={() => completeMutation.mutate({ sessionId: completeModalSession.id, data: { notes: completeNotes } })}>{completeMutation.isPending ? "Saving..." : "Confirm Complete"}</button>
        </div>
      </ModalShell>
      <ModalShell open={Boolean(attendanceModalSession)} onClose={() => !saveAttendanceMutation.isPending && setAttendanceModalSession(null)} title={`Attendance - ${attendanceModalSession?.topic || "Session"}`}>
        {attendanceQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500">{formatLongDate(attendanceModalSession?.date)} - {formatTimeLabel(attendanceModalSession?.startTime)} to {formatTimeLabel(attendanceModalSession?.endTime)}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs">Total: {attendanceCounts.total}</div>
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Present: {attendanceCounts.present}</div>
              <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">Absent: {attendanceCounts.absent}</div>
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">Late: {attendanceCounts.late}</div>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">Not Marked: {attendanceCounts.notMarked}</div>
            </div>

            {attendanceCounts.total > 0 && attendanceCounts.notMarked === attendanceCounts.total ? (
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">Attendance not recorded yet <button className="ml-2 rounded-full border border-amber-200 px-2 py-1 text-xs" onClick={() => setAttendanceDraft(Object.fromEntries(attendanceStudents.map((s) => [s.studentId, "present"])))}>Mark Attendance Now</button></div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <input className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Search students" value={attendanceSearch} onChange={(e) => setAttendanceSearch(e.target.value)} />
              <button className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold" onClick={() => setAttendanceDraft(Object.fromEntries(attendanceStudents.map((s) => [s.studentId, "present"])))}>Mark All Present</button>
            </div>

            <div className="mt-3 max-h-[380px] space-y-2 overflow-y-auto pr-1">
              {searchedAttendanceStudents.map((student) => {
                const status = attendanceDraft[student.studentId] || student.status || "not_marked";
                const initials = String(student.fullName || "S").split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <div key={student.studentId} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials || "S"}</span>
                    <div className="min-w-[140px] flex-1">
                      <p className="text-sm font-semibold text-slate-800">{student.fullName}</p>
                      <p className="text-xs text-slate-500">{student.email}</p>
                    </div>
                    <div className="flex gap-1">
                      {["present", "late", "absent"].map((item) => {
                        const active = status === item;
                        return (
                          <button key={item} className={`h-8 w-8 rounded-full border text-xs font-bold ${attendancePillClass(item, active)}`} onClick={() => setAttendanceDraft((prev) => ({ ...prev, [student.studentId]: item }))}>
                            {item === "present" ? "P" : item === "late" ? "L" : "A"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                className="btn-primary"
                disabled={saveAttendanceMutation.isPending}
                onClick={() => {
                  const attendance = attendanceStudents
                    .map((student) => ({ studentId: student.studentId, status: attendanceDraft[student.studentId] || student.status }))
                    .filter((row) => ["present", "absent", "late"].includes(row.status));
                  if (!attendance.length) {
                    toast.error("Mark at least one student before saving");
                    return;
                  }
                  saveAttendanceMutation.mutate({
                    sessionId: attendanceModalSession.id,
                    data: { attendance },
                  });
                }}
              >
                {saveAttendanceMutation.isPending ? "Saving..." : "Save Attendance"}
              </button>
            </div>
          </>
        )}
      </ModalShell>

      <ModalShell open={Boolean(calendarDetailSession)} onClose={() => setCalendarDetailSession(null)} title="Session Details" width="max-w-2xl">
        {detailQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : detailSession ? (
          <>
            {(() => {
              const isDetailOwner = !detailSession.teacherId || detailSession.teacherId === userProfile?.uid;
              return (
                <>
            <h4 className="text-xl font-bold text-slate-900">{detailSession.topic}</h4>
            <p className="mt-1 text-sm text-slate-600">{detailSession.className} • {detailSession.courseName || "No course"}</p>
            <p className="mt-2 text-sm text-slate-600">{formatLongDate(detailSession.date)} • {formatTimeLabel(detailSession.startTime)} - {formatTimeLabel(detailSession.endTime)}</p>
            <p className="mt-2 text-sm text-slate-600">Platform: {detailSession.platform}</p>
            <p className="mt-2 text-sm text-slate-500">{detailSession.description || "No description"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(resolveStatus(detailSession) === "upcoming" || resolveStatus(detailSession) === "live") && detailSession.meetingLink ? (
                <a className="rounded-full border border-primary/40 px-4 py-2 text-xs font-semibold text-primary" href={detailSession.meetingLink} target="_blank" rel="noreferrer">Join Link</a>
              ) : null}
              {resolveStatus(detailSession) === "upcoming" && isDetailOwner ? <button className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold" onClick={() => { setCalendarDetailSession(null); openScheduleModal("edit", detailSession); }}>Edit</button> : null}
              {resolveStatus(detailSession) === "upcoming" && isDetailOwner ? <button className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600" onClick={() => { setCalendarDetailSession(null); setCancelModalSession(detailSession); setCancelReason(""); setCancelNotify(true); }}>Cancel</button> : null}
              {(resolveStatus(detailSession) === "upcoming" || resolveStatus(detailSession) === "live") && isDetailOwner ? <button className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700" onClick={() => { setCalendarDetailSession(null); setCompleteModalSession(detailSession); setCompleteNotes(detailSession.sessionNotes || ""); }}>Mark Complete</button> : null}
              {resolveStatus(detailSession) === "completed" && isDetailOwner ? <button className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold" onClick={() => { setCalendarDetailSession(null); setAttendanceModalSession(detailSession); }}>View Attendance</button> : null}
              {resolveStatus(detailSession) === "cancelled" && isDetailOwner ? <button className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold" onClick={() => { setCalendarDetailSession(null); openScheduleModal("reschedule", detailSession); }}>Reschedule</button> : null}
              {!isDetailOwner ? <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">Owned by another teacher</span> : null}
            </div>
                </>
              );
            })()}
          </>
        ) : (
          <p className="text-sm text-slate-500">Session details unavailable.</p>
        )}
      </ModalShell>
    </div>
  );
}

export default TeacherSessions;

