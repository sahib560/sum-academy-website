import { Router } from "express";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";
import {
  getCertificates,
  generateCertificate,
  revokeCertificate,
  verifyCertificate,
} from "../controllers/certificate.controller.js";

const adminRouter = Router();
const publicRouter = Router();
const adminOnly = [verifyToken, requireRole("admin")];

adminRouter.get("/certificates", adminOnly, getCertificates);
adminRouter.post("/certificates", adminOnly, generateCertificate);
adminRouter.patch("/certificates/:certId/revoke", adminOnly, revokeCertificate);

publicRouter.get("/verify/:certId", verifyCertificate);

export default adminRouter;
export { publicRouter as publicCertRoutes };
