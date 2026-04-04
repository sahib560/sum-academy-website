import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
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
import {
  isPakistanPhone,
  normalizePakistanPhone,
  sanitizePhoneInput,
} from "../../utils/phone.js";

const TABS = [
  { id: "profile", label: "Profile" },
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
  const fatherName = String(form.fatherName || "").trim();
  const fatherPhone = String(form.fatherPhone || "").trim();
  const fatherOccupation = String(form.fatherOccupation || "").trim();
  const address = String(form.address || "").trim();
  const district = String(form.district || "").trim();
  const domicile = String(form.domicile || "").trim();
  const caste = String(form.caste || "").trim();

  if (!fullName) {
    errors.fullName = "Full Name is required";
  } else if (fullName.length < 2) {
    errors.fullName = "Full Name must be at least 2 characters";
  } else if (fullName.length > 120) {
    errors.fullName = "Full Name cannot exceed 120 characters";
  }

  if (phoneNumber && !isPakistanPhone(phoneNumber)) {
    errors.phoneNumber = "Use 03001234567 or +923001234567 format";
  }
  if (fatherName.length > 120) {
    errors.fatherName = "Father Name cannot exceed 120 characters";
  }
  if (fatherPhone && !isPakistanPhone(fatherPhone)) {
    errors.fatherPhone = "Use 03001234567 or +923001234567 format";
  }
  if (fatherOccupation.length > 120) {
    errors.fatherOccupation = "Father Occupation cannot exceed 120 characters";
  }
  if (address.length > 300) {
    errors.address = "Address cannot exceed 300 characters";
  }
  if (district.length > 120) {
    errors.district = "District cannot exceed 120 characters";
  }
  if (domicile.length > 120) {
    errors.domicile = "Domicile cannot exceed 120 characters";
  }
  if (caste.length > 120) {
    errors.caste = "Caste cannot exceed 120 characters";
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
    fatherName: "",
    fatherPhone: "",
    fatherOccupation: "",
    address: "",
    district: "",
    domicile: "",
    caste: "",
  });
  const [profileBaseline, setProfileBaseline] = useState(profileForm);
  const [profileTouched, setProfileTouched] = useState({
    fullName: false,
    phoneNumber: false,
    fatherName: false,
    fatherPhone: false,
    fatherOccupation: false,
    address: false,
    district: false,
    domicile: false,
    caste: false,
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
      phoneNumber:
        normalizePakistanPhone(String(settingsQuery.data.phoneNumber || "")) ||
        String(settingsQuery.data.phoneNumber || ""),
      fatherName: String(settingsQuery.data.fatherName || ""),
      fatherPhone:
        normalizePakistanPhone(String(settingsQuery.data.fatherPhone || "")) ||
        String(settingsQuery.data.fatherPhone || ""),
      fatherOccupation: String(settingsQuery.data.fatherOccupation || ""),
      address: String(settingsQuery.data.address || ""),
      district: String(settingsQuery.data.district || ""),
      domicile: String(settingsQuery.data.domicile || ""),
      caste: String(settingsQuery.data.caste || ""),
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
        phoneNumber:
          normalizePakistanPhone(
            String(data.phoneNumber || profileForm.phoneNumber || "")
          ) || String(data.phoneNumber || profileForm.phoneNumber || ""),
        fatherName: String(data.fatherName || profileForm.fatherName || ""),
        fatherPhone:
          normalizePakistanPhone(
            String(data.fatherPhone || profileForm.fatherPhone || "")
          ) || String(data.fatherPhone || profileForm.fatherPhone || ""),
        fatherOccupation: String(
          data.fatherOccupation || profileForm.fatherOccupation || ""
        ),
        address: String(data.address || profileForm.address || ""),
        district: String(data.district || profileForm.district || ""),
        domicile: String(data.domicile || profileForm.domicile || ""),
        caste: String(data.caste || profileForm.caste || ""),
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
    setProfileTouched({
      fullName: true,
      phoneNumber: true,
      fatherName: true,
      fatherPhone: true,
      fatherOccupation: true,
      address: true,
      district: true,
      domicile: true,
      caste: true,
    });
    if (Object.keys(errors).length) {
      toast.error("Please fix profile validation errors", {
        style: { borderRadius: "12px", fontFamily: "DM Sans, sans-serif" },
      });
      return;
    }

    updateProfileMutation.mutate({
      fullName: String(profileForm.fullName || "").trim(),
      phoneNumber: profileForm.phoneNumber
        ? normalizePakistanPhone(profileForm.phoneNumber)
        : "",
      fatherName: String(profileForm.fatherName || "").trim(),
      fatherPhone: profileForm.fatherPhone
        ? normalizePakistanPhone(profileForm.fatherPhone)
        : "",
      fatherOccupation: String(profileForm.fatherOccupation || "").trim(),
      address: String(profileForm.address || "").trim(),
      district: String(profileForm.district || "").trim(),
      domicile: String(profileForm.domicile || "").trim(),
      caste: String(profileForm.caste || "").trim(),
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

      <Motion.aside
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
      </Motion.aside>

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
              <Motion.div key="profile" {...tabTransition} className="space-y-6">
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
                          setProfileForm((prev) => ({
                            ...prev,
                            phoneNumber: sanitizePhoneInput(event.target.value),
                          }));
                        }}
                        placeholder="03001234567 or +923001234567"
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileTouched.phoneNumber && profileErrors.phoneNumber ? (
                        <p className="mt-1 text-xs text-rose-600">{profileErrors.phoneNumber}</p>
                      ) : null}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Father Name
                      </label>
                      <input
                        value={profileForm.fatherName}
                        onChange={(event) => {
                          setProfileTouched((prev) => ({ ...prev, fatherName: true }));
                          setProfileForm((prev) => ({ ...prev, fatherName: event.target.value }));
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileTouched.fatherName && profileErrors.fatherName ? (
                        <p className="mt-1 text-xs text-rose-600">{profileErrors.fatherName}</p>
                      ) : null}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Father Phone
                      </label>
                      <input
                        value={profileForm.fatherPhone}
                        onChange={(event) => {
                          setProfileTouched((prev) => ({ ...prev, fatherPhone: true }));
                          setProfileForm((prev) => ({
                            ...prev,
                            fatherPhone: sanitizePhoneInput(event.target.value),
                          }));
                        }}
                        placeholder="03001234567 or +923001234567"
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileTouched.fatherPhone && profileErrors.fatherPhone ? (
                        <p className="mt-1 text-xs text-rose-600">{profileErrors.fatherPhone}</p>
                      ) : null}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Father Occupation
                      </label>
                      <input
                        value={profileForm.fatherOccupation}
                        onChange={(event) => {
                          setProfileTouched((prev) => ({ ...prev, fatherOccupation: true }));
                          setProfileForm((prev) => ({
                            ...prev,
                            fatherOccupation: event.target.value,
                          }));
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileTouched.fatherOccupation && profileErrors.fatherOccupation ? (
                        <p className="mt-1 text-xs text-rose-600">
                          {profileErrors.fatherOccupation}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        District
                      </label>
                      <input
                        value={profileForm.district}
                        onChange={(event) => {
                          setProfileTouched((prev) => ({ ...prev, district: true }));
                          setProfileForm((prev) => ({ ...prev, district: event.target.value }));
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileTouched.district && profileErrors.district ? (
                        <p className="mt-1 text-xs text-rose-600">{profileErrors.district}</p>
                      ) : null}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Domicile
                      </label>
                      <input
                        value={profileForm.domicile}
                        onChange={(event) => {
                          setProfileTouched((prev) => ({ ...prev, domicile: true }));
                          setProfileForm((prev) => ({ ...prev, domicile: event.target.value }));
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileTouched.domicile && profileErrors.domicile ? (
                        <p className="mt-1 text-xs text-rose-600">{profileErrors.domicile}</p>
                      ) : null}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Caste
                      </label>
                      <input
                        value={profileForm.caste}
                        onChange={(event) => {
                          setProfileTouched((prev) => ({ ...prev, caste: true }));
                          setProfileForm((prev) => ({ ...prev, caste: event.target.value }));
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileTouched.caste && profileErrors.caste ? (
                        <p className="mt-1 text-xs text-rose-600">{profileErrors.caste}</p>
                      ) : null}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Address
                      </label>
                      <textarea
                        value={profileForm.address}
                        onChange={(event) => {
                          setProfileTouched((prev) => ({ ...prev, address: true }));
                          setProfileForm((prev) => ({ ...prev, address: event.target.value }));
                        }}
                        rows={3}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileTouched.address && profileErrors.address ? (
                        <p className="mt-1 text-xs text-rose-600">{profileErrors.address}</p>
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
              </Motion.div>
            ) : null}

            {activeTab === "notifications" ? (
              <Motion.section key="notifications" {...tabTransition} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
              </Motion.section>
            ) : null}

            {activeTab === "appearance" ? (
              <Motion.section key="appearance" {...tabTransition} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
              </Motion.section>
            ) : null}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

export default StudentSettings;

