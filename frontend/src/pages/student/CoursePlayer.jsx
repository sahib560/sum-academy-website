import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import {
  FiBookOpen,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiLock,
  FiMaximize2,
  FiPause,
  FiPlay,
  FiShield,
  FiVolume2,
} from "react-icons/fi";
import { Skeleton } from "../../components/Skeleton.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import {
  reportStudentSecurityViolation,
} from "../../services/student.service.js";
import {
  getCourseContent,
  markLectureComplete,
  saveWatchProgress,
} from "../../services/progress.service.js";
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
  const chapters = Array.isArray(payload.chapters) ? payload.chapters : [];
  const subjectQuizzes = Array.isArray(payload.subjectQuizzes)
    ? payload.subjectQuizzes
    : [];

  const normalizedChapters = chapters.map((chapter, chapterIndex) => {
    const lectures = Array.isArray(chapter.lectures) ? chapter.lectures : [];
    const quizzes = Array.isArray(chapter.quizzes) ? chapter.quizzes : [];

    const normalizedLectures = lectures.map((lecture, lectureIndex) => ({
      lectureId: lecture.lectureId || lecture.id || `${chapterIndex}-${lectureIndex}`,
      title: lecture.title || "Lecture",
      duration: lecture.duration || lecture.videoDuration || "--",
      isCompleted: Boolean(lecture.isCompleted),
      completedAt: lecture.completedAt || null,
      watchedPercent: clamp(toNumber(lecture.watchedPercent, 0), 0, 100),
      isLocked: Boolean(lecture.isLocked),
      lockReason: lecture.lockReason || "",
      manuallyUnlocked: Boolean(lecture.manuallyUnlocked),
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

    const normalizedQuizzes = quizzes.map((quiz, quizIndex) => ({
      quizId: quiz.quizId || quiz.id || `${chapterIndex}-quiz-${quizIndex}`,
      title: quiz.title || "Chapter Quiz",
      isLocked: Boolean(quiz.isLocked),
      lockReason: quiz.lockReason || "",
      isAttempted: Boolean(quiz.isAttempted),
      isPassed: Boolean(quiz.isPassed),
      result: quiz.result || null,
    }));

    return {
      chapterId: chapter.chapterId || chapter.id || `chapter-${chapterIndex}`,
      title: chapter.title || "Chapter",
      totalLectures: toNumber(chapter.totalLectures, normalizedLectures.length),
      completedLectures: toNumber(
        chapter.completedLectures,
        normalizedLectures.filter((item) => item.isCompleted).length
      ),
      isChapterComplete: Boolean(chapter.isChapterComplete),
      allLecturesDone: Boolean(chapter.allLecturesDone),
      lectures: normalizedLectures,
      quizzes: normalizedQuizzes,
    };
  });

  const normalizedFinalQuizzes = subjectQuizzes.map((quiz, index) => ({
    quizId: quiz.quizId || quiz.id || `final-${index}`,
    title: quiz.title || "Final Quiz",
    isLocked: Boolean(quiz.isLocked),
    lockReason: quiz.lockReason || "",
    isAttempted: Boolean(quiz.isAttempted),
    isPassed: Boolean(quiz.isPassed),
    result: quiz.result || null,
  }));

  const allLectures = normalizedChapters.flatMap((chapter) => chapter.lectures);
  const isCourseCompleted = Boolean(payload.isCourseCompleted);
  const anyManualRewatch = allLectures.some((lecture) => lecture.manuallyUnlocked);

  return {
    course: {
      id: payload.courseId || "",
      title: payload.courseName || "Course",
      description: payload.courseDescription || "",
      teacherName: payload.teacherName || "Teacher",
    },
    progress: {
      completedLectures: toNumber(
        payload.completedLectures,
        allLectures.filter((lecture) => lecture.isCompleted).length
      ),
      totalLectures: toNumber(payload.totalLectures, allLectures.length),
      completionPercent: clamp(toNumber(payload.overallProgress, 0), 0, 100),
    },
    access: {
      isLockedAfterCompletion: isCourseCompleted,
      canRewatchAny: anyManualRewatch,
    },
    chapters: normalizedChapters,
    subjectQuizzes: normalizedFinalQuizzes,
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
  const lastWatchSaveAtRef = useRef(0);
  const autoCompletedLectureRef = useRef("");

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
  const [lastSavedWatchPercent, setLastSavedWatchPercent] = useState(0);
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
    queryKey: ["student-course-content", courseId],
    queryFn: () => getCourseContent(courseId),
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
    mutationFn: ({
      courseId: targetCourseId,
      lectureId: targetLectureId,
      watchedPercent: targetWatchedPercent = 0,
    }) => markLectureComplete(targetCourseId, targetLectureId, targetWatchedPercent),
    onSuccess: (result) => {
      const data = result || {};
      if (data?.courseCompleted) {
        toast.success("Congratulations! Course completed!");
      } else if (data?.chapterCompleted && data?.chapterQuizUnlocked) {
        toast.success("Chapter complete! Quiz unlocked.");
      } else {
        toast.success("Lecture completed! Keep going.");
      }
      queryClient.invalidateQueries({ queryKey: ["student-course-content", courseId] });
      queryClient.invalidateQueries({ queryKey: ["student-courses"] });
      queryClient.invalidateQueries({ queryKey: ["student-dashboard"] });
      if (data?.certificateGenerated || data?.courseCompleted) {
        setShowCelebration(true);
      }
    },
    onError: (mutationError) => {
      autoCompletedLectureRef.current = "";
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
      normalized.lectures.find((lecture) => !lecture.isLocked) || normalized.lectures[0];
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
      setLastSavedWatchPercent(clamp(toNumber(currentLecture?.watchedPercent, 0), 0, 100));
      lastWatchSaveAtRef.current = 0;
      setIsPlaying(false);

      if (!currentLecture || currentLecture.isLocked) return;

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
  }, [currentLecture]);

  useEffect(() => {
    if (!courseId || !currentLecture?.lectureId) return undefined;
    if (classCompletionLocked || currentLecture.isLocked) return undefined;
    if (watchedPercent <= 0) return undefined;

    const now = Date.now();
    if (now - lastWatchSaveAtRef.current < 10000) return undefined;
    const shouldSave = watchedPercent >= lastSavedWatchPercent + 5 || watchedPercent === 100;
    if (!shouldSave) return undefined;

    lastWatchSaveAtRef.current = now;
    saveWatchProgress(courseId, currentLecture.lectureId, Math.round(watchedPercent))
      .then(() => {
        setLastSavedWatchPercent((prev) =>
          Math.max(prev, Math.round(watchedPercent))
        );
      })
      .catch(() => {});
    return undefined;
  }, [
    courseId,
    currentLecture?.lectureId,
    currentLecture?.isLocked,
    watchedPercent,
    lastSavedWatchPercent,
    classCompletionLocked,
  ]);

  const handlePlayPause = async () => {
    const video = videoRef.current;
    if (!video || currentLecture?.isLocked || !videoSrc || securityLocked) return;
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
    if (lecture.isLocked) {
      toast.error(lecture.lockReason || "This video is locked");
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
      watchedPercent: Math.round(watchedPercent),
    });
  };

  useEffect(() => {
    if (!courseId || !currentLecture?.lectureId) return;
    if (classCompletionLocked || securityLocked) return;
    if (currentLecture.isLocked || currentLecture.isCompleted) return;
    if (markCompleteMutation.isPending) return;

    const roundedWatchedPercent = Math.round(watchedPercent);
    if (roundedWatchedPercent < 100) return;

    const autoKey = `${courseId}:${currentLecture.lectureId}`;
    if (autoCompletedLectureRef.current === autoKey) return;

    autoCompletedLectureRef.current = autoKey;
    markCompleteMutation.mutate({
      courseId,
      lectureId: currentLecture.lectureId,
      watchedPercent: roundedWatchedPercent,
    });
  }, [
    courseId,
    currentLecture?.lectureId,
    currentLecture?.isCompleted,
    currentLecture?.isLocked,
    watchedPercent,
    classCompletionLocked,
    securityLocked,
    markCompleteMutation.isPending,
  ]);

  const canMarkComplete =
    Boolean(currentLecture) &&
    !securityLocked &&
    !classCompletionLocked &&
    currentLecture.isLocked !== true &&
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
    currentLecture.isLocked;
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

      <Motion.section
        {...fadeUp}
        className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-cyan-50 via-white to-blue-50 p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Learning Studio
            </p>
            <h1 className="font-heading text-2xl text-slate-900 md:text-3xl">
              {normalized.course.title || "Course Player"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {normalized.course.teacherName || "Teacher"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-100/70 px-3 py-1 font-semibold text-cyan-700">
              <FiBookOpen className="h-3.5 w-3.5" />
              {normalized.progress.completedLectures}/{normalized.progress.totalLectures} lectures
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100/70 px-3 py-1 font-semibold text-emerald-700">
              <FiCheckCircle className="h-3.5 w-3.5" />
              {Math.round(normalized.progress.completionPercent)}% complete
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100/70 px-3 py-1 font-semibold text-amber-700">
              <FiShield className="h-3.5 w-3.5" />
              Warnings {securityWarningCount}/{VIDEO_VIOLATION_LIMIT}
            </span>
          </div>
        </div>
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
              className="protected-zone video-wrapper relative overflow-hidden rounded-3xl border border-slate-700/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.85)] ring-1 ring-cyan-300/20"
              style={{ position: "relative" }}
            >
              <div className="aspect-video">
                <video
                  ref={videoRef}
                  src={videoSrc || undefined}
                  className="h-full w-full object-cover"
                  style={{ pointerEvents: "none", filter: "contrast(1.05) saturate(1.12)" }}
                  controls={false}
                  controlsList="nodownload nofullscreen"
                  disablePictureInPicture
                  disableRemotePlayback
                  onContextMenu={(event) => event.preventDefault()}
                  onLoadedMetadata={(event) => {
                    const media = event.currentTarget;
                    const loadedDuration = toNumber(media.duration, 0);
                    setDuration(loadedDuration);
                    media.volume = volume;
                    media.playbackRate = playbackRate;
                    const existingPercent = clamp(
                      toNumber(currentLecture?.watchedPercent, 0),
                      0,
                      100
                    );
                    if (loadedDuration > 0 && existingPercent > 0) {
                      setMaxWatchedSeconds((loadedDuration * existingPercent) / 100);
                    }
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
                        : currentLecture?.lockReason || "Complete previous content first."}
                  </p>
                </div>
              )}

              {!showLockedOverlay && !isLoadingVideo && !lectureHasVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/75 px-4 text-center text-xs font-semibold text-white">
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
                  Loading secure video stream...
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {normalized.course.title}
                  </p>
                  <h2 className="font-heading text-2xl text-slate-900">
                    {currentLecture?.title || "Select a lecture"}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {(currentLecture?.isLiveSession ||
                      String(currentLecture?.videoMode || "").toLowerCase() === "live_session") ? (
                      <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold text-rose-700">
                        Live Session Replay
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                      <FiClock className="h-3 w-3" />
                      {currentLecture?.duration || "--"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {normalized.course.teacherName}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>Watched: {Math.round(watchedPercent)}%</p>
                  <p>Lecture: {currentLecture?.duration || "--"}</p>
                  <p>Security: {securityWarningCount}/{VIDEO_VIOLATION_LIMIT}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 text-white shadow-inner">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handlePlayPause}
                    disabled={showLockedOverlay || !lectureHasVideo || !videoSrc}
                  >
                    {isPlaying ? <FiPause className="h-3.5 w-3.5" /> : <FiPlay className="h-3.5 w-3.5" />}
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  <span className="text-xs font-semibold text-slate-100">
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
                  className="w-full accent-cyan-400"
                  disabled={showLockedOverlay || !lectureHasVideo || !videoSrc}
                />

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="text-xs text-slate-200">
                    <span className="mb-1 inline-flex items-center gap-1">
                      <FiVolume2 className="h-3.5 w-3.5" />
                      Volume
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={handleVolume}
                      className="mt-1 w-full accent-cyan-400"
                    />
                  </label>

                  <label className="text-xs text-slate-200">
                    Speed
                    <select
                      value={playbackRate}
                      onChange={handleSpeed}
                      className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white"
                    >
                      {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
                        <option key={speed} value={speed}>
                          {speed}x
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-end">
                    <button
                      className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                      onClick={handleFullscreen}
                      disabled={showLockedOverlay || !lectureHasVideo || !videoSrc}
                    >
                      <FiMaximize2 className="h-3.5 w-3.5" />
                      Fullscreen
                    </button>
                  </div>
                </div>
              </div>

              {(currentLecture?.notes || lectureResources.length > 0) && (
                <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <FiFileText className="h-3.5 w-3.5" />
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
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50"
                        >
                          <span>{item.title || "Resource"}</span>
                          <span className="text-cyan-700">Open</span>
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
              {normalized.subjectQuizzes.length > 0 ? (
                <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-800">
                  <p className="font-semibold">Final assessment unlocks after all chapters.</p>
                  <p className="mt-1">
                    Complete chapter quizzes to unlock your final quiz and certificate.
                  </p>
                </div>
              ) : null}
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
                    className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
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
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3"
                    >
                      <button
                        className="flex w-full items-center justify-between text-left"
                        onClick={() => toggleChapter(chapter.chapterId)}
                      >
                        <div>
                          <span className="text-sm font-semibold text-slate-700">
                            {chapter.title}
                          </span>
                          <p className="text-[11px] text-slate-500">
                            {chapter.completedLectures}/{chapter.totalLectures} lectures
                          </p>
                        </div>
                        <span
                          className={`text-[11px] font-semibold ${
                            chapter.isChapterComplete
                              ? "text-emerald-600"
                              : chapter.lectures[0]?.isLocked
                                ? "text-slate-500"
                                : "text-amber-600"
                          }`}
                        >
                          {chapter.isChapterComplete
                            ? "Complete"
                            : chapter.lectures[0]?.isLocked
                              ? "Locked"
                              : "In Progress"}
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
                                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                                  isCurrent
                                    ? "border-cyan-300 bg-cyan-50"
                                    : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/40"
                                } ${
                                  lecture.isLocked ? "opacity-70" : ""
                                }`}
                                onClick={() => selectLecture(lecture)}
                                title={lecture.isLocked ? lecture.lockReason || "Locked" : ""}
                              >
                                <div className="flex items-center gap-2">
                                  {lecture.isCompleted ? (
                                    <FiCheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                  ) : lecture.isLocked ? (
                                    <FiLock className="h-3.5 w-3.5 text-slate-400" />
                                  ) : isCurrent ? (
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" />
                                  ) : (
                                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                                  )}
                                  <span className="text-slate-700">
                                    {lecture.title}
                                    {lecture.manuallyUnlocked ? (
                                      <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                        Rewatch
                                      </span>
                                    ) : null}
                                  </span>
                                </div>
                                <span className="text-slate-500">{lecture.duration}</span>
                              </button>
                            );
                          })}
                          {chapter.quizzes.map((quiz) => (
                            <div
                              key={quiz.quizId}
                              className={`rounded-xl border px-3 py-2 text-xs ${
                                quiz.isLocked
                                  ? "border-slate-200 bg-slate-100 text-slate-500"
                                  : quiz.isPassed
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-indigo-200 bg-indigo-50 text-indigo-700"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold">Chapter Quiz: {quiz.title}</p>
                                {quiz.isPassed ? (
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    Passed
                                  </span>
                                ) : null}
                              </div>
                              {quiz.result ? (
                                <p className="mt-1 text-[11px]">
                                  Score: {Math.round(toNumber(quiz.result.percentage, 0))}%
                                </p>
                              ) : null}
                              <button
                                type="button"
                                className={`mt-2 rounded-full px-3 py-1 text-[11px] font-semibold ${
                                  quiz.isLocked
                                    ? "cursor-not-allowed bg-slate-200 text-slate-500"
                                    : "bg-indigo-600 text-white"
                                }`}
                                onClick={() => {
                                  if (quiz.isLocked) {
                                    toast.error(quiz.lockReason || "Complete chapter videos first");
                                    return;
                                  }
                                  navigate(`/student/quizzes/${quiz.quizId}/attempt`);
                                }}
                                disabled={quiz.isLocked}
                              >
                                {quiz.isPassed
                                  ? "Review Quiz"
                                  : quiz.isAttempted
                                    ? "Retry Quiz"
                                    : "Start Quiz"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {normalized.subjectQuizzes.length > 0 ? (
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">
                      Final Assessment
                    </p>
                    <div className="mt-2 space-y-2">
                      {normalized.subjectQuizzes.map((quiz) => (
                        <div
                          key={quiz.quizId}
                          className={`rounded-xl border px-3 py-2 text-xs ${
                            quiz.isLocked
                              ? "border-slate-200 bg-slate-100 text-slate-500"
                              : quiz.isPassed
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-indigo-200 bg-white text-indigo-700"
                          }`}
                        >
                          <p className="font-semibold">{quiz.title}</p>
                          {quiz.result ? (
                            <p className="mt-1 text-[11px]">
                              Score: {Math.round(toNumber(quiz.result.percentage, 0))}%
                            </p>
                          ) : null}
                          <button
                            type="button"
                            className={`mt-2 rounded-full px-3 py-1 text-[11px] font-semibold ${
                              quiz.isLocked
                                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                                : "bg-indigo-600 text-white"
                            }`}
                            onClick={() => {
                              if (quiz.isLocked) {
                                toast.error(quiz.lockReason || "Complete all chapters first");
                                return;
                              }
                              navigate(`/student/quizzes/${quiz.quizId}/attempt`);
                            }}
                            disabled={quiz.isLocked}
                          >
                            {quiz.isPassed
                              ? "Review Final Quiz"
                              : quiz.isAttempted
                                ? "Retry Final Quiz"
                                : "Start Final Quiz"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
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



