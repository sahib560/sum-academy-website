import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiBell } from "react-icons/fi";
import { motion } from "framer-motion";
import { Skeleton } from "../../components/Skeleton.jsx";
import {
  getStudentAnnouncements,
  markAnnouncementRead,
  markAllStudentAnnouncementsRead,
} from "../../services/student.service.js";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const tabs = [
  { label: "All", value: "all" },
  { label: "Course Announcements", value: "course" },
  { label: "Class Announcements", value: "class" },
  { label: "System", value: "system" },
];

const typeBadgeStyles = {
  Course: "bg-accent/10 text-accent",
  Class: "bg-primary/10 text-primary",
  System: "bg-purple-100 text-purple-600",
};

const emptyMessages = {
  all: "No announcements yet.",
  course: "No course announcements yet.",
  class: "No class announcements yet.",
  system: "No system announcements yet.",
};

const toTypeLabel = (targetType = "") => {
  const normalized = String(targetType || "").toLowerCase();
  if (normalized === "course") return "Course";
  if (normalized === "class") return "Class";
  return "System";
};

const resolveSourceLabel = (row = {}) => {
  const targetType = String(row.targetType || "").toLowerCase();
  if (targetType === "course") {
    return row.targetId ? `Course ${row.targetId}` : "Course Announcement";
  }
  if (targetType === "class") {
    return row.targetId ? `Class ${row.targetId}` : "Class Announcement";
  }
  if (targetType === "single_user") return "Direct Message";
  return "System";
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
  });
};

const relativeDays = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 1) return "Today";
  if (diff < 2) return "1 day ago";
  return `${Math.floor(diff)} days ago`;
};

function StudentAnnouncements() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const announcementsQuery = useQuery({
    queryKey: ["student-announcements"],
    queryFn: getStudentAnnouncements,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const announcements = useMemo(() => {
    const source = Array.isArray(announcementsQuery.data)
      ? announcementsQuery.data
      : [];

    return source
      .map((row) => ({
        id: row.id,
        type: toTypeLabel(row.targetType),
        source: resolveSourceLabel(row),
        title: String(row.title || "Announcement").trim(),
        message: String(row.message || "").trim(),
        teacher: String(row.postedByName || "SUM Academy").trim() || "SUM Academy",
        date: row.createdAt || row.updatedAt || null,
        read: Boolean(row.isRead),
        isPinned: Boolean(row.isPinned),
      }))
      .sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
          return a.isPinned ? -1 : 1;
        }
        return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      });
  }, [announcementsQuery.data]);

  const tabCounts = useMemo(
    () => ({
      all: announcements.length,
      course: announcements.filter((item) => item.type === "Course").length,
      class: announcements.filter((item) => item.type === "Class").length,
      system: announcements.filter((item) => item.type === "System").length,
    }),
    [announcements]
  );

  const tabUnread = useMemo(
    () => ({
      all: announcements.filter((item) => !item.read).length,
      course: announcements.filter((item) => item.type === "Course" && !item.read).length,
      class: announcements.filter((item) => item.type === "Class" && !item.read).length,
      system: announcements.filter((item) => item.type === "System" && !item.read).length,
    }),
    [announcements]
  );

  const filtered = useMemo(() => {
    const byTab =
      activeTab === "all"
        ? announcements
        : announcements.filter((item) => {
            if (activeTab === "course") return item.type === "Course";
            if (activeTab === "class") return item.type === "Class";
            return item.type === "System";
          });

    if (!debouncedSearch) return byTab;

    return byTab.filter((item) => {
      const title = String(item.title || "").toLowerCase();
      const message = String(item.message || "").toLowerCase();
      const source = String(item.source || "").toLowerCase();
      return (
        title.includes(debouncedSearch) ||
        message.includes(debouncedSearch) ||
        source.includes(debouncedSearch)
      );
    });
  }, [activeTab, announcements, debouncedSearch]);

  const markReadMutation = useMutation({
    mutationFn: (id) => markAnnouncementRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["my-announcements"] });
      toast.success("Marked as read");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to mark as read");
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllStudentAnnouncementsRead,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["student-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["my-announcements"] });
      const updated = Number(response?.data?.updated || 0);
      if (updated > 0) {
        toast.success(`Marked ${updated} announcements as read`);
      } else {
        toast.success("No unread announcements");
      }
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to mark all as read");
    },
  });

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Announcements</h1>
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
            {tabUnread[tab.value] > 0 ? (
              <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-primary" />
            ) : null}
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

      <motion.section {...fadeUp} className="space-y-4">
        {tabUnread.all > 0 ? (
          <div className="flex justify-end">
            <button
              className="btn-outline"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              {markAllReadMutation.isPending ? "Marking..." : "Mark All as Read"}
            </button>
          </div>
        ) : null}

        {announcementsQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`ann-skeleton-${index}`}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-4 h-4 w-2/3" />
              <Skeleton className="mt-4 h-10 w-full" />
            </div>
          ))
        ) : announcementsQuery.isError ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            <p className="font-semibold">Failed to load announcements</p>
            <button
              className="btn-outline mt-3"
              onClick={() => announcementsQuery.refetch()}
            >
              Try Again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FiBell className="h-6 w-6" />
            </div>
            {emptyMessages[activeTab]}
          </div>
        ) : (
          filtered.map((item) => {
            const unread = !item.read;
            return (
              <div
                key={item.id}
                className={`rounded-3xl border-l-4 p-5 shadow-sm ${
                  unread ? "border-primary bg-primary/5" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        typeBadgeStyles[item.type]
                      }`}
                    >
                      {item.source}
                    </span>
                    {item.isPinned ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        Pinned
                      </span>
                    ) : null}
                  </div>
                  {unread ? <span className="inline-flex h-2 w-2 rounded-full bg-primary" /> : null}
                </div>

                <h3 className="mt-3 font-heading text-lg text-slate-900">{item.title}</h3>
                <p className={`mt-2 text-sm text-slate-500 ${expanded[item.id] ? "" : "line-clamp-3"}`}>
                  {item.message}
                </p>

                {item.message.length > 180 ? (
                  <button
                    className="mt-2 text-xs font-semibold text-primary"
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [item.id]: !prev[item.id],
                      }))
                    }
                  >
                    {expanded[item.id] ? "Show Less" : "Read More"}
                  </button>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {item.teacher
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase() || "S"}
                    </span>
                    {item.teacher}
                  </div>

                  <div className="flex items-center gap-3">
                    <span>{formatDate(item.date)}</span>
                    <span>{relativeDays(item.date)}</span>
                    {unread ? (
                      <button
                        className="text-primary"
                        onClick={() => markReadMutation.mutate(item.id)}
                        disabled={markReadMutation.isPending}
                      >
                        Mark as Read
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </motion.section>
    </div>
  );
}

export default StudentAnnouncements;
