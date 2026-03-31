import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import toast, { Toaster } from "react-hot-toast";
import { useSettings } from "../../hooks/useSettings.js";
import { defaultSettings } from "../../context/SettingsContext.jsx";
import {
  generateCertificate,
  getCertificates,
  getCourses,
  getStudents,
  revokeCertificate,
  unrevokeCertificate,
} from "../../services/admin.service.js";
const EMPTY = [];
const MotionDiv = motion.div;

const toDate = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const dateLabel = (v) => {
  const d = toDate(v);
  if (!d) return "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const initials = (name = "") =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "S";

const certStatus = (cert) => (cert?.isRevoked ? "revoked" : "valid");
const statusClass = (s) =>
  s === "valid" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700";

const PUBLIC_VERIFY_BASE = "https://sum-academy-lms.web.app/verify";
const verifyLinkFor = (cert) =>
  cert?.verificationUrl || `${PUBLIC_VERIFY_BASE}/${cert?.certId || cert?.id}`;

const normalizeStudentEnrollments = (student) =>
  Array.isArray(student?.enrolledCourses)
    ? student.enrolledCourses
        .map((entry) => {
          const courseId =
            typeof entry === "string" ? entry : entry?.courseId || entry?.id || "";
          if (!courseId) return null;
          const progress = Number(
            typeof entry === "string"
              ? 0
              : entry?.progress ?? entry?.progressPercent ?? entry?.completionPercent ?? 0
          );
          const completedAt = typeof entry === "string" ? null : entry?.completedAt || null;
          return {
            courseId: String(courseId),
            progress: Number.isFinite(progress) ? progress : 0,
            completedAt,
          };
        })
        .filter(Boolean)
    : [];

const hexToRgb = (value = "") => {
  const hex = String(value || "").replace("#", "");
  if (hex.length !== 6) return [0, 0, 0];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return [r, g, b];
};

const loadImageAsDataUrl = (url) =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

async function downloadCertPdf(cert, certSettings) {
  const doc = new jsPDF("landscape", "mm", "a4");
  const pageW = 297;
  const pageH = 210;

  const borderColor = hexToRgb(certSettings.borderColor);
  const headingColor = hexToRgb(certSettings.headingColor);
  const nameColor = hexToRgb(certSettings.nameColor);
  const bodyColor = hexToRgb(certSettings.bodyColor);
  const bgColor = hexToRgb(certSettings.backgroundColor);

  doc.setFillColor(...bgColor);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setDrawColor(...borderColor);
  doc.setLineWidth(1);
  doc.rect(10, 10, pageW - 20, pageH - 20);
  doc.setLineWidth(0.5);
  doc.rect(14, 14, pageW - 28, pageH - 28);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...headingColor);
  doc.setFontSize(30);
  doc.text("SUM ACADEMY", pageW / 2, 34, { align: "center" });

  doc.setTextColor(...headingColor);
  doc.setFontSize(20);
  doc.text("Certificate of Completion", pageW / 2, 48, { align: "center" });

  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.setTextColor(...bodyColor);
  doc.text("This is to certify that", pageW / 2, 66, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...nameColor);
  doc.text(cert.studentName || "Student", pageW / 2, 84, { align: "center" });

  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.setTextColor(...bodyColor);
  doc.text("has successfully completed", pageW / 2, 98, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...headingColor);
  doc.text(cert.courseName || "Course", pageW / 2, 113, { align: "center" });

  doc.setFont("times", "italic");
  doc.setFontSize(11);
  doc.setTextColor(...bodyColor);
  doc.text("with distinction", pageW / 2, 124, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...bodyColor);
  doc.text(`Issue Date: ${dateLabel(cert.issuedAt || cert.createdAt)}`, 24, 160);
  doc.text(`Cert ID: ${cert.certId || cert.id}`, pageW / 2, 160, { align: "center" });
  if (certSettings.showSignature) {
    doc.text(
      certSettings.signatureLabel || "Authorized Signature",
      pageW - 65,
      160
    );
    doc.line(pageW - 92, 156, pageW - 25, 156);
    if (certSettings.signatureUrl) {
      const sigData = await loadImageAsDataUrl(certSettings.signatureUrl);
      if (sigData) {
        doc.addImage(sigData, "PNG", pageW - 92, 140, 60, 14);
      }
    }
  }

  if (certSettings.showQr) {
    doc.setDrawColor(148, 163, 184);
    doc.rect(pageW - 50, 120, 22, 22);
    doc.setFontSize(8);
    doc.text("QR", pageW - 39, 132, { align: "center" });
    doc.text("Scan to verify", pageW - 39, 146, { align: "center" });
  }

  doc.setFontSize(7);
  doc.setTextColor(...bodyColor);
  doc.text(verifyLinkFor(cert), pageW / 2, 178, { align: "center" });

  doc.save(`SUM_Certificate_${cert.certId || cert.id}.pdf`);
}

