import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const methods = ["All", "JazzCash", "EasyPaisa", "Bank Transfer"];
const statuses = ["All", "Paid", "Pending", "Failed", "Refunded"];

const transactions = [
  {
    id: "TX-1001",
    student: "Hassan Ali",
    course: "Class XI - Pre-Medical",
    method: "JazzCash",
    amount: 3500,
    date: "Mar 12, 2026",
    time: "10:15 AM",
    status: "Paid",
    reference: "JC-443289",
    discount: 0,
    promo: "-",
  },
  {
    id: "TX-1002",
    student: "Ayesha Noor",
    course: "Pre-Entrance Test",
    method: "Bank Transfer",
    amount: 4200,
    date: "Mar 12, 2026",
    time: "12:05 PM",
    status: "Pending",
    reference: "BT-552190",
    discount: 200,
    promo: "SUM200",
  },
  {
    id: "TX-1003",
    student: "Bilal Khan",
    course: "Class XII - Pre-Medical",
    method: "EasyPaisa",
    amount: 3800,
    date: "Mar 11, 2026",
    time: "09:40 AM",
    status: "Paid",
    reference: "EP-772109",
    discount: 0,
    promo: "-",
  },
  {
    id: "TX-1004",
    student: "Sana Akbar",
    course: "Pre-Entrance Test",
    method: "Bank Transfer",
    amount: 4200,
    date: "Mar 10, 2026",
    time: "04:20 PM",
    status: "Failed",
    reference: "BT-998011",
    discount: 0,
    promo: "-",
  },
];

const methodStyles = {
  JazzCash: "bg-rose-50 text-rose-600",
  EasyPaisa: "bg-emerald-50 text-emerald-600",
  "Bank Transfer": "bg-blue-50 text-blue-600",
};

const statusStyles = {
  Paid: "bg-emerald-50 text-emerald-600",
  Pending: "bg-amber-50 text-amber-600",
  Failed: "bg-rose-50 text-rose-600",
  Refunded: "bg-slate-100 text-slate-500",
};

function Transactions() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("All");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [detailTx, setDetailTx] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const perPage = 20;

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      const matchesSearch =
        !query ||
        tx.student.toLowerCase().includes(query) ||
        tx.id.toLowerCase().includes(query);
      const matchesMethod = method === "All" || tx.method === method;
      const matchesStatus = status === "All" || tx.status === status;
      return matchesSearch && matchesMethod && matchesStatus;
    });
  }, [method, search, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const stats = {
    total: "PKR 4.2M",
    month: "PKR 820k",
    pending: 12,
    failed: 5,
  };

  const exportCSV = () => {
    const rows = [
      ["Transaction ID", "Student", "Course", "Method", "Amount", "Status"],
      ...transactions.map((tx) => [
        tx.id,
        tx.student,
        tx.course,
        tx.method,
        tx.amount,
        tx.status,
      ]),
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Transactions</h2>
          <p className="text-sm text-slate-500">
            Monitor transactions, verification, and refunds.
          </p>
        </div>
        <button className="btn-outline" onClick={exportCSV}>
          Export CSV
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={`stat-${index}`} className="glass-card space-y-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-6 w-1/2" />
              </div>
            ))
          : [
              { label: "Total Collected PKR", value: stats.total },
              { label: "This Month PKR", value: stats.month },
              { label: "Pending Verification", value: stats.pending },
              { label: "Failed Transactions", value: stats.failed },
            ].map((item) => (
              <div key={item.label} className="glass-card">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by student or transaction..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <div className="flex gap-2">
          {methods.map((item) => (
            <button
              key={item}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                method === item
                  ? "bg-primary text-white"
                  : "border border-slate-200 text-slate-600"
              }`}
              onClick={() => setMethod(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item === "All" ? "Status: All" : item}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm"
          />
          <span className="text-sm text-slate-400">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 p-4 lg:hidden">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={`tx-card-${index}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="skeleton h-4 w-1/2" />
                <div className="mt-3 space-y-2">
                  <div className="skeleton h-3 w-3/4" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
            ))
          ) : paginated.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No transactions found.
            </div>
          ) : (
            paginated.map((tx) => (
              <div
                key={tx.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Transaction ID
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-500">{tx.id}</p>
                    <p className="mt-2 font-semibold text-slate-900">{tx.student}</p>
                    <p className="text-xs text-slate-500">{tx.course}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${methodStyles[tx.method]}`}
                  >
                    {tx.method}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500">
                  <div>
                    <p className="uppercase tracking-[0.2em] text-slate-400">Amount</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      PKR {tx.amount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.2em] text-slate-400">Date</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {tx.date} · {tx.time}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[tx.status]}`}
                  >
                    {tx.status}
                  </span>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                    onClick={() => setDetailTx(tx)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Course</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Amount PKR</th>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`row-${index}`} className="border-b border-slate-100">
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-32" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-32" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-16" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-12" />
                    </td>
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                paginated.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-100">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {tx.id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {tx.student
                            .split(" ")
                            .slice(0, 2)
                            .map((word) => word[0])
                            .join("")}
                        </div>
                        <span className="text-slate-900">{tx.student}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{tx.course}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${methodStyles[tx.method]}`}
                      >
                        {tx.method}
                      </span>
                    </td>
                    <td className="px-6 py-4">PKR {tx.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {tx.date} - {tx.time}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[tx.status]}`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-primary"
                        onClick={() => setDetailTx(tx)}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="currentColor"
                        >
                          <path d="M12 5c5 0 9.3 3.1 11 7.5C21.3 16.9 17 20 12 20S2.7 16.9 1 12.5C2.7 8.1 7 5 12 5zm0 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-4 text-sm text-slate-500 lg:px-6">
          <span>
            Page {page} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-full border border-slate-200 px-3 py-1"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              Prev
            </button>
            <button
              className="rounded-full border border-slate-200 px-3 py-1"
              onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
              disabled={page === pageCount}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {detailTx && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setDetailTx(null)}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-heading text-2xl text-slate-900">Transaction Detail</h3>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">Transaction ID:</span>{" "}
                {detailTx.id}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Date:</span>{" "}
                {detailTx.date} - {detailTx.time}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Student:</span>{" "}
                {detailTx.student}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Course:</span>{" "}
                {detailTx.course}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Payment Method:</span>{" "}
                {detailTx.method} ({detailTx.reference})
              </p>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Course Fee</span>
                <span>PKR {detailTx.amount + detailTx.discount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Discount</span>
                <span>-PKR {detailTx.discount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Promo Code</span>
                <span>{detailTx.promo}</span>
              </div>
              <div className="mt-2 flex items-center justify-between font-semibold text-slate-900">
                <span>Final Amount</span>
                <span>PKR {detailTx.amount}</span>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase text-slate-400">Status Timeline</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-600">
                  Initiated
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-600">
                  Processing
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-600">
                  Completed
                </span>
              </div>
            </div>
            <button className="btn-primary mt-6 w-full">Download Receipt</button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default Transactions;
