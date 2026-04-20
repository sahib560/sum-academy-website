import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  getMyAnnouncements,
  markAllAnnouncementsRead,
  markAnnouncementRead,
} from "../../services/admin.service.js";

const resolveBasePath = (pathname) => {
  if (pathname.startsWith("/admin")) return "/admin";
  if (pathname.startsWith("/teacher")) return "/teacher";
  if (pathname.startsWith("/student")) return "/student";
  return "";
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

const resolveTargetLabel = (item) => {
  if (item?.targetName) return item.targetName;
  if (item?.targetType === "single_user") return "Single User";
  if (item?.targetType === "course") return "Course";
  if (item?.targetType === "class") return "Class";
  return "System";
};

function Notifications() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const basePath = useMemo(
    () => resolveBasePath(location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const notificationsQuery = useQuery({
    queryKey: ["my-announcements", basePath, "notifications"],
    queryFn: getMyAnnouncements,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const notifications = useMemo(() => {
    const source = Array.isArray(notificationsQuery.data)
      ? notificationsQuery.data
      : [];
    return source;
  }, [notificationsQuery.data]);
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const readCount = notifications.length - unreadCount;

  const counts = {
    all: notifications.length,
    unread: unreadCount,
    read: readCount,
  };

  const filtered = useMemo(() => {
    const byTab =
      activeTab === "all"
        ? notifications
        : notifications.filter((item) =>
            activeTab === "unread" ? !item.isRead : Boolean(item.isRead)
          );

    const bySearch = debouncedSearch
      ? byTab.filter((item) => {
          const title = String(item.title || "").toLowerCase();
          const message = String(item.message || "").toLowerCase();
          return title.includes(debouncedSearch) || message.includes(debouncedSearch);
        })
      : byTab;

    return [...bySearch].sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [activeTab, debouncedSearch, notifications]);

  const markOneMutation = useMutation({
    mutationFn: markAnnouncementRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-announcements"] });
      toast.success("Marked as read");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to mark as read");
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllAnnouncementsRead,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["my-announcements"] });
      const updated = response?.data?.updated || 0;
      if (updated > 0) {
        toast.success(`Marked ${updated} notifications as read`);
      } else {
        toast.success("No unread notifications");
      }
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to mark all as read");
    },
  });

  const handleMarkRead = (item) => {
    if (!item || item.isRead || markOneMutation.isPending) return;
    markOneMutation.mutate(item.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Notifications</h2>
          <p className="text-sm text-slate-500">
            {basePath === "/teacher"
              ? "Showing incoming notifications only."
              : "View all announcements sent to your account and manage read status."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-primary"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending || unreadCount === 0}
          >
            {markAllMutation.isPending ? "Marking..." : "Mark all as read"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Total
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{counts.all}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
            Unread
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{counts.unread}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
            Read
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{counts.read}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {[
            { key: "all", label: "All" },
            { key: "unread", label: "Unread" },
            { key: "read", label: "Read" },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                activeTab === tab.key
                  ? "bg-primary text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label} ({counts[tab.key] || 0})
            </button>
          ))}
        </div>
        <input
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:max-w-sm"
          placeholder="Search notifications..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="grid gap-3">
        {notificationsQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`notifications-skeleton-${index}`}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="skeleton h-5 w-1/2" />
              <div className="skeleton mt-2 h-4 w-11/12" />
              <div className="skeleton mt-2 h-4 w-8/12" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-14 text-center">
            <p className="text-lg font-semibold text-slate-700">No notifications found</p>
            <p className="mt-1 text-sm text-slate-500">
              {activeTab === "all"
                ? "You will see announcements here."
                : "Try switching tab or clearing search."}
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 ${
                item.isRead
                  ? "border-slate-200 bg-white"
                  : "border-primary/20 bg-primary/5"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    {!item.isRead ? (
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
                    ) : null}
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      {resolveTargetLabel(item)}
                    </span>
                    {item.isPinned ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">
                        Pinned
                      </span>
                    ) : null}
                  </div>
                  <p className="text-base font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                  <p className="text-[11px] text-slate-400">{getRelativeTime(item.createdAt)}</p>
                  {!item.isRead ? (
                    <button
                      className="rounded-lg border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                      onClick={() => handleMarkRead(item)}
                      disabled={markOneMutation.isPending}
                    >
                      Mark as read
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-600">Read</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Notifications;
