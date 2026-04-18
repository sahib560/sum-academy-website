import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/axios.js";

export const defaultSettings = {
  general: {
    siteName: "SUM Academy",
    tagline: "Learn Without Limits",
    description:
      "Pakistan's most modern learning platform built for academies",
    contactEmail: "info@sumacademy.com",
    contactPhone: "+92 300 0000000",
    address: "Karachi, Pakistan",
    logoUrl: null,
    faviconUrl: null,
    apkUrl: null,
    apkFileName: "",
    apkMimeType: "",
    apkSize: null,
    socialLinks: {
      facebook: "",
      instagram: "",
      youtube: "",
      whatsapp: "",
    },
  },
  hero: {
    heading: "Learn Without Limits",
    subheading: "Join thousands of students growing with SUM Academy",
    ctaPrimary: "Browse Courses",
    ctaSecondary: "Watch Demo",
    badge: "Pakistan's #1 Academy Platform",
    stats: [
      { label: "Students", value: "500+" },
      { label: "Courses", value: "50+" },
      { label: "Teachers", value: "20+" },
      { label: "Certificates", value: "200+" },
    ],
  },
  howItWorks: {
    heading: "How It Works",
    subheading: "Simple steps to get started",
    steps: [
      {
        number: 1,
        title: "Browse Courses",
        description: "Explore our wide range of courses",
      },
      {
        number: 2,
        title: "Enroll and Pay",
        description: "Easy enrollment with Pakistani payment methods",
      },
      {
        number: 3,
        title: "Learn and Certify",
        description: "Complete courses and earn certificates",
      },
    ],
  },
  features: {
    heading: "Why Choose SUM Academy",
    items: [
      {
        icon: "shield",
        title: "Secure Platform",
        description: "Enterprise grade security",
      },
      {
        icon: "certificate",
        title: "Get Certified",
        description: "Industry recognized certificates",
      },
      {
        icon: "mobile",
        title: "Mobile App",
        description: "Learn anywhere on Android",
      },
      {
        icon: "payment",
        title: "Easy Payments",
        description: "JazzCash EasyPaisa Bank Transfer",
      },
    ],
  },
  testimonials: {
    heading: "What Students Say",
    items: [
      {
        name: "Ahmad Ali",
        course: "Computer Science",
        rating: 5,
        review: "SUM Academy changed my career path",
        avatar: "",
      },
      {
        name: "Fatima Khan",
        course: "Mathematics",
        rating: 5,
        review: "Best online learning platform in Pakistan",
        avatar: "",
      },
      {
        name: "Usman Raza",
        course: "English",
        rating: 5,
        review: "Teachers are very helpful and professional",
        avatar: "",
      },
    ],
  },
  about: {
    heading: "About SUM Academy",
    storyHeading: "Our Story",
    mission:
      "To provide quality education to every student in Pakistan regardless of location",
    vision: "Become Pakistan's leading digital learning platform",
    story:
      "SUM Academy was founded with a simple mission: make quality education accessible to all students across Pakistan",
    foundedYear: "2024",
    valuesHeading: "Our Values",
    certificateHeading: "Earn Verified Certificates",
    certificateLabel: "Certificate",
    certificateTitle: "Certificate of Completion",
    certificateDescription:
      "Finish your course and receive a secure, shareable certificate.",
    certificateSampleId: "SUM-2026-ABC12345",
    certificateSideTitle: "Trusted Verification",
    certificateSideDescription:
      "Every certificate can be verified online with a unique ID.",
    ctaBadge: "Start Now",
    ctaHeading: "Start Your Journey Today",
    ctaDescription: "Choose a course and begin learning right away.",
    ctaLabel: "Get Started",
    teamHeading: "Our Leadership",
    team: [
      {
        name: "SUM Founder",
        role: "Founder & CEO",
        avatar: "",
      },
    ],
    values: [
      {
        title: "Excellence",
        description: "We deliver the highest quality education",
      },
      {
        title: "Accessibility",
        description: "Education for every student in Pakistan",
      },
      {
        title: "Innovation",
        description: "Modern technology for better learning",
      },
    ],
  },
  contact: {
    heading: "Get In Touch",
    subheading: "We are here to help you",
    subjects: ["Admissions", "Courses", "Payments", "Technical Support"],
    email: "support@sumacademy.com",
    phone: "+92 300 0000000",
    whatsapp: "+92 300 0000000",
    address: "Karachi, Pakistan",
    officeHours: "Monday to Saturday 9AM to 6PM PKT",
    mapEmbedUrl: "",
    faq: [
      {
        question: "How do I enroll in a course?",
        answer: "Browse courses and click Enroll Now",
      },
      {
        question: "What payment methods are accepted?",
        answer: "JazzCash EasyPaisa and Bank Transfer",
      },
      {
        question: "Can I access courses on mobile?",
        answer: "Yes download our Android app",
      },
      {
        question: "How do I get my certificate?",
        answer: "Complete 100% of the course",
      },
      {
        question: "What is the refund policy?",
        answer: "Contact admin within 7 days of enrollment",
      },
    ],
  },
  footer: {
    description: "Pakistan's most modern learning platform",
    copyright: "2026 SUM Academy. All rights reserved.",
    links: {
      learn: [
        { label: "All Courses", url: "/courses" },
        { label: "Our Teachers", url: "/teachers" },
        { label: "Certificates", url: "/about" },
        { label: "Live Classes", url: "/courses" },
      ],
      company: [
        { label: "About Us", url: "/about" },
        { label: "Contact", url: "/contact" },
        { label: "Careers", url: "/contact" },
      ],
      support: [
        { label: "Help Center", url: "/contact" },
        { label: "Privacy Policy", url: "/contact" },
        { label: "Terms of Use", url: "/contact" },
      ],
    },
  },
  appearance: {
    primaryColor: "#4a63f5",
    accentColor: "#ff6f0f",
    secondaryColor: "#12b981",
    successColor: "#16a34a",
    warningColor: "#f59e0b",
    dangerColor: "#ef4444",
    infoColor: "#0ea5e9",
    surfaceColor: "#ffffff",
    backgroundColor: "#f8fafc",
    textColor: "#0f172a",
    mutedTextColor: "#64748b",
    borderColor: "#e2e8f0",
    darkModeDefault: false,
    fontFamily: "DM Sans",
  },
  certificate: {
    borderColor: "#4a63f5",
    headingColor: "#1f2937",
    nameColor: "#4a63f5",
    bodyColor: "#334155",
    backgroundColor: "#ffffff",
    showQr: true,
    showLogo: true,
    showSignature: true,
    logoUrl: "",
    signatureUrl: "",
    signatureLabel: "Authorized Signature",
  },
  maintenance: {
    enabled: false,
    message: "We are updating SUM Academy. Back soon!",
    startAt: null,
    endAt: null,
    active: false,
    hasSchedule: false,
  },
  email: {
    smtpHost: "",
    smtpPort: 587,
    smtpEmail: "",
    smtpPassword: "",
    fromName: "SUM Academy",
  },
  payment: {
    jazzcash: {
      merchantId: "",
      accountTitle: "SUM Academy",
      password: "",
      integritySalt: "",
      instructions:
        "Send payment to JazzCash merchant and upload the transaction receipt.",
      enabled: true,
    },
    easypaisa: {
      accountNumber: "",
      accountTitle: "SUM Academy",
      username: "",
      password: "",
      instructions:
        "Send payment to EasyPaisa account and upload the transaction receipt.",
      enabled: true,
    },
    bankTransfer: {
      bankName: "Meezan Bank",
      accountTitle: "SUM Academy",
      accountNumber: "",
      iban: "",
      enabled: true,
    },
  },
  security: {
    maxLoginAttempts: 5,
    lockoutDuration: 30,
    sessionTimeout: 60,
    maintenanceMode: false,
  },
  emailTemplates: {
    templates: {},
  },
};

