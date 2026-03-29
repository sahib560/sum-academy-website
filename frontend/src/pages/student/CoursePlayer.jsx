import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "../../services/student.service.js";
import api from "../../api/axios.js";
import {
  WatermarkOverlay,
  disableContentProtection,
  enableContentProtection,
  useDevToolsDetection,
} from "../../utils/security.js";

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
  lecture.playbackUrl ||
  "";

const normalizeProgressPayload = (payload = {}) => {
  const course = payload.course || {};
  const progress = payload.progress || {};
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
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [maxWatchedSeconds, setMaxWatchedSeconds] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);

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

  const watchedPercent = useMemo(() => {
    if (duration <= 0) return 0;
    return clamp((maxWatchedSeconds / duration) * 100, 0, 100);
  }, [duration, maxWatchedSeconds]);


  const markCompleteMutation = useMutation({
    mutationFn: ({ courseId: targetCourseId, lectureId: targetLectureId }) =>
      markLectureComplete(targetCourseId, targetLectureId),
    onSuccess: (result) => {
      toast.success("Lecture marked as complete");
      queryClient.invalidateQueries({ queryKey: ["student-course-progress", courseId] });
      queryClient.invalidateQueries({ queryKey: ["student-courses"] });
      queryClient.invalidateQueries({ queryKey: ["student-dashboard"] });

      const data = result?.data || result?.data?.data || result || {};
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
    let lastToastAt = 0;
    enableContentProtection({
      onBlocked: (message) => {
        const now = Date.now();
        if (now - lastToastAt < 1200) return;
        lastToastAt = now;
        toast.error(message || "Content protection is active");
      },
    });
    return () => {
      disableContentProtection();
    };
  }, []);

  const handleDevToolsDetected = useCallback((isOpen) => {
    setDevToolsOpen(isOpen);
    if (isOpen && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  useDevToolsDetection(handleDevToolsDetected);

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
      setCurrentTime(0);
      setDuration(0);
      setMaxWatchedSeconds(0);
      setIsPlaying(false);

      if (!currentLecture || currentLecture.hasAccess === false) return;

      const secureUrl = getLectureSource(currentLecture);
      if (!secureUrl) return;

      setIsLoadingVideo(true);
      try {
        let blob;
        const isAbsolute = /^https?:\/\//i.test(secureUrl);

        if (isAbsolute) {
          const response = await fetch(secureUrl, { credentials: "include" });
          if (!response.ok) throw new Error("Failed to fetch secure stream");
          blob = await response.blob();
        } else {
          const response = await api.get(secureUrl, { responseType: "blob" });
          blob = response.data;
        }

        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        setVideoSrc(objectUrl);
      } catch {
        if (!cancelled) {
          setVideoSrc("");
          toast.error("Unable to load secure video stream");
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
  }, [currentLecture]);

  const handlePlayPause = async () => {
    const video = videoRef.current;
    if (!video || devToolsOpen || currentLecture?.hasAccess === false || !videoSrc) return;
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
    if (!video || duration <= 0) return;
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
    currentLecture.hasAccess !== false &&
    watchedPercent >= 80 &&
    !currentLecture.isCompleted &&
    !markCompleteMutation.isPending;

  const contentBlocked = devToolsOpen;
  const showLockedOverlay = !currentLecture || currentLecture.hasAccess === false || !videoSrc;

  return (
    <div className="relative space-y-6 protected-content">
      <Toaster position="top-right" />

      <Motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Course Player</h1>
      </Motion.section>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-3xl" />
      ) : isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error?.response?.data?.message || error?.message || "Failed to load course"}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[7fr_3fr]">
          <Motion.section {...fadeUp} className="space-y-4">
            <div
              ref={playerRef}
              className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-black ${
                contentBlocked ? "blur-sm" : ""
              }`}
            >
              <div className="aspect-video">
                <video
                  ref={videoRef}
                  src={videoSrc || undefined}
                  className="h-full w-full object-cover"
                  style={{ pointerEvents: "none", filter: "none" }}
                  controls={false}
                  controlsList="nodownload"
                  disablePictureInPicture
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
                  <p className="text-xs text-slate-200">Contact your teacher to unlock</p>
                </div>
              )}

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
                </div>
              </div>

              <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handlePlayPause}
                    disabled={showLockedOverlay || contentBlocked}
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
                  disabled={showLockedOverlay || contentBlocked}
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
                      disabled={showLockedOverlay || contentBlocked}
                    >
                      Fullscreen
                    </button>
                  </div>
                </div>
              </div>

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
                                    <span className="text-emerald-500">✓</span>
                                  ) : lecture.hasAccess === false ? (
                                    <span className="text-slate-400">🔒</span>
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

      {devToolsOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/90 px-6 text-center text-white">
          <div>
            <p className="font-heading text-2xl">Developer tools detected.</p>
            <p className="mt-2 text-sm text-slate-200">
              Content is protected. Please close DevTools to continue.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentCoursePlayer;



