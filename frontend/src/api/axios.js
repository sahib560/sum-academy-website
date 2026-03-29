import axios from "axios";
import { signOut } from "firebase/auth";
import { firebaseAuth } from "../config/firebase.js";

const LOGIN_ALERT_STORAGE_KEY = "sumacademy:login-alert";
const LOGIN_ALERT_EVENT = "sumacademy:login-alert";

const getDeviceFingerprint = () => {
  if (typeof window === "undefined") return "server";
  const nav = window.navigator;
  const screen = window.screen;

  const components = [
    nav.userAgent,
    nav.language,
    nav.platform,
    `${screen.width}x${screen.height}`,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    nav.hardwareConcurrency || "",
    nav.deviceMemory || "",
  ];

  let hash = 0;
  const str = components.join("|");
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }

  return (
    Math.abs(hash).toString(36) +
    "-" +
    screen.width +
    "-" +
    screen.height +
    "-" +
    String(nav.platform || "")
      .replace(/\s/g, "")
      .toLowerCase()
  );
};

const DEVICE_FINGERPRINT = getDeviceFingerprint();

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

api.interceptors.request.use(
  async (config) => {
    const user = firebaseAuth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    if (typeof window !== "undefined") {
      config.headers = {
        ...config.headers,
        "x-device-fingerprint": DEVICE_FINGERPRINT,
        "x-screen-resolution": `${window.screen.width}x${window.screen.height}`,
        "x-platform": navigator.platform,
      };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    const errorCode =
      error?.response?.data?.errors?.code || error?.response?.data?.code;
    const isAuthBootstrap =
      url.includes("/auth/me") ||
      url.includes("/auth/register") ||
      url.includes("/auth/login");
    const isDeviceMismatch =
      errorCode === "DEVICE_IP_MISMATCH" || errorCode === "DEVICE_MISMATCH";

    if (isDeviceMismatch && !url.includes("/auth/login")) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "You are trying to login from another device or network.";
      const warning =
        error?.response?.data?.errors?.warning ||
        "Do not try again from another device/IP, otherwise your account may be blocked.";

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          LOGIN_ALERT_STORAGE_KEY,
          JSON.stringify({
            type: "device_ip_mismatch",
            message,
            warning,
            contactAdmin: true,
          })
        );
        window.dispatchEvent(
          new CustomEvent(LOGIN_ALERT_EVENT, {
            detail: { message, warning, contactAdmin: true },
          })
        );
      }

      try {
        await signOut(firebaseAuth);
      } catch {
        // ignore sign out errors
      }

      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/login" &&
        window.location.pathname !== "/lms-login"
      ) {
        window.location.assign("/login");
      }
    } else if (status === 401 && !isAuthBootstrap) {
      try {
        await signOut(firebaseAuth);
      } catch {
        // ignore sign out errors
      }
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
