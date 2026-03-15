import { createContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChange } from "../services/auth.service.js";
import api from "../api/axios.js";

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let retryTimer = null;
    let cancelled = false;

    const fetchProfile = async (attempt = 0) => {
      try {
        const response = await api.get("/auth/me");
        const profile = response.data?.user || null;
        if (cancelled) return;
        setUserProfile(profile);
        setRole(profile?.role || null);
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        const message = typeof error === "string" ? error : error?.message;
        if (message === "User profile not found" && attempt < 5) {
          retryTimer = setTimeout(() => fetchProfile(attempt + 1), 500);
          return;
        }
        setUserProfile(null);
        setRole(null);
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      setLoading(true);
      setUser(firebaseUser || null);
      setUserProfile(null);
      setRole(null);
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      fetchProfile();
    });

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
      isAdmin: role === "admin",
      isTeacher: role === "teacher",
      isStudent: role === "student",
    };
  }, [user, userProfile, role, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext, AuthProvider };
