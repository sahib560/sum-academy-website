import { admin, db } from "../config/firebase.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";
import {
  isPakistanPhone,
  normalizePakistanPhone,
} from "../utils/phone.utils.js";
import {
  sendForgotPasswordOTP,
  sendRegistrationOTP,
} from "../services/email.service.js";
import crypto from "crypto";

const OTP_COLLECTION = "authOtps";
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_VERIFIED_TOKEN_TTL_MS = 20 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
const isValidEmail = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
const trimText = (value = "") => String(value || "").trim();
const hashOtp = (otp = "") =>
  crypto.createHash("sha256").update(String(otp)).digest("hex");
const createOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const createVerificationToken = () => crypto.randomUUID();
const otpDocId = (purpose, email) => `${purpose}:${normalizeEmail(email)}`;
const getNameFromEmail = (email = "") => normalizeEmail(email).split("@")[0] || "User";
const resolveClientContext = (req) => {
  const forwarded = req.headers?.["x-forwarded-for"];
  const realIP = forwarded
    ? String(forwarded).split(",")[0].trim()
    : req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      "unknown";

  const cleanIP =
    realIP === "::1"
      ? "127.0.0.1"
      : String(realIP).startsWith("::ffff:")
        ? String(realIP).replace("::ffff:", "")
        : String(realIP);

  const userAgent = req.headers?.["user-agent"] || "unknown";
  let browser = "Unknown Browser";
  if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) browser = "Chrome";
  else if (/firefox/i.test(userAgent)) browser = "Firefox";
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = "Safari";
  else if (/edg/i.test(userAgent)) browser = "Edge";
  else if (/opera|opr/i.test(userAgent)) browser = "Opera";

  let os = "Unknown OS";
  if (/windows/i.test(userAgent)) os = "Windows";
  else if (/macintosh|mac os/i.test(userAgent)) os = "MacOS";
  else if (/linux/i.test(userAgent)) os = "Linux";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/iphone|ipad/i.test(userAgent)) os = "iOS";

  return {
    clientIP: req.clientIP || cleanIP,
    clientDevice: req.clientDevice || `${browser} on ${os}`,
  };
};

const getOtpRef = (purpose, email) =>
  db.collection(OTP_COLLECTION).doc(otpDocId(purpose, email));

const getRoleCollection = (role = "") => {
  const normalizedRole = trimText(role).toLowerCase();
  if (normalizedRole === "student") return "students";
  if (normalizedRole === "teacher") return "teachers";
  if (normalizedRole === "admin") return "admins";
  return "";
};

const hasRoleProfile = async (uid, role) => {
  const roleCollection = getRoleCollection(role);
  if (!uid || !roleCollection) return false;
  const snap = await db.collection(roleCollection).doc(uid).get();
  return snap.exists;
};

const isCompleteUserRecord = async (uid, userData = {}) => {
  if (!uid) return false;
  const role = trimText(userData.role).toLowerCase();
  if (!["student", "teacher", "admin"].includes(role)) return false;
  return hasRoleProfile(uid, role);
};

const validateVerifiedOtpToken = async (purpose, email, token) => {
  const ref = getOtpRef(purpose, email);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, reason: "OTP not found" };

  const data = snap.data() || {};
  const now = Date.now();

  if (data.purpose !== purpose) {
    return { ok: false, reason: "OTP purpose mismatch" };
  }
  if (data.used) {
    return { ok: false, reason: "OTP token already used" };
  }
  if (!data.verified || !data.verificationToken) {
    return { ok: false, reason: "OTP is not verified" };
  }
  if (data.verificationToken !== token) {
    return { ok: false, reason: "Invalid OTP verification token" };
  }

  const verifiedAt = Number(data.verifiedAt || 0);
  if (!verifiedAt || now - verifiedAt > OTP_VERIFIED_TOKEN_TTL_MS) {
    return { ok: false, reason: "OTP verification token expired" };
  }

  return { ok: true, ref, data };
};

