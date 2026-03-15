import { admin } from "../config/firebase.js";

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      role: decoded.role || null,
    };
    return next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};

const requireRole =
  (...roles) =>
  (req, res, next) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied" });
    }
    return next();
  };

const detectDevice = (req, res, next) => {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.ip;
  const device = req.headers["user-agent"] || "unknown";

  req.clientIP = ip;
  req.clientDevice = device;
  return next();
};

export { verifyToken, requireRole, detectDevice };
