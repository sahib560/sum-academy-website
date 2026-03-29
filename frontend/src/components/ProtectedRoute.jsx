import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { firebaseAuth } from "../config/firebase.js";
import SplashScreen from "./SplashScreen.jsx";

const LOGIN_ALERT_STORAGE_KEY = "sumacademy:login-alert";

function ProtectedRoute({ allowedRoles = [], children }) {
  const { isAuthenticated, role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasLoginAlert =
    typeof window !== "undefined" &&
    window.sessionStorage.getItem(LOGIN_ALERT_STORAGE_KEY);

  useEffect(() => {
    if (hasLoginAlert) {
      if (
        location.pathname !== "/login" &&
        location.pathname !== "/lms-login"
      ) {
        navigate("/login", { replace: true });
      }
      return;
    }
    if (loading) return;
    if (!isAuthenticated) {
      // Wait for Firebase auth state to finish syncing into context.
      if (firebaseAuth.currentUser) return;
      navigate("/login", { state: { from: location.pathname }, replace: true });
      return;
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      navigate("/unauthorized", { replace: true });
    }
  }, [
    allowedRoles,
    hasLoginAlert,
    isAuthenticated,
    loading,
    location.pathname,
    navigate,
    role,
  ]);

  if (hasLoginAlert) {
    return null;
  }

  if (loading || (isAuthenticated && allowedRoles.length > 0 && !role)) {
    return (
      <SplashScreen
        message="Verifying access..."
        subMessage="Applying role permissions for your dashboard"
      />
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return null;
  }

  return children;
}

export default ProtectedRoute;
