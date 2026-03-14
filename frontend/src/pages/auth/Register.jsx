import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import logo from "../../assets/logo.jpeg";

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
  fatherName: "",
  caste: "",
  fatherOccupation: "",
  contactNo: "",
  fatherContact: "",
  district: "",
  address: "",
  email: "",
  password: "",
  confirmPassword: "",
  terms: false,
};

const phoneRegex = /^\+92\d{10}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [otpTimer, setOtpTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (step !== 2) return;
    if (otpTimer <= 0) return;
    const timer = setTimeout(() => setOtpTimer((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpTimer, step]);

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

  const validateStep1 = () => {
    const nextErrors = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Name is required.";
    if (!form.fatherName.trim()) nextErrors.fatherName = "Father's name required.";
    if (!form.caste.trim()) nextErrors.caste = "Caste is required.";
    if (!form.fatherOccupation.trim())
      nextErrors.fatherOccupation = "Occupation is required.";
    if (!form.contactNo.trim()) {
      nextErrors.contactNo = "Contact number is required.";
    } else if (!phoneRegex.test(form.contactNo.trim())) {
      nextErrors.contactNo = "Use +92XXXXXXXXXX format.";
    }
    if (!form.fatherContact.trim()) {
      nextErrors.fatherContact = "Father's contact is required.";
    } else if (!phoneRegex.test(form.fatherContact.trim())) {
      nextErrors.fatherContact = "Use +92XXXXXXXXXX format.";
    }
    if (!form.district.trim()) nextErrors.district = "District is required.";
    if (!form.address.trim()) nextErrors.address = "Address is required.";
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

  const handleContinue = (event) => {
    event.preventDefault();
    if (!validateStep1()) return;
    setErrors({});
    setStep(2);
    setOtp(Array(6).fill(""));
    setOtpTimer(60);
    setTimeout(() => {
      otpRefs.current[0]?.focus();
    }, 0);
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

  const handleVerify = (event) => {
    event.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setToast({ type: "error", message: "Enter the 6-digit code." });
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setToast({ type: "success", message: "Account created successfully!" });
      setTimeout(() => navigate("/dashboard"), 900);
    }, 900);
  };

  const resendOtp = () => {
    if (otpTimer > 0) return;
    setOtp(Array(6).fill(""));
    setOtpTimer(60);
    setToast({ type: "success", message: "OTP resent to your email." });
    setTimeout(() => {
      otpRefs.current[0]?.focus();
    }, 0);
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
                    src={logo}
                    alt="SUM Academy logo"
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
                  SUM Academy
                </p>
                <h1 className="mt-2 font-heading text-3xl text-slate-900">
                  Create Account
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                    step === 1 ? "border-primary text-primary" : "border-slate-300"
                  }`}
                >
                  1
                </span>
                <span>/</span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                    step === 2 ? "border-primary text-primary" : "border-slate-300"
                  }`}
                >
                  2
                </span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.form
                  key="step1"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={fadeUp}
                  onSubmit={handleContinue}
                  className="mt-8 space-y-5"
                >
                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Name
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
                      <p className="mt-2 text-xs text-accent">
                        {errors.fatherName}
                      </p>
                    )}
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
                    {errors.caste && (
                      <p className="mt-2 text-xs text-accent">{errors.caste}</p>
                    )}
                  </div>

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
                    {errors.fatherOccupation && (
                      <p className="mt-2 text-xs text-accent">
                        {errors.fatherOccupation}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Contact No
                    </label>
                    <input
                      type="text"
                      value={form.contactNo}
                      onChange={(event) =>
                        setForm({ ...form, contactNo: event.target.value })
                      }
                      className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="+92XXXXXXXXXX"
                    />
                    {errors.contactNo && (
                      <p className="mt-2 text-xs text-accent">{errors.contactNo}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Contact of Father
                    </label>
                    <input
                      type="text"
                      value={form.fatherContact}
                      onChange={(event) =>
                        setForm({ ...form, fatherContact: event.target.value })
                      }
                      className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="+92XXXXXXXXXX"
                    />
                    {errors.fatherContact && (
                      <p className="mt-2 text-xs text-accent">
                        {errors.fatherContact}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      District of Domicile
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
                    {errors.district && (
                      <p className="mt-2 text-xs text-accent">
                        {errors.district}
                      </p>
                    )}
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
                    {errors.address && (
                      <p className="mt-2 text-xs text-accent">{errors.address}</p>
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

                  <button type="submit" className="btn-primary w-full">
                    Continue
                  </button>

                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                        <path d="M21.4 10.2H12v3.6h5.4c-.2 1.2-.9 2.2-1.9 2.9v2.4h3.1c1.8-1.6 2.8-4 2.8-6.9 0-.5 0-.9-.1-1z" />
                        <path d="M12 22c2.6 0 4.7-.9 6.3-2.5l-3.1-2.4c-.8.6-1.9 1-3.2 1-2.5 0-4.6-1.7-5.3-3.9H3.5v2.5C5.1 19.7 8.3 22 12 22z" />
                        <path d="M6.7 13.2a5.8 5.8 0 0 1 0-2.4V8.3H3.5a10 10 0 0 0 0 7.4l3.2-2.5z" />
                        <path d="M12 6.8c1.4 0 2.6.5 3.6 1.4l2.7-2.7C16.7 3.9 14.6 3 12 3 8.3 3 5.1 5.3 3.5 8.3l3.2 2.5c.7-2.2 2.8-4 5.3-4z" />
                      </svg>
                    </span>
                    Continue with Google
                  </button>

                  <p className="text-sm text-slate-600">
                    Already have an account?{" "}
                    <Link to="/login" className="font-semibold text-primary">
                      Sign In
                    </Link>
                  </p>
                </motion.form>
              ) : (
                <motion.form
                  key="step2"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={fadeUp}
                  onSubmit={handleVerify}
                  className="mt-8 space-y-6"
                >
                  <div>
                    <p className="text-sm text-slate-600">
                      We sent a 6-digit code to your email{" "}
                      <span className="font-semibold text-slate-900">
                        {form.email || "your email"}
                      </span>
                      .
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
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>
                      Resend OTP in {otpTimer}s
                    </span>
                    <button
                      type="button"
                      className="font-semibold text-primary disabled:text-slate-400"
                      onClick={resendOtp}
                      disabled={otpTimer > 0}
                    >
                      Resend
                    </button>
                  </div>
                  <button
                    type="submit"
                    className="btn-primary w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Verifying...
                      </span>
                    ) : (
                      "Verify & Create Account"
                    )}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-semibold text-slate-600"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
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
                src={logo}
                alt="SUM Academy logo"
                className="h-full w-full object-cover"
              />
            </div>
            <h2 className="mt-4 font-heading text-3xl">SUM Academy</h2>
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

export default Register;
