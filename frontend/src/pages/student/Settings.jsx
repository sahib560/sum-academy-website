import { useState } from "react";
import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

function StudentSettings() {
  const [notifications, setNotifications] = useState({
    reminders: true,
    announcements: true,
    promotions: false,
  });

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Manage your preferences.</p>
      </motion.section>

      <motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h3 className="font-heading text-xl text-slate-900">
          Notification Preferences
        </h3>
        <div className="mt-4 space-y-3">
          {[
            {
              key: "reminders",
              label: "Session reminders",
              desc: "Get a reminder before live sessions",
            },
            {
              key: "announcements",
              label: "Course announcements",
              desc: "Receive important course updates",
            },
            {
              key: "promotions",
              label: "Promotions",
              desc: "Receive new course offers and discounts",
            },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
              <button
                className={`h-7 w-12 rounded-full p-1 ${
                  notifications[item.key] ? "bg-primary" : "bg-slate-200"
                }`}
                onClick={() =>
                  setNotifications((prev) => ({
                    ...prev,
                    [item.key]: !prev[item.key],
                  }))
                }
                type="button"
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white transition ${
                    notifications[item.key] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}

export default StudentSettings;
