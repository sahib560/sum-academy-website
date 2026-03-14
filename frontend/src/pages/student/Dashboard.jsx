import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Skeleton, SkeletonCard } from "../../components/Skeleton.jsx";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const quotes = [
  "Small steps every day lead to big results.",
  "Your future is created by what you do today.",
  "Consistency beats intensity. Keep learning.",
  "Focus on progress, not perfection.",
  "Your effort today is your success tomorrow.",
];

const summaryCards = [
  {
    label: "Enrolled Courses",
    value: 6,
    color: "border-blue-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M6 4h11a3 3 0 0 1 3 3v12a2 2 0 0 1-2 2H7a3 3 0 0 0-3 3V7a3 3 0 0 1 2-3z" />
      </svg>
    ),
  },
  {
    label: "Completed Courses",
    value: 2,
    color: "border-emerald-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14-4-4 1.4-1.4L11 12.2l4.6-4.6L17 9l-6 7z" />
      </svg>
    ),
  },
  {
    label: "Certificates Earned",
    value: 1,
    color: "border-orange-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2a6 6 0 0 1 6 6c0 2.2-1.2 4.2-3 5.2V22l-3-1.6L9 22v-8.8A6 6 0 0 1 12 2z" />
      </svg>
    ),
  },
];

const continueCourse = {
  title: "Biology Masterclass XI",
  teacher: "Mr. Sikander Ali Qureshi",
  progress: 62,
  nextLecture: "Human Physiology Overview",
};

const courses = [
  {
    id: 1,
    title: "Biology Masterclass XI",
    teacher: "Mr. Sikander Ali Qureshi",
    progress: 62,
    status: "In Progress",
  },
  {
    id: 2,
    title: "Chemistry Quick Revision",
    teacher: "Mr. Mansoor Ahmed Mangi",
    progress: 100,
    status: "Completed",
  },
  {
    id: 3,
    title: "Physics Practice Lab",
    teacher: "Mr. Muhammad Idress Mahar",
    progress: 0,
    status: "Locked",
  },
  {
    id: 4,
    title: "English Essay Clinic",
    teacher: "Mr. Waseem Ahmed Soomro",
    progress: 44,
    status: "In Progress",
  },
  {
    id: 5,
    title: "Entrance Test Sprint",
    teacher: "Mr. Shah Mohammad Pathan",
    progress: 76,
    status: "In Progress",
  },
  {
    id: 6,
    title: "Pre-Medical Crash Course",
    teacher: "Mr. Mansoor Ahmed Mangi",
    progress: 0,
    status: "Locked",
  },
];

const deadlines = {
  installments: [
    { id: 1, amount: 1200, due: "2026-03-15", status: "due-soon" },
    { id: 2, amount: 1500, due: "2026-03-20", status: "ok" },
    { id: 3, amount: 900, due: "2026-03-08", status: "overdue" },
  ],
  quizzes: [
    {
      id: 1,
      name: "Genetics Quiz",
      course: "Biology Masterclass XI",
      due: "2026-03-17",
    },
  ],
  sessions: [
    {
      id: 1,
      name: "Batch A - Biology XI",
      date: "Mar 18, 2026",
      time: "5:00 PM",
    },
  ],
};

const announcements = [
  {
    id: 1,
    title: "Live revision session tomorrow",
    source: "Batch A - Biology XI",
    date: "Mar 14, 2026",
    unread: true,
  },
  {
    id: 2,
    title: "Worksheet uploaded in Module 3",
    source: "Chemistry Quick Revision",
    date: "Mar 12, 2026",
    unread: true,
  },
  {
    id: 3,
    title: "Essay topics list updated",
    source: "English Essay Clinic",
    date: "Mar 10, 2026",
    unread: false,
  },
];

const recommended = [
  {
    id: 1,
    title: "Advanced Biology MCQs",
    teacher: "Mr. Sikander Ali Qureshi",
    price: 2500,
    rating: 4.8,
  },
  {
    id: 2,
    title: "Organic Chemistry Drill",
    teacher: "Mr. Mansoor Ahmed Mangi",
    price: 2200,
    rating: 4.6,
  },
  {
    id: 3,
    title: "Physics Numericals",
    teacher: "Mr. Muhammad Idress Mahar",
    price: 2000,
    rating: 4.7,
  },
  {
    id: 4,
    title: "English Grammar Bootcamp",
    teacher: "Mr. Waseem Ahmed Soomro",
    price: 1800,
    rating: 4.5,
  },
];

const statusStyles = {
  "In Progress": "bg-blue-50 text-blue-600",
  Completed: "bg-emerald-50 text-emerald-600",
  Locked: "bg-slate-100 text-slate-500",
};

