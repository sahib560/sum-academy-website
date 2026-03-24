import { useEffect, useState } from "react";
import { useSettings } from "../hooks/useSettings.js";

const subjects = ["Admissions", "Courses", "Technical Support", "Payments", "Other"];

const faqs = [
  {
    question: "How do I enroll in a course?",
    answer:
      "Browse the Courses page, select your program, and click Enroll Now to start.",
  },
  {
    question: "Which payment methods are supported in Pakistan?",
    answer:
      "We support bank transfers, Easypaisa, and JazzCash for convenient payments.",
  },
  {
    question: "Can I access courses on mobile?",
    answer:
      "Yes, SUM Academy is fully responsive and optimized for mobile learning.",
  },
  {
    question: "Do you provide certificates?",
    answer:
      "Certificates are issued after successful completion with a verifiable ID.",
  },
  {
    question: "How can I contact a teacher?",
    answer:
      "Use the in-platform messaging tools or reach out via the Contact form.",
  },
];

const initialForm = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

function Contact() {
  const { settings } = useSettings();
  const contact = settings.contact || {};
  const social = settings.general?.socialLinks || {};
  const faqItems = contact.faq?.length ? contact.faq : faqs;
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const validate = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Name is required.";
    if (!form.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = "Enter a valid email.";
    }
    if (!form.subject) nextErrors.subject = "Subject is required.";
    if (!form.message.trim()) nextErrors.message = "Message is required.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setForm(initialForm);
      setToast("Message sent successfully!");
    }, 1000);
  };

  return (
    <main className="pt-24">
      <section className="section">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-2xl shadow-slate-200/50 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/40">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">
              {settings.general.siteName || "SUM Academy"}
            </p>
            <h1 className="font-heading text-4xl text-slate-900 dark:text-white">
              {contact.heading || "Get In Touch"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-200">
              {contact.subheading ||
                "We are here to help with admissions, course guidance, and support."}
            </p>
          </div>
        </div>
      </section>

      <section className="section pt-0">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <form
            onSubmit={handleSubmit}
            className="glass-card flex flex-col gap-5"
          >
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-dark dark:text-slate-200"
                placeholder="Your name"
              />
              {errors.name && (
                <p className="mt-2 text-xs text-accent">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-dark dark:text-slate-200"
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="mt-2 text-xs text-accent">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Subject
              </label>
              <select
                value={form.subject}
                onChange={(event) =>
                  setForm({ ...form, subject: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-dark dark:text-slate-200"
              >
                <option value="">Select a subject</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
              {errors.subject && (
                <p className="mt-2 text-xs text-accent">{errors.subject}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Message
              </label>
              <textarea
                value={form.message}
                onChange={(event) =>
                  setForm({ ...form, message: event.target.value })
                }
                rows={5}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-dark dark:text-slate-200"
                placeholder="Tell us how we can help..."
              />
              {errors.message && (
                <p className="mt-2 text-xs text-accent">{errors.message}</p>
              )}
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Sending..." : "Send Message"}
            </button>
          </form>

          <div className="flex flex-col gap-6">
            <div className="glass-card">
              <h3 className="font-heading text-2xl text-slate-900 dark:text-white">
                Contact Info
              </h3>
              <div className="mt-4 grid gap-4 text-sm text-slate-600 dark:text-slate-200">
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Address
                  </p>
                  <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                    {settings.general.address || "Karachi, Pakistan"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Email
                  </p>
                  <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                    {contact.email || settings.general.contactEmail || "info@sumacademy.pk"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Phone
                  </p>
                  <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                    {contact.phone || settings.general.contactPhone || "+92 300 123 4567"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    WhatsApp
                  </p>
                  <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                    {contact.whatsapp || settings.general.contactPhone || "+92 300 123 4567"}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-card">
              <h3 className="font-heading text-2xl text-slate-900 dark:text-white">
                Office Hours
              </h3>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-200">
                {contact.officeHours || "Mon-Sat, 9AM - 6PM PKT"}
              </p>
            </div>

            <div className="glass-card">
              <h3 className="font-heading text-2xl text-slate-900 dark:text-white">
                Social Links
              </h3>
              <div className="mt-4 flex flex-wrap gap-3">
                {[
                  { label: "Facebook", to: social.facebook || "#" },
                  { label: "Instagram", to: social.instagram || "#" },
                  { label: "WhatsApp", to: social.whatsapp || "#" },
                  { label: "YouTube", to: social.youtube || "#" },
                ].map((item) => (
                  <a key={item.label} href={item.to} target="_blank" rel="noreferrer" className="tag">
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="glass-card">
              <h3 className="font-heading text-2xl text-slate-900 dark:text-white">
                Location
              </h3>
              <div className="mt-4 flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-2 text-sm">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
                  </svg>
                  {contact.address || settings.general.address || "Karachi, Pakistan"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section pt-0">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              FAQs
            </p>
            <h2 className="mt-3 font-heading text-3xl text-slate-900 dark:text-white">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="grid gap-4">
            {faqItems.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <button
                  key={faq.question}
                  type="button"
                  className="w-full rounded-2xl border border-slate-200/70 bg-white/80 p-5 text-left shadow-lg shadow-slate-200/40 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/50"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {faq.question}
                    </span>
                    <span className="text-slate-400 dark:text-slate-300">
                      {isOpen ? "-" : "+"}
                    </span>
                  </div>
                  {isOpen && (
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-200">
                      {faq.answer}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {toast && (
        <div className="fixed right-6 top-24 z-[70] rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}
    </main>
  );
}

export default Contact;
