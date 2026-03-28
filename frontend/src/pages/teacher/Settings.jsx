import { useEffect, useMemo, useState } from "react";
import { motion as Motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "react-hot-toast";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { Skeleton } from "../../components/Skeleton.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { firebaseAuth } from "../../config/firebase.js";
import {
  getTeacherSettingsProfile,
  updateTeacherSettingsProfile,
  getTeacherSettingsSecurity,
  revokeTeacherSession,
  revokeTeacherOtherSessions,
} from "../../services/teacher.service.js";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.4 },
};

const tabs = ["Profile", "Security"];

const buildProfileForm = (data = {}) => ({
  fullName: String(data?.fullName || "").trim(),
  email: String(data?.email || "").trim(),
  phoneNumber: String(data?.phoneNumber || "").trim(),
  subject: String(data?.subject || "").trim(),
  bio: String(data?.bio || "").trim(),
});

const getInitials = (name = "") =>
  String(name || "")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "T";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const passwordStrength = (value) => {
  const score = [
    value.length >= 8,
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;

  if (score <= 1) return { label: "Weak", width: "25%", color: "bg-rose-500" };
  if (score === 2) return { label: "Fair", width: "50%", color: "bg-amber-500" };
  if (score === 3) return { label: "Good", width: "75%", color: "bg-emerald-500" };
  return { label: "Strong", width: "100%", color: "bg-emerald-600" };
};

function TeacherSettings() {
  const queryClient = useQueryClient();
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("Profile");
  const [profile, setProfile] = useState(buildProfileForm());
  const [profileBaseline, setProfileBaseline] = useState(buildProfileForm());
  const [profileErrors, setProfileErrors] = useState({});
  const [securityErrors, setSecurityErrors] = useState({});
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  const profileQuery = useQuery({
    queryKey: ["teacher-settings-profile", userProfile?.uid],
    queryFn: getTeacherSettingsProfile,
    enabled: Boolean(userProfile?.uid),
    staleTime: 60 * 1000,
  });

  const securityQuery = useQuery({
    queryKey: ["teacher-settings-security", userProfile?.uid],
    queryFn: getTeacherSettingsSecurity,
    enabled: Boolean(userProfile?.uid),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    const next = buildProfileForm(profileQuery.data);
    setProfile(next);
    setProfileBaseline(next);
  }, [profileQuery.data]);

  const profileDirty = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(profileBaseline),
    [profile, profileBaseline]
  );

  const strength = passwordStrength(passwords.next);
  const passwordChecks = {
    length: passwords.next.length >= 8,
    upper: /[A-Z]/.test(passwords.next),
    number: /[0-9]/.test(passwords.next),
    special: /[^A-Za-z0-9]/.test(passwords.next),
  };

  const validateProfile = () => {
    const nextErrors = {};
    if (profile.fullName.trim().length < 2) {
      nextErrors.fullName = "Full name must be at least 2 characters.";
    }
    if (!profile.phoneNumber.trim()) {
      nextErrors.phoneNumber = "Phone number is required.";
    }
    if (!profile.subject.trim()) {
      nextErrors.subject = "Subject is required.";
    }
    if (profile.bio.trim().length > 500) {
      nextErrors.bio = "Bio cannot exceed 500 characters.";
    }
    setProfileErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const profileMutation = useMutation({
    mutationFn: updateTeacherSettingsProfile,
    onSuccess: (data) => {
      const next = buildProfileForm(data);
      setProfile(next);
      setProfileBaseline(next);
      queryClient.invalidateQueries({
        queryKey: ["teacher-settings-profile", userProfile?.uid],
      });
      toast.success("Profile settings updated");
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to update profile"
      );
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: revokeTeacherSession,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["teacher-settings-security", userProfile?.uid],
      });
      toast.success("Session revoked");
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to revoke session"
      );
    },
  });

  const revokeOthersMutation = useMutation({
    mutationFn: revokeTeacherOtherSessions,
    onSuccess: (response) => {
      const count = Number(response?.data?.revokedCount || 0);
      queryClient.invalidateQueries({
        queryKey: ["teacher-settings-security", userProfile?.uid],
      });
      if (count > 0) {
        toast.success(`Revoked ${count} session${count > 1 ? "s" : ""}`);
      } else {
        toast.success("No other active sessions found");
      }
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to revoke sessions"
      );
    },
  });

  const handleSaveProfile = () => {
    if (!validateProfile()) return;
    profileMutation.mutate({
      fullName: profile.fullName.trim(),
      phoneNumber: profile.phoneNumber.trim(),
      subject: profile.subject.trim(),
      bio: profile.bio.trim(),
    });
  };

  const validateSecurity = () => {
    const nextErrors = {};
    if (!passwords.current) nextErrors.current = "Current password is required.";
    if (!passwords.next) nextErrors.next = "New password is required.";
    if (passwords.next && passwords.next.length < 8) {
      nextErrors.next = "New password must be at least 8 characters.";
    }
    if (passwords.next === passwords.current && passwords.next) {
      nextErrors.next = "New password must be different.";
    }
    if (passwords.confirm !== passwords.next) {
      nextErrors.confirm = "Passwords do not match.";
    }
    setSecurityErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const [changingPassword, setChangingPassword] = useState(false);
  const handleSavePassword = async () => {
    if (!validateSecurity()) return;

    const currentUser = firebaseAuth.currentUser;
    if (!currentUser?.email) {
      toast.error("Session expired. Please login again.");
      return;
    }

    const hasPasswordProvider = currentUser.providerData.some(
      (provider) => provider?.providerId === "password"
    );
    if (!hasPasswordProvider) {
      toast.error("Password change is only available for email/password accounts.");
      return;
    }

    try {
      setChangingPassword(true);
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwords.current
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, passwords.next);

      setPasswords({ current: "", next: "", confirm: "" });
      setSecurityErrors({});
      toast.success("Password updated");
    } catch (error) {
      const code = error?.code;
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        toast.error("Current password is incorrect.");
      } else if (code === "auth/weak-password") {
        toast.error("New password is too weak.");
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many attempts. Try again shortly.");
      } else {
        toast.error(error?.message || "Failed to update password");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const sessions = Array.isArray(securityQuery.data?.sessions)
    ? securityQuery.data.sessions
    : [];
  const loginHistory = Array.isArray(securityQuery.data?.loginHistory)
    ? securityQuery.data.loginHistory
    : [];

  const canRevokeOthers = sessions.some((row) => !row.isCurrent);

  const handleRevokeSession = (sessionDocId) => {
    if (!sessionDocId) return;
    const ok = window.confirm("Revoke this session?");
    if (!ok) return;
    revokeSessionMutation.mutate(sessionDocId);
  };

  const handleRevokeOthers = () => {
    const ok = window.confirm("Revoke all other active sessions?");
    if (!ok) return;
    revokeOthersMutation.mutate();
  };

  const isInitialLoading = profileQuery.isLoading && !profileQuery.data;

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <Toaster position="top-right" />

      <Motion.aside
        {...fadeUp}
        className="sticky top-24 h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
                activeTab === tab
                  ? "bg-primary text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </Motion.aside>

      <div className="space-y-6">
        {isInitialLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        ) : null}

        {!isInitialLoading && activeTab === "Profile" ? (
          <div className="space-y-6">
            <Motion.section
              {...fadeUp}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {getInitials(profile.fullName)}
                </div>
                <div>
                  <h2 className="font-heading text-2xl text-slate-900">
                    {profile.fullName || "Teacher"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {profile.subject || "Subject not set"}
                  </p>
                </div>
              </div>
            </Motion.section>

            <Motion.section
              {...fadeUp}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="font-heading text-xl text-slate-900">Profile Settings</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Full Name
                  </label>
                  <input
                    value={profile.fullName}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, fullName: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  {profileErrors.fullName ? (
                    <p className="mt-1 text-xs text-rose-500">{profileErrors.fullName}</p>
                  ) : null}
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Email
                  </label>
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    {profile.email || "-"}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Contact admin to update email.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Phone Number
                  </label>
                  <input
                    value={profile.phoneNumber}
                    onChange={(event) =>
                      setProfile((prev) => ({
                        ...prev,
                        phoneNumber: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  {profileErrors.phoneNumber ? (
                    <p className="mt-1 text-xs text-rose-500">
                      {profileErrors.phoneNumber}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Subject
                  </label>
                  <input
                    value={profile.subject}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, subject: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  {profileErrors.subject ? (
                    <p className="mt-1 text-xs text-rose-500">{profileErrors.subject}</p>
                  ) : null}
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <label className="font-semibold uppercase">Bio</label>
                    <span>{profile.bio.length}/500</span>
                  </div>
                  <textarea
                    rows={4}
                    value={profile.bio}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, bio: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  {profileErrors.bio ? (
                    <p className="mt-1 text-xs text-rose-500">{profileErrors.bio}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    setProfile(profileBaseline);
                    setProfileErrors({});
                  }}
                  disabled={!profileDirty || profileMutation.isPending}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveProfile}
                  disabled={!profileDirty || profileMutation.isPending}
                >
                  {profileMutation.isPending ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </Motion.section>
          </div>
        ) : null}

        {!isInitialLoading && activeTab === "Security" ? (
          <div className="space-y-6">
            <Motion.section
              {...fadeUp}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="font-heading text-xl text-slate-900">Change Password</h3>
              <div className="mt-4 space-y-4">
                {[
                  { key: "current", label: "Current Password" },
                  { key: "next", label: "New Password" },
                  { key: "confirm", label: "Confirm New Password" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="text-xs font-semibold uppercase text-slate-400">
                      {field.label}
                    </label>
                    <div className="mt-2 flex items-center rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <input
                        type={showPasswords[field.key] ? "text" : "password"}
                        value={passwords[field.key]}
                        onChange={(event) =>
                          setPasswords((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                        className="w-full bg-transparent focus:outline-none"
                      />
                      <button
                        type="button"
                        className="text-xs text-slate-500"
                        onClick={() =>
                          setShowPasswords((prev) => ({
                            ...prev,
                            [field.key]: !prev[field.key],
                          }))
                        }
                      >
                        {showPasswords[field.key] ? "Hide" : "Show"}
                      </button>
                    </div>
                    {securityErrors[field.key] ? (
                      <p className="mt-1 text-xs text-rose-500">
                        {securityErrors[field.key]}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div
                    className={`h-2 rounded-full transition-all ${strength.color}`}
                    style={{ width: strength.width }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">Strength: {strength.label}</p>
                <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                  <span className={passwordChecks.length ? "text-emerald-600" : ""}>
                    At least 8 characters
                  </span>
                  <span className={passwordChecks.upper ? "text-emerald-600" : ""}>
                    One uppercase letter
                  </span>
                  <span className={passwordChecks.number ? "text-emerald-600" : ""}>
                    One number
                  </span>
                  <span className={passwordChecks.special ? "text-emerald-600" : ""}>
                    One special character
                  </span>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSavePassword}
                  disabled={changingPassword}
                >
                  {changingPassword ? "Saving..." : "Save Password"}
                </button>
              </div>
            </Motion.section>

            <Motion.section
              {...fadeUp}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-heading text-xl text-slate-900">
                    Active Login Sessions
                  </h3>
                  <p className="text-sm text-slate-500">
                    Active: {securityQuery.data?.totalActiveSessions || 0} sessions
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-outline border-rose-200 text-rose-600"
                  onClick={handleRevokeOthers}
                  disabled={!canRevokeOthers || revokeOthersMutation.isPending}
                >
                  {revokeOthersMutation.isPending
                    ? "Revoking..."
                    : "Revoke All Other Sessions"}
                </button>
              </div>

              {securityQuery.isLoading ? (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {sessions.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      No active sessions found.
                    </div>
                  ) : (
                    sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{session.device}</p>
                          <p className="text-xs text-slate-500">
                            {session.ip || "-"} | Last active{" "}
                            {formatDateTime(session.lastActiveAt)}
                          </p>
                        </div>
                        <div>
                          {session.isCurrent ? (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                              This device
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRevokeSession(session.id)}
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                              disabled={revokeSessionMutation.isPending}
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Motion.section>

            <Motion.section
              {...fadeUp}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-xl text-slate-900">Login History</h3>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
                  Blocked attempts: {securityQuery.data?.blockedAttempts || 0}
                </span>
              </div>
              <div className="mt-4 overflow-x-auto">
                {securityQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="h-10 w-full" />
                    ))}
                  </div>
                ) : loginHistory.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    No login activity found.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                        <th className="py-2">Date & Time</th>
                        <th className="py-2">IP Address</th>
                        <th className="py-2">Device</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginHistory.slice(0, 20).map((row) => {
                        const statusLabel =
                          row.status === "success"
                            ? "Success"
                            : row.status === "blocked"
                              ? "Blocked"
                              : "Activity";
                        const statusClass =
                          row.status === "success"
                            ? "text-emerald-600"
                            : row.status === "blocked"
                              ? "text-rose-600"
                              : "text-slate-500";
                        return (
                          <tr key={row.id} className="border-b border-slate-100">
                            <td className="py-2">{formatDateTime(row.timestamp)}</td>
                            <td className="py-2">{row.ip || "-"}</td>
                            <td className="py-2">{row.device || "-"}</td>
                            <td className={`py-2 font-semibold ${statusClass}`}>
                              {statusLabel}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </Motion.section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default TeacherSettings;
