import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import FileUploader from "../../components/FileUploader.jsx";
import {
  getEmailTemplates,
  getSiteSettings,
  testEmailSettings,
  updateAboutSettings,
  updateAppearanceSettings,
  updateContactSettings,
  updateEmailSettings,
  updateEmailTemplate,
  updateFeaturesSettings,
  updateFooterSettings,
  updateGeneralSettings,
  updateHeroSettings,
  updateHowItWorksSettings,
  updateMaintenanceSettings,
  updatePaymentSettings,
  updateCertificateSettings,
  updateSecuritySettings,
  updateTestimonialsSettings,
  uploadApkFile,
} from "../../services/admin.service.js";
import { defaultSettings } from "../../context/SettingsContext.jsx";
import { storage } from "../../config/firebase.js";
import { useSettings } from "../../hooks/useSettings.js";
import { sanitizePhoneInput } from "../../utils/phone.js";
import { uploadLogo as uploadLogoToStorage } from "../../utils/firebaseUpload.js";

const tabs = [
  "General",
  "Hero",
  "How It Works",
  "Features",
  "Testimonials",
  "About",
  "Contact",
  "Footer",
  "Appearance",
  "Certificates",
  "Maintenance",
  "Email",
  "Payment",
  "Security",
  "Templates",
];

const sectionKeyByTab = {
  General: "general",
  Hero: "hero",
  "How It Works": "howItWorks",
  Features: "features",
  Testimonials: "testimonials",
  About: "about",
  Contact: "contact",
  Footer: "footer",
  Appearance: "appearance",
  Certificates: "certificate",
  Maintenance: "maintenance",
  Email: "email",
  Payment: "payment",
  Security: "security",
  Templates: "emailTemplates",
};

