import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Skeleton, SkeletonCard } from "../../components/Skeleton.jsx";

const quickActions = [
  {
    label: "Upload Video",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M4 5h10a2 2 0 0 1 2 2v2.4l4-2.4v10l-4-2.4V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      </svg>
    ),
  },
  {
    label: "Create Quiz",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm2 4h6v2H9V8zm0 4h6v2H9v-2z" />
      </svg>
    ),
  },
  {
    label: "Schedule Session",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M7 2h2v3H7V2zm8 0h2v3h-2V2zM4 6h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 4v10h16V10H4z" />
      </svg>
    ),
  },
  {
    label: "Post Announcement",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M3 11h3l8-5v14l-8-5H3v-4zm15.5 1a3.5 3.5 0 0 0-1.2-2.6V14.6A3.5 3.5 0 0 0 18.5 12z" />
      </svg>
    ),
  },
];

const statsConfig = [
  {
    label: "My Courses",
    value: 8,
    suffix: "",
    color: "border-blue-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M6 4h11a3 3 0 0 1 3 3v12a2 2 0 0 1-2 2H7a3 3 0 0 0-3 3V7a3 3 0 0 1 2-3z" />
      </svg>
    ),
  },
  {
    label: "Total My Students",
    value: 560,
    suffix: "",
    color: "border-emerald-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M7 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm10 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM2 20a5 5 0 0 1 10 0H2zm12 0a4 4 0 0 1 8 0h-8z" />
      </svg>
    ),
  },
  {
    label: "Avg Completion Rate",
    value: 86,
    suffix: "%",
    color: "border-orange-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M4 19h16v2H2V3h2v16zm4-2H6V9h2v8zm6 0h-2V5h2v12zm6 0h-2v-6h2v6z" />
      </svg>
    ),
  },
  {
    label: "Pending Quiz Reviews",
    value: 12,
    suffix: "",
    color: "border-purple-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm2 4h6v2H9V8zm0 4h6v2H9v-2z" />
      </svg>
    ),
  },
];

const courses = [
  {
    id: 1,
    title: "Biology Masterclass XI",
    enrolled: 180,
    completion: 78,
    status: "Published",
  },
  {
    id: 2,
    title: "Chemistry Quick Revision",
    enrolled: 142,
    completion: 83,
    status: "Published",
  },
  {
    id: 3,
    title: "Physics Practice Lab",
    enrolled: 112,
    completion: 71,
    status: "Draft",
  },
  {
    id: 4,
    title: "English Essay Clinic",
    enrolled: 95,
    completion: 65,
    status: "Published",
  },
  {
    id: 5,
    title: "Entrance Test Sprint",
    enrolled: 203,
    completion: 88,
    status: "Published",
  },
];

const activities = [
  {
    id: 1,
    name: "Ayesha Noor",
    action: "New enrollment",
    course: "Biology Masterclass XI",
    time: "2 mins ago",
  },
  {
    id: 2,
    name: "Bilal Khan",
    action: "Quiz submitted",
    course: "Chemistry Quick Revision",
    time: "12 mins ago",
  },
  {
    id: 3,
    name: "Hina Sheikh",
    action: "Course completed",
    course: "Entrance Test Sprint",
    time: "25 mins ago",
  },
  {
    id: 4,
    name: "Usman Raza",
    action: "Video unlock request",
    course: "Physics Practice Lab",
    time: "40 mins ago",
  },
  {
    id: 5,
    name: "Mariam Bukhari",
    action: "New enrollment",
    course: "English Essay Clinic",
    time: "1 hour ago",
  },
  {
    id: 6,
    name: "Sana Akbar",
    action: "Quiz submitted",
    course: "Biology Masterclass XI",
    time: "2 hours ago",
  },
  {
    id: 7,
    name: "Hassan Ali",
    action: "Course completed",
    course: "Chemistry Quick Revision",
    time: "3 hours ago",
  },
  {
    id: 8,
    name: "Ayesha Noor",
    action: "Video unlock request",
    course: "Biology Masterclass XI",
    time: "4 hours ago",
  },
];

const sessions = [
  {
    id: 1,
    title: "Batch A - Biology Live Review",
    date: "Mar 15, 2026",
    time: "5:00 PM",
  },
  {
    id: 2,
    title: "Batch B - Chemistry Drill",
    date: "Mar 16, 2026",
    time: "6:30 PM",
  },
  {
    id: 3,
    title: "Batch C - Physics Q and A",
    date: "Mar 18, 2026",
    time: "4:30 PM",
  },
];

const statusStyles = {
  Published: "bg-emerald-50 text-emerald-600",
  Draft: "bg-amber-50 text-amber-600",
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
      setValue(target);
      return;
    }
    let animationFrame;
    const start = performance.now();
    const duration = 1200;

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

function TeacherDashboard() {
  const [loading, setLoading] = useState(true);
  const teacherName = "Mr. Sikander Ali Qureshi";
  const countValues = [
    useCountUp(8, !loading),
    useCountUp(560, !loading),
    useCountUp(86, !loading),
    useCountUp(12, !loading),
  ];

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

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
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="group inline-flex items-center gap-2 rounded-full border border-primary/40 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
            >
              <span className="transition group-hover:text-white">
                {action.icon}
              </span>
              {action.label}
            </button>
          ))}
        </div>
      </motion.section>

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={`stat-${index}`} />
            ))
          : statsConfig.map((stat, index) => {
              const count = countValues[index] ?? stat.value;
              return (
                <div
                  key={stat.label}
                  className={`glass-card border-l-4 ${stat.color}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <div className="text-slate-400">{stat.icon}</div>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">
                    {count}
                    {stat.suffix}
                  </p>
                </div>
              );
            })}
      </motion.section>

      <motion.section {...fadeUp} className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl text-slate-900">My Courses</h2>
          </div>
          <div className="mt-4 space-y-3">
            {loading
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
              : courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-16 rounded-xl bg-slate-200" />
                      <div>
                        <p className="font-semibold text-slate-900">{course.title}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                            {course.enrolled} enrolled
                          </span>
                          <span>{course.completion}% completion</span>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${course.completion}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        statusStyles[course.status]
                      }`}
                    >
                      {course.status}
                    </span>
                  </div>
                ))}
          </div>
          <div className="mt-4 text-right">
            <Link className="text-sm font-semibold text-primary" to="/teacher/courses">
              View All
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl text-slate-900">
              Recent Student Activity
            </h2>
          </div>
          <div className="mt-4 space-y-3">
            {loading
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
              : activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {activity.name
                          .split(" ")
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {activity.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {activity.action} - {activity.course}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{activity.time}</span>
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
          <button className="btn-outline">Schedule Session</button>
        </div>
        <div className="mt-4 space-y-3">
          {loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={`session-skeleton-${index}`} className="h-16 w-full" />
              ))
            : sessions.length === 0
              ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    <p>No upcoming sessions.</p>
                    <button className="btn-outline mt-3">Schedule Session</button>
                  </div>
                )
              : sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{session.title}</p>
                      <p className="text-xs text-slate-500">
                        {session.date} - {session.time}
                      </p>
                    </div>
                    <button className="btn-outline">Join</button>
                  </div>
                ))}
        </div>
      </motion.section>
    </div>
  );
}

export default TeacherDashboard;
