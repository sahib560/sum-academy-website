import nodemailer from "nodemailer";
import { admin, db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { errorResponse, successResponse } from "../utils/response.utils.js";

const SETTINGS_DOC_ID = "siteSettings";
const LAUNCH_DATE = new Date("2026-04-01T00:00:00+05:00");
const LAUNCH_NOTIFY_COLLECTION = "launchNotifications";

const DEFAULT_SETTINGS = {
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
      bankName: process.env.BANK_NAME || "Meezan Bank",
      accountTitle: process.env.BANK_ACCOUNT_TITLE || "SUM Academy",
      accountNumber: process.env.BANK_ACCOUNT_NUMBER || "",
      iban: process.env.BANK_IBAN || "",
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

const settingsRef = () =>
  db.collection(COLLECTIONS.SETTINGS).doc(SETTINGS_DOC_ID);

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const isValidHex = (value) =>
  /^#([A-Fa-f0-9]{6})$/.test(String(value || "").trim());

const normalizeString = (value) => String(value || "").trim();

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();

const launchNotifyRef = (email) =>
  db
    .collection(LAUNCH_NOTIFY_COLLECTION)
    .doc(String(email || "").replace(/\//g, "_"));

const createMailerFromSettings = (settings) => {
  const email = settings?.email || DEFAULT_SETTINGS.email;
  const smtpHost = normalizeString(email.smtpHost);
  const smtpPort = Number(email.smtpPort);
  const smtpEmail = normalizeEmail(email.smtpEmail);
  const smtpPassword = normalizeString(email.smtpPassword);
  const fromName = normalizeString(email.fromName || "SUM Academy");

  if (!smtpHost || !smtpPort || !smtpEmail || !smtpPassword) {
    return { transporter: null, from: "", configured: false };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpEmail,
      pass: smtpPassword,
    },
  });

  return {
    transporter,
    from: `"${fromName}" <${smtpEmail}>`,
    configured: true,
  };
};

const getNormalizedSettings = async () => {
  const ref = settingsRef();
  const snap = await ref.get();
  if (!snap.exists) {
    const initial = {
      ...clone(DEFAULT_SETTINGS),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(initial, { merge: true });
    return clone(DEFAULT_SETTINGS);
  }

  const data = snap.data() || {};
  const merged = mergeDeep(clone(DEFAULT_SETTINGS), data);
  return merged;
};

const saveSection = async (sectionName, sectionData) => {
  await settingsRef().set(
    {
      [sectionName]: sectionData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return getNormalizedSettings();
};

const validateStringMin = (value, min) =>
  normalizeString(value).length >= min;

const normalizeStats = (stats = []) =>
  (Array.isArray(stats) ? stats : [])
    .map((item) => ({
      label: normalizeString(item?.label),
      value: normalizeString(item?.value),
    }))
    .filter((item) => item.label && item.value);

const normalizeHowItWorksSteps = (steps = []) =>
  (Array.isArray(steps) ? steps : [])
    .map((item, index) => ({
      number: index + 1,
      title: normalizeString(item?.title),
      description: normalizeString(item?.description),
    }))
    .filter((item) => item.title && item.description);

const normalizeFeatureItems = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      icon: normalizeString(item?.icon) || "sparkles",
      title: normalizeString(item?.title),
      description: normalizeString(item?.description),
    }))
    .filter((item) => item.title && item.description);

const normalizeTestimonials = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      name: normalizeString(item?.name),
      course: normalizeString(item?.course),
      rating: Number(item?.rating) || 5,
      review: normalizeString(item?.review),
      avatar: normalizeString(item?.avatar),
    }))
    .filter((item) => item.name && item.review)
    .map((item) => ({
      ...item,
      rating: Math.min(5, Math.max(1, item.rating)),
    }));

const normalizeFaq = (faq = []) =>
  (Array.isArray(faq) ? faq : [])
    .map((item) => ({
      question: normalizeString(item?.question),
      answer: normalizeString(item?.answer),
    }))
    .filter((item) => item.question && item.answer);

const normalizeTeam = (team = []) =>
  (Array.isArray(team) ? team : [])
    .map((item) => ({
      name: normalizeString(item?.name),
      role: normalizeString(item?.role),
      avatar: normalizeString(item?.avatar),
    }))
    .filter((item) => item.name && item.role);

