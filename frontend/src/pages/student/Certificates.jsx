import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import toast, { Toaster } from "react-hot-toast";
import { FiAward } from "react-icons/fi";
import { Skeleton } from "../../components/Skeleton.jsx";
import { useSettings } from "../../hooks/useSettings.js";
import { defaultSettings } from "../../context/SettingsContext.jsx";
import {
  getStudentCertificates,
  getStudentCourses,
} from "../../services/student.service.js";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const parsed = toDate(value);
  if (!parsed) return "N/A";
  return parsed.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const sanitizeText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const buildVerificationUrl = (certificate = {}) => {
  if (certificate.verificationUrl) return certificate.verificationUrl;
  const certId = certificate.certId || certificate.id || "";
  const origin = window?.location?.origin || "";
  return `${origin}/verify/${encodeURIComponent(certId)}`;
};

const normalizeCertificates = (rows = []) =>
  rows.map((certificate, index) => ({
    id: certificate.id || `cert-${index}`,
    certId: sanitizeText(certificate.certId || certificate.id || `CERT-${index + 1}`),
    courseName: sanitizeText(certificate.courseName || certificate.course || "Course"),
    studentName: sanitizeText(certificate.studentName || certificate.student || "Student"),
    issuedAt:
      certificate.issuedAt ||
      certificate.createdAt ||
      certificate.issueDate ||
      certificate.date ||
      null,
    verificationUrl: buildVerificationUrl(certificate),
    isRevoked: Boolean(certificate.isRevoked),
    revokedAt: certificate.revokedAt || null,
  }));

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

