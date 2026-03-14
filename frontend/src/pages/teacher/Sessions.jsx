import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "../../components/Skeleton.jsx";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const statusConfig = {
  Upcoming: {
    bar: "bg-blue-500",
    badge: "bg-blue-50 text-blue-600",
    pill: "bg-blue-100 text-blue-600",
  },
  Live: {
    bar: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-600",
    pill: "bg-emerald-100 text-emerald-600",
  },
  Completed: {
    bar: "bg-slate-300",
    badge: "bg-slate-100 text-slate-500",
    pill: "bg-slate-100 text-slate-500",
  },
  Cancelled: {
    bar: "bg-rose-500",
    badge: "bg-rose-50 text-rose-500",
    pill: "bg-rose-100 text-rose-600",
  },
};

const initialSessions = [
  {
    id: 1,
    className: "Batch A - Biology XI",
    topic: "Genetics Live Review",
    date: "2026-03-14",
    startTime: "16:00",
    duration: "1 hr",
    platform: "Zoom",
    link: "https://zoom.us/j/123",
    students: 36,
    status: "Live",
  },
  {
    id: 2,
    className: "Batch B - Chemistry XII",
    topic: "Organic Mechanisms",
    date: "2026-03-16",
    startTime: "18:30",
    duration: "1.5 hrs",
    platform: "Google Meet",
    link: "https://meet.google.com/xyz",
    students: 28,
    status: "Upcoming",
  },
  {
    id: 3,
    className: "Batch C - Physics XI",
    topic: "Kinematics Drill",
    date: "2026-03-11",
    startTime: "17:00",
    duration: "1 hr",
    platform: "Zoom",
    link: "https://zoom.us/j/456",
    students: 31,
    status: "Completed",
  },
  {
    id: 4,
    className: "Batch D - English XI",
    topic: "Essay Planning",
    date: "2026-03-12",
    startTime: "15:30",
    duration: "30 min",
    platform: "Microsoft Teams",
    link: "https://teams.microsoft.com/l/meetup",
    students: 24,
    status: "Cancelled",
  },
  {
    id: 5,
    className: "Batch A - Biology XI",
    topic: "Physiology Q&A",
    date: "2026-03-20",
    startTime: "17:30",
    duration: "2 hrs",
    platform: "Zoom",
    link: "https://zoom.us/j/789",
    students: 42,
    status: "Upcoming",
  },
];

const filterTabs = ["All", "Upcoming", "Today", "Completed", "Cancelled"];

const classOptions = [
  "Batch A - Biology XI",
  "Batch B - Chemistry XII",
  "Batch C - Physics XI",
  "Batch D - English XI",
];

const durationOptions = ["30 min", "1 hr", "1.5 hrs", "2 hrs", "Custom"];

const platformOptions = ["Zoom", "Google Meet", "Microsoft Teams", "Other"];

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "2-digit",
    year: "numeric",
  });
};

const formatMonth = (date) =>
  date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

const isSameDay = (date, target) =>
  date.getFullYear() === target.getFullYear() &&
  date.getMonth() === target.getMonth() &&
  date.getDate() === target.getDate();

