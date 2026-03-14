import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

const slide = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.3 } },
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [otpTimer, setOtpTimer] = useState(60);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (step !== 2 || otpTimer <= 0) return;
    const timer = setTimeout(() => setOtpTimer((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpTimer, step]);

  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 6) score += 1;
    if (/[A-Z]/.test(password) || /\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password) || password.length >= 10) score += 1;
    return score;
  }, [password]);

  const strengthLabel =
    strength <= 1 ? "Weak" : strength === 2 ? "Medium" : "Strong";

  const validateEmail = () => {
    const nextErrors = {};
    if (!email.trim()) nextErrors.email = "Email is required.";
    else if (!emailRegex.test(email)) nextErrors.email = "Enter a valid email.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateOtp = () => {
    const code = otp.join("");
    if (code.length < 6) {
      setErrors({ otp: "Enter the 6-digit code." });
      return false;
    }
    setErrors({});
    return true;
  };

  const validatePassword = () => {
    const nextErrors = {};
    if (!password) nextErrors.password = "Password is required.";
    else if (password.length < 6)
      nextErrors.password = "Password must be at least 6 characters.";
    if (!confirmPassword) nextErrors.confirmPassword = "Confirm password.";
    else if (confirmPassword !== password)
      nextErrors.confirmPassword = "Passwords do not match.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSend = (event) => {
    event.preventDefault();
    if (!validateEmail()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(2);
      setOtp(Array(6).fill(""));
      setOtpTimer(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 0);
    }, 700);
  };

  const handleVerify = (event) => {
    event.preventDefault();
    if (!validateOtp()) return;
    setStep(3);
  };

  const handleReset = (event) => {
    event.preventDefault();
    if (!validatePassword()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    }, 900);
  };

  const handleOtpChange = (value, index) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && otpRefs.current[index + 1]) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (event, index) => {
    if (event.key === "Backspace" && !otp[index] && otpRefs.current[index - 1]) {
      otpRefs.current[index - 1].focus();
    }
  };

  const resendOtp = () => {
    if (otpTimer > 0) return;
    setOtp(Array(6).fill(""));
    setOtpTimer(60);
    setErrors({});
    setTimeout(() => otpRefs.current[0]?.focus(), 0);
  };

  return (
    <main className="min-h-screen bg-[#f0f4ff]">
      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                "radial-gradient(#cdd9ff 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
        </div>
        <div className="relative w-full max-w-[440px] rounded-3xl bg-white p-8 shadow-2xl">
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((dot) => (
              <span
                key={dot}
                className={`h-2.5 w-2.5 rounded-full ${
                  step === dot ? "bg-primary" : "bg-slate-200"
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.form
                key="step1"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={slide}
                onSubmit={handleSend}
                className="mt-8 space-y-6"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
                    <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v7a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-7a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z" />
                  </svg>
                </div>
                <div>
                  <h1 className="font-heading text-3xl text-slate-900">
                    Forgot your password?
                  </h1>
                  <p className="mt-2 text-sm text-slate-600">
                    Enter your email and we&apos;ll send you a reset code.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="you@example.com"
                  />
                  {errors.email && (
                    <p className="mt-2 text-xs text-accent">{errors.email}</p>
                  )}
                </div>
                <button type="submit" className="btn-primary w-full">
                  {loading ? "Sending..." : "Send Reset Code"}
                </button>
                <Link
                  to="/login"
                  className="block text-center text-sm font-semibold text-primary"
                >
                  Back to login
                </Link>
              </motion.form>
            )}

            {step === 2 && (
              <motion.form
                key="step2"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={slide}
                onSubmit={handleVerify}
                className="mt-8 space-y-6"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
                    <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 2 8 5 8-5H4zm0 8h16V10l-8 5-8-5v6z" />
                  </svg>
                </div>
                <div>
                  <h1 className="font-heading text-3xl text-slate-900">
                    Check your email
                  </h1>
                  <p className="mt-2 text-sm text-slate-600">
                    We sent a 6-digit code to{" "}
                    <span className="font-semibold text-slate-900">{email}</span>.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {otp.map((value, index) => (
                    <input
                      key={`otp-${index}`}
                      ref={(el) => {
                        otpRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={value}
                      onChange={(event) =>
                        handleOtpChange(event.target.value, index)
                      }
                      onKeyDown={(event) => handleOtpKeyDown(event, index)}
                      className="h-12 w-12 rounded-xl border border-slate-200 bg-white text-center text-lg font-semibold text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  ))}
                </div>
                {errors.otp && (
                  <p className="text-xs text-accent">{errors.otp}</p>
                )}
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Resend OTP in {otpTimer}s</span>
                  <button
                    type="button"
                    className="font-semibold text-primary disabled:text-slate-400"
                    onClick={resendOtp}
                    disabled={otpTimer > 0}
                  >
                    Resend
                  </button>
                </div>
                <button type="submit" className="btn-primary w-full">
                  Verify Code
                </button>
                <button
                  type="button"
                  className="text-sm font-semibold text-primary"
                  onClick={() => setStep(1)}
                >
                  Wrong email?
                </button>
              </motion.form>
            )}

            {step === 3 && (
              <motion.form
                key="step3"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={slide}
                onSubmit={handleReset}
                className="mt-8 space-y-6"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
                    <path d="M12 2a7 7 0 0 0-7 7v3h14V9a7 7 0 0 0-7-7zm-5 12h10v7H7v-7zm5-8a4 4 0 0 1 4 4H8a4 4 0 0 1 4-4z" />
                  </svg>
                </div>
                <div>
                  <h1 className="font-heading text-3xl text-slate-900">
                    Set new password
                  </h1>
                  <p className="mt-2 text-sm text-slate-600">
                    Create a new password to secure your account.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Create a new password"
                  />
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <div className="flex-1 rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${
                          strength <= 1
                            ? "w-1/3 bg-accent/70"
                            : strength === 2
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
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Confirm password"
                  />
                  {errors.confirmPassword && (
                    <p className="mt-2 text-xs text-accent">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
                <button type="submit" className="btn-primary w-full">
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
                {success && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                      ✓
                    </span>
                    Password updated. Redirecting to login...
                  </div>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

export default ForgotPassword;
