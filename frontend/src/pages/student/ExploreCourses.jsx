import { useMemo, useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
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
  const status = String(classItem.classStatus || classItem.status || "").toLowerCase();
  if (status === "expired") return "Expired";
  if (status === "full" || classItem.isFull) return "Full";
  if (status === "upcoming") return "Upcoming";
  return "Active";
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

  const enrollmentSnapshot = useMemo(() => {
    const classes = Array.isArray(studentDashboardQuery.data?.classes)
      ? studentDashboardQuery.data.classes
      : [];
    const enrolledClassIds = new Set(
      classes.map((row) => row.classId || row.id).filter(Boolean)
    );
    const paidCourseKeySet = new Set();
    classes.forEach((classRow) => {
      const classId = classRow.classId || classRow.id || "";
      const courses = Array.isArray(classRow.courses) ? classRow.courses : [];
      courses.forEach((course) => {
        const courseId = course.courseId || course.id || "";
        if (!classId || !courseId) return;
        if (course.isPaymentLocked) return;
        paidCourseKeySet.add(`${classId}::${courseId}`);
      });
    });
    return { enrolledClassIds, paidCourseKeySet };
  }, [studentDashboardQuery.data]);

  const classes = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    return rows.map((row) => {
      const assignedSubjects = Array.isArray(row.assignedSubjects)
        ? row.assignedSubjects
        : Array.isArray(row.assignedCourses)
          ? row.assignedCourses
        : [];
      const enrolledCount = Math.max(0, toNumber(row.enrolledCount, 0));
      const capacity = Math.max(1, toNumber(row.capacity, 30));
      const spotsLeft = Math.max(0, toNumber(row.spotsLeft, capacity - enrolledCount));
      const isFull = Boolean(row.isFull) || spotsLeft < 1;
      const enrichedSubjects = assignedSubjects.map((subject) => {
        const subjectId = subject.subjectId || subject.courseId || "";
        const isPaid =
          Boolean(subject.alreadyPurchased) ||
          enrollmentSnapshot.paidCourseKeySet.has(`${row.id}::${subjectId}`);
        return {
          ...subject,
          subjectId,
          courseId: subjectId,
          alreadyPurchased: isPaid,
        };
      });
      const paidCoursesCount = enrichedSubjects.filter((subject) => subject.alreadyPurchased).length;
      const isEnrolled = enrollmentSnapshot.enrolledClassIds.has(row.id);
      const totalSubjectsCount = enrichedSubjects.length;
      const isFullyPaid =
        Boolean(row.isFullyEnrolled) ||
        (totalSubjectsCount > 0 && paidCoursesCount >= totalSubjectsCount);
      const isPartiallyEnrolled =
        Boolean(row.isPartiallyEnrolled) || (paidCoursesCount > 0 && !isFullyPaid);
      const totalPrice = Math.max(
        0,
        toNumber(row.price ?? row.totalPrice, toNumber(row.totalPrice, 0))
      );
      const remainingPrice = Math.max(
        0,
        toNumber(row.remainingPrice, totalPrice)
      );
      return {
        ...row,
        assignedSubjects: enrichedSubjects,
        assignedCourses: enrichedSubjects,
        enrolledCount,
        capacity,
        spotsLeft,
        isFull,
        isEnrolled,
        paidCoursesCount,
        totalSubjectsCount,
        isFullyPaid,
        isPartiallyEnrolled,
        totalPrice,
        remainingPrice,
      };
    });
  }, [data, enrollmentSnapshot]);

  const filteredClasses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return classes;
    return classes.filter((row) => {
      const subjectText = row.assignedSubjects
        .map((subject) => String(subject?.title || subject?.courseName || "").toLowerCase())
        .join(" ");
      return (
        String(row.name || "").toLowerCase().includes(query) ||
        String(row.batchCode || "").toLowerCase().includes(query) ||
        String(row.teacherName || "").toLowerCase().includes(query) ||
        subjectText.includes(query)
      );
    });
  }, [classes, search]);

  const goToCheckout = ({ classItem }) => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (classItem.isFull && !classItem.isEnrolled) return;
    navigate("/student/checkout", {
      state: {
        enrollmentType: "full_class",
        classInfo: {
          id: classItem.id,
          name: classItem.name,
          batchCode: classItem.batchCode,
          totalPrice: toNumber(classItem.totalPrice, 0),
          remainingPrice: toNumber(classItem.remainingPrice, toNumber(classItem.totalPrice, 0)),
          assignedSubjects: classItem.assignedSubjects || [],
          assignedCourses: classItem.assignedSubjects || [],
        },
        course: null,
        prefillClassId: classItem.id,
        prefillShiftId: classItem.shifts?.[0]?.id || "",
      },
    });
  };

  return (
    <div className="space-y-6">
      <Motion.section {...fadeUp} className="text-center">
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
      </Motion.section>

      {isError && (
        <Motion.section
          {...fadeUp}
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error?.response?.data?.message || error?.message || "Failed to load classes"}
        </Motion.section>
      )}

      <Motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={`class-skel-${index}`} />
            ))
          : filteredClasses.map((classItem) => {
              const statusLabel = toStatusLabel(classItem);
              const canEnrollFull =
                (!classItem.isFull || classItem.isEnrolled) &&
                classItem.assignedSubjects.length > 0 &&
                !classItem.isFullyPaid;
              const statusBadge =
                statusLabel === "Full"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : statusLabel === "Expired"
                  ? "bg-slate-100 text-slate-600 border-slate-300"
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
                    <p>{classItem.shifts?.length || 0} shift(s)</p>
                    {statusLabel === "Upcoming" && classItem.daysUntilStart != null ? (
                      <p>{classItem.daysUntilStart} day(s) to start</p>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {classItem.assignedSubjects.slice(0, 3).map((subject) => (
                      <span
                        key={`${classItem.id}-${subject.subjectId}`}
                        className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600"
                      >
                        {subject.title || "Subject"}
                      </span>
                    ))}
                    {classItem.assignedSubjects.length > 3 ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600">
                        +{classItem.assignedSubjects.length - 3} more
                      </span>
                    ) : null}
                  </div>
                  {classItem.isPartiallyEnrolled ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                      You already paid for {classItem.paidCoursesCount} subject(s). Remaining:
                      <span className="ml-1 font-semibold">
                        PKR {toNumber(classItem.remainingPrice, 0).toLocaleString("en-PK")}
                      </span>
                    </div>
                  ) : null}
                  <div className="mt-4 space-y-2">
                    <button
                      className={`w-full rounded-full px-4 py-2 text-sm font-semibold ${
                        classItem.isFull && !classItem.isEnrolled
                          ? "cursor-not-allowed bg-slate-200 text-slate-500"
                          : classItem.isFullyPaid
                          ? "bg-emerald-500 text-white"
                          : canEnrollFull
                          ? "bg-primary text-white"
                          : "cursor-not-allowed bg-slate-200 text-slate-500"
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        goToCheckout({ classItem });
                      }}
                      disabled={!canEnrollFull}
                    >
                      {classItem.isFull && !classItem.isEnrolled
                        ? "Class Full"
                        : classItem.isFullyPaid
                        ? "Fully Enrolled"
                        : classItem.isPartiallyEnrolled
                        ? `Complete Enrollment — PKR ${toNumber(
                            classItem.remainingPrice,
                            0
                          ).toLocaleString("en-PK")}`
                        : `Enroll Full Class - PKR ${toNumber(classItem.totalPrice, 0).toLocaleString("en-PK")}`}
                    </button>
                    <button
                      className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedClass(classItem);
                      }}
                    >
                      Choose Individual Subject
                    </button>
                    <p className="text-[11px] text-slate-500">
                      Paid subjects: {classItem.paidCoursesCount}/{classItem.assignedSubjects.length}
                    </p>
                    {classItem.isPartiallyEnrolled ? (
                      <p className="text-[11px] text-slate-500">
                        <span className="line-through">
                          PKR {toNumber(classItem.totalPrice, 0).toLocaleString("en-PK")}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
      </Motion.section>

      {!isLoading && filteredClasses.length === 0 && (
        <Motion.section
          {...fadeUp}
          className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500"
        >
          No classes found.
        </Motion.section>
      )}

      <AnimatePresence>
        {selectedClass ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
            <button
              className="absolute inset-0 bg-slate-900/50"
              onClick={() => setSelectedClass(null)}
              aria-label="Close class detail modal"
            />
            <Motion.div
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
                  <p className="text-sm font-semibold text-slate-900">Assigned Subjects</p>
                {selectedClass.assignedSubjects.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {selectedClass.assignedSubjects.map((course) => (
                      <div
                        key={`${selectedClass.id}-${course.subjectId}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                      >
                        <p className="font-semibold">{course.title || "Subject"}</p>
                        <p className="text-xs text-slate-500">
                          {course.teacherName || "Teacher"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No subjects assigned yet.</p>
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
                <button
                  className={`rounded-full px-5 py-2 text-sm font-semibold ${
                    (selectedClass.isFull && !selectedClass.isEnrolled) ||
                    selectedClass.isFullyPaid
                      ? "cursor-not-allowed bg-slate-200 text-slate-500"
                      : "bg-primary text-white"
                  }`}
                  onClick={() => goToCheckout({ classItem: selectedClass })}
                  disabled={
                    (selectedClass.isFull && !selectedClass.isEnrolled) ||
                    selectedClass.isFullyPaid
                  }
                >
                  {selectedClass.isFull && !selectedClass.isEnrolled
                    ? "Class Full"
                    : selectedClass.isFullyPaid
                    ? "Fully Enrolled"
                    : selectedClass.isPartiallyEnrolled
                    ? `Complete Enrollment — PKR ${toNumber(
                        selectedClass.remainingPrice,
                        0
                      ).toLocaleString("en-PK")}`
                    : `Enroll Full Class - PKR ${toNumber(selectedClass.totalPrice, 0).toLocaleString("en-PK")}`}
                </button>
              </div>
            </Motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default StudentExploreCourses;
