import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SkeletonCard } from "../components/Skeleton.jsx";
import { useSiteSettings } from "../context/SiteSettingsContext.jsx";

const courseData = [
  {
    id: 1,
    title: "Class XI - Pre-Medical",
    category: "Pre-Medical",
    categories: ["Science", "Biology", "Chemistry", "Physics", "English"],
    subjects: ["Biology", "Chemistry", "Physics", "English"],
    level: "Intermediate",
    duration: "Academic Session",
    teacher: "Mr. Sikander Ali Qureshi",
    price: 3500,
    rating: 4.9,
    students: 850,
    description:
      "Structured learning plan for Class XI pre-medical students with core subjects and topic-wise assessments.",
  },
  {
    id: 2,
    title: "Class XII - Pre-Medical",
    category: "Pre-Medical",
    categories: ["Science", "Biology", "Chemistry", "Physics", "English"],
    subjects: ["Biology", "Chemistry", "Physics", "English"],
    level: "Advanced",
    duration: "Academic Session",
    teacher: "Mr. Shah Mohammad Pathan",
    price: 3800,
    rating: 4.8,
    students: 720,
    description:
      "Advanced board-focused preparation with revision modules, practice tests, and performance tracking.",
  },
  {
    id: 3,
    title: "Pre-Entrance Test",
    category: "Test Prep",
    categories: ["Science", "Biology", "Chemistry", "Physics", "English"],
    subjects: ["Biology", "Chemistry", "Physics", "English"],
    level: "Advanced",
    duration: "Prep Cycle",
    teacher: "Mr. Muhammad Idress Mahar",
    price: 4200,
    rating: 4.9,
    students: 640,
    description:
      "Intensive entrance test preparation with concept revision, timed practice, and exam strategy sessions.",
  },
];

const categories = [
  "Math",
  "Science",
  "English",
  "Computer",
  "Biology",
  "Chemistry",
  "Physics",
];
const levels = ["Beginner", "Intermediate", "Advanced"];

const formatPKR = (value) => `PKR ${value.toLocaleString()}`;

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <svg
          key={`rating-${index}`}
          viewBox="0 0 24 24"
          className={`h-4 w-4 ${
            index < Math.round(rating) ? "text-accent" : "text-slate-300"
          }`}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 3.4l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.7l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3.4z" />
        </svg>
      ))}
      <span className="ml-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

function TeacherAvatar({ name }) {
  const initial = name?.trim()?.[0] ?? "S";
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-semibold text-white shadow-lg shadow-primary/30">
      {initial}
    </div>
  );
}

function CourseCard({ course, onSelect }) {
  return (
    <div
      className="glass-card card-hover flex h-full cursor-pointer flex-col gap-4"
      onClick={() => onSelect(course)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect(course);
      }}
    >
      <div className="h-40 w-full rounded-2xl bg-gradient-to-br from-primary/20 via-white to-accent/20" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="tag">{course.category}</p>
          <h3 className="mt-3 font-heading text-xl text-slate-900 dark:text-white">
            {course.title}
          </h3>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary dark:bg-primary/20">
          {course.level}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <TeacherAvatar name={course.teacher} />
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {course.teacher}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            Lead Instructor
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-200">
        <StarRating rating={course.rating} />
        <span>{course.students}+ students</span>
      </div>
      <div className="mt-auto flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">
          {formatPKR(course.price)}
        </span>
        <button
          type="button"
          className="btn-primary px-4 py-2 text-xs"
          onClick={(event) => event.stopPropagation()}
        >
          Enroll Now
        </button>
      </div>
    </div>
  );
}

