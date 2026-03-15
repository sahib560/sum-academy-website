import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

function ProtectedRoute({ allowedRoles = [], children }) {
  const { isAuthenticated, role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location.pathname }, replace: true });
      return;
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      navigate("/unauthorized", { replace: true });
    }
  }, [allowedRoles, isAuthenticated, loading, location.pathname, navigate, role]);

  if (loading || (isAuthenticated && allowedRoles.length > 0 && !role)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
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
