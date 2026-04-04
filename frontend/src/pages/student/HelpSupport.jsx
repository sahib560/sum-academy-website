import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Skeleton } from "../../components/Skeleton.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { submitStudentHelpSupport } from "../../services/student.service.js";
import {
  normalizePakistanPhone,
  toPakistanWhatsAppNumber,
  toTelHref,
} from "../../utils/phone.js";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const CATEGORY_TABS = ["All", "Courses", "Payments", "Technical", "Account"];
const CATEGORY_OPTIONS = ["Courses", "Payments", "Technical", "Account", "General"];

const FALLBACK_FAQS = [
  {
    id: "faq-1",
    question: "How do I enroll in a course?",
    answer: "Browse courses and click Enroll Now.",
    category: "Courses",
  },
  {
    id: "faq-2",
    question: "What payment methods are accepted?",
    answer: "JazzCash, EasyPaisa, and Bank Transfer are available.",
    category: "Payments",
  },
  {
    id: "faq-3",
    question: "I cannot access a lecture. What should I do?",
    answer: "Contact your teacher or support to check your access status.",
    category: "Technical",
  },
];

const normalizeText = (value = "") => String(value || "").trim();

const inferCategory = (question = "", answer = "") => {
  const text = `${normalizeText(question)} ${normalizeText(answer)}`.toLowerCase();
  if (/(payment|installment|fee|receipt|refund|jazzcash|easypaisa|bank)/.test(text)) {
    return "Payments";
  }
  if (/(login|password|error|bug|issue|device|video|technical|loading|crash)/.test(text)) {
    return "Technical";
  }
  if (/(profile|account|email|name|settings|teacher|announcement)/.test(text)) {
    return "Account";
  }
  return "Courses";
};

