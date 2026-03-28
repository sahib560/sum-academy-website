import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import { jsPDF } from "jspdf";
import {
  exportTransactionsCSV,
  getAdminTransactions,
  getTransactionById,
  verifyPayment,
} from "../../services/payment.service.js";

const MotionDiv = motion.div;

const METHOD_TABS = [
  { key: "all", label: "All" },
  { key: "jazzcash", label: "JazzCash" },
  { key: "easypaisa", label: "EasyPaisa" },
  { key: "bank_transfer", label: "Bank Transfer" },
];

const STATUS_OPTIONS = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "pending", label: "Pending" },
  { key: "pending_verification", label: "Pending Verification" },
  { key: "rejected", label: "Rejected" },
];

const statusClassMap = {
  paid: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  pending_verification: "bg-orange-50 text-orange-700",
  rejected: "bg-rose-50 text-rose-700",
};

const methodClassMap = {
  jazzcash: "bg-rose-50 text-rose-700",
  easypaisa: "bg-emerald-50 text-emerald-700",
  bank_transfer: "bg-blue-50 text-blue-700",
};

const formatMethod = (method = "") => {
  if (method === "bank_transfer") return "Bank Transfer";
  if (method === "jazzcash") return "JazzCash";
  if (method === "easypaisa") return "EasyPaisa";
  return method || "-";
};

const formatStatus = (status = "") =>
  String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const date = parseDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  const date = parseDate(value);
  if (!date) return "-";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatPKR = (amount) => `PKR ${Number(amount || 0).toLocaleString("en-PK")}`;
const canReviewTransaction = (transaction = {}) =>
  ["pending", "pending_verification"].includes(
    String(transaction.status || "").toLowerCase()
  );

const getInitials = (text = "") => {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 1) return "ST";
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");
};

const getRelativeTime = (value) => {
  const date = parseDate(value);
  if (!date) return "";
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, "day");
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

