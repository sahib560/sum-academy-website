import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import { FiLock } from "react-icons/fi";
import { Skeleton } from "../../components/Skeleton.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import {
  getCourseProgress,
  markLectureComplete,
  reportStudentSecurityViolation,
} from "../../services/student.service.js";
import api from "../../api/axios.js";
import { WatermarkOverlay } from "../../utils/security.js";
import { getViolationCount, setupMaxProtection } from "../../utils/maxProtection.js";

const VIDEO_VIOLATION_LIMIT = 3;

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatSeconds = (value = 0) => {
  const total = Math.max(0, Math.floor(toNumber(value, 0)));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const getLectureSource = (lecture = {}) =>
  lecture.signedUrl ||
  lecture.signedVideoUrl ||
  lecture.videoSignedUrl ||
  lecture.streamUrl ||
  lecture.videoUrl ||
  lecture.playbackUrl ||
  "";

const normalizeProgressPayload = (payload = {}) => {
  const course = payload.course || {};
  const progress = payload.progress || {};
  const access = payload.access || {};
  const chapters = Array.isArray(payload.chapters) ? payload.chapters : [];

  const normalizedChapters = chapters.map((chapter, chapterIndex) => {
    const lectures = Array.isArray(chapter.lectures) ? chapter.lectures : [];
    const normalizedLectures = lectures.map((lecture, lectureIndex) => ({
      lectureId: lecture.lectureId || lecture.id || `${chapterIndex}-${lectureIndex}`,
      title: lecture.title || "Lecture",
      duration: lecture.duration || lecture.videoDuration || "--",
      isCompleted: Boolean(lecture.isCompleted),
      completedAt: lecture.completedAt || null,
      hasAccess: lecture.hasAccess !== false,
      signedUrl: lecture.signedUrl || lecture.signedVideoUrl || lecture.videoSignedUrl || "",
      streamUrl: lecture.streamUrl || "",
      playbackUrl: lecture.playbackUrl || "",
      videoUrl: lecture.videoUrl || "",
      videoId: lecture.videoId || "",
      videoMode: lecture.videoMode || "recorded",
      isLiveSession: Boolean(lecture.isLiveSession),
      videoTitle: lecture.videoTitle || "",
      pdfNotes: Array.isArray(lecture.pdfNotes) ? lecture.pdfNotes : [],
      books: Array.isArray(lecture.books) ? lecture.books : [],
      notes: lecture.notes || "",
    }));

    return {
      chapterId: chapter.chapterId || chapter.id || `chapter-${chapterIndex}`,
      title: chapter.title || "Chapter",
      totalLectures: toNumber(chapter.totalLectures, normalizedLectures.length),
      completedLectures: toNumber(
        chapter.completedLectures,
        normalizedLectures.filter((item) => item.isCompleted).length
      ),
      lectures: normalizedLectures,
    };
  });

  const allLectures = normalizedChapters.flatMap((chapter) => chapter.lectures);
  return {
    course: {
      id: course.id || "",
      title: course.title || "Course",
      description: course.description || "",
      teacherName: course.teacherName || "Teacher",
    },
    progress: {
      completedLectures: toNumber(
        progress.completedLectures,
        allLectures.filter((lecture) => lecture.isCompleted).length
      ),
      totalLectures: toNumber(progress.totalLectures, allLectures.length),
      completionPercent: clamp(toNumber(progress.completionPercent, 0), 0, 100),
    },
    access: {
      hasClassContext: Boolean(access.hasClassContext),
      isLockedAfterCompletion: Boolean(access.isLockedAfterCompletion),
      isCompletedWindow: Boolean(access.isCompletedWindow),
      certificateEligible: access.certificateEligible !== false,
      classStates: Array.isArray(access.classStates) ? access.classStates : [],
    },
    chapters: normalizedChapters,
    lectures: allLectures,
  };
};

function StudentCoursePlayer() {
  const { courseId, lectureId: routeLectureId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userProfile } = useAuth();

  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const objectUrlRef = useRef("");

  const [currentLectureId, setCurrentLectureId] = useState("");
  const [expandedChapters, setExpandedChapters] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [videoSrc, setVideoSrc] = useState("");
  const [videoLoadError, setVideoLoadError] = useState("");
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [maxWatchedSeconds, setMaxWatchedSeconds] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [securityWarningCount, setSecurityWarningCount] = useState(0);
  const [securityLocked, setSecurityLocked] = useState(false);
  const [securityDeactivatedInfo, setSecurityDeactivatedInfo] = useState(null);
  const lastReportedViolationRef = useRef({
    reason: "",
    count: 0,
    at: 0,
  });

  const {
    data: progressPayload,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["student-course-progress", courseId],
    queryFn: () => getCourseProgress(courseId),
    enabled: Boolean(courseId),
    staleTime: 30000,
    refetchInterval: 15000,
  });

  const normalized = useMemo(
    () => normalizeProgressPayload(progressPayload || {}),
    [progressPayload]
  );

  const currentLecture = useMemo(
    () =>
      normalized.lectures.find(
        (lecture) => lecture.lectureId === currentLectureId
      ) || null,
    [normalized.lectures, currentLectureId]
  );
  const classCompletionLocked = Boolean(normalized.access?.isLockedAfterCompletion);

  const watchedPercent = useMemo(() => {
    if (duration <= 0) return 0;
    return clamp((maxWatchedSeconds / duration) * 100, 0, 100);
  }, [duration, maxWatchedSeconds]);


  const markCompleteMutation = useMutation({
    mutationFn: ({ courseId: targetCourseId, lectureId: targetLectureId }) =>
      markLectureComplete(targetCourseId, targetLectureId),
    onSuccess: (result) => {
      const data = result?.data || result?.data?.data || result || {};
      if (data?.certificatePending) {
        toast.success("Lecture completed. Certificate will unlock after class completion.");
      } else {
        toast.success("Lecture marked as complete");
      }
      queryClient.invalidateQueries({ queryKey: ["student-course-progress", courseId] });
      queryClient.invalidateQueries({ queryKey: ["student-courses"] });
      queryClient.invalidateQueries({ queryKey: ["student-dashboard"] });
      if (data.courseCompleted) {
        setShowCelebration(true);
      }
    },
    onError: (mutationError) => {
      toast.error(
        mutationError?.response?.data?.message || "Failed to mark lecture complete"
      );
    },
  });

  useEffect(() => {
    if (!normalized.chapters.length) return;
    setExpandedChapters((previous) => {
      const next = { ...previous };
      normalized.chapters.forEach((chapter, index) => {
        if (next[chapter.chapterId] === undefined) next[chapter.chapterId] = index === 0;
      });
      return next;
    });
  }, [normalized.chapters]);

  useEffect(() => {
    if (!normalized.lectures.length) {
      setCurrentLectureId("");
      return;
    }

    const requested = routeLectureId
      ? normalized.lectures.find((lecture) => lecture.lectureId === routeLectureId)
      : null;
    if (requested) {
      setCurrentLectureId(requested.lectureId);
      return;
    }

    const existing = normalized.lectures.find(
      (lecture) => lecture.lectureId === currentLectureId
    );
    if (existing) return;

    const firstAccessible =
      normalized.lectures.find((lecture) => lecture.hasAccess) || normalized.lectures[0];
    setCurrentLectureId(firstAccessible.lectureId);
  }, [normalized.lectures, routeLectureId, currentLectureId]);

  useEffect(() => {
    const getViolationMessage = (reason) => {
      const messages = {
        tab_switch: "Do not switch tabs while watching",
        window_blur: "Do not minimize or switch windows",
        screenshot: "Screenshots are not allowed",
        printscreen: "Screenshots are not allowed",
        devtools: "Developer tools are not allowed",
        screen_record: "Screen recording is blocked",
      };
      return messages[reason] || "Security violation detected";
    };

    const reportViolationToBackend = async (count, reason) => {
      const now = Date.now();
      if (securityDeactivatedInfo?.deactivated) return;
      if (
        lastReportedViolationRef.current.reason === reason &&
        lastReportedViolationRef.current.count === count &&
        now - lastReportedViolationRef.current.at < 1200
      ) {
        return;
      }
      lastReportedViolationRef.current = { reason, count, at: now };

      try {
        const result = await reportStudentSecurityViolation({
          reason,
          page: "video",
          details: `Video player violation ${count}/${VIDEO_VIOLATION_LIMIT}`,
        });
        if (result?.deactivated) {
          setSecurityLocked(true);
          setSecurityDeactivatedInfo({
            deactivated: true,
            count: Number(result.count || VIDEO_VIOLATION_LIMIT),
            limit: Number(result.limit || VIDEO_VIOLATION_LIMIT),
            reason: result.reason || reason,
          });
          toast.error("Account deactivated due to repeated violations.");
        }
      } catch (violationError) {
        const errCode =
          violationError?.response?.data?.errors?.code ||
          violationError?.response?.data?.code;
        if (errCode === "ACCOUNT_DEACTIVATED") {
          setSecurityLocked(true);
          setSecurityDeactivatedInfo({
            deactivated: true,
            count: VIDEO_VIOLATION_LIMIT,
            limit: VIDEO_VIOLATION_LIMIT,
            reason: reason || "security_violation",
          });
        }
      }
    };

    const cleanup = setupMaxProtection({
      enforceFullscreenMode: false,
      quizMode: true,
      maxViolations: VIDEO_VIOLATION_LIMIT,
      onViolation: (count, reason) => {
        setSecurityWarningCount(count);
        void reportViolationToBackend(count, reason);
        if (
          (reason === "tab_switch" || reason === "window_blur") &&
          videoRef.current
        ) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
        if (count < VIDEO_VIOLATION_LIMIT) {
          toast.error(`Warning ${count}/${VIDEO_VIOLATION_LIMIT}: ${getViolationMessage(reason)}`);
        }
      },
      onMaxViolation: (count, reason) => {
        setSecurityWarningCount(VIDEO_VIOLATION_LIMIT);
        setSecurityLocked(true);
        void reportViolationToBackend(count || VIDEO_VIOLATION_LIMIT, reason || "default");
        if (videoRef.current) {
          videoRef.current.pause();
        }
        setIsPlaying(false);
        toast.error("3 violations detected. Account is being deactivated.");
      },
    });
    setSecurityWarningCount(getViolationCount());
    return cleanup;
  }, [securityDeactivatedInfo?.deactivated]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden || !videoRef.current) return;
      videoRef.current.pause();
      setIsPlaying(false);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cleanupObjectUrl = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = "";
      }
    };

    const loadSecureVideo = async () => {
      cleanupObjectUrl();
      setVideoSrc("");
      setVideoLoadError("");
      setCurrentTime(0);
      setDuration(0);
      setMaxWatchedSeconds(0);
      setIsPlaying(false);

      if (!currentLecture || currentLecture.hasAccess === false || classCompletionLocked) return;

      const secureUrl = getLectureSource(currentLecture);
      if (!secureUrl) return;

      setIsLoadingVideo(true);
      try {
        const isAbsolute = /^https?:\/\//i.test(secureUrl);

        if (isAbsolute) {
          if (cancelled) return;
          setVideoSrc(secureUrl);
          return;
        } else {
          const response = await api.get(secureUrl, { responseType: "blob" });
          if (cancelled) return;
          const objectUrl = URL.createObjectURL(response.data);
          objectUrlRef.current = objectUrl;
          setVideoSrc(objectUrl);
        }
      } catch {
        if (!cancelled) {
          setVideoSrc("");
          setVideoLoadError("Unable to load this video right now.");
        }
      } finally {
        if (!cancelled) setIsLoadingVideo(false);
      }
    };

    loadSecureVideo();

    return () => {
      cancelled = true;
      cleanupObjectUrl();
    };
  }, [currentLecture, classCompletionLocked]);

  const handlePlayPause = async () => {
    const video = videoRef.current;
    if (!video || currentLecture?.hasAccess === false || !videoSrc || securityLocked) return;
    try {
      if (video.paused) {
        await video.play();
        setIsPlaying(true);
      } else {
        video.pause();
        setIsPlaying(false);
      }
    } catch {
      setIsPlaying(false);
    }
  };

  const handleSeek = (event) => {
    const video = videoRef.current;
    if (!video || duration <= 0 || securityLocked) return;
    const nextTime = clamp(toNumber(event.target.value, 0), 0, duration);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleVolume = (event) => {
    const video = videoRef.current;
    const nextVolume = clamp(toNumber(event.target.value, 1), 0, 1);
    setVolume(nextVolume);
    if (video) video.volume = nextVolume;
  };

  const handleSpeed = (event) => {
    const video = videoRef.current;
    const nextRate = clamp(toNumber(event.target.value, 1), 0.5, 2);
    setPlaybackRate(nextRate);
    if (video) video.playbackRate = nextRate;
  };

  const handleFullscreen = () => {
    if (!playerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      playerRef.current.requestFullscreen?.();
    }
  };

  const toggleChapter = (chapterId) => {
    setExpandedChapters((previous) => ({
      ...previous,
      [chapterId]: !previous[chapterId],
    }));
  };

  const selectLecture = (lecture) => {
    if (securityLocked) {
      toast.error("Video is locked due to security violations.");
      return;
    }
    if (classCompletionLocked) {
      toast.error("Class is locked after completion. Contact teacher/admin for rewatch access.");
      return;
    }
    if (lecture.hasAccess === false) {
      toast.error("This video is locked");
      return;
    }
    setCurrentLectureId(lecture.lectureId);
    navigate(`/student/courses/${courseId}/player/${lecture.lectureId}`);
  };

  const handleMarkComplete = () => {
    if (!courseId || !currentLecture?.lectureId) return;
    if (watchedPercent < 80) return;
    markCompleteMutation.mutate({
      courseId,
      lectureId: currentLecture.lectureId,
    });
  };

  const canMarkComplete =
    Boolean(currentLecture) &&
    !securityLocked &&
    !classCompletionLocked &&
    currentLecture.hasAccess !== false &&
    watchedPercent >= 80 &&
    !currentLecture.isCompleted &&
    !markCompleteMutation.isPending;
  const lectureHasVideo = Boolean(getLectureSource(currentLecture || {}));
  const lectureResources = useMemo(() => {
    if (!currentLecture) return [];
    const pdfs = Array.isArray(currentLecture.pdfNotes) ? currentLecture.pdfNotes : [];
    const books = Array.isArray(currentLecture.books) ? currentLecture.books : [];
    return [...pdfs, ...books].filter((row) => row?.url);
  }, [currentLecture]);

  const showLockedOverlay =
    securityLocked ||
    !currentLecture ||
    currentLecture.hasAccess === false ||
    classCompletionLocked;
  const showVideoErrorOverlay =
    !showLockedOverlay && !isLoadingVideo && lectureHasVideo && !videoSrc;

  return (
    <div className="protected-zone lecture-content relative space-y-6 protected-content">
      <Toaster position="top-right" />

      {securityDeactivatedInfo?.deactivated ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/95 px-4 text-center text-white">
          <div className="w-full max-w-lg rounded-3xl border border-rose-400/40 bg-slate-900/90 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-rose-300">Account Deactivated</p>
            <h2 className="mt-2 font-heading text-2xl">
              Access blocked after {securityDeactivatedInfo.count}/{securityDeactivatedInfo.limit} violations
            </h2>
            <p className="mt-3 text-sm text-slate-200">
              Reason: {securityDeactivatedInfo.reason || "Security policy violation"}.
              Please contact admin or teacher to review and reactivate your account.
            </p>
            <button
              type="button"
              className="mt-5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900"
              onClick={() => navigate("/login")}
            >
              Go To Login
            </button>
          </div>
        </div>
      ) : null}

      <Motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Learning Studio</h1>
      </Motion.section>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-3xl" />
      ) : isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error?.response?.data?.errors?.code === "PENDING_APPROVAL"
            ? "Your payment is pending admin approval. Course content will unlock after approval."
            : error?.response?.data?.message || error?.message || "Failed to load course"}
        </div>
      ) : (
        <div className="space-y-4">
          {classCompletionLocked ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              This class is completed. Videos are locked for rewatch until teacher/admin unlocks access.
            </div>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-[7fr_3fr]">
          <Motion.section {...fadeUp} className="space-y-4">
            <div
              ref={playerRef}
              className="protected-zone video-wrapper relative overflow-hidden rounded-3xl border border-slate-700 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 shadow-2xl"
              style={{ position: "relative" }}
            >
              <div className="aspect-video">
                <video
                  ref={videoRef}
                  src={videoSrc || undefined}
                  className="h-full w-full object-cover"
                  style={{ pointerEvents: "none", filter: "contrast(1.03) saturate(1.08)" }}
                  controls={false}
                  controlsList="nodownload nofullscreen"
                  disablePictureInPicture
                  disableRemotePlayback
                  onContextMenu={(event) => event.preventDefault()}
                  onLoadedMetadata={(event) => {
                    const media = event.currentTarget;
                    setDuration(toNumber(media.duration, 0));
                    media.volume = volume;
                    media.playbackRate = playbackRate;
                  }}
                  onTimeUpdate={(event) => {
                    const media = event.currentTarget;
                    const nextTime = toNumber(media.currentTime, 0);
                    setCurrentTime(nextTime);
                    setMaxWatchedSeconds((previous) => Math.max(previous, nextTime));
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onError={() => {
                    setVideoLoadError("Unable to play this video right now.");
                    setVideoSrc("");
                    setIsPlaying(false);
                  }}
                />
              </div>

              <WatermarkOverlay
                studentName={
                  userProfile?.fullName ||
                  userProfile?.name ||
                  userProfile?.displayName ||
                  "Student"
                }
                email={userProfile?.email || ""}
              />

              {showLockedOverlay && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/75 text-center text-white backdrop-blur-sm">
                  <FiLock className="h-8 w-8" />
                  <p className="text-sm font-semibold">This video is locked</p>
                  <p className="text-xs text-slate-200">
                    {securityLocked
                      ? "Locked due to security violations in this session."
                      : classCompletionLocked
                        ? "Class completed. Rewatch is locked until teacher/admin unlocks."
                        : "Contact your teacher to unlock"}
                  </p>
                </div>
              )}

              {!showLockedOverlay && !isLoadingVideo && !lectureHasVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/75 text-center text-xs font-semibold text-white">
                  No video attached for this lecture. Use notes below.
                </div>
              )}

              {showVideoErrorOverlay ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/75 text-center text-white">
                  <p className="text-sm font-semibold">
                    {videoLoadError || "Unable to load video"}
                  </p>
                  <p className="text-xs text-slate-200">
                    Access is allowed. Please refresh this page or try again.
                  </p>
                </div>
              ) : null}

              {isLoadingVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 text-sm font-semibold text-white">
                  Loading secure video...
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {normalized.course.title}
                  </p>
                  <h2 className="font-heading text-2xl text-slate-900">
                    {currentLecture?.title || "Select a lecture"}
                  </h2>
                  {currentLecture?.isLiveSession ||
                  String(currentLecture?.videoMode || "").toLowerCase() === "live_session" ? (
                    <span className="mt-2 inline-flex rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold text-rose-700">
                      Live Session Replay
                    </span>
                  ) : null}
                  <p className="mt-1 text-sm text-slate-500">
                    {normalized.course.teacherName}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>
                    Watched: {Math.round(watchedPercent)}%
                  </p>
                  <p>
                    Lecture: {currentLecture?.duration || "--"}
                  </p>
                  <p>
                    Security warnings: {securityWarningCount}/{VIDEO_VIOLATION_LIMIT}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handlePlayPause}
                    disabled={showLockedOverlay || !lectureHasVideo || !videoSrc}
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  <span className="text-xs font-semibold text-slate-700">
                    {formatSeconds(currentTime)} / {formatSeconds(duration)}
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full"
                  disabled={showLockedOverlay || !lectureHasVideo || !videoSrc}
                />

                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-xs text-slate-600">
                    Volume
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={handleVolume}
                      className="mt-1 w-full"
                    />
                  </label>

                  <label className="text-xs text-slate-600">
                    Speed
                    <select
                      value={playbackRate}
                      onChange={handleSpeed}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-1 text-xs"
                    >
                      {[0.5, 1, 1.25, 1.5, 2].map((speed) => (
                        <option key={speed} value={speed}>
                          {speed}x
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-end">
                    <button
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                      onClick={handleFullscreen}
                      disabled={showLockedOverlay || !lectureHasVideo || !videoSrc}
                    >
                      Fullscreen
                    </button>
                  </div>
                </div>
              </div>

              {(currentLecture?.notes || lectureResources.length > 0) && (
                <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Lecture Resources
                  </p>
                  {currentLecture?.notes ? (
                    <p className="text-sm text-slate-700">{currentLecture.notes}</p>
                  ) : null}
                  {lectureResources.length > 0 ? (
                    <div className="space-y-2">
                      {lectureResources.map((item, index) => (
                        <a
                          key={`${item.id || "resource"}-${index}`}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          <span>{item.title || "Resource"}</span>
                          <span className="text-slate-500">Open</span>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              <button
                className={`mt-4 w-full rounded-full px-4 py-3 text-sm font-semibold ${
                  canMarkComplete
                    ? "bg-emerald-500 text-white"
                    : "cursor-not-allowed bg-slate-200 text-slate-500"
                }`}
                onClick={handleMarkComplete}
                disabled={!canMarkComplete}
              >
                {markCompleteMutation.isPending
                  ? "Saving..."
                  : currentLecture?.isCompleted
                    ? "Already Completed"
                    : "Mark as Complete"}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Mark as complete unlocks when watched over 80%.
              </p>
            </div>
          </Motion.section>

          <Motion.aside {...fadeUp}>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-heading text-xl text-slate-900">
                {normalized.course.title}
              </h3>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <div className="h-2 w-36 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${normalized.progress.completionPercent}%` }}
                  />
                </div>
                {Math.round(normalized.progress.completionPercent)}%
              </div>

              <div className="mt-4 space-y-3">
                {normalized.chapters.map((chapter) => {
                  const isOpen = Boolean(expandedChapters[chapter.chapterId]);
                  return (
                    <div
                      key={chapter.chapterId}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <button
                        className="flex w-full items-center justify-between text-left"
                        onClick={() => toggleChapter(chapter.chapterId)}
                      >
                        <span className="text-sm font-semibold text-slate-700">
                          {chapter.title}
                        </span>
                        <span className="text-xs text-slate-500">
                          {chapter.completedLectures}/{chapter.totalLectures}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="mt-3 space-y-2">
                          {chapter.lectures.map((lecture) => {
                            const isCurrent =
                              lecture.lectureId === currentLecture?.lectureId;
                            return (
                              <button
                                key={lecture.lectureId}
                                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs ${
                                  isCurrent
                                    ? "border-primary bg-primary/10"
                                    : "border-slate-200 bg-white"
                                } ${
                                  lecture.hasAccess === false ? "opacity-70" : ""
                                }`}
                                onClick={() => selectLecture(lecture)}
                              >
                                <div className="flex items-center gap-2">
                                  {lecture.isCompleted ? (
                                    <span className="text-emerald-500">OK</span>
                                  ) : lecture.hasAccess === false ? (
                                    <span className="text-slate-400">LOCK</span>
                                  ) : isCurrent ? (
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                                  ) : (
                                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                                  )}
                                  <span className="text-slate-700">{lecture.title}</span>
                                </div>
                                <span className="text-slate-500">{lecture.duration}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Motion.aside>
        </div>
        </div>
      )}

      <AnimatePresence>
        {showCelebration && (
          <Motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              className="absolute inset-0 bg-slate-900/60"
              onClick={() => setShowCelebration(false)}
              aria-label="Close celebration modal"
            />
            <Motion.div
              className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
            >
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                {Array.from({ length: 24 }).map((_, index) => (
                  <span
                    key={`confetti-${index}`}
                    className="absolute h-2 w-2 animate-bounce rounded-full"
                    style={{
                      top: `${(index * 13) % 95}%`,
                      left: `${(index * 17) % 95}%`,
                      backgroundColor: index % 3 === 0 ? "#4a63f5" : index % 3 === 1 ? "#22c55e" : "#f59e0b",
                      opacity: 0.8,
                      animationDelay: `${(index % 6) * 0.08}s`,
                    }}
                  />
                ))}
              </div>
              <h3 className="font-heading text-2xl text-slate-900">
                Congratulations! Course Completed!
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Your certificate is being generated.
              </p>
              <div className="mt-5 flex justify-center gap-2">
                <Link className="btn-primary" to="/student/certificates">
                  Download Certificate
                </Link>
                <button
                  className="btn-outline"
                  onClick={() => setShowCelebration(false)}
                >
                  Close
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default StudentCoursePlayer;



