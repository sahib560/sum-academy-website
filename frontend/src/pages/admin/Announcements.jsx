import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

const tabs = ["All", "System-wide", "Class-specific", "Course-specific"];

const classOptions = ["Batch A", "Batch B", "Batch C"];
const courseOptions = [
  "Math 101",
  "Physics Mastery",
  "Biology Essentials",
  "English Prep",
];

const initialAnnouncements = [
  {
    id: 1,
    title: "Midterm Schedule Released",
    type: "Class-specific",
    target: "Class: Batch A",
    message:
      "Midterm exams will start next Monday. Please review the schedule and reach out to your class coordinator if you have clashes.",
    postedBy: "Admin User",
    date: "Mar 12, 2026",
    reached: 120,
    pinned: true,
  },
  {
    id: 2,
    title: "New Course Materials Uploaded",
    type: "Course-specific",
    target: "Course: Biology Essentials",
    message:
      "Chapter 6 notes and practice quizzes are now available in the course resources section.",
    postedBy: "Admin User",
    date: "Mar 10, 2026",
    reached: 86,
    pinned: false,
  },
  {
    id: 3,
    title: "System Maintenance Window",
    type: "System-wide",
    target: "All Students",
    message:
      "The LMS will be under maintenance on Saturday from 2 AM to 4 AM PKT. Please plan your study schedule accordingly.",
    postedBy: "Admin User",
    date: "Mar 09, 2026",
    reached: 540,
    pinned: false,
  },
];