const normalizeValues = (values = []) =>
  (Array.isArray(values) ? values : [])
    .map((item) => ({
      title: normalizeString(item?.title),
      description: normalizeString(item?.description),
    }))
    .filter((item) => item.title && item.description);

const normalizeFooterLinks = (links = {}) => {
  const normalizeGroup = (items) =>
    (Array.isArray(items) ? items : [])
      .map((item) => ({
        label: normalizeString(item?.label),
        url: normalizeString(item?.url) || "/",
      }))
      .filter((item) => item.label && item.url);

  return {
    learn: normalizeGroup(links.learn),
    company: normalizeGroup(links.company),
    support: normalizeGroup(links.support),
  };
};

export const getSettings = async (req, res) => {
  try {
    const settings = await getNormalizedSettings();
    return successResponse(res, settings, "Settings fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch settings", 500);
  }
};

export const getAdminSettings = getSettings;

export const updateGeneralSettings = async (req, res) => {
  try {
    const current = await getNormalizedSettings();
    const input = req.body || {};

    const siteName = normalizeString(input.siteName || current.general.siteName);
    if (!validateStringMin(siteName, 3)) {
      return errorResponse(res, "siteName must be at least 3 characters", 400);
    }

    const contactEmail = normalizeString(
      input.contactEmail ?? current.general.contactEmail
    );
    if (contactEmail && !isValidEmail(contactEmail)) {
      return errorResponse(res, "contactEmail must be a valid email", 400);
    }

    const socialLinks = {
      ...current.general.socialLinks,
      ...(input.socialLinks || {}),
    };

    const nextGeneral = {
      ...current.general,
      siteName,
      tagline: normalizeString(input.tagline ?? current.general.tagline),
      description: normalizeString(
        input.description ?? current.general.description
      ),
      contactEmail,
      contactPhone: normalizeString(
        input.contactPhone ?? current.general.contactPhone
      ),
      address: normalizeString(input.address ?? current.general.address),
      logoUrl: input.logoUrl ?? current.general.logoUrl ?? null,
      faviconUrl: input.faviconUrl ?? current.general.faviconUrl ?? null,
      socialLinks: {
        facebook: normalizeString(socialLinks.facebook),
        instagram: normalizeString(socialLinks.instagram),
        youtube: normalizeString(socialLinks.youtube),
        whatsapp: normalizeString(socialLinks.whatsapp),
      },
    };

    const settings = await saveSection("general", nextGeneral);
    return successResponse(res, settings, "General settings updated");
  } catch (error) {
    return errorResponse(res, "Failed to update general settings", 500);
  }
};

export const updateHeroSettings = async (req, res) => {
  try {
    const current = await getNormalizedSettings();
    const input = req.body || {};

    const heading = normalizeString(input.heading ?? current.hero.heading);
    if (!validateStringMin(heading, 5)) {
      return errorResponse(res, "Hero heading must be at least 5 characters", 400);
    }

    const stats = normalizeStats(input.stats ?? current.hero.stats);
    if (stats.length < 1) {
      return errorResponse(res, "At least one hero stat is required", 400);
    }

    const nextHero = {
      ...current.hero,
      heading,
      subheading: normalizeString(input.subheading ?? current.hero.subheading),
      ctaPrimary: normalizeString(input.ctaPrimary ?? current.hero.ctaPrimary),
      ctaSecondary: normalizeString(
        input.ctaSecondary ?? current.hero.ctaSecondary
      ),
      badge: normalizeString(input.badge ?? current.hero.badge),
      stats,
    };

    const settings = await saveSection("hero", nextHero);
    return successResponse(res, settings, "Hero settings updated");
  } catch (error) {
    return errorResponse(res, "Failed to update hero settings", 500);
  }
};

export const updateHowItWorks = async (req, res) => {
  try {
    const current = await getNormalizedSettings();
    const input = req.body || {};

    const heading = normalizeString(
      input.heading ?? current.howItWorks.heading
    );
    const subheading = normalizeString(
      input.subheading ?? current.howItWorks.subheading
    );
    const steps = normalizeHowItWorksSteps(input.steps ?? current.howItWorks.steps);

    if (!validateStringMin(heading, 3)) {
      return errorResponse(res, "How It Works heading is required", 400);
    }
    if (steps.length < 1) {
      return errorResponse(res, "At least one step is required", 400);
    }

    const nextSection = {
      heading,
      subheading,
      steps,
    };

    const settings = await saveSection("howItWorks", nextSection);
    return successResponse(res, settings, "How It Works updated");
  } catch (error) {
    return errorResponse(res, "Failed to update How It Works", 500);
  }
};

