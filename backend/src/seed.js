import { admin, db, auth } from "./config/firebase.js";

const users = [
  {
    email: "admin@gmail.com",
    password: "Admin123@",
    name: "SUM Admin",
    role: "admin",
    phone: "03001234567",
  },
  {
    email: "teacher@gmail.com",
    password: "Teacher123@",
    name: "SUM Teacher",
    role: "teacher",
    phone: "03001234568",
    subject: "Mathematics",
    bio: "Experienced teacher at SUM Academy",
    assignedSubjects: ["Mathematics"],
  },
  {
    email: "student@gmail.com",
    password: "Student123@",
    name: "SUM Student",
    role: "student",
    phone: "03001234569",
  },
];

const seedUsers = async () => {
  console.log("Starting SUM Academy seed...\n");

  for (const user of users) {
    try {
      let firebaseUser;
      try {
        firebaseUser = await auth.getUserByEmail(user.email);
        console.log(`Auth user already exists: ${user.email}`);
      } catch {
        firebaseUser = await auth.createUser({
          email: user.email,
          password: user.password,
          displayName: user.name,
          emailVerified: true,
        });
        console.log(`Auth user created: ${user.email}`);
      }

      const uid = firebaseUser.uid;
      await auth.setCustomUserClaims(uid, { role: user.role });

      const userRef = db.collection("users").doc(uid);
      const userSnap = await userRef.get();
      const baseData = {
        uid,
        email: user.email,
        role: user.role,
        isActive: true,
        assignedWebDevice: "",
        assignedWebIp: "",
        lastKnownWebIp: "",
        lastLoginAt: null,
      };

      if (userSnap.exists) {
        await userRef.set(baseData, { merge: true });
      } else {
        await userRef.set({
          ...baseData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (user.role === "admin") {
        const adminRef = db.collection("admins").doc(uid);
        const adminSnap = await adminRef.get();
        const adminData = { uid, fullName: user.name };
        if (adminSnap.exists) {
          await adminRef.set(adminData, { merge: true });
        } else {
          await adminRef.set({
            ...adminData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      if (user.role === "teacher") {
        const teacherRef = db.collection("teachers").doc(uid);
        const teacherSnap = await teacherRef.get();
        const teacherData = {
          uid,
          fullName: user.name,
          phoneNumber: user.phone || "",
          subject: user.subject || "",
          bio: user.bio || "",
          assignedSubjects: user.assignedSubjects || [],
          profilePicture: null,
          assignedClasses: [],
          assignedCourses: [],
        };
        if (teacherSnap.exists) {
          await teacherRef.set(teacherData, { merge: true });
        } else {
          await teacherRef.set({
            ...teacherData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      if (user.role === "student") {
        const studentRef = db.collection("students").doc(uid);
        const studentSnap = await studentRef.get();
        const studentData = {
          uid,
          fullName: user.name,
          phoneNumber: user.phone || "",
          enrolledCourses: [],
          certificates: [],
        };
        if (studentSnap.exists) {
          await studentRef.set(studentData, { merge: true });
        } else {
          await studentRef.set({
            ...studentData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      console.log(`User ready: ${user.email} (${user.role})`);
    } catch (error) {
      console.error(`Failed for ${user.email}:`, error.message);
    }
  }

  console.log("\nSeed completed successfully.");
  process.exit(0);
};

seedUsers();