const buildFaqRows = (faq = []) => {
  if (!Array.isArray(faq) || !faq.length) return FALLBACK_FAQS;
  const rows = faq
    .map((item, index) => {
      const question = normalizeText(item?.question);
      const answer = normalizeText(item?.answer);
      if (!question || !answer) return null;
      return {
        id: normalizeText(item?.id) || `faq-${index + 1}`,
        question,
        answer,
        category: inferCategory(question, answer),
      };
    })
    .filter(Boolean);
  return rows.length ? rows : FALLBACK_FAQS;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function StudentHelpSupport() {
  const { settings, loading } = useSettings();
  const { userProfile } = useAuth();

  const contact = settings?.contact || {};
  const faqRows = useMemo(() => buildFaqRows(contact.faq), [contact.faq]);

  const initialName =
    normalizeText(userProfile?.fullName) ||
    normalizeText(userProfile?.name) ||
    normalizeText(userProfile?.displayName) ||
    "";
  const initialEmail = normalizeText(userProfile?.email);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [expandedId, setExpandedId] = useState("");
  const [helpfulById, setHelpfulById] = useState({});
  const [toast, setToast] = useState("");
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    name: initialName,
    email: initialEmail,
    category: "Courses",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: prev.name || initialName,
      email: prev.email || initialEmail,
    }));
  }, [initialName, initialEmail]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const filteredFaqs = useMemo(() => {
    const query = search.toLowerCase().trim();
    return faqRows.filter((item) => {
      const matchesCategory =
        activeCategory === "All" || item.category === activeCategory;
      const matchesQuery =
        !query ||
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, faqRows, search]);

  const validateForm = () => {
    const next = {};
    if (!normalizeText(form.name)) next.name = "Name is required";
    if (!emailRegex.test(normalizeText(form.email))) next.email = "Valid email is required";
    if (!normalizeText(form.subject) || normalizeText(form.subject).length < 3) {
      next.subject = "Subject must be at least 3 characters";
    }
    if (!normalizeText(form.message) || normalizeText(form.message).length < 10) {
      next.message = "Message must be at least 10 characters";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitForm = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    setSending(true);
    try {
      await submitStudentHelpSupport({
        name: normalizeText(form.name),
        email: normalizeText(form.email),
        category: normalizeText(form.category) || "General",
        subject: normalizeText(form.subject),
        message: normalizeText(form.message),
      });
      setForm((prev) => ({ ...prev, subject: "", message: "" }));
      setErrors({});
      setToast("Message sent! Reply within 24 hours.");
    } catch (error) {
      setToast(error?.response?.data?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const supportEmail = normalizeText(contact.email) || "support@sumacademy.com";
  const supportWhatsapp =
    normalizePakistanPhone(normalizeText(contact.whatsapp)) ||
    normalizeText(contact.whatsapp) ||
    "+92 300 0000000";
  const supportPhone =
    normalizePakistanPhone(normalizeText(contact.phone)) ||
    normalizeText(contact.phone) ||
    "+92 300 0000000";
  const supportHours = normalizeText(contact.officeHours) || "Monday to Saturday 9AM to 6PM PKT";
  const whatsappHref = toPakistanWhatsAppNumber(supportWhatsapp)
    ? `https://wa.me/${toPakistanWhatsAppNumber(supportWhatsapp)}`
    : "";
  const phoneHref = toTelHref(supportPhone);

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Help & Support</h1>
        <p className="mt-1 text-sm text-slate-500">Find answers quickly or contact support.</p>
      </motion.section>

      <motion.section {...fadeUp} className="flex justify-center">
        <div className="relative w-full max-w-2xl">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search for help topics..."
            className="w-full rounded-full border border-slate-200 bg-white px-12 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">Search</span>
        </div>
      </motion.section>

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={`help-card-skel-${index}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-4 w-full" />
              </div>
            ))
          : [
              { title: "Email", value: supportEmail, href: `mailto:${supportEmail}` },
              { title: "WhatsApp", value: supportWhatsapp, href: whatsappHref },
              { title: "Phone", value: supportPhone, href: phoneHref },
              { title: "Office Hours", value: supportHours, href: "" },
            ].map((item) => (
              <div key={item.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{item.title}</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{item.value}</p>
                {item.href ? (
                  <a
                    href={item.href}
                    target={item.href.startsWith("http") ? "_blank" : undefined}
                    rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                    className="mt-4 inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-primary"
                  >
                    Open
                  </a>
                ) : null}
              </div>
            ))}
      </motion.section>

      <motion.section {...fadeUp} className="space-y-4">
        <h2 className="font-heading text-2xl text-slate-900">Frequently Asked Questions</h2>

        <div className="flex flex-wrap gap-3">
          {CATEGORY_TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setActiveCategory(item)}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                activeCategory === item
                  ? "bg-primary text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`faq-skel-${index}`} className="rounded-3xl border border-slate-200 bg-white p-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-3 h-3 w-full" />
              </div>
            ))}
          </div>
        ) : filteredFaqs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            No FAQ found for this search.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFaqs.map((item) => {
              const isOpen = expandedId === item.id;
              return (
                <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left"
                    onClick={() => setExpandedId((prev) => (prev === item.id ? "" : item.id))}
                  >
                    <span className="font-semibold text-slate-900">{item.question}</span>
                    <span className="text-xs font-semibold text-slate-500">{isOpen ? "Hide" : "Show"}</span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                          <p>{item.answer}</p>
                          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                            <span>Was this helpful?</span>
                            <button
                              type="button"
                              onClick={() => {
                                setHelpfulById((prev) => ({ ...prev, [item.id]: "yes" }));
                                setToast("Thanks for your feedback");
                              }}
                              className={`rounded-full border px-3 py-1 ${
                                helpfulById[item.id] === "yes"
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 text-slate-600"
                              }`}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setHelpfulById((prev) => ({ ...prev, [item.id]: "no" }));
                                setToast("Thanks for your feedback");
                              }}
                              className={`rounded-full border px-3 py-1 ${
                                helpfulById[item.id] === "no"
                                  ? "border-amber-300 bg-amber-50 text-amber-700"
                                  : "border-slate-200 text-slate-600"
                              }`}
                            >
                              No
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </motion.section>

      <motion.section {...fadeUp} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-heading text-xl text-slate-900">Still need help? Send us a message</h3>

        <form className="mt-4 space-y-4" onSubmit={submitForm}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Name</label>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              {errors.name ? <p className="mt-1 text-xs text-rose-600">{errors.name}</p> : null}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Email</label>
              <input
                value={form.email}
                readOnly
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
              {errors.email ? <p className="mt-1 text-xs text-rose-600">{errors.email}</p> : null}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Category</label>
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Subject</label>
              <input
                value={form.subject}
                onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              {errors.subject ? <p className="mt-1 text-xs text-rose-600">{errors.subject}</p> : null}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Message</label>
            <textarea
              rows={4}
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            {errors.message ? <p className="mt-1 text-xs text-rose-600">{errors.message}</p> : null}
          </div>

          <button type="submit" className="btn-primary" disabled={sending}>
            {sending ? "Sending..." : "Submit"}
          </button>
        </form>
      </motion.section>

      <motion.section {...fadeUp} className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">{normalizeText(contact.heading) || "SUM Academy Support"}</p>
        <p>{normalizeText(contact.subheading) || "We are here to help you"}</p>
        <p className="mt-2">Email: {supportEmail}</p>
        <p>WhatsApp: {supportWhatsapp}</p>
        <p>Phone: {supportPhone}</p>
        <p>Office Hours: {supportHours}</p>
        {normalizeText(contact.address) ? <p>Address: {normalizeText(contact.address)}</p> : null}
      </motion.section>

      {toast ? (
        <div className="fixed right-6 top-6 z-[70] rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

export default StudentHelpSupport;
