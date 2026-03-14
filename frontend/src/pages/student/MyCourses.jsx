import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Skeleton, SkeletonCard } from "../../components/Skeleton.jsx";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const courses = [
  {
    id: 1,
    title: "Biology Masterclass XI",
    teacher: "Mr. Sikander Ali Qureshi",
    status: "In Progress",
    progress: 62,
    category: "Biology",
    lastAccessed: "2 days ago",
  },
  {
    id: 2,
    title: "Chemistry Quick Revision",
    teacher: "Mr. Mansoor Ahmed Mangi",
    status: "Completed",
    progress: 100,
    category: "Chemistry",
    lastAccessed: "5 days ago",
  },
  {
    id: 3,
    title: "Physics Practice Lab",
    teacher: "Mr. Muhammad Idress Mahar",
    status: "Locked",
    progress: 0,
    category: "Physics",
    lastAccessed: "Not started",
  },
  {
    id: 4,
    title: "English Essay Clinic",
    teacher: "Mr. Waseem Ahmed Soomro",
    status: "In Progress",
    progress: 44,
    category: "English",
    lastAccessed: "Today",
  },
  {
    id: 5,
    title: "Entrance Test Sprint",
    teacher: "Mr. Shah Mohammad Pathan",
    status: "In Progress",
    progress: 76,
    category: "Biology",
    lastAccessed: "3 days ago",
  },
  {
    id: 6,
    title: "Pre-Medical Crash Course",
    teacher: "Mr. Mansoor Ahmed Mangi",
    status: "Locked",
    progress: 0,
    category: "Chemistry",
    lastAccessed: "Not started",
  },
];

const statusStyles = {
  "In Progress": "bg-blue-50 text-blue-600",
  Completed: "bg-emerald-50 text-emerald-600",
  Locked: "bg-slate-100 text-slate-500",
};

const categoryStyles = {
  Biology: "from-emerald-400/70 to-emerald-100",
  Chemistry: "from-blue-500/70 to-blue-100",
  Physics: "from-violet-500/70 to-violet-100",
  English: "from-orange-400/70 to-orange-100",
};

const filters = ["All", "In Progress", "Completed", "Locked"];
const sortOptions = [
  "Recently Accessed",
  "Progress",
  "Name",
  "Enrolled Date",
];

function StudentMyCourses() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("Recently Accessed");

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const counts = useMemo(() => {
    return {
      All: courses.length,
      "In Progress": courses.filter((c) => c.status === "In Progress").length,
      Completed: courses.filter((c) => c.status === "Completed").length,
      Locked: courses.filter((c) => c.status === "Locked").length,
    };
  }, []);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = courses.filter((course) => {
      const matchesTab =
        activeTab === "All" || course.status === activeTab;
      const matchesSearch =
        !query || course.title.toLowerCase().includes(query);
      return matchesTab && matchesSearch;
    });

    if (sortBy === "Progress") {
      list = list.sort((a, b) => b.progress - a.progress);
    } else if (sortBy === "Name") {
      list = list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [activeTab, search, sortBy]);

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">My Courses</h1>
      </motion.section>

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={`stat-${index}`} className="glass-card border border-slate-200">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-4 h-8 w-1/2" />
              </div>
            ))
          : [
              { label: "Enrolled", value: counts.All },
              { label: "In Progress", value: counts["In Progress"] },
              { label: "Completed", value: counts.Completed },
            ].map((card) => (
              <div key={card.label} className="glass-card border border-slate-200">
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {card.value}
                </p>
              </div>
            ))}
      </motion.section>

      <motion.section {...fadeUp} className="flex flex-wrap items-center gap-3">
        {filters.map((tab) => (
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

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={`course-skel-${index}`} />
            ))
          : filteredCourses.map((course) => (
              <div
                key={course.id}
                className="relative rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div
                  className={`h-24 rounded-2xl bg-gradient-to-br ${
                    categoryStyles[course.category] || "from-slate-300 to-slate-100"
                  }`}
                />
                <span
                  className={`absolute right-6 top-6 rounded-full px-3 py-1 text-xs font-semibold ${
                    statusStyles[course.status]
                  }`}
                >
                  {course.status}
                </span>
                <h3 className="mt-4 font-heading text-lg text-slate-900">
                  {course.title}
                </h3>
                <p className="text-sm text-slate-500">{course.teacher}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <div className="h-2 w-28 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                  {course.progress}%
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Accessed {course.lastAccessed}
                </p>
                <div className="mt-4">
                  {course.status === "Locked" ? (
                    <button
                      className="w-full rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400"
                      disabled
                      title="Your access has been locked. Contact your teacher."
                    >
                      Locked
                    </button>
                  ) : course.status === "Completed" ? (
                    <button className="w-full rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                      View Certificate
                    </button>
                  ) : (
                    <Link className="btn-primary w-full text-center" to="/student/course-player">
                      Continue Learning
                    </Link>
                  )}
                </div>
              </div>
            ))}
      </motion.section>

      {!loading && filteredCourses.length === 0 && (
        <motion.section {...fadeUp} className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No courses found in this tab yet.
        </motion.section>
      )}
    </div>
  );
}

export default StudentMyCourses;
