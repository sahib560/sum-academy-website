import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { FcGoogle } from "react-icons/fc";
import { FiCheck, FiEye, FiEyeOff, FiMail, FiUser } from "react-icons/fi";
import logo from "../../assets/logo.jpeg";
import { useSettings } from "../../hooks/useSettings.js";
import {
  registerWithEmail,
  beginGoogleRegistration,
  registerWithGoogle,
  sendRegistrationOtp,
  verifyRegistrationOtp,
} from "../../services/auth.service.js";
import SplashScreen from "../../components/SplashScreen.jsx";

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
const MIN_SPLASH_MS = 1200;

function Register() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpMode, setOtpMode] = useState(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [toastState, setToastState] = useState(null);
  const logoSrc = settings.general.logoUrl || logo;
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

  useEffect(() => {
    if (!otpStep || otpTimer <= 0) return;
    const timer = setTimeout(() => setOtpTimer((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpStep, otpTimer]);

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

  const ensureMinSplashTime = async (startedAt) => {
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_SPLASH_MS) {
      await new Promise((resolve) => {
        setTimeout(resolve, MIN_SPLASH_MS - elapsed);
      });
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Name is required.";
    if (!form.phoneNumber.trim()) {
      nextErrors.phoneNumber = "Phone number is required.";
    } else if (!phoneRegex.test(form.phoneNumber.trim())) {
      nextErrors.phoneNumber = "Use +92XXXXXXXXXX format.";
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

  const validateGoogle = () => {
    const nextErrors = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Name is required.";
    if (!form.phoneNumber.trim()) {
      nextErrors.phoneNumber = "Phone number is required.";
    } else if (!phoneRegex.test(form.phoneNumber.trim())) {
      nextErrors.phoneNumber = "Use +92XXXXXXXXXX format.";
    }
    if (!form.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!emailRegex.test(form.email)) {
      nextErrors.email = "Enter a valid email.";
    }
    if (!form.terms) nextErrors.terms = "You must accept terms.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const startedAt = Date.now();
    setLoading(true);
    setError("");

    try {
      if (otpMode === "google") {
        if (!validateGoogle()) {
          await ensureMinSplashTime(startedAt);
          return;
        }
        if (!pendingGoogleUser?.email) {
          throw new Error("Google registration session expired. Please try again.");
        }
        if (!/^\d{6}$/.test(otpCode.trim())) {
          await ensureMinSplashTime(startedAt);
          setError("Enter the 6-digit OTP sent to your email.");
          toast.error("Please enter a valid 6-digit OTP.");
          return;
        }

        const verifyData = await verifyRegistrationOtp(
          pendingGoogleUser.email,
          otpCode.trim()
        );
        const otpVerificationToken = verifyData?.otpVerificationToken;
        if (!otpVerificationToken) {
          throw new Error("OTP verification failed. Please try again.");
        }

        const registeredUser = await registerWithGoogle(otpVerificationToken, {
          fullName: form.fullName,
          phoneNumber: form.phoneNumber,
          fatherName: form.fatherName,
          fatherPhone: form.fatherPhone,
          fatherOccupation: form.fatherOccupation,
          address: form.address,
          district: form.district,
          domicile: form.domicile,
          caste: form.caste,
        });
        await ensureMinSplashTime(startedAt);
        toast.success("Account created successfully! Welcome to SUM Academy");
        const nextRole =
          registeredUser?.data?.user?.role ||
          registeredUser?.user?.role ||
          registeredUser?.role ||
          "student";
        if (nextRole === "admin") {
          navigate("/admin/dashboard");
        } else if (nextRole === "teacher") {
          navigate("/teacher/dashboard");
        } else {
          navigate("/student/dashboard");
        }
        return;
      }

      if (!validate()) return;

      if (!otpStep) {
        await sendRegistrationOtp(email, fullName);
        await ensureMinSplashTime(startedAt);
        setOtpStep(true);
        setOtpMode("email");
        setOtpCode("");
        setOtpTimer(60);
        toast.success("OTP sent to your email. Verify OTP to continue.");
        return;
      }

      if (!/^\d{6}$/.test(otpCode.trim())) {
        await ensureMinSplashTime(startedAt);
        setError("Enter the 6-digit OTP sent to your email.");
        toast.error("Please enter a valid 6-digit OTP.");
        return;
      }

      const verifyData = await verifyRegistrationOtp(email, otpCode.trim());
      const otpVerificationToken = verifyData?.otpVerificationToken;
      if (!otpVerificationToken) {
        throw new Error("OTP verification failed. Please try again.");
      }

      const registeredUser = await registerWithEmail(
        fullName,
        email,
        password,
        phoneNumber,
        otpVerificationToken,
        {
          fatherName: form.fatherName,
          fatherPhone: form.fatherPhone,
          fatherOccupation: form.fatherOccupation,
          address: form.address,
          district: form.district,
          domicile: form.domicile,
          caste: form.caste,
        }
      );
      await ensureMinSplashTime(startedAt);
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
      await ensureMinSplashTime(startedAt);
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

  const handleResendOtp = async () => {
    if (otpTimer > 0) return;
    try {
      setLoading(true);
      setError("");
      const targetEmail = otpMode === "google" ? pendingGoogleUser?.email : email;
      const targetName =
        otpMode === "google" ? pendingGoogleUser?.displayName || fullName : fullName;
      if (!targetEmail) {
        throw new Error("Email is required to resend OTP.");
      }
      await sendRegistrationOtp(targetEmail, targetName);
      setOtpCode("");
      setOtpTimer(60);
      toast.success("OTP resent successfully.");
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to resend OTP.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegistration = async () => {
    const startedAt = Date.now();
    setGoogleLoading(true);
    try {
      const googleUser = await beginGoogleRegistration();
      await ensureMinSplashTime(startedAt);
      if (!googleUser) return;

      setForm((prev) => ({
        ...prev,
        email: googleUser.email || prev.email,
        fullName:
          googleUser.displayName ||
          prev.fullName ||
          (googleUser.email ? googleUser.email.split("@")[0] : ""),
      }));

      await sendRegistrationOtp(
        googleUser.email,
        googleUser.displayName || googleUser.email?.split("@")[0] || ""
      );
      setPendingGoogleUser({
        uid: googleUser.uid,
        email: googleUser.email,
        displayName: googleUser.displayName || "",
      });
      setOtpMode("google");
      setOtpStep(true);
      setOtpCode("");
      setOtpTimer(60);
      toast.success("OTP sent to your email. Verify OTP to continue.");
    } catch (error) {
      await ensureMinSplashTime(startedAt);
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
    <main className="min-h-screen bg-white lg:h-screen lg:overflow-hidden">
      {(loading || googleLoading) && (
        <SplashScreen
          message="Creating your account..."
          subMessage="Securing your profile and setting up your classroom access"
        />
      )}

      <div className="grid min-h-screen lg:h-screen lg:grid-cols-[3fr_2fr]">
        <div className="flex items-center justify-center px-6 py-12 sm:px-10 lg:h-screen lg:items-start lg:overflow-y-auto">
          <div className="w-full max-w-md">
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
              <h1 className="mt-2 font-heading text-3xl text-slate-900 dark:text-slate-900">
                Create Account
              </h1>
            </div>

            <Motion.form
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
                    <FiUser className="h-5 w-5" />
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
                    <FiMail className="h-5 w-5" />
                  </span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => {
                      setForm({ ...form, email: event.target.value });
                      if (otpStep) {
                        setOtpStep(false);
                        setOtpCode("");
                        setOtpTimer(0);
                        setOtpMode(null);
                        setPendingGoogleUser(null);
                      }
                    }}
                    readOnly={otpMode === "google"}
                    disabled={otpMode === "google"}
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
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) =>
                      setForm({ ...form, password: event.target.value })
                    }
                    className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Create a password"
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
                <div className="relative mt-2">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={(event) =>
                      setForm({ ...form, confirmPassword: event.target.value })
                    }
                    className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Confirm password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? (
                      <FiEyeOff className="h-5 w-5" />
                    ) : (
                      <FiEye className="h-5 w-5" />
                    )}
                  </button>
                </div>
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
                  inputMode="numeric"
                  pattern="[0-9+]*"
                  onChange={(event) => {
                    const nextValue = event.target.value.replace(/[^0-9+]/g, "");
                    setForm({ ...form, phoneNumber: nextValue });
                  }}
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
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Father&apos;s Phone
                </label>
                <input
                  type="text"
                  value={form.fatherPhone}
                  inputMode="numeric"
                  pattern="[0-9+]*"
                  onChange={(event) => {
                    const nextValue = event.target.value.replace(/[^0-9+]/g, "");
                    setForm({ ...form, fatherPhone: nextValue });
                  }}
                  className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="+92XXXXXXXXXX"
                />
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

              {otpStep && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <label className="text-sm font-semibold text-slate-700">
                    Email OTP
                  </label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(event) =>
                      setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm tracking-[0.35em] text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="123456"
                    inputMode="numeric"
                    maxLength={6}
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Code sent to{" "}
                      {otpMode === "google" ? pendingGoogleUser?.email : email}
                    </span>
                    <button
                      type="button"
                      className="font-semibold text-primary disabled:text-slate-400"
                      onClick={handleResendOtp}
                      disabled={loading || otpTimer > 0}
                    >
                      {otpTimer > 0 ? `Resend in ${otpTimer}s` : "Resend OTP"}
                    </button>
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : otpStep
                  ? "Verify OTP & Create Account"
                  : "Send OTP"}
              </button>

              <div style={{ margin: "16px 0" }}>
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-sm text-gray-400">or</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleRegistration}
                  disabled={googleLoading}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50"
                >
                  <FcGoogle className="h-5 w-5" />
                  {googleLoading ? "Please wait..." : "Continue with Google"}
                </button>
              </div>

              <p className="text-sm text-slate-600">
                Already have an account?{" "}
                <Link to="/login" className="font-semibold text-primary">
                  Sign In
                </Link>
              </p>
            </Motion.form>
          </div>
        </div>

        <div className="relative hidden items-center justify-center bg-dark px-10 py-12 text-white lg:sticky lg:top-0 lg:flex lg:h-screen">
          <div className="absolute inset-0 opacity-60">
            <div className="absolute -left-20 top-10 h-48 w-48 rounded-full bg-primary/30 blur-[100px]" />
            <div className="absolute bottom-10 right-0 h-48 w-48 rounded-full bg-accent/30 blur-[100px]" />
          </div>
          <div className="relative z-10 max-w-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-primary/40">
              <img
                src={logoSrc}
                alt={`${siteName} logo`}
                className="h-full w-full object-cover"
              />
            </div>
            <h2 className="mt-4 font-heading text-3xl text-white">{siteName}</h2>
            <p className="mt-3 text-sm text-slate-300">
              Build your future with modern learning and verified credentials.
            </p>
            <div className="mt-8 space-y-3 text-sm text-slate-200">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-accent">
                    <FiCheck className="h-4 w-4" />
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
          className={`fixed left-6 top-6 z-50 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl ${
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



