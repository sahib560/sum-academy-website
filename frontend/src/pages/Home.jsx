import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion as Motion, useInView } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { FaStar } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import {
  SkeletonCard,
  SkeletonTeacherCard,
} from "../components/Skeleton.jsx";
import { useSettings } from "../hooks/useSettings.js";
import { exploreCourses } from "../services/student.service.js";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const NOT_ADDED = "Not added yet";
const textOrNotAdded = (value) => {
  const cleaned = String(value || "").trim();
  return cleaned || NOT_ADDED;
};

const isDefaultFounderPlaceholder = (teacher = {}) => {
  const name = String(teacher?.name || "").trim().toLowerCase();
  const role = String(teacher?.role || teacher?.title || "")
    .trim()
    .toLowerCase();
  const subject = String(teacher?.subject || "").trim();
  const courses = String(teacher?.courses || "").trim();
  const bio = String(teacher?.bio || teacher?.description || "").trim();

  return (
    name === "sum founder" &&
    role === "founder & ceo" &&
    !subject &&
    !courses &&
    !bio
  );
};

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
        <span className="text-primary">{course.priceLabel}</span>
      </div>
    </div>
  );
}

function TeacherCard({ teacher }) {
  const initial = String(teacher.name || "N").trim()[0] || "N";
  return (
    <div className="relative flex h-[220px] min-w-[240px] flex-col snap-center overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-5 shadow-lg shadow-slate-200/50 transition hover:-translate-y-1 hover:shadow-2xl dark:border-white/10 dark:bg-white/5 dark:shadow-black/40">
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-primary/10 blur-2xl dark:bg-primary/20" />
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-base font-semibold text-white shadow-lg shadow-primary/30">
          {initial}
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
        <FaStar key={`star-${index}`} className="h-4 w-4 text-accent" aria-hidden="true" />
      ))}
    </div>
  );
}

