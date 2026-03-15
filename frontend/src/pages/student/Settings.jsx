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
  name: "Sana Ahmed",
  email: "sana.ahmed@sumacademy.com",
  phone: "+92 300 1234567",
  dob: "2006-08-12",
  city: "Karachi",
};

const initialNotifications = {
  announcement: true,
  installment: true,
  quiz: true,
  session: false,
  certificate: true,
  completion: false,
};


const sessions = [
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
];

const passwordStrength = (value) => {
  const score = [
    value.length >= 8,
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;
  if (score <= 1) return { label: "Weak", color: "bg-rose-500" };
  if (score === 2 || score === 3)
    return { label: "Medium", color: "bg-amber-400" };
  return { label: "Strong", color: "bg-emerald-500" };
};

const requirementList = [
  { key: "length", label: "At least 8 characters" },
  { key: "upper", label: "One uppercase letter" },
  { key: "number", label: "One number" },
  { key: "special", label: "One special character" },
];


function StudentSettings() {
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
  const [toast, setToast] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [avatar, setAvatar] = useState("");
  const [avatarBaseline, setAvatarBaseline] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
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
    setUploading(true);
    setUploadProgress(10);
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result);
      let progress = 10;
      const timer = setInterval(() => {
        progress += 15;
        setUploadProgress(progress);
        if (progress >= 100) {
          clearInterval(timer);
          setUploading(false);
          setAvatarBaseline(reader.result);
          setToast({ message: "Profile photo updated" });
        }
      }, 140);
    };
    reader.readAsDataURL(file);
  };

  const validateProfile = () => {
    const errors = {};
    if (!profile.name.trim()) errors.name = "Name is required.";
    if (!profile.phone.trim()) errors.phone = "Phone number is required.";
    if (!profile.dob) errors.dob = "Date of birth is required.";
    if (!profile.city.trim()) errors.city = "City is required.";
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
      setToast({ message: "Profile saved successfully" });
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
      errors.next = "Password too short.";
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
      setToast({ message: "Password updated" });
    }, 900);
  };

  const handleSaveNotifications = () => {
    setSavingNotifications(true);
    setTimeout(() => {
      setSavingNotifications(false);
      setNotificationsBaseline(notifications);
      setToast({ message: "Preferences saved" });
    }, 900);
  };


  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <motion.aside
        {...fadeUp}
        className="sticky top-24 h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
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
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
        )}
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
                    <label className="relative flex h-[72px] w-[72px] cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xl font-semibold text-primary">
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
                          Student
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                          3 Courses
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                          2 Certificates
                        </span>
                        <span>Member since Jan 2025</span>
                      </div>
                    </div>
                  </div>
                  {uploading && (
                    <div className="mt-4">
                      <div className="h-2 w-full rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${uploadProgress}%` }}
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
                        Contact admin to update email
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Phone Number (+92)
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
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={profile.dob}
                        onChange={(event) =>
                          setProfile((prev) => ({
                            ...prev,
                            dob: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileErrors.dob && (
                        <p className="mt-1 text-xs text-rose-500">
                          {profileErrors.dob}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        City
                      </label>
                      <input
                        value={profile.city}
                        onChange={(event) =>
                          setProfile((prev) => ({
                            ...prev,
                            city: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      {profileErrors.city && (
                        <p className="mt-1 text-xs text-rose-500">
                          {profileErrors.city}
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
                  <div className="mt-4 grid gap-4">
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
                    <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                      {requirementList.map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center gap-2"
                        >
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                              requirements[item.key]
                                ? "border-emerald-500 text-emerald-500"
                                : "border-slate-300 text-slate-300"
                            }`}
                          >
                            <svg
                              viewBox="0 0 20 20"
                              className="h-3 w-3"
                              fill="currentColor"
                            >
                              <path d="M7.5 13.2 4.5 10.3l-1.2 1.2 4.2 4.1 8-8-1.2-1.2-6.2 6.2z" />
                            </svg>
                          </span>
                          <span
                            className={
                              requirements[item.key]
                                ? "text-emerald-600"
                                : "text-slate-500"
                            }
                          >
                            {item.label}
                          </span>
                        </div>
                      ))}
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
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {session.device}
                          </p>
                          <p className="text-xs text-slate-500">
                            {session.location} - {session.ip}
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
              </div>
            )}
            {activeTab === "Notifications" && (
              <motion.section
                {...fadeUp}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h3 className="font-heading text-xl text-slate-900">
                  Email Notifications
                </h3>
                <div className="mt-4 space-y-3">
                  {[
                    {
                      key: "announcement",
                      label: "New announcement from teacher",
                      desc: "Get emailed when teacher posts an announcement",
                    },
                    {
                      key: "installment",
                      label: "Installment due reminder",
                      desc: "Get reminded 3 days before installment due",
                    },
                    {
                      key: "quiz",
                      label: "Quiz available",
                      desc: "Get notified when a new quiz is assigned",
                    },
                    {
                      key: "session",
                      label: "Live session reminder",
                      desc: "Get reminded 1 hour before a live session",
                    },
                    {
                      key: "certificate",
                      label: "Certificate issued",
                      desc: "Get emailed when your certificate is ready",
                    },
                    {
                      key: "completion",
                      label: "Course completion",
                      desc: "Get a summary email when you complete a course",
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

export default StudentSettings;
