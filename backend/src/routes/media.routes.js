import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { streamProtectedMedia } from "../controllers/media.controller.js";

const router = Router();

// Streams quiz/test question images via backend auth (works even when Storage token URLs are blocked).
router.get("/media/image", verifyToken, streamProtectedMedia);

export default router;

