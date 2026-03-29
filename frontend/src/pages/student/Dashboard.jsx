import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion as Motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FiAward, FiBookOpen, FiCheckCircle } from "react-icons/fi";
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

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const getLearningStreak = (lastLoginAt) => {
  const parsed = parseDate(lastLoginAt);
  if (!parsed) return 1;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = new Date(parsed);
  last.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - last.getTime()) / 86400000);
  if (diffDays <= 0) return 1;
  if (diffDays === 1) return 2;
  return 1;
};

const formatDisplayDate = (value, options) => {
  const parsed = parseDate(value);
  if (!parsed) return "-";
  return parsed.toLocaleDateString("en-US", options);
};

const formatSessionTime = (startTime = "", endTime = "") => {
  const safeStart = String(startTime || "").trim();
  const safeEnd = String(endTime || "").trim();
  if (!safeStart && !safeEnd) return "Time not set";
  if (!safeEnd) return safeStart;
  return `${safeStart} - ${safeEnd}`;
};

const capitalize = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  return `${text[0].toUpperCase()}${text.slice(1)}`;
};

const getAnnouncementSource = (item = {}) => {
  if (item.source) return String(item.source);
  if (item.targetType) return `${capitalize(item.targetType)} Update`;
  return "Announcement";
};

const normalizeDashboard = (raw = {}, fallbackName = "Student") => {
  const profile = raw.profile || {};
  const stats = raw.stats || {};
  const courses = Array.isArray(raw.enrolledCourses)
    ? raw.enrolledCourses
    : Array.isArray(raw.courses)
      ? raw.courses
      : [];
  const announcements = Array.isArray(raw.recentAnnouncements)
    ? raw.recentAnnouncements
    : Array.isArray(raw.announcements)
      ? raw.announcements
      : [];
  const upcomingSessions = Array.isArray(raw.upcomingSessions)
    ? raw.upcomingSessions
    : [];
  const lastAccessedCourse = raw.lastAccessedCourse || null;
  const nextInstallment = raw.nextInstallment || null;
  const attendanceSummary =
    raw.attendanceSummary && typeof raw.attendanceSummary === "object"
      ? raw.attendanceSummary
      : {};

  const enrolledCount = Math.max(
    0,
    toNumber(stats.enrolledCount, toNumber(raw.enrolledCount, courses.length))
  );
  const completedCount = Math.max(
    0,
    toNumber(
      stats.completedCount,
      toNumber(
        raw.completedCount,
        courses.filter((course) => toNumber(course.progress, 0) >= 100).length
      )
    )
  );
  const certificatesCount = Math.max(
    0,
    toNumber(
      stats.certificatesCount,
      toNumber(
        raw.certificatesCount,
        Array.isArray(raw.certificates) ? raw.certificates.length : 0
      )
    )
  );

  const fullName =
    profile.fullName || raw.fullName || fallbackName || "Student";

  const resolvedLastAccessed = lastAccessedCourse
    ? {
        ...lastAccessedCourse,
        ...courses.find(
          (course) =>
            (course.courseId || course.id) ===
            (lastAccessedCourse.courseId || lastAccessedCourse.id)
        ),
      }
    : null;

  return {
    fullName,
    lastLoginAt: profile.lastLoginAt || raw.lastLoginAt || null,
    profileDetails: {
      phoneNumber: profile.phoneNumber || "",
      fatherName: profile.fatherName || "",
      fatherPhone: profile.fatherPhone || "",
      fatherOccupation: profile.fatherOccupation || "",
      address: profile.address || "",
      district: profile.district || "",
      domicile: profile.domicile || "",
      caste: profile.caste || "",
    },
    enrolledCount,
    completedCount,
    certificatesCount,
    courses,
    announcements,
    upcomingSessions,
    lastAccessedCourse: resolvedLastAccessed,
    nextInstallment,
    attendanceSummary: {
      currentStreak: toNumber(attendanceSummary.currentStreak, 0),
      longestStreak: toNumber(attendanceSummary.longestStreak, 0),
      attendancePercent: toNumber(attendanceSummary.attendancePercent, 0),
      learningDaysElapsed: toNumber(attendanceSummary.learningDaysElapsed, 0),
      courseDurationDays: toNumber(attendanceSummary.courseDurationDays, 0),
      learningDayProgress:
        attendanceSummary.learningDayProgress === null ||
        attendanceSummary.learningDayProgress === undefined
          ? null
          : toNumber(attendanceSummary.learningDayProgress, null),
    },
  };
};

