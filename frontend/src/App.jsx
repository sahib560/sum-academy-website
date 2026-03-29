import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Home from "./pages/Home.jsx";
import Courses from "./pages/Courses.jsx";
import Teachers from "./pages/Teachers.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import Login from "./pages/auth/Login.jsx";
import Register from "./pages/auth/Register.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword.jsx";
import AdminLayout from "./layouts/AdminLayout.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
import Users from "./pages/admin/Users.jsx";
import AdminCourses from "./pages/admin/Courses.jsx";
import Payments from "./pages/admin/Payments.jsx";
import Transactions from "./pages/admin/Transactions.jsx";
import Installments from "./pages/admin/Installments.jsx";
import PromoCodes from "./pages/admin/PromoCodes.jsx";
import Certificates from "./pages/admin/Certificates.jsx";
import Announcements from "./pages/admin/Announcements.jsx";
import SiteSettings from "./pages/admin/SiteSettings.jsx";
import TeacherDashboard from "./pages/teacher/Dashboard.jsx";
import TeacherLayout from "./layouts/TeacherLayout.jsx";
import TeacherMyCourses from "./pages/teacher/MyCourses.jsx";
import TeacherStudents from "./pages/teacher/Students.jsx";
import TeacherAnnouncements from "./pages/teacher/Announcements.jsx";
import TeacherSettings from "./pages/teacher/Settings.jsx";
import TeacherSessions from "./pages/teacher/Sessions.jsx";
import TeacherQuizzes from "./pages/teacher/Quizzes.jsx";
import TeacherMyQuizzes from "./pages/teacher/MyQuizzes.jsx";
import TeacherQuizDetailAssignmentGrading from "./pages/teacher/QuizDetailAssignmentGrading.jsx";
import StudentLayout from "./layouts/StudentLayout.jsx";
import StudentDashboard from "./pages/student/Dashboard.jsx";
import StudentMyCourses from "./pages/student/MyCourses.jsx";
import StudentExploreCourses from "./pages/student/ExploreCourses.jsx";
import StudentCoursePlayer from "./pages/student/CoursePlayer.jsx";
import StudentCertificates from "./pages/student/Certificates.jsx";
import StudentQuizzes from "./pages/student/Quizzes.jsx";
import StudentQuizAttempt from "./pages/student/QuizAttempt.jsx";
import StudentPayments from "./pages/student/Payments.jsx";
import StudentAnnouncements from "./pages/student/Announcements.jsx";
import StudentAttendance from "./pages/student/Attendance.jsx";
import StudentHelpSupport from "./pages/student/HelpSupport.jsx";
import StudentSettings from "./pages/student/Settings.jsx";
import StudentCheckout from "./pages/student/Checkout.jsx";
import Analytics from "./pages/admin/Analytics.jsx";
import AdminTeachers from "./pages/admin/Teachers.jsx";
import Students from "./pages/admin/Students.jsx";
import Classes from "./pages/admin/Classes.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { useSettings } from "./hooks/useSettings.js";
import Unauthorized from "./pages/Unauthorized.jsx";
import NotFound from "./pages/NotFound.jsx";
import SplashScreen from "./components/SplashScreen.jsx";
import VerifyCertificate from "./pages/public/VerifyCertificate.jsx";
import NotificationsPage from "./pages/shared/Notifications.jsx";
import ComingSoon from "./pages/ComingSoon.jsx";

const LOGIN_ALERT_STORAGE_KEY = "sumacademy:login-alert";
const SHOW_COMING_SOON = true;
const LAUNCH_DATE = new Date("2026-04-01T00:00:00+05:00");

const getDashboardPathByRole = (role) => {
  if (role === "admin") return "/admin/dashboard";
  if (role === "teacher") return "/teacher/dashboard";
  if (role === "student") return "/student/dashboard";
  return null;
};

function AuthRedirectLoader() {
  return (
    <SplashScreen
      message="Loading secure session..."
      subMessage="Syncing your profile and dashboard access"
    />
  );
}

function GuestRoute({ children }) {
  const { isAuthenticated, role, loading } = useAuth();
  const hasLoginAlert =
    typeof window !== "undefined" &&
    window.sessionStorage.getItem(LOGIN_ALERT_STORAGE_KEY);

  if (hasLoginAlert) return children;
  if (loading || (isAuthenticated && !role)) return <AuthRedirectLoader />;
  if (isAuthenticated) {
    const dashboardPath = getDashboardPathByRole(role);
    if (!dashboardPath) return <AuthRedirectLoader />;
    return <Navigate to={dashboardPath} replace />;
  }

  return children;
}

function HomeRoute() {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading || (isAuthenticated && !role)) return <AuthRedirectLoader />;
  if (isAuthenticated) {
    const dashboardPath = getDashboardPathByRole(role);
    if (!dashboardPath) return <AuthRedirectLoader />;
    return <Navigate to={dashboardPath} replace />;
  }

  return <Home />;
}

function MaintenanceScreen({ settings }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-2xl shadow-slate-200/70">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white">
          S
        </div>
        <h1 className="mt-5 font-heading text-4xl text-slate-900">
          Under Maintenance
        </h1>
        <p className="mt-4 text-slate-600">
          {settings.maintenance?.message || "We are updating SUM Academy. Back soon!"}
        </p>
        <p className="mt-2 text-sm text-slate-500">We will be back soon.</p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}

