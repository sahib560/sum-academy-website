import { useEffect, useRef } from "react";

// Minimal HLS wrapper:
// - Uses native HLS if available (Safari/iOS)
// - Otherwise uses hls.js (Chrome/Firefox/Edge)
export function HlsVideo({
  src,
  videoRef,
  onReady,
  onFatalError,
}) {
  const hlsRef = useRef(null);

  useEffect(() => {
    const video = videoRef?.current;
    if (!video) return undefined;

    // Cleanup any previous instance.
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {
        // ignore
      }
      hlsRef.current = null;
    }

    if (!src) return undefined;

    const isHls = /\.m3u8(\?|#|$)/i.test(String(src));
    if (!isHls) return undefined;

    // Native HLS (Safari/iOS)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      const onLoaded = () => {
        if (typeof onReady === "function") onReady();
      };
      video.addEventListener("loadeddata", onLoaded);
      return () => {
        video.removeEventListener("loadeddata", onLoaded);
      };
    }

    let cancelled = false;

    (async () => {
      try {
        const mod = await import("hls.js");
        if (cancelled) return;
        const Hls = mod.default;
        if (!Hls?.isSupported?.()) {
          if (typeof onFatalError === "function") {
            onFatalError("HLS is not supported in this browser.");
          }
          return;
        }

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 30,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxBufferSize: 60 * 1000 * 1000,
          fragLoadingTimeOut: 20000,
          manifestLoadingTimeOut: 20000,
          levelLoadingTimeOut: 20000,
        });
        hlsRef.current = hls;

        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(src);
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (typeof onReady === "function") onReady();
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data?.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          if (typeof onFatalError === "function") {
            onFatalError("Stream error. Please retry.");
          }
          try {
            hls.destroy();
          } catch {
            // ignore
          }
          hlsRef.current = null;
        });
      } catch {
        if (typeof onFatalError === "function") {
          onFatalError("Failed to load HLS player.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {
          // ignore
        }
        hlsRef.current = null;
      }
    };
  }, [src, videoRef, onReady, onFatalError]);

  return null;
}

