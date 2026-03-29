import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiBell } from "react-icons/fi";
import { Skeleton } from "../../components/Skeleton.jsx";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const tabs = [
  { label: "All", value: "All" },
  { label: "Course Announcements", value: "Course" },
  { label: "Class Announcements", value: "Class" },
  { label: "System", value: "System" },
];

const initialAnnouncements = [
  {
    id: 1,
    type: "Class",
    source: "Batch A - Biology XI",
    title: "Live revision session tomorrow",
    message:
      "We will focus on Genetics and common exam pitfalls. Bring your notes and list any doubts in advance.",
    teacher: "Mr. Sikander Ali Qureshi",
    date: "2026-03-14",
    read: false,
  },
  {
    id: 2,
    type: "Course",
    source: "Chemistry Quick Revision",
    title: "Worksheet uploaded in Module 3",
    message:
      "A new practice worksheet is available in Module 3. Submit by Friday for feedback.",
    teacher: "Mr. Mansoor Ahmed Mangi",
    date: "2026-03-12",
    read: false,
  },
  {
    id: 3,
    type: "System",
    source: "System",
    title: "Maintenance window scheduled",
    message:
      "The platform will be under maintenance on March 20 from 1 AM to 3 AM.",
    teacher: "SUM Academy",
    date: "2026-03-10",
    read: true,
  },
  {
    id: 4,
    type: "Course",
    source: "English Essay Clinic",
    title: "Essay topics list updated",
    message:
      "We have updated the essay topics list for the upcoming writing assessment.",
    teacher: "Mr. Waseem Ahmed Soomro",
    date: "2026-03-09",
    read: true,
  },
];

const typeBadgeStyles = {
  Course: "bg-accent/10 text-accent",
  Class: "bg-primary/10 text-primary",
  System: "bg-purple-100 text-purple-600",
};

const emptyMessages = {
  All: "No announcements yet.",
  Course: "No course announcements yet.",
  Class: "No class announcements yet.",
  System: "No system announcements yet.",
};

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
  });

const relativeDays = (dateStr) => {
  const diff =
    (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24);
  if (diff < 1) return "Today";
  if (diff < 2) return "1 day ago";
  return `${Math.floor(diff)} days ago`;
};

function StudentAnnouncements() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unreadCount = announcements.filter((item) => !item.read).length;
    window.localStorage.setItem(
      "studentUnreadAnnouncements",
      String(unreadCount)
    );
    window.dispatchEvent(new Event("student:announcements"));
  }, [announcements]);

  const tabCounts = useMemo(() => {
    const counts = {
      All: announcements.length,
      Course: announcements.filter((a) => a.type === "Course").length,
      Class: announcements.filter((a) => a.type === "Class").length,
      System: announcements.filter((a) => a.type === "System").length,
    };
    return counts;
  }, [announcements]);

  const tabUnread = useMemo(() => {
    const counts = {
      All: announcements.filter((a) => !a.read).length,
      Course: announcements.filter((a) => a.type === "Course" && !a.read).length,
      Class: announcements.filter((a) => a.type === "Class" && !a.read).length,
      System: announcements.filter((a) => a.type === "System" && !a.read).length,
    };
    return counts;
  }, [announcements]);

  const filtered = useMemo(() => {
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

  const markAllRead = () => {
    setAnnouncements((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  const markRead = (id) => {
    setAnnouncements((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  };

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
            {tabUnread[tab.value] > 0 && (
              <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-primary" />
            )}
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
        {tabUnread.All > 0 && (
          <div className="flex justify-end">
            <button className="btn-outline" onClick={markAllRead}>
              Mark All as Read
            </button>
          </div>
        )}
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`ann-skel-${index}`}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-4 h-4 w-2/3" />
              <Skeleton className="mt-4 h-10 w-full" />
            </div>
          ))
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
                  unread
                    ? "border-primary bg-primary/5"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      typeBadgeStyles[item.type]
                    }`}
                  >
                    {item.source}
                  </span>
                  {unread && (
                    <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
                <h3 className="mt-3 font-heading text-lg text-slate-900">
                  {item.title}
                </h3>
                <p
                  className={`mt-2 text-sm text-slate-500 ${
                    expanded[item.id]
                      ? ""
                      : "line-clamp-3"
                  }`}
                >
                  {item.message}
                </p>
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
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {item.teacher
                        .split(" ")
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")}
                    </span>
                    {item.teacher}
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{formatDate(item.date)}</span>
                    <span>{relativeDays(item.date)}</span>
                    {unread && (
                      <button
                        className="text-primary"
                        onClick={() => markRead(item.id)}
                      >
                        Mark as Read
                      </button>
                    )}
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
