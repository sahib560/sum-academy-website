import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "../../components/Skeleton.jsx";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const transactions = [
  {
    id: "TXN-1023",
    course: "Biology Masterclass XI",
    method: "JazzCash",
    amount: 1200,
    date: "Mar 12, 2026 09:20 AM",
    status: "Paid",
  },
  {
    id: "TXN-1024",
    course: "Chemistry Quick Revision",
    method: "EasyPaisa",
    amount: 1500,
    date: "Mar 10, 2026 02:45 PM",
    status: "Pending",
  },
  {
    id: "TXN-1025",
    course: "Physics Practice Lab",
    method: "Bank Transfer",
    amount: 900,
    date: "Mar 08, 2026 05:00 PM",
    status: "Failed",
  },
];

const plans = [
  {
    id: 1,
    course: "Biology Masterclass XI",
    teacher: "Mr. Sikander Ali Qureshi",
    total: 6000,
    perInstallment: 1000,
    paid: 3000,
    progress: 50,
    installments: [
      { id: 1, amount: 1000, due: "Feb 15, 2026", paid: "Feb 14, 2026", status: "Paid" },
      { id: 2, amount: 1000, due: "Mar 15, 2026", paid: "-", status: "Overdue" },
      { id: 3, amount: 1000, due: "Apr 15, 2026", paid: "-", status: "Upcoming" },
    ],
  },
];

const invoices = [
  {
    id: "INV-2026-001",
    course: "Biology Masterclass XI",
    date: "Mar 12, 2026",
    amount: 1200,
    method: "JazzCash",
    status: "Paid",
  },
];

const methodStyles = {
  JazzCash: "bg-rose-500",
  EasyPaisa: "bg-emerald-500",
  "Bank Transfer": "bg-blue-500",
};

