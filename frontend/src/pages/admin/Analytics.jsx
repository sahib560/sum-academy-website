import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
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
import {
  getRevenueChart,
  getPayments,
  getTopCourses,
  getRecentEnrollments,
  getCourses,
  getTeachers,
  getStudents,
} from "../../services/admin.service.js";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const quickRanges = ["Today", "7 Days", "30 Days", "3 Months", "1 Year"];
const revenueViews = ["Daily", "Weekly", "Monthly"];

const rangeDaysMap = {
  Today: 1,
  "7 Days": 7,
  "30 Days": 30,
  "3 Months": 90,
  "1 Year": 365,
};

const parseTimestamp = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value._seconds === "number") return new Date(value._seconds * 1000);
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateLabel = (date) =>
  date.toLocaleDateString("en-PK", { month: "short", day: "numeric" });

const formatMonthLabel = (date) =>
  date.toLocaleDateString("en-PK", { month: "short", year: "2-digit" });

const getWeekStart = (date) => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const normalizeMethod = (method = "") => {
  const value = method.toLowerCase().replace(/\s+/g, "_");
  if (value.includes("jazz")) return "JazzCash";
  if (value.includes("easy")) return "EasyPaisa";
  if (value.includes("bank")) return "Bank Transfer";
  return "Other";
};

const methodColors = {
  JazzCash: "#ef4444",
  EasyPaisa: "#10b981",
  "Bank Transfer": "#3b82f6",
  Other: "#94a3b8",
};

const sortRows = (rows, sort) =>
  [...rows].sort((a, b) => {
    const valueA = a[sort.key];
    const valueB = b[sort.key];
    if (typeof valueA === "string" || typeof valueB === "string") {
      const safeA = String(valueA ?? "");
      const safeB = String(valueB ?? "");
      return sort.dir === "asc"
        ? safeA.localeCompare(safeB)
        : safeB.localeCompare(safeA);
    }
    const numA = Number(valueA || 0);
    const numB = Number(valueB || 0);
    return sort.dir === "asc" ? numA - numB : numB - numA;
  });

