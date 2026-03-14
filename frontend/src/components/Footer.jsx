import { Link } from "react-router-dom";
import logo from "../assets/logo.jpeg";

const learnLinks = [
  { label: "Courses", to: "/courses" },
  { label: "Programs", to: "/programs" },
  { label: "Pricing", to: "/pricing" },
  { label: "Scholarships", to: "/scholarships" },
];

const companyLinks = [
  { label: "About Us", to: "/about" },
  { label: "Our Story", to: "/story" },
  { label: "Careers", to: "/careers" },
  { label: "Partners", to: "/partners" },
];

const supportLinks = [
  { label: "Help Center", to: "/support" },
  { label: "Admissions", to: "/admissions" },
  { label: "Contact", to: "/contact" },
  { label: "FAQs", to: "/faqs" },
];

function Footer() {
  return (
    <footer className="bg-white text-slate-700 dark:bg-dark dark:text-slate-200">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg shadow-primary/40">
                <img
                  src={logo}
                  alt="SUM Academy logo"
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="font-heading text-lg text-slate-900 dark:text-white">
                SUM Academy
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              A modern learning platform helping Pakistani academies scale with
              engaging courses, smart analytics, and delightful learner
              experiences.
            </p>
            <div className="flex items-center gap-3">
              {[
                {
                  label: "Facebook",
                  to: "/facebook",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <path d="M13 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h2v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z" />
                    </svg>
                  ),
                },
                {
                  label: "Email",
                  to: "/contact",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 2 8 5 8-5H4zm0 8h16V10l-8 5-8-5v6z" />
                    </svg>
                  ),
                },
                {
                  label: "WhatsApp",
                  to: "/whatsapp",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <path d="M12 4a8 8 0 0 0-6.9 12.1L4 20l4-1.1A8 8 0 1 0 12 4zm4.5 11.6c-.2.6-1.1 1-1.5 1-.4.1-.9.2-2.1-.2-1.4-.5-2.7-1.5-3.7-3-1-1.4-1.3-2.5-1.4-2.9 0-.4.1-1 .4-1.4.3-.4.6-.5.9-.5.2 0 .4 0 .6.1.2.1.4.6.5.9.1.3.4 1 .5 1.1.1.1.1.3 0 .4-.1.1-.2.3-.3.4-.1.1-.2.2-.1.4.1.2.5.9 1.1 1.5.8.8 1.6 1.1 1.8 1.2.2.1.3.1.4 0 .1-.1.5-.6.6-.8.1-.2.3-.2.5-.1.2.1 1.4.7 1.6.8.2.1.4.2.4.3.1.1.1.6-.1 1.2z" />
                    </svg>
                  ),
                },
                {
                  label: "TikTok",
                  to: "/tiktok",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <path d="M16.5 6.2a4.6 4.6 0 0 0 3.5 1.4V10c-1.6 0-3.1-.5-4.3-1.4v6.1a5.2 5.2 0 1 1-4.5-5.2v2.7a2.6 2.6 0 1 0 1.9 2.5V4h3.4v2.2z" />
                    </svg>
                  ),
                },
              ].map((social) => (
                <Link
                  key={social.label}
                  to={social.to}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:border-white/30 dark:hover:text-white"
                  aria-label={social.label}
                >
                  {social.icon}
                </Link>
              ))}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Call: +92 300 123 4567
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-white/60">
              Learn
            </p>
            <div className="flex flex-col gap-2 text-sm">
              {learnLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-slate-600 transition hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-white/60">
              Company
            </p>
            <div className="flex flex-col gap-2 text-sm">
              {companyLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-slate-600 transition hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-white/60">
              Support
            </p>
            <div className="flex flex-col gap-2 text-sm">
              {supportLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-slate-600 transition hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-black/20">
        <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-500 dark:text-white/60 sm:px-6 lg:px-8">
          © 2026 SUM Academy. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default Footer;
