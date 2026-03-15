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
      const url = error?.config?.url || "";
      const isAuthBootstrap =
        url.includes("/auth/me") || url.includes("/auth/register");

      if (!isAuthBootstrap) {
        try {
          await signOut(firebaseAuth);
        } catch {
          // ignore sign out errors
        }
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
