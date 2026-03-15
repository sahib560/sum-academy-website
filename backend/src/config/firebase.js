import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(
    path.join(__dirname, "../../serviceAccountKey.json"),
    "utf-8"
  )
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Storage skipped for now — will add later
  });
}

const db   = admin.firestore();
const auth = admin.auth();

export { admin, db, auth };