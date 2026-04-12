import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import {
  FiCalendar,
  FiClock,
  FiPlayCircle,
  FiRadio,
} from "react-icons/fi";
import { Skeleton } from "../../components/Skeleton.jsx";
import {
  getStudentLiveSessions,
} from "../../services/student.service.js";

const STATUS_STYLES = {
  live: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  waiting: "bg-amber-100 text-amber-700 border border-amber-200",
  join_window_open: "bg-blue-100 text-blue-700 border border-blue-200",
  join_closed: "bg-rose-100 text-rose-700 border border-rose-200",
  scheduled: "bg-slate-100 text-slate-700 border border-slate-200",
  ended: "bg-slate-200 text-slate-700 border border-slate-300",
  expired: "bg-slate-200 text-slate-700 border border-slate-300",
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatTimeRange = (startAt, endAt, fallbackStart = "-", fallbackEnd = "-") => {
  const start = startAt ? new Date(startAt) : null;
  const end = endAt ? new Date(endAt) : null;
  const validStart = start && !Number.isNaN(start.getTime());
  const validEnd = end && !Number.isNaN(end.getTime());
  if (!validStart || !validEnd) {
    return `${fallbackStart || "-"} - ${fallbackEnd || "-"}`;
  }
  const toHHMM = (d) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${toHHMM(start)} - ${toHHMM(end)}`;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const APK_URL = `${import.meta.env.VITE_API_URL.replace("/api", "")}/download/app`;

const formatCountdown = (seconds) => {
  const safe = Math.max(0, Math.floor(toNumber(seconds, 0)));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

function StudentLivePage() {
  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Student Live</p>
            <h2 className="mt-2 font-heading text-3xl text-slate-900">Live Sessions</h2>
            <p className="mt-2 text-sm text-slate-500">
              Join window opens 10 minutes before start time and closes 10 minutes after start time.
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Live sessions are optimized for the SUM Academy Android app. Please use the APK for the best experience.
          <div className="mt-3">
            <a
              href={APK_URL}
              download="SUM_Academy.apk"
              className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
            >
              Download Android APK
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default StudentLivePage;
