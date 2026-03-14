import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const faqs = [
  {
    id: 1,
    q: "How do I reset my password?",
    a: "Go to Settings > Security and update your password.",
  },
  {
    id: 2,
    q: "Where can I download my certificate?",
    a: "Open Certificates from the sidebar to download the PDF.",
  },
  {
    id: 3,
    q: "How do I pay my installment?",
    a: "Visit Payments and choose Pay Now for the due installment.",
  },
];

function StudentSupport() {
  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Help & Support</h1>
        <p className="text-sm text-slate-500">
          We’re here to help you with any issues.
        </p>
      </motion.section>

      <motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h3 className="font-heading text-xl text-slate-900">Contact Support</h3>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <p>Email: support@sumacademy.pk</p>
          <p>WhatsApp: +92 300 1234567</p>
          <p>Office Hours: Mon - Sat, 9:00 AM - 6:00 PM</p>
        </div>
      </motion.section>

      <motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h3 className="font-heading text-xl text-slate-900">FAQs</h3>
        <div className="mt-4 space-y-3">
          {faqs.map((item) => (
            <details
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <summary className="cursor-pointer font-semibold text-slate-700">
                {item.q}
              </summary>
              <p className="mt-2 text-sm text-slate-500">{item.a}</p>
            </details>
          ))}
        </div>
      </motion.section>
    </div>
  );
}

export default StudentSupport;
