import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import {
  getInstallmentsAdmin,
  createInstallmentPlan,
  markInstallmentPaid,
  sendInstallmentReminders,
} from "../../services/payment.service.js";
import { getStudents, getCourses } from "../../services/admin.service.js";

const tabs = ["All", "Active", "Overdue", "Completed"];

const formatPKR = (amount) => `PKR ${Number(amount || 0).toLocaleString("en-PK")}`;

const parseDate = (value) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const date = parseDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function Installments() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("All");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlan, setNewPlan] = useState({
    studentId: "",
    courseId: "",
    totalAmount: "",
    numberOfInstallments: 2,
    startDate: "",
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["admin-installments"],
    queryFn: () => getInstallmentsAdmin(),
  });

  const { data: students = [] } = useQuery({
    queryKey: ["admin-students-dropdown"],
    queryFn: getStudents,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["admin-courses-dropdown"],
    queryFn: getCourses,
  });

  const remindersMutation = useMutation({
    mutationFn: sendInstallmentReminders,
    onSuccess: (res) => {
      const count = res?.data?.remindersSent ?? res?.remindersSent ?? 0;
      toast.success(`Reminders sent to ${count} students`);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send reminders");
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: createInstallmentPlan,
    onSuccess: () => {
      toast.success("Installment plan created");
      setShowCreateModal(false);
      setNewPlan({
        studentId: "",
        courseId: "",
        totalAmount: "",
        numberOfInstallments: 2,
        startDate: "",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-installments"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to create plan");
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ planId, number }) => markInstallmentPaid(planId, number),
    onSuccess: () => {
      toast.success("Installment marked paid");
      queryClient.invalidateQueries({ queryKey: ["admin-installments"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to mark paid");
    },
  });

  const computed = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const normalized = plans.map((plan) => {
      const rows = Array.isArray(plan.installments) ? plan.installments : [];
      const paidRows = rows.filter((row) => String(row.status || "").toLowerCase() === "paid");
      const overdueRows = rows.filter((row) => String(row.status || "").toLowerCase() === "overdue");
      const nextDue = rows
        .filter((row) => String(row.status || "").toLowerCase() !== "paid")
        .sort((a, b) => (parseDate(a.dueDate)?.getTime() || 0) - (parseDate(b.dueDate)?.getTime() || 0))[0];

      const paidAmount = paidRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const remaining = Math.max(Number(plan.totalAmount || 0) - paidAmount, 0);
      const status = String(plan.status || "").toLowerCase();
      const derivedStatus =
        status === "completed"
          ? "completed"
          : overdueRows.length > 0
            ? "overdue"
            : "active";

      return {
        ...plan,
        status: derivedStatus,
        paidCount: paidRows.length,
        totalCount: rows.length,
        paidAmount,
        remaining,
        nextDueDate: nextDue?.dueDate || null,
        overdueRows,
      };
    });

    const filtered = normalized.filter((plan) => {
      if (activeTab === "All") return true;
      return plan.status === activeTab.toLowerCase();
    });

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const collectedThisMonth = normalized.reduce((sum, plan) => {
      const rows = Array.isArray(plan.installments) ? plan.installments : [];
      const monthPaid = rows.reduce((acc, row) => {
        const paidAt = parseDate(row.paidAt);
        if (
          String(row.status || "").toLowerCase() === "paid" &&
          paidAt &&
          paidAt.getMonth() === currentMonth &&
          paidAt.getFullYear() === currentYear
        ) {
          return acc + Number(row.amount || 0);
        }
        return acc;
      }, 0);
      return sum + monthPaid;
    }, 0);

    const weekAhead = new Date(now);
    weekAhead.setDate(weekAhead.getDate() + 7);
    const upcomingDue = normalized.reduce((sum, plan) => {
      const rows = Array.isArray(plan.installments) ? plan.installments : [];
      const dueRows = rows.filter((row) => {
        if (String(row.status || "").toLowerCase() === "paid") return false;
        const dueDate = parseDate(row.dueDate);
        return dueDate && dueDate >= now && dueDate <= weekAhead;
      });
      return sum + dueRows.reduce((acc, row) => acc + Number(row.amount || 0), 0);
    }, 0);

    return {
      rows: filtered,
      activePlans: normalized.filter((plan) => plan.status === "active").length,
      overduePlans: normalized.filter((plan) => plan.status === "overdue").length,
      collectedThisMonth,
      upcomingDue,
    };
  }, [plans, activeTab]);

  const installmentPreview = useMemo(() => {
    const total = Number(newPlan.totalAmount || 0);
    const count = Number(newPlan.numberOfInstallments || 2);
    if (!total || count < 2) return [];
    const per = Number((total / count).toFixed(2));
    const start = parseDate(newPlan.startDate) || new Date();
    start.setHours(0, 0, 0, 0);

    return Array.from({ length: count }).map((_, idx) => {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + idx);
      return {
        number: idx + 1,
        amount: idx === count - 1 ? Number((total - per * idx).toFixed(2)) : per,
        dueDate,
      };
    });
  }, [newPlan.totalAmount, newPlan.numberOfInstallments, newPlan.startDate]);

  return (
    <div className="space-y-6">
      <Toaster position="top-left" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Installments</h2>
          <p className="text-sm text-slate-500">
            Track plans, due reminders, and payment completion
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          Create Installment Plan
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active Plans", value: computed.activePlans },
          { label: "Overdue Plans", value: computed.overduePlans },
          { label: "Collected This Month", value: formatPKR(computed.collectedThisMonth) },
          { label: "Upcoming Due This Week", value: formatPKR(computed.upcomingDue) },
        ].map((item) => (
          <div key={item.label} className="glass-card">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      {computed.overduePlans > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-sm font-medium text-rose-700">
            {computed.overduePlans} students have overdue installments
          </p>
          <button
            className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
            disabled={remindersMutation.isPending}
            onClick={() => remindersMutation.mutate()}
          >
            Send Reminders
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              activeTab === tab
                ? "bg-primary text-white"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4">Student Name</th>
                <th className="px-6 py-4">Course Name</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Total Fee</th>
                <th className="px-6 py-4">Paid</th>
                <th className="px-6 py-4">Remaining</th>
                <th className="px-6 py-4">Next Due Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-6 py-4"><div className="skeleton h-5 w-24" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-24" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-20" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-20" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-20" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-20" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-20" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-20" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-24" /></td>
                  </tr>
                ))
              ) : computed.rows.length < 1 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    No installment plans yet
                  </td>
                </tr>
              ) : (
                computed.rows.map((plan) => (
                  <tr key={plan.id} className="border-b border-slate-100">
                    <td className="px-6 py-4 font-semibold text-slate-900">{plan.studentName || "-"}</td>
                    <td className="px-6 py-4 text-slate-600">{plan.courseName || "-"}</td>
                    <td className="px-6 py-4">
                      {plan.paidCount} of {plan.totalCount} paid
                    </td>
                    <td className="px-6 py-4">{formatPKR(plan.totalAmount)}</td>
                    <td className="px-6 py-4">{formatPKR(plan.paidAmount)}</td>
                    <td className="px-6 py-4">{formatPKR(plan.remaining)}</td>
                    <td className="px-6 py-4">{formatDate(plan.nextDueDate)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          plan.status === "completed"
                            ? "bg-emerald-50 text-emerald-600"
                            : plan.status === "overdue"
                              ? "bg-rose-50 text-rose-600"
                              : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        {plan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                          onClick={() => setSelectedPlan(plan)}
                        >
                          View Plan
                        </button>
                        {plan.status !== "completed" ? (
                          <button
                            className="rounded-full border border-emerald-200 px-3 py-1 text-xs text-emerald-600"
                            onClick={() => {
                              const nextPending = (plan.installments || []).find(
                                (row) => String(row.status || "").toLowerCase() !== "paid"
                              );
                              if (!nextPending) return;
                              markPaidMutation.mutate({
                                planId: plan.id,
                                number: nextPending.number,
                              });
                            }}
                          >
                            Mark Paid
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedPlan ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setSelectedPlan(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="relative z-10 w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-2xl text-slate-900">Installment Plan</h3>
                  <p className="text-sm text-slate-500">
                    {selectedPlan.studentName || "-"} · {selectedPlan.courseName || "-"}
                  </p>
                </div>
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                  onClick={() => setSelectedPlan(null)}
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm md:grid-cols-3">
                <p><span className="text-slate-500">Total:</span> {formatPKR(selectedPlan.totalAmount)}</p>
                <p><span className="text-slate-500">Paid:</span> {formatPKR(selectedPlan.paidAmount)}</p>
                <p><span className="text-slate-500">Remaining:</span> {formatPKR(selectedPlan.remaining)}</p>
              </div>

              <div className="mt-4 space-y-3">
                {(selectedPlan.installments || []).map((row) => (
                  <div
                    key={row.number}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 text-sm"
                  >
                    <p className="font-semibold text-slate-900">Installment {row.number}</p>
                    <p>{formatPKR(row.amount)}</p>
                    <p>Due: {formatDate(row.dueDate)}</p>
                    <p>Paid: {formatDate(row.paidAt)}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        String(row.status).toLowerCase() === "paid"
                          ? "bg-emerald-50 text-emerald-600"
                          : String(row.status).toLowerCase() === "overdue"
                            ? "bg-rose-50 text-rose-600"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {row.status}
                    </span>
                    {String(row.status).toLowerCase() !== "paid" ? (
                      <button
                        className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white"
                        onClick={() =>
                          markPaidMutation.mutate({
                            planId: selectedPlan.id,
                            number: row.number,
                          })
                        }
                      >
                        Mark Paid
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateModal ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setShowCreateModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="relative z-10 w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"
            >
              <h3 className="font-heading text-2xl text-slate-900">Create Installment Plan</h3>
              <div className="mt-4 grid gap-3">
                <select
                  value={newPlan.studentId}
                  onChange={(e) => setNewPlan((prev) => ({ ...prev, studentId: e.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Select Student</option>
                  {students.map((student) => (
                    <option key={student.id || student.uid} value={student.id || student.uid}>
                      {student.fullName || student.email}
                    </option>
                  ))}
                </select>
                <select
                  value={newPlan.courseId}
                  onChange={(e) => setNewPlan((prev) => ({ ...prev, courseId: e.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Select Course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={newPlan.totalAmount}
                  onChange={(e) => setNewPlan((prev) => ({ ...prev, totalAmount: e.target.value }))}
                  placeholder="Total Amount (PKR)"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <select
                  value={newPlan.numberOfInstallments}
                  onChange={(e) =>
                    setNewPlan((prev) => ({
                      ...prev,
                      numberOfInstallments: Number(e.target.value),
                    }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {[2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>
                      {count} Installments
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={newPlan.startDate}
                  onChange={(e) => setNewPlan((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              {installmentPreview.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-slate-200 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-800">Schedule Preview</p>
                  <div className="space-y-1 text-xs text-slate-600">
                    {installmentPreview.map((row) => (
                      <p key={row.number}>
                        Installment {row.number}: {formatPKR(row.amount)} - Due {formatDate(row.dueDate)}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex gap-2">
                <button
                  className="btn-primary flex-1"
                  disabled={createPlanMutation.isPending}
                  onClick={() => {
                    if (
                      !newPlan.studentId ||
                      !newPlan.courseId ||
                      !newPlan.totalAmount ||
                      !newPlan.numberOfInstallments
                    ) {
                      toast.error("Please fill all required fields");
                      return;
                    }

                    createPlanMutation.mutate({
                      studentId: newPlan.studentId,
                      courseId: newPlan.courseId,
                      totalAmount: Number(newPlan.totalAmount),
                      numberOfInstallments: Number(newPlan.numberOfInstallments),
                      startDate: newPlan.startDate || new Date().toISOString().split("T")[0],
                    });
                  }}
                >
                  {createPlanMutation.isPending ? "Creating..." : "Create Plan"}
                </button>
                <button
                  className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default Installments;

