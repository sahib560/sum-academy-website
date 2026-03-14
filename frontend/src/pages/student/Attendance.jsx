import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const attendanceRows = [
  { id: 1, date: "Mar 12, 2026", className: "Biology XI", status: "Present" },
  { id: 2, date: "Mar 10, 2026", className: "Chemistry XII", status: "Present" },
  { id: 3, date: "Mar 08, 2026", className: "Physics XI", status: "Absent" },
  { id: 4, date: "Mar 06, 2026", className: "English XI", status: "Present" },
];

function StudentAttendance() {
  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Attendance</h1>
        <p className="text-sm text-slate-500">
          Track your attendance across sessions.
        </p>
      </motion.section>

      <motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                <th className="py-2">Date</th>
                <th className="py-2">Class</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="py-3">{row.date}</td>
                  <td className="py-3">{row.className}</td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        row.status === "Present"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-rose-50 text-rose-600"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>
    </div>
  );
}

export default StudentAttendance;