const downloadCertificatePdf = async (certificate, certSettings) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Modern gradient background
  const gradient = doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Decorative border with modern styling
  doc.setDrawColor(59, 130, 246); // Blue border
  doc.setLineWidth(0.8);
  doc.roundedRect(15, 15, pageWidth - 30, pageHeight - 30, 5, 5);

  // Inner decorative elements
  doc.setDrawColor(16, 185, 129); // Green accent
  doc.setLineWidth(0.3);
  doc.roundedRect(18, 18, pageWidth - 36, pageHeight - 36, 3, 3);

  // Academy Logo and Header
  if (certSettings.showLogo && certSettings.logoUrl) {
    const logoData = await loadImageAsDataUrl(certSettings.logoUrl);
    if (logoData) {
      doc.addImage(logoData, "PNG", 25, 25, 30, 30);
    }
  }

  // Academy Name and Title
  doc.setTextColor(30, 58, 138); // Dark blue
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("SUM ACADEMY", pageWidth / 2, 35, { align: "center" });

  doc.setFontSize(18);
  doc.setTextColor(59, 130, 246); // Blue
  doc.text("CERTIFICATE OF COMPLETION", pageWidth / 2, 50, { align: "center" });

  // Decorative line
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(1);
  doc.line(60, 55, pageWidth - 60, 55);

  // Certificate Body
  doc.setFont("times", "normal");
  doc.setFontSize(14);
  doc.setTextColor(75, 85, 99); // Gray
  doc.text("This is to certify that", pageWidth / 2, 75, { align: "center" });

  // Student Name - Highlighted
  doc.setFillColor(59, 130, 246);
  doc.roundedRect(50, 80, pageWidth - 100, 20, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("times", "bold");
  doc.setFontSize(24);
  doc.text(certificate.studentName, pageWidth / 2, 92, { align: "center" });

  // Course completion text
  doc.setTextColor(75, 85, 99);
  doc.setFont("times", "normal");
  doc.setFontSize(14);
  doc.text("has successfully completed the course", pageWidth / 2, 110, { align: "center" });

  // Course Name - Highlighted
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(50, 115, pageWidth - 100, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.text(certificate.courseName, pageWidth / 2, 127, { align: "center" });

  // Issue Date
  doc.setTextColor(107, 114, 128);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Issued on: ${formatDate(certificate.issuedAt)}`, pageWidth / 2, 145, { align: "center" });

  // Certificate Details Box
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(30, 155, pageWidth - 60, 35, 3, 3, "F");
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.roundedRect(30, 155, pageWidth - 60, 35, 3, 3);

  // Certificate ID
  doc.setTextColor(31, 41, 55);
  doc.setFont("courier", "bold");
  doc.setFontSize(11);
  doc.text(`Certificate ID: ${certificate.certId}`, 35, 168);

  // Verification URL
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(59, 130, 246);
  const verifyUrl = certificate.verificationUrl || `${window.location.origin}/verify/${certificate.certId}`;
  doc.textWithLink("Verify Online", 35, 178, { url: verifyUrl });

  // Signatures Section
  if (certSettings.showSignature) {
    // Director Signature
    doc.setDrawColor(156, 163, 175);
    doc.setLineWidth(0.5);
    doc.line(40, pageHeight - 50, 90, pageHeight - 50);
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text("Director", 65, pageHeight - 45, { align: "center" });
    doc.text("SUM Academy", 65, pageHeight - 38, { align: "center" });

    // Instructor Signature
    doc.line(pageWidth - 90, pageHeight - 50, pageWidth - 40, pageHeight - 50);
    doc.text("Course Instructor", pageWidth - 65, pageHeight - 45, { align: "center" });
    doc.text(certificate.teacherName || "Faculty", pageWidth - 65, pageHeight - 38, { align: "center" });

    // Signature images if available
    if (certSettings.signatureUrl) {
      const sigData = await loadImageAsDataUrl(certSettings.signatureUrl);
      if (sigData) {
        doc.addImage(sigData, "PNG", 50, pageHeight - 70, 30, 15);
      }
    }
  }

  // QR Code for verification
  if (certSettings.showQr) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pageWidth - 45, pageHeight - 45, 25, 25, 2, 2, "F");
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.roundedRect(pageWidth - 45, pageHeight - 45, 25, 25, 2, 2);

    // QR Code placeholder
    doc.setFontSize(8);
    doc.setTextColor(59, 130, 246);
    doc.text("QR", pageWidth - 32.5, pageHeight - 35, { align: "center" });
    doc.text("CODE", pageWidth - 32.5, pageHeight - 30, { align: "center" });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text("This certificate is issued by SUM Academy and can be verified online using the certificate ID.", pageWidth / 2, pageHeight - 15, { align: "center" });
  doc.text("© 2026 SUM Academy. All rights reserved.", pageWidth / 2, pageHeight - 10, { align: "center" });

  doc.save(`SUM_Certificate_${certificate.certId}.pdf`);
};

function StudentCertificates() {
  const { settings } = useSettings();
  const certSettings = settings?.certificate || defaultSettings.certificate;
  const {
    data: certificateRows,
    isLoading: certificatesLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["student-certificates"],
    queryFn: () => getStudentCertificates(),
    staleTime: 30000,
  });

  const { data: coursesRows, isLoading: coursesLoading } = useQuery({
    queryKey: ["student-courses-for-certificates"],
    queryFn: () => getStudentCourses(),
    staleTime: 30000,
  });

  const certificates = useMemo(
    () => normalizeCertificates(Array.isArray(certificateRows) ? certificateRows : []),
    [certificateRows]
  );

  const courses = useMemo(
    () => (Array.isArray(coursesRows) ? coursesRows : []),
    [coursesRows]
  );

  const isLoading = certificatesLoading || coursesLoading;
  const inProgressCount = useMemo(
    () =>
      courses.filter((course) => {
        const progress = Number(course.progress || 0);
        return progress > 0 && progress < 100;
      }).length,
    [courses]
  );

  const handleCopyLink = async (certificate) => {
    if (certificate.isRevoked) {
      toast.error("This certificate has been revoked by admin and cannot be shared.");
      return;
    }
    try {
      await navigator.clipboard.writeText(certificate.verificationUrl);
      toast.success("Certificate link copied!");
    } catch {
      toast.error("Failed to copy certificate link");
    }
  };

  const handleVerify = (certificate) => {
    if (certificate.isRevoked) {
      toast.error("This certificate has been revoked by admin and cannot be verified.");
      return;
    }
    const verifyPath = `/verify/${encodeURIComponent(certificate.certId)}`;
    window.open(verifyPath, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">My Certificates</h1>
      </motion.section>

      {isError && (
        <motion.section
          {...fadeUp}
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error?.response?.data?.message || error?.message || "Failed to load certificates"}
        </motion.section>
      )}

      <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2">
        {isLoading
          ? Array.from({ length: 2 }).map((_, index) => (
              <div key={`stat-${index}`} className="glass-card border border-slate-200">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-4 h-8 w-1/3" />
              </div>
            ))
          : [
              { label: "Total Earned", value: certificates.length },
              { label: "Courses In Progress", value: inProgressCount },
            ].map((card) => (
              <div key={card.label} className="glass-card border border-slate-200">
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{card.value}</p>
              </div>
            ))}
      </motion.section>

      {isLoading ? (
        <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`cert-skeleton-${index}`}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="mt-4 h-9 w-full rounded-full" />
              <Skeleton className="mt-2 h-9 w-full rounded-full" />
            </div>
          ))}
        </motion.section>
      ) : certificates.length < 1 ? (
        <motion.section
          {...fadeUp}
          className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FiAward className="h-8 w-8" />
          </div>
          <p className="font-semibold text-slate-800">No certificates yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Complete a course to earn your certificate
          </p>
          <Link className="btn-primary mt-4 inline-flex" to="/student/explore">
            Explore Courses
          </Link>
        </motion.section>
      ) : (
        <motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {certificates.map((certificate) => (
            <article
              key={certificate.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div
                className="rounded-2xl border border-slate-200 bg-white p-4"
                style={{ background: certSettings.backgroundColor }}
              >
                <div
                  className="h-1.5 w-full rounded-full"
                  style={{ background: certSettings.borderColor }}
                />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="font-heading text-sm" style={{ color: certSettings.headingColor }}>
                    SUM Academy
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                    Official
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Certificate of Completion
                </p>
                <p
                  className="mt-3 text-base text-slate-900"
                  style={{ fontFamily: "\"Playfair Display\", serif" }}
                >
                  {certificate.courseName}
                </p>
                {certificate.isRevoked ? (
                  <span className="mt-2 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-700">
                    Revoked by admin
                  </span>
                ) : null}
                <p className="mt-1 text-xs" style={{ color: certSettings.bodyColor }}>
                  {certificate.studentName}
                </p>
                <p className="mt-2 text-[11px] text-slate-400">
                  Issued {formatDate(certificate.issuedAt)}
                </p>
                <p className="mt-1 font-mono text-[10px] text-slate-500">{certificate.certId}</p>
                {certSettings.showQr ? (
                  <div className="mt-3 flex h-12 w-12 items-center justify-center rounded border border-slate-200 bg-slate-100 text-[10px] text-slate-500">
                    QR
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-2">
                <button
                  className={`rounded-full px-4 py-2 text-xs font-semibold text-white ${
                    certificate.isRevoked ? "bg-slate-400" : "bg-primary"
                  }`}
                  onClick={() => {
                    if (certificate.isRevoked) {
                      toast.error(
                        "This certificate has been revoked by admin and cannot be downloaded."
                      );
                      return;
                    }
                    downloadCertificatePdf(certificate, certSettings);
                  }}
                >
                  Download PDF
                </button>
                <button
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                  onClick={() => handleCopyLink(certificate)}
                >
                  Share
                </button>
                <button
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                  onClick={() => handleVerify(certificate)}
                >
                  Verify
                </button>
              </div>
            </article>
          ))}
        </motion.section>
      )}
    </div>
  );
}

export default StudentCertificates;
