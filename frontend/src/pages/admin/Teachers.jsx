import { useMemo, useState } from "react";
import { motion } from "framer-motion";

const subjects = ["Biology", "Chemistry", "Physics", "English", "Botany"];
const allCourses = [
  "Class XI - Pre-Medical",
  "Class XII - Pre-Medical",
  "Pre-Entrance Test",
  "Chemistry Lab Workshop",
  "English Fluency",
];

const initialTeachers = [
  {
    id: 1,
    name: "Mr. Sikander Ali Qureshi",
    email: "sikander@sumacademy.pk",
    subject: "Chemistry",
    bio: "Founder & Director with a focus on conceptual clarity.",
    courses: ["Class XI - Pre-Medical", "Chemistry Lab Workshop"],
    classes: ["Class XI", "Class XII"],
    students: 620,
    rating: 4.9,
    status: "Active",
    revenue: 2200000,
  },
  {
    id: 2,
    name: "Mr. Shah Mohammad Pathan",
    email: "shah.pathan@sumacademy.pk",
    subject: "Botany",
    bio: "Associate Professor of Botany.",
    courses: ["Class XII - Pre-Medical"],
    classes: ["Class XII"],
    students: 480,
    rating: 4.8,
    status: "Active",
    revenue: 1800000,
  },
  {
    id: 3,
    name: "Mr. Mansoor Ahmed Mangi",
    email: "mansoor.mangi@sumacademy.pk",
    subject: "Chemistry",
    bio: "Lecturer Chemistry with exam-focused modules.",
    courses: ["Pre-Entrance Test"],
    classes: ["Class XI"],
    students: 360,
    rating: 4.6,
    status: "Inactive",
    revenue: 1200000,
  },
  {
    id: 4,
    name: "Mr. Muhammad Idress Mahar",
    email: "idress.mahar@sumacademy.pk",
    subject: "Physics",
    bio: "Lecturer Physics with practical problem-solving focus.",
    courses: ["Pre-Entrance Test", "Class XI - Pre-Medical"],
    classes: ["Class XI", "Class XII"],
    students: 510,
    rating: 4.7,
    status: "Active",
    revenue: 1500000,
  },
  {
    id: 5,
    name: "Mr. Waseem Ahmed Soomro",
    email: "waseem.soomro@sumacademy.pk",
    subject: "English",
    bio: "Lecturer English specializing in fluency and writing.",
    courses: ["English Fluency"],
    classes: ["Class XI"],
    students: 290,
    rating: 4.5,
    status: "Active",
    revenue: 780000,
  },
];

