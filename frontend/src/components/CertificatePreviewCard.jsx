const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const parsed = toDate(value);
  if (!parsed) return "N/A";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const resolveScope = (certificate = {}) =>
  String(certificate.completionScope || (certificate.className ? "class" : "course"))
    .trim()
    .toLowerCase();

const resolveCompletionTitle = (certificate = {}) =>
  certificate.completionTitle ||
  (certificate.className
    ? `${certificate.className}${certificate.courseName ? ` - ${certificate.courseName}` : ""}`
    : certificate.courseName || "Course");

export default function CertificatePreviewCard({
  certificate = {},
  logoUrl = "",
  compact = false,
}) {
  const certId = certificate.certId || certificate.id || "CERT-ID";
  const scope = resolveScope(certificate);
  const completionTitle = resolveCompletionTitle(certificate);

  return (
    <div
      className={`rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 ${
        compact ? "p-4" : "p-7"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="SUM Academy"
              className={`${compact ? "h-10 w-10" : "h-12 w-12"} rounded-full border border-cyan-200 bg-white object-contain p-1`}
            />
          ) : (
            <div
              className={`${compact ? "h-10 w-10 text-base" : "h-12 w-12 text-lg"} flex items-center justify-center rounded-full border border-cyan-200 bg-white font-bold text-cyan-700`}
            >
              S
            </div>
          )}
          <div>
            <p className={`${compact ? "text-sm" : "text-base"} font-heading text-slate-900`}>
              SUM Academy
            </p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-700">
              Medical Learning Excellence
            </p>
          </div>
        </div>
        {certificate.isRevoked ? (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-700">
            Revoked
          </span>
        ) : null}
      </div>

      <div className={`${compact ? "mt-4" : "mt-7"} text-center`}>
        <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
          Certificate Of Completion
        </p>
        <p className={`${compact ? "mt-2 text-xs" : "mt-3 text-sm"} italic text-slate-600`}>
          This certifies that
        </p>
        <p
          className={`${compact ? "mt-1 text-xl" : "mt-2 text-3xl"} font-heading text-slate-900`}
          style={{ fontFamily: "\"Playfair Display\", serif" }}
        >
          {certificate.studentName || "Student"}
        </p>
        <p className={`${compact ? "mt-2 text-xs" : "mt-3 text-sm"} text-slate-600`}>
          has successfully completed the {scope === "class" ? "class program" : "course program"}
        </p>
        <p className={`${compact ? "mt-1 text-sm" : "mt-2 text-xl"} font-semibold text-cyan-800`}>
          {completionTitle}
        </p>
      </div>

      <div className={`${compact ? "mt-4" : "mt-7"} grid gap-2 border-t border-cyan-100 pt-3 md:grid-cols-3`}>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Issue Date</p>
          <p className="mt-1 text-xs text-slate-700">{formatDate(certificate.issuedAt || certificate.createdAt)}</p>
        </div>
        <div className="md:text-center">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Certificate Id</p>
          <p className="mt-1 font-mono text-xs text-slate-700">{certId}</p>
        </div>
        <div className="md:text-right">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Authorized By</p>
          <p className="mt-1 text-xs font-semibold text-slate-700">SUM Academy</p>
        </div>
      </div>
    </div>
  );
}