function Transactions() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [methodTab, setMethodTab] = useState("all");
  const [status, setStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const rowsPerPage = 20;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters = useMemo(
    () => ({
      method: methodTab === "all" ? "" : methodTab,
      status: status === "all" ? "" : status,
      search: debouncedSearch || "",
    }),
    [debouncedSearch, methodTab, status]
  );

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["admin-transactions", filters],
    queryFn: () => getAdminTransactions(filters),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: selectedTransaction, isFetching: isDetailLoading } = useQuery({
    queryKey: ["admin-transaction", selectedId],
    queryFn: () => getTransactionById(selectedId),
    enabled: Boolean(selectedId),
    staleTime: 30000,
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, action }) => verifyPayment(id, action),
    onSuccess: (_, variables) => {
      toast.success(
        variables.action === "approve"
          ? "Payment approved! Student enrolled."
          : "Payment rejected."
      );
      setPendingAction(null);
      setSelectedId("");
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transaction"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-installments"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update payment");
    },
  });

  const computed = useMemo(() => {
    const rows = (Array.isArray(transactions) ? transactions : []).map((item) => ({
      ...item,
      method: String(item.method || "").toLowerCase(),
      status: String(item.status || "").toLowerCase(),
    }));

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const totalRevenue = rows
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthRevenue = rows
      .filter((item) => {
        if (item.status !== "paid") return false;
        const createdAt = parseDate(item.createdAt);
        return (
          createdAt &&
          createdAt.getMonth() === currentMonth &&
          createdAt.getFullYear() === currentYear
        );
      })
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const pendingVerificationCount = rows.filter((item) =>
      canReviewTransaction(item)
    ).length;
    const rejectedCount = rows.filter((item) => item.status === "rejected").length;

    const methodCounts = {
      all: rows.length,
      jazzcash: rows.filter((item) => item.method === "jazzcash").length,
      easypaisa: rows.filter((item) => item.method === "easypaisa").length,
      bank_transfer: rows.filter((item) => item.method === "bank_transfer").length,
    };

    const filtered = rows
      .filter((item) => {
        if (methodTab !== "all" && item.method !== methodTab) return false;
        if (status !== "all" && item.status !== status) return false;

        if (debouncedSearch) {
          const query = debouncedSearch.toLowerCase();
          const studentName = String(item.studentName || "").toLowerCase();
          const courseName = String(item.courseName || "").toLowerCase();
          if (!studentName.includes(query) && !courseName.includes(query)) return false;
        }

        const createdAt = parseDate(item.createdAt);
        if (startDate) {
          const start = parseDate(startDate);
          if (start && (!createdAt || createdAt < start)) return false;
        }
        if (endDate) {
          const end = parseDate(endDate);
          if (end) {
            const endInclusive = new Date(end);
            endInclusive.setHours(23, 59, 59, 999);
            if (!createdAt || createdAt > endInclusive) return false;
          }
        }
        return true;
      })
      .sort(
        (a, b) =>
          (parseDate(b.createdAt)?.getTime() || 0) -
          (parseDate(a.createdAt)?.getTime() || 0)
      );

    return {
      totalRevenue,
      monthRevenue,
      pendingVerificationCount,
      rejectedCount,
      methodCounts,
      filtered,
    };
  }, [transactions, methodTab, status, debouncedSearch, startDate, endDate]);

  const totalRows = computed.filtered.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const safePage = Math.min(page, pageCount);
  const pageRows = computed.filtered.slice(
    (safePage - 1) * rowsPerPage,
    safePage * rowsPerPage
  );

  const showingFrom = totalRows < 1 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const showingTo = totalRows < 1 ? 0 : Math.min(safePage * rowsPerPage, totalRows);
  const hasActiveFilters = Boolean(
    debouncedSearch || methodTab !== "all" || status !== "all" || startDate || endDate
  );

  const clearAllFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setMethodTab("all");
    setStatus("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const handleCopy = async (value, message = "Copied!") => {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      toast.success(message);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleExportCSV = async () => {
    try {
      const blob = await exportTransactionsCSV();
      downloadBlob(blob, "transactions.csv");
      toast.success("Transactions exported as CSV.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to export CSV");
    }
  };

  const handleExportPDF = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text("SUM Academy - Transactions", 14, 16);
    pdf.setFontSize(10);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
    pdf.text(`Total Revenue: ${formatPKR(computed.totalRevenue)}`, 14, 28);

    let y = 36;
    computed.filtered.forEach((row, index) => {
      if (y > 280) {
        pdf.addPage();
        y = 16;
      }
      const line = `${index + 1}. ${row.studentName || "-"} | ${row.courseName || "-"} | ${formatMethod(row.method)} | ${formatPKR(row.amount)} | ${formatStatus(row.status)}`;
      pdf.text(line, 14, y);
      y += 6;
    });

    pdf.save(`SUM_Transactions_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const handleInvoicePdf = (tx) => {
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text("SUM Academy Invoice", 14, 18);
    pdf.setFontSize(10);
    pdf.text(`Transaction ID: ${tx.id}`, 14, 26);
    pdf.text(`Date: ${formatDateTime(tx.createdAt)}`, 14, 32);
    pdf.text(`Reference: ${tx.reference || "-"}`, 14, 38);
    pdf.text(`Student: ${tx.studentName || "-"}`, 14, 44);
    pdf.text(`Email: ${tx.studentEmail || "-"}`, 14, 50);
    pdf.text(`Course: ${tx.courseName || "-"}`, 14, 56);
    pdf.text(`Class: ${tx.className || "-"}`, 14, 62);
    pdf.text(`Method: ${formatMethod(tx.method)}`, 14, 68);
    pdf.text(`Original: ${formatPKR(tx.originalAmount || tx.amount)}`, 14, 76);
    pdf.text(`Discount: ${formatPKR(tx.discount)}`, 14, 82);
    pdf.setFontSize(12);
    pdf.text(`Final Amount: ${formatPKR(tx.amount)}`, 14, 90);
    pdf.setTextColor(22, 163, 74);
    pdf.text("PAID", 160, 20);
    pdf.setTextColor(0, 0, 0);
    pdf.save(`Invoice_${tx.reference || tx.id.slice(0, 8)}.pdf`);
    toast.success("Invoice downloaded.");
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-left" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Transactions</h2>
          <p className="text-sm text-slate-500">Live payment transactions with verification tools</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline" onClick={handleExportCSV}>Export CSV</button>
          <button className="btn-primary" onClick={handleExportPDF}>Export PDF</button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Revenue PKR", value: formatPKR(computed.totalRevenue) },
          { label: "This Month PKR", value: formatPKR(computed.monthRevenue) },
          { label: "Pending Requests", value: computed.pendingVerificationCount },
          { label: "Failed / Rejected", value: computed.rejectedCount },
        ].map((item) => (
          <div key={item.label} className="glass-card">
            <p className="text-sm text-slate-500">{item.label}</p>
            {isLoading ? <div className="skeleton mt-2 h-8 w-24" /> : <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>}
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {METHOD_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`rounded-full border-b-2 px-4 py-2 text-xs font-semibold ${methodTab === tab.key ? "border-primary text-primary" : "border-transparent text-slate-500"}`}
              onClick={() => {
                setMethodTab(tab.key);
                setPage(1);
              }}
            >
              {tab.label} <span className="text-slate-400">({computed.methodCounts[tab.key] || 0})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              placeholder="Search student or course..."
              className="w-full rounded-full border border-slate-200 px-4 py-2 pr-10 text-sm focus:border-primary focus:outline-none"
            />
            {searchInput ? (
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500" onClick={() => {
                setSearchInput("");
                setPage(1);
              }}>
                X
              </button>
            ) : null}
          </div>
          <select value={status} onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }} className="rounded-full border border-slate-200 px-4 py-2 text-sm">
            {STATUS_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                Status: {option.label}
              </option>
            ))}
          </select>
          <input type="date" value={startDate} onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }} className="rounded-full border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" value={endDate} onChange={(e) => {
            setEndDate(e.target.value);
            setPage(1);
          }} className="rounded-full border border-slate-200 px-3 py-2 text-sm" />
          {hasActiveFilters ? (
            <button className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700" onClick={clearAllFilters}>
              Clear All Filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-4">Transaction ID</th>
                <th className="px-4 py-4">Student</th>
                <th className="px-4 py-4">Course</th>
                <th className="px-4 py-4">Class</th>
                <th className="px-4 py-4">Method</th>
                <th className="px-4 py-4">Amount</th>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <tr key={`txn-skeleton-${index}`} className="border-b border-slate-100">
                    {Array.from({ length: 9 }).map((__, cellIndex) => (
                      <td key={`txn-cell-${cellIndex}`} className="px-4 py-4"><div className="skeleton h-5 w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : null}

              {!isLoading && totalRows < 1 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    {hasActiveFilters ? "No transactions match your filters" : "No transactions yet"}
                  </td>
                </tr>
              ) : null}

              {!isLoading && pageRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-4">
                    <div className="group flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-700" title={row.id}>
                        {row.id.slice(0, 8)}
                      </span>
                      <button className="text-[10px] text-slate-400 opacity-0 transition group-hover:opacity-100" onClick={() => handleCopy(row.id, "Transaction ID copied!")}>
                        Copy
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{getInitials(row.studentName)}</div>
                      <div>
                        <p className="font-semibold text-slate-900">{row.studentName || "-"}</p>
                        <p className="text-xs text-slate-500">{row.studentEmail || "-"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[220px] px-4 py-4 text-slate-700"><p className="truncate" title={row.courseName || "-"}>{row.courseName || "-"}</p></td>
                  <td className="px-4 py-4 text-slate-600">{row.className || "-"}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${methodClassMap[row.method] || "bg-slate-100 text-slate-700"}`}>{formatMethod(row.method)}</span></td>
                  <td className="px-4 py-4">
                    {row.discount > 0 ? <p className="text-xs text-slate-400 line-through">{formatPKR(row.originalAmount)}</p> : null}
                    <p className="text-base font-semibold text-slate-900">{formatPKR(row.amount)}</p>
                  </td>
                  <td className="px-4 py-4" title={getRelativeTime(row.createdAt)}>{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusClassMap[row.status] || "bg-slate-100 text-slate-700"}`}>
                      {canReviewTransaction(row) ? <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-orange-500" /> : null}
                      {formatStatus(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700" onClick={() => setSelectedId(row.id)}>View</button>
                      {canReviewTransaction(row) ? (
                        <>
                          <button className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700" onClick={() => setPendingAction({ id: row.id, action: "approve" })}>Approve</button>
                          <button className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700" onClick={() => setPendingAction({ id: row.id, action: "reject" })}>Reject</button>
                        </>
                      ) : null}
                      {row.status === "paid" ? <button className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700" onClick={() => handleInvoicePdf(row)}>Invoice</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
          <p>Showing {showingFrom}-{showingTo} of {totalRows} transactions</p>
          <div className="flex items-center gap-2">
            <span>Page {safePage} of {pageCount}</span>
            <button className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50" disabled={safePage <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Previous</button>
            <button className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50" disabled={safePage >= pageCount} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Next</button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedId ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
            <button type="button" className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => setSelectedId("")} />
            <MotionDiv initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }} className="relative z-10 max-h-[88vh] w-full max-w-[600px] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
              <button type="button" className="absolute right-4 top-4 rounded-full border border-slate-200 px-3 py-1 text-xs" onClick={() => setSelectedId("")}>X</button>
              <h3 className="font-heading text-2xl text-slate-900">Transaction Details</h3>
              {isDetailLoading || !selectedTransaction ? (
                <div className="mt-4 space-y-3">{Array.from({ length: 6 }).map((_, index) => <div key={`detail-skeleton-${index}`} className="skeleton h-10 w-full" />)}</div>
              ) : (
                <>
                  <div className="mt-4 rounded-2xl border border-slate-200 p-4 text-sm">
                    <p className="font-mono text-xs text-slate-700">{selectedTransaction.id}</p>
                    <p className="text-slate-600">{formatDateTime(selectedTransaction.createdAt)}</p>
                    <p className="mt-2 font-semibold text-slate-900">{selectedTransaction.studentName || "-"}</p>
                    <p className="text-slate-600">{selectedTransaction.studentEmail || "-"}</p>
                    <p className="text-slate-600">{selectedTransaction.courseName || "-"} - {selectedTransaction.className || "-"}</p>
                    <p className="text-slate-600">Method: {formatMethod(selectedTransaction.method)}</p>
                    <p className="text-slate-600">Original: {formatPKR(selectedTransaction.originalAmount)}</p>
                    <p className="text-slate-600">Discount: {formatPKR(selectedTransaction.discount)}</p>
                    <p className="text-lg font-semibold text-primary">Final: {formatPKR(selectedTransaction.amount)}</p>
                    <p className="font-mono text-xs text-slate-500">Ref: {selectedTransaction.reference || "-"}</p>
                  </div>
                  {selectedTransaction.method === "bank_transfer" ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 p-4">
                      {selectedTransaction.receiptUrl ? (
                        <a href={selectedTransaction.receiptUrl} target="_blank" rel="noreferrer">
                          <img src={selectedTransaction.receiptUrl} alt="Receipt" className="h-44 w-full rounded-2xl object-cover" />
                        </a>
                      ) : (
                        <p className="text-sm text-slate-500">No receipt uploaded</p>
                      )}
                    </div>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {canReviewTransaction(selectedTransaction) ? (
                      <>
                        <button className="btn-primary flex-1" onClick={() => setPendingAction({ id: selectedTransaction.id, action: "approve" })}>Approve</button>
                        <button className="flex-1 rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700" onClick={() => setPendingAction({ id: selectedTransaction.id, action: "reject" })}>Reject</button>
                      </>
                    ) : null}
                    {selectedTransaction.status === "paid" ? <button className="btn-outline w-full" onClick={() => handleInvoicePdf(selectedTransaction)}>Download Invoice PDF</button> : null}
                  </div>
                </>
              )}
            </MotionDiv>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {pendingAction ? (
          <div className="fixed inset-0 z-[95] flex items-center justify-center px-4">
            <button type="button" className="absolute inset-0 bg-slate-900/45" onClick={() => setPendingAction(null)} />
            <MotionDiv initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }} className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <h4 className="font-heading text-xl text-slate-900">{pendingAction.action === "approve" ? "Approve payment?" : "Reject payment?"}</h4>
              <p className="mt-2 text-sm text-slate-600">This will update transaction status immediately.</p>
              <div className="mt-5 flex gap-2">
                <button className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => setPendingAction(null)}>Cancel</button>
                <button className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold text-white ${pendingAction.action === "approve" ? "bg-emerald-600" : "bg-rose-600"}`} disabled={verifyMutation.isPending} onClick={() => verifyMutation.mutate({ id: pendingAction.id, action: pendingAction.action })}>
                  {verifyMutation.isPending ? "Please wait..." : pendingAction.action === "approve" ? "Approve" : "Reject"}
                </button>
              </div>
            </MotionDiv>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default Transactions;
