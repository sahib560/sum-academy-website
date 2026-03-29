import { Router } from "express";
import { requireRole, verifyToken } from "../middlewares/auth.middleware.js";
import {
  getAdminSettings,
  getEmailTemplates,
  getSettings,
  testEmailSettings,
  updateAboutSettings,
  updateAppearance,
  updateCertificateSettings,
  updateContactSettings,
  updateEmailSettings,
  updateEmailTemplate,
  updateFeatures,
  updateFooterSettings,
  updateGeneralSettings,
  updateHeroSettings,
  updateHowItWorks,
  updateMaintenance,
  updatePaymentSettings,
  updateSecuritySettings,
  updateTestimonials,
} from "../controllers/settings.controller.js";

const adminRouter = Router();
const publicRouter = Router();

const adminOnly = [verifyToken, requireRole("admin")];

publicRouter.get("/settings", getSettings);

adminRouter.get("/settings", adminOnly, getAdminSettings);
adminRouter.put("/settings/general", adminOnly, updateGeneralSettings);
adminRouter.put("/settings/hero", adminOnly, updateHeroSettings);
adminRouter.put("/settings/how-it-works", adminOnly, updateHowItWorks);
adminRouter.put("/settings/features", adminOnly, updateFeatures);
adminRouter.put("/settings/testimonials", adminOnly, updateTestimonials);
adminRouter.put("/settings/about", adminOnly, updateAboutSettings);
adminRouter.put("/settings/contact", adminOnly, updateContactSettings);
adminRouter.put("/settings/footer", adminOnly, updateFooterSettings);
adminRouter.put("/settings/appearance", adminOnly, updateAppearance);
adminRouter.put("/settings/certificate", adminOnly, updateCertificateSettings);
adminRouter.put("/settings/maintenance", adminOnly, updateMaintenance);

adminRouter.put("/settings/email", adminOnly, updateEmailSettings);
adminRouter.post("/settings/email/test", adminOnly, testEmailSettings);
adminRouter.put("/settings/payment", adminOnly, updatePaymentSettings);
adminRouter.put("/settings/security", adminOnly, updateSecuritySettings);
adminRouter.get("/settings/templates", adminOnly, getEmailTemplates);
adminRouter.put("/settings/templates", adminOnly, updateEmailTemplate);

export default adminRouter;
export { publicRouter as publicSettingsRoutes };
