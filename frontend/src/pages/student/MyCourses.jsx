import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion as Motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { SkeletonCard } from "../../components/Skeleton.jsx";
import { getStudentDashboard } from "../../services/student.service.js";

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

function StudentMyCourses() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["student-dashboard-access"],
    queryFn: () => getStudentDashboard(),
    staleTime: 30000,
  });
  const pendingAccess = useMemo(() => {
    const access = dashboardData?.access || {};
    const hasPending = Boolean(access.hasPendingApproval);
    const pendingCount = Number(access.pendingApprovalCount || 0);
    return {
      hasPendingApproval: hasPending,
      pendingApprovalCount: Number.isFinite(pendingCount) ? pendingCount : 0,
      latestPendingPayment: access.latestPendingPayment || null,
    };
  }, [dashboardData]);

  const enrolledClasses = useMemo(() => {
    const rows = Array.isArray(dashboardData?.classes) ? dashboardData.classes : [];
    return rows.map((classRow, classIndex) => ({
      key: classRow.classId || classRow.id || `class-${classIndex}`,
      classId: classRow.classId || classRow.id || `class-${classIndex}`,
      className: classRow.name || "Class",
      batchCode: classRow.batchCode || "No batch",
      teacherName: classRow.teacherName || "Teacher",
      shiftId: classRow.shiftId || "",
      overallProgress: Math.max(0, Math.min(100, toNumber(classRow.overallProgress, 0))),
      paidCoursesCount: toNumber(classRow.paidCoursesCount, 0),
      totalCoursesCount: toNumber(
        classRow.totalCoursesCount,
        Array.isArray(classRow.courses) ? classRow.courses.length : 0
      ),
      lockedCoursesCount: toNumber(classRow.lockedCoursesCount, 0),
      isLockedAfterCompletion: Boolean(classRow.isLockedAfterCompletion),
      courses: (Array.isArray(classRow.courses) ? classRow.courses : []).map((course, index) => ({
        id: course.id || `${classRow.classId || classIndex}-${course.courseId || index}`,
        courseId: course.courseId || "",
        title: course.title || "Course",
        teacherName: course.teacherName || "Teacher",
        thumbnail: course.thumbnail || null,
        subjects: Array.isArray(course.subjects) ? course.subjects : [],
        progress: Math.max(0, Math.min(100, toNumber(course.progress, 0))),
        finalPrice: toNumber(course.finalPrice ?? course.price, 0),
        price: toNumber(course.price, 0),
        discountPercent: toNumber(course.discountPercent, 0),
        isPaymentLocked: Boolean(course.isPaymentLocked),
        classLocked: Boolean(course.classLocked),
      })),
    }));
  }, [dashboardData]);

  const filteredClasses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return enrolledClasses;
    return enrolledClasses
      .map((row) => {
        const classMatch =
          row.className.toLowerCase().includes(query) ||
          row.batchCode.toLowerCase().includes(query) ||
          row.teacherName.toLowerCase().includes(query);
        if (classMatch) return row;
        const courseMatches = row.courses.filter(
          (course) =>
            course.title.toLowerCase().includes(query) ||
            course.teacherName.toLowerCase().includes(query)
        );
        if (!courseMatches.length) return null;
        return { ...row, courses: courseMatches };
      })
      .filter(Boolean);
  }, [enrolledClasses, search]);

  const activeClassId =
    filteredClasses.find((row) => row.classId === selectedClassId)?.classId ||
    filteredClasses[0]?.classId ||
    "";

  const activeClass = filteredClasses.find((row) => row.classId === activeClassId) || null;

  const activeCourses = Array.isArray(activeClass?.courses) ? activeClass.courses : [];

  return (
    <div className="space-y-6">
      <Motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">My Classes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Click a class to view all courses assigned inside it.
        </p>
      </Motion.section>

      <Motion.section {...fadeUp}>
        <input
          type="text"
          placeholder="Search courses..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </Motion.section>

      {!isLoading &&
      pendingAccess.hasPendingApproval &&
      filteredClasses.length < 1 ? (
        <Motion.section
          {...fadeUp}
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          <p className="font-semibold">Waiting For Admin Approval</p>
          <p className="mt-1">
            We received your payment receipt. Courses and learning content will appear here after admin approval.
          </p>
          {pendingAccess.latestPendingPayment?.reference ? (
            <p className="mt-2 text-xs text-amber-700">
              Reference: {pendingAccess.latestPendingPayment.reference}
            </p>
          ) : null}
        </Motion.section>
      ) : null}

      <div className="space-y-5">
        <Motion.section {...fadeUp}>
          <h2 className="mb-3 font-heading text-xl text-slate-900">Enrolled Classes</h2>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonCard key={`class-skel-${index}`} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredClasses.map((group) => {
                const isActive = activeClassId === group.classId;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setSelectedClassId(group.classId)}
                    className={`rounded-3xl border p-5 text-left shadow-sm transition ${
                      isActive
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-slate-200 bg-white hover:border-primary/40"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {group.batchCode}
                    </p>
                    <h3 className="mt-1 font-heading text-xl text-slate-900">{group.className}</h3>
                    <p className="mt-1 text-sm text-slate-500">{group.teacherName}</p>
                    <p className="mt-3 text-xs text-slate-600">
                      Paid courses: {group.paidCoursesCount}/{group.totalCoursesCount}
                    </p>
                    {group.lockedCoursesCount > 0 ? (
                      <p className="mt-1 text-[11px] font-semibold text-amber-700">
                        {group.lockedCoursesCount} course(s) locked
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <div className="h-2 w-28 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${group.overallProgress}%` }}
                        />
                      </div>
                      {Math.round(group.overallProgress)}%
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Motion.section>

        {!isLoading && activeClass ? (
          <Motion.section key={activeClass.classId} {...fadeUp} className="space-y-4">
            <h2 className="font-heading text-2xl text-slate-900">
              {activeClass.batchCode} - {activeClass.className}
            </h2>
            <p className="text-sm text-slate-500">
              {activeClass.courses.length} course(s) in this class
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {activeCourses.map((course) => {
                const isCompleted = course.progress >= 100;
                const isLocked = Boolean(course.classLocked);
                const isPaymentLocked = Boolean(course.isPaymentLocked);
                return (
                  <div
                    key={course.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="h-24 overflow-hidden rounded-2xl bg-slate-100">
                      {course.thumbnail ? (
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-xs font-semibold text-slate-500">
                          Course
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
                    <p className="text-sm text-slate-500">{course.teacherName}</p>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {course.subjects.slice(0, 2).map((subject, index) => (
                        <span
                          key={`${course.id}-subject-${index}`}
                          className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600"
                        >
                          {subject?.name || "Subject"}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <div className="h-2 w-28 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                      {Math.round(course.progress)}%
                    </div>
                    {isPaymentLocked ? (
                      <p className="mt-2 text-xs font-semibold text-rose-700">
                        Not included in your enrollment - PKR {course.finalPrice.toLocaleString("en-PK")}
                      </p>
                    ) : null}
                    {isLocked ? (
                      <p className="mt-2 text-xs font-semibold text-amber-700">
                        Class completed. Rewatch locked until teacher/admin unlocks.
                      </p>
                    ) : null}

                    <div className="mt-4">
                      {isPaymentLocked ? (
                        <button
                          className="btn-primary w-full"
                          onClick={() =>
                            navigate("/student/checkout", {
                              state: {
                                enrollmentType: "single_course",
                                classInfo: {
                                  id: activeClass.classId,
                                  name: activeClass.className,
                                  batchCode: activeClass.batchCode,
                                  totalPrice: 0,
                                  assignedCourses: activeClass.courses,
                                },
                                course: {
                                  id: course.courseId,
                                  title: course.title,
                                  price: course.price || course.finalPrice,
                                  originalPrice: course.price || course.finalPrice,
                                  discountPercent: course.discountPercent || 0,
                                  discountedPrice: course.finalPrice,
                                  finalPrice: course.finalPrice,
                                },
                                prefillClassId: activeClass.classId,
                                prefillShiftId: activeClass.shiftId || "",
                              },
                            })
                          }
                        >
                          Buy Now
                        </button>
                      ) : (
                        <Link
                          className={`w-full rounded-full px-4 py-2 text-center text-sm font-semibold ${
                            isLocked
                              ? "cursor-not-allowed bg-slate-200 text-slate-500"
                              : "btn-primary"
                          }`}
                          to={
                            isLocked
                              ? "#"
                              : `/student/courses/${course.courseId || course.id}/player`
                          }
                          onClick={(event) => {
                            if (!isLocked) return;
                            event.preventDefault();
                          }}
                        >
                          {isLocked ? "Locked" : isCompleted ? "Review" : "Continue"}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Motion.section>
        ) : null}

      </div>

      {!isLoading && filteredClasses.length === 0 && (
        <Motion.section
          {...fadeUp}
          className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center"
        >
          <p className="text-sm text-slate-500">No courses found for your classes.</p>
          <Link
            className="btn-outline mt-4 inline-flex items-center justify-center"
            to="/student/explore"
          >
            Explore Classes
          </Link>
        </Motion.section>
      )}
    </div>
  );
}

export default StudentMyCourses;
