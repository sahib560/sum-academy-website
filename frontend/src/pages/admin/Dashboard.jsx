import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const kpis = [
  {
    label: "Total Students",
    value: 12500,
    change: 12.4,
    trend: "up",
    color: "text-primary",
    icon: "users",
  },
  {
    label: "Total Revenue PKR",
    value: 4265000,
    change: 8.1,
    trend: "up",
    color: "text-emerald-500",
    icon: "trend",
  },
  {
    label: "Active Courses",
    value: 86,
    change: -3.2,
    trend: "down",
    color: "text-accent",
    icon: "book",
  },
  {
    label: "Enrollments Today",
    value: 142,
    change: 5.6,
    trend: "up",
    color: "text-purple-500",
    icon: "user-plus",
  },
];

const chartData = {
  "7 Days": [
    { name: "Mon", revenue: 520000 },
    { name: "Tue", revenue: 610000 },
    { name: "Wed", revenue: 480000 },
    { name: "Thu", revenue: 710000 },
    { name: "Fri", revenue: 690000 },
    { name: "Sat", revenue: 760000 },
    { name: "Sun", revenue: 820000 },
  ],
  "30 Days": [
    { name: "Week 1", revenue: 2100000 },
    { name: "Week 2", revenue: 2480000 },
    { name: "Week 3", revenue: 2320000 },
    { name: "Week 4", revenue: 2700000 },
  ],
  "3 Months": [
    { name: "Jan", revenue: 8200000 },
    { name: "Feb", revenue: 7600000 },
    { name: "Mar", revenue: 9100000 },
  ],
};

const enrollments = [
  {
    name: "Hassan Ali",
    course: "Class XI - Pre-Medical",
    amount: 3500,
    date: "Mar 12, 2026",
    status: "Paid",
  },
  {
    name: "Ayesha Noor",
    course: "Pre-Entrance Test",
    amount: 4200,
    date: "Mar 12, 2026",
    status: "Pending",
  },
  {
    name: "Bilal Khan",
    course: "Class XII - Pre-Medical",
    amount: 3800,
    date: "Mar 11, 2026",
    status: "Paid",
  },
  {
    name: "Sana Akbar",
    course: "Pre-Entrance Test",
    amount: 4200,
    date: "Mar 11, 2026",
    status: "Failed",
  },
  {
    name: "Usman Raza",
    course: "Class XI - Pre-Medical",
    amount: 3500,
    date: "Mar 10, 2026",
    status: "Paid",
  },
];

const topCourses = [
  { name: "Class XI - Pre-Medical", enrolled: 420, revenue: 1470000 },
  { name: "Class XII - Pre-Medical", enrolled: 380, revenue: 1420000 },
  { name: "Pre-Entrance Test", enrolled: 310, revenue: 1300000 },
  { name: "Matric Biology Essentials", enrolled: 260, revenue: 850000 },
  { name: "English Language Fluency", enrolled: 210, revenue: 620000 },
];

const activityFeed = [
  {
    type: "enroll",
    text: "New enrollment: Ayesha Noor joined Pre-Entrance Test.",
    time: "2 mins ago",
  },
  {
    type: "payment",
    text: "Payment received from Hassan Ali (PKR 3,500).",
    time: "15 mins ago",
  },
  {
    type: "teacher",
    text: "New teacher added: Mr. Waseem Ahmed Soomro.",
    time: "1 hour ago",
  },
  {
    type: "course",
    text: "Course published: Chemistry Lab Workshop.",
    time: "2 hours ago",
  },
  {
    type: "certificate",
    text: "Certificate issued to Bilal Khan.",
    time: "3 hours ago",
  },
  {
    type: "enroll",
    text: "New enrollment: Usman Raza joined Class XI - Pre-Medical.",
    time: "5 hours ago",
  },
  {
    type: "payment",
    text: "Payment received from Sana Akbar (PKR 4,200).",
    time: "6 hours ago",
  },
  {
    type: "course",
    text: "Course updated: Class XII - Pre-Medical revision module.",
    time: "8 hours ago",
  },
  {
    type: "teacher",
    text: "Teacher profile updated: Mr. Mansoor Ahmed Mangi.",
    time: "1 day ago",
  },
  {
    type: "certificate",
    text: "Certificate issued to Ayesha Noor.",
    time: "1 day ago",
  },
];

const iconMap = {
  users: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M7 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm10 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM2 20a5 5 0 0 1 10 0H2zm12 0a4 4 0 0 1 8 0h-8z" />
    </svg>
  ),
  trend: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M3 17l6-6 4 4 7-7v4h2V4h-8v2h4l-5 5-4-4-7 7z" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M6 4h11a3 3 0 0 1 3 3v12a2 2 0 0 1-2 2H7a3 3 0 0 0-3 3V7a3 3 0 0 1 2-3z" />
    </svg>
  ),
  "user-plus": (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M15 14a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-9 6a6 6 0 0 1 9-5.2 6.4 6.4 0 0 0-.8 3.2V20H6zm12-4v-3h-2v3h-3v2h3v3h2v-3h3v-2z" />
    </svg>
  ),
  enroll: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm6 8H6a6 6 0 0 1 12 0z" />
    </svg>
  ),
  payment: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7zm3-1a1 1 0 0 0-1 1v2h16V7a1 1 0 0 0-1-1H6z" />
    </svg>
  ),
  teacher: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 3 1 9l11 6 9-4.9V17h2V9L12 3z" />
      <path d="M5 12.3v4.2c0 2.2 3.1 4 7 4s7-1.8 7-4v-4.2l-7 3.8-7-3.8z" />
    </svg>
  ),
  course: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M6 4h11a3 3 0 0 1 3 3v12a2 2 0 0 1-2 2H7a3 3 0 0 0-3 3V7a3 3 0 0 1 2-3z" />
    </svg>
  ),
  certificate: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 2a6 6 0 1 0 0 12A6 6 0 0 0 12 2zm-3 14h6l2 6-5-2-5 2 2-6z" />
    </svg>
  ),
};

