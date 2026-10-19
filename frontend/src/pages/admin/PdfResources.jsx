import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  FiFileText,
  FiUploadCloud,
  FiSearch,
  FiEdit3,
  FiTrash2,
  FiEye,
  FiDownload,
  FiCheckCircle,
  FiClock,
  FiArchive,
  FiX,
  FiPlus,
  FiAlertTriangle,
} from "react-icons/fi";

const MotionDiv = motion.div;

import {
  getAdminPdfResources,
  getAdminPdfResourceStats,
  createPdfResource,
  updatePdfResource,
  updatePdfResourceStatus,
  deletePdfResource,
  getAdminPdfPreviewUrl,
} from "../../services/pdfResource.service.js";
import PdfViewerModal from "../../components/PdfViewerModal.jsx";

const formatBytes = (bytes = 0) => {
  const safe = Number(bytes || 0);
  if (!safe || safe <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(safe) / Math.log(k));
  return `${parseFloat((safe / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatDate = (val) => {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const CATEGORY_PRESETS = [
  "Notes",
  "Past Papers",
  "Syllabus",
  "Formula Sheet",
  "Question Bank",
  "Practice Worksheet",
  "Guide",
  "General",
];

const SUBJECT_PRESETS = [
  "Physics",
  "Chemistry",
  "Biology",
  "Mathematics",
  "English",
  "Urdu",
  "Islamiyat",
  "Computer Science",
  "General",
];

const CLASS_LEVEL_PRESETS = [
  "All",
  "9th Class",
  "10th Class",
  "11th Class",
  "12th Class",
  "MDCAT",
  "ECAT",
  "O-Level",
  "A-Level",
];

export default function AdminPdfResources() {
  const queryClient = useQueryClient();

  // Filters & Pagination state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [deletingResource, setDeletingResource] = useState(null);
  const [previewingResource, setPreviewingResource] = useState(null);

  // Upload/Edit Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("Notes");
  const [formSubject, setFormSubject] = useState("Physics");
  const [formClassLevel, setFormClassLevel] = useState("All");
  const [formTags, setFormTags] = useState("");
  const [formStatus, setFormStatus] = useState("published");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Queries
  const queryParams = useMemo(
    () => ({
      search: search.trim(),
      status: statusFilter === "all" ? "" : statusFilter,
      category: categoryFilter === "all" ? "" : categoryFilter,
      subject: subjectFilter === "all" ? "" : subjectFilter,
      page,
      limit: 12,
    }),
    [search, statusFilter, categoryFilter, subjectFilter, page]
  );

  const { data: listData, isLoading: isListLoading } = useQuery({
    queryKey: ["admin-pdf-resources", queryParams],
    queryFn: () => getAdminPdfResources(queryParams),
  });

  const { data: statsData, isLoading: isStatsLoading } = useQuery({
    queryKey: ["admin-pdf-stats"],
    queryFn: getAdminPdfResourceStats,
  });

  const resources = listData?.resources || [];
  const pagination = listData?.pagination || { page: 1, totalPages: 1, total: 0 };

  // Mutations
  const createMutation = useMutation({
    mutationFn: ({ formData }) =>
      createPdfResource(formData, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percent);
      }),
    onSuccess: () => {
      toast.success("PDF resource uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-pdf-resources"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pdf-stats"] });
      queryClient.invalidateQueries({ queryKey: ["public-pdf-resources"] });
      closeFormModal();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to upload PDF");
      setUploadProgress(0);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }) =>
      updatePdfResource(id, formData, (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      }),
    onSuccess: () => {
      toast.success("PDF resource updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-pdf-resources"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pdf-stats"] });
      queryClient.invalidateQueries({ queryKey: ["public-pdf-resources"] });
      closeFormModal();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update PDF");
      setUploadProgress(0);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updatePdfResourceStatus(id, status),
    onSuccess: (_, variables) => {
      toast.success(`Status changed to ${variables.status}`);
      queryClient.invalidateQueries({ queryKey: ["admin-pdf-resources"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pdf-stats"] });
      queryClient.invalidateQueries({ queryKey: ["public-pdf-resources"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to update status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deletePdfResource(id),
    onSuccess: () => {
      toast.success("PDF resource deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-pdf-resources"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pdf-stats"] });
      queryClient.invalidateQueries({ queryKey: ["public-pdf-resources"] });
      setDeletingResource(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to delete PDF resource");
    },
  });

  // Modal Handlers
  const openCreateModal = () => {
    setEditingResource(null);
    setFormTitle("");
    setFormDescription("");
    setFormCategory("Notes");
    setFormSubject("Physics");
    setFormClassLevel("All");
    setFormTags("");
    setFormStatus("published");
    setSelectedFile(null);
    setUploadProgress(0);
    setIsFormModalOpen(true);
  };

  const openEditModal = (resource) => {
    setEditingResource(resource);
    setFormTitle(resource.title || "");
    setFormDescription(resource.description || "");
    setFormCategory(resource.category || "Notes");
    setFormSubject(resource.subject || "Physics");
    setFormClassLevel(resource.classLevel || "All");
    setFormTags(Array.isArray(resource.tags) ? resource.tags.join(", ") : "");
    setFormStatus(resource.status || "published");
    setSelectedFile(null);
    setUploadProgress(0);
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setEditingResource(null);
    setSelectedFile(null);
    setUploadProgress(0);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF (.pdf) files are supported");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size exceeds 50MB limit");
      return;
    }

    setSelectedFile(file);

    // Auto-fill title if empty
    if (!formTitle.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
      setFormTitle(cleanName);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      toast.error("Document title is required");
      return;
    }

    if (!editingResource && !selectedFile) {
      toast.error("Please select a PDF document to upload");
      return;
    }

    const formData = new FormData();
    formData.append("title", formTitle.trim());
    formData.append("description", formDescription.trim());
    formData.append("category", formCategory);
    formData.append("subject", formSubject);
    formData.append("classLevel", formClassLevel);
    formData.append("tags", formTags);
    formData.append("status", formStatus);

    if (selectedFile) {
      formData.append("file", selectedFile);
    }

    if (editingResource) {
      updateMutation.mutate({ id: editingResource.id, formData });
    } else {
      createMutation.mutate({ formData });
    }
  };

  const isFormSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-heading">
            PDF Resources
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-body mt-1">
            Upload, categorize, publish, and manage educational PDF documents and study materials.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90 transition hover:-translate-y-0.5"
        >
          <FiPlus className="w-4 h-4" /> Upload New PDF
        </button>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
              <FiFileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Resources</p>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {isStatsLoading ? "..." : statsData?.total || 0}
              </h3>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
              <FiCheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Published</p>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {isStatsLoading ? "..." : statsData?.published || 0}
              </h3>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
              <FiClock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Drafts</p>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {isStatsLoading ? "..." : statsData?.draft || 0}
              </h3>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
              <FiArchive className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Archived</p>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {isStatsLoading ? "..." : statsData?.archived || 0}
              </h3>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center">
              <FiDownload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Downloads</p>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {isStatsLoading ? "..." : statsData?.totalDownloads || 0}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, subject, or filename..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-40">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Category Filter */}
        <div className="w-full md:w-44">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">All Categories</option>
            {CATEGORY_PRESETS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Subject Filter */}
        <div className="w-full md:w-44">
          <select
            value={subjectFilter}
            onChange={(e) => {
              setSubjectFilter(e.target.value);
              setPage(1);
            }}
            className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">All Subjects</option>
            {SUBJECT_PRESETS.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>

        {(Boolean(search) || statusFilter !== "all" || categoryFilter !== "all" || subjectFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setCategoryFilter("all");
              setSubjectFilter("all");
              setPage(1);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <FiX className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>

      {/* Table Listing */}
      <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Document</th>
                <th className="py-3.5 px-4">Subject & Category</th>
                <th className="py-3.5 px-4">Class Level</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Size</th>
                <th className="py-3.5 px-4">Downloads</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
              {isListLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="py-4 px-4 sm:px-6">
                      <div className="skeleton h-5 w-48 rounded mb-1.5" />
                      <div className="skeleton h-3 w-32 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="skeleton h-5 w-24 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="skeleton h-5 w-20 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="skeleton h-6 w-20 rounded-full" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="skeleton h-4 w-16 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="skeleton h-4 w-12 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="skeleton h-4 w-20 rounded" />
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-right">
                      <div className="skeleton h-8 w-24 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : resources.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <FiFileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No PDF resources found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Upload your first PDF resource or adjust your search filters.
                    </p>
                  </td>
                </tr>
              ) : (
                resources.map((resItem) => {
                  const statusColors = {
                    published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40",
                    draft: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-800/40",
                    archived: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
                  };

                  return (
                    <tr
                      key={resItem.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Document info */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center shrink-0 border border-red-100 dark:border-red-900/30">
                            <FiFileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate max-w-xs">
                              {resItem.title}
                            </p>
                            <p className="text-xs text-slate-400 truncate max-w-xs">
                              {resItem.originalFileName || "document.pdf"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Subject & Category */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                            {resItem.subject || "General"}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {resItem.category || "General"}
                          </span>
                        </div>
                      </td>

                      {/* Class Level */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          {resItem.classLevel || "All"}
                        </span>
                      </td>

                      {/* Status Dropdown */}
                      <td className="py-3.5 px-4">
                        <select
                          value={resItem.status}
                          disabled={statusMutation.isPending}
                          onChange={(e) =>
                            statusMutation.mutate({ id: resItem.id, status: e.target.value })
                          }
                          className={`text-xs font-semibold py-1 px-2.5 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 transition ${
                            statusColors[resItem.status] || statusColors.draft
                          }`}
                        >
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                          <option value="archived">Archived</option>
                        </select>
                      </td>

                      {/* File Size */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                        {formatBytes(resItem.fileSize)}
                      </td>

                      {/* Downloads */}
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {resItem.downloadCount || 0}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {formatDate(resItem.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewingResource(resItem)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Preview PDF"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(resItem)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition"
                            title="Edit Resource"
                          >
                            <FiEdit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingResource(resItem)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                            title="Delete Resource"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs">
            <span className="text-slate-500">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-700 transition"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-700 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload & Edit Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm">
          <MotionDiv
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <FiUploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                    {editingResource ? "Edit PDF Resource" : "Upload New PDF Resource"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingResource
                      ? "Update metadata or replace the document file"
                      : "Add educational documents to the academy library"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeFormModal}
                disabled={isFormSubmitting}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* File Upload Zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  PDF File {editingResource ? "(Optional: select only to replace current PDF)" : "*"}
                </label>
                <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary rounded-xl p-5 text-center bg-slate-50 dark:bg-slate-800/40 transition">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FiUploadCloud className="w-8 h-8 text-primary mx-auto mb-2" />
                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-semibold text-primary">{selectedFile.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatBytes(selectedFile.size)} • Ready to upload
                      </p>
                    </div>
                  ) : editingResource ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Current file: {editingResource.originalFileName}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Drag or click here to replace with a new PDF (max 50MB)
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Drop your PDF file here, or <span className="text-primary font-semibold">browse</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Supports standard PDF documents up to 50MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physics Chapter 3 Comprehensive Notes"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows="3"
                  placeholder="Provide a brief summary of what this document covers..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Category, Subject, Class Level Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {CATEGORY_PRESETS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subject
                  </label>
                  <select
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {SUBJECT_PRESETS.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Class Level */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Class Level
                  </label>
                  <select
                    value={formClassLevel}
                    onChange={(e) => setFormClassLevel(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {CLASS_LEVEL_PRESETS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. thermodynamics, mcqs, board exam, 2026"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Publication Status
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="formStatus"
                      value="published"
                      checked={formStatus === "published"}
                      onChange={() => setFormStatus("published")}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-slate-800 dark:text-slate-200 font-medium">Published (Visible to all)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="formStatus"
                      value="draft"
                      checked={formStatus === "draft"}
                      onChange={() => setFormStatus("draft")}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-slate-800 dark:text-slate-200 font-medium">Draft (Admin only)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="formStatus"
                      value="archived"
                      checked={formStatus === "archived"}
                      onChange={() => setFormStatus("archived")}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-slate-800 dark:text-slate-200 font-medium">Archived</span>
                  </label>
                </div>
              </div>

              {/* Progress bar */}
              {isFormSubmitting && uploadProgress > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>Uploading file...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={isFormSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isFormSubmitting}
                  className="btn-primary text-xs px-5 py-2 font-semibold disabled:opacity-50"
                >
                  {isFormSubmitting
                    ? editingResource
                      ? "Saving Changes..."
                      : "Uploading..."
                    : editingResource
                    ? "Save Changes"
                    : "Upload & Save"}
                </button>
              </div>
            </form>
          </MotionDiv>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <MotionDiv
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mx-auto">
              <FiAlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading">
                Delete PDF Resource?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to permanently delete <strong className="text-slate-800 dark:text-slate-200 font-semibold">{deletingResource.title}</strong>? This will remove the document metadata and delete the file from cloud storage.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingResource(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deletingResource.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-600/20 transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </MotionDiv>
        </div>
      )}

      {/* PDF Viewer Preview Modal */}
      {previewingResource && (
        <PdfViewerModal
          isOpen={Boolean(previewingResource)}
          onClose={() => setPreviewingResource(null)}
          title={previewingResource.title}
          category={previewingResource.category}
          subject={previewingResource.subject}
          fileSizeText={formatBytes(previewingResource.fileSize)}
          previewUrl={getAdminPdfPreviewUrl(previewingResource.id)}
          downloadUrl={getAdminPdfPreviewUrl(previewingResource.id)}
        />
      )}
    </div>
  );
}
