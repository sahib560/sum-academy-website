import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useParams } from "react-router-dom";

const tabs = ["Students", "Schedule", "Attendance", "Announcements"];

const mockStudents = [
  { id: 1, name: "Hassan Ali", progress: 82 },
  { id: 2, name: "Ayesha Noor", progress: 74 },
  { id: 3, name: "Bilal Khan", progress: 66 },
];

const sessions = [
  { id: 1, date: "Mar 15, 2026", time: "4:00 PM", duration: "90 min", link: "Zoom", attendance: 30 },
  { id: 2, date: "Mar 17, 2026", time: "4:00 PM", duration: "90 min", link: "Meet", attendance: 28 },
];

const attendanceDates = ["Mar 01", "Mar 03", "Mar 05", "Mar 07"];

const announcements = [
  { id: 1, text: "Midterm practice test on Friday.", date: "Mar 10, 2026" },
  { id: 2, text: "Submit assignment by next Tuesday.", date: "Mar 08, 2026" },
];

function ClassDetail() {
  const { id } = useParams();
  const [tab, setTab] = useState("Students");
  const [loading, setLoading] = useState(true);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [toast, setToast] = useState(null);

  useMemo(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useMemo(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="space-y-6">
      <div className="glass-card">
        <h2 className="font-heading text-2xl text-slate-900">Class Detail</h2>
        <p className="text-sm text-slate-500">Batch ID: {id}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
          <span>Teacher: Mr. Sikander Ali Qureshi</span>
          <span>Students: 36</span>
          <span>Status: Active</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {tabs.map((item) => (
          <button
            key={item}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === item
                ? "bg-primary text-white"
                : "border border-slate-200 text-slate-600"
            }`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Students" && (
        <div className="glass-card">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((ignore, index) => (
                <div key={`student-skeleton-${index}`} className="skeleton h-8 w-full" />
              ))}
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-3">Student</th>
                  <th className="pb-3">Progress</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockStudents.map((student) => (
                  <tr key={student.id} className="border-t border-slate-100">
                    <td className="py-3 font-semibold text-slate-900">{student.name}</td>
                    <td className="py-3">
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${student.progress}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button className="rounded-full border border-slate-200 px-3 py-1 text-xs">
                          Add
                        </button>
                        <button className="rounded-full border border-slate-200 px-3 py-1 text-xs text-rose-500">
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "Schedule" && (
        <div className="glass-card">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xl text-slate-900">Class Schedule</h3>
            <button className="btn-outline" onClick={() => setShowSessionModal(true)}>
              Add Session
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            {sessions.map((session) => (
              <div key={session.id} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>{session.date}</span>
                  <span>{session.time}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-slate-500">
                  <span>{session.duration}</span>
                  <span>{session.link}</span>
                  <span>{session.attendance} attended</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "Attendance" && (
        <div className="glass-card">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-3">Student</th>
                  {attendanceDates.map((date) => (
                    <th key={date} className="pb-3">
                      {date}
                    </th>
                  ))}
                  <th className="pb-3">Summary</th>
                </tr>
              </thead>
              <tbody>
                {mockStudents.map((student) => (
                  <tr key={student.id} className="border-t border-slate-100">
                    <td className="py-3 font-semibold text-slate-900">{student.name}</td>
                    {attendanceDates.map((date) => (
                      <td key={date} className="py-3">
                        <button className="rounded-full border border-slate-200 px-3 py-1 text-xs">
                          Present
                        </button>
                      </td>
                    ))}
                    <td className="py-3 text-slate-500">{student.progress}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-primary mt-4">Save Attendance</button>
        </div>
      )}

      {tab === "Announcements" && (
        <div className="glass-card">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xl text-slate-900">Announcements</h3>
            <button className="btn-outline" onClick={() => setShowAnnouncementModal(true)}>
              Post Announcement
            </button>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {announcements.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                <p className="font-semibold text-slate-900">{item.text}</p>
                <p className="text-xs text-slate-400">{item.date}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSessionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button className="absolute inset-0 bg-slate-900/40" onClick={() => setShowSessionModal(false)} />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-heading text-xl text-slate-900">Add Session</h3>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" type="date" />
              <input className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" type="time" />
              <input className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Meeting link" />
              <button className="btn-primary w-full" onClick={() => setShowSessionModal(false)}>
                Save Session
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showAnnouncementModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button className="absolute inset-0 bg-slate-900/40" onClick={() => setShowAnnouncementModal(false)} />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-heading text-xl text-slate-900">Post Announcement</h3>
            <textarea className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" rows={3} placeholder="Write announcement..." />
            <button className="btn-primary mt-4 w-full" onClick={() => setShowAnnouncementModal(false)}>
              Post
            </button>
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

export default ClassDetail;
