import { useMemo } from "react";
import { motion as Motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import { FiAward } from "react-icons/fi";
import { Skeleton } from "../../components/Skeleton.jsx";
import { useSettings } from "../../hooks/useSettings.js";
import { useAuth } from "../../hooks/useAuth.js";
import { defaultSettings } from "../../context/SettingsContext.jsx";
import CertificatePreviewCard from "../../components/CertificatePreviewCard.jsx";
import {
  getStudentCertificates,
  getStudentCourses,
} from "../../services/student.service.js";
import { generateCertificatePDF } from "../../utils/pdfDesigns.js";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
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
    className: sanitizeText(certificate.className || ""),
    completionScope: sanitizeText(certificate.completionScope || ""),
    completionTitle: sanitizeText(certificate.completionTitle || ""),
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

const downloadCertificatePdf = async (certificate, logoUrl, fallbackStudentName) => {
  const completionScope =
    certificate.completionScope || (certificate.className ? "class" : "course");
  const completionTitle =
    certificate.completionTitle ||
    (certificate.className
      ? `${certificate.className}${certificate.courseName ? ` - ${certificate.courseName}` : ""}`
      : certificate.courseName);

  await generateCertificatePDF({
    certId: certificate.certId,
    studentName: fallbackStudentName || certificate.studentName,
    courseName: certificate.courseName,
    className: certificate.className,
    completionScope,
    completionTitle,
    issuedDate: certificate.issuedAt,
    instructorName: "SUM Academy",
    logoUrl,
  });
};

function StudentCertificates() {
  const { settings } = useSettings();
  const { userProfile } = useAuth();
  const certSettings = settings?.certificate || defaultSettings.certificate;
  const logoUrl = settings?.general?.logoUrl || null;
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

      <Motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">My Certificates</h1>
      </Motion.section>

      {isError && (
        <Motion.section
          {...fadeUp}
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error?.response?.data?.message || error?.message || "Failed to load certificates"}
        </Motion.section>
      )}

      <Motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2">
        {isLoading
          ? Array.from({ length: 2 }).map((ignore, index) => (
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
      </Motion.section>

      {isLoading ? (
        <Motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((ignore, index) => (
            <div
              key={`cert-skeleton-${index}`}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="mt-4 h-9 w-full rounded-full" />
              <Skeleton className="mt-2 h-9 w-full rounded-full" />
            </div>
          ))}
        </Motion.section>
      ) : certificates.length < 1 ? (
        <Motion.section
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
        </Motion.section>
      ) : (
        <Motion.section {...fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {certificates.map((certificate) => (
            <article
              key={certificate.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <CertificatePreviewCard
                certificate={certificate}
                logoUrl={logoUrl || certSettings.logoUrl || ""}
                compact
              />

              <div className="mt-4 grid gap-2">
                <button
                  className={`rounded-full px-4 py-2 text-xs font-semibold text-white ${
                    certificate.isRevoked ? "bg-slate-400" : "bg-primary"
                  }`}
                  onClick={async () => {
                    if (certificate.isRevoked) {
                      toast.error(
                        "This certificate has been revoked by admin and cannot be downloaded."
                      );
                      return;
                    }
                    try {
                      await downloadCertificatePdf(
                        certificate,
                        logoUrl,
                        userProfile?.fullName || userProfile?.name
                      );
                      toast.success("Certificate PDF downloaded");
                    } catch (error) {
                      toast.error(error?.message || "Failed to download certificate");
                    }
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
        </Motion.section>
      )}
    </div>
  );
}

export default StudentCertificates;
