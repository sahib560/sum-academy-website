import { useMemo, useState } from "react";
import { motion as Motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { FiCalendar } from "react-icons/fi";
import { Skeleton } from "../../components/Skeleton.jsx";
import { getStudentAttendance } from "../../services/student.service.js";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_STYLES = {
  present: "bg-emerald-50 text-emerald-700",
  absent: "bg-rose-50 text-rose-700",
  late: "bg-amber-50 text-amber-700",
  upcoming: "bg-slate-100 text-slate-600",
};

const CALENDAR_DOT = {
  present: "bg-emerald-500",
  absent: "bg-rose-500",
  late: "bg-amber-400",
  upcoming: "bg-slate-400",
};

const STATUS_PRIORITY = {
  absent: 4,
  late: 3,
  present: 2,
  upcoming: 1,
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeStatus = (value = "") => {
  const status = String(value || "").trim().toLowerCase();
  if (["present", "absent", "late", "upcoming"].includes(status)) return status;
  return "absent";
};

const getPercentColor = (value) => {
  if (value >= 75) return "text-emerald-600";
  if (value >= 50) return "text-amber-600";
  return "text-rose-600";
};

const getStandingBadge = (value) => {
  if (value >= 75) return { label: "Good Standing", className: "bg-emerald-50 text-emerald-700" };
  if (value >= 50) return { label: "At Risk", className: "bg-amber-50 text-amber-700" };
  return { label: "Critical", className: "bg-rose-50 text-rose-700" };
};

const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDateKey = (value) => {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : "";
};

const formatDate = (value) => {
  const parsed = toDate(value);
  if (!parsed) return "-";
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDateCompact = (value) => {
  const parsed = toDate(value);
  if (!parsed) return "N/A";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const formatMonth = (date) =>
  date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

const getMonthGrid = (monthCursor) => {
  const firstDay = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const lastDay = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
  const leadingBlanks = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();
  const cells = [];

  for (let index = 0; index < leadingBlanks; index += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

function StudentAttendance() {
  const [preferredClassId, setPreferredClassId] = useState("");
  const [monthCursor, setMonthCursor] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student-attendance"],
    queryFn: () => getStudentAttendance(),
    staleTime: 30000,
  });

  const classes = useMemo(
    () => (Array.isArray(data?.classes) ? data.classes : []),
    [data]
  );

  const activeClassId = useMemo(() => {
    if (!classes.length) return "";
    if (classes.some((row) => String(row.classId) === String(preferredClassId))) {
      return String(preferredClassId);
    }
    return String(classes[0].classId);
  }, [classes, preferredClassId]);

  const selectedClass = useMemo(
    () => classes.find((row) => String(row.classId) === String(activeClassId)) || null,
    [activeClassId, classes]
  );

  const sessions = useMemo(() => {
    const rows = Array.isArray(selectedClass?.sessions) ? selectedClass.sessions : [];
    return rows
      .map((row, index) => ({
        sessionId: row.sessionId || `session-${index + 1}`,
        sessionNumber: toNumber(row.sessionNumber, index + 1),
        date: row.date || "",
        topic: row.topic || "Session",
        status: normalizeStatus(row.status),
        remarks: row.remarks || "",
        subjectName: row.subjectName || "",
      }))
      .sort((a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0));
  }, [selectedClass]);

  const monthSessions = useMemo(
    () =>
      sessions.filter((row) => {
        const date = toDate(row.date);
        if (!date) return false;
        return (
          date.getFullYear() === monthCursor.getFullYear() &&
          date.getMonth() === monthCursor.getMonth()
        );
      }),
    [monthCursor, sessions]
  );

  const calendarStatusByDate = useMemo(() => {
    const map = new Map();
    monthSessions.forEach((row) => {
      const key = toDateKey(row.date);
      if (!key) return;
      const current = map.get(key);
      if (!current || STATUS_PRIORITY[row.status] > STATUS_PRIORITY[current]) {
        map.set(key, row.status);
      }
    });
    return map;
  }, [monthSessions]);

  const monthGrid = useMemo(() => getMonthGrid(monthCursor), [monthCursor]);
  const attendancePercent = toNumber(selectedClass?.attendancePercent, 0);
  const standing = getStandingBadge(attendancePercent);
  const currentStreak = toNumber(selectedClass?.currentStreak, 0);
  const longestStreak = toNumber(selectedClass?.longestStreak, 0);
  const learningDaysElapsed = toNumber(selectedClass?.learningDaysElapsed, 0);
  const courseDurationDays = toNumber(selectedClass?.courseDurationDays, 0);
  const courseWindowStart = selectedClass?.courseWindowStart || null;
  const courseWindowEnd = selectedClass?.courseWindowEnd || null;

  const stats = useMemo(() => {
    if (!selectedClass) return { total: 0, present: 0, absent: 0, late: 0 };
    return {
      total: toNumber(selectedClass.totalSessions, 0),
      present: toNumber(selectedClass.presentCount, 0),
      absent: toNumber(selectedClass.absentCount, 0),
      late: toNumber(selectedClass.lateCount, 0),
    };
  }, [selectedClass]);

  if (isError) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error?.response?.data?.message || error?.message || "Failed to load attendance"}
      </div>
    );
  }

  if (!isLoading && classes.length < 1) {
    return (
      <div className="space-y-6">
        <Motion.section {...fadeUp}>
          <h1 className="font-heading text-3xl text-slate-900">Attendance</h1>
        </Motion.section>
        <Motion.section
          {...fadeUp}
          className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FiCalendar className="h-8 w-8" aria-hidden="true" />
          </div>
          <p className="text-base font-semibold text-slate-800">
            You are not enrolled in any class
          </p>
          <p className="mt-1 text-sm text-slate-500">Contact admin to enroll in a class</p>
        </Motion.section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Attendance</h1>
      </Motion.section>

      <Motion.section {...fadeUp} className="flex flex-wrap items-center gap-3">
        {isLoading
          ? Array.from({ length: 3 }).map((ignore, index) => (
              <Skeleton key={`class-tab-skel-${index}`} className="h-10 w-40 rounded-full" />
            ))
          : classes.map((row) => (
              <button
                key={row.classId}
                className={`rounded-full px-4 py-2 text-left text-xs font-semibold ${
                  String(activeClassId) === String(row.classId)
                    ? "bg-primary text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
                onClick={() => setPreferredClassId(String(row.classId))}
              >
                {row.className}
                <span className="ml-2 opacity-80">{row.batchCode ? `(${row.batchCode})` : ""}</span>
              </button>
            ))}
      </Motion.section>

      <Motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {isLoading ? (
          <Skeleton className="h-28 w-full rounded-2xl" />
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Attendance</p>
                <p className={`mt-2 text-5xl font-semibold ${getPercentColor(attendancePercent)}`}>
                  {Math.round(attendancePercent)}%
                </p>
                <span
                  className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${standing.className}`}
                >
                  {standing.label}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{stats.total}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-600">Present</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-700">{stats.present}</p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                  <p className="text-xs text-rose-600">Absent</p>
                  <p className="mt-1 text-xl font-semibold text-rose-700">{stats.absent}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-600">Late</p>
                  <p className="mt-1 text-xl font-semibold text-amber-700">{stats.late}</p>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs text-blue-700">Current Streak</p>
                  <p className="mt-1 text-xl font-semibold text-blue-800">
                    {currentStreak} days
                  </p>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
                  <p className="text-xs text-indigo-700">Longest Streak</p>
                  <p className="mt-1 text-xl font-semibold text-indigo-800">
                    {longestStreak} days
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-700">Learning Days</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-800">
                    {courseDurationDays > 0
                      ? `${learningDaysElapsed}/${courseDurationDays}`
                      : learningDaysElapsed}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Course Window</p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">
                    {formatDateCompact(courseWindowStart)} -{" "}
                    {formatDateCompact(courseWindowEnd)}
                  </p>
                </div>
              </div>
            </div>

            {attendancePercent < 75 ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Your attendance is below 75%. Contact your teacher.
              </div>
            ) : null}
          </>
        )}
      </Motion.section>

      <Motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <button
            className="btn-outline"
            onClick={() =>
              setMonthCursor(
                new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1)
              )
            }
            disabled={isLoading}
          >
            Prev
          </button>
          <h2 className="font-heading text-xl text-slate-900">{formatMonth(monthCursor)}</h2>
          <button
            className="btn-outline"
            onClick={() =>
              setMonthCursor(
                new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1)
              )
            }
            disabled={isLoading}
          >
            Next
          </button>
        </div>

        {isLoading ? (
          <Skeleton className="mt-4 h-56 w-full rounded-2xl" />
        ) : (
          <div className="mt-4 grid grid-cols-7 gap-2 text-xs">
            {WEEK_LABELS.map((label) => (
              <div
                key={label}
                className="py-1 text-center uppercase tracking-[0.16em] text-slate-400"
              >
                {label}
              </div>
            ))}
            {monthGrid.map((date, index) => {
              const key = date ? toDateKey(date) : `empty-${index}`;
              const status = date ? calendarStatusByDate.get(toDateKey(date)) : "";
              const isToday =
                Boolean(date) && toDateKey(date) === new Date().toISOString().slice(0, 10);

              return (
                <div
                  key={key}
                  className={`min-h-[68px] rounded-xl border p-2 ${
                    isToday ? "border-primary/40 bg-primary/5" : "border-slate-200 bg-white"
                  }`}
                >
                  {date ? (
                    <div className="flex h-full flex-col items-center justify-start gap-2">
                      <span className="text-xs text-slate-600">{date.getDate()}</span>
                      {status ? <span className={`h-2.5 w-2.5 rounded-full ${CALENDAR_DOT[status]}`} /> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${CALENDAR_DOT.present}`} />
            Present
          </span>
          <span className="inline-flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${CALENDAR_DOT.absent}`} />
            Absent
          </span>
          <span className="inline-flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${CALENDAR_DOT.late}`} />
            Late
          </span>
          <span className="inline-flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${CALENDAR_DOT.upcoming}`} />
            Upcoming session
          </span>
        </div>
      </Motion.section>

      <Motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h3 className="font-heading text-xl text-slate-900">Attendance Table</h3>

        {isLoading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 6 }).map((ignore, index) => (
              <Skeleton key={`attendance-row-skel-${index}`} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : monthSessions.length < 1 ? (
          <p className="mt-4 text-sm text-slate-500">No session records for this month.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
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
                {monthSessions.map((row, index) => (
                  <tr key={row.sessionId} className="border-t border-slate-100">
                    <td className="py-3">{row.sessionNumber || index + 1}</td>
                    <td className="py-3 text-slate-600">{formatDate(row.date)}</td>
                    <td className="py-3">
                      <p className="font-semibold text-slate-900">{row.topic}</p>
                      {row.subjectName ? (
                        <p className="text-xs text-slate-500">{row.subjectName}</p>
                      ) : null}
                    </td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          STATUS_STYLES[row.status] || STATUS_STYLES.absent
                        }`}
                      >
                        {row.status === "upcoming"
                          ? "Upcoming"
                          : row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 text-slate-500">{row.remarks || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Motion.section>
    </div>
  );
}

export default StudentAttendance;