function StudentDashboard() {
  const { userProfile } = useAuth();
  const fallbackName =
    userProfile?.name ||
    userProfile?.fullName ||
    userProfile?.email ||
    "Student";

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["student-dashboard"],
    queryFn: () => getStudentDashboard(),
    staleTime: 30000,
  });

  const dashboard = useMemo(
    () => normalizeDashboard(data || {}, fallbackName),
    [data, fallbackName]
  );

  const firstName = String(dashboard.fullName).split(" ")[0] || "Student";
  const greeting = getGreeting();
  const streakDays = Math.max(
    0,
    toNumber(
      dashboard.attendanceSummary.currentStreak,
      getLearningStreak(dashboard.lastLoginAt)
    )
  );
  const learningDaysElapsed = toNumber(
    dashboard.attendanceSummary.learningDaysElapsed,
    0
  );
  const courseDurationDays = toNumber(
    dashboard.attendanceSummary.courseDurationDays,
    0
  );
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

  const profileRows = [
    { label: "Phone", value: dashboard.profileDetails.phoneNumber },
    { label: "Father Name", value: dashboard.profileDetails.fatherName },
    { label: "Father Phone", value: dashboard.profileDetails.fatherPhone },
    { label: "Father Occupation", value: dashboard.profileDetails.fatherOccupation },
    { label: "District", value: dashboard.profileDetails.district },
    { label: "Domicile", value: dashboard.profileDetails.domicile },
    { label: "Caste", value: dashboard.profileDetails.caste },
    { label: "Address", value: dashboard.profileDetails.address },
  ];

  const cards = [
    {
      label: "Enrolled Courses",
      value: dashboard.enrolledCount,
      color: "border-blue-500",
      icon: <FiBookOpen className="h-5 w-5" />,
    },
    {
      label: "Completed Courses",
      value: dashboard.completedCount,
      color: "border-emerald-500",
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
    {
      label: "Certificates Earned",
      value: dashboard.certificatesCount,
      color: "border-orange-500",
      icon: <FiAward className="h-5 w-5" />,
    },
  ];

  const topCourses = dashboard.courses.slice(0, 6);
  const topSessions = dashboard.upcomingSessions.slice(0, 3);
  const topAnnouncements = dashboard.announcements.slice(0, 3);

  const installmentDueDate = parseDate(dashboard.nextInstallment?.dueDate);
  const installmentState = useMemo(() => {
    if (!installmentDueDate) return "none";
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dueStart = new Date(installmentDueDate);
    dueStart.setHours(0, 0, 0, 0);
    const diffDays = Math.floor(
      (dueStart.getTime() - todayStart.getTime()) / 86400000
    );
    if (diffDays < 0) return "overdue";
    if (diffDays <= 3) return "due-soon";
    return "normal";
  }, [installmentDueDate]);

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
            <div className="flex flex-wrap gap-3 pt-1">
              <Skeleton className="h-8 w-44 rounded-full" />
              <Skeleton className="h-8 w-56 rounded-full" />
            </div>
          </div>
        ) : (
          <>
            <h2 className="font-heading text-2xl text-slate-900">
              {greeting}, {firstName}
            </h2>
            <p className="mt-2 text-sm text-slate-500">{today}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                {streakDays} day learning streak
              </span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                Learning days:{" "}
                {courseDurationDays > 0
                  ? `${learningDaysElapsed}/${courseDurationDays}`
                  : `${learningDaysElapsed}`}
              </span>
              <span>
                Last login:{" "}
                {dashboard.lastLoginAt
                  ? formatDisplayDate(dashboard.lastLoginAt, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "N/A"}
              </span>
            </div>
          </>
        )}
      </Motion.section>

      <Motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading text-xl text-slate-900">Profile Details</h3>
          <Link className="text-sm font-semibold text-primary" to="/student/settings">
            Edit Profile
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {isLoading
            ? Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={`profile-skel-${index}`} className="h-14 w-full rounded-xl" />
              ))
            : profileRows.map((row) => (
                <div
                  key={row.label}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                    {row.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {String(row.value || "").trim() || "-"}
                  </p>
                </div>
              ))}
        </div>
      </Motion.section>

      {isError && (
        <Motion.section
          {...fadeUp}
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <p>
            Failed to load dashboard data
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
              <div
                key={`summary-${index}`}
                className="glass-card border border-slate-200"
              >
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
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {card.value}
                </p>
              </div>
            ))}
      </Motion.section>

      <Motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {isLoading ? (
          <Skeleton className="h-36 w-full rounded-2xl" />
        ) : dashboard.lastAccessedCourse ? (
          <div className="flex flex-wrap items-center gap-6">
            <div className="h-28 w-44 overflow-hidden rounded-2xl bg-slate-100">
              {dashboard.lastAccessedCourse.thumbnail ? (
                <img
                  src={dashboard.lastAccessedCourse.thumbnail}
                  alt={dashboard.lastAccessedCourse.title || "Course thumbnail"}
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
                {dashboard.lastAccessedCourse.title || "Latest Course"}
              </h3>
              <p className="text-sm text-slate-500">
                {dashboard.lastAccessedCourse.teacherName || "Teacher"}
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <div className="h-2 w-44 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, toNumber(dashboard.lastAccessedCourse.progress, 0))
                      )}%`,
                    }}
                  />
                </div>
                {Math.round(toNumber(dashboard.lastAccessedCourse.progress, 0))}%
              </div>
              <p className="text-sm text-slate-500">
                Next lecture:{" "}
                {dashboard.lastAccessedCourse.nextLecture || "Resume from your last activity"}
              </p>
            </div>
            <Link className="btn-primary px-6 py-3" to="/student/courses">
              Continue Learning
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-slate-200 p-5">
            <div>
              <h3 className="font-heading text-lg text-slate-900">
                No active course yet
              </h3>
              <p className="text-sm text-slate-500">
                Start a new course and keep your learning moving.
              </p>
            </div>
            <Link className="btn-outline px-6 py-3" to="/student/explore">
              Explore Courses
            </Link>
          </div>
        )}
      </Motion.section>

      <Motion.section {...fadeUp} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xl text-slate-900">My Courses</h3>
          <Link className="text-sm font-semibold text-primary" to="/student/courses">
            View All
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={`course-skel-${index}`} />
              ))
            : topCourses.map((course, index) => {
                const progress = Math.max(
                  0,
                  Math.min(100, toNumber(course.progress, 0))
                );
                const isCompleted = progress >= 100;
                const badgeClass = isCompleted
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-blue-50 text-blue-600";

                return (
                  <div
                    key={course.id || course.courseId || `${course.title}-${index}`}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="h-24 overflow-hidden rounded-2xl bg-slate-100">
                      {course.thumbnail ? (
                        <img
                          src={course.thumbnail}
                          alt={course.title || "Course thumbnail"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-xs font-semibold text-slate-500">
                          Course
                        </div>
                      )}
                    </div>

                    <h4
                      className="mt-4 font-heading text-lg text-slate-900"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {course.title || "Course"}
                    </h4>

                    <p className="mt-2 text-xs text-slate-500">
                      {course.teacherName || "Teacher"}
                    </p>

                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <div className="h-2 w-28 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      {Math.round(progress)}%
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}
                      >
                        {isCompleted ? "Completed" : "In Progress"}
                      </span>
                      <Link
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                        to={isCompleted ? "/student/certificates" : "/student/courses"}
                      >
                        {isCompleted ? "View Certificate" : "Continue"}
                      </Link>
                    </div>
                  </div>
                );
              })}
        </div>

        {!isLoading && topCourses.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
            No enrolled courses yet.
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
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {session.className || "Class"} - {session.topic || "Session"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDisplayDate(session.date, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    - {formatSessionTime(session.startTime, session.endTime)}
                  </p>
                </div>
                {session.meetingLink ? (
                  <a
                    href={session.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary"
                  >
                    Join
                  </a>
                ) : (
                  <button
                    className="cursor-not-allowed rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-400"
                    disabled
                  >
                    No Link
                  </button>
                )}
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
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xl text-slate-900">
            Recent Announcements
          </h3>
          <Link className="text-sm font-semibold text-primary" to="/student/announcements">
            View All
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={`ann-skel-${index}`} className="h-14 w-full rounded-xl" />
            ))
          ) : topAnnouncements.length > 0 ? (
            topAnnouncements.map((item, index) => (
              <div
                key={item.id || `${item.title}-${index}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {item.title || "Announcement"}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                      {getAnnouncementSource(item)}
                    </span>
                    <span>
                      {formatDisplayDate(item.createdAt, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                {item.isRead === false && (
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                )}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No announcements right now.
            </div>
          )}
        </div>
      </Motion.section>

      <Motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h3 className="font-heading text-xl text-slate-900">Upcoming Deadlines</h3>
        <div className="mt-4">
          {isLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : dashboard.nextInstallment ? (
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-4 ${
                installmentState === "overdue"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : installmentState === "due-soon"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  Next installment: PKR{" "}
                  {toNumber(dashboard.nextInstallment.amount, 0).toLocaleString()}
                </p>
                <p className="text-xs">
                  Due{" "}
                  {formatDisplayDate(dashboard.nextInstallment.dueDate, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                  {installmentState === "overdue" ? " (Overdue)" : ""}
                  {installmentState === "due-soon" ? " (Due soon)" : ""}
                </p>
              </div>
              <Link
                className="rounded-full border border-current px-4 py-2 text-xs font-semibold"
                to="/student/payments"
              >
                Pay Now
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No upcoming deadlines.
            </div>
          )}
        </div>
      </Motion.section>
    </div>
  );
}

export default StudentDashboard;



