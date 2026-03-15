import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const tabs = ["All", "Active", "Overdue", "Completed"];

const initialPlans = [
  {
    id: 1,
    student: "Hassan Ali",
    course: "Class XI - Pre-Medical",
    total: 12000,
    status: "On Track",
    installments: [
      { id: 1, amount: 2000, dueDate: "2026-03-05", paidDate: "2026-03-05" },
      { id: 2, amount: 2000, dueDate: "2026-04-05", paidDate: null },
      { id: 3, amount: 2000, dueDate: "2026-05-05", paidDate: null },
      { id: 4, amount: 2000, dueDate: "2026-06-05", paidDate: null },
      { id: 5, amount: 2000, dueDate: "2026-07-05", paidDate: null },
      { id: 6, amount: 2000, dueDate: "2026-08-05", paidDate: null },
    ],
  },
  {
    id: 2,
    student: "Ayesha Noor",
    course: "Pre-Entrance Test",
    total: 9000,
    status: "Overdue",
    installments: [
      { id: 1, amount: 3000, dueDate: "2026-02-28", paidDate: "2026-02-28" },
      { id: 2, amount: 3000, dueDate: "2026-03-12", paidDate: null },
      { id: 3, amount: 3000, dueDate: "2026-04-12", paidDate: null },
    ],
  },
  {
    id: 3,
    student: "Bilal Khan",
    course: "Class XII - Pre-Medical",
    total: 15000,
    status: "Completed",
    installments: [
      { id: 1, amount: 5000, dueDate: "2026-01-10", paidDate: "2026-01-10" },
      { id: 2, amount: 5000, dueDate: "2026-02-10", paidDate: "2026-02-10" },
      { id: 3, amount: 5000, dueDate: "2026-03-10", paidDate: "2026-03-10" },
    ],
  },
  {
    id: 4,
    student: "Hira Fatima",
    course: "Class XI - Pre-Medical",
    total: 12000,
    status: "Due Soon",
    installments: [
      { id: 1, amount: 4000, dueDate: "2026-03-18", paidDate: null },
      { id: 2, amount: 4000, dueDate: "2026-04-18", paidDate: null },
      { id: 3, amount: 4000, dueDate: "2026-05-18", paidDate: null },
    ],
  },
];

