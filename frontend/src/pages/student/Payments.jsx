import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import toast, { Toaster } from "react-hot-toast";
import {
  getMyPayments,
  getMyInstallments,
} from "../../services/payment.service.js";

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
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Modern header with gradient background
    pdf.setFillColor(59, 130, 246); // Blue header
    pdf.rect(0, 0, pageWidth, 40, "F");

    // White content area
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 40, pageWidth, pageHeight - 40, "F");

    // Academy Logo placeholder (you can add actual logo loading here)
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.text("SUM ACADEMY", 20, 25);

    // Invoice title
    pdf.setFontSize(18);
    pdf.text("INVOICE", pageWidth - 20, 25, { align: "right" });

    // Invoice details box
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(20, 50, pageWidth - 40, 60, 3, 3);

    // Invoice info
    pdf.setTextColor(31, 41, 55);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Invoice Details", 25, 65);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Invoice Number: ${payment.reference || payment.id}`, 25, 75);
    pdf.text(`Issue Date: ${formatDate(payment.createdAt)}`, 25, 82);
    pdf.text(`Payment Status: ${payment.status || "Completed"}`, 25, 89);
    pdf.text(`Payment Method: ${payment.method || "Bank Transfer"}`, 25, 96);

    // Billing information
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Bill To:", pageWidth - 80, 65);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(payment.studentName || "Student", pageWidth - 80, 75);
    pdf.text("SUM Academy Student", pageWidth - 80, 82);
    pdf.text("Pakistan", pageWidth - 80, 89);

    // Course details section
    pdf.setFillColor(249, 250, 251);
    pdf.roundedRect(20, 120, pageWidth - 40, 40, 3, 3, "F");
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(20, 120, pageWidth - 40, 40, 3, 3);

    pdf.setTextColor(31, 41, 55);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Course Details", 25, 135);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Course: ${payment.courseName || "N/A"}`, 25, 145);
    pdf.text(`Class: ${payment.className || "N/A"}`, 25, 152);

    // Amount breakdown
    pdf.setFillColor(249, 250, 251);
    pdf.roundedRect(20, 170, pageWidth - 40, 50, 3, 3, "F");
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(20, 170, pageWidth - 40, 50, 3, 3);

    // Table headers
    pdf.setTextColor(31, 41, 55);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("Description", 25, 185);
    pdf.text("Qty", 120, 185);
    pdf.text("Unit Price", 140, 185);
    pdf.text("Amount", pageWidth - 25, 185, { align: "right" });

    // Table line
    pdf.setDrawColor(209, 213, 219);
    pdf.setLineWidth(0.3);
    pdf.line(25, 188, pageWidth - 25, 188);

    // Item details
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(payment.courseName || "Course Fee", 25, 198);
    pdf.text("1", 120, 198);
    pdf.text(formatPKR(payment.amount), 140, 198);
    pdf.text(formatPKR(payment.amount), pageWidth - 25, 198, { align: "right" });

    // Total section
    pdf.setDrawColor(59, 130, 246);
    pdf.setLineWidth(0.8);
    pdf.line(120, 210, pageWidth - 25, 210);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(59, 130, 246);
    pdf.text("TOTAL:", 140, 220);
    pdf.text(formatPKR(payment.amount), pageWidth - 25, 220, { align: "right" });

    // Footer
    pdf.setTextColor(107, 114, 128);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("Thank you for choosing SUM Academy!", pageWidth / 2, pageHeight - 30, { align: "center" });
    pdf.text("For any queries, contact us at help@sumacademy.net", pageWidth / 2, pageHeight - 25, { align: "center" });
    pdf.text("© 2026 SUM Academy. All rights reserved.", pageWidth / 2, pageHeight - 15, { align: "center" });

    // Decorative elements
    pdf.setDrawColor(59, 130, 246);
    pdf.setLineWidth(0.3);
    pdf.line(20, pageHeight - 35, pageWidth - 20, pageHeight - 35);

    pdf.save(`SUM_Invoice_${payment.reference || payment.id}.pdf`);
    toast.success("Invoice downloaded successfully!");
  };

  const downloadReceipt = async (payment) => {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Modern header with green accent for receipts
    pdf.setFillColor(16, 185, 129); // Green header
    pdf.rect(0, 0, pageWidth, 35, "F");

    // White content area
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 35, pageWidth, pageHeight - 35, "F");

    // Academy Logo placeholder
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text("SUM ACADEMY", 20, 22);

    // Receipt title
    pdf.setFontSize(16);
    pdf.text("PAYMENT RECEIPT", pageWidth - 20, 22, { align: "right" });

    // Receipt details box
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(20, 45, pageWidth - 40, 50, 3, 3);

    // Receipt info
    pdf.setTextColor(31, 41, 55);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Receipt Details", 25, 60);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Receipt Number: ${payment.reference || payment.id}`, 25, 70);
    pdf.text(`Payment Date: ${formatDate(payment.createdAt)}`, 25, 77);
    pdf.text(`Status: Payment Approved`, 25, 84);
    pdf.text(`Transaction ID: ${payment.transactionId || "N/A"}`, 25, 91);

    // Student information
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Received From:", pageWidth - 80, 60);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(payment.studentName || "Student", pageWidth - 80, 70);
    pdf.text("SUM Academy Student", pageWidth - 80, 77);
    pdf.text("Pakistan", pageWidth - 80, 84);

    // Payment details section
    pdf.setFillColor(249, 250, 251);
    pdf.roundedRect(20, 105, pageWidth - 40, 40, 3, 3, "F");
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(20, 105, pageWidth - 40, 40, 3, 3);

    pdf.setTextColor(31, 41, 55);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Payment Details", 25, 120);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Course: ${payment.courseName || "N/A"}`, 25, 130);
    pdf.text(`Class: ${payment.className || "N/A"}`, 25, 137);
    pdf.text(`Payment Method: ${payment.method || "Bank Transfer"}`, 25, 144);

    // Amount section
    pdf.setFillColor(16, 185, 129);
    pdf.roundedRect(20, 155, pageWidth - 40, 30, 3, 3, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("AMOUNT RECEIVED", pageWidth / 2, 170, { align: "center" });
    pdf.setFontSize(18);
    pdf.text(formatPKR(payment.amount), pageWidth / 2, 180, { align: "center" });

    // Approval stamp
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(pageWidth - 60, 190, 40, 20, 2, 2, "F");
    pdf.setDrawColor(16, 185, 129);
    pdf.setLineWidth(1);
    pdf.roundedRect(pageWidth - 60, 190, 40, 20, 2, 2);

    pdf.setTextColor(16, 185, 129);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("APPROVED", pageWidth - 40, 198, { align: "center" });
    pdf.setFontSize(6);
    pdf.text(formatDate(new Date()), pageWidth - 40, 203, { align: "center" });

    // Footer
    pdf.setTextColor(107, 114, 128);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("This receipt confirms successful payment processing.", pageWidth / 2, pageHeight - 30, { align: "center" });
    pdf.text("Keep this receipt for your records.", pageWidth / 2, pageHeight - 25, { align: "center" });
    pdf.text("© 2026 SUM Academy. All rights reserved.", pageWidth / 2, pageHeight - 15, { align: "center" });

    // Decorative elements
    pdf.setDrawColor(16, 185, 129);
    pdf.setLineWidth(0.3);
    pdf.line(20, pageHeight - 35, pageWidth - 20, pageHeight - 35);

    pdf.save(`SUM_Receipt_${payment.reference || payment.id}.pdf`);
    toast.success("Receipt downloaded successfully!");
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-left" />

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="font-heading text-3xl text-slate-900">Payments</h1>
        <p className="text-sm text-slate-500">
          Track your transactions, installments, and invoices
        </p>
      </motion.section>

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
                      {payment.method || "-"} · {formatDate(payment.createdAt)}
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
                  {payment.status === "approved" && (
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
                    {invoice.reference || "-"} · {formatDate(invoice.createdAt)}
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

