import { useMemo, useState } from "react";
import { motion } from "framer-motion";

const initialStudents = [
  {
    id: 1,
    name: "Hassan Ali",
    email: "hassan.ali@sumacademy.pk",
    phone: "+92 300 111 2233",
    courses: [
      { name: "Class XI - Pre-Medical", progress: 78 },
      { name: "Pre-Entrance Test", progress: 42 },
    ],
    joined: "Jan 15, 2026",
    lastActive: "Mar 12, 2026",
    status: "Active",
  },
  {
    id: 2,
    name: "Ayesha Noor",
    email: "ayesha.noor@sumacademy.pk",
    phone: "+92 300 223 4455",
    courses: [
      { name: "Class XII - Pre-Medical", progress: 55 },
      { name: "English Fluency", progress: 90 },
    ],
    joined: "Feb 02, 2026",
    lastActive: "Mar 11, 2026",
    status: "Active",
  },
  {
    id: 3,
    name: "Bilal Khan",
    email: "bilal.khan@sumacademy.pk",
    phone: "+92 300 334 5566",
    courses: [{ name: "Pre-Entrance Test", progress: 25 }],
    joined: "Jan 08, 2026",
    lastActive: "Mar 05, 2026",
    status: "Inactive",
  },
  {
    id: 4,
    name: "Sana Akbar",
    email: "sana.akbar@sumacademy.pk",
    phone: "+92 300 445 6677",
    courses: [{ name: "Class XI - Pre-Medical", progress: 62 }],
    joined: "Dec 12, 2025",
    lastActive: "Mar 02, 2026",
    status: "Active",
  },
  {
    id: 5,
    name: "Usman Raza",
    email: "usman.raza@sumacademy.pk",
    phone: "+92 300 556 7788",
    courses: [{ name: "Class XII - Pre-Medical", progress: 72 }],
    joined: "Nov 26, 2025",
    lastActive: "Mar 03, 2026",
    status: "Active",
  },
];

const payments = [
  { id: 1, amount: 3500, date: "Mar 12, 2026", method: "JazzCash" },
  { id: 2, amount: 4200, date: "Feb 15, 2026", method: "Bank Transfer" },
  { id: 3, amount: 3800, date: "Jan 18, 2026", method: "EasyPaisa" },
  { id: 4, amount: 3500, date: "Dec 20, 2025", method: "JazzCash" },
  { id: 5, amount: 4200, date: "Nov 30, 2025", method: "Bank Transfer" },
];

const certificates = ["Pre-Medical Excellence", "Entrance Test Mastery"];

