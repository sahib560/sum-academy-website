import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion as Motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FiAward, FiBookOpen, FiGrid } from "react-icons/fi";
import { Skeleton, SkeletonCard } from "../../components/Skeleton.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { getStudentDashboard } from "../../services/student.service.js";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDisplayDate = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return "-";
  return parsed.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeDashboard = (raw = {}, fallbackName = "Student") => {
  const profile = raw.profile || {};
  const stats = raw.stats || {};
  const classes = Array.isArray(raw.classes) ? raw.classes : [];
  const courses = Array.isArray(raw.courses) ? raw.courses : [];
  const announcements = Array.isArray(raw.announcements) ? raw.announcements : [];
  const upcomingSessions = Array.isArray(raw.upcomingSessions) ? raw.upcomingSessions : [];
  const lastAccessed = raw.lastAccessedCourse || null;

  return {
    fullName: profile.fullName || fallbackName || "Student",
    lastLoginAt: profile.lastLoginAt || null,
    classes,
    courses,
    announcements,
    upcomingSessions,
    lastAccessed,
    stats: {
      enrolledClassesCount: toNumber(stats.enrolledClassesCount, classes.length),
      enrolledCoursesCount: toNumber(stats.enrolledCoursesCount, courses.length),
      completedCount: toNumber(
        stats.completedCount,
        courses.filter((row) => toNumber(row.progress, 0) >= 100).length
      ),
      certificatesCount: toNumber(stats.certificatesCount, 0),
    },
  };
};

