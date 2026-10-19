import { Router } from "express";
import multer from "multer";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";
import {
  getPublicPdfResources,
  getPublicPdfResourceById,
  previewPublicPdfResource,
  downloadPublicPdfResource,
  getAdminPdfResources,
  getAdminPdfResourceStats,
  getAdminPdfResourceById,
  previewAdminPdfResource,
  createPdfResource,
  updatePdfResource,
  updatePdfResourceStatus,
  deletePdfResource,
} from "../controllers/pdfResource.controller.js";
import { MAX_SIZES } from "../services/storage.service.js";

const publicRouter = Router();
const adminRouter = Router();

// Multer memory storage configured with 50MB PDF limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZES.pdf || 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Basic mimetype check in multer; controller performs deep magic-bytes validation
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files (.pdf) are allowed"));
    }
  },
});

/**
 * -------------------------------------------------------------
 * PUBLIC ROUTES
 * -------------------------------------------------------------
 */
publicRouter.get("/pdf-resources", getPublicPdfResources);
publicRouter.get("/pdf-resources/:id", getPublicPdfResourceById);
publicRouter.get("/pdf-resources/:id/preview", previewPublicPdfResource);
publicRouter.get("/pdf-resources/:id/download", downloadPublicPdfResource);

/**
 * -------------------------------------------------------------
 * ADMIN ROUTES (Protected with verifyToken + requireRole("admin"))
 * -------------------------------------------------------------
 */
const adminOnly = [verifyToken, requireRole("admin")];

adminRouter.use(adminOnly);

adminRouter.get("/pdf-resources", getAdminPdfResources);
adminRouter.get("/pdf-resources/stats", getAdminPdfResourceStats);
adminRouter.get("/pdf-resources/:id", getAdminPdfResourceById);
adminRouter.get("/pdf-resources/:id/preview", previewAdminPdfResource);
adminRouter.post("/pdf-resources", upload.single("file"), createPdfResource);
adminRouter.patch("/pdf-resources/:id", upload.single("file"), updatePdfResource);
adminRouter.patch("/pdf-resources/:id/status", updatePdfResourceStatus);
adminRouter.delete("/pdf-resources/:id", deletePdfResource);

export { publicRouter as publicPdfResourceRoutes, adminRouter as adminPdfResourceRoutes };
export default publicRouter;