function Students() {
  const [students, setStudents] = useState(initialStudents);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [courseFilter, setCourseFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [detailStudent, setDetailStudent] = useState(null);
  const [showDelete, setShowDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const perPage = 15;
  const [form, setForm] = useState({
    id: null,
    name: "",
    email: "",
    phone: "",
    password: "",
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

  const courseOptions = useMemo(() => {
    const courses = new Set();
    students.forEach((student) =>
      student.courses.forEach((course) => courses.add(course.name))
    );
    return Array.from(courses);
  }, [students]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return students.filter((student) => {
      const matchesSearch =
        !query ||
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "All" || student.status === statusFilter;
      const matchesCourse =
        courseFilter === "All" ||
        student.courses.some((course) => course.name === courseFilter);
      return matchesSearch && matchesStatus && matchesCourse;
    });
  }, [courseFilter, search, statusFilter, students]);

  const pageCount = Math.max(1, Math.ceil(filteredStudents.length / perPage));
  const paginated = filteredStudents.slice(
    (page - 1) * perPage,
    page * perPage
  );

  const stats = {
    total: students.length,
    active: students.filter((s) => s.status === "Active").length,
    avgCourses:
      students.reduce((sum, s) => sum + s.courses.length, 0) / students.length,
    completion: 84,
  };

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleAll = (checked) => {
    setSelected(checked ? paginated.map((s) => s.id) : []);
  };

  const bulkAction = (action) => {
    if (selected.length === 0) {
      setToast({ type: "error", message: "Select students first." });
      return;
    }
    if (action === "delete") {
      setStudents((prev) => prev.filter((s) => !selected.includes(s.id)));
      setSelected([]);
      setToast({ type: "success", message: "Students deleted." });
      return;
    }
    setStudents((prev) =>
      prev.map((s) =>
        selected.includes(s.id)
          ? { ...s, status: action === "activate" ? "Active" : "Inactive" }
          : s
      )
    );
    setToast({ type: "success", message: "Statuses updated." });
  };

  const openAdd = () => {
    setForm({ id: null, name: "", email: "", phone: "", password: "", status: "Active" });
    setShowModal(true);
  };

  const openEdit = (student) => {
    setForm({ ...student, password: "" });
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
        setStudents((prev) =>
          prev.map((s) => (s.id === form.id ? { ...s, ...form } : s))
        );
        setToast({ type: "success", message: "Student updated." });
      } else {
        setStudents((prev) => [
          {
            ...form,
            id: Date.now(),
            courses: [],
            joined: "Mar 13, 2026",
            lastActive: "Mar 13, 2026",
          },
          ...prev,
        ]);
        setToast({ type: "success", message: "Student added." });
      }
      setShowModal(false);
    }, 900);
  };

  const toggleStatus = (student) => {
    setStudents((prev) =>
      prev.map((item) =>
        item.id === student.id
          ? { ...item, status: item.status === "Active" ? "Inactive" : "Active" }
          : item
      )
    );
  };

  const exportCSV = () => {
    const rows = [
      ["Name", "Email", "Phone", "Status"],
      ...students.map((s) => [s.name, s.email, s.phone, s.status]),
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "students.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Students</h2>
          <p className="text-sm text-slate-500">
            Track students, enrollments, and progress.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="btn-outline" onClick={exportCSV}>
            Export CSV
          </button>
          <button className="btn-primary" onClick={openAdd}>
            Add Student
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={`stat-${index}`} className="glass-card space-y-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-6 w-1/2" />
              </div>
            ))
          : [
              { label: "Total Students", value: stats.total },
              { label: "Active This Month", value: stats.active },
              { label: "Avg Courses / Student", value: stats.avgCourses.toFixed(1) },
              { label: "Completion Rate", value: `${stats.completion}%` },
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
          placeholder="Search student..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          <option value="All">Status: All</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <select
          value={courseFilter}
          onChange={(event) => setCourseFilter(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          <option value="All">Course: All</option>
          {courseOptions.map((course) => (
            <option key={course} value={course}>
              {course}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          className="rounded-full border border-slate-200 px-3 py-1"
          onClick={() => bulkAction("activate")}
        >
          Activate Selected
        </button>
        <button
          className="rounded-full border border-slate-200 px-3 py-1"
          onClick={() => bulkAction("deactivate")}
        >
          Deactivate Selected
        </button>
        <button
          className="rounded-full border border-slate-200 px-3 py-1 text-rose-500"
          onClick={() => bulkAction("delete")}
        >
          Delete Selected
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="sm:hidden">
          <div className="space-y-3 px-4 py-4">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`student-card-skeleton-${index}`}
                  className="skeleton h-28 w-full rounded-2xl"
                />
              ))
            ) : paginated.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                No students found.
              </div>
            ) : (
              paginated.map((student) => (
                <div
                  key={student.id}
                  className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-sm shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {student.name
                          .split(" ")
                          .slice(0, 2)
                          .map((word) => word[0])
                          .join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {student.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {student.email}
                        </p>
                        <p className="text-xs text-slate-400">{student.phone}</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selected.includes(student.id)}
                      onChange={() => toggleSelect(student.id)}
                      className="mt-1"
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                    <div>
                      <p className="text-slate-400">Courses</p>
                      <p className="font-semibold text-slate-900">
                        {student.courses.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Last Active</p>
                      <p className="font-semibold text-slate-900">
                        {student.lastActive}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Joined</p>
                      <p className="font-semibold text-slate-900">
                        {student.joined}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400">Status</p>
                        <p className="font-semibold text-slate-900">
                          {student.status}
                        </p>
                      </div>
                      <button
                        className={`relative h-6 w-12 rounded-full transition ${
                          student.status === "Active"
                            ? "bg-emerald-400"
                            : "bg-slate-200"
                        }`}
                        onClick={() => toggleStatus(student)}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            student.status === "Active"
                              ? "translate-x-6"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                      onClick={() => setDetailStudent(student)}
                    >
                      View Profile
                    </button>
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                      onClick={() => openEdit(student)}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs text-rose-500"
                      onClick={() => setShowDelete(student)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selected.length === paginated.length && paginated.length > 0}
                    onChange={(event) => toggleAll(event.target.checked)}
                  />
                </th>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Courses</th>
                <th className="px-6 py-4">Join Date</th>
                <th className="px-6 py-4">Last Active</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`row-${index}`} className="border-b border-slate-100">
                    <td className="px-6 py-4">
                      <div className="skeleton h-4 w-4" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-32" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-32" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-12" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-12" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-16" />
                    </td>
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    No students found.
                  </td>
                </tr>
              ) : (
                paginated.map((student) => (
                  <tr key={student.id} className="border-b border-slate-100">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selected.includes(student.id)}
                        onChange={() => toggleSelect(student.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {student.name
                            .split(" ")
                            .slice(0, 2)
                            .map((word) => word[0])
                            .join("")}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{student.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{student.email}</td>
                    <td className="px-6 py-4 text-slate-600">{student.phone}</td>
                    <td className="px-6 py-4 text-slate-600">{student.courses.length}</td>
                    <td className="px-6 py-4 text-slate-500">{student.joined}</td>
                    <td className="px-6 py-4 text-slate-500">{student.lastActive}</td>
                    <td className="px-6 py-4">
                      <button
                        className={`relative h-6 w-12 rounded-full transition ${
                          student.status === "Active" ? "bg-emerald-400" : "bg-slate-200"
                        }`}
                        onClick={() => toggleStatus(student)}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            student.status === "Active" ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                          onClick={() => setDetailStudent(student)}
                        >
                          View Profile
                        </button>
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                          onClick={() => openEdit(student)}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-rose-500"
                          onClick={() => setShowDelete(student)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 text-sm text-slate-500">
          <span>
            Page {page} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-full border border-slate-200 px-3 py-1"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              Prev
            </button>
            <button
              className="rounded-full border border-slate-200 px-3 py-1"
              onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
              disabled={page === pageCount}
            >
              Next
            </button>
          </div>
        </div>
      </div>

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
              {form.id ? "Edit Student" : "Add Student"}
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
                placeholder="Phone"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <button type="submit" className="btn-primary w-full" disabled={saving}>
                {saving ? "Saving..." : "Save Student"}
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
            <h3 className="font-heading text-2xl text-slate-900">Delete student?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-900">{showDelete.name}</span>?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm"
                onClick={() => setShowDelete(null)}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={() => setShowDelete(null)}>
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {detailStudent && (
        <div className="fixed inset-0 z-[60] flex items-start justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setDetailStudent(null)}
          />
          <motion.aside
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="relative h-full w-full max-w-md bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-2xl text-slate-900">Student Profile</h3>
              <button
                className="rounded-full border border-slate-200 p-2 text-slate-500"
                onClick={() => setDetailStudent(null)}
              >
                x
              </button>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {detailStudent.name
                  .split(" ")
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{detailStudent.name}</p>
                <p className="text-sm text-slate-600">{detailStudent.email}</p>
                <p className="text-sm text-slate-500">{detailStudent.phone}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Joined: {detailStudent.joined}
            </p>
            <div className="mt-6">
              <p className="text-xs uppercase text-slate-400">Enrolled Courses</p>
              <div className="mt-3 space-y-3">
                {detailStudent.courses.map((course) => (
                  <div key={course.name}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{course.name}</span>
                      <span>{course.progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <p className="text-xs uppercase text-slate-400">Payment History</p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between">
                    <span>
                      PKR {payment.amount.toLocaleString()} · {payment.method}
                    </span>
                    <span>{payment.date}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <p className="text-xs uppercase text-slate-400">Certificates</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {certificates.map((cert) => (
                  <span key={cert} className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                    {cert}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <p className="text-xs uppercase text-slate-400">Account Status</p>
              <button
                className={`w-full rounded-full px-4 py-2 text-sm font-semibold ${
                  detailStudent.status === "Active"
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {detailStudent.status}
              </button>
              <input
                type="text"
                placeholder="Reason for deactivation"
                className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm"
              />
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

export default Students;
