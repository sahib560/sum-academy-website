import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { Skeleton } from "../../components/Skeleton.jsx";
import { firebaseAuth } from "../../config/firebase.js";
import {
  getStudentSettings,
  updateStudentSettings,
} from "../../services/student.service.js";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
  { id: "appearance", label: "Appearance" },
];

const tabTransition = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.22 },
};

const profileErrorsFor = (form) => {
  const errors = {};
  const fullName = String(form.fullName || "").trim();
  const phoneNumber = String(form.phoneNumber || "").trim();

  if (!fullName) {
    errors.fullName = "Full Name is required";
  } else if (fullName.length < 2) {
    errors.fullName = "Full Name must be at least 2 characters";
  } else if (fullName.length > 120) {
    errors.fullName = "Full Name cannot exceed 120 characters";
  }

  if (phoneNumber.length > 30) {
    errors.phoneNumber = "Phone Number cannot exceed 30 characters";
  }

  return errors;
};

const passwordRulesFor = (password = "") => ({
  length: password.length >= 8,
  upper: /[A-Z]/.test(password),
  number: /[0-9]/.test(password),
  special: /[^A-Za-z0-9]/.test(password),
});

const passwordStrength = (rules) => {
  const score = Object.values(rules).filter(Boolean).length;
  if (score <= 1) return { label: "Weak", barClass: "bg-rose-500", width: "33%" };
  if (score <= 3) return { label: "Medium", barClass: "bg-amber-400", width: "66%" };
  return { label: "Strong", barClass: "bg-emerald-500", width: "100%" };
};

function StudentSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");

  const [profileForm, setProfileForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
  });
  const [profileBaseline, setProfileBaseline] = useState(profileForm);
  const [profileTouched, setProfileTouched] = useState({
    fullName: false,
    phoneNumber: false,
  });

  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordTouched, setPasswordTouched] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [savingPassword, setSavingPassword] = useState(false);

  const [notifications, setNotifications] = useState({
    announcements: true,
    sessions: true,
    quizzes: true,
    payments: true,
  });

  const [appearance, setAppearance] = useState({
    compactCards: false,
    reduceMotion: false,
  });

  const settingsQuery = useQuery({
    queryKey: ["student-settings"],
    queryFn: () => getStudentSettings(),
    staleTime: 30000,
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    const nextForm = {
      fullName: String(settingsQuery.data.fullName || ""),
      email: String(settingsQuery.data.email || ""),
      phoneNumber: String(settingsQuery.data.phoneNumber || ""),
    };
    setProfileForm(nextForm);
    setProfileBaseline(nextForm);
  }, [settingsQuery.data]);

  const profileErrors = useMemo(() => profileErrorsFor(profileForm), [profileForm]);
  const profileDirty = useMemo(
    () => JSON.stringify(profileForm) !== JSON.stringify(profileBaseline),
    [profileForm, profileBaseline]
  );

  const updateProfileMutation = useMutation({
    mutationFn: (payload) => updateStudentSettings(payload),
    onSuccess: (response) => {
      const data = response?.data || response?.data?.data || response || {};
      const next = {
        fullName: String(data.fullName || profileForm.fullName || ""),
        email: String(data.email || profileForm.email || ""),
        phoneNumber: String(data.phoneNumber || profileForm.phoneNumber || ""),
      };
      setProfileForm(next);
      setProfileBaseline(next);
      queryClient.invalidateQueries({ queryKey: ["student-settings"] });
      toast.success("Profile updated", {
        style: { borderRadius: "12px", fontFamily: "DM Sans, sans-serif" },
      });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update profile", {
        style: { borderRadius: "12px", fontFamily: "DM Sans, sans-serif" },
      });
    },
  });

  const passwordRules = useMemo(() => passwordRulesFor(passwordForm.next), [passwordForm.next]);
  const strength = useMemo(() => passwordStrength(passwordRules), [passwordRules]);

  const profileSave = () => {
    const errors = profileErrorsFor(profileForm);
    setProfileTouched({ fullName: true, phoneNumber: true });
    if (Object.keys(errors).length) {
      toast.error("Please fix profile validation errors", {
        style: { borderRadius: "12px", fontFamily: "DM Sans, sans-serif" },
      });
      return;
    }

    updateProfileMutation.mutate({
      fullName: String(profileForm.fullName || "").trim(),
      phoneNumber: String(profileForm.phoneNumber || "").trim(),
    });
  };

  const passwordSave = async () => {
    const nextErrors = {};
    if (!passwordForm.current) nextErrors.current = "Current password is required";
    if (!passwordForm.next) nextErrors.next = "New password is required";
    if (!Object.values(passwordRules).every(Boolean)) {
      nextErrors.next = "New password does not meet strength requirements";
    }
    if (passwordForm.confirm !== passwordForm.next) {
      nextErrors.confirm = "Passwords do not match";
    }

    setPasswordTouched({ current: true, next: true, confirm: true });
    if (Object.keys(nextErrors).length) {
      toast.error(nextErrors.current || nextErrors.next || nextErrors.confirm, {
        style: { borderRadius: "12px", fontFamily: "DM Sans, sans-serif" },
      });
      return;
    }

    const currentUser = firebaseAuth.currentUser;
    if (!currentUser?.email) {
      toast.error("Current user not available. Please login again.", {
        style: { borderRadius: "12px", fontFamily: "DM Sans, sans-serif" },
      });
      return;
    }

    setSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordForm.current
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, passwordForm.next);

      setPasswordForm({ current: "", next: "", confirm: "" });
      setPasswordTouched({ current: false, next: false, confirm: false });
      toast.success("Password updated", {
        style: { borderRadius: "12px", fontFamily: "DM Sans, sans-serif" },
      });
    } catch (error) {
      let message = error?.message || "Failed to update password";
      if (error?.code === "auth/wrong-password") message = "Current password is incorrect";
      if (error?.code === "auth/weak-password") message = "New password is too weak";
      if (error?.code === "auth/requires-recent-login") {
        message = "Please logout and login again, then try updating password";
      }
      toast.error(message, {
        style: { borderRadius: "12px", fontFamily: "DM Sans, sans-serif" },
      });
    } finally {
      setSavingPassword(false);
    }
  };

  if (settingsQuery.isError) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {settingsQuery.error?.response?.data?.message ||
          settingsQuery.error?.message ||
          "Failed to load settings"}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <Toaster position="top-right" />

      <motion.aside
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="sticky top-24 h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        {settingsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`tab-skel-${index}`} className="h-10 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </motion.aside>

      <div>
        {settingsQuery.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-40 w-full rounded-3xl" />
            <Skeleton className="h-40 w-full rounded-3xl" />
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "profile" ? (
              <motion.div key="profile" {...tabTransition} className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="font-heading text-2xl text-slate-900">Profile</h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Full Name
                      </label>
                      <input
                        value={profileForm.fullName}
                        onChange={(event) => {
                          setProfileTouched((prev) => ({ ...prev, fullName: true }));
                          setProfileForm((prev) => ({ ...prev, fullName: event.target.value }));
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileTouched.fullName && profileErrors.fullName ? (
                        <p className="mt-1 text-xs text-rose-600">{profileErrors.fullName}</p>
                      ) : null}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Email
                      </label>
                      <input
                        value={profileForm.email}
                        readOnly
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Phone Number
                      </label>
                      <input
                        value={profileForm.phoneNumber}
                        onChange={(event) => {
                          setProfileTouched((prev) => ({ ...prev, phoneNumber: true }));
                          setProfileForm((prev) => ({ ...prev, phoneNumber: event.target.value }));
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileTouched.phoneNumber && profileErrors.phoneNumber ? (
                        <p className="mt-1 text-xs text-rose-600">{profileErrors.phoneNumber}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={profileSave}
                      disabled={!profileDirty || updateProfileMutation.isPending}
                      className="inline-flex min-w-[160px] items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updateProfileMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          Saving...
                        </span>
                      ) : (
                        "Save"
                      )}
                    </button>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="font-heading text-xl text-slate-900">Change Password</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Current Password
                      </label>
                      <input
                        type="password"
                        value={passwordForm.current}
                        onChange={(event) => {
                          setPasswordTouched((prev) => ({ ...prev, current: true }));
                          setPasswordForm((prev) => ({ ...prev, current: event.target.value }));
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {passwordTouched.current && !passwordForm.current ? (
                        <p className="mt-1 text-xs text-rose-600">Current password is required</p>
                      ) : null}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={passwordForm.next}
                        onChange={(event) => {
                          setPasswordTouched((prev) => ({ ...prev, next: true }));
                          setPasswordForm((prev) => ({ ...prev, next: event.target.value }));
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {passwordTouched.next && passwordForm.next && !Object.values(passwordRules).every(Boolean) ? (
                        <p className="mt-1 text-xs text-rose-600">Password does not meet requirements</p>
                      ) : null}
                    </div>

                    <div className="sm:col-span-2">
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className={`h-2 rounded-full ${strength.barClass}`} style={{ width: strength.width }} />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-600">Strength: {strength.label}</p>
                      <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                        <p className={passwordRules.length ? "text-emerald-600" : "text-slate-500"}>At least 8 characters</p>
                        <p className={passwordRules.upper ? "text-emerald-600" : "text-slate-500"}>One uppercase letter</p>
                        <p className={passwordRules.number ? "text-emerald-600" : "text-slate-500"}>One number</p>
                        <p className={passwordRules.special ? "text-emerald-600" : "text-slate-500"}>One special character</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={passwordForm.confirm}
                        onChange={(event) => {
                          setPasswordTouched((prev) => ({ ...prev, confirm: true }));
                          setPasswordForm((prev) => ({ ...prev, confirm: event.target.value }));
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {passwordTouched.confirm && passwordForm.confirm !== passwordForm.next ? (
                        <p className="mt-1 text-xs text-rose-600">Passwords do not match</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={passwordSave}
                      disabled={savingPassword}
                      className="inline-flex min-w-[160px] items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingPassword ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          Saving...
                        </span>
                      ) : (
                        "Save Password"
                      )}
                    </button>
                  </div>
                </section>
              </motion.div>
            ) : null}

            {activeTab === "security" ? (
              <motion.section key="security" {...tabTransition} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-heading text-2xl text-slate-900">Security</h2>
                <p className="mt-2 text-sm text-slate-500">Password updates are available in the Profile tab. Keep your account secure by using a strong password and signing out from shared devices.</p>
              </motion.section>
            ) : null}

            {activeTab === "notifications" ? (
              <motion.section key="notifications" {...tabTransition} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-heading text-2xl text-slate-900">Notifications</h2>
                <div className="mt-4 space-y-3 text-sm">
                  {[
                    ["announcements", "Announcements"],
                    ["sessions", "Live Sessions"],
                    ["quizzes", "Quizzes"],
                    ["payments", "Payments"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                      <span className="font-medium text-slate-700">{label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(notifications[key])}
                        onChange={(event) =>
                          setNotifications((prev) => ({ ...prev, [key]: event.target.checked }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => toast.success("Notification preferences saved", { style: { borderRadius: "12px", fontFamily: "DM Sans, sans-serif" } })}
                  className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Save Notifications
                </button>
              </motion.section>
            ) : null}

            {activeTab === "appearance" ? (
              <motion.section key="appearance" {...tabTransition} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-heading text-2xl text-slate-900">Appearance</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <span className="font-medium text-slate-700">Compact Cards</span>
                    <input
                      type="checkbox"
                      checked={appearance.compactCards}
                      onChange={(event) =>
                        setAppearance((prev) => ({ ...prev, compactCards: event.target.checked }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <span className="font-medium text-slate-700">Reduce Motion</span>
                    <input
                      type="checkbox"
                      checked={appearance.reduceMotion}
                      onChange={(event) =>
                        setAppearance((prev) => ({ ...prev, reduceMotion: event.target.checked }))
                      }
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => toast.success("Appearance preferences saved", { style: { borderRadius: "12px", fontFamily: "DM Sans, sans-serif" } })}
                  className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Save Appearance
                </button>
              </motion.section>
            ) : null}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

export default StudentSettings;