export const updateFeatures = async (req, res) => {
  try {
    const current = await getNormalizedSettings();
    const input = req.body || {};
    const heading = normalizeString(input.heading ?? current.features.heading);
    const items = normalizeFeatureItems(input.items ?? current.features.items);

    if (!validateStringMin(heading, 3)) {
      return errorResponse(res, "Features heading is required", 400);
    }
    if (items.length < 1) {
      return errorResponse(res, "At least one feature is required", 400);
    }
    if (items.length > 8) {
      return errorResponse(res, "You can add up to 8 features only", 400);
    }

    const settings = await saveSection("features", { heading, items });
    return successResponse(res, settings, "Features updated");
  } catch (error) {
    return errorResponse(res, "Failed to update features", 500);
  }
};

export const updateTestimonials = async (req, res) => {
  try {
    const current = await getNormalizedSettings();
    const input = req.body || {};
    const heading = normalizeString(
      input.heading ?? current.testimonials.heading
    );
    const items = normalizeTestimonials(
      input.items ?? current.testimonials.items
    );

    if (!validateStringMin(heading, 3)) {
      return errorResponse(res, "Testimonials heading is required", 400);
    }
    if (items.length < 1) {
      return errorResponse(res, "At least one testimonial is required", 400);
    }

    const settings = await saveSection("testimonials", { heading, items });
    return successResponse(res, settings, "Testimonials updated");
  } catch (error) {
    return errorResponse(res, "Failed to update testimonials", 500);
  }
};

export const updateAboutSettings = async (req, res) => {
  try {
    const current = await getNormalizedSettings();
    const input = req.body || {};

    const heading = normalizeString(input.heading ?? current.about.heading);
    if (!validateStringMin(heading, 3)) {
      return errorResponse(res, "About heading is required", 400);
    }

    const nextSection = {
      ...current.about,
      heading,
      storyHeading: normalizeString(
        input.storyHeading ?? current.about.storyHeading
      ),
      mission: normalizeString(input.mission ?? current.about.mission),
      vision: normalizeString(input.vision ?? current.about.vision),
      story: normalizeString(input.story ?? current.about.story),
      foundedYear: normalizeString(input.foundedYear ?? current.about.foundedYear),
      valuesHeading: normalizeString(
        input.valuesHeading ?? current.about.valuesHeading
      ),
      certificateHeading: normalizeString(
        input.certificateHeading ?? current.about.certificateHeading
      ),
      certificateLabel: normalizeString(
        input.certificateLabel ?? current.about.certificateLabel
      ),
      certificateTitle: normalizeString(
        input.certificateTitle ?? current.about.certificateTitle
      ),
      certificateDescription: normalizeString(
        input.certificateDescription ?? current.about.certificateDescription
      ),
      certificateSampleId: normalizeString(
        input.certificateSampleId ?? current.about.certificateSampleId
      ),
      certificateSideTitle: normalizeString(
        input.certificateSideTitle ?? current.about.certificateSideTitle
      ),
      certificateSideDescription: normalizeString(
        input.certificateSideDescription ?? current.about.certificateSideDescription
      ),
      ctaBadge: normalizeString(input.ctaBadge ?? current.about.ctaBadge),
      ctaHeading: normalizeString(input.ctaHeading ?? current.about.ctaHeading),
      ctaDescription: normalizeString(
        input.ctaDescription ?? current.about.ctaDescription
      ),
      ctaLabel: normalizeString(input.ctaLabel ?? current.about.ctaLabel),
      teamHeading: normalizeString(
        input.teamHeading ?? current.about.teamHeading
      ),
      team: normalizeTeam(input.team ?? current.about.team),
      values: normalizeValues(input.values ?? current.about.values),
    };

    const settings = await saveSection("about", nextSection);
    return successResponse(res, settings, "About settings updated");
  } catch (error) {
    return errorResponse(res, "Failed to update about settings", 500);
  }
};

