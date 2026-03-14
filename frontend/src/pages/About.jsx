import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const factItems = [
  { label: "Founded", value: "2014" },
  { label: "Students", value: "12,500+" },
  { label: "Courses", value: "120+" },
  { label: "Pass Rate", value: "96%" },
];

const features = [
  {
    title: "Certified Teachers",
    description: "Experienced faculty with strong academic and mentoring records.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
        <path d="M12 3 1 9l11 6 9-4.9V17h2V9L12 3zm0 9.7L5.1 9 12 5.3 18.9 9 12 12.7z" />
        <path d="M5 12.3v4.2c0 2.2 3.1 4 7 4s7-1.8 7-4v-4.2l-7 3.8-7-3.8z" />
      </svg>
    ),
  },
  {
    title: "Secure Platform",
    description: "Data protection, safe payments, and privacy-first LMS features.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
        <path d="M12 3 4 6v6c0 5 3.4 9.5 8 10 4.6-.5 8-5 8-10V6l-8-3zm0 9.5 3.5-3.5 1.5 1.5-5 5-3-3 1.5-1.5 1.5 1.5z" />
      </svg>
    ),
  },
  {
    title: "Mobile App",
    description: "Learn anywhere with offline access and progress sync.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
        <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm4 17h2v-1h-2v1z" />
      </svg>
    ),
  },
  {
    title: "Pakistani Payment Methods",
    description: "Easypaisa, JazzCash, and bank transfers supported.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
        <path d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7zm3-1a1 1 0 0 0-1 1v2h16V7a1 1 0 0 0-1-1H6z" />
      </svg>
    ),
  },
];

const values = [
  {
    title: "Excellence",
    description: "We uphold high academic standards and continuous improvement.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
        <path d="M12 2 9 9H2l5.7 4.1L5.5 21 12 16.9 18.5 21l-2.2-7.9L22 9h-7z" />
      </svg>
    ),
  },
  {
    title: "Accessibility",
    description: "Quality learning designed for students across Pakistan.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
        <path d="M12 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm-7 8h6v12H9v-4H7v4H5V10zm8 0h6v12h-2v-4h-2v4h-2V10z" />
      </svg>
    ),
  },
  {
    title: "Innovation",
    description: "Modern tools that make learning more engaging and effective.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
        <path d="M9 21h6v-1H9v1zm3-20C7.9 1 5 3.9 5 7c0 2.4 1.4 4.5 3.5 5.5L9 16h6l.5-3.5C17.6 11.5 19 9.4 19 7c0-3.1-2.9-6-7-6z" />
      </svg>
    ),
  },
];

const founders = [
  { name: "Mr. Sikander Ali Qureshi", role: "Founder & Director" },
  { name: "Mr. Shah Mohammad Pathan", role: "Academic Lead" },
  { name: "Mr. Mansoor Ahmed Mangi", role: "Operations Lead" },
];

