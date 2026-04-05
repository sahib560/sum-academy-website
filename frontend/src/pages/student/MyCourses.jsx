import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion as Motion } from "framer-motion";
import { Link } from "react-router-dom";
import { SkeletonCard } from "../../components/Skeleton.jsx";
import {
  getStudentCourses,
  getStudentDashboard,
} from "../../services/student.service.js";

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
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["student-courses"],
    queryFn: () => getStudentCourses(),
    staleTime: 30000,
  });
  const { data: dashboardData } = useQuery({
    queryKey: ["student-dashboard-access"],
    queryFn: () => getStudentDashboard(),
    staleTime: 30000,
  });

  const courses = useMemo(() => (Array.isArray(data) ? data : []), [data]);
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

  const groupedByClass = useMemo(() => {
    const map = new Map();
    courses.forEach((course, index) => {
      const classId = course.classId || `class-${index}`;
      const className = course.className || "Class";
      const batchCode = course.batchCode || "No batch";
      const key = `${classId}_${batchCode}_${className}`;
      const current = map.get(key) || {
        key,
        classId,
        className,
        batchCode,
        courses: [],
      };
      current.courses.push({
        id: course.id || `${classId}_${course.courseId || index}`,
        courseId: course.courseId || "",
        title: course.title || "Course",
        teacherName: course.teacherName || "Teacher",
        thumbnail: course.thumbnail || null,
        subjects: Array.isArray(course.subjects) ? course.subjects : [],
        progress: Math.max(0, Math.min(100, toNumber(course.progress, 0))),
        classLocked: Boolean(course.classLocked),
      });
      map.set(key, current);
    });
    return Array.from(map.values());
  }, [courses]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groupedByClass;
    return groupedByClass
      .map((group) => ({
        ...group,
        courses: group.courses.filter(
          (course) =>
            course.title.toLowerCase().includes(query) ||
            course.teacherName.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.courses.length > 0);
  }, [groupedByClass, search]);

  return (
    <div className="space-y-6">
      <Motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">My Courses</h1>
        <p className="mt-1 text-sm text-slate-500">
          Courses are grouped by your enrolled classes.
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
      filteredGroups.length < 1 ? (
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

      <div className="space-y-6">
        {isLoading
          ? Array.from({ length: 2 }).map((_, groupIndex) => (
              <Motion.section key={`group-skel-${groupIndex}`} {...fadeUp} className="space-y-4">
                <div className="h-8 w-60 rounded-xl bg-slate-100" />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }).map((__, cardIndex) => (
                    <SkeletonCard key={`card-skel-${groupIndex}-${cardIndex}`} />
                  ))}
                </div>
              </Motion.section>
            ))
          : filteredGroups.map((group) => (
              <Motion.section key={group.key} {...fadeUp} className="space-y-4">
                <h2 className="font-heading text-2xl text-slate-900">
                  {group.batchCode} - {group.className}
                </h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.courses.map((course) => {
                    const isCompleted = course.progress >= 100;
                    const isLocked = Boolean(course.classLocked);
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
                        {isLocked ? (
                          <p className="mt-2 text-xs font-semibold text-amber-700">
                            Class completed. Rewatch locked until teacher/admin unlocks.
                          </p>
                        ) : null}

                        <div className="mt-4">
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Motion.section>
            ))}
      </div>

      {!isLoading && filteredGroups.length === 0 && (
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
