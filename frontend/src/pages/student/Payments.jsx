import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const payments = [
  {
    id: 1,
    course: "Biology Masterclass XI",
    amount: 1200,
    due: "Mar 15, 2026",
    status: "Due Soon",
  },
  {
    id: 2,
    course: "Chemistry Quick Revision",
    amount: 1500,
    due: "Mar 20, 2026",
    status: "Upcoming",
  },
  {
    id: 3,
    course: "Physics Practice Lab",
    amount: 900,
    due: "Mar 08, 2026",
    status: "Overdue",
  },
];

function StudentPayments() {
  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Payments</h1>
        <p className="text-sm text-slate-500">
          Manage your installment plans and payment history.
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
                <th className="py-2">Course</th>
                <th className="py-2">Amount (PKR)</th>
                <th className="py-2">Due Date</th>
                <th className="py-2">Status</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="py-3">{item.course}</td>
                  <td className="py-3">PKR {item.amount}</td>
                  <td className="py-3 text-slate-500">{item.due}</td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        item.status === "Overdue"
                          ? "bg-rose-50 text-rose-600"
                          : item.status === "Due Soon"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <button className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                      Pay Now
                    </button>
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

export default StudentPayments;
