import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "../../components/Skeleton.jsx";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const tabs = ["Profile", "Security", "Notifications"];

const initialProfile = {
  name: "Mr. Sikander Ali Qureshi",
  email: "teacher@sumacademy.pk",
  phone: "+92 300 1234567",
  subject: "Chemistry",
  bio: "Associate Professor of Chemistry with a focus on conceptual clarity and exam strategy.",
};

const initialNotifications = {
  enroll: true,
  quiz: true,
  complete: true,
  reminder: false,
  reply: false,
};

const activeSessions = [
  {
    id: 1,
    device: "Chrome on Windows",
    ip: "103.12.45.102",
    location: "Karachi",
    lastActive: "Just now",
    current: true,
  },
  {
    id: 2,
    device: "Safari on iPhone",
    ip: "223.64.21.17",
    location: "Lahore",
    lastActive: "2 hours ago",
    current: false,
  },
  {
    id: 3,
    device: "Edge on Windows",
    ip: "119.160.98.22",
    location: "Hyderabad",
    lastActive: "Yesterday",
    current: false,
  },
];

const loginHistory = [
  {
    id: 1,
    date: "Mar 14, 2026 09:12 PM",
    ip: "103.12.45.102",
    device: "Chrome / Windows",
    status: "Success",
  },
  {
    id: 2,
    date: "Mar 13, 2026 10:18 AM",
    ip: "223.64.21.17",
    device: "Safari / iPhone",
    status: "Success",
  },
  {
    id: 3,
    date: "Mar 12, 2026 02:44 PM",
    ip: "119.160.98.22",
    device: "Edge / Windows",
    status: "Success",
  },
  {
    id: 4,
    date: "Mar 11, 2026 11:02 PM",
    ip: "111.22.10.6",
    device: "Unknown / Desktop",
    status: "Failed",
  },
  {
    id: 5,
    date: "Mar 10, 2026 08:31 AM",
    ip: "119.160.98.22",
    device: "Edge / Windows",
    status: "Success",
  },
];

