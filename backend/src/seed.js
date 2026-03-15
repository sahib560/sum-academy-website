// import admin from "firebase-admin";
// import { readFileSync } from "fs";
// import { fileURLToPath } from "url";
// import path from "path";
// import dotenv from "dotenv";

// dotenv.config();

// const __filename = fileURLToPath(import.meta.url);
// const __dirname  = path.dirname(__filename);

// const serviceAccount = JSON.parse(
//   readFileSync(
//     path.join(__dirname, "../serviceAccountKey.json"),
//     "utf-8"
//   )
// );

// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//   });
// }

// const db   = admin.firestore();
// const auth = admin.auth();

// const users = [
//   {
//     email:       "admin@gmail.com",
//     password:    "Admin123@",
//     name:        "SUM Admin",
//     phone:       "03001234567",
//     role:        "admin",
//     displayName: "SUM Admin",
//   },
//   {
//     email:       "teacher@gmail.com",
//     password:    "Teacher123@",
//     name:        "SUM Teacher",
//     phone:       "03001234568",
//     role:        "teacher",
//     displayName: "SUM Teacher",
//   },
//   {
//     email:       "student@gmail.com",
//     password:    "Student123@",
//     name:        "SUM Student",
//     phone:       "03001234569",
//     role:        "student",
//     displayName: "SUM Student",
//   },
// ];

// const seedUsers = async () => {
//   console.log("🌱 Starting SUM Academy seed...\n");

//   for (const user of users) {
//     try {
//       // ── Step 1: Create in Firebase Auth ──────────────────
//       let firebaseUser;

//       try {
//         // Try to get existing user first
//         firebaseUser = await auth.getUserByEmail(user.email);
//         console.log(`⚠️  Auth user already exists: ${user.email}`);
//       } catch {
//         // Does not exist — create it
//         firebaseUser = await auth.createUser({
//           email:         user.email,
//           password:      user.password,
//           displayName:   user.displayName,
//           emailVerified: true,
//         });
//         console.log(`✅ Auth user created: ${user.email}`);
//       }

//       const uid = firebaseUser.uid;

//       // ── Step 2: Set custom role claim ─────────────────────
//       await auth.setCustomUserClaims(uid, { role: user.role });
//       console.log(`✅ Role set: ${user.role} → ${user.email}`);

//       // ── Step 3: Save profile to Firestore ─────────────────
//       const userRef  = db.collection("users").doc(uid);
//       const userSnap = await userRef.get();

//       if (userSnap.exists) {
//         await userRef.update({
//           role:      user.role,
//           updatedAt: admin.firestore.FieldValue.serverTimestamp(),
//         });
//         console.log(`⚠️  Firestore doc updated: ${user.email}`);
//       } else {
//         await userRef.set({
//           uid,
//           name:             user.name,
//           email:            user.email,
//           phone:            user.phone,
//           role:             user.role,
//           isActive:         true,
//           isVerified:       true,
//           enrolledCourses:  [],
//           certificates:     [],
//           createdAt:        admin.firestore.FieldValue.serverTimestamp(),
//           lastLoginAt:      null,
//           lastKnownIP:      null,
//           lastDevice:       null,
//         });
//         console.log(`✅ Firestore doc created: ${user.email}`);
//       }

//       console.log(`\n👤 ${user.role.toUpperCase()} ready:`);
//       console.log(`   Email:    ${user.email}`);
//       console.log(`   Password: ${user.password}`);
//       console.log(`   UID:      ${uid}\n`);

//     } catch (error) {
//       console.error(`❌ Failed for ${user.email}:`, error.message);
//     }
//   }

//   console.log("✅ Seed completed successfully!");
//   console.log("\n─────────────────────────────────────");
//   console.log("🔑 LOGIN CREDENTIALS:");
//   console.log("─────────────────────────────────────");
//   console.log("ADMIN:");
//   console.log("  Email:    admin@gmail.com");
//   console.log("  Password: Admin123@");
//   console.log("\nTEACHER:");
//   console.log("  Email:    teacher@gmail.com");
//   console.log("  Password: Teacher123@");
//   console.log("\nSTUDENT:");
//   console.log("  Email:    student@gmail.com");
//   console.log("  Password: Student123@");
//   console.log("─────────────────────────────────────\n");

//   process.exit(0);
// };

// seedUsers();