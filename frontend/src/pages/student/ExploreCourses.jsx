import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SkeletonCard } from "../../components/Skeleton.jsx";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const categories = [
  "All",
  "Math",
  "Science",
  "English",
  "Computer Science",
  "Physics",
  "Chemistry",
  "Biology",
  "Urdu",
  "Islamic Studies",
];

const levelOptions = ["All", "Beginner", "Intermediate", "Advanced"];
const priceOptions = ["All", "Free", "Paid", "Under 1000 PKR", "Under 5000 PKR"];
const ratingOptions = ["All", "4★ & above", "3★ & above"];
const sortOptions = [
  "Most Popular",
  "Newest",
  "Price Low-High",
  "Price High-Low",
];

const courses = [
  {
    id: 1,
    title: "Advanced Biology MCQs",
    category: "Biology",
    teacher: "Mr. Sikander Ali Qureshi",
    rating: 4.8,
    reviews: 124,
    students: 420,
    lectures: 36,
    duration: "18h 20m",
    price: 2500,
    originalPrice: 3200,
    discount: 20,
    level: "Advanced",
    enrolled: true,
    bio: "Associate Professor of Chemistry with 10+ years of teaching experience.",
    chapters: [
      "Foundations of Biology",
      "Genetics Deep Dive",
      "Physiology Mastery",
      "Mock Tests",
    ],
  },
  {
    id: 2,
    title: "Organic Chemistry Drill",
    category: "Chemistry",
    teacher: "Mr. Mansoor Ahmed Mangi",
    rating: 4.6,
    reviews: 88,
    students: 350,
    lectures: 28,
    duration: "12h 30m",
    price: 2200,
    originalPrice: 2200,
    discount: 0,
    level: "Intermediate",
    enrolled: false,
    bio: "Lecturer Chemistry focusing on practical exam strategies.",
    chapters: ["Basics", "Reactions", "Mechanisms", "Practice Sets"],
  },
  {
    id: 3,
    title: "Physics Numericals",
    category: "Physics",
    teacher: "Mr. Muhammad Idress Mahar",
    rating: 4.7,
    reviews: 95,
    students: 280,
    lectures: 30,
    duration: "14h 10m",
    price: 2000,
    originalPrice: 2600,
    discount: 25,
    level: "Intermediate",
    enrolled: false,
    bio: "Physics mentor known for problem-solving techniques.",
    chapters: ["Kinematics", "Dynamics", "Waves", "Mock Tests"],
  },
  {
    id: 4,
    title: "English Grammar Bootcamp",
    category: "English",
    teacher: "Mr. Waseem Ahmed Soomro",
    rating: 4.5,
    reviews: 64,
    students: 190,
    lectures: 20,
    duration: "9h 40m",
    price: 1800,
    originalPrice: 1800,
    discount: 0,
    level: "Beginner",
    enrolled: true,
    bio: "English lecturer specializing in grammar and composition.",
    chapters: ["Grammar", "Writing", "Practice", "Final Quiz"],
  },
  {
    id: 5,
    title: "Math Problem Solving",
    category: "Math",
    teacher: "Ms. Hira Fatima",
    rating: 4.4,
    reviews: 52,
    students: 160,
    lectures: 18,
    duration: "8h 15m",
    price: 1500,
    originalPrice: 2000,
    discount: 25,
    level: "Beginner",
    enrolled: false,
    bio: "Math instructor focused on concept clarity.",
    chapters: ["Algebra", "Geometry", "Practice Sets", "Review"],
  },
  {
    id: 6,
    title: "Computer Science Basics",
    category: "Computer Science",
    teacher: "Mr. Ali Raza",
    rating: 4.3,
    reviews: 40,
    students: 140,
    lectures: 16,
    duration: "7h 10m",
    price: 0,
    originalPrice: 0,
    discount: 0,
    level: "Beginner",
    enrolled: false,
    bio: "CS lecturer teaching fundamentals for beginners.",
    chapters: ["Intro", "Programming Basics", "Practice", "Wrap-up"],
  },
];

const categoryStyles = {
  Biology: "from-emerald-400/70 to-emerald-100",
  Chemistry: "from-blue-500/70 to-blue-100",
  Physics: "from-violet-500/70 to-violet-100",
  English: "from-orange-400/70 to-orange-100",
  Math: "from-sky-400/70 to-sky-100",
  "Computer Science": "from-indigo-400/70 to-indigo-100",
  Science: "from-teal-400/70 to-teal-100",
  Urdu: "from-rose-400/70 to-rose-100",
  "Islamic Studies": "from-amber-400/70 to-amber-100",
};

