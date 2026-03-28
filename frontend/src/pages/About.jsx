import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { useSettings } from "../hooks/useSettings.js";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const NOT_ADDED = "Not added yet";
const textOrNotAdded = (value) => {
  const cleaned = String(value || "").trim();
  return cleaned || NOT_ADDED;
};

function About() {
  const { settings } = useSettings();
  const about = settings.about || {};
  const featuresSection = settings.features || {};
  const hero = settings.hero || {};
  const siteName = textOrNotAdded(settings.general?.siteName);
  const aboutValues = Array.isArray(about.values) ? about.values : [];
  const leadership = Array.isArray(about.team) ? about.team : [];
  const factItems = Array.isArray(about.facts) ? about.facts : hero.stats || [];
  const whyChooseItems = Array.isArray(featuresSection.items)
    ? featuresSection.items
    : [];
  return (
    <main className="pt-24">
      <Motion.section
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
            {siteName}
          </p>
          <h1 className="mt-4 font-heading text-4xl text-slate-900 dark:text-white sm:text-5xl">
            {textOrNotAdded(about.heading)}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-200 sm:text-lg">
            {textOrNotAdded(about.mission)}
          </p>
        </div>
      </Motion.section>

      <Motion.section
        className="section pt-0"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="glass-card flex flex-col gap-4">
            <h2 className="font-heading text-3xl text-slate-900 dark:text-white">
              {textOrNotAdded(about.storyHeading)}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-200">
              {textOrNotAdded(about.story)}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-200">
              {textOrNotAdded(about.vision)}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-200">
              {textOrNotAdded(about.mission)}
            </p>
          </div>
          <div className="glass-card">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Key Facts
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {factItems.length ? (
                factItems.map((fact, index) => (
                  <div
                    key={`${fact.label || "fact"}-${index}`}
                    className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-center shadow-lg shadow-slate-200/40 dark:border-white/10 dark:bg-white/5 dark:shadow-black/40"
                  >
                    <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                      {textOrNotAdded(fact.value)}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
                      {textOrNotAdded(fact.label)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200/70 bg-white/80 p-4 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 sm:col-span-2">
                  {NOT_ADDED}
                </div>
              )}
            </div>
          </div>
        </div>
      </Motion.section>

      <Motion.section
        className="section pt-0"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              {textOrNotAdded(featuresSection.heading)}
            </p>
            <h2 className="mt-3 font-heading text-3xl text-slate-900 dark:text-white">
              Built for modern Pakistani academies
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {whyChooseItems.length ? (
              whyChooseItems.map((feature, index) => (
                <div key={`${feature.title || "feature"}-${index}`} className="glass-card card-hover">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14-4-4 1.4-1.4L11 13.2l4.6-4.6L17 10l-6 6z" />
                    </svg>
                  </div>
                  <h3 className="mt-4 font-heading text-xl text-slate-900 dark:text-white">
                    {textOrNotAdded(feature.title)}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                    {textOrNotAdded(feature.description)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200/70 bg-white/80 p-6 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 sm:col-span-2 lg:col-span-4">
                {NOT_ADDED}
              </div>
            )}
          </div>
        </div>
      </Motion.section>

      <Motion.section
        className="section pt-0"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              {textOrNotAdded(about.valuesHeading)}
            </p>
            <h2 className="mt-3 font-heading text-3xl text-slate-900 dark:text-white">
              Principles that shape every lesson
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {aboutValues.length ? (
              aboutValues.map((value, index) => (
                <div key={`${value.title || "value"}-${index}`} className="glass-card card-hover">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                      <path d="M12 2 9 9H2l5.7 4.1L5.5 21 12 16.9 18.5 21l-2.2-7.9L22 9h-7z" />
                    </svg>
                  </div>
                  <h3 className="mt-4 font-heading text-xl text-slate-900 dark:text-white">
                    {textOrNotAdded(value.title)}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                    {textOrNotAdded(value.description)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200/70 bg-white/80 p-6 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 md:col-span-3">
                {NOT_ADDED}
              </div>
            )}
          </div>
        </div>
      </Motion.section>

      <Motion.section
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
              {textOrNotAdded(about.certificateHeading)}
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="glass-card card-hover">
              <div className="rounded-2xl border border-dashed border-slate-200/80 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {textOrNotAdded(about.certificateLabel)}
                </p>
                <h3 className="mt-4 font-heading text-2xl text-slate-900 dark:text-white">
                  {textOrNotAdded(about.certificateTitle)}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                  {textOrNotAdded(about.certificateDescription)}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Unique ID
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                      {textOrNotAdded(about.certificateSampleId)}
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
                {textOrNotAdded(about.certificateSideTitle)}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                {textOrNotAdded(about.certificateSideDescription)}
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
      </Motion.section>

      <Motion.section
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
              {textOrNotAdded(about.teamHeading)}
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {leadership.length ? leadership.map((leader, index) => {
              const initials = leader.name
                .split(" ")
                .slice(0, 2)
                .map((word) => word[0])
                .join("");
              return (
                <div key={`${leader.name || "leader"}-${index}`} className="glass-card card-hover">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-sm font-semibold text-white shadow-lg shadow-primary/30">
                    {initials || "N"}
                  </div>
                  <h3 className="mt-4 font-heading text-xl text-slate-900 dark:text-white">
                    {textOrNotAdded(leader.name)}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                    {textOrNotAdded(leader.role)}
                  </p>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-slate-200/70 bg-white/80 p-6 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 md:col-span-3">
                {NOT_ADDED}
              </div>
            )}
          </div>
        </div>
      </Motion.section>

      <Motion.section
        className="section pt-0"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2rem] bg-gradient-to-r from-primary/90 via-indigo-500 to-accent/90 p-[2px] shadow-2xl shadow-primary/30 dark:shadow-black/50">
            <div className="relative overflow-hidden rounded-[1.9rem] bg-white/90 px-6 py-10 backdrop-blur dark:border dark:border-white/10 dark:bg-white/5 sm:px-10 sm:py-12">
              <div className="pointer-events-none absolute -left-16 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-[80px]" />
              <div className="pointer-events-none absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-accent/20 blur-[90px]" />
              <div className="relative z-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">
                    {textOrNotAdded(about.ctaBadge)}
                  </p>
                  <h2 className="mt-3 font-heading text-3xl text-slate-900 dark:text-white sm:text-4xl">
                    {textOrNotAdded(about.ctaHeading)}
                  </h2>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-200 sm:text-base">
                    {textOrNotAdded(about.ctaDescription)}
                  </p>
                </div>
                <Link
                  to="/enroll"
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:-translate-y-0.5"
                >
                  {textOrNotAdded(about.ctaLabel)}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Motion.section>
    </main>
  );
}

export default About;

