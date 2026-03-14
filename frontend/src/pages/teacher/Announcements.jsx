import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "../../components/Skeleton.jsx";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const classOptions = [
  "Batch A - Biology XI",
  "Batch B - Chemistry XII",
  "Batch C - Physics XI",
];

const courseOptions = [
  "Biology Masterclass XI",
  "Chemistry Quick Revision",
  "Physics Practice Lab",
];

const initialAnnouncements = [
  {
    id: 1,
    type: "Class",
    target: "Batch A - Biology XI",
    title: "Tomorrow's revision session",
    message:
      "Please review Chapter 5 before we meet. Bring your notes and questions so we can focus on weak areas.",
    date: "2026-03-14",
    students: 42,
    emailSent: true,
  },
  {
    id: 2,
    type: "Course",
    target: "Chemistry Quick Revision",
    title: "New practice worksheet uploaded",
    message:
      "A new worksheet is live in Module 3. Complete it before Friday and post your questions in the discussion.",
    date: "2026-03-12",
    students: 28,
    emailSent: false,
  },
  {
    id: 3,
    type: "Class",
    target: "Batch C - Physics XI",
    title: "Lab assessment reminder",
    message:
      "Lab assessments begin next week. Make sure to review your lab notebooks and be prepared for viva questions.",
    date: "2026-03-10",
    students: 31,
    emailSent: true,
  },
];

const tabs = [
  { label: "All", value: "All" },
  { label: "Class Announcements", value: "Class" },
  { label: "Course Announcements", value: "Course" },
];

const formatLongDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
  });

