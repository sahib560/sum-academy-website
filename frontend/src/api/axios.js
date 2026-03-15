import axios from "axios";
import { signOut } from "firebase/auth";
import { firebaseAuth } from "../config/firebase.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

api.interceptors.request.use(
  async (config) => {
    const user = firebaseAuth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      try {
        await signOut(firebaseAuth);
      } catch {
        // ignore sign out errors
      }
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject("Unauthorized");
    }
    const message =
      error?.response?.data?.message || error?.message || "Request failed";
    return Promise.reject(message);
  }
);

export default api;