const passwordStrength = (value) => {
  const score = [
    value.length >= 8,
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;
  if (score <= 1) return { label: "Weak", color: "bg-rose-500" };
  if (score === 2 || score === 3) return { label: "Medium", color: "bg-amber-400" };
  return { label: "Strong", color: "bg-emerald-500" };
};

function TeacherSettings() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Profile");
  const [profile, setProfile] = useState(initialProfile);
  const [profileBaseline, setProfileBaseline] = useState(initialProfile);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [notificationsBaseline, setNotificationsBaseline] =
    useState(initialNotifications);
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
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [toast, setToast] = useState(null);
  const [avatar, setAvatar] = useState("");
  const [avatarBaseline, setAvatarBaseline] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const profileDirty = useMemo(
    () =>
      JSON.stringify(profile) !== JSON.stringify(profileBaseline) ||
      avatar !== avatarBaseline,
    [profile, profileBaseline, avatar, avatarBaseline]
  );

  const securityDirty = useMemo(
    () => passwords.current || passwords.next || passwords.confirm,
    [passwords]
  );

  const notificationsDirty = useMemo(
    () =>
      JSON.stringify(notifications) !== JSON.stringify(notificationsBaseline),
    [notifications, notificationsBaseline]
  );

  const handleTabChange = (tab) => {
    const hasUnsaved =
      (activeTab === "Profile" && profileDirty) ||
      (activeTab === "Security" && securityDirty) ||
      (activeTab === "Notifications" && notificationsDirty);
    if (hasUnsaved) {
      const confirmed = window.confirm(
        "You have unsaved changes. Switch tabs anyway?"
      );
      if (!confirmed) return;
    }
    setActiveTab(tab);
  };

  const handleAvatarUpload = (file) => {
    if (!file) return;
    setUploadingAvatar(true);
    setAvatarProgress(10);
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result);
      let progress = 10;
      const timer = setInterval(() => {
        progress += 20;
        setAvatarProgress(progress);
        if (progress >= 100) {
          clearInterval(timer);
          setUploadingAvatar(false);
          setAvatarBaseline(reader.result);
          setToast({ type: "success", message: "Profile photo updated" });
        }
      }, 150);
    };
    reader.readAsDataURL(file);
  };

  const validateProfile = () => {
    const errors = {};
    if (!profile.name.trim()) errors.name = "Name is required.";
    if (!profile.phone.trim()) errors.phone = "Phone number is required.";
    if (!profile.subject.trim()) errors.subject = "Subject is required.";
    if (profile.bio.length > 300) errors.bio = "Bio must be under 300 characters.";
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = () => {
    if (!validateProfile()) return;
    setSavingProfile(true);
    setTimeout(() => {
      setSavingProfile(false);
      setProfileBaseline(profile);
      setAvatarBaseline(avatar);
      setToast({ type: "success", message: "Profile saved successfully" });
    }, 900);
  };

  const strength = passwordStrength(passwords.next);
  const requirements = {
    length: passwords.next.length >= 8,
    upper: /[A-Z]/.test(passwords.next),
    number: /[0-9]/.test(passwords.next),
    special: /[^A-Za-z0-9]/.test(passwords.next),
  };

  const validateSecurity = () => {
    const errors = {};
    if (!passwords.current) errors.current = "Current password required.";
    if (!passwords.next) errors.next = "New password required.";
    if (passwords.next && passwords.next.length < 8)
      errors.next = "Password must be at least 8 characters.";
    if (passwords.confirm !== passwords.next)
      errors.confirm = "Passwords do not match.";
    setSecurityErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSavePassword = () => {
    if (!validateSecurity()) return;
    setSavingSecurity(true);
    setTimeout(() => {
      setSavingSecurity(false);
      setPasswords({ current: "", next: "", confirm: "" });
      setToast({ type: "success", message: "Password updated" });
    }, 900);
  };

  const handleSaveNotifications = () => {
    setSavingNotifications(true);
    setTimeout(() => {
      setSavingNotifications(false);
      setNotificationsBaseline(notifications);
      setToast({ type: "success", message: "Notification preferences saved" });
    }, 900);
  };

  const profilePreview = {
    name: profile.name,
    subject: profile.subject,
    bio: profile.bio,
    courses: 6,
    rating: 4.8,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <motion.aside
        {...fadeUp}
        className="sticky top-24 h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
                activeTab === tab
                  ? "bg-primary text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              onClick={() => handleTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </motion.aside>
      <div className="space-y-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {activeTab === "Profile" && (
              <div className="space-y-6">
                <motion.section
                  {...fadeUp}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="relative flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-semibold text-primary">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        profile.name
                          .split(" ")
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) =>
                          handleAvatarUpload(event.target.files?.[0])
                        }
                      />
                    </label>
                    <div className="flex-1">
                      <h2 className="font-heading text-2xl text-slate-900">
                        {profile.name}
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                          {profile.subject}
                        </span>
                        <span>Member since Jan 2024</span>
                      </div>
                    </div>
                  </div>
                  {uploadingAvatar && (
                    <div className="mt-4">
                      <div className="h-2 w-full rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${avatarProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </motion.section>

                <motion.section
                  {...fadeUp}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <h3 className="font-heading text-xl text-slate-900">
                    Edit Profile
                  </h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Full Name
                      </label>
                      <input
                        value={profile.name}
                        onChange={(event) =>
                          setProfile((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileErrors.name && (
                        <p className="mt-1 text-xs text-rose-500">
                          {profileErrors.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Email
                      </label>
                      <div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        <svg
                          viewBox="0 0 24 24"
                          className="mr-2 h-4 w-4"
                          fill="currentColor"
                        >
                          <path d="M12 1a5 5 0 0 1 5 5v4h-2V6a3 3 0 0 0-6 0v4H7V6a5 5 0 0 1 5-5zm-6 9h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" />
                        </svg>
                        {profile.email}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Contact admin to update your email
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Phone Number
                      </label>
                      <input
                        value={profile.phone}
                        onChange={(event) =>
                          setProfile((prev) => ({
                            ...prev,
                            phone: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileErrors.phone && (
                        <p className="mt-1 text-xs text-rose-500">
                          {profileErrors.phone}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Subject / Expertise
                      </label>
                      <input
                        value={profile.subject}
                        onChange={(event) =>
                          setProfile((prev) => ({
                            ...prev,
                            subject: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileErrors.subject && (
                        <p className="mt-1 text-xs text-rose-500">
                          {profileErrors.subject}
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold uppercase">Bio</span>
                        <span>{profile.bio.length}/300</span>
                      </div>
                      <textarea
                        value={profile.bio}
                        onChange={(event) =>
                          setProfile((prev) => ({
                            ...prev,
                            bio: event.target.value,
                          }))
                        }
                        rows={4}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileErrors.bio && (
                        <p className="mt-1 text-xs text-rose-500">
                          {profileErrors.bio}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      className="btn-primary"
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                    >
                      {savingProfile ? "Saving..." : "Save Profile"}
                    </button>
                  </div>
                </motion.section>

                <motion.section
                  {...fadeUp}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-heading text-xl text-slate-900">
                        My Public Profile Preview
                      </h3>
                      <p className="text-sm text-slate-500">
                        Preview how students see your profile
                      </p>
                    </div>
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                      onClick={() => setPreviewOpen((prev) => !prev)}
                    >
                      {previewOpen ? "Hide" : "Preview"}
                    </button>
                  </div>
                  {previewOpen && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {profilePreview.name
                            .split(" ")
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {profilePreview.name}
                          </p>
                          <span className="text-xs text-slate-500">
                            {profilePreview.subject}
                          </span>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-500">
                        {profilePreview.bio.slice(0, 120)}...
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                          {profilePreview.courses} courses
                        </span>
                        <span className="inline-flex items-center gap-1">
                          ⭐ {profilePreview.rating}
                        </span>
                      </div>
                    </div>
                  )}
                </motion.section>
              </div>
            )}

            {activeTab === "Security" && (
              <div className="space-y-6">
                <motion.section
                  {...fadeUp}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <h3 className="font-heading text-xl text-slate-900">
                    Change Password
                  </h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {[
                      { key: "current", label: "Current Password" },
                      { key: "next", label: "New Password" },
                      { key: "confirm", label: "Confirm New Password" },
                    ].map((field) => (
                      <div key={field.key} className="sm:col-span-2">
                        <label className="text-xs font-semibold uppercase text-slate-400">
                          {field.label}
                        </label>
                        <div className="mt-2 flex items-center rounded-xl border border-slate-200 px-3 py-2 text-sm">
                          <input
                            type={
                              showPasswords[field.key] ? "text" : "password"
                            }
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
                            onClick={() =>
                              setShowPasswords((prev) => ({
                                ...prev,
                                [field.key]: !prev[field.key],
                              }))
                            }
                            className="text-xs text-slate-500"
                          >
                            {showPasswords[field.key] ? "Hide" : "Show"}
                          </button>
                        </div>
                        {securityErrors[field.key] && (
                          <p className="mt-1 text-xs text-rose-500">
                            {securityErrors[field.key]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div className={`h-2 rounded-full ${strength.color}`} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Strength: {strength.label}
                    </p>
                    <div className="mt-3 grid gap-2 text-xs text-slate-500">
                      <span className={requirements.length ? "text-emerald-600" : ""}>
                        ✓ At least 8 characters
                      </span>
                      <span className={requirements.upper ? "text-emerald-600" : ""}>
                        ✓ One uppercase letter
                      </span>
                      <span className={requirements.number ? "text-emerald-600" : ""}>
                        ✓ One number
                      </span>
                      <span className={requirements.special ? "text-emerald-600" : ""}>
                        ✓ One special character
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      className="btn-primary"
                      onClick={handleSavePassword}
                      disabled={savingSecurity}
                    >
                      {savingSecurity ? "Saving..." : "Save Password"}
                    </button>
                  </div>
                </motion.section>

                <motion.section
                  {...fadeUp}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <h3 className="font-heading text-xl text-slate-900">
                    Active Login Sessions
                  </h3>
                  <div className="mt-4 space-y-3">
                    {activeSessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {session.device}
                          </p>
                          <p className="text-xs text-slate-500">
                            {session.location} · {session.ip}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">
                            {session.lastActive}
                          </span>
                          {session.current ? (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-600">
                              This device
                            </span>
                          ) : (
                            <button className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500">
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="btn-outline mt-4 border-rose-200 text-rose-500">
                    Revoke All Other Sessions
                  </button>
                </motion.section>

                <motion.section
                  {...fadeUp}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <h3 className="font-heading text-xl text-slate-900">
                    Login History
                  </h3>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                          <th className="py-2">Date & Time</th>
                          <th className="py-2">IP Address</th>
                          <th className="py-2">Device</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loginHistory.map((row) => (
                          <tr
                            key={row.id}
                            className={`border-t border-slate-100 ${
                              row.status === "Failed" ? "text-rose-500" : ""
                            }`}
                          >
                            <td className="py-2">{row.date}</td>
                            <td className="py-2">{row.ip}</td>
                            <td className="py-2">{row.device}</td>
                            <td className="py-2">{row.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.section>
              </div>
            )}

            {activeTab === "Notifications" && (
              <div className="space-y-6">
                <motion.section
                  {...fadeUp}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <h3 className="font-heading text-xl text-slate-900">
                    Email me when...
                  </h3>
                  <div className="mt-4 space-y-3">
                    {[
                      {
                        key: "enroll",
                        label: "New student enrolled in my course",
                        desc: "Get notified when a student enrolls",
                      },
                      {
                        key: "quiz",
                        label: "Student submits a quiz",
                        desc: "Get notified when a student submits a quiz for review",
                      },
                      {
                        key: "complete",
                        label: "Student completes a course",
                        desc: "Get notified when a student reaches 100% completion",
                      },
                      {
                        key: "reminder",
                        label: "Session reminder (1 hour before)",
                        desc: "Get a reminder 1 hour before your scheduled session",
                      },
                      {
                        key: "reply",
                        label: "New announcement reply",
                        desc: "Get notified when students respond to announcements",
                      },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {item.label}
                          </p>
                          <p className="text-xs text-slate-500">{item.desc}</p>
                        </div>
                        <button
                          className={`h-7 w-12 rounded-full p-1 ${
                            notifications[item.key]
                              ? "bg-primary"
                              : "bg-slate-200"
                          }`}
                          onClick={() =>
                            setNotifications((prev) => ({
                              ...prev,
                              [item.key]: !prev[item.key],
                            }))
                          }
                          type="button"
                        >
                          <span
                            className={`block h-5 w-5 rounded-full bg-white transition ${
                              notifications[item.key]
                                ? "translate-x-5"
                                : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      className="btn-primary"
                      onClick={handleSaveNotifications}
                      disabled={savingNotifications}
                    >
                      {savingNotifications ? "Saving..." : "Save Preferences"}
                    </button>
                  </div>
                </motion.section>
              </div>
            )}
          </>
        )}
      </div>
      {toast && (
        <div className="fixed right-6 top-6 z-[70] rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default TeacherSettings;