function Announcements() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    type: "System-wide",
    target: "All Students",
    message: "",
    sendEmail: false,
    pinned: false,
  });
  const textAreaRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const filteredAnnouncements = useMemo(() => {
    const items =
      activeTab === "All"
        ? announcements
        : announcements.filter((item) => item.type === activeTab);
    const pinnedItems = items.filter((item) => item.pinned);
    const regularItems = items.filter((item) => !item.pinned);
    return [...pinnedItems, ...regularItems];
  }, [activeTab, announcements]);

  const openModal = (announcement) => {
    if (announcement) {
      setEditing(announcement);
      setFormData({
        title: announcement.title,
        type: announcement.type,
        target: announcement.target,
        message: announcement.message,
        sendEmail: false,
        pinned: announcement.pinned,
      });
    } else {
      setEditing(null);
      setFormData({
        title: "",
        type: "System-wide",
        target: "All Students",
        message: "",
        sendEmail: false,
        pinned: false,
      });
    }
    setModalOpen(true);
  };

  const handleTypeChange = (value) => {
    let target = "All Students";
    if (value === "Class-specific") {
      target = `Class: ${classOptions[0]}`;
    }
    if (value === "Course-specific") {
      target = `Course: ${courseOptions[0]}`;
    }
    setFormData((prev) => ({ ...prev, type: value, target }));
  };

  const handleSave = () => {
    if (!formData.title || !formData.message) {
      setToast({ type: "error", message: "Title and message are required." });
      return;
    }
    if (editing) {
      setAnnouncements((prev) =>
        prev.map((item) =>
          item.id === editing.id
            ? {
                ...item,
                title: formData.title,
                type: formData.type,
                target: formData.target,
                message: formData.message,
                pinned: formData.pinned,
              }
            : item
        )
      );
      setToast({ type: "success", message: "Announcement updated." });
    } else {
      const newAnnouncement = {
        id: Date.now(),
        title: formData.title,
        type: formData.type,
        target: formData.target,
        message: formData.message,
        postedBy: "Admin User",
        date: "Mar 13, 2026",
        reached: 0,
        pinned: formData.pinned,
      };
      setAnnouncements((prev) => [newAnnouncement, ...prev]);
      setToast({ type: "success", message: "Announcement posted." });
    }
    if (formData.sendEmail) {
      setToast({ type: "success", message: "Email notifications sent." });
    }
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setAnnouncements((prev) =>
      prev.filter((item) => item.id !== deleteTarget.id)
    );
    setToast({ type: "success", message: "Announcement deleted." });
    setDeleteTarget(null);
  };

  const handlePinToggle = (announcement) => {
    setAnnouncements((prev) =>
      prev.map((item) =>
        item.id === announcement.id ? { ...item, pinned: !item.pinned } : item
      )
    );
  };

  const applyFormat = (type) => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const selected = formData.message.slice(start, end);
    let nextValue = formData.message;

    if (type === "bold") {
      nextValue =
        formData.message.slice(0, start) +
        `**${selected || "bold text"}**` +
        formData.message.slice(end);
    }
    if (type === "italic") {
      nextValue =
        formData.message.slice(0, start) +
        `*${selected || "italic text"}*` +
        formData.message.slice(end);
    }
    if (type === "bullet") {
      const lines = (selected || "List item").split("\n");
      const bulletLines = lines.map((line) => `- ${line}`);
      nextValue =
        formData.message.slice(0, start) +
        bulletLines.join("\n") +
        formData.message.slice(end);
    }
    setFormData((prev) => ({ ...prev, message: nextValue }));
    setTimeout(() => textarea.focus(), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">
            Announcements
          </h2>
          <p className="text-sm text-slate-500">
            Share updates with classes, courses, or the entire academy.
          </p>
        </div>
        <button className="btn-primary" onClick={() => openModal(null)}>
          Post Announcement
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="glass-card space-y-3">
                <div className="skeleton h-5 w-1/2" />
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-8 w-32" />
              </div>
            ))
          : filteredAnnouncements.length === 0 ? (
              <div className="col-span-full rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
                No announcements yet.
              </div>
            )
          : filteredAnnouncements.map((item) => (
              <div
                key={item.id}
                className={`glass-card flex flex-col gap-4 ${
                  item.pinned ? "border border-primary/30" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {item.title}
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {item.type.replace("-specific", "")}
                      </span>
                      {item.pinned && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3 w-3"
                            fill="currentColor"
                          >
                            <path d="M14 2 9 7l-4 1 7 7 1-4 5-5-4-4zM5 19l5-5 1 1-5 5H5v-1z" />
                          </svg>
                          Pinned
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{item.target}</p>
                  </div>
                </div>
                <p
                  className="text-sm text-slate-600"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {item.message}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      AU
                    </div>
                    <span>{item.postedBy}</span>
                    <span>{item.date}</span>
                    <span>{item.reached} students reached</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                      onClick={() => openModal(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                      onClick={() => setDeleteTarget(item)}
                    >
                      Delete
                    </button>
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                      onClick={() => handlePinToggle(item)}
                    >
                      {item.pinned ? "Unpin" : "Pin to top"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-heading text-2xl text-slate-900">
                  {editing ? "Edit Announcement" : "Post Announcement"}
                </h3>
                <p className="text-sm text-slate-500">
                  Compose and target your announcement.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500"
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(event) => handleTypeChange(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    {tabs
                      .filter((item) => item !== "All")
                      .map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                  </select>
                </div>
                {formData.type === "Class-specific" && (
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-400">
                      Class
                    </label>
                    <select
                      value={formData.target.replace("Class: ", "")}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          target: `Class: ${event.target.value}`,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      {classOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {formData.type === "Course-specific" && (
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-400">
                      Course
                    </label>
                    <select
                      value={formData.target.replace("Course: ", "")}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          target: `Course: ${event.target.value}`,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      {courseOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Message
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => applyFormat("bold")}
                  >
                    Bold
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => applyFormat("italic")}
                  >
                    Italic
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => applyFormat("bullet")}
                  >
                    Bullet list
                  </button>
                </div>
                <textarea
                  ref={textAreaRef}
                  rows={5}
                  value={formData.message}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      message: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Send email notification
                    </p>
                    <p className="text-xs text-slate-500">
                      Email all targeted students.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      formData.sendEmail ? "bg-primary" : "bg-slate-200"
                    }`}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        sendEmail: !prev.sendEmail,
                      }))
                    }
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                        formData.sendEmail ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Pin to top
                    </p>
                    <p className="text-xs text-slate-500">
                      Keep this announcement visible.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      formData.pinned ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, pinned: !prev.pinned }))
                    }
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                        formData.pinned ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <button className="btn-primary mt-6 w-full" onClick={handleSave}>
              {editing ? "Save Changes" : "Post Announcement"}
            </button>
          </motion.div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
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
              This action cannot be undone.
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

export default Announcements;
