import { Link } from "react-router-dom";
import logo from "../assets/logo.jpeg";
import { useSettings } from "../hooks/useSettings.js";

const renderFooterLink = (item) => {
  const url = item?.url || "/";
  const label = item?.label || "Link";
  if (url.startsWith("/")) {
    return (
      <Link
        key={`${label}-${url}`}
        to={url}
        className="text-slate-600 transition hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
      >
        {label}
      </Link>
    );
  }
  return (
    <a
      key={`${label}-${url}`}
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-slate-600 transition hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
    >
      {label}
    </a>
  );
};

const socialItems = (socialLinks) => [
  {
    label: "Facebook",
    url: socialLinks.facebook || "#",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M13 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h2v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    url: socialLinks.instagram || "#",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm9.5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
      </svg>
    ),
  },
  {
    label: "WhatsApp",
    url: socialLinks.whatsapp || "#",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M12 4a8 8 0 0 0-6.9 12.1L4 20l4-1.1A8 8 0 1 0 12 4zm4.5 11.6c-.2.6-1.1 1-1.5 1-.4.1-.9.2-2.1-.2-1.4-.5-2.7-1.5-3.7-3-1-1.4-1.3-2.5-1.4-2.9 0-.4.1-1 .4-1.4.3-.4.6-.5.9-.5.2 0 .4 0 .6.1.2.1.4.6.5.9.1.3.4 1 .5 1.1.1.1.1.3 0 .4-.1.1-.2.3-.3.4-.1.1-.2.2-.1.4.1.2.5.9 1.1 1.5.8.8 1.6 1.1 1.8 1.2.2.1.3.1.4 0 .1-.1.5-.6.6-.8.1-.2.3-.2.5-.1.2.1 1.4.7 1.6.8.2.1.4.2.4.3.1.1.1.6-.1 1.2z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    url: socialLinks.youtube || "#",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M21 7.5a2.5 2.5 0 0 0-1.8-1.8C17.6 5.2 12 5.2 12 5.2s-5.6 0-7.2.5A2.5 2.5 0 0 0 3 7.5a26 26 0 0 0 0 9 2.5 2.5 0 0 0 1.8 1.8c1.6.5 7.2.5 7.2.5s5.6 0 7.2-.5a2.5 2.5 0 0 0 1.8-1.8 26 26 0 0 0 0-9zM10 15V9l5 3-5 3z" />
      </svg>
    ),
  },
];

function Footer() {
  const { settings } = useSettings();
  const siteName = settings.general?.siteName || "SUM Academy";
  const logoSrc = settings.general?.logoUrl || logo;
  const footer = settings.footer || {};
  const links = footer.links || {};
  const socialLinks = settings.general?.socialLinks || {};

  return (
    <footer className="bg-white text-slate-700 dark:bg-dark dark:text-slate-200">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg shadow-primary/40">
                <img
                  src={logoSrc}
                  alt={`${siteName} logo`}
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="font-heading text-lg text-slate-900 dark:text-white">
                {siteName}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {footer.description ||
                "Pakistan's most modern learning platform"}
            </p>
            <div className="flex items-center gap-3">
              {socialItems(socialLinks).map((item) => (
                <a
                  key={item.label}
                  href={item.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:border-white/30 dark:hover:text-white"
                  aria-label={item.label}
                >
                  {item.icon}
                </a>
              ))}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Call: {settings.general?.contactPhone || "+92 300 0000000"}
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-white/60">
              Learn
            </p>
            <div className="flex flex-col gap-2 text-sm">
              {(links.learn || []).map(renderFooterLink)}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-white/60">
              Company
            </p>
            <div className="flex flex-col gap-2 text-sm">
              {(links.company || []).map(renderFooterLink)}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-white/60">
              Support
            </p>
            <div className="flex flex-col gap-2 text-sm">
              {(links.support || []).map(renderFooterLink)}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-black/20">
        <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-500 dark:text-white/60 sm:px-6 lg:px-8">
          {footer.copyright || `2026 ${siteName}. All rights reserved.`}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
