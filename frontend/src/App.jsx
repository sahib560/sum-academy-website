import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import Courses from "./pages/Courses.jsx";
import Teachers from "./pages/Teachers.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import Login from "./pages/auth/Login.jsx";
import Register from "./pages/auth/Register.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword.jsx";
import VerifyOTP from "./pages/auth/VerifyOTP.jsx";
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
import StudentProfile from "./pages/student/Profile.jsx";
import StudentSettings from "./pages/student/Settings.jsx";
import StudentCoursePlayer from "./pages/student/CoursePlayer.jsx";
import StudentQuizAttempt from "./pages/student/QuizAttempt.jsx";
import Analytics from "./pages/admin/Analytics.jsx";
import AdminTeachers from "./pages/admin/Teachers.jsx";
import Students from "./pages/admin/Students.jsx";
import Classes from "./pages/admin/Classes.jsx";
import ClassDetail from "./pages/admin/ClassDetail.jsx";
import { SiteSettingsProvider } from "./context/SiteSettingsContext.jsx";

function AppLayout() {
  const location = useLocation();
  const hideLayout =
    [
      "/lms-login",
      "/login",
      "/register",
      "/forgot-password",
      "/verify-otp",
    ].includes(location.pathname) ||
    location.pathname.startsWith("/admin") ||
    location.pathname === "/teacher" ||
    location.pathname.startsWith("/teacher/") ||
    location.pathname === "/student" ||
    location.pathname.startsWith("/student/") ||
    location.pathname === "/student/quiz-attempt";

  return (
    <>
      {!hideLayout && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/teachers" element={<Teachers />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/lms-login" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/teacher" element={<TeacherLayout />}>
          <Route index element={<TeacherDashboard />} />
          <Route path="courses" element={<TeacherMyCourses />} />
          <Route path="students" element={<TeacherStudents />} />
          <Route path="announcements" element={<TeacherAnnouncements />} />
          <Route path="settings" element={<TeacherSettings />} />
          <Route path="*" element={<TeacherDashboard />} />
        </Route>
        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<StudentDashboard />} />
          <Route path="courses" element={<StudentMyCourses />} />
          <Route path="course-player" element={<StudentCoursePlayer />} />
          <Route path="explore" element={<StudentExploreCourses />} />
          <Route path="certificates" element={<StudentCertificates />} />
          <Route path="quizzes" element={<StudentQuizzes />} />
          <Route path="payments" element={<StudentPayments />} />
          <Route path="announcements" element={<StudentAnnouncements />} />
          <Route path="attendance" element={<StudentAttendance />} />
          <Route path="support" element={<StudentHelpSupport />} />
          <Route path="profile" element={<StudentProfile />} />
          <Route path="settings" element={<StudentSettings />} />
          <Route path="*" element={<StudentDashboard />} />
        </Route>
        <Route path="/student/quiz-attempt" element={<StudentQuizAttempt />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="users" element={<Users />} />
          <Route path="teachers" element={<AdminTeachers />} />
          <Route path="students" element={<Students />} />
          <Route path="classes" element={<Classes />} />
          <Route path="classes/:id" element={<ClassDetail />} />
          <Route path="courses" element={<AdminCourses />} />
          <Route path="payments" element={<Payments />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="installments" element={<Installments />} />
          <Route path="promos" element={<PromoCodes />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="settings" element={<SiteSettings />} />
          <Route path="*" element={<Dashboard />} />
        </Route>
        <Route path="/dashboard" element={<Home />} />
        <Route path="*" element={<Home />} />
      </Routes>
      {!hideLayout && <Footer />}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <SiteSettingsProvider>
        <AppLayout />
      </SiteSettingsProvider>
    </BrowserRouter>
  );
}

export default App;
