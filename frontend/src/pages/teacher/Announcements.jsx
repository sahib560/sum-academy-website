import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Skeleton } from "../../components/Skeleton.jsx";
import {
  createTeacherAnnouncement,
  getTeacherAnnouncements,
  getTeacherCourses,
  getTeacherStudents,
} from "../../services/teacher.service.js";

const tabs = [
  { label: "All", value: "all" },
  { label: "Course", value: "course" },
  { label: "Single Student", value: "single_user" },
];

const initialSendForm = {
  targetType: "course",
  targetId: "",
  title: "",
  message: "",
  sendEmail: true,
};

const formatDateTime = (value) => {
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
  if (item?.targetType === "course") return "Course";
  if (item?.targetType === "single_user") return "Single Student";
  return "Announcement";
};

function TeacherAnnouncements() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expanded, setExpanded] = useState({});
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendForm, setSendForm] = useState(initialSendForm);
  const [sendErrors, setSendErrors] = useState({});

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const outgoingQuery = useQuery({
    queryKey: ["teacher-announcements", "outgoing"],
    queryFn: getTeacherAnnouncements,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const teacherCoursesQuery = useQuery({
    queryKey: ["teacher-courses", "announcement-targets"],
    queryFn: getTeacherCourses,
    staleTime: 60 * 1000,
  });

  const teacherStudentsQuery = useQuery({
    queryKey: ["teacher-students", "announcement-targets"],
    queryFn: getTeacherStudents,
    staleTime: 60 * 1000,
  });

  const announcements = useMemo(() => {
    return Array.isArray(outgoingQuery.data) ? outgoingQuery.data : [];
  }, [outgoingQuery.data]);

  const counts = useMemo(
    () => ({
      all: announcements.length,
      course: announcements.filter((item) => item.targetType === "course").length,
      single_user: announcements.filter((item) => item.targetType === "single_user")
        .length,
    }),
    [announcements]
  );

  const filteredAnnouncements = useMemo(() => {
    const byTab =
      activeTab === "all"
        ? announcements
        : announcements.filter((item) => item.targetType === activeTab);

    const bySearch = debouncedSearch
      ? byTab.filter((item) => {
          const title = String(item.title || "").toLowerCase();
          const message = String(item.message || "").toLowerCase();
          return title.includes(debouncedSearch) || message.includes(debouncedSearch);
        })
      : byTab;

    return [...bySearch].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [activeTab, announcements, debouncedSearch]);

  const sendMutation = useMutation({
    mutationFn: createTeacherAnnouncement,
    onSuccess: (response) => {
      const reached = Number(response?.data?.studentsReached || 0);
      const emailsSent = Number(response?.data?.emailsSent || 0);
      toast.success(
        reached > 0
          ? `Announcement sent to ${reached} students`
          : "Announcement posted"
      );
      if (emailsSent > 0) {
        toast.success(`${emailsSent} email notifications sent`);
      }
      setSendModalOpen(false);
      setSendForm(initialSendForm);
      setSendErrors({});
      queryClient.invalidateQueries({ queryKey: ["teacher-announcements"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send announcement");
    },
  });

  const teacherCourses = Array.isArray(teacherCoursesQuery.data)
    ? teacherCoursesQuery.data
    : [];
  const teacherStudents = Array.isArray(teacherStudentsQuery.data)
    ? teacherStudentsQuery.data
    : [];

  const validateSendForm = () => {
    const next = {};
    const title = String(sendForm.title || "").trim();
    const message = String(sendForm.message || "").trim();

    if (!["course", "single_user"].includes(sendForm.targetType)) {
      next.targetType = "Invalid recipient type";
    }
    if (!sendForm.targetId) {
      next.targetId =
        sendForm.targetType === "single_user"
          ? "Please select a student"
          : "Please select a course";
    }
    if (title.length < 5) next.title = "Title must be at least 5 characters";
    if (title.length > 100) next.title = "Title must be at most 100 characters";
    if (message.length < 10) next.message = "Message must be at least 10 characters";

    setSendErrors(next);
    return Object.keys(next).length < 1;
  };

  const submitSendAnnouncement = () => {
    if (!validateSendForm()) return;
    sendMutation.mutate({
      targetType: sendForm.targetType,
      targetId: sendForm.targetId,
      title: String(sendForm.title || "").trim(),
      message: String(sendForm.message || "").trim(),
      sendEmail: Boolean(sendForm.sendEmail),
    });
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl text-slate-900">Announcements</h1>
          <p className="text-sm text-slate-500">
            Showing only outgoing announcements sent by you.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setSendForm(initialSendForm);
            setSendErrors({});
            setSendModalOpen(true);
          }}
        >
          Send Announcement
        </button>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Total Outgoing
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{counts.all}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
            Course Announcements
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{counts.course}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
            Single Student
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{counts.single_user}</p>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                activeTab === tab.value
                  ? "bg-primary text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label} ({counts[tab.value] || 0})
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search announcements..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full max-w-sm rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </section>

      <section className="space-y-4">
        {outgoingQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`teacher-outgoing-skeleton-${index}`}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-3 h-5 w-2/3" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-10/12" />
            </div>
          ))
        ) : outgoingQuery.isError ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            <p className="font-semibold">Failed to load outgoing announcements</p>
            <button className="btn-outline mt-3" onClick={() => outgoingQuery.refetch()}>
              Try Again
            </button>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No outgoing announcements found.
          </div>
        ) : (
          filteredAnnouncements.map((item) => {
            const message = String(item.message || "");
            const isExpanded = Boolean(expanded[item.id]);
            const shouldTrim = message.length > 180 && !isExpanded;
            const displayMessage = shouldTrim ? `${message.slice(0, 180)}...` : message;

            return (
              <div
                key={item.id}
                className="rounded-3xl border-l-4 border-primary bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {resolveTargetLabel(item)}
                    </span>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {item.targetType === "single_user" ? "Single Student" : "Course"}
                    </span>
                    {item.sendEmail ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Email Enabled
                      </span>
                    ) : null}
                  </div>
                </div>

                <h3 className="mt-3 font-heading text-xl text-slate-900">
                  {item.title || "Announcement"}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{displayMessage}</p>

                {message.length > 180 ? (
                  <button
                    className="mt-2 text-xs font-semibold text-primary"
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [item.id]: !prev[item.id],
                      }))
                    }
                  >
                    {isExpanded ? "Show less" : "Read more"}
                  </button>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span>{formatDateTime(item.createdAt)}</span>
                  <span>{getRelativeTime(item.createdAt)}</span>
                  <span>{Number(item.studentsReached || 0)} recipients</span>
                </div>
              </div>
            );
          })
        )}
      </section>

      {sendModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => {
              if (sendMutation.isPending) return;
              setSendModalOpen(false);
            }}
          />
          <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-heading text-2xl text-slate-900">Send Announcement</h3>
                <p className="text-xs text-slate-500">
                  Send to students in your assigned courses or one specific student.
                </p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500"
                onClick={() => {
                  if (sendMutation.isPending) return;
                  setSendModalOpen(false);
                }}
              >
                X
              </button>
            </div>

            {teacherCoursesQuery.isLoading || teacherStudentsQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                {teacherCourses.length < 1 && teacherStudents.length < 1 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    No eligible students found in your assigned courses.
                  </div>
                ) : null}

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">
                    Recipient Type
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                        sendForm.targetType === "course"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 text-slate-600"
                      }`}
                      onClick={() =>
                        setSendForm((prev) => ({
                          ...prev,
                          targetType: "course",
                          targetId: "",
                        }))
                      }
                    >
                      Course Students
                    </button>
                    <button
                      type="button"
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                        sendForm.targetType === "single_user"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 text-slate-600"
                      }`}
                      onClick={() =>
                        setSendForm((prev) => ({
                          ...prev,
                          targetType: "single_user",
                          targetId: "",
                        }))
                      }
                    >
                      Single Student
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-rose-500">{sendErrors.targetType || ""}</p>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">
                    {sendForm.targetType === "single_user" ? "Student" : "Course"}
                  </label>
                  <select
                    value={sendForm.targetId}
                    onChange={(event) =>
                      setSendForm((prev) => ({ ...prev, targetId: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">
                      {sendForm.targetType === "single_user"
                        ? "Select student"
                        : "Select your course"}
                    </option>
                    {sendForm.targetType === "single_user"
                      ? teacherStudents.map((student) => (
                          <option key={student.uid} value={student.uid}>
                            {student.fullName || student.email || "Student"}
                          </option>
                        ))
                      : teacherCourses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.title}
                          </option>
                        ))}
                  </select>
                  <p className="mt-1 text-xs text-rose-500">{sendErrors.targetId || ""}</p>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Title</label>
                  <input
                    value={sendForm.title}
                    onChange={(event) =>
                      setSendForm((prev) => ({ ...prev, title: event.target.value }))
                    }
                    maxLength={100}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Enter announcement title"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-rose-500">{sendErrors.title || ""}</p>
                    <p className="text-xs text-slate-400">{sendForm.title.length}/100</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">
                    Message
                  </label>
                  <textarea
                    value={sendForm.message}
                    onChange={(event) =>
                      setSendForm((prev) => ({ ...prev, message: event.target.value }))
                    }
                    rows={6}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Write your announcement..."
                  />
                  <p className="mt-1 text-xs text-rose-500">{sendErrors.message || ""}</p>
                </div>

                <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Send email notification
                  </span>
                  <input
                    type="checkbox"
                    checked={sendForm.sendEmail}
                    onChange={(event) =>
                      setSendForm((prev) => ({
                        ...prev,
                        sendEmail: event.target.checked,
                      }))
                    }
                  />
                </label>

                <button
                  className="btn-primary w-full"
                  onClick={submitSendAnnouncement}
                  disabled={
                    sendMutation.isPending ||
                    (sendForm.targetType === "single_user"
                      ? teacherStudents.length < 1
                      : teacherCourses.length < 1)
                  }
                >
                  {sendMutation.isPending ? "Sending..." : "Send Announcement"}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default TeacherAnnouncements;