const SettingsContext = createContext({
  settings: defaultSettings,
  loading: true,
  refetchSettings: async () => {},
});

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

const hexToRgb = (hex) => {
  const normalized = String(hex || "").trim();
  const match = /^#([A-Fa-f0-9]{6})$/.exec(normalized);
  if (!match) return null;
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
};

const applySettingsToDom = (settings) => {
  const root = document.documentElement;
  const appearance = settings.appearance || defaultSettings.appearance;
  const primaryRgb =
    hexToRgb(appearance.primaryColor) ||
    hexToRgb(defaultSettings.appearance.primaryColor) ||
    "74 99 245";
  const accentRgb =
    hexToRgb(appearance.accentColor) ||
    hexToRgb(defaultSettings.appearance.accentColor) ||
    "255 111 15";
  root.style.setProperty(
    "--brand-primary",
    appearance.primaryColor || defaultSettings.appearance.primaryColor
  );
  root.style.setProperty("--brand-primary-rgb", primaryRgb);
  root.style.setProperty(
    "--brand-accent",
    appearance.accentColor || defaultSettings.appearance.accentColor
  );
  root.style.setProperty("--brand-accent-rgb", accentRgb);
  root.style.setProperty(
    "--brand-secondary",
    appearance.secondaryColor || defaultSettings.appearance.secondaryColor
  );
  root.style.setProperty(
    "--brand-success",
    appearance.successColor || defaultSettings.appearance.successColor
  );
  root.style.setProperty(
    "--brand-warning",
    appearance.warningColor || defaultSettings.appearance.warningColor
  );
  root.style.setProperty(
    "--brand-danger",
    appearance.dangerColor || defaultSettings.appearance.dangerColor
  );
  root.style.setProperty(
    "--brand-info",
    appearance.infoColor || defaultSettings.appearance.infoColor
  );
  root.style.setProperty(
    "--brand-surface",
    appearance.surfaceColor || defaultSettings.appearance.surfaceColor
  );
  root.style.setProperty(
    "--brand-bg",
    appearance.backgroundColor || defaultSettings.appearance.backgroundColor
  );
  root.style.setProperty(
    "--brand-text",
    appearance.textColor || defaultSettings.appearance.textColor
  );
  root.style.setProperty(
    "--brand-muted",
    appearance.mutedTextColor || defaultSettings.appearance.mutedTextColor
  );
  root.style.setProperty(
    "--brand-border",
    appearance.borderColor || defaultSettings.appearance.borderColor
  );
  root.style.setProperty(
    "--font-body",
    appearance.fontFamily || defaultSettings.appearance.fontFamily
  );
  root.style.setProperty(
    "--brand-font",
    appearance.fontFamily || defaultSettings.appearance.fontFamily
  );

  const siteName =
    settings.general?.siteName || defaultSettings.general.siteName;
  document.title = siteName;

  const faviconUrl = settings.general?.faviconUrl;
  if (!faviconUrl) return;
  const icon =
    document.querySelector("link[rel='icon']") ||
    document.querySelector("link[rel='shortcut icon']");
  if (icon) icon.setAttribute("href", faviconUrl);
};

