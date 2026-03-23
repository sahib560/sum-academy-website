import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout } from "../services/auth.service.js";
import { useAuth } from "../hooks/useAuth.js";

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
      { label: "Courses", to: "/admin/courses", icon: "book" },
      { label: "Classes", to: "/admin/classes", icon: "calendar" },
      { label: "Payments", to: "/admin/payments", icon: "card" },
    ],
  },
  {
    title: "Payments",
    items: [
      { label: "Transactions", to: "/admin/transactions", icon: "card" },
      { label: "Installments", to: "/admin/installments", icon: "clock" },
      { label: "Promo Codes", to: "/admin/promo-codes", icon: "tag" },
    ],
  },
  {
    title: "Content",
    items: [
      { label: "Certificates", to: "/admin/certificates", icon: "award" },
      { label: "Announcements", to: "/admin/announcements", icon: "bell" },
      { label: "Site Settings", to: "/admin/settings", icon: "settings" },
    ],
  },
];

const iconMap = {
  grid: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h5v8H3v-8zm7 5h11v3H10v-3zm0-5h11v3H10v-3z" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M4 19h16v2H2V3h2v16zm4-2H6V9h2v8zm6 0h-2V5h2v12zm6 0h-2v-6h2v6z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M7 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm10 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM2 20a5 5 0 0 1 10 0H2zm12 0a4 4 0 0 1 8 0h-8z" />
    </svg>
  ),
  teacher: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 3 1 9l11 6 9-4.9V17h2V9L12 3zm0 9.7L5.1 9 12 5.3 18.9 9 12 12.7z" />
    </svg>
  ),
  student: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 3 1 9l11 6 9-4.9V17h2V9L12 3z" />
      <path d="M5 12.3v4.2c0 2.2 3.1 4 7 4s7-1.8 7-4v-4.2l-7 3.8-7-3.8z" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M6 4h11a3 3 0 0 1 3 3v12a2 2 0 0 1-2 2H7a3 3 0 0 0-3 3V7a3 3 0 0 1 2-3z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M7 2h2v3H7V2zm8 0h2v3h-2V2zM4 6h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 4v10h16V10H4z" />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7zm3-1a1 1 0 0 0-1 1v2h16V7a1 1 0 0 0-1-1H6z" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm1 5v5l4 2-1 1-5-2.5V7h2z" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M3 12 12 3h7l2 2v7l-9 9-9-9zm14-5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
    </svg>
  ),
  award: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 2a6 6 0 1 0 0 12A6 6 0 0 0 12 2zm-3 14h6l2 6-5-2-5 2 2-6z" />
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

function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

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

  const displayName =
    userProfile?.name ||
    userProfile?.fullName ||
    userProfile?.email ||
    "Admin";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 font-body text-slate-900">
      <div className="lg:hidden">
        <button
          type="button"
          className="fixed left-4 top-4 z-50 rounded-full border border-slate-200 bg-white p-2 shadow-lg"
          onClick={() => setSidebarOpen(true)}
        >
          <span className="block h-4 w-4 rounded bg-primary" />
        </button>
      </div>

      <div
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-dark text-slate-200 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-20" : "w-[260px]"}`}
      >
        <div className="flex items-center justify-between px-5 py-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-white shadow-lg shadow-primary/40">
              S
            </span>
            {!collapsed && (
              <div>
                <p className="font-heading text-base text-white">SUM Academy</p>
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
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M8 6h13v2H8V6zm0 5h13v2H8v-2zm0 5h13v2H8v-2zM3 6h3v12H3V6z" />
            </svg>
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
                          ? "bg-primary text-white shadow-lg shadow-primary/30"
                          : "text-white/70 hover:bg-primary hover:text-white"
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
                <button className="text-xs text-white/60" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
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

      <div
        className={`min-h-screen transition-all duration-300 ${
          collapsed ? "lg:pl-20" : "lg:pl-[260px]"
        }`}
      >
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl text-slate-900">{pageTitle}</h1>
          </div>
          <div className="flex flex-1 items-center justify-end gap-4">
            <div className="relative hidden w-full max-w-xs lg:block">
              <input
                type="text"
                placeholder="Search..."
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                🔍
              </span>
            </div>
            <button className="relative rounded-full border border-slate-200 bg-white p-2 shadow-sm">
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-white">
                3
              </span>
              {iconMap.bell}
            </button>
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

        <main className="p-6">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
