import { errorResponse } from "../utils/response.utils.js";
import { streamFromR2 } from "../services/r2.service.js";

const trimText = (value = "") => String(value || "").trim();

const ALLOWED_PREFIXES = ["quiz/questions/", "test/questions/"];

export const streamProtectedMedia = async (req, res) => {
  try {
    const path = trimText(req.query?.path);
    if (!path) return errorResponse(res, "path is required", 400);
    if (!ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return errorResponse(res, "Invalid media path", 400);
    }

    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    await streamFromR2(path, null, res);
  } catch (e) {
    console.error("streamProtectedMedia error:", e);
    if (!res.headersSent) return errorResponse(res, "Failed to stream media", 500);
  }
};

