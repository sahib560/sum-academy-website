import { useMemo, useState } from "react";
import { motion as Motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import { getAvailableClasses } from "../../services/admin.service.js";
import {
  getPaymentConfig,
  initiatePayment,
  uploadPaymentReceipt as saveReceiptUrl,
  finishPaymentRequest,
  validatePromoCode,
} from "../../services/payment.service.js";
import { uploadPaymentReceipt as uploadReceiptToStorage } from "../../utils/firebaseUpload.js";
import FileUploader from "../../components/FileUploader.jsx";
import { useAuth } from "../../hooks/useAuth.js";

const STEPS = ["Order Summary", "Installment Option", "Payment Method", "Confirm"];

const METHOD_STYLE = {
  jazzcash: "border-rose-300 bg-rose-50",
  easypaisa: "border-emerald-300 bg-emerald-50",
  bank_transfer: "border-blue-300 bg-blue-50",
};

const formatPKR = (amount) => `PKR ${Number(amount || 0).toLocaleString("en-PK")}`;
const formatMethodLabel = (value = "") =>
  String(value || "")
    .replace("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

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
  const { userProfile } = useAuth();
  const enrollmentType = "full_class";
  const classInfoFromState = location.state?.classInfo || null;
  const course = null;
  const courseId = "";
  const prefillClassId = location.state?.prefillClassId || "";
  const prefillShiftId = location.state?.prefillShiftId || "";

  const [step, setStep] = useState(1);
  const [promoCode, setPromoCode] = useState("");
  const [promoInfo, setPromoInfo] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState(prefillClassId);
  const [selectedShiftId, setSelectedShiftId] = useState(prefillShiftId);
  const [installmentMode, setInstallmentMode] = useState("full");
  const [installments, setInstallments] = useState(2);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [initiatedPayment, setInitiatedPayment] = useState(null);
  const [receiptSubmitted, setReceiptSubmitted] = useState(false);
  const [receiptUploaded, setReceiptUploaded] = useState(false);

  const { data: paymentConfig } = useQuery({
    queryKey: ["payment-method-config"],
    queryFn: getPaymentConfig,
    staleTime: 30_000,
  });

  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: ["checkout-classes"],
    queryFn: () => getAvailableClasses(),
    enabled: true,
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

  const fallbackClassTotal = Number(classInfoFromState?.totalPrice || 0);
  const fallbackClassRemaining = Number(
    classInfoFromState?.remainingPrice || classInfoFromState?.totalPrice || 0
  );
  const classTotalFromSelection = Number(selectedClass?.totalPrice || fallbackClassTotal || 0);
  const classRemainingFromSelection = Number(
    selectedClass?.remainingPrice || fallbackClassRemaining || classTotalFromSelection || 0
  );
  const originalAmount =
    enrollmentType === "full_class"
      ? classRemainingFromSelection
      : Number(course?.originalPrice ?? course?.price ?? 0);
  const courseDiscountPercent = Math.max(
    0,
    Math.min(
      100,
      enrollmentType === "full_class" ? 0 : Number(course?.discountPercent || 0)
    )
  );
  const courseDiscountAmount = useMemo(
    () => Number(((originalAmount * courseDiscountPercent) / 100).toFixed(2)),
    [originalAmount, courseDiscountPercent]
  );
  const amountAfterCourseDiscount = useMemo(
    () => Number(Math.max(originalAmount - courseDiscountAmount, 0).toFixed(2)),
    [originalAmount, courseDiscountAmount]
  );
  const promoDiscountAmount = useMemo(() => {
    if (enrollmentType === "full_class") return 0;
    if (!promoInfo) return 0;
    if (promoInfo.discountType === "fixed") {
      return Math.min(amountAfterCourseDiscount, Number(promoInfo.discountValue || 0));
    }
    const pct = Math.min(Number(promoInfo.discountValue || 0), 100);
    return Number(((amountAfterCourseDiscount * pct) / 100).toFixed(2));
  }, [promoInfo, amountAfterCourseDiscount, enrollmentType]);
  const totalAmount = Math.max(
    Number((amountAfterCourseDiscount - promoDiscountAmount).toFixed(2)),
    0
  );

  const paymentMethods = useMemo(
    () => {
      const jazz = paymentConfig?.jazzcash || {};
      const easy = paymentConfig?.easypaisa || {};
      const jazzLegacyDisabled =
        jazz?.enabled === false &&
        !jazz?.merchantId &&
        !jazz?.accountTitle &&
        !jazz?.instructions;
      const easyLegacyDisabled =
        easy?.enabled === false &&
        !easy?.accountNumber &&
        !easy?.accountTitle &&
        !easy?.instructions;

      return [
        {
          id: "jazzcash",
          label: "JazzCash",
          enabled: jazzLegacyDisabled ? true : Boolean(jazz?.enabled ?? true),
        },
        {
          id: "easypaisa",
          label: "EasyPaisa",
          enabled: easyLegacyDisabled ? true : Boolean(easy?.enabled ?? true),
        },
        {
          id: "bank_transfer",
          label: "Bank Transfer",
          enabled: Boolean(paymentConfig?.bankTransfer?.enabled ?? true),
        },
      ];
    },
    [paymentConfig]
  );

  const jazzcashDetails = paymentConfig?.jazzcash || {
    merchantId: "----",
    accountTitle: "SUM Academy",
    instructions:
      "Send payment to JazzCash merchant and upload your transaction receipt.",
  };

  const easypaisaDetails = paymentConfig?.easypaisa || {
    accountNumber: "----",
    accountTitle: "SUM Academy",
    username: "",
    instructions:
      "Send payment to EasyPaisa account and upload your transaction receipt.",
  };

  const bankDetails = paymentConfig?.bankTransfer || {
    bankName: "Meezan Bank",
    accountTitle: "SUM Academy",
    accountNumber: "----",
    iban: "----",
  };

  const activePaymentMethod =
    paymentMethods.find((method) => method.id === paymentMethod && method.enabled)?.id ||
    paymentMethods.find((method) => method.enabled)?.id ||
    "bank_transfer";

  const selectedPaymentDetails =
    activePaymentMethod === "jazzcash"
      ? jazzcashDetails
      : activePaymentMethod === "easypaisa"
        ? easypaisaDetails
        : bankDetails;

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

  const amountDueNow =
    installmentMode === "installment"
      ? installmentPreview[0]?.amount ?? totalAmount
      : totalAmount;

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
        enrollmentType,
        classId: selectedClassId,
        shiftId: selectedShiftId,
        method: activePaymentMethod,
        promoCode: "",
        installments: installmentMode === "installment" ? Number(installments) : 1,
      }),
    onSuccess: (data) => {
      setInitiatedPayment(data);
      setReceiptSubmitted(false);
      setReceiptUploaded(false);
      toast.success(
        `${formatMethodLabel(data?.method || activePaymentMethod)} payment initiated.`
      );
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to initiate payment");
    },
  });

  const finishMutation = useMutation({
    mutationFn: () => finishPaymentRequest(initiatedPayment?.paymentId),
    onSuccess: () => {
      setReceiptSubmitted(true);
      toast.success("Payment submitted for verification");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to submit payment");
    },
  });

  if (enrollmentType === "single_course" && !courseId) {
    return null;
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

      <Motion.section
        key={step}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {step === 1 ? (
          <div className="space-y-4">
            <h2 className="font-heading text-xl text-slate-900">Order Summary</h2>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">
                {enrollmentType === "full_class"
                  ? `Full Class Enrollment - ${selectedClass?.name || classInfoFromState?.name || "Class"}`
                  : course.title || "Selected Course"}
              </p>
              {enrollmentType === "full_class" ? (
                <div className="mt-1 text-sm text-slate-600">
                  <p>
                    Access to all{" "}
                    {(selectedClass?.assignedSubjects ||
                      selectedClass?.assignedCourses ||
                      classInfoFromState?.assignedSubjects ||
                      classInfoFromState?.assignedCourses ||
                      []).length} subject(s)
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {(
                      selectedClass?.assignedSubjects ||
                      selectedClass?.assignedCourses ||
                      classInfoFromState?.assignedSubjects ||
                      classInfoFromState?.assignedCourses ||
                      []
                    ).map((row) => (
                      <li key={`inc-${row.subjectId || row.courseId || row.title}`}>
                        {row.title || row.courseName || "Subject"}
                      </li>
                    ))}
                  </ul>
                  {selectedClass?.isPartiallyEnrolled ? (
                    <p className="mt-2 text-xs text-amber-700">
                      You already paid for {selectedClass.purchasedSubjectsCount || 0} subject(s).
                      You are paying now: PKR{" "}
                      {Number(classRemainingFromSelection || 0).toLocaleString("en-PK")}
                      <span className="ml-2 line-through text-slate-400">
                        PKR {Number(classTotalFromSelection || 0).toLocaleString("en-PK")}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}
              <p className="mt-1 text-sm text-slate-600">
                Original Price: {formatPKR(originalAmount)}
              </p>
              <p className="text-sm text-slate-600">
                Course Discount ({courseDiscountPercent}%): -{formatPKR(courseDiscountAmount)}
              </p>
              {enrollmentType === "single_course" ? (
                <p className="text-sm text-slate-600">
                  Promo Discount: -{formatPKR(promoDiscountAmount)}
                </p>
              ) : null}
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
                  {classes.map((classItem) => {
  const spotsText = `${classItem.availableSpots} spots left`;
  const statusText = String(classItem.classStatus || classItem.status || "active");
  return (
    <option
      key={classItem.id}
      value={classItem.id}
      disabled={Boolean(classItem.isFull || classItem.isExpired)}
    >
      {classItem.name} ({classItem.batchCode || "No Batch"}) - {spotsText} - {statusText}
    </option>
  );
})}
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
                      {shift.name} - {(shift.days || []).map(shortDay).join(", ")} -{" "}
                      {formatTime(shift.startTime)}-{formatTime(shift.endTime)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {enrollmentType === "single_course" ? (
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
            ) : (
              <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Promo codes are available on individual course purchases only.
              </p>
            )}
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
                        Installment {row.number}: {formatPKR(row.amount)} - Due:{" "}
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
                    activePaymentMethod === method.id
                      ? "border-primary ring-2 ring-primary/20"
                      : ""
                  } ${METHOD_STYLE[method.id] || "border-slate-200 bg-slate-50"} ${
                    !method.enabled ? "opacity-60" : ""
                  }`}
                  disabled={!method.enabled}
                >
                  <p className="font-semibold text-slate-900">{method.label}</p>
                  {!method.enabled ? (
                    <span className="mt-2 inline-flex rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">
                      Disabled
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

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-slate-900">
                {activePaymentMethod === "bank_transfer"
                  ? "Bank Details"
                  : `${formatMethodLabel(activePaymentMethod)} Details`}
              </p>
              {activePaymentMethod === "jazzcash" ? (
                <>
                  <p className="mt-2 text-slate-600">
                    Merchant ID: {selectedPaymentDetails?.merchantId || "----"}
                  </p>
                  <p className="text-slate-600">
                    Account Title: {selectedPaymentDetails?.accountTitle || "SUM Academy"}
                  </p>
                </>
              ) : null}
              {activePaymentMethod === "easypaisa" ? (
                <>
                  <p className="mt-2 text-slate-600">
                    Account Number: {selectedPaymentDetails?.accountNumber || "----"}
                  </p>
                  <p className="text-slate-600">
                    Account Title: {selectedPaymentDetails?.accountTitle || "SUM Academy"}
                  </p>
                  {selectedPaymentDetails?.username ? (
                    <p className="text-slate-600">
                      Username: {selectedPaymentDetails.username}
                    </p>
                  ) : null}
                </>
              ) : null}
              {activePaymentMethod === "bank_transfer" ? (
                <>
                  <p className="mt-2 text-slate-600">Bank: {bankDetails.bankName}</p>
                  <p className="text-slate-600">Account Title: {bankDetails.accountTitle}</p>
                  <p className="text-slate-600">Account Number: {bankDetails.accountNumber}</p>
                  <p className="text-slate-600">IBAN: {bankDetails.iban}</p>
                </>
              ) : null}
              {selectedPaymentDetails?.instructions ? (
                <p className="mt-3 text-xs text-slate-500">
                  {selectedPaymentDetails.instructions}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <h2 className="font-heading text-xl text-slate-900">Confirm</h2>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-slate-900">
                {enrollmentType === "full_class"
                  ? `Full Class: ${selectedClass?.name || classInfoFromState?.name || "Class"}`
                  : course.title}
              </p>
              <p className="mt-1 text-slate-600">
                Class: {selectedClass?.name || "-"} - Shift: {selectedShift?.name || "-"}
              </p>
              {enrollmentType === "full_class" && selectedClass?.isPartiallyEnrolled ? (
                <p className="mt-1 text-xs text-amber-700">
                  Remaining enrollment only: PKR{" "}
                  {Number(classRemainingFromSelection || 0).toLocaleString("en-PK")}
                </p>
              ) : null}
              <p className="mt-1 text-slate-600">
                Method: {formatMethodLabel(activePaymentMethod)}
              </p>
              {installmentMode === "installment" ? (
                <>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    Amount Due Now: {formatPKR(amountDueNow)}
                  </p>
                  <p className="text-sm text-slate-600">
                    Total: {formatPKR(totalAmount)} - {installments} installments
                  </p>
                </>
              ) : (
                <p className="mt-2 text-base font-semibold text-slate-900">
                  Total: {formatPKR(totalAmount)}
                </p>
              )}
            </div>

            {!initiatedPayment ? (
              <button
                className="btn-primary w-full"
                disabled={initiateMutation.isPending}
                onClick={() => {
                  if (!selectedClassId || !selectedShiftId) {
                    toast.error("Please select class and shift first");
                    setStep(1);
                    return;
                  }
                  if (selectedClass?.isFull) {
                    toast.error("This class is full. Please choose another class.");
                    setStep(1);
                    return;
                  }
                  initiateMutation.mutate();
                }}
              >
                {initiateMutation.isPending ? "Processing..." : "Confirm Payment"}
              </button>
            ) : null}

            {initiatedPayment?.paymentId ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Payment Reference: {initiatedPayment.reference}
                </p>
                {initiatedPayment?.paymentDetails ? (
                  <p className="text-xs text-slate-600">
                    Method: {formatMethodLabel(
                      initiatedPayment.method || activePaymentMethod
                    )}
                  </p>
                ) : null}
                {initiatedPayment?.amount != null ? (
                  <p className="text-xs text-slate-600">
                    Amount Due Now: {formatPKR(initiatedPayment.amount)}
                    {initiatedPayment?.totalAmount
                      ? ` - Total ${formatPKR(initiatedPayment.totalAmount)}`
                      : ""}
                  </p>
                ) : null}
                <p className="text-xs text-slate-600">
                  Upload receipt image or PDF for admin verification.
                </p>
                <FileUploader
                  accept="image/*,.pdf"
                  maxSize={10}
                  label="Upload Payment Receipt"
                  hint="JPG, PNG, WEBP or PDF - max 10MB"
                  onUpload={async (file, { onProgress }) => {
                    if (!initiatedPayment?.paymentId) {
                      throw new Error("Payment session not found");
                    }
                    const uploaded = await uploadReceiptToStorage(
                      file,
                      userProfile?.uid || initiatedPayment.paymentId,
                      onProgress
                    );
                    const receiptRes = await saveReceiptUrl(
                      initiatedPayment.paymentId,
                      uploaded.url
                    );
                    if (receiptRes?.receiptUploaded || receiptRes?.url) {
                      setReceiptUploaded(true);
                    }
                    const alreadySubmitted =
                      receiptRes?.status === "pending_verification" ||
                      receiptRes?.status === "pending";
                    setReceiptSubmitted(alreadySubmitted);
                    toast.success(
                      alreadySubmitted
                        ? "Receipt uploaded. Waiting for admin verification."
                        : "Receipt uploaded. Click Finish to submit."
                    );
                    return uploaded;
                  }}
                />
                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={!receiptUploaded || receiptSubmitted || finishMutation.isPending}
                  onClick={() => finishMutation.mutate()}
                >
                  {finishMutation.isPending ? "Submitting..." : "Finish"}
                </button>
                <p
                  className={`text-xs ${
                    receiptSubmitted ? "text-amber-700" : "text-slate-600"
                  }`}
                >
                  Status:{" "}
                  {receiptSubmitted
                    ? "Pending Admin Verification"
                    : receiptUploaded
                      ? "Receipt uploaded (not submitted)"
                      : "Awaiting receipt upload"}
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
      </Motion.section>
    </div>
  );
}

export default Checkout;

