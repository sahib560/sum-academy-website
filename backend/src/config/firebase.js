import admin from "firebase-admin";
import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const normalizeBucketName = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^gs:\/\//i, "")
    .replace(/\/+$/, "");

const loadServiceAccount = () => {
  const serviceAccountPath = path.join(__dirname, "../../serviceAccountKey.json");
  if (existsSync(serviceAccountPath)) {
    return JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString(
        "utf8"
      )
    );
  }

  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").replace(
    /\\n/g,
    "\n"
  );
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    privateKey
  ) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: privateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };
  }

  throw new Error(
    "Firebase credentials missing. Provide serviceAccountKey.json, FIREBASE_SERVICE_ACCOUNT_BASE64, or FIREBASE_* env vars."
  );
};

const serviceAccount = loadServiceAccount();
const bucketName =
  normalizeBucketName(process.env.FIREBASE_STORAGE_BUCKET) ||
  normalizeBucketName(`${serviceAccount.project_id}.appspot.com`);

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
