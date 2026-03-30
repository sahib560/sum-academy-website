import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FaStar } from "react-icons/fa";
import { FiSearch } from "react-icons/fi";
import { SkeletonCard } from "../components/Skeleton.jsx";
import { useSiteSettings } from "../context/SiteSettingsContext.jsx";
import { exploreCourses } from "../services/student.service.js";

const NOT_ADDED = "Not added yet";
const textOrNotAdded = (value) => {
  const cleaned = String(value || "").trim();
  return cleaned || NOT_ADDED;
};
const formatPKR = (value) =>
  Number.isFinite(Number(value)) ? `PKR ${Number(value).toLocaleString()}` : NOT_ADDED;

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <FaStar
          key={`rating-${index}`}
          className={`h-4 w-4 ${
            index < Math.round(rating) ? "text-accent" : "text-slate-300"
          }`}
          aria-hidden="true"
        />
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
            {textOrNotAdded(course.title)}
          </h3>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary dark:bg-primary/20">
          {textOrNotAdded(course.level)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <TeacherAvatar name={course.teacher} />
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {textOrNotAdded(course.teacher)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            Lead Instructor
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-200">
        <StarRating rating={course.rating} />
        <span>{course.students > 0 ? `${course.students}+ students` : NOT_ADDED}</span>
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

function FilterPanel({
  categories,
  selectedCategories,
  onToggleCategory,
  levels,
  level,
  onLevelChange,
  priceMin,
  priceMax,
  maxDetectedPrice,
  onPriceMinChange,
  onPriceMaxChange,
}) {
  const makeId = (prefix, value) =>
    `${prefix}-${String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}`;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
          Category
        </p>
        <div className="mt-4 grid gap-2">
          {categories.length ? (
            categories.map((category) => (
              <div key={category} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                <input
                  id={makeId("category", category)}
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  checked={selectedCategories.includes(category)}
                  onChange={(event) => onToggleCategory(category, event.target.checked)}
                />
                <label htmlFor={makeId("category", category)}>{category}</label>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-300">{NOT_ADDED}</p>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
          Level
        </p>
        <div className="mt-4 grid gap-2">
          <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
            <input
              id="level-all"
              type="radio"
              name="level"
              className="h-4 w-4 text-primary focus:ring-primary"
              checked={level === "All"}
              onChange={() => onLevelChange("All")}
            />
            <label htmlFor="level-all">All Levels</label>
          </div>
          {levels.length ? (
            levels.map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                <input
                  id={makeId("level", item)}
                  type="radio"
                  name="level"
                  className="h-4 w-4 text-primary focus:ring-primary"
                  checked={level === item}
                  onChange={() => onLevelChange(item)}
                />
                <label htmlFor={makeId("level", item)}>{item}</label>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-300">{NOT_ADDED}</p>
          )}
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
              onChange={(event) => onPriceMinChange(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-dark dark:text-slate-200"
              placeholder="Min"
            />
            <input
              type="number"
              min={priceMin}
              max={maxDetectedPrice}
              value={priceMax}
              onChange={(event) => onPriceMaxChange(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-dark dark:text-slate-200"
              placeholder="Max"
            />
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-300">
            Showing courses between {formatPKR(priceMin)} and {formatPKR(priceMax)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Courses() {
  const { settings, loading: settingsLoading } = useSiteSettings();
  const siteName = textOrNotAdded(settings.general?.siteName);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [level, setLevel] = useState("All");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(5000);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);

  const coursesQuery = useQuery({
    queryKey: ["public-courses-page"],
    queryFn: () => exploreCourses({}),
    staleTime: 60000,
  });

  const allCourses = useMemo(() => {
    const rows = Array.isArray(coursesQuery.data) ? coursesQuery.data : [];
    return rows.map((course, index) => {
      const subjects = Array.isArray(course.subjects)
        ? course.subjects
            .map((subject) =>
              typeof subject === "string"
                ? subject
                : subject?.name || subject?.title || ""
            )
            .filter(Boolean)
        : [];
      const category = textOrNotAdded(course.category);
      return {
        id: course.id || `course-${index}`,
        title: textOrNotAdded(course.title),
        category,
        categories: [category, ...subjects].filter(Boolean),
        subjects: subjects.length ? subjects : [NOT_ADDED],
        level: textOrNotAdded(course.level),
        duration: textOrNotAdded(course.duration),
        teacher: textOrNotAdded(course.teacherName),
        price: Number.isFinite(Number(course.price)) ? Number(course.price) : 0,
        rating: Number(course.rating) || 0,
        students: Number(course.enrollmentCount) || 0,
        description: textOrNotAdded(course.description),
      };
    });
  }, [coursesQuery.data]);

  const categories = useMemo(
    () =>
      [...new Set(allCourses.flatMap((course) => course.categories))]
        .filter((item) => item && item !== NOT_ADDED)
        .sort((a, b) => a.localeCompare(b)),
    [allCourses]
  );

  const levels = useMemo(
    () =>
      [...new Set(allCourses.map((course) => course.level))]
        .filter((item) => item && item !== NOT_ADDED)
        .sort((a, b) => a.localeCompare(b)),
    [allCourses]
  );

  const isLoading = settingsLoading || coursesQuery.isLoading;
  const maxDetectedPrice = useMemo(() => {
    const max = allCourses.reduce((highest, course) => {
      const current = Number.isFinite(course.price) ? course.price : 0;
      return Math.max(highest, current);
    }, 0);
    return max > 0 ? max : 5000;
  }, [allCourses]);
  const clampedPriceMax = Math.min(priceMax, maxDetectedPrice);
  const clampedPriceMin = Math.min(priceMin, clampedPriceMax);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase().replace(/-/g, " ");
    return allCourses.filter((course) => {
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
        course.price >= clampedPriceMin && course.price <= clampedPriceMax;
      return matchesSearch && matchesCategory && matchesLevel && matchesPrice;
    });
  }, [
    allCourses,
    clampedPriceMax,
    clampedPriceMin,
    level,
    search,
    selectedCategories,
  ]);

  const toggleCategory = (category, checked) => {
    setSelectedCategories((prev) => {
      if (checked) return [...new Set([...prev, category])];
      return prev.filter((item) => item !== category);
    });
  };

  const resetFilters = () => {
    setSearch("");
    setSelectedCategories([]);
    setLevel("All");
    setPriceMin(0);
    setPriceMax(maxDetectedPrice);
  };

  const handlePriceMinChange = (nextValue) => {
    const parsed = Number(nextValue) || 0;
    setPriceMin(Math.max(0, Math.min(parsed, clampedPriceMax)));
  };

  const handlePriceMaxChange = (nextValue) => {
    const parsed = Number(nextValue) || 0;
    setPriceMax(Math.min(maxDetectedPrice, Math.max(parsed, clampedPriceMin)));
  };

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
                {textOrNotAdded(settings.content?.coursesHeroTitle || settings.general?.tagline)}
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                {textOrNotAdded(
                  settings.content?.coursesHeroSubtitle || settings.general?.description
                )}
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
                />                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <FiSearch className="h-4 w-4" />
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
            <FilterPanel
              categories={categories}
              selectedCategories={selectedCategories}
              onToggleCategory={toggleCategory}
              levels={levels}
              level={level}
              onLevelChange={setLevel}
              priceMin={clampedPriceMin}
              priceMax={clampedPriceMax}
              maxDetectedPrice={maxDetectedPrice}
              onPriceMinChange={handlePriceMinChange}
              onPriceMaxChange={handlePriceMaxChange}
            />
          </aside>

          <div>
            {isLoading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <SkeletonCard key={`course-skeleton-${index}`} />
                ))}
              </div>
            ) : allCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center dark:border-white/10 dark:bg-slate-900/70">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FiSearch className="h-7 w-7" />
                </div>
                <h3 className="mt-4 font-heading text-2xl text-slate-900 dark:text-white">
                  {NOT_ADDED}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                  {NOT_ADDED}
                </p>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center dark:border-white/10 dark:bg-slate-900/70">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FiSearch className="h-7 w-7" />
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
            <FilterPanel
              categories={categories}
              selectedCategories={selectedCategories}
              onToggleCategory={toggleCategory}
              levels={levels}
              level={level}
              onLevelChange={setLevel}
              priceMin={clampedPriceMin}
              priceMax={clampedPriceMax}
              maxDetectedPrice={maxDetectedPrice}
              onPriceMinChange={handlePriceMinChange}
              onPriceMaxChange={handlePriceMaxChange}
            />
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
                  {textOrNotAdded(selectedCourse.title)}
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
              {textOrNotAdded(selectedCourse.description)}
            </p>
            <div className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-200 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Teacher
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {textOrNotAdded(selectedCourse.teacher)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Duration
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {textOrNotAdded(selectedCourse.duration)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Subjects
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {Array.isArray(selectedCourse.subjects) && selectedCourse.subjects.length
                    ? selectedCourse.subjects.join(", ")
                    : NOT_ADDED}
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