const templateOptions = [
  "Registration OTP",
  "Forgot Password OTP",
  "Payment Confirmation",
  "Certificate Issued",
  "Installment Reminder",
  "New Device Login Alert",
  "Announcement Notification",
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const mergeDeep = (target, source) => {
  const output = { ...target };
  Object.keys(source || {}).forEach((key) => {
    const sourceValue = source[key];
    const targetValue = target?.[key];
    if (
      sourceValue &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      output[key] = mergeDeep(targetValue, sourceValue);
    } else {
      output[key] = sourceValue;
    }
  });
  return output;
};

const isEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const isHex = (value) =>
  /^#([A-Fa-f0-9]{6})$/.test(String(value || "").trim());

const fieldLabelClass =
  "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500";

function SiteSettings() {
  const queryClient = useQueryClient();
  const { refetchSettings } = useSettings();
  const [activeTab, setActiveTab] = useState("General");
  const [pendingTab, setPendingTab] = useState(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [templateName, setTemplateName] = useState(templateOptions[0]);
  const [testEmail, setTestEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [uploadingAsset, setUploadingAsset] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["site-settings-admin-all"],
    queryFn: getSiteSettings,
  });
  const templatesQuery = useQuery({
    queryKey: ["site-settings-admin-templates"],
    queryFn: getEmailTemplates,
  });

  const [draft, setDraft] = useState(clone(defaultSettings));
  const [baseline, setBaseline] = useState(clone(defaultSettings));

  useEffect(() => {
    if (!settingsQuery.data) return;
    const merged = mergeDeep(defaultSettings, settingsQuery.data || {});
    const templates = templatesQuery.data?.templates || merged.emailTemplates?.templates || {};
    const next = {
      ...merged,
      emailTemplates: { templates },
    };
    setDraft(next);
    setBaseline(clone(next));
  }, [settingsQuery.data, templatesQuery.data]);

  const sectionKey = sectionKeyByTab[activeTab];
  const isDirty = useMemo(
    () =>
      JSON.stringify(draft?.[sectionKey] || {}) !==
      JSON.stringify(baseline?.[sectionKey] || {}),
    [baseline, draft, sectionKey]
  );

  const updateSection = (key, updater) => {
    setDraft((prev) => ({
      ...prev,
      [key]:
        typeof updater === "function"
          ? updater(prev[key])
          : { ...prev[key], ...updater },
    }));
  };

  const validate = () => {
    const next = {};
    if (activeTab === "General") {
      if (!draft.general.siteName || draft.general.siteName.trim().length < 3) {
        next.siteName = "Site name must be at least 3 characters.";
      }
      if (draft.general.contactEmail && !isEmail(draft.general.contactEmail)) {
        next.contactEmail = "Contact email is invalid.";
      }
    }
    if (activeTab === "Hero" && (!draft.hero.heading || draft.hero.heading.trim().length < 5)) {
      next.heading = "Hero heading must be at least 5 characters.";
    }
    if (activeTab === "Appearance") {
      if (!isHex(draft.appearance.primaryColor)) next.primaryColor = "Invalid primary color.";
      if (!isHex(draft.appearance.accentColor)) next.accentColor = "Invalid accent color.";
      const extraColors = [
        "secondaryColor",
        "successColor",
        "warningColor",
        "dangerColor",
        "infoColor",
        "surfaceColor",
        "backgroundColor",
        "textColor",
        "mutedTextColor",
        "borderColor",
      ];
      extraColors.forEach((key) => {
        if (!isHex(draft.appearance[key])) next[key] = `Invalid ${key}.`;
      });
    }
    if (activeTab === "Certificates") {
      const cert = draft.certificate || {};
      ["borderColor", "headingColor", "nameColor", "bodyColor", "backgroundColor"].forEach(
        (key) => {
          if (!isHex(cert[key])) next[key] = `Invalid ${key}.`;
        }
      );
    }
    if (activeTab === "Email") {
      if (!draft.email.smtpHost?.trim()) next.smtpHost = "SMTP host is required.";
      if (draft.email.smtpEmail && !isEmail(draft.email.smtpEmail)) {
        next.smtpEmail = "SMTP email is invalid.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = draft[sectionKey];
      switch (activeTab) {
        case "General":
          return updateGeneralSettings(payload);
        case "Hero":
          return updateHeroSettings(payload);
        case "How It Works":
          return updateHowItWorksSettings(payload);
        case "Features":
          return updateFeaturesSettings(payload);
        case "Testimonials":
          return updateTestimonialsSettings(payload);
        case "About":
          return updateAboutSettings(payload);
        case "Contact":
          return updateContactSettings(payload);
        case "Footer":
          return updateFooterSettings(payload);
        case "Appearance":
          return updateAppearanceSettings(payload);
        case "Certificates":
          return updateCertificateSettings(payload);
        case "Maintenance":
          return updateMaintenanceSettings(payload);
        case "Email":
          return updateEmailSettings(payload);
        case "Payment":
          return updatePaymentSettings(payload);
        case "Security":
          return updateSecuritySettings(payload);
        case "Templates":
          return updateEmailTemplate({
            templateName,
            subject: draft.emailTemplates.templates?.[templateName]?.subject || "",
            body: draft.emailTemplates.templates?.[templateName]?.body || "",
          });
        default:
          return null;
      }
    },
    onSuccess: () => {
      setBaseline(clone(draft));
      queryClient.invalidateQueries({ queryKey: ["site-settings-admin-all"] });
      queryClient.invalidateQueries({ queryKey: ["site-settings-admin-templates"] });
      refetchSettings();
      toast.success(`${activeTab} settings saved and applied!`);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || `Failed to save ${activeTab}`);
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: testEmailSettings,
    onSuccess: () => toast.success("Test email sent! Check your inbox."),
    onError: (error) =>
      toast.error(error?.response?.data?.message || "Failed to send test email"),
  });

  const onSave = () => {
    if (!validate()) return;
    saveMutation.mutate();
  };

  const switchTab = (nextTab) => {
    if (nextTab === activeTab) return;
    if (isDirty) {
      setPendingTab(nextTab);
      setUnsavedOpen(true);
      return;
    }
    setActiveTab(nextTab);
  };

  const discardChanges = () => {
    setDraft((prev) => ({ ...prev, [sectionKey]: clone(baseline[sectionKey]) }));
    setUnsavedOpen(false);
    if (pendingTab) setActiveTab(pendingTab);
    setPendingTab(null);
  };

  const currentTemplate = draft.emailTemplates?.templates?.[templateName] || {
    subject: "",
    body: "",
  };

  const updateArrayItem = (section, listKey, index, patch) => {
    updateSection(section, {
      [listKey]: (draft[section][listKey] || []).map((item, idx) =>
        idx === index ? { ...item, ...patch } : item
      ),
    });
  };

  const removeArrayItem = (section, listKey, index) => {
    updateSection(section, {
      [listKey]: (draft[section][listKey] || []).filter((ignore, idx) => idx !== index),
    });
  };

  const addArrayItem = (section, listKey, item) => {
    updateSection(section, {
      [listKey]: [...(draft[section][listKey] || []), item],
    });
  };

  const toDateTimeLocalValue = (value) => {
    if (!value) return "";
    const raw = String(value || "").trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const y = parsed.getFullYear();
    const m = pad(parsed.getMonth() + 1);
    const d = pad(parsed.getDate());
    const hh = pad(parsed.getHours());
    const mm = pad(parsed.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  };

  const updateNestedArrayItem = (section, nestedKey, listKey, index, patch) => {
    const nested = draft?.[section]?.[nestedKey] || {};
    const list = Array.isArray(nested?.[listKey]) ? nested[listKey] : [];
    updateSection(section, {
      [nestedKey]: {
        ...nested,
        [listKey]: list.map((item, idx) =>
          idx === index ? { ...item, ...patch } : item
        ),
      },
    });
  };

  const removeNestedArrayItem = (section, nestedKey, listKey, index) => {
    const nested = draft?.[section]?.[nestedKey] || {};
    const list = Array.isArray(nested?.[listKey]) ? nested[listKey] : [];
    updateSection(section, {
      [nestedKey]: {
        ...nested,
        [listKey]: list.filter((ignore, idx) => idx !== index),
      },
    });
  };

  const addNestedArrayItem = (section, nestedKey, listKey, item) => {
    const nested = draft?.[section]?.[nestedKey] || {};
    const list = Array.isArray(nested?.[listKey]) ? nested[listKey] : [];
    updateSection(section, {
      [nestedKey]: {
        ...nested,
        [listKey]: [...list, item],
      },
    });
  };

  const renderColorField = (label, key, placeholder) => (
    <div className="space-y-1" key={key}>
      <p className={fieldLabelClass}>{label} Color</p>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={draft.appearance[key] || placeholder}
          onChange={(e) =>
            updateSection("appearance", { [key]: e.target.value })
          }
          className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
          aria-label={`${label} color picker`}
        />
        <input
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder={placeholder}
          value={draft.appearance[key]}
          onChange={(e) =>
            updateSection("appearance", { [key]: e.target.value })
          }
        />
      </div>
    </div>
  );

  const handleAssetUpload = async (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isLogo = field === "logoUrl";
    const isCertificate =
      field === "certificateLogoUrl" || field === "certificateSignatureUrl";
    const isCertLogo = field === "certificateLogoUrl";
    const allowed = isLogo
      ? ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]
      : isCertificate
        ? ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]
        : ["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      toast.error("Unsupported file type.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be 2MB or less.");
      return;
    }

    try {
      setUploadingAsset(field);
      const fileRef = ref(
        storage,
        `settings/${field}/${Date.now()}-${file.name}`
      );
      const uploadTask = uploadBytesResumable(fileRef, file);
      await new Promise((resolve, reject) => {
        uploadTask.on("state_changed", null, reject, resolve);
      });
      const url = await getDownloadURL(fileRef);
      if (isCertificate) {
        updateSection("certificate", {
          [isCertLogo ? "logoUrl" : "signatureUrl"]: url,
        });
        toast.success(isCertLogo ? "Certificate logo uploaded." : "Signature uploaded.");
      } else {
        updateSection("general", { [field]: url });
        toast.success(isLogo ? "Logo uploaded." : "Favicon uploaded.");
      }
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploadingAsset("");
    }
  };

  const handleLogoUpload = async (file, { onProgress }) => {
    const uploaded = await uploadLogoToStorage(file, onProgress);
    await updateGeneralSettings({
      ...draft.general,
      logoUrl: uploaded.url,
    });
    updateSection("general", { logoUrl: uploaded.url });
    setBaseline((prev) => ({
      ...prev,
      general: {
        ...prev.general,
        logoUrl: uploaded.url,
      },
    }));
    queryClient.invalidateQueries({ queryKey: ["site-settings-admin-all"] });
    refetchSettings();
    toast.success("Logo uploaded and saved.");
    return uploaded;
  };

  const handleApkUpload = async (file, { onProgress } = {}) => {
    const fileName = String(file?.name || "").toLowerCase();
    const mimeType = String(file?.type || "").toLowerCase();
    const allowedMimeTypes = [
      "application/vnd.android.package-archive",
      "application/x-android-package",
      "application/octet-stream",
      "application/zip",
      "application/x-zip-compressed",
      "multipart/x-zip",
      "application/java-archive",
      "",
    ];

    if (!fileName.endsWith(".apk")) {
      throw new Error("Only APK file is allowed");
    }
    if (!allowedMimeTypes.includes(mimeType)) {
      throw new Error("Invalid APK mime type");
    }
    if (Number(file?.size || 0) > 300 * 1024 * 1024) {
      throw new Error("APK max size is 300MB");
    }

    const response = await uploadApkFile(file, (event) => {
      if (!event?.total) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      if (typeof onProgress === "function") onProgress(pct);
    });
    const data = response?.data || {};
    const apkUrl = data?.url || "";

    if (!apkUrl) {
      throw new Error("APK upload failed");
    }

    updateSection("general", {
      apkUrl,
      apkFileName: data?.fileName || file.name,
      apkMimeType: file.type || "application/vnd.android.package-archive",
      apkSize: Number(data?.size || file.size || 0) || null,
    });
    setBaseline((prev) => ({
      ...prev,
      general: {
        ...prev.general,
        apkUrl,
        apkFileName: data?.fileName || file.name,
        apkMimeType: file.type || "application/vnd.android.package-archive",
        apkSize: Number(data?.size || file.size || 0) || null,
      },
    }));
    queryClient.invalidateQueries({ queryKey: ["site-settings-admin-all"] });
    refetchSettings();
    toast.success("APK uploaded and linked to Download App.");

    return {
      url: apkUrl,
      name: data?.fileName || file.name,
      size: Number(data?.size || file.size || 0) || null,
      type: file.type || "application/vnd.android.package-archive",
    };
  };

  const renderTab = () => {
    if (activeTab === "General") {
      return (
        <>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Site Name</p>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Site Name"
              value={draft.general.siteName}
              onChange={(e) =>
                updateSection("general", { siteName: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Tagline</p>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Tagline"
              value={draft.general.tagline}
              onChange={(e) => updateSection("general", { tagline: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Description</p>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              placeholder="Description"
              value={draft.general.description}
              onChange={(e) =>
                updateSection("general", { description: e.target.value })
              }
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className={fieldLabelClass}>Contact Email</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Contact Email"
                value={draft.general.contactEmail}
                onChange={(e) =>
                  updateSection("general", { contactEmail: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Contact Phone</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="03001234567 or +923001234567"
                value={draft.general.contactPhone}
                onChange={(e) =>
                  updateSection("general", {
                    contactPhone: sanitizePhoneInput(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Address</p>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              rows={2}
              placeholder="Address"
              value={draft.general.address}
              onChange={(e) => updateSection("general", { address: e.target.value })}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className={fieldLabelClass}>Logo URL</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Logo URL"
                value={draft.general.logoUrl || ""}
                onChange={(e) =>
                  updateSection("general", { logoUrl: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Favicon URL</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Favicon URL"
                value={draft.general.faviconUrl || ""}
                onChange={(e) =>
                  updateSection("general", { faviconUrl: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Android APK URL</p>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="https://storage.googleapis.com/.../app-release.apk"
              value={draft.general.apkUrl || ""}
              onChange={(e) =>
                updateSection("general", { apkUrl: e.target.value })
              }
            />
          </div>
          <div className="grid gap-3 rounded-2xl border border-slate-200 p-3 md:grid-cols-2">
            <FileUploader
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              maxSize={2}
              label="Upload Logo"
              hint="JPG, PNG, WEBP, SVG — max 2MB"
              disabled={uploadingAsset === "logoUrl"}
              onUpload={handleLogoUpload}
            />
            <label className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Upload Favicon
              <input
                type="file"
                accept=".png,.ico,.svg"
                className="mt-2 block w-full text-xs"
                onChange={(e) => handleAssetUpload(e, "faviconUrl")}
              />
              {uploadingAsset === "faviconUrl" ? (
                <span className="text-xs text-slate-500">Uploading...</span>
              ) : null}
            </label>
          </div>
          <div className="rounded-2xl border border-slate-200 p-3">
            <FileUploader
              accept=".apk,application/vnd.android.package-archive,application/octet-stream"
              maxSize={300}
              label="Upload Android APK"
              hint="APK file - max 300MB. This powers the public Download App button."
              onUpload={handleApkUpload}
            />
            {draft.general.apkFileName ? (
              <p className="mt-2 text-xs text-slate-500">
                Current APK: {draft.general.apkFileName}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className={fieldLabelClass}>Facebook URL</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Facebook URL"
                value={draft.general.socialLinks?.facebook || ""}
                onChange={(e) =>
                  updateSection("general", {
                    socialLinks: {
                      ...draft.general.socialLinks,
                      facebook: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Instagram URL</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Instagram URL"
                value={draft.general.socialLinks?.instagram || ""}
                onChange={(e) =>
                  updateSection("general", {
                    socialLinks: {
                      ...draft.general.socialLinks,
                      instagram: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>YouTube URL</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="YouTube URL"
                value={draft.general.socialLinks?.youtube || ""}
                onChange={(e) =>
                  updateSection("general", {
                    socialLinks: {
                      ...draft.general.socialLinks,
                      youtube: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>WhatsApp URL</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="WhatsApp URL"
                value={draft.general.socialLinks?.whatsapp || ""}
                onChange={(e) =>
                  updateSection("general", {
                    socialLinks: {
                      ...draft.general.socialLinks,
                      whatsapp: e.target.value,
                    },
                  })
                }
              />
            </div>
          </div>
        </>
      );
    }

    if (activeTab === "Hero") {
      return (
        <>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Hero Heading</p>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Heading"
              value={draft.hero.heading}
              onChange={(e) => updateSection("hero", { heading: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Hero Subheading</p>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              placeholder="Subheading"
              value={draft.hero.subheading}
              onChange={(e) =>
                updateSection("hero", { subheading: e.target.value })
              }
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <p className={fieldLabelClass}>Primary CTA</p>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Primary CTA" value={draft.hero.ctaPrimary} onChange={(e) => updateSection("hero", { ctaPrimary: e.target.value })} />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Secondary CTA</p>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Secondary CTA" value={draft.hero.ctaSecondary} onChange={(e) => updateSection("hero", { ctaSecondary: e.target.value })} />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Hero Badge</p>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Badge" value={draft.hero.badge} onChange={(e) => updateSection("hero", { badge: e.target.value })} />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Stats</p>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
                onClick={() => addArrayItem("hero", "stats", { label: "", value: "" })}
              >
                Add
              </button>
            </div>
            {(draft.hero.stats || []).map((item, index) => (
              <div key={`hero-stat-${index}`} className="mb-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1">
                  <p className={fieldLabelClass}>Stat Label</p>
                  <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Label" value={item.label} onChange={(e) => updateArrayItem("hero", "stats", index, { label: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <p className={fieldLabelClass}>Stat Value</p>
                  <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Value" value={item.value} onChange={(e) => updateArrayItem("hero", "stats", index, { value: e.target.value })} />
                </div>
                <button type="button" className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600" onClick={() => removeArrayItem("hero", "stats", index)}>Remove</button>
              </div>
            ))}
          </div>
        </>
      );
    }

    if (activeTab === "How It Works") {
      return (
        <>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Section Heading</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Heading" value={draft.howItWorks.heading} onChange={(e) => updateSection("howItWorks", { heading: e.target.value })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Section Subheading</p>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Subheading"
              value={draft.howItWorks.subheading || ""}
              onChange={(e) => updateSection("howItWorks", { subheading: e.target.value })}
            />
          </div>
          {(draft.howItWorks.steps || []).map((step, index) => (
            <div key={`step-${index}`} className="rounded-2xl border border-slate-200 p-3">
              <div className="mb-2 space-y-1">
                <p className={fieldLabelClass}>Step {index + 1} Title</p>
                <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Step Title" value={step.title} onChange={(e) => updateArrayItem("howItWorks", "steps", index, { title: e.target.value, number: index + 1 })} />
              </div>
              <div className="space-y-1">
                <p className={fieldLabelClass}>Step {index + 1} Description</p>
                <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} placeholder="Step Description" value={step.description} onChange={(e) => updateArrayItem("howItWorks", "steps", index, { description: e.target.value, number: index + 1 })} />
              </div>
            </div>
          ))}
          <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => addArrayItem("howItWorks", "steps", { number: (draft.howItWorks.steps?.length || 0) + 1, title: "", description: "" })}>Add Step</button>
        </>
      );
    }

    if (activeTab === "Features") {
      return (
        <>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Section Heading</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Heading" value={draft.features.heading} onChange={(e) => updateSection("features", { heading: e.target.value })} />
          </div>
          {(draft.features.items || []).map((item, index) => (
            <div key={`feature-${index}`} className="rounded-2xl border border-slate-200 p-3">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <p className={fieldLabelClass}>Feature Icon</p>
                  <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Icon" value={item.icon} onChange={(e) => updateArrayItem("features", "items", index, { icon: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <p className={fieldLabelClass}>Feature Title</p>
                  <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Title" value={item.title} onChange={(e) => updateArrayItem("features", "items", index, { title: e.target.value })} />
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <p className={fieldLabelClass}>Feature Description</p>
                <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} placeholder="Description" value={item.description} onChange={(e) => updateArrayItem("features", "items", index, { description: e.target.value })} />
              </div>
              <button type="button" className="mt-2 rounded-xl border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600" onClick={() => removeArrayItem("features", "items", index)}>Remove</button>
            </div>
          ))}
          <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => addArrayItem("features", "items", { icon: "sparkles", title: "", description: "" })}>Add Feature</button>
        </>
      );
    }

    if (activeTab === "Testimonials") {
      return (
        <>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Section Heading</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Heading" value={draft.testimonials.heading} onChange={(e) => updateSection("testimonials", { heading: e.target.value })} />
          </div>
          {(draft.testimonials.items || []).map((item, index) => (
            <div key={`testimonial-${index}`} className="rounded-2xl border border-slate-200 p-3">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <p className={fieldLabelClass}>Student Name</p>
                  <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Name" value={item.name} onChange={(e) => updateArrayItem("testimonials", "items", index, { name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <p className={fieldLabelClass}>Course Name</p>
                  <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Course" value={item.course} onChange={(e) => updateArrayItem("testimonials", "items", index, { course: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <p className={fieldLabelClass}>Rating (1-5)</p>
                  <input type="number" min="1" max="5" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Rating" value={item.rating} onChange={(e) => updateArrayItem("testimonials", "items", index, { rating: Number(e.target.value) || 1 })} />
                </div>
                <div className="space-y-1">
                  <p className={fieldLabelClass}>Avatar URL</p>
                  <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Avatar URL" value={item.avatar || ""} onChange={(e) => updateArrayItem("testimonials", "items", index, { avatar: e.target.value })} />
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <p className={fieldLabelClass}>Review Text</p>
                <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} placeholder="Review" value={item.review} onChange={(e) => updateArrayItem("testimonials", "items", index, { review: e.target.value })} />
              </div>
              <button type="button" className="mt-2 rounded-xl border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600" onClick={() => removeArrayItem("testimonials", "items", index)}>Remove</button>
            </div>
          ))}
          <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => addArrayItem("testimonials", "items", { name: "", course: "", rating: 5, review: "", avatar: "" })}>Add Testimonial</button>
        </>
      );
    }

    if (activeTab === "About") {
      return (
        <>
          <div className="space-y-1">
            <p className={fieldLabelClass}>About Heading</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Heading" value={draft.about.heading} onChange={(e) => updateSection("about", { heading: e.target.value })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Story Heading</p>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Story Heading"
              value={draft.about.storyHeading || ""}
              onChange={(e) => updateSection("about", { storyHeading: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Mission Statement</p>
            <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} placeholder="Mission" value={draft.about.mission} onChange={(e) => updateSection("about", { mission: e.target.value })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Vision Statement</p>
            <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} placeholder="Vision" value={draft.about.vision} onChange={(e) => updateSection("about", { vision: e.target.value })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Story</p>
            <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={3} placeholder="Story" value={draft.about.story} onChange={(e) => updateSection("about", { story: e.target.value })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Founded Year</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Founded Year" value={draft.about.foundedYear} onChange={(e) => updateSection("about", { foundedYear: e.target.value })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Values Heading</p>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Values Heading"
              value={draft.about.valuesHeading || ""}
              onChange={(e) => updateSection("about", { valuesHeading: e.target.value })}
            />
          </div>
          <div className="rounded-2xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-700">Certificate Section</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <p className={fieldLabelClass}>Heading</p>
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Heading"
                  value={draft.about.certificateHeading || ""}
                  onChange={(e) =>
                    updateSection("about", { certificateHeading: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <p className={fieldLabelClass}>Label</p>
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Label"
                  value={draft.about.certificateLabel || ""}
                  onChange={(e) =>
                    updateSection("about", { certificateLabel: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <p className={fieldLabelClass}>Title</p>
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Title"
                  value={draft.about.certificateTitle || ""}
                  onChange={(e) =>
                    updateSection("about", { certificateTitle: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <p className={fieldLabelClass}>Description</p>
                <textarea
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Description"
                  value={draft.about.certificateDescription || ""}
                  onChange={(e) =>
                    updateSection("about", { certificateDescription: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <p className={fieldLabelClass}>Sample Certificate ID</p>
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Sample ID"
                  value={draft.about.certificateSampleId || ""}
                  onChange={(e) =>
                    updateSection("about", { certificateSampleId: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <p className={fieldLabelClass}>Side Title</p>
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Side Title"
                  value={draft.about.certificateSideTitle || ""}
                  onChange={(e) =>
                    updateSection("about", { certificateSideTitle: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <p className={fieldLabelClass}>Side Description</p>
                <textarea
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Side Description"
                  value={draft.about.certificateSideDescription || ""}
                  onChange={(e) =>
                    updateSection("about", {
                      certificateSideDescription: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-700">About CTA</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <p className={fieldLabelClass}>Badge</p>
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Badge"
                  value={draft.about.ctaBadge || ""}
                  onChange={(e) => updateSection("about", { ctaBadge: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <p className={fieldLabelClass}>CTA Heading</p>
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Heading"
                  value={draft.about.ctaHeading || ""}
                  onChange={(e) => updateSection("about", { ctaHeading: e.target.value })}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <p className={fieldLabelClass}>CTA Description</p>
                <textarea
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Description"
                  value={draft.about.ctaDescription || ""}
                  onChange={(e) =>
                    updateSection("about", { ctaDescription: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <p className={fieldLabelClass}>CTA Button Label</p>
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Button Label"
                  value={draft.about.ctaLabel || ""}
                  onChange={(e) => updateSection("about", { ctaLabel: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Team Section Heading</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Team Heading" value={draft.about.teamHeading} onChange={(e) => updateSection("about", { teamHeading: e.target.value })} />
          </div>

          <div className="rounded-2xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-700">Leadership Team</p>
            {(draft.about.team || []).map((member, index) => (
              <div key={`about-team-${index}`} className="mt-3 rounded-xl border border-slate-200 p-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className={fieldLabelClass}>Member Name</p>
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Name"
                      value={member.name || ""}
                      onChange={(e) =>
                        updateArrayItem("about", "team", index, { name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <p className={fieldLabelClass}>Member Role</p>
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Role"
                      value={member.role || ""}
                      onChange={(e) =>
                        updateArrayItem("about", "team", index, { role: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className={fieldLabelClass}>Avatar URL</p>
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Avatar URL"
                      value={member.avatar || ""}
                      onChange={(e) =>
                        updateArrayItem("about", "team", index, { avatar: e.target.value })
                      }
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-2 rounded-xl border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                  onClick={() => removeArrayItem("about", "team", index)}
                >
                  Remove Member
                </button>
              </div>
            ))}
            <button
              type="button"
              className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              onClick={() => addArrayItem("about", "team", { name: "", role: "", avatar: "" })}
            >
              Add Team Member
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-700">Core Values</p>
            {(draft.about.values || []).map((valueItem, index) => (
              <div key={`about-value-${index}`} className="mt-3 rounded-xl border border-slate-200 p-3">
                <div className="space-y-1">
                  <p className={fieldLabelClass}>Value Title</p>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Title"
                    value={valueItem.title || ""}
                    onChange={(e) =>
                      updateArrayItem("about", "values", index, { title: e.target.value })
                    }
                  />
                </div>
                <div className="mt-2 space-y-1">
                  <p className={fieldLabelClass}>Value Description</p>
                  <textarea
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Description"
                    value={valueItem.description || ""}
                    onChange={(e) =>
                      updateArrayItem("about", "values", index, { description: e.target.value })
                    }
                  />
                </div>
                <button
                  type="button"
                  className="mt-2 rounded-xl border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                  onClick={() => removeArrayItem("about", "values", index)}
                >
                  Remove Value
                </button>
              </div>
            ))}
            <button
              type="button"
              className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              onClick={() => addArrayItem("about", "values", { title: "", description: "" })}
            >
              Add Value
            </button>
          </div>
        </>
      );
    }

    if (activeTab === "Contact") {
      return (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className={fieldLabelClass}>Contact Heading</p>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Heading" value={draft.contact.heading} onChange={(e) => updateSection("contact", { heading: e.target.value })} />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Contact Subheading</p>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Subheading" value={draft.contact.subheading} onChange={(e) => updateSection("contact", { subheading: e.target.value })} />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Support Email</p>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Email" value={draft.contact.email} onChange={(e) => updateSection("contact", { email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Support Phone</p>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="03001234567 or +923001234567" value={draft.contact.phone} onChange={(e) => updateSection("contact", { phone: sanitizePhoneInput(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>WhatsApp Number</p>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="03001234567 or +923001234567" value={draft.contact.whatsapp} onChange={(e) => updateSection("contact", { whatsapp: sanitizePhoneInput(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Office Hours</p>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Office Hours" value={draft.contact.officeHours} onChange={(e) => updateSection("contact", { officeHours: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Address</p>
            <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} placeholder="Address" value={draft.contact.address} onChange={(e) => updateSection("contact", { address: e.target.value })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Map Embed URL</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Map Embed URL" value={draft.contact.mapEmbedUrl} onChange={(e) => updateSection("contact", { mapEmbedUrl: e.target.value })} />
          </div>
          <div className="rounded-2xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-700">Contact Subjects</p>
            {(draft.contact.subjects || []).map((subject, index) => (
              <div key={`contact-subject-${index}`} className="mt-2 flex items-center gap-2">
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Subject"
                  value={subject || ""}
                  onChange={(e) => {
                    const nextSubjects = [...(draft.contact.subjects || [])];
                    nextSubjects[index] = e.target.value;
                    updateSection("contact", { subjects: nextSubjects });
                  }}
                />
                <button
                  type="button"
                  className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600"
                  onClick={() => {
                    const nextSubjects = (draft.contact.subjects || []).filter(
                      (ignore, idx) => idx !== index
                    );
                    updateSection("contact", { subjects: nextSubjects });
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              onClick={() =>
                updateSection("contact", {
                  subjects: [...(draft.contact.subjects || []), ""],
                })
              }
            >
              Add Subject
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-700">FAQs</p>
            {(draft.contact.faq || []).map((faqItem, index) => (
              <div key={`contact-faq-${index}`} className="mt-3 rounded-xl border border-slate-200 p-3">
                <div className="space-y-1">
                  <p className={fieldLabelClass}>Question</p>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Question"
                    value={faqItem.question || ""}
                    onChange={(e) =>
                      updateArrayItem("contact", "faq", index, { question: e.target.value })
                    }
                  />
                </div>
                <div className="mt-2 space-y-1">
                  <p className={fieldLabelClass}>Answer</p>
                  <textarea
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Answer"
                    value={faqItem.answer || ""}
                    onChange={(e) =>
                      updateArrayItem("contact", "faq", index, { answer: e.target.value })
                    }
                  />
                </div>
                <button
                  type="button"
                  className="mt-2 rounded-xl border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                  onClick={() => removeArrayItem("contact", "faq", index)}
                >
                  Remove FAQ
                </button>
              </div>
            ))}
            <button
              type="button"
              className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              onClick={() => addArrayItem("contact", "faq", { question: "", answer: "" })}
            >
              Add FAQ
            </button>
          </div>
        </>
      );
    }

    if (activeTab === "Footer") {
      return (
        <>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Footer Description</p>
            <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} placeholder="Description" value={draft.footer.description} onChange={(e) => updateSection("footer", { description: e.target.value })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Copyright Text</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Copyright" value={draft.footer.copyright} onChange={(e) => updateSection("footer", { copyright: e.target.value })} />
          </div>

          {["learn", "company", "support"].map((groupKey) => (
            <div key={`footer-links-${groupKey}`} className="rounded-2xl border border-slate-200 p-3">
              <p className="text-sm font-semibold capitalize text-slate-700">
                {groupKey} Links
              </p>
              {(draft.footer.links?.[groupKey] || []).map((linkItem, index) => (
                <div key={`footer-${groupKey}-${index}`} className="mt-3 rounded-xl border border-slate-200 p-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className={fieldLabelClass}>Label</p>
                      <input
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Label"
                        value={linkItem.label || ""}
                        onChange={(e) =>
                          updateNestedArrayItem("footer", "links", groupKey, index, {
                            label: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <p className={fieldLabelClass}>URL</p>
                      <input
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="/path or https://..."
                        value={linkItem.url || ""}
                        onChange={(e) =>
                          updateNestedArrayItem("footer", "links", groupKey, index, {
                            url: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mt-2 rounded-xl border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                    onClick={() => removeNestedArrayItem("footer", "links", groupKey, index)}
                  >
                    Remove Link
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                onClick={() =>
                  addNestedArrayItem("footer", "links", groupKey, {
                    label: "",
                    url: "",
                  })
                }
              >
                Add Link
              </button>
            </div>
          ))}
        </>
      );
    }

    if (activeTab === "Appearance") {
      return (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {renderColorField("Primary", "primaryColor", "#4a63f5")}
            {renderColorField("Accent", "accentColor", "#ff6f0f")}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Secondary", "secondaryColor", "#12b981"],
              ["Success", "successColor", "#16a34a"],
              ["Warning", "warningColor", "#f59e0b"],
              ["Danger", "dangerColor", "#ef4444"],
              ["Info", "infoColor", "#0ea5e9"],
              ["Surface", "surfaceColor", "#ffffff"],
              ["Background", "backgroundColor", "#f8fafc"],
              ["Text", "textColor", "#0f172a"],
              ["Muted Text", "mutedTextColor", "#64748b"],
              ["Border", "borderColor", "#e2e8f0"],
            ].map(([label, key, placeholder]) =>
              renderColorField(label, key, placeholder)
            )}
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Font Family</p>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={draft.appearance.fontFamily} onChange={(e) => updateSection("appearance", { fontFamily: e.target.value })}>
              {["DM Sans", "Inter", "Poppins", "Plus Jakarta Sans"].map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
            Dark Mode Default
            <input type="checkbox" checked={Boolean(draft.appearance.darkModeDefault)} onChange={(e) => updateSection("appearance", { darkModeDefault: e.target.checked })} />
          </label>
        </>
      );
    }

    if (activeTab === "Certificates") {
      return (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className={fieldLabelClass}>Border Color</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="#4a63f5"
                value={draft.certificate.borderColor}
                onChange={(e) => updateSection("certificate", { borderColor: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Heading Color</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="#1f2937"
                value={draft.certificate.headingColor}
                onChange={(e) => updateSection("certificate", { headingColor: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Student Name Color</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="#4a63f5"
                value={draft.certificate.nameColor}
                onChange={(e) => updateSection("certificate", { nameColor: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Body Text Color</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="#334155"
                value={draft.certificate.bodyColor}
                onChange={(e) => updateSection("certificate", { bodyColor: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Background Color</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="#ffffff"
                value={draft.certificate.backgroundColor}
                onChange={(e) =>
                  updateSection("certificate", { backgroundColor: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Signature Label</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Authorized Signature"
                value={draft.certificate.signatureLabel}
                onChange={(e) =>
                  updateSection("certificate", { signatureLabel: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Show QR Code", "showQr"],
              ["Show Logo", "showLogo"],
              ["Show Signature", "showSignature"],
            ].map(([label, key]) => (
              <label
                key={key}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {label}
                <input
                  type="checkbox"
                  checked={Boolean(draft.certificate[key])}
                  onChange={(e) =>
                    updateSection("certificate", { [key]: e.target.checked })
                  }
                />
              </label>
            ))}
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200 p-3 md:grid-cols-2">
            <label className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Upload Certificate Logo
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.svg"
                className="mt-2 block w-full text-xs"
                onChange={(e) => handleAssetUpload(e, "certificateLogoUrl")}
              />
              {uploadingAsset === "certificateLogoUrl" ? (
                <span className="text-xs text-slate-500">Uploading...</span>
              ) : null}
            </label>
            <label className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Upload Signature
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.svg"
                className="mt-2 block w-full text-xs"
                onChange={(e) => handleAssetUpload(e, "certificateSignatureUrl")}
              />
              {uploadingAsset === "certificateSignatureUrl" ? (
                <span className="text-xs text-slate-500">Uploading...</span>
              ) : null}
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className={fieldLabelClass}>Logo URL</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Logo URL"
                value={draft.certificate.logoUrl || ""}
                onChange={(e) =>
                  updateSection("certificate", { logoUrl: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Signature URL</p>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Signature URL"
                value={draft.certificate.signatureUrl || ""}
                onChange={(e) =>
                  updateSection("certificate", { signatureUrl: e.target.value })
                }
              />
            </div>
          </div>

          <div
            className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm"
            style={{ background: draft.certificate.backgroundColor }}
          >
            <div
              className="rounded-xl border-2 p-4"
              style={{ borderColor: draft.certificate.borderColor }}
            >
              <p
                className="text-center text-base font-semibold"
                style={{ color: draft.certificate.headingColor }}
              >
                Certificate of Completion
              </p>
              <p
                className="mt-2 text-center text-2xl font-bold"
                style={{ color: draft.certificate.nameColor }}
              >
                Student Name
              </p>
              <p className="mt-2 text-center" style={{ color: draft.certificate.bodyColor }}>
                This is a preview of your certificate styling.
              </p>
            </div>
          </div>
        </>
      );
    }

    if (activeTab === "Maintenance") {
      return (
        <>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
            Maintenance Mode
            <input type="checkbox" checked={Boolean(draft.maintenance.enabled)} onChange={(e) => updateSection("maintenance", { enabled: e.target.checked })} />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className={fieldLabelClass}>Start (PK Time)</p>
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={toDateTimeLocalValue(draft.maintenance.startAt)}
                onChange={(e) => updateSection("maintenance", { startAt: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>End (PK Time)</p>
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={toDateTimeLocalValue(draft.maintenance.endAt)}
                onChange={(e) => updateSection("maintenance", { endAt: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Tip: If you set start/end, maintenance will automatically turn ON at start and OFF at end.
          </p>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Maintenance Message</p>
            <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={3} placeholder="Maintenance Message" value={draft.maintenance.message} onChange={(e) => updateSection("maintenance", { message: e.target.value })} />
          </div>
        </>
      );
    }

    if (activeTab === "Email") {
      return (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className={fieldLabelClass}>SMTP Host</p>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="SMTP Host" value={draft.email.smtpHost} onChange={(e) => updateSection("email", { smtpHost: e.target.value })} />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>SMTP Port</p>
              <input type="number" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="SMTP Port" value={draft.email.smtpPort} onChange={(e) => updateSection("email", { smtpPort: Number(e.target.value) || 587 })} />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>SMTP Email</p>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="SMTP Email" value={draft.email.smtpEmail} onChange={(e) => updateSection("email", { smtpEmail: e.target.value })} />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>SMTP Password</p>
              <input type="password" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="SMTP Password" value={draft.email.smtpPassword} onChange={(e) => updateSection("email", { smtpPassword: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>From Name</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="From Name" value={draft.email.fromName} onChange={(e) => updateSection("email", { fromName: e.target.value })} />
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <p className={fieldLabelClass}>Test Email Address</p>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="test@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
            </div>
            <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => testEmailMutation.mutate(testEmail)} disabled={testEmailMutation.isPending}>
              {testEmailMutation.isPending ? "Sending..." : "Send Test Email"}
            </button>
          </div>
        </>
      );
    }

    if (activeTab === "Payment") {
      return (
        <>
          <p className="text-sm font-semibold text-slate-700">JazzCash</p>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
            Enable JazzCash
            <input
              type="checkbox"
              checked={Boolean(draft.payment.jazzcash.enabled)}
              onChange={(e) =>
                updateSection("payment", {
                  jazzcash: {
                    ...draft.payment.jazzcash,
                    enabled: e.target.checked,
                  },
                })
              }
            />
          </label>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Merchant ID</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Merchant ID" value={draft.payment.jazzcash.merchantId} onChange={(e) => updateSection("payment", { jazzcash: { ...draft.payment.jazzcash, merchantId: e.target.value } })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Account Title</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Account Title" value={draft.payment.jazzcash.accountTitle || ""} onChange={(e) => updateSection("payment", { jazzcash: { ...draft.payment.jazzcash, accountTitle: e.target.value } })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>JazzCash Password</p>
            <input type="password" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Password" value={draft.payment.jazzcash.password} onChange={(e) => updateSection("payment", { jazzcash: { ...draft.payment.jazzcash, password: e.target.value } })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Integrity Salt</p>
            <input type="password" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Integrity Salt" value={draft.payment.jazzcash.integritySalt} onChange={(e) => updateSection("payment", { jazzcash: { ...draft.payment.jazzcash, integritySalt: e.target.value } })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Instructions</p>
            <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} placeholder="Instructions shown to students" value={draft.payment.jazzcash.instructions || ""} onChange={(e) => updateSection("payment", { jazzcash: { ...draft.payment.jazzcash, instructions: e.target.value } })} />
          </div>
          <p className="text-sm font-semibold text-slate-700">EasyPaisa</p>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
            Enable EasyPaisa
            <input
              type="checkbox"
              checked={Boolean(draft.payment.easypaisa.enabled)}
              onChange={(e) =>
                updateSection("payment", {
                  easypaisa: {
                    ...draft.payment.easypaisa,
                    enabled: e.target.checked,
                  },
                })
              }
            />
          </label>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Account Number</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Account Number" value={draft.payment.easypaisa.accountNumber} onChange={(e) => updateSection("payment", { easypaisa: { ...draft.payment.easypaisa, accountNumber: e.target.value } })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Account Title</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Account Title" value={draft.payment.easypaisa.accountTitle || ""} onChange={(e) => updateSection("payment", { easypaisa: { ...draft.payment.easypaisa, accountTitle: e.target.value } })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>EasyPaisa Username</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Username" value={draft.payment.easypaisa.username} onChange={(e) => updateSection("payment", { easypaisa: { ...draft.payment.easypaisa, username: e.target.value } })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>EasyPaisa Password</p>
            <input type="password" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Password" value={draft.payment.easypaisa.password} onChange={(e) => updateSection("payment", { easypaisa: { ...draft.payment.easypaisa, password: e.target.value } })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Instructions</p>
            <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} placeholder="Instructions shown to students" value={draft.payment.easypaisa.instructions || ""} onChange={(e) => updateSection("payment", { easypaisa: { ...draft.payment.easypaisa, instructions: e.target.value } })} />
          </div>
          <p className="text-sm font-semibold text-slate-700">Bank Transfer</p>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
            Enable Bank Transfer
            <input
              type="checkbox"
              checked={Boolean(draft.payment.bankTransfer.enabled)}
              onChange={(e) =>
                updateSection("payment", {
                  bankTransfer: {
                    ...draft.payment.bankTransfer,
                    enabled: e.target.checked,
                  },
                })
              }
            />
          </label>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Bank Name</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Bank Name" value={draft.payment.bankTransfer.bankName} onChange={(e) => updateSection("payment", { bankTransfer: { ...draft.payment.bankTransfer, bankName: e.target.value } })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Account Title</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Account Title" value={draft.payment.bankTransfer.accountTitle} onChange={(e) => updateSection("payment", { bankTransfer: { ...draft.payment.bankTransfer, accountTitle: e.target.value } })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Account Number</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Account Number" value={draft.payment.bankTransfer.accountNumber} onChange={(e) => updateSection("payment", { bankTransfer: { ...draft.payment.bankTransfer, accountNumber: e.target.value } })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>IBAN</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="IBAN" value={draft.payment.bankTransfer.iban} onChange={(e) => updateSection("payment", { bankTransfer: { ...draft.payment.bankTransfer, iban: e.target.value } })} />
          </div>
        </>
      );
    }

    if (activeTab === "Security") {
      return (
        <>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Max Login Attempts</p>
            <input type="number" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Max Login Attempts" value={draft.security.maxLoginAttempts} onChange={(e) => updateSection("security", { maxLoginAttempts: Number(e.target.value) || 5 })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Lockout Duration (minutes)</p>
            <input type="number" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Lockout Duration" value={draft.security.lockoutDuration} onChange={(e) => updateSection("security", { lockoutDuration: Number(e.target.value) || 30 })} />
          </div>
          <div className="space-y-1">
            <p className={fieldLabelClass}>Session Timeout (minutes)</p>
            <input type="number" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Session Timeout" value={draft.security.sessionTimeout} onChange={(e) => updateSection("security", { sessionTimeout: Number(e.target.value) || 60 })} />
          </div>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
            Maintenance Mode
            <input type="checkbox" checked={Boolean(draft.security.maintenanceMode)} onChange={(e) => updateSection("security", { maintenanceMode: e.target.checked })} />
          </label>
        </>
      );
    }

    return (
      <>
        <div className="space-y-1">
          <p className={fieldLabelClass}>Template Type</p>
          <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={templateName} onChange={(e) => setTemplateName(e.target.value)}>
            {templateOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <p className={fieldLabelClass}>Template Subject</p>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Template Subject"
            value={currentTemplate.subject}
            onChange={(e) =>
              updateSection("emailTemplates", {
                templates: {
                  ...draft.emailTemplates.templates,
                  [templateName]: {
                    ...currentTemplate,
                    subject: e.target.value,
                  },
                },
              })
            }
          />
        </div>
        <div className="space-y-1">
          <p className={fieldLabelClass}>Template Body</p>
          <textarea
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm"
            rows={10}
            placeholder="Template Body"
            value={currentTemplate.body}
            onChange={(e) =>
              updateSection("emailTemplates", {
                templates: {
                  ...draft.emailTemplates.templates,
                  [templateName]: {
                    ...currentTemplate,
                    body: e.target.value,
                  },
                },
              })
            }
          />
        </div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-3xl text-slate-900">Site Settings</h2>
        <p className="text-sm text-slate-500">
          Control public pages, auth pages, and dashboards from one place.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 lg:sticky lg:top-24 lg:h-fit">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`mb-2 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${
                activeTab === tab
                  ? "bg-primary text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              onClick={() => switchTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          {settingsQuery.isLoading ? (
            <div className="space-y-3">
              <div className="skeleton h-5 w-1/4" />
              <div className="skeleton h-11 w-full" />
              <div className="skeleton h-11 w-full" />
              <div className="skeleton h-24 w-full" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <Motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {renderTab()}
              </Motion.div>
            </AnimatePresence>
          )}

          {Object.values(errors)[0] ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {Object.values(errors)[0]}
            </div>
          ) : null}

          {!settingsQuery.isLoading ? (
            <button
              type="button"
              className="btn-primary mt-5"
              onClick={onSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : `Save ${activeTab}`}
            </button>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {unsavedOpen ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <button
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setUnsavedOpen(false)}
            />
            <Motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="relative w-full max-w-md rounded-3xl bg-white p-6"
            >
              <h3 className="text-xl font-bold text-slate-900">Unsaved Changes</h3>
              <p className="mt-2 text-sm text-slate-500">
                You have unsaved changes. Do you want to discard them?
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                  onClick={() => setUnsavedOpen(false)}
                >
                  Stay
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-rose-500 px-3 py-2 text-sm font-semibold text-white"
                  onClick={discardChanges}
                >
                  Discard
                </button>
              </div>
            </Motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default SiteSettings;
