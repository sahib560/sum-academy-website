import { admin, db } from "../config/firebase.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";

const registerUser = async (req, res) => {
  try {
    const {
      uid,
      email,
      fullName,
      phoneNumber = "",
      fatherName = "",
      fatherPhone = "",
      fatherOccupation = "",
      address = "",
      district = "",
      domicile = "",
      caste = "",
    } = req.body || {};

    if (!uid || !email) {
      return errorResponse(res, "uid and email are required", 400);
    }

    const displayName = fullName || email.split("@")[0];

    const existingUser = await db.collection("users").doc(uid).get();
    if (existingUser.exists) {
      return errorResponse(res, "User already registered", 409);
    }

    await admin.auth().setCustomUserClaims(uid, { role: "student" });

    const batch = db.batch();

    const userRef = db.collection("users").doc(uid);
    batch.set(userRef, {
      uid,
      email,
      role: "student",
      isActive: true,
      assignedWebDevice: req.clientDevice || null,
      lastKnownWebIp: req.clientIP || null,
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const studentRef = db.collection("students").doc(uid);
    batch.set(studentRef, {
      uid,
      fullName: displayName,
      phoneNumber,
      fatherName,
      fatherPhone,
      fatherOccupation,
      address,
      district,
      domicile,
      caste,
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

    if (!uid) {
      return errorResponse(res, "Missing user uid", 400);
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return errorResponse(res, "User profile not found", 404);
    }

    const userData = userSnap.data();

    if (!userData.isActive) {
      return errorResponse(
        res,
        "Account has been deactivated. Contact admin.",
        403
      );
    }

    if (!userData.assignedWebDevice && !userData.lastKnownWebIp) {
      await db.collection("users").doc(uid).update({
        assignedWebDevice: req.clientDevice || null,
        lastKnownWebIp: req.clientIP || null,
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log("[Security] First login - device and IP assigned");
    }

    if (userData.lastKnownWebIp) {
      const currentIP = req.clientIP;
      const ipMatch = userData.lastKnownWebIp === currentIP;

      console.log(`[Security Check]`);
      console.log(`  Assigned Device : ${userData.assignedWebDevice}`);
      console.log(`  Current Device  : ${req.clientDevice}`);
      console.log(`  Assigned IP     : ${userData.lastKnownWebIp}`);
      console.log(`  Current IP      : ${currentIP}`);
      console.log(`  IP Match        : ${ipMatch}`);

      if (!ipMatch) {
        await db.collection("auditLogs").add({
          uid,
          email: userData.email,
          action: "blocked_login",
          reason: "ip_mismatch",
          assignedDevice: userData.assignedWebDevice,
          attemptDevice: req.clientDevice,
          assignedIP: userData.lastKnownWebIp,
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
    }

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

    await db.collection("sessions").add({
      uid,
      active: true,
      ip: req.clientIP,
      device: req.clientDevice,
      deviceType: req.deviceType || "web",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await userRef.update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("auditLogs").add({
      uid,
      email: userData.email,
      action: "login_success",
      ip: req.clientIP,
      device: req.clientDevice,
      deviceType: req.deviceType || "web",
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
      name: roleData.fullName || roleData.name || userData.email,
    };

    delete fullProfile.assignedWebDevice;
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
