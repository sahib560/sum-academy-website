import { useMemo, useState } from "react";
import { motion } from "framer-motion";

const categories = ["Science", "Biology", "Chemistry", "Physics", "English"];
const teachers = [
  "Mr. Sikander Ali Qureshi",
  "Mr. Shah Mohammad Pathan",
  "Mr. Mansoor Ahmed Mangi",
  "Mr. Muhammad Idress Mahar",
  "Mr. Waseem Ahmed Soomro",
];
const statuses = ["Published", "Draft", "Archived"];

const initialCourses = [
  {
    id: 1,
    title: "Class XI - Pre-Medical",
    category: "Science",
    status: "Published",
    teacher: "Mr. Sikander Ali Qureshi",
    enrolled: 420,
    price: 3500,
  },
  {
    id: 2,
    title: "Class XII - Pre-Medical",
    category: "Biology",
    status: "Published",
    teacher: "Mr. Shah Mohammad Pathan",
    enrolled: 380,
    price: 3800,
  },
  {
    id: 3,
    title: "Pre-Entrance Test",
    category: "Physics",
    status: "Draft",
    teacher: "Mr. Muhammad Idress Mahar",
    enrolled: 310,
    price: 4200,
  },
  {
    id: 4,
    title: "Chemistry Lab Workshop",
    category: "Chemistry",
    status: "Archived",
    teacher: "Mr. Mansoor Ahmed Mangi",
    enrolled: 190,
    price: 3000,
  },
];

const statusStyles = {
  Published: "bg-emerald-50 text-emerald-600",
  Draft: "bg-amber-50 text-amber-600",
  Archived: "bg-slate-100 text-slate-500",
};

const categoryColors = {
  Science: "bg-primary/15",
  Biology: "bg-emerald-100",
  Chemistry: "bg-amber-100",
  Physics: "bg-purple-100",
  English: "bg-blue-100",
};

function Courses() {
  const [courses, setCourses] = useState(initialCourses);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [teacherFilter, setTeacherFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDelete, setShowDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    id: null,
    title: "",
    description: "",
    category: categories[0],
    teacher: teachers[0],
    price: "",
    status: "Published",
  });

  useMemo(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useMemo(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesSearch =
        !query || course.title.toLowerCase().includes(query);
      const matchesCategory =
        categoryFilter === "All" || course.category === categoryFilter;
      const matchesStatus =
        statusFilter === "All" || course.status === statusFilter;
      const matchesTeacher =
        teacherFilter === "All" || course.teacher === teacherFilter;
      return matchesSearch && matchesCategory && matchesStatus && matchesTeacher;
    });
  }, [categoryFilter, courses, search, statusFilter, teacherFilter]);

  const stats = {
    total: courses.length,
    published: courses.filter((c) => c.status === "Published").length,
    draft: courses.filter((c) => c.status === "Draft").length,
    archived: courses.filter((c) => c.status === "Archived").length,
  };

  const openAdd = () => {
    setForm({
      id: null,
      title: "",
      description: "",
      category: categories[0],
      teacher: teachers[0],
      price: "",
      status: "Published",
    });
    setShowModal(true);
  };

  const openEdit = (course) => {
    setForm({
      id: course.id,
      title: course.title,
      description: course.description || "",
      category: course.category,
      teacher: course.teacher,
      price: course.price,
      status: course.status,
    });
    setShowModal(true);
  };

  const handleSave = (event) => {
    event.preventDefault();
    if (!form.title || !form.price) {
      setToast({ type: "error", message: "Fill required fields." });
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      if (form.id) {
        setCourses((prev) =>
          prev.map((course) =>
            course.id === form.id
              ? { ...course, ...form, price: Number(form.price) }
              : course
          )
        );
        setToast({ type: "success", message: "Course updated." });
      } else {
        setCourses((prev) => [
          {
            ...form,
            id: Date.now(),
            enrolled: 0,
            price: Number(form.price),
          },
          ...prev,
        ]);
        setToast({ type: "success", message: "Course added." });
      }
      setShowModal(false);
    }, 900);
  };

  const handleDelete = () => {
    setCourses((prev) => prev.filter((course) => course.id !== showDelete.id));
    setToast({ type: "success", message: "Course deleted." });
    setShowDelete(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Courses</h2>
          <p className="text-sm text-slate-500">
            Manage courses, categories, and publishing status.
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          Add Course
        </button>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
          Total: {stats.total}
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-600">
          Published: {stats.published}
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-600">
          Draft: {stats.draft}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">
          Archived: {stats.archived}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search courses..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          <option value="All">Category: All</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          <option value="All">Status: All</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={teacherFilter}
          onChange={(event) => setTeacherFilter(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          <option value="All">Teacher: All</option>
          {teachers.map((teacher) => (
            <option key={teacher} value={teacher}>
              {teacher}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`course-skeleton-${index}`} className="glass-card space-y-3">
              <div className="skeleton h-32 w-full" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-1/3" />
            </div>
          ))}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No courses found.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => (
            <div key={course.id} className="glass-card card-hover flex flex-col gap-4">
              <div
                className={`h-32 rounded-2xl ${
                  categoryColors[course.category] || "bg-slate-100"
                }`}
              />
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[course.status]}`}
              >
                {course.status}
              </span>
              <h3 className="font-heading text-xl text-slate-900">{course.title}</h3>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {course.teacher
                    .split(" ")
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{course.teacher}</p>
                  <p className="text-xs text-slate-500">{course.enrolled} students</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-primary">
                  PKR {course.price.toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-primary"
                    onClick={() => openEdit(course)}
                  >
                    ✎
                  </button>
                  <button className="rounded-full border border-slate-200 p-2 text-slate-500">
                    Archive
                  </button>
                  <button
                    className="rounded-full border border-slate-200 p-2 text-rose-500"
                    onClick={() => setShowDelete(course)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-heading text-2xl text-slate-900">
              {form.id ? "Edit Course" : "Add Course"}
            </h3>
            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <input
                type="text"
                placeholder="Course Title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <textarea
                rows={3}
                placeholder="Description"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={form.teacher}
                onChange={(event) => setForm({ ...form, teacher: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                {teachers.map((teacher) => (
                  <option key={teacher} value={teacher}>
                    {teacher}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Price (PKR)"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                Thumbnail upload placeholder
              </div>
              <button type="submit" className="btn-primary w-full" disabled={saving}>
                {saving ? "Saving..." : "Save Course"}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {showDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowDelete(null)}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-heading text-2xl text-slate-900">Delete course?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This action cannot be undone. Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-900">{showDelete.title}</span>?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm"
                onClick={() => setShowDelete(null)}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${
            toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default Courses;
