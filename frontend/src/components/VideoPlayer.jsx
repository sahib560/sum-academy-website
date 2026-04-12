import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axios.js";
import { HlsVideo } from "./HlsVideo.jsx";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatTime = (secs) => {
  if (!secs || Number.isNaN(secs)) return "0:00";
  const minutes = Math.floor(secs / 60);
  const seconds = Math.floor(secs % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export default function VideoPlayer({
  lectureId,
  title,
  onComplete,
  onProgress,
  onTimeUpdate,
  onPlayState,
  onLoadingChange,
  onErrorChange,
  onStreamReady,
  studentName,
  studentEmail,
  disableSeeking = false,
  videoRef: externalVideoRef,
}) {
  const internalVideoRef = useRef(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const containerRef = useRef(null);
  const progressRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [watermarkPos, setWatermarkPos] = useState({ top: "15%", left: "10%" });
  const [showControls, setShowControls] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [buffered, setBuffered] = useState(0);

  const isHls = useMemo(
    () => /\.m3u8(\?|#|$)/i.test(String(streamUrl || "")),
    [streamUrl]
  );

  useEffect(() => {
    if (!lectureId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setStreamUrl("");

    const fetchUrl = async () => {
      try {
        const res = await api.get(`/video/${lectureId}/stream-url`);
        if (cancelled) return;
        const url = res?.data?.data?.streamUrl || "";
        setStreamUrl(url);
        if (typeof onStreamReady === "function") onStreamReady(url);
      } catch (e) {
        if (cancelled) return;
        const message =
          e?.response?.data?.message || "Failed to load video. Please try again.";
        setError(message);
        if (typeof onErrorChange === "function") onErrorChange(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          if (typeof onLoadingChange === "function") onLoadingChange(false);
        }
      }
    };
    fetchUrl();
    return () => {
      cancelled = true;
    };
  }, [lectureId, onErrorChange, onLoadingChange, onStreamReady]);

  useEffect(() => {
    if (!streamUrl || !videoRef.current) return undefined;
    const video = videoRef.current;
    if (!isHls) {
      video.src = streamUrl;
    }
    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    video.controlsList = "nodownload";
    video.disablePictureInPicture = true;

    const onLoadedMetadata = () => {
      setDuration(video.duration || 0);
      if (typeof onTimeUpdate === "function") {
        onTimeUpdate(video.currentTime || 0, video.duration || 0);
      }
    };

    const onTime = () => {
      const pct = video.duration
        ? clamp((video.currentTime / video.duration) * 100, 0, 100)
        : 0;
      setCurrentTime(video.currentTime || 0);
      progressRef.current = Math.round(pct);
      if (typeof onProgress === "function") onProgress(Math.round(pct), video.currentTime || 0, video.duration || 0);
      if (typeof onTimeUpdate === "function") onTimeUpdate(video.currentTime || 0, video.duration || 0);

      if (video.buffered.length > 0 && video.duration > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBuffered(clamp((bufferedEnd / video.duration) * 100, 0, 100));
      }

      if (pct >= 80 && !video.dataset.marked) {
        video.dataset.marked = "true";
        if (typeof onComplete === "function") onComplete();
      }
    };

    const onError = () => {
      const errors = {
        1: "Video loading aborted",
        2: "Network error while loading video",
        3: "Video decoding failed — try refreshing",
        4: "Video format not supported by your browser",
      };
      const code = video.error?.code;
      const message = errors[code] || "Video failed to load. Please refresh.";
      setError(message);
      if (typeof onErrorChange === "function") onErrorChange(message);
    };

    const onWaiting = () => {
      setLoading(true);
      if (typeof onLoadingChange === "function") onLoadingChange(true);
    };
    const onCanPlay = () => {
      setLoading(false);
      if (typeof onLoadingChange === "function") onLoadingChange(false);
    };
    const onPlaying = () => {
      setLoading(false);
      setIsPlaying(true);
      if (typeof onPlayState === "function") onPlayState(true);
      if (typeof onLoadingChange === "function") onLoadingChange(false);
    };
    const onPause = () => {
      setIsPlaying(false);
      if (typeof onPlayState === "function") onPlayState(false);
    };
    const onEnded = () => {
      setIsPlaying(false);
      if (typeof onPlayState === "function") onPlayState(false);
      if (typeof onComplete === "function") onComplete();
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("error", onError);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("error", onError);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      if (!isHls) video.src = "";
    };
  }, [
    isHls,
    onComplete,
    onErrorChange,
    onLoadingChange,
    onPlayState,
    onProgress,
    onTimeUpdate,
    streamUrl,
    videoRef,
  ]);

  useEffect(() => {
    const positions = [
      { top: "10%", left: "5%" },
      { top: "10%", left: "70%" },
      { top: "75%", left: "5%" },
      { top: "75%", left: "70%" },
      { top: "40%", left: "35%" },
    ];
    const interval = setInterval(() => {
      setWatermarkPos(positions[Math.floor(Math.random() * positions.length)]);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, [videoRef]);

  const seek = useCallback(
    (event) => {
      if (disableSeeking) return;
      const video = videoRef.current;
      const bar = event.currentTarget;
      if (!video || !bar || !video.duration) return;
      const rect = bar.getBoundingClientRect();
      const pct = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      video.currentTime = pct * video.duration;
    },
    [disableSeeking, videoRef]
  );

  const changeSpeed = useCallback(
    (next) => {
      setSpeed(next);
      if (videoRef.current) videoRef.current.playbackRate = next;
    },
    [videoRef]
  );

  const watermarkText = useMemo(() => {
    const name = studentName || "SUM Academy";
    const email = studentEmail ? `${String(studentEmail).slice(0, 4)}***` : "";
    return `${name} ${email} | SUM Academy`.trim();
  }, [studentEmail, studentName]);

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      style={{
        position: "relative",
        background: "#000",
        borderRadius: "12px",
        overflow: "hidden",
        aspectRatio: "16/9",
        width: "100%",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.7)",
            zIndex: 10,
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              border: "4px solid rgba(255,255,255,0.2)",
              borderTopColor: "#4a63f5",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <p style={{ color: "#94a3b8", fontSize: "13px" }}>Loading video...</p>
        </div>
      )}

      {error && !loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0d0f1a",
            zIndex: 10,
            flexDirection: "column",
            gap: "16px",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              background: "#dc2626",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p
            style={{
              color: "#fff",
              fontSize: "15px",
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            {error}
          </p>
          <button
            onClick={() => {
              setError("");
              setLoading(true);
              const v = videoRef.current;
              if (v) v.load();
            }}
            style={{
              background: "#4a63f5",
              color: "#fff",
              border: "none",
              padding: "10px 24px",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            Retry
          </button>
        </div>
      )}

      <video
        ref={videoRef}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
        playsInline
        controlsList="nodownload"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
      />

      {isHls ? <HlsVideo src={streamUrl} videoRef={videoRef} /> : null}

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: "48px",
          zIndex: 5,
          background: "transparent",
          cursor: "pointer",
        }}
        onClick={togglePlay}
        onContextMenu={(e) => e.preventDefault()}
      />

      <div
        style={{
          position: "absolute",
          ...watermarkPos,
          zIndex: 20,
          opacity: 0.12,
          pointerEvents: "none",
          userSelect: "none",
          color: "#fff",
          fontSize: "13px",
          fontWeight: "700",
          transform: "rotate(-15deg)",
          whiteSpace: "nowrap",
          transition: "all 3s ease",
          fontFamily: "monospace",
        }}
      >
        {watermarkText}
      </div>

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: "rgba(255,255,255,0.1)",
          zIndex: 15,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${buffered}%`,
            background: "rgba(74,99,245,0.5)",
            transition: "width 0.5s",
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
          padding: "20px 16px 10px",
          zIndex: 15,
          opacity: showControls ? 1 : 0,
          transition: "opacity 0.3s",
        }}
      >
        <div
          onClick={seek}
          style={{
            height: "4px",
            background: "rgba(255,255,255,0.2)",
            borderRadius: "2px",
            cursor: "pointer",
            marginBottom: "10px",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              height: "100%",
              width: `${buffered}%`,
              background: "rgba(255,255,255,0.3)",
              borderRadius: "2px",
            }}
          />
          <div
            style={{
              position: "absolute",
              height: "100%",
              width: duration ? `${(currentTime / duration) * 100}%` : "0%",
              background: "#4a63f5",
              borderRadius: "2px",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <button
            onClick={togglePlay}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              padding: "4px",
            }}
            type="button"
            title={title || "Play"}
          >
            {isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (videoRef.current) videoRef.current.volume = v;
            }}
            style={{ width: "70px", accentColor: "#4a63f5" }}
          />

          <span
            style={{
              color: "#94a3b8",
              fontSize: "12px",
              fontFamily: "monospace",
            }}
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div style={{ flex: 1 }} />

          <select
            value={speed}
            onChange={(e) => changeSpeed(parseFloat(e.target.value))}
            style={{
              background: "#1e293b",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
