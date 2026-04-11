import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiCheckCircle, FiRadio, FiVolume2, FiVolumeX } from "react-icons/fi";
import { setupMaxProtection } from "../../utils/maxProtection.js";
import {
  getStudentSessionById,
  getStudentSessionStatus,
  getStudentSessionSync,
  joinStudentSession,
  leaveStudentSession,
  logStudentSessionViolation,
  reportStudentSecurityViolation,
} from "../../services/student.service.js";

const toDateTime = (date, time) => {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatLongDate = (date, time = "00:00") => {
  const parsed = toDateTime(date, time);
  if (!parsed) return "-";
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatHHMMSS = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)));
  const h = String(Math.floor(safe / 3600)).padStart(2, "0");
  const m = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const s = String(safe % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

const formatTimeHHMM = (dateObj) => {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return "--:--";
  return dateObj.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const splitCountdown = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return { days, hours, minutes, seconds: secs };
};

const getInitials = (name = "Student") =>
  String(name || "Student")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "ST";

const safeDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default function LiveSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [overlayWarning, setOverlayWarning] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  // Autoplay on desktop is blocked unless muted or initiated by user gesture.
  const [muted, setMuted] = useState(true);
  const [needsUserStart, setNeedsUserStart] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [isBuffering, setIsBuffering] = useState(false);
  const videoRef = useRef(null);
  const seekLockRef = useRef(0);

  const sessionQuery = useQuery({
    queryKey: ["student-session", sessionId],
    queryFn: () => getStudentSessionById(sessionId),
    enabled: Boolean(sessionId),
    staleTime: 10000,
    refetchInterval: 30000,
  });

  const statusQuery = useQuery({
    queryKey: ["student-session-status", sessionId],
    queryFn: () => getStudentSessionStatus(sessionId),
    enabled: Boolean(sessionId),
    staleTime: 5000,
    refetchInterval: 30000,
  });

  const syncQuery = useQuery({
    queryKey: ["student-session-sync", sessionId],
    queryFn: () => getStudentSessionSync(sessionId),
    enabled: Boolean(sessionId),
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const session = sessionQuery.data || {};
  const status = statusQuery.data || {};
  const sync = syncQuery.data || {};

  const startAt = safeDate(session?.timing?.startAt) || toDateTime(session.sessionDate, session.shiftStartTime);
  const endAt = safeDate(session?.timing?.endAt) || toDateTime(session.sessionDate, session.shiftEndTime);
  const preSeconds = startAt ? Math.max(0, Math.floor((startAt.getTime() - nowMs) / 1000)) : 0;
  const liveSeconds = endAt ? Math.max(0, Math.floor((endAt.getTime() - nowMs) / 1000)) : 0;

  const uiState = useMemo(() => {
    if (!sessionId) return "loading";
    const raw = String(session?.status || status?.status || "scheduled").toLowerCase();
    if (raw === "ended" || raw === "expired") return "ended";
    if (raw === "live") return "live";
    return "pre";
  }, [session?.status, sessionId, status?.status]);

  const canPlayNow = uiState === "live" && Boolean(session?.canPlay);

  const joinedMutation = useMutation({
    mutationFn: () => joinStudentSession(sessionId),
    onSuccess: () => {
      toast.success("Joined live session");
      setVideoError("");
      sessionQuery.refetch();
      statusQuery.refetch();
      syncQuery.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to join session");
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveStudentSession(sessionId),
  });

  const violationMutation = useMutation({
    mutationFn: ({ reason, count }) =>
      logStudentSessionViolation(sessionId, {
        reason,
        count,
        timestamp: new Date().toISOString(),
      }),
    onSuccess: (data) => {
      if (data?.deactivated) {
        toast.error("Account deactivated due to repeated violations.");
        navigate("/login");
      }
    },
  });

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!canPlayNow) return undefined;
    window.history.pushState(null, "", window.location.href);
    const onPopState = () => {
      window.history.pushState(null, "", window.location.href);
      toast.error("Cannot go back during live session");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [canPlayNow]);

  useEffect(() => {
    if (!canPlayNow) return undefined;
    const cleanup = setupMaxProtection({
      quizMode: true,
      maxViolations: 3,
      onViolation: (count, reason) => {
        // Always log every violation to backend so 3 violations actually deactivate.
        // (Some reasons come from keyboard/printscreen/devtools, not just tab switches.)
        const normalized = String(reason || "default");
        if (["tab_switch", "window_blur"].includes(normalized)) {
          setOverlayWarning("You left the live session. Return immediately.");
          setTimeout(() => setOverlayWarning(""), 2200);
        }
        toast.error(`Warning ${count}: Security violation (${normalized.replaceAll("_", " ")})`, {
          duration: 4500,
        });
        violationMutation.mutate({ reason: normalized, count });
        void reportStudentSecurityViolation({
          reason: normalized,
          page: "live_session",
          details: `Live session violation ${count}/3`,
        }).catch(() => null);
      },
      onMaxViolation: (count, reason) => {
        toast.error("3 violations detected. Account is being deactivated.");
        violationMutation.mutate({ reason: reason || "default", count: count || 3 });
        void reportStudentSecurityViolation({
          reason: reason || "default",
          page: "live_session",
          details: `Live session violation ${count || 3}/3`,
        }).catch(() => null);
      },
    });
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [canPlayNow, violationMutation]);

  useEffect(() => {
    if (uiState === "ended") {
      leaveMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiState]);

  // Hard lock: no pause/no seek during live playback.
  useEffect(() => {
    if (!canPlayNow) return undefined;

    const preventLeave = (event) => {
      event.preventDefault();
      event.returnValue = "Live session is running. Leaving now will disconnect you.";
      return event.returnValue;
    };
    window.addEventListener("beforeunload", preventLeave);
    return () => window.removeEventListener("beforeunload", preventLeave);
  }, [canPlayNow]);

  useEffect(() => {
    if (!canPlayNow) return;
    const video = videoRef.current;
    if (!video) return;
    const elapsed = Math.max(0, Number(sync.elapsedSeconds || 0));
    const applySeek = () => {
      try {
        // Seek late joiners to current live position.
        video.currentTime = elapsed;
        seekLockRef.current = video.currentTime;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise
            .then(() => setNeedsUserStart(false))
            .catch(() => setNeedsUserStart(true));
        }
      } catch {
        // ignore
      }
    };
    // Apply when metadata is ready.
    const onLoaded = () => applySeek();
    video.addEventListener("loadedmetadata", onLoaded);
    applySeek();
    return () => video.removeEventListener("loadedmetadata", onLoaded);
  }, [canPlayNow, sync.elapsedSeconds]);

  const handlePause = () => {
    if (!canPlayNow) return;
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => setNeedsUserStart(true));
  };

  const handleSeeking = () => {
    if (!canPlayNow) return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seekLockRef.current;
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    seekLockRef.current = video.currentTime;
  };

  const handleUserStart = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      // Ensure it's muted for autoplay policies, then let student unmute manually.
      video.muted = true;
      setMuted(true);
      await video.play();
      setNeedsUserStart(false);
      setVideoError("");
    } catch {
      setNeedsUserStart(true);
    }
  };

  if (statusQuery.isLoading || sessionQuery.isLoading || uiState === "loading") {
    return <div className="rounded-3xl bg-[#0d0f1a] p-8 text-white">Loading live session...</div>;
  }

  if (sessionQuery.isError || !session?.id) {
    return (
      <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-6 text-rose-100">
        {sessionQuery.error?.response?.data?.message || "Session not found"}
      </div>
    );
  }

  const countdown = splitCountdown(preSeconds);
  const showDangerTimer = liveSeconds <= 10 * 60;
  const studentsOnline = Number(status.joinedCount || 0);
  const initials = getInitials(session.teacherName || "Teacher");
  const canJoin = Boolean(session.canJoin) || Boolean(status.canJoin);
  const videoUrl = String(sync.videoUrl || session.videoUrl || "").trim();
  const totalDurationSeconds = Math.max(
    0,
    (startAt && endAt ? Math.floor((endAt.getTime() - startAt.getTime()) / 1000) : 0)
  );

  return (
    <div className="relative min-h-[85vh] rounded-3xl bg-[#0d0f1a] p-4 text-white sm:p-8">
      {overlayWarning ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4">
          <div className="rounded-2xl border border-amber-400/40 bg-[#171a2a] px-6 py-5 text-center text-amber-200">
            {overlayWarning}
          </div>
        </div>
      ) : null}

      {uiState === "pre" ? (
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="rounded-xl bg-[#4a63f5] px-3 py-2 text-sm font-bold">SUM</div>
            <span className="rounded-full border border-blue-400/40 bg-blue-500/20 px-3 py-1 text-xs font-semibold">
              Live Session
            </span>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-300">
              {session.className || "Class"} {session.batchCode ? `(${session.batchCode})` : ""}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4a63f5] text-sm font-bold">
                {initials}
              </div>
              <div>
                <p className="font-semibold">{session.teacherName || "Teacher"}</p>
                <p className="text-xs text-slate-300">Scheduled Live</p>
              </div>
            </div>
            <h1 className="mt-5 font-heading text-3xl font-semibold">{session.lectureTitle || "Live Session"}</h1>
            <p className="mt-2 text-sm text-slate-300">
              {startAt ? startAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "-"}
            </p>
            <p className="text-sm text-slate-200">{formatTimeHHMM(startAt)} - {formatTimeHHMM(endAt)}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#111525] p-6 text-center">
            <p className="text-sm text-slate-300">Session starts in:</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {[
                { label: "Days", value: countdown.days },
                { label: "Hours", value: countdown.hours },
                { label: "Minutes", value: countdown.minutes },
                { label: "Seconds", value: countdown.seconds },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-[#161a2b] p-4">
                  <div className="h-1 rounded-full bg-[#4a63f5]" />
                  <p className="mt-3 text-3xl font-bold">{String(item.value).padStart(2, "0")}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <span className="rounded-full bg-slate-700/50 px-3 py-1 text-xs">
              {studentsOnline} students waiting
            </span>
            <p className="text-sm text-slate-300">Waiting for session to begin...</p>
            <button
              type="button"
              disabled={!canJoin || joinedMutation.isPending}
              onClick={() => joinedMutation.mutate()}
              className="rounded-full bg-[#4a63f5] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {joinedMutation.isPending ? "Joining..." : canJoin ? "Join Waiting Room" : "Join Opens 10 Minutes Before"}
            </button>
          </div>
        </div>
      ) : null}

      {uiState === "live" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111525] px-4 py-3">
            <div className="text-sm font-semibold">SUM Academy</div>
            <p className="max-w-[52vw] truncate text-center text-sm font-semibold text-white">
              {status.topic || session.lectureTitle || "Live Session"}
            </p>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 font-semibold text-emerald-300">
                <FiRadio className="animate-pulse" /> LIVE
              </span>
              <span className={`${showDangerTimer ? "text-rose-300" : "text-slate-200"}`}>
                Time remaining: {formatHHMMSS(liveSeconds)}
              </span>
              <span>{studentsOnline} students online</span>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
            <div className="rounded-3xl border border-white/10 bg-[#111525] p-6">
              <div className="rounded-2xl border border-white/10 bg-[#171b2f] p-6 text-center">
                <p className="text-sm text-slate-300">Live Premiere</p>
                <h2 className="mt-2 text-3xl font-bold">{session.lectureTitle || "Live Session"}</h2>
                <p className="mt-2 text-slate-300">{session.subjectName || "Subject"}</p>
                <p className="mt-1 text-sm text-slate-300">Teacher: {session.teacherName || "Teacher"}</p>
                <p className="mt-1 text-sm text-slate-200">{formatTimeHHMM(startAt)} - {formatTimeHHMM(endAt)}</p>

                {!session.canPlay ? (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-[#0d0f1a] p-5 text-left">
                    <p className="text-sm text-slate-300">{session.lockReason || "Join to continue."}</p>
                    <button
                      type="button"
                      disabled={!canJoin || joinedMutation.isPending}
                      onClick={() => joinedMutation.mutate()}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#4a63f5] px-6 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {joinedMutation.isPending ? "Joining..." : "Join Live Session"}
                    </button>
                  </div>
                ) : (
                  <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black">
                    {!videoUrl ? (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 px-4 text-center">
                        <div className="max-w-sm rounded-2xl border border-white/10 bg-[#0d0f1a] p-5">
                          <p className="text-sm text-slate-200">
                            Live video URL is missing for this session. Please ask your teacher/admin to upload the live session video.
                          </p>
                        </div>
                      </div>
                    ) : null}
                    <video
                      ref={videoRef}
                      src={videoUrl || ""}
                      className="aspect-video w-full bg-black"
                      crossOrigin="anonymous"
                      autoPlay
                      muted={muted}
                      preload="metadata"
                      playsInline
                      controls={false}
                      disablePictureInPicture
                      controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
                      onPause={handlePause}
                      onSeeking={handleSeeking}
                      onTimeUpdate={handleTimeUpdate}
                      onWaiting={() => setIsBuffering(true)}
                      onCanPlay={() => setIsBuffering(false)}
                      onPlaying={() => setIsBuffering(false)}
                      onEnded={() => {
                        // End immediately when the live video ends (if shorter than shift).
                        toast.success("Live session ended");
                        leaveMutation.mutate();
                        sessionQuery.refetch();
                        statusQuery.refetch();
                        syncQuery.refetch();
                      }}
                      onError={() => {
                        setVideoError("This live video could not be played in your browser.");
                        setNeedsUserStart(false);
                      }}
                    />

                    {isBuffering ? (
                      <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-slate-100">
                        Loading live video... (buffering)
                      </div>
                    ) : null}

                    {needsUserStart ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-4 text-center">
                        <div className="max-w-sm rounded-2xl border border-white/10 bg-[#0d0f1a] p-5">
                          <p className="text-sm text-slate-200">
                            Tap to start the live video. (Desktop browsers require a click to start playback.)
                          </p>
                          <button
                            type="button"
                            onClick={handleUserStart}
                            className="mt-4 w-full rounded-full bg-[#4a63f5] px-5 py-2 text-sm font-semibold"
                          >
                            Start Live Video
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {videoError ? (
                      <div className="absolute inset-x-3 bottom-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                        {videoError}
                      </div>
                    ) : null}

                    <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      LIVE
                    </div>
                    <div className="absolute bottom-3 right-3">
                      <button
                        type="button"
                        onClick={() => setMuted((prev) => !prev)}
                        className="rounded-full bg-white/90 p-2 text-slate-700 shadow"
                      >
                        {muted ? <FiVolumeX className="h-4 w-4" /> : <FiVolume2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Do not close or switch this page during session. Attendance is tracked automatically.
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#111525] p-5">
              <p className="text-sm font-semibold">{studentsOnline} students joined this session</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {Array.from({ length: Math.min(10, studentsOnline) }).map((_, idx) => (
                  <div
                    key={`joined-${idx}`}
                    className="rounded-xl border border-white/10 bg-[#171b2f] px-3 py-2 text-xs"
                  >
                    ST{idx + 1}
                  </div>
                ))}
              </div>
              {studentsOnline > 10 ? (
                <p className="mt-2 text-xs text-slate-300">and {studentsOnline - 10} more</p>
              ) : null}
              <div className="mt-5 border-t border-white/10 pt-4 text-xs text-slate-300">
                <p>Class: {session.className || "-"}</p>
                <p>Session time: {formatTimeHHMM(startAt)} - {formatTimeHHMM(endAt)}</p>
                <p>Session ends at {formatTimeHHMM(endAt)}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {uiState === "ended" ? (
        <div className="mx-auto mt-12 max-w-xl rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-8 text-center">
          <FiCheckCircle className="mx-auto text-5xl text-emerald-300" />
          <h2 className="mt-4 font-heading text-3xl font-bold">Session Ended</h2>
          <p className="mt-2 text-slate-200">{session.lectureTitle || "Live Session"}</p>
          <p className="mt-1 text-sm text-slate-300">
            Duration: {formatHHMMSS(totalDurationSeconds)}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            You can now watch the recorded lecture from your course player.
          </p>
          <button
            type="button"
            className="mt-6 rounded-full bg-white px-6 py-2 text-sm font-semibold text-slate-900"
            onClick={() => navigate("/student/live")}
          >
            Return to Dashboard
          </button>
        </div>
      ) : null}
    </div>
  );
}
