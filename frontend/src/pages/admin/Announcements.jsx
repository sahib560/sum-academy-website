import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiBell, FiEdit3, FiPaperclip, FiTrash2 } from "react-icons/fi";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  getClasses,
  getCourses,
  getUsers,
  toggleAnnouncementPin,
  updateAnnouncement,
} from "../../services/admin.service.js";

const filterTabs = [
  { key: "all", label: "All" },
  { key: "system", label: "System" },
  { key: "class", label: "Class" },
  { key: "course", label: "Course" },
  { key: "single_user", label: "Single User" },
];

const typeMeta = {
  system: {
    label: "All Students",
    border: "border-l-4 border-l-violet-500",
    badge: "bg-violet-100 text-violet-700",
  },
  class: {
    label: "Class",
    border: "border-l-4 border-l-blue-500",
    badge: "bg-blue-100 text-blue-700",
  },
  course: {
    label: "Course",
    border: "border-l-4 border-l-orange-500",
    badge: "bg-orange-100 text-orange-700",
  },
  single_user: {
    label: "Single User",
    border: "border-l-4 border-l-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
  },
};

const initialForm = {
  title: "",
  message: "",
  targetType: "system",
  targetId: "",
  sendEmail: false,
  isPinned: false,
  audienceRole: "student",
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getRelativeTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
};

const getUserDisplayLabel = (user) => {
  const fullName = String(user?.fullName || user?.name || "").trim();
  const email = String(user?.email || "").trim();
  const role = String(user?.role || "user").toLowerCase();

  if (fullName) return `${fullName} (${role})`;
  if (email) return `${email} (${role})`;
  return `User (${role})`;
};

