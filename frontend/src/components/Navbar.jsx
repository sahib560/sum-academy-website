import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import logo from "../assets/logo.jpeg";
import { useSettings } from "../hooks/useSettings.js";

const navLinks = [
  { label: "Home", to: "/" },
  { label: "Courses", to: "/courses" },
  { label: "Teachers", to: "/teachers" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
];

function Navbar() {
  const { settings } = useSettings();
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("sum-theme");
    const resolvedTheme = savedTheme === "dark" ? "dark" : "light";
    setTheme(resolvedTheme);
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    localStorage.setItem("sum-theme", resolvedTheme);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("sum-theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  const isDark = theme === "dark";
  const headerClasses = [
    "fixed left-0 right-0 top-0 z-50 transition-all duration-300",
    isScrolled
      ? isDark
        ? "border-b border-white/10 bg-dark/95 shadow-lg shadow-black/70 backdrop-blur-xl"
        : "border-b border-slate-200/60 bg-white/90 shadow-lg shadow-slate-200/70 backdrop-blur-xl"
      : isDark
      ? "bg-dark/80 backdrop-blur lg:bg-transparent"
      : "bg-transparent",
  ].join(" ");

  const menuPanelClasses = [
    "mx-4 mb-5 rounded-2xl border p-5 shadow-xl backdrop-blur sm:mx-6",
    isDark
      ? "border-white/10 bg-dark/95 text-white shadow-black/50"
      : "border-slate-200/70 bg-white/90 text-slate-900 shadow-slate-200/60",
  ].join(" ");

  const containerClasses = [
    "mx-auto flex max-w-7xl items-center justify-between px-4 transition-all duration-300 sm:px-6 lg:px-8",
    isScrolled ? "py-3" : "py-5",
  ].join(" ");

  const closeMenu = () => setMenuOpen(false);
  const logoSrc = settings.general.logoUrl || logo;
  const siteName = settings.general.siteName || "SUM Academy";
  const navbarLabels = {
    navbarLmsLabel: "LMS Login",
    navbarSignInLabel: "Sign In",
    navbarGetStartedLabel: "Get Started",
  };

  const handleAppDownloadClick = () => {
    toast.success("something is coming soon");
  };

  return (
    <header className={headerClasses}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { borderRadius: "12px", fontFamily: "DM Sans, sans-serif" },
        }}
      />
      <nav className={containerClasses} aria-label="Primary">
        <Link to="/" className="flex items-center gap-3" onClick={closeMenu}>
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg shadow-primary/30">
            <img
              src={logoSrc}
              alt={`${siteName} logo`}
              className="h-full w-full object-cover"
            />
          </span>
          <span className="font-heading text-lg tracking-wide text-slate-900 dark:text-white">
            {siteName}
          </span>
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? "text-primary dark:text-white" : ""}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            type="button"
            onClick={handleAppDownloadClick}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:-translate-y-0.5 hover:border-primary hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M12 3a1 1 0 0 1 1 1v8.6l2.3-2.3 1.4 1.4-4.7 4.7-4.7-4.7 1.4-1.4L11 12.6V4a1 1 0 0 1 1-1zm-7 14h14v2H5v-2z" />
            </svg>
            Download App
          </button>
          <Link to="/lms-login" className="btn-lms">
            {navbarLabels.navbarLmsLabel || "LMS Login"}
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:-translate-y-0.5 hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-white"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <Link to="/lms-login" className="btn-outline">
            {navbarLabels.navbarSignInLabel || "Sign In"}
          </Link>
          <Link to="/register" className="btn-primary">
            {navbarLabels.navbarGetStartedLabel || "Get Started"}
          </Link>
        </div>

        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/70 text-slate-900 shadow-sm backdrop-blur lg:hidden dark:border-white/10 dark:bg-white/5 dark:text-white"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span
            className={`absolute h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
              menuOpen ? "translate-y-0 rotate-45" : "-translate-y-2"
            }`}
          />
          <span
            className={`absolute h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
              menuOpen ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`absolute h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
              menuOpen ? "translate-y-0 -rotate-45" : "translate-y-2"
            }`}
          />
        </button>
      </nav>

      <div
        className={`overflow-hidden transition-all duration-300 lg:hidden ${
          menuOpen ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className={menuPanelClasses}>
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={closeMenu}
                className={({ isActive }) =>
                  `nav-link text-base ${
                    isDark ? "text-slate-100 hover:text-white" : ""
                  } ${isActive ? "text-primary dark:text-white" : ""}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleAppDownloadClick}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:-translate-y-0.5 hover:text-primary dark:border-white/10 dark:bg-white/10 dark:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M12 3a1 1 0 0 1 1 1v8.6l2.3-2.3 1.4 1.4-4.7 4.7-4.7-4.7 1.4-1.4L11 12.6V4a1 1 0 0 1 1-1zm-7 14h14v2H5v-2z" />
              </svg>
              Download App
            </button>
            <Link to="/lms-login" className="btn-lms" onClick={closeMenu}>
              {navbarLabels.navbarLmsLabel || "LMS Login"}
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className={`inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:-translate-y-0.5 hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-white ${
                isDark ? "border-white/10 bg-white/10 text-white" : ""
              }`}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <Link to="/login" className="btn-outline" onClick={closeMenu}>
              {navbarLabels.navbarSignInLabel || "Sign In"}
            </Link>
            <Link to="/register" className="btn-primary" onClick={closeMenu}>
              {navbarLabels.navbarGetStartedLabel || "Get Started"}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
