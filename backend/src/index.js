 
// import express      from "express";
// import cors         from "cors";
// import helmet       from "helmet";
// import morgan       from "morgan";
// import cookieParser from "cookie-parser";
// import rateLimit    from "express-rate-limit";
// import dotenv       from "dotenv";
// import { db }       from "./config/firebase.js";
// import authRoutes   from "./routes/auth.routes.js";
// import adminRoutes  from "./routes/admin.routes.js";
// import classesPublicRoutes from "./routes/classes.routes.js";
// import paymentRoutes, { adminPaymentRoutes } from "./routes/payment.routes.js";
// import certificateRoutes, { publicCertRoutes } from "./routes/certificate.routes.js";
// import adminAnnouncementRoutes, {
//   userAnnouncementsRoutes,
// } from "./routes/announcement.routes.js";
// import settingsRoutes, { publicSettingsRoutes } from "./routes/settings.routes.js";
// import { verifyToken } from "./middlewares/auth.middleware.js";
// import { validatePromoCode } from "./controllers/admin.controller.js";

// dotenv.config();

// const app  = express();
// const PORT = process.env.PORT || 5000;

// // ── Security ─────────────────────────────────────────────────
// app.use(helmet());
// app.use(cors({
//   origin:        process.env.CLIENT_URL,
//   credentials:   true,
//   methods:       ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// }));

// // ── Rate Limiting ─────────────────────────────────────────────
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max:      100,
//   message:  { error: "Too many requests. Please try again later." },
// });
// app.use("/api", limiter);

// // ── Body Parsing ──────────────────────────────────────────────
// app.use(express.json({ limit: "10mb" }));
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());

// // ── Logger ────────────────────────────────────────────────────
// if (process.env.NODE_ENV === "development") {
//   app.use(morgan("dev"));
// }

// // ── Routes ────────────────────────────────────────────────────
// app.use("/api/auth", authRoutes);
// app.use("/api/admin", adminRoutes);
// app.use("/api/admin", certificateRoutes);
// app.use("/api/admin", adminAnnouncementRoutes);
// app.use("/api/admin", settingsRoutes);
// app.use("/api", publicSettingsRoutes);
// app.use("/api/payments", paymentRoutes);
// app.use("/api/admin", adminPaymentRoutes);
// app.use("/api/classes", classesPublicRoutes);
// app.use("/api", publicCertRoutes);
// app.use("/api", userAnnouncementsRoutes);
// app.post("/api/promo-codes/validate", verifyToken, validatePromoCode);

// app.get("/api/health", (req, res) => {
//   res.json({
//     status: "ok",
//     message: "SUM Academy API healthy",
//     timestamp: new Date().toISOString(),
//   });
// });

// // ── Test Route ────────────────────────────────────────────────
// app.get("/", async (req, res) => {
//   try {
//     await db.collection("_health").doc("ping").set({
//       ping:      "pong",
//       timestamp: new Date().toISOString(),
//     });
//     res.json({
//       status:   "ok",
//       message:  "SUM Academy API is running",
//       firebase: "connected ✅",
//     });
//   } catch (error) {
//     res.status(500).json({
//       status:  "error",
//       message: "Firebase connection failed ❌",
//       error:   error.message,
//     });
//   }
// });

// // ── 404 Handler ───────────────────────────────────────────────
// app.use((req, res) => {
//   res.status(404).json({ error: "Route not found" });
// });


// // ── Global Error Handler ──────────────────────────────────────
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(err.status || 500).json({
//     error: err.message || "Internal Server Error",
//   });
// });

// // ── Start Server ──────────────────────────────────────────────
// app.listen(PORT, () => {
//   console.log(`✅ SUM Academy API running → http://localhost:${PORT}`);
// });
import express      from "express";
import cors         from "cors";
import helmet       from "helmet";
import morgan       from "morgan";
import cookieParser from "cookie-parser";
import rateLimit    from "express-rate-limit";
import dotenv       from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
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
import { verifyToken } from "./middlewares/auth.middleware.js";
import { validatePromoCode } from "./controllers/admin.controller.js";

dotenv.config();

// ── ES6 __dirname fix ─────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security ─────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // needed for React to load properly
}));
app.use(cors({
  origin:         process.env.CLIENT_URL,
  credentials:    true,
  methods:        ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

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
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ── API Routes ────────────────────────────────────────────────
app.use("/api/auth",     authRoutes);
app.use("/api/admin",    adminRoutes);
app.use("/api/admin",    certificateRoutes);
app.use("/api/admin",    adminAnnouncementRoutes);
app.use("/api/admin",    settingsRoutes);
app.use("/api",          publicSettingsRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin",    adminPaymentRoutes);
app.use("/api/classes",  classesPublicRoutes);
app.use("/api",          publicCertRoutes);
app.use("/api",          userAnnouncementsRoutes);
app.post("/api/promo-codes/validate", verifyToken, validatePromoCode);

app.get("/api/health", (req, res) => {
  res.json({
    status:    "ok",
    message:   "SUM Academy API healthy",
    timestamp: new Date().toISOString(),
  });
});

// ── Firebase Test Route ───────────────────────────────────────
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

// ── Serve React Frontend ──────────────────────────────────────
const frontendDist = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));

// Any route not caught by API → serve React app
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

// ── Start Server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ SUM Academy API running → http://localhost:${PORT}`);
});