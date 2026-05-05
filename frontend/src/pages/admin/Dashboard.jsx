import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  FiActivity,
  FiAward,
  FiBookOpen,
  FiCreditCard,
  FiTrendingUp,
  FiUserPlus,
  FiUsers,
  FiUser,
} from "react-icons/fi";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getDashboardStats,
  getRecentEnrollments,
  getTopClasses,
  getRecentActivity,
  getRevenueChart,
} from "../../services/admin.service.js";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const iconMap = {
  users: <FiUsers className="h-5 w-5" />,
  trend: <FiTrendingUp className="h-5 w-5" />,
  book: <FiBookOpen className="h-5 w-5" />,
  "user-plus": <FiUserPlus className="h-5 w-5" />,
  activity: <FiActivity className="h-4 w-4" />,
  enroll: <FiUser className="h-4 w-4" />,
  payment: <FiCreditCard className="h-4 w-4" />,
  teacher: <FiUsers className="h-4 w-4" />,
  course: <FiBookOpen className="h-4 w-4" />,
  certificate: <FiAward className="h-4 w-4" />,
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

const formatFullDate = (date) =>
  date.toLocaleDateString("en-PK", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const timeAgo = (date) => {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
};

const formatCompactPKR = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  const abs = Math.abs(numeric);
  if (abs >= 1_000_000) {
    return `${Math.round(numeric / 1_000_000)}M`;
  }
  if (abs >= 10_000) {
    return `${Math.round(numeric / 1_000)}k`;
  }
  if (abs >= 1_000) {
    return `${(numeric / 1_000).toFixed(1)}k`;
  }
  return Math.round(numeric).toLocaleString();
};

const statusClass = (status) => {
  const normalized = (status || "").toLowerCase();
  if (normalized === "paid") return "bg-emerald-50 text-emerald-600";
  if (normalized === "pending") return "bg-amber-50 text-amber-600";
  if (normalized === "failed" || normalized === "rejected")
    return "bg-rose-50 text-rose-600";
  return "bg-slate-100 text-slate-600";
};

const activityIcon = (action) => {
  const normalized = (action || "").toLowerCase();
  if (normalized.includes("payment")) return iconMap.payment;
  if (normalized.includes("teacher")) return iconMap.teacher;
  if (normalized.includes("course")) return iconMap.course;
  if (normalized.includes("certificate")) return iconMap.certificate;
  if (normalized.includes("enroll")) return iconMap.enroll;
  return iconMap.activity;
};

const activityText = (activity) => {
  const action = (activity?.action || "").replace(/_/g, " ");
  if (!action) return "Activity logged";
  const subject = activity?.email || activity?.uid || "user";
  return `${action} — ${subject}`;
};

function CountUp({ value, prefix = "" }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Number(value || 0);
    let start = null;
    let frame;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / 1000, 1);
      setDisplay(Math.round(target * progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span>
      {prefix}
      {display.toLocaleString()}
    </span>
  );
}

function Dashboard() {
  const [rangeDays, setRangeDays] = useState(7);
  const navigate = useNavigate();

  const {
    data: statsResponse,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["admin", "dashboard-stats"],
    queryFn: getDashboardStats,
    staleTime: 30000,
    retry: 2,
  });

  const {
    data: revenueResponse,
    isLoading: revenueLoading,
    error: revenueError,
    refetch: refetchRevenue,
  } = useQuery({
    queryKey: ["admin", "revenue-chart", rangeDays],
    queryFn: () => getRevenueChart(rangeDays),
    staleTime: 30000,
    retry: 2,
  });

  const {
    data: enrollmentsResponse,
    isLoading: enrollmentsLoading,
    error: enrollmentsError,
  } = useQuery({
    queryKey: ["admin", "recent-enrollments"],
    queryFn: getRecentEnrollments,
    staleTime: 30000,
    retry: 2,
  });

  const {
    data: topClassesResponse,
    isLoading: topClassesLoading,
    error: topClassesError,
  } = useQuery({
    queryKey: ["admin", "top-classes"],
    queryFn: getTopClasses,
    staleTime: 30000,
    retry: 2,
  });

  const {
    data: activityResponse,
    isLoading: activityLoading,
    error: activityError,
  } = useQuery({
    queryKey: ["admin", "recent-activity"],
    queryFn: getRecentActivity,
    staleTime: 30000,
    retry: 2,
  });

  const stats = statsResponse?.data ?? statsResponse ?? {};

  const kpis = useMemo(() => {
    const items = [
      {
        label: "Total Students",
        value: Number(stats.totalStudents || 0),
        color: "text-primary",
        icon: "users",
      },
      {
        label: "Total Revenue PKR",
        value: Number(stats.totalRevenue || 0),
        color: "text-emerald-500",
        icon: "trend",
        prefix: "PKR ",
      },
      {
        label: "Total Enrollments",
        value: Number(stats.totalEnrollments || stats.activeEnrollments || 0),
        color: "text-purple-500",
        icon: "user-plus",
      },
      {
        label: "Total Classes",
        value: Number(stats.totalClasses || 0),
        color: "text-accent",
        icon: "book",
      },
    ];

    const pendingApprovals = Number(stats.pendingApprovals || 0);
    if (pendingApprovals > 0) {
      items.push({
        label: "Pending Approvals",
        value: pendingApprovals,
        color: "text-amber-500",
        icon: "user-plus",
        cardClass: "border border-amber-200 bg-amber-50/70",
        helperText: "Click to review",
        onClick: () =>
          navigate("/admin/students?tab=pending_approval"),
      });
    }

    return items;
  }, [navigate, stats]);

  const revenueRaw = useMemo(() => {
    const data = revenueResponse?.data ?? revenueResponse ?? [];
    return Array.isArray(data) ? data : [];
  }, [revenueResponse]);

  const revenueData = useMemo(
    () =>
      revenueRaw.map((item) => {
        const date = parseTimestamp(item.date);
        return {
          label: date ? formatDateLabel(date) : item.date || "N/A",
          amount: Number(item.amount || 0),
        };
      }),
    [revenueRaw]
  );

  const hasRevenueData = revenueData.some((item) => Number(item.amount || 0) > 0);

  const enrollments = useMemo(() => {
    const data = enrollmentsResponse?.data ?? enrollmentsResponse ?? [];
    return Array.isArray(data) ? data : [];
  }, [enrollmentsResponse]);

  const topClasses = useMemo(() => {
    const data = topClassesResponse?.data ?? topClassesResponse ?? [];
    return Array.isArray(data) ? data : [];
  }, [topClassesResponse]);

  const activityFeed = useMemo(() => {
    const data = activityResponse?.data ?? activityResponse ?? [];
    return Array.isArray(data) ? data : [];
  }, [activityResponse]);

  const maxEnroll =
    topClasses.length > 0
      ? Math.max(...topClasses.map((row) => Number(row.enrollmentCount || 0)))
      : 0;

  const ranges = [
    { label: "7 Days", days: 7 },
    { label: "30 Days", days: 30 },
    { label: "3 Months", days: 90 },
  ];

  return (
    <div className="space-y-8">
      <motion.div
        className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
      >
        {statsLoading ? (
          Array.from({ length: 4 }).map((ignore, index) => (
            <div key={`kpi-skeleton-${index}`} className="glass-card">
              <div className="skeleton h-5 w-24" />
              <div className="mt-4 skeleton h-10 w-32" />
              <div className="mt-4 skeleton h-4 w-20" />
            </div>
          ))
        ) : statsError ? (
          <div className="sm:col-span-2 xl:col-span-4 rounded-2xl border border-rose-100 bg-rose-50 p-6 text-sm text-rose-600">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span>Failed to load dashboard stats.</span>
              <button
                className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600"
                onClick={() => refetchStats()}
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          kpis.map((kpi) => (
            <motion.div
              key={kpi.label}
              variants={fadeUp}
              className={`glass-card card-hover flex flex-col gap-4 ${
                kpi.onClick ? "cursor-pointer" : ""
              } ${
                kpi.cardClass || ""
              }`}
              onClick={kpi.onClick}
              role={kpi.onClick ? "button" : undefined}
              tabIndex={kpi.onClick ? 0 : undefined}
              onKeyDown={(event) => {
                if (!kpi.onClick) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  kpi.onClick();
                }
              }}
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
                <CountUp value={kpi.value} prefix={kpi.prefix} />
              </p>
              <span className="text-xs text-slate-400">
                {kpi.helperText || "Live data"}
              </span>
            </motion.div>
          ))
        )}
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
            {ranges.map((range) => (
              <button
                key={range.label}
                type="button"
                onClick={() => setRangeDays(range.days)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  rangeDays === range.days
                    ? "bg-primary text-white"
                    : "border border-slate-200 text-slate-600"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 min-h-[18rem] w-full overflow-hidden">
          {revenueLoading ? (
            <div className="skeleton h-full w-full rounded-2xl" />
          ) : revenueError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-sm text-rose-600">
              <div className="flex items-center justify-between gap-4">
                <span>Failed to load revenue chart.</span>
                <button
                  className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600"
                  onClick={() => refetchRevenue()}
                >
                  Retry
                </button>
              </div>
            </div>
          ) : revenueData.length === 0 || !hasRevenueData ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-500">
              No revenue data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={288}>
              <LineChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4a63f5" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4a63f5" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatCompactPKR(value)}
                />
                <Tooltip
                  formatter={(value) => [
                    `PKR ${Number(value).toLocaleString()}`,
                    "Revenue",
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    borderColor: "#e2e8f0",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
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
            {enrollmentsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((ignore, index) => (
                  <div key={`enroll-skeleton-${index}`} className="skeleton h-10 w-full" />
                ))}
              </div>
            ) : enrollmentsError ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
                Failed to load enrollments.
              </div>
            ) : enrollments.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-slate-500">
                No enrollments yet
              </div>
            ) : (
              <>
                <div className="space-y-3 sm:hidden">
                  {enrollments.map((item) => {
                    const createdAt = parseTimestamp(item.createdAt);
                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-sm shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-900">
                            {item.studentName || "Unknown"}
                          </p>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                              item.status
                            )}`}
                          >
                            {item.status || "Pending"}
                          </span>
                        </div>
                        <p className="mt-2 text-slate-600">
                          {item.courseName || "Unknown"}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span>PKR {Number(item.amount || 0).toLocaleString()}</span>
                          <span>
                            {createdAt ? formatFullDate(createdAt) : "N/A"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
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
                        {enrollments.map((item) => {
                          const createdAt = parseTimestamp(item.createdAt);
                          return (
                            <tr key={item.id} className="border-t border-slate-100">
                              <td className="py-3 pr-3 font-semibold text-slate-900">
                                {item.studentName || "Unknown"}
                              </td>
                              <td className="py-3 pr-4 text-slate-600">
                                {item.courseName || "Unknown"}
                              </td>
                              <td className="py-3 whitespace-nowrap">
                                PKR {Number(item.amount || 0).toLocaleString()}
                              </td>
                              <td className="py-3 whitespace-nowrap">
                                {createdAt ? formatFullDate(createdAt) : "N/A"}
                              </td>
                              <td className="py-3">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                                    item.status
                                  )}`}
                                >
                                  {item.status || "Pending"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="glass-card">
          <h3 className="font-heading text-xl text-slate-900">Top Classes</h3>
          <div className="mt-6 space-y-4">
            {topClassesLoading ? (
              Array.from({ length: 5 }).map((ignore, index) => (
                <div key={`top-skeleton-${index}`} className="space-y-2">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-2 w-full" />
                </div>
              ))
            ) : topClassesError ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
                Failed to load top classes.
              </div>
            ) : topClasses.length === 0 ? (
              <div className="text-sm text-slate-500">No classes yet.</div>
            ) : (
              topClasses.map((row, index) => {
                const enrolled = Number(row.enrollmentCount || 0);
                return (
                  <div key={row.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-900">
                        {index + 1}. {row.className || row.title || "Class"}
                      </span>
                      <span className="text-slate-500">{enrolled} enrolled</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{
                          width: maxEnroll ? `${(enrolled / maxEnroll) * 100}%` : "0%",
                        }}
                      />
                    </div>
                    <div className="text-xs text-slate-500">
                      PKR {Number(row.revenue || 0).toLocaleString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="glass-card">
        <h3 className="font-heading text-xl text-slate-900">Recent Activity</h3>
        <div className="mt-6 space-y-4">
          {activityLoading ? (
            Array.from({ length: 6 }).map((ignore, index) => (
              <div key={`activity-skeleton-${index}`} className="skeleton h-6 w-full" />
            ))
          ) : activityError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
              Failed to load recent activity.
            </div>
          ) : activityFeed.length === 0 ? (
            <div className="text-sm text-slate-500">No recent activity.</div>
          ) : (
            activityFeed.map((item) => {
              const createdAt = parseTimestamp(item.timestamp);
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 text-sm text-slate-600"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {activityIcon(item.action)}
                  </span>
                  <div className="flex-1">
                    <p className="text-slate-700">{activityText(item)}</p>
                    <p className="text-xs text-slate-400">
                      {item.ip ? `IP ${item.ip}` : "IP unavailable"}
                      {createdAt ? ` • ${timeAgo(createdAt)}` : ""}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
