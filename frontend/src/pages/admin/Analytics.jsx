import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const quickRanges = ["Today", "7 Days", "30 Days", "3 Months", "1 Year"];
const revenueViews = ["Daily", "Weekly", "Monthly"];

const revenueSeries = {
  Today: [
    { name: "9 AM", value: 85000 },
    { name: "12 PM", value: 120000 },
    { name: "3 PM", value: 98000 },
    { name: "6 PM", value: 145000 },
    { name: "9 PM", value: 160000 },
  ],
  "7 Days": [
    { name: "Mon", value: 520000 },
    { name: "Tue", value: 610000 },
    { name: "Wed", value: 480000 },
    { name: "Thu", value: 710000 },
    { name: "Fri", value: 690000 },
    { name: "Sat", value: 760000 },
    { name: "Sun", value: 820000 },
  ],
  "30 Days": [
    { name: "Week 1", value: 2100000 },
    { name: "Week 2", value: 2480000 },
    { name: "Week 3", value: 2320000 },
    { name: "Week 4", value: 2700000 },
  ],
  "3 Months": [
    { name: "Jan", value: 8200000 },
    { name: "Feb", value: 7600000 },
    { name: "Mar", value: 9100000 },
  ],
  "1 Year": [
    { name: "Q1", value: 24500000 },
    { name: "Q2", value: 26700000 },
    { name: "Q3", value: 25200000 },
    { name: "Q4", value: 28900000 },
  ],
};

const revenueBreakdown = [
  { name: "JazzCash", percent: 42, color: "#ef4444" },
  { name: "EasyPaisa", percent: 33, color: "#10b981" },
  { name: "Bank Transfer", percent: 25, color: "#3b82f6" },
];

const enrollmentsByCourse = [
  { name: "Class XI - Pre-Medical", value: 420 },
  { name: "Class XII - Pre-Medical", value: 380 },
  { name: "Pre-Entrance Test", value: 310 },
  { name: "Chemistry Workshop", value: 240 },
  { name: "Physics Prep", value: 210 },
  { name: "English Fluency", value: 190 },
  { name: "Biology Essentials", value: 170 },
  { name: "Math Foundations", value: 150 },
  { name: "Computer Basics", value: 140 },
  { name: "Test Strategy", value: 120 },
];

const enrollmentsTrend = [
  { name: "Mon", value: 42 },
  { name: "Tue", value: 55 },
  { name: "Wed", value: 38 },
  { name: "Thu", value: 68 },
  { name: "Fri", value: 60 },
  { name: "Sat", value: 74 },
  { name: "Sun", value: 79 },
];

const activeStudents = [
  { name: "Mon", value: 920 },
  { name: "Tue", value: 980 },
  { name: "Wed", value: 860 },
  { name: "Thu", value: 1040 },
  { name: "Fri", value: 990 },
  { name: "Sat", value: 1120 },
  { name: "Sun", value: 1180 },
];

const studentGrowth = [
  { name: "Jan", value: 9800 },
  { name: "Feb", value: 10400 },
  { name: "Mar", value: 11200 },
  { name: "Apr", value: 12100 },
  { name: "May", value: 12500 },
];

const coursePerformance = [
  {
    name: "Class XI - Pre-Medical",
    teacher: "Mr. Sikander Ali Qureshi",
    enrolled: 420,
    completed: 360,
    rate: 86,
    revenue: 1470000,
    rating: 4.8,
  },
  {
    name: "Class XII - Pre-Medical",
    teacher: "Mr. Shah Mohammad Pathan",
    enrolled: 380,
    completed: 315,
    rate: 82,
    revenue: 1420000,
    rating: 4.7,
  },
  {
    name: "Pre-Entrance Test",
    teacher: "Mr. Muhammad Idress Mahar",
    enrolled: 310,
    completed: 250,
    rate: 81,
    revenue: 1300000,
    rating: 4.6,
  },
];