const markOtpUsed = async (ref) => {
  await ref.set(
    {
      used: true,
      usedAt: Date.now(),
      verificationToken: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
};

const findUserDocByEmail = async (email = "") => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const exactSnap = await db
    .collection("users")
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();
  if (!exactSnap.empty) {
    const doc = exactSnap.docs[0];
    return { id: doc.id, data: doc.data() || {} };
  }

  // Legacy safety: older rows may store email with mixed casing.
  const allUsersSnap = await db.collection("users").get();
  const matchedDoc = allUsersSnap.docs.find(
    (doc) => normalizeEmail(doc.data()?.email) === normalizedEmail
  );
  if (!matchedDoc) return null;

  return { id: matchedDoc.id, data: matchedDoc.data() || {} };
};

const resolveRecoveryAccount = async (email = "") => {
  const normalizedEmail = normalizeEmail(email);
  let authUser = null;
  let userDoc = null;

  try {
    authUser = await admin.auth().getUserByEmail(normalizedEmail);
  } catch (authError) {
    if (authError?.code !== "auth/user-not-found") {
      throw authError;
    }
  }

  userDoc = await findUserDocByEmail(normalizedEmail);

  if (!authUser && userDoc?.id) {
    try {
      authUser = await admin.auth().getUser(userDoc.id);
    } catch (authError) {
      if (authError?.code !== "auth/user-not-found") {
        throw authError;
      }
    }
  }

  return { authUser, userDoc };
};

const getUserNameByEmail = async (email) => {
  const emailLower = normalizeEmail(email);
  const matchedUser = await findUserDocByEmail(emailLower);

  if (!matchedUser) {
    return getNameFromEmail(emailLower);
  }

  const userData = matchedUser.data || {};
  const uid = userData.uid || matchedUser.id;
  const role = userData.role;

  let roleDoc = null;
  if (role === "student") {
    roleDoc = await db.collection("students").doc(uid).get();
  } else if (role === "teacher") {
    roleDoc = await db.collection("teachers").doc(uid).get();
  } else if (role === "admin") {
    roleDoc = await db.collection("admins").doc(uid).get();
  }

  const roleData = roleDoc?.exists ? roleDoc.data() : {};
  return (
    trimText(roleData?.fullName) ||
    trimText(roleData?.name) ||
    trimText(userData?.fullName) ||
    trimText(userData?.name) ||
    getNameFromEmail(emailLower)
  );
};

const cleanupOrphanAuthAccountByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return { cleaned: false, reason: "INVALID_EMAIL" };
  }

  let authUser = null;
  try {
    authUser = await admin.auth().getUserByEmail(normalizedEmail);
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      return { cleaned: false, reason: "AUTH_NOT_FOUND" };
    }
    throw error;
  }

  const userSnap = await db.collection("users").doc(authUser.uid).get();
  if (userSnap.exists) {
    const userData = userSnap.data() || {};
    const isComplete = await isCompleteUserRecord(authUser.uid, userData);
    if (isComplete) {
      return { cleaned: false, reason: "COMPLETE_ACCOUNT_EXISTS" };
    }
  }

  const batch = db.batch();
  batch.delete(db.collection("users").doc(authUser.uid));
  batch.delete(db.collection("students").doc(authUser.uid));
  batch.delete(db.collection("teachers").doc(authUser.uid));
  batch.delete(db.collection("admins").doc(authUser.uid));
  await batch.commit();

  try {
    await admin.auth().deleteUser(authUser.uid);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }
  }

  return { cleaned: true, uid: authUser.uid };
};

const sendRegistrationOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const fullName = trimText(req.body?.fullName);

    if (!isValidEmail(email)) {
      return errorResponse(res, "Valid email is required", 400);
    }

    const existingUserSnap = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!existingUserSnap.empty) {
      const existingDoc = existingUserSnap.docs[0];
      const existingData = existingDoc.data() || {};
      const isComplete = await isCompleteUserRecord(existingDoc.id, existingData);
      if (isComplete) {
        return errorResponse(res, "Email is already registered", 409);
      }

      await db.collection("users").doc(existingDoc.id).delete();
      console.warn(
        `Recovered orphan user record for email ${email}; users/${existingDoc.id} removed`
      );
    }

    const orphanCleanup = await cleanupOrphanAuthAccountByEmail(email);
    if (orphanCleanup.reason === "COMPLETE_ACCOUNT_EXISTS") {
      return errorResponse(res, "Email is already registered", 409);
    }
    if (orphanCleanup.cleaned) {
      console.warn(
        `Recovered orphan auth account for ${email}; auth/${orphanCleanup.uid} deleted`
      );
    }

    const ref = getOtpRef("register", email);
    const snap = await ref.get();
    const now = Date.now();
    const current = snap.exists ? snap.data() || {} : {};

    if (
      current.lastSentAt &&
      now - Number(current.lastSentAt) < OTP_RESEND_COOLDOWN_MS
    ) {
      const waitFor = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS - (now - Number(current.lastSentAt))) / 1000
      );
      return errorResponse(
        res,
        `Please wait ${waitFor}s before requesting a new OTP`,
        429
      );
    }

    const otp = createOtp();
    const otpHash = hashOtp(otp);

    await ref.set(
      {
        purpose: "register",
        email,
        otpHash,
        attempts: 0,
        verified: false,
        verificationToken: null,
        used: false,
        expiresAt: now + OTP_EXPIRY_MS,
        verifiedAt: null,
        lastSentAt: now,
        fullName,
        createdAt: current.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await sendRegistrationOTP(email, fullName || getNameFromEmail(email), otp);

    return successResponse(
      res,
      { expiresInSeconds: OTP_EXPIRY_MS / 1000 },
      "OTP sent successfully"
    );
  } catch (error) {
    console.error("sendRegistrationOtp error:", error);
    return errorResponse(res, "Failed to send OTP", 500);
  }
};

const verifyRegistrationOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = trimText(req.body?.otp);

    if (!isValidEmail(email)) {
      return errorResponse(res, "Valid email is required", 400);
    }
    if (!/^\d{6}$/.test(otp)) {
      return errorResponse(res, "Enter a valid 6-digit OTP", 400);
    }

    const ref = getOtpRef("register", email);
    const snap = await ref.get();
    if (!snap.exists) {
      return errorResponse(res, "OTP not found. Request a new OTP.", 400);
    }

    const data = snap.data() || {};
    const now = Date.now();

    if (data.used) {
      return errorResponse(res, "OTP already used. Request a new OTP.", 400);
    }
    if (Number(data.expiresAt || 0) < now) {
      return errorResponse(res, "OTP expired. Request a new OTP.", 400);
    }
    if (Number(data.attempts || 0) >= OTP_MAX_ATTEMPTS) {
      return errorResponse(
        res,
        "Too many invalid attempts. Request a new OTP.",
        429
      );
    }

    if (hashOtp(otp) !== data.otpHash) {
      await ref.set(
        {
          attempts: Number(data.attempts || 0) + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return errorResponse(res, "Invalid OTP", 400);
    }

    const verificationToken = createVerificationToken();
    await ref.set(
      {
        verified: true,
        verificationToken,
        verifiedAt: now,
        attempts: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return successResponse(
      res,
      { otpVerificationToken: verificationToken },
      "OTP verified successfully"
    );
  } catch (error) {
    console.error("verifyRegistrationOtp error:", error);
    return errorResponse(res, "Failed to verify OTP", 500);
  }
};

const sendForgotPasswordOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!isValidEmail(email)) {
      return errorResponse(res, "Valid email is required", 400);
    }

    const { authUser, userDoc } = await resolveRecoveryAccount(email);
    if (!authUser && !userDoc) {
      return errorResponse(res, "Account not found", 404);
    }
    const userData = userDoc?.data || {};
    if (userData.isActive === false) {
      return errorResponse(
        res,
        "Your account is deactivated. Contact admin.",
        403
      );
    }

    const ref = getOtpRef("forgot-password", email);
    const snap = await ref.get();
    const now = Date.now();
    const current = snap.exists ? snap.data() || {} : {};

    if (
      current.lastSentAt &&
      now - Number(current.lastSentAt) < OTP_RESEND_COOLDOWN_MS
    ) {
      const waitFor = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS - (now - Number(current.lastSentAt))) / 1000
      );
      return errorResponse(
        res,
        `Please wait ${waitFor}s before requesting a new OTP`,
        429
      );
    }

    const otp = createOtp();
    const otpHash = hashOtp(otp);
    const recoveryEmail = normalizeEmail(authUser?.email || userData.email || email);
    const userName = await getUserNameByEmail(recoveryEmail);

    await ref.set(
      {
        purpose: "forgot-password",
        email: recoveryEmail,
        otpHash,
        attempts: 0,
        verified: false,
        verificationToken: null,
        used: false,
        expiresAt: now + OTP_EXPIRY_MS,
        verifiedAt: null,
        lastSentAt: now,
        createdAt: current.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await sendForgotPasswordOTP(recoveryEmail, userName, otp);

    return successResponse(
      res,
      { expiresInSeconds: OTP_EXPIRY_MS / 1000 },
      "OTP sent successfully"
    );
  } catch (error) {
    console.error("sendForgotPasswordOtp error:", error);
    return errorResponse(res, "Failed to send OTP", 500);
  }
};

const verifyForgotPasswordOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = trimText(req.body?.otp);

    if (!isValidEmail(email)) {
      return errorResponse(res, "Valid email is required", 400);
    }
    if (!/^\d{6}$/.test(otp)) {
      return errorResponse(res, "Enter a valid 6-digit OTP", 400);
    }

    const ref = getOtpRef("forgot-password", email);
    const snap = await ref.get();
    if (!snap.exists) {
      return errorResponse(res, "OTP not found. Request a new OTP.", 400);
    }

    const data = snap.data() || {};
    const now = Date.now();

    if (data.used) {
      return errorResponse(res, "OTP already used. Request a new OTP.", 400);
    }
    if (Number(data.expiresAt || 0) < now) {
      return errorResponse(res, "OTP expired. Request a new OTP.", 400);
    }
    if (Number(data.attempts || 0) >= OTP_MAX_ATTEMPTS) {
      return errorResponse(
        res,
        "Too many invalid attempts. Request a new OTP.",
        429
      );
    }

    if (hashOtp(otp) !== data.otpHash) {
      await ref.set(
        {
          attempts: Number(data.attempts || 0) + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return errorResponse(res, "Invalid OTP", 400);
    }

    const verificationToken = createVerificationToken();
    await ref.set(
      {
        verified: true,
        verificationToken,
        verifiedAt: now,
        attempts: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return successResponse(
      res,
      { otpVerificationToken: verificationToken },
      "OTP verified successfully"
    );
  } catch (error) {
    console.error("verifyForgotPasswordOtp error:", error);
    return errorResponse(res, "Failed to verify OTP", 500);
  }
};

const resetForgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const newPassword = String(req.body?.newPassword || "");
    const confirmPassword = String(req.body?.confirmPassword || "");
    const otpVerificationToken = trimText(req.body?.otpVerificationToken);

    if (!isValidEmail(email)) {
      return errorResponse(res, "Valid email is required", 400);
    }
    if (!otpVerificationToken) {
      return errorResponse(res, "OTP verification token is required", 400);
    }
    if (!newPassword || newPassword.length < 6) {
      return errorResponse(res, "Password must be at least 6 characters", 400);
    }
    if (newPassword !== confirmPassword) {
      return errorResponse(res, "Passwords do not match", 400);
    }

    const tokenValidation = await validateVerifiedOtpToken(
      "forgot-password",
      email,
      otpVerificationToken
    );

    if (!tokenValidation.ok) {
      return errorResponse(res, "OTP verification required", 400, {
        reason: tokenValidation.reason,
      });
    }

    const { authUser, userDoc } = await resolveRecoveryAccount(email);
    const authUid = authUser?.uid || userDoc?.id || "";
    if (!authUid) return errorResponse(res, "User not found", 404);

    await admin.auth().updateUser(authUid, { password: newPassword });
    await admin.auth().revokeRefreshTokens(authUid);
    await markOtpUsed(tokenValidation.ref);

    return successResponse(res, {}, "Password reset successful");
  } catch (error) {
    console.error("resetForgotPassword error:", error);
    return errorResponse(res, "Failed to reset password", 500);
  }
};

