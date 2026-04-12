import express from "express";
import {
  getVideoStreamUrl,
  streamVideo,
  getLiveSessionVideo,
} from "../controllers/video.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Signed URL for lecture video
router.get("/video/:lectureId/stream-url", verifyToken, getVideoStreamUrl);

// Stream lecture video with Range support
router.get("/video/:lectureId/stream", verifyToken, streamVideo);

// Live session recording
router.get("/sessions/:sessionId/recording", verifyToken, getLiveSessionVideo);

export default router;