const teacherPerformance = [
  {
    name: "Mr. Sikander Ali Qureshi",
    courses: 5,
    students: 920,
    completion: 84,
    revenue: 2400000,
  },
  {
    name: "Mr. Shah Mohammad Pathan",
    courses: 4,
    students: 780,
    completion: 82,
    revenue: 1980000,
  },
  {
    name: "Mr. Muhammad Idress Mahar",
    courses: 3,
    students: 630,
    completion: 79,
    revenue: 1560000,
  },
];

function Analytics() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7 Days");
  const [view, setView] = useState("Daily");
  const [sortCourse, setSortCourse] = useState({ key: "revenue", dir: "desc" });
  const [sortTeacher, setSortTeacher] = useState({
    key: "revenue",
    dir: "desc",
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const sortedCoursePerformance = useMemo(() => {
    const sorted = [...coursePerformance].sort((a, b) => {
      const valueA = a[sortCourse.key];
      const valueB = b[sortCourse.key];
      if (valueA < valueB) return sortCourse.dir === "asc" ? -1 : 1;
      if (valueA > valueB) return sortCourse.dir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [sortCourse]);

  const sortedTeacherPerformance = useMemo(() => {
    const sorted = [...teacherPerformance].sort((a, b) => {
      const valueA = a[sortTeacher.key];
      const valueB = b[sortTeacher.key];
      if (valueA < valueB) return sortTeacher.dir === "asc" ? -1 : 1;
      if (valueA > valueB) return sortTeacher.dir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [sortTeacher]);

  const totalRevenue = revenueSeries[range].reduce((sum, item) => sum + item.value, 0);
  const breakdownData = useMemo(
    () =>
      revenueBreakdown.map((entry) => ({
        ...entry,
        amount: Math.round((entry.percent / 100) * totalRevenue),
      })),
    [totalRevenue]
  );

  const exportReport = () => {
    const rows = [
      ["Metric", "Value"],
      ["Total Revenue", totalRevenue],
      ["Range", range],
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sum-academy-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-3xl text-slate-900">Analytics & Reports</h2>
            <p className="text-sm text-slate-500">
              Track revenue, enrollments, and growth metrics.
            </p>
          </div>
          <button className="btn-outline" onClick={exportReport}>
            Export Report
          </button>
        </div>

      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="glass-card space-y-4"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {quickRanges.map((item) => (
              <button
                key={item}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  range === item
                    ? "bg-primary text-white"
                    : "border border-slate-200 text-slate-600"
                }`}
                onClick={() => setRange(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full min-w-[140px] flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm sm:max-w-[180px]"
            />
            <span className="hidden text-sm text-slate-400 sm:inline">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full min-w-[140px] flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm sm:max-w-[180px]"
            />
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="grid gap-6 lg:grid-cols-[2fr_1fr]"
      >
        <div className="glass-card min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
                Revenue
              </p>
              <h3 className="mt-2 font-heading text-2xl text-slate-900">
                Revenue Analytics
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {revenueViews.map((item) => (
                <button
                  key={item}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    view === item
                      ? "bg-primary text-white"
                      : "border border-slate-200 text-slate-600"
                  }`}
                  onClick={() => setView(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 min-h-[18rem] w-full px-2 sm:px-4">
            {loading ? (
              <div className="skeleton h-full w-full rounded-2xl" />
            ) : (
              <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={300}>
                <LineChart data={revenueSeries[range]} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={56} tickMargin={8} />
                  <Tooltip
                    formatter={(value) => [`PKR ${value.toLocaleString()}`, "Revenue"]}
                    contentStyle={{ borderRadius: "12px", borderColor: "#e2e8f0" }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#4a63f5" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass-card min-w-0 space-y-6">
          <div>
            <p className="text-sm text-slate-500">Total Revenue</p>
            <h3 className="mt-2 font-heading text-3xl text-slate-900">
              PKR {totalRevenue.toLocaleString()}
            </h3>
          </div>
          <div className="h-52">
            {loading ? (
              <div className="skeleton h-full w-full rounded-2xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                <PieChart>
                  <Pie
                    data={breakdownData}
                    dataKey="amount"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {breakdownData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`PKR ${value.toLocaleString()}`, "Revenue"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-2 text-sm text-slate-600">
            {breakdownData.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                  {entry.name}
                </span>
                <span>PKR {entry.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <div>
          <h3 className="font-heading text-2xl text-slate-900">Enrollment Analytics</h3>
          <p className="text-sm text-slate-500">
            Track enrollments by course and daily trends.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="glass-card min-w-0">
            <h4 className="text-sm font-semibold text-slate-500">Top Courses</h4>
            <div className="mt-4">
              {loading ? (
                <div className="skeleton h-64 w-full rounded-2xl" />
              ) : (
                <>
                  <div className="h-72 sm:hidden">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                      <BarChart
                        data={enrollmentsByCourse}
                        layout="vertical"
                        margin={{ top: 8, right: 12, left: 12, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" tickLine={false} axisLine={false} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          tickLine={false}
                          axisLine={false}
                          width={120}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip />
                        <Bar dataKey="value" fill="#4a63f5" radius={[6, 6, 6, 6]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="hidden h-64 sm:block">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                      <BarChart data={enrollmentsByCourse}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} />
                        <YAxis tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#4a63f5" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="glass-card min-w-0">
            <h4 className="text-sm font-semibold text-slate-500">New Enrollments</h4>
            <div className="mt-4 h-64">
              {loading ? (
                <div className="skeleton h-full w-full rounded-2xl" />
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                  <LineChart data={enrollmentsTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#ff6f0f" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <div key={`kpi-skeleton-${index}`} className="glass-card space-y-2">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton h-6 w-1/2" />
                </div>
              ))
            : [
                { label: "Total Enrollments", value: "3,420" },
                { label: "New This Month", value: "420" },
                { label: "Avg per Day", value: "65" },
              ].map((item) => (
                <div key={item.label} className="glass-card">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {item.value}
                  </p>
                </div>
              ))}
        </div>
      </motion.section>

      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <div>
          <h3 className="font-heading text-2xl text-slate-900">Student Analytics</h3>
          <p className="text-sm text-slate-500">
            Monitor active students and growth trends.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="glass-card min-w-0">
            <h4 className="text-sm font-semibold text-slate-500">Active Students</h4>
            <div className="mt-4 h-64">
              {loading ? (
                <div className="skeleton h-full w-full rounded-2xl" />
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                  <BarChart data={activeStudents}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="glass-card min-w-0">
            <h4 className="text-sm font-semibold text-slate-500">Student Growth</h4>
            <div className="mt-4 h-64">
              {loading ? (
                <div className="skeleton h-full w-full rounded-2xl" />
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                  <LineChart data={studentGrowth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#4a63f5" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <div key={`student-kpi-${index}`} className="glass-card space-y-2">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton h-6 w-1/2" />
                </div>
              ))
            : [
                { label: "Total Students", value: "12,500" },
                { label: "New This Month", value: "860" },
                { label: "Avg Session Time", value: "32 mins" },
              ].map((item) => (
                <div key={item.label} className="glass-card">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {item.value}
                  </p>
                </div>
              ))}
        </div>
      </motion.section>

      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <div className="glass-card">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xl text-slate-900">Course Performance</h3>
            <span className="text-xs text-slate-400">Sortable</span>
          </div>
          <div className="mt-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`course-card-skeleton-${index}`}
                    className="skeleton h-20 w-full rounded-2xl"
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-3 sm:hidden">
                  {sortedCoursePerformance.map((course) => (
                    <div
                      key={course.name}
                      className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-sm shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {course.name}
                          </p>
                          <p className="text-xs text-slate-500">{course.teacher}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {course.rating}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                        <div>
                          <p className="text-slate-400">Enrolled</p>
                          <p className="font-semibold text-slate-900">
                            {course.enrolled}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Completed</p>
                          <p className="font-semibold text-slate-900">
                            {course.completed}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Completion</p>
                          <p className="font-semibold text-slate-900">{course.rate}%</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Revenue</p>
                          <p className="font-semibold text-slate-900">
                            PKR {course.revenue.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto sm:block">
                  <table className="min-w-[760px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
                      <tr>
                        {[
                          { label: "Course Name", key: "name" },
                          { label: "Teacher", key: "teacher" },
                          { label: "Enrolled", key: "enrolled" },
                          { label: "Completed", key: "completed" },
                          { label: "Completion Rate %", key: "rate" },
                          { label: "Revenue PKR", key: "revenue" },
                          { label: "Avg Rating", key: "rating" },
                        ].map((col) => (
                          <th
                            key={col.key}
                            className="cursor-pointer pb-3 pr-4 whitespace-nowrap"
                            onClick={() =>
                              setSortCourse((prev) => ({
                                key: col.key,
                                dir:
                                  prev.key === col.key && prev.dir === "asc"
                                    ? "desc"
                                    : "asc",
                              }))
                            }
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCoursePerformance.map((course) => (
                        <tr key={course.name} className="border-b border-slate-100">
                          <td className="py-3 pr-4 font-semibold text-slate-900">
                            {course.name}
                          </td>
                          <td className="py-3 pr-4 text-slate-600">
                            {course.teacher}
                          </td>
                          <td className="py-3 pr-4">{course.enrolled}</td>
                          <td className="py-3 pr-4">{course.completed}</td>
                          <td className="py-3 pr-4">{course.rate}%</td>
                          <td className="py-3 pr-4 whitespace-nowrap">
                            PKR {course.revenue.toLocaleString()}
                          </td>
                          <td className="py-3 pr-4">{course.rating}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <div className="glass-card">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xl text-slate-900">Teacher Performance</h3>
            <span className="text-xs text-slate-400">Sortable</span>
          </div>
          <div className="mt-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`teacher-card-skeleton-${index}`}
                    className="skeleton h-20 w-full rounded-2xl"
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-3 sm:hidden">
                  {sortedTeacherPerformance.map((teacher) => (
                    <div
                      key={teacher.name}
                      className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-sm shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {teacher.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {teacher.courses} Courses
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {teacher.completion}%
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                        <div>
                          <p className="text-slate-400">Students</p>
                          <p className="font-semibold text-slate-900">
                            {teacher.students}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Revenue</p>
                          <p className="font-semibold text-slate-900">
                            PKR {teacher.revenue.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto sm:block">
                  <table className="min-w-[680px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
                      <tr>
                        {[
                          { label: "Teacher Name", key: "name" },
                          { label: "Courses", key: "courses" },
                          { label: "Total Students", key: "students" },
                          { label: "Avg Completion Rate", key: "completion" },
                          { label: "Revenue Generated", key: "revenue" },
                        ].map((col) => (
                          <th
                            key={col.key}
                            className="cursor-pointer pb-3 pr-4 whitespace-nowrap"
                            onClick={() =>
                              setSortTeacher((prev) => ({
                                key: col.key,
                                dir:
                                  prev.key === col.key && prev.dir === "asc"
                                    ? "desc"
                                    : "asc",
                              }))
                            }
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTeacherPerformance.map((teacher) => (
                        <tr key={teacher.name} className="border-b border-slate-100">
                          <td className="py-3 pr-4 font-semibold text-slate-900">
                            {teacher.name}
                          </td>
                          <td className="py-3 pr-4">{teacher.courses}</td>
                          <td className="py-3 pr-4">{teacher.students}</td>
                          <td className="py-3 pr-4">{teacher.completion}%</td>
                          <td className="py-3 pr-4 whitespace-nowrap">
                            PKR {teacher.revenue.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.section>
    </div>
  );
}

export default Analytics;
