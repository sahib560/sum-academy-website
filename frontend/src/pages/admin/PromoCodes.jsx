import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const statusOptions = ["All", "Active", "Expired", "Disabled"];

const courseOptions = [
  "All Courses",
  "Class XI - Pre-Medical",
  "Class XII - Pre-Medical",
  "Pre-Entrance Test",
];

const initialPromos = [
  {
    id: 1,
    code: "SUMSAVE20",
    discountType: "percentage",
    discountValue: 20,
    appliesTo: "All Courses",
    used: 42,
    limit: 200,
    expiry: "2026-05-30",
    status: "Active",
  },
  {
    id: 2,
    code: "BIO1000",
    discountType: "fixed",
    discountValue: 1000,
    appliesTo: "Class XI - Pre-Medical",
    used: 18,
    limit: 50,
    expiry: "2026-04-15",
    status: "Active",
  },
  {
    id: 3,
    code: "WELCOME50",
    discountType: "percentage",
    discountValue: 10,
    appliesTo: "All Courses",
    used: 120,
    limit: 0,
    expiry: "2026-02-15",
    status: "Expired",
  },
  {
    id: 4,
    code: "NOCODE",
    discountType: "fixed",
    discountValue: 500,
    appliesTo: "Pre-Entrance Test",
    used: 3,
    limit: 20,
    expiry: "2026-06-20",
    status: "Disabled",
  },
];

const initialCourseDiscounts = [
  {
    id: 1,
    course: "Class XI - Pre-Medical",
    originalPrice: 12000,
    discountPercent: 15,
    active: true,
  },
  {
    id: 2,
    course: "Class XII - Pre-Medical",
    originalPrice: 14000,
    discountPercent: 10,
    active: false,
  },
  {
    id: 3,
    course: "Pre-Entrance Test",
    originalPrice: 9000,
    discountPercent: 20,
    active: true,
  },
];

const statusStyles = {
  Active: "bg-emerald-50 text-emerald-600",
  Expired: "bg-slate-100 text-slate-500",
  Disabled: "bg-rose-50 text-rose-600",
};

const formatPKR = (amount) => `PKR ${amount.toLocaleString("en-US")}`;

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const generateCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 8 })
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join("");
};