export const updateContactSettings = async (req, res) => {
  try {
    const current = await getNormalizedSettings();
    const input = req.body || {};

    const email = normalizeString(input.email ?? current.contact.email);
    if (email && !isValidEmail(email)) {
      return errorResponse(res, "contact email must be valid", 400);
    }

    const nextSection = {
      ...current.contact,
      heading: normalizeString(input.heading ?? current.contact.heading),
      subheading: normalizeString(input.subheading ?? current.contact.subheading),
      subjects: normalizeSubjects(input.subjects ?? current.contact.subjects),
      email,
      phone: normalizeString(input.phone ?? current.contact.phone),
      whatsapp: normalizeString(input.whatsapp ?? current.contact.whatsapp),
      address: normalizeString(input.address ?? current.contact.address),
      officeHours: normalizeString(input.officeHours ?? current.contact.officeHours),
      mapEmbedUrl: normalizeString(input.mapEmbedUrl ?? current.contact.mapEmbedUrl),
      faq: normalizeFaq(input.faq ?? current.contact.faq),
    };

    const settings = await saveSection("contact", nextSection);
    return successResponse(res, settings, "Contact settings updated");
  } catch (error) {
    return errorResponse(res, "Failed to update contact settings", 500);
  }
};

export const updateFooterSettings = async (req, res) => {
  try {
    const current = await getNormalizedSettings();
    const input = req.body || {};

    const links = normalizeFooterLinks(input.links ?? current.footer.links);
    const nextSection = {
      ...current.footer,
      description: normalizeString(input.description ?? current.footer.description),
      copyright: normalizeString(input.copyright ?? current.footer.copyright),
      links,
    };

    const settings = await saveSection("footer", nextSection);
    return successResponse(res, settings, "Footer settings updated");
  } catch (error) {
    return errorResponse(res, "Failed to update footer settings", 500);
  }
};

