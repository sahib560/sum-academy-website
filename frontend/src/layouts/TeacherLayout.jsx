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
  { label: "Dashboard", to: "/teacher/dashboard", icon: "grid" },
  { label: "My Courses", to: "/teacher/courses", icon: "book" },
  { label: "Students", to: "/teacher/students", icon: "users" },
  { label: "Sessions", to: "/teacher/sessions", icon: "calendar" },
  { label: "Announcements", to: "/teacher/announcements", icon: "bell" },
  { label: "Settings", to: "/teacher/settings", icon: "settings" },
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
  users: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M7 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm10 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM2 20a5 5 0 0 1 10 0H2zm12 0a4 4 0 0 1 8 0h-8z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M7 2h2v3H7V2zm8 0h2v3h-2V2zM4 6h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 4v10h16V10H4z" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-6V11a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 4a7 7 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a7 7 0 0 0-1.7-1l-.4-2.6H9.6l-.4 2.6a7 7 0 0 0-1.7 1l-2.5-1-2 3.4 2.1 1.6a7 7 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1a7 7 0 0 0 1.7 1l.4 2.6h4.8l.4-2.6a7 7 0 0 0 1.7-1l2.5 1 2-3.4-2.1-1.6c.1-.3.1-.6.1-1z" />
    </svg>
  ),
};

function TeacherLayout() {
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
    queryKey: ["my-announcements", "teacher", userProfile?.uid],
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
    return match?.label || "Teacher Dashboard";
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
    "Teacher";
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
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
      <button
        type="button"
        className="fixed left-4 top-4 z-50 rounded-full border border-slate-200 bg-white p-2 shadow-lg lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="block h-4 w-4 rounded bg-primary" />
      </button>

      <div
        className={`fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col bg-white shadow-lg transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
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
              Teacher
            </span>
          </div>
        </div>

        <nav className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-400">
            Workspace
          </p>
          <div className="mt-3 grid gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/teacher/dashboard"}
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
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="border-t border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {initials || "T"}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">
                {displayName}
              </p>
              <button className="text-xs text-slate-500" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <div className="min-h-screen lg:pl-[240px]">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              {siteName}
            </p>
            <h1 className="font-heading text-2xl text-slate-900">
              {pageTitle}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden w-64 lg:block">
              <input
                type="text"
                placeholder="Search..."
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
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
                      <Link className="text-primary hover:underline" to="/teacher/notifications">
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
                  {initials || "T"}
                </span>
                <span className="hidden sm:inline">{displayName}</span>
              </button>
              <div className="pointer-events-none absolute right-0 mt-3 w-40 rounded-2xl border border-slate-200 bg-white p-2 text-sm text-slate-600 opacity-0 shadow-xl transition group-hover:pointer-events-auto group-hover:opacity-100">
                <Link className="block rounded-xl px-3 py-2 hover:bg-slate-100" to="/teacher/settings">
                  Profile
                </Link>
                <Link className="block rounded-xl px-3 py-2 hover:bg-slate-100" to="/teacher/settings">
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

        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default TeacherLayout;
