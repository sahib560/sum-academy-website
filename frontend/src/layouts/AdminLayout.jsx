
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  FiAward,
  FiBarChart2,
  FiBell,
  FiBookOpen,
  FiCalendar,
  FiClipboard,
  FiClock,
  FiCreditCard,
  FiGrid,
  FiLogOut,
  FiMenu,
  FiMessageSquare,
  FiSearch,
  FiSettings,
  FiTag,
  FiUser,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { logout } from "../services/auth.service.js";
import { useAuth } from "../hooks/useAuth.js";
import { getMyAnnouncements } from "../services/admin.service.js";
import { useSettings } from "../hooks/useSettings.js";

const MotionDiv = motion.div;

const navSections = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", to: "/admin/dashboard", icon: "grid" },
      { label: "Analytics", to: "/admin/analytics", icon: "chart" },
    ],
  },
  {
    title: "Management",
    items: [
      { label: "Users", to: "/admin/users", icon: "users" },
      { label: "Teachers", to: "/admin/teachers", icon: "teacher" },
      { label: "Students", to: "/admin/students", icon: "student" },
      { label: "Subjects", to: "/admin/courses", icon: "book" },
      { label: "Classes", to: "/admin/classes", icon: "calendar" },
      { label: "Payments", to: "/admin/payments", icon: "card" },
    ],
  },
  {
    title: "Payments",
    items: [
      { label: "Installments", to: "/admin/installments", icon: "clock" },
      { label: "Promo Codes", to: "/admin/promo-codes", icon: "tag" },
    ],
  },
  {
    title: "Content",
    items: [
      { label: "Videos", to: "/admin/videos", icon: "film" },
      { label: "Subject Content", to: "/admin/course-content", icon: "book" },
      { label: "Quizzes", to: "/admin/quizzes", icon: "clipboard" },
      { label: "Tests", to: "/admin/tests", icon: "clipboard" },
      { label: "Certificates", to: "/admin/certificates", icon: "award" },
      { label: "Announcements", to: "/admin/announcements", icon: "bell" },
      { label: "Support Inbox", to: "/admin/support", icon: "support" },
      { label: "Site Settings", to: "/admin/settings", icon: "settings" },
    ],
  },
];

const iconMap = {
  grid: <FiGrid className="h-4 w-4" />,
  chart: <FiBarChart2 className="h-4 w-4" />,
  users: <FiUsers className="h-4 w-4" />,
  teacher: <FiUserCheck className="h-4 w-4" />,
  student: <FiUser className="h-4 w-4" />,
  book: <FiBookOpen className="h-4 w-4" />,
  calendar: <FiCalendar className="h-4 w-4" />,
  card: <FiCreditCard className="h-4 w-4" />,
  clock: <FiClock className="h-4 w-4" />,
  tag: <FiTag className="h-4 w-4" />,
  film: <FiBookOpen className="h-4 w-4" />,
  clipboard: <FiClipboard className="h-4 w-4" />,
  award: <FiAward className="h-4 w-4" />,
  bell: <FiBell className="h-4 w-4" />,
  support: <FiMessageSquare className="h-4 w-4" />,
  settings: <FiSettings className="h-4 w-4" />,
};

