import { useMemo, useState } from "react";
import { motion } from "framer-motion";

const paymentMethods = ["All", "JazzCash", "EasyPaisa", "Bank Transfer"];
const statusFilters = ["All", "Paid", "Pending", "Failed", "Overdue"];

const transactions = [
  {
    id: 1,
    student: "Hassan Ali",
    course: "Class XI - Pre-Medical",
    method: "JazzCash",
    amount: 3500,
    date: "Mar 12, 2026",
    status: "Paid",
  },
  {
    id: 2,
    student: "Ayesha Noor",
    course: "Pre-Entrance Test",
    method: "Bank Transfer",
    amount: 4200,
    date: "Mar 12, 2026",
    status: "Pending",
  },
  {
    id: 3,
    student: "Bilal Khan",
    course: "Class XII - Pre-Medical",
    method: "EasyPaisa",
    amount: 3800,
    date: "Mar 11, 2026",
    status: "Paid",
  },
  {
    id: 4,
    student: "Sana Akbar",
    course: "Pre-Entrance Test",
    method: "Bank Transfer",
    amount: 4200,
    date: "Mar 10, 2026",
    status: "Overdue",
  },
  {
    id: 5,
    student: "Usman Raza",
    course: "Class XI - Pre-Medical",
    method: "JazzCash",
    amount: 3500,
    date: "Mar 09, 2026",
    status: "Failed",
  },
];

const pendingTransfers = [
  {
    id: 1,
    student: "Ayesha Noor",
    course: "Pre-Entrance Test",
    amount: 4200,
  },
  {
    id: 2,
    student: "Sana Akbar",
    course: "Pre-Entrance Test",
    amount: 4200,
  },
];

