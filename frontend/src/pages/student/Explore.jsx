import { useState } from "react";
import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const categories = ["All", "Biology", "Chemistry", "Physics", "English"];

const courses = [
  {
    id: 1,
    title: "Advanced Biology MCQs",
    teacher: "Mr. Sikander Ali Qureshi",
    price: 2500,
    category: "Biology",
  },
  {
    id: 2,
    title: "Organic Chemistry Drill",
    teacher: "Mr. Mansoor Ahmed Mangi",
    price: 2200,
    category: "Chemistry",
  },
  {
    id: 3,
    title: "Physics Numericals",
    teacher: "Mr. Muhammad Idress Mahar",
    price: 2000,
    category: "Physics",
  },
  {
    id: 4,
    title: "English Grammar Bootcamp",
    teacher: "Mr. Waseem Ahmed Soomro",
    price: 1800,
    category: "English",
  },
];

function StudentExplore() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = courses.filter((course) => {
    const matchesCategory = category === "All" || course.category === category;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || course.title.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Explore Courses</h1>
        <p className="text-sm text-slate-500">
          Discover new courses tailored to your interests.
        </p>
      </motion.section>

      <motion.section {...fadeUp} className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search courses..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {categories.map((item) => (
          <button
            key={item}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
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

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((course) => (
          <div
            key={course.id}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="h-24 rounded-2xl bg-slate-100" />
            <h3 className="mt-4 font-heading text-lg text-slate-900">
              {course.title}
            </h3>
            <p className="text-sm text-slate-500">{course.teacher}</p>
            <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                {course.category}
              </span>
              <span>PKR {course.price}</span>
            </div>
            <button className="btn-primary mt-4 w-full">Enroll Now</button>
          </div>
        ))}
      </motion.section>
    </div>
  );
}

export default StudentExplore;