function Home() {
  const { settings, loading: settingsLoading } = useSettings();
  const hero = settings.hero || {};
  const howItWorks = settings.howItWorks || {};
  const features = settings.features || {};
  const testimonials = settings.testimonials || {};
  const about = settings.about || {};
  const siteName = textOrNotAdded(settings.general?.siteName);
  const heroBadges = (hero.stats || []).map((item) => ({
    label: textOrNotAdded(`${item.value || ""} ${item.label || ""}`.trim()),
  }));
  const stats = (hero.stats || []).map((item) => {
    const numeric = Number(String(item.value || "").replace(/[^\d]/g, ""));
    const suffix = String(item.value || "").replace(/[\d\s]/g, "");
    return {
      label: textOrNotAdded(item.label),
      value: Number.isFinite(numeric) && numeric > 0 ? numeric : 0,
      suffix,
      rawValue: textOrNotAdded(item.value),
    };
  });
  const safeHeroBadges = heroBadges;
  const safeStats = stats;
  const safeTestimonials = Array.isArray(testimonials.items)
    ? testimonials.items
    : [];
  const [selectedCourse, setSelectedCourse] = useState(null);
  const teacherTrackRef = useRef(null);
  const coursesQuery = useQuery({
    queryKey: ["public-home-courses"],
    queryFn: () => exploreCourses({}),
    staleTime: 60000,
  });

  const featuredCourses = useMemo(() => {
    const rows = Array.isArray(coursesQuery.data) ? coursesQuery.data : [];
    return rows.slice(0, 3).map((course, index) => {
      const subjects = Array.isArray(course.subjects)
        ? course.subjects
            .map((subject) =>
              typeof subject === "string"
                ? subject
                : subject?.name || subject?.title || ""
            )
            .filter(Boolean)
        : [];
      const price = Number(course.price);
      return {
        id: course.id || `course-${index}`,
        title: textOrNotAdded(course.title),
        category: textOrNotAdded(course.category),
        lessons: subjects.length ? subjects.join(", ") : NOT_ADDED,
        level: textOrNotAdded(course.level),
        duration: textOrNotAdded(course.duration),
        teacher: textOrNotAdded(course.teacherName),
        description: textOrNotAdded(course.description),
        priceLabel:
          Number.isFinite(price) && price >= 0
            ? `PKR ${price.toLocaleString()}`
            : NOT_ADDED,
      };
    });
  }, [coursesQuery.data]);

  const featuredTeachers = useMemo(() => {
    const rows = Array.isArray(about.team) ? about.team : [];
    return rows
      .filter((teacher) => {
        if (isDefaultFounderPlaceholder(teacher)) return false;
        const name = String(teacher?.name || "").trim();
        const role = String(teacher?.role || "").trim();
        return Boolean(name && role);
      })
      .map((teacher, index) => ({
        id: teacher.id || `teacher-${index}`,
        name: textOrNotAdded(teacher.name),
        role: textOrNotAdded(teacher.role),
        courses: textOrNotAdded(teacher.subject || teacher.courses),
      }));
  }, [about.team]);

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
    if (settingsLoading) return;
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
  }, [settingsLoading, featuredTeachers.length]);

  return (
    <main className="pt-24">
      <Motion.section
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
              {textOrNotAdded(hero.badge)}
            </p>
            <h1 className="mt-4 font-heading text-4xl leading-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
              <span className="gradient-text">
                {textOrNotAdded(hero.heading)}
              </span>
            </h1>
            <p className="mt-4 text-base text-slate-600 dark:text-slate-100 sm:text-lg">
              {textOrNotAdded(hero.subheading)}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/courses"
                className="btn-primary"
              >
                {textOrNotAdded(hero.ctaPrimary)}
              </Link>
              <Link to="/" className="btn-outline">
                {textOrNotAdded(hero.ctaSecondary)}
              </Link>
            </div>
          </div>

          <div className="relative z-10 grid gap-4 sm:grid-cols-2 lg:w-[420px]">
            {safeHeroBadges.length ? (
              safeHeroBadges.map((badge, index) => (
                <div
                  key={badge.label}
                  className={`glass-card card-hover flex items-center justify-center px-5 py-4 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-200/60 dark:text-slate-100 dark:shadow-black/50 ${
                    index === 0 ? "animate-float" : ""
                  }`}
                >
                  {badge.label}
                </div>
              ))
            ) : (
              <div className="glass-card flex items-center justify-center px-5 py-4 text-sm font-semibold text-slate-500 dark:text-slate-300 sm:col-span-2">
                {NOT_ADDED}
              </div>
            )}
          </div>
        </div>
      </Motion.section>

      <Motion.section
        className="section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl rounded-3xl border border-slate-200/70 bg-gradient-to-r from-white via-slate-50 to-white p-1 shadow-2xl shadow-slate-200/60 backdrop-blur dark:border-white/10 dark:bg-none dark:bg-white/5 dark:shadow-black/60">
          <div className="grid gap-6 rounded-[1.4rem] bg-white/80 p-6 backdrop-blur sm:grid-cols-2 lg:grid-cols-4 dark:bg-white/5">
            {safeStats.length ? (
              safeStats.map((stat, index) => (
                <div
                  key={stat.label}
                  className={`relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 p-5 shadow-lg shadow-slate-200/40 transition hover:-translate-y-1 dark:border-white/15 dark:bg-slate-900/70 dark:shadow-black/70 ${
                    index !== safeStats.length - 1
                      ? "after:absolute after:-right-3 after:top-1/2 after:hidden after:h-10 after:w-[1px] after:-translate-y-1/2 after:bg-slate-200/70 lg:after:block dark:after:bg-white/15"
                      : ""
                  }`}
                >
                  <p className="text-3xl font-semibold text-slate-900 dark:text-white">
                    {stat.value > 0 ? (
                      <CountUp value={stat.value} suffix={stat.suffix} />
                    ) : (
                      stat.rawValue
                    )}
                  </p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                    {stat.label}
                  </p>
                  <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-primary/10 blur-2xl dark:bg-primary/20" />
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200/70 bg-white/70 p-5 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-slate-900/70 dark:text-slate-300 sm:col-span-2 lg:col-span-4">
                {NOT_ADDED}
              </div>
            )}
          </div>
        </div>
      </Motion.section>

      <Motion.section
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
            {coursesQuery.isLoading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <SkeletonCard key={`course-skeleton-${index}`} />
                ))
              : featuredCourses.length
                ? featuredCourses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => setSelectedCourse(course)}
                    className="text-left"
                  >
                    <CourseCard course={course} />
                  </button>
                  ))
                : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 md:col-span-2 lg:col-span-3">
                    {NOT_ADDED}
                  </div>
                )}
          </div>
        </div>
      </Motion.section>

      <Motion.section
        className="section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              {textOrNotAdded(howItWorks.heading)}
            </p>
            <h2 className="mt-3 font-heading text-3xl text-slate-900">
              {textOrNotAdded(howItWorks.subheading)}
            </h2>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {Array.isArray(howItWorks.steps) && howItWorks.steps.length ? (
              howItWorks.steps.map((step, index) => (
                <StepCard
                  key={`${step.title}-${index}`}
                  title={textOrNotAdded(step.title)}
                  description={textOrNotAdded(step.description)}
                  icon={
                    <span className="text-base font-bold">{step.number || index + 1}</span>
                  }
                />
              )
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 md:col-span-3">
                {NOT_ADDED}
              </div>
            )}
          </div>
        </div>
      </Motion.section>

      <Motion.section
        className="section pt-0"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              {textOrNotAdded(features.heading)}
            </p>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {Array.isArray(features.items) && features.items.length ? (
              features.items.map((item, index) => (
              <div key={`${item.title}-${index}`} className="glass-card card-hover">
                <h3 className="font-heading text-xl text-slate-900">{textOrNotAdded(item.title)}</h3>
                <p className="mt-2 text-sm text-slate-600">{textOrNotAdded(item.description)}</p>
              </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 md:col-span-2 lg:col-span-4">
                {NOT_ADDED}
              </div>
            )}
          </div>
        </div>
      </Motion.section>

      <Motion.section
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
              {settingsLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <SkeletonTeacherCard
                      key={`teacher-skeleton-${index}`}
                      className="min-w-[240px] h-[220px] snap-center rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-lg shadow-slate-200/40 dark:border-white/10 dark:bg-white/5 dark:shadow-black/40"
                    />
                  ))
                : featuredTeachers.length
                  ? featuredTeachers.map((teacher) => (
                    <TeacherCard key={teacher.id} teacher={teacher} />
                    ))
                  : (
                    <div className="min-w-full rounded-2xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
                      {NOT_ADDED}
                    </div>
                  )}
            </div>
          </div>
        </div>
      </Motion.section>

      <Motion.section
        className="section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              {textOrNotAdded(testimonials.heading)}
            </p>
            <h2 className="mt-3 font-heading text-3xl text-slate-900">
              Students love learning with {siteName}
            </h2>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {safeTestimonials.length ? safeTestimonials.map((item) => (
              <div key={item.name} className="glass-card card-hover">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {(String(item.name || "").trim()[0] || "N").toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {textOrNotAdded(item.name)}
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
                      {textOrNotAdded(item.course)}
                    </p>
                  </div>
                </div>
                <StarRow />
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-200">
                  {textOrNotAdded(item.review)}
                </p>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 md:col-span-3">
                {NOT_ADDED}
              </div>
            )}
          </div>
        </div>
      </Motion.section>

      <Motion.section
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
                    Start Your Journey Today
                  </h2>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-200 sm:text-base">
                    {textOrNotAdded(settings.footer?.description)}
                  </p>
                </div>
                <Link
                  to="/register"  
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:-translate-y-0.5"
                >
                  Enroll for Free
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Motion.section>

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
                <IoClose className="h-5 w-5" />
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
                {selectedCourse.priceLabel}
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