function StudentExploreCourses() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [level, setLevel] = useState("All");
  const [price, setPrice] = useState("All");
  const [rating, setRating] = useState("All");
  const [sort, setSort] = useState("Most Popular");
  const [showCount, setShowCount] = useState(6);
  const [selectedCourse, setSelectedCourse] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const hasFilters =
    search ||
    category !== "All" ||
    level !== "All" ||
    price !== "All" ||
    rating !== "All" ||
    sort !== "Most Popular";

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = courses.filter((course) => {
      const matchesSearch =
        !query ||
        course.title.toLowerCase().includes(query) ||
        course.teacher.toLowerCase().includes(query);
      const matchesCategory = category === "All" || course.category === category;
      const matchesLevel = level === "All" || course.level === level;
      const matchesPrice =
        price === "All" ||
        (price === "Free" && course.price === 0) ||
        (price === "Paid" && course.price > 0) ||
        (price === "Under 1000 PKR" && course.price <= 1000) ||
        (price === "Under 5000 PKR" && course.price <= 5000);
      const matchesRating =
        rating === "All" ||
        (rating === "4★ & above" && course.rating >= 4) ||
        (rating === "3★ & above" && course.rating >= 3);
      return (
        matchesSearch && matchesCategory && matchesLevel && matchesPrice && matchesRating
      );
    });

    if (sort === "Price Low-High") {
      list = list.sort((a, b) => a.price - b.price);
    } else if (sort === "Price High-Low") {
      list = list.sort((a, b) => b.price - a.price);
    }

    return list;
  }, [category, level, price, rating, search, sort]);

  const visibleCourses = filteredCourses.slice(0, showCount);

  const clearFilters = () => {
    setSearch("");
    setCategory("All");
    setLevel("All");
    setPrice("All");
    setRating("All");
    setSort("Most Popular");
  };

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp} className="text-center">
        <h1 className="font-heading text-3xl text-slate-900">Explore Courses</h1>
        <div className="mt-4 flex justify-center">
          <div className="relative w-full max-w-2xl">
            <input
              type="text"
              placeholder="Search for courses, topics, or teachers..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-full border border-slate-200 bg-white px-12 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              🔍
            </span>
            {search && (
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400"
                onClick={() => setSearch("")}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </motion.section>

      <motion.section {...fadeUp} className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((item) => (
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
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          {priceOptions.map((option) => (
            <option key={option} value={option}>
              Price: {option}
            </option>
          ))}
        </select>
        <select
          value={rating}
          onChange={(event) => setRating(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          {ratingOptions.map((option) => (
            <option key={option} value={option}>
              Rating: {option}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          {sortOptions.map((option) => (
            <option key={option} value={option}>
              Sort: {option}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button className="text-xs text-primary" onClick={clearFilters}>
            Clear Filters
          </button>
        )}
      </motion.section>

      <motion.section {...fadeUp} className="text-sm text-slate-500">
        Showing {filteredCourses.length} courses
      </motion.section>

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={`course-skel-${index}`} />
            ))
          : visibleCourses.map((course) => (
              <button
                key={course.id}
                className="text-left rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                onClick={() => setSelectedCourse(course)}
              >
                <div
                  className={`h-24 rounded-2xl bg-gradient-to-br ${
                    categoryStyles[course.category] || "from-slate-300 to-slate-100"
                  }`}
                />
                <span className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                  {course.category}
                </span>
                <h3
                  className="mt-3 font-heading text-lg text-slate-900"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {course.title}
                </h3>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {course.teacher
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")}
                  </span>
                  {course.teacher}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <span>⭐ {course.rating}</span>
                  <span>({course.reviews})</span>
                  <span>{course.students} students</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {course.lectures} lectures · {course.duration}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-lg font-semibold text-slate-900">
                    {course.price === 0 ? "Free" : `PKR ${course.price}`}
                  </span>
                  {course.originalPrice > course.price && (
                    <span className="text-xs text-slate-400 line-through">
                      PKR {course.originalPrice}
                    </span>
                  )}
                  {course.discount > 0 && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600">
                      {course.discount}% OFF
                    </span>
                  )}
                </div>
                <button
                  className={`mt-4 w-full rounded-full px-3 py-2 text-xs font-semibold ${
                    course.enrolled
                      ? "bg-emerald-500 text-white"
                      : "bg-primary text-white"
                  }`}
                >
                  {course.enrolled ? "Continue Learning" : "Enroll Now"}
                </button>
              </button>
            ))}
      </motion.section>

      {!loading && filteredCourses.length === 0 && (
        <motion.section {...fadeUp} className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          <p>No courses found.</p>
          <button className="btn-outline mt-4" onClick={clearFilters}>
            Clear Filters
          </button>
        </motion.section>
      )}

      {!loading && filteredCourses.length > visibleCourses.length && (
        <div className="flex justify-center">
          <button
            className="btn-outline"
            onClick={() => setShowCount((prev) => prev + 6)}
          >
            Load More
          </button>
        </div>
      )}

      {selectedCourse && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setSelectedCourse(null)}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-2xl text-slate-900">
                  {selectedCourse.title}
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedCourse.category} · {selectedCourse.level}
                </p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                onClick={() => setSelectedCourse(null)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr]">
              <div className="space-y-4">
                <p className="text-sm text-slate-500">
                  Chapter preview
                </p>
                <div className="space-y-2 text-sm text-slate-600">
                  {selectedCourse.chapters.map((chapter, index) => (
                    <div
                      key={chapter}
                      className={`rounded-2xl border border-slate-200 px-3 py-2 ${
                        index > 2 ? "text-slate-400" : "bg-slate-50"
                      }`}
                    >
                      {index > 2 ? "🔒 " : ""}
                      {chapter}
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="font-semibold text-slate-900">Teacher</p>
                  <p className="text-slate-500">{selectedCourse.teacher}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedCourse.bio}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                  <p className="font-semibold text-slate-900">Student Reviews</p>
                  <div className="mt-2 space-y-2 text-xs text-slate-500">
                    <p>Great explanations and pacing.</p>
                    <p>Helped me score higher in mock tests.</p>
                    <p>Clear concepts and supportive instructor.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Price</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {selectedCourse.price === 0
                    ? "Free"
                    : `PKR ${selectedCourse.price}`}
                </p>
                {selectedCourse.originalPrice > selectedCourse.price && (
                  <p className="text-xs text-slate-400 line-through">
                    PKR {selectedCourse.originalPrice}
                  </p>
                )}
                <button className="btn-primary mt-4 w-full">
                  Enroll Now
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default StudentExploreCourses;
