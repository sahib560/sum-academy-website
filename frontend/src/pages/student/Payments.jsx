import { useMemo, useState } from "react";
import { motion as Motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import {
  getMyPayments,
  getMyInstallments,
} from "../../services/payment.service.js";
import { useSettings } from "../../hooks/useSettings.js";
import { useAuth } from "../../hooks/useAuth.js";
import {
  generateInvoicePDF,
  generateReceiptPDF,
} from "../../utils/pdfDesigns.js";

const tabs = ["Transaction History", "Installment Plans", "Invoices"];

const formatPKR = (value) => `PKR ${Number(value || 0).toLocaleString("en-PK")}`;

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

function StudentPayments() {
  const [activeTab, setActiveTab] = useState("Transaction History");
  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const { settings } = useSettings();
  const { userProfile } = useAuth();
  const logoUrl = settings?.general?.logoUrl || null;

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["student-payments"],
    queryFn: getMyPayments,
  });

  const { data: installmentPlans = [], isLoading: installmentsLoading } = useQuery({
    queryKey: ["student-installments"],
    queryFn: getMyInstallments,
  });

  const paidInvoices = useMemo(
    () => payments.filter((payment) => String(payment.status || "").toLowerCase() === "paid"),
    [payments]
  );

  const downloadInvoice = async (payment) => {
    try {
      await generateInvoicePDF({
        invoiceId: payment.id,
        studentName:
          userProfile?.fullName ||
          userProfile?.name ||
          payment.studentName ||
          "Student",
        studentEmail: userProfile?.email || payment.studentEmail || "",
        studentPhone: userProfile?.phoneNumber || payment.studentPhone || "",
        courseName: payment.courseName,
        className: payment.className,
        shiftName: payment.shiftName || payment.shiftId || "",
        method: payment.method,
        originalAmount: payment.originalAmount || payment.amount,
        discountAmount: payment.discount || 0,
        promoCode: payment.promoCode || null,
        finalAmount: payment.amount,
        status: payment.status,
        paymentDate: payment.createdAt,
        referenceNumber: payment.reference,
        logoUrl,
      });
      toast.success("Invoice downloaded successfully!");
    } catch (error) {
      toast.error(error?.message || "Failed to download invoice");
    }
  };
  const downloadReceipt = async (payment) => {
    try {
      await generateReceiptPDF({
        receiptId: payment.id,
        studentName:
          userProfile?.fullName ||
          userProfile?.name ||
          payment.studentName ||
          "Student",
        studentEmail: userProfile?.email || payment.studentEmail || "",
        courseName: payment.courseName,
        className: payment.className,
        amount: payment.amount,
        method: payment.method,
        referenceNumber: payment.reference,
        paymentDate: payment.createdAt,
        verifiedBy: payment.verifiedBy || "SUM Academy",
        verifiedAt: payment.verifiedAt || payment.updatedAt || payment.createdAt,
        logoUrl,
      });
      toast.success("Receipt downloaded successfully!");
    } catch (error) {
      toast.error(error?.message || "Failed to download receipt");
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-left" />

      <Motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="font-heading text-3xl text-slate-900">Payments</h1>
        <p className="text-sm text-slate-500">
          Track your transactions, installments, and invoices
        </p>
      </Motion.section>

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

      {activeTab === "Transaction History" ? (
        <section className="space-y-3">
          {paymentsLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="skeleton h-24 rounded-2xl" />
            ))
          ) : payments.length < 1 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No payments yet
            </div>
          ) : (
            payments.map((payment) => (
              <div key={payment.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{payment.courseName || "-"}</p>
                    <p className="text-xs text-slate-500">
                      {payment.method || "-"} | {formatDate(payment.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{formatPKR(payment.amount)}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        String(payment.status || "").toLowerCase() === "paid"
                          ? "bg-emerald-50 text-emerald-600"
                          : String(payment.status || "").toLowerCase() === "pending_verification"
                            ? "bg-orange-50 text-orange-600"
                            : String(payment.status || "").toLowerCase() === "rejected"
                              ? "bg-rose-50 text-rose-600"
                              : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {String(payment.status || "").replace(/_/g, " ") || "pending"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => downloadInvoice(payment)}
                  >
                    Download Invoice
                  </button>
                  {["paid", "approved"].includes(String(payment.status || "").toLowerCase()) && (
                    <button
                      className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs text-green-700 hover:bg-green-100"
                      onClick={() => downloadReceipt(payment)}
                    >
                      Download Receipt
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}

      {activeTab === "Installment Plans" ? (
        <section className="space-y-3">
          {installmentsLoading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="skeleton h-28 rounded-2xl" />
            ))
          ) : installmentPlans.length < 1 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No installment plans found
            </div>
          ) : (
            installmentPlans.map((plan) => {
              const rows = Array.isArray(plan.installments) ? plan.installments : [];
              const paidCount = rows.filter(
                (row) => String(row.status || "").toLowerCase() === "paid"
              ).length;
              const nextDue = rows.find(
                (row) => String(row.status || "").toLowerCase() !== "paid"
              );
              const overdue = rows.some(
                (row) => String(row.status || "").toLowerCase() === "overdue"
              );
              const progress = rows.length > 0 ? (paidCount / rows.length) * 100 : 0;

              return (
                <div key={plan.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{plan.courseName || "-"}</p>
                      <p className="text-xs text-slate-500">
                        {paidCount} of {rows.length} paid
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        overdue ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {overdue ? "Overdue" : "Active"}
                    </span>
                  </div>

                  <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <p className="mt-3 text-sm text-slate-600">
                    Next due:{" "}
                    <span className={overdue ? "font-semibold text-rose-600" : "font-semibold"}>
                      {formatDate(nextDue?.dueDate)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Per installment: {formatPKR(plan.perInstallmentAmount)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                      onClick={() =>
                        setExpandedPlanId((prev) => (prev === plan.id ? null : plan.id))
                      }
                    >
                      {expandedPlanId === plan.id ? "Hide Schedule" : "View Schedule"}
                    </button>
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-400"
                      disabled
                    >
                      Pay Next Installment (Coming Soon)
                    </button>
                  </div>

                  {expandedPlanId === plan.id ? (
                    <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      {rows.map((row) => (
                        <div
                          key={row.number}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"
                        >
                          <span>#{row.number}</span>
                          <span>{formatPKR(row.amount)}</span>
                          <span>Due: {formatDate(row.dueDate)}</span>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                              String(row.status || "").toLowerCase() === "paid"
                                ? "bg-emerald-50 text-emerald-600"
                                : String(row.status || "").toLowerCase() === "overdue"
                                  ? "bg-rose-50 text-rose-600"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {row.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </section>
      ) : null}

      {activeTab === "Invoices" ? (
        <section className="space-y-3">
          {paymentsLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="skeleton h-20 rounded-2xl" />
            ))
          ) : paidInvoices.length < 1 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No invoices yet
            </div>
          ) : (
            paidInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div>
                  <p className="font-semibold text-slate-900">{invoice.courseName || "-"}</p>
                  <p className="text-xs text-slate-500">
                    {invoice.reference || "-"} | {formatDate(invoice.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{formatPKR(invoice.amount)}</p>
                  <button
                    className="mt-1 rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => downloadInvoice(invoice)}
                  >
                    Download PDF
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}
    </div>
  );
}

export default StudentPayments;
