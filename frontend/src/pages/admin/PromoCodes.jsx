import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import toast, { Toaster } from "react-hot-toast";
import {
  createPromoCode,
  deletePromoCode,
  getCourses,
  getPromoCodes,
  togglePromoCode,
  updatePromoCode,
} from "../../services/admin.service.js";

const INIT = {
  code: "",
  discountType: "percentage",
  discountValue: "",
  courseId: "",
  usageLimit: "0",
  isSingleUse: false,
  expiresAt: "",
  isActive: true,
};
const EMPTY = [];
const MotionDiv = motion.div;

const toDate = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const codeNormalize = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const statusOf = (p) => {
  const ex = toDate(p.expiresAt);
  if (ex && ex < new Date()) return "expired";
  return p.isActive ? "active" : "inactive";
};
const statusClass = (s) =>
  s === "active"
    ? "bg-emerald-50 text-emerald-700"
    : s === "expired"
    ? "bg-rose-50 text-rose-700"
    : "bg-slate-100 text-slate-600";
const dateLabel = (v) => {
  const d = toDate(v);
  if (!d) return "Never";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const discountLabel = (p) =>
  p.discountType === "fixed"
    ? `PKR ${Number(p.discountValue || 0).toLocaleString("en-PK")} OFF`
    : `${Number(p.discountValue || 0)}% OFF`;
const makeCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 8 })
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join("");
};

function validate(form, mode, promos) {
  const e = {};
  const c = codeNormalize(form.code);
  if (mode === "create") {
    if (!c) e.code = "Code is required";
    else if (c.length < 4) e.code = "Code must be at least 4 characters";
    else if (promos.some((x) => String(x.code || "").toUpperCase() === c)) e.code = "Code already exists";
  }
  const value = Number(form.discountValue);
  if (!Number.isFinite(value) || value <= 0) e.discountValue = "Discount must be positive";
  if (form.discountType === "percentage" && (value < 1 || value > 100))
    e.discountValue = "Percentage must be between 1 and 100";
  const limit = Number(form.usageLimit);
  if (!Number.isFinite(limit) || limit < 0) e.usageLimit = "Usage limit must be 0 or positive";
  if (form.expiresAt) {
    const ex = new Date(form.expiresAt);
    if (Number.isNaN(ex.getTime()) || ex <= new Date()) e.expiresAt = "Expiry date must be in the future";
  }
  return e;
}