function PromoCodes() {
  const [promos, setPromos] = useState(initialPromos);
  const [courseDiscounts, setCourseDiscounts] = useState(initialCourseDiscounts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [courseFilter, setCourseFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [formData, setFormData] = useState({
    code: "",
    discountType: "percentage",
    discountValue: "",
    appliesTo: "All Courses",
    usageLimit: 0,
    singleUse: false,
    expiry: "",
    active: true,
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

  useEffect(() => {
    if (!copiedId) return;
    const timer = setTimeout(() => setCopiedId(null), 1500);
    return () => clearTimeout(timer);
  }, [copiedId]);

  const stats = useMemo(() => {
    const activeCodes = promos.filter((promo) => promo.status === "Active").length;
    const totalUses = promos.reduce((sum, promo) => sum + promo.used, 0);
    const revenueDiscounted = promos.reduce((sum, promo) => {
      if (promo.discountType === "fixed") {
        return sum + promo.discountValue * promo.used;
      }
      return sum + promo.used * 300;
    }, 0);
    return { activeCodes, totalUses, revenueDiscounted };
  }, [promos]);

  const filteredPromos = useMemo(() => {
    const query = search.trim().toLowerCase();
    return promos.filter((promo) => {
      const matchesSearch =
        !query || promo.code.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "All" || promo.status === statusFilter;
      const matchesCourse =
        courseFilter === "All" ||
        promo.appliesTo === courseFilter ||
        (courseFilter === "All Courses" && promo.appliesTo === "All Courses");
      return matchesSearch && matchesStatus && matchesCourse;
    });
  }, [courseFilter, promos, search, statusFilter]);

  const openModal = (promo) => {
    if (promo) {
      setEditingPromo(promo);
      setFormData({
        code: promo.code,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        appliesTo: promo.appliesTo,
        usageLimit: promo.limit,
        singleUse: false,
        expiry: promo.expiry,
        active: promo.status === "Active",
      });
    } else {
      setEditingPromo(null);
      setFormData({
        code: "",
        discountType: "percentage",
        discountValue: "",
        appliesTo: "All Courses",
        usageLimit: 0,
        singleUse: false,
        expiry: "",
        active: true,
      });
    }
    setModalOpen(true);
  };

  const handleSavePromo = () => {
    if (!formData.code || !formData.discountValue) {
      setToast({ type: "error", message: "Code and discount are required." });
      return;
    }
    const status = formData.active ? "Active" : "Disabled";
    if (editingPromo) {
      setPromos((prev) =>
        prev.map((promo) =>
          promo.id === editingPromo.id
            ? {
                ...promo,
                code: formData.code,
                discountType: formData.discountType,
                discountValue: Number(formData.discountValue),
                appliesTo: formData.appliesTo,
                limit: Number(formData.usageLimit),
                expiry: formData.expiry,
                status,
              }
            : promo
        )
      );
      setToast({ type: "success", message: "Promo code updated." });
    } else {
      const newPromo = {
        id: Date.now(),
        code: formData.code,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        appliesTo: formData.appliesTo,
        used: 0,
        limit: Number(formData.usageLimit),
        expiry: formData.expiry,
        status,
      };
      setPromos((prev) => [newPromo, ...prev]);
      setToast({ type: "success", message: "Promo code created." });
    }
    setModalOpen(false);
  };

  const handleToggleStatus = (promo) => {
    setPromos((prev) =>
      prev.map((item) =>
        item.id === promo.id
          ? {
              ...item,
              status: item.status === "Disabled" ? "Active" : "Disabled",
            }
          : item
      )
    );
    setToast({ type: "success", message: "Promo code status updated." });
  };

  const handleDeletePromo = (promo) => {
    setPromos((prev) => prev.filter((item) => item.id !== promo.id));
    setToast({ type: "success", message: "Promo code deleted." });
  };

  const handleCopyCode = async (promo) => {
    try {
      await navigator.clipboard.writeText(promo.code);
      setCopiedId(promo.id);
      setToast({ type: "success", message: "Promo code copied." });
    } catch (error) {
      setToast({ type: "error", message: "Copy failed. Please try again." });
    }
  };

  const handleDiscountChange = (id, value) => {
    setCourseDiscounts((prev) =>
      prev.map((course) =>
        course.id === id
          ? { ...course, discountPercent: Number(value) }
          : course
      )
    );
  };

  const handleToggleCourse = (id) => {
    setCourseDiscounts((prev) =>
      prev.map((course) =>
        course.id === id ? { ...course, active: !course.active } : course
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">
            Promo Codes & Discounts
          </h2>
          <p className="text-sm text-slate-500">
            Manage promo codes and course-level discounts.
          </p>
        </div>
        <button className="btn-primary" onClick={() => openModal(null)}>
          Create Promo Code
        </button>
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
              { label: "Active Codes", value: stats.activeCodes },
              { label: "Total Uses This Month", value: stats.totalUses },
              {
                label: "Revenue Discounted",
                value: formatPKR(stats.revenueDiscounted),
              },
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
          placeholder="Search code..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status === "All" ? "Status: All" : status}
            </option>
          ))}
        </select>
        <select
          value={courseFilter}
          onChange={(event) => setCourseFilter(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          {courseOptions.map((course) => (
            <option key={course} value={course}>
              {course === "All" ? "Course: All" : course}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 p-4 lg:hidden">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={`promo-card-${index}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="skeleton h-4 w-1/2" />
                <div className="mt-3 space-y-2">
                  <div className="skeleton h-3 w-3/4" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
            ))
          ) : filteredPromos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No promo codes found.
            </div>
          ) : (
            filteredPromos.map((promo) => (
              <div
                key={promo.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Code
                    </p>
                    <p className="mt-1 inline-flex rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-semibold text-slate-700">
                      {promo.code}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {promo.appliesTo}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[promo.status]}`}
                  >
                    {promo.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500">
                  <div>
                    <p className="uppercase tracking-[0.2em] text-slate-400">Discount</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {promo.discountType === "percentage"
                        ? `${promo.discountValue}%`
                        : formatPKR(promo.discountValue)}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.2em] text-slate-400">Used</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {promo.used}/{promo.limit === 0 ? "Unlimited" : promo.limit}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.2em] text-slate-400">Expiry</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatDate(promo.expiry)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => openModal(promo)}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => handleToggleStatus(promo)}
                  >
                    {promo.status === "Disabled" ? "Enable" : "Disable"}
                  </button>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => handleDeletePromo(promo)}
                  >
                    Delete
                  </button>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => handleCopyCode(promo)}
                  >
                    {copiedId === promo.id ? "Copied!" : "Copy Code"}
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
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Discount</th>
                <th className="px-6 py-4">Applies To</th>
                <th className="px-6 py-4">Used/Limit</th>
                <th className="px-6 py-4">Expiry Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`row-${index}`} className="border-b border-slate-100">
                    {Array.from({ length: 7 }).map((__, col) => (
                      <td key={col} className="px-6 py-4">
                        <div className="skeleton h-6 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredPromos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No promo codes found.
                  </td>
                </tr>
              ) : (
                filteredPromos.map((promo) => (
                  <tr key={promo.id} className="border-b border-slate-100">
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-semibold text-slate-700">
                        {promo.code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {promo.discountType === "percentage"
                        ? `${promo.discountValue}%`
                        : formatPKR(promo.discountValue)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{promo.appliesTo}</td>
                    <td className="px-6 py-4">
                      {promo.used}/{promo.limit === 0 ? "Unlimited" : promo.limit}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {formatDate(promo.expiry)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[promo.status]}`}
                      >
                        {promo.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                          onClick={() => openModal(promo)}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                          onClick={() => handleToggleStatus(promo)}
                        >
                          {promo.status === "Disabled" ? "Enable" : "Disable"}
                        </button>
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                          onClick={() => handleDeletePromo(promo)}
                        >
                          Delete
                        </button>
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                          onClick={() => handleCopyCode(promo)}
                        >
                          {copiedId === promo.id ? "Copied!" : "Copy Code"}
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
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading text-2xl text-slate-900">
            Course-level Discounts
          </h3>
        </div>
        <div className="mt-4 space-y-3 lg:hidden">
          {courseDiscounts.map((course) => {
            const discounted =
              course.originalPrice -
              (course.originalPrice * course.discountPercent) / 100;
            return (
              <div
                key={course.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Course
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {course.course}
                    </p>
                  </div>
                  <button
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      course.active ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                    onClick={() => handleToggleCourse(course.id)}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                        course.active ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500">
                  <div>
                    <p className="uppercase tracking-[0.2em] text-slate-400">
                      Original
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatPKR(course.originalPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.2em] text-slate-400">
                      Discounted
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatPKR(Math.max(discounted, 0))}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.2em] text-slate-400">
                      Discount %
                    </p>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={course.discountPercent}
                      onChange={(event) =>
                        handleDiscountChange(course.id, event.target.value)
                      }
                      className="mt-1 w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 hidden overflow-x-auto lg:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Original Price</th>
                <th className="px-4 py-3">Discount %</th>
                <th className="px-4 py-3">Discounted Price</th>
                <th className="px-4 py-3">Active</th>
              </tr>
            </thead>
            <tbody>
              {courseDiscounts.map((course) => {
                const discounted =
                  course.originalPrice -
                  (course.originalPrice * course.discountPercent) / 100;
                return (
                  <tr key={course.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {course.course}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatPKR(course.originalPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={course.discountPercent}
                        onChange={(event) =>
                          handleDiscountChange(course.id, event.target.value)
                        }
                        className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatPKR(Math.max(discounted, 0))}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                          course.active ? "bg-emerald-500" : "bg-slate-200"
                        }`}
                        onClick={() => handleToggleCourse(course.id)}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                            course.active ? "translate-x-5" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-heading text-2xl text-slate-900">
                  {editingPromo ? "Edit Promo Code" : "Create Promo Code"}
                </h3>
                <p className="text-sm text-slate-500">
                  Configure discounts and usage rules.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500"
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Code
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        code: event.target.value.toUpperCase(),
                      }))
                    }
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
                    placeholder="SUMCODE"
                  />
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        code: generateCode(),
                      }))
                    }
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Discount Type
                  </label>
                  <div className="mt-2 flex gap-2">
                    {["percentage", "fixed"].map((type) => (
                      <button
                        key={type}
                        className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold ${
                          formData.discountType === type
                            ? "bg-primary text-white"
                            : "border border-slate-200 text-slate-600"
                        }`}
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, discountType: type }))
                        }
                      >
                        {type === "percentage" ? "Percentage %" : "Fixed PKR"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Discount Value
                  </label>
                  <input
                    type="number"
                    value={formData.discountValue}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        discountValue: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="20"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Applies To
                  </label>
                  <select
                    value={formData.appliesTo}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        appliesTo: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    {courseOptions
                      .filter((item) => item !== "All")
                      .map((course) => (
                        <option key={course} value={course}>
                          {course}
                        </option>
                      ))}
                    <option value="All Courses">All Courses</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    value={formData.usageLimit}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        usageLimit: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="0 = unlimited"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Single use per student
                    </p>
                    <p className="text-xs text-slate-500">Prevent multiple uses.</p>
                  </div>
                  <button
                    type="button"
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      formData.singleUse ? "bg-primary" : "bg-slate-200"
                    }`}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        singleUse: !prev.singleUse,
                      }))
                    }
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                        formData.singleUse ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiry}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        expiry: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Active</p>
                  <p className="text-xs text-slate-500">
                    Toggle promo code availability.
                  </p>
                </div>
                <button
                  type="button"
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    formData.active ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, active: !prev.active }))
                  }
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      formData.active ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <button className="btn-primary mt-6 w-full" onClick={handleSavePromo}>
              Save Promo Code
            </button>
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

export default PromoCodes;
