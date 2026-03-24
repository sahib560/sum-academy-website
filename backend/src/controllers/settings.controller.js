import nodemailer from "nodemailer";
import { admin, db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { errorResponse, successResponse } from "../utils/response.utils.js";

const SETTINGS_DOC_ID = "siteSettings";

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
    mission:
      "To provide quality education to every student in Pakistan regardless of location",
    vision: "Become Pakistan's leading digital learning platform",
    story:
      "SUM Academy was founded with a simple mission: make quality education accessible to all students across Pakistan",
    foundedYear: "2024",
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
    darkModeDefault: false,
    fontFamily: "DM Sans",
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
      password: "",
      integritySalt: "",
      enabled: false,
    },
    easypaisa: {
      accountNumber: "",
      username: "",
      password: "",
      enabled: false,
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
    const steps = normalizeHowItWorksSteps(input.steps ?? current.howItWorks.steps);

    if (!validateStringMin(heading, 3)) {
      return errorResponse(res, "How It Works heading is required", 400);
    }
    if (steps.length < 1) {
      return errorResponse(res, "At least one step is required", 400);
    }

    const nextSection = {
      heading,
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
      mission: normalizeString(input.mission ?? current.about.mission),
      vision: normalizeString(input.vision ?? current.about.vision),
      story: normalizeString(input.story ?? current.about.story),
      foundedYear: normalizeString(input.foundedYear ?? current.about.foundedYear),
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

    const primaryColor = normalizeString(
      input.primaryColor ?? current.appearance.primaryColor
    );
    const accentColor = normalizeString(
      input.accentColor ?? current.appearance.accentColor
    );

    if (!isValidHex(primaryColor) || !isValidHex(accentColor)) {
      return errorResponse(res, "Colors must be valid hex values", 400);
    }

    const nextSection = {
      ...current.appearance,
      primaryColor,
      accentColor,
      darkModeDefault: Boolean(
        input.darkModeDefault ?? current.appearance.darkModeDefault
      ),
      fontFamily: normalizeString(
        input.fontFamily ?? current.appearance.fontFamily
      ),
    };

    const settings = await saveSection("appearance", nextSection);
    return successResponse(res, settings, "Appearance settings updated");
  } catch (error) {
    return errorResponse(res, "Failed to update appearance settings", 500);
  }
};

export const updateAppearanceSettings = updateAppearance;

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
    const email = settings.email || DEFAULT_SETTINGS.email;

    if (!email.smtpHost || !email.smtpPort || !email.smtpEmail || !email.smtpPassword) {
      return errorResponse(res, "Email settings are incomplete", 400);
    }

    const transporter = nodemailer.createTransport({
      host: email.smtpHost,
      port: Number(email.smtpPort),
      secure: false,
      auth: {
        user: email.smtpEmail,
        pass: email.smtpPassword,
      },
    });

    await transporter.sendMail({
      from: `"${email.fromName || "SUM Academy"}" <${email.smtpEmail}>`,
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
    process.env.JAZZCASH_PASSWORD = nextPayment.jazzcash.password || "";
    process.env.JAZZCASH_INTEGRITY_SALT = nextPayment.jazzcash.integritySalt || "";
    process.env.EASYPAISA_ACCOUNT = nextPayment.easypaisa.accountNumber || "";
    process.env.EASYPAISA_USERNAME = nextPayment.easypaisa.username || "";
    process.env.EASYPAISA_PASSWORD = nextPayment.easypaisa.password || "";
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

export { DEFAULT_SETTINGS };
