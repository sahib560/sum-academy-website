import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import StudentLayout from "./layouts/StudentLayout.jsx";
import StudentDashboard from "./pages/student/Dashboard.jsx";
import StudentMyCourses from "./pages/student/MyCourses.jsx";
import StudentExploreCourses from "./pages/student/ExploreCourses.jsx";
import StudentCertificates from "./pages/student/Certificates.jsx";
import StudentQuizzes from "./pages/student/Quizzes.jsx";
import StudentPayments from "./pages/student/Payments.jsx";
import StudentAnnouncements from "./pages/student/Announcements.jsx";
import StudentAttendance from "./pages/student/Attendance.jsx";
import StudentHelpSupport from "./pages/student/HelpSupport.jsx";
import StudentSettings from "./pages/student/Settings.jsx";
import Analytics from "./pages/admin/Analytics.jsx";
import AdminTeachers from "./pages/admin/Teachers.jsx";
import Students from "./pages/admin/Students.jsx";
import Classes from "./pages/admin/Classes.jsx";
import { SiteSettingsProvider } from "./context/SiteSettingsContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import Unauthorized from "./pages/Unauthorized.jsx";
import NotFound from "./pages/NotFound.jsx";

function AppLayout() {
  const location = useLocation();
  const hideLayout =
    ["/login", "/register", "/lms-login", "/unauthorized"].includes(
      location.pathname
    ) ||
    location.pathname.startsWith("/admin") ||
    location.pathname === "/teacher" ||
    location.pathname.startsWith("/teacher/") ||
    location.pathname === "/student" ||
    location.pathname.startsWith("/student/");

  return (
    <>
      {!hideLayout && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/teachers" element={<Teachers />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/lms-login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
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
          <Route path="announcements" element={<TeacherAnnouncements />} />
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
          <Route path="explore" element={<StudentExploreCourses />} />
          <Route path="certificates" element={<StudentCertificates />} />
          <Route path="quizzes" element={<StudentQuizzes />} />
          <Route path="payments" element={<StudentPayments />} />
          <Route path="announcements" element={<StudentAnnouncements />} />
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

const queryClient = new QueryClient();

function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <SiteSettingsProvider>
          <AuthProvider>
            <AppLayout />
          </AuthProvider>
        </SiteSettingsProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
