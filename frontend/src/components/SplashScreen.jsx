import { motion } from "framer-motion";
import logo from "../assets/logo.jpeg";
import { useSiteSettings } from "../context/SiteSettingsContext.jsx";

function SplashScreen({
  message = "Loading your academy...",
  subMessage = "Please wait a moment",
}) {
  const { settings } = useSiteSettings();
  const logoSrc = settings.general.logoPreview || logo;
  const siteName = settings.general.siteName || "SUM Academy";

  return (
    <div className="fixed inset-0 z-[180] overflow-hidden bg-[radial-gradient(circle_at_20%_18%,rgba(var(--brand-primary-rgb),0.22),transparent_34%),radial-gradient(circle_at_84%_82%,rgba(var(--brand-accent-rgb),0.18),transparent_38%),linear-gradient(145deg,#eaf0ff_0%,#f6f8ff_48%,#fff6f1_100%)]">
      <motion.div
        animate={{ scale: [1, 1.18, 1], opacity: [0.2, 0.35, 0.2] }}
        transition={{ repeat: Infinity, duration: 4.2, ease: "easeInOut" }}
        className="absolute -left-16 top-12 h-56 w-56 rounded-full bg-primary/25 blur-3xl"
      />
      <motion.div
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.2, 0.35, 0.2] }}
        transition={{ repeat: Infinity, duration: 4.6, ease: "easeInOut" }}
        className="absolute -right-14 bottom-14 h-60 w-60 rounded-full bg-accent/20 blur-3xl"
      />

      <div className="relative flex h-full items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white px-10 py-12 text-center shadow-[0_20px_60px_rgba(15,23,42,0.18)]"
        >
          <div className="relative mx-auto mb-6 h-28 w-28">
            <motion.div
              className="absolute inset-0 rounded-[1.75rem] border border-slate-300"
              animate={{ rotate: [0, 360] }}
              transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-2 rounded-[1.2rem] border border-primary/45"
              animate={{ rotate: [360, 0] }}
              transition={{ repeat: Infinity, duration: 3.5, ease: "linear" }}
            />
            <div className="absolute inset-4 overflow-hidden rounded-2xl bg-white shadow-[0_10px_25px_rgba(74,99,245,0.35)]">
              <img
                src={logoSrc}
                alt={`${siteName} logo`}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-700">
            SUM Academy
          </p>
          <h2 className="mt-2 font-heading text-4xl text-slate-900">{siteName}</h2>
          <p className="mt-4 text-base font-semibold text-slate-900">{message}</p>
          <p className="mt-2 text-sm text-slate-700">{subMessage}</p>

          <div className="mx-auto mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-slate-200">
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{
                repeat: Infinity,
                duration: 1.2,
                ease: "linear",
              }}
              className="h-full w-1/2 rounded-full bg-gradient-to-r from-accent to-primary"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default SplashScreen;
