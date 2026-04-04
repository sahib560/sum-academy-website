import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import { SkeletonCard } from "../../components/Skeleton.jsx";
import {
  getAvailableClassesForStudents,
  getStudentDashboard,
} from "../../services/student.service.js";
import { useAuth } from "../../hooks/useAuth.js";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toStatusLabel = (classItem = {}) => {
  if (classItem.isFull) return "Full";
  const status = String(classItem.status || "").toLowerCase();
  if (status === "upcoming") return "Upcoming";
  return "Open";
};

function StudentExploreCourses() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["explore-classes"],
    queryFn: () => getAvailableClassesForStudents(),
    staleTime: 30000,
  });

  const studentDashboardQuery = useQuery({
    queryKey: ["student-dashboard-class-enrollment"],
    queryFn: () => getStudentDashboard(),
    enabled: Boolean(isAuthenticated),
    staleTime: 30000,
  });

  const enrolledClassIds = useMemo(() => {
    const classes = Array.isArray(studentDashboardQuery.data?.classes)
      ? studentDashboardQuery.data.classes
      : [];
    return new Set(classes.map((row) => row.classId || row.id).filter(Boolean));
  }, [studentDashboardQuery.data]);

  const classes = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    return rows.map((row) => {
      const assignedCourses = Array.isArray(row.assignedCourses)
        ? row.assignedCourses
        : [];
      const enrolledCount = Math.max(0, toNumber(row.enrolledCount, 0));
      const capacity = Math.max(1, toNumber(row.capacity, 30));
      const spotsLeft = Math.max(0, toNumber(row.spotsLeft, capacity - enrolledCount));
      const isFull = Boolean(row.isFull) || spotsLeft < 1;
      const isEnrolled = enrolledClassIds.has(row.id);
      return {
        ...row,
        assignedCourses,
        enrolledCount,
        capacity,
        spotsLeft,
        isFull,
        isEnrolled,
      };
    });
  }, [data, enrolledClassIds]);

  const filteredClasses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return classes;
    return classes.filter((row) => {
      const courseText = row.assignedCourses
        .map((course) => String(course?.title || course?.courseName || "").toLowerCase())
        .join(" ");
      return (
        String(row.name || "").toLowerCase().includes(query) ||
        String(row.batchCode || "").toLowerCase().includes(query) ||
        String(row.teacherName || "").toLowerCase().includes(query) ||
        courseText.includes(query)
      );
    });
  }, [classes, search]);

  const handleEnroll = (classItem) => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (classItem.isFull || classItem.isEnrolled) return;

    const primaryCourse = classItem.assignedCourses[0] || {};
    if (!primaryCourse.courseId) return;
    navigate("/student/checkout", {
      state: {
        course: {
          id: primaryCourse.courseId || "",
          title: primaryCourse.title || primaryCourse.courseName || classItem.name || "Class",
          price: toNumber(primaryCourse.price, 0),
        },
        prefillClassId: classItem.id,
        prefillShiftId: classItem.shifts?.[0]?.id || "",
      },
    });
  };

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp} className="text-center">
        <h1 className="font-heading text-3xl text-slate-900">Explore Classes</h1>
        <div className="mt-5 flex justify-center">
          <div className="relative w-full max-w-3xl">
            <input
              type="text"
              placeholder="Search class, batch, teacher, or course..."
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

      {isError && (
        <motion.section
          {...fadeUp}
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error?.response?.data?.message || error?.message || "Failed to load classes"}
        </motion.section>
      )}

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={`class-skel-${index}`} />
            ))
          : filteredClasses.map((classItem) => {
              const statusLabel = toStatusLabel(classItem);
              const canEnroll =
                !classItem.isEnrolled &&
                !classItem.isFull &&
                classItem.assignedCourses.length > 0;
              const statusBadge =
                statusLabel === "Full"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : statusLabel === "Upcoming"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200";

              return (
                <article
                  key={classItem.id}
                  className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                  onClick={() => setSelectedClass(classItem)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-heading text-lg text-slate-900">
                        {classItem.name || "Class"}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {classItem.batchCode || "No batch code"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusBadge}`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    Teacher: {classItem.teacherName || "Teacher"}
                  </p>

                  <div className="mt-3 space-y-1 text-xs text-slate-600">
                    <p>
                      {classItem.spotsLeft > 0
                        ? `${classItem.spotsLeft} spots left`
                        : `${classItem.enrolledCount}/${classItem.capacity} students enrolled`}
                    </p>
                    <p>
                      {classItem.shifts?.length || 0} shift(s)
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {classItem.assignedCourses.slice(0, 3).map((course) => (
                      <span
                        key={`${classItem.id}-${course.courseId}`}
                        className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600"
                      >
                        {course.title || "Course"}
                      </span>
                    ))}
                    {classItem.assignedCourses.length > 3 ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600">
                        +{classItem.assignedCourses.length - 3} more
                      </span>
                    ) : null}
                  </div>

                  <button
                    className={`mt-4 w-full rounded-full px-4 py-2 text-sm font-semibold ${
                      classItem.isEnrolled
                        ? "bg-emerald-500 text-white"
                        : classItem.isFull
                        ? "cursor-not-allowed bg-slate-200 text-slate-500"
                        : !canEnroll
                        ? "cursor-not-allowed bg-slate-200 text-slate-500"
                        : "bg-primary text-white"
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleEnroll(classItem);
                    }}
                    disabled={!canEnroll}
                  >
                    {classItem.isEnrolled
                      ? "Enrolled"
                      : classItem.isFull
                      ? "Class Full"
                      : !canEnroll
                      ? "Not Available"
                      : "Enroll Now"}
                  </button>
                </article>
              );
            })}
      </motion.section>

      {!isLoading && filteredClasses.length === 0 && (
        <motion.section
          {...fadeUp}
          className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500"
        >
          No classes found.
        </motion.section>
      )}

      <AnimatePresence>
        {selectedClass ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
            <button
              className="absolute inset-0 bg-slate-900/50"
              onClick={() => setSelectedClass(null)}
              aria-label="Close class detail modal"
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
                    {selectedClass.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedClass.batchCode || "No batch code"} - {selectedClass.teacherName || "Teacher"}
                  </p>
                </div>
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                  onClick={() => setSelectedClass(null)}
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {toStatusLabel(selectedClass)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Capacity</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedClass.enrolledCount}/{selectedClass.capacity}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Spots Left</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedClass.spotsLeft}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-900">Assigned Courses</p>
                {selectedClass.assignedCourses.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {selectedClass.assignedCourses.map((course) => (
                      <div
                        key={`${selectedClass.id}-${course.courseId}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                      >
                        <p className="font-semibold">{course.title || "Course"}</p>
                        <p className="text-xs text-slate-500">
                          {(course.subjects || []).join(", ") || "Subjects will be shared in class"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No courses assigned yet.</p>
                )}
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-900">Shifts / Timings</p>
                {selectedClass.shifts?.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {selectedClass.shifts.map((shift) => (
                      <div
                        key={`${selectedClass.id}-${shift.id}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                      >
                        {shift.name} - {(shift.days || []).join(", ")} - {shift.startTime || "-"} to{" "}
                        {shift.endTime || "-"}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No shifts added yet.</p>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                {(() => {
                  const canEnroll =
                    !selectedClass.isEnrolled &&
                    !selectedClass.isFull &&
                    selectedClass.assignedCourses.length > 0;
                  return (
                <button
                  className={`rounded-full px-5 py-2 text-sm font-semibold ${
                    selectedClass.isEnrolled
                      ? "bg-emerald-500 text-white"
                      : selectedClass.isFull
                      ? "cursor-not-allowed bg-slate-200 text-slate-500"
                      : !canEnroll
                      ? "cursor-not-allowed bg-slate-200 text-slate-500"
                      : "bg-primary text-white"
                  }`}
                  onClick={() => handleEnroll(selectedClass)}
                  disabled={!canEnroll}
                >
                  {selectedClass.isEnrolled
                    ? "Enrolled"
                    : selectedClass.isFull
                    ? "Class Full"
                    : !canEnroll
                    ? "Not Available"
                    : "Enroll in this Class"}
                </button>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default StudentExploreCourses;
