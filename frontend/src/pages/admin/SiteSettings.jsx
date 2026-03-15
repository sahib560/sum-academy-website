import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSiteSettings } from "../../context/SiteSettingsContext.jsx";

const tabs = [
  "General",
  "Appearance",
  "Content",
  "Email Settings",
  "Payment Settings",
  "Security Settings",
  "Email Templates",
];

const emailTemplates = [
  "Registration OTP",
  "Forgot Password",
  "Payment Confirmation",
  "Certificate Issued",
  "Installment Reminder",
  "New Device Login Alert",
];

const variables = [
  "{{student_name}}",
  "{{otp_code}}",
  "{{course_name}}",
  "{{payment_amount}}",
  "{{certificate_id}}",
  "{{due_date}}",
];

const defaultTemplateBody = `Hello {{student_name}},

Your OTP code is {{otp_code}}. It will expire in 10 minutes.

Thank you,
SUM Academy`;

function SiteSettings() {
  const { settings, updateSettings } = useSiteSettings();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("General");
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasMounted = useRef(false);

  const [general, setGeneral] = useState(settings.general);

  const [appearance, setAppearance] = useState(settings.appearance);

  const [content, setContent] = useState(settings.content);

  const [emailSettings, setEmailSettings] = useState({
    host: "",
    port: "587",
    email: "",
    password: "",
    fromName: "SUM Academy",
    testEmail: "",
  });

  const [paymentSettings, setPaymentSettings] = useState({
    jazzcash: { id: "", password: "", salt: "", enabled: true },
    easypaisa: { account: "", username: "", password: "", enabled: false },
    bank: {
      bankName: "",
      accountTitle: "",
      accountNumber: "",
      iban: "",
      enabled: true,
    },
  });

  const [security, setSecurity] = useState({
    maxAttempts: 5,
    lockout: 15,
    accessExpiry: 15,
    refreshExpiry: 7,
    sessionTimeout: 30,
    singleDevice: true,
    maintenance: false,
  });

  const [templates, setTemplates] = useState({
    current: "Registration OTP",
    subject: "Your OTP Code",
    body: defaultTemplateBody,
  });

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setGeneral(settings.general);
    setAppearance(settings.appearance);
    setContent(settings.content);
  }, [settings]);

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    setDirty(true);
  }, [
    general,
    appearance,
    content,
    emailSettings,
    paymentSettings,
    security,
    templates,
  ]);

  const handleSave = (message, updater) => {
    setSaving(true);
    setTimeout(() => {
      if (updater) {
        updateSettings(updater);
      }
      setSaving(false);
      setDirty(false);
      setToast({ type: "success", message });
    }, 1200);
  };

  const uploadPreview = (event, key) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setGeneral((prev) => ({
        ...prev,
        [key]: String(reader.result || ""),
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (event, key) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setGeneral((prev) => ({
        ...prev,
        [key]: String(reader.result || ""),
      }));
    };
    reader.readAsDataURL(file);
  };

  const previewStyles = useMemo(
    () => ({
      fontFamily: appearance.font,
      borderColor: appearance.primaryColor,
      background: appearance.darkMode ? "#0d0f1a" : "#ffffff",
      color: appearance.darkMode ? "#ffffff" : "#0f172a",
    }),
    [appearance]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Site Settings</h2>
          <p className="text-sm text-slate-500">
            Configure branding, email, and platform preferences.
          </p>
        </div>
        {dirty && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
            Unsaved changes
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className="space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                activeTab === tab
                  ? "bg-primary text-white shadow-lg shadow-primary/30"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-primary/30"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {loading ? (
            <div className="space-y-4">
              <div className="skeleton h-6 w-1/3" />
              <div className="skeleton h-12 w-full" />
              <div className="skeleton h-12 w-full" />
              <div className="skeleton h-12 w-3/4" />
            </div>
          ) : (
            <>
              {activeTab === "General" && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Site Name
                      </label>
                      <input
                        type="text"
                        value={general.siteName}
                        onChange={(event) =>
                          setGeneral((prev) => ({
                            ...prev,
                            siteName: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Site Tagline
                      </label>
                      <input
                        type="text"
                        value={general.tagline}
                        onChange={(event) =>
                          setGeneral((prev) => ({
                            ...prev,
                            tagline: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Contact Email
                      </label>
                      <input
                        type="email"
                        value={general.contactEmail}
                        onChange={(event) =>
                          setGeneral((prev) => ({
                            ...prev,
                            contactEmail: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Contact Phone
                      </label>
                      <input
                        type="text"
                        value={general.contactPhone}
                        onChange={(event) =>
                          setGeneral((prev) => ({
                            ...prev,
                            contactPhone: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-400">
                      Address
                    </label>
                    <textarea
                      value={general.address}
                      onChange={(event) =>
                        setGeneral((prev) => ({
                          ...prev,
                          address: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Logo Upload
                      </label>
                      <div
                        className="mt-2 rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDrop(event, "logoPreview")}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            uploadPreview(event, "logoPreview")
                          }
                        />
                        {general.logoPreview && (
                          <img
                            src={general.logoPreview}
                            alt="Logo preview"
                            className="mx-auto mt-3 h-16 w-16 rounded-xl object-cover"
                          />
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Favicon Upload
                      </label>
                      <div
                        className="mt-2 rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDrop(event, "faviconPreview")}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            uploadPreview(event, "faviconPreview")
                          }
                        />
                        {general.faviconPreview && (
                          <img
                            src={general.faviconPreview}
                            alt="Favicon preview"
                            className="mx-auto mt-3 h-12 w-12 rounded-lg object-cover"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() =>
                      handleSave("General settings saved.", { general })
                    }
                    disabled={saving}
                  >
                    {saving ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                        Saving...
                      </span>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              )}

              {activeTab === "Appearance" && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Primary Color
                      </label>
                      <input
                        type="color"
                        value={appearance.primaryColor}
                        onChange={(event) =>
                          setAppearance((prev) => ({
                            ...prev,
                            primaryColor: event.target.value,
                          }))
                        }
                        className="mt-2 h-12 w-full rounded-xl border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Accent Color
                      </label>
                      <input
                        type="color"
                        value={appearance.accentColor}
                        onChange={(event) =>
                          setAppearance((prev) => ({
                            ...prev,
                            accentColor: event.target.value,
                          }))
                        }
                        className="mt-2 h-12 w-full rounded-xl border border-slate-200"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Dark Mode Default
                        </p>
                        <p className="text-xs text-slate-500">
                          Enable dark theme by default.
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                          appearance.darkMode ? "bg-primary" : "bg-slate-200"
                        }`}
                        onClick={() =>
                          setAppearance((prev) => ({
                            ...prev,
                            darkMode: !prev.darkMode,
                          }))
                        }
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                            appearance.darkMode
                              ? "translate-x-5"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Font
                      </label>
                      <select
                        value={appearance.font}
                        onChange={(event) =>
                          setAppearance((prev) => ({
                            ...prev,
                            font: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option>DM Sans</option>
                        <option>Inter</option>
                        <option>Poppins</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Live Preview
                    </p>
                    <div
                      className="mt-2 rounded-2xl border p-4"
                      style={previewStyles}
                    >
                      <h4 className="text-lg font-semibold">
                        SUM Academy Preview
                      </h4>
                      <p className="text-sm opacity-80">
                        Preview how your colors and typography will appear.
                      </p>
                      <button
                        className="mt-3 rounded-full px-4 py-2 text-xs font-semibold"
                        style={{
                          background: appearance.primaryColor,
                          color: "#fff",
                        }}
                      >
                        Primary Button
                      </button>
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() =>
                      handleSave("Appearance settings saved.", { appearance })
                    }
                    disabled={saving}
                  >
                    {saving ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                        Saving...
                      </span>
                    ) : (
                      "Save Appearance"
                    )}
                  </button>
                </div>
              )}

              {activeTab === "Content" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-heading text-xl text-slate-900">
                      Home Hero
                    </h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {[
                        ["Hero Badge", "heroBadge"],
                        ["Hero Title", "heroTitle"],
                        ["Primary CTA Label", "heroPrimaryLabel"],
                        ["Primary CTA Link", "heroPrimaryLink"],
                        ["Secondary CTA Label", "heroSecondaryLabel"],
                        ["Secondary CTA Link", "heroSecondaryLink"],
                      ].map(([label, key]) => (
                        <div key={key}>
                          <label className="text-xs font-semibold uppercase text-slate-400">
                            {label}
                          </label>
                          <input
                            type="text"
                            value={content[key]}
                            onChange={(event) =>
                              setContent((prev) => ({
                                ...prev,
                                [key]: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                        </div>
                      ))}
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold uppercase text-slate-400">
                          Hero Subtitle
                        </label>
                        <textarea
                          value={content.heroSubtitle}
                          onChange={(event) =>
                            setContent((prev) => ({
                              ...prev,
                              heroSubtitle: event.target.value,
                            }))
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-heading text-xl text-slate-900">
                      About Page
                    </h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {[
                        ["About Hero Title", "aboutHeroTitle"],
                        ["Story Title", "aboutStoryTitle"],
                      ].map(([label, key]) => (
                        <div key={key}>
                          <label className="text-xs font-semibold uppercase text-slate-400">
                            {label}
                          </label>
                          <input
                            type="text"
                            value={content[key]}
                            onChange={(event) =>
                              setContent((prev) => ({
                                ...prev,
                                [key]: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                        </div>
                      ))}
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold uppercase text-slate-400">
                          Mission Statement
                        </label>
                        <textarea
                          value={content.aboutMission}
                          onChange={(event) =>
                            setContent((prev) => ({
                              ...prev,
                              aboutMission: event.target.value,
                            }))
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          rows={3}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold uppercase text-slate-400">
                          Story Body
                        </label>
                        <textarea
                          value={content.aboutStoryBody}
                          onChange={(event) =>
                            setContent((prev) => ({
                              ...prev,
                              aboutStoryBody: event.target.value,
                            }))
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          rows={4}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-heading text-xl text-slate-900">
                      Contact Page
                    </h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {[
                        ["Contact Hero Title", "contactHeroTitle"],
                        ["Office Hours", "officeHours"],
                      ].map(([label, key]) => (
                        <div key={key}>
                          <label className="text-xs font-semibold uppercase text-slate-400">
                            {label}
                          </label>
                          <input
                            type="text"
                            value={content[key]}
                            onChange={(event) =>
                              setContent((prev) => ({
                                ...prev,
                                [key]: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                        </div>
                      ))}
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold uppercase text-slate-400">
                          Contact Subtitle
                        </label>
                        <textarea
                          value={content.contactHeroSubtitle}
                          onChange={(event) =>
                            setContent((prev) => ({
                              ...prev,
                              contactHeroSubtitle: event.target.value,
                            }))
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-heading text-xl text-slate-900">
                      Footer
                    </h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {[
                        ["CTA Title", "footerCtaTitle"],
                        ["CTA Subtitle", "footerCtaSubtitle"],
                        ["CTA Button", "footerCtaButton"],
                        ["Copyright Text", "footerCopyright"],
                      ].map(([label, key]) => (
                        <div key={key}>
                          <label className="text-xs font-semibold uppercase text-slate-400">
                            {label}
                          </label>
                          <input
                            type="text"
                            value={content[key]}
                            onChange={(event) =>
                              setContent((prev) => ({
                                ...prev,
                                [key]: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                        </div>
                      ))}
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold uppercase text-slate-400">
                          Footer Description
                        </label>
                        <textarea
                          value={content.footerDescription}
                          onChange={(event) =>
                            setContent((prev) => ({
                              ...prev,
                              footerDescription: event.target.value,
                            }))
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-heading text-xl text-slate-900">
                      Navigation & Social Links
                    </h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {[
                        ["Navbar LMS Label", "navbarLmsLabel"],
                        ["Navbar Sign In Label", "navbarSignInLabel"],
                        ["Navbar Get Started Label", "navbarGetStartedLabel"],
                        ["Facebook URL", "facebookUrl"],
                        ["WhatsApp URL", "whatsappUrl"],
                        ["TikTok URL", "tiktokUrl"],
                      ].map(([label, key]) => (
                        <div key={key}>
                          <label className="text-xs font-semibold uppercase text-slate-400">
                            {label}
                          </label>
                          <input
                            type="text"
                            value={content[key]}
                            onChange={(event) =>
                              setContent((prev) => ({
                                ...prev,
                                [key]: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={() => handleSave("Content settings saved.", { content })}
                    disabled={saving}
                  >
                    {saving ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                        Saving...
                      </span>
                    ) : (
                      "Save Content"
                    )}
                  </button>
                </div>
              )}

              {activeTab === "Email Settings" && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      ["SMTP Host", "host"],
                      ["SMTP Port", "port"],
                      ["SMTP Email", "email"],
                      ["SMTP Password", "password"],
                      ["From Name", "fromName"],
                    ].map(([label, key]) => (
                      <div key={key}>
                        <label className="text-xs font-semibold uppercase text-slate-400">
                          {label}
                        </label>
                        <input
                          type={key === "password" ? "password" : "text"}
                          value={emailSettings[key]}
                          onChange={(event) =>
                            setEmailSettings((prev) => ({
                              ...prev,
                              [key]: event.target.value,
                            }))
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-slate-200 px-4 py-3">
                    <label className="text-xs font-semibold uppercase text-slate-400">
                      Send Test Email
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        type="email"
                        value={emailSettings.testEmail}
                        onChange={(event) =>
                          setEmailSettings((prev) => ({
                            ...prev,
                            testEmail: event.target.value,
                          }))
                        }
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="test@example.com"
                      />
                      <button
                        className="btn-outline"
                        onClick={() =>
                          setToast({
                            type: "success",
                            message: "Test email sent.",
                          })
                        }
                      >
                        Send Test Email
                      </button>
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => handleSave("Email settings saved.")}
                    disabled={saving}
                  >
                    {saving ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                        Saving...
                      </span>
                    ) : (
                      "Save Email Settings"
                    )}
                  </button>
                </div>
              )}

              {activeTab === "Payment Settings" && (
                <div className="space-y-4">
                  {[
                    {
                      title: "JazzCash",
                      fields: [
                        ["Merchant ID", "id"],
                        ["Password", "password"],
                        ["Integrity Salt", "salt"],
                      ],
                      key: "jazzcash",
                    },
                    {
                      title: "EasyPaisa",
                      fields: [
                        ["Account Number", "account"],
                        ["Username", "username"],
                        ["Password", "password"],
                      ],
                      key: "easypaisa",
                    },
                    {
                      title: "Bank Transfer",
                      fields: [
                        ["Bank Name", "bankName"],
                        ["Account Title", "accountTitle"],
                        ["Account Number", "accountNumber"],
                        ["IBAN", "iban"],
                      ],
                      key: "bank",
                    },
                  ].map((section) => (
                    <div
                      key={section.key}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {section.title}
                        </h3>
                        <button
                          className="btn-outline"
                          onClick={() =>
                            setToast({
                              type: "success",
                              message: `${section.title} connection tested.`,
                            })
                          }
                        >
                          Test Connection
                        </button>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {section.fields.map(([label, key]) => (
                          <div key={key}>
                            <label className="text-xs font-semibold uppercase text-slate-400">
                              {label}
                            </label>
                            <input
                              type={
                                label.toLowerCase().includes("password")
                                  ? "password"
                                  : "text"
                              }
                              value={paymentSettings[section.key][key]}
                              onChange={(event) =>
                                setPaymentSettings((prev) => ({
                                  ...prev,
                                  [section.key]: {
                                    ...prev[section.key],
                                    [key]: event.target.value,
                                  },
                                }))
                              }
                              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Enable {section.title}
                          </p>
                        </div>
                        <button
                          type="button"
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                            paymentSettings[section.key].enabled
                              ? "bg-emerald-500"
                              : "bg-slate-200"
                          }`}
                          onClick={() =>
                            setPaymentSettings((prev) => ({
                              ...prev,
                              [section.key]: {
                                ...prev[section.key],
                                enabled: !prev[section.key].enabled,
                              },
                            }))
                          }
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                              paymentSettings[section.key].enabled
                                ? "translate-x-5"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    className="btn-primary"
                    onClick={() => handleSave("Payment settings saved.")}
                    disabled={saving}
                  >
                    {saving ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                        Saving...
                      </span>
                    ) : (
                      "Save Payment Settings"
                    )}
                  </button>
                </div>
              )}

              {activeTab === "Security Settings" && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      ["Max login attempts", "maxAttempts"],
                      ["Account lockout duration (min)", "lockout"],
                      ["JWT access token expiry (min)", "accessExpiry"],
                      ["Refresh token expiry (days)", "refreshExpiry"],
                      ["Session timeout (min)", "sessionTimeout"],
                    ].map(([label, key]) => (
                      <div key={key}>
                        <label className="text-xs font-semibold uppercase text-slate-400">
                          {label}
                        </label>
                        <input
                          type="number"
                          value={security[key]}
                          onChange={(event) =>
                            setSecurity((prev) => ({
                              ...prev,
                              [key]: Number(event.target.value),
                            }))
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  {[
                    ["Force single device login", "singleDevice"],
                    ["Maintenance mode", "maintenance"],
                  ].map(([label, key]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {label}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                          security[key] ? "bg-primary" : "bg-slate-200"
                        }`}
                        onClick={() =>
                          setSecurity((prev) => ({
                            ...prev,
                            [key]: !prev[key],
                          }))
                        }
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                            security[key]
                              ? "translate-x-5"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn-primary"
                    onClick={() => handleSave("Security settings saved.")}
                    disabled={saving}
                  >
                    {saving ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                        Saving...
                      </span>
                    ) : (
                      "Save Security Settings"
                    )}
                  </button>
                </div>
              )}

              {activeTab === "Email Templates" && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Template
                      </label>
                      <select
                        value={templates.current}
                        onChange={(event) =>
                          setTemplates((prev) => ({
                            ...prev,
                            current: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        {emailTemplates.map((template) => (
                          <option key={template} value={template}>
                            {template}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={templates.subject}
                        onChange={(event) =>
                          setTemplates((prev) => ({
                            ...prev,
                            subject: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-400">
                      HTML Body
                    </label>
                    <textarea
                      value={templates.body}
                      onChange={(event) =>
                        setTemplates((prev) => ({
                          ...prev,
                          body: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      rows={6}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {variables.map((variable) => (
                      <span
                        key={variable}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                      >
                        {variable}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="btn-outline"
                      onClick={() => setPreviewOpen(true)}
                    >
                      Preview
                    </button>
                    <button
                      className="btn-outline"
                      onClick={() =>
                        setTemplates((prev) => ({
                          ...prev,
                          body: defaultTemplateBody,
                          subject: "Your OTP Code",
                        }))
                      }
                    >
                      Reset to Default
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => handleSave("Template saved.")}
                      disabled={saving}
                    >
                      {saving ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                          Saving...
                        </span>
                      ) : (
                        "Save Template"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setPreviewOpen(false)}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-heading text-2xl text-slate-900">
              Template Preview
            </h3>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{templates.subject}</p>
              <pre className="mt-2 whitespace-pre-wrap font-sans">
                {templates.body}
              </pre>
            </div>
            <button
              className="btn-primary mt-6 w-full"
              onClick={() => setPreviewOpen(false)}
            >
              Close Preview
            </button>
          </motion.div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${
            toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default SiteSettings;
