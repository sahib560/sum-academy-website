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

const classes = [
  {
    id: 1,
    name: "Batch A - Biology",
    teacher: "Mr. Sikander Ali Qureshi",
    sessions: [
      {
        id: 1,
        date: "2026-03-02",
        topic: "Genetics Intro",
        status: "Present",
        remarks: "",
      },
      {
        id: 2,
        date: "2026-03-05",
        topic: "DNA Basics",
        status: "Late",
        remarks: "Joined 10 min late",
      },
      {
        id: 3,
        date: "2026-03-08",
        topic: "Chromosomes",
        status: "Absent",
        remarks: "Excused absence",
      },
      {
        id: 4,
        date: "2026-03-12",
        topic: "Physiology",
        status: "Present",
        remarks: "",
      },
      {
        id: 5,
        date: "2026-03-18",
        topic: "Respiration",
        status: "Upcoming",
        remarks: "",
      },
    ],
  },
  {
    id: 2,
    name: "Batch B - Chemistry",
    teacher: "Mr. Mansoor Ahmed Mangi",
    sessions: [
      {
        id: 1,
        date: "2026-03-01",
        topic: "Organic Intro",
        status: "Present",
        remarks: "",
      },
      {
        id: 2,
        date: "2026-03-04",
        topic: "Reactions",
        status: "Present",
        remarks: "",
      },
      {
        id: 3,
        date: "2026-03-07",
        topic: "Mechanisms",
        status: "Present",
        remarks: "",
      },
      {
        id: 4,
        date: "2026-03-11",
        topic: "Practice Session",
        status: "Present",
        remarks: "",
      },
    ],
  },
];

const statusStyles = {
  Present: "bg-emerald-50 text-emerald-600",
  Absent: "bg-rose-50 text-rose-600",
  Late: "bg-amber-50 text-amber-600",
};

const calendarDot = {
  Present: "bg-emerald-500",
  Absent: "bg-rose-500",
  Late: "bg-amber-400",
  Upcoming: "bg-slate-300",
};

const getPercentColor = (value) => {
  if (value >= 75) return "text-emerald-600";
  if (value >= 50) return "text-amber-600";
  return "text-rose-600";
};

const getStatusBadge = (value) => {
  if (value >= 75) return "bg-emerald-50 text-emerald-600";
  if (value >= 50) return "bg-amber-50 text-amber-600";
  return "bg-rose-50 text-rose-600";
};

const getStatusLabel = (value) => {
  if (value >= 75) return "Good Standing";
  if (value >= 50) return "At Risk";
  return "Critical";
};