export const updateAppearance = async (req, res) => {
  try {
    const current = await getNormalizedSettings();
    const input = req.body || {};

    const nextSection = {
      ...current.appearance,
      primaryColor: normalizeString(
        input.primaryColor ?? current.appearance.primaryColor
      ),
      accentColor: normalizeString(
        input.accentColor ?? current.appearance.accentColor
      ),
      secondaryColor: normalizeString(
        input.secondaryColor ?? current.appearance.secondaryColor
      ),
      successColor: normalizeString(
        input.successColor ?? current.appearance.successColor
      ),
      warningColor: normalizeString(
        input.warningColor ?? current.appearance.warningColor
      ),
      dangerColor: normalizeString(
        input.dangerColor ?? current.appearance.dangerColor
      ),
      infoColor: normalizeString(
        input.infoColor ?? current.appearance.infoColor
      ),
      surfaceColor: normalizeString(
        input.surfaceColor ?? current.appearance.surfaceColor
      ),
      backgroundColor: normalizeString(
        input.backgroundColor ?? current.appearance.backgroundColor
      ),
      textColor: normalizeString(
        input.textColor ?? current.appearance.textColor
      ),
      mutedTextColor: normalizeString(
        input.mutedTextColor ?? current.appearance.mutedTextColor
      ),
      borderColor: normalizeString(
        input.borderColor ?? current.appearance.borderColor
      ),
      darkModeDefault: Boolean(
        input.darkModeDefault ?? current.appearance.darkModeDefault
      ),
      fontFamily: normalizeString(
        input.fontFamily ?? current.appearance.fontFamily
      ),
    };

    const colorFields = [
      "primaryColor",
      "accentColor",
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
    for (const field of colorFields) {
      if (!isValidHex(nextSection[field])) {
        return errorResponse(res, `${field} must be a valid hex value`, 400);
      }
    }

    const settings = await saveSection("appearance", nextSection);
    return successResponse(res, settings, "Appearance settings updated");
  } catch (error) {
    return errorResponse(res, "Failed to update appearance settings", 500);
  }
};

export const updateAppearanceSettings = updateAppearance;

export const updateCertificateSettings = async (req, res) => {
  try {
    const current = await getNormalizedSettings();
    const input = req.body || {};

    const nextSection = {
      ...current.certificate,
      borderColor: normalizeString(
        input.borderColor ?? current.certificate.borderColor
      ),
      headingColor: normalizeString(
        input.headingColor ?? current.certificate.headingColor
      ),
      nameColor: normalizeString(
        input.nameColor ?? current.certificate.nameColor
      ),
      bodyColor: normalizeString(
        input.bodyColor ?? current.certificate.bodyColor
      ),
      backgroundColor: normalizeString(
        input.backgroundColor ?? current.certificate.backgroundColor
      ),
      showQr: Boolean(input.showQr ?? current.certificate.showQr),
      showLogo: Boolean(input.showLogo ?? current.certificate.showLogo),
      showSignature: Boolean(input.showSignature ?? current.certificate.showSignature),
      logoUrl: normalizeString(input.logoUrl ?? current.certificate.logoUrl),
      signatureUrl: normalizeString(
        input.signatureUrl ?? current.certificate.signatureUrl
      ),
      signatureLabel: normalizeString(
        input.signatureLabel ?? current.certificate.signatureLabel
      ),
    };

    const colorFields = [
      "borderColor",
      "headingColor",
      "nameColor",
      "bodyColor",
      "backgroundColor",
    ];
    for (const field of colorFields) {
      if (!isValidHex(nextSection[field])) {
        return errorResponse(res, `${field} must be a valid hex value`, 400);
      }
    }

    const settings = await saveSection("certificate", nextSection);
    return successResponse(res, settings, "Certificate settings updated");
  } catch (error) {
    return errorResponse(res, "Failed to update certificate settings", 500);
  }
};

export const updateMaintenance = async (req, res) => {
  try {
    const current = await getNormalizedSettings();
    const input = req.body || {};

    const nextMaintenance = {
      enabled: Boolean(input.enabled ?? current.maintenance.enabled),
      message: normalizeString(input.message ?? current.maintenance.message),
    };

    await settingsRef().set(
      {
        maintenance: nextMaintenance,
        security: {
          ...(current.security || {}),
          maintenanceMode: nextMaintenance.enabled,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const settings = await getNormalizedSettings();
    return successResponse(res, settings, "Maintenance settings updated");
  } catch (error) {
    return errorResponse(res, "Failed to update maintenance settings", 500);
  }
};

export const updateEmailSettings = async (req, res) => {
  try {
    const current = await getNormalizedSettings();
    const input = req.body || {};

    const smtpHost = normalizeString(input.smtpHost ?? current.email.smtpHost);
    const smtpPort = Number(input.smtpPort ?? current.email.smtpPort);
    const smtpEmail = normalizeString(input.smtpEmail ?? current.email.smtpEmail);
    const smtpPassword = normalizeString(
      input.smtpPassword ?? current.email.smtpPassword
    );
    const fromName = normalizeString(input.fromName ?? current.email.fromName);

    if (!smtpHost) return errorResponse(res, "smtpHost is required", 400);
    if (!Number.isFinite(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
      return errorResponse(res, "smtpPort must be a valid port number", 400);
    }
    if (!isValidEmail(smtpEmail)) {
      return errorResponse(res, "smtpEmail must be a valid email", 400);
    }

    const settings = await saveSection("email", {
      smtpHost,
      smtpPort,
      smtpEmail,
      smtpPassword,
      fromName: fromName || "SUM Academy",
    });
    return successResponse(res, settings, "Email settings updated");
  } catch (error) {
    return errorResponse(res, "Failed to update email settings", 500);
  }
};

export const testEmailSettings = async (req, res) => {
  try {
    const { testEmail } = req.body || {};
    if (!isValidEmail(testEmail)) {
      return errorResponse(res, "testEmail must be valid", 400);
    }

    const settings = await getNormalizedSettings();
    const { transporter, from, configured } = createMailerFromSettings(settings);
    if (!configured || !transporter) {
      return errorResponse(res, "Email settings are incomplete", 400);
    }

    await transporter.sendMail({
      from,
      to: testEmail,
      subject: "SUM Academy SMTP Test",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>SMTP Test Successful</h2>
          <p>Your SUM Academy email settings are working correctly.</p>
        </div>
      `,
    });

    return successResponse(res, {}, "Test email sent successfully");
  } catch (error) {
    return errorResponse(
      res,
      `Failed to send test email: ${error.message || "Unknown error"}`,
      500
    );
  }
};

export const updatePaymentSettings = async (req, res) => {
  try {
    const current = await getNormalizedSettings();
    const input = req.body || {};
    const currentPayment = current.payment || DEFAULT_SETTINGS.payment;

    const nextPayment = {
      jazzcash: {
        ...DEFAULT_SETTINGS.payment.jazzcash,
        ...(currentPayment.jazzcash || {}),
        ...(input.jazzcash || {}),
      },
      easypaisa: {
        ...DEFAULT_SETTINGS.payment.easypaisa,
        ...(currentPayment.easypaisa || {}),
        ...(input.easypaisa || {}),
      },
      bankTransfer: {
        ...DEFAULT_SETTINGS.payment.bankTransfer,
        ...(currentPayment.bankTransfer || {}),
        ...(input.bankTransfer || {}),
      },
    };

    const settings = await saveSection("payment", nextPayment);

    process.env.JAZZCASH_MERCHANT_ID = nextPayment.jazzcash.merchantId || "";
    process.env.JAZZCASH_ACCOUNT_TITLE = nextPayment.jazzcash.accountTitle || "";
    process.env.JAZZCASH_PASSWORD = nextPayment.jazzcash.password || "";
    process.env.JAZZCASH_INTEGRITY_SALT = nextPayment.jazzcash.integritySalt || "";
    process.env.JAZZCASH_INSTRUCTIONS = nextPayment.jazzcash.instructions || "";
    process.env.EASYPAISA_ACCOUNT = nextPayment.easypaisa.accountNumber || "";
    process.env.EASYPAISA_ACCOUNT_TITLE = nextPayment.easypaisa.accountTitle || "";
    process.env.EASYPAISA_USERNAME = nextPayment.easypaisa.username || "";
    process.env.EASYPAISA_PASSWORD = nextPayment.easypaisa.password || "";
    process.env.EASYPAISA_INSTRUCTIONS = nextPayment.easypaisa.instructions || "";
    process.env.BANK_NAME = nextPayment.bankTransfer.bankName || "";
    process.env.BANK_ACCOUNT_TITLE = nextPayment.bankTransfer.accountTitle || "";
    process.env.BANK_ACCOUNT_NUMBER = nextPayment.bankTransfer.accountNumber || "";
    process.env.BANK_IBAN = nextPayment.bankTransfer.iban || "";

    return successResponse(res, settings, "Payment settings updated");
  } catch (error) {
    return errorResponse(res, "Failed to update payment settings", 500);
  }
};

export const updateSecuritySettings = async (req, res) => {
  try {
    const current = await getNormalizedSettings();
    const input = req.body || {};

    const maxLoginAttempts = Number(
      input.maxLoginAttempts ?? current.security.maxLoginAttempts
    );
    const lockoutDuration = Number(
      input.lockoutDuration ?? current.security.lockoutDuration
    );
    const sessionTimeout = Number(
      input.sessionTimeout ?? current.security.sessionTimeout
    );
    const maintenanceMode = Boolean(
      input.maintenanceMode ?? current.security.maintenanceMode
    );

    if (!Number.isFinite(maxLoginAttempts) || maxLoginAttempts < 3 || maxLoginAttempts > 10) {
      return errorResponse(res, "maxLoginAttempts must be between 3 and 10", 400);
    }
    if (!Number.isFinite(lockoutDuration) || lockoutDuration < 5 || lockoutDuration > 60) {
      return errorResponse(res, "lockoutDuration must be between 5 and 60", 400);
    }
    if (!Number.isFinite(sessionTimeout) || sessionTimeout <= 0) {
      return errorResponse(res, "sessionTimeout must be a positive number", 400);
    }

    await settingsRef().set(
      {
        security: {
          maxLoginAttempts,
          lockoutDuration,
          sessionTimeout,
          maintenanceMode,
        },
        maintenance: {
          ...(current.maintenance || {}),
          enabled: maintenanceMode,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const settings = await getNormalizedSettings();
    return successResponse(res, settings, "Security settings updated");
  } catch (error) {
    return errorResponse(res, "Failed to update security settings", 500);
  }
};

export const getEmailTemplates = async (req, res) => {
  try {
    const settings = await getNormalizedSettings();
    return successResponse(res, settings.emailTemplates || { templates: {} }, "Email templates fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch email templates", 500);
  }
};

export const updateEmailTemplate = async (req, res) => {
  try {
    const current = await getNormalizedSettings();
    const { templateName, subject, body } = req.body || {};
    const normalizedTemplateName = normalizeString(templateName);

    if (!normalizedTemplateName) {
      return errorResponse(res, "templateName is required", 400);
    }
    if (!normalizeString(subject)) {
      return errorResponse(res, "subject is required", 400);
    }
    if (!normalizeString(body)) {
      return errorResponse(res, "body is required", 400);
    }

    const existingTemplates = current.emailTemplates?.templates || {};
    const nextTemplates = {
      ...existingTemplates,
      [normalizedTemplateName]: {
        subject: normalizeString(subject),
        body: String(body),
      },
    };

    const settings = await saveSection("emailTemplates", { templates: nextTemplates });
    return successResponse(res, settings, "Template updated");
  } catch (error) {
    return errorResponse(res, "Failed to update email template", 500);
  }
};

export const submitLaunchNotify = async (req, res) => {
  try {
    const rawEmail = normalizeEmail(req.body?.email || "");
    if (!isValidEmail(rawEmail)) {
      return errorResponse(res, "Valid email is required", 400);
    }

    const now = new Date();
    const settings = await getNormalizedSettings();
    const { transporter, from, configured } = createMailerFromSettings(settings);

    const shouldSendNow = now >= LAUNCH_DATE && configured && transporter;

    const docRef = launchNotifyRef(rawEmail);
    const payload = {
      email: rawEmail,
      status: shouldSendNow ? "sent" : "pending",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await docRef.set(
      {
        ...payload,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (shouldSendNow) {
      await transporter.sendMail({
        from,
        to: rawEmail,
        subject: "SUM Academy is now live",
        html: `
          <div style="font-family: DM Sans, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background: #f8f9fe; border-radius: 16px;">
            <h2 style="color: #4a63f5; margin: 0 0 10px;">We are live!</h2>
            <p style="color: #334155;">Thank you for joining the SUM Academy launch list. You can now access the platform and start learning.</p>
            <p style="margin-top: 16px;"><a href="https://sumacademy.net" style="background: #4a63f5; color: #ffffff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 600;">Go to SUM Academy</a></p>
            <p style="margin-top: 16px; color: #94a3b8; font-size: 12px;">© 2026 SUM Academy — Karachi, Pakistan</p>
          </div>
        `,
      });
      await docRef.set(
        {
          status: "sent",
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return successResponse(
      res,
      { status: shouldSendNow ? "sent" : "pending" },
      shouldSendNow
        ? "Launch notification sent"
        : "You are on the launch notification list"
    );
  } catch (error) {
    return errorResponse(res, "Failed to save launch notification", 500);
  }
};

export const dispatchLaunchNotifications = async (req, res) => {
  try {
    if (new Date() < LAUNCH_DATE) {
      return errorResponse(res, "Launch date has not passed yet", 400);
    }

    const settings = await getNormalizedSettings();
    const { transporter, from, configured } = createMailerFromSettings(settings);
    if (!configured || !transporter) {
      return errorResponse(res, "Email settings are incomplete", 400);
    }

    const pendingSnap = await db
      .collection(LAUNCH_NOTIFY_COLLECTION)
      .where("status", "==", "pending")
      .limit(200)
      .get();

    let sentCount = 0;
    for (const doc of pendingSnap.docs) {
      const data = doc.data() || {};
      const email = normalizeEmail(data.email || doc.id);
      if (!isValidEmail(email)) continue;

      await transporter.sendMail({
        from,
        to: email,
        subject: "SUM Academy is now live",
        html: `
          <div style="font-family: DM Sans, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background: #f8f9fe; border-radius: 16px;">
            <h2 style="color: #4a63f5; margin: 0 0 10px;">We are live!</h2>
            <p style="color: #334155;">Thank you for joining the SUM Academy launch list. You can now access the platform and start learning.</p>
            <p style="margin-top: 16px;"><a href="https://sumacademy.net" style="background: #4a63f5; color: #ffffff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 600;">Go to SUM Academy</a></p>
            <p style="margin-top: 16px; color: #94a3b8; font-size: 12px;">© 2026 SUM Academy — Karachi, Pakistan</p>
          </div>
        `,
      });

      await doc.ref.set(
        {
          status: "sent",
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      sentCount += 1;
    }

    return successResponse(
      res,
      { sentCount },
      "Launch notifications dispatched"
    );
  } catch (error) {
    return errorResponse(res, "Failed to dispatch launch notifications", 500);
  }
};

export { DEFAULT_SETTINGS };
const normalizeSubjects = (subjects = []) =>
  (Array.isArray(subjects) ? subjects : [])
    .map((item) => normalizeString(item))
    .filter(Boolean);
