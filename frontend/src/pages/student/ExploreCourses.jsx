import { useEffect, useMemo, useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { SkeletonCard } from "../../components/Skeleton.jsx";
import {
  addStudentToClass,
  getAvailableClasses,
  getCourseCatalog,
} from "../../services/admin.service.js";
import { useAuth } from "../../hooks/useAuth.js";

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
    id: "class-xi-pre-medical",
    title: "Class XI - Pre-Medical",
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
    enrolled: false,
    bio: "Board-focused full stream for Biology, Chemistry and Physics.",
    chapters: ["Biology", "Chemistry", "Physics", "Mock Tests"],
  },
  {
    id: "organic-chemistry-drill",
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
    bio: "Concept-to-MCQs chemistry track for board and entry tests.",
    chapters: ["Basics", "Reactions", "Mechanisms", "Practice Sets"],
  },
  {
    id: "physics-numericals",
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
    bio: "Problem-solving heavy course with weekly performance checks.",
    chapters: ["Kinematics", "Dynamics", "Waves", "Mock Tests"],
  },
  {
    id: "english-grammar-bootcamp",
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
    enrolled: false,
    bio: "Grammar and writing confidence with live practice sheets.",
    chapters: ["Grammar", "Writing", "Practice", "Final Quiz"],
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

const formatTime = (value = "") => {
  if (!/^\d{2}:\d{2}$/.test(value)) return value || "N/A";
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
};

const shortDay = (day = "") => day.slice(0, 3);

function StudentExploreCourses() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [level, setLevel] = useState("All");
  const [price, setPrice] = useState("All");
  const [rating, setRating] = useState("All");
  const [sort, setSort] = useState("Most Popular");
  const [showCount, setShowCount] = useState(6);
  const [selectedCourse, setSelectedCourse] = useState(null);

  const [enrollStep, setEnrollStep] = useState(1);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [promoCode, setPromoCode] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(timer);
  }, []);

  const courseCatalogQuery = useQuery({
    queryKey: ["public-course-catalog"],
    queryFn: getCourseCatalog,
    staleTime: 30000,
  });

  const coursesData = useMemo(() => {
    const remoteCourses = Array.isArray(courseCatalogQuery.data)
      ? courseCatalogQuery.data
      : [];
    if (remoteCourses.length > 0) {
      return remoteCourses.map((course) => ({
        id: course.id,
        title: course.title || "Untitled Course",
        category: course.category || "General",
        teacher: course.teacher || "SUM Academy Faculty",
        rating: Number(course.rating || 0),
        reviews: Number(course.reviews || 0),
        students: Number(course.students || 0),
        lectures: Number(course.lectures || 0),
        duration: course.duration || "Self paced",
        price: Number(course.price || 0),
        originalPrice: Number(course.originalPrice || course.price || 0),
        discount: Number(course.discount || 0),
        level:
          String(course.level || "Beginner").charAt(0).toUpperCase() +
          String(course.level || "Beginner").slice(1),
        enrolled: false,
        bio: course.description || "No description available.",
        chapters: Array.isArray(course.chapters) ? course.chapters : [],
      }));
    }
    return courses;
  }, [courseCatalogQuery.data]);

  const hasFilters =
    search ||
    category !== "All" ||
    level !== "All" ||
    price !== "All" ||
    rating !== "All" ||
    sort !== "Most Popular";

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = coursesData.filter((course) => {
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
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sort === "Price High-Low") {
      list = [...list].sort((a, b) => b.price - a.price);
    }

    return list;
  }, [category, coursesData, level, price, rating, search, sort]);

  const visibleCourses = filteredCourses.slice(0, showCount);

  const clearFilters = () => {
    setSearch("");
    setCategory("All");
    setLevel("All");
    setPrice("All");
    setRating("All");
    setSort("Most Popular");
  };

  const availableClassesQuery = useQuery({
    queryKey: ["available-classes", selectedCourse?.id],
    queryFn: () => getAvailableClasses(selectedCourse.id),
    enabled: Boolean(selectedCourse?.id),
    staleTime: 10000,
  });

  const enrollMutation = useMutation({
    mutationFn: ({ classId, data }) => addStudentToClass(classId, data),
    onSuccess: () => {
      toast.success("Enrollment request submitted successfully.");
      setSelectedCourse(null);
      setSelectedClass(null);
      setSelectedShift(null);
      setEnrollStep(1);
      setPromoCode("");
      setPaymentMethod("bank_transfer");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Enrollment failed.");
    },
  });

  const onClickEnroll = (course) => {
    navigate("/student/checkout", {
      state: {
        course: {
          id: course.id,
          title: course.title,
          price: course.price,
          category: course.category || "",
          level: course.level || "Beginner",
        },
      },
    });
  };

  const closeEnroll = () => {
    setSelectedCourse(null);
    setSelectedClass(null);
    setSelectedShift(null);
    setEnrollStep(1);
    setPromoCode("");
    setPaymentMethod("bank_transfer");
  };

  const availableClasses = useMemo(
    () => availableClassesQuery.data || [],
    [availableClassesQuery.data]
  );

  const selectedClassShifts = useMemo(
    () => selectedClass?.shifts || [],
    [selectedClass]
  );

  const totalFee = Number(selectedCourse?.price || 0);

  return (
    <div className="space-y-6">
      <Toaster position="top-left" />

      <Motion.section {...fadeUp} className="text-center">
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
            {search ? (
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400"
                onClick={() => setSearch("")}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </Motion.section>

      <Motion.section {...fadeUp} className="flex gap-2 overflow-x-auto pb-2">
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
      </Motion.section>

      <Motion.section {...fadeUp} className="flex flex-wrap items-center gap-3">
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
        {hasFilters ? (
          <button className="text-xs text-primary" onClick={clearFilters}>
            Clear Filters
          </button>
        ) : null}
      </Motion.section>

      <Motion.section {...fadeUp} className="text-sm text-slate-500">
        Showing {filteredCourses.length} courses
      </Motion.section>

      <Motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={`course-skel-${index}`} />
            ))
          : visibleCourses.map((course) => (
              <article
                key={course.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
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
                <p className="mt-2 text-xs text-slate-500">{course.teacher}</p>
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
                  {course.originalPrice > course.price ? (
                    <span className="text-xs text-slate-400 line-through">
                      PKR {course.originalPrice}
                    </span>
                  ) : null}
                </div>
                <button
                  className="btn-primary mt-4 w-full"
                  onClick={() => onClickEnroll(course)}
                >
                  Enroll Now
                </button>
              </article>
            ))}
      </Motion.section>

      {!loading && filteredCourses.length === 0 ? (
        <Motion.section
          {...fadeUp}
          className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500"
        >
          <p>No courses found.</p>
          <button className="btn-outline mt-4" onClick={clearFilters}>
            Clear Filters
          </button>
        </Motion.section>
      ) : null}

      {!loading && filteredCourses.length > visibleCourses.length ? (
        <div className="flex justify-center">
          <button
            className="btn-outline"
            onClick={() => setShowCount((prev) => prev + 6)}
          >
            Load More
          </button>
        </div>
      ) : null}

      <AnimatePresence>
        {selectedCourse ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40"
              onClick={closeEnroll}
            />
            <Motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-2xl text-slate-900">{selectedCourse.title}</h3>
                  <p className="text-sm text-slate-500">
                    Step {enrollStep} of 3
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEnroll}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 overflow-y-auto pr-1">
                {enrollStep === 1 ? (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-slate-900">Select Class</h4>
                    {availableClassesQuery.isLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div key={`class-select-skel-${index}`} className="skeleton h-24 rounded-2xl" />
                        ))}
                      </div>
                    ) : availableClasses.length < 1 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                        No available classes found for this course yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {availableClasses.map((classItem) => (
                          <button
                            key={classItem.id}
                            type="button"
                            onClick={() => {
                              setSelectedClass(classItem);
                              setSelectedShift(null);
                              setEnrollStep(2);
                            }}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold text-slate-900">
                                {classItem.name} ({classItem.batchCode || "No Batch"})
                              </p>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                                {classItem.status}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {classItem.enrolledCount}/{classItem.capacity} enrolled ·{" "}
                              {classItem.availableSpots} seats left
                            </p>
                            <p className="mt-2 text-xs text-slate-500">
                              Shifts: {(classItem.shifts || []).length}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {enrollStep === 2 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-slate-900">Select Shift</h4>
                      <button
                        type="button"
                        className="text-xs text-primary"
                        onClick={() => setEnrollStep(1)}
                      >
                        Back to classes
                      </button>
                    </div>
                    {selectedClassShifts.length < 1 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                        No shifts found for selected class.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedClassShifts.map((shift) => (
                          <button
                            key={shift.id}
                            type="button"
                            onClick={() => {
                              setSelectedShift(shift);
                              setEnrollStep(3);
                            }}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                          >
                            <p className="font-semibold text-slate-900">{shift.name}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {(shift.days || []).map((day) => shortDay(day)).join(", ")} ·{" "}
                              {formatTime(shift.startTime)} to {formatTime(shift.endTime)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Teacher: {shift.teacherName || "N/A"}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {enrollStep === 3 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-slate-900">Payment</h4>
                      <button
                        type="button"
                        className="text-xs text-primary"
                        onClick={() => setEnrollStep(2)}
                      >
                        Back to shifts
                      </button>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                      <p className="font-semibold text-slate-900">{selectedCourse.title}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {selectedClass?.name} · {selectedShift?.name}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        Course Fee: {totalFee === 0 ? "Free" : `PKR ${totalFee}`}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-700">Payment Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(event) => setPaymentMethod(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      >
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="jazzcash">JazzCash</option>
                        <option value="easypaisa">EasyPaisa</option>
                        <option value="cash">Cash</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-700">Promo Code</label>
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(event) => setPromoCode(event.target.value)}
                        placeholder="Enter promo code (optional)"
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      />
                    </div>

                    <button
                      type="button"
                      className="btn-primary w-full"
                      disabled={enrollMutation.isPending}
                      onClick={() => {
                        if (!selectedClass || !selectedShift) {
                          toast.error("Please select class and shift.");
                          return;
                        }
                        if (!userProfile?.uid && !user?.uid) {
                          toast.error("User session not found. Please login again.");
                          return;
                        }

                        enrollMutation.mutate({
                          classId: selectedClass.id,
                          data: {
                            studentId: userProfile?.uid || user?.uid,
                            shiftId: selectedShift.id,
                            courseId: selectedCourse.id,
                            paymentMethod,
                            promoCode: promoCode.trim(),
                          },
                        });
                      }}
                    >
                      {enrollMutation.isPending ? "Submitting..." : "Confirm Enrollment"}
                    </button>
                  </div>
                ) : null}
              </div>
            </Motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default StudentExploreCourses;

