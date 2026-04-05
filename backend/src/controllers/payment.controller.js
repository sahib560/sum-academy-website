import { admin, db } from "../config/firebase.js";
import { PAYMENT_CONFIG } from "../config/payment.config.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";
import {
  sendPaymentConfirmation,
  sendPaymentRejected,
  sendInstallmentReminder,
  sendBankTransferInitiated,
  sendInstallmentPaidEmail,
  sendInstallmentPlanCreatedEmail,
  sendInstallmentReminderEmail,
} from "../services/email.service.js";

const { FieldValue } = admin.firestore;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getEnrollmentStatusFromClassDates = (classData = {}) => {
  const start = parseDate(classData?.startDate);
  const end = parseDate(classData?.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (start) {
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    if (today.getTime() < startDay.getTime()) return "upcoming";
  }

  if (end) {
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    if (today.getTime() > endDay.getTime()) return "completed";
  }

  return "active";
};

const mergeEnrollmentStatus = (currentStatus = "", nextStatus = "") => {
  const current = String(currentStatus || "").trim().toLowerCase();
  const next = String(nextStatus || "").trim().toLowerCase();
  if (current === "active" || next === "active") return "active";
  if (current === "upcoming" || next === "upcoming") return "upcoming";
  if (next) return next;
  return current || "active";
};

const serializeTimestamp = (value) => {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
};

const generateReference = () =>
  `SUM-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

const normalizePromoCode = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase();

const isPromoCodeFormatValid = (value = "") => /^[A-Z0-9]+$/.test(value);

const normalizePaymentStatus = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase();

const ACTIVE_PROMO_USAGE_STATUSES = new Set([
  "pending",
  "pending_verification",
  "paid",
]);

const RESERVED_CLASS_SEAT_STATUSES = new Set([
  "pending",
  "pending_verification",
]);

const escapeCsv = (value = "") =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

const addDays = (date, days) => {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
};

const startOfDay = (date) => {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
};

const getDateOnlyISO = (date) => {
  if (!date) return null;
  return date.toISOString().split("T")[0];
};

const getDocMap = async (collectionName, ids = []) => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length < 1) return {};

  const snaps = await Promise.all(
    uniqueIds.map((id) => db.collection(collectionName).doc(id).get())
  );

  return snaps.reduce((acc, snap) => {
    if (snap.exists) acc[snap.id] = snap.data() || {};
    return acc;
  }, {});
};

const normalizePaymentMethod = (value = "") => String(value || "").toLowerCase();

const formatPaymentMethodLabel = (value = "") => {
  const method = normalizePaymentMethod(value);
  if (method === "bank_transfer") return "Bank Transfer";
  if (method === "jazzcash") return "JazzCash";
  if (method === "easypaisa") return "EasyPaisa";
  return method || "-";
};

const resolveEnabled = (value, fallback = true) =>
  typeof value === "boolean" ? value : fallback;

const sortByCreatedAtDesc = (a, b) =>
  (parseDate(b.createdAt)?.getTime() || 0) -
  (parseDate(a.createdAt)?.getTime() || 0);

const buildInstallmentSchedule = (amount, installments, startDate = null) => {
  const count = Number(installments || 1);
  if (count <= 1) return null;

  const total = Math.max(toNumber(amount), 0);
  const per = Math.floor((total / count) * 100) / 100;
  let remaining = total;
  const schedule = [];

  const base = startDate ? parseDate(startDate) : new Date();
  if (!base) return null;
  base.setHours(0, 0, 0, 0);

  for (let index = 0; index < count; index += 1) {
    const due = new Date(base);
    due.setMonth(due.getMonth() + index);

    const isLast = index === count - 1;
    const installmentAmount = isLast
      ? Number(remaining.toFixed(2))
      : Number(per.toFixed(2));
    remaining = Number((remaining - installmentAmount).toFixed(2));

    schedule.push({
      number: index + 1,
      amount: installmentAmount,
      dueDate: due.toISOString().split("T")[0],
      status: "pending",
      paidAt: null,
      paymentId: null,
    });
  }

  return schedule;
};

const getStudentIdentity = async (uid) => {
  const [studentSnap, userSnap] = await Promise.all([
    db.collection(COLLECTIONS.STUDENTS).doc(uid).get(),
    db.collection(COLLECTIONS.USERS).doc(uid).get(),
  ]);

  if (!userSnap.exists) return null;
  const userData = userSnap.data() || {};
  const studentData = studentSnap.exists ? studentSnap.data() || {} : {};

  return {
    uid,
    email: userData.email || "",
    fullName:
      studentData.fullName ||
      (userData.email ? userData.email.split("@")[0] : "Student"),
  };
};

const getCourseById = async (courseId) => {
  const courseSnap = await db.collection(COLLECTIONS.COURSES).doc(courseId).get();
  if (!courseSnap.exists) return null;
  return { id: courseSnap.id, ...(courseSnap.data() || {}) };
};

const getClassById = async (classId) => {
  if (!classId) return null;
  const classSnap = await db.collection(COLLECTIONS.CLASSES).doc(classId).get();
  if (!classSnap.exists) return null;
  return { id: classSnap.id, ...(classSnap.data() || {}) };
};

const getClassAssignedCourseIds = (classData = {}) => {
  const ids = [];

  const directCourseId = String(classData.courseId || "").trim();
  if (directCourseId) ids.push(directCourseId);

  const assignedCourses = Array.isArray(classData.assignedCourses)
    ? classData.assignedCourses
    : [];
  assignedCourses.forEach((entry) => {
    const courseId =
      typeof entry === "string"
        ? String(entry).trim()
        : String(entry?.courseId || entry?.id || "").trim();
    if (courseId) ids.push(courseId);
  });

  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  shifts.forEach((shift) => {
    const courseId = String(shift?.courseId || "").trim();
    if (courseId) ids.push(courseId);
  });

  return [...new Set(ids)];
};

const validateClassShiftSelection = ({ classData = {}, shiftId = "", courseId = "" }) => {
  const normalizedShiftId = String(shiftId || "").trim();
  const normalizedCourseId = String(courseId || "").trim();
  if (!normalizedShiftId) {
    return { error: "shiftId is required", status: 400 };
  }

  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  const selectedShift = shifts.find(
    (shift) => String(shift?.id || "").trim() === normalizedShiftId
  );
  if (!selectedShift) {
    return { error: "Selected shift was not found in this class", status: 400 };
  }

  const shiftCourseId = String(selectedShift.courseId || "").trim();
  if (!shiftCourseId) {
    return { error: "Selected shift is missing a linked course", status: 400 };
  }

  if (normalizedCourseId && shiftCourseId !== normalizedCourseId) {
    return {
      error: "Selected class shift does not belong to the selected course",
      status: 400,
    };
  }

  const classCourseIds = getClassAssignedCourseIds(classData);
  if (normalizedCourseId && !classCourseIds.includes(normalizedCourseId)) {
    return {
      error: "Selected class is not assigned to the selected course",
      status: 400,
    };
  }

  return { shift: selectedShift, shiftCourseId };
};

const countActivePromoUsage = async ({ promoCodeId = "", normalizedCode = "" }) => {
  const cleanPromoId = String(promoCodeId || "").trim();
  const cleanCode = normalizePromoCode(normalizedCode);
  const docsById = new Map();

  if (cleanPromoId) {
    const byIdSnap = await db
      .collection(COLLECTIONS.PAYMENTS)
      .where("promoCodeId", "==", cleanPromoId)
      .get();
    byIdSnap.docs.forEach((doc) => docsById.set(doc.id, doc));
  }

  if (cleanCode) {
    const byCodeSnap = await db
      .collection(COLLECTIONS.PAYMENTS)
      .where("promoCode", "==", cleanCode)
      .get();
    byCodeSnap.docs.forEach((doc) => docsById.set(doc.id, doc));
  }

  let count = 0;
  docsById.forEach((doc) => {
    const row = doc.data() || {};
    const status = normalizePaymentStatus(row.status);
    if (ACTIVE_PROMO_USAGE_STATUSES.has(status)) {
      count += 1;
    }
  });

  return count;
};

const hasStudentUsedPromo = async ({ studentId = "", promoCodeId = "", normalizedCode = "" }) => {
  const cleanStudentId = String(studentId || "").trim();
  if (!cleanStudentId) return false;

  const studentPaymentsSnap = await db
    .collection(COLLECTIONS.PAYMENTS)
    .where("studentId", "==", cleanStudentId)
    .get();

  const cleanPromoId = String(promoCodeId || "").trim();
  const cleanCode = normalizePromoCode(normalizedCode);

  return studentPaymentsSnap.docs.some((doc) => {
    const payment = doc.data() || {};
    const status = normalizePaymentStatus(payment.status);
    if (!ACTIVE_PROMO_USAGE_STATUSES.has(status)) return false;

    const samePromoId =
      cleanPromoId && String(payment.promoCodeId || "").trim() === cleanPromoId;
    const sameCode =
      cleanCode && normalizePromoCode(payment.promoCode) === cleanCode;
    return Boolean(samePromoId || sameCode);
  });
};

const countReservedSeatsForClass = async (classId, excludedStudentIds = []) => {
  const cleanClassId = String(classId || "").trim();
  if (!cleanClassId) return 0;

  const excluded = new Set(
    (Array.isArray(excludedStudentIds) ? excludedStudentIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  );

  const snap = await db
    .collection(COLLECTIONS.PAYMENTS)
    .where("classId", "==", cleanClassId)
    .get();

  const reservedStudents = new Set();
  snap.docs.forEach((doc) => {
    const row = doc.data() || {};
    const status = normalizePaymentStatus(row.status);
    if (!RESERVED_CLASS_SEAT_STATUSES.has(status)) return;
    const studentId = String(row.studentId || "").trim();
    if (!studentId || excluded.has(studentId)) return;
    reservedStudents.add(studentId);
  });

  return reservedStudents.size;
};

const fetchMergedPayments = async () => {
  const paymentsSnap = await db.collection(COLLECTIONS.PAYMENTS).get();
  const payments = paymentsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));

  const studentIds = payments.map((item) => item.studentId).filter(Boolean);
  const courseIds = payments.map((item) => item.courseId).filter(Boolean);
  const classIds = payments.map((item) => item.classId).filter(Boolean);

  const [studentMap, userMap, courseMap, classMap] = await Promise.all([
    getDocMap(COLLECTIONS.STUDENTS, studentIds),
    getDocMap(COLLECTIONS.USERS, studentIds),
    getDocMap(COLLECTIONS.COURSES, courseIds),
    getDocMap(COLLECTIONS.CLASSES, classIds),
  ]);

  return payments.map((item) => {
    const student = studentMap[item.studentId] || {};
    const user = userMap[item.studentId] || {};
    const course = courseMap[item.courseId] || {};
    const classInfo = classMap[item.classId] || {};

    const studentName =
      student.fullName ||
      item.studentName ||
      (user.email ? String(user.email).split("@")[0] : "Student");

    const className = item.className || classInfo.name || "";

    return {
      id: item.id,
      studentId: item.studentId || null,
      studentName,
      studentEmail: user.email || "",
      courseId: item.courseId || null,
      courseName: item.courseName || course.title || "",
      classId: item.classId || null,
      className,
      shiftId: item.shiftId || null,
      method: normalizePaymentMethod(item.method),
      amount: toNumber(item.amount),
      totalAmount: toNumber(item.totalAmount, toNumber(item.amount)),
      originalAmount: toNumber(item.originalAmount, toNumber(item.amount)),
      discount: toNumber(item.discount),
      courseDiscountPercent: toNumber(item.courseDiscountPercent),
      courseDiscountAmount: toNumber(item.courseDiscountAmount),
      promoDiscountAmount: toNumber(item.promoDiscountAmount),
      status: String(item.status || "").toLowerCase() || "pending",
      receiptUrl: item.receiptUrl || null,
      canApprove:
        normalizePaymentStatus(item.status) === "pending_verification" &&
        Boolean(String(item.receiptUrl || "").trim()),
      isAwaitingReceipt:
        normalizePaymentStatus(item.status) === "pending" &&
        !String(item.receiptUrl || "").trim(),
      reference: item.reference || "",
      promoCode: item.promoCode || null,
      isInstallment: Boolean(item.isInstallment),
      numberOfInstallments: toNumber(item.numberOfInstallments),
      installments: Array.isArray(item.installments) ? item.installments : null,
      createdAt: serializeTimestamp(item.createdAt),
      updatedAt: serializeTimestamp(item.updatedAt),
      verifiedAt: serializeTimestamp(item.verifiedAt),
      receiptUploadedAt: serializeTimestamp(item.receiptUploadedAt),
    };
  });
};

const calculateInstallmentComputedFields = (plan = {}) => {
  const today = startOfDay(new Date());
  const rows = Array.isArray(plan.installments) ? plan.installments : [];

  const normalizedRows = rows.map((row, index) => {
    const dueDate = parseDate(row.dueDate);
    const dueDay = dueDate ? startOfDay(dueDate) : null;
    const isPaid = String(row.status || "").toLowerCase() === "paid";
    const isOverdue = Boolean(!isPaid && dueDay && dueDay < today);
    return {
      number: Number(row.number || index + 1),
      amount: toNumber(row.amount),
      dueDate: row.dueDate || getDateOnlyISO(dueDate),
      status: isPaid ? "paid" : isOverdue ? "overdue" : "pending",
      paidAt: row.paidAt || null,
      paymentId: row.paymentId || null,
      isOverdue,
    };
  });

  const paidRows = normalizedRows.filter((row) => row.status === "paid");
  const unpaidRows = normalizedRows.filter((row) => row.status !== "paid");
  const overdueRows = normalizedRows.filter((row) => row.isOverdue);

  const paidAmount = paidRows.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const totalAmount = toNumber(plan.totalAmount);
  const remainingAmount = Number(Math.max(totalAmount - paidAmount, 0).toFixed(2));

  const nextDueRow = unpaidRows
    .filter((row) => parseDate(row.dueDate))
    .sort(
      (a, b) =>
        (parseDate(a.dueDate)?.getTime() || 0) -
        (parseDate(b.dueDate)?.getTime() || 0)
    )[0];

  const paidCount = paidRows.length;
  const numberOfInstallments =
    toNumber(plan.numberOfInstallments) || normalizedRows.length;
  const completed =
    numberOfInstallments > 0 && paidCount >= numberOfInstallments;

  return {
    ...plan,
    installments: normalizedRows,
    numberOfInstallments,
    paidCount,
    paidAmount: Number(paidAmount.toFixed(2)),
    remainingAmount,
    nextDueDate: nextDueRow?.dueDate || null,
    isOverdue: overdueRows.length > 0,
    overdueCount: overdueRows.length,
    status: completed ? "completed" : overdueRows.length > 0 ? "overdue" : "active",
  };
};

const getCurrentPaymentSettings = async () => {
  const [settingsSnap, legacySnap] = await Promise.all([
    db.collection(COLLECTIONS.SETTINGS).doc("siteSettings").get(),
    db.collection(COLLECTIONS.SETTINGS).doc("general").get(),
  ]);
  const settings = settingsSnap.exists
    ? settingsSnap.data() || {}
    : legacySnap.exists
      ? legacySnap.data() || {}
      : {};

  const configuredPayment = settings.payment || settings.paymentSettings || {};
  const configuredJazz = configuredPayment.jazzcash || settings.jazzcash || {};
  const configuredEasypaisa = configuredPayment.easypaisa || settings.easypaisa || {};

  const configuredBank =
    configuredPayment?.bankTransfer ||
    configuredPayment?.bank ||
    settings?.bankTransfer ||
    {};

  const defaultAccountTitle =
    settings?.general?.siteName || settings?.siteName || "SUM Academy";
  const legacyJazzDisabledByDefault =
    configuredJazz?.enabled === false &&
    !configuredJazz?.merchantId &&
    !configuredJazz?.accountTitle &&
    !configuredJazz?.instructions;
  const legacyEasyDisabledByDefault =
    configuredEasypaisa?.enabled === false &&
    !configuredEasypaisa?.accountNumber &&
    !configuredEasypaisa?.accountTitle &&
    !configuredEasypaisa?.instructions;

  return {
    jazzcash: {
      enabled: legacyJazzDisabledByDefault
        ? true
        : resolveEnabled(configuredJazz?.enabled, PAYMENT_CONFIG.jazzcash.enabled ?? true),
      merchantId: configuredJazz?.merchantId || PAYMENT_CONFIG.jazzcash.merchantId || "",
      password: configuredJazz?.password || PAYMENT_CONFIG.jazzcash.password || "",
      integritySalt:
        configuredJazz?.integritySalt || PAYMENT_CONFIG.jazzcash.integritySalt || "",
      accountTitle:
        configuredJazz?.accountTitle ||
        PAYMENT_CONFIG.jazzcash.accountTitle ||
        defaultAccountTitle,
      instructions:
        configuredJazz?.instructions ||
        PAYMENT_CONFIG.jazzcash.instructions ||
        "Send payment to JazzCash merchant and upload the transaction receipt.",
      sandboxUrl: PAYMENT_CONFIG.jazzcash.sandboxUrl,
      productionUrl: PAYMENT_CONFIG.jazzcash.productionUrl,
      returnUrl: PAYMENT_CONFIG.jazzcash.returnUrl,
    },
    easypaisa: {
      enabled: legacyEasyDisabledByDefault
        ? true
        : resolveEnabled(
            configuredEasypaisa?.enabled,
            PAYMENT_CONFIG.easypaisa.enabled ?? true
          ),
      accountNumber:
        configuredEasypaisa?.accountNumber || PAYMENT_CONFIG.easypaisa.accountNumber || "",
      password: configuredEasypaisa?.password || PAYMENT_CONFIG.easypaisa.password || "",
      accountTitle:
        configuredEasypaisa?.accountTitle ||
        PAYMENT_CONFIG.easypaisa.accountTitle ||
        defaultAccountTitle,
      username: configuredEasypaisa?.username || PAYMENT_CONFIG.easypaisa.username || "",
      instructions:
        configuredEasypaisa?.instructions ||
        PAYMENT_CONFIG.easypaisa.instructions ||
        "Send payment to EasyPaisa account and upload the transaction receipt.",
      sandboxUrl: PAYMENT_CONFIG.easypaisa.sandboxUrl,
      productionUrl: PAYMENT_CONFIG.easypaisa.productionUrl,
      returnUrl: PAYMENT_CONFIG.easypaisa.returnUrl,
    },
    bankTransfer: {
      enabled: resolveEnabled(configuredBank?.enabled, PAYMENT_CONFIG.bankTransfer.enabled),
      bankName:
        configuredBank?.bankName || PAYMENT_CONFIG.bankTransfer.bankName,
      accountTitle:
        configuredBank?.accountTitle ||
        PAYMENT_CONFIG.bankTransfer.accountTitle,
      accountNumber:
        configuredBank?.accountNumber ||
        PAYMENT_CONFIG.bankTransfer.accountNumber,
      iban: configuredBank?.iban || PAYMENT_CONFIG.bankTransfer.iban,
    },
  };
};

const resolvePromo = async (promoCode, courseId, studentId = "") => {
  if (!promoCode) return { promoData: null, discountAmount: 0 };
  const normalized = normalizePromoCode(promoCode);
  if (!isPromoCodeFormatValid(normalized)) {
    throw new Error("INVALID_PROMO_FORMAT");
  }

  const promoSnap = await db
    .collection(COLLECTIONS.PROMO_CODES)
    .where("code", "==", normalized)
    .limit(1)
    .get();

  if (promoSnap.empty) throw new Error("PROMO_NOT_FOUND");

  const promoDoc = promoSnap.docs[0];
  const promoData = promoDoc.data() || {};
  if (!promoData.isActive) throw new Error("PROMO_INACTIVE");

  const expiresAt = parseDate(promoData.expiresAt);
  if (expiresAt && expiresAt < new Date()) throw new Error("PROMO_EXPIRED");

  const usageLimit = toNumber(promoData.usageLimit);
  const usageCount = toNumber(promoData.usageCount);
  const reservedUsageCount = await countActivePromoUsage({
    promoCodeId: promoDoc.id,
    normalizedCode: normalized,
  });
  const effectiveUsageCount = Math.max(usageCount, reservedUsageCount);
  if (usageLimit > 0 && effectiveUsageCount >= usageLimit) {
    throw new Error("PROMO_LIMIT_REACHED");
  }

  if (promoData.courseId && promoData.courseId !== courseId) {
    throw new Error("PROMO_INVALID_FOR_COURSE");
  }

  if (promoData.isSingleUse) {
    const usedBefore = await hasStudentUsedPromo({
      studentId,
      promoCodeId: promoDoc.id,
      normalizedCode: normalized,
    });
    if (usedBefore) {
      throw new Error("PROMO_ALREADY_USED_BY_STUDENT");
    }
  }

  return {
    promoDoc,
    promoData: { ...promoData, code: normalized },
  };
};

const calculateDiscount = (amount, promoData) => {
  if (!promoData) return 0;
  const original = Math.max(toNumber(amount), 0);
  const value = Math.max(toNumber(promoData.discountValue), 0);
  if (promoData.discountType === "fixed") return Math.min(original, value);
  const percent = Math.min(value, 100);
  return Number(((original * percent) / 100).toFixed(2));
};

const calculateCourseDiscount = (amount, discountPercent = 0) => {
  const original = Math.max(toNumber(amount), 0);
  const percent = Math.max(0, Math.min(100, toNumber(discountPercent, 0)));
  return Number(((original * percent) / 100).toFixed(2));
};

const isInstallmentPlanEligible = (plan = {}) => {
  const count = toNumber(plan.numberOfInstallments, 0);
  const rows = Array.isArray(plan.installments) ? plan.installments : [];
  if (count > 1) return true;
  return rows.length > 1;
};

const normalizeClassStudents = (students = []) =>
  students.map((entry) =>
    typeof entry === "string"
      ? { studentId: entry, shiftId: "", courseId: "", enrolledAt: null }
      : {
          studentId: String(entry?.studentId || "").trim(),
          shiftId: String(entry?.shiftId || "").trim(),
          courseId: String(entry?.courseId || "").trim(),
          enrolledAt: entry?.enrolledAt || null,
        }
  );

export const initiatePayment = async (req, res) => {
  try {
    const studentId = req.user.uid;
    const {
      courseId,
      classId = "",
      shiftId = "",
      method,
      promoCode = "",
      installments = 1,
    } = req.body || {};

    if (!courseId || !method || !classId || !shiftId) {
      return errorResponse(
        res,
        "courseId, classId, shiftId and method are required",
        400
      );
    }

    const paymentMethod = String(method).trim().toLowerCase();
    if (!["jazzcash", "easypaisa", "bank_transfer"].includes(paymentMethod)) {
      return errorResponse(res, "Invalid payment method", 400);
    }

    const installmentCount = toNumber(installments, 1);
    if (installmentCount !== 1 && (installmentCount < 2 || installmentCount > 6)) {
      return errorResponse(res, "Installments must be between 2 and 6", 400);
    }

    const [student, course, classData] = await Promise.all([
      getStudentIdentity(studentId),
      getCourseById(courseId),
      classId ? getClassById(classId) : Promise.resolve(null),
    ]);

    if (!student) return errorResponse(res, "Student profile not found", 404);
    if (!course) return errorResponse(res, "Course not found", 404);
    if (!classData) return errorResponse(res, "Class not found", 404);

    const enrollmentStatus = getEnrollmentStatusFromClassDates(classData);
    if (enrollmentStatus === "completed") {
      return errorResponse(
        res,
        "Selected class has already ended. Choose an active class.",
        400
      );
    }

    const classShiftValidation = validateClassShiftSelection({
      classData,
      shiftId,
      courseId,
    });
    if (classShiftValidation.error) {
      return errorResponse(res, classShiftValidation.error, classShiftValidation.status || 400);
    }

    const classStudents = normalizeClassStudents(
      Array.isArray(classData.students) ? classData.students : []
    );
    const studentAlreadyInClass = classStudents.some(
      (entry) => entry.studentId === studentId
    );
    const pendingSeatReservations = await countReservedSeatsForClass(
      classId,
      classStudents.map((entry) => entry.studentId)
    );
    const alreadyHasOpenPayment = !studentAlreadyInClass
      ? (
          await db
            .collection(COLLECTIONS.PAYMENTS)
            .where("studentId", "==", studentId)
            .get()
        ).docs.some((doc) => {
          const row = doc.data() || {};
          if (String(row.classId || "").trim() !== String(classId || "").trim()) {
            return false;
          }
          const status = normalizePaymentStatus(row.status);
          return (
            RESERVED_CLASS_SEAT_STATUSES.has(status) ||
            status === "paid"
          );
        })
      : false;
    if (alreadyHasOpenPayment) {
      return errorResponse(
        res,
        "You already have an active enrollment request for this class.",
        400
      );
    }
    const classCapacity = Math.max(toNumber(classData.capacity), 0);
    const occupiedSeats = classStudents.length + pendingSeatReservations;
    if (classCapacity > 0 && !studentAlreadyInClass && occupiedSeats >= classCapacity) {
      return errorResponse(
        res,
        "Class seats are fully reserved. Please select another class.",
        400
      );
    }

    const originalAmount = Math.max(toNumber(course.price), 0);
    const courseDiscountPercent = Math.max(
      0,
      Math.min(100, toNumber(course.discountPercent, 0))
    );
    const courseDiscountAmount = calculateCourseDiscount(
      originalAmount,
      courseDiscountPercent
    );
    const amountAfterCourseDiscount = Number(
      Math.max(originalAmount - courseDiscountAmount, 0).toFixed(2)
    );
    let promoDoc = null;
    let promoData = null;
    if (promoCode) {
      const promoResult = await resolvePromo(promoCode, courseId, studentId);
      promoDoc = promoResult.promoDoc || null;
      promoData = promoResult.promoData || null;
    }

    const promoDiscountAmount = calculateDiscount(amountAfterCourseDiscount, promoData);
    const discountAmount = Number(
      (courseDiscountAmount + promoDiscountAmount).toFixed(2)
    );
    const finalAmount = Number(
      Math.max(amountAfterCourseDiscount - promoDiscountAmount, 0).toFixed(2)
    );
    const installmentSchedule =
      installmentCount > 1
        ? buildInstallmentSchedule(finalAmount, installmentCount)
        : null;
    const amountDueNow =
      installmentSchedule?.[0]?.amount != null ? installmentSchedule[0].amount : finalAmount;

    const paymentSettings = await getCurrentPaymentSettings();
    const selectedMethodSettings =
      paymentMethod === "jazzcash"
        ? paymentSettings.jazzcash
        : paymentMethod === "easypaisa"
          ? paymentSettings.easypaisa
          : paymentSettings.bankTransfer;

    if (!selectedMethodSettings?.enabled) {
      return errorResponse(
        res,
        `${formatPaymentMethodLabel(paymentMethod)} is currently disabled`,
        503
      );
    }

    const methodLabel = formatPaymentMethodLabel(paymentMethod);
    const paymentRef = db.collection(COLLECTIONS.PAYMENTS).doc();
    const reference = generateReference();

    const paymentPayload = {
      studentId,
      studentName: student.fullName,
      courseId,
      courseName: course.title || "",
      classId: classId || null,
      className: classData?.name || "",
      shiftId: shiftId || null,
      amount: amountDueNow,
      totalAmount: finalAmount,
      originalAmount,
      discount: discountAmount,
      courseDiscountPercent,
      courseDiscountAmount,
      promoDiscountAmount,
      promoCode: promoData?.code || null,
      promoCodeId: promoDoc?.id || null,
      method: paymentMethod,
      status: "pending",
      receiptUrl: null,
      reference,
      installments: installmentSchedule,
      isInstallment: installmentCount > 1,
      numberOfInstallments: installmentCount,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const paymentDetails =
      paymentMethod === "jazzcash"
        ? {
            merchantId: paymentSettings.jazzcash.merchantId || "-",
            accountTitle: paymentSettings.jazzcash.accountTitle || "SUM Academy",
            instructions:
              paymentSettings.jazzcash.instructions ||
              "Send payment to JazzCash merchant and upload the transaction receipt.",
          }
        : paymentMethod === "easypaisa"
          ? {
              accountNumber: paymentSettings.easypaisa.accountNumber || "-",
              accountTitle: paymentSettings.easypaisa.accountTitle || "SUM Academy",
              username: paymentSettings.easypaisa.username || "",
              instructions:
                paymentSettings.easypaisa.instructions ||
                "Send payment to EasyPaisa account and upload the transaction receipt.",
            }
          : {
              bankName: paymentSettings.bankTransfer.bankName,
              accountTitle: paymentSettings.bankTransfer.accountTitle,
              accountNumber: paymentSettings.bankTransfer.accountNumber,
              iban: paymentSettings.bankTransfer.iban,
              instructions:
                "Transfer amount to the bank account and upload your payment receipt.",
            };

    await paymentRef.set(paymentPayload);

    try {
      await sendBankTransferInitiated(
        student.email,
        student.fullName,
        paymentPayload,
        paymentDetails,
        methodLabel
      );
    } catch (emailError) {
      console.error("sendBankTransferInitiated error:", emailError.message);
    }

    return successResponse(
      res,
      {
        paymentId: paymentRef.id,
        reference,
        amount: amountDueNow,
        totalAmount: finalAmount,
        originalAmount,
        discount: discountAmount,
        courseDiscountPercent,
        courseDiscountAmount,
        promoDiscountAmount,
        method: paymentMethod,
        promoCode: promoData?.code || null,
        paymentDetails,
        bankDetails:
          paymentMethod === "bank_transfer" ? paymentDetails : undefined,
        installments: installmentSchedule,
        isInstallment: installmentCount > 1,
        numberOfInstallments: installmentCount,
      },
      `${methodLabel} initiated`,
      201
    );
  } catch (error) {
    if (error.message === "INVALID_PROMO_FORMAT") {
      return errorResponse(res, "Promo code must be uppercase alphanumeric", 400);
    }
    if (error.message === "PROMO_NOT_FOUND") {
      return errorResponse(res, "Promo code not found", 404);
    }
    if (error.message === "PROMO_INACTIVE") {
      return errorResponse(res, "Promo code is not active", 400);
    }
    if (error.message === "PROMO_EXPIRED") {
      return errorResponse(res, "Promo code has expired", 400);
    }
    if (error.message === "PROMO_LIMIT_REACHED") {
      return errorResponse(res, "Promo code usage limit reached", 400);
    }
    if (error.message === "PROMO_ALREADY_USED_BY_STUDENT") {
      return errorResponse(res, "You have already used this promo code", 400);
    }
    if (error.message === "PROMO_INVALID_FOR_COURSE") {
      return errorResponse(res, "Promo code not valid for selected course", 400);
    }

    console.error("initiatePayment error:", error);
    return errorResponse(res, "Failed to initiate payment", 500);
  }
};

export const uploadPaymentReceipt = async (req, res) => {
  try {
    const paymentId = req.params.id || req.params.paymentId;
    const { receiptUrl } = req.body || {};
    if (!paymentId || !receiptUrl) {
      return errorResponse(res, "paymentId and receiptUrl are required", 400);
    }

    if (!/^https?:\/\//i.test(String(receiptUrl))) {
      return errorResponse(res, "Invalid receipt URL", 400);
    }

    const paymentRef = db.collection(COLLECTIONS.PAYMENTS).doc(paymentId);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) return errorResponse(res, "Payment not found", 404);

    const payment = paymentSnap.data() || {};
    if (payment.studentId !== req.user.uid) {
      return errorResponse(res, "You can upload receipt for your own payment only", 403);
    }
    const paymentMethod = String(payment.method || "").toLowerCase();
    const supportedReceiptMethods = new Set([
      "bank_transfer",
      "easypaisa",
      "jazzcash",
    ]);
    if (!supportedReceiptMethods.has(paymentMethod)) {
      return errorResponse(res, "Unsupported payment method for receipt upload", 400);
    }

    await paymentRef.update({
      receiptUrl,
      status: "pending_verification",
      receiptUploadedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return successResponse(res, { paymentId, status: "pending_verification" }, "Receipt uploaded");
  } catch (error) {
    console.error("uploadPaymentReceipt error:", error);
    return errorResponse(res, "Failed to upload receipt", 500);
  }
};

export const getPaymentStatus = async (req, res) => {
  try {
    const paymentId = req.params.id || req.params.paymentId;
    const paymentSnap = await db.collection(COLLECTIONS.PAYMENTS).doc(paymentId).get();
    if (!paymentSnap.exists) return errorResponse(res, "Payment not found", 404);

    const payment = paymentSnap.data() || {};
    const isOwner = payment.studentId === req.user.uid;
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return errorResponse(res, "Access denied", 403);
    }

    return successResponse(
      res,
      {
        id: paymentSnap.id,
        ...payment,
        createdAt: serializeTimestamp(payment.createdAt),
        updatedAt: serializeTimestamp(payment.updatedAt),
        verifiedAt: serializeTimestamp(payment.verifiedAt),
        receiptUploadedAt: serializeTimestamp(payment.receiptUploadedAt),
      },
      "Payment status fetched"
    );
  } catch (error) {
    console.error("getPaymentStatus error:", error);
    return errorResponse(res, "Failed to fetch payment status", 500);
  }
};

export const getMyPayments = async (req, res) => {
  try {
    const snap = await db
      .collection(COLLECTIONS.PAYMENTS)
      .where("studentId", "==", req.user.uid)
      .get();

    const data = snap.docs
      .map((doc) => {
        const payment = doc.data() || {};
        return {
          id: doc.id,
          ...payment,
          createdAt: serializeTimestamp(payment.createdAt),
          updatedAt: serializeTimestamp(payment.updatedAt),
          verifiedAt: serializeTimestamp(payment.verifiedAt),
          receiptUploadedAt: serializeTimestamp(payment.receiptUploadedAt),
        };
      })
      .sort(
        (a, b) =>
          (parseDate(b.createdAt)?.getTime() || 0) -
          (parseDate(a.createdAt)?.getTime() || 0)
      );

    return successResponse(res, data, "My payments fetched");
  } catch (error) {
    console.error("getMyPayments error:", error);
    return errorResponse(res, "Failed to fetch payments", 500);
  }
};

export const getMyInstallments = async (req, res) => {
  try {
    const snap = await db
      .collection(COLLECTIONS.INSTALLMENTS)
      .where("studentId", "==", req.user.uid)
      .get();

    const data = snap.docs
      .map((doc) => {
        const plan = doc.data() || {};
        return {
          id: doc.id,
          ...plan,
          createdAt: serializeTimestamp(plan.createdAt),
          updatedAt: serializeTimestamp(plan.updatedAt),
        };
      })
      .filter((plan) => isInstallmentPlanEligible(plan))
      .sort(
        (a, b) =>
          (parseDate(b.createdAt)?.getTime() || 0) -
          (parseDate(a.createdAt)?.getTime() || 0)
      );

    return successResponse(res, data, "My installments fetched");
  } catch (error) {
    console.error("getMyInstallments error:", error);
    return errorResponse(res, "Failed to fetch installments", 500);
  }
};

export const getTransactions = async (req, res) => {
  try {
    const { method = "", status = "", search = "", startDate = "", endDate = "" } =
      req.query || {};
    const normalizedMethod = normalizePaymentMethod(method);
    const normalizedStatus = String(status || "").toLowerCase();
    const normalizedSearch = String(search || "").trim().toLowerCase();

    let rows = await fetchMergedPayments();

    if (normalizedMethod && normalizedMethod !== "all") {
      rows = rows.filter((item) => item.method === normalizedMethod);
    }
    if (normalizedStatus && normalizedStatus !== "all") {
      rows = rows.filter((item) => item.status === normalizedStatus);
    }

    if (normalizedSearch) {
      rows = rows.filter((item) => {
        const studentName = String(item.studentName || "").toLowerCase();
        const courseName = String(item.courseName || "").toLowerCase();
        const className = String(item.className || "").toLowerCase();
        return (
          studentName.includes(normalizedSearch) ||
          courseName.includes(normalizedSearch) ||
          className.includes(normalizedSearch) ||
          item.id.toLowerCase().includes(normalizedSearch)
        );
      });
    }

    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const endDay = end ? startOfDay(addDays(end, 1)) : null;

    if (start || endDay) {
      rows = rows.filter((item) => {
        const createdAt = parseDate(item.createdAt);
        if (!createdAt) return false;
        if (start && createdAt < startOfDay(start)) return false;
        if (endDay && createdAt >= endDay) return false;
        return true;
      });
    }

    rows.sort(sortByCreatedAtDesc);
    return successResponse(res, rows, "Transactions fetched");
  } catch (error) {
    console.error("getTransactions error:", error);
    return errorResponse(res, "Failed to fetch transactions", 500);
  }
};

export const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const paymentSnap = await db.collection(COLLECTIONS.PAYMENTS).doc(id).get();
    if (!paymentSnap.exists) return errorResponse(res, "Transaction not found", 404);

    const payment = { id: paymentSnap.id, ...(paymentSnap.data() || {}) };

    const [studentSnap, userSnap, courseSnap, classSnap] = await Promise.all([
      payment.studentId
        ? db.collection(COLLECTIONS.STUDENTS).doc(payment.studentId).get()
        : Promise.resolve(null),
      payment.studentId
        ? db.collection(COLLECTIONS.USERS).doc(payment.studentId).get()
        : Promise.resolve(null),
      payment.courseId
        ? db.collection(COLLECTIONS.COURSES).doc(payment.courseId).get()
        : Promise.resolve(null),
      payment.classId
        ? db.collection(COLLECTIONS.CLASSES).doc(payment.classId).get()
        : Promise.resolve(null),
    ]);

    const studentData = studentSnap?.exists ? studentSnap.data() || {} : {};
    const userData = userSnap?.exists ? userSnap.data() || {} : {};
    const courseData = courseSnap?.exists ? courseSnap.data() || {} : {};
    const classData = classSnap?.exists ? classSnap.data() || {} : {};

    const shift = Array.isArray(classData.shifts)
      ? classData.shifts.find((row) => row.id === payment.shiftId)
      : null;

    const studentName =
      studentData.fullName ||
      payment.studentName ||
      (userData.email ? String(userData.email).split("@")[0] : "Student");

    const merged = {
      id: payment.id,
      studentId: payment.studentId || null,
      studentName,
      studentEmail: userData.email || "",
      studentPhone: studentData.phoneNumber || userData.phoneNumber || "",
      studentProfile: {
        uid: payment.studentId || null,
        fullName: studentName,
        email: userData.email || "",
        phoneNumber: studentData.phoneNumber || userData.phoneNumber || "",
        isActive: userData.isActive ?? true,
      },
      courseId: payment.courseId || null,
      courseName: payment.courseName || courseData.title || "",
      courseDetails: courseSnap?.exists
        ? {
            id: courseSnap.id,
            title: courseData.title || "",
            category: courseData.category || "",
            level: courseData.level || "",
            price: toNumber(courseData.price),
          }
        : null,
      classId: payment.classId || null,
      className: payment.className || classData.name || "",
      classDetails: classSnap?.exists
        ? {
            id: classSnap.id,
            name: classData.name || "",
            batchCode: classData.batchCode || "",
            startDate: classData.startDate || null,
            endDate: classData.endDate || null,
          }
        : null,
      shiftId: payment.shiftId || null,
      shiftDetails: shift
        ? {
            id: shift.id,
            name: shift.name || "",
            days: Array.isArray(shift.days) ? shift.days : [],
            startTime: shift.startTime || "",
            endTime: shift.endTime || "",
            teacherId: shift.teacherId || "",
            teacherName: shift.teacherName || "",
            room: shift.room || "",
          }
        : null,
      method: normalizePaymentMethod(payment.method),
      methodLabel: formatPaymentMethodLabel(payment.method),
      amount: toNumber(payment.amount),
      originalAmount: toNumber(payment.originalAmount, toNumber(payment.amount)),
      discount: toNumber(payment.discount),
      status: String(payment.status || "").toLowerCase() || "pending",
      reference: payment.reference || "",
      promoCode: payment.promoCode || null,
      receiptUrl: payment.receiptUrl || null,
      isInstallment: Boolean(payment.isInstallment),
      numberOfInstallments: toNumber(payment.numberOfInstallments),
      installments: Array.isArray(payment.installments) ? payment.installments : null,
      createdAt: serializeTimestamp(payment.createdAt),
      updatedAt: serializeTimestamp(payment.updatedAt),
      verifiedAt: serializeTimestamp(payment.verifiedAt),
      receiptUploadedAt: serializeTimestamp(payment.receiptUploadedAt),
    };

    return successResponse(res, merged, "Transaction details fetched");
  } catch (error) {
    console.error("getTransactionById error:", error);
    return errorResponse(res, "Failed to fetch transaction details", 500);
  }
};

export const exportTransactionsCSV = async (req, res) => {
  try {
    const rows = await fetchMergedPayments();
    rows.sort(sortByCreatedAtDesc);

    const headers = [
      "ID",
      "Student",
      "Email",
      "Course",
      "Class",
      "Method",
      "Amount",
      "Discount",
      "PromoCode",
      "Date",
      "Status",
    ];

    const csvRows = rows.map((item) =>
      [
        item.id,
        item.studentName || "",
        item.studentEmail || "",
        item.courseName || "",
        item.className || "",
        formatPaymentMethodLabel(item.method),
        toNumber(item.amount),
        toNumber(item.discount),
        item.promoCode || "",
        item.createdAt || "",
        item.status || "",
      ]
        .map((entry) => escapeCsv(entry))
        .join(",")
    );

    const csvString = [headers.map((item) => escapeCsv(item)).join(","), ...csvRows].join(
      "\n"
    );

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=transactions.csv"
    );

    return res.status(200).send(csvString);
  } catch (error) {
    console.error("exportTransactionsCSV error:", error);
    return errorResponse(res, "Failed to export transactions", 500);
  }
};

export const getAdminPayments = async (req, res) => {
  try {
    const rows = await fetchMergedPayments();
    rows.sort(sortByCreatedAtDesc);
    return successResponse(res, rows, "Admin payments fetched");
  } catch (error) {
    console.error("getAdminPayments error:", error);
    return errorResponse(res, "Failed to fetch admin payments", 500);
  }
};

export const verifyBankTransfer = async (req, res) => {
  try {
    const paymentId = req.params.id || req.params.paymentId;
    const action = String(req.body?.action || "").trim().toLowerCase();

    if (!["approve", "reject"].includes(action)) {
      return errorResponse(res, "Action must be approve or reject", 400);
    }

    const paymentRef = db.collection(COLLECTIONS.PAYMENTS).doc(paymentId);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) return errorResponse(res, "Payment not found", 404);

    const payment = paymentSnap.data() || {};
    const currentStatus = normalizePaymentStatus(payment.status);
    const canRejectStatuses = new Set(["pending", "pending_verification"]);
    const canApproveStatuses = new Set(["pending_verification"]);
    const hasReceipt = Boolean(String(payment.receiptUrl || "").trim());

    if (action === "approve" && !hasReceipt) {
      return errorResponse(
        res,
        "Receipt is required before approval. Ask student to upload receipt first.",
        400,
        { code: "RECEIPT_REQUIRED" }
      );
    }

    if (action === "approve" && !canApproveStatuses.has(currentStatus)) {
      if (action === "approve" && currentStatus === "paid") {
        return successResponse(res, { paymentId, status: "paid" }, "Payment already approved");
      }
      if (currentStatus === "pending") {
        return errorResponse(
          res,
          "Payment cannot be approved until receipt is uploaded.",
          400,
          { code: "RECEIPT_NOT_UPLOADED" }
        );
      }
      return errorResponse(
        res,
        "Only receipt-submitted requests can be approved",
        400
      );
    }

    if (action === "reject" && !canRejectStatuses.has(currentStatus)) {
      if (currentStatus === "rejected") {
        return successResponse(
          res,
          { paymentId, status: "rejected" },
          "Payment already rejected"
        );
      }
      if (currentStatus === "paid") {
        return errorResponse(res, "Paid payment cannot be rejected", 400);
      }
      return errorResponse(
        res,
        "Only pending requests can be rejected",
        400
      );
    }

    const studentUserSnap = await db.collection(COLLECTIONS.USERS).doc(payment.studentId).get();
    const studentUser = studentUserSnap.exists ? studentUserSnap.data() || {} : {};
    const studentEmail = studentUser.email || "";

    if (action === "reject") {
      await paymentRef.update({
        status: "rejected",
        verifiedBy: req.user.uid,
        verifiedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      try {
        await sendPaymentRejected(
          studentEmail,
          payment.studentName || "Student",
          payment.courseName || "Course",
          payment.amount || 0,
          payment.reference || ""
        );
      } catch (emailError) {
        console.error("sendPaymentRejected error:", emailError.message);
      }

      return successResponse(res, { paymentId, status: "rejected" }, "Payment rejected");
    }

    await db.runTransaction(async (transaction) => {
      const freshSnap = await transaction.get(paymentRef);
      if (!freshSnap.exists) throw new Error("PAYMENT_NOT_FOUND");
      const freshPayment = freshSnap.data() || {};
      const freshStatus = normalizePaymentStatus(freshPayment.status);
      if (freshStatus !== "pending_verification") {
        throw new Error("RECEIPT_NOT_UPLOADED");
      }
      if (!String(freshPayment.receiptUrl || "").trim()) {
        throw new Error("RECEIPT_REQUIRED");
      }
      if (!freshPayment.classId) {
        throw new Error("CLASS_REQUIRED");
      }
      let classData = null;
      let classRef = null;
      let normalizedClassStudents = [];
      let studentAlreadyInClass = false;
      let enrollmentStatus = "active";
      let selectedShift = null;
      if (freshPayment.classId) {
        classRef = db.collection(COLLECTIONS.CLASSES).doc(freshPayment.classId);
        const classSnap = await transaction.get(classRef);
        if (!classSnap.exists) throw new Error("CLASS_NOT_FOUND");
        classData = classSnap.data() || {};
        enrollmentStatus = getEnrollmentStatusFromClassDates(classData);
      }
      if (enrollmentStatus === "completed") {
        throw new Error("CLASS_ENDED");
      }
      if (classData && freshPayment.shiftId) {
        const classShiftValidation = validateClassShiftSelection({
          classData,
          shiftId: freshPayment.shiftId,
          courseId: freshPayment.courseId,
        });
        if (classShiftValidation.error) {
          throw new Error("CLASS_SHIFT_COURSE_MISMATCH");
        }
        selectedShift = classShiftValidation.shift || null;
      }

      if (classData) {
        normalizedClassStudents = normalizeClassStudents(
          Array.isArray(classData.students) ? classData.students : []
        );
        studentAlreadyInClass = normalizedClassStudents.some(
          (entry) => entry.studentId === freshPayment.studentId
        );
        const classCapacity = Math.max(toNumber(classData.capacity), 0);
        if (
          classCapacity > 0 &&
          !studentAlreadyInClass &&
          normalizedClassStudents.length >= classCapacity
        ) {
          throw new Error("CLASS_FULL");
        }
      }

      const classCourseIds = classData
        ? getClassAssignedCourseIds(classData)
        : [];
      if (freshPayment.courseId && !classCourseIds.includes(freshPayment.courseId)) {
        throw new Error("CLASS_SHIFT_COURSE_MISMATCH");
      }
      const enrollmentCourseIds = [
        ...new Set([...classCourseIds, String(freshPayment.courseId || "").trim()].filter(Boolean)),
      ];
      if (!enrollmentCourseIds.length) {
        throw new Error("CLASS_HAS_NO_COURSES");
      }

      transaction.update(paymentRef, {
        status: "paid",
        verifiedBy: req.user.uid,
        verifiedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const enrollmentQuery = db
        .collection(COLLECTIONS.ENROLLMENTS)
        .where("studentId", "==", freshPayment.studentId);
      const enrollmentSnap = await transaction.get(enrollmentQuery);
      const studentRef = db.collection(COLLECTIONS.STUDENTS).doc(freshPayment.studentId);
      const existingEnrollmentRows = enrollmentSnap.docs.map((doc) => ({
        ref: doc.ref,
        data: doc.data() || {},
      }));

      enrollmentCourseIds.forEach((courseId) => {
        const existingEnrollment = existingEnrollmentRows.find((row) => {
          const existingCourseId = String(row.data?.courseId || "").trim();
          const existingClassId = String(row.data?.classId || "").trim();
          return (
            existingCourseId === courseId &&
            existingClassId === String(freshPayment.classId || "").trim()
          );
        });

        if (!existingEnrollment) {
          const enrollmentRef = db.collection(COLLECTIONS.ENROLLMENTS).doc();
          transaction.set(enrollmentRef, {
            studentId: freshPayment.studentId,
            courseId,
            paymentId,
            classId: freshPayment.classId || null,
            shiftId: freshPayment.shiftId || null,
            status: enrollmentStatus,
            progress: 0,
            completedAt: null,
            classStartDate: classData?.startDate || null,
            classEndDate: classData?.endDate || null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            source: "class_enrollment",
          });
          const courseRef = db.collection(COLLECTIONS.COURSES).doc(courseId);
          transaction.set(
            courseRef,
            {
              enrollmentCount: FieldValue.increment(1),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          return;
        }

        const existingEnrollmentData = existingEnrollment.data || {};
        const mergedStatus = mergeEnrollmentStatus(
          existingEnrollmentData.status,
          enrollmentStatus
        );
        transaction.set(
          existingEnrollment.ref,
          {
            classId: freshPayment.classId || null,
            shiftId: freshPayment.shiftId || null,
            status: mergedStatus,
            classStartDate: classData?.startDate || null,
            classEndDate: classData?.endDate || null,
            paymentId,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });

      const studentUpdates = {
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (enrollmentCourseIds.length) {
        studentUpdates.enrolledCourses = FieldValue.arrayUnion(...enrollmentCourseIds);
      }
      if (freshPayment.classId) {
        studentUpdates.enrolledClasses = FieldValue.arrayUnion(freshPayment.classId);
      }
      transaction.set(
        studentRef,
        studentUpdates,
        { merge: true }
      );

      if (freshPayment.promoCodeId) {
        const promoRef = db.collection(COLLECTIONS.PROMO_CODES).doc(freshPayment.promoCodeId);
        const promoSnap = await transaction.get(promoRef);
        if (promoSnap.exists) {
          const promoData = promoSnap.data() || {};
          const usageLimit = toNumber(promoData.usageLimit, 0);
          const usageCount = toNumber(promoData.usageCount, 0);
          if (usageLimit > 0 && usageCount >= usageLimit) {
            throw new Error("PROMO_LIMIT_REACHED");
          }
          transaction.update(promoRef, {
            usageCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      if (classRef && classData && !studentAlreadyInClass) {
        normalizedClassStudents.push({
          studentId: freshPayment.studentId,
          shiftId: freshPayment.shiftId || "",
          courseId:
            String(selectedShift?.courseId || "").trim() ||
            freshPayment.courseId ||
            "",
          enrolledAt: new Date().toISOString(),
        });
        transaction.update(classRef, {
          students: normalizedClassStudents,
          enrolledCount: normalizedClassStudents.length,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    let installmentPlanId = null;
    if (payment.isInstallment && Array.isArray(payment.installments) && payment.installments.length > 0) {
      const planRef = db.collection(COLLECTIONS.INSTALLMENTS).doc();
      installmentPlanId = planRef.id;

      const classData = payment.classId ? await getClassById(payment.classId) : null;
      const paidAtISO = new Date().toISOString();
      const installmentsForPlan = payment.installments.map((row, index) => {
        if (index !== 0) return row;
        return {
          ...row,
          status: "paid",
          paidAt: paidAtISO,
          paymentId,
        };
      });
      const paidCount = installmentsForPlan.filter(
        (row) => String(row.status || "").toLowerCase() === "paid"
      ).length;

      await planRef.set({
        studentId: payment.studentId,
        studentName: payment.studentName || "",
        courseId: payment.courseId,
        courseName: payment.courseName || "",
        classId: payment.classId || null,
        className: classData?.name || payment.className || "",
        totalAmount: payment.totalAmount || payment.amount || 0,
        numberOfInstallments: payment.numberOfInstallments || payment.installments.length,
        perInstallmentAmount:
          payment.installments?.[0]?.amount || toNumber(payment.amount) / toNumber(payment.numberOfInstallments || 1),
        installments: installmentsForPlan,
        paidCount,
        status: "active",
        paymentId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await paymentRef.update({
        installmentPlanId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    try {
      await sendPaymentConfirmation(
        studentEmail,
        payment.studentName || "Student",
        payment.courseName || "Course",
        payment.amount || 0
      );
    } catch (emailError) {
      console.error("sendPaymentConfirmation error:", emailError.message);
    }

    return successResponse(
      res,
      { paymentId, status: "paid", installmentPlanId },
      "Payment approved"
    );
  } catch (error) {
    if (error?.message === "CLASS_ENDED") {
      return errorResponse(
        res,
        "Cannot approve payment for an ended class. Use an active/upcoming class.",
        400
      );
    }
    if (error?.message === "CLASS_SHIFT_COURSE_MISMATCH") {
      return errorResponse(
        res,
        "Selected class shift is invalid for this course. Please update class/shift selection.",
        400
      );
    }
    if (error?.message === "CLASS_NOT_FOUND") {
      return errorResponse(
        res,
        "Selected class no longer exists. Please ask student to choose another class.",
        400
      );
    }
    if (error?.message === "CLASS_REQUIRED") {
      return errorResponse(
        res,
        "Class-based enrollment is required. Payment must be linked to a class.",
        400
      );
    }
    if (error?.message === "RECEIPT_REQUIRED") {
      return errorResponse(
        res,
        "Receipt is required before approval. Ask student to upload receipt first.",
        400,
        { code: "RECEIPT_REQUIRED" }
      );
    }
    if (error?.message === "RECEIPT_NOT_UPLOADED") {
      return errorResponse(
        res,
        "Payment cannot be approved until receipt is uploaded.",
        400,
        { code: "RECEIPT_NOT_UPLOADED" }
      );
    }
    if (error?.message === "CLASS_HAS_NO_COURSES") {
      return errorResponse(
        res,
        "Cannot approve payment because this class has no assigned courses.",
        400
      );
    }
    if (error?.message === "PROMO_LIMIT_REACHED") {
      return errorResponse(
        res,
        "Promo code usage limit reached. Cannot approve this payment with this promo.",
        400
      );
    }
    if (error?.message === "CLASS_FULL") {
      return errorResponse(
        res,
        "Class seats are fully reserved. Cannot approve this enrollment.",
        400
      );
    }
    console.error("verifyBankTransfer error:", error);
    return errorResponse(res, "Failed to verify payment", 500);
  }
};

export const createInstallmentPlan = async (req, res) => {
  try {
    const {
      studentId,
      courseId,
      classId = null,
      totalAmount,
      numberOfInstallments,
      startDate,
    } = req.body || {};

    if (!studentId || !courseId || !totalAmount || !numberOfInstallments) {
      return errorResponse(
        res,
        "studentId, courseId, totalAmount, numberOfInstallments are required",
        400
      );
    }

    const count = toNumber(numberOfInstallments);
    if (count < 2 || count > 6) {
      return errorResponse(res, "Installments must be between 2 and 6", 400);
    }

    const amount = toNumber(totalAmount);
    if (amount <= 0) return errorResponse(res, "Amount must be positive", 400);

    const [student, course, classData] = await Promise.all([
      getStudentIdentity(studentId),
      getCourseById(courseId),
      classId ? getClassById(classId) : Promise.resolve(null),
    ]);

    if (!student) return errorResponse(res, "Student not found", 404);
    if (!course) return errorResponse(res, "Course not found", 404);
    if (classId && !classData) return errorResponse(res, "Class not found", 404);

    const schedule = buildInstallmentSchedule(
      amount,
      count,
      startDate || new Date()
    );
    const perInstallmentAmount = schedule?.[0]?.amount || Number((amount / count).toFixed(2));

    const planRef = db.collection(COLLECTIONS.INSTALLMENTS).doc();
    await planRef.set({
      studentId,
      studentName: student.fullName,
      courseId,
      courseName: course.title || "",
      classId,
      className: classData?.name || "",
      totalAmount: amount,
      numberOfInstallments: count,
      perInstallmentAmount,
      installments: schedule,
      paidCount: 0,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      await sendInstallmentPlanCreatedEmail(
        student.email || "",
        student.fullName || "Student",
        course.title || "Course",
        Array.isArray(schedule) ? schedule : []
      );
    } catch (emailError) {
      console.error("sendInstallmentPlanCreatedEmail error:", emailError.message);
    }

    return successResponse(res, { id: planRef.id }, "Installment plan created", 201);
  } catch (error) {
    console.error("createInstallmentPlan error:", error);
    return errorResponse(res, "Failed to create installment plan", 500);
  }
};

export const markInstallmentPaid = async (req, res) => {
  try {
    const planId = req.params.planId;
    const installmentNumber = Number(req.params.number || req.params.installmentNumber);
    if (!planId || !installmentNumber) {
      return errorResponse(res, "planId and installment number are required", 400);
    }

    const planRef = db.collection(COLLECTIONS.INSTALLMENTS).doc(planId);
    const planSnap = await planRef.get();
    if (!planSnap.exists) return errorResponse(res, "Plan not found", 404);

    const planData = planSnap.data() || {};
    const installments = Array.isArray(planData.installments) ? planData.installments : [];
    const target = installments.find((item) => Number(item.number) === installmentNumber);
    if (!target) {
      return errorResponse(res, "Installment not found in this plan", 404);
    }
    if (String(target.status || "").toLowerCase() === "paid") {
      return errorResponse(res, "Installment already marked as paid", 400);
    }

    const paidAtISO = new Date().toISOString();
    const updatedInstallments = installments.map((item) => {
      if (Number(item.number) !== installmentNumber) return item;
      return {
        ...item,
        status: "paid",
        paidAt: paidAtISO,
      };
    });

    const paidCount = updatedInstallments.filter(
      (item) => String(item.status || "").toLowerCase() === "paid"
    ).length;
    const numberOfInstallments =
      toNumber(planData.numberOfInstallments) || updatedInstallments.length;
    const completed =
      numberOfInstallments > 0 && paidCount >= numberOfInstallments;

    await planRef.update({
      installments: updatedInstallments,
      paidCount,
      status: completed ? "completed" : "active",
      updatedAt: FieldValue.serverTimestamp(),
    });

    const refreshedSnap = await planRef.get();
    const refreshedPlan = calculateInstallmentComputedFields({
      id: refreshedSnap.id,
      ...(refreshedSnap.data() || {}),
    });

    const userSnap = refreshedPlan.studentId
      ? await db.collection(COLLECTIONS.USERS).doc(refreshedPlan.studentId).get()
      : null;
    const email = userSnap?.exists ? userSnap.data()?.email || "" : "";

    const nextDueDate = refreshedPlan.nextDueDate || null;

    try {
      await sendInstallmentPaidEmail(
        email,
        refreshedPlan.studentName || "Student",
        installmentNumber,
        toNumber(target.amount),
        refreshedPlan.courseName || "Course",
        refreshedPlan.remainingAmount || 0,
        nextDueDate
      );
    } catch (emailError) {
      console.error("sendInstallmentPaidEmail error:", emailError.message);
    }

    return successResponse(res, refreshedPlan, "Installment marked paid");
  } catch (error) {
    console.error("markInstallmentPaid error:", error);
    return errorResponse(res, "Failed to mark installment paid", 500);
  }
};

export const getInstallments = async (req, res) => {
  try {
    const { status = "", search = "" } = req.query || {};
    const normalizedStatus = String(status || "").toLowerCase();
    const normalizedSearch = String(search || "").trim().toLowerCase();

    const snap = await db.collection(COLLECTIONS.INSTALLMENTS).get();
    let rows = snap.docs
      .map((doc) =>
        calculateInstallmentComputedFields({ id: doc.id, ...(doc.data() || {}) })
      )
      .filter((plan) => isInstallmentPlanEligible(plan));

    const studentIds = rows.map((item) => item.studentId).filter(Boolean);
    const courseIds = rows.map((item) => item.courseId).filter(Boolean);
    const classIds = rows.map((item) => item.classId).filter(Boolean);

    const [studentMap, userMap, courseMap, classMap] = await Promise.all([
      getDocMap(COLLECTIONS.STUDENTS, studentIds),
      getDocMap(COLLECTIONS.USERS, studentIds),
      getDocMap(COLLECTIONS.COURSES, courseIds),
      getDocMap(COLLECTIONS.CLASSES, classIds),
    ]);

    rows = rows.map((item) => {
      const studentData = studentMap[item.studentId] || {};
      const userData = userMap[item.studentId] || {};
      const courseData = courseMap[item.courseId] || {};
      const classData = classMap[item.classId] || {};

      const studentName =
        studentData.fullName ||
        item.studentName ||
        (userData.email ? String(userData.email).split("@")[0] : "Student");

      return {
        ...item,
        studentName,
        studentEmail: userData.email || "",
        courseName: item.courseName || courseData.title || "",
        className: item.className || classData.name || "",
        createdAt: serializeTimestamp(item.createdAt),
        updatedAt: serializeTimestamp(item.updatedAt),
      };
    });

    if (normalizedStatus && normalizedStatus !== "all") {
      rows = rows.filter((item) => item.status === normalizedStatus);
    }

    if (normalizedSearch) {
      rows = rows.filter((item) => {
        const studentName = String(item.studentName || "").toLowerCase();
        const courseName = String(item.courseName || "").toLowerCase();
        return (
          studentName.includes(normalizedSearch) ||
          courseName.includes(normalizedSearch) ||
          item.id.toLowerCase().includes(normalizedSearch)
        );
      });
    }

    rows.sort(sortByCreatedAtDesc);
    return successResponse(res, rows, "Installments fetched");
  } catch (error) {
    console.error("getInstallments error:", error);
    return errorResponse(res, "Failed to fetch installments", 500);
  }
};

export const getInstallmentById = async (req, res) => {
  try {
    const { planId } = req.params;
    const planSnap = await db.collection(COLLECTIONS.INSTALLMENTS).doc(planId).get();
    if (!planSnap.exists) return errorResponse(res, "Installment plan not found", 404);

    const plan = calculateInstallmentComputedFields({
      id: planSnap.id,
      ...(planSnap.data() || {}),
    });
    if (!isInstallmentPlanEligible(plan)) {
      return errorResponse(res, "Installment plan not found", 404);
    }

    const [studentSnap, userSnap, courseSnap, classSnap] = await Promise.all([
      plan.studentId
        ? db.collection(COLLECTIONS.STUDENTS).doc(plan.studentId).get()
        : Promise.resolve(null),
      plan.studentId
        ? db.collection(COLLECTIONS.USERS).doc(plan.studentId).get()
        : Promise.resolve(null),
      plan.courseId
        ? db.collection(COLLECTIONS.COURSES).doc(plan.courseId).get()
        : Promise.resolve(null),
      plan.classId
        ? db.collection(COLLECTIONS.CLASSES).doc(plan.classId).get()
        : Promise.resolve(null),
    ]);

    const studentData = studentSnap?.exists ? studentSnap.data() || {} : {};
    const userData = userSnap?.exists ? userSnap.data() || {} : {};
    const courseData = courseSnap?.exists ? courseSnap.data() || {} : {};
    const classData = classSnap?.exists ? classSnap.data() || {} : {};

    const merged = {
      ...plan,
      studentName:
        studentData.fullName ||
        plan.studentName ||
        (userData.email ? String(userData.email).split("@")[0] : "Student"),
      studentEmail: userData.email || "",
      studentPhone: studentData.phoneNumber || userData.phoneNumber || "",
      courseName: plan.courseName || courseData.title || "",
      className: plan.className || classData.name || "",
      createdAt: serializeTimestamp(plan.createdAt),
      updatedAt: serializeTimestamp(plan.updatedAt),
    };

    return successResponse(res, merged, "Installment plan fetched");
  } catch (error) {
    console.error("getInstallmentById error:", error);
    return errorResponse(res, "Failed to fetch installment plan", 500);
  }
};

export const overrideInstallment = async (req, res) => {
  try {
    const { planId } = req.params;
    const { installments } = req.body || {};

    if (!Array.isArray(installments) || installments.length < 1) {
      return errorResponse(res, "installments array is required", 400);
    }

    const planRef = db.collection(COLLECTIONS.INSTALLMENTS).doc(planId);
    const planSnap = await planRef.get();
    if (!planSnap.exists) return errorResponse(res, "Installment plan not found", 404);

    const currentPlan = planSnap.data() || {};
    const currentRows = Array.isArray(currentPlan.installments)
      ? currentPlan.installments
      : [];

    const today = startOfDay(new Date());
    const overriddenRows = installments.map((incoming, index) => {
      const current = currentRows.find(
        (row) => Number(row.number) === Number(incoming.number || index + 1)
      );

      const amount = toNumber(incoming.amount, toNumber(current?.amount));
      if (amount <= 0) throw new Error("INVALID_INSTALLMENT_AMOUNT");

      const dueDate =
        incoming.dueDate || current?.dueDate || getDateOnlyISO(addDays(today, 30 * index));
      const parsedDueDate = parseDate(dueDate);
      if (!parsedDueDate) throw new Error("INVALID_INSTALLMENT_DUE_DATE");
      if (startOfDay(parsedDueDate) < today && String(current?.status || "").toLowerCase() !== "paid") {
        throw new Error("INSTALLMENT_DUE_DATE_MUST_BE_FUTURE");
      }

      const isPaid = String(current?.status || "").toLowerCase() === "paid";
      return {
        number: Number(incoming.number || current?.number || index + 1),
        amount,
        dueDate: getDateOnlyISO(parsedDueDate),
        status: isPaid ? "paid" : "pending",
        paidAt: isPaid ? current?.paidAt || null : null,
        paymentId: current?.paymentId || null,
      };
    });

    const paidCount = overriddenRows.filter(
      (row) => String(row.status || "").toLowerCase() === "paid"
    ).length;
    const numberOfInstallments =
      toNumber(currentPlan.numberOfInstallments) || overriddenRows.length;
    const isCompleted =
      numberOfInstallments > 0 && paidCount >= numberOfInstallments;

    await planRef.update({
      installments: overriddenRows,
      paidCount,
      status: isCompleted ? "completed" : "active",
      updatedAt: FieldValue.serverTimestamp(),
    });

    const refreshedSnap = await planRef.get();
    const refreshedPlan = calculateInstallmentComputedFields({
      id: refreshedSnap.id,
      ...(refreshedSnap.data() || {}),
    });

    return successResponse(res, refreshedPlan, "Installment schedule updated");
  } catch (error) {
    if (error.message === "INVALID_INSTALLMENT_AMOUNT") {
      return errorResponse(res, "Each installment amount must be a positive number", 400);
    }
    if (error.message === "INVALID_INSTALLMENT_DUE_DATE") {
      return errorResponse(res, "Each installment dueDate must be valid", 400);
    }
    if (error.message === "INSTALLMENT_DUE_DATE_MUST_BE_FUTURE") {
      return errorResponse(
        res,
        "Unpaid installment due dates must be today or future",
        400
      );
    }
    console.error("overrideInstallment error:", error);
    return errorResponse(res, "Failed to override installment schedule", 500);
  }
};

export const sendInstallmentReminders = async (req, res) => {
  try {
    const now = startOfDay(new Date());
    const inThreeDays = addDays(now, 3);

    const { studentId = "" } = req.body || {};

    const plansSnap = await db.collection(COLLECTIONS.INSTALLMENTS).get();
    let plans = plansSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    plans = plans.filter((plan) => String(plan.status || "").toLowerCase() !== "completed");
    plans = plans.filter((plan) => isInstallmentPlanEligible(plan));
    if (studentId) {
      plans = plans.filter((plan) => plan.studentId === studentId);
    }

    const targetPlans = plans
      .map((plan) => calculateInstallmentComputedFields(plan))
      .filter((plan) => plan.installments.some((item) => {
        if (item.status === "paid") return false;
        const dueDate = parseDate(item.dueDate);
        if (!dueDate) return false;
        const due = startOfDay(dueDate);
        return due >= now && due <= inThreeDays;
      }));

    const studentIds = targetPlans.map((plan) => plan.studentId).filter(Boolean);
    const courseIds = targetPlans.map((plan) => plan.courseId).filter(Boolean);
    const [studentMap, userMap, courseMap] = await Promise.all([
      getDocMap(COLLECTIONS.STUDENTS, studentIds),
      getDocMap(COLLECTIONS.USERS, studentIds),
      getDocMap(COLLECTIONS.COURSES, courseIds),
    ]);

    let sent = 0;
    const remindedStudents = new Set();

    for (const plan of targetPlans) {
      const user = userMap[plan.studentId] || {};
      const student = studentMap[plan.studentId] || {};
      const course = courseMap[plan.courseId] || {};
      const email = user.email || "";
      if (!email) continue;

      const studentName =
        student.fullName ||
        plan.studentName ||
        (email ? String(email).split("@")[0] : "Student");
      const courseName = plan.courseName || course.title || "Course";

      const dueSoonRows = plan.installments
        .filter((item) => {
          if (item.status === "paid") return false;
          const dueDate = parseDate(item.dueDate);
          if (!dueDate) return false;
          const due = startOfDay(dueDate);
          return due >= now && due <= inThreeDays;
        })
        .sort(
          (a, b) =>
            (parseDate(a.dueDate)?.getTime() || 0) -
            (parseDate(b.dueDate)?.getTime() || 0)
        );

      if (dueSoonRows.length < 1) continue;

      const nextDue = dueSoonRows[0];

      try {
        await sendInstallmentReminderEmail(
          email,
          studentName,
          courseName,
          nextDue.amount || 0,
          nextDue.dueDate || ""
        );
      } catch (primaryEmailError) {
        try {
          await sendInstallmentReminder(
            email,
            studentName,
            courseName,
            nextDue.amount || 0,
            nextDue.dueDate || ""
          );
        } catch (fallbackEmailError) {
          console.error(
            "sendInstallmentReminders email error:",
            primaryEmailError.message || fallbackEmailError.message
          );
          continue;
        }
      }

      remindedStudents.add(plan.studentId);
      sent += 1;
    }

    return successResponse(
      res,
      { sent, remindersSent: sent, students: remindedStudents.size },
      `Reminders sent to ${sent} students`
    );
  } catch (error) {
    console.error("sendInstallmentReminders error:", error);
    return errorResponse(res, "Failed to send reminders", 500);
  }
};

export const getPaymentMethodsConfig = async (req, res) => {
  try {
    const paymentSettings = await getCurrentPaymentSettings();
    return successResponse(res, paymentSettings, "Payment config fetched");
  } catch (error) {
    console.error("getPaymentMethodsConfig error:", error);
    return errorResponse(res, "Failed to fetch payment config", 500);
  }
};
