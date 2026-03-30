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

const AUTH_OVERLAY_EVENT = "sumacademy:auth-overlay";

const emitAuthOverlay = (show, message = "", subMessage = "") => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(AUTH_OVERLAY_EVENT, {
      detail: { show, message, subMessage },
    })
  );
};

const registerWithEmail = async (
  fullName,
  email,
  password,
  phoneNumber,
  otpVerificationToken,
  profileData = {}
) => {
  try {
    console.log("Step 1: Creating Firebase user...");
    const result = await createUserWithEmailAndPassword(
      firebaseAuth,
      email,
      password
    );
    const user = result.user;

    console.log("Step 2: Updating profile...");
    await updateProfile(user, { displayName: fullName });

    console.log("Step 3: Getting ID token...");
    const idToken = await user.getIdToken(true);

    console.log("Step 4: Calling backend register...");
    const response = await api.post(
      "/auth/register",
      {
        uid: user.uid,
        email,
        fullName,
        phoneNumber: phoneNumber || "",
        otpVerificationToken: otpVerificationToken || "",
        fatherName: profileData.fatherName || "",
        fatherPhone: profileData.fatherPhone || "",
        fatherOccupation: profileData.fatherOccupation || "",
        address: profileData.address || "",
        district: profileData.district || "",
        domicile: profileData.domicile || "",
        caste: profileData.caste || "",
      },
      { headers: { Authorization: `Bearer ${idToken}` } }
    );

    console.log("Step 5: Done:", response.data);
    return response.data;
  } catch (error) {
    console.error("Register error:", error.response?.data || error.message);
    throw error;
  }
};

const beginGoogleRegistration = async () => {
  try {
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    return result.user;
  } catch (error) {
    if (error.code === "auth/unauthorized-domain") {
      const host =
        typeof window !== "undefined" ? window.location.hostname : "this domain";
      throw new Error(
        `Google login is not enabled for ${host}. Ask admin to add this domain in Firebase Authentication > Settings > Authorized domains.`
      );
    }
    if (error.code === "auth/popup-closed-by-user") {
      return null;
    }
    throw error;
  }
};

const registerWithGoogle = async (
  otpVerificationToken,
  profileData = {}
) => {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error("Google session expired. Please try again.");
  }

  const idToken = await user.getIdToken(true);
  const response = await api.post(
    "/auth/register",
    {
      uid: user.uid,
      email: user.email,
      fullName:
        profileData.fullName ||
        user.displayName ||
        (user.email ? user.email.split("@")[0] : "Student"),
      phoneNumber: profileData.phoneNumber || "",
      otpVerificationToken: otpVerificationToken || "",
      fatherName: profileData.fatherName || "",
      fatherPhone: profileData.fatherPhone || "",
      fatherOccupation: profileData.fatherOccupation || "",
      address: profileData.address || "",
      district: profileData.district || "",
      domicile: profileData.domicile || "",
      caste: profileData.caste || "",
      provider: "google",
    },
    { headers: { Authorization: `Bearer ${idToken}` } }
  );

  return response.data;
};

const loginWithEmail = async (email, password) => {
  const { user } = await signInWithEmailAndPassword(
    firebaseAuth,
    email,
    password
  );

  try {
    const token = await user.getIdToken();
    const response = await api.post(
      "/auth/login",
      { token },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return (
      response.data?.data?.user ||
      response.data?.user ||
      response.data?.data ||
      response.data
    );
  } catch (error) {
    await signOut(firebaseAuth);
    throw error;
  }
};

const loginWithGoogle = async () => {
  try {
    console.log("Step 1: Opening Google popup...");

    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const user = result.user;

    console.log("Step 2: Google sign in success:", user.email);

    const idToken = await user.getIdToken();

    console.log("Step 3: Calling backend login...");

    let loginResponse;
    try {
      loginResponse = await api.post(
        "/auth/login",
        { token: idToken },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
    } catch (loginError) {
      await signOut(firebaseAuth);
      throw loginError;
    }

    console.log("Step 4: Login complete:", loginResponse.data);

    return (
      loginResponse.data?.data?.user ||
      loginResponse.data?.user ||
      loginResponse.data
    );
  } catch (error) {
    console.error("Google login error:", error);
    if (error.code === "auth/unauthorized-domain") {
      const host =
        typeof window !== "undefined" ? window.location.hostname : "this domain";
      throw new Error(
        `Google login is not enabled for ${host}. Ask admin to add this domain in Firebase Authentication > Settings > Authorized domains.`
      );
    }
    if (error.code === "auth/popup-closed-by-user") {
      return null;
    }
    if (error.response?.status === 404) {
      await signOut(firebaseAuth);
      throw new Error(
        "Account not registered. Please sign up and verify OTP first."
      );
    }
    throw error;
  }
};

const logout = async () => {
  const startedAt = Date.now();
  emitAuthOverlay(
    true,
    "Signing you out...",
    "Securing your account and ending this session"
  );

  const user = firebaseAuth.currentUser;

  try {
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
  } finally {
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, 1000 - elapsed);
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
    emitAuthOverlay(false);
  }
};

const getCurrentUser = () => firebaseAuth.currentUser;

const onAuthStateChange = (callback) => onAuthStateChanged(firebaseAuth, callback);

const sendRegistrationOtp = (email, fullName = "") =>
  api
    .post("/auth/register/send-otp", { email, fullName })
    .then((response) => response.data);

const verifyRegistrationOtp = (email, otp) =>
  api
    .post("/auth/register/verify-otp", { email, otp })
    .then((response) => response.data?.data || {});

const sendForgotPasswordOtp = (email) =>
  api.post("/auth/forgot-password/send-otp", { email }).then((response) => response.data);

const verifyForgotPasswordOtp = (email, otp) =>
  api
    .post("/auth/forgot-password/verify-otp", { email, otp })
    .then((response) => response.data?.data || {});

const resetForgotPassword = (
  email,
  newPassword,
  confirmPassword,
  otpVerificationToken
) =>
  api
    .post("/auth/forgot-password/reset", {
      email,
      newPassword,
      confirmPassword,
      otpVerificationToken,
    })
    .then((response) => response.data);

export {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  beginGoogleRegistration,
  registerWithGoogle,
  logout,
  getCurrentUser,
  onAuthStateChange,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetForgotPassword,
};
