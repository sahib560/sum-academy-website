import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

function StudentProfile() {
  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500">View your student details.</p>
      </motion.section>

      <motion.section
        {...fadeUp}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            SA
          </div>
          <div>
            <h2 className="font-heading text-2xl text-slate-900">Sana Ahmed</h2>
            <p className="text-sm text-slate-500">sana.ahmed@sumacademy.pk</p>
            <p className="text-xs text-slate-400">Member since Jan 2025</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 text-sm text-slate-600">
          <p>Program: Pre-Medical</p>
          <p>Phone: +92 300 1234567</p>
          <p>City: Larkana</p>
        </div>
      </motion.section>
    </div>
  );
}

export default StudentProfile;
