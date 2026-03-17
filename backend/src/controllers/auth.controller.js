import { admin, db } from "../config/firebase.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";

const registerUser = async (req, res) => {
  try {
    const {
      uid,
      email,
      fullName = "",
      phoneNumber = "",
    } = req.body || {};

    if (!uid || !email) {
      return errorResponse(res, "uid and email are required", 400);
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
      email,
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

    return successResponse(
      res,
      { user: { uid, email, role: "student", fullName: displayName } },
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

    // ── DEVICE + IP CHECK ──────────────────────────────────
    // Only run check if assignedWebDevice and assignedWebIp
    // are already saved (means user registered from web before)
    if (
      userData.assignedWebDevice &&
      userData.assignedWebDevice !== "" &&
      userData.assignedWebIp &&
      userData.assignedWebIp !== ""
    ) {
      const currentDevice = req.clientDevice;
      const currentIP = req.clientIP;

      const deviceMatch =
        userData.assignedWebDevice === currentDevice;
      const ipMatch =
        userData.assignedWebIp === currentIP;

      console.log(`[Security Check]`);
      console.log(`  Assigned Device : ${userData.assignedWebDevice}`);
      console.log(`  Current Device  : ${currentDevice}`);
      console.log(`  Device Match    : ${deviceMatch}`);
      console.log(`  Assigned IP     : ${userData.assignedWebIp}`);
      console.log(`  Current IP      : ${currentIP}`);
      console.log(`  IP Match        : ${ipMatch}`);

      if (!deviceMatch || !ipMatch) {
        // Log the blocked attempt in auditLogs
        // Do NOT update any user fields
        await db.collection("auditLogs").add({
          uid,
          email: userData.email,
          action: "blocked_login",
          reason: !deviceMatch && !ipMatch
            ? "device_and_ip_mismatch"
            : !deviceMatch
              ? "device_mismatch"
              : "ip_mismatch",
          assignedDevice: userData.assignedWebDevice,
          attemptDevice: currentDevice,
          assignedIP: userData.assignedWebIp,
          attemptIP: currentIP,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return errorResponse(
          res,
          "You are not allowed to login from a new device. Please login from your own device or contact your teacher.",
          403,
          { code: "DEVICE_IP_MISMATCH", contactAdmin: true }
        );
      }
    } else {
      // assignedWebDevice or assignedWebIp is empty
      // This means account was created by admin
      // First web login — save device and IP now
      await db.collection("users").doc(uid).update({
        assignedWebDevice: req.clientDevice,
        assignedWebIp: req.clientIP,
        lastKnownWebIp: req.clientIP,
      });
      console.log(
        `[Security] First web login — device and IP saved`
      );
    }
    // ── END CHECK ──────────────────────────────────────────

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

    const fullProfile = {
      ...userData,
      ...roleData,
      uid,
      name: roleData.fullName || userData.email,
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

export { registerUser, loginUser, logoutUser, getMe, setUserRole };
