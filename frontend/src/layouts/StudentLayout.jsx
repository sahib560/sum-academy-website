import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  FiAward,
  FiBell,
  FiBookOpen,
  FiClipboard,
  FiCompass,
  FiCreditCard,
  FiGrid,
  FiHelpCircle,
  FiLogOut,
  FiMenu,
  FiSettings,
  FiUser,
} from "react-icons/fi";
import { logout } from "../services/auth.service.js";
import { useAuth } from "../hooks/useAuth.js";
import { getMyAnnouncements } from "../services/admin.service.js";
import { useSettings } from "../hooks/useSettings.js";

const MotionDiv = motion.div;

const navItems = [
  { label: "Dashboard", to: "/student/dashboard", icon: "grid" },
  { label: "My Classes", to: "/student/courses", icon: "book" },
  { label: "Explore Classes", to: "/student/explore", icon: "compass" },
  { label: "Certificates", to: "/student/certificates", icon: "award" },
  { label: "Quizzes", to: "/student/quizzes", icon: "clipboard" },
  { label: "Payments", to: "/student/payments", icon: "credit" },
  { label: "Announcements", to: "/student/announcements", icon: "bell" },
  { label: "Help & Support", to: "/student/help", icon: "help" },
  { label: "Settings", to: "/student/settings", icon: "settings" },
];

const mobileTabs = [
  { label: "Dashboard", to: "/student/dashboard", icon: "grid" },
  { label: "Classes", to: "/student/courses", icon: "book" },
  { label: "Quizzes", to: "/student/quizzes", icon: "clipboard" },
  { label: "Explore", to: "/student/explore", icon: "compass" },
  { label: "Profile", to: "/student/settings", icon: "user" },
];

const iconMap = {
  grid: <FiGrid className="h-4 w-4" />,
  book: <FiBookOpen className="h-4 w-4" />,
  compass: <FiCompass className="h-4 w-4" />,
  award: <FiAward className="h-4 w-4" />,
  clipboard: <FiClipboard className="h-4 w-4" />,
  credit: <FiCreditCard className="h-4 w-4" />,
  bell: <FiBell className="h-4 w-4" />,
  help: <FiHelpCircle className="h-4 w-4" />,
  settings: <FiSettings className="h-4 w-4" />,
  user: <FiUser className="h-4 w-4" />,
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
    queryKey: ["my-announcements", "student", userProfile?.uid],
    queryFn: getMyAnnouncements,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
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
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
      <div
        className={`fixed inset-y-0 left-0 z-[70] flex w-[260px] flex-col bg-white shadow-lg transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
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
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 flex w-full items-center justify-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <FiLogOut className="h-4 w-4" />
            <span>Logout</span>
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

      <header className="sticky top-0 z-30 flex min-w-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 lg:ml-[260px] lg:px-6">
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
          <h1 className="truncate font-heading text-2xl text-slate-900">
            {pageTitle}
          </h1>
          </div>
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
                      <Link className="text-primary hover:underline" to="/student/notifications">
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

      <main className="min-h-screen min-w-0 overflow-x-hidden px-4 pb-20 pt-6 lg:ml-[260px] lg:px-6 lg:pb-6">
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
                `flex items-center justify-center rounded-xl px-2 py-2 ${
                  isActive ? "text-primary" : "text-slate-400"
                }`
              }
              aria-label={tab.label}
              title={tab.label}
            >
              <span className="text-lg">{iconMap[tab.icon]}</span>
              <span className="sr-only">{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default StudentLayout;
