import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import api from "../../api/axios.js";

const toDateLabel = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function VerifyCertificate() {
  const { certId } = useParams();

  const verifyQuery = useQuery({
    queryKey: ["public-verify-certificate", certId],
    queryFn: async () => {
      const response = await api.get(`/verify/${certId}`);
      return response.data.data;
    },
    retry: false,
    enabled: Boolean(certId),
  });

  if (verifyQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="skeleton mx-auto h-14 w-14 rounded-full" />
          <div className="mx-auto mt-4 h-5 w-52 skeleton" />
          <div className="mx-auto mt-2 h-4 w-72 skeleton" />
          <div className="mt-8 space-y-3">
            <div className="h-4 w-full skeleton" />
            <div className="h-4 w-11/12 skeleton" />
            <div className="h-4 w-10/12 skeleton" />
          </div>
        </div>
      </div>
    );
  }

  if (verifyQuery.isError) {
    const status = verifyQuery.error?.response?.status;
    const message = verifyQuery.error?.response?.data?.message || "Unable to verify certificate.";
    const revoked = status === 400 && message.toLowerCase().includes("revoked");
    const notFound = status === 404;

    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
            revoked ? "bg-rose-100 text-rose-600" : "bg-rose-100 text-rose-600"
          }`}>
            X
          </div>
          <h2 className="mt-4 font-heading text-3xl text-slate-900">
            {notFound ? "Certificate Not Found" : revoked ? "Certificate Revoked" : "Verification Failed"}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            {notFound
              ? "The certificate ID you entered is invalid."
              : revoked
              ? "This certificate has been revoked by SUM Academy."
              : message}
          </p>
        </div>
      </div>
    );
  }

  const cert = verifyQuery.data;
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="rounded-3xl border border-emerald-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
          V
        </div>
        <h2 className="mt-4 text-center font-heading text-3xl text-slate-900">Certificate Verified</h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          This certificate was issued by SUM Academy.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Student Name</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{cert.studentName || "-"}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500">Course Name</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{cert.courseName || "-"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Certificate ID</p>
            <p className="mt-2 font-mono text-base font-semibold text-primary">{cert.certId || cert.id}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500">Issue Date</p>
            <p className="mt-2 text-base text-slate-800">{toDateLabel(cert.issuedAt || cert.createdAt)}</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-primary/30 bg-gradient-to-br from-white to-slate-50 p-6">
          <p className="text-center text-sm italic text-slate-500">Certificate Preview</p>
          <p className="mt-3 text-center font-heading text-4xl text-primary">{cert.studentName || "Student"}</p>
          <p className="mt-2 text-center text-sm text-slate-500">has successfully completed</p>
          <p className="mt-2 text-center text-2xl font-bold text-slate-900">{cert.courseName || "Course"}</p>
        </div>
      </div>
    </div>
  );
}
