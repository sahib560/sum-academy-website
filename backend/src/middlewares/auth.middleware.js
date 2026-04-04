import { admin, db } from "../config/firebase.js";

const normalizeRole = (role) => {
  if (typeof role !== "string") return null;
  const value = role.trim().toLowerCase();
  return value || null;
};

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme === "Bearer" && token) return token;
  if (req.body?.token) return req.body.token;
  if (req.query?.token) return req.query.token;
  return null;
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

const verifyFirebaseToken = async (req, res, next) => {
  const token = getTokenFromHeader(req);
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const normalizedRole = normalizeRole(decoded.role);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      role: normalizedRole,
    };
    return next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};

const verifyToken = async (req, res, next) => {
  const token = getTokenFromHeader(req);

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }

  try {
    const userRef = db.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res
        .status(401)
        .json({ success: false, message: "User profile not found" });
    }

    const user = userSnap.data() || {};
    const userRole = normalizeRole(user?.role);
    const tokenRole = normalizeRole(decoded?.role);
    const resolvedRole = userRole || tokenRole || null;
    if (!resolvedRole) {
      return res
        .status(403)
        .json({ success: false, message: "Access role missing for this account" });
    }

    if (userRole !== resolvedRole) {
      await userRef.set(
        {
          role: resolvedRole,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (user.isActive === false) {
      return res
        .status(403)
        .json({ success: false, message: "Account deactivated" });
    }

    if (
      resolvedRole === "student" &&
      String(user.status || "").toLowerCase() === "pending_approval"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your account is pending admin approval. Please wait for activation.",
        code: "PENDING_APPROVAL",
      });
    }

    if (resolvedRole === "student") {
      const studentSnap = await db.collection("students").doc(decoded.uid).get();
      if (studentSnap.exists) {
        const studentData = studentSnap.data() || {};
        const approvalStatus = String(studentData.approvalStatus || "")
          .trim()
          .toLowerCase();
        if (approvalStatus && approvalStatus !== "approved") {
          return res.status(403).json({
            success: false,
            message:
              "Your account is pending admin approval. Please wait for activation.",
            code: "PENDING_APPROVAL",
          });
        }
      }
    }

    req.user = {
      uid: user.uid || decoded.uid,
      email: user.email || decoded.email || null,
      role: resolvedRole,
      isActive: user.isActive,
      status: user.status || null,
    };

    return next();
  } catch (error) {
    if (isFirebaseCredentialError(error)) {
      return res.status(500).json({
        success: false,
        message:
          "Server Firebase credentials are invalid. Please contact admin.",
        code: "FIREBASE_CREDENTIALS_ERROR",
      });
    }

    console.error("verifyToken DB error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to verify user profile" });
  }
};

const requireRole =
  (...roles) =>
  (req, res, next) => {
    const role = normalizeRole(req.user?.role);
    const allowedRoles = roles.map((entry) => normalizeRole(entry)).filter(Boolean);

    if (!role || !allowedRoles.includes(role)) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Access denied",
          code: "ACCESS_DENIED",
          requiredRoles: allowedRoles,
          actualRole: role,
        });
    }
    return next();
  };

const detectDevice = (req, res, next) => {
  const forwarded = req.headers["x-forwarded-for"];
  const realIP = forwarded
    ? forwarded.split(",")[0].trim()
    : req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      "unknown";

  const cleanIP =
    realIP === "::1"
      ? "127.0.0.1"
      : realIP.startsWith("::ffff:")
        ? realIP.replace("::ffff:", "")
        : realIP;

  const userAgent = req.headers["user-agent"] || "unknown";
  const deviceFingerprint = req.headers["x-device-fingerprint"] || "";
  const screenRes = req.headers["x-screen-resolution"] || "";
  const platform = req.headers["x-platform"] || "";

  let browser = "Unknown";
  if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent))
    browser = "Chrome";
  else if (/firefox/i.test(userAgent)) browser = "Firefox";
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent))
    browser = "Safari";
  else if (/edg/i.test(userAgent)) browser = "Edge";
  else if (/opera|opr/i.test(userAgent)) browser = "Opera";

  let os = "Unknown";
  if (/windows/i.test(userAgent)) os = "Windows";
  else if (/macintosh|mac os/i.test(userAgent)) os = "MacOS";
  else if (/linux/i.test(userAgent)) os = "Linux";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/iphone|ipad/i.test(userAgent)) os = "iOS";

  const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
  const deviceString = `${browser} on ${os}`;

  const uniqueDeviceId = deviceFingerprint
    ? deviceFingerprint
    : `${browser}-${os}-${screenRes}-${platform}`
        .replace(/\s+/g, "-")
        .toLowerCase();

  req.clientIP = cleanIP;
  req.clientDevice = deviceString;
  req.uniqueDeviceId = uniqueDeviceId;
  req.deviceType = isMobile ? "mobile" : "web";
  req.rawUserAgent = userAgent;

  console.log(
    `[Device] IP: ${cleanIP} | Device: ${deviceString} | ` +
      `UniqueID: ${String(uniqueDeviceId).substring(0, 30)}... | ` +
      `Type: ${req.deviceType}`
  );

  next();
};

export { verifyToken, verifyFirebaseToken, requireRole, detectDevice };
