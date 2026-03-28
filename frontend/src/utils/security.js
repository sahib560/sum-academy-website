import { createElement, useEffect, useMemo, useState } from "react";

const STYLE_ID = "sum-content-protection-style";
const DEVTOOLS_THRESHOLD = 160;

let activeListeners = [];
let activeStyleElement = null;

const removeActiveListeners = () => {
  activeListeners.forEach(({ type, handler, options }) => {
    document.removeEventListener(type, handler, options);
  });
  activeListeners = [];
};

const normalizeKey = (event) => String(event?.key || "").toLowerCase();

const maskEmail = (email = "") => {
  const clean = String(email || "").trim();
  if (!clean) return "***";
  return `${clean.slice(0, 3)}***`;
};

export const enableContentProtection = (config = {}) => {
  const onBlocked =
    typeof config.onBlocked === "function" ? config.onBlocked : () => {};

  disableContentProtection();

  const bind = (type, handler, options) => {
    document.addEventListener(type, handler, options);
    activeListeners.push({ type, handler, options });
  };

  bind("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onBlocked("Content protection is active");
  });

  bind("copy", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onBlocked("Copying content is not allowed");
  });

  bind("cut", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onBlocked("Content protection is active");
  });

  bind("paste", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onBlocked("Pasting content is not allowed");
  });

  bind("dragstart", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onBlocked("Content protection is active");
  });

  bind("keydown", (event) => {
    const key = normalizeKey(event);
    const blocked = [
      event.ctrlKey && key === "c",
      event.ctrlKey && key === "s",
      event.ctrlKey && key === "u",
      event.ctrlKey && key === "p",
      event.ctrlKey && event.shiftKey && key === "i",
      event.ctrlKey && event.shiftKey && key === "j",
      event.ctrlKey && event.shiftKey && key === "c",
      key === "f12",
      key === "printscreen",
    ];

    if (!blocked.some(Boolean)) return;

    event.preventDefault();
    event.stopPropagation();
    onBlocked("Content protection is active");
  });

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.innerHTML = `
    .protected-content {
      user-select: none !important;
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
    }
    .protected-content img {
      pointer-events: none !important;
      -webkit-user-drag: none !important;
      user-drag: none !important;
    }
  `;
  document.head.appendChild(style);
  activeStyleElement = style;
};

export const disableContentProtection = () => {
  removeActiveListeners();

  if (activeStyleElement) {
    activeStyleElement.remove();
    activeStyleElement = null;
  }
};

export const useDevToolsDetection = (onDetected) => {
  useEffect(() => {
    const notify = typeof onDetected === "function" ? onDetected : () => {};
    const check = () => {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      notify(widthDiff > DEVTOOLS_THRESHOLD || heightDiff > DEVTOOLS_THRESHOLD);
    };

    window.addEventListener("resize", check);
    check();
    const interval = window.setInterval(check, 1000);

    return () => {
      window.removeEventListener("resize", check);
      window.clearInterval(interval);
    };
  }, [onDetected]);
};

export const WatermarkOverlay = ({ studentName = "", email = "" }) => {
  const positions = useMemo(
    () => [
      { top: "10%", left: "10%" },
      { top: "10%", right: "10%" },
      { top: "80%", left: "10%" },
      { top: "80%", right: "10%" },
      { top: "45%", left: "40%" },
    ],
    []
  );

  const [position, setPosition] = useState({ top: "10%", left: "10%" });

  useEffect(() => {
    const interval = window.setInterval(() => {
      const randomIndex = Math.floor(Math.random() * positions.length);
      setPosition(positions[randomIndex]);
    }, 30000);
    return () => window.clearInterval(interval);
  }, [positions]);

  return createElement(
    "div",
    {
      style: {
        position: "absolute",
        ...position,
        opacity: 0.12,
        pointerEvents: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        zIndex: 999,
        color: "white",
        fontSize: "14px",
        fontWeight: "700",
        transform: "rotate(-15deg)",
        whiteSpace: "nowrap",
      },
    },
    `${studentName || "Student"} - ${maskEmail(email)}`
  );
};
