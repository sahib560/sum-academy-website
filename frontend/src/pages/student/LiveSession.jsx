import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { setupMaxProtection } from "../../utils/maxProtection.js";
import {
  getStudentSessionById,
  getStudentSessionSync,
  joinStudentSession,
  logStudentSessionViolation,
} from "../../services/student.service.js";

const formatSeconds = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = String(Math.floor(safe / 3600)).padStart(2, "0");
  const m = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const s = String(safe % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isEmbeddableMeetingLink = (url = "") => {
  const clean = String(url || "").toLowerCase();
  return clean.includes("zoom") || clean.includes("meet.google") || clean.includes("teams.microsoft");
};

export default function LiveSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endReason, setEndReason] = useState("Session has ended");
  const [joined, setJoined] = useState(false);
  const [joinAt, setJoinAt] = useState(null);

  const sessionQuery = useQuery({
    queryKey: ["student-session", sessionId],
    queryFn: () => getStudentSessionById(sessionId),
    enabled: Boolean(sessionId),
    staleTime: 10000,
    refetchInterval: 30000,
  });

  const syncQuery = useQuery({
    queryKey: ["student-session-sync", sessionId],
    queryFn: () => getStudentSessionSync(sessionId),
    enabled: Boolean(sessionId),
    staleTime: 5000,
    refetchInterval: 30000,
  });

  const violationMutation = useMutation({
    mutationFn: ({ reason, count }) =>
      logStudentSessionViolation(sessionId, {
        reason,
        count,
        timestamp: new Date().toISOString(),
      }),
  });

  const joinMutation = useMutation({
    mutationFn: () => joinStudentSession(sessionId),
    onSuccess: () => {
      setJoined(true);
      setJoinAt(new Date());
      toast.success("Joined live session");
      sessionQuery.refetch();
      syncQuery.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to join session");
    },
  });

  const session = sessionQuery.data || {};
  const sync = syncQuery.data || {};
  const isRunning = Boolean(sync.isRunning);
  const remainingSeconds = Number(sync.remainingSeconds || 0);

  useEffect(() => {
    if (!session?.status) return;
    if (["completed", "cancelled"].includes(String(session.status).toLowerCase())) {
      setSessionEnded(true);
      setEndReason(
        String(session.status).toLowerCase() === "cancelled"
          ? "Session has been cancelled"
          : "Session has ended"
      );
    }
  }, [session?.status]);

  useEffect(() => {
    if (!syncQuery.data) return;
    if (!sync.isRunning || remainingSeconds <= 0) {
      setSessionEnded(true);
      setEndReason("Session has ended");
    }
  }, [remainingSeconds, sync.isRunning, syncQuery.data]);

  useEffect(() => {
    if (!joined || sessionEnded || !isRunning) return undefined;

    window.history.pushState(null, "", window.location.href);
    const onPopState = () => {
      window.history.pushState(null, "", window.location.href);
      toast.error("Cannot go back during live session");
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [isRunning, joined, sessionEnded]);

  useEffect(() => {
    if (!joined || sessionEnded) return undefined;

    const cleanup = setupMaxProtection({
      quizMode: true,
      enforceFullscreenMode: false,
      onViolation: (count, reason) => {
        if (reason === "tab_switch") {
          toast.error(`Warning ${count}: Do not switch tabs during live session`, {
            duration: 5000,
          });
          violationMutation.mutate({ reason, count });
        } else if (reason === "window_blur") {
          toast.error(`Warning ${count}: Do not minimize during live session`, {
            duration: 5000,
          });
          violationMutation.mutate({ reason, count });
        }
      },
    });

    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [joined, sessionEnded, violationMutation]);

  const joinedDuration = useMemo(() => {
    if (!joinAt) return "00:00:00";
    const elapsed = Math.floor((Date.now() - joinAt.getTime()) / 1000);
    return formatSeconds(elapsed);
  }, [joinAt]);

  useEffect(() => {
    if (!joinAt) return undefined;
    const timer = setInterval(() => {
      setJoinAt((prev) => (prev ? new Date(prev.getTime()) : prev));
    }, 1000);
    return () => clearInterval(timer);
  }, [joinAt]);

  if (sessionQuery.isLoading) {
    return <div className="rounded-2xl bg-slate-900 p-6 text-white">Loading session...</div>;
  }

  if (sessionQuery.isError || !session?.id) {
    return (
      <div className="rounded-2xl bg-rose-900/30 p-6 text-rose-100">
        {sessionQuery.error?.response?.data?.message || "Session not found"}
      </div>
    );
  }

  if (sessionEnded) {
    return (
      <div className="min-h-[70vh] rounded-3xl bg-[#0d0f1a] p-8 text-white">
        <div className="mx-auto mt-14 max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="text-4xl">LIVE</div>
          <h1 className="mt-4 font-heading text-3xl">Live Session Ended</h1>
          <p className="mt-2 text-slate-300">{endReason}</p>
          <p className="mt-1 text-sm text-slate-400">{session.topic}</p>
          <button
            type="button"
            className="btn-primary mt-6 px-5 py-2"
            onClick={() => navigate("/student/live")}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const canJoinNow = Boolean(session.canJoin || isRunning || joined);
  const meetingLink = String(sync.meetingLink || session.meetingLink || "").trim();

  return (
    <div className="min-h-[85vh] rounded-3xl bg-[#0d0f1a] p-4 text-white sm:p-6">
      <div className="sticky top-3 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111525] px-4 py-3">
        <div className="text-sm font-semibold">SUM Academy</div>
        <div className="text-center">
          <p className="text-sm font-semibold">{session.topic || "Live Session"}</p>
          <p className="text-xs text-slate-400">{session.className || "Class"}</p>
        </div>
        <div className="text-right text-xs">
          <p>Live timer: {joinedDuration}</p>
          <p>Ends: {formatDateTime(sync.endAt || session?.timing?.endAt || session?.endTime)}</p>
          <p>Remaining: {formatSeconds(remainingSeconds)}</p>
        </div>
      </div>

      {!joined ? (
        <div className="mx-auto mt-12 max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
          <h2 className="font-heading text-2xl">Join Live Session</h2>
          <p className="mt-2 text-sm text-slate-300">
            {canJoinNow
              ? "You can join this live session now."
              : session.lockReason || "Join opens 10 minutes before shift time."}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Start: {formatDateTime(session?.timing?.startAt)} | End: {formatDateTime(session?.timing?.endAt)}
          </p>
          <button
            type="button"
            disabled={!canJoinNow || joinMutation.isPending}
            onClick={() => joinMutation.mutate()}
            className="btn-primary mt-5 px-5 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {joinMutation.isPending ? "Joining..." : "Join Meeting"}
          </button>
          <div className="mt-3 text-xs text-amber-300">
            Do not close this page during live session. Violations are recorded.
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-black p-2">
            {meetingLink && isEmbeddableMeetingLink(meetingLink) ? (
              <iframe
                title="Live Session"
                src={meetingLink}
                className="h-[60vh] w-full rounded-xl border-0"
                allow="camera; microphone; fullscreen"
              />
            ) : (
              <div className="flex h-[60vh] flex-col items-center justify-center rounded-xl border border-white/10 bg-[#111525] p-6 text-center">
                <p className="text-sm text-slate-300">Meeting is ready.</p>
                <button
                  type="button"
                  className="btn-primary mt-4 px-5 py-2"
                  onClick={() => {
                    if (!meetingLink) {
                      toast.error("Meeting link is missing");
                      return;
                    }
                    window.location.assign(meetingLink);
                  }}
                >
                  Join Meeting
                </button>
              </div>
            )}
            <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Do not close this page during live session. Violations are recorded.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            <p className="font-semibold">Session Info</p>
            <p className="mt-2 text-slate-300">Class: {session.className || "-"}</p>
            <p className="text-slate-300">Teacher: {session.teacherName || "-"}</p>
            <p className="text-slate-300">Shift: {session.startTime || "-"} - {session.endTime || "-"}</p>
            <p className="text-slate-300">Session ends at {session.endTime || "-"}</p>
            <Link
              to="/student/live"
              className="mt-4 inline-block rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-200"
            >
              Back to Live List
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
