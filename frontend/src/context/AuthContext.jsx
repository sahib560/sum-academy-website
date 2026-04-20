import { createContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { firebaseAuth } from "../config/firebase.js";
import api from "../api/axios.js";

const AuthContext = createContext(null);
const LOGIN_ALERT_STORAGE_KEY = "sumacademy:login-alert";
const LOGIN_ALERT_EVENT = "sumacademy:login-alert";
const PROFILE_HEARTBEAT_MS = 5 * 60 * 1000;

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isStudent, setIsStudent] = useState(false);

  useEffect(() => {
    let retryTimer = null;
    let heartbeatTimer = null;
    let cancelled = false;
    let lastProfileFetchAt = 0;
    let visibilityHandler = null;
    let focusHandler = null;

    const clearHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    const pushLoginAlert = (payload = {}) => {
      if (typeof window === "undefined") return;
      window.sessionStorage.setItem(
        LOGIN_ALERT_STORAGE_KEY,
        JSON.stringify(payload)
      );
      window.dispatchEvent(
        new CustomEvent(LOGIN_ALERT_EVENT, {
          detail: payload,
        })
      );
    };

    const fetchProfile = async (
      firebaseUser,
      attempt = 0,
      options = {}
    ) => {
      const { forceRefresh = false } = options;
      try {
        const idToken = await firebaseUser.getIdToken(forceRefresh);
        const response = await api.get("/auth/me", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const profile =
          response.data?.user ||
          response.data?.data?.user ||
          response.data?.data;
        if (!profile) {
          throw new Error("Profile not found in response");
        }
        if (cancelled) return;
        setUser(firebaseUser);
        setUserProfile(profile);
        setRole(profile.role);
        setIsAdmin(profile.role === "admin");
        setIsTeacher(profile.role === "teacher");
        setIsStudent(profile.role === "student");
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        const status = error?.response?.status;
        const errorCode =
          error?.response?.data?.errors?.code || error?.response?.data?.code;
        const errorMessage =
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          "";
        const isDeactivated =
          errorCode === "ACCOUNT_DEACTIVATED" ||
          /deactivat/i.test(String(errorMessage));

        if ((status === 401 || status === 403) && firebaseAuth.currentUser) {
          if (isDeactivated) {
            pushLoginAlert({
              type: "account_deactivated",
              message:
                "Your account has been deactivated by admin. Please contact admin to restore access.",
              contactAdmin: true,
            });
          }

          if (
            (errorCode === "DEVICE_IP_MISMATCH" ||
              errorCode === "DEVICE_MISMATCH") &&
            typeof window !== "undefined"
          ) {
            const message =
              error?.response?.data?.error ||
              error?.response?.data?.message ||
              "You are trying to login from another device or network.";
            const warning =
              error?.response?.data?.errors?.warning ||
              "Do not try again from another device/IP, otherwise your account may be blocked.";
            pushLoginAlert({
              type: "device_ip_mismatch",
              message,
              warning,
              contactAdmin: true,
            });
          }

          clearHeartbeat();
          try {
            await signOut(firebaseAuth);
          } catch {
            // ignore sign out errors
          }
        }

        if (status === 404 && attempt < 8) {
          retryTimer = setTimeout(
            () => fetchProfile(firebaseUser, attempt + 1),
            500
          );
          return;
        }
        console.error("Auth state error:", error);
        setUser(null);
        setUserProfile(null);
        setRole(null);
        setIsAdmin(false);
        setIsTeacher(false);
        setIsStudent(false);
        setLoading(false);
      }
    };

    const maybeFetchProfile = (options = {}) => {
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser || cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const now = Date.now();
      const minGapMs = options.force ? 0 : 30 * 1000;
      if (now - lastProfileFetchAt < minGapMs) return;
      lastProfileFetchAt = now;
      fetchProfile(currentUser, 0, { forceRefresh: Boolean(options.forceRefresh) });
    };

    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      async (firebaseUser) => {
        clearHeartbeat();
        setLoading(true);
        if (!firebaseUser) {
          setUser(null);
          setUserProfile(null);
          setRole(null);
          setIsAdmin(false);
          setIsTeacher(false);
          setIsStudent(false);
          setLoading(false);
          return;
        }

        setUser(firebaseUser);
        lastProfileFetchAt = 0;
        await fetchProfile(firebaseUser, 0, { forceRefresh: true });
        heartbeatTimer = setInterval(() => {
          maybeFetchProfile({ forceRefresh: false });
        }, PROFILE_HEARTBEAT_MS);
      }
    );

    if (typeof document !== "undefined") {
      visibilityHandler = () => {
        if (document.visibilityState === "visible") {
          maybeFetchProfile({ forceRefresh: false });
        }
      };
      document.addEventListener("visibilitychange", visibilityHandler);
    }

    if (typeof window !== "undefined") {
      focusHandler = () => {
        maybeFetchProfile({ forceRefresh: false });
      };
      window.addEventListener("focus", focusHandler);
    }

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      clearHeartbeat();
      if (visibilityHandler && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
      if (focusHandler && typeof window !== "undefined") {
        window.removeEventListener("focus", focusHandler);
      }
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => {
    const isAuthenticated = Boolean(user);
    return {
      user,
      userProfile,
      role,
      loading,
      isAuthenticated,
      isAdmin,
      isTeacher,
      isStudent,
    };
  }, [user, userProfile, role, loading, isAdmin, isTeacher, isStudent]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext, AuthProvider };