function Teachers() {
  const [teachers, setTeachers] = useState(initialTeachers);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(null);
  const [detailTeacher, setDetailTeacher] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    id: null,
    name: "",
    email: "",
    password: "",
    subject: subjects[0],
    bio: "",
    courses: [],
    status: "Active",
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

  const filteredTeachers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return teachers.filter((teacher) => {
      const matchesSearch =
        !query ||
        teacher.name.toLowerCase().includes(query) ||
        teacher.email.toLowerCase().includes(query);
      const matchesSubject =
        subjectFilter === "All" || teacher.subject === subjectFilter;
      const matchesStatus =
        statusFilter === "All" || teacher.status === statusFilter;
      return matchesSearch && matchesSubject && matchesStatus;
    });
  }, [search, statusFilter, subjectFilter, teachers]);

  const stats = {
    total: teachers.length,
    active: teachers.filter((teacher) => teacher.status === "Active").length,
    courses: teachers.reduce((sum, teacher) => sum + teacher.courses.length, 0),
  };

  const openAdd = () => {
    setForm({
      id: null,
      name: "",
      email: "",
      password: "",
      subject: subjects[0],
      bio: "",
      courses: [],
      status: "Active",
    });
    setShowModal(true);
  };

  const openEdit = (teacher) => {
    setForm({ ...teacher, password: "" });
    setShowModal(true);
  };

  const handleSave = (event) => {
    event.preventDefault();
    if (!form.name || !form.email) {
      setToast({ type: "error", message: "Fill required fields." });
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      if (form.id) {
        setTeachers((prev) =>
          prev.map((teacher) =>
            teacher.id === form.id ? { ...teacher, ...form } : teacher
          )
        );
        setToast({ type: "success", message: "Teacher updated." });
      } else {
        setTeachers((prev) => [
          {
            ...form,
            id: Date.now(),
            courses: form.courses,
            classes: ["Class XI"],
            students: 0,
            rating: 4.5,
            revenue: 0,
          },
          ...prev,
        ]);
        setToast({ type: "success", message: "Teacher added." });
      }
      setShowModal(false);
    }, 900);
  };

  const handleDeactivate = () => {
    setTeachers((prev) =>
      prev.map((teacher) =>
        teacher.id === showDeactivate.id
          ? {
              ...teacher,
              status: teacher.status === "Active" ? "Inactive" : "Active",
            }
          : teacher
      )
    );
    setToast({ type: "success", message: "Status updated." });
    setShowDeactivate(null);
  };

  const toggleCourseSelection = (course) => {
    setForm((prev) => ({
      ...prev,
      courses: prev.courses.includes(course)
        ? prev.courses.filter((item) => item !== course)
        : [...prev.courses, course],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Teachers</h2>
          <p className="text-sm text-slate-500">
            Manage teacher profiles and assignments.
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          Add Teacher
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={`stat-${index}`} className="glass-card space-y-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-6 w-1/2" />
              </div>
            ))
          : [
              { label: "Total Teachers", value: stats.total },
              { label: "Active Teachers", value: stats.active },
              { label: "Total Courses", value: stats.courses },
            ].map((item) => (
              <div key={item.label} className="glass-card">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search teacher..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <select
          value={subjectFilter}
          onChange={(event) => setSubjectFilter(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          <option value="All">Subject: All</option>
          {subjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          <option value="All">Status: All</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`teacher-skeleton-${index}`} className="glass-card space-y-3">
              <div className="skeleton h-24 w-full" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No teachers found.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTeachers.map((teacher) => {
            const initials = teacher.name
              .split(" ")
              .slice(0, 2)
              .map((word) => word[0])
              .join("");
            return (
              <div key={teacher.id} className="glass-card card-hover flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {initials}
                    <span
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                        teacher.status === "Active" ? "bg-emerald-400" : "bg-slate-300"
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg text-slate-900">
                      {teacher.name}
                    </h3>
                    <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {teacher.subject}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                  <span>{teacher.courses.length} Courses</span>
                  <span>{teacher.students} Students</span>
                  <span>⭐ {teacher.rating}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      teacher.status === "Active"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {teacher.status}
                  </span>
                  <div className="flex gap-2">
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                      onClick={() => openEdit(teacher)}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                      onClick={() => setDetailTeacher(teacher)}
                    >
                      View Courses
                    </button>
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                      onClick={() => setShowDeactivate(teacher)}
                    >
                      {teacher.status === "Active" ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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
              {form.id ? "Edit Teacher" : "Add Teacher"}
            </h3>
            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              {!form.id && (
                <input
                  type="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={(event) =>
                    setForm({ ...form, password: event.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              )}
              <input
                type="text"
                placeholder="Subject / Expertise"
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <textarea
                rows={3}
                placeholder="Bio"
                value={form.bio}
                onChange={(event) => setForm({ ...form, bio: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                Profile photo upload placeholder
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Assigned Courses</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {allCourses.map((course) => (
                    <label key={course} className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={form.courses.includes(course)}
                        onChange={() => toggleCourseSelection(course)}
                      />
                      {course}
                    </label>
                  ))}
                </div>
              </div>
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <button type="submit" className="btn-primary w-full" disabled={saving}>
                {saving ? "Saving..." : "Save Teacher"}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {showDeactivate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowDeactivate(null)}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-heading text-2xl text-slate-900">
              {showDeactivate.status === "Active" ? "Deactivate" : "Activate"} teacher?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to{" "}
              {showDeactivate.status === "Active" ? "deactivate" : "activate"}{" "}
              <span className="font-semibold text-slate-900">{showDeactivate.name}</span>?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm"
                onClick={() => setShowDeactivate(null)}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={handleDeactivate}>
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {detailTeacher && (
        <div className="fixed inset-0 z-[60] flex items-start justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setDetailTeacher(null)}
          />
          <motion.aside
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="relative h-full w-full max-w-md bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-2xl text-slate-900">Teacher Profile</h3>
              <button
                className="rounded-full border border-slate-200 p-2 text-slate-500"
                onClick={() => setDetailTeacher(null)}
              >
                x
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <p className="font-semibold text-slate-900">{detailTeacher.name}</p>
              <p className="text-sm text-slate-600">{detailTeacher.subject}</p>
              <p className="text-sm text-slate-500">{detailTeacher.bio}</p>
            </div>
            <div className="mt-6 space-y-4">
              <div>
                <p className="text-xs uppercase text-slate-400">Courses</p>
                <div className="mt-2 space-y-2">
                  {detailTeacher.courses.map((course) => (
                    <div key={course} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      {course}
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-600">
                        Published
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Classes</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detailTeacher.classes.map((item) => (
                    <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Total Students</span>
                <span className="font-semibold text-slate-900">{detailTeacher.students}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Revenue Generated</span>
                <span className="font-semibold text-slate-900">
                  PKR {detailTeacher.revenue.toLocaleString()}
                </span>
              </div>
            </div>
          </motion.aside>
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

export default Teachers;
