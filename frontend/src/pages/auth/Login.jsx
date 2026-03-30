import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import toast from "react-hot-toast";
import { FcGoogle } from "react-icons/fc";
import { FiEye, FiEyeOff, FiLock, FiMail } from "react-icons/fi";
import logo from "../../assets/logo.jpeg";
import { useSettings } from "../../hooks/useSettings.js";
import { loginWithEmail, loginWithGoogle } from "../../services/auth.service.js";
import SplashScreen from "../../components/SplashScreen.jsx";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const MIN_SPLASH_MS = 1200;
const LOGIN_ALERT_STORAGE_KEY = "sumacademy:login-alert";
const LOGIN_ALERT_EVENT = "sumacademy:login-alert";

function Login() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    email: "",
    password: "",
    remember: false,
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [inlineToast, setInlineToast] = useState(null);
  const [error, setError] = useState("");
  const [showContactAdmin, setShowContactAdmin] = useState(false);
  const [alertType, setAlertType] = useState("");
  const logoSrc = settings.general.logoUrl || logo;
  const siteName = settings.general.siteName || "SUM Academy";

  useEffect(() => {
    if (!inlineToast) return;
    const timer = setTimeout(() => setInlineToast(null), 2500);
    return () => clearTimeout(timer);
  }, [inlineToast]);

  const consumeLoginAlert = () => {
    if (typeof window === "undefined") return false;
    const rawAlert = window.sessionStorage.getItem(LOGIN_ALERT_STORAGE_KEY);
    if (!rawAlert) return false;

    window.sessionStorage.removeItem(LOGIN_ALERT_STORAGE_KEY);

    let parsed = null;
    try {
      parsed = JSON.parse(rawAlert);
    } catch {
      parsed = null;
    }

    if (parsed?.type === "account_deactivated") {
      const message =
        parsed?.message ||
        "Your account has been deactivated by admin. Please contact admin.";
      setAlertType("account_deactivated");
      setInlineToast({
        type: "error",
        message: "Account deactivated",
      });
      setError(message);
      setShowContactAdmin(true);
      return true;
    }

    const message =
      parsed?.message ||
      "You are trying to login from another device or network.";
    const warning =
      parsed?.warning ||
      "Do not try again from another device/IP, otherwise your account may be blocked.";

    setInlineToast({
      type: "error",
      message:
        "Device/IP mismatch detected. One more wrong attempt may block your account.",
    });
    setAlertType("device_mismatch");
    setError(
      `${message} ${warning} Please contact your admin or teacher to restore access.`
    );
    setShowContactAdmin(true);
    return true;
  };

  useEffect(() => {
    const handleAlert = () => {
      consumeLoginAlert();
    };
    consumeLoginAlert();
    if (typeof window === "undefined") return;
    window.addEventListener(LOGIN_ALERT_EVENT, handleAlert);
    window.addEventListener("storage", handleAlert);
    return () => {
      window.removeEventListener(LOGIN_ALERT_EVENT, handleAlert);
      window.removeEventListener("storage", handleAlert);
    };
  }, [location.pathname]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const startedAt = Date.now();
    setLoading(true);
    setError("");
    setShowContactAdmin(false);
    setAlertType("");

    try {
      const result = await loginWithEmail(form.email, form.password);
      await ensureMinSplashTime(startedAt);
      console.log("Login result:", result);

      const userData = result?.data?.user || result?.user || result?.data;
      const userRole = userData?.role;

      if (!userRole) {
        setError("Login failed. Please try again.");
        toast.error("Login failed. Please try again.");
        return;
      }

      toast.success("Welcome back!");

      if (userRole === "admin") navigate("/admin/dashboard");
      else if (userRole === "teacher") navigate("/teacher/dashboard");
      else navigate("/student/dashboard");
    } catch (error) {
      await ensureMinSplashTime(startedAt);
      console.error("Login error full:", error);
      console.error("Response data:", error.response?.data);

      const status = error.response?.status;
      const errData = error.response?.data;
      const errCode = errData?.errors?.code;
      const errMsg =
        errData?.message ||
        errData?.error ||
        error.message ||
        "Login failed. Please try again.";

      if (errCode === "PENDING_APPROVAL") {
        setError(
          "Your account is pending admin approval. " +
            "Please wait — you will receive an email " +
            "when your account is activated."
        );
        toast.error("Account pending approval", { duration: 6000 });
      } else if (errCode === "ACCOUNT_DEACTIVATED") {
        setError(
          "Your account has been deactivated by admin. Please contact admin to reactivate access."
        );
        setShowContactAdmin(true);
        setAlertType("account_deactivated");
        toast.error("Account deactivated", { duration: 6000 });
      } else if (errCode === "DEVICE_MISMATCH" || errCode === "DEVICE_IP_MISMATCH") {
        const registered = errData?.errors?.registeredDevice || "your registered device";

        setError(
          "You are trying to login from a different device. " +
            "Please use " +
            registered +
            " or contact your admin or teacher to reset your device access."
        );
        setShowContactAdmin(true);
        setAlertType("device_mismatch");
        toast.error("Login blocked — wrong device detected", { duration: 6000 });
      } else if (status === 403) {
        setError(errMsg);
        toast.error(errMsg);
      } else if (status === 401) {
        setError("Invalid email or password. Please try again.");
        toast.error("Invalid email or password");
      } else if (status === 404) {
        setError("No account found with this email.");
        toast.error("Account not found");
      } else if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        setError("Wrong password. Please try again.");
        toast.error("Wrong password");
      } else if (error.code === "auth/user-not-found") {
        setError("No account found with this email.");
        toast.error("Account not found");
      } else if (error.code === "auth/too-many-requests") {
        setError(
          "Too many failed attempts. Account temporarily locked. Try again in 30 minutes."
        );
        toast.error("Too many attempts. Try again later.");
      } else {
        setError(errMsg);
        toast.error(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const result = await loginWithGoogle();
      if (!result) {
        setGoogleLoading(false);
        return;
      }
      const role = result?.data?.user?.role || result?.user?.role;
      toast.success("Welcome to SUM Academy!");
      if (role === "admin") navigate("/admin/dashboard");
      else if (role === "teacher") navigate("/teacher/dashboard");
      else navigate("/student/dashboard");
    } catch (error) {
      if (error.message) {
        toast.error(error.message, { duration: 5000 });
      }
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
          <Motion.div
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
                <div
                  style={{
                    background: "#fee2e2",
                    border: "1px solid #fca5a5",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    marginBottom: "16px",
                    color: "#991b1b",
                    fontSize: "14px",
                    lineHeight: "1.5",
                  }}
                >
                  {error}
                </div>
              )}
              {showContactAdmin && (
                <div
                  style={{
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    marginBottom: "16px",
                  }}
                >
                  <p
                    style={{
                      color: "#92400e",
                      fontSize: "13px",
                      marginBottom: "8px",
                    }}
                  >
                    {alertType === "account_deactivated"
                      ? "Your account has been deactivated. Contact admin to reactivate access."
                      : "Device not recognized. Contact admin to reset access."}
                  </p>
                  <a
                    href="mailto:admin@sumacademy.net"
                    style={{
                      display: "inline-block",
                      background: "#ff6f0f",
                      color: "white",
                      padding: "6px 16px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      textDecoration: "none",
                      fontWeight: "600",
                    }}
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
                    <FiMail className="h-5 w-5" />
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
                    <FiLock className="h-5 w-5" />
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
                      <FiEyeOff className="h-5 w-5" />
                    ) : (
                      <FiEye className="h-5 w-5" />
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
                  <FcGoogle className="h-5 w-5" />
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
          </Motion.div>
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

      {inlineToast && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl ${
            inlineToast.type === "success"
              ? "bg-emerald-500 text-white"
              : "bg-slate-900 text-white"
          }`}
        >
          {inlineToast.message}
        </div>
      )}
    </main>
  );
}

export default Login;



