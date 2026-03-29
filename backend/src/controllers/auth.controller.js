import { admin, db } from "../config/firebase.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";
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

const getOtpRef = (purpose, email) =>
  db.collection(OTP_COLLECTION).doc(otpDocId(purpose, email));

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

const getUserNameByEmail = async (email) => {
  const emailLower = normalizeEmail(email);
  const usersSnap = await db
    .collection("users")
    .where("email", "==", emailLower)
    .limit(1)
    .get();

  if (usersSnap.empty) {
    return getNameFromEmail(emailLower);
  }

  const userData = usersSnap.docs[0].data() || {};
  const uid = userData.uid || usersSnap.docs[0].id;
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

const sendRegistrationOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const fullName = trimText(req.body?.fullName);

    if (!isValidEmail(email)) {
      return errorResponse(res, "Valid email is required", 400);
    }

    try {
      await admin.auth().getUserByEmail(email);
      return errorResponse(res, "Email is already registered", 409);
    } catch (authError) {
      if (authError?.code !== "auth/user-not-found") {
        throw authError;
      }
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

    let userRecord = null;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (authError) {
      if (authError?.code !== "auth/user-not-found") {
        throw authError;
      }
    }

    if (!userRecord) {
      return successResponse(
        res,
        {},
        "If this email exists, an OTP has been sent"
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
    const userName = await getUserNameByEmail(email);

    await ref.set(
      {
        purpose: "forgot-password",
        email,
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

    await sendForgotPasswordOTP(email, userName, otp);

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

    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (authError) {
      if (authError?.code === "auth/user-not-found") {
        return errorResponse(res, "User not found", 404);
      }
      throw authError;
    }

    await admin.auth().updateUser(userRecord.uid, { password: newPassword });
    await admin.auth().revokeRefreshTokens(userRecord.uid);
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

    const isGoogleRegistration = String(provider || "").toLowerCase() === "google";

    if (!isGoogleRegistration) {
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
    }

    const existingUser = await db.collection("users").doc(uid).get();
    if (existingUser.exists) {
      return errorResponse(res, "User already registered", 409);
    }

    await admin.auth().setCustomUserClaims(uid, { role: "student" });

    const batch = db.batch();

    const displayName = fullName || email.split("@")[0];
    const safeDevice = req.clientDevice || req.headers?.["user-agent"] || "";
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
      role: "student",
      isActive: true,
      assignedWebDevice: safeDevice,
      assignedWebIp: safeIp,
      lastKnownWebIp: safeIp,
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const studentRef = db.collection("students").doc(uid);
    batch.set(studentRef, {
      uid,
      fullName: displayName,
      phoneNumber,
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
      "Student account created successfully",
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
    const userSnap = await db.collection("users").doc(uid).get();

    if (!userSnap.exists) {
      return errorResponse(res, "User profile not found", 404);
    }

    const userData = userSnap.data();

    // Check account is active
    if (!userData.isActive) {
      return errorResponse(
        res,
        "Your account has been deactivated. Contact admin.",
        403
      );
    }

    // Device + IP check
    if (userData.role === "student") {
      // Run device and IP check only for students
      if (userData.assignedWebDevice && userData.assignedWebIp) {
        const currentDevice = req.clientDevice;
        const currentIP = req.clientIP;

        const deviceMatch = userData.assignedWebDevice === currentDevice;
        const ipMatch = userData.assignedWebIp === currentIP;

        console.log(`[Security Check]`);
        console.log(`  Assigned Device : ${userData.assignedWebDevice}`);
        console.log(`  Current Device  : ${currentDevice}`);
        console.log(`  Device Match    : ${deviceMatch}`);
        console.log(`  Assigned IP     : ${userData.assignedWebIp}`);
        console.log(`  Current IP      : ${currentIP}`);
        console.log(`  IP Match        : ${ipMatch}`);

        if (!deviceMatch || !ipMatch) {
          await db.collection("auditLogs").add({
            uid,
            email: userData.email,
            action: "blocked_login",
            reason: !deviceMatch ? "device_mismatch" : "ip_mismatch",
            assignedDevice: userData.assignedWebDevice,
            attemptDevice: currentDevice,
            assignedIP: userData.assignedWebIp,
            attemptIP: currentIP,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

          return errorResponse(
            res,
            "You are trying to login from another device or network. Contact your admin or teacher.",
            403,
            { code: "DEVICE_IP_MISMATCH", contactAdmin: true }
          );
        }
      } else {
        // First login for student - save device and IP
        await db.collection("users").doc(uid).update({
          assignedWebDevice: req.clientDevice,
          assignedWebIp: req.clientIP,
          lastKnownWebIp: req.clientIP,
        });
        console.log(`[Security] First web login - device and IP saved`);
      }
    } else if (userData.role === "admin" || userData.role === "teacher") {
      console.log("[Security] Role is admin/teacher - device check skipped");
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

    const roleCollection =
      userData.role === "student"
        ? "students"
        : userData.role === "teacher"
          ? "teachers"
          : userData.role === "admin"
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


