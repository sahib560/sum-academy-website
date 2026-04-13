import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import NodeCache from "node-cache";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { admin, db } from "./config/firebase.js";
import { COLLECTIONS } from "./config/collections.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import classesPublicRoutes from "./routes/classes.routes.js";
import paymentRoutes, { adminPaymentRoutes } from "./routes/payment.routes.js";
import certificateRoutes, { publicCertRoutes } from "./routes/certificate.routes.js";
import adminAnnouncementRoutes, {
  userAnnouncementsRoutes,
} from "./routes/announcement.routes.js";
import settingsRoutes, { publicSettingsRoutes } from "./routes/settings.routes.js";
import teacherRoutes from "./routes/teacher.routes.js";
import studentRoutes from "./routes/student.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import progressRoutes from "./routes/progress.routes.js";
import videoRoutes from "./routes/video.routes.js";
import { verifyToken } from "./middlewares/auth.middleware.js";
import { validatePromoCode } from "./controllers/admin.controller.js";
import { exploreCourses, getPublicTeachers } from "./controllers/student.controller.js";
import { submitPublicContactMessage } from "./controllers/support.controller.js";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.disable("etag");
app.set("trust proxy", 1);

// const allowedOrigins = new Set([
//   "https://sumacademy.net",
//   "https://www.sumacademy.net",
//   "http://localhost:5173",
//   "http://localhost:3000",
//   "http://localhost",
//   "https://localhost",
//   "capacitor://localhost",
//   "ionic://localhost",
//   "null",
// ]);
// / ✅ UPDATE LINES 33-40 to this:
const allowedOrigins = new Set([
  "https://sumacademy.net",
  "https://www.sumacademy.net",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
  "ionic://localhost",
  "null",
  // 👇 ADD THESE LINES:
  "https://cornflowerblue-wren-894067.hostingersite.com",
  "https://*.hostingersite.com", // wildcard for other Hostinger previews
]);

// const allowedOriginPatterns = [
//   /^https?:\/\/([a-z0-9-]+\.)*sumacademy\.net(?::\d+)?$/i,
//   /^https?:\/\/localhost(?::\d+)?$/i,
//   /^capacitor:\/\/localhost$/i,
//   /^ionic:\/\/localhost$/i,
//   /^file:\/\//i,
// ];

// ✅ UPDATE LINES 42-47 to this:
const allowedOriginPatterns = [
  /^https?:\/\/([a-z0-9-]+\.)*sumacademy\.net(?::\d+)?$/i,
  /^https?:\/\/localhost(?::\d+)?$/i,
  /^capacitor:\/\/localhost$/i,
  /^ionic:\/\/localhost$/i,
  /^file:\/\//i,
  // 👇 ADD THIS LINE for Hostinger:
  /^https?:\/\/[a-z0-9-]+\.hostingersite\.com(?::\d+)?$/i,
];

const normalizeOrigin = (origin = "") => String(origin || "").trim().replace(/\/+$/, "");

const isAllowedOrigin = (origin = "") => {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return true;
  if (allowedOrigins.has(normalized)) return true;
  return allowedOriginPatterns.some((pattern) => pattern.test(normalized));
};

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) return callback(null, true);
    console.warn("[CORS] Blocked origin:", origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-device-fingerprint",
    "x-screen-resolution",
    "x-platform",
  ],
};

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors(corsOptions));
app.options("/{*path}", cors(corsOptions));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// Increase timeout for large streaming routes
app.use((req, res, next) => {
  if (String(req.path || "").includes("/stream")) {
    req.setTimeout(0);
    res.setTimeout(0);
  }
  next();
});

// Streaming-specific socket tuning
app.use("/api/video", (req, res, next) => {
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);
  res.setHeader("Transfer-Encoding", "chunked");
  next();
});

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

export const responseCache = new NodeCache({
  stdTTL: 30,
  checkperiod: 60,
  maxKeys: 5000,
});

