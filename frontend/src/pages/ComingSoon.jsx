import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";

const LAUNCH_DATE = new Date("2026-04-01T00:00:00+05:00");
const PROGRESS_START = new Date("2026-01-01T00:00:00+05:00");
const ONE_SECOND = 1000;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
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
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-[#14182a]/80 px-4 py-4 text-center shadow-lg shadow-black/30">
      <div className="h-1 w-full rounded-full bg-[#4a63f5]/70" />
      <Motion.div
        key={value}
        initial={{ rotateX: -90, opacity: 0 }}
        animate={{ rotateX: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="text-3xl font-semibold text-white"
      >
        {pad(value)}
      </Motion.div>
      <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
        {label}
      </span>
    </div>
  );
}

function ComingSoon() {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (now >= LAUNCH_DATE) {
      navigate("/", { replace: true });
    }
  }, [navigate, now]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, ONE_SECOND);
    return () => clearInterval(timer);
  }, []);

  const diffMs = Math.max(LAUNCH_DATE - now, 0);
  const timeParts = useMemo(() => getTimeParts(diffMs), [diffMs]);

  const progress = useMemo(() => {
    const total = LAUNCH_DATE - PROGRESS_START;
    const elapsed = Math.min(Math.max(now - PROGRESS_START, 0), total);
    if (total <= 0) return 0;
    return Math.round((elapsed / total) * 100);
  }, [now]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d0f1a] px-6 py-14 text-white">
      <div className="pointer-events-none absolute inset-0">
        <Motion.div
          className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#4a63f5]/20 blur-[120px]"
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <Motion.div
          className="absolute right-0 top-1/3 h-64 w-64 rounded-full bg-[#ff6f0f]/15 blur-[110px]"
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <Motion.div
          className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#4a63f5]/10 blur-[130px]"
          animate={{ x: [0, -50, 0], y: [0, 25, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-10 text-center">
        <Motion.div variants={fadeUp} initial="hidden" animate="visible">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#4a63f5]/20 text-3xl font-bold text-[#4a63f5] shadow-lg shadow-[#4a63f5]/30">
            S
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.6em] text-[#4a63f5]">
            SUM ACADEMY
          </p>
        </Motion.div>

        <Motion.div variants={fadeUp} initial="hidden" animate="visible">
          <h1 className="font-heading text-3xl font-semibold text-white md:text-5xl">
            Something amazing is launching soon
          </h1>
          <p className="mt-4 text-sm text-slate-300 md:text-base">
            Pakistan&apos;s most modern learning platform is nearly ready. Join the
            waitlist and be the first to explore the new SUM Academy.
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

        <Motion.div variants={fadeUp} initial="hidden" animate="visible">
          <p className="text-sm font-semibold text-[#ff6f0f]">
            Launching on April 1, 2026
          </p>
        </Motion.div>

        <Motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-center"
        >
          <input
            type="email"
            placeholder="Enter your email"
            className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-[#4a63f5]"
          />
          <button className="rounded-full bg-[#4a63f5] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#4a63f5]/30 transition hover:bg-[#4a63f5]/90">
            Notify Me
          </button>
        </Motion.div>

        <Motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="w-full"
        >
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-[#4a63f5]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </Motion.div>
      </div>
    </div>
  );
}

export default ComingSoon;
