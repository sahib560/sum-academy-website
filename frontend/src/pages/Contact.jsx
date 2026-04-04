import { useEffect, useState } from "react";
import { FiMapPin } from "react-icons/fi";
import { useSettings } from "../hooks/useSettings.js";
import { normalizePakistanPhone } from "../utils/phone.js";
import { submitPublicContactMessage } from "../services/student.service.js";

const NOT_ADDED = "Not added yet";
const textOrNotAdded = (value) => {
  const cleaned = String(value || "").trim();
  return cleaned || NOT_ADDED;
};

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
  const contactPhone =
    normalizePakistanPhone(contact.phone || settings.general?.contactPhone) ||
    contact.phone ||
    settings.general?.contactPhone ||
    "";
  const contactWhatsapp =
    normalizePakistanPhone(contact.whatsapp || settings.general?.contactPhone) ||
    contact.whatsapp ||
    settings.general?.contactPhone ||
    "";
  const faqItems = Array.isArray(contact.faq) ? contact.faq : [];
  const subjectOptions = Array.isArray(contact.subjects) ? contact.subjects : [];
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState("success");
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await submitPublicContactMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        category: form.subject || "Contact",
        subject: form.subject,
        message: form.message.trim(),
      });
      setLoading(false);
      setForm(initialForm);
      setToastType("success");
      setToast("Message sent successfully!");
    } catch (error) {
      setLoading(false);
      setToastType("error");
      setToast(error?.response?.data?.message || "Failed to send message");
    }
  };

  return (
    <main className="pt-24">
      <section className="section">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-2xl shadow-slate-200/50 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/40">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">
              {textOrNotAdded(settings.general?.siteName)}
            </p>
            <h1 className="font-heading text-4xl text-slate-900 dark:text-white">
              {textOrNotAdded(contact.heading)}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-200">
              {textOrNotAdded(contact.subheading)}
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
                {(subjectOptions.length ? subjectOptions : [NOT_ADDED]).map((subject) => (
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
                    {textOrNotAdded(settings.general?.address)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Email
                  </p>
                  <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                    {textOrNotAdded(contact.email || settings.general?.contactEmail)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Phone
                  </p>
                  <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                    {textOrNotAdded(contactPhone)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    WhatsApp
                  </p>
                  <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                    {textOrNotAdded(contactWhatsapp)}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-card">
              <h3 className="font-heading text-2xl text-slate-900 dark:text-white">
                Office Hours
              </h3>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-200">
                {textOrNotAdded(contact.officeHours)}
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
                ].map((item) =>
                  item.to && item.to !== "#" ? (
                    <a key={item.label} href={item.to} target="_blank" rel="noreferrer" className="tag">
                      {item.label}
                    </a>
                  ) : null
                )}
                {!social.facebook && !social.instagram && !social.whatsapp && !social.youtube ? (
                  <span className="tag">{NOT_ADDED}</span>
                ) : null}
              </div>
            </div>

            <div className="glass-card">
              <h3 className="font-heading text-2xl text-slate-900 dark:text-white">
                Location
              </h3>
              <div className="mt-4 flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-2 text-sm">
                  <FiMapPin className="h-5 w-5" />
                  {textOrNotAdded(contact.address || settings.general?.address)}
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
            {faqItems.length ? faqItems.map((faq, index) => {
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
                      {textOrNotAdded(faq.question)}
                    </span>
                    <span className="text-slate-400 dark:text-slate-300">
                      {isOpen ? "-" : "+"}
                    </span>
                  </div>
                  {isOpen && (
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-200">
                      {textOrNotAdded(faq.answer)}
                    </p>
                  )}
                </button>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
                {NOT_ADDED}
              </div>
            )}
          </div>
        </div>
      </section>

      {toast && (
        <div
          className={`fixed right-6 top-24 z-[70] rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${
            toastType === "error" ? "bg-rose-600" : "bg-slate-900"
          }`}
        >
          {toast}
        </div>
      )}
    </main>
  );
}

export default Contact;
