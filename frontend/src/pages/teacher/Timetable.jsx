import { useMemo } from "react";
import { motion as Motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../../components/Skeleton.jsx";
import { getTeacherTimetable } from "../../services/teacher.service.js";

const dayOrder = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

const sortDays = (days = []) =>
  [...days].sort((a, b) => {
    const aKey = String(a || "").trim().toLowerCase();
    const bKey = String(b || "").trim().toLowerCase();
    return (dayOrder[aKey] || 99) - (dayOrder[bKey] || 99);
  });

const formatDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
};

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.3 },
};

function TeacherTimetable() {
  const timetableQuery = useQuery({
    queryKey: ["teacher-timetable"],
    queryFn: getTeacherTimetable,
    staleTime: 30 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const classes = Array.isArray(timetableQuery.data?.classes)
    ? timetableQuery.data.classes
    : [];
  const entries = Array.isArray(timetableQuery.data?.timetable)
    ? timetableQuery.data.timetable
    : [];

  const byDay = useMemo(() => {
    const map = new Map();
    entries.forEach((entry) => {
      const days = sortDays(Array.isArray(entry.days) ? entry.days : []);
      if (!days.length) {
        const key = "Unscheduled";
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(entry);
        return;
      }
      days.forEach((day) => {
        if (!map.has(day)) map.set(day, []);
        map.get(day).push(entry);
      });
    });
    const sortedKeys = [...map.keys()].sort((a, b) => {
      const aKey = String(a).toLowerCase();
      const bKey = String(b).toLowerCase();
      return (dayOrder[aKey] || 99) - (dayOrder[bKey] || 99);
    });
    return sortedKeys.map((key) => ({
      day: key,
      rows: (map.get(key) || []).sort((a, b) =>
        String(a.startTime || "").localeCompare(String(b.startTime || ""))
      ),
    }));
  }, [entries]);

  if (timetableQuery.isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="font-heading text-2xl text-slate-900">Class Timetable</h2>
        <p className="mt-1 text-sm text-slate-500">
          Weekly schedule for assigned classes and shifts.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
              Classes
            </p>
            <p className="mt-2 text-2xl font-semibold text-blue-900">{classes.length}</p>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Total Shifts
            </p>
            <p className="mt-2 text-2xl font-semibold text-indigo-900">{entries.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
              Active Range
            </p>
            <p className="mt-2 text-sm font-semibold text-emerald-900">
              {classes.length
                ? `${formatDate(classes[0]?.startDate)} - ${formatDate(
                    classes[classes.length - 1]?.endDate
                  )}`
                : "-"}
            </p>
          </div>
        </div>
      </Motion.section>

      {entries.length < 1 ? (
        <Motion.section
          {...fadeUp}
          className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500"
        >
          No timetable entries found for assigned classes yet.
        </Motion.section>
      ) : (
        <div className="grid gap-4">
          {byDay.map((dayBlock) => (
            <Motion.section
              key={dayBlock.day}
              {...fadeUp}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h3 className="font-heading text-xl text-slate-900">{dayBlock.day}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {dayBlock.rows.map((entry) => (
                  <div
                    key={`${dayBlock.day}-${entry.id}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {entry.className}
                      {entry.batchCode ? ` (${entry.batchCode})` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{entry.courseName || "Course"}</p>
                    <p className="mt-2 text-sm font-semibold text-primary">
                      {entry.startTime || "TBD"} - {entry.endTime || "TBD"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Active: {formatDate(entry.startDate)} to {formatDate(entry.endDate)}
                    </p>
                  </div>
                ))}
              </div>
            </Motion.section>
          ))}
        </div>
      )}
    </div>
  );
}

export default TeacherTimetable;