function PreviewModal({ cert, onClose, certSettings }) {
  if (!cert) return null;
  return (
    <AnimatePresence>
      <MotionDiv className="fixed inset-0 z-[90] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-label="Close preview" />
        <MotionDiv initial={{ scale: 0.96, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.96, y: 10, opacity: 0 }} className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between">
            <h3 className="font-heading text-2xl text-slate-900">Certificate Preview</h3>
            <button className="rounded-full border border-slate-200 px-3 py-1 text-sm" onClick={onClose}>X</button>
          </div>

          <div
            className="mt-5 rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-white via-slate-50 to-white p-8"
            style={{ background: certSettings.backgroundColor }}
          >
            <div
              className="rounded-2xl border border-primary/30 p-8"
              style={{ borderColor: certSettings.borderColor }}
            >
              {certSettings.showLogo && certSettings.logoUrl ? (
                <div className="mx-auto flex h-14 w-20 items-center justify-center">
                  <img
                    src={certSettings.logoUrl}
                    alt="Certificate logo"
                    className="max-h-14 object-contain"
                  />
                </div>
              ) : (
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
                  S
                </div>
              )}
              <p
                className="mt-3 text-center text-3xl font-bold"
                style={{ color: certSettings.headingColor }}
              >
                SUM ACADEMY
              </p>
              <p className="text-center text-sm" style={{ color: certSettings.bodyColor }}>
                Certificate of Completion
              </p>
              <div className="mx-auto mt-4 h-px w-72 bg-slate-200" />

              <div className="mt-8 space-y-3 text-center">
                <p className="text-sm italic" style={{ color: certSettings.bodyColor }}>
                  This is to certify that
                </p>
                <p
                  className="font-heading text-5xl font-semibold"
                  style={{ color: certSettings.nameColor }}
                >
                  {cert.studentName || "Student"}
                </p>
                <p className="text-sm italic" style={{ color: certSettings.bodyColor }}>
                  has successfully completed
                </p>
                <p className="text-3xl font-bold" style={{ color: certSettings.headingColor }}>
                  {cert.courseName || "Course"}
                </p>
                <p className="text-sm italic" style={{ color: certSettings.bodyColor }}>
                  with distinction
                </p>
              </div>

              <div className="mt-10 grid gap-6 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Issue Date</p>
                  <p className="mt-1 text-sm" style={{ color: certSettings.bodyColor }}>
                    {dateLabel(cert.issuedAt || cert.createdAt)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cert ID</p>
                  <p className="mt-1 font-mono text-sm" style={{ color: certSettings.nameColor }}>
                    {cert.certId || cert.id}
                  </p>
                </div>
                {certSettings.showSignature ? (
                  <div className="text-right">
                    {certSettings.signatureUrl ? (
                      <img
                        src={certSettings.signatureUrl}
                        alt="Signature"
                        className="ml-auto h-10 object-contain"
                      />
                    ) : (
                      <div className="ml-auto h-px w-36 bg-slate-300" />
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {certSettings.signatureLabel || "Authorized Signature"}
                    </p>
                  </div>
                ) : null}
              </div>

              {certSettings.showQr ? (
                <div className="mt-8 flex items-end justify-between">
                  <div className="h-20 w-20 rounded-lg border border-slate-300 bg-white text-center text-xs leading-[80px] text-slate-500">
                    QR
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Scan to verify</p>
                    <p className="mt-1 text-[11px] text-slate-500">{verifyLinkFor(cert)}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="btn-primary"
              onClick={() => {
                downloadCertPdf(cert, certSettings);
                toast.success("Certificate PDF downloaded");
              }}
            >
              Download PDF
            </button>
            <button className="btn-outline" onClick={async () => { await navigator.clipboard.writeText(verifyLinkFor(cert)); toast.success("Verification link copied!"); }}>
              Copy Verification Link
            </button>
            <button className="rounded-full border border-slate-200 px-5 py-2 text-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </MotionDiv>
      </MotionDiv>
    </AnimatePresence>
  );
}

function GenerateModal({
  open,
  onClose,
  students,
  courses,
  form,
  setForm,
  onSubmit,
  loading,
}) {
  if (!open) return null;
  const selectedStudent = students.find((s) => (s.uid || s.id) === form.studentId);
  const enrolledRows = normalizeStudentEnrollments(selectedStudent);
  const enrolledIds = new Set(enrolledRows.map((row) => row.courseId));
  const eligibleCourses = form.studentId
    ? courses.filter((course) => enrolledIds.has(course.id))
    : [];
  const selectedEnrollment = enrolledRows.find((row) => row.courseId === form.courseId);
  const isIncompleteCourse =
    Boolean(selectedEnrollment) &&
    Number(selectedEnrollment.progress || 0) < 100 &&
    !selectedEnrollment.completedAt;

  return (
    <AnimatePresence>
      <MotionDiv className="fixed inset-0 z-[91] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button className="absolute inset-0 bg-slate-900/45" onClick={onClose} />
        <MotionDiv initial={{ scale: 0.96, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.96, y: 10, opacity: 0 }} className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between">
            <h3 className="font-heading text-2xl">Generate Certificate</h3>
            <button className="rounded-full border border-slate-200 px-3 py-1 text-sm" onClick={onClose}>X</button>
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Student</label>
              <input
                placeholder="Search student by name or email"
                value={form.studentSearch}
                onChange={(e) => setForm((p) => ({ ...p, studentSearch: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={form.studentId}
                onChange={(e) => setForm((p) => ({ ...p, studentId: e.target.value, courseId: "", forceGenerate: false }))}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select student</option>
                {students
                  .filter((s) => {
                    const q = form.studentSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      String(s.fullName || "").toLowerCase().includes(q) ||
                      String(s.email || "").toLowerCase().includes(q)
                    );
                  })
                  .map((s) => (
                    <option key={s.uid || s.id} value={s.uid || s.id}>
                      {s.fullName || "Student"} - {s.email || ""}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Course</label>
              <select
                value={form.courseId}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    courseId: e.target.value,
                    forceGenerate: false,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                disabled={!form.studentId}
              >
                <option value="">
                  {form.studentId ? "Select enrolled course" : "Select student first"}
                </option>
                {eligibleCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              {form.studentId && eligibleCourses.length < 1 ? (
                <p className="mt-2 text-xs text-rose-600">
                  This student is not enrolled in any course yet.
                </p>
              ) : null}
            </div>

            {isIncompleteCourse ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p>
                  This student has not completed this course yet
                  {Number.isFinite(selectedEnrollment?.progress)
                    ? ` (${Math.max(0, Math.round(selectedEnrollment.progress))}% done)`
                    : ""}
                  . Generate anyway?
                </p>
                <label className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.forceGenerate}
                    onChange={(e) => setForm((p) => ({ ...p, forceGenerate: e.target.checked }))}
                  />
                  <span>I understand and want to continue</span>
                </label>
              </div>
            ) : null}
          </div>

          <button className="btn-primary mt-6 w-full disabled:opacity-60" disabled={loading} onClick={onSubmit}>
            {loading ? "Generating..." : "Generate Certificate"}
          </button>
        </MotionDiv>
      </MotionDiv>
    </AnimatePresence>
  );
}

export default function Certificates() {
  const qc = useQueryClient();
  const { settings } = useSettings();
  const certSettings = settings?.certificate || defaultSettings.certificate;
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [preview, setPreview] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [unrevokeTarget, setUnrevokeTarget] = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({
    studentSearch: "",
    studentId: "",
    courseId: "",
    forceGenerate: false,
  });

  const certQ = useQuery({ queryKey: ["admin-certificates"], queryFn: getCertificates });
  const studentsQ = useQuery({ queryKey: ["admin-students"], queryFn: getStudents });
  const coursesQ = useQuery({ queryKey: ["admin-courses"], queryFn: getCourses });

  const certs = certQ.data || EMPTY;
  const students = studentsQ.data || EMPTY;
  const courses = coursesQ.data || EMPTY;

  const generateM = useMutation({
    mutationFn: generateCertificate,
    onSuccess: (resp) => {
      const data = resp?.data || resp;
      qc.invalidateQueries({ queryKey: ["admin-certificates"] });
      toast.success("Certificate generated successfully");
      setShowGenerate(false);
      setGenForm({ studentSearch: "", studentId: "", courseId: "", forceGenerate: false });
      setPreview(data);
    },
    onError: (e) => {
      toast.error(e?.response?.data?.message || "Failed to generate certificate");
    },
  });

  const revokeM = useMutation({
    mutationFn: (certKey) => revokeCertificate(certKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-certificates"] });
      setRevokeTarget(null);
      toast.success("Certificate has been revoked");
    },
    onError: (e) => {
      toast.error(e?.response?.data?.message || "Failed to revoke certificate");
    },
  });

  const unrevokeM = useMutation({
    mutationFn: (certKey) => unrevokeCertificate(certKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-certificates"] });
      setUnrevokeTarget(null);
      toast.success("Certificate has been unrevoked");
    },
    onError: (e) => {
      toast.error(e?.response?.data?.message || "Failed to unrevoke certificate");
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return certs.filter((cert) => {
      const inSearch =
        !q ||
        String(cert.studentName || "").toLowerCase().includes(q) ||
        String(cert.certId || cert.id || "").toLowerCase().includes(q);
      const inCourse =
        courseFilter === "all" ||
        String(cert.courseId || "") === courseFilter;
      const d = toDate(cert.issuedAt || cert.createdAt);
      const inStart = startDate ? (d ? d >= new Date(startDate) : false) : true;
      const inEnd = endDate ? (d ? d <= new Date(`${endDate}T23:59:59`) : false) : true;
      return inSearch && inCourse && inStart && inEnd;
    });
  }, [certs, search, courseFilter, startDate, endDate]);

  const stats = useMemo(() => {
    const now = new Date();
    const total = certs.length;
    const issuedMonth = certs.filter((cert) => {
      const d = toDate(cert.issuedAt || cert.createdAt);
      return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const active = certs.filter((cert) => !cert.isRevoked).length;
    return { total, issuedMonth, active };
  }, [certs]);

  const handleGenerate = () => {
    if (!genForm.studentId || !genForm.courseId) {
      toast.error("Select student and course");
      return;
    }
    const student = students.find((s) => (s.uid || s.id) === genForm.studentId);
    const enrolledRows = normalizeStudentEnrollments(student);
    const selectedEnrollment = enrolledRows.find((row) => row.courseId === genForm.courseId);
    if (!selectedEnrollment) {
      toast.error("Student is not enrolled in this course");
      return;
    }
    const isIncomplete =
      Number(selectedEnrollment.progress || 0) < 100 && !selectedEnrollment.completedAt;
    if (isIncomplete && !genForm.forceGenerate) {
      toast.error("Student has not completed this course. Confirm warning to continue.");
      return;
    }
    generateM.mutate({
      studentId: genForm.studentId,
      courseId: genForm.courseId,
      allowIncomplete: Boolean(isIncomplete && genForm.forceGenerate),
    });
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-left" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Certificates</h2>
          <p className="text-sm text-slate-500">Issue and manage student certificates.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowGenerate(true)}>
          Generate Certificate
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-card"><p className="text-sm text-slate-500">Total Issued</p><p className="mt-2 text-3xl font-semibold text-primary">{stats.total}</p></div>
        <div className="glass-card"><p className="text-sm text-slate-500">Issued This Month</p><p className="mt-2 text-3xl font-semibold text-emerald-600">{stats.issuedMonth}</p></div>
        <div className="glass-card"><p className="text-sm text-slate-500">Active Certificates</p><p className="mt-2 text-3xl font-semibold text-primary">{stats.active}</p></div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by student or cert ID..." className="rounded-full border border-slate-200 px-4 py-2 text-sm" />
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="rounded-full border border-slate-200 px-4 py-2 text-sm">
          <option value="all">All Courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-500">Issue Date From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Issue date from"
            title="Select start issue date"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-500">Issue Date To</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="Issue date to"
            title="Select end issue date"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm"
          />
        </div>
        <p className="w-full text-xs text-slate-500">
          Hint: Use both dates to filter certificates by issue date range.
        </p>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-6 py-4">Cert ID</th>
              <th className="px-6 py-4">Student</th>
              <th className="px-6 py-4">Course</th>
              <th className="px-6 py-4">Issue Date</th>
              <th className="px-6 py-4">Verification URL</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {certQ.isLoading
              ? Array.from({ length: 6 }).map((_, r) => (
                  <tr key={r} className="border-b border-slate-100">
                    {Array.from({ length: 7 }).map((__, c) => (
                      <td key={c} className="px-6 py-4"><div className="skeleton h-5 w-24" /></td>
                    ))}
                  </tr>
                ))
              : filtered.length === 0
              ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="mx-auto max-w-md">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500">T</div>
                      <p className="mt-3 font-semibold text-slate-700">No certificates issued yet</p>
                    </div>
                  </td>
                </tr>
                )
              : filtered.map((cert) => {
                  const s = certStatus(cert);
                  const link = verifyLinkFor(cert);
                  return (
                    <tr key={cert.id} className="border-b border-slate-100">
                      <td className="px-6 py-4">
                        <button className={`font-mono text-sm font-semibold text-primary ${cert.isRevoked ? "line-through opacity-70" : ""}`} onClick={async () => { await navigator.clipboard.writeText(cert.certId || cert.id); toast.success("Copied to clipboard!"); }}>
                          {cert.certId || cert.id}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                            {initials(cert.studentName)}
                          </div>
                          <span className="font-semibold text-slate-800">{cert.studentName || "Student"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{cert.courseName || "-"}</td>
                      <td className="px-6 py-4 text-slate-600">{dateLabel(cert.issuedAt || cert.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="max-w-[240px] truncate text-xs text-slate-500">{link}</div>
                        <button className="mt-1 rounded-full border border-slate-200 px-2 py-1 text-xs" onClick={async () => { await navigator.clipboard.writeText(link); toast.success("Verification link copied!"); }}>
                          Copy Link
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(s)}`}>
                          {s === "valid" ? "Valid" : "Revoked"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button className="rounded-full border border-slate-200 px-3 py-1 text-xs" onClick={() => setPreview(cert)}>Preview</button>
                          <button
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                            onClick={() => {
                              downloadCertPdf(cert, certSettings);
                              toast.success("Certificate PDF downloaded");
                            }}
                          >
                            Download
                          </button>
                          <button className="rounded-full border border-slate-200 px-3 py-1 text-xs" onClick={async () => { await navigator.clipboard.writeText(link); toast.success("Verification link copied!"); }}>Copy Verify Link</button>
                          {cert.isRevoked ? (
                            <button
                              className="rounded-full border border-emerald-200 px-3 py-1 text-xs text-emerald-700"
                              onClick={() => setUnrevokeTarget(cert)}
                            >
                              Unrevoke
                            </button>
                          ) : (
                            <button
                              className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600"
                              onClick={() => setRevokeTarget(cert)}
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      <PreviewModal
        cert={preview}
        onClose={() => setPreview(null)}
        certSettings={certSettings}
      />

      <GenerateModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        students={students}
        courses={courses}
        form={genForm}
        setForm={setGenForm}
        onSubmit={handleGenerate}
        loading={generateM.isPending}
      />

      <AnimatePresence>
        {revokeTarget ? (
          <MotionDiv className="fixed inset-0 z-[92] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="absolute inset-0 bg-slate-900/45" onClick={() => setRevokeTarget(null)} />
            <MotionDiv initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }} className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <h3 className="font-heading text-xl text-slate-900">Revoke Certificate</h3>
              <p className="mt-2 text-sm text-slate-600">
                Revoke certificate {revokeTarget.certId || revokeTarget.id}? This will invalidate the certificate and the student will be notified.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button className="rounded-full border border-slate-200 px-4 py-2 text-sm" onClick={() => setRevokeTarget(null)}>
                  Cancel
                </button>
                <button className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => revokeM.mutate(revokeTarget.certId || revokeTarget.id)}>
                  Revoke
                </button>
              </div>
            </MotionDiv>
          </MotionDiv>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {unrevokeTarget ? (
          <MotionDiv className="fixed inset-0 z-[92] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="absolute inset-0 bg-slate-900/45" onClick={() => setUnrevokeTarget(null)} />
            <MotionDiv initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }} className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <h3 className="font-heading text-xl text-slate-900">Unrevoke Certificate</h3>
              <p className="mt-2 text-sm text-slate-600">
                Restore certificate {unrevokeTarget.certId || unrevokeTarget.id}? Student will be able to verify and download it again.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button className="rounded-full border border-slate-200 px-4 py-2 text-sm" onClick={() => setUnrevokeTarget(null)}>
                  Cancel
                </button>
                <button className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => unrevokeM.mutate(unrevokeTarget.certId || unrevokeTarget.id)}>
                  Unrevoke
                </button>
              </div>
            </MotionDiv>
          </MotionDiv>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
