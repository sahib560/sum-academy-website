import { createContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { firebaseAuth } from "../config/firebase.js";
import api from "../api/axios.js";

const AuthContext = createContext(null);
const LOGIN_ALERT_STORAGE_KEY = "sumacademy:login-alert";

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
    let cancelled = false;

    const fetchProfile = async (firebaseUser, attempt = 0) => {
      try {
        const idToken = await firebaseUser.getIdToken(true);
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
        const mismatchCode =
          error?.response?.data?.errors?.code || error?.response?.data?.code;

        if ((status === 401 || status === 403) && firebaseAuth.currentUser) {
          if (
            mismatchCode === "DEVICE_IP_MISMATCH" &&
            typeof window !== "undefined"
          ) {
            const message =
              error?.response?.data?.error ||
              error?.response?.data?.message ||
              "You are trying to login from another device or network.";
            const warning =
              error?.response?.data?.errors?.warning ||
              "Do not try again from another device/IP, otherwise your account may be blocked.";
            window.sessionStorage.setItem(
              LOGIN_ALERT_STORAGE_KEY,
              JSON.stringify({
                type: "device_ip_mismatch",
                message,
                warning,
                contactAdmin: true,
              })
            );
          }

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

    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      async (firebaseUser) => {
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
        fetchProfile(firebaseUser);
      }
    );

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
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
