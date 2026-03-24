import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import { getAvailableClasses } from "../../services/admin.service.js";
import {
  getPaymentConfig,
  initiatePayment,
  uploadPaymentReceipt,
  validatePromoCode,
} from "../../services/payment.service.js";
import { uploadReceipt } from "../../utils/upload.firebase.js";

const STEPS = ["Order Summary", "Installment Option", "Payment Method", "Confirm"];

const METHOD_STYLE = {
  jazzcash: "border-rose-300 bg-rose-50",
  easypaisa: "border-emerald-300 bg-emerald-50",
  bank_transfer: "border-blue-300 bg-blue-50",
};

const formatPKR = (amount) => `PKR ${Number(amount || 0).toLocaleString("en-PK")}`;

const formatTime = (value = "") => {
  if (!/^\d{2}:\d{2}$/.test(value)) return value || "-";
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
};

const shortDay = (day = "") => day.slice(0, 3);

function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const course = location.state?.course || null;
  const courseId = course?.id || "";

  const [step, setStep] = useState(1);
  const [promoCode, setPromoCode] = useState("");
  const [promoInfo, setPromoInfo] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [installmentMode, setInstallmentMode] = useState("full");
  const [installments, setInstallments] = useState(2);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [initiatedPayment, setInitiatedPayment] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data: paymentConfig } = useQuery({
    queryKey: ["payment-method-config"],
    queryFn: getPaymentConfig,
    staleTime: 30_000,
  });

  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: ["checkout-classes", courseId],
    queryFn: () => getAvailableClasses(courseId),
    enabled: Boolean(courseId),
  });

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const selectedShift = useMemo(
    () =>
      (selectedClass?.shifts || []).find((shift) => shift.id === selectedShiftId) ||
      null,
    [selectedClass, selectedShiftId]
  );

  const originalAmount = Number(course?.price || 0);
  const discountAmount = useMemo(() => {
    if (!promoInfo) return 0;
    if (promoInfo.discountType === "fixed") {
      return Math.min(originalAmount, Number(promoInfo.discountValue || 0));
    }
    const pct = Math.min(Number(promoInfo.discountValue || 0), 100);
    return Number(((originalAmount * pct) / 100).toFixed(2));
  }, [promoInfo, originalAmount]);
  const totalAmount = Math.max(Number((originalAmount - discountAmount).toFixed(2)), 0);

  const paymentMethods = useMemo(
    () => [
      {
        id: "jazzcash",
        label: "JazzCash",
        enabled: Boolean(paymentConfig?.jazzcash?.enabled),
      },
      {
        id: "easypaisa",
        label: "EasyPaisa",
        enabled: Boolean(paymentConfig?.easypaisa?.enabled),
      },
      {
        id: "bank_transfer",
        label: "Bank Transfer",
        enabled: Boolean(paymentConfig?.bankTransfer?.enabled ?? true),
      },
    ],
    [paymentConfig]
  );

  const bankDetails = paymentConfig?.bankTransfer || {
    bankName: "Meezan Bank",
    accountTitle: "SUM Academy",
    accountNumber: "----",
    iban: "----",
  };

  const installmentPreview = useMemo(() => {
    if (installmentMode !== "installment") return [];
    const count = Number(installments);
    if (count < 2) return [];
    const per = Number((totalAmount / count).toFixed(2));
    const start = new Date();
    return Array.from({ length: count }).map((_, index) => {
      const due = new Date(start);
      due.setMonth(due.getMonth() + index);
      const amount =
        index === count - 1
          ? Number((totalAmount - per * index).toFixed(2))
          : per;
      return {
        number: index + 1,
        amount,
        dueDate: due,
      };
    });
  }, [installmentMode, installments, totalAmount]);

  const applyPromoMutation = useMutation({
    mutationFn: () => validatePromoCode(promoCode, courseId),
    onSuccess: (data) => {
      setPromoInfo(data);
      toast.success("Promo code applied");
    },
    onError: (error) => {
      setPromoInfo(null);
      toast.error(error?.response?.data?.message || "Invalid promo code");
    },
  });

  const initiateMutation = useMutation({
    mutationFn: () =>
      initiatePayment({
        courseId,
        classId: selectedClassId,
        shiftId: selectedShiftId,
        method: paymentMethod,
        promoCode: promoCode ? promoCode.toUpperCase() : "",
        installments: installmentMode === "installment" ? Number(installments) : 1,
      }),
    onSuccess: (data) => {
      setInitiatedPayment(data);
      if (paymentMethod === "bank_transfer") {
        toast.success("Payment initiated. Upload your receipt.");
      } else {
        toast.success("Gateway initiation started.");
      }
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to initiate payment");
    },
  });

  const uploadReceiptMutation = useMutation({
    mutationFn: async () => {
      if (!receiptFile || !initiatedPayment?.paymentId) {
        throw new Error("Please choose a receipt image first.");
      }

      const uploaded = await uploadReceipt(
        receiptFile,
        initiatedPayment.paymentId,
        setUploadProgress
      );
      return uploadPaymentReceipt(initiatedPayment.paymentId, uploaded.url);
    },
    onSuccess: () => {
      setReceiptFile(null);
      setUploadProgress(100);
      toast.success("Payment submitted for verification");
    },
    onError: (error) => {
      toast.error(error?.message || "Failed to upload receipt");
    },
  });

  if (!courseId) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <p className="text-slate-600">No course selected for checkout.</p>
        <button className="btn-primary mt-4" onClick={() => navigate("/student/explore")}>
          Back to Explore
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-left" />

      <div>
        <h1 className="font-heading text-3xl text-slate-900">Checkout</h1>
        <p className="text-sm text-slate-500">Complete your enrollment securely</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index + 1)}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              step === index + 1
                ? "bg-primary text-white"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      <motion.section
        key={step}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {step === 1 ? (
          <div className="space-y-4">
            <h2 className="font-heading text-xl text-slate-900">Order Summary</h2>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">{course.title || "Selected Course"}</p>
              <p className="mt-1 text-sm text-slate-600">
                Original Price: {formatPKR(originalAmount)}
              </p>
              <p className="text-sm text-slate-600">
                Discount: -{formatPKR(discountAmount)}
              </p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                Total: {formatPKR(totalAmount)}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-700">Select Class</label>
                <select
                  value={selectedClassId}
                  onChange={(event) => {
                    setSelectedClassId(event.target.value);
                    setSelectedShiftId("");
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">
                    {classesLoading ? "Loading classes..." : "Choose class"}
                  </option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name} ({classItem.batchCode || "No Batch"}) ·{" "}
                      {classItem.availableSpots} spots left
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Select Shift</label>
                <select
                  value={selectedShiftId}
                  onChange={(event) => setSelectedShiftId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  disabled={!selectedClass}
                >
                  <option value="">{selectedClass ? "Choose shift" : "Select class first"}</option>
                  {(selectedClass?.shifts || []).map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} · {(shift.days || []).map(shortDay).join(", ")} ·{" "}
                      {formatTime(shift.startTime)}-{formatTime(shift.endTime)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Promo Code</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                  placeholder="ENTER CODE"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  className="btn-outline"
                  disabled={!promoCode || applyPromoMutation.isPending}
                  onClick={() => applyPromoMutation.mutate()}
                >
                  Validate
                </button>
              </div>
              {promoInfo ? (
                <p className="mt-2 text-xs text-emerald-600">
                  Applied: {promoInfo.code} ({promoInfo.discountType}{" "}
                  {promoInfo.discountValue})
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <h2 className="font-heading text-xl text-slate-900">Installment Option</h2>
            <div className="flex flex-wrap gap-2">
              <button
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  installmentMode === "full"
                    ? "bg-primary text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
                onClick={() => setInstallmentMode("full")}
              >
                Pay Full
              </button>
              <button
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  installmentMode === "installment"
                    ? "bg-primary text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
                onClick={() => setInstallmentMode("installment")}
              >
                Installment
              </button>
            </div>

            {installmentMode === "installment" ? (
              <div className="space-y-3">
                <select
                  value={installments}
                  onChange={(event) => setInstallments(Number(event.target.value))}
                  className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {[2, 3, 4, 6].map((count) => (
                    <option key={count} value={count}>
                      {count} installments
                    </option>
                  ))}
                </select>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-900">Schedule Preview</p>
                  <div className="space-y-1 text-xs text-slate-600">
                    {installmentPreview.map((row) => (
                      <p key={row.number}>
                        Installment {row.number}: {formatPKR(row.amount)} — Due:{" "}
                        {row.dueDate.toLocaleDateString()}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                You selected full payment: {formatPKR(totalAmount)}
              </p>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <h2 className="font-heading text-xl text-slate-900">Payment Method</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => method.enabled && setPaymentMethod(method.id)}
                  className={`rounded-2xl border p-4 text-left ${
                    paymentMethod === method.id ? "border-primary ring-2 ring-primary/20" : ""
                  } ${METHOD_STYLE[method.id] || "border-slate-200 bg-slate-50"} ${
                    !method.enabled ? "opacity-60" : ""
                  }`}
                  disabled={!method.enabled}
                >
                  <p className="font-semibold text-slate-900">{method.label}</p>
                  {!method.enabled ? (
                    <span className="mt-2 inline-flex rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">
                      Coming Soon
                    </span>
                  ) : null}
                  {method.id === "bank_transfer" ? (
                    <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                      Recommended
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {paymentMethod === "bank_transfer" ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-slate-900">Bank Details</p>
                <p className="mt-2 text-slate-600">Bank: {bankDetails.bankName}</p>
                <p className="text-slate-600">Account Title: {bankDetails.accountTitle}</p>
                <p className="text-slate-600">Account Number: {bankDetails.accountNumber}</p>
                <p className="text-slate-600">IBAN: {bankDetails.iban}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <h2 className="font-heading text-xl text-slate-900">Confirm</h2>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-slate-900">{course.title}</p>
              <p className="mt-1 text-slate-600">
                Class: {selectedClass?.name || "-"} · Shift: {selectedShift?.name || "-"}
              </p>
              <p className="mt-1 text-slate-600">
                Method: {paymentMethod.replace("_", " ")}
              </p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                Total: {formatPKR(totalAmount)}
              </p>
            </div>

            {!initiatedPayment ? (
              <button
                className="btn-primary w-full"
                disabled={initiateMutation.isPending}
                onClick={() => {
                  const requiresClassSelection = classes.length > 0;
                  if (
                    requiresClassSelection &&
                    (!selectedClassId || !selectedShiftId)
                  ) {
                    toast.error("Please select class and shift first");
                    setStep(1);
                    return;
                  }
                  initiateMutation.mutate();
                }}
              >
                {initiateMutation.isPending ? "Processing..." : "Confirm Payment"}
              </button>
            ) : null}

            {initiatedPayment?.paymentId && paymentMethod === "bank_transfer" ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Payment Reference: {initiatedPayment.reference}
                </p>
                <p className="text-xs text-slate-600">
                  Upload receipt image (JPG/PNG, max 5MB) for admin verification.
                </p>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(event) => {
                    setUploadProgress(0);
                    setReceiptFile(event.target.files?.[0] || null);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
                {uploadProgress > 0 ? (
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                ) : null}
                <button
                  className="btn-primary w-full"
                  disabled={!receiptFile || uploadReceiptMutation.isPending}
                  onClick={() => uploadReceiptMutation.mutate()}
                >
                  {uploadReceiptMutation.isPending ? "Uploading..." : "Upload Receipt"}
                </button>
                <p className="text-xs text-amber-700">
                  Status: Pending Admin Verification
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600"
            onClick={() => setStep((prev) => Math.max(1, prev - 1))}
            disabled={step === 1}
          >
            Back
          </button>
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600"
            onClick={() => setStep((prev) => Math.min(4, prev + 1))}
            disabled={step === 4}
          >
            Next
          </button>
        </div>
      </motion.section>
    </div>
  );
}

export default Checkout;
