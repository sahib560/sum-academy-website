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

const registerWithEmail = async ({
  fullName,
  email,
  password,
  phoneNumber,
  fatherName,
  fatherPhone,
  fatherOccupation,
  address,
  district,
  domicile,
  caste,
}) => {
  const { user } = await createUserWithEmailAndPassword(
    firebaseAuth,
    email,
    password
  );

  await updateProfile(user, { displayName: fullName });
  const idToken = await user.getIdToken();
  const response = await api.post(
    "/auth/register",
    {
      uid: user.uid,
      email,
      fullName,
      phoneNumber,
      fatherName,
      fatherPhone,
      fatherOccupation,
      address,
      district,
      domicile,
      caste,
    },
    {
      headers: { Authorization: "Bearer " + idToken },
    }
  );

  return response.data?.user || response.data?.data || response.data;
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
    { token },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return (
    response.data?.user ||
    response.data?.data?.user ||
    response.data?.data ||
    response.data
  );
};

const loginWithGoogle = async () => {
  try {
    console.log("Step 1: Opening Google popup...");

    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const user = result.user;

    console.log("Step 2: Google sign in success:", user.email);

    const idToken = await user.getIdToken();

    console.log("Step 3: Calling backend register (new user)...");

    try {
      await api.post(
        "/auth/register",
        {
          uid: user.uid,
          email: user.email,
          fullName: user.displayName || user.email.split("@")[0],
          phoneNumber: "",
          fatherName: "",
          fatherPhone: "",
          fatherOccupation: "",
          address: "",
          district: "",
          domicile: "",
          caste: "",
        },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      console.log("Step 4: New user registered");
    } catch (regError) {
      if (regError.response?.status !== 409) {
        throw regError;
      }
      console.log("Step 4: Existing user - skipping register");
    }

    console.log("Step 5: Calling backend login...");

    const loginResponse = await api.post(
      "/auth/login",
      { token: idToken },
      { headers: { Authorization: `Bearer ${idToken}` } }
    );

    console.log("Step 6: Login complete:", loginResponse.data);

    return (
      loginResponse.data?.data?.user ||
      loginResponse.data?.user ||
      loginResponse.data
    );
  } catch (error) {
    console.error("Google login error:", error);
    if (error.code === "auth/popup-closed-by-user") {
      return null;
    }
    throw error;
  }
};

const logout = async () => {
  const user = firebaseAuth.currentUser;

  if (user) {
    const token = await user.getIdToken();
    await api.post(
      "/auth/logout",
      { token },
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
