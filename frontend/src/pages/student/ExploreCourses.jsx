import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import { SkeletonCard } from "../../components/Skeleton.jsx";
import { exploreCourses } from "../../services/student.service.js";
import { useAuth } from "../../hooks/useAuth.js";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const levelOptions = ["All", "Beginner", "Intermediate", "Advanced"];
const priceOptions = ["All", "Free", "Under 1000 PKR", "1000 - 5000 PKR", "5000+ PKR"];
const ratingOptions = ["All", "4.5+ Rating", "4+ Rating", "3+ Rating"];
const sortOptions = [
  "Most Popular",
  "Top Rated",
  "Newest",
  "Price Low-High",
  "Price High-Low",
];

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getFinalPrice = (course = {}) => {
  const basePrice = Math.max(0, toNumber(course.price, 0));
  const discountPercent = Math.max(0, Math.min(100, toNumber(course.discountPercent, 0)));
  const discountAmount = (basePrice * discountPercent) / 100;
  return Number((basePrice - discountAmount).toFixed(2));
};

const getPriceRangeMatch = (priceRange, finalPrice) => {
  if (priceRange === "All") return true;
  if (priceRange === "Free") return finalPrice === 0;
  if (priceRange === "Under 1000 PKR") return finalPrice > 0 && finalPrice <= 1000;
  if (priceRange === "1000 - 5000 PKR") return finalPrice > 1000 && finalPrice <= 5000;
  if (priceRange === "5000+ PKR") return finalPrice > 5000;
  return true;
};

const getRatingMatch = (ratingFilter, rating) => {
  if (ratingFilter === "All") return true;
  if (ratingFilter === "4.5+ Rating") return rating >= 4.5;
  if (ratingFilter === "4+ Rating") return rating >= 4;
  if (ratingFilter === "3+ Rating") return rating >= 3;
  return true;
};

const getSubjectTitle = (subject) => {
  if (!subject) return "Subject";
  if (typeof subject === "string") return subject;
  return subject.subjectName || subject.name || subject.title || "Subject";
};

const getSubjectTeacher = (subject) =>
  (typeof subject === "object" && subject?.teacherName) || "Teacher";

const getChapterTitle = (chapter) => {
  if (!chapter) return "Chapter";
  if (typeof chapter === "string") return chapter;
  return chapter.title || chapter.name || "Chapter";
};

