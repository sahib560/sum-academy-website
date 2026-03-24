import { Router } from "express";
import { requireRole, verifyToken } from "../middlewares/auth.middleware.js";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  getStudentAnnouncements,
  markAllAnnouncementsRead,
  markAnnouncementRead,
  togglePin,
  updateAnnouncement,
} from "../controllers/announcement.controller.js";

const adminRouter = Router();
const userRouter = Router();

const adminOnly = [verifyToken, requireRole("admin")];

adminRouter.get("/announcements", adminOnly, getAnnouncements);
adminRouter.post("/announcements", adminOnly, createAnnouncement);
adminRouter.put("/announcements/:id", adminOnly, updateAnnouncement);
adminRouter.delete("/announcements/:id", adminOnly, deleteAnnouncement);
adminRouter.patch("/announcements/:id/pin", adminOnly, togglePin);

userRouter.get("/announcements/my", verifyToken, getStudentAnnouncements);
userRouter.patch("/announcements/read-all", verifyToken, markAllAnnouncementsRead);
userRouter.patch("/announcements/:id/read", verifyToken, markAnnouncementRead);

export default adminRouter;
export { userRouter as userAnnouncementsRoutes };