function Announcements() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expanded, setExpanded] = useState({});

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const announcementsQuery = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: getAnnouncements,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
  const classesQuery = useQuery({
    queryKey: ["admin-classes-for-announcements"],
    queryFn: getClasses,
  });
  const coursesQuery = useQuery({
    queryKey: ["admin-courses-for-announcements"],
    queryFn: getCourses,
  });
  const usersQuery = useQuery({
    queryKey: ["admin-users-for-announcements"],
    queryFn: () => getUsers(),
  });

  const announcements = announcementsQuery.data || [];
  const classes = classesQuery.data || [];
  const courses = coursesQuery.data || [];
  const users = usersQuery.data || [];
  const usersById = useMemo(
    () =>
      users.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {}),
    [users]
  );
  const userCounts = useMemo(
    () =>
      users.reduce(
        (acc, user) => {
          const role = String(user.role || "").toLowerCase();
          if (role === "student") acc.student += 1;
          if (role === "teacher") acc.teacher += 1;
          if (role === "admin") acc.admin += 1;
          acc.all += 1;
          return acc;
        },
        { all: 0, student: 0, teacher: 0, admin: 0 }
      ),
    [users]
  );

  const countsByTab = useMemo(() => {
    return {
      all: announcements.length,
      system: announcements.filter((item) => item.targetType === "system").length,
      class: announcements.filter((item) => item.targetType === "class").length,
      course: announcements.filter((item) => item.targetType === "course").length,
      single_user: announcements.filter((item) => item.targetType === "single_user").length,
    };
  }, [announcements]);

  const stats = useMemo(() => {
    const emailSent = announcements.filter((item) => item.sendEmail).length;
    const pinned = announcements.filter((item) => item.isPinned).length;
    return {
      total: announcements.length,
      pinned,
      emailSent,
    };
  }, [announcements]);

  const filteredAnnouncements = useMemo(() => {
    const targetFiltered =
      activeTab === "all"
        ? announcements
        : announcements.filter((item) => item.targetType === activeTab);

    const searched = debouncedSearch
      ? targetFiltered.filter((item) => {
          const title = String(item.title || "").toLowerCase();
          const message = String(item.message || "").toLowerCase();
          return title.includes(debouncedSearch) || message.includes(debouncedSearch);
        })
      : targetFiltered;

    return [...searched].sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
      }
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [activeTab, announcements, debouncedSearch]);

  const studentReachPreview = useMemo(() => {
    if (form.targetType === "system") {
      if (form.audienceRole === "all") return userCounts.all;
      if (form.audienceRole === "student") return userCounts.student;
      if (form.audienceRole === "teacher") return userCounts.teacher;
      if (form.audienceRole === "admin") return userCounts.admin;
      return userCounts.student;
    }
    if (form.targetType === "class") {
      const selectedClass = classes.find((item) => item.id === form.targetId);
      const classStudents = Array.isArray(selectedClass?.students)
        ? selectedClass.students
        : [];
      return new Set(
        classStudents
          .map((entry) => (typeof entry === "string" ? entry : entry?.studentId))
          .filter(Boolean)
      ).size;
    }
    if (form.targetType === "course") {
      const selectedCourse = courses.find((item) => item.id === form.targetId);
      return Number(selectedCourse?.enrollmentCount || 0);
    }
    if (form.targetType === "single_user") {
      return form.targetId ? 1 : 0;
    }
    return 0;
  }, [classes, courses, form.audienceRole, form.targetId, form.targetType, userCounts]);

  const resetFormState = () => {
    setForm(initialForm);
    setErrors({});
  };

  const validateForm = (isEdit = false) => {
    const nextErrors = {};
    const title = String(form.title || "").trim();
    const message = String(form.message || "").trim();

    if (title.length < 5) nextErrors.title = "Title must be at least 5 characters";
    if (title.length > 100) nextErrors.title = "Title must be at most 100 characters";
    if (message.length < 10) nextErrors.message = "Message must be at least 10 characters";
    if (!["system", "class", "course", "single_user"].includes(form.targetType)) {
      nextErrors.targetType = "Invalid target type";
    }
    if (
      !isEdit &&
      (form.targetType === "class" ||
        form.targetType === "course" ||
        form.targetType === "single_user") &&
      !form.targetId
    ) {
      nextErrors.targetId = "Please select a target";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const createMutation = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["my-announcements"] });
      const reached = response?.data?.studentsReached ?? studentReachPreview;
      const emailsSent = response?.data?.emailsSent || 0;
      toast.success(`Announcement posted! Reached ${reached} users`);
      if (emailsSent > 0) {
        toast.success(`Emails sent to ${emailsSent} users`);
      }
      setCreateOpen(false);
      resetFormState();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to post announcement");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAnnouncement(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["my-announcements"] });
      toast.success("Announcement updated");
      setEditItem(null);
      resetFormState();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update announcement");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["my-announcements"] });
      toast.success("Announcement deleted");
      setDeleteItem(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to delete announcement");
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, isPinned }) => toggleAnnouncementPin(id, isPinned),
    onSuccess: (ignore, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["my-announcements"] });
      toast.success(vars.isPinned ? "Announcement pinned" : "Announcement unpinned");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to toggle pin");
    },
  });

  const openCreateModal = () => {
    resetFormState();
    setCreateOpen(true);
  };

  const openEditModal = (item) => {
    setForm({
      title: item.title || "",
      message: item.message || "",
      targetType: item.targetType || "system",
      targetId: item.targetId || "",
      sendEmail: Boolean(item.sendEmail),
      isPinned: Boolean(item.isPinned),
      audienceRole: item.audienceRole || "student",
    });
    setErrors({});
    setEditItem(item);
  };

  const submitCreate = () => {
    if (!validateForm(false)) return;
    createMutation.mutate({
      title: form.title.trim(),
      message: form.message.trim(),
      targetType: form.targetType,
      targetId: form.targetType === "system" ? null : form.targetId,
      sendEmail: form.sendEmail,
      isPinned: form.isPinned,
      audienceRole:
        form.targetType === "system"
          ? form.audienceRole
          : form.targetType === "single_user"
          ? String(usersById[form.targetId]?.role || "all").toLowerCase()
          : "student",
    });
  };

  const submitEdit = () => {
    if (!validateForm(true)) return;
    updateMutation.mutate({
      id: editItem.id,
      payload: {
        title: form.title.trim(),
        message: form.message.trim(),
        isPinned: form.isPinned,
      },
    });
  };

  const applyFormatting = (type) => {
    const textarea = document.getElementById("announcement-message");
    if (!textarea) return;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const selected = form.message.slice(start, end) || "";
    let insert = selected;

    if (type === "bold") insert = `**${selected || "bold text"}**`;
    if (type === "italic") insert = `*${selected || "italic text"}*`;
    if (type === "bullet") {
      const lines = (selected || "list item").split("\n");
      insert = lines.map((line) => `- ${line}`).join("\n");
    }

    const nextMessage = `${form.message.slice(0, start)}${insert}${form.message.slice(end)}`;
    setForm((prev) => ({ ...prev, message: nextMessage }));
  };

  const isLoading =
    announcementsQuery.isLoading ||
    classesQuery.isLoading ||
    coursesQuery.isLoading ||
    usersQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Announcements</h2>
          <p className="text-sm text-slate-500">
            Broadcast updates by system, class, course, or single user with pin and email control.
          </p>
        </div>
        <button className="btn-primary" onClick={openCreateModal}>
          Post Announcement
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500">
            Total
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
            Pinned
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.pinned}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
            Sent Via Email
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.emailSent}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                activeTab === tab.key
                  ? "bg-primary text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label} ({countsByTab[tab.key] || 0})
            </button>
          ))}
        </div>
        <input
          className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="Search title or message..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((ignore, index) => (
            <div key={`announcement-skeleton-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="skeleton h-5 w-1/3" />
              <div className="skeleton mt-3 h-4 w-2/3" />
              <div className="skeleton mt-2 h-4 w-full" />
              <div className="skeleton mt-2 h-4 w-4/5" />
            </div>
          ))
        ) : filteredAnnouncements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-14 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <FiBell className="h-7 w-7" />
            </div>
            <p className="text-lg font-semibold text-slate-700">No announcements yet</p>
            <button className="btn-primary mt-4" onClick={openCreateModal}>
              Post Announcement
            </button>
          </div>
        ) : (
          filteredAnnouncements.map((item) => {
            const meta = typeMeta[item.targetType] || typeMeta.system;
            const expandedKey = expanded[item.id];
            const canExpand = String(item.message || "").length > 180;
            return (
              <motion.div
                layout
                key={item.id}
                className={`rounded-2xl border border-slate-200 bg-white p-5 ${meta.border}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${meta.badge}`}>
                        {item.targetType === "system"
                          ? item.targetName || "All Students"
                          : item.targetName || meta.label}
                      </span>
                      {item.isPinned ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                          Pinned
                        </span>
                      ) : null}
                      {item.sendEmail ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                          Email sent
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-primary"
                      onClick={() =>
                        pinMutation.mutate({
                          id: item.id,
                          isPinned: !Boolean(item.isPinned),
                        })
                      }
                      title={item.isPinned ? "Unpin" : "Pin"}
                    >
                      <FiPaperclip className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-primary"
                      onClick={() => openEditModal(item)}
                      title="Edit"
                    >
                      <FiEdit3 className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-rose-500"
                      onClick={() => setDeleteItem(item)}
                      title="Delete"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className={`mt-3 text-sm text-slate-600 ${expandedKey ? "" : "line-clamp-3"}`}>
                  {item.message}
                </p>
                {canExpand ? (
                  <button
                    className="mt-1 text-xs font-semibold text-primary"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                    }
                  >
                    {expandedKey ? "Read less" : "Read more"}
                  </button>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>
                    Posted by <strong>{item.postedByName || "Admin"}</strong>
                  </span>
                  <span>{formatDate(item.createdAt)}</span>
                  <span>{getRelativeTime(item.createdAt)}</span>
                  <span>{item.studentsReached || 0} reached</span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {(createOpen || editItem) && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => {
                setCreateOpen(false);
                setEditItem(null);
                resetFormState();
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="font-heading text-2xl text-slate-900">
                    {editItem ? "Edit Announcement" : "Post Announcement"}
                  </h3>
                  {editItem ? (
                    <p className="text-xs text-slate-500">
                      Target cannot be changed after posting.
                    </p>
                  ) : null}
                </div>
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500"
                  onClick={() => {
                    setCreateOpen(false);
                    setEditItem(null);
                    resetFormState();
                  }}
                >
                  X
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Title</label>
                  <input
                    value={form.title}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, title: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Enter announcement title"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-rose-500">{errors.title || ""}</p>
                    <p className="text-xs text-slate-400">{form.title.length}/100</p>
                  </div>
                </div>

                {!editItem ? (
                  <>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Target Type</label>
                      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                        {[
                          { key: "system", label: "System-wide" },
                          { key: "class", label: "Class" },
                          { key: "course", label: "Course" },
                          { key: "single_user", label: "Single User" },
                        ].map((item) => (
                          <button
                            key={item.key}
                            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                              form.targetType === item.key
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-slate-200 text-slate-600"
                            }`}
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                targetType: item.key,
                                targetId: "",
                                audienceRole:
                                  item.key === "system" ? prev.audienceRole : "student",
                              }))
                            }
                            type="button"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {form.targetType === "system" ? (
                      <div>
                        <label className="text-xs font-semibold uppercase text-slate-500">
                          Audience
                        </label>
                        <select
                          value={form.audienceRole}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              audienceRole: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        >
                          <option value="student">Students</option>
                          <option value="teacher">Teachers</option>
                          <option value="admin">Admins</option>
                          <option value="all">All Users</option>
                        </select>
                      </div>
                    ) : null}

                    {form.targetType !== "system" ? (
                      <div>
                        <label className="text-xs font-semibold uppercase text-slate-500">
                          {form.targetType === "class"
                            ? "Class"
                            : form.targetType === "course"
                            ? "Course"
                            : "User"}
                        </label>
                        <select
                          value={form.targetId}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, targetId: event.target.value }))
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        >
                          <option value="">Select target</option>
                          {form.targetType === "class"
                            ? classes.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))
                            : form.targetType === "course"
                            ? courses.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.title}
                                </option>
                              ))
                            : users.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {getUserDisplayLabel(item)}
                                </option>
                              ))}
                        </select>
                        <p className="mt-1 text-xs text-rose-500">{errors.targetId || ""}</p>
                      </div>
                    ) : null}
                  </>
                ) : null}

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Message</label>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-2 py-1 text-xs"
                      onClick={() => applyFormatting("bold")}
                    >
                      Bold
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-2 py-1 text-xs"
                      onClick={() => applyFormatting("italic")}
                    >
                      Italic
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-2 py-1 text-xs"
                      onClick={() => applyFormatting("bullet")}
                    >
                      Bullet
                    </button>
                  </div>
                  <textarea
                    id="announcement-message"
                    value={form.message}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, message: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    rows={7}
                    placeholder="Write announcement message..."
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-rose-500">{errors.message || ""}</p>
                    <p className="text-xs text-slate-400">{form.message.length} chars</p>
                  </div>
                </div>

                {!editItem ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-600">
                      This will reach {studentReachPreview} users
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  {!editItem ? (
                    <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2">
                      <span className="text-sm font-semibold text-slate-700">Send Email</span>
                      <input
                        type="checkbox"
                        checked={form.sendEmail}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, sendEmail: event.target.checked }))
                        }
                      />
                    </label>
                  ) : null}
                  <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2">
                    <span className="text-sm font-semibold text-slate-700">Pin to top</span>
                    <input
                      type="checkbox"
                      checked={form.isPinned}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, isPinned: event.target.checked }))
                      }
                    />
                  </label>
                </div>
              </div>

              <button
                className="btn-primary mt-5 w-full"
                onClick={editItem ? submitEdit : submitCreate}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : editItem ? "Save Changes" : "Post Announcement"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteItem ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setDeleteItem(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md rounded-3xl bg-white p-6"
            >
              <h3 className="text-xl font-bold text-slate-900">Delete this announcement?</h3>
              <p className="mt-2 text-sm text-slate-500">
                Students will no longer see it.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
                  onClick={() => setDeleteItem(null)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-xl bg-rose-500 px-3 py-2 text-sm font-semibold text-white"
                  onClick={() => deleteMutation.mutate(deleteItem.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default Announcements;
