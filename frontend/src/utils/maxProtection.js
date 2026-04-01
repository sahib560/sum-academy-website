const violationCount = { current: 0 };
let onViolationCallback = null;
let blurTimeout = null;
let activeCleanup = null;

export const setViolationCallback = (cb) => {
  onViolationCallback = typeof cb === "function" ? cb : null;
};

const getReasonText = (reason) => {
  const texts = {
    screenshot:
      "Screenshot attempt detected. Content has been protected. This violation has been logged.",
    tab_switch:
      "You switched away from this page. Please stay on the quiz at all times.",
    window_blur:
      "You minimized or switched the browser window. This is not allowed during quiz.",
    devtools: "Developer tools were opened. This is not allowed.",
    printscreen: "Print Screen key was detected. Screenshots are not allowed.",
    screen_record: "Screen recording was blocked.",
    default:
      "A security violation was detected. This has been logged with your account.",
  };
  return texts[reason] || texts.default;
};

export const blurContent = () => {
  const targets = document.querySelectorAll(
    ".protected-zone, .quiz-content, .video-wrapper, .lecture-content"
  );
  targets.forEach((element) => {
    element.style.filter = "blur(30px)";
    element.style.transition = "filter 0.1s";
  });

  clearTimeout(blurTimeout);
  blurTimeout = setTimeout(() => {
    unblurContent();
  }, 5000);
};

export const unblurContent = () => {
  const targets = document.querySelectorAll(
    ".protected-zone, .quiz-content, .video-wrapper, .lecture-content"
  );
  targets.forEach((element) => {
    element.style.filter = "none";
  });
};

export const showWarningOverlay = (reason, count) => {
  const existing = document.getElementById("sum-warning");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "sum-warning";
  overlay.innerHTML = `
    <div style="
      position:fixed;top:0;left:0;right:0;bottom:0;
      background:rgba(13,15,26,0.96);z-index:2147483647;
      display:flex;flex-direction:column;
      align-items:center;justify-content:center;
      font-family:DM Sans,sans-serif;
      padding: 24px;
      box-sizing: border-box;
    ">
      <div style="
        width:72px;height:72px;border-radius:50%;
        background:#dc2626;display:flex;
        align-items:center;justify-content:center;
        margin-bottom:20px;
      ">
        <svg width="36" height="36" viewBox="0 0 24 24"
             fill="none" stroke="white" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <h2 style="color:#fff;font-size:22px;font-weight:700;
                 margin-bottom:10px;text-align:center;">
        Security Violation Detected
      </h2>
      <p style="color:#94a3b8;font-size:14px;
                text-align:center;max-width:340px;
                line-height:1.7;margin-bottom:6px;">
        ${getReasonText(reason)}
      </p>
      <p style="color:#ef4444;font-size:13px;
                margin-bottom:28px;font-weight:600;">
        Violation ${count} of 3 - Auto-submit at 3
      </p>
      <button id="sum-warn-close" style="
        background:#4a63f5;color:white;border:none;
        padding:13px 32px;border-radius:12px;
        font-size:14px;font-weight:600;
        cursor:pointer;font-family:inherit;
      ">
        I understand - Return to content
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("sum-warn-close")?.addEventListener("click", () => {
    overlay.remove();
    unblurContent();
  });

  setTimeout(() => {
    overlay.remove();
    unblurContent();
  }, 10000);
};

const recordViolation = (reason) => {
  violationCount.current += 1;
  console.warn(
    `[Protection] Violation #${violationCount.current}: ${String(reason || "default")}`
  );
  blurContent();
  showWarningOverlay(reason, violationCount.current);
  if (typeof onViolationCallback === "function") {
    onViolationCallback(violationCount.current, reason);
  }
};

const stopEvent = (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === "function") {
    event.stopImmediatePropagation();
  }
};

