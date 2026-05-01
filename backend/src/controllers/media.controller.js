import { bucket } from "../config/firebase.js";
import { errorResponse } from "../utils/response.utils.js";

const trimText = (value = "") => String(value || "").trim();

const ALLOWED_PREFIXES = ["quiz/questions/", "test/questions/"];

export const streamProtectedMedia = async (req, res) => {
  try {
    const path = trimText(req.query?.path);
    if (!path) return errorResponse(res, "path is required", 400);
    if (!ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return errorResponse(res, "Invalid media path", 400);
    }

    const file = bucket.file(path);
    const [exists] = await file.exists();
    if (!exists) return errorResponse(res, "File not found", 404);

    const [metadata] = await file.getMetadata();
    const contentType = metadata?.contentType || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    const stream = file.createReadStream();
    stream.on("error", (err) => {
      console.error("streamProtectedMedia error:", err);
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (e) {
    console.error("streamProtectedMedia error:", e);
    if (!res.headersSent) return errorResponse(res, "Failed to stream media", 500);
  }
};

