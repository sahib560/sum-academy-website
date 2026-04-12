import admin from "firebase-admin";
import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const normalizeBucketName = (value = "", projectId = "") => {
  let normalized = String(value || "")
    .trim()
    .replace(/^gs:\/\//i, "")
    .replace(/\/+$/, "");

  if (!normalized) return "";

  // Handle full Firebase Storage URLs
  const urlMatch = normalized.match(/\/b\/([^/]+)/i);
  if (urlMatch?.[1]) {
    normalized = urlMatch[1];
  }

  // Some hosts mistakenly set FIREBASE_STORAGE_BUCKET to firebasestorage.app domain
  if (normalized.toLowerCase().includes("firebasestorage.app")) {
    const safeProject = String(projectId || "")
      .trim()
      .toLowerCase();
    if (safeProject) {
      normalized = `${safeProject}.appspot.com`;
    }
  }

  return normalized.toLowerCase();
};

const loadServiceAccount = () => {
  // Priority 1: Base64 env var (hosting friendly)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const decoded = Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
        "base64"
      ).toString("utf8");
      const parsed = JSON.parse(decoded);
      return Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [
          k.trim(),
          typeof v === "string" ? v.trim() : v,
        ])
      );
    } catch (err) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:", err.message);
    }
  }

  // Priority 2: Individual env vars
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    privateKey
  ) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID.trim(),
      private_key: privateKey.trim(),
      client_email: process.env.FIREBASE_CLIENT_EMAIL.trim(),
    };
  }

  // Priority 3: Local JSON (fallback)
  const serviceAccountPath = path.join(__dirname, "../../serviceAccountKey.json");
  if (existsSync(serviceAccountPath)) {
    const raw = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
    return Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [
        k.trim(),
        typeof v === "string" ? v.trim() : v,
      ])
    );
  }

  throw new Error(
    "Firebase credentials missing. Provide FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_* env vars or serviceAccountKey.json."
  );
};

const serviceAccount = loadServiceAccount();
const bucketName =
  normalizeBucketName(process.env.FIREBASE_STORAGE_BUCKET, serviceAccount.project_id) ||
  normalizeBucketName(`${serviceAccount.project_id}.appspot.com`, serviceAccount.project_id);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: bucketName,
  });
}

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket(bucketName);

export { admin, db, auth, bucket };