const isFirebaseCredentialError = (error) => {
  const code = error?.code;
  const msg = String(error?.message || "").toLowerCase();
  return (
    code === 16 ||
    code === "16" ||
    msg.includes("unauthenticated") ||
    msg.includes("invalid authentication credentials")
  );
};

const registerUser = async (req, res) => {
  try {
    const {
      uid,
      email,
      fullName = "",
      phoneNumber = "",
      fatherName = "",
      fatherPhone = "",
      fatherOccupation = "",
      address = "",
      district = "",
      domicile = "",
      caste = "",
      otpVerificationToken = "",
      provider = "",
    } = req.body || {};

    if (!uid || !email) {
      return errorResponse(res, "uid and email are required", 400);
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return errorResponse(res, "Valid email is required", 400);
    }

    if (req.user?.uid && req.user.uid !== uid) {
      return errorResponse(res, "Token uid mismatch", 403);
    }

    if (req.user?.email && normalizeEmail(req.user.email) !== normalizedEmail) {
      return errorResponse(res, "Token email mismatch", 403);
    }

    if (!trimText(otpVerificationToken)) {
      return errorResponse(res, "OTP verification is required", 400);
    }

    const tokenValidation = await validateVerifiedOtpToken(
      "register",
      normalizedEmail,
      trimText(otpVerificationToken)
    );

    if (!tokenValidation.ok) {
      return errorResponse(res, "OTP verification required", 400, {
        reason: tokenValidation.reason,
      });
    }

    const existingUser = await db.collection("users").doc(uid).get();
    if (existingUser.exists) {
      const existingData = existingUser.data() || {};
      const isComplete = await isCompleteUserRecord(uid, existingData);
      if (isComplete) {
        return errorResponse(res, "User already registered", 409);
      }
    }

    const existingByEmailSnap = await db
      .collection("users")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (!existingByEmailSnap.empty) {
      const existingDoc = existingByEmailSnap.docs[0];
      if (existingDoc.id !== uid) {
        const existingData = existingDoc.data() || {};
        const isComplete = await isCompleteUserRecord(existingDoc.id, existingData);
        if (isComplete) {
          return errorResponse(
            res,
            "This email is already linked with another account. Please login using your original account/device.",
            409,
            { code: "EMAIL_ALREADY_REGISTERED_WITH_DIFFERENT_ACCOUNT" }
          );
        }

        await db.collection("users").doc(existingDoc.id).delete();
        console.warn(
          `Recovered orphan email mapping for ${normalizedEmail}; users/${existingDoc.id} removed`
        );
      }
    }

    await admin.auth().setCustomUserClaims(uid, { role: "student" });

    const batch = db.batch();

    const displayName = trimText(fullName) || email.split("@")[0];
    const safePhone = normalizePakistanPhone(trimText(phoneNumber));
    if (!safePhone || !isPakistanPhone(safePhone)) {
      return errorResponse(
        res,
        "phoneNumber must be 03001234567 or +923001234567 format",
        400
      );
    }
    const safeFatherPhone = trimText(fatherPhone)
      ? normalizePakistanPhone(trimText(fatherPhone))
      : "";
    if (trimText(fatherPhone) && !isPakistanPhone(safeFatherPhone)) {
      return errorResponse(
        res,
        "fatherPhone must be 03001234567 or +923001234567 format",
        400
      );
    }
    const studentProfile = {
      fatherName: trimText(fatherName),
      fatherPhone: safeFatherPhone,
      fatherOccupation: trimText(fatherOccupation),
      address: trimText(address),
      district: trimText(district),
      domicile: trimText(domicile),
      caste: trimText(caste),
    };
    const safeDevice = req.clientDevice || req.headers?.["user-agent"] || "";
    const safeUniqueDeviceId = req.uniqueDeviceId || "";
    const rawIp =
      req.clientIP ||
      req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      "";
    const safeIp =
      rawIp === "::1"
        ? "127.0.0.1"
        : rawIp.startsWith("::ffff:")
          ? rawIp.replace("::ffff:", "")
          : rawIp;

    const userRef = db.collection("users").doc(uid);
    batch.set(userRef, {
      uid,
      email: normalizedEmail,
      fullName: displayName,
      name: displayName,
      phoneNumber: safePhone,
      role: "student",
      isActive: false,
      status: "pending_approval",
      registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      assignedWebDevice: safeDevice,
      assignedWebIp: safeIp,
      assignedUniqueDeviceId: safeUniqueDeviceId,
      lastKnownWebIp: safeIp,
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const studentRef = db.collection("students").doc(uid);
    batch.set(studentRef, {
      uid,
      email: normalizedEmail,
      fullName: displayName,
      name: displayName,
      phoneNumber: safePhone,
      phone: safePhone,
      approvalStatus: "pending",
      ...studentProfile,
      enrolledCourses: [],
      certificates: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    if (String(provider || "").toLowerCase() !== "google") {
      const otpRef = getOtpRef("register", normalizedEmail);
      await markOtpUsed(otpRef);
    }

    return successResponse(
      res,
      { user: { uid, email: normalizedEmail, role: "student", fullName: displayName } },
      "Registration successful! Your account is pending admin approval. You will be notified once approved.",
      201
    );
  } catch (error) {
    console.error("Register error:", error);
    return errorResponse(res, "Registration failed", 500);
  }
};

const loginUser = async (req, res) => {
  try {
    const uid = req.user.uid;

    // Fetch user doc
    const [userSnap, studentSnap] = await Promise.all([
      db.collection("users").doc(uid).get(),
      db.collection("students").doc(uid).get(),
    ]);

    if (!userSnap.exists) {
      return errorResponse(res, "User profile not found", 404);
    }

    const userData = userSnap.data();

    if (userData.role === "student" && userData.status === "pending_approval") {
      return errorResponse(
        res,
        "Your account is pending admin approval. Please wait for admin to activate your account.",
        403,
        { code: "PENDING_APPROVAL" }
      );
    }

    if (userData.role === "student" && studentSnap.exists) {
      const studentData = studentSnap.data() || {};
      const approvalStatus = String(studentData.approvalStatus || "")
        .trim()
        .toLowerCase();
      if (approvalStatus && approvalStatus !== "approved") {
        return errorResponse(
          res,
          "Your account is pending admin approval. Please wait for admin to activate your account.",
          403,
          { code: "PENDING_APPROVAL" }
        );
      }
    }

    // Check account is active
    if (!userData.isActive) {
      return errorResponse(
        res,
        userData.securityDeactivationReason ||
          "Your account has been deactivated. Contact admin or teacher.",
        403,
        {
          code: "ACCOUNT_DEACTIVATED",
          contactAdmin: true,
          reason: userData.lastSecurityViolationReason || "",
          deactivatedAt: userData.securityDeactivatedAt || null,
        }
      );
    }

    // Device check
    if (userData.role === "student") {
      if (
        userData.assignedWebDevice &&
        userData.assignedWebDevice !== "" &&
        userData.assignedUniqueDeviceId &&
        userData.assignedUniqueDeviceId !== ""
      ) {
        const deviceMatch =
          userData.assignedUniqueDeviceId === req.uniqueDeviceId;

        console.log(`[Security Check]`);
        console.log(`  Assigned DeviceID: ${userData.assignedUniqueDeviceId}`);
        console.log(`  Current  DeviceID: ${req.uniqueDeviceId}`);
        console.log(`  Device Match     : ${deviceMatch}`);
        console.log(`  Assigned Device  : ${userData.assignedWebDevice}`);
        console.log(`  Current  Device  : ${req.clientDevice}`);

        if (!deviceMatch) {
          await db.collection("auditLogs").add({
            uid,
            email: userData.email,
            action: "blocked_login",
            reason: "device_mismatch",
            assignedDeviceId: userData.assignedUniqueDeviceId,
            attemptDeviceId: req.uniqueDeviceId,
            assignedDeviceName: userData.assignedWebDevice,
            attemptDeviceName: req.clientDevice,
            ip: req.clientIP,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

          return errorResponse(
            res,
            "You are trying to login from a different device. Please use your registered device or contact your admin or teacher to reset your device.",
            403,
            {
              code: "DEVICE_MISMATCH",
              contactAdmin: true,
              registeredDevice: userData.assignedWebDevice,
              currentDevice: req.clientDevice,
            }
          );
        }
      } else {
        await db.collection("users").doc(uid).update({
          assignedWebDevice: req.clientDevice,
          assignedWebIp: req.clientIP,
          assignedUniqueDeviceId: req.uniqueDeviceId,
          lastKnownWebIp: req.clientIP,
        });
        console.log(`[Security] First login — device fingerprint saved`);
      }
    } else if (userData.role === "admin" || userData.role === "teacher") {
      console.log("[Security] Role is admin/teacher — device check skipped");
    }

    // Single device enforcement — deactivate old sessions
    const sessionsSnap = await db
      .collection("sessions")
      .where("uid", "==", uid)
      .where("active", "==", true)
      .get();

    const batch = db.batch();
    sessionsSnap.docs.forEach((doc) => {
      batch.update(doc.ref, { active: false });
    });
    if (!sessionsSnap.empty) {
      await batch.commit();
    }

    // Create new active session
    await db.collection("sessions").add({
      uid,
      active: true,
      ip: req.clientIP,
      device: req.clientDevice,
      deviceType: "web",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update ONLY lastLoginAt — never touch assigned fields
    await db.collection("users").doc(uid).update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log successful login
    await db.collection("auditLogs").add({
      uid,
      email: userData.email,
      action: "login_success",
      ip: req.clientIP,
      device: req.clientDevice,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return successResponse(
      res,
      {
        user: {
          uid,
          email: userData.email,
          role: userData.role,
        },
      },
      "Login successful"
    );
  } catch (error) {
    console.error("Login error:", error);
    if (isFirebaseCredentialError(error)) {
      return errorResponse(
        res,
        "Server Firebase credentials are invalid. Please contact admin.",
        500,
        { code: "FIREBASE_CREDENTIALS_ERROR" }
      );
    }
    return errorResponse(res, "Login failed", 500);
  }
};

const logoutUser = async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res
        .status(400)
        .json({ success: false, message: "Missing user uid" });
    }

    const sessionsSnap = await db
      .collection("sessions")
      .where("uid", "==", uid)
      .where("active", "==", true)
      .get();

    if (!sessionsSnap.empty) {
      const batch = db.batch();
      sessionsSnap.forEach((doc) => {
        batch.update(doc.ref, { active: false });
      });
      await batch.commit();
    }

    return res
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Server error" });
  }
};

const getMe = async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return errorResponse(res, "Missing user uid", 400);
    }

    const userSnap = await db.collection("users").doc(uid).get();

    if (!userSnap.exists) {
      return errorResponse(res, "User not found", 404);
    }

    const userData = userSnap.data();
    const role = String(userData.role || "").toLowerCase();
    const { clientIP, clientDevice } = resolveClientContext(req);

    if (userData.isActive === false) {
      return errorResponse(
        res,
        userData.securityDeactivationReason ||
          "Your account has been deactivated. Contact admin or teacher.",
        403,
        {
          code: "ACCOUNT_DEACTIVATED",
          contactAdmin: true,
          reason: userData.lastSecurityViolationReason || "",
          deactivatedAt: userData.securityDeactivatedAt || null,
        }
      );
    }

    if (role === "student") {
      const assignedDevice = trimText(userData.assignedWebDevice);
      const assignedDeviceId = trimText(userData.assignedUniqueDeviceId);
      const currentDeviceId = trimText(req.uniqueDeviceId);

      if (assignedDevice && assignedDeviceId) {
        const deviceMatch = assignedDeviceId === currentDeviceId;

        if (!deviceMatch) {
          await db.collection("auditLogs").add({
            uid,
            email: userData.email || "",
            action: "blocked_login",
            reason: "device_mismatch",
            assignedDeviceId,
            attemptDeviceId: currentDeviceId,
            assignedDeviceName: assignedDevice,
            attemptDeviceName: clientDevice,
            ip: clientIP,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

          return errorResponse(
            res,
            "You are trying to login from a different device. Please use your registered device or contact your admin or teacher to reset your device.",
            403,
            {
              code: "DEVICE_MISMATCH",
              contactAdmin: true,
              registeredDevice: assignedDevice,
              currentDevice: clientDevice,
            }
          );
        }
      } else if (clientDevice && clientIP) {
        await db.collection("users").doc(uid).set(
          {
            assignedWebDevice: clientDevice,
            assignedWebIp: clientIP,
            assignedUniqueDeviceId: currentDeviceId,
            lastKnownWebIp: clientIP,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    const roleCollection =
      role === "student"
        ? "students"
        : role === "teacher"
          ? "teachers"
          : role === "admin"
            ? "admins"
            : null;

    let roleData = {};
    if (roleCollection) {
      const roleSnap = await db.collection(roleCollection).doc(uid).get();
      if (roleSnap.exists) roleData = roleSnap.data();
    }

    const fallbackName = userData.email
      ? String(userData.email).split("@")[0]
      : "User";
    const resolvedName =
      roleData.fullName ||
      roleData.name ||
      userData.fullName ||
      userData.name ||
      userData.displayName ||
      fallbackName;

    const fullProfile = {
      ...userData,
      ...roleData,
      uid,
      name: resolvedName,
      fullName: resolvedName,
    };

    delete fullProfile.assignedWebDevice;
    delete fullProfile.assignedWebIp;
    delete fullProfile.lastKnownWebIp;
    delete fullProfile.assignedUniqueDeviceId;

    return successResponse(res, { user: fullProfile }, "Profile fetched");
  } catch (error) {
    console.error("getMe error:", error);
    return errorResponse(res, "Failed to fetch profile", 500);
  }
};

const setUserRole = async (req, res) => {
  try {
    const { uid, role } = req.body || {};
    const allowedRoles = ["student", "teacher", "admin"];

    if (!uid || !allowedRoles.includes(role)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid role" });
    }

    await db.collection("users").doc(uid).update({ role });
    await admin.auth().setCustomUserClaims(uid, { role });

    return res
      .status(200)
      .json({ success: true, message: "Role updated" });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Server error" });
  }
};

export {
  sendRegistrationOtp,
  verifyRegistrationOtp,
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  setUserRole,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetForgotPassword,
};