function TeacherAnnouncements() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [expanded, setExpanded] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [emailToggle, setEmailToggle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    type: "Class",
    target: classOptions[0],
    title: "",
    message: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const tabCounts = useMemo(() => {
    return {
      All: announcements.length,
      Class: announcements.filter((item) => item.type === "Class").length,
      Course: announcements.filter((item) => item.type === "Course").length,
    };
  }, [announcements]);

  const filteredAnnouncements = useMemo(() => {
    const query = search.trim().toLowerCase();
    return announcements
      .filter((item) => (activeTab === "All" ? true : item.type === activeTab))
      .filter(
        (item) =>
          !query ||
          item.title.toLowerCase().includes(query) ||
          item.message.toLowerCase().includes(query)
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [activeTab, announcements, search]);

  const openModal = (announcement = null) => {
    setEditing(announcement);
    setFormData(
      announcement
        ? {
            type: announcement.type,
            target: announcement.target,
            title: announcement.title,
            message: announcement.message,
          }
        : {
            type: "Class",
            target: classOptions[0],
            title: "",
            message: "",
          }
    );
    setEmailToggle(announcement?.emailSent || false);
    setModalOpen(true);
  };

  const applyFormat = (wrapper) => {
    setFormData((prev) => {
      const nextValue = `${wrapper}${prev.message}${wrapper}`;
      return { ...prev, message: nextValue };
    });
  };

  const handleSave = () => {
    if (formData.title.trim().length === 0 || formData.message.trim().length < 10) {
      setToast({ type: "error", message: "Something went wrong. Please try again." });
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      let emailCount = 0;
      if (editing) {
        setAnnouncements((prev) =>
          prev.map((item) =>
            item.id === editing.id
              ? {
                  ...item,
                  ...formData,
                  emailSent: emailToggle,
                }
              : item
          )
        );
        emailCount = editing.students;
        setToast({ type: "success", message: "Announcement posted successfully" });
      } else {
        const newAnnouncement = {
          id: Date.now(),
          date: new Date().toISOString().slice(0, 10),
          students: 0,
          emailSent: emailToggle,
          ...formData,
        };
        setAnnouncements((prev) => [newAnnouncement, ...prev]);
        emailCount = newAnnouncement.students;
        setToast({ type: "success", message: "Announcement posted successfully" });
      }
      if (emailToggle) {
        setTimeout(() => {
          setToast({
            type: "email",
            message: `Email sent to ${emailCount} students`,
          });
        }, 1200);
      }
      setModalOpen(false);
    }, 900);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setAnnouncements((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    setDeleteTarget(null);
    setToast({ type: "delete", message: "Announcement deleted" });
  };

  return (
    <div className="space-y-6">
      <motion.section
        {...fadeUp}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <h1 className="font-heading text-3xl text-slate-900">Announcements</h1>
        <button className="btn-primary" onClick={() => openModal()}>
          Post Announcement
        </button>
      </motion.section>

      <motion.section {...fadeUp} className="flex flex-wrap items-center gap-3">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              activeTab === tab.value
                ? "bg-primary text-white"
                : "border border-slate-200 text-slate-600"
            }`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
              {tabCounts[tab.value]}
            </span>
          </button>
        ))}
        <input
          type="text"
          placeholder="Search announcements..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </motion.section>

      <motion.section {...fadeUp} className="grid gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={`ann-skel-${index}`} className="glass-card border border-slate-200">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-4 h-4 w-2/3" />
              <Skeleton className="mt-4 h-10 w-full" />
            </div>
          ))
        ) : filteredAnnouncements.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            <p>No announcements yet.</p>
            <button className="btn-primary mt-4" onClick={() => openModal()}>
              Post Announcement
            </button>
          </div>
        ) : (
          filteredAnnouncements.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-start gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <span
                className={`h-full w-1 rounded-full ${
                  item.type === "Class" ? "bg-primary" : "bg-accent"
                }`}
              />
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-heading text-lg text-slate-900">{item.title}</h3>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    {item.target}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {expanded[item.id]
                    ? item.message
                    : `${item.message.slice(0, 140)}${item.message.length > 140 ? "..." : ""}`}
                  {item.message.length > 140 && (
                    <button
                      className="ml-2 text-primary"
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                    >
                      {expanded[item.id] ? "Show less" : "Read more"}
                    </button>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span>{formatLongDate(item.date)}</span>
                  <span className="inline-flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <path d="M7 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm10 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM2 20a5 5 0 0 1 10 0H2zm12 0a4 4 0 0 1 8 0h-8z" />
                    </svg>
                    {item.students} students reached
                  </span>
                  {item.emailSent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-600">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                        <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 2v.5l8 4.5 8-4.5V8H4z" />
                      </svg>
                      Email sent
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600"
                  onClick={() => openModal(item)}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M4 17.3V20h2.7l7.9-7.9-2.7-2.7L4 17.3zM20.7 7.04a1 1 0 0 0 0-1.41l-2.3-2.3a1 1 0 0 0-1.41 0l-1.8 1.8 3.7 3.7 1.8-1.79z" />
                  </svg>
                </button>
                <button
                  className="rounded-full border border-slate-200 px-3 py-2 text-xs text-rose-500"
                  onClick={() => setDeleteTarget(item)}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </motion.section>

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setModalOpen(false)}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h2 className="font-heading text-2xl text-slate-900">
              {editing ? "Edit Announcement" : "Post Announcement"}
            </h2>
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {["Class", "Course"].map((type) => (
                  <button
                    key={type}
                    className={`rounded-full px-4 py-2 text-xs font-semibold ${
                      formData.type === type
                        ? type === "Class"
                          ? "bg-primary text-white"
                          : "bg-accent text-white"
                        : "border border-slate-200 text-slate-600"
                    }`}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        type,
                        target: type === "Class" ? classOptions[0] : courseOptions[0],
                      }))
                    }
                  >
                    {type} Announcement
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Target
                </label>
                <select
                  value={formData.target}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, target: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {(formData.type === "Class" ? classOptions : courseOptions).map(
                    (item) => (
                      <option key={item}>{item}</option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Title
                </label>
                <input
                  value={formData.title}
                  maxLength={100}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, title: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold uppercase">Message</span>
                  <span>{formData.message.length}/500</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => applyFormat("**")}
                  >
                    Bold
                  </button>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => applyFormat("_")}
                  >
                    Italic
                  </button>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        message: `${prev.message}\n- `,
                      }))
                    }
                  >
                    Bullet List
                  </button>
                </div>
                <textarea
                  value={formData.message}
                  minLength={10}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, message: event.target.value }))
                  }
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">
                    Send email notification
                  </p>
                  <p className="text-xs text-slate-500">
                    Announcement visible in dashboard only when off
                  </p>
                </div>
                <button
                  className={`h-7 w-12 rounded-full p-1 ${
                    emailToggle ? "bg-primary" : "bg-slate-200"
                  }`}
                  onClick={() => setEmailToggle((prev) => !prev)}
                  type="button"
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white transition ${
                      emailToggle ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              {emailToggle && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <p className="font-semibold">
                    This will send an email to all enrolled students. This action
                    cannot be undone.
                  </p>
                  <p className="mt-2 text-xs">
                    Subject: {formData.title || "Announcement"}
                  </p>
                  <p className="text-xs">
                    Preview: {formData.message.slice(0, 60) || "No message yet"}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button className="btn-outline" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Posting..." : "Post Announcement"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setDeleteTarget(null)}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-heading text-xl text-slate-900">
              Delete announcement?
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Students will no longer see it.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                className="btn-outline flex-1"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button className="btn-primary flex-1" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed right-6 top-6 z-[70] rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${
            toast.type === "error"
              ? "bg-rose-500"
              : toast.type === "delete"
                ? "bg-slate-700"
                : toast.type === "email"
                  ? "bg-blue-600"
                  : "bg-emerald-500"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default TeacherAnnouncements;
