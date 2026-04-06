import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import { jsPDF } from "jspdf";
import {
  getAdminPayments,
  verifyPayment,
  getInstallmentsAdmin,
} from "../../services/payment.service.js";
import {
  generateInvoicePDF,
  generateReceiptPDF,
} from "../../utils/pdfDesigns.js";
import { useSettings } from "../../hooks/useSettings.js";

const tabOptions = ["All", "JazzCash", "EasyPaisa", "Bank Transfer", "Pending"];
const MotionDiv = motion.div;

const methodBadgeClass = {
  jazzcash: "bg-rose-50 text-rose-600",
  easypaisa: "bg-emerald-50 text-emerald-600",
  bank_transfer: "bg-blue-50 text-blue-600",
};

const statusBadgeClass = {
  paid: "bg-emerald-50 text-emerald-600",
  pending: "bg-amber-50 text-amber-700",
  awaiting_receipt: "bg-yellow-50 text-yellow-700",
  pending_verification: "bg-orange-50 text-orange-600",
  rejected: "bg-rose-50 text-rose-600",
  overdue: "bg-red-100 text-red-700",
};

const formatPKR = (value) => `PKR ${Number(value || 0).toLocaleString("en-PK")}`;
const formatMethod = (value = "") => {
  const method = String(value || "").toLowerCase();
  if (method === "bank_transfer") return "Bank Transfer";
  if (method === "jazzcash") return "JazzCash";
  if (method === "easypaisa") return "EasyPaisa";
  return method || "-";
};
const canReviewPayment = (payment = {}) =>
  typeof payment.canApprove === "boolean"
    ? payment.canApprove
    : ["pending", "pending_verification"].includes(
        String(payment.status || "").toLowerCase()
      ) && Boolean(String(payment.receiptUrl || "").trim());

const formatDate = (value) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const monthKey = (value) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

