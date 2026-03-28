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
import { verifyToken } from "./middlewares/auth.middleware.js";
import { validatePromoCode } from "./controllers/admin.controller.js";
import { exploreCourses }    from "./controllers/student.controller.js";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

// ── ES6 __dirname fix ──────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Allowed origins (Web + Android app) ───────────────────────
const allowedOrigins = [
  "https://sumacademy.net",
  "https://www.sumacademy.net",
  "http://localhost:5173",
  "http://localhost:3000",
  // Android app uses null origin or custom scheme
  "null",
];

// ── Security ──────────────────────────────────────────────────
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
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Handle preflight requests for all routes
app.options("/{*path}", cors());

// ── Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  message:  { error: "Too many requests. Please try again later." },
});
app.use("/api", limiter);

// ── Body Parsing ──────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Logger ────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ── API Routes ────────────────────────────────────────────────
app.use("/api/auth",     authRoutes);
app.use("/api/admin",    adminRoutes);
app.use("/api/admin",    certificateRoutes);
app.use("/api/admin",    adminAnnouncementRoutes);
app.use("/api/admin",    settingsRoutes);
app.use("/api/teacher",  teacherRoutes);
app.use("/api/student",  studentRoutes);
app.use("/api",          publicSettingsRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin",    adminPaymentRoutes);
app.use("/api/classes",  classesPublicRoutes);
app.get("/api/courses/explore", exploreCourses);
app.use("/api",          publicCertRoutes);
app.use("/api",          userAnnouncementsRoutes);
app.post("/api/promo-codes/validate", verifyToken, validatePromoCode);

// ── Health Check ──────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status:    "ok",
    message:   "SUM Academy API healthy",
    timestamp: new Date().toISOString(),
  });
});

// ── Firebase Connection Test ───────────────────────────────────
app.get("/api/test", async (req, res) => {
  try {
    await db.collection("_health").doc("ping").set({
      ping:      "pong",
      timestamp: new Date().toISOString(),
    });
    res.json({
      status:   "ok",
      message:  "SUM Academy API is running",
      firebase: "connected ✅",
    });
  } catch (error) {
    res.status(500).json({
      status:  "error",
      message: "Firebase connection failed ❌",
      error:   error.message,
    });
  }
});

// ── Serve React Frontend ───────────────────────────────────────
const frontendDist = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

// ── Global Error Handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

// ── Start Server ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ SUM Academy API running on port ${PORT}`);
  console.log(`🌐 Domain: https://sumacademy.net`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
});


console.log("🚀 Starting server...");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID ? "✅" : "❌");
console.log("FIREBASE_PRIVATE_KEY:", process.env.FIREBASE_PRIVATE_KEY ? "✅" : "❌");