function StudentExploreCourses() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [level, setLevel] = useState("All");
  const [priceRange, setPriceRange] = useState("All");
  const [ratingFilter, setRatingFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Most Popular");
  const [showCount, setShowCount] = useState(6);
  const [selectedCourse, setSelectedCourse] = useState(null);

  const filters = useMemo(
    () => ({
      category,
      level,
      search,
      priceRange,
      rating: ratingFilter,
      sort: sortBy,
    }),
    [category, level, priceRange, ratingFilter, search, sortBy]
  );

  const serverFilters = useMemo(
    () => ({
      category: category === "All" ? undefined : category,
      level: level === "All" ? undefined : level.toLowerCase(),
      search: search.trim() || undefined,
    }),
    [category, level, search]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["explore-courses", filters],
    queryFn: () => exploreCourses(serverFilters),
    staleTime: 30000,
  });

  const categoriesQuery = useQuery({
    queryKey: ["explore-courses-categories"],
    queryFn: () => exploreCourses({}),
    staleTime: 60000,
  });

  const allCourses = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const categoryCourses = useMemo(
    () => (Array.isArray(categoriesQuery.data) ? categoriesQuery.data : allCourses),
    [categoriesQuery.data, allCourses]
  );

  const categoryPills = useMemo(() => {
    const values = new Set(["All"]);
    categoryCourses.forEach((course) => {
      const value = String(course.category || "").trim();
      if (value) values.add(value);
    });
    return Array.from(values);
  }, [categoryCourses]);

  const normalizedCourses = useMemo(
    () =>
      allCourses.map((course, index) => {
        const price = Math.max(0, toNumber(course.price, 0));
        const discountPercent = Math.max(
          0,
          Math.min(100, toNumber(course.discountPercent, 0))
        );
        const finalPrice = getFinalPrice(course);
        const rating = Math.max(0, toNumber(course.rating, 0));
        const enrolledCount = Math.max(0, toNumber(course.enrollmentCount, 0));
        const subjects = Array.isArray(course.subjects) ? course.subjects : [];
        const chapters = Array.isArray(course.chapters) ? course.chapters : [];
        const totalLectures = Math.max(
          0,
          toNumber(
            course.totalLectures,
            chapters.reduce((sum, chapter) => {
              if (Array.isArray(chapter?.lectures)) return sum + chapter.lectures.length;
              return sum;
            }, 0)
          )
        );
        return {
          id: course.id || `course-${index}`,
          title: course.title || "Course",
          description: course.description || "No description available.",
          thumbnail: course.thumbnail || "",
          category: course.category || "General",
          level: course.level || "Beginner",
          teacherName: course.teacherName || "Teacher",
          rating,
          enrollmentCount: enrolledCount,
          price,
          discountPercent,
          finalPrice,
          subjects,
          chapters,
          totalLectures,
          hasCertificate: course.hasCertificate !== false,
          isEnrolled: Boolean(course.isEnrolled),
          createdAt: course.createdAt || null,
        };
      }),
    [allCourses]
  );

  const filteredCourses = useMemo(() => {
    let list = normalizedCourses.filter((course) => {
      const matchesPrice = getPriceRangeMatch(priceRange, course.finalPrice);
      const matchesRating = getRatingMatch(ratingFilter, course.rating);
      return matchesPrice && matchesRating;
    });

    if (sortBy === "Top Rated") {
      list = [...list].sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "Price Low-High") {
      list = [...list].sort((a, b) => a.finalPrice - b.finalPrice);
    } else if (sortBy === "Price High-Low") {
      list = [...list].sort((a, b) => b.finalPrice - a.finalPrice);
    } else if (sortBy === "Newest") {
      list = [...list].sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime() || 0;
        const bTime = new Date(b.createdAt || 0).getTime() || 0;
        return bTime - aTime;
      });
    } else {
      list = [...list].sort((a, b) => b.enrollmentCount - a.enrollmentCount);
    }

    return list;
  }, [normalizedCourses, priceRange, ratingFilter, sortBy]);

  const visibleCourses = filteredCourses.slice(0, showCount);

  useEffect(() => {
    setShowCount(6);
  }, [search, category, level, priceRange, ratingFilter, sortBy]);

  const handleEnroll = (course) => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    navigate("/student/checkout", {
      state: {
        course: {
          id: course.id,
          title: course.title,
          price: course.finalPrice,
          category: course.category,
          level: course.level,
        },
      },
    });
  };

  const handlePrimaryAction = (course) => {
    if (course.isEnrolled) {
      navigate("/student/courses");
      return;
    }
    handleEnroll(course);
  };

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp} className="text-center">
        <h1 className="font-heading text-3xl text-slate-900">Explore Courses</h1>
        <div className="mt-5 flex justify-center">
          <div className="relative w-full max-w-3xl">
            <input
              type="text"
              placeholder="Search for courses, teachers, or topics..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-full border border-slate-200 bg-white px-14 py-4 text-base text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
              <FiSearch className="h-4 w-4" />
            </span>
          </div>
        </div>
      </motion.section>

      <motion.section {...fadeUp} className="flex gap-2 overflow-x-auto pb-2">
        {categoryPills.map((item) => (
          <button
            key={item}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold ${
              category === item
                ? "bg-primary text-white"
                : "border border-slate-200 text-slate-600"
            }`}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </motion.section>

      <motion.section {...fadeUp} className="flex flex-wrap items-center gap-3">
        <select
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          {levelOptions.map((option) => (
            <option key={option} value={option}>
              Level: {option}
            </option>
          ))}
        </select>
        <select
          value={priceRange}
          onChange={(event) => setPriceRange(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          {priceOptions.map((option) => (
            <option key={option} value={option}>
              Price: {option}
            </option>
          ))}
        </select>
        <select
          value={ratingFilter}
          onChange={(event) => setRatingFilter(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          {ratingOptions.map((option) => (
            <option key={option} value={option}>
              Rating: {option}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          {sortOptions.map((option) => (
            <option key={option} value={option}>
              Sort: {option}
            </option>
          ))}
        </select>
      </motion.section>

      {isError && (
        <motion.section
          {...fadeUp}
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error?.response?.data?.message || error?.message || "Failed to load courses"}
        </motion.section>
      )}

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={`course-skel-${index}`} />
            ))
          : visibleCourses.map((course) => (
              <article
                key={course.id}
                className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                onClick={() => setSelectedCourse(course)}
              >
                <div className="h-24 overflow-hidden rounded-2xl bg-slate-100">
                  {course.thumbnail ? (
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-slate-100 text-xs font-semibold text-primary">
                      {course.category}
                    </div>
                  )}
                </div>

                <h3
                  className="mt-4 font-heading text-lg text-slate-900"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {course.title}
                </h3>
                <p className="mt-2 text-xs text-slate-500">{course.teacherName}</p>

                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <span>Rating {course.rating.toFixed(1)}</span>
                  <span>{course.enrollmentCount} enrolled</span>
                </div>

                <div className="mt-3 flex items-end gap-2">
                  <span className="text-lg font-semibold text-slate-900">
                    {course.finalPrice === 0
                      ? "Free"
                      : `PKR ${Math.round(course.finalPrice).toLocaleString("en-PK")}`}
                  </span>
                  {course.discountPercent > 0 && course.price > course.finalPrice ? (
                    <span className="text-xs text-slate-400 line-through">
                      PKR {Math.round(course.price).toLocaleString("en-PK")}
                    </span>
                  ) : null}
                </div>

                <button
                  className={`mt-4 w-full rounded-full px-4 py-2 text-sm font-semibold ${
                    course.isEnrolled
                      ? "bg-emerald-500 text-white"
                      : "bg-primary text-white"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePrimaryAction(course);
                  }}
                >
                  {course.isEnrolled ? "Continue Learning" : "Enroll Now"}
                </button>
              </article>
            ))}
      </motion.section>

      {!isLoading && filteredCourses.length === 0 && (
        <motion.section
          {...fadeUp}
          className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500"
        >
          No courses found.
        </motion.section>
      )}

      {!isLoading && filteredCourses.length > visibleCourses.length && (
        <div className="flex justify-center">
          <button
            className="btn-outline"
            onClick={() => setShowCount((previous) => previous + 6)}
          >
            Load More
          </button>
        </div>
      )}

      <AnimatePresence>
        {selectedCourse ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
            <button
              className="absolute inset-0 bg-slate-900/50"
              onClick={() => setSelectedCourse(null)}
              aria-label="Close course detail modal"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-2xl text-slate-900">
                    {selectedCourse.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedCourse.teacherName}
                  </p>
                </div>
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                  onClick={() => setSelectedCourse(null)}
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <p className="text-sm text-slate-600">{selectedCourse.description}</p>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Category</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedCourse.category}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Level</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedCourse.level}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Total Lectures</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedCourse.totalLectures}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">Subjects</p>
                  {selectedCourse.subjects.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {selectedCourse.subjects.map((subject, index) => (
                        <div
                          key={`subject-${selectedCourse.id}-${index}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                        >
                          {getSubjectTitle(subject)} - {getSubjectTeacher(subject)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No subjects listed yet.</p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Chapter Preview (first 3)
                  </p>
                  {selectedCourse.chapters.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {selectedCourse.chapters.slice(0, 3).map((chapter, index) => (
                        <div
                          key={`chapter-${selectedCourse.id}-${index}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                        >
                          {getChapterTitle(chapter)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No chapters available yet.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Price</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-xl font-semibold text-slate-900">
                      {selectedCourse.finalPrice === 0
                        ? "Free"
                        : `PKR ${Math.round(selectedCourse.finalPrice).toLocaleString("en-PK")}`}
                    </p>
                    {selectedCourse.discountPercent > 0 &&
                    selectedCourse.price > selectedCourse.finalPrice ? (
                      <p className="text-xs text-slate-400 line-through">
                        PKR {Math.round(selectedCourse.price).toLocaleString("en-PK")}
                      </p>
                    ) : null}
                  </div>
                  {selectedCourse.discountPercent > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-600">
                      {selectedCourse.discountPercent}% discount applied
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  {selectedCourse.isEnrolled ? (
                    <button
                      className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white"
                      onClick={() => {
                        setSelectedCourse(null);
                        navigate("/student/courses");
                      }}
                    >
                      Continue Learning
                    </button>
                  ) : (
                    <button
                      className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white"
                      onClick={() => handleEnroll(selectedCourse)}
                    >
                      Enroll Now
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default StudentExploreCourses;