function TeacherSessions() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("List");
  const [filter, setFilter] = useState("All");
  const [sessions, setSessions] = useState(initialSessions);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [completeModal, setCompleteModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notifyStudents, setNotifyStudents] = useState(true);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNotify, setCancelNotify] = useState(true);
  const [completeNotes, setCompleteNotes] = useState("");
  const [formData, setFormData] = useState({
    className: classOptions[0],
    topic: "",
    date: "",
    startTime: "",
    duration: durationOptions[1],
    platform: platformOptions[0],
    link: "",
    description: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(() => {
    const upcoming = sessions.filter((session) => session.status === "Upcoming")
      .length;
    const completed = sessions.filter((session) => session.status === "Completed")
      .length;
    return {
      upcoming,
      completed,
      total: sessions.length,
    };
  }, [sessions]);

  const today = new Date();

  const filteredSessions = useMemo(() => {
    return sessions
      .filter((session) => {
        if (filter === "All") return true;
        if (filter === "Today") {
          return isSameDay(new Date(session.date), today);
        }
        return session.status === filter;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [filter, sessions, today]);

  const sessionsByDate = useMemo(() => {
    const map = new Map();
    sessions.forEach((session) => {
      const key = session.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(session);
    });
    return map;
  }, [sessions]);

  const monthStart = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
    [currentMonth]
  );
  const monthEnd = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0),
    [currentMonth]
  );

  const calendarDays = useMemo(() => {
    const days = [];
    const startDay = monthStart.getDay();
    const totalDays = monthEnd.getDate();
    for (let i = 0; i < startDay; i += 1) {
      days.push(null);
    }
    for (let day = 1; day <= totalDays; day += 1) {
      days.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
    }
    while (days.length % 7 !== 0) {
      days.push(null);
    }
    return days;
  }, [monthEnd, monthStart]);

  const sessionsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return sessionsByDate.get(selectedDate) || [];
  }, [selectedDate, sessionsByDate]);

  const openScheduleModal = (session = null) => {
    setEditingSession(session);
    setFormData(
      session
        ? {
            className: session.className,
            topic: session.topic,
            date: session.date,
            startTime: session.startTime,
            duration: session.duration,
            platform: session.platform,
            link: session.link,
            description: session.description || "",
          }
        : {
            className: classOptions[0],
            topic: "",
            date: "",
            startTime: "",
            duration: durationOptions[1],
            platform: platformOptions[0],
            link: "",
            description: "",
          }
    );
    setNotifyStudents(true);
    setScheduleModal(true);
  };

  const handleSaveSession = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      if (editingSession) {
        setSessions((prev) =>
          prev.map((session) =>
            session.id === editingSession.id
              ? { ...session, ...formData }
              : session
          )
        );
        setToast({ type: "success", message: "Session updated." });
      } else {
        const newSession = {
          id: Date.now(),
          students: 0,
          status: "Upcoming",
          ...formData,
        };
        setSessions((prev) => [...prev, newSession]);
        setToast({ type: "success", message: "Session scheduled." });
      }
      setScheduleModal(false);
    }, 900);
  };

  const handleCancelSession = () => {
    if (!cancelModal) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === cancelModal.id
          ? { ...session, status: "Cancelled" }
          : session
      )
    );
    setCancelModal(null);
    setCancelReason("");
    setToast({ type: "success", message: "Session cancelled." });
  };

  const handleCompleteSession = () => {
    if (!completeModal) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === completeModal.id
          ? { ...session, status: "Completed" }
          : session
      )
    );
    setCompleteModal(null);
    setCompleteNotes("");
    setToast({ type: "success", message: "Session marked complete." });
  };
  return (
    <div className="space-y-6">
      <motion.section
        {...fadeUp}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <h1 className="font-heading text-3xl text-slate-900">Sessions</h1>
        <button className="btn-primary" onClick={() => openScheduleModal()}>
          Schedule Session
        </button>
      </motion.section>
      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`stat-${index}`}
                className="glass-card border border-slate-200"
              >
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-4 h-8 w-1/2" />
              </div>
            ))
          : [
              { label: "Upcoming Sessions", value: stats.upcoming },
              { label: "Completed This Month", value: stats.completed },
              { label: "Total Sessions", value: stats.total },
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
      <motion.section {...fadeUp} className="flex flex-wrap items-center gap-3">
        {["List", "Calendar"].map((option) => (
          <button
            key={option}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              view === option
                ? "bg-primary text-white"
                : "border border-slate-200 text-slate-600"
            }`}
            onClick={() => setView(option)}
          >
            {option} View
          </button>
        ))}
      </motion.section>
      {view === "List" ? (
        <div>{/*LIST_VIEW*/}</div>
      ) : (
        <div>{/*CALENDAR_VIEW*/}</div>
      )}
      {/*SCHEDULE_MODAL*/}
      {/*CANCEL_MODAL*/}
      {/*COMPLETE_MODAL*/}
      {/*TOAST*/}
    </div>
  );
}

export default TeacherSessions;
