import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import dotenv from "dotenv";
import { db, bucket } from "./src/config/firebase.js";

dotenv.config();

const reqEnvs = [
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ACCOUNT_ID",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
];

for (const env of reqEnvs) {
  if (!process.env[env]) {
    console.error(`Error: Missing required environment variable: ${env}`);
    process.exit(1);
  }
}

const accountId = process.env.R2_ACCOUNT_ID;
const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

const s3Client = new S3Client({
  region: "auto",
  endpoint: r2Endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const bucketName = process.env.R2_BUCKET_NAME;
const publicUrl = process.env.R2_PUBLIC_URL.endsWith("/")
  ? process.env.R2_PUBLIC_URL.slice(0, -1)
  : process.env.R2_PUBLIC_URL;

const urlMap = {};
const LOG_FILE = "migration_log.json";

let migratedFiles = [];
if (fs.existsSync(LOG_FILE)) {
  try {
    migratedFiles = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
  } catch (e) {
    console.warn("Could not parse migration_log.json, starting fresh.");
  }
}

const saveLog = () => {
  fs.writeFileSync(LOG_FILE, JSON.stringify(migratedFiles, null, 2));
};

const addToUrlMap = (fileName) => {
  const newUrl = `${publicUrl}/${fileName}`;
  const googleApiUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  const firebaseDownloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    fileName
  )}`;
  urlMap[googleApiUrl] = newUrl;
  urlMap[firebaseDownloadUrl] = newUrl;
};

// Summary counters
let alreadyMigratedCount = 0;
let newlyMigratedCount = 0;
let failedCount = 0;
let remainingCount = 0;

async function migrateFiles() {
  console.log("Fetching files from Firebase Storage...");
  const [files] = await bucket.getFiles();
  const validFiles = files.filter((f) => !f.name.endsWith("/"));
  console.log(`Found ${validFiles.length} files to process.`);

  remainingCount = validFiles.length;

  for (const file of validFiles) {
    // 1. Check local log
    if (migratedFiles.includes(file.name)) {
      console.log(`Already migrated (in log): ${file.name}`);
      alreadyMigratedCount++;
      remainingCount--;
      addToUrlMap(file.name);
      continue;
    }

    // 2. Check R2 directly using HeadObjectCommand
    try {
      await s3Client.send(
        new HeadObjectCommand({ Bucket: bucketName, Key: file.name })
      );
      console.log(`Already migrated (found in R2): ${file.name}`);
      migratedFiles.push(file.name);
      saveLog();
      alreadyMigratedCount++;
      remainingCount--;
      addToUrlMap(file.name);
      continue;
    } catch (err) {
      if (err.name !== "NotFound") {
        console.error(` -> Error checking R2 for ${file.name}:`, err.message);
      }
    }

    // 3. Migrate
    console.log(`Migrating: ${file.name}`);
    try {
      const [fileBuffer] = await file.download();
      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType || "application/octet-stream";

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: file.name,
          Body: fileBuffer,
          ContentType: contentType,
        })
      );

      const newUrl = `${publicUrl}/${file.name}`;
      console.log(` -> Uploaded to R2: ${newUrl}`);

      migratedFiles.push(file.name);
      saveLog();
      addToUrlMap(file.name);

      newlyMigratedCount++;
      remainingCount--;
    } catch (error) {
      console.error(` -> Error migrating ${file.name}:`, error.message);
      failedCount++;
      remainingCount--;
    }
  }

  console.log("\n--- File Migration Summary ---");
  console.log(`Already Migrated: ${alreadyMigratedCount}`);
  console.log(`Newly Migrated:   ${newlyMigratedCount}`);
  console.log(`Failed:           ${failedCount}`);
  console.log(`Remaining:        ${remainingCount}`);
  console.log("------------------------------");
}

async function updateFirestore() {
  console.log("\nStarting Firestore update...");
  const collections = await db.listCollections();

  for (const collection of collections) {
    await processCollection(collection);
  }
  console.log("Firestore update complete.");
}

async function processCollection(collectionRef) {
  const snapshot = await collectionRef.get();
  for (const doc of snapshot.docs) {
    await processDocument(doc.ref, doc.data());
  }
}

async function processDocument(docRef, data) {
  if (!data) return;

  // Fast pre-check: skip document entirely if it already contains the R2 public URL
  if (JSON.stringify(data).includes(publicUrl)) {
    console.log(`Skipping document (already contains R2 URL): ${docRef.path}`);

    // We still need to recurse into subcollections even if we skip this document!
    const subcollections = await docRef.listCollections();
    for (const sub of subcollections) {
      await processCollection(sub);
    }
    return;
  }

  let needsUpdate = false;

  const replaceUrls = (obj) => {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === "string") {
      if (
        obj.includes("storage.googleapis.com") ||
        obj.includes("firebasestorage.googleapis.com")
      ) {
        for (const [oldBase, newUrl] of Object.entries(urlMap)) {
          if (obj.startsWith(oldBase)) {
            needsUpdate = true;
            return newUrl;
          }
        }
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => replaceUrls(item));
    }

    if (typeof obj === "object") {
      if (
        typeof obj.toDate === "function" ||
        typeof obj.latitude === "number"
      ) {
        return obj;
      }

      const newObj = {};
      for (const [key, value] of Object.entries(obj)) {
        newObj[key] = replaceUrls(value);
      }
      return newObj;
    }

    return obj;
  };

  const newData = replaceUrls(data);

  if (needsUpdate) {
    console.log(`Updating document: ${docRef.path}`);
    try {
      await docRef.set(newData);
    } catch (error) {
      console.error(` -> Error updating ${docRef.path}:`, error.message);
    }
  }

  const subcollections = await docRef.listCollections();
  for (const sub of subcollections) {
    await processCollection(sub);
  }
}

async function main() {
  console.log("Starting Migration to R2...");
  await migrateFiles();
  await updateFirestore();
  console.log("\nMigration finished successfully.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed with error:", error);
  process.exit(1);
});