const installments = [
  {
    id: 1,
    student: "Hassan Ali",
    course: "Class XI - Pre-Medical",
    total: 12000,
    paid: 8000,
    remaining: 4000,
    nextDue: "Apr 05, 2026",
    status: "Active",
  },
  {
    id: 2,
    student: "Bilal Khan",
    course: "Class XII - Pre-Medical",
    total: 14000,
    paid: 6000,
    remaining: 8000,
    nextDue: "Apr 12, 2026",
    status: "Active",
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
  Overdue: "bg-purple-50 text-purple-600",
};

function Payments() {
  const [tab, setTab] = useState("Transactions");
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("All");
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);
  const [activeTransaction, setActiveTransaction] = useState(null);
  const [activeInstallment, setActiveInstallment] = useState(null);
  const perPage = 10;

  useMemo(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useMemo(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      const matchesSearch =
        !query || tx.student.toLowerCase().includes(query);
      const matchesMethod = method === "All" || tx.method === method;
      const matchesStatus = status === "All" || tx.status === status;
      return matchesSearch && matchesMethod && matchesStatus;
    });
  }, [method, search, status]);

  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / perPage));
  const paginated = filteredTransactions.slice(
    (page - 1) * perPage,
    page * perPage
  );

  const stats = {
    total: "PKR 4.2M",
    month: "PKR 820k",
    pending: 12,
    overdue: 5,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">
            Payments & Transactions
          </h2>
          <p className="text-sm text-slate-500">
            Track revenue, payments, and installment plans.
          </p>
        </div>
        <button className="btn-outline">Export CSV</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={`stat-skeleton-${index}`} className="glass-card space-y-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-6 w-1/2" />
              </div>
            ))
          : [
              { label: "Total Revenue", value: stats.total },
              { label: "This Month Revenue", value: stats.month },
              { label: "Pending Verifications", value: stats.pending },
              { label: "Overdue Installments", value: stats.overdue },
            ].map((item) => (
              <div key={item.label} className="glass-card">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {["Transactions", "Bank Transfer", "Installments"].map((item) => (
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

      {tab === "Transactions" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search by student..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex gap-2">
              {paymentMethods.map((item) => (
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
              {statusFilters.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "Status: All" : item}
                </option>
              ))}
            </select>
            <button className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
              Date Range
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="space-y-3 p-4 lg:hidden">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={`tx-card-skeleton-${index}`} className="rounded-2xl border border-slate-200 p-4">
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
                          Student
                        </p>
                        <p className="mt-1 font-semibold text-slate-900">{tx.student}</p>
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
                        <p className="mt-1 text-sm text-slate-600">{tx.date}</p>
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
                        onClick={() => setActiveTransaction(tx)}
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
                    <th className="px-6 py-4">Student Name</th>
                    <th className="px-6 py-4">Course</th>
                    <th className="px-6 py-4">Method</th>
                    <th className="px-6 py-4">Amount PKR</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={`tx-skeleton-${index}`} className="border-b border-slate-100">
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
                          <div className="skeleton h-6 w-24" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="skeleton h-6 w-20" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="skeleton h-6 w-16" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="skeleton h-6 w-24" />
                        </td>
                      </tr>
                    ))
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((tx) => (
                      <tr key={tx.id} className="border-b border-slate-100">
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {tx.student}
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
                        <td className="px-6 py-4 text-slate-500">{tx.date}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[tx.status]}`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button className="rounded-full border border-slate-200 px-3 py-1 text-xs">
                              View Receipt
                            </button>
                            {tx.method === "Bank Transfer" && (
                              <button className="rounded-full border border-slate-200 px-3 py-1 text-xs">
                                Verify
                              </button>
                            )}
                            <button className="rounded-full border border-slate-200 px-3 py-1 text-xs">
                              Mark Paid
                            </button>
                          </div>
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
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1"
                  onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
                  disabled={page === pageCount}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "Bank Transfer" && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`bank-skeleton-${index}`} className="glass-card space-y-3">
                <div className="skeleton h-32 w-full" />
                <div className="skeleton h-4 w-1/2" />
                <div className="skeleton h-4 w-3/4" />
              </div>
            ))
          ) : (
            pendingTransfers.map((transfer) => (
              <div key={transfer.id} className="glass-card">
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
                  Receipt Placeholder
                </div>
                <h3 className="mt-4 font-heading text-lg text-slate-900">
                  {transfer.student}
                </h3>
                <p className="text-sm text-slate-500">{transfer.course}</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  PKR {transfer.amount.toLocaleString()}
                </p>
                <div className="mt-4 flex gap-2">
                  <button className="btn-primary w-full">Approve</button>
                  <button className="rounded-full border border-slate-200 px-4 py-2 text-sm text-rose-500">
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "Installments" && (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-3 p-4 lg:hidden">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={`inst-card-skeleton-${index}`} className="rounded-2xl border border-slate-200 p-4">
                  <div className="skeleton h-4 w-1/2" />
                  <div className="mt-3 space-y-2">
                    <div className="skeleton h-3 w-3/4" />
                    <div className="skeleton h-3 w-1/3" />
                  </div>
                </div>
              ))
            ) : (
              installments.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Student
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">{plan.student}</p>
                      <p className="text-xs text-slate-500">{plan.course}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                      {plan.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500">
                    <div>
                      <p className="uppercase tracking-[0.2em] text-slate-400">Total</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        PKR {plan.total.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.2em] text-slate-400">Paid</p>
                      <p className="mt-1 text-sm text-slate-600">
                        PKR {plan.paid.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.2em] text-slate-400">Remaining</p>
                      <p className="mt-1 text-sm text-slate-600">
                        PKR {plan.remaining.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.2em] text-slate-400">Next Due</p>
                      <p className="mt-1 text-sm text-slate-600">{plan.nextDue}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                      onClick={() => setActiveInstallment(plan)}
                    >
                      View Details
                    </button>
                    <button className="rounded-full border border-slate-200 px-3 py-1 text-xs">
                      Override
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
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Course</th>
                  <th className="px-6 py-4">Total Fee</th>
                  <th className="px-6 py-4">Paid</th>
                  <th className="px-6 py-4">Remaining</th>
                  <th className="px-6 py-4">Next Due Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={`inst-skeleton-${index}`} className="border-b border-slate-100">
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
                        <div className="skeleton h-6 w-20" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="skeleton h-6 w-24" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="skeleton h-6 w-16" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="skeleton h-6 w-16" />
                      </td>
                    </tr>
                  ))
                ) : (
                  installments.map((plan) => (
                    <tr key={plan.id} className="border-b border-slate-100">
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {plan.student}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{plan.course}</td>
                      <td className="px-6 py-4">PKR {plan.total.toLocaleString()}</td>
                      <td className="px-6 py-4">PKR {plan.paid.toLocaleString()}</td>
                      <td className="px-6 py-4">PKR {plan.remaining.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-500">{plan.nextDue}</td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                          {plan.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="rounded-full border border-slate-200 px-3 py-1 text-xs">
                          Override
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 lg:hidden"
          onClick={() => setActiveTransaction(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Transaction
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {activeTransaction.student}
                </h3>
                <p className="text-sm text-slate-500">{activeTransaction.course}</p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500"
                onClick={() => setActiveTransaction(null)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Method</span>
                <span>{activeTransaction.method}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Amount</span>
                <span className="font-semibold text-slate-900">
                  PKR {activeTransaction.amount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Date</span>
                <span>{activeTransaction.date}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Status</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[activeTransaction.status]}`}
                >
                  {activeTransaction.status}
                </span>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="btn-outline flex-1">View Receipt</button>
              {activeTransaction.method === "Bank Transfer" && (
                <button className="btn-outline flex-1">Verify</button>
              )}
              <button className="btn-primary flex-1">Mark Paid</button>
            </div>
          </div>
        </div>
      )}

      {activeInstallment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 lg:hidden"
          onClick={() => setActiveInstallment(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Installment Plan
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {activeInstallment.student}
                </h3>
                <p className="text-sm text-slate-500">{activeInstallment.course}</p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500"
                onClick={() => setActiveInstallment(null)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Total Fee</span>
                <span className="font-semibold text-slate-900">
                  PKR {activeInstallment.total.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Paid</span>
                <span>PKR {activeInstallment.paid.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Remaining</span>
                <span>PKR {activeInstallment.remaining.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Next Due</span>
                <span>{activeInstallment.nextDue}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Status</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                  {activeInstallment.status}
                </span>
              </div>
            </div>
            <button className="btn-primary mt-5 w-full">Override</button>
          </div>
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

export default Payments;
