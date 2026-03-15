import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import logo from "../../assets/logo.jpeg";
import { useSiteSettings } from "../../context/SiteSettingsContext.jsx";
import {
  registerWithEmail,
  loginWithGoogle,
} from "../../services/auth.service.js";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.3 } },
};

const benefits = [
  "Access 50+ Courses",
  "Learn from Expert Teachers",
  "Get Certified",
  "Mobile App Access",
  "Pakistani Payment Methods",
];

const initialForm = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  phoneNumber: "",
  fatherName: "",
  fatherPhone: "",
  fatherOccupation: "",
  address: "",
  district: "",
  domicile: "",
  caste: "",
  terms: false,
};

const phoneRegex = /^\+92\d{10}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Register() {
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [toastState, setToastState] = useState(null);
  const logoSrc = settings.general.logoPreview || logo;
  const siteName = settings.general.siteName || "SUM Academy";
  const toast = {
    success: (message) => setToastState({ type: "success", message }),
    error: (message) => setToastState({ type: "error", message }),
  };
  const fullName = form.fullName.trim();
  const email = form.email.trim();
  const password = form.password;
  const phoneNumber = form.phoneNumber.trim();

  useEffect(() => {
    if (!toastState) return;
    const timer = setTimeout(() => setToastState(null), 2500);
    return () => clearTimeout(timer);
  }, [toastState]);

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (form.password.length >= 6) score += 1;
    if (/[A-Z]/.test(form.password) || /\d/.test(form.password)) score += 1;
    if (/[^A-Za-z0-9]/.test(form.password) || form.password.length >= 10)
      score += 1;
    return score;
  }, [form.password]);

  const strengthLabel =
    passwordStrength <= 1 ? "Weak" : passwordStrength === 2 ? "Medium" : "Strong";

  const validate = () => {
    const nextErrors = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Name is required.";
    if (!form.fatherName.trim()) nextErrors.fatherName = "Father's name required.";
    if (!form.phoneNumber.trim()) {
      nextErrors.phoneNumber = "Phone number is required.";
    } else if (!phoneRegex.test(form.phoneNumber.trim())) {
      nextErrors.phoneNumber = "Use +92XXXXXXXXXX format.";
    }
    if (!form.fatherPhone.trim()) {
      nextErrors.fatherPhone = "Father's phone is required.";
    } else if (!phoneRegex.test(form.fatherPhone.trim())) {
      nextErrors.fatherPhone = "Use +92XXXXXXXXXX format.";
    }
    if (!form.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!emailRegex.test(form.email)) {
      nextErrors.email = "Enter a valid email.";
    }
    if (!form.password) {
      nextErrors.password = "Password is required.";
    } else if (form.password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    }
    if (!form.confirmPassword) {
      nextErrors.confirmPassword = "Confirm your password.";
    } else if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    if (!form.terms) nextErrors.terms = "You must accept terms.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError("");

    try {
      const registeredUser = await registerWithEmail({
        fullName,
        email,
        password,
        phoneNumber,
        fatherName: form.fatherName.trim(),
        fatherPhone: form.fatherPhone.trim(),
        fatherOccupation: form.fatherOccupation.trim(),
        address: form.address.trim(),
        district: form.district.trim(),
        domicile: form.domicile.trim(),
        caste: form.caste.trim(),
      });
      toast.success("Account created successfully! Welcome to SUM Academy");
      const nextRole = registeredUser?.role || "student";
      if (nextRole === "admin") {
        navigate("/admin/dashboard");
      } else if (nextRole === "teacher") {
        navigate("/teacher/dashboard");
      } else {
        navigate("/student/dashboard");
      }
    } catch (error) {
      console.error("Registration error:", error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Registration failed. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const result = await loginWithGoogle();
      if (!result) return;
      const role = result?.user?.role || result?.role || result?.data?.role;
      toast.success("Welcome to SUM Academy!");
      if (role === "admin") navigate("/admin/dashboard");
      else if (role === "teacher") navigate("/teacher/dashboard");
      else navigate("/student/dashboard");
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Google sign in failed";
      toast.error(message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="grid min-h-screen lg:grid-cols-[3fr_2fr]">
        <div className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-primary/20">
                  <img
                    src={logoSrc}
                    alt={`${siteName} logo`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
                  {siteName}
                </p>
                <h1 className="mt-2 font-heading text-3xl text-slate-900">
                  Create Account
                </h1>
              </div>
            </div>

            <motion.form
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              onSubmit={handleSubmit}
              className="mt-8 space-y-5"
            >
              {error && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {error}
                </div>
              )}
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Full Name
                </label>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <path d="M12 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm-6 8a6 6 0 1 1 12 0H6z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(event) =>
                      setForm({ ...form, fullName: event.target.value })
                    }
                    className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Student name"
                  />
                </div>
                {errors.fullName && (
                  <p className="mt-2 text-xs text-accent">{errors.fullName}</p>
                )}
              </div>
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
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm({ ...form, password: event.target.value })
                  }
                  className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Create a password"
                />
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <div className="flex-1 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${
                        passwordStrength <= 1
                          ? "w-1/3 bg-accent/70"
                          : passwordStrength === 2
                          ? "w-2/3 bg-primary/70"
                          : "w-full bg-emerald-400"
                      }`}
                    />
                  </div>
                  <span>{strengthLabel}</span>
                </div>
                {errors.password && (
                  <p className="mt-2 text-xs text-accent">{errors.password}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    setForm({ ...form, confirmPassword: event.target.value })
                  }
                  className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Confirm password"
                />
                {errors.confirmPassword && (
                  <p className="mt-2 text-xs text-accent">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={form.phoneNumber}
                  onChange={(event) =>
                    setForm({ ...form, phoneNumber: event.target.value })
                  }
                  className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="+92XXXXXXXXXX"
                />
                {errors.phoneNumber && (
                  <p className="mt-2 text-xs text-accent">{errors.phoneNumber}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Father&apos;s Name
                </label>
                <input
                  type="text"
                  value={form.fatherName}
                  onChange={(event) =>
                    setForm({ ...form, fatherName: event.target.value })
                  }
                  className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Father's name"
                />
                {errors.fatherName && (
                  <p className="mt-2 text-xs text-accent">{errors.fatherName}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Father&apos;s Phone
                </label>
                <input
                  type="text"
                  value={form.fatherPhone}
                  onChange={(event) =>
                    setForm({ ...form, fatherPhone: event.target.value })
                  }
                  className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="+92XXXXXXXXXX"
                />
                {errors.fatherPhone && (
                  <p className="mt-2 text-xs text-accent">{errors.fatherPhone}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Father&apos;s Occupation
                  </label>
                  <input
                    type="text"
                    value={form.fatherOccupation}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        fatherOccupation: event.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Occupation"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Address
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(event) =>
                      setForm({ ...form, address: event.target.value })
                    }
                    className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Full address"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    District
                  </label>
                  <input
                    type="text"
                    value={form.district}
                    onChange={(event) =>
                      setForm({ ...form, district: event.target.value })
                    }
                    className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="District"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Domicile
                  </label>
                  <input
                    type="text"
                    value={form.domicile}
                    onChange={(event) =>
                      setForm({ ...form, domicile: event.target.value })
                    }
                    className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Domicile"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Caste
                  </label>
                  <input
                    type="text"
                    value={form.caste}
                    onChange={(event) =>
                      setForm({ ...form, caste: event.target.value })
                    }
                    className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Caste"
                  />
                </div>
              </div>


              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  checked={form.terms}
                  onChange={(event) =>
                    setForm({ ...form, terms: event.target.checked })
                  }
                />
                I agree to the{" "}
                <Link to="/terms" className="font-semibold text-primary">
                  Terms & Conditions
                </Link>
              </label>
              {errors.terms && (
                <p className="text-xs text-accent">{errors.terms}</p>
              )}

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Creating account...
                  </span>
                ) : (
                  "Create Account"
                )}
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
                  {googleLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
                  ) : (
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
                  )}
                  {googleLoading ? "Signing in..." : "Continue with Google"}
                </button>
              </div>

              <p className="text-sm text-slate-600">
                Already have an account?{" "}
                <Link to="/login" className="font-semibold text-primary">
                  Sign In
                </Link>
              </p>
            </motion.form>
          </div>
        </div>

        <div className="relative hidden items-center justify-center bg-dark px-10 py-12 text-white lg:flex">
          <div className="absolute inset-0 opacity-60">
            <div className="absolute -left-20 top-10 h-48 w-48 rounded-full bg-primary/30 blur-[100px]" />
            <div className="absolute bottom-10 right-0 h-48 w-48 rounded-full bg-accent/30 blur-[100px]" />
          </div>
          <div className="relative z-10 max-w-sm">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-primary/40">
              <img
                src={logoSrc}
                alt={`${siteName} logo`}
                className="h-full w-full object-cover"
              />
            </div>
            <h2 className="mt-4 font-heading text-3xl">{siteName}</h2>
            <p className="mt-3 text-sm text-slate-300">
              Build your future with modern learning and verified credentials.
            </p>
            <div className="mt-8 space-y-3 text-sm text-slate-200">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-accent">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <path d="M9.6 16.4 5.5 12.3l1.4-1.4 2.7 2.7 7-7 1.4 1.4-8.4 8.4z" />
                    </svg>
                  </span>
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {toastState && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl ${
            toastState.type === "success"
              ? "bg-emerald-500 text-white"
              : "bg-slate-900 text-white"
          }`}
        >
          {toastState.message}
        </div>
      )}
    </main>
  );
}

export default Register;