function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { settings } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  const announcementsQuery = useQuery({
    queryKey: ["my-announcements", "admin", userProfile?.uid],
    queryFn: getMyAnnouncements,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: Boolean(userProfile?.uid),
  });
  const notifications = announcementsQuery.data || [];
  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const pageTitle = useMemo(() => {
    const match =
      navSections
        .flatMap((section) => section.items)
        .find((item) => location.pathname.startsWith(item.to))?.label ||
      "Dashboard";
    return match;
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login");
    }
  };

  const emailPrefix = userProfile?.email
    ? String(userProfile.email).split("@")[0]
    : "";
  const displayName =
    userProfile?.name ||
    userProfile?.fullName ||
    userProfile?.displayName ||
    emailPrefix ||
    "Admin";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const siteName = settings.general?.siteName || "SUM Academy";
  const logoUrl = settings.general?.logoUrl || "";

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 font-body text-slate-900">

      <div
        className={`fixed inset-y-0 left-0 z-[70] flex flex-col bg-dark text-slate-200 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-20" : "w-[260px]"}`}
      >
        <div className="flex items-center justify-between px-5 py-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-primary text-lg font-semibold text-white shadow-lg shadow-primary/40">
              {logoUrl ? (
                <img src={logoUrl} alt={`${siteName} logo`} className="h-full w-full object-cover" />
              ) : (
                "S"
              )}
            </span>
            {!collapsed && (
              <div>
                <p className="font-heading text-base text-white">{siteName}</p>
                <span className="mt-1 inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.3em] text-white/70">
                  Admin Panel
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="hidden rounded-full border border-white/10 p-2 text-white/60 transition hover:text-white lg:inline-flex"
            onClick={() => setCollapsed((prev) => !prev)}
          >
            <FiMenu className="h-4 w-4" />
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6">
          {navSections.map((section) => (
            <div key={section.title} className="mb-6">
              {!collapsed && (
                <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.4em] text-white/40">
                  {section.title}
                </p>
              )}
              <div className="mt-3 grid gap-2">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/admin/dashboard"}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        isActive
                          ? "bg-white/20 text-white shadow-lg shadow-black/20 ring-1 ring-white/15"
                          : "text-white/80 hover:bg-white/15 hover:text-white"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-white/10 text-white group-hover:bg-white/20"
                          }`}
                        >
                          {iconMap[item.icon]}
                        </span>
                        {!collapsed && <span>{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
              {initials || "A"}
            </div>
            {!collapsed && (
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{displayName}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className={`mt-4 flex items-center rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-white/90 transition hover:bg-white/10 ${
              collapsed ? "justify-center px-0 py-2.5" : "w-full justify-start gap-2 px-3 py-2.5"
            }`}
            title="Logout"
            aria-label="Logout"
          >
            <FiLogOut className="h-4 w-4" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[60] bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <div
        className={`min-h-screen min-w-0 transition-all duration-300 ${
          collapsed ? "lg:pl-20" : "lg:pl-[260px]"
        }`}
      >
        <header className="sticky top-0 z-30 flex min-w-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <FiMenu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-xs uppercase tracking-[0.3em] text-slate-400">
                {siteName}
              </p>
              <h1 className="truncate font-heading text-2xl text-slate-900">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-end gap-4">
            <div className="relative hidden w-full max-w-xs lg:block">
              <input
                type="text"
                placeholder="Search..."
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                <FiSearch className="h-4 w-4" />
              </span>
            </div>
            <div className="relative">
              <button
                className="relative rounded-full border border-slate-200 bg-white p-2 shadow-sm"
                onClick={() => setNotifOpen((prev) => !prev)}
              >
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] text-white">
                    {unreadCount}
                  </span>
                ) : null}
                {iconMap.bell}
              </button>
              <AnimatePresence>
                {notifOpen ? (
                  <div className="fixed inset-x-0 top-[4.5rem] z-[80] flex justify-center px-3 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:z-20 sm:mt-2 sm:block sm:px-0">
                    <MotionDiv
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:w-[min(92vw,20rem)]"
                    >
                      <p className="mb-2 text-sm font-semibold text-slate-900">Notifications</p>
                      {notifications.length === 0 ? (
                        <p className="text-xs text-slate-500">No announcements yet.</p>
                      ) : (
                        <div className="max-h-72 space-y-2 overflow-auto">
                          {notifications.slice(0, 8).map((item) => (
                            <div
                              key={item.id}
                              className={`rounded-xl border p-2 ${
                                item.isRead
                                  ? "border-slate-100 bg-white"
                                  : "border-primary/20 bg-primary/5"
                              }`}
                            >
                              <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                              <p className="line-clamp-2 text-xs text-slate-500">{item.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 border-t border-slate-200 pt-2 text-xs font-semibold">
                        <Link className="text-primary hover:underline" to="/admin/notifications">
                          See all announcements
                        </Link>
                      </div>
                    </MotionDiv>
                  </div>
                ) : null}
              </AnimatePresence>
            </div>
            <div className="relative group">
              <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {initials || "A"}
                </span>
                <span className="hidden sm:inline">{displayName}</span>
              </button>
              <div className="pointer-events-none absolute right-0 mt-3 w-40 rounded-2xl border border-slate-200 bg-white p-2 text-sm text-slate-600 opacity-0 shadow-xl transition group-hover:pointer-events-auto group-hover:opacity-100">
                <Link className="block rounded-xl px-3 py-2 hover:bg-slate-100" to="/admin/settings">
                  Profile
                </Link>
                <Link className="block rounded-xl px-3 py-2 hover:bg-slate-100" to="/admin/settings">
                  Settings
                </Link>
                <button
                  className="block w-full rounded-xl px-3 py-2 text-left hover:bg-slate-100"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 overflow-x-hidden p-4 sm:p-6">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;

