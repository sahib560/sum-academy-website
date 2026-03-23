import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import logo from "../../assets/logo.jpeg";
import { useSiteSettings } from "../../context/SiteSettingsContext.jsx";
import { loginWithEmail, loginWithGoogle } from "../../services/auth.service.js";
import SplashScreen from "../../components/SplashScreen.jsx";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const MIN_SPLASH_MS = 1200;

function Login() {
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    remember: false,
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState("");
  const [showContactAdmin, setShowContactAdmin] = useState(false);
  const logoSrc = settings.general.logoPreview || logo;
  const siteName = settings.general.siteName || "SUM Academy";

  const getReadableLoginError = (err) => {
    const code = err?.code || "";
    if (code === "auth/invalid-credential") {
      return "Invalid email or password.";
    }
    if (code === "auth/user-disabled") {
      return "Your account has been disabled. Contact admin.";
    }
    if (code === "auth/too-many-requests") {
      return "Too many attempts. Please try again after some time.";
    }
    return null;
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const validate = () => {
    const nextErrors = {};
    if (!form.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = "Enter a valid email.";
    }
    if (!form.password) {
      nextErrors.password = "Password is required.";
    } else if (form.password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const ensureMinSplashTime = async (startedAt) => {
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_SPLASH_MS) {
      await new Promise((resolve) => {
        setTimeout(resolve, MIN_SPLASH_MS - elapsed);
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    const startedAt = Date.now();
    setLoading(true);
    setError("");
    setShowContactAdmin(false);
    try {
      const userData = await loginWithEmail(form.email, form.password);
      await ensureMinSplashTime(startedAt);
      setToast({ type: "success", message: "Welcome back!" });
      const nextRole = userData?.role || "student";
      if (nextRole === "admin") {
        navigate("/admin/dashboard");
      } else if (nextRole === "teacher") {
        navigate("/teacher/dashboard");
      } else {
        navigate("/student/dashboard");
      }
    } catch (error) {
      await ensureMinSplashTime(startedAt);
      const errData = error?.response?.data;
      const errCode = errData?.errors?.code;
      if (errCode === "DEVICE_IP_MISMATCH") {
        setToast({
          type: "error",
          message: "You are trying to login from another device or IP!",
        });
        setError(
          "You are trying to login from another device or network. Please contact your admin or teacher to restore access."
        );
        setShowContactAdmin(true);
      } else if (errCode === "FIREBASE_CREDENTIALS_ERROR") {
        const message =
          "Server Firebase credentials are invalid. Please contact admin.";
        setToast({ type: "error", message });
        setError(message);
      } else {
        const firebaseMessage = getReadableLoginError(error);
        const message =
          firebaseMessage ||
          errData?.error ||
          errData?.message ||
          error?.message ||
          "Login failed. Please try again.";
        setToast({
          type: "error",
          message,
        });
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const startedAt = Date.now();
    setGoogleLoading(true);
    setError("");
    setShowContactAdmin(false);
    try {
      const result = await loginWithGoogle();
      await ensureMinSplashTime(startedAt);
      if (!result) return;
      const role = result?.user?.role || result?.role || result?.data?.role;
      setToast({ type: "success", message: "Welcome to SUM Academy!" });
      if (role === "admin") navigate("/admin/dashboard");
      else if (role === "teacher") navigate("/teacher/dashboard");
      else navigate("/student/dashboard");
    } catch (error) {
      await ensureMinSplashTime(startedAt);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Google sign in failed";
      setToast({
        type: "error",
        message,
      });
      setError(message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white lg:h-screen lg:overflow-hidden">
      {(loading || googleLoading) && (
        <SplashScreen
          message="Signing you in..."
          subMessage="Verifying your secure academy access"
        />
      )}

      <div className="grid min-h-screen lg:h-screen lg:grid-cols-[3fr_2fr]">
        <div className="flex items-center justify-center px-6 py-12 sm:px-10 lg:h-screen lg:overflow-y-auto">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="w-full max-w-md lg:my-auto"
          >
            <div className="flex flex-col items-center text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-primary/20">
                <img
                  src={logoSrc}
                  alt={`${siteName} logo`}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-500">
                {siteName}
              </p>
              <h1 className="mt-3 font-heading text-3xl text-slate-900 dark:text-slate-900">
                Welcome Back
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-600">
                Log in to continue your learning journey.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {error && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {error}
                </div>
              )}
              {showContactAdmin && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="mb-2 text-sm font-medium text-red-700">
                    Device or IP mismatch detected
                  </p>
                  <p className="mb-3 text-xs text-red-600">
                    Your account is locked to your registered device and IP. Contact
                    admin to update your access.
                  </p>
                  <a
                    href="mailto:admin@sumacademy.com"
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs text-white transition-colors hover:bg-red-700"
                  >
                    Contact Admin
                  </a>
                </div>
              )}
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Email
                </label>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 2 8 5 8-5H4zm0 8h16V10l-8 5-8-5v6z" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                    className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="you@example.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-2 text-xs text-accent">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Password
                </label>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v7a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-7a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) =>
                      setForm({ ...form, password: event.target.value })
                    }
                    className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-12 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                        <path d="M12 5c5 0 9.3 3.1 11 7-1.7 3.9-6 7-11 7S2.7 15.9 1 12c1.7-3.9 6-7 11-7zm0 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                        <path d="M2 5.3 3.3 4 20 20.7 18.7 22l-3.2-3.2A12.4 12.4 0 0 1 12 19C7 19 2.7 15.9 1 12c.8-1.8 2-3.4 3.5-4.7L2 5.3zm9.9 9.9a3.5 3.5 0 0 1-3.1-3.1l3.1 3.1zm7.2-1.7-2.2-2.2a3.5 3.5 0 0 0-4.2-4.2L9.3 6.4A8.7 8.7 0 0 1 12 5c5 0 9.3 3.1 11 7-.9 2.1-2.5 4-4.6 5.5z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-2 text-xs text-accent">{errors.password}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    checked={form.remember}
                    onChange={(event) =>
                      setForm({ ...form, remember: event.target.checked })
                    }
                  />
                  Remember me
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-semibold text-primary hover:text-primary/80"
                >
                  Forgot Password
                </Link>
              </div>

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={loading}
              >
                {loading ? "Please wait..." : "Sign In"}
              </button>

              <div style={{ margin: "16px 0" }}>
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-sm text-gray-400">or</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {googleLoading ? "Please wait..." : "Continue with Google"}
                </button>
              </div>
            </form>

            <p className="mt-6 text-sm text-slate-600">
              Don&apos;t have an account?{" "}
              <Link to="/register" className="font-semibold text-primary">
                Sign Up
              </Link>
            </p>
          </motion.div>
        </div>

        <div className="relative hidden items-center justify-center bg-dark px-10 py-12 text-white lg:sticky lg:top-0 lg:flex lg:h-screen">
          <div className="absolute inset-0 opacity-60">
            <div className="absolute -left-20 top-10 h-48 w-48 rounded-full bg-primary/30 blur-[100px]" />
            <div className="absolute bottom-10 right-0 h-48 w-48 rounded-full bg-accent/30 blur-[100px]" />
          </div>
          <div className="relative z-10 max-w-sm text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-primary/40">
              <img
                src={logoSrc}
                alt={`${siteName} logo`}
                className="h-full w-full object-cover"
              />
            </div>
            <h2 className="mt-4 font-heading text-3xl text-white">{siteName}</h2>
            <p className="mt-3 text-sm text-slate-300">
              A modern LMS experience for Pakistan&apos;s academies.
            </p>
            <div className="mt-8 grid gap-4">
              {["500+ Students", "50+ Courses"].map((stat) => (
                <div
                  key={stat}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-semibold shadow-lg shadow-black/40 backdrop-blur"
                >
                  {stat}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl ${
            toast.type === "success"
              ? "bg-emerald-500 text-white"
              : "bg-slate-900 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}

export default Login;