function Courses() {
  const { settings } = useSiteSettings();
  const siteName = settings.general.siteName || "SUM Academy";
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [level, setLevel] = useState("All");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(5000);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase().replace(/-/g, " ");
    return courseData.filter((course) => {
      const title = course.title.toLowerCase().replace(/-/g, " ");
      const matchesSearch =
        !query ||
        title.includes(query) ||
        course.teacher.toLowerCase().includes(query) ||
        course.subjects.join(" ").toLowerCase().includes(query);
      const matchesCategory =
        selectedCategories.length === 0 ||
        selectedCategories.some((category) =>
          course.categories.includes(category)
        );
      const matchesLevel = level === "All" || course.level === level;
      const matchesPrice =
        course.price >= priceMin && course.price <= priceMax;
      return matchesSearch && matchesCategory && matchesLevel && matchesPrice;
    });
  }, [level, priceMax, priceMin, search, selectedCategories]);

  const toggleCategory = (category) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category]
    );
  };

  const resetFilters = () => {
    setSearch("");
    setSelectedCategories([]);
    setLevel("All");
    setPriceMin(0);
    setPriceMax(5000);
  };

  const FilterPanel = () => (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
          Category
        </p>
        <div className="mt-4 grid gap-2">
          {categories.map((category) => (
            <label
              key={category}
              className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                checked={selectedCategories.includes(category)}
                onChange={() => toggleCategory(category)}
              />
              {category}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
          Level
        </p>
        <div className="mt-4 grid gap-2">
          <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="radio"
              name="level"
              className="h-4 w-4 text-primary focus:ring-primary"
              checked={level === "All"}
              onChange={() => setLevel("All")}
            />
            All Levels
          </label>
          {levels.map((item) => (
            <label
              key={item}
              className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200"
            >
              <input
                type="radio"
                name="level"
                className="h-4 w-4 text-primary focus:ring-primary"
                checked={level === item}
                onChange={() => setLevel(item)}
              />
              {item}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
          Price Range
        </p>
        <div className="mt-4 grid gap-3">
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={priceMax}
              value={priceMin}
              onChange={(event) =>
                setPriceMin(
                  Math.min(Number(event.target.value) || 0, priceMax)
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-dark dark:text-slate-200"
              placeholder="Min"
            />
            <input
              type="number"
              min={priceMin}
              max={5000}
              value={priceMax}
              onChange={(event) =>
                setPriceMax(
                  Math.max(Number(event.target.value) || 0, priceMin)
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-dark dark:text-slate-200"
              placeholder="Max"
            />
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-300">
            Showing courses between {formatPKR(priceMin)} and{" "}
            {formatPKR(priceMax)}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <main className="pt-24">
      <section className="section">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-2xl shadow-slate-200/50 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/40 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">
                {siteName}
              </p>
              <h1 className="mt-3 font-heading text-4xl text-slate-900 dark:text-white">
                Explore Our Courses
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                Find the perfect learning path for your academic journey.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 md:max-w-md">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search courses, subjects, teachers..."
                  className="w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-dark dark:text-slate-200"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  🔍
                </span>
              </div>
              <button
                type="button"
                className="btn-outline w-full lg:hidden"
                onClick={() => setFilterOpen(true)}
              >
                Filters
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section pt-0">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[260px_1fr]">
          <aside className="hidden rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/40 lg:block">
            <FilterPanel />
          </aside>

          <div>
            {loading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <SkeletonCard key={`course-skeleton-${index}`} />
                ))}
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center dark:border-white/10 dark:bg-slate-900/70">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
                    <path d="M10 3a7 7 0 1 1 0 14A7 7 0 0 1 10 3zm0 2a5 5 0 1 0 0 10A5 5 0 0 0 10 5zm8.6 13.2 2.2 2.2-1.4 1.4-2.2-2.2a9 9 0 0 1-5.2 1.6v-2a7 7 0 0 0 4.4-1.5z" />
                  </svg>
                </div>
                <h3 className="mt-4 font-heading text-2xl text-slate-900 dark:text-white">
                  No courses found
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                  Try adjusting your search or filters to see available courses.
                </p>
                <button
                  type="button"
                  className="btn-outline mt-6"
                  onClick={resetFilters}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onSelect={setSelectedCourse}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {filterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setFilterOpen(false)}
            aria-label="Close filters"
          />
          <div className="absolute bottom-0 w-full rounded-t-3xl border border-slate-200/70 bg-white p-6 shadow-2xl shadow-slate-200/50 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/50">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-xl text-slate-900 dark:text-white">
                Filters
              </h3>
              <button
                type="button"
                className="text-sm font-semibold text-primary"
                onClick={() => setFilterOpen(false)}
              >
                Done
              </button>
            </div>
            <FilterPanel />
            <button
              type="button"
              className="btn-outline mt-6 w-full"
              onClick={resetFilters}
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

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
            className="relative w-full max-w-2xl rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl shadow-slate-200/60 dark:border-white/10 dark:bg-dark dark:shadow-black/50"
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
                x
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-200">
              {selectedCourse.description}
            </p>
            <div className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-200 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Teacher
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {selectedCourse.teacher}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Duration
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {selectedCourse.duration}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Subjects
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {selectedCourse.subjects.join(", ")}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-semibold text-primary">
                {formatPKR(selectedCourse.price)}
              </span>
              <div className="flex gap-3">
                <Link to="/enroll" className="btn-primary">
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

export default Courses;