function StudentAttendance() {
  const [loading, setLoading] = useState(true);
  const [activeClass, setActiveClass] = useState(classes[0]?.id || null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const selectedClass = classes.find((item) => item.id === activeClass);
  const sessions = selectedClass?.sessions || [];

  const stats = useMemo(() => {
    const recorded = sessions.filter((s) => s.status !== "Upcoming");
    const total = recorded.length;
    const present = recorded.filter((s) => s.status === "Present").length;
    const late = recorded.filter((s) => s.status === "Late").length;
    const absent = recorded.filter((s) => s.status === "Absent").length;
    const percent = total === 0 ? 0 : Math.round((present / total) * 100);
    return { total, present, late, absent, percent };
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

  const sessionsByDate = useMemo(() => {
    const map = new Map();
    sessions.forEach((session) => {
      map.set(session.date, session.status);
    });
    return map;
  }, [sessions]);

  const monthSessions = useMemo(() => {
    return sessions.filter((item) => {
      const date = new Date(item.date);
      return (
        date.getFullYear() === currentMonth.getFullYear() &&
        date.getMonth() === currentMonth.getMonth()
      );
    });
  }, [currentMonth, sessions]);

  const sortedSessions = useMemo(() => {
    const list = monthSessions.filter((item) => item.status !== "Upcoming");
    return list.sort((a, b) =>
      sortAsc
        ? new Date(a.date) - new Date(b.date)
        : new Date(b.date) - new Date(a.date)
    );
  }, [monthSessions, sortAsc]);

  if (classes.length === 0) {
    return (
      <div className="space-y-6">
        <motion.section {...fadeUp}>
          <h1 className="font-heading text-3xl text-slate-900">Attendance</h1>
        </motion.section>
        <motion.section
          {...fadeUp}
          className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
              <path d="M7 2h2v3H7V2zm8 0h2v3h-2V2zM4 6h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
            </svg>
          </div>
          <p className="font-semibold text-slate-700">
            You are not enrolled in any class
          </p>
          <Link className="btn-primary mt-4 inline-flex" to="/student/explore">
            Explore Courses
          </Link>
        </motion.section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Attendance</h1>
      </motion.section>

      <motion.section {...fadeUp} className="flex flex-wrap items-center gap-3">
        {classes.map((item) => (
          <button
            key={item.id}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              activeClass === item.id
                ? "bg-primary text-white"
                : "border border-slate-200 text-slate-600"
            }`}
            onClick={() => setActiveClass(item.id)}
          >
            {item.name}
          </button>
        ))}
      </motion.section>

      <motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">{selectedClass?.name}</p>
              <p className="text-sm text-slate-500">{selectedClass?.teacher}</p>
            </div>
            <div className="text-center">
              <p className={`text-4xl font-semibold ${getPercentColor(stats.percent)}`}>
                {stats.percent}%
              </p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(
                  stats.percent
                )}`}
              >
                {getStatusLabel(stats.percent)}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-3 text-xs text-slate-500">
              <div>
                <p className="text-sm font-semibold text-slate-900">{stats.total}</p>
                Total Sessions
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{stats.present}</p>
                Present
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{stats.absent}</p>
                Absent
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{stats.late}</p>
                Late
              </div>
            </div>
          </div>
        )}
      </motion.section>

      <motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <button
            className="btn-outline"
            onClick={() =>
              setCurrentMonth(
                new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
              )
            }
          >
            Prev
          </button>
          <h2 className="font-heading text-xl text-slate-900">
            {currentMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <button
            className="btn-outline"
            onClick={() =>
              setCurrentMonth(
                new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
              )
            }
          >
            Next
          </button>
        </div>
        {loading ? (
          <Skeleton className="mt-4 h-48 w-full" />
        ) : (
          <div className="mt-4 grid grid-cols-7 gap-2 text-xs text-slate-500">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day} className="text-center uppercase text-[10px]">
                {day}
              </span>
            ))}
            {calendarDays.map((day, index) => {
              const key = day ? day.toISOString().slice(0, 10) : `empty-${index}`;
              const status = day ? sessionsByDate.get(day.toISOString().slice(0, 10)) : null;
              return (
                <div
                  key={key}
                  className="min-h-[48px] rounded-xl border border-slate-200 bg-white p-2 text-center"
                >
                  {day && (
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-xs text-slate-600">{day.getDate()}</span>
                      {status && (
                        <span className={`h-2 w-2 rounded-full ${calendarDot[status]}`} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
          {Object.entries(calendarDot).map(([label, color]) => (
            <span key={label} className="inline-flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${color}`} />
              {label}
            </span>
          ))}
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-200" />
            No session
          </span>
        </div>
      </motion.section>

      <motion.section {...fadeUp} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xl text-slate-900">Attendance Detail</h3>
          <button className="text-xs text-slate-500" onClick={() => setSortAsc((prev) => !prev)}>
            Sort by date
          </button>
        </div>
        {loading ? (
          <Skeleton className="mt-4 h-24 w-full" />
        ) : sortedSessions.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">
            No attendance records for this month.
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-3 md:hidden">
              {sortedSessions.map((session, index) => (
                <div
                  key={session.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Session #{index + 1}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        statusStyles[session.status]
                      }`}
                    >
                      {session.status}
                    </span>
                  </div>
                  <p className="mt-2 font-semibold text-slate-900">
                    {session.topic}
                  </p>
                  <p className="text-xs text-slate-500">{session.date}</p>
                  {session.remarks && (
                    <p className="mt-2 text-xs text-slate-500">
                      {session.remarks}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                    <th className="py-2">Session #</th>
                    <th className="py-2">Date</th>
                    <th className="py-2">Topic</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSessions.map((session, index) => (
                    <tr key={session.id} className="border-t border-slate-100">
                      <td className="py-3">{index + 1}</td>
                      <td className="py-3">{session.date}</td>
                      <td className="py-3">{session.topic}</td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            statusStyles[session.status]
                          }`}
                        >
                          {session.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500">
                        {session.remarks || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.section>

      {stats.percent < 75 && (
        <motion.section
          {...fadeUp}
          className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700"
        >
          Your attendance is below 75%. Please contact your teacher.
          <button className="btn-primary ml-4">Contact Teacher</button>
        </motion.section>
      )}
    </div>
  );
}

export default StudentAttendance;