function CountUp({ value }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = null;
    let frame;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / 1000, 1);
      setDisplay(Math.round(value * progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span>{display.toLocaleString()}</span>;
}

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7 Days");

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const maxEnroll = Math.max(...topCourses.map((course) => course.enrolled));

  return (
    <div className="space-y-8">
      <motion.div
        className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
      >
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={`kpi-skeleton-${index}`} className="glass-card">
                <div className="skeleton h-5 w-24" />
                <div className="mt-4 skeleton h-10 w-32" />
                <div className="mt-4 skeleton h-4 w-20" />
              </div>
            ))
          : kpis.map((kpi) => (
              <motion.div
                key={kpi.label}
                variants={fadeUp}
                className="glass-card card-hover flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-500">
                    {kpi.label}
                  </p>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 ${kpi.color}`}
                  >
                    {iconMap[kpi.icon]}
                  </div>
                </div>
                <p className="text-3xl font-semibold text-slate-900">
                  <CountUp value={kpi.value} />
                </p>
                <span
                  className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                    kpi.trend === "up"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-rose-50 text-rose-600"
                  }`}
                >
                  {kpi.trend === "up" ? "▲" : "▼"} {Math.abs(kpi.change)}%
                </span>
              </motion.div>
            ))}
      </motion.div>

      <div className="glass-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Revenue
            </p>
            <h2 className="mt-2 font-heading text-2xl text-slate-900">
              Revenue Overview
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(chartData).map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setRange(label)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  range === label
                    ? "bg-primary text-white"
                    : "border border-slate-200 text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 min-h-[18rem] w-full overflow-hidden">
          {loading ? (
            <div className="skeleton h-full w-full rounded-2xl" />
          ) : (
            <ResponsiveContainer width="100%" height={288}>
              <LineChart data={chartData[range]}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4a63f5" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4a63f5" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value / 1000}k`}
                />
                <Tooltip
                  formatter={(value) => [`PKR ${value.toLocaleString()}`, "Revenue"]}
                  contentStyle={{
                    borderRadius: "12px",
                    borderColor: "#e2e8f0",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#4a63f5"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  fill="url(#revenueFill)"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass-card">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xl text-slate-900">
              Recent Enrollments
            </h3>
            <button className="text-sm font-semibold text-primary">View All</button>
          </div>
          <div className="mt-6">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={`enroll-skeleton-${index}`} className="skeleton h-10 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-3 sm:hidden">
                  {enrollments.map((item) => (
                    <div
                      key={item.name}
                      className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-sm shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            item.status === "Paid"
                              ? "bg-emerald-50 text-emerald-600"
                              : item.status === "Pending"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-rose-50 text-rose-600"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-2 text-slate-600">{item.course}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>PKR {item.amount.toLocaleString()}</span>
                        <span>{item.date}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block">
                  <div className="overflow-x-auto">
                    <table className="min-w-[680px] text-left text-sm sm:min-w-full">
                      <thead className="text-xs uppercase text-slate-400">
                        <tr>
                          <th className="pb-3 whitespace-nowrap">Student Name</th>
                          <th className="pb-3">Course</th>
                          <th className="pb-3 whitespace-nowrap">Amount PKR</th>
                          <th className="pb-3 whitespace-nowrap">Date</th>
                          <th className="pb-3 whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-600">
                        {enrollments.map((item) => (
                          <tr key={item.name} className="border-t border-slate-100">
                            <td className="py-3 pr-3 font-semibold text-slate-900">
                              {item.name}
                            </td>
                            <td className="py-3 pr-4 text-slate-600">
                              {item.course}
                            </td>
                            <td className="py-3 whitespace-nowrap">
                              PKR {item.amount.toLocaleString()}
                            </td>
                            <td className="py-3 whitespace-nowrap">{item.date}</td>
                            <td className="py-3">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  item.status === "Paid"
                                    ? "bg-emerald-50 text-emerald-600"
                                    : item.status === "Pending"
                                    ? "bg-amber-50 text-amber-600"
                                    : "bg-rose-50 text-rose-600"
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="glass-card">
          <h3 className="font-heading text-xl text-slate-900">Top Courses</h3>
          <div className="mt-6 space-y-4">
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div key={`top-skeleton-${index}`} className="space-y-2">
                    <div className="skeleton h-4 w-3/4" />
                    <div className="skeleton h-2 w-full" />
                  </div>
                ))
              : topCourses.map((course, index) => (
                  <div key={course.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-900">
                        {index + 1}. {course.name}
                      </span>
                      <span className="text-slate-500">
                        {course.enrolled} enrolled
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{
                          width: `${(course.enrolled / maxEnroll) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs text-slate-500">
                      PKR {course.revenue.toLocaleString()}
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>

      <div className="glass-card">
        <h3 className="font-heading text-xl text-slate-900">Recent Activity</h3>
        <div className="mt-6 space-y-4">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div key={`activity-skeleton-${index}`} className="skeleton h-6 w-full" />
              ))
            : activityFeed.map((item, index) => (
                <div
                  key={`${item.text}-${index}`}
                  className="flex items-start gap-3 text-sm text-slate-600"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {iconMap[item.type]}
                  </span>
                  <div className="flex-1">
                    <p className="text-slate-700">{item.text}</p>
                    <p className="text-xs text-slate-400">{item.time}</p>
                  </div>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