const statusStyles = {
  "On Track": "bg-emerald-50 text-emerald-600",
  "Due Soon": "bg-amber-50 text-amber-600",
  Overdue: "bg-rose-50 text-rose-600",
  Completed: "bg-slate-100 text-slate-500",
  Paid: "bg-emerald-50 text-emerald-600",
  Pending: "bg-slate-100 text-slate-500",
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const formatPKR = (amount) => `PKR ${amount.toLocaleString("en-US")}`;

const getTodayISO = () => new Date().toISOString().split("T")[0];

function Installments() {
  const [plans, setPlans] = useState(initialPlans);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("All");
  const [toast, setToast] = useState(null);
  const [modalPlan, setModalPlan] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setEditingRow(null);
    setNotes("");
  }, [modalPlan?.id]);

  const courseOptions = useMemo(() => {
    const unique = Array.from(new Set(plans.map((plan) => plan.course)));
    return ["All", ...unique];
  }, [plans]);

  const now = new Date();
  const upcomingCutoff = new Date(now);
  upcomingCutoff.setDate(now.getDate() + 7);

  const isOverdue = (dateValue) => {
    const date = new Date(dateValue);
    return !Number.isNaN(date.getTime()) && date < now;
  };

  const isDueSoon = (dateValue) => {
    const date = new Date(dateValue);
    return (
      !Number.isNaN(date.getTime()) &&
      date >= now &&
      date <= upcomingCutoff
    );
  };

  const derivePlanStatus = (plan) => {
    if (plan.installments.every((inst) => inst.paidDate)) return "Completed";
    const overdue = plan.installments.some(
      (inst) => !inst.paidDate && isOverdue(inst.dueDate)
    );
    if (overdue) return "Overdue";
    const dueSoon = plan.installments.some(
      (inst) => !inst.paidDate && isDueSoon(inst.dueDate)
    );
    if (dueSoon) return "Due Soon";
    return "On Track";
  };

  const getInstallmentStatus = (installment) => {
    if (installment.paidDate) return "Paid";
    if (isOverdue(installment.dueDate)) return "Overdue";
    if (isDueSoon(installment.dueDate)) return "Due Soon";
    return "Pending";
  };

  const computePlanTotals = (plan) => {
    const paidTotal = plan.installments.reduce(
      (sum, inst) => sum + (inst.paidDate ? inst.amount : 0),
      0
    );
    const remaining = Math.max(plan.total - paidTotal, 0);
    const unpaid = plan.installments
      .filter((inst) => !inst.paidDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const nextDue = unpaid.length ? unpaid[0].dueDate : null;
    const paidCount = plan.installments.filter((inst) => inst.paidDate).length;
    return {
      paidTotal,
      remaining,
      nextDue,
      paidCount,
      totalCount: plan.installments.length,
    };
  };

  const filteredPlans = useMemo(() => {
    const query = search.trim().toLowerCase();
    return plans.filter((plan) => {
      const status = derivePlanStatus(plan);
      const matchesTab =
        activeTab === "All" ||
        (activeTab === "Active" &&
          (status === "On Track" || status === "Due Soon")) ||
        (activeTab === "Overdue" && status === "Overdue") ||
        (activeTab === "Completed" && status === "Completed");
      const matchesSearch =
        !query || plan.student.toLowerCase().includes(query);
      const matchesCourse =
        courseFilter === "All" || plan.course === courseFilter;
      return matchesTab && matchesSearch && matchesCourse;
    });
  }, [activeTab, courseFilter, plans, search]);

  const overduePlans = plans.filter(
    (plan) => derivePlanStatus(plan) === "Overdue"
  );

  const stats = useMemo(() => {
    const activePlans = plans.filter(
      (plan) => derivePlanStatus(plan) !== "Completed"
    ).length;
    const overdueCount = overduePlans.length;
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const collectedThisMonth = plans.reduce((sum, plan) => {
      const monthTotal = plan.installments.reduce((acc, inst) => {
        if (!inst.paidDate) return acc;
        const paidDate = new Date(inst.paidDate);
        if (
          paidDate.getMonth() === currentMonth &&
          paidDate.getFullYear() === currentYear
        ) {
          return acc + inst.amount;
        }
        return acc;
      }, 0);
      return sum + monthTotal;
    }, 0);
    const upcomingDue = plans.reduce((sum, plan) => {
      const dueTotal = plan.installments.reduce((acc, inst) => {
        if (inst.paidDate) return acc;
        return isDueSoon(inst.dueDate) ? acc + inst.amount : acc;
      }, 0);
      return sum + dueTotal;
    }, 0);
    return { activePlans, overdueCount, collectedThisMonth, upcomingDue };
  }, [overduePlans.length, plans]);

  const openPlanModal = (plan) => {
    setModalPlan(JSON.parse(JSON.stringify(plan)));
  };

  const handleSaveOverride = () => {
    if (!modalPlan) return;
    const updated = {
      ...modalPlan,
      status: derivePlanStatus(modalPlan),
    };
    setPlans((prev) =>
      prev.map((plan) => (plan.id === updated.id ? updated : plan))
    );
    setToast({ type: "success", message: "Installment overrides saved." });
    setModalPlan(null);
  };

  const handleSendReminder = (name) => {
    setToast({
      type: "success",
      message: `Reminder sent to ${name}.`,
    });
  };

  const handleBulkReminder = () => {
    setToast({
      type: "success",
      message: "Reminders sent to overdue students.",
    });
  };

  const handleMarkPaid = (installmentId) => {
    setModalPlan((prev) => {
      if (!prev) return prev;
      const updatedInstallments = prev.installments.map((inst) =>
        inst.id === installmentId
          ? { ...inst, paidDate: getTodayISO() }
          : inst
      );
      const updatedPlan = {
        ...prev,
        installments: updatedInstallments,
      };
      updatedPlan.status = derivePlanStatus(updatedPlan);
      setPlans((plansPrev) =>
        plansPrev.map((plan) => (plan.id === updatedPlan.id ? updatedPlan : plan))
      );
      setToast({ type: "success", message: "Installment marked as paid." });
      return updatedPlan;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">
            Installment Plans
          </h2>
          <p className="text-sm text-slate-500">
            Track installment schedules, reminders, and overrides.
          </p>
        </div>
        <button className="btn-outline" onClick={handleBulkReminder}>
          Bulk Send Reminders
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
              {
                label: "Active Plans",
                value: stats.activePlans,
              },
              {
                label: "Overdue Plans",
                value: stats.overdueCount,
              },
              {
                label: "Collected This Month",
                value: formatPKR(stats.collectedThisMonth),
              },
              {
                label: "Upcoming Due (7 days)",
                value: formatPKR(stats.upcomingDue),
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`glass-card ${
                  item.label === "Overdue Plans" && stats.overdueCount > 0
                    ? "border border-rose-200"
                    : ""
                }`}
              >
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
      </div>

      {stats.overdueCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>
            {stats.overdueCount} students have overdue installments.
          </span>
          <button
            className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
            onClick={() => setActiveTab("Overdue")}
          >
            View Overdue
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              activeTab === tab
                ? "bg-primary text-white"
                : "border border-slate-200 text-slate-600"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
        <input
          type="text"
          placeholder="Search student..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <select
          value={courseFilter}
          onChange={(event) => setCourseFilter(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          {courseOptions.map((option) => (
            <option key={option} value={option}>
              {option === "All" ? "Course: All" : option}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 p-4 lg:hidden">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={`plan-card-${index}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="skeleton h-4 w-1/2" />
                <div className="mt-3 space-y-2">
                  <div className="skeleton h-3 w-3/4" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
            ))
          ) : filteredPlans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No installment plans found.
            </div>
          ) : (
            filteredPlans.map((plan) => {
              const totals = computePlanTotals(plan);
              const status = derivePlanStatus(plan);
              return (
                <div
                  key={plan.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Student
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {plan.student}
                      </p>
                      <p className="text-xs text-slate-500">{plan.course}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500">
                    <div>
                      <p className="uppercase tracking-[0.2em] text-slate-400">Plan</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {totals.paidCount} of {totals.totalCount} paid
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.2em] text-slate-400">Next Due</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatDate(totals.nextDue)}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.2em] text-slate-400">Total</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatPKR(plan.total)}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.2em] text-slate-400">Remaining</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatPKR(totals.remaining)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                      onClick={() => openPlanModal(plan)}
                    >
                      View Plan
                    </button>
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                      onClick={() => openPlanModal(plan)}
                    >
                      Override
                    </button>
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                      onClick={() => handleSendReminder(plan.student)}
                    >
                      Send Reminder
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4">Student Name</th>
                <th className="px-6 py-4">Course</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Total Fee PKR</th>
                <th className="px-6 py-4">Paid PKR</th>
                <th className="px-6 py-4">Remaining PKR</th>
                <th className="px-6 py-4">Next Due Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`row-${index}`} className="border-b border-slate-100">
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
                      <div className="skeleton h-6 w-24" />
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
                      <div className="skeleton h-6 w-20" />
                    </td>
                  </tr>
                ))
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    No installment plans found.
                  </td>
                </tr>
              ) : (
                filteredPlans.map((plan) => {
                  const totals = computePlanTotals(plan);
                  const status = derivePlanStatus(plan);
                  return (
                    <tr key={plan.id} className="border-b border-slate-100">
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {plan.student}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{plan.course}</td>
                      <td className="px-6 py-4">
                        {totals.paidCount} of {totals.totalCount} paid
                      </td>
                      <td className="px-6 py-4">{formatPKR(plan.total)}</td>
                      <td className="px-6 py-4">{formatPKR(totals.paidTotal)}</td>
                      <td className="px-6 py-4">
                        {formatPKR(totals.remaining)}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {formatDate(totals.nextDue)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                            onClick={() => openPlanModal(plan)}
                          >
                            View Plan
                          </button>
                          <button
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                            onClick={() => openPlanModal(plan)}
                          >
                            Override
                          </button>
                          <button
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                            onClick={() => handleSendReminder(plan.student)}
                          >
                            Send Reminder
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalPlan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setModalPlan(null)}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-heading text-2xl text-slate-900">
                  {modalPlan.student}
                </h3>
                <p className="text-sm text-slate-500">{modalPlan.course}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500"
                onClick={() => setModalPlan(null)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {modalPlan.installments.map((inst, index) => {
                const instStatus = getInstallmentStatus(inst);
                return (
                  <div
                    key={inst.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Installment {index + 1}
                        </p>
                        <p className="text-xs text-slate-500">
                          Amount: {formatPKR(inst.amount)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[instStatus]}`}
                      >
                        {instStatus}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase text-slate-400">Due Date</p>
                        {editingRow === inst.id ? (
                          <input
                            type="date"
                            value={inst.dueDate}
                            onChange={(event) =>
                              setModalPlan((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  installments: prev.installments.map((row) =>
                                    row.id === inst.id
                                      ? { ...row, dueDate: event.target.value }
                                      : row
                                  ),
                                };
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                          />
                        ) : (
                          <p className="mt-1 font-medium text-slate-700">
                            {formatDate(inst.dueDate)}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-400">Paid Date</p>
                        <p className="mt-1 font-medium text-slate-700">
                          {formatDate(inst.paidDate)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!inst.paidDate && (
                          <button
                            className="rounded-full bg-primary px-4 py-1 text-xs font-semibold text-white"
                            onClick={() => handleMarkPaid(inst.id)}
                          >
                            Pay
                          </button>
                        )}
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                          onClick={() =>
                            setEditingRow((prev) => (prev === inst.id ? null : inst.id))
                          }
                        >
                          {editingRow === inst.id ? "Done" : "Edit Due Date"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  Manual Reminder
                </p>
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                  onClick={() => handleSendReminder(modalPlan.student)}
                >
                  Send Reminder Email
                </button>
              </div>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add admin notes for this plan..."
                className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                rows={3}
              />
              <button className="btn-primary mt-4 w-full" onClick={handleSaveOverride}>
                Save Override
              </button>
            </div>
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

export default Installments;