export const blockKeys = (event) => {
  const key = String(event?.key || "");
  const lower = key.toLowerCase();
  const blocked = [
    { check: key === "PrintScreen", reason: "printscreen" },
    { check: key === "F12", reason: "devtools" },
    { check: event.ctrlKey && event.shiftKey && lower === "i", reason: "devtools" },
    { check: event.ctrlKey && event.shiftKey && lower === "j", reason: "devtools" },
    { check: event.ctrlKey && event.shiftKey && lower === "c", reason: "devtools" },
    { check: event.ctrlKey && lower === "u", reason: "devtools" },
    { check: event.ctrlKey && lower === "p", reason: "screenshot" },
    { check: event.ctrlKey && lower === "s", reason: "screenshot" },
    { check: event.ctrlKey && lower === "c", reason: "screenshot" },
    { check: event.metaKey && event.shiftKey && key === "3", reason: "screenshot" },
    { check: event.metaKey && event.shiftKey && key === "4", reason: "screenshot" },
    { check: event.metaKey && event.shiftKey && key === "5", reason: "screenshot" },
    { check: event.metaKey && key === "PrintScreen", reason: "screenshot" },
    { check: event.altKey && key === "PrintScreen", reason: "screenshot" },
    { check: key === "F1", reason: "default" },
    { check: event.ctrlKey && lower === "a", reason: "default" },
  ];

  for (const { check, reason } of blocked) {
    if (!check) continue;
    stopEvent(event);
    recordViolation(reason);
    return false;
  }
  return true;
};

export const blockPrintScreen = (event) => {
  const key = String(event?.key || "");
  const code = String(event?.code || "");
  if (key !== "PrintScreen" && code !== "PrintScreen") return;

  stopEvent(event);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText("Screenshot blocked by SUM Academy").catch(() => {});
  }
  recordViolation("printscreen");
};

export const setupVisibilityGuard = (onViolate) => {
  const onHidden = () => {
    if (document.hidden || document.visibilityState === "hidden") {
      recordViolation("tab_switch");
      if (typeof onViolate === "function") onViolate("tab_switch");
    }
  };

  const onBlur = () => {
    recordViolation("window_blur");
    if (typeof onViolate === "function") onViolate("window_blur");
  };

  const onFocus = () => {
    unblurContent();
  };

  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);

  return () => {
    document.removeEventListener("visibilitychange", onHidden);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("focus", onFocus);
  };
};

export const setupDevToolsDetection = () => {
  let devToolsOpen = false;

  const check = () => {
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    const isOpen = widthDiff > threshold || heightDiff > threshold;

    if (isOpen && !devToolsOpen) {
      devToolsOpen = true;
      recordViolation("devtools");
    } else if (!isOpen) {
      devToolsOpen = false;
    }
  };

  const interval = setInterval(check, 1000);
  window.addEventListener("resize", check);

  return () => {
    clearInterval(interval);
    window.removeEventListener("resize", check);
  };
};

export const blockScreenCapture = () => {
  if (!navigator.mediaDevices) return () => {};

  const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia?.bind(
    navigator.mediaDevices
  );

  if (navigator.mediaDevices.getDisplayMedia) {
    navigator.mediaDevices.getDisplayMedia = async () => {
      recordViolation("screen_record");
      throw new DOMException("Screen capture blocked by SUM Academy", "NotAllowedError");
    };
  }

  return () => {
    if (originalGetDisplayMedia && navigator.mediaDevices) {
      navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
    }
  };
};

export const applyCSSScreenshotBlock = () => {
  const existing = document.getElementById("css-screenshot-block");
  if (existing) return;

  const style = document.createElement("style");
  style.id = "css-screenshot-block";
  style.textContent = `
    .protected-zone {
      position: relative;
      isolation: isolate;
    }
    .protected-zone::after {
      content: "";
      position: absolute;
      inset: 0;
      background: transparent;
      mix-blend-mode: difference;
      pointer-events: none;
      z-index: 1;
    }
    @media print {
      .protected-zone,
      .quiz-content,
      .video-wrapper,
      .lecture-content {
        display: none !important;
        visibility: hidden !important;
      }
      body::after {
        content: "This content is protected by SUM Academy";
        display: block;
        text-align: center;
        font-size: 24px;
        padding: 100px;
      }
    }
  `;
  document.head.appendChild(style);
};

