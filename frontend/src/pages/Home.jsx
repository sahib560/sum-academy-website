import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import {
  SkeletonCard,
  SkeletonTeacherCard,
} from "../components/Skeleton.jsx";
import { useSiteSettings } from "../context/SiteSettingsContext.jsx";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const heroBadges = [
  { label: "500+ Students" },
  { label: "50+ Courses" },
  { label: "20+ Teachers" },
];

const stats = [
  { label: "Total Students", value: 12500, suffix: "+" },
  { label: "Courses", value: 320, suffix: "+" },
  { label: "Teachers", value: 85, suffix: "+" },
  { label: "Completion Rate", value: 96, suffix: "%" },
];

const courseData = [
  {
    title: "Class XI - Pre-Medical",
    category: "Subject of Study",
    lessons: "Biology, Chemistry, Physics, English",
    level: "Pre-Medical",
    duration: "Academic Session",
    teacher: "Faculty Team",
    description:
      "Structured learning plan for Class XI pre-medical students with core subjects.",
  },
  {
    title: "Class XII - Pre-Medical",
    category: "Subject of Study",
    lessons: "Biology, Chemistry, Physics, English",
    level: "Pre-Medical",
    duration: "Academic Session",
    teacher: "Faculty Team",
    description:
      "Advanced subject coverage for Class XII with board-focused preparation.",
  },
  {
    title: "Pre-Entrance Test",
    category: "Subject of Study",
    lessons: "Biology, Chemistry, Physics, English",
    level: "Test Prep",
    duration: "Prep Cycle",
    teacher: "Faculty Team",
    description:
      "Entrance test preparation with concept revision and practice drills.",
  },
];

const teacherData = [
  {
    name: "Mr. Sikander Ali Qureshi",
    role: "Founder & Director, Associate Professor of Chemistry",
    courses: "Chemistry",
  },
  {
    name: "Mr. Shah Mohammad Pathan",
    role: "Associate Professor of Botany",
    courses: "Botany",
  },
  {
    name: "Mr. Mansoor Ahmed Mangi",
    role: "Lecturer Chemistry",
    courses: "Chemistry",
  },
  {
    name: "Mr. Muhammad Idress Mahar",
    role: "Lecturer Physics",
    courses: "Physics",
  },
  {
    name: "Mr. Waseem Ahmed Soomro",
    role: "Lecturer English",
    courses: "English",
  },
];

const testimonials = [
  {
    name: "Hassan Khan",
    course: "ECAT Physics Prep",
    review:
      "SUM Academy helped me structure my prep. The lessons are crisp and the tests feel real.",
  },
  {
    name: "Areeba Syed",
    course: "English Language Fluency",
    review:
      "I loved the bite-sized practice and teacher feedback. My confidence improved fast.",
  },
  {
    name: "Ali Zain",
    course: "ICS Programming Bootcamp",
    review:
      "The LMS tracking kept me consistent. I finally built the projects I wanted.",
  },
];

function CountUp({ value, suffix = "", duration = 1200 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px 0px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = null;
    let frame;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const nextValue = Math.round(value * progress);
      setDisplay(nextValue);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [duration, isInView, value]);

  return (
    <span ref={ref}>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

function CourseCard({ course }) {
  return (
    <div className="glass-card card-hover flex flex-col gap-4">
      <div className="h-40 w-full rounded-2xl bg-gradient-to-br from-primary/20 via-white to-accent/20" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="tag">{course.category}</p>
          <h3 className="mt-3 font-heading text-xl text-slate-900">
            {course.title}
          </h3>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {course.level}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-200">
        <span>{course.lessons}</span>
        <span className="text-primary">PKR 2,500</span>
      </div>
    </div>
  );
}

function TeacherCard({ teacher }) {
  return (
    <div className="relative flex h-[220px] min-w-[240px] flex-col snap-center overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-5 shadow-lg shadow-slate-200/50 transition hover:-translate-y-1 hover:shadow-2xl dark:border-white/10 dark:bg-white/5 dark:shadow-black/40">
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-primary/10 blur-2xl dark:bg-primary/20" />
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-base font-semibold text-white shadow-lg shadow-primary/30">
          {teacher.name[0]}
        </div>
        <div>
          <h4 className="font-heading text-lg text-slate-900 dark:text-white">
            {teacher.name}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {teacher.role}
          </p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between text-sm">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary dark:bg-primary/20">
          {teacher.courses}
        </span>
        <span className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-400">
          Mentor
        </span>
      </div>
    </div>
  );
}

function StepCard({ title, description, icon }) {
  return (
    <div className="glass-card card-hover flex flex-col gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-heading text-xl text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  );
}

function StarRow() {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <svg
          key={`star-${index}`}
          viewBox="0 0 24 24"
          className="h-4 w-4 text-accent"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 3.4l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.7l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3.4z" />
        </svg>
      ))}
    </div>
  );
}

