import {
  createUserWithEmailAndPassword,
  deleteUser as deleteAuthUser,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
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
  let user = null;
  let isNewAuthUser = false;
  try {
    console.log("Step 1: Creating Firebase user...");
    try {
      const result = await createUserWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      );
      user = result.user;
      isNewAuthUser = true;
    } catch (createError) {
      if (createError?.code === "auth/email-already-in-use") {
        const signInResult = await signInWithEmailAndPassword(
          firebaseAuth,
          email,
          password
        );
        user = signInResult.user;
      } else {
        throw createError;
      }
    }

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

    // Student registration is pending admin approval, so keep user signed out.
    await signOut(firebaseAuth);

    console.log("Step 5: Done:", response.data);
    return response.data;
  } catch (error) {
    if (isNewAuthUser && user) {
      try {
        await deleteAuthUser(user);
      } catch (cleanupError) {
        console.warn("Partial auth cleanup failed:", cleanupError?.message || cleanupError);
      }
    }
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
    if (
      error.code === "auth/popup-closed-by-user" ||
      error.code === "auth/cancelled-popup-request"
    ) {
      return null;
    }
    if (error.code === "auth/popup-blocked") {
      throw new Error(
        "Popup was blocked by your browser. Please allow popups and try again."
      );
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

    let result;
    try {
      result = await signInWithPopup(firebaseAuth, googleProvider);
    } catch (popupError) {
      if (
        popupError.code === "auth/popup-closed-by-user" ||
        popupError.code === "auth/cancelled-popup-request"
      ) {
        console.log("User closed popup - silent cancel");
        return null;
      }
      if (popupError.code === "auth/popup-blocked") {
        console.log("Popup blocked - trying redirect...");
        await signInWithRedirect(firebaseAuth, googleProvider);
        return null;
      }
      throw popupError;
    }

    if (!result || !result.user) return null;

    const user = result.user;
    const idToken = await user.getIdToken(true);

    console.log("Step 2: Google auth success:", user.email);

    try {
      await api.post(
        "/auth/register",
        {
          uid: user.uid,
          email: user.email,
          fullName: user.displayName || user.email.split("@")[0],
          phoneNumber: "",
        },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      console.log("Step 3: New user registered");
    } catch (regError) {
      if (regError.response?.status === 409) {
        console.log("Step 3: Existing user - skip register");
      } else {
        throw regError;
      }
    }

    console.log("Step 4: Calling backend login...");
    const loginResponse = await api.post(
      "/auth/login",
      {},
      { headers: { Authorization: `Bearer ${idToken}` } }
    );

    console.log("Step 5: Login complete:", loginResponse.data);
    return loginResponse.data;
  } catch (error) {
    console.error("Google login error:", error.code, error.message);

    if (
      error.code === "auth/popup-closed-by-user" ||
      error.code === "auth/cancelled-popup-request"
    ) {
      return null;
    }

    if (error.code === "auth/popup-blocked") {
      throw new Error(
        "Popup was blocked by your browser. " +
          "Please allow popups for sumacademy.net and try again."
      );
    }

    if (error.code === "auth/unauthorized-domain") {
      throw new Error(
        "Google login is not available. " +
          "Please use email login instead."
      );
    }

    if (error.code === "auth/network-request-failed") {
      throw new Error("Network error. Check your connection and try again.");
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