export const enforceFullscreen = (onExit) => {
  const request = () => {
    const root = document.documentElement;
    if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
    else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
    else if (root.mozRequestFullScreen) root.mozRequestFullScreen();
  };

  request();

  const onChange = () => {
    const isFullscreen =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement;

    if (isFullscreen) return;
    recordViolation("window_blur");
    if (typeof onExit === "function") onExit();
    setTimeout(request, 1000);
  };

  document.addEventListener("fullscreenchange", onChange);
  document.addEventListener("webkitfullscreenchange", onChange);
  document.addEventListener("mozfullscreenchange", onChange);

  return () => {
    document.removeEventListener("fullscreenchange", onChange);
    document.removeEventListener("webkitfullscreenchange", onChange);
    document.removeEventListener("mozfullscreenchange", onChange);
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };
};

export const setupMaxProtection = ({
  onViolation,
  enforceFullscreenMode = false,
  quizMode = false,
} = {}) => {
  if (typeof activeCleanup === "function") {
    activeCleanup();
  }

  setViolationCallback(onViolation);
  violationCount.current = 0;
  applyCSSScreenshotBlock();

  const previousBodyUserSelect = document.body.style.userSelect;
  const previousBodyWebkitUserSelect = document.body.style.webkitUserSelect;

  const onContextMenu = (event) => {
    stopEvent(event);
    recordViolation("screenshot");
  };
  const onCopy = (event) => {
    stopEvent(event);
    recordViolation("screenshot");
  };
  const onCut = (event) => {
    stopEvent(event);
    recordViolation("screenshot");
  };
  const onDragStart = (event) => {
    stopEvent(event);
    recordViolation("screenshot");
  };

  document.addEventListener("keydown", blockKeys, true);
  document.addEventListener("keyup", blockPrintScreen, true);
  document.addEventListener("contextmenu", onContextMenu, true);
  document.addEventListener("copy", onCopy, true);
  document.addEventListener("cut", onCut, true);
  document.addEventListener("dragstart", onDragStart, true);

  document.body.style.userSelect = "none";
  document.body.style.webkitUserSelect = "none";

  const cleanupCapture = blockScreenCapture();
  const cleanupDevTools = setupDevToolsDetection();
  let cleanupVisibility = () => {};
  let cleanupFullscreen = () => {};

  if (quizMode) {
    cleanupVisibility = setupVisibilityGuard(onViolation);
    if (enforceFullscreenMode) {
      cleanupFullscreen = enforceFullscreen(() => {
        if (typeof onViolation === "function") {
          onViolation(violationCount.current, "window_blur");
        }
      });
    }
  }

  activeCleanup = () => {
    document.removeEventListener("keydown", blockKeys, true);
    document.removeEventListener("keyup", blockPrintScreen, true);
    document.removeEventListener("contextmenu", onContextMenu, true);
    document.removeEventListener("copy", onCopy, true);
    document.removeEventListener("cut", onCut, true);
    document.removeEventListener("dragstart", onDragStart, true);

    document.body.style.userSelect = previousBodyUserSelect;
    document.body.style.webkitUserSelect = previousBodyWebkitUserSelect;

    cleanupCapture();
    cleanupDevTools();
    cleanupVisibility();
    cleanupFullscreen();

    const style = document.getElementById("css-screenshot-block");
    if (style) style.remove();
    const warning = document.getElementById("sum-warning");
    if (warning) warning.remove();
    clearTimeout(blurTimeout);
    unblurContent();
    setViolationCallback(null);
    activeCleanup = null;
  };

  return activeCleanup;
};

export const getViolationCount = () => violationCount.current;