function AppLayout() {
  const { settings, loading: settingsLoading } = useSettings();
  const { isAdmin, loading: authLoading } = useAuth();
  const [showStartupSplash, setShowStartupSplash] = useState(true);
  const [authOverlay, setAuthOverlay] = useState({
    show: false,
    message: "",
    subMessage: "",
  });
  const location = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowStartupSplash(false);
    }, 2100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handler = (event) => {
      const detail = event?.detail || {};
      setAuthOverlay({
        show: Boolean(detail.show),
        message: detail.message || "",
        subMessage: detail.subMessage || "",
      });
    };

    window.addEventListener("sumacademy:auth-overlay", handler);
    return () => {
      window.removeEventListener("sumacademy:auth-overlay", handler);
    };
  }, []);

  if (showStartupSplash) {
    return (
      <SplashScreen
        message={`Welcome to ${
          settings.general.siteName || "SUM Academy"
        }. Preparing your experience...`}
        subMessage="Initializing smart classroom modules"
      />
    );
  }

  const publicRoutes = new Set([
    "/",
    "/courses",
    "/teachers",
    "/about",
    "/contact",
    "/login",
    "/register",
    "/forgot-password",
    "/lms-login",
    "/unauthorized",
  ]);
  const noLayoutRoutes = new Set([
    "/login",
    "/register",
    "/forgot-password",
    "/lms-login",
    "/unauthorized",
  ]);
  const isDashboardRoute =
    location.pathname.startsWith("/admin") ||
    location.pathname === "/teacher" ||
    location.pathname.startsWith("/teacher/") ||
    location.pathname === "/student" ||
    location.pathname.startsWith("/student/");
  const isKnownPublic = publicRoutes.has(location.pathname);
  const hideLayout =
    isDashboardRoute || noLayoutRoutes.has(location.pathname) || !isKnownPublic;

  if (settingsLoading) {
    return (
      <SplashScreen
        message="Loading SUM Academy settings..."
        subMessage="Preparing your personalized experience"
      />
    );
  }

  const maintenanceEnabled = Boolean(settings.maintenance?.enabled);
  const isLoginRoute =
    location.pathname === "/login" || location.pathname === "/lms-login";
  if (authLoading && maintenanceEnabled) {
    return (
      <SplashScreen
        message="Checking access policy..."
        subMessage="Verifying your role and maintenance access"
      />
    );
  }
  if (maintenanceEnabled && !isAdmin && !isLoginRoute) {
    return <MaintenanceScreen settings={settings} />;
  }

  return (
    <>
      {authOverlay.show ? (
        <SplashScreen
          message={authOverlay.message || "Please wait..."}
          subMessage={authOverlay.subMessage || "Processing your request"}
        />
      ) : null}

      {!hideLayout && <Navbar />}
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/teachers" element={<Teachers />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route
          path="/lms-login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <Register />
            </GuestRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestRoute>
              <ForgotPassword />
            </GuestRoute>
          }
        />
        <Route path="/verify/:certId" element={<VerifyCertificate />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route
          path="/student/quizzes/:quizId/attempt"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentQuizAttempt />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="courses" element={<AdminCourses />} />
          <Route path="teachers" element={<AdminTeachers />} />
          <Route path="students" element={<Students />} />
          <Route path="classes" element={<Classes />} />
          <Route path="payments" element={<Payments />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="installments" element={<Installments />} />
          <Route path="promo-codes" element={<PromoCodes />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SiteSettings />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
        <Route
          path="/teacher"
          element={
            <ProtectedRoute allowedRoles={["teacher"]}>
              <TeacherLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<TeacherDashboard />} />
          <Route path="courses" element={<TeacherMyCourses />} />
          <Route path="students" element={<TeacherStudents />} />
          <Route path="sessions" element={<TeacherSessions />} />
          <Route path="quizzes" element={<TeacherQuizzes />} />
          <Route path="quizzes/my" element={<TeacherMyQuizzes />} />
          <Route
            path="quizzes/detail"
            element={<TeacherQuizDetailAssignmentGrading />}
          />
          <Route
            path="quizzes/detail/:quizId"
            element={<TeacherQuizDetailAssignmentGrading />}
          />
          <Route path="announcements" element={<TeacherAnnouncements />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<TeacherSettings />} />
        </Route>
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="courses" element={<StudentMyCourses />} />
          <Route path="courses/:courseId/player" element={<StudentCoursePlayer />} />
          <Route
            path="courses/:courseId/player/:lectureId"
            element={<StudentCoursePlayer />}
          />
          <Route path="explore" element={<StudentExploreCourses />} />
          <Route path="checkout" element={<StudentCheckout />} />
          <Route path="certificates" element={<StudentCertificates />} />
          <Route path="quizzes" element={<StudentQuizzes />} />
          <Route path="payments" element={<StudentPayments />} />
          <Route path="announcements" element={<StudentAnnouncements />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="attendance" element={<StudentAttendance />} />
          <Route path="help" element={<StudentHelpSupport />} />
          <Route path="settings" element={<StudentSettings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!hideLayout && <Footer />}
    </>
  );
}

function App() {
  const isPastLaunch = new Date() >= LAUNCH_DATE;
  const showComingSoon = SHOW_COMING_SOON && !isPastLaunch;

  return (
    <BrowserRouter>
      {showComingSoon ? (
        <Routes>
          <Route path="/coming-soon" element={<ComingSoon />} />
          <Route path="*" element={<Navigate to="/coming-soon" replace />} />
        </Routes>
      ) : (
        <AppLayout />
      )}
    </BrowserRouter>
  );
}

export default App;
