import express      from "express";
import cors         from "cors";
import helmet       from "helmet";
import morgan       from "morgan";
import cookieParser from "cookie-parser";
import rateLimit    from "express-rate-limit";
import dotenv       from "dotenv";
import { fileURLToPath } from "url";
import path         from "path";
import { db }       from "./config/firebase.js";
import { COLLECTIONS } from "./config/collections.js";
import authRoutes   from "./routes/auth.routes.js";
import adminRoutes  from "./routes/admin.routes.js";
import classesPublicRoutes from "./routes/classes.routes.js";
import paymentRoutes, { adminPaymentRoutes } from "./routes/payment.routes.js";
import certificateRoutes, { publicCertRoutes } from "./routes/certificate.routes.js";
import adminAnnouncementRoutes, {
  userAnnouncementsRoutes,
} from "./routes/announcement.routes.js";
import settingsRoutes, { publicSettingsRoutes } from "./routes/settings.routes.js";
import teacherRoutes  from "./routes/teacher.routes.js";
import studentRoutes  from "./routes/student.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import progressRoutes from "./routes/progress.routes.js";
import { verifyToken } from "./middlewares/auth.middleware.js";
import { validatePromoCode } from "./controllers/admin.controller.js";
import { exploreCourses }    from "./controllers/student.controller.js";
import { submitPublicContactMessage } from "./controllers/support.controller.js";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

// â”€â”€ ES6 __dirname fix â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 5000;
// â”€â”€ Trust Proxy (required for Hostinger) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.set('trust proxy', 1);

// â”€â”€ Allowed origins (Web + Android app) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const allowedOrigins = [
  "https://sumacademy.net",
  "https://www.sumacademy.net",
  "http://localhost:5173",
  "http://localhost:3000",
  // Android app uses null origin or custom scheme
  "null",
];

// â”€â”€ Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(helmet({
  contentSecurityPolicy: false, // needed for React frontend
}));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Android app, Postman, mobile)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials:    true,
  methods:        ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-device-fingerprint",
    "x-screen-resolution",
    "x-platform",
  ],
}));

// Handle preflight requests for all routes
app.options("/{*path}", cors());

// â”€â”€ Rate Limiting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      500,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: "Too many requests. Please wait a moment."
  },
  skip: (req) => {
    // Skip rate limit for admin and teacher roles
    // They make many calls on dashboard load
    const auth = req.headers.authorization;
    return false;
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: "Too many login attempts. Try again in 15 minutes."
  }
});

const dashboardLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max:      120,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: "Too many requests. Please refresh in a moment."
  }
});

app.use((req, res, next) => {
  res.setHeader("X-RateLimit-Policy", "dashboard-friendly");
  next();
});

// Auth routes — strict
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Dashboard routes — very generous
app.use("/api/admin", dashboardLimiter);
app.use("/api/teacher", dashboardLimiter);
app.use("/api/student", dashboardLimiter);
app.use("/api/announcements", dashboardLimiter);

// Everything else — general
app.use("/api", generalLimiter);

// â”€â”€ Body Parsing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// â”€â”€ Logger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// â”€â”€ API Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use("/api/auth",     authRoutes);
app.use("/api/admin",    adminRoutes);
app.use("/api/admin",    certificateRoutes);
app.use("/api/admin",    adminAnnouncementRoutes);
app.use("/api/admin",    settingsRoutes);
app.use("/api/teacher",  teacherRoutes);
app.use("/api",          progressRoutes);
app.use("/api/student",  studentRoutes);
app.use("/api",          publicSettingsRoutes);
app.use("/api",          uploadRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin",    adminPaymentRoutes);
app.use("/api/classes",  classesPublicRoutes);
app.get("/api/courses/explore", exploreCourses);
app.post("/api/contact/messages", submitPublicContactMessage);
app.use("/api",          publicCertRoutes);
app.use("/api",          userAnnouncementsRoutes);
app.post("/api/promo-codes/validate", verifyToken, validatePromoCode);

// â”€â”€ Health Check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/health", (req, res) => {
  res.json({
    status:    "ok",
    message:   "SUM Academy API healthy",
    timestamp: new Date().toISOString(),
  });
});

// â”€â”€ Firebase Connection Test â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/test", async (req, res) => {
  try {
    await db.collection("_health").doc("ping").set({
      ping:      "pong",
      timestamp: new Date().toISOString(),
    });
    res.json({
      status:   "ok",
      message:  "SUM Academy API is running",
      firebase: "connected âœ…",
    });
  } catch (error) {
    res.status(500).json({
      status:  "error",
      message: "Firebase connection failed âŒ",
      error:   error.message,
    });
  }
});

// â”€â”€ Serve React Frontend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const frontendDist = path.join(__dirname, "../frontend-dist");
app.use(express.static(frontendDist));
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

// â”€â”€ Global Error Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((err, req, res, next) => {
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

const startClassStatusCron = () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const run = async () => {
    try {
      const updated = await syncClassStatusLifecycle();
      console.log(`[cron] class status lifecycle synced. updated=${updated}`);
    } catch (error) {
      console.error("[cron] class status lifecycle failed:", error?.message || error);
    }
  };
  run();
  setInterval(run, DAY_MS);
};

// â”€â”€ Start Server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.listen(PORT, () => {
  console.log(`âœ… SUM Academy API running on port ${PORT}`);
  console.log(`ðŸŒ Domain: https://sumacademy.net`);
  console.log(`ðŸ”§ Environment: ${process.env.NODE_ENV}`);
});

startClassStatusCron();


console.log("ðŸš€ Starting server...");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID ? "âœ…" : "âŒ");
console.log("FIREBASE_PRIVATE_KEY:", process.env.FIREBASE_PRIVATE_KEY ? "âœ…" : "âŒ");



