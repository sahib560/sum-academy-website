import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  FiBarChart2,
  FiBookOpen,
  FiCalendar,
  FiClipboard,
  FiBell,
  FiUsers,
  FiVideo,
} from "react-icons/fi";
import { Skeleton, SkeletonCard } from "../../components/Skeleton.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { getTeacherDashboard } from "../../services/teacher.service.js";

const quickActions = [
  {
    label: "Upload Video",
    to: "/teacher/courses",
    icon: <FiVideo className="h-4 w-4" />,
  },
  {
    label: "Create Quiz",
    to: "/teacher/quizzes",
    icon: <FiClipboard className="h-4 w-4" />,
  },
  {
    label: "Schedule Session",
    to: "/teacher/sessions",
    icon: <FiCalendar className="h-4 w-4" />,
  },
  {
    label: "Post Announcement",
    to: "/teacher/announcements",
    icon: <FiBell className="h-4 w-4" />,
  },
];

const statsConfig = [
  {
    key: "myCourses",
    label: "My Courses",
    suffix: "",
    color: "border-blue-500",
    icon: <FiBookOpen className="h-5 w-5" />,
  },
  {
    key: "totalMyStudents",
    label: "Total My Students",
    suffix: "",
    color: "border-emerald-500",
    icon: <FiUsers className="h-5 w-5" />,
  },
  {
    key: "avgCompletionRate",
    label: "Avg Completion Rate",
    suffix: "%",
    color: "border-orange-500",
    icon: <FiBarChart2 className="h-5 w-5" />,
  },
  {
    key: "pendingQuizReviews",
    label: "Pending Quiz Reviews",
    suffix: "",
    color: "border-purple-500",
    icon: <FiClipboard className="h-5 w-5" />,
  },
];

const statusStyles = {
  published: "bg-emerald-50 text-emerald-600",
  draft: "bg-amber-50 text-amber-600",
  archived: "bg-slate-100 text-slate-500",
  active: "bg-blue-50 text-blue-600",
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const useCountUp = (target, enabled) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setValue(0);
      return;
    }

    let animationFrame;
    const start = performance.now();
    const duration = 700;

    const animate = (time) => {
      const progress = Math.min((time - start) / duration, 1);
      setValue(Math.floor(progress * target));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [enabled, target]);

  return value;
};

const formatRelativeTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))} mins ago`;
  if (diff < day) return `${Math.floor(diff / hour)} hours ago`;
  return `${Math.floor(diff / day)} days ago`;
};

const formatSessionDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const formatSessionTime = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "TBD";
  if (raw.toLowerCase().includes("am") || raw.toLowerCase().includes("pm")) {
    return raw.toUpperCase();
  }
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return raw;
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

function TeacherDashboard() {
  const { userProfile } = useAuth();
  const canQuery = Boolean(userProfile?.uid);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["teacher-dashboard", userProfile?.uid],
    queryFn: getTeacherDashboard,
    enabled: canQuery,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
  const showLoading = !canQuery || isLoading;

  const dashboard = data || {};
  const stats = dashboard.stats || {};
  const courses = Array.isArray(dashboard.courses) ? dashboard.courses : [];
  const activities = Array.isArray(dashboard.activities) ? dashboard.activities : [];
  const sessions = Array.isArray(dashboard.sessions) ? dashboard.sessions : [];

  const countValues = [
    useCountUp(Number(stats.myCourses || 0), !showLoading),
    useCountUp(Number(stats.totalMyStudents || 0), !showLoading),
    useCountUp(Number(stats.avgCompletionRate || 0), !showLoading),
    useCountUp(Number(stats.pendingQuizReviews || 0), !showLoading),
  ];

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    []
  );

  const teacherName =
    userProfile?.name ||
    userProfile?.fullName ||
    userProfile?.displayName ||
    "Teacher";

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-lg text-slate-700">
            <span>
              {greeting}, {teacherName}!
            </span>
            <span className="text-sm text-slate-500">| {today}</span>
          </div>
          {isError && canQuery ? (
            <span className="text-xs font-semibold text-rose-500">
              Live data failed to load. Showing latest available values.
            </span>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="group inline-flex items-center gap-2 rounded-full border border-primary/40 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
            >
              <span className="transition group-hover:text-white">{action.icon}</span>
              {action.label}
            </Link>
          ))}
        </div>
      </motion.section>

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {showLoading
          ? Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={`stat-${index}`} />)
          : statsConfig.map((stat, index) => (
              <div key={stat.key} className={`glass-card border-l-4 ${stat.color}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">{stat.label}</p>
                  <div className="text-slate-400">{stat.icon}</div>
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {countValues[index]}
                  {stat.suffix}
                </p>
              </div>
            ))}
      </motion.section>

      <motion.section {...fadeUp} className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl text-slate-900">My Courses</h2>
          </div>
          <div className="mt-4 space-y-3">
            {showLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div key={`course-skeleton-${index}`} className="flex items-center gap-3">
                    <Skeleton className="h-12 w-16 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                ))
              : courses.length === 0
                ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                      No courses assigned yet.
                    </div>
                  )
                : courses.map((course) => {
                    const normalizedStatus = String(course.status || "draft").toLowerCase();
                    return (
                      <div
                        key={course.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-16 rounded-xl bg-slate-200" />
                          <div>
                            <p className="font-semibold text-slate-900">{course.title || "Untitled Course"}</p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                                {Number(course.enrolled || 0)} enrolled
                              </span>
                              <span>{Number(course.completion || 0)}% completion</span>
                            </div>
                            <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                              <div
                                className="h-2 rounded-full bg-primary"
                                style={{
                                  width: `${Math.max(0, Math.min(100, Number(course.completion || 0)))}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            statusStyles[normalizedStatus] || "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {course.status || "Draft"}
                        </span>
                      </div>
                    );
                  })}
          </div>
          <div className="mt-4 text-right">
            <Link className="text-sm font-semibold text-primary" to="/teacher/courses">
              View All
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl text-slate-900">Recent Student Activity</h2>
          </div>
          <div className="mt-4 space-y-3">
            {showLoading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <div key={`activity-skeleton-${index}`} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))
              : activities.length === 0
                ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                      No recent student activity.
                    </div>
                  )
                : activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {String(activity.name || "Student")
                            .split(" ")
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{activity.name || "Student"}</p>
                          <p className="text-xs text-slate-500">
                            {activity.action || "Activity"} - {activity.course || "Course"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">
                        {formatRelativeTime(activity.time)}
                      </span>
                    </div>
                  ))}
          </div>
          <div className="mt-4 text-right">
            <Link className="text-sm font-semibold text-primary" to="/teacher/students">
              View All Students
            </Link>
          </div>
        </div>
      </motion.section>

      <motion.section {...fadeUp} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-heading text-2xl text-slate-900">Upcoming Sessions</h2>
          <Link to="/teacher/sessions" className="btn-outline">
            Schedule Session
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {showLoading
            ? Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={`session-skeleton-${index}`} className="h-16 w-full" />
              ))
            : sessions.length === 0
              ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    <p>No upcoming sessions.</p>
                    <Link to="/teacher/sessions" className="btn-outline mt-3 inline-flex">
                      Schedule Session
                    </Link>
                  </div>
                )
              : sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{session.title || "Session"}</p>
                      <p className="text-xs text-slate-500">
                        {formatSessionDate(session.date)} - {formatSessionTime(session.time)}
                      </p>
                    </div>
                    <Link to="/teacher/sessions" className="btn-outline">
                      Join
                    </Link>
                  </div>
                ))}
        </div>
      </motion.section>
    </div>
  );
}

export default TeacherDashboard;
