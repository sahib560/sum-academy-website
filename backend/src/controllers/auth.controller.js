import { admin, db } from "../config/firebase.js";

const registerUser = async (req, res) => {
  try {
    const { uid, name, email, phone } = req.body || {};

    if (!uid || !name || !email) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const userRef = db.collection("users").doc(uid);
    const existing = await userRef.get();

    if (existing.exists) {
      return res
        .status(409)
        .json({ success: false, message: "User already registered" });
    }

    const userData = {
      uid,
      name,
      email,
      phone: phone || null,
      role: "student",
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: null,
      lastKnownIP: null,
      lastDevice: null,
      enrolledCourses: [],
      certificates: [],
    };

    await userRef.set(userData);
    await admin.auth().setCustomUserClaims(uid, { role: "student" });

    return res.status(201).json({
      success: true,
      message: "Account created",
      user: { uid, name, email, role: "student" },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Server error" });
  }
};

const loginUser = async (req, res) => {
  try {
    const uid = req.user?.uid || req.body?.uid;

    if (!uid) {
      return res
        .status(400)
        .json({ success: false, message: "Missing user uid" });
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res
        .status(404)
        .json({ success: false, message: "User profile not found" });
    }

    const user = userSnap.data();

    if (user.isActive === false) {
      return res
        .status(403)
        .json({ success: false, message: "Account deactivated" });
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

    await db.collection("sessions").add({
      uid,
      active: true,
      ip: req.clientIP || null,
      device: req.clientDevice || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (user.lastKnownIP && user.lastKnownIP !== req.clientIP) {
      await db.collection("auditLogs").add({
        uid,
        email: user.email || null,
        ip: req.clientIP || null,
        device: req.clientDevice || null,
        action: "new_device_login",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await userRef.update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      lastKnownIP: req.clientIP || null,
      lastDevice: req.clientDevice || null,
    });

    return res.status(200).json({
      success: true,
      user: {
        uid,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Server error" });
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
      return res
        .status(400)
        .json({ success: false, message: "Missing user uid" });
    }

    const userSnap = await db.collection("users").doc(uid).get();

    if (!userSnap.exists) {
      return res
        .status(404)
        .json({ success: false, message: "User profile not found" });
    }

    return res.status(200).json({
      success: true,
      user: userSnap.data(),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Server error" });
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