function Analytics() {
  const [range, setRange] = useState("7 Days");
  const [view, setView] = useState("Daily");
  const [sortCourse, setSortCourse] = useState({ key: "revenue", dir: "desc" });
  const [sortTeacher, setSortTeacher] = useState({
    key: "revenue",
    dir: "desc",
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const rangeDays = rangeDaysMap[range] || 7;
  const hasCustomRange = Boolean(startDate && endDate);

  const rangeWindow = useMemo(() => {
    const end = hasCustomRange ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    const start = hasCustomRange ? new Date(startDate) : new Date();
    if (!hasCustomRange) {
      start.setDate(end.getDate() - rangeDays + 1);
    }
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }, [startDate, endDate, rangeDays, hasCustomRange]);

  const {
    data: revenueResponse,
    isLoading: revenueLoading,
    error: revenueError,
  } = useQuery({
    queryKey: ["admin", "analytics-revenue", rangeDays],
    queryFn: () => getRevenueChart(rangeDays),
    staleTime: 30000,
    retry: 2,
  });

  const {
    data: paymentsResponse,
    isLoading: paymentsLoading,
    error: paymentsError,
  } = useQuery({
    queryKey: ["admin", "analytics-payments"],
    queryFn: () => getPayments(),
    staleTime: 30000,
    retry: 2,
  });

  const {
    data: topCoursesResponse,
    isLoading: topCoursesLoading,
    error: topCoursesError,
  } = useQuery({
    queryKey: ["admin", "analytics-top-courses"],
    queryFn: getTopCourses,
    staleTime: 30000,
    retry: 2,
  });

  const {
    data: enrollmentsResponse,
    isLoading: enrollmentsLoading,
    error: enrollmentsError,
  } = useQuery({
    queryKey: ["admin", "analytics-enrollments"],
    queryFn: getRecentEnrollments,
    staleTime: 30000,
    retry: 2,
  });

  const {
    data: coursesResponse,
    isLoading: coursesLoading,
    error: coursesError,
  } = useQuery({
    queryKey: ["admin", "analytics-courses"],
    queryFn: getCourses,
    staleTime: 30000,
    retry: 2,
  });

  const {
    data: teachersResponse,
    isLoading: teachersLoading,
    error: teachersError,
  } = useQuery({
    queryKey: ["admin", "analytics-teachers"],
    queryFn: getTeachers,
    staleTime: 30000,
    retry: 2,
  });

  const {
    data: studentsResponse,
    isLoading: studentsLoading,
    error: studentsError,
  } = useQuery({
    queryKey: ["admin", "analytics-students"],
    queryFn: getStudents,
    staleTime: 30000,
    retry: 2,
  });

  const revenueRaw = useMemo(() => {
    const data = revenueResponse?.data ?? revenueResponse ?? [];
    return Array.isArray(data) ? data : [];
  }, [revenueResponse]);

  const revenueDaily = useMemo(
    () =>
      revenueRaw
        .map((item) => {
          const date = parseTimestamp(item.date || item.createdAt || item.day);
          if (!date) return null;
          if (date < rangeWindow.start || date > rangeWindow.end) return null;
          return {
            date,
            label: formatDateLabel(date),
            amount: Number(item.amount || item.value || 0),
          };
        })
        .filter(Boolean),
    [revenueRaw, rangeWindow]
  );

  const revenueWeekly = useMemo(() => {
    const totals = {};
    revenueDaily.forEach((item) => {
      const weekStart = getWeekStart(item.date);
      const key = weekStart.toISOString().slice(0, 10);
      totals[key] = (totals[key] || 0) + item.amount;
    });
    return Object.keys(totals)
      .sort()
      .map((key) => ({
        label: `Week of ${formatDateLabel(new Date(key))}`,
        amount: totals[key],
      }));
  }, [revenueDaily]);

  const revenueMonthly = useMemo(() => {
    const totals = {};
    revenueDaily.forEach((item) => {
      const key = `${item.date.getFullYear()}-${item.date.getMonth()}`;
      totals[key] = (totals[key] || 0) + item.amount;
    });
    return Object.keys(totals)
      .sort()
      .map((key) => {
        const [year, month] = key.split("-").map(Number);
        return {
          label: formatMonthLabel(new Date(year, month, 1)),
          amount: totals[key],
        };
      });
  }, [revenueDaily]);

  const revenueChartData = useMemo(() => {
    if (view === "Weekly") return revenueWeekly;
    if (view === "Monthly") return revenueMonthly;
    return revenueDaily;
  }, [view, revenueDaily, revenueWeekly, revenueMonthly]);

  const totalRevenue = useMemo(
    () => revenueChartData.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [revenueChartData]
  );

  const paymentsRaw = useMemo(() => {
    const data = paymentsResponse?.data ?? paymentsResponse ?? [];
    return Array.isArray(data) ? data : [];
  }, [paymentsResponse]);

  const paidPayments = useMemo(
    () =>
      paymentsRaw.filter((payment) => {
        const status = (payment.status || "").toLowerCase();
        if (status !== "paid") return false;
        const date = parseTimestamp(payment.createdAt);
        if (!date) return false;
        return date >= rangeWindow.start && date <= rangeWindow.end;
      }),
    [paymentsRaw, rangeWindow]
  );

  const breakdownData = useMemo(() => {
    const totals = { JazzCash: 0, EasyPaisa: 0, "Bank Transfer": 0, Other: 0 };
    paidPayments.forEach((payment) => {
      const method = normalizeMethod(payment.method || "");
      totals[method] += Number(payment.amount || 0);
    });
    return Object.entries(totals)
      .map(([name, amount]) => ({
        name,
        amount,
        color: methodColors[name] || "#94a3b8",
      }))
      .filter((item) => item.amount > 0);
  }, [paidPayments]);

  const topCourses = useMemo(() => {
    const data = topCoursesResponse?.data ?? topCoursesResponse ?? [];
    return Array.isArray(data) ? data : [];
  }, [topCoursesResponse]);

  const enrollments = useMemo(() => {
    const data = enrollmentsResponse?.data ?? enrollmentsResponse ?? [];
    return Array.isArray(data) ? data : [];
  }, [enrollmentsResponse]);

  const courses = useMemo(() => {
    const data = coursesResponse?.data ?? coursesResponse ?? [];
    return Array.isArray(data) ? data : [];
  }, [coursesResponse]);

  const teachers = useMemo(() => {
    const data = teachersResponse?.data ?? teachersResponse ?? [];
    return Array.isArray(data) ? data : [];
  }, [teachersResponse]);

  const students = useMemo(() => {
    const data = studentsResponse?.data ?? studentsResponse ?? [];
    return Array.isArray(data) ? data : [];
  }, [studentsResponse]);

  const enrollmentsByCourse = useMemo(
    () =>
      topCourses.map((course) => ({
        name: course.title || course.name || "Untitled",
        value: Number(course.enrollmentCount || 0),
      })),
    [topCourses]
  );

  const enrollmentsTrend = useMemo(() => {
    const totals = {};
    enrollments.forEach((item) => {
      const date = parseTimestamp(item.createdAt);
      if (!date) return;
      if (date < rangeWindow.start || date > rangeWindow.end) return;
      const key = date.toISOString().slice(0, 10);
      totals[key] = (totals[key] || 0) + 1;
    });
    return Object.keys(totals)
      .sort()
      .map((key) => ({
        name: formatDateLabel(new Date(key)),
        value: totals[key],
      }));
  }, [enrollments, rangeWindow]);

  const totalEnrollments = useMemo(
    () =>
      courses.reduce(
        (sum, course) => sum + Number(course.enrollmentCount || 0),
        0
      ),
    [courses]
  );

  const newEnrollmentsThisMonth = useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return enrollments.filter((item) => {
      const date = parseTimestamp(item.createdAt);
      return date && date >= start;
    }).length;
  }, [enrollments]);

  const avgEnrollmentsPerDay = useMemo(
    () => Math.round(newEnrollmentsThisMonth / 30),
    [newEnrollmentsThisMonth]
  );

  const activeStudentsData = useMemo(() => {
    const activeCount = students.filter((student) => student.isActive !== false)
      .length;
    const inactiveCount = Math.max(students.length - activeCount, 0);
    return [
      { name: "Active", value: activeCount },
      { name: "Inactive", value: inactiveCount },
    ];
  }, [students]);

  const studentGrowth = useMemo(() => {
    const totals = {};
    students.forEach((student) => {
      const date = parseTimestamp(student.createdAt);
      if (!date) return;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      totals[key] = (totals[key] || 0) + 1;
    });
    return Object.keys(totals)
      .sort()
      .map((key) => {
        const [year, month] = key.split("-").map(Number);
        return {
          name: formatMonthLabel(new Date(year, month, 1)),
          value: totals[key],
        };
      });
  }, [students]);

  const totalStudents = students.length;

  const newStudentsThisMonth = useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return students.filter((student) => {
      const date = parseTimestamp(student.createdAt);
      return date && date >= start;
    }).length;
  }, [students]);

  const averageSessionTime = useMemo(() => {
    const values = students
      .map((student) => Number(student.avgSessionTime || 0))
      .filter((value) => value > 0);
    if (!values.length) return "N/A";
    const avg = Math.round(
      values.reduce((sum, value) => sum + value, 0) / values.length
    );
    return `${avg} mins`;
  }, [students]);

  const coursePerformance = useMemo(
    () =>
      courses.map((course) => {
        const enrolled = Number(course.enrollmentCount || course.enrolled || 0);
        const completed = Number(
          course.completedCount || course.completed || 0
        );
        const rate = enrolled ? Math.round((completed / enrolled) * 100) : 0;
        const ratingValue = Number(course.rating || course.avgRating || 0);
        return {
          name: course.title || course.name || "Untitled",
          teacher: course.teacherName || "Unknown",
          enrolled,
          completed,
          rate,
          revenue: Number(course.revenue || 0),
          rating: ratingValue,
          ratingLabel: ratingValue ? ratingValue.toFixed(1) : "N/A",
        };
      }),
    [courses]
  );

  const teacherPerformance = useMemo(() => {
    return teachers.map((teacher) => {
      const teacherId = teacher.uid || teacher.id;
      const teacherName =
        teacher.fullName || teacher.name || teacher.email || "Unknown";
      const ownedCourses = courses.filter(
        (course) => course.teacherId === teacherId
      );
      const studentsCount = ownedCourses.reduce(
        (sum, course) => sum + Number(course.enrollmentCount || 0),
        0
      );
      const revenue = ownedCourses.reduce(
        (sum, course) => sum + Number(course.revenue || 0),
        0
      );
      const completionValues = ownedCourses.map((course) => {
        const enrolled = Number(course.enrollmentCount || 0);
        const completed = Number(
          course.completedCount || course.completed || 0
        );
        if (enrolled === 0) return 0;
        return Math.round((completed / enrolled) * 100);
      });
      const completion =
        completionValues.length > 0
          ? Math.round(
              completionValues.reduce((sum, value) => sum + value, 0) /
                completionValues.length
            )
          : 0;
      return {
        name: teacherName,
        courses: ownedCourses.length,
        students: studentsCount,
        completion,
        revenue,
      };
    });
  }, [teachers, courses]);

  const sortedCoursePerformance = useMemo(
    () => sortRows(coursePerformance, sortCourse),
    [coursePerformance, sortCourse]
  );

  const sortedTeacherPerformance = useMemo(
    () => sortRows(teacherPerformance, sortTeacher),
    [teacherPerformance, sortTeacher]
  );

  const showRevenueEmpty =
    !revenueLoading && (revenueError || revenueChartData.length === 0);
  const showBreakdownEmpty =
    !paymentsLoading && (paymentsError || breakdownData.length === 0);
  const showEnrollmentsEmpty =
    !topCoursesLoading && (topCoursesError || enrollmentsByCourse.length === 0);
  const showEnrollmentsTrendEmpty =
    !enrollmentsLoading && (enrollmentsError || enrollmentsTrend.length === 0);
  const showCoursesEmpty =
    !coursesLoading && (coursesError || coursePerformance.length === 0);
  const showTeachersEmpty =
    !teachersLoading && (teachersError || teacherPerformance.length === 0);
  const showStudentsEmpty =
    !studentsLoading && (studentsError || students.length === 0);

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
          <h2 className="font-heading text-3xl text-slate-900">
            Analytics & Reports
          </h2>
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
            {revenueLoading ? (
              <div className="skeleton h-full w-full rounded-2xl" />
            ) : showRevenueEmpty ? (
              <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                No revenue data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={300}>
                <LineChart data={revenueChartData} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={56} tickMargin={8} />
                  <Tooltip
                    formatter={(value) => [
                      `PKR ${Number(value).toLocaleString()}`,
                      "Revenue",
                    ]}
                    contentStyle={{ borderRadius: "12px", borderColor: "#e2e8f0" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#4a63f5"
                    strokeWidth={3}
                  />
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
            {paymentsLoading ? (
              <div className="skeleton h-full w-full rounded-2xl" />
            ) : showBreakdownEmpty ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No payment data yet
              </div>
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
                    formatter={(value) => [
                      `PKR ${Number(value).toLocaleString()}`,
                      "Revenue",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-2 text-sm text-slate-600">
            {breakdownData.length === 0 ? (
              <p className="text-sm text-slate-500">No payment breakdown yet.</p>
            ) : (
              breakdownData.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: entry.color }}
                    />
                    {entry.name}
                  </span>
                  <span>PKR {entry.amount.toLocaleString()}</span>
                </div>
              ))
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
        <div>
          <h3 className="font-heading text-2xl text-slate-900">
            Enrollment Analytics
          </h3>
          <p className="text-sm text-slate-500">
            Track enrollments by course and daily trends.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="glass-card min-w-0">
            <h4 className="text-sm font-semibold text-slate-500">Top Courses</h4>
            <div className="mt-4">
              {topCoursesLoading ? (
                <div className="skeleton h-64 w-full rounded-2xl" />
              ) : showEnrollmentsEmpty ? (
                <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                  No enrollment data yet
                </div>
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
            <h4 className="text-sm font-semibold text-slate-500">
              New Enrollments
            </h4>
            <div className="mt-4 h-64">
              {enrollmentsLoading ? (
                <div className="skeleton h-full w-full rounded-2xl" />
              ) : showEnrollmentsTrendEmpty ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No enrollment trends yet
                </div>
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
          {coursesLoading || enrollmentsLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`kpi-skeleton-${index}`} className="glass-card space-y-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-6 w-1/2" />
              </div>
            ))
          ) : (
            [
              {
                label: "Total Enrollments",
                value: totalEnrollments.toLocaleString(),
              },
              {
                label: "New This Month",
                value: newEnrollmentsThisMonth.toLocaleString(),
              },
              { label: "Avg per Day", value: avgEnrollmentsPerDay.toLocaleString() },
            ].map((item) => (
              <div key={item.label} className="glass-card">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))
          )}
        </div>
      </motion.section>

      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <div>
          <h3 className="font-heading text-2xl text-slate-900">
            Student Analytics
          </h3>
          <p className="text-sm text-slate-500">
            Monitor active students and growth trends.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="glass-card min-w-0">
            <h4 className="text-sm font-semibold text-slate-500">
              Active Students
            </h4>
            <div className="mt-4 h-64">
              {studentsLoading ? (
                <div className="skeleton h-full w-full rounded-2xl" />
              ) : showStudentsEmpty ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No student data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                  <BarChart data={activeStudentsData}>
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
            <h4 className="text-sm font-semibold text-slate-500">
              Student Growth
            </h4>
            <div className="mt-4 h-64">
              {studentsLoading ? (
                <div className="skeleton h-full w-full rounded-2xl" />
              ) : showStudentsEmpty || studentGrowth.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No growth data yet
                </div>
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
          {studentsLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`student-kpi-${index}`} className="glass-card space-y-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-6 w-1/2" />
              </div>
            ))
          ) : (
            [
              { label: "Total Students", value: totalStudents.toLocaleString() },
              { label: "New This Month", value: newStudentsThisMonth.toLocaleString() },
              { label: "Avg Session Time", value: averageSessionTime },
            ].map((item) => (
              <div key={item.label} className="glass-card">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))
          )}
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
            <h3 className="font-heading text-xl text-slate-900">
              Course Performance
            </h3>
            <span className="text-xs text-slate-400">Sortable</span>
          </div>
          <div className="mt-4">
            {coursesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`course-card-skeleton-${index}`}
                    className="skeleton h-20 w-full rounded-2xl"
                  />
                ))}
              </div>
            ) : showCoursesEmpty ? (
              <div className="text-sm text-slate-500">No course data yet.</div>
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
                          {course.ratingLabel}
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
                          <p className="font-semibold text-slate-900">
                            {course.rate}%
                          </p>
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
                          <td className="py-3 pr-4">{course.ratingLabel}</td>
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
            <h3 className="font-heading text-xl text-slate-900">
              Teacher Performance
            </h3>
            <span className="text-xs text-slate-400">Sortable</span>
          </div>
          <div className="mt-4">
            {teachersLoading || coursesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`teacher-card-skeleton-${index}`}
                    className="skeleton h-20 w-full rounded-2xl"
                  />
                ))}
              </div>
            ) : showTeachersEmpty ? (
              <div className="text-sm text-slate-500">No teacher data yet.</div>
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
