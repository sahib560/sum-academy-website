import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { logout } from "../services/auth.service.js";
import { useAuth } from "../hooks/useAuth.js";
import { getMyAnnouncements } from "../services/admin.service.js";
import { useSettings } from "../hooks/useSettings.js";

const MotionDiv = motion.div;

const navItems = [
  { label: "Dashboard", to: "/student/dashboard", icon: "grid" },
  { label: "My Courses", to: "/student/courses", icon: "book" },
  { label: "Explore Courses", to: "/student/explore", icon: "compass" },
  { label: "Certificates", to: "/student/certificates", icon: "award" },
  { label: "Quizzes", to: "/student/quizzes", icon: "clipboard" },
  { label: "Payments", to: "/student/payments", icon: "credit" },
  { label: "Announcements", to: "/student/announcements", icon: "bell" },
  { label: "Attendance", to: "/student/attendance", icon: "calendar" },
  { label: "Help & Support", to: "/student/help", icon: "help" },
  { label: "Settings", to: "/student/settings", icon: "settings" },
];

const mobileTabs = [
  { label: "Dashboard", to: "/student/dashboard", icon: "grid" },
  { label: "My Courses", to: "/student/courses", icon: "book" },
  { label: "Explore", to: "/student/explore", icon: "compass" },
  { label: "Certificates", to: "/student/certificates", icon: "award" },
  { label: "Profile", to: "/student/settings", icon: "user" },
];

const iconMap = {
  grid: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h5v8H3v-8zm7 5h11v3H10v-3zm0-5h11v3H10v-3z" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M6 4h11a3 3 0 0 1 3 3v12a2 2 0 0 1-2 2H7a3 3 0 0 0-3 3V7a3 3 0 0 1 2-3z" />
    </svg>
  ),
  compass: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.9 6.1-1.9 5.1-5.1 1.9 1.9-5.1 5.1-1.9z" />
    </svg>
  ),
  award: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 2a6 6 0 0 1 6 6c0 2.2-1.2 4.2-3 5.2V22l-3-1.6L9 22v-8.8A6 6 0 0 1 12 2z" />
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M9 2h6a2 2 0 0 1 2 2h2v18H5V4h2a2 2 0 0 1 2-2zm0 4h6V4H9v2z" />
    </svg>
  ),
  credit: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M3 5h18a2 2 0 0 1 2 2v2H1V7a2 2 0 0 1 2-2zm-2 6h22v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-6zm4 2v2h6v-2H5z" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-6V11a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M7 2h2v3H7V2zm8 0h2v3h-2V2zM4 6h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 4v10h16V10H4z" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 15a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm1.1-6.1-.6.5v.6h-1.6v-1.3l1.2-1c.5-.4.8-.8.8-1.3a1.6 1.6 0 0 0-3.2 0H7.8a3.4 3.4 0 0 1 6.8 0c0 .9-.4 1.7-1.5 2.4z" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M19.4 13.5a7.8 7.8 0 0 0 .1-1.5 7.8 7.8 0 0 0-.1-1.5l2-1.5-2-3.4-2.4 1a7.5 7.5 0 0 0-2.6-1.5l-.4-2.5h-4l-.4 2.5a7.5 7.5 0 0 0-2.6 1.5l-2.4-1-2 3.4 2 1.5a7.8 7.8 0 0 0-.1 1.5 7.8 7.8 0 0 0 .1 1.5l-2 1.5 2 3.4 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5zM12 15.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4z" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.4 0-8 2-8 4.5V21h16v-2.5c0-2.5-3.6-4.5-8-4.5z" />
    </svg>
  ),
};

function StudentLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { settings } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  const announcementsQuery = useQuery({
    queryKey: ["my-announcements", "student", userProfile?.uid],
    queryFn: getMyAnnouncements,
    staleTime: 60 * 1000,
    enabled: Boolean(userProfile?.uid),
  });
  const notifications = announcementsQuery.data || [];
  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const pageTitle = useMemo(() => {
    const match = navItems.find((item) =>
      location.pathname.startsWith(item.to)
    );
    return match?.label || "Student Portal";
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
    "Student";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const enrolledCount = userProfile?.enrolledCourses?.length ?? 0;
  const siteName = settings.general?.siteName || "SUM Academy";
  const logoUrl = settings.general?.logoUrl || "";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div
        className={`fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col bg-white shadow-lg transition-transform duration-300 lg:flex ${
          sidebarOpen ? "translate-x-0" : "translate-x-0"
        }`}
      >
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-primary text-lg font-semibold text-white shadow-lg shadow-primary/30">
            {logoUrl ? (
              <img src={logoUrl} alt={`${siteName} logo`} className="h-full w-full object-cover" />
            ) : (
              "S"
            )}
          </div>
          <div>
            <p className="font-heading text-base text-slate-900">{siteName}</p>
            <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.3em] text-slate-500">
              Student Portal
            </span>
          </div>
        </div>

        <nav className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6">
          <div className="grid gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/student/dashboard"}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                      : "text-slate-700 hover:bg-slate-900 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-500 group-hover:bg-white/20 group-hover:text-white"
                      }`}
                    >
                      {iconMap[item.icon]}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.label === "Announcements" && unreadCount > 0 && (
                      <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="border-t border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {initials || "S"}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">{displayName}</p>
              <span className="text-xs text-slate-500">
                {enrolledCount} Courses
              </span>
            </div>
            <button
              className="rounded-full border border-slate-200 p-2 text-slate-500"
              onClick={handleLogout}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M10 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8v-2h8V6h-8V4zM4 12l4-4v3h8v2H8v3l-4-4z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 lg:ml-[260px] lg:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            {siteName}
          </p>
          <h1 className="font-heading text-2xl text-slate-900">
            {pageTitle}
          </h1>
        </div>
        <div className="flex items-center gap-3">
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
                <MotionDiv
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
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
                    <Link className="text-primary hover:underline" to="/student/notifications">
                      See all announcements
                    </Link>
                  </div>
                </MotionDiv>
              ) : null}
            </AnimatePresence>
          </div>
          <div className="relative group">
            <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                {initials || "S"}
              </span>
              <span className="hidden sm:inline">{displayName}</span>
            </button>
            <div className="pointer-events-none absolute right-0 mt-3 w-40 rounded-2xl border border-slate-200 bg-white p-2 text-sm text-slate-600 opacity-0 shadow-xl transition group-hover:pointer-events-auto group-hover:opacity-100">
              <Link
                className="block rounded-xl px-3 py-2 hover:bg-slate-100"
                to="/student/settings"
              >
                My Profile
              </Link>
              <Link
                className="block rounded-xl px-3 py-2 hover:bg-slate-100"
                to="/student/settings"
              >
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

      <main className="min-h-screen px-4 pb-20 pt-6 lg:ml-[260px] lg:px-6 lg:pb-6">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white px-4 pb-[env(safe-area-inset-bottom)] pt-2 lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobileTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === "/student/dashboard"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold ${
                  isActive ? "text-primary" : "text-slate-400"
                }`
              }
            >
              <span className="text-base">{iconMap[tab.icon]}</span>
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default StudentLayout;
