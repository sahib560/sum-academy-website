import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import {
  FiCalendar,
  FiClock,
  FiPlayCircle,
  FiRadio,
  FiVolume2,
  FiVolumeX,
} from "react-icons/fi";
import { Skeleton } from "../../components/Skeleton.jsx";
import {
  getStudentLiveSessions,
  joinStudentLiveSession,
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

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [joinedSessions, setJoinedSessions] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const videoRef = useRef(null);
  const seekLockRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const liveQuery = useQuery({
    queryKey: ["student-live-sessions"],
    queryFn: getStudentLiveSessions,
    staleTime: 10000,
    refetchInterval: 10000,
  });

  const sessions = useMemo(
    () => (Array.isArray(liveQuery.data?.sessions) ? liveQuery.data.sessions : []),
    [liveQuery.data]
  );

  useEffect(() => {
    if (!sessions.length) return;
    if (selectedSessionId && sessions.some((row) => row.id === selectedSessionId)) return;
    const preferred =
      sessions.find((row) => row.status === "live" && (row.isJoined || joinedSessions[row.id])) ||
      sessions.find((row) => row.canJoin) ||
      sessions[0];
    if (preferred?.id) setSelectedSessionId(preferred.id);
  }, [sessions, selectedSessionId, joinedSessions]);

  const selectedSession = useMemo(
    () => sessions.find((row) => row.id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

  const joinMutation = useMutation({
    mutationFn: (sessionId) => joinStudentLiveSession(sessionId),
    onSuccess: (payload, sessionId) => {
      setJoinedSessions((prev) => ({ ...prev, [sessionId]: true }));
      if (payload?.waiting) {
        toast.success("Joined waiting room. Live starts at shift time.");
      } else {
        toast.success("Joined live session.");
      }
      liveQuery.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to join live session");
    },
  });

  const selectedTiming = selectedSession?.timing || {};
  const startMs = new Date(selectedTiming.startAt || "").getTime();
  const endMs = new Date(selectedTiming.endAt || "").getTime();
  const joined = Boolean(
    selectedSession &&
      (selectedSession.isJoined || joinedSessions[selectedSession.id] === true)
  );
  const isWaiting = joined && Number.isFinite(startMs) && nowMs < startMs;
  const isLive = joined && Number.isFinite(startMs) && Number.isFinite(endMs) && nowMs >= startMs && nowMs < endMs;
  const hasEnded = Number.isFinite(endMs) && nowMs >= endMs;
  const countdownSec = Number.isFinite(startMs) ? Math.max(0, Math.floor((startMs - nowMs) / 1000)) : 0;

  useEffect(() => {
    if (!selectedSession || !joined || !isLive) return;
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => null);
  }, [selectedSession, joined, isLive]);

  useEffect(() => {
    if (!isLive) return undefined;

    const preventLeave = (event) => {
      event.preventDefault();
      event.returnValue = "Live class is running. Leaving now will disconnect your session.";
      return event.returnValue;
    };

    const preventBack = () => {
      window.history.pushState(null, "", window.location.href);
      toast.error("You cannot leave this page until the live session ends.");
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("beforeunload", preventLeave);
    window.addEventListener("popstate", preventBack);

    return () => {
      window.removeEventListener("beforeunload", preventLeave);
      window.removeEventListener("popstate", preventBack);
    };
  }, [isLive]);

  useEffect(() => {
    if (!hasEnded || !selectedSession) return;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }, [hasEnded, selectedSession]);

  const onJoin = (session) => {
    if (!session?.id) return;
    joinMutation.mutate(session.id);
  };

  const handlePause = () => {
    if (!isLive) return;
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => null);
  };

  const handleSeeking = () => {
    if (!isLive) return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seekLockRef.current;
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    seekLockRef.current = video.currentTime;
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Student Live</p>
            <h2 className="mt-2 font-heading text-3xl text-slate-900">Live Sessions</h2>
            <p className="mt-2 text-sm text-slate-500">
              Join window opens 10 minutes before shift time and remains open until session end.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p>Total sessions: {toNumber(liveQuery.data?.summary?.total, sessions.length)}</p>
            <p>Live now: {toNumber(liveQuery.data?.summary?.liveNow, 0)}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-heading text-xl text-slate-900">Upcoming / Live</h3>
          <div className="mt-4 space-y-3">
            {liveQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={`live-session-skeleton-${index}`} className="h-28 w-full rounded-2xl" />
              ))
            ) : sessions.length > 0 ? (
              sessions.map((session) => {
                const active = session.id === selectedSessionId;
                const statusClass =
                  STATUS_STYLES[session.status] || STATUS_STYLES.scheduled;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-primary bg-primary/5 shadow-[0_10px_24px_rgba(74,99,245,0.16)]"
                        : "border-slate-200 bg-white hover:border-primary/40 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">
                        {session.subjectName} - {session.lectureTitle}
                      </p>
                      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${statusClass}`}>
                        {session.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {session.className} {session.batchCode ? `(${session.batchCode})` : ""}
                    </p>
                    <div className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <FiCalendar className="h-3.5 w-3.5" />
                        <span>{formatDateTime(session.timing?.startAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FiClock className="h-3.5 w-3.5" />
                        <span>{session.shiftStartTime || "-"} - {session.shiftEndTime || "-"}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                No live session is configured for your enrolled subjects yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          {selectedSession ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-xl text-slate-900">{selectedSession.lectureTitle}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedSession.subjectName} - {selectedSession.className}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ${
                    STATUS_STYLES[selectedSession.status] || STATUS_STYLES.scheduled
                  }`}
                >
                  <FiRadio className="h-3.5 w-3.5" />
                  {selectedSession.status.replaceAll("_", " ")}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <p>Join opens: {formatDateTime(selectedSession.joinWindow?.opensAt)}</p>
                <p>Starts at: {formatDateTime(selectedSession.timing?.startAt)}</p>
                <p>Ends at: {formatDateTime(selectedSession.timing?.endAt)}</p>
              </div>

              {!joined ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-600">
                    {selectedSession.lockReason || "Join this session during the allowed time window."}
                  </p>
                  <button
                    type="button"
                    onClick={() => onJoin(selectedSession)}
                    disabled={!selectedSession.canJoin || joinMutation.isPending}
                    className="btn-primary mt-4 px-5 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {joinMutation.isPending ? "Joining..." : "Join Live Session"}
                  </button>
                </div>
              ) : hasEnded ? (
                <div className="rounded-2xl border border-slate-300 bg-slate-100 p-5 text-sm text-slate-700">
                  This live session has ended. Replay is disabled until the next scheduled class time.
                </div>
              ) : (
                <div className="space-y-3">
                  {isWaiting ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      Live starts in {formatCountdown(countdownSec)}. Playback will auto-start at shift time.
                    </div>
                  ) : null}

                  <div className="relative overflow-hidden rounded-2xl border border-slate-900 bg-black">
                    <video
                      ref={videoRef}
                      src={selectedSession.videoUrl || ""}
                      className="aspect-video w-full bg-black"
                      autoPlay={isLive}
                      muted={isMuted}
                      playsInline
                      controls={false}
                      disablePictureInPicture
                      controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
                      onPause={handlePause}
                      onSeeking={handleSeeking}
                      onTimeUpdate={handleTimeUpdate}
                    />
                    <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      LIVE
                    </div>
                    <div className="absolute bottom-3 right-3">
                      <button
                        type="button"
                        onClick={() => setIsMuted((prev) => !prev)}
                        className="rounded-full bg-white/90 p-2 text-slate-700 shadow"
                      >
                        {isMuted ? <FiVolumeX className="h-4 w-4" /> : <FiVolume2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    <p className="font-semibold">Live session rules</p>
                    <p className="mt-1">
                      Pause, seek and leaving this page are blocked while session is live. Keep this page open until session ends.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              <FiPlayCircle className="mx-auto mb-2 h-6 w-6 text-slate-400" />
              Select a live session from the left.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-heading text-lg text-slate-900">Restrictions</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold">Join window</p>
            <p className="mt-1">Only 10 minutes before shift start until exact start time.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold">Late join support</p>
            <p className="mt-1">Late join is allowed while the live session is still running.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold">Playback lock</p>
            <p className="mt-1">No pause and no seek while live is running.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold">Post-session access</p>
            <p className="mt-1">Replay is blocked after end; access opens again on next schedule.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default StudentLivePage;