function StudentDashboard() {
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState(quotes[0]);

  useEffect(() => {
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
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
        <h2 className="font-heading text-2xl text-slate-900">
          Welcome back, Sana!
        </h2>
        <p className="mt-2 text-sm text-slate-500">{quote}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
            🔥 5 day streak — keep it up!
          </span>
          <span>{today}</span>
        </div>
      </motion.section>

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={`summary-${index}`} className="glass-card border border-slate-200">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-4 h-8 w-1/2" />
              </div>
            ))
          : summaryCards.map((card) => (
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
      </motion.section>

      <motion.section {...fadeUp} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="flex flex-wrap items-center gap-6">
            <div className="h-28 w-40 rounded-2xl bg-gradient-to-br from-blue-400/70 to-blue-100" />
            <div className="flex-1 space-y-2">
              <h3 className="font-heading text-xl text-slate-900">
                {continueCourse.title}
              </h3>
              <p className="text-sm text-slate-500">
                {continueCourse.teacher}
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <div className="h-2 w-40 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${continueCourse.progress}%` }}
                  />
                </div>
                {continueCourse.progress}%
              </div>
              <p className="inline-flex items-center gap-2 text-sm text-slate-500">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M8 5v14l11-7-11-7z" />
                </svg>
                Next lecture: {continueCourse.nextLecture}
              </p>
            </div>
            <button className="btn-primary px-6 py-3">Continue Learning</button>
          </div>
        )}
      </motion.section>

      <motion.section {...fadeUp} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xl text-slate-900">My Courses</h3>
          <Link className="text-sm font-semibold text-primary" to="/student/courses">
            View All
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={`course-skel-${index}`} />
              ))
            : courses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="h-24 rounded-2xl bg-slate-100" />
                  <h4
                    className="mt-4 font-heading text-lg text-slate-900"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {course.title}
                  </h4>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {course.teacher
                        .split(" ")
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")}
                    </span>
                    {course.teacher}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <div className="h-2 w-24 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                    {course.progress}%
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        statusStyles[course.status]
                      }`}
                    >
                      {course.status}
                    </span>
                    <button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                      {course.status === "Completed"
                        ? "View Certificate"
                        : "Continue"}
                    </button>
                  </div>
                </div>
              ))}
        </div>
      </motion.section>

      <motion.section {...fadeUp} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-heading text-xl text-slate-900">Upcoming Deadlines</h3>
        {loading ? (
          <Skeleton className="mt-4 h-24 w-full" />
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">Installments</p>
              <div className="mt-2 space-y-2">
                {deadlines.installments.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-wrap items-center justify-between rounded-2xl border px-4 py-2 text-sm ${
                      item.status === "overdue"
                        ? "border-rose-200 bg-rose-50 text-rose-600"
                        : item.status === "due-soon"
                          ? "border-amber-200 bg-amber-50 text-amber-600"
                          : "border-emerald-200 bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    <span>PKR {item.amount} · Due {item.due}</span>
                    <button className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                      Pay Now
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Quizzes</p>
              <div className="mt-2 space-y-2">
                {deadlines.quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600"
                  >
                    <span>
                      {quiz.name} · {quiz.course}
                    </span>
                    <span>Due {quiz.due}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Live Sessions</p>
              <div className="mt-2 space-y-2">
                {deadlines.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600"
                  >
                    <span>
                      {session.name} · {session.date} · {session.time}
                    </span>
                    <button className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                      Join
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.section>

      <motion.section {...fadeUp} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xl text-slate-900">Recent Announcements</h3>
          <Link className="text-sm font-semibold text-primary" to="/student/announcements">
            View All Announcements
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            announcements.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    {item.source} · {item.date}
                  </p>
                </div>
                {item.unread && <span className="h-2 w-2 rounded-full bg-primary" />}
              </div>
            ))
          )}
        </div>
      </motion.section>

      <motion.section {...fadeUp} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xl text-slate-900">Recommended Courses</h3>
        </div>
        <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={`rec-${index}`} className="h-40 w-56 rounded-2xl" />
              ))
            : recommended.map((course) => (
                <div
                  key={course.id}
                  className="min-w-[220px] rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="h-20 rounded-xl bg-slate-100" />
                  <p className="mt-3 font-semibold text-slate-900">{course.title}</p>
                  <p className="text-xs text-slate-500">{course.teacher}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>PKR {course.price}</span>
                    <span>⭐ {course.rating}</span>
                  </div>
                </div>
              ))}
          {!loading && (
            <div className="flex min-w-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 p-4">
              <button className="btn-outline">Explore More Courses</button>
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}

export default StudentDashboard;