function Payments() {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const logoUrl = settings?.general?.logoUrl || null;
  const [activeTab, setActiveTab] = useState("All");
  const [selectedPayment, setSelectedPayment] = useState(null);

  const {
    data: payments = [],
    isLoading: paymentsLoading,
  } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => getAdminPayments(),
  });

  const { data: installments = [] } = useQuery({
    queryKey: ["admin-installments-for-stats"],
    queryFn: () => getInstallmentsAdmin(),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ paymentId, action }) => verifyPayment(paymentId, action),
    onSuccess: (_, variables) => {
      toast.success(
        variables.action === "approve" ? "Payment approved" : "Payment rejected"
      );
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-installments-for-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-installments"] });
      setSelectedPayment(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update payment");
    },
  });

  const computed = useMemo(() => {
    const normalized = payments.map((item) => ({
      ...item,
      method: String(item.method || "").toLowerCase(),
      status: String(item.status || "").toLowerCase(),
    }));

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const totalRevenue = normalized
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const monthRevenue = normalized
      .filter((item) => item.status === "paid" && monthKey(item.createdAt) === currentMonth)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const pendingRequests = normalized.filter((item) =>
      ["awaiting_receipt", "pending", "pending_verification"].includes(
        String(item.status || "").toLowerCase()
      )
    );

    const overdueInstallments = installments.filter((plan) => {
      if (String(plan.status || "").toLowerCase() === "overdue") return true;
      const rows = Array.isArray(plan.installments) ? plan.installments : [];
      return rows.some((row) => String(row.status || "").toLowerCase() === "overdue");
    }).length;

    const tabFiltered = normalized.filter((item) => {
      if (activeTab === "All") return true;
      if (activeTab === "JazzCash") return item.method === "jazzcash";
      if (activeTab === "EasyPaisa") return item.method === "easypaisa";
      if (activeTab === "Bank Transfer") return item.method === "bank_transfer";
      if (activeTab === "Pending") return canReviewPayment(item);
      return true;
    });

    return {
      totalRevenue,
      monthRevenue,
      pendingRequests,
      overdueInstallments,
      rows: tabFiltered.sort(
        (a, b) =>
          (b.createdAt?.seconds || new Date(b.createdAt || 0).getTime()) -
          (a.createdAt?.seconds || new Date(a.createdAt || 0).getTime())
      ),
    };
  }, [payments, installments, activeTab]);

  const downloadInvoice = async (payment) => {
    try {
      await generateInvoicePDF({
        invoiceId: payment.id,
        studentName: payment.studentName || "Student",
        studentEmail: payment.studentEmail || "",
        studentPhone: payment.studentPhone || "",
        courseName: payment.courseName || "",
        className: payment.className || "",
        shiftName: payment.shiftName || payment.shiftId || "",
        method: payment.method,
        originalAmount: payment.originalAmount || payment.amount,
        discountAmount: payment.discount || 0,
        promoCode: payment.promoCode || null,
        finalAmount: payment.totalAmount || payment.amount,
        status: payment.status,
        paymentDate: payment.createdAt,
        referenceNumber: payment.reference,
        logoUrl,
      });
      toast.success("Invoice PDF downloaded");
    } catch (error) {
      toast.error(error?.message || "Failed to download invoice");
    }
  };

  const downloadReceipt = async (payment) => {
    try {
      await generateReceiptPDF({
        receiptId: payment.id,
        studentName: payment.studentName || "Student",
        studentEmail: payment.studentEmail || "",
        courseName: payment.courseName || "",
        className: payment.className || "",
        amount: payment.totalAmount || payment.amount,
        method: payment.method,
        referenceNumber: payment.reference,
        paymentDate: payment.createdAt,
        verifiedBy: payment.verifiedBy || "SUM Academy",
        verifiedAt: payment.verifiedAt || payment.updatedAt || payment.createdAt,
        logoUrl,
      });
      toast.success("Receipt PDF downloaded");
    } catch (error) {
      toast.error(error?.message || "Failed to download receipt");
    }
  };

  const exportPdf = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text("SUM Academy - Payments Report", 14, 16);
    pdf.setFontSize(10);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

    let y = 30;
    computed.rows.forEach((row, index) => {
      if (y > 280) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(
        `${index + 1}. ${row.studentName || "-"} | ${row.courseName || "-"} | ${formatPKR(
          row.amount
        )} | ${row.method} | ${row.status}`,
        14,
        y
      );
      y += 6;
    });
    pdf.save("sum-academy-payments.pdf");
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-left" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Payments</h2>
          <p className="text-sm text-slate-500">
            JazzCash, EasyPaisa, and Bank Transfer tracking
          </p>
        </div>
        <button className="btn-outline" onClick={exportPdf}>
          Export PDF
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Revenue", value: formatPKR(computed.totalRevenue) },
          { label: "This Month Revenue", value: formatPKR(computed.monthRevenue) },
          {
            label: "Pending Verifications",
            value: computed.pendingRequests.length,
          },
          {
            label: "Overdue Installments",
            value: computed.overdueInstallments,
          },
        ].map((item) => (
          <div key={item.label} className="glass-card">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabOptions.map((tab) => (
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
                <th className="px-6 py-4">Class Name</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paymentsLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td className="px-6 py-4"><div className="skeleton h-5 w-24" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-24" /></td>
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
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No payments yet
                  </td>
                </tr>
              ) : (
                computed.rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {row.studentName || "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{row.courseName || "-"}</td>
                    <td className="px-6 py-4 text-slate-600">{row.className || "-"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          methodBadgeClass[row.method] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {formatMethod(row.method)}
                      </span>
                    </td>
                    <td className="px-6 py-4">{formatPKR(row.amount)}</td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(row.createdAt)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          statusBadgeClass[row.status] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.status?.replace(/_/g, " ") || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedPayment(row)}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                        >
                          View Details
                        </button>
                        {canReviewPayment(row) ? (
                          <>
                            <button
                              onClick={() =>
                                verifyMutation.mutate({ paymentId: row.id, action: "approve" })
                              }
                              className="rounded-full border border-emerald-200 px-3 py-1 text-xs text-emerald-600"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() =>
                                verifyMutation.mutate({ paymentId: row.id, action: "reject" })
                              }
                              className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600"
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                        <button
                          onClick={() => downloadInvoice(row)}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                        >
                          Invoice
                        </button>
                        {["paid", "approved"].includes(
                          String(row.status || "").toLowerCase()
                        ) ? (
                          <button
                            onClick={() => downloadReceipt(row)}
                            className="rounded-full border border-emerald-200 px-3 py-1 text-xs text-emerald-700"
                          >
                            Receipt
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

      <div className="space-y-3">
        <h3 className="font-heading text-xl text-slate-900">
          Pending Payment Requests
        </h3>
        {computed.pendingRequests.length < 1 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            No pending payment requests
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {computed.pendingRequests.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="font-semibold text-slate-900">{item.studentName || "-"}</p>
                <p className="text-sm text-slate-500">{item.courseName || "-"}</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {formatPKR(item.amount)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Ref: {item.reference || "-"} | {formatMethod(item.method)} |{" "}{formatDate(item.createdAt)}
                </p>
                {item.receiptUrl ? (
                  <img
                    src={item.receiptUrl}
                    alt="Receipt"
                    className="mt-3 h-28 w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                    Receipt not uploaded
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() =>
                      verifyMutation.mutate({ paymentId: item.id, action: "approve" })
                    }
                    className="flex-1 rounded-full bg-emerald-500 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() =>
                      verifyMutation.mutate({ paymentId: item.id, action: "reject" })
                    }
                    className="flex-1 rounded-full bg-rose-500 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedPayment ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setSelectedPayment(null)}
            />
            <MotionDiv
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="relative z-10 w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-2xl text-slate-900">Payment Details</h3>
                  <p className="text-sm text-slate-500">Reference: {selectedPayment.reference || "-"}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                  onClick={() => setSelectedPayment(null)}
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Student</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedPayment.studentName || "-"}</p>
                  <p className="text-sm text-slate-500">{selectedPayment.studentEmail || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Course & Class</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedPayment.courseName || "-"}</p>
                  <p className="text-sm text-slate-500">
                    Class: {selectedPayment.className || "-"} | Shift: {selectedPayment.shiftId || "-"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm md:grid-cols-2">
                <p><span className="text-slate-500">Method:</span> {formatMethod(selectedPayment.method)}</p>
                <p><span className="text-slate-500">Original:</span> {formatPKR(selectedPayment.originalAmount)}</p>
                <p><span className="text-slate-500">Course Discount:</span> {formatPKR(selectedPayment.courseDiscountAmount)}</p>
                <p><span className="text-slate-500">Promo Discount:</span> {formatPKR(selectedPayment.promoDiscountAmount)}</p>
                <p><span className="text-slate-500">Total Discount:</span> {formatPKR(selectedPayment.discount)}</p>
                <p><span className="text-slate-500">Final:</span> {formatPKR(selectedPayment.totalAmount || selectedPayment.amount)}</p>
                <p><span className="text-slate-500">Promo:</span> {selectedPayment.promoCode || "-"}</p>
                <p><span className="text-slate-500">Status:</span> {selectedPayment.status?.replace(/_/g, " ")}</p>
              </div>

              {selectedPayment.receiptUrl ? (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold text-slate-700">Receipt</p>
                  <a href={selectedPayment.receiptUrl} target="_blank" rel="noreferrer">
                    <img
                      src={selectedPayment.receiptUrl}
                      alt="Receipt"
                      className="h-52 w-full rounded-2xl border border-slate-200 object-cover"
                    />
                  </a>
                </div>
              ) : null}

              {canReviewPayment(selectedPayment) ? (
                <div className="mt-5 flex gap-2">
                  <button
                    className="btn-primary flex-1"
                    disabled={verifyMutation.isPending}
                    onClick={() =>
                      verifyMutation.mutate({
                        paymentId: selectedPayment.id,
                        action: "approve",
                      })
                    }
                  >
                    Approve
                  </button>
                  <button
                    className="flex-1 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
                    disabled={verifyMutation.isPending}
                    onClick={() =>
                      verifyMutation.mutate({
                        paymentId: selectedPayment.id,
                        action: "reject",
                      })
                    }
                  >
                    Reject
                  </button>
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  onClick={() => downloadInvoice(selectedPayment)}
                >
                  Download Invoice
                </button>
                {["paid", "approved"].includes(
                  String(selectedPayment.status || "").toLowerCase()
                ) ? (
                  <button
                    className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700"
                    onClick={() => downloadReceipt(selectedPayment)}
                  >
                    Download Receipt
                  </button>
                ) : null}
              </div>
            </MotionDiv>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default Payments;


