import { useEffect, useMemo, useRef, useState } from "react";
import { motion as Motion } from "framer-motion";
import logo from "../assets/logo.jpeg";
import tryLogo from "../assets/try-logo.png";
import api from "../api/axios.js";

const LAUNCH_DATE = new Date("2026-04-01T00:00:00+05:00");
const PROGRESS_START = new Date("2026-03-01T00:00:00+05:00");
const ONE_SECOND = 1000;

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7 } },
};

const pad = (value) => String(value).padStart(2, "0");

const getTimeParts = (diffMs) => {
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
};

function TimeCard({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-[#12162b] px-4 py-4 text-center shadow-lg shadow-black/30">
      <div className="h-0.5 w-full rounded-full bg-[#4a63f5]" />
      <Motion.div
        key={value}
        initial={{ rotateX: -90, opacity: 0 }}
        animate={{ rotateX: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="text-3xl font-semibold text-white"
      >
        {pad(value)}
      </Motion.div>
      <span className="text-xs uppercase tracking-[0.3em] text-[#4a63f5]">
        {label}
      </span>
    </div>
  );
}

function ComingSoon() {
  const [now, setNow] = useState(() => new Date());
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const dispatchRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, ONE_SECOND);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (now >= LAUNCH_DATE) {
      if (!dispatchRef.current) {
        dispatchRef.current = true;
        api.post("/launch/notify/dispatch").catch(() => {});
      }
      window.location.reload();
    }
  }, [now]);

  const diffMs = Math.max(LAUNCH_DATE - now, 0);
  const timeParts = useMemo(() => getTimeParts(diffMs), [diffMs]);

  const progress = useMemo(() => {
    const total = LAUNCH_DATE - PROGRESS_START;
    const elapsed = Math.min(Math.max(now - PROGRESS_START, 0), total);
    if (total <= 0) return 100;
    return Math.round((elapsed / total) * 100);
  }, [now]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d0f1a] px-6 py-14 text-white">
      <div className="pointer-events-none absolute inset-0">
        <Motion.div
          className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#4a63f5]/15 blur-[120px]"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <Motion.div
          className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[#ff6f0f]/12 blur-[120px]"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-10 text-center">
        <Motion.div variants={fadeUp} initial="hidden" animate="visible">
          <div className="mx-auto flex flex-col items-center gap-3">
            <div className="flex items-center gap-4 rounded-full border border-white/10 bg-white/5 px-6 py-4">
              <img src={tryLogo} alt="Tryunity" className="h-14 w-14" />
              <span className="text-3xl font-semibold text-white">X</span>
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#4a63f5]/15 shadow-lg shadow-[#4a63f5]/30">
                <img
                  src={logo}
                  alt="SUM Academy"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <p className="text-lg font-semibold uppercase tracking-[0.5em] text-[#4a63f5] md:text-xl">
              SUM ACADEMY
            </p>
            <p className="text-xl font-semibold text-white md:text-2xl">
              Tryunity Solutions
            </p>
          </div>
        </Motion.div>

        <Motion.div variants={fadeUp} initial="hidden" animate="visible">
          <h1 className="font-heading text-3xl font-semibold text-white md:text-5xl">
            Something amazing is launching soon
          </h1>
          <p className="mt-4 text-sm text-slate-300 md:text-base">
            Pakistan&apos;s most modern learning platform is almost ready for you.
          </p>
        </Motion.div>

        <Motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="grid w-full grid-cols-2 gap-4 md:grid-cols-4"
        >
          <TimeCard label="Days" value={timeParts.days} />
          <TimeCard label="Hours" value={timeParts.hours} />
          <TimeCard label="Minutes" value={timeParts.minutes} />
          <TimeCard label="Seconds" value={timeParts.seconds} />
        </Motion.div>

        <Motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="grid w-full items-start gap-8 md:grid-cols-[2fr_1fr]"
        >
          <Motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-6 shadow-2xl shadow-black/40"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={tryLogo} alt="Try Logo" className="h-10 w-10" />
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white/10">
                  <img
                    src={logo}
                    alt="SUM Academy"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#4a63f5]" />
                <div className="h-2 w-2 rounded-full bg-[#ff6f0f]" />
                <div className="h-2 w-2 rounded-full bg-white/20" />
              </div>
            </div>
            <div className="grid gap-3">
              <div className="h-6 w-2/3 rounded-full bg-white/10" />
              <div className="h-4 w-1/2 rounded-full bg-white/10" />
              <div className="mt-2 h-40 w-full rounded-2xl bg-white/5" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-20 rounded-2xl bg-white/5" />
                <div className="h-20 rounded-2xl bg-white/5" />
                <div className="h-20 rounded-2xl bg-white/5" />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.3em] text-[#4a63f5]">
              <span>Loading</span>
              <span>{pad(timeParts.minutes)}:{pad(timeParts.seconds)}</span>
            </div>
            <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </Motion.div>

          <Motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="relative mx-auto w-full max-w-xs overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-white/5 to-white/0 p-4 shadow-2xl shadow-black/40"
          >
            <div className="mb-4 flex items-center justify-between">
              <img src={tryLogo} alt="Try Logo" className="h-8 w-8" />
              <div className="h-5 w-20 rounded-full bg-white/10" />
            </div>
            <div className="flex justify-center">
              <div className="h-12 w-12 overflow-hidden rounded-full bg-white/10">
                <img
                  src={logo}
                  alt="SUM Academy"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="h-4 w-3/4 rounded-full bg-white/10" />
              <div className="h-3 w-1/2 rounded-full bg-white/10" />
              <div className="mt-2 h-40 rounded-2xl bg-white/5" />
              <div className="h-10 rounded-2xl bg-white/5" />
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-[#ff6f0f]">
              <span>Skeleton</span>
              <span>{pad(timeParts.minutes)}:{pad(timeParts.seconds)}</span>
            </div>
            <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </Motion.div>
        </Motion.div>

        <Motion.div variants={fadeUp} initial="hidden" animate="visible">
          <p className="text-base font-semibold text-white md:text-lg">
            Launching on <span className="text-[#ff6f0f]">April 1, 2026</span>
          </p>
        </Motion.div>

        <Motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex w-full flex-col items-center gap-4"
        >
          <div className="w-full max-w-md">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
              <span>{progress}% to launch</span>
              <span>Progress</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-[#4a63f5]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <Motion.form
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            onSubmit={async (event) => {
              event.preventDefault();
              setSubmitError("");
              if (submitting) return;
              const formData = new FormData(event.currentTarget);
              const email = String(formData.get("email") || "").trim();
              if (!email) {
                setSubmitError("Please enter a valid email.");
                return;
              }
              setSubmitting(true);
              try {
                await api.post("/launch/notify", { email });
                setSubmitted(true);
              } catch (error) {
                setSubmitError(
                  error?.response?.data?.message ||
                    error?.response?.data?.error ||
                    "Unable to save your email. Please try again."
                );
              } finally {
                setSubmitting(false);
              }
            }}
            className="flex w-full max-w-md flex-col gap-3"
          >
            <input
              type="email"
              name="email"
              required
              placeholder="Enter your email"
              className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-[#4a63f5]"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[#4a63f5] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#4a63f5]/30 transition hover:bg-[#4a63f5]/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Saving..." : "Notify Me"}
            </button>
          </Motion.form>

          <a
            href="mailto:infotryunity@gmail.com"
            className="rounded-full border border-white/20 px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-[#4a63f5] hover:text-white"
          >
            CTN
          </a>
        </Motion.div>

        {submitted ? (
          <Motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-sm font-semibold text-emerald-400"
          >
            You are on the list!
          </Motion.p>
        ) : null}
        {submitError ? (
          <Motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-sm font-semibold text-rose-400"
          >
            {submitError}
          </Motion.p>
        ) : null}

        <Motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex items-center justify-center gap-3 text-base font-semibold text-slate-300 md:text-lg"
        >
          <img src={tryLogo} alt="Tryunity" className="h-7 w-7" />
          <span>Powered by Tryunity Solutions</span>
        </Motion.div>
      </div>
    </div>
  );
}

export default ComingSoon;