const getUidFromAuthHeader = (req) => {
  const header = String(req.headers?.authorization || "");
  if (!header.startsWith("Bearer ")) return "";
  const token = header.slice(7).trim();
  const parts = token.split(".");
  if (parts.length < 2) return "";
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return String(payload.user_id || payload.uid || payload.sub || "").trim();
  } catch {
    return "";
  }
};

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return String(req.ip || "unknown").trim();
};

const keyGenerator = (req) => {
  const uid = req.user?.uid || getUidFromAuthHeader(req);
  if (uid) return `uid:${uid}`;
  return `ip:${getClientIp(req)}`;
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many attempts. Try again in 15 minutes.",
      retryAfter: Math.ceil(15 * 60),
    });
  },
  skip: () => false,
});

const studentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests. Please wait a moment.",
      retryAfter: 60,
    });
  },
});

const dashboardLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Dashboard refresh limit reached. Auto-retrying...",
      retryAfter: 30,
    });
  },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Upload limit reached. Wait 1 minute before uploading again.",
      retryAfter: 60,
    });
  },
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Payment request limit reached. Try again in 15 minutes.",
      retryAfter: 900,
    });
  },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Request limit reached. Please wait.",
      retryAfter: 900,
    });
  },
});

app.use((req, res, next) => {
  res.setHeader("X-RateLimit-Policy", "dashboard-friendly");
  next();
});

app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const keys = responseCache.keys();
    const pathPrefix = String(req.path || "").split("/")[2] || "";
    keys.forEach((key) => {
      if (pathPrefix && key.includes(pathPrefix)) {
        responseCache.del(key);
      }
    });
  }
  next();
});

app.use((req, res, next) => {
  if (req.method !== "GET") return next();

  const uidKey = req.user?.uid || getUidFromAuthHeader(req) || "public";
  const cacheKey = `${uidKey}:${req.path}:${JSON.stringify(req.query || {})}`;
  const cached = responseCache.get(cacheKey);
  if (cached) return res.json(cached);

  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (res.statusCode === 200 && data?.success) {
      let ttl = 30;
      if (req.path.includes("/settings")) ttl = 300;
      if (req.path.includes("/courses")) ttl = 60;
      if (req.path.includes("/dashboard")) ttl = 30;
      if (req.path.includes("/announcements")) ttl = 60;
      if (req.path.includes("/certificates")) ttl = 120;

      if (
        !req.path.includes("/progress") &&
        !req.path.includes("/quiz") &&
        !req.path.includes("/payments") &&
        !req.path.includes("/auth")
      ) {
        responseCache.set(cacheKey, data, ttl);
      }
    }
    return originalJson(data);
  };

  next();
});

app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);

app.use("/api/payments/initiate", paymentLimiter);
app.use("/api/payments", paymentLimiter);

app.use("/api/upload", uploadLimiter);
app.use("/api/admin", dashboardLimiter);
app.use("/api/teacher", dashboardLimiter);
app.use("/api/student", studentLimiter);
app.use("/api", generalLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", certificateRoutes);
app.use("/api/admin", adminAnnouncementRoutes);
app.use("/api/admin", settingsRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api", progressRoutes);
app.use("/api/student", studentRoutes);
app.use("/api", publicSettingsRoutes);
app.use("/api", uploadRoutes);
app.use("/api", videoRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminPaymentRoutes);
app.use("/api/classes", classesPublicRoutes);
app.get("/api/courses/explore", exploreCourses);
app.get("/api/teachers/public", getPublicTeachers);
app.post("/api/contact/messages", submitPublicContactMessage);
app.use("/api", publicCertRoutes);
app.use("/api", userAnnouncementsRoutes);
app.post("/api/promo-codes/validate", verifyToken, validatePromoCode);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "SUM Academy API healthy",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/test", async (_req, res) => {
  try {
    await db.collection("_health").doc("ping").set({
      ping: "pong",
      timestamp: new Date().toISOString(),
    });
    res.json({
      status: "ok",
      message: "SUM Academy API is running",
      firebase: "connected",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Firebase connection failed",
      error: error.message,
    });
  }
});