function StudentDashboard() {
  const { userProfile } = useAuth();
  const fallbackName =
    userProfile?.name || userProfile?.fullName || userProfile?.email || "Student";

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["student-dashboard"],
    queryFn: () => getStudentDashboard(),
    staleTime: 30000,
  });

  const dashboard = useMemo(
    () => normalizeDashboard(data || {}, fallbackName),
    [data, fallbackName]
  );

  const firstName = String(dashboard.fullName).split(" ")[0] || "Student";
  const classCards = dashboard.classes.slice(0, 6);
  const topSessions = dashboard.upcomingSessions.slice(0, 3);
  const topAnnouncements = dashboard.announcements.slice(0, 3);

  const cards = [
    {
      label: "My Classes",
      value: dashboard.stats.enrolledClassesCount,
      color: "border-blue-500",
      icon: <FiGrid className="h-5 w-5" />,
    },
    {
      label: "Courses In Classes",
      value: dashboard.stats.enrolledCoursesCount,
      color: "border-emerald-500",
      icon: <FiBookOpen className="h-5 w-5" />,
    },
    {
      label: "Certificates Earned",
      value: dashboard.stats.certificatesCount,
      color: "border-orange-500",
      icon: <FiAward className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-6">
      <Motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-56" />
          </div>
        ) : (
          <>
            <h2 className="font-heading text-2xl text-slate-900">Welcome, {firstName}</h2>
            <p className="mt-2 text-sm text-slate-500">
              Last login: {dashboard.lastLoginAt ? formatDisplayDate(dashboard.lastLoginAt) : "N/A"}
            </p>
          </>
        )}
      </Motion.section>

      {isError && (
        <Motion.section
          {...fadeUp}
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <p>
            Failed to load dashboard
            {error?.message ? `: ${error.message}` : "."}
          </p>
          <button
            className="mt-3 rounded-full border border-rose-300 bg-white px-4 py-2 text-xs font-semibold"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </Motion.section>
      )}

      <Motion.section {...fadeUp} className="grid gap-4 md:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={`summary-${index}`} className="glass-card border border-slate-200">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-4 h-8 w-1/3" />
              </div>
            ))
          : cards.map((card) => (
              <div key={card.label} className={`glass-card border-l-4 ${card.color}`}>
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>{card.label}</span>
                  <span className="text-slate-400">{card.icon}</span>
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{card.value}</p>
              </div>
            ))}
      </Motion.section>

      <Motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {isLoading ? (
          <Skeleton className="h-36 w-full rounded-2xl" />
        ) : dashboard.lastAccessed ? (
          <div className="flex flex-wrap items-center gap-6">
            <div className="h-28 w-44 overflow-hidden rounded-2xl bg-slate-100">
              {dashboard.lastAccessed.thumbnail ? (
                <img
                  src={dashboard.lastAccessed.thumbnail}
                  alt={dashboard.lastAccessed.title || "Course thumbnail"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-200 to-blue-50 text-xs font-semibold text-blue-700">
                  Continue
                </div>
              )}
            </div>
            <div className="min-w-[220px] flex-1 space-y-2">
              <h3 className="font-heading text-xl text-slate-900">
                {dashboard.lastAccessed.title || "Latest Course"}
              </h3>
              <p className="text-sm text-slate-500">
                {dashboard.lastAccessed.className || "Class"}{" "}
                {dashboard.lastAccessed.batchCode ? `- ${dashboard.lastAccessed.batchCode}` : ""}
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <div className="h-2 w-44 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, toNumber(dashboard.lastAccessed.progress, 0))
                      )}%`,
                    }}
                  />
                </div>
                {Math.round(toNumber(dashboard.lastAccessed.progress, 0))}%
              </div>
            </div>
            <Link className="btn-primary px-6 py-3" to="/student/courses">
              Continue Learning
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-slate-200 p-5">
            <div>
              <h3 className="font-heading text-lg text-slate-900">No enrolled class yet</h3>
              <p className="text-sm text-slate-500">
                Enroll in a class to access all assigned courses.
              </p>
            </div>
            <Link className="btn-outline px-6 py-3" to="/student/explore">
              Explore Classes
            </Link>
          </div>
        )}
      </Motion.section>

      <Motion.section {...fadeUp} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xl text-slate-900">My Classes</h3>
          <Link className="text-sm font-semibold text-primary" to="/student/courses">
            View All
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={`class-skel-${index}`} />
              ))
            : classCards.map((classItem, index) => {
                const progress = Math.max(0, Math.min(100, toNumber(classItem.overallProgress, 0)));
                const nextSession = topSessions.find(
                  (session) => (session.classId || "") === (classItem.classId || classItem.id || "")
                );
                return (
                  <div
                    key={classItem.classId || classItem.id || `${classItem.name}-${index}`}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h4 className="font-heading text-lg text-slate-900">
                      {classItem.name || "Class"}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      {classItem.batchCode || "No batch code"} - {classItem.teacherName || "Teacher"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(classItem.courses || []).slice(0, 3).map((course) => (
                        <span
                          key={`${classItem.classId}-${course.courseId}`}
                          className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600"
                        >
                          {course.title || "Course"}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <div className="h-2 w-28 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${progress}%` }} />
                      </div>
                      {Math.round(progress)}%
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      Next session:{" "}
                      {nextSession
                        ? `${formatDisplayDate(nextSession.date)} ${nextSession.startTime || "-"}-${nextSession.endTime || "-"}`
                        : "Not scheduled"}
                    </p>

                    <Link
                      className="mt-4 inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                      to="/student/courses"
                    >
                      View Class
                    </Link>
                  </div>
                );
              })}
        </div>

        {!isLoading && classCards.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
            No enrolled classes yet.
          </div>
        )}
      </Motion.section>

      <Motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h3 className="font-heading text-xl text-slate-900">Upcoming Sessions</h3>
        <div className="mt-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={`session-skel-${index}`} className="h-16 w-full rounded-2xl" />
            ))
          ) : topSessions.length > 0 ? (
            topSessions.map((session, index) => (
              <div
                key={session.id || `${session.topic}-${index}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <p className="font-semibold text-slate-900">
                  {session.className || "Class"} - {session.topic || "Session"}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDisplayDate(session.date)} - {session.startTime || "-"} to {session.endTime || "-"}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No upcoming sessions.
            </div>
          )}
        </div>
      </Motion.section>

      <Motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h3 className="font-heading text-xl text-slate-900">Recent Announcements</h3>
        <div className="mt-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={`ann-skel-${index}`} className="h-14 w-full rounded-xl" />
            ))
          ) : topAnnouncements.length > 0 ? (
            topAnnouncements.map((item, index) => (
              <div
                key={item.id || `${item.title}-${index}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <p className="font-semibold text-slate-900">{item.title || "Announcement"}</p>
                <p className="mt-1 text-xs text-slate-500">{item.message || ""}</p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No announcements right now.
            </div>
          )}
        </div>
      </Motion.section>
    </div>
  );
}

export default StudentDashboard;
