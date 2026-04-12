import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  FaDownload,
  FaFacebookF,
  FaInstagram,
  FaWhatsapp,
  FaYoutube,
} from "react-icons/fa";
import logo from "../assets/logo.jpeg";
import { useSettings } from "../hooks/useSettings.js";
import { normalizePakistanPhone, toPakistanWhatsAppNumber } from "../utils/phone.js";

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
    icon: <FaFacebookF className="h-4 w-4" />,
  },
  {
    label: "Instagram",
    url: socialLinks.instagram || "#",
    icon: <FaInstagram className="h-4 w-4" />,
  },
  {
    label: "WhatsApp",
    url: (() => {
      const raw = socialLinks.whatsapp || "";
      const phone = toPakistanWhatsAppNumber(raw);
      if (phone) return `https://wa.me/${phone}`;
      return raw || "#";
    })(),
    icon: <FaWhatsapp className="h-4 w-4" />,
  },
  {
    label: "YouTube",
    url: socialLinks.youtube || "#",
    icon: <FaYoutube className="h-4 w-4" />,
  },
];

function Footer() {
  const { settings } = useSettings();
  const siteName = settings.general?.siteName || "SUM Academy";
  const logoSrc = settings.general?.logoUrl || logo;
  const footer = settings.footer || {};
  const links = footer.links || {};
  const socialLinks = settings.general?.socialLinks || {};
  const apkUrl = String(settings?.general?.apkUrl || "").trim();
  const apkFileName = String(settings?.general?.apkFileName || "SUM-Academy.apk");
  const apiBase = String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
  const fallbackApkUrl = apiBase ? `${apiBase}/download/app` : "/download/app";
  const resolvedApkUrl = apkUrl || fallbackApkUrl;
  const contactPhone =
    normalizePakistanPhone(settings.general?.contactPhone || "") ||
    settings.general?.contactPhone ||
    "+92 300 0000000";

  const handleAppDownloadClick = () => {
    if (!resolvedApkUrl) {
      toast.success("Something is coming soon");
      return;
    }

    const link = document.createElement("a");
    link.href = resolvedApkUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("download", apkFileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("Downloading app...");
  };

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
              Call: {contactPhone}
            </p>
            <button
              type="button"
              onClick={handleAppDownloadClick}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:-translate-y-0.5 hover:border-primary hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              <FaDownload className="h-4 w-4" />
              Download App
            </button>
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
