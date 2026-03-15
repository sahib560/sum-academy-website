import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "../../components/Skeleton.jsx";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const categories = [
  "All",
  "Courses & Learning",
  "Payments",
  "Technical",
  "Account",
];

const faqs = [
  {
    id: 1,
    question: "How do I enroll in a course?",
    answer:
      "Open Explore Courses, choose a course, and click Enroll Now to complete payment or start free access.",
    category: "Courses & Learning",
  },
  {
    id: 2,
    question: "What payment methods are accepted?",
    answer: "We accept JazzCash, EasyPaisa, and bank transfer.",
    category: "Payments",
  },
  {
    id: 3,
    question: "Can I access courses on mobile?",
    answer: "Yes, all courses are optimized for mobile and tablet devices.",
    category: "Technical",
  },
  {
    id: 4,
    question: "How do I get my certificate?",
    answer: "Complete 100% of a course and your certificate will appear under My Certificates.",
    category: "Courses & Learning",
  },
  {
    id: 5,
    question: "What happens if I miss an installment payment?",
    answer: "Your access may be paused. Please contact support or your teacher to restore access.",
    category: "Payments",
  },
  {
    id: 6,
    question: "How do I reset my password?",
    answer: "Go to Settings and use the Change Password section, or use Forgot Password on login.",
    category: "Account",
  },
  {
    id: 7,
    question: "Can I watch videos offline?",
    answer: "Offline viewing depends on course settings. Some lessons may allow download if enabled.",
    category: "Courses & Learning",
  },
  {
    id: 8,
    question: "How do I contact my teacher?",
    answer: "Use the class announcements page or the messaging option in your class dashboard.",
    category: "Account",
  },
  {
    id: 9,
    question: "What is the refund policy?",
    answer: "Refunds are handled case-by-case. Please contact support within 7 days of purchase.",
    category: "Payments",
  },
  {
    id: 10,
    question: "How do I join a live session?",
    answer: "Go to your course or dashboard and click the Join button on the session card.",
    category: "Courses & Learning",
  },
];

function StudentHelpSupport() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [expanded, setExpanded] = useState({});
  const [toast, setToast] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: "Sana Ahmed",
    email: "sana.ahmed@sumacademy.com",
    category: "Course Issue",
    subject: "",
    message: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const filteredFaqs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return faqs.filter((item) => {
      const matchesCategory =
        activeCategory === "All" || item.category === activeCategory;
      const matchesQuery =
        !query ||
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, search]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
      setToast({ message: "Message sent successfully!" });
    }, 900);
  };

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Help & Support</h1>
      </motion.section>

      <motion.section {...fadeUp} className="flex justify-center">
        <div className="relative w-full max-w-2xl">
          <input
            type="text"
            placeholder="Search for help topics..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-full border border-slate-200 bg-white px-12 py-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
        </div>
      </motion.section>

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            💬
          </div>
          <h3 className="mt-3 font-heading text-lg text-slate-900">
            Contact Support
          </h3>
          <p className="text-sm text-slate-500">Chat with our team</p>
          <button className="btn-primary mt-4 w-full">Send Message</button>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            🟢
          </div>
          <h3 className="mt-3 font-heading text-lg text-slate-900">
            WhatsApp Support
          </h3>
          <p className="text-sm text-slate-500">Chat on WhatsApp</p>
          <a className="btn-outline mt-4 w-full text-center" href="https://wa.me/923000000000">
            Open WhatsApp
          </a>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            ✉️
          </div>
          <h3 className="mt-3 font-heading text-lg text-slate-900">Email Support</h3>
          <p className="text-sm text-slate-500">support@sumacademy.com</p>
          <button className="btn-outline mt-4 w-full">Send Email</button>
        </div>
      </motion.section>

      <motion.section {...fadeUp} className="space-y-4">
        <h2 className="font-heading text-2xl text-slate-900">
          Frequently Asked Questions
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {categories.map((item) => (
            <button
              key={item}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                activeCategory === item
                  ? "bg-primary text-white"
                  : "border border-slate-200 text-slate-600"
              }`}
              onClick={() => setActiveCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`faq-skel-${index}`}
                className="rounded-3xl border border-slate-200 bg-white p-4"
              >
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-3 h-3 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFaqs.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-slate-200 bg-white p-4"
              >
                <button
                  className="flex w-full items-center justify-between text-left"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [item.id]: !prev[item.id],
                    }))
                  }
                >
                  <span className="font-semibold text-slate-900">
                    {item.question}
                  </span>
                  <span className="text-slate-400">
                    {expanded[item.id] ? "▲" : "▼"}
                  </span>
                </button>
                {expanded[item.id] && (
                  <div className="mt-3 text-sm text-slate-500">
                    {item.answer}
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      Was this helpful?
                      <button className="rounded-full border border-slate-200 px-3 py-1 text-xs">
                        Yes
                      </button>
                      <button className="rounded-full border border-slate-200 px-3 py-1 text-xs">
                        No
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.section>

      <motion.section {...fadeUp} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-heading text-xl text-slate-900">
          Still need help? Send us a message
        </h3>
        {sent ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            Your message has been sent! We&apos;ll reply within 24 hours.
          </div>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Name
                </label>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Email
                </label>
                <input
                  value={form.email}
                  readOnly
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option>Course Issue</option>
                  <option>Payment Issue</option>
                  <option>Technical Problem</option>
                  <option>Account Issue</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Subject
                </label>
                <input
                  value={form.subject}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, subject: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400">
                Message
              </label>
              <textarea
                rows={4}
                value={form.message}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, message: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">
                Attach screenshot
                <input type="file" className="hidden" />
              </label>
              <button className="btn-primary" type="submit" disabled={sending}>
                {sending ? "Sending..." : "Send Message"}
              </button>
            </div>
          </form>
        )}
      </motion.section>

      <motion.section {...fadeUp} className="text-sm text-slate-500">
        <p className="font-semibold text-slate-700">SUM Academy Support</p>
        <p>Karachi, Pakistan</p>
        <p>support@sumacademy.com</p>
        <p>Mon-Sat, 9AM - 6PM PKT</p>
      </motion.section>

      {toast && (
        <div className="fixed right-6 top-6 z-[70] rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default StudentHelpSupport;
