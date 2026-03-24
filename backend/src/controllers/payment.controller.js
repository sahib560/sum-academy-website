import { admin, db } from "../config/firebase.js";
import { PAYMENT_CONFIG } from "../config/payment.config.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";
import {
  sendPaymentConfirmation,
  sendPaymentRejected,
  sendInstallmentReminder,
  sendBankTransferInitiated,
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

const getCurrentPaymentSettings = async () => {
  const settingsSnap = await db
    .collection(COLLECTIONS.SETTINGS)
    .doc("general")
    .get();
  const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};

  const configuredBank =
    settings?.paymentSettings?.bankTransfer ||
    settings?.paymentSettings?.bank ||
    settings?.bankTransfer ||
    {};

  return {
    jazzcash: {
      enabled:
        settings?.paymentSettings?.jazzcash?.enabled ??
        PAYMENT_CONFIG.jazzcash.enabled,
      returnUrl: PAYMENT_CONFIG.jazzcash.returnUrl,
    },
    easypaisa: {
      enabled:
        settings?.paymentSettings?.easypaisa?.enabled ??
        PAYMENT_CONFIG.easypaisa.enabled,
      returnUrl: PAYMENT_CONFIG.easypaisa.returnUrl,
    },
    bankTransfer: {
      enabled:
        configuredBank?.enabled ?? PAYMENT_CONFIG.bankTransfer.enabled,
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

const resolvePromo = async (promoCode, courseId) => {
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
  if (usageLimit > 0 && usageCount >= usageLimit) {
    throw new Error("PROMO_LIMIT_REACHED");
  }

  if (promoData.courseId && promoData.courseId !== courseId) {
    throw new Error("PROMO_INVALID_FOR_COURSE");
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

const addStudentToClassFromPayment = async ({ classId, studentId, shiftId, courseId }) => {
  if (!classId || !shiftId || !studentId) return;

  await db.runTransaction(async (transaction) => {
    const classRef = db.collection(COLLECTIONS.CLASSES).doc(classId);
    const classSnap = await transaction.get(classRef);
    if (!classSnap.exists) throw new Error("CLASS_NOT_FOUND");

    const classData = classSnap.data() || {};
    const students = Array.isArray(classData.students) ? classData.students : [];
    const normalizedStudents = students.map((entry) =>
      typeof entry === "string"
        ? { studentId: entry, shiftId: "", courseId: "", enrolledAt: null }
        : {
            studentId: entry.studentId,
            shiftId: entry.shiftId || "",
            courseId: entry.courseId || "",
            enrolledAt: entry.enrolledAt || null,
          }
    );

    if (normalizedStudents.some((entry) => entry.studentId === studentId)) {
      return;
    }

    const capacity = Math.max(toNumber(classData.capacity), 0);
    if (capacity > 0 && normalizedStudents.length >= capacity) {
      throw new Error("CLASS_FULL");
    }

    normalizedStudents.push({
      studentId,
      shiftId: shiftId || "",
      courseId: courseId || "",
      enrolledAt: new Date().toISOString(),
    });

    transaction.update(classRef, {
      students: normalizedStudents,
      enrolledCount: normalizedStudents.length,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
};

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

    if (!courseId || !method) {
      return errorResponse(res, "courseId and method are required", 400);
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
    if (classId && !classData) return errorResponse(res, "Class not found", 404);

    const originalAmount = Math.max(toNumber(course.price), 0);
    let promoDoc = null;
    let promoData = null;
    if (promoCode) {
      const promoResult = await resolvePromo(promoCode, courseId);
      promoDoc = promoResult.promoDoc || null;
      promoData = promoResult.promoData || null;
    }

    const discountAmount = calculateDiscount(originalAmount, promoData);
    const finalAmount = Number(Math.max(originalAmount - discountAmount, 0).toFixed(2));
    const installmentSchedule =
      installmentCount > 1
        ? buildInstallmentSchedule(finalAmount, installmentCount)
        : null;

    const paymentSettings = await getCurrentPaymentSettings();

    if (paymentMethod === "jazzcash") {
      if (!paymentSettings.jazzcash.enabled) {
        return errorResponse(
          res,
          "JazzCash integration coming soon. Please use Bank Transfer for now.",
          503
        );
      }

      return successResponse(
        res,
        {
          gateway: "jazzcash",
          status: "placeholder",
          message: "JazzCash API call placeholder ready. Add keys to enable.",
        },
        "JazzCash initiation placeholder"
      );
    }

    if (paymentMethod === "easypaisa") {
      if (!paymentSettings.easypaisa.enabled) {
        return errorResponse(
          res,
          "EasyPaisa integration coming soon. Please use Bank Transfer for now.",
          503
        );
      }

      return successResponse(
        res,
        {
          gateway: "easypaisa",
          status: "placeholder",
          message: "EasyPaisa API call placeholder ready. Add keys to enable.",
        },
        "EasyPaisa initiation placeholder"
      );
    }

    if (!paymentSettings.bankTransfer.enabled) {
      return errorResponse(res, "Bank transfer is currently disabled", 503);
    }

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
      amount: finalAmount,
      originalAmount,
      discount: discountAmount,
      promoCode: promoData?.code || null,
      promoCodeId: promoDoc?.id || null,
      method: "bank_transfer",
      status: "pending",
      receiptUrl: null,
      reference,
      installments: installmentSchedule,
      isInstallment: installmentCount > 1,
      numberOfInstallments: installmentCount,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await paymentRef.set(paymentPayload);

    try {
      await sendBankTransferInitiated(
        student.email,
        student.fullName,
        paymentPayload,
        paymentSettings.bankTransfer
      );
    } catch (emailError) {
      console.error("sendBankTransferInitiated error:", emailError.message);
    }

    return successResponse(
      res,
      {
        paymentId: paymentRef.id,
        reference,
        amount: finalAmount,
        originalAmount,
        discount: discountAmount,
        promoCode: promoData?.code || null,
        bankDetails: paymentSettings.bankTransfer,
        installments: installmentSchedule,
      },
      "Bank transfer initiated",
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
    if (payment.method !== "bank_transfer") {
      return errorResponse(res, "Receipt upload is only for bank transfer", 400);
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

export const getAdminPayments = async (req, res) => {
  try {
    const { method, status, dateRange, from, to } = req.query;
    const snap = await db.collection(COLLECTIONS.PAYMENTS).get();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let data = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    if (method) data = data.filter((item) => item.method === method);
    if (status) data = data.filter((item) => item.status === status);

    if (dateRange === "this_month") {
      data = data.filter((item) => {
        const createdAt = parseDate(item.createdAt);
        return createdAt && createdAt >= monthStart;
      });
    } else if (dateRange === "last_30_days") {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      data = data.filter((item) => {
        const createdAt = parseDate(item.createdAt);
        return createdAt && createdAt >= start;
      });
    } else if (from || to) {
      const fromDate = parseDate(from);
      const toDate = parseDate(to);
      data = data.filter((item) => {
        const createdAt = parseDate(item.createdAt);
        if (!createdAt) return false;
        if (fromDate && createdAt < fromDate) return false;
        if (toDate && createdAt > toDate) return false;
        return true;
      });
    }

    const uniqueStudentIds = [...new Set(data.map((item) => item.studentId).filter(Boolean))];
    const uniqueClassIds = [...new Set(data.map((item) => item.classId).filter(Boolean))];

    const [userSnaps, classSnaps] = await Promise.all([
      Promise.all(
        uniqueStudentIds.map((studentId) =>
          db.collection(COLLECTIONS.USERS).doc(studentId).get()
        )
      ),
      Promise.all(
        uniqueClassIds.map((classId) =>
          db.collection(COLLECTIONS.CLASSES).doc(classId).get()
        )
      ),
    ]);

    const userEmailMap = {};
    userSnaps.forEach((snap) => {
      if (snap.exists) {
        userEmailMap[snap.id] = snap.data()?.email || "";
      }
    });
    const classMap = {};
    classSnaps.forEach((snap) => {
      if (snap.exists) {
        classMap[snap.id] = snap.data() || {};
      }
    });

    data = data.map((item) => {
      const classData = item.classId ? classMap[item.classId] : null;
      const shift = Array.isArray(classData?.shifts)
        ? classData.shifts.find((row) => row.id === item.shiftId)
        : null;

      return {
        ...item,
        studentEmail: userEmailMap[item.studentId] || "",
        className: item.className || classData?.name || "",
        shiftName: shift?.name || "",
        createdAt: serializeTimestamp(item.createdAt),
        updatedAt: serializeTimestamp(item.updatedAt),
        verifiedAt: serializeTimestamp(item.verifiedAt),
        receiptUploadedAt: serializeTimestamp(item.receiptUploadedAt),
      };
    });

    data.sort(
      (a, b) =>
        (parseDate(b.createdAt)?.getTime() || 0) -
        (parseDate(a.createdAt)?.getTime() || 0)
    );
    return successResponse(res, data, "Admin payments fetched");
  } catch (error) {
    console.error("getAdminPayments error:", error);
    return errorResponse(res, "Failed to fetch admin payments", 500);
  }
};

export const verifyBankTransfer = async (req, res) => {
  try {
    const paymentId = req.params.id || req.params.paymentId;
    const { action } = req.body || {};

    if (!["approve", "reject"].includes(action)) {
      return errorResponse(res, "Action must be approve or reject", 400);
    }

    const paymentRef = db.collection(COLLECTIONS.PAYMENTS).doc(paymentId);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) return errorResponse(res, "Payment not found", 404);

    const payment = paymentSnap.data() || {};
    if (payment.method !== "bank_transfer") {
      return errorResponse(res, "Only bank transfer can be verified here", 400);
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

      transaction.update(paymentRef, {
        status: "paid",
        verifiedBy: req.user.uid,
        verifiedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const enrollmentQuery = await db
        .collection(COLLECTIONS.ENROLLMENTS)
        .where("studentId", "==", freshPayment.studentId)
        .get();
      const hasEnrollment = enrollmentQuery.docs.some((doc) => {
        const row = doc.data() || {};
        return row.courseId === freshPayment.courseId;
      });

      if (!hasEnrollment) {
        const enrollmentRef = db.collection(COLLECTIONS.ENROLLMENTS).doc();
        transaction.set(enrollmentRef, {
          studentId: freshPayment.studentId,
          courseId: freshPayment.courseId,
          paymentId,
          classId: freshPayment.classId || null,
          shiftId: freshPayment.shiftId || null,
          status: "active",
          progress: 0,
          completedAt: null,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      const courseRef = db.collection(COLLECTIONS.COURSES).doc(freshPayment.courseId);
      transaction.update(courseRef, {
        enrollmentCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (freshPayment.promoCodeId) {
        const promoRef = db.collection(COLLECTIONS.PROMO_CODES).doc(freshPayment.promoCodeId);
        transaction.update(promoRef, {
          usageCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    if (payment.classId && payment.shiftId) {
      try {
        await addStudentToClassFromPayment({
          classId: payment.classId,
          studentId: payment.studentId,
          shiftId: payment.shiftId,
          courseId: payment.courseId,
        });
      } catch (classError) {
        console.error("addStudentToClassFromPayment error:", classError.message);
      }
    }

    let installmentPlanId = null;
    if (payment.isInstallment && Array.isArray(payment.installments) && payment.installments.length > 0) {
      const planRef = db.collection(COLLECTIONS.INSTALLMENTS).doc();
      installmentPlanId = planRef.id;

      const classData = payment.classId ? await getClassById(payment.classId) : null;

      await planRef.set({
        studentId: payment.studentId,
        studentName: payment.studentName || "",
        courseId: payment.courseId,
        courseName: payment.courseName || "",
        classId: payment.classId || null,
        className: classData?.name || payment.className || "",
        totalAmount: payment.amount || 0,
        numberOfInstallments: payment.numberOfInstallments || payment.installments.length,
        perInstallmentAmount:
          payment.installments?.[0]?.amount || toNumber(payment.amount) / toNumber(payment.numberOfInstallments || 1),
        installments: payment.installments,
        paidCount: 0,
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
    const updatedInstallments = installments.map((item) => {
      if (Number(item.number) !== installmentNumber) return item;
      return {
        ...item,
        status: "paid",
        paidAt: new Date().toISOString(),
      };
    });

    const paidCount = updatedInstallments.filter((item) => item.status === "paid").length;
    const completed = paidCount >= updatedInstallments.length && updatedInstallments.length > 0;

    await planRef.update({
      installments: updatedInstallments,
      paidCount,
      status: completed ? "completed" : "active",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return successResponse(
      res,
      { planId, installmentNumber, status: completed ? "completed" : "active" },
      "Installment marked paid"
    );
  } catch (error) {
    console.error("markInstallmentPaid error:", error);
    return errorResponse(res, "Failed to mark installment paid", 500);
  }
};

export const getInstallments = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snap = await db.collection(COLLECTIONS.INSTALLMENTS).get();
    let data = snap.docs.map((doc) => {
      const plan = { id: doc.id, ...(doc.data() || {}) };
      const installments = Array.isArray(plan.installments) ? plan.installments : [];

      const normalizedInstallments = installments.map((item) => {
        const dueDate = parseDate(item.dueDate);
        const isOverdue =
          item.status !== "paid" && dueDate && dueDate < today;

        return {
          ...item,
          status: isOverdue ? "overdue" : item.status || "pending",
          isOverdue,
        };
      });

      const overdueCount = normalizedInstallments.filter((item) => item.isOverdue).length;
      const paidCount = normalizedInstallments.filter((item) => item.status === "paid").length;
      const totalCount = normalizedInstallments.length;

      return {
        ...plan,
        installments: normalizedInstallments,
        overdueCount,
        paidCount,
        status:
          plan.status === "completed"
            ? "completed"
            : overdueCount > 0
              ? "overdue"
              : "active",
        remainingInstallments: Math.max(totalCount - paidCount, 0),
      };
    });

    const uniqueStudentIds = [...new Set(data.map((item) => item.studentId).filter(Boolean))];
    const uniqueCourseIds = [...new Set(data.map((item) => item.courseId).filter(Boolean))];
    const uniqueClassIds = [...new Set(data.map((item) => item.classId).filter(Boolean))];

    const [studentSnaps, userSnaps, courseSnaps, classSnaps] = await Promise.all([
      Promise.all(
        uniqueStudentIds.map((studentId) =>
          db.collection(COLLECTIONS.STUDENTS).doc(studentId).get()
        )
      ),
      Promise.all(
        uniqueStudentIds.map((studentId) =>
          db.collection(COLLECTIONS.USERS).doc(studentId).get()
        )
      ),
      Promise.all(
        uniqueCourseIds.map((courseId) =>
          db.collection(COLLECTIONS.COURSES).doc(courseId).get()
        )
      ),
      Promise.all(
        uniqueClassIds.map((classId) =>
          db.collection(COLLECTIONS.CLASSES).doc(classId).get()
        )
      ),
    ]);

    const studentMap = {};
    studentSnaps.forEach((snap) => {
      if (snap.exists) {
        studentMap[snap.id] = snap.data() || {};
      }
    });
    const userMap = {};
    userSnaps.forEach((snap) => {
      if (snap.exists) {
        userMap[snap.id] = snap.data() || {};
      }
    });
    const courseMap = {};
    courseSnaps.forEach((snap) => {
      if (snap.exists) {
        courseMap[snap.id] = snap.data() || {};
      }
    });
    const classMap = {};
    classSnaps.forEach((snap) => {
      if (snap.exists) {
        classMap[snap.id] = snap.data() || {};
      }
    });

    data = data.map((item) => {
      const studentData = item.studentId ? studentMap[item.studentId] || {} : {};
      const userData = item.studentId ? userMap[item.studentId] || {} : {};
      const courseData = item.courseId ? courseMap[item.courseId] || {} : {};
      const classData = item.classId ? classMap[item.classId] || {} : {};

      return {
        ...item,
        studentName:
          item.studentName ||
          studentData.fullName ||
          (userData.email ? String(userData.email).split("@")[0] : "Student"),
        studentEmail: userData.email || "",
        courseName: item.courseName || courseData.title || "",
        className: item.className || classData.name || "",
        createdAt: serializeTimestamp(item.createdAt),
        updatedAt: serializeTimestamp(item.updatedAt),
      };
    });

    data.sort((a, b) => (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0));
    return successResponse(res, data, "Installments fetched");
  } catch (error) {
    console.error("getInstallments error:", error);
    return errorResponse(res, "Failed to fetch installments", 500);
  }
};

export const sendInstallmentReminders = async (req, res) => {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const inThreeDays = new Date(now);
    inThreeDays.setDate(inThreeDays.getDate() + 3);

    const plansSnap = await db.collection(COLLECTIONS.INSTALLMENTS).get();
    let remindersSent = 0;

    for (const doc of plansSnap.docs) {
      const plan = doc.data() || {};
      const installments = Array.isArray(plan.installments) ? plan.installments : [];
      const pendingSoon = installments.filter((item) => {
        if (item.status === "paid") return false;
        const dueDate = parseDate(item.dueDate);
        if (!dueDate) return false;
        dueDate.setHours(0, 0, 0, 0);
        return dueDate >= now && dueDate <= inThreeDays;
      });

      if (pendingSoon.length < 1) continue;

      const userSnap = await db.collection(COLLECTIONS.USERS).doc(plan.studentId).get();
      const studentSnap = await db.collection(COLLECTIONS.STUDENTS).doc(plan.studentId).get();
      const courseSnap = await db.collection(COLLECTIONS.COURSES).doc(plan.courseId).get();

      if (!userSnap.exists) continue;
      const email = userSnap.data()?.email || "";
      const studentName =
        (studentSnap.exists ? studentSnap.data()?.fullName : "") ||
        (email ? email.split("@")[0] : "Student");
      const courseName = courseSnap.exists ? courseSnap.data()?.title || "Course" : "Course";

      for (const installment of pendingSoon) {
        try {
          await sendInstallmentReminder(
            email,
            studentName,
            courseName,
            installment.amount || 0,
            installment.dueDate || ""
          );
          remindersSent += 1;
        } catch (emailError) {
          console.error("sendInstallmentReminder error:", emailError.message);
        }
      }
    }

    return successResponse(
      res,
      { remindersSent },
      `Reminders sent to ${remindersSent} installments`
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
