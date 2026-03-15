import { createContext, useContext, useEffect, useMemo, useState } from "react";

const defaultSettings = {
  general: {
    siteName: "SUM Academy",
    tagline: "Empowering Pakistani academies",
    contactEmail: "support@sumacademy.pk",
    contactPhone: "+92 300 1234567",
    address: "Karachi, Pakistan",
    logoPreview: "",
    faviconPreview: "",
  },
  appearance: {
    primaryColor: "#4a63f5",
    accentColor: "#ff6f0f",
    darkMode: false,
    font: "DM Sans",
    headingFont: "Playfair Display",
  },
  content: {
    heroBadge: "SUM Academy Pakistan",
    heroTitle: "Learn Without Limits",
    heroSubtitle:
      "Empowering Pakistani academies with a premium LMS experience, personalized learning paths, and real-time performance insights.",
    heroPrimaryLabel: "Browse Courses",
    heroPrimaryLink: "/courses",
    heroSecondaryLabel: "Watch Demo",
    heroSecondaryLink: "/",
    aboutHeroTitle: "About SUM Academy",
    aboutMission:
      "We help Pakistani academies deliver measurable learning outcomes with modern, student-first digital classrooms.",
    aboutStoryTitle: "Our Story",
    aboutStoryBody:
      "SUM Academy started with a simple goal: bring premium learning tools to local academies so every student can thrive with structure, clarity, and confidence.",
    contactHeroTitle: "Get In Touch",
    contactHeroSubtitle:
      "Have questions about enrollment, payments, or support? Our team is ready to help.",
    officeHours: "Mon-Sat, 9AM - 6PM PKT",
    footerDescription:
      "A modern learning platform helping Pakistani academies scale with engaging courses, smart analytics, and delightful learner experiences.",
    footerCtaTitle: "Ready to start learning?",
    footerCtaButton: "Enroll for Free",
    footerCtaSubtitle:
      "Join SUM Academy and unlock personalized learning paths built for Pakistan's top boards.",
    footerCopyright: "© 2026 SUM Academy. All rights reserved.",
    navbarLmsLabel: "LMS Login",
    navbarSignInLabel: "Sign In",
    navbarGetStartedLabel: "Get Started",
    facebookUrl: "/facebook",
    whatsappUrl: "/whatsapp",
    tiktokUrl: "/tiktok",
  },
};

const STORAGE_KEY = "sum-site-settings";

const SiteSettingsContext = createContext({
  settings: defaultSettings,
  updateSettings: () => {},
  resetSettings: () => {},
});

const mergeDeep = (target, source) => {
  if (!source) return target;
  const output = { ...target };
  Object.keys(source).forEach((key) => {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      output[key] = mergeDeep(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  });
  return output;
};

const hexToRgb = (hex) => {
  if (!hex) return "74 99 245";
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "74 99 245";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
};

export function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return defaultSettings;
      return mergeDeep(defaultSettings, JSON.parse(saved));
    } catch (error) {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", settings.appearance.primaryColor);
    root.style.setProperty(
      "--brand-primary-rgb",
      hexToRgb(settings.appearance.primaryColor)
    );
    root.style.setProperty("--brand-accent", settings.appearance.accentColor);
    root.style.setProperty(
      "--brand-accent-rgb",
      hexToRgb(settings.appearance.accentColor)
    );
    root.style.setProperty("--brand-dark", "#0d0f1a");
    root.style.setProperty("--brand-font", settings.appearance.font);
    root.style.setProperty(
      "--brand-heading-font",
      settings.appearance.headingFont
    );

    if (settings.general.siteName) {
      document.title = settings.general.siteName;
    }

    if (settings.general.faviconPreview) {
      const icon =
        document.querySelector("link[rel='icon']") ||
        document.querySelector("link[rel='shortcut icon']");
      if (icon) {
        icon.setAttribute("href", settings.general.faviconPreview);
      }
    }
  }, [settings]);

  const updateSettings = (updater) => {
    setSettings((prev) => {
      const next =
        typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      return mergeDeep(prev, next);
    });
  };

  const resetSettings = () => setSettings(defaultSettings);

  const value = useMemo(
    () => ({ settings, updateSettings, resetSettings }),
    [settings]
  );

  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export const useSiteSettings = () => useContext(SiteSettingsContext);
