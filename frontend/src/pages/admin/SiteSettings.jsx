import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
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
  updateSecuritySettings,
  updateTestimonialsSettings,
} from "../../services/admin.service.js";
import { defaultSettings } from "../../context/SettingsContext.jsx";
import { storage } from "../../config/firebase.js";
import { useSettings } from "../../hooks/useSettings.js";

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
      [listKey]: (draft[section][listKey] || []).filter((_, idx) => idx !== index),
    });
  };

  const addArrayItem = (section, listKey, item) => {
    updateSection(section, {
      [listKey]: [...(draft[section][listKey] || []), item],
    });
  };

  const handleAssetUpload = async (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isLogo = field === "logoUrl";
    const allowed = isLogo
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
      updateSection("general", { [field]: url });
      toast.success(isLogo ? "Logo uploaded." : "Favicon uploaded.");
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploadingAsset("");
    }
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
                placeholder="Contact Phone"
                value={draft.general.contactPhone}
                onChange={(e) =>
                  updateSection("general", { contactPhone: e.target.value })
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
          <div className="grid gap-3 rounded-2xl border border-slate-200 p-3 md:grid-cols-2">
            <label className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Upload Logo
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.svg"
                className="mt-2 block w-full text-xs"
                onChange={(e) => handleAssetUpload(e, "logoUrl")}
              />
              {uploadingAsset === "logoUrl" ? (
                <span className="text-xs text-slate-500">Uploading...</span>
              ) : null}
            </label>
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
            <p className={fieldLabelClass}>Team Section Heading</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Team Heading" value={draft.about.teamHeading} onChange={(e) => updateSection("about", { teamHeading: e.target.value })} />
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
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Phone" value={draft.contact.phone} onChange={(e) => updateSection("contact", { phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>WhatsApp Number</p>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="WhatsApp" value={draft.contact.whatsapp} onChange={(e) => updateSection("contact", { whatsapp: e.target.value })} />
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
        </>
      );
    }

    if (activeTab === "Appearance") {
      return (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className={fieldLabelClass}>Primary Color</p>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="#4a63f5" value={draft.appearance.primaryColor} onChange={(e) => updateSection("appearance", { primaryColor: e.target.value })} />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Accent Color</p>
              <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="#ff6f0f" value={draft.appearance.accentColor} onChange={(e) => updateSection("appearance", { accentColor: e.target.value })} />
            </div>
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

    if (activeTab === "Maintenance") {
      return (
        <>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
            Maintenance Mode
            <input type="checkbox" checked={Boolean(draft.maintenance.enabled)} onChange={(e) => updateSection("maintenance", { enabled: e.target.checked })} />
          </label>
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