function Home() {
  const { settings } = useSiteSettings();
  const heroContent = settings.content || {};
  const siteName = settings.general.siteName || "SUM Academy";
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [teachersLoading, setTeachersLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const teacherTrackRef = useRef(null);

  useEffect(() => {
    const courseTimer = setTimeout(() => setCoursesLoading(false), 1500);
    const teacherTimer = setTimeout(() => setTeachersLoading(false), 1500);
    return () => {
      clearTimeout(courseTimer);
      clearTimeout(teacherTimer);
    };
  }, []);

  useEffect(() => {
    if (!selectedCourse) return;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setSelectedCourse(null);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.body.classList.add("overflow-hidden");
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.classList.remove("overflow-hidden");
    };
  }, [selectedCourse]);

  useEffect(() => {
    if (teachersLoading) return;
    const track = teacherTrackRef.current;
    if (!track) return;

    const getStep = () => {
      const firstChild = track.firstElementChild;
      if (!firstChild) return 260;
      const styles = window.getComputedStyle(track);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "24");
      return firstChild.getBoundingClientRect().width + gap;
    };

    const step = () => {
      const scrollAmount = getStep();
      const maxScrollLeft = track.scrollWidth - track.clientWidth;
      const next = track.scrollLeft + scrollAmount;
      track.scrollTo({
        left: next >= maxScrollLeft - 4 ? 0 : next,
        behavior: "smooth",
      });
    };

    const autoSlide = setInterval(step, 2400);
    return () => clearInterval(autoSlide);
  }, [teachersLoading]);

  return (
    <main className="pt-24">
      <motion.section
        className="section relative overflow-hidden"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 top-10 h-48 w-48 rounded-full bg-primary/20 blur-[80px]" />
          <div className="absolute right-0 top-24 h-56 w-56 rounded-full bg-accent/20 blur-[90px]" />
          <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        </div>

        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative z-10 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-200">
              {heroContent.heroBadge || "SUM Academy Pakistan"}
            </p>
            <h1 className="mt-4 font-heading text-4xl leading-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
              <span className="gradient-text">
                {heroContent.heroTitle || "Learn Without Limits"}
              </span>
            </h1>
            <p className="mt-4 text-base text-slate-600 dark:text-slate-100 sm:text-lg">
              {heroContent.heroSubtitle ||
                "Empowering Pakistani academies with a premium LMS experience, personalized learning paths, and real-time performance insights."}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to={heroContent.heroPrimaryLink || "/courses"}
                className="btn-primary"
              >
                {heroContent.heroPrimaryLabel || "Browse Courses"}
              </Link>
              <Link
                to={heroContent.heroSecondaryLink || "/demo"}
                className="btn-outline"
              >
                {heroContent.heroSecondaryLabel || "Watch Demo"}
              </Link>
            </div>
          </div>

          <div className="relative z-10 grid gap-4 sm:grid-cols-2 lg:w-[420px]">
            {heroBadges.map((badge, index) => (
              <div
                key={badge.label}
                className={`glass-card card-hover flex items-center justify-center px-5 py-4 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-200/60 dark:text-slate-100 dark:shadow-black/50 ${
                  index === 0 ? "animate-float" : ""
                }`}
              >
                {badge.label}
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl rounded-3xl border border-slate-200/70 bg-gradient-to-r from-white via-slate-50 to-white p-1 shadow-2xl shadow-slate-200/60 backdrop-blur dark:border-white/10 dark:bg-none dark:bg-white/5 dark:shadow-black/60">
          <div className="grid gap-6 rounded-[1.4rem] bg-white/80 p-6 backdrop-blur sm:grid-cols-2 lg:grid-cols-4 dark:bg-white/5">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 p-5 shadow-lg shadow-slate-200/40 transition hover:-translate-y-1 dark:border-white/15 dark:bg-slate-900/70 dark:shadow-black/70 ${
                  index !== stats.length - 1
                    ? "after:absolute after:-right-3 after:top-1/2 after:hidden after:h-10 after:w-[1px] after:-translate-y-1/2 after:bg-slate-200/70 lg:after:block dark:after:bg-white/15"
                    : ""
                }`}
              >
                <p className="text-3xl font-semibold text-slate-900 dark:text-white">
                  <CountUp value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                  {stat.label}
                </p>
                <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-primary/10 blur-2xl dark:bg-primary/20" />
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                Featured Courses
              </p>
              <h2 className="mt-3 font-heading text-3xl text-slate-900">
                Learn from Pakistan&apos;s best mentors
              </h2>
            </div>
            <Link to="/courses" className="btn-outline">
              View All
            </Link>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {coursesLoading
              ? Array.from({ length: courseData.length }).map((_, index) => (
                  <SkeletonCard key={`course-skeleton-${index}`} />
                ))
              : courseData.map((course) => (
                  <button
                    key={course.title}
                    type="button"
                    onClick={() => setSelectedCourse(course)}
                    className="text-left"
                  >
                    <CourseCard course={course} />
                  </button>
                ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              How It Works
            </p>
            <h2 className="mt-3 font-heading text-3xl text-slate-900">
              Learn smarter in three simple steps
            </h2>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <StepCard
              title="Browse Courses"
              description="Explore curated paths for every board and test prep goal."
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                  <path d="M4 6.5C4 5.1 5.1 4 6.5 4h11C18.9 4 20 5.1 20 6.5V18c0 1.1-.9 2-2 2H7.5C5.6 20 4 18.4 4 16.5V6.5zm3 .5v10c0 .6.4 1 1 1h10V7H7z" />
                </svg>
              }
            />
            <StepCard
              title="Enroll & Pay"
              description="Secure payments and flexible plans built for Pakistani academies."
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                  <path d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7zm3-1a1 1 0 0 0-1 1v2h16V7a1 1 0 0 0-1-1H6z" />
                </svg>
              }
            />
            <StepCard
              title="Learn & Certify"
              description="Track progress, take assessments, and earn verified certificates."
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                  <path d="M6 4h12a2 2 0 0 1 2 2v7a7 7 0 1 1-14 0V6a2 2 0 0 1 2-2zm6 10a4 4 0 0 0 4-4H8a4 4 0 0 0 4 4z" />
                </svg>
              }
            />
          </div>
        </div>
      </motion.section>

      <motion.section
        className="section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                Featured Teachers
              </p>
              <h2 className="mt-3 font-heading text-3xl text-slate-900 dark:text-white">
                Learn with Pakistan&apos;s top educators
              </h2>
            </div>
            <Link to="/teachers" className="btn-outline hidden sm:inline-flex">
              Meet All
            </Link>
          </div>

          <div className="relative mt-8">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-white to-transparent dark:from-dark" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent dark:from-dark" />
            <div
              ref={teacherTrackRef}
              className="no-scrollbar flex gap-6 overflow-x-auto pb-4 pt-1 scroll-smooth snap-x snap-mandatory"
            >
              {teachersLoading
                ? Array.from({ length: teacherData.length }).map((_, index) => (
                    <SkeletonTeacherCard
                      key={`teacher-skeleton-${index}`}
                      className="min-w-[240px] h-[220px] snap-center rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-lg shadow-slate-200/40 dark:border-white/10 dark:bg-white/5 dark:shadow-black/40"
                    />
                  ))
                : teacherData.map((teacher) => (
                    <TeacherCard key={teacher.name} teacher={teacher} />
                  ))}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              Testimonials
            </p>
            <h2 className="mt-3 font-heading text-3xl text-slate-900">
              Students love learning with {siteName}
            </h2>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {testimonials.map((item) => (
              <div key={item.name} className="glass-card card-hover">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {item.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {item.name}
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
                      {item.course}
                    </p>
                  </div>
                </div>
                <StarRow />
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-200">
                  {item.review}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2rem] bg-gradient-to-r from-primary/90 via-indigo-500 to-accent/90 p-[2px] shadow-2xl shadow-primary/30 dark:shadow-black/50">
            <div className="relative overflow-hidden rounded-[1.9rem] bg-white/90 px-6 py-10 backdrop-blur dark:border dark:border-white/10 dark:bg-white/5 sm:px-10 sm:py-12">
              <div className="pointer-events-none absolute -left-16 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-[80px]" />
              <div className="pointer-events-none absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-accent/20 blur-[90px]" />
              <div className="relative z-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">
                    Start Now
                  </p>
                  <h2 className="mt-3 font-heading text-3xl text-slate-900 dark:text-white sm:text-4xl">
                    {heroContent.footerCtaTitle || "Start Your Journey Today"}
                  </h2>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-200 sm:text-base">
                    {heroContent.footerCtaSubtitle ||
                      `Join ${siteName} and unlock personalized learning paths built for Pakistan's top boards.`}
                  </p>
                </div>
                <Link
                  to="/register"  
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:-translate-y-0.5"
                >
                  {heroContent.footerCtaButton || "Enroll for Free"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {selectedCourse && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSelectedCourse(null)}
            aria-label="Close course details"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-xl rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl shadow-slate-200/60 dark:border-white/10 dark:bg-dark dark:shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="tag">{selectedCourse.category}</p>
                <h3 className="mt-3 font-heading text-2xl text-slate-900 dark:text-white">
                  {selectedCourse.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCourse(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-200">
              {selectedCourse.description}
            </p>
            <div className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-200 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
                  Teacher
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {selectedCourse.teacher}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
                  Duration
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {selectedCourse.duration}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
                  Lessons
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {selectedCourse.lessons}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-semibold text-primary">
                PKR 2,500
              </span>
              <div className="flex gap-3">
                <Link to="/courses" className="btn-outline">
                  View Curriculum
                </Link>
                <Link to="/register" className="btn-primary">
                  Enroll Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Home;
