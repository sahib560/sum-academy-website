import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const courses = [
  "All Courses",
  "Class XI - Pre-Medical",
  "Class XII - Pre-Medical",
  "Pre-Entrance Test",
];

const certificatesData = [
  {
    id: "CERT-2026-001",
    student: "Hassan Ali",
    course: "Class XI - Pre-Medical",
    issuedAt: "2026-03-01",
    verifiedCount: 12,
  },
  {
    id: "CERT-2026-002",
    student: "Ayesha Noor",
    course: "Pre-Entrance Test",
    issuedAt: "2026-03-04",
    verifiedCount: 8,
  },
  {
    id: "CERT-2026-003",
    student: "Bilal Khan",
    course: "Class XII - Pre-Medical",
    issuedAt: "2026-03-08",
    verifiedCount: 5,
  },
  {
    id: "CERT-2026-004",
    student: "Sana Akbar",
    course: "Class XI - Pre-Medical",
    issuedAt: "2026-03-10",
    verifiedCount: 3,
  },
];

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

function Certificates() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("All Courses");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [previewCert, setPreviewCert] = useState(null);
  const [toast, setToast] = useState(null);
  const [template, setTemplate] = useState({
    institution: "SUM Academy",
    signature: "Admin Director",
    primaryColor: "#4a63f5",
  });

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return certificatesData.filter((cert) => {
      const matchesSearch =
        !query ||
        cert.student.toLowerCase().includes(query) ||
        cert.id.toLowerCase().includes(query);
      const matchesCourse =
        courseFilter === "All Courses" || cert.course === courseFilter;
      const issueDate = new Date(cert.issuedAt);
      const afterStart = startDate ? issueDate >= new Date(startDate) : true;
      const beforeEnd = endDate ? issueDate <= new Date(endDate) : true;
      return matchesSearch && matchesCourse && afterStart && beforeEnd;
    });
  }, [courseFilter, endDate, search, startDate]);

  const stats = {
    total: certificatesData.length,
    month: certificatesData.filter((cert) => cert.issuedAt.startsWith("2026-03"))
      .length,
    verified: certificatesData.reduce(
      (sum, cert) => sum + cert.verifiedCount,
      0
    ),
  };

  const handleDownload = () => {
    setToast({ type: "success", message: "Certificate PDF download started." });
  };

  const handleRevoke = (cert) => {
    const confirmed = window.confirm(
      `Revoke certificate ${cert.id} for ${cert.student}?`
    );
    if (!confirmed) return;
    setToast({ type: "success", message: "Certificate revoked." });
  };

  const handleShare = async (cert) => {
    const url = `https://verify.sumacademy.com/cert/${cert.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast({ type: "success", message: "Verification link copied." });
    } catch (error) {
      setToast({ type: "error", message: "Copy failed. Try again." });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Certificates</h2>
          <p className="text-sm text-slate-500">
            Issue and verify SUM Academy completion certificates.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={`stat-${index}`} className="glass-card space-y-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-6 w-1/2" />
              </div>
            ))
          : [
              { label: "Total Issued", value: stats.total },
              { label: "Issued This Month", value: stats.month },
              { label: "Verified via QR", value: stats.verified },
            ].map((item) => (
              <div key={item.label} className="glass-card">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by student or certificate ID..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <select
          value={courseFilter}
          onChange={(event) => setCourseFilter(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          {courses.map((course) => (
            <option key={course} value={course}>
              {course === "All Courses" ? "Course: All" : course}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm"
          />
          <span className="text-sm text-slate-400">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 p-4 lg:hidden">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={`cert-card-${index}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="skeleton h-4 w-1/2" />
                <div className="mt-3 space-y-2">
                  <div className="skeleton h-3 w-3/4" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No certificates found.
            </div>
          ) : (
            filtered.map((cert) => (
              <div
                key={cert.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Certificate ID
                    </p>
                    <p className="mt-1 inline-flex rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-semibold text-slate-700">
                      {cert.id}
                    </p>
                    <p className="mt-2 font-semibold text-slate-900">{cert.student}</p>
                    <p className="text-xs text-slate-500">{cert.course}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {cert.verifiedCount} verified
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500">
                  <div>
                    <p className="uppercase tracking-[0.2em] text-slate-400">
                      Issued
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatDate(cert.issuedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.2em] text-slate-400">
                      Verification
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {cert.verifiedCount}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => setPreviewCert(cert)}
                  >
                    Preview
                  </button>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={handleDownload}
                  >
                    Download PDF
                  </button>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-rose-500"
                    onClick={() => handleRevoke(cert)}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4">Certificate ID</th>
                <th className="px-6 py-4">Student Name</th>
                <th className="px-6 py-4">Course Name</th>
                <th className="px-6 py-4">Issue Date</th>
                <th className="px-6 py-4">Verification Count</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`row-${index}`} className="border-b border-slate-100">
                    {Array.from({ length: 6 }).map((__, col) => (
                      <td key={col} className="px-6 py-4">
                        <div className="skeleton h-6 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No certificates found.
                  </td>
                </tr>
              ) : (
                filtered.map((cert) => (
                  <tr key={cert.id} className="border-b border-slate-100">
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-semibold text-slate-700">
                        {cert.id}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {cert.student}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{cert.course}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {formatDate(cert.issuedAt)}
                    </td>
                    <td className="px-6 py-4">{cert.verifiedCount}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                          onClick={() => setPreviewCert(cert)}
                        >
                          Preview
                        </button>
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                          onClick={handleDownload}
                        >
                          Download PDF
                        </button>
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-rose-500"
                          onClick={() => handleRevoke(cert)}
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-heading text-2xl text-slate-900">
          Certificate Template Settings
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <button className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
              Upload Logo
            </button>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400">
                Institution Name
              </label>
              <input
                type="text"
                value={template.institution}
                onChange={(event) =>
                  setTemplate((prev) => ({
                    ...prev,
                    institution: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400">
                Signature Name
              </label>
              <input
                type="text"
                value={template.signature}
                onChange={(event) =>
                  setTemplate((prev) => ({
                    ...prev,
                    signature: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400">
                Primary Color
              </label>
              <input
                type="color"
                value={template.primaryColor}
                onChange={(event) =>
                  setTemplate((prev) => ({
                    ...prev,
                    primaryColor: event.target.value,
                  }))
                }
                className="mt-2 h-12 w-full rounded-xl border border-slate-200"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="btn-outline">Preview Template</button>
              <button className="btn-primary">Save Template</button>
            </div>
          </div>
        </div>
      </div>

      {previewCert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setPreviewCert(null)}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-heading text-2xl text-slate-900">
                Certificate Preview
              </h3>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500"
                onClick={() => setPreviewCert(null)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white p-6">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-white">
                  S
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.4em] text-slate-400">
                  SUM Academy
                </p>
                <h4 className="mt-3 font-heading text-2xl text-slate-900">
                  Certificate of Completion
                </h4>
              </div>
              <div className="mt-6 space-y-2 text-center text-sm text-slate-600">
                <p>This is to certify that</p>
                <p className="text-3xl font-semibold text-slate-900">
                  {previewCert.student}
                </p>
                <p>has successfully completed</p>
                <p className="text-lg font-semibold text-slate-800">
                  {previewCert.course}
                </p>
                <p>Date Issued: {formatDate(previewCert.issuedAt)}</p>
                <p>Certificate ID: {previewCert.id}</p>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs text-slate-400">
                  QR: verify.sumacademy.com/cert/{previewCert.id}
                </div>
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="h-12 w-28 rounded-full border border-slate-300" />
                  <p className="text-xs text-slate-500">Admin Signature</p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-center">
                <div className="h-16 w-16 rounded-full border-2 border-dashed border-slate-300 text-xs text-slate-400 flex items-center justify-center">
                  Seal
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button className="btn-primary" onClick={handleDownload}>
                Download PDF
              </button>
              <button
                className="btn-outline"
                onClick={() => handleShare(previewCert)}
              >
                Share Link
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${
            toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default Certificates;
