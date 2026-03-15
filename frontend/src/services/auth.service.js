import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import api from "../api/axios.js";
import { firebaseAuth, googleProvider } from "../config/firebase.js";

const registerWithEmail = async (name, email, password, phone) => {
  const { user } = await createUserWithEmailAndPassword(
    firebaseAuth,
    email,
    password
  );

  await updateProfile(user, { displayName: name });
  const idToken = await user.getIdToken();
  const response = await api.post(
    "/auth/register",
    { uid: user.uid, name, email, phone },
    {
      headers: { Authorization: "Bearer " + idToken },
    }
  );

  return response.data?.user || response.data;
};

const loginWithEmail = async (email, password) => {
  const { user } = await signInWithEmailAndPassword(
    firebaseAuth,
    email,
    password
  );

  const token = await user.getIdToken();
  const response = await api.post(
    "/auth/login",
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return response.data?.user || response.data;
};

const loginWithGoogle = async () => {
  const { user } = await signInWithPopup(firebaseAuth, googleProvider);
  const token = await user.getIdToken();

  try {
    await api.post(
      "/auth/register",
      {
        uid: user.uid,
        name: user.displayName || "User",
        email: user.email,
        phone: "",
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  } catch (error) {
    if (error?.response?.status !== 409) {
      throw error;
    }
  }

  const response = await api.post(
    "/auth/login",
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return response.data?.user || response.data;
};

const logout = async () => {
  const user = firebaseAuth.currentUser;

  if (user) {
    const token = await user.getIdToken();
    await api.post(
      "/auth/logout",
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  }

  await signOut(firebaseAuth);
  localStorage.clear();
};

const getCurrentUser = () => firebaseAuth.currentUser;

const onAuthStateChange = (callback) => onAuthStateChanged(firebaseAuth, callback);

export {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  logout,
  getCurrentUser,
  onAuthStateChange,
};
