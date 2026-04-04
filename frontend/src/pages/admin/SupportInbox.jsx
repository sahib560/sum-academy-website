import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import {
  deleteSupportMessage,
  getSupportMessages,
  markSupportMessageRead,
  replySupportMessage,
} from "../../services/admin.service.js";

const STATUS_OPTIONS = ["all", "unread", "read", "replied"];
const SOURCE_OPTIONS = ["all", "student", "public"];

function SupportInbox() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-support-messages", status, source, search],
    queryFn: () => getSupportMessages({ status, source, search }),
    staleTime: 15000,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-support-messages"] });

  const markReadMutation = useMutation({
    mutationFn: ({ id, isRead }) => markSupportMessageRead(id, isRead),
    onSuccess: (_, vars) => {
      toast.success(vars.isRead ? "Marked as read" : "Marked as unread");
      refresh();
      if (selected?.id === vars.id) {
        setSelected((prev) => (prev ? { ...prev, isRead: vars.isRead } : prev));
      }
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteSupportMessage(id),
    onSuccess: () => {
      toast.success("Message deleted");
      refresh();
      setSelected(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to delete message");
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, reply }) => replySupportMessage(id, reply),
    onSuccess: () => {
      toast.success("Reply sent");
      refresh();
      setReplyMessage("");
      setSelected(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send reply");
    },
  });

  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  return (
    <div className="space-y-6">
      <Toaster position="top-left" />
      <div>
        <h2 className="font-heading text-3xl text-slate-900">Support Inbox</h2>
        <p className="text-sm text-slate-500">
          Contact and help/support messages from students and public pages.
        </p>
      </div>

      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(event) => setSource(event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          {SOURCE_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email, subject..."
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
        />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : rows.length < 1 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    No support messages
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-6 py-4 font-semibold text-slate-900">{row.name || "-"}</td>
                    <td className="px-6 py-4 text-slate-600">{row.email || "-"}</td>
                    <td className="px-6 py-4 capitalize text-slate-600">{row.source || "-"}</td>
                    <td className="px-6 py-4 text-slate-600">{row.subject || "-"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          row.status === "unread"
                            ? "bg-amber-50 text-amber-700"
                            : row.status === "replied"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.status || "unread"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                          onClick={() => setSelected(row)}
                        >
                          View
                        </button>
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                          onClick={() =>
                            markReadMutation.mutate({
                              id: row.id,
                              isRead: !row.isRead,
                            })
                          }
                        >
                          {row.isRead ? "Unread" : "Read"}
                        </button>
                        <button
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600"
                          onClick={() => deleteMutation.mutate(row.id)}
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
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => {
              setSelected(null);
              setReplyMessage("");
            }}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-2xl text-slate-900">Support Message</h3>
                <p className="text-sm text-slate-500">{selected.subject || "-"}</p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                onClick={() => {
                  setSelected(null);
                  setReplyMessage("");
                }}
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm">
              <p>
                <span className="text-slate-500">Name:</span> {selected.name || "-"}
              </p>
              <p>
                <span className="text-slate-500">Email:</span> {selected.email || "-"}
              </p>
              <p>
                <span className="text-slate-500">Category:</span> {selected.category || "-"}
              </p>
              <p>
                <span className="text-slate-500">Message:</span> {selected.message || "-"}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Reply Message
              </label>
              <textarea
                rows={4}
                value={replyMessage}
                onChange={(event) => setReplyMessage(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Write your reply..."
              />
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm"
                onClick={() => markReadMutation.mutate({ id: selected.id, isRead: true })}
              >
                Mark Read
              </button>
              <button
                className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-600"
                onClick={() => deleteMutation.mutate(selected.id)}
              >
                Delete
              </button>
              <button
                className="btn-primary"
                disabled={!replyMessage.trim() || replyMutation.isPending}
                onClick={() =>
                  replyMutation.mutate({
                    id: selected.id,
                    reply: replyMessage.trim(),
                  })
                }
              >
                {replyMutation.isPending ? "Sending..." : "Send Reply"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default SupportInbox;