function StudentPayments() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Transaction History");
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeTx, setActiveTx] = useState(null);
  const [activeInvoice, setActiveInvoice] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(() => {
    return {
      totalPaid: 4200,
      plans: plans.length,
      nextDue: 1000,
    };
  }, []);

  const overduePlan = plans.find((plan) =>
    plan.installments.some((item) => item.status === "Overdue")
  );

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Payments & Billing</h1>
      </motion.section>

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={`stat-${index}`} className="glass-card border border-slate-200">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-4 h-8 w-1/2" />
              </div>
            ))
          : [
              { label: "Total Paid PKR", value: stats.totalPaid },
              { label: "Active Installment Plans", value: stats.plans },
              { label: "Next Due Amount PKR", value: stats.nextDue },
            ].map((card) => (
              <div key={card.label} className="glass-card border border-slate-200">
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {card.value}
                </p>
              </div>
            ))}
      </motion.section>

      {overduePlan && (
        <motion.section
          {...fadeUp}
          className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600"
        >
          You have an overdue installment of PKR{" "}
          {overduePlan.installments.find((i) => i.status === "Overdue")?.amount} for{" "}
          {overduePlan.course}
          <button className="btn-primary ml-4">Pay Now</button>
        </motion.section>
      )}

      <motion.section {...fadeUp} className="flex flex-wrap items-center gap-3">
        {["Transaction History", "Installment Plans", "Invoices"].map((item) => (
          <button
            key={item}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              tab === item
                ? "bg-primary text-white"
                : "border border-slate-200 text-slate-600"
            }`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </motion.section>

      {tab === "Transaction History" && (
        <motion.section {...fadeUp} className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search transactions..."
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
            />
            <select className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
              <option>All Methods</option>
              <option>JazzCash</option>
              <option>EasyPaisa</option>
              <option>Bank Transfer</option>
            </select>
            <input
              type="date"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
            />
          </div>

          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : transactions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No transactions yet.
            </div>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-10 w-10 rounded-full ${methodStyles[tx.method]}`} />
                  <div>
                    <p className="font-semibold text-slate-900">{tx.course}</p>
                    <p className="text-xs text-slate-400 font-mono">{tx.id}</p>
                    <p className="text-xs text-slate-500">{tx.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-slate-900">PKR {tx.amount}</p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      tx.status === "Paid"
                        ? "bg-emerald-50 text-emerald-600"
                        : tx.status === "Pending"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {tx.status}
                  </span>
                </div>
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                  onClick={() => setToast({ message: "Invoice downloaded" })}
                >
                  Download Invoice
                </button>
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 lg:hidden"
                  onClick={() => setActiveTx(tx)}
                >
                  View Details
                </button>
              </div>
            ))
          )}
        </motion.section>
      )}

      {tab === "Installment Plans" && (
        <motion.section {...fadeUp} className="space-y-4">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : plans.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No installment plans available.
            </div>
          ) : (
            plans.map((plan) => (
              <div
                key={plan.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-3"
                  onClick={() =>
                    setExpandedPlan(expandedPlan === plan.id ? null : plan.id)
                  }
                >
                  <div>
                    <p className="font-semibold text-slate-900">{plan.course}</p>
                    <p className="text-sm text-slate-500">{plan.teacher}</p>
                    <p className="text-xs text-slate-500">
                      Installment Plan — {plan.paid / plan.perInstallment} of{" "}
                      {plan.total / plan.perInstallment} paid
                    </p>
                  </div>
                  <div className="text-sm text-slate-500">
                    PKR {plan.total} · PKR {plan.perInstallment}/installment
                  </div>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${plan.progress}%` }}
                  />
                </div>
                {expandedPlan === plan.id && (
                  <div className="mt-4 space-y-2">
                    {plan.installments.map((item, index) => (
                      <div
                        key={item.id}
                        className={`flex flex-wrap items-center justify-between rounded-2xl border px-4 py-2 text-sm ${
                          item.status === "Overdue"
                            ? "border-rose-200 bg-rose-50 text-rose-600"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                          #{index + 1}
                        </span>
                        <span>PKR {item.amount}</span>
                        <span>Due {item.due}</span>
                        <span>{item.paid !== "-" ? `Paid ${item.paid}` : "-"}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs">
                          {item.status}
                        </span>
                        {item.status !== "Paid" && (
                          <button className="btn-primary px-3 py-1 text-xs">
                            Pay Now
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </motion.section>
      )}

      {tab === "Invoices" && (
        <motion.section {...fadeUp}>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : invoices.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No invoices found.
            </div>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Invoice #
                        </p>
                        <p className="mt-1 font-mono text-xs text-slate-500">
                          {invoice.id}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                        {invoice.status}
                      </span>
                    </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Course</span>
                        <span className="text-right font-medium text-slate-900">
                          {invoice.course}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Date</span>
                        <span>{invoice.date}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Amount</span>
                        <span className="font-semibold text-slate-900">
                          PKR {invoice.amount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Method</span>
                        <span>{invoice.method}</span>
                      </div>
                    </div>
                    <button
                      className="mt-4 w-full rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                      onClick={() => setActiveInvoice(invoice)}
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                      <th className="py-2">Invoice #</th>
                      <th className="py-2">Course</th>
                      <th className="py-2">Date</th>
                      <th className="py-2">Amount</th>
                      <th className="py-2">Method</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-t border-slate-100">
                        <td className="py-3 font-mono text-xs">{invoice.id}</td>
                        <td className="py-3">{invoice.course}</td>
                        <td className="py-3 text-slate-500">{invoice.date}</td>
                        <td className="py-3">PKR {invoice.amount}</td>
                        <td className="py-3">{invoice.method}</td>
                        <td className="py-3">{invoice.status}</td>
                        <td className="py-3">
                          <button
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                            onClick={() =>
                              setToast({ message: "Invoice downloaded" })
                            }
                          >
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </motion.section>
      )}

      {activeTx && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setActiveTx(null)}
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
                  {activeTx.course}
                </h3>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500"
                onClick={() => setActiveTx(null)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Transaction ID</span>
                <span className="font-mono text-xs text-slate-500">
                  {activeTx.id}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Method</span>
                <span>{activeTx.method}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Date</span>
                <span>{activeTx.date}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Amount</span>
                <span className="font-semibold text-slate-900">
                  PKR {activeTx.amount}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Status</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    activeTx.status === "Paid"
                      ? "bg-emerald-50 text-emerald-600"
                      : activeTx.status === "Pending"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-rose-50 text-rose-600"
                  }`}
                >
                  {activeTx.status}
                </span>
              </div>
            </div>
            <button
              className="btn-outline mt-5 w-full"
              onClick={() => {
                setToast({ message: "Invoice downloaded" });
                setActiveTx(null);
              }}
            >
              Download Invoice
            </button>
          </div>
        </div>
      )}

      {activeInvoice && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setActiveInvoice(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Invoice
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {activeInvoice.course}
                </h3>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500"
                onClick={() => setActiveInvoice(null)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Invoice ID</span>
                <span className="font-mono text-xs text-slate-500">
                  {activeInvoice.id}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Date</span>
                <span>{activeInvoice.date}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Amount</span>
                <span className="font-semibold text-slate-900">
                  PKR {activeInvoice.amount}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Method</span>
                <span>{activeInvoice.method}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Status</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                  {activeInvoice.status}
                </span>
              </div>
            </div>
            <button
              className="btn-outline mt-5 w-full"
              onClick={() => {
                setToast({ message: "Invoice downloaded" });
                setActiveInvoice(null);
              }}
            >
              Download PDF
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed right-6 top-6 z-[70] rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default StudentPayments;
