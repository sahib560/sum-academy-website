import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const teachers = [
  "Mr. Sikander Ali Qureshi",
  "Mr. Shah Mohammad Pathan",
  "Mr. Mansoor Ahmed Mangi",
  "Mr. Muhammad Idress Mahar",
  "Mr. Waseem Ahmed Soomro",
];

const statuses = ["Active", "Upcoming", "Completed"];

const initialClasses = [
  {
    id: 1,
    name: "Class XI - Pre-Medical A",
    batchCode: "PMXI-A",
    teacher: "Mr. Sikander Ali Qureshi",
    start: "Mar 01, 2026",
    end: "Aug 30, 2026",
    enrolled: 36,
    capacity: 45,
    status: "Active",
    description: "Morning batch for pre-medical XI students.",
  },
  {
    id: 2,
    name: "Class XII - Pre-Medical B",
    batchCode: "PMXII-B",
    teacher: "Mr. Shah Mohammad Pathan",
    start: "Apr 10, 2026",
    end: "Sep 15, 2026",
    enrolled: 28,
    capacity: 40,
    status: "Upcoming",
    description: "Evening batch with intensive revision.",
  },
  {
    id: 3,
    name: "Entrance Test Batch",
    batchCode: "ENT-01",
    teacher: "Mr. Muhammad Idress Mahar",
    start: "Jan 15, 2026",
    end: "Mar 15, 2026",
    enrolled: 32,
    capacity: 35,
    status: "Completed",
    description: "Two-month entrance prep intensive.",
  },
];

function Classes() {
  const [classes, setClasses] = useState(initialClasses);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [teacherFilter, setTeacherFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDelete, setShowDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    id: null,
    name: "",
    batchCode: "",
    teacher: teachers[0],
    start: "",
    end: "",
    capacity: "",
    description: "",
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

  const filteredClasses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return classes.filter((item) => {
      const matchesSearch =
        !query || item.name.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "All" || item.status === statusFilter;
      const matchesTeacher =
        teacherFilter === "All" || item.teacher === teacherFilter;
      return matchesSearch && matchesStatus && matchesTeacher;
    });
  }, [classes, search, statusFilter, teacherFilter]);

  const stats = {
    total: classes.length,
    active: classes.filter((item) => item.status === "Active").length,
    students: classes.reduce((sum, item) => sum + item.enrolled, 0),
  };

  const openAdd = () => {
    setForm({
      id: null,
      name: "",
      batchCode: `BATCH-${Math.floor(Math.random() * 900 + 100)}`,
      teacher: teachers[0],
      start: "",
      end: "",
      capacity: "",
      description: "",
      status: "Active",
    });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setForm({ ...item });
    setShowModal(true);
  };

  const handleSave = (event) => {
    event.preventDefault();
    if (!form.name || !form.batchCode) {
      setToast({ type: "error", message: "Fill required fields." });
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      if (form.id) {
        setClasses((prev) =>
          prev.map((item) => (item.id === form.id ? { ...item, ...form } : item))
        );
        setToast({ type: "success", message: "Class updated." });
      } else {
        setClasses((prev) => [
          {
            ...form,
            id: Date.now(),
            enrolled: 0,
          },
          ...prev,
        ]);
        setToast({ type: "success", message: "Class created." });
      }
      setShowModal(false);
    }, 900);
  };

  const handleDelete = () => {
    setClasses((prev) => prev.filter((item) => item.id !== showDelete.id));
    setToast({ type: "success", message: "Class deleted." });
    setShowDelete(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Classes & Batches</h2>
          <p className="text-sm text-slate-500">
            Create and manage batches, schedules, and capacity.
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          Create Class
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
              { label: "Total Classes", value: stats.total },
              { label: "Active Classes", value: stats.active },
              { label: "Total Students", value: stats.students },
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
          placeholder="Search classes..."
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
            <div key={`class-skeleton-${index}`} className="glass-card space-y-3">
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-2 w-full" />
            </div>
          ))}
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No classes found.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClasses.map((item) => (
            <div key={item.id} className="glass-card card-hover flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-lg text-slate-900">{item.name}</h3>
                  <span className="mt-1 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {item.batchCode}
                  </span>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.status === "Active"
                      ? "bg-emerald-50 text-emerald-600"
                      : item.status === "Upcoming"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {item.teacher
                    .split(" ")
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.teacher}</p>
                  <p className="text-xs text-slate-500">
                    {item.start} → {item.end}
                  </p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Capacity</span>
                  <span>
                    {item.enrolled}/{item.capacity}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${(item.enrolled / item.capacity) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/admin/classes/${item.id}`}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                >
                  Manage
                </Link>
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                  onClick={() => openEdit(item)}
                >
                  Edit
                </button>
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs text-rose-500"
                  onClick={() => setShowDelete(item)}
                >
                  Delete
                </button>
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
              {form.id ? "Edit Class" : "Create Class"}
            </h3>
            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <input
                type="text"
                placeholder="Class Name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <input
                type="text"
                placeholder="Batch Code"
                value={form.batchCode}
                onChange={(event) =>
                  setForm({ ...form, batchCode: event.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
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
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="date"
                  value={form.start}
                  onChange={(event) => setForm({ ...form, start: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
                <input
                  type="date"
                  value={form.end}
                  onChange={(event) => setForm({ ...form, end: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </div>
              <input
                type="number"
                placeholder="Max Capacity"
                value={form.capacity}
                onChange={(event) => setForm({ ...form, capacity: event.target.value })}
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
              <button type="submit" className="btn-primary w-full" disabled={saving}>
                {saving ? "Saving..." : "Save Class"}
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
            <h3 className="font-heading text-2xl text-slate-900">Delete class?</h3>
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

export default Classes;
