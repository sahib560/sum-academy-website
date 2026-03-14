import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const announcements = [
  {
    id: 1,
    title: "Live revision session tomorrow",
    source: "Batch A - Biology XI",
    date: "Mar 14, 2026",
  },
  {
    id: 2,
    title: "Worksheet uploaded in Module 3",
    source: "Chemistry Quick Revision",
    date: "Mar 12, 2026",
  },
  {
    id: 3,
    title: "Essay topics list updated",
    source: "English Essay Clinic",
    date: "Mar 10, 2026",
  },
];

function StudentAnnouncements() {
  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Announcements</h1>
        <p className="text-sm text-slate-500">
          Latest updates from your classes and courses.
        </p>
      </motion.section>

      <motion.section {...fadeUp} className="space-y-3">
        {announcements.map((item) => (
          <div
            key={item.id}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="font-heading text-lg text-slate-900">{item.title}</h3>
            <p className="text-sm text-slate-500">{item.source}</p>
            <p className="mt-2 text-xs text-slate-400">{item.date}</p>
          </div>
        ))}
      </motion.section>
    </div>
  );
}

export default StudentAnnouncements;
