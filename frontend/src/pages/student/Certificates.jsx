import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Skeleton } from "../../components/Skeleton.jsx";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const certificates = [
  {
    id: "SUM-2026-001",
    course: "Chemistry Quick Revision",
    student: "Sana Ahmed",
    issued: "Mar 02, 2026",
  },
  {
    id: "SUM-2026-002",
    course: "Biology Masterclass XI",
    student: "Sana Ahmed",
    issued: "Mar 10, 2026",
  },
  {
    id: "SUM-2026-003",
    course: "English Essay Clinic",
    student: "Sana Ahmed",
    issued: "Mar 13, 2026",
  },
];

function StudentCertificates() {
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(() => {
    return {
      total: certificates.length,
      inProgress: 4,
    };
  }, []);

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ message: "Link copied!" });
    } catch (error) {
      setToast({ message: "Link copied!" });
    }
  };

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">My Certificates</h1>
      </motion.section>

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2">
        {loading
          ? Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`stat-${index}`}
                className="glass-card border border-slate-200"
              >
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-4 h-8 w-1/2" />
              </div>
            ))
          : [
              { label: "Total Certificates Earned", value: stats.total },
              { label: "Courses In Progress", value: stats.inProgress },
            ].map((card) => (
              <div
                key={card.label}
                className="glass-card border border-slate-200"
              >
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {card.value}
                </p>
              </div>
            ))}
      </motion.section>

      {loading ? (
        <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`cert-skel-${index}`}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="mt-4 h-4 w-1/2" />
              <Skeleton className="mt-2 h-4 w-1/3" />
              <Skeleton className="mt-3 h-8 w-full rounded-full" />
            </div>
          ))}
        </motion.section>
      ) : certificates.length === 0 ? (
        <motion.section
          {...fadeUp}
          className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
              <path d="M12 2a6 6 0 0 1 6 6c0 2.2-1.2 4.2-3 5.2V22l-3-1.6L9 22v-8.8A6 6 0 0 1 12 2z" />
            </svg>
          </div>
          <p className="font-semibold text-slate-700">No certificates yet</p>
          <p className="mt-1">
            Complete a course to earn your first certificate!
          </p>
          <Link className="btn-primary mt-4 inline-flex" to="/student/explore">
            Explore Courses
          </Link>
        </motion.section>
      ) : (
        <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {certificates.map((cert) => (
            <button
              key={cert.id}
              className="text-left rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              onClick={() => setSelected(cert)}
            >
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="h-1 w-full rounded-full bg-primary" />
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                    S
                  </span>
                  Certificate of Completion
                </div>
                <p className="mt-3 font-heading text-sm text-slate-900">
                  {cert.course}
                </p>
                <p className="text-xs text-slate-500">{cert.student}</p>
                <p className="mt-2 text-[10px] text-slate-400">{cert.issued}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-400">
                  {cert.id}
                </p>
                <div className="mt-3 h-10 w-10 rounded bg-slate-100" />
              </div>
              <div className="mt-4 space-y-1 text-sm">
                <p className="font-semibold text-slate-900">{cert.course}</p>
                <p className="text-xs text-slate-500">{cert.issued}</p>
                <button
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-mono text-slate-500"
                  onClick={(event) => {
                    event.stopPropagation();
                    copyText(cert.id);
                  }}
                >
                  {cert.id}
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary"
                  onClick={(event) => event.stopPropagation()}
                >
                  Download PDF
                </button>
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                  onClick={(event) => event.stopPropagation()}
                >
                  Share
                </button>
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                  onClick={(event) => {
                    event.stopPropagation();
                    window.open(
                      `https://sumacademy.pk/verify/${cert.id}`,
                      "_blank"
                    );
                  }}
                >
                  Verify
                </button>
              </div>
            </button>
          ))}
        </motion.section>
      )}

      {selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setSelected(null)}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="rounded-3xl border border-slate-200 bg-white p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
                    S
                  </div>
                  <span className="font-heading text-lg text-slate-900">
                    SUM Academy
                  </span>
                </div>
                <span className="text-xs uppercase tracking-[0.4em] text-slate-400">
                  Official
                </span>
              </div>
              <div className="mt-6 border-2 border-dashed border-slate-200 p-6 text-center">
                <p className="font-heading text-2xl text-slate-900">
                  Certificate of Completion
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  This is to certify that
                </p>
                <p className="mt-4 font-heading text-3xl text-primary">
                  {selected.student}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  has successfully completed
                </p>
                <p className="mt-3 text-xl font-semibold text-slate-900">
                  {selected.course}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Completion date: {selected.issued}
                </p>
                <div className="my-6 h-px bg-slate-200" />
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
                  <span className="font-mono">{selected.id}</span>
                  <div className="h-12 w-12 rounded bg-slate-100" />
                </div>
                <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
                  <span className="border-t border-slate-300 pt-2">
                    Admin Signature
                  </span>
                  <span className="rounded-full border border-slate-300 px-4 py-2">
                    SUM Academy Stamp
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button className="btn-primary">Download PDF</button>
              <button
                className="btn-outline"
                onClick={() => copyText(`https://sumacademy.pk/verify/${selected.id}`)}
              >
                Copy Share Link
              </button>
              <button className="btn-outline" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {toast && (
        <div className="fixed right-6 top-6 z-[70] rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default StudentCertificates;
