import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Skeleton, SkeletonCard } from "../../components/Skeleton.jsx";
import { getStudentCourses } from "../../services/student.service.js";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const tabs = ["All", "In Progress", "Completed"];

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return "N/A";
  return parsed.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function StudentMyCourses() {
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["student-courses"],
    queryFn: () => getStudentCourses(),
    staleTime: 30000,
  });

  const courses = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const normalizedCourses = useMemo(
    () =>
      courses.map((course, index) => {
        const progress = Math.max(0, Math.min(100, toNumber(course.progress, 0)));
        const isCompleted = Boolean(course.isCompleted) || progress >= 100;
        return {
          id: course.id || course.courseId || `course-${index}`,
          title: course.title || "Course",
          teacherName: course.teacherName || "Teacher",
          thumbnail: course.thumbnail || null,
          progress,
          status: isCompleted ? "Completed" : "In Progress",
          lastAccessed:
            course.lastAccessedAt ||
            course.lastAccessed ||
            course.updatedAt ||
            course.completedAt ||
            null,
        };
      }),
    [courses]
  );

  const counts = useMemo(
    () => ({
      All: normalizedCourses.length,
      "In Progress": normalizedCourses.filter((item) => item.status === "In Progress")
        .length,
      Completed: normalizedCourses.filter((item) => item.status === "Completed").length,
    }),
    [normalizedCourses]
  );

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return normalizedCourses.filter((course) => {
      const tabMatch = activeTab === "All" || course.status === activeTab;
      const searchMatch =
        !query ||
        course.title.toLowerCase().includes(query) ||
        course.teacherName.toLowerCase().includes(query);
      return tabMatch && searchMatch;
    });
  }, [activeTab, normalizedCourses, search]);

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">My Courses</h1>
      </motion.section>

      <motion.section {...fadeUp} className="flex flex-wrap items-center gap-3">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              activeTab === tab
                ? "bg-primary text-white"
                : "border border-slate-200 text-slate-600"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
              {counts[tab]}
            </span>
          </button>
        ))}
        <input
          type="text"
          placeholder="Search courses..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </motion.section>

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={`course-skel-${index}`} />
            ))
          : filteredCourses.map((course) => {
              const isCompleted = course.status === "Completed";
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

                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <div className="h-2 w-28 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                    {Math.round(course.progress)}%
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span
                      className={`rounded-full px-3 py-1 font-semibold ${
                        isCompleted
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {course.status}
                    </span>
                    <span className="text-slate-400">
                      Last accessed {formatDate(course.lastAccessed)}
                    </span>
                  </div>

                  <div className="mt-4">
                    {isCompleted ? (
                      <Link
                        className="w-full rounded-full border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600"
                        to="/student/certificates"
                      >
                        View Certificate
                      </Link>
                    ) : (
                      <Link
                        className="btn-primary w-full text-center"
                        to={`/student/courses/${course.id}/player`}
                      >
                        Continue Learning
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
      </motion.section>

      {!isLoading && normalizedCourses.length === 0 && (
        <motion.section
          {...fadeUp}
          className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center"
        >
          <p className="text-sm text-slate-500">No courses enrolled yet</p>
          <Link
            className="btn-outline mt-4 inline-flex items-center justify-center"
            to="/student/explore"
          >
            Explore Courses
          </Link>
        </motion.section>
      )}

      {!isLoading &&
        normalizedCourses.length > 0 &&
        filteredCourses.length === 0 && (
          <motion.section
            {...fadeUp}
            className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500"
          >
            No courses found for this filter.
          </motion.section>
        )}

      {isLoading && (
        <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`meta-${index}`} className="rounded-2xl border border-slate-200 p-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-3 h-6 w-1/3" />
            </div>
          ))}
        </motion.section>
      )}
    </div>
  );
}

export default StudentMyCourses;