const withCompatibility = (settings) => {
  const next = mergeDeep(defaultSettings, settings || {});
  const general = next.general || defaultSettings.general;
  const hero = next.hero || defaultSettings.hero;
  const about = next.about || defaultSettings.about;
  const contact = next.contact || defaultSettings.contact;
  const footer = next.footer || defaultSettings.footer;

  // Backward compatibility for existing screens still reading legacy keys.
  next.general = {
    ...general,
    logoPreview: general.logoUrl || "",
    faviconPreview: general.faviconUrl || "",
    apkPreview: general.apkUrl || "",
  };
  next.content = {
    heroBadge: hero.badge,
    heroTitle: hero.heading,
    heroSubtitle: hero.subheading,
    heroPrimaryLabel: hero.ctaPrimary,
    heroPrimaryLink: "/courses",
    heroSecondaryLabel: hero.ctaSecondary,
    heroSecondaryLink: "/",
    aboutHeroTitle: about.heading,
    aboutMission: about.mission,
    aboutStoryTitle: "Our Story",
    aboutStoryBody: about.story,
    contactHeroTitle: contact.heading,
    contactHeroSubtitle: contact.subheading,
    officeHours: contact.officeHours,
    footerDescription: footer.description,
    footerCopyright: footer.copyright,
    facebookUrl: general.socialLinks?.facebook || "",
    whatsappUrl: general.socialLinks?.whatsapp || "",
    tiktokUrl: general.socialLinks?.youtube || "",
  };
  return next;
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(withCompatibility(defaultSettings));
  const [loading, setLoading] = useState(true);

  const refetchSettings = async () => {
    try {
      const response = await api.get("/settings");
      const payload = response.data?.data || {};
      const merged = withCompatibility(payload);
      setSettings(merged);
      applySettingsToDom(merged);
    } catch {
      const fallback = withCompatibility(defaultSettings);
      setSettings(fallback);
      applySettingsToDom(fallback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetchSettings();
  }, []);

  useEffect(() => {
    applySettingsToDom(settings);
  }, [settings]);

  const value = useMemo(
    () => ({ settings, loading, refetchSettings }),
    [settings, loading]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);

export default SettingsContext;
