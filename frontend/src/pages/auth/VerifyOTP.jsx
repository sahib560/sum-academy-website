import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const floatAnim = {
  animate: {
    y: [0, -6, 0],
    transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
  },
};

const shake = {
  animate: {
    x: [0, -8, 8, -6, 6, 0],
    transition: { duration: 0.4 },
  },
};

function VerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = useMemo(
    () => location.state?.email || "student@sumacademy.pk",
    [location.state]
  );
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const otpRefs = useRef([]);

  useEffect(() => {
    otpRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (timer <= 0) return;
    const tick = setTimeout(() => setTimer((prev) => prev - 1), 1000);
    return () => clearTimeout(tick);
  }, [timer]);

  const handleChange = (value, index) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    setError("");
    if (value && otpRefs.current[index + 1]) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (event, index) => {
    if (event.key === "Backspace" && !otp[index] && otpRefs.current[index - 1]) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (event) => {
    const text = event.clipboardData.getData("Text").trim();
    if (!/^\d{6}$/.test(text)) return;
    const next = text.split("");
    setOtp(next);
    setError("");
    otpRefs.current[5]?.focus();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter the 6-digit code.");
      setShakeKey((prev) => prev + 1);
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (code === "123456") {
        setSuccess(true);
        setTimeout(() => navigate("/dashboard"), 1500);
      } else {
        setError("Invalid code. Please try again.");
        setShakeKey((prev) => prev + 1);
      }
    }, 900);
  };

  const resendOtp = () => {
    if (timer > 0) return;
    setOtp(Array(6).fill(""));
    setTimer(60);
    setError("");
    otpRefs.current[0]?.focus();
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
        <div className="relative w-full max-w-[420px] rounded-3xl bg-white p-8 shadow-2xl">
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            variants={floatAnim}
            animate="animate"
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
              <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 2 8 5 8-5H4zm0 8h16V10l-8 5-8-5v6z" />
            </svg>
          </motion.div>
          <h1 className="mt-6 font-heading text-3xl text-slate-900">
            Verify Your Email
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter the 6-digit code sent to{" "}
            <span className="font-semibold text-slate-900">{email}</span>
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <motion.div
              key={shakeKey}
              variants={shake}
              animate={error ? "animate" : ""}
              className="flex items-center justify-between gap-2"
              onPaste={handlePaste}
            >
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
                  onChange={(event) => handleChange(event.target.value, index)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className="h-12 w-12 rounded-xl border border-slate-200 bg-white text-center text-lg font-semibold text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              ))}
            </motion.div>
            {error && <p className="text-xs text-accent">{error}</p>}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Verifying...
                </span>
              ) : (
                "Verify Email"
              )}
            </button>

            {success && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2 text-sm text-emerald-600"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                  ✓
                </span>
                Email verified! Redirecting...
              </motion.div>
            )}

            <div className="text-sm text-slate-500">
              {timer > 0 ? (
                <span>Resend code in 0:{String(timer).padStart(2, "0")}</span>
              ) : (
                <button
                  type="button"
                  className="font-semibold text-primary"
                  onClick={resendOtp}
                >
                  Resend OTP
                </button>
              )}
            </div>

            <Link to="/register" className="block text-sm font-semibold text-primary">
              Back to Register
            </Link>
          </form>
        </div>
      </div>
    </main>
  );
}

export default VerifyOTP;
