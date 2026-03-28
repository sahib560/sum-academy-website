import admin from "firebase-admin";

// Decode base64 service account
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential:    admin.credential.cert(serviceAccount),
    projectId:     serviceAccount.project_id,
    storageBucket: `${serviceAccount.project_id}.appspot.com`,
  });
}

const db     = admin.firestore();
const auth   = admin.auth();
const bucket = admin.storage().bucket();

export { admin, db, auth, bucket };