function PromoModal({ open, mode, form, setForm, errors, codeError, courses, saving, onClose, onSave }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <MotionDiv className="fixed inset-0 z-[90] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-label="Close modal" />
        <MotionDiv initial={{ scale: 0.96, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.96, y: 10, opacity: 0 }} className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-heading text-2xl">{mode === "create" ? "Add Promo Code" : "Edit Promo Code"}</h3>
              <p className="text-sm text-slate-500">Create or update promo code settings.</p>
            </div>
            <button className="rounded-full border border-slate-200 px-3 py-1 text-sm" onClick={onClose}>X</button>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Code</label>
              <div className="mt-2 flex gap-2">
                <input value={form.code} disabled={mode === "edit"} onChange={(e) => setForm((p) => ({ ...p, code: codeNormalize(e.target.value) }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm disabled:bg-slate-50" placeholder="SUM2026" />
                <button className="rounded-xl border border-slate-200 px-4 text-sm" disabled={mode === "edit"} onClick={() => setForm((p) => ({ ...p, code: makeCode() }))}>Generate</button>
              </div>
              {codeError ? <p className="mt-1 text-xs text-rose-600">{codeError}</p> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Discount Type</label>
                <div className="mt-2 grid grid-cols-2 rounded-xl border border-slate-200 p-1">
                  <button className={`rounded-lg px-3 py-2 text-sm ${form.discountType === "percentage" ? "bg-primary text-white" : "text-slate-600"}`} onClick={() => setForm((p) => ({ ...p, discountType: "percentage" }))}>Percentage %</button>
                  <button className={`rounded-lg px-3 py-2 text-sm ${form.discountType === "fixed" ? "bg-primary text-white" : "text-slate-600"}`} onClick={() => setForm((p) => ({ ...p, discountType: "fixed" }))}>Fixed PKR</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Discount Value</label>
                <input type="number" min={1} max={form.discountType === "percentage" ? 100 : undefined} value={form.discountValue} onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                {errors.discountValue ? <p className="mt-1 text-xs text-rose-600">{errors.discountValue}</p> : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Applies To</label>
                <select value={form.courseId} onChange={(e) => setForm((p) => ({ ...p, courseId: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option value="">All Courses</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Usage Limit</label>
                <input type="number" min={0} value={form.usageLimit} onChange={(e) => setForm((p) => ({ ...p, usageLimit: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <p className="mt-1 text-xs text-slate-500">Enter 0 for unlimited uses</p>
                {errors.usageLimit ? <p className="mt-1 text-xs text-rose-600">{errors.usageLimit}</p> : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Expiry Date</label>
                <input type="date" value={form.expiresAt} onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                {errors.expiresAt ? <p className="mt-1 text-xs text-rose-600">{errors.expiresAt}</p> : null}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Flags</label>
                <button className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-2 text-sm" onClick={() => setForm((p) => ({ ...p, isSingleUse: !p.isSingleUse }))}>
                  <span>Single Use Per Student</span><span>{form.isSingleUse ? "ON" : "OFF"}</span>
                </button>
                <button className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-2 text-sm" onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}>
                  <span>Active</span><span>{form.isActive ? "ON" : "OFF"}</span>
                </button>
              </div>
            </div>
          </div>

          <button className="btn-primary mt-6 w-full disabled:opacity-60" disabled={saving} onClick={onSave}>
            {saving ? "Saving..." : mode === "create" ? "Save Promo Code" : "Update Promo Code"}
          </button>
        </MotionDiv>
      </MotionDiv>
    </AnimatePresence>
  );
}

export default function PromoCodes() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [copied, setCopied] = useState("");
  const [modal, setModal] = useState({ open: false, mode: "create", promo: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [usedTarget, setUsedTarget] = useState(null);
  const [form, setForm] = useState(INIT);
  const [errors, setErrors] = useState({});
  const [debouncedCode, setDebouncedCode] = useState("");

  const promoQ = useQuery({ queryKey: ["admin-promo-codes"], queryFn: getPromoCodes });
  const coursesQ = useQuery({ queryKey: ["admin-courses"], queryFn: getCourses });
  const promos = promoQ.data || EMPTY;
  const courses = coursesQ.data || EMPTY;

  const createM = useMutation({
    mutationFn: createPromoCode,
    onSuccess: (_r, vars) => {
      toast.success(`Promo code ${vars.code} created!`);
      qc.invalidateQueries({ queryKey: ["admin-promo-codes"] });
      setModal({ open: false, mode: "create", promo: null });
      setForm(INIT);
    },
    onError: (e) => {
      if (e?.response?.status === 409) setErrors((p) => ({ ...p, code: "Code already exists" }));
      else toast.error(e?.response?.data?.message || "Failed to create promo code");
    },
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }) => updatePromoCode(id, payload),
    onSuccess: () => {
      toast.success("Promo code updated");
      qc.invalidateQueries({ queryKey: ["admin-promo-codes"] });
      setModal({ open: false, mode: "create", promo: null });
      setForm(INIT);
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to update promo code"),
  });
  const toggleM = useMutation({
    mutationFn: ({ id, isActive }) => togglePromoCode(id, isActive),
    onSuccess: (_r, v) => {
      toast.success(v.isActive ? "Code activated" : "Code deactivated");
      qc.invalidateQueries({ queryKey: ["admin-promo-codes"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to toggle code"),
  });
  const deleteM = useMutation({
    mutationFn: deletePromoCode,
    onSuccess: () => {
      toast.success("Promo code deleted");
      qc.invalidateQueries({ queryKey: ["admin-promo-codes"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to delete promo code"),
  });

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(""), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCode(form.code), 300);
    return () => clearTimeout(timer);
  }, [form.code]);

  const liveCodeError = useMemo(() => {
    if (!modal.open || modal.mode !== "create") return "";
    const normalized = codeNormalize(debouncedCode);
    if (!normalized || normalized.length < 4) return "";
    const exists = promos.some(
      (promo) => String(promo.code || "").toUpperCase() === normalized
    );
    return exists ? "Code already exists" : "";
  }, [debouncedCode, modal.mode, modal.open, promos]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return promos.filter((p) => {
      const s = statusOf(p);
      const t = p.discountType === "fixed" ? "Fixed Amount" : "Percentage";
      const m1 = !q || String(p.code || "").toUpperCase().includes(q);
      const m2 = statusFilter === "All" || statusFilter.toLowerCase() === s;
      const m3 = typeFilter === "All" || typeFilter === t;
      return m1 && m2 && m3;
    });
  }, [promos, search, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const activeCodes = promos.filter((p) => statusOf(p) === "active").length;
    const expiredCodes = promos.filter((p) => statusOf(p) === "expired").length;
    const monthUses = promos.reduce((sum, p) => {
      const d = toDate(p.updatedAt) || toDate(p.createdAt);
      if (!d) return sum + Number(p.usageCount || 0);
      const sameMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return sum + (sameMonth ? Number(p.usageCount || 0) : 0);
    }, 0);
    return { activeCodes, expiredCodes, monthUses };
  }, [promos]);

  const onOpenCreate = () => {
    setModal({ open: true, mode: "create", promo: null });
    setForm(INIT);
    setErrors({});
  };
  const onOpenEdit = (p) => {
    setModal({ open: true, mode: "edit", promo: p });
    setErrors({});
    setForm({
      code: String(p.code || "").toUpperCase(),
      discountType: p.discountType || "percentage",
      discountValue: String(p.discountValue ?? ""),
      courseId: p.courseId || "",
      usageLimit: String(p.usageLimit ?? 0),
      isSingleUse: Boolean(p.isSingleUse),
      expiresAt: p.expiresAt ? new Date(p.expiresAt).toISOString().slice(0, 10) : "",
      isActive: Boolean(p.isActive),
    });
  };
  const onSave = () => {
    const e = validate(form, modal.mode, promos);
    if (liveCodeError) e.code = liveCodeError;
    setErrors(e);
    if (Object.keys(e).length) return;
    if (modal.mode === "create") {
      createM.mutate({
        code: codeNormalize(form.code),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        courseId: form.courseId || null,
        usageLimit: Number(form.usageLimit || 0),
        expiresAt: form.expiresAt || null,
        isSingleUse: Boolean(form.isSingleUse),
        isActive: Boolean(form.isActive),
      });
    } else {
      updateM.mutate({
        id: modal.promo.id,
        payload: {
          discountValue: Number(form.discountValue),
          usageLimit: Number(form.usageLimit || 0),
          expiresAt: form.expiresAt || null,
          isSingleUse: Boolean(form.isSingleUse),
          isActive: Boolean(form.isActive),
        },
      });
    }
  };

  const onExport = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("SUM Academy - Promo Codes", 14, 18);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
    let y = 34;
    filtered.forEach((p, i) => {
      if (y > 280) { doc.addPage(); y = 18; }
      const line = `${i + 1}. ${p.code} | ${discountLabel(p)} | ${p.courseName || "All Courses"} | ${p.usageCount || 0}/${p.usageLimit || "Unlimited"} | ${statusOf(p)}`;
      doc.text(line, 14, y);
      y += 8;
    });
    doc.save("SUM_Promo_Codes.pdf");
    toast.success("Promo codes PDF exported");
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-left" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl">Promo Codes</h2>
          <p className="text-sm text-slate-500">Create, update, and control discounts.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={onExport}>Export PDF</button>
          <button className="btn-primary" onClick={onOpenCreate}>Add Promo Code</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-card"><p className="text-sm text-slate-500">Active Codes</p><p className="mt-2 text-3xl font-semibold text-emerald-600">{stats.activeCodes}</p></div>
        <div className="glass-card"><p className="text-sm text-slate-500">Total Uses This Month</p><p className="mt-2 text-3xl font-semibold text-primary">{stats.monthUses}</p></div>
        <div className="glass-card"><p className="text-sm text-slate-500">Expired Codes</p><p className="mt-2 text-3xl font-semibold text-rose-600">{stats.expiredCodes}</p></div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code..." className="rounded-full border border-slate-200 px-4 py-2 text-sm" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-full border border-slate-200 px-4 py-2 text-sm">
          {["All", "Active", "Inactive", "Expired"].map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-full border border-slate-200 px-4 py-2 text-sm">
          {["All", "Percentage", "Fixed Amount"].map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-6 py-4">Code</th><th className="px-6 py-4">Discount</th><th className="px-6 py-4">Applies To</th><th className="px-6 py-4">Used / Limit</th><th className="px-6 py-4">Expiry</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {promoQ.isLoading ? Array.from({ length: 6 }).map((_, r) => (
              <tr key={r} className="border-b border-slate-100">{Array.from({ length: 7 }).map((__, c) => (<td key={c} className="px-6 py-4"><div className="skeleton h-5 w-24" /></td>))}</tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-16 text-center"><div className="mx-auto max-w-md"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500">%</div><p className="mt-3 font-semibold text-slate-700">No promo codes yet</p><button className="btn-primary mt-4" onClick={onOpenCreate}>Add Promo Code</button></div></td></tr>
            ) : filtered.map((p) => {
              const s = statusOf(p);
              const used = Number(p.usageCount || 0);
              const limit = Number(p.usageLimit || 0);
              const progress = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
              const expiry = toDate(p.expiresAt);
              const nextWeek = new Date();
              nextWeek.setDate(nextWeek.getDate() + 7);
              return (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="px-6 py-4"><div className="flex items-center gap-2"><span className="font-mono text-base font-semibold text-primary">{String(p.code || "").toUpperCase()}</span><button className="rounded-md border border-slate-200 px-2 py-1 text-xs" onClick={async () => { await navigator.clipboard.writeText(String(p.code || "").toUpperCase()); setCopied(p.id); toast.success("Copied to clipboard!"); }}>{copied === p.id ? "Copied!" : "Copy"}</button></div></td>
                  <td className="px-6 py-4"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{discountLabel(p)}</span></td>
                  <td className="px-6 py-4 text-slate-600">{p.courseName || "All Courses"}</td>
                  <td className="px-6 py-4"><p>{used} / {limit === 0 ? "Unlimited" : limit}</p>{limit > 0 ? <div className="mt-2 h-2 w-36 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div> : null}</td>
                  <td className={`px-6 py-4 ${expiry && expiry < new Date() ? "text-rose-600" : expiry && expiry < nextWeek ? "text-amber-600" : "text-slate-600"}`}>{dateLabel(p.expiresAt)}</td>
                  <td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(s)}`}>{s.charAt(0).toUpperCase() + s.slice(1)}</span></td>
                  <td className="px-6 py-4"><div className="flex flex-wrap gap-2"><button className="rounded-full border border-slate-200 px-3 py-1 text-xs" onClick={() => onOpenEdit(p)}>Edit</button><button className="rounded-full border border-slate-200 px-3 py-1 text-xs" onClick={() => toggleM.mutate({ id: p.id, isActive: !p.isActive })}>{p.isActive ? "Deactivate" : "Activate"}</button><button className={`rounded-full border px-3 py-1 text-xs ${used > 0 ? "border-slate-200 text-slate-400" : "border-rose-200 text-rose-600"}`} onClick={() => (used > 0 ? setUsedTarget(p) : setDeleteTarget(p))}>Delete</button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PromoModal
        open={modal.open}
        mode={modal.mode}
        form={form}
        setForm={setForm}
        errors={errors}
        codeError={errors.code || liveCodeError}
        courses={courses}
        saving={createM.isPending || updateM.isPending}
        onClose={() => setModal({ open: false, mode: "create", promo: null })}
        onSave={onSave}
      />

      <AnimatePresence>
        {deleteTarget ? (
          <MotionDiv className="fixed inset-0 z-[91] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="absolute inset-0 bg-slate-900/40" onClick={() => setDeleteTarget(null)} />
            <MotionDiv initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }} className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <h3 className="font-heading text-xl">Delete Promo Code</h3>
              <p className="mt-2 text-sm text-slate-600">Delete code <span className="font-mono font-semibold">{deleteTarget.code}</span>? This cannot be undone.</p>
              <div className="mt-6 flex justify-end gap-2"><button className="rounded-full border border-slate-200 px-4 py-2 text-sm" onClick={() => setDeleteTarget(null)}>Cancel</button><button className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => deleteM.mutate(deleteTarget.id)}>Delete</button></div>
            </MotionDiv>
          </MotionDiv>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {usedTarget ? (
          <MotionDiv className="fixed inset-0 z-[92] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="absolute inset-0 bg-slate-900/40" onClick={() => setUsedTarget(null)} />
            <MotionDiv initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }} className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <h3 className="font-heading text-xl">Cannot Delete Used Promo Code</h3>
              <p className="mt-2 text-sm text-slate-600">This code has been used {Number(usedTarget.usageCount || 0)} times. Deactivate it instead.</p>
              <div className="mt-6 flex justify-end gap-2"><button className="rounded-full border border-slate-200 px-4 py-2 text-sm" onClick={() => setUsedTarget(null)}>Close</button><button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={() => { toggleM.mutate({ id: usedTarget.id, isActive: false }); setUsedTarget(null); }}>Deactivate</button></div>
            </MotionDiv>
          </MotionDiv>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