app.get("/download/app", (req, res) => {
  const apkPath = path.join(__dirname, "../Sum Academy LMS.apk");
  res.download(apkPath, "SUM_Academy.apk", (err) => {
    if (!err) return;
    console.error("APK download error:", err);
    if (!res.headersSent) {
      res.status(404).json({
        success: false,
        message: "APK file not found",
      });
    }
  });
});

const frontendDist = path.join(__dirname, "../frontend-dist");
app.use(
  express.static(frontendDist, {
    setHeaders: (res, filePath) => {
      // Prevent stale index.html across browsers/CDN
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      } else {
        // Cache static assets aggressively (hashed filenames)
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  })
);
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

const parseClassDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toClassDay = (value) => {
  const parsed = parseClassDate(value);
  if (!parsed) return null;
  const copy = new Date(parsed);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const syncClassStatusLifecycle = async () => {
  const classesSnap = await db.collection(COLLECTIONS.CLASSES).get();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const batch = db.batch();
  let updateCount = 0;

  classesSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const start = toClassDay(data.startDate);
    const end = toClassDay(data.endDate);
    const capacity = Math.max(1, Number(data.capacity || 30));
    const enrolledCount = Math.max(
      Number(data.enrolledCount || 0),
      Array.isArray(data.students) ? data.students.length : 0
    );
    const isFull = enrolledCount >= capacity;

    let status = "active";
    if (end && today.getTime() > end.getTime()) status = "expired";
    else if (start && today.getTime() < start.getTime()) status = "upcoming";
    else if (isFull) status = "full";

    if (String(data.status || "").toLowerCase() !== status) {
      batch.set(
        doc.ref,
        {
          status,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      updateCount += 1;
    }
  });

  if (updateCount > 0) {
    await batch.commit();
  }

  return updateCount;
};

const syncSessionLifecycle = async () => {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const sessionsSnap = await db
    .collection(COLLECTIONS.SESSIONS)
    .where("date", "==", today)
    .where("status", "not-in", ["completed", "cancelled"])
    .get();

  const batch = db.batch();
  let updates = 0;

  sessionsSnap.docs.forEach((doc) => {
    const row = doc.data() || {};
    const [sh, sm] = String(row.startTime || "").split(":").map(Number);
    const [eh, em] = String(row.endTime || "").split(":").map(Number);
    if (![sh, sm, eh, em].every(Number.isFinite)) return;

    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    if (nowMinutes >= endMinutes) {
      batch.set(
        doc.ref,
        {
          status: "completed",
          sessionLocked: true,
          isLocked: true,
          autoEnded: true,
          autoEndedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      updates += 1;
      return;
    }

    if (nowMinutes >= startMinutes) {
      batch.set(
        doc.ref,
        {
          status: "active",
          sessionStartedAt: row.sessionStartedAt || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      updates += 1;
    }
  });

  if (updates > 0) {
    await batch.commit();
  }

  return updates;
};

const startLifecycleJobs = () => {
  const dailyMs = 24 * 60 * 60 * 1000;
  const fiveMinutesMs = 5 * 60 * 1000;

  const runClassSync = async () => {
    try {
      const updated = await syncClassStatusLifecycle();
      console.log(`[cron] class status lifecycle synced. updated=${updated}`);
    } catch (error) {
      console.error("[cron] class status lifecycle failed:", error?.message || error);
    }
  };

  const runSessionSync = async () => {
    try {
      const updated = await syncSessionLifecycle();
      if (updated > 0) {
        console.log(`[cron] session lifecycle synced. updated=${updated}`);
      }
    } catch (error) {
      console.error("[cron] session lifecycle failed:", error?.message || error);
    }
  };

  runClassSync();
  runSessionSync();
  setInterval(runClassSync, dailyMs);
  setInterval(runSessionSync, fiveMinutesMs);
};

    app.listen(PORT, () => {
    console.log(`SUM Academy API running on port ${PORT}`);
    console.log(`Domain: https://sumacademy.net`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
  
  startLifecycleJobs();
  
  console.log("Starting server...");
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("PORT:", process.env.PORT);
  console.log("FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID ? "ok" : "missing");
  console.log("FIREBASE_PRIVATE_KEY:", process.env.FIREBASE_PRIVATE_KEY ? "ok" : "missing");