function About() {
  return (
    <main className="pt-24">
      <motion.section
        className="section relative overflow-hidden"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 top-10 h-48 w-48 rounded-full bg-primary/20 blur-[80px]" />
          <div className="absolute right-0 top-24 h-56 w-56 rounded-full bg-accent/20 blur-[90px]" />
        </div>
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">
            SUM Academy
          </p>
          <h1 className="mt-4 font-heading text-4xl text-slate-900 dark:text-white sm:text-5xl">
            About SUM Academy
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-200 sm:text-lg">
            Our mission is to deliver a modern, student-first learning experience
            for Pakistani academies with powerful tools and trusted educators.
          </p>
        </div>
      </motion.section>

      <motion.section
        className="section pt-0"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="glass-card flex flex-col gap-4">
            <h2 className="font-heading text-3xl text-slate-900 dark:text-white">
              Our Story
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-200">
              SUM Academy was founded to make high-quality education accessible
              across Pakistan. We combine structured curricula with technology to
              keep students engaged and confident.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-200">
              Our vision is to empower academies with data-driven insights,
              personalized learning, and a community of committed educators.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-200">
              Our mission is to deliver measurable academic outcomes while
              building lifelong learning habits.
            </p>
          </div>
          <div className="glass-card">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Key Facts
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {factItems.map((fact) => (
                <div
                  key={fact.label}
                  className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-center shadow-lg shadow-slate-200/40 dark:border-white/10 dark:bg-white/5 dark:shadow-black/40"
                >
                  <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                    {fact.value}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
                    {fact.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="section pt-0"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Why Choose Us
            </p>
            <h2 className="mt-3 font-heading text-3xl text-slate-900 dark:text-white">
              Built for modern Pakistani academies
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="glass-card card-hover">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {feature.icon}
                </div>
                <h3 className="mt-4 font-heading text-xl text-slate-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="section pt-0"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Our Values
            </p>
            <h2 className="mt-3 font-heading text-3xl text-slate-900 dark:text-white">
              Principles that shape every lesson
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {values.map((value) => (
              <div key={value.title} className="glass-card card-hover">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {value.icon}
                </div>
                <h3 className="mt-4 font-heading text-xl text-slate-900 dark:text-white">
                  {value.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="section pt-0"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Certification
            </p>
            <h2 className="mt-3 font-heading text-3xl text-slate-900 dark:text-white">
              Recognized achievement certificates
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="glass-card card-hover">
              <div className="rounded-2xl border border-dashed border-slate-200/80 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  SUM Academy Certificate
                </p>
                <h3 className="mt-4 font-heading text-2xl text-slate-900 dark:text-white">
                  Certificate of Excellence
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                  Awarded to students who complete the program with distinction.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Unique ID
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                      SUM-2026-00123
                    </p>
                  </div>
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs text-slate-400 dark:border-white/10 dark:bg-white/5">
                    QR
                  </div>
                </div>
              </div>
            </div>
            <div className="glass-card card-hover">
              <h3 className="font-heading text-2xl text-slate-900 dark:text-white">
                Verified and shareable
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                Students receive verifiable certificates with QR codes and unique
                IDs that can be shared with institutions and employers.
              </p>
              <div className="mt-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Secure verification
              </div>
              <div className="mt-3 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Instant issuance
              </div>
              <div className="mt-3 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Shareable PDF
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="section pt-0"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Leadership
            </p>
            <h2 className="mt-3 font-heading text-3xl text-slate-900 dark:text-white">
              Meet the founders
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {founders.map((leader) => {
              const initials = leader.name
                .split(" ")
                .slice(0, 2)
                .map((word) => word[0])
                .join("");
              return (
                <div key={leader.name} className="glass-card card-hover">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-sm font-semibold text-white shadow-lg shadow-primary/30">
                    {initials}
                  </div>
                  <h3 className="mt-4 font-heading text-xl text-slate-900 dark:text-white">
                    {leader.name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                    {leader.role}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="section pt-0"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2rem] bg-gradient-to-r from-primary/90 via-indigo-500 to-accent/90 p-[2px] shadow-2xl shadow-primary/30 dark:shadow-black/50">
            <div className="relative overflow-hidden rounded-[1.9rem] bg-white/90 px-6 py-10 backdrop-blur dark:bg-dark/80 sm:px-10 sm:py-12">
              <div className="pointer-events-none absolute -left-16 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-[80px]" />
              <div className="pointer-events-none absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-accent/20 blur-[90px]" />
              <div className="relative z-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">
                    Join Us
                  </p>
                  <h2 className="mt-3 font-heading text-3xl text-slate-900 dark:text-white sm:text-4xl">
                    Join SUM Academy Today
                  </h2>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-200 sm:text-base">
                    Empower your academy with modern tools and student-first
                    learning experiences.
                  </p>
                </div>
                <Link
                  to="/enroll"
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:-translate-y-0.5"
                >
                  Enroll for Free
                </Link>
              </div>
            </div>
          </div>
        </div>
      </motion.section>
    </main>
  );
}

export default About;
