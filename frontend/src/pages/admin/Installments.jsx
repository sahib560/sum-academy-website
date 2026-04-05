import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import { jsPDF } from "jspdf";
import {
  createInstallmentPlan,
  getAdminPayments,
  getInstallmentPlanById,
  getInstallmentsAdmin,
  markInstallmentPaid,
  overrideInstallmentPlan,
  sendInstallmentReminderToStudent,
  sendInstallmentReminders,
  verifyPayment,
} from "../../services/payment.service.js";
import { getCourses, getStudents, getClasses } from "../../services/admin.service.js";

const MotionDiv = motion.div;

const TABS = ["All", "Active", "Overdue", "Completed"];
const ALLOWED_COUNTS = [2, 3, 4, 6];

const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const date = parseDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatPKR = (amount) => `PKR ${Number(amount || 0).toLocaleString("en-PK")}`;
const canReviewPaymentRequest = (payment = {}) =>
  typeof payment.canApprove === "boolean"
    ? payment.canApprove
    : String(payment.status || "").toLowerCase() === "pending_verification" &&
      Boolean(String(payment.receiptUrl || "").trim());

const getInitials = (name = "") =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() || "")
    .join("") || "ST";

function Installments() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [form, setForm] = useState({
    studentId: "",
    courseId: "",
    classId: "",
    totalAmount: "",
    numberOfInstallments: 2,
    startDate: "",
  });
  const [overrideRows, setOverrideRows] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = useMemo(
    () => ({
      status: tab === "All" ? "" : tab.toLowerCase(),
      search: debouncedSearch || "",
    }),
    [tab, debouncedSearch]
  );

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["admin-installments", filters],
    queryFn: () => getInstallmentsAdmin(filters),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: selectedPlan, isFetching: planLoading } = useQuery({
    queryKey: ["admin-installment-plan", selectedPlanId],
    queryFn: () => getInstallmentPlanById(selectedPlanId),
    enabled: Boolean(selectedPlanId),
    staleTime: 30000,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["admin-students-installments"],
    queryFn: getStudents,
    staleTime: 30000,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["admin-courses-installments"],
    queryFn: getCourses,
    staleTime: 30000,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["admin-classes-installments"],
    queryFn: getClasses,
    staleTime: 30000,
  });

  const { data: paymentRequests = [] } = useQuery({
    queryKey: ["admin-payments-installments"],
    queryFn: getAdminPayments,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ planId, number }) => markInstallmentPaid(planId, number),
    onSuccess: (_, vars) => {
      toast.success(`Installment ${vars.number} marked as paid!`);
      queryClient.invalidateQueries({ queryKey: ["admin-installments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-installment-plan"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to mark installment as paid");
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: ({ paymentId, action }) => verifyPayment(paymentId, action),
    onSuccess: (_, vars) => {
      toast.success(
        vars.action === "approve" ? "Payment approved" : "Payment rejected"
      );
      queryClient.invalidateQueries({ queryKey: ["admin-installments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-installment-plan"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments-installments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update payment");
    },
  });

  const remindersMutation = useMutation({
    mutationFn: () => sendInstallmentReminders(),
    onSuccess: (res) => {
      const sent = res?.data?.sent ?? res?.sent ?? 0;
      toast.success(`Reminders sent to ${sent} students`);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send reminders");
    },
  });

  const reminderOneMutation = useMutation({
    mutationFn: (studentId) => sendInstallmentReminderToStudent(studentId),
    onSuccess: (_, studentId) => {
      const student = students.find((item) => (item.id || item.uid) === studentId);
      toast.success(`Reminder sent to ${student?.fullName || "student"}`);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send reminder");
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: (payload) => createInstallmentPlan(payload),
    onSuccess: () => {
      toast.success("Installment plan created successfully");
      setShowCreateModal(false);
      setCreateStep(1);
      setForm({
        studentId: "",
        courseId: "",
        classId: "",
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

  const overrideMutation = useMutation({
    mutationFn: ({ planId, installments }) => overrideInstallmentPlan(planId, installments),
    onSuccess: () => {
      toast.success("Schedule updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-installments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-installment-plan"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to save override");
    },
  });

  const computed = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const weekAhead = new Date(startOfToday);
    weekAhead.setDate(weekAhead.getDate() + 7);

    const rows = (Array.isArray(plans) ? plans : []).map((plan) => {
      const normalizedStatus = String(plan.status || "").toLowerCase();
      const due = parseDate(plan.nextDueDate);
      const dueSoon = due && due >= startOfToday && due <= new Date(startOfToday.getTime() + 3 * 86400000);
      return {
        ...plan,
        status: normalizedStatus || "active",
        dueSoon,
      };
    });

    const activePlans = rows.filter((item) => item.status === "active").length;
    const overduePlans = rows.filter((item) => item.isOverdue || item.status === "overdue").length;

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const collectedThisMonth = rows.reduce((sum, plan) => {
      const installments = Array.isArray(plan.installments) ? plan.installments : [];
      return sum + installments.reduce((inner, row) => {
        if (String(row.status || "").toLowerCase() !== "paid") return inner;
        const paidAt = parseDate(row.paidAt);
        if (!paidAt || paidAt.getMonth() !== currentMonth || paidAt.getFullYear() !== currentYear) {
          return inner;
        }
        return inner + Number(row.amount || 0);
      }, 0);
    }, 0);

    const dueThisWeek = rows.reduce((sum, plan) => {
      const installments = Array.isArray(plan.installments) ? plan.installments : [];
      return sum + installments.reduce((inner, row) => {
        if (String(row.status || "").toLowerCase() === "paid") return inner;
        const due = parseDate(row.dueDate);
        if (!due || due < startOfToday || due > weekAhead) return inner;
        return inner + Number(row.amount || 0);
      }, 0);
    }, 0);

    const filtered = rows
      .filter((item) => {
        if (tab !== "All" && item.status !== tab.toLowerCase()) return false;
        if (debouncedSearch) {
          const query = debouncedSearch.toLowerCase();
          const student = String(item.studentName || "").toLowerCase();
          const course = String(item.courseName || "").toLowerCase();
          if (!student.includes(query) && !course.includes(query)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0)
      );

    const pendingRequests = (Array.isArray(paymentRequests) ? paymentRequests : [])
      .map((item) => ({
        ...item,
        status: String(item.status || "").toLowerCase(),
        method: String(item.method || "").toLowerCase(),
      }))
      .filter((item) => canReviewPaymentRequest(item))
      .sort(
        (a, b) =>
          (parseDate(b.createdAt)?.getTime() || 0) -
          (parseDate(a.createdAt)?.getTime() || 0)
      )
      .slice(0, 8);

    return {
      activePlans,
      overduePlans,
      collectedThisMonth,
      dueThisWeek,
      filtered,
      total: rows.length,
      pendingRequests,
    };
  }, [plans, tab, debouncedSearch, paymentRequests]);

  const previewSchedule = useMemo(() => {
    const count = Number(form.numberOfInstallments || 2);
    const total = Number(form.totalAmount || 0);
    const start = parseDate(form.startDate) || new Date();
    start.setHours(0, 0, 0, 0);
    if (!ALLOWED_COUNTS.includes(count) || total <= 0) return [];
    const per = Math.floor((total / count) * 100) / 100;
    let remaining = total;
    return Array.from({ length: count }).map((_, index) => {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + index);
      const amount = index === count - 1 ? Number(remaining.toFixed(2)) : Number(per.toFixed(2));
      remaining = Number((remaining - amount).toFixed(2));
      return { number: index + 1, amount, dueDate };
    });
  }, [form.numberOfInstallments, form.totalAmount, form.startDate]);

  const createPlan = () => {
    const totalAmount = Number(form.totalAmount);
    if (!form.studentId || !form.courseId || !form.classId) return toast.error("Student, course and class are required");
    if (!ALLOWED_COUNTS.includes(Number(form.numberOfInstallments))) return toast.error("Installments can only be 2, 3, 4, or 6");
    if (!(totalAmount > 0)) return toast.error("Total amount must be a positive number");
    if (!form.startDate || parseDate(form.startDate) < new Date(new Date().setHours(0, 0, 0, 0))) {
      return toast.error("Start date must be today or future");
    }
    createPlanMutation.mutate({
      studentId: form.studentId,
      courseId: form.courseId,
      classId: form.classId,
      totalAmount,
      numberOfInstallments: Number(form.numberOfInstallments),
      startDate: form.startDate,
    });
  };

  const exportPDF = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(17);
    pdf.text("SUM Academy - Installments", 14, 16);
    pdf.setFontSize(10);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
    let y = 30;
    computed.filtered.forEach((item, index) => {
      if (y > 280) {
        pdf.addPage();
        y = 16;
      }
      const line = `${index + 1}. ${item.studentName || "-"} | ${item.courseName || "-"} | ${item.paidCount || 0}/${item.numberOfInstallments || 0} | ${formatPKR(item.totalAmount)} | ${formatStatus(item.status)}`;
      pdf.text(line, 14, y);
      y += 6;
    });
    pdf.save(`SUM_Installments_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const formatStatus = (value = "") =>
    String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);

  return (
    <div className="space-y-6">
      <Toaster position="top-left" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Installments</h2>
          <p className="text-sm text-slate-500">Track plans, dues, reminders, and payments</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={exportPDF}>Export PDF</button>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>Create Plan</button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active Plans", value: computed.activePlans },
          { label: "Overdue Plans", value: computed.overduePlans, red: true },
          { label: "Collected This Month PKR", value: formatPKR(computed.collectedThisMonth) },
          { label: "Due This Week PKR", value: formatPKR(computed.dueThisWeek) },
        ].map((item) => (
          <div key={item.label} className="glass-card">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${item.red && item.value > 0 ? "text-rose-700" : "text-slate-900"}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {computed.overduePlans > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-sm font-semibold text-rose-700">
            {computed.overduePlans} students have overdue installments
          </p>
          <button className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white" disabled={remindersMutation.isPending} onClick={() => remindersMutation.mutate()}>
            {remindersMutation.isPending ? "Sending..." : "Send All Reminders"}
          </button>
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-heading text-xl text-slate-900">Pending Course Requests</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {computed.pendingRequests.length} pending
          </span>
        </div>
        {computed.pendingRequests.length < 1 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">
            No pending payment requests to review.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {computed.pendingRequests.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">{item.studentName || "-"}</p>
                <p className="text-xs text-slate-500">
                  {item.courseName || "-"} | {item.method || "-"} | {formatDate(item.createdAt)}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {formatPKR(item.amount)}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    className="flex-1 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                    disabled={verifyPaymentMutation.isPending}
                    onClick={() =>
                      verifyPaymentMutation.mutate({ paymentId: item.id, action: "approve" })
                    }
                  >
                    Approve
                  </button>
                  <button
                    className="flex-1 rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700"
                    disabled={verifyPaymentMutation.isPending}
                    onClick={() =>
                      verifyPaymentMutation.mutate({ paymentId: item.id, action: "reject" })
                    }
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => {
            const count =
              item === "All" ? computed.total : computed.filtered.filter((row) => row.status === item.toLowerCase()).length;
            return (
              <button key={item} className={`rounded-full px-4 py-2 text-xs font-semibold ${tab === item ? "bg-primary text-white" : "border border-slate-200 text-slate-700"}`} onClick={() => setTab(item)}>
                {item} ({count})
              </button>
            );
          })}
        </div>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student or course..." className="min-w-[220px] rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-primary focus:outline-none" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-4">Student</th>
                <th className="px-4 py-4">Course</th>
                <th className="px-4 py-4">Class</th>
                <th className="px-4 py-4">Plan</th>
                <th className="px-4 py-4">Total</th>
                <th className="px-4 py-4">Paid</th>
                <th className="px-4 py-4">Remaining</th>
                <th className="px-4 py-4">Next Due</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`loading-${idx}`} className="border-b border-slate-100">
                  {Array.from({ length: 10 }).map((__, cell) => <td key={`c-${cell}`} className="px-4 py-4"><div className="skeleton h-5 w-20" /></td>)}
                </tr>
              )) : null}
              {!isLoading && computed.filtered.length < 1 ? (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-slate-500">No installment plans found</td></tr>
              ) : null}
              {!isLoading && computed.filtered.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{getInitials(row.studentName)}</div>
                      <div><p className="font-semibold text-slate-900">{row.studentName || "-"}</p><p className="text-xs text-slate-500">{row.studentEmail || "-"}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-700">{row.courseName || "-"}</td>
                  <td className="px-4 py-4 text-slate-700">{row.className || "-"}</td>
                  <td className="px-4 py-4">
                    <p className="text-sm text-slate-700">{row.paidCount || 0} of {row.numberOfInstallments || 0} paid</p>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-200"><div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, ((row.paidCount || 0) / Math.max(1, row.numberOfInstallments || 1)) * 100)}%` }} /></div>
                  </td>
                  <td className="px-4 py-4">{formatPKR(row.totalAmount)}</td>
                  <td className="px-4 py-4 text-emerald-700">{formatPKR(row.paidAmount)}</td>
                  <td className={`px-4 py-4 ${row.isOverdue ? "text-rose-700" : "text-slate-700"}`}>{formatPKR(row.remainingAmount)}</td>
                  <td className={`px-4 py-4 ${row.isOverdue ? "text-rose-700" : row.dueSoon ? "text-amber-700" : "text-slate-700"}`}>{row.status === "completed" ? "All Paid" : formatDate(row.nextDueDate)}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.status === "completed" ? "bg-emerald-50 text-emerald-700" : row.isOverdue ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700"}`}>{formatStatus(row.status)}</span></td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                        onClick={() => {
                          setSelectedPlanId(row.id);
                          const rows = Array.isArray(row.installments)
                            ? row.installments
                            : [];
                          setOverrideRows(rows.map((item) => ({ ...item })));
                        }}
                      >
                        View
                      </button>
                      {row.status !== "completed" ? <button className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700" onClick={() => {
                        const next = (row.installments || []).find((item) => String(item.status || "").toLowerCase() !== "paid");
                        if (!next) return;
                        markPaidMutation.mutate({ planId: row.id, number: next.number });
                      }}>Mark Paid</button> : null}
                      <button className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700" onClick={() => reminderOneMutation.mutate(row.studentId)}>Remind</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedPlanId ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
            <button type="button" className="absolute inset-0 bg-slate-900/45" onClick={() => setSelectedPlanId("")} />
            <MotionDiv initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }} className="relative z-10 max-h-[90vh] w-full max-w-[760px] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
              <button type="button" className="absolute right-4 top-4 rounded-full border border-slate-200 px-3 py-1 text-xs" onClick={() => setSelectedPlanId("")}>X</button>
              {planLoading || !selectedPlan ? <div className="space-y-3">{Array.from({ length: 6 }).map((_, idx) => <div key={idx} className="skeleton h-12 w-full" />)}</div> : (
                <>
                  <h3 className="font-heading text-2xl text-slate-900">{selectedPlan.studentName || "-"}</h3>
                  <p className="text-sm text-slate-600">{selectedPlan.courseName || "-"} - {selectedPlan.className || "-"}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 p-3 text-sm"><p className="text-slate-500">Total</p><p className="font-semibold">{formatPKR(selectedPlan.totalAmount)}</p></div>
                    <div className="rounded-2xl border border-slate-200 p-3 text-sm"><p className="text-slate-500">Paid</p><p className="font-semibold text-emerald-700">{formatPKR(selectedPlan.paidAmount)}</p></div>
                    <div className="rounded-2xl border border-slate-200 p-3 text-sm"><p className="text-slate-500">Remaining</p><p className={`font-semibold ${selectedPlan.isOverdue ? "text-rose-700" : "text-slate-900"}`}>{formatPKR(selectedPlan.remainingAmount)}</p></div>
                    <div className="rounded-2xl border border-slate-200 p-3 text-sm"><p className="text-slate-500">Next Due</p><p className={`font-semibold ${selectedPlan.isOverdue ? "text-rose-700" : "text-slate-900"}`}>{selectedPlan.status === "completed" ? "All Paid" : formatDate(selectedPlan.nextDueDate)}</p></div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {(selectedPlan.installments || []).map((row) => (
                      <div key={row.number} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 text-sm">
                        <div>
                          <p className="font-semibold text-slate-900">Installment {row.number} of {selectedPlan.numberOfInstallments}</p>
                          <p className="text-slate-500">Due: {formatDate(row.dueDate)} | Paid: {formatDate(row.paidAt)}</p>
                        </div>
                        <p className="font-semibold text-slate-900">{formatPKR(row.amount)}</p>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${String(row.status || "").toLowerCase() === "paid" ? "bg-emerald-50 text-emerald-700" : String(row.status || "").toLowerCase() === "overdue" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{formatStatus(row.status)}</span>
                          {String(row.status || "").toLowerCase() !== "paid" ? <button className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white" onClick={() => markPaidMutation.mutate({ planId: selectedPlan.id, number: row.number })}>Mark as Paid</button> : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  <details className="mt-4 rounded-2xl border border-slate-200 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-800">Override Schedule</summary>
                    <div className="mt-3 space-y-2">
                      {overrideRows.map((row, index) => (
                        <div key={`override-${row.number}`} className="grid gap-2 md:grid-cols-4">
                          <input type="text" disabled value={`Installment ${row.number}`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                          <input type="number" min="1" value={row.amount || ""} disabled={String(row.status || "").toLowerCase() === "paid"} onChange={(e) => setOverrideRows((prev) => prev.map((item, i) => i === index ? { ...item, amount: e.target.value } : item))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                          <input type="date" value={row.dueDate || ""} disabled={String(row.status || "").toLowerCase() === "paid"} onChange={(e) => setOverrideRows((prev) => prev.map((item, i) => i === index ? { ...item, dueDate: e.target.value } : item))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                          <div className="flex items-center"><span className="text-xs text-slate-500">{formatStatus(row.status)}</span></div>
                        </div>
                      ))}
                      <button className="btn-primary mt-2" disabled={overrideMutation.isPending} onClick={() => overrideMutation.mutate({ planId: selectedPlan.id, installments: overrideRows.map((row) => ({ ...row, amount: Number(row.amount || 0) })) })}>
                        {overrideMutation.isPending ? "Saving..." : "Save Override"}
                      </button>
                    </div>
                  </details>
                </>
              )}
            </MotionDiv>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateModal ? (
          <div className="fixed inset-0 z-[95] flex items-center justify-center px-4">
            <button type="button" className="absolute inset-0 bg-slate-900/45" onClick={() => setShowCreateModal(false)} />
            <MotionDiv initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }} className="relative z-10 max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
              <h3 className="font-heading text-2xl text-slate-900">Create Installment Plan</h3>
              <p className="mt-1 text-sm text-slate-500">Step {createStep} of 3</p>

              {createStep === 1 ? (
                <div className="mt-4 grid gap-3">
                  <select value={form.studentId} onChange={(e) => setForm((prev) => ({ ...prev, studentId: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Select Student</option>
                    {students.map((item) => <option key={item.id || item.uid} value={item.id || item.uid}>{item.fullName || item.email}</option>)}
                  </select>
                  <select value={form.courseId} onChange={(e) => {
                    const selected = courses.find((course) => course.id === e.target.value);
                    setForm((prev) => ({ ...prev, courseId: e.target.value, totalAmount: selected?.price || prev.totalAmount }));
                  }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Select Course</option>
                    {courses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                  <select value={form.classId} onChange={(e) => setForm((prev) => ({ ...prev, classId: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Select Class</option>
                    {classes.filter((item) => !form.courseId || (item.assignedCourses || []).some((course) => course.courseId === form.courseId)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <input type="number" min="1" value={form.totalAmount} onChange={(e) => setForm((prev) => ({ ...prev, totalAmount: e.target.value }))} placeholder="Total Amount PKR" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </div>
              ) : null}

              {createStep === 2 ? (
                <div className="mt-4 grid gap-3">
                  <div className="grid grid-cols-4 gap-2">
                    {ALLOWED_COUNTS.map((count) => (
                      <button key={count} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${Number(form.numberOfInstallments) === count ? "border-primary bg-primary/10 text-primary" : "border-slate-200 text-slate-700"}`} onClick={() => setForm((prev) => ({ ...prev, numberOfInstallments: count }))}>
                        {count}
                      </button>
                    ))}
                  </div>
                  <input type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </div>
              ) : null}

              {createStep === 3 ? (
                <div className="mt-4 rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-800">Schedule Preview</p>
                  <div className="mt-3 space-y-2 text-sm">
                    {previewSchedule.map((row) => <p key={row.number}>Installment {row.number}: {formatPKR(row.amount)} - Due: {formatDate(row.dueDate)}</p>)}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex gap-2">
                <button className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => (createStep > 1 ? setCreateStep((step) => step - 1) : setShowCreateModal(false))}>
                  {createStep > 1 ? "Back" : "Cancel"}
                </button>
                {createStep < 3 ? (
                  <button className="btn-primary flex-1" onClick={() => setCreateStep((step) => Math.min(3, step + 1))}>
                    Next
                  </button>
                ) : (
                  <button className="btn-primary flex-1" disabled={createPlanMutation.isPending} onClick={createPlan}>
                    {createPlanMutation.isPending ? "Creating..." : "Create Plan"}
                  </button>
                )}
              </div>
            </MotionDiv>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default Installments;
