import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBJoTsnUD76KvoQpp_Yed2whlq4h1X6ZfQ",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sum-academy-lms.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || "sum-academy-lms",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sum-academy-lms.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "459097675748",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || "1:459097675748:web:646340823f0ea5473719f1",
};

const app            = initializeApp(firebaseConfig);
const firebaseAuth   = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const storage        = getStorage(app);

export { app, firebaseAuth, googleProvider, storage };
