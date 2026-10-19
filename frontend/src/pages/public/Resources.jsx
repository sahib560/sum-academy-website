import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FiFileText,
  FiSearch,
  FiDownload,
  FiEye,
  FiX,
  FiBookOpen,
  FiLayers,
  FiCalendar,
} from "react-icons/fi";

const MotionDiv = motion.div;
import {
  getPublicPdfResources,
  getPublicPdfPreviewUrl,
  getPublicPdfDownloadUrl,
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
  if (!val) return "";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function Resources() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedClassLevel, setSelectedClassLevel] = useState("all");
  const [page, setPage] = useState(1);
  const [activeModalResource, setActiveModalResource] = useState(null);

  const queryParams = useMemo(
    () => ({
      search: search.trim(),
      category: selectedCategory === "all" ? "" : selectedCategory,
      subject: selectedSubject === "all" ? "" : selectedSubject,
      classLevel: selectedClassLevel === "all" ? "" : selectedClassLevel,
      page,
      limit: 12,
    }),
    [search, selectedCategory, selectedSubject, selectedClassLevel, page]
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-pdf-resources", queryParams],
    queryFn: () => getPublicPdfResources(queryParams),
    staleTime: 60000,
  });

  const resources = data?.resources || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };
  const filterOptions = data?.filters || { categories: [], subjects: [], classLevels: [] };

  const handleResetFilters = () => {
    setSearch("");
    setSelectedCategory("all");
    setSelectedSubject("all");
    setSelectedClassLevel("all");
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(search) ||
    selectedCategory !== "all" ||
    selectedSubject !== "all" ||
    selectedClassLevel !== "all";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark text-slate-800 dark:text-slate-100 transition-colors duration-200 pt-28 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-4 animate-fadeUp">
            <FiBookOpen className="w-3.5 h-3.5" /> Free Educational Materials
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white font-heading">
            SUM Academy <span className="text-primary">PDF Resource</span> Library
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 font-body">
            Browse, preview, and download study notes, formulas, past papers, and syllabi curated by our top educators. Completely free and open to all students.
          </p>
        </div>

        {/* Filter and Search Bar */}
        <div className="glass-card p-4 sm:p-6 mb-8 border border-slate-200/80 dark:border-white/10 shadow-lg">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search resources by title, topic, or keyword..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <FiX className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="w-full md:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full py-2.5 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              >
                <option value="all">All Categories</option>
                {filterOptions.categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject Dropdown */}
            <div className="w-full md:w-48">
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setPage(1);
                }}
                className="w-full py-2.5 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              >
                <option value="all">All Subjects</option>
                {filterOptions.subjects.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            {/* Class Level Dropdown */}
            <div className="w-full md:w-44">
              <select
                value={selectedClassLevel}
                onChange={(e) => {
                  setSelectedClassLevel(e.target.value);
                  setPage(1);
                }}
                className="w-full py-2.5 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              >
                <option value="all">All Classes</option>
                {filterOptions.classLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Filters button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <FiX className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Resources Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="skeleton w-12 h-12 rounded-xl" />
                  <div className="flex-1">
                    <div className="skeleton h-4 w-3/4 mb-2 rounded" />
                    <div className="skeleton h-3 w-1/2 rounded" />
                  </div>
                </div>
                <div className="skeleton h-12 w-full rounded" />
                <div className="flex gap-2 pt-2">
                  <div className="skeleton h-9 flex-1 rounded-full" />
                  <div className="skeleton h-9 flex-1 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="glass-card p-12 text-center max-w-md mx-auto">
            <p className="text-base text-red-500 font-semibold mb-2">Unable to load resources</p>
            <p className="text-sm text-slate-500 mb-4">
              Please check your connection or try again in a few moments.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="btn-primary text-xs"
            >
              Retry
            </button>
          </div>
        ) : resources.length === 0 ? (
          <div className="glass-card p-12 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-4">
              <FiFileText className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading">
              No PDF resources found
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {hasActiveFilters
                ? "No published documents matched your search or filter criteria."
                : "No educational PDF documents have been published yet. Please check back soon!"}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-5 btn-outline text-xs"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {resources.map((doc) => (
                <MotionDiv
                  key={doc.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="glass-card card-hover flex flex-col justify-between border border-slate-200/80 dark:border-white/10 group"
                >
                  <div>
                    {/* Top Badges & Icon */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center shrink-0 border border-red-100 dark:border-red-900/30 group-hover:scale-105 transition-transform duration-200">
                        <FiFileText className="w-6 h-6" />
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                          {doc.subject || "General"}
                        </span>
                        {doc.classLevel && doc.classLevel !== "All" && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accent/10 text-accent border border-accent/20">
                            {doc.classLevel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2 mb-2 font-heading group-hover:text-primary transition-colors">
                      {doc.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 mb-4 font-body leading-relaxed">
                      {doc.description || "No description provided."}
                    </p>

                    {/* Metadata chips */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-4 pb-4 border-b border-slate-100 dark:border-white/5">
                      <span className="inline-flex items-center gap-1 font-medium bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">
                        <FiLayers className="w-3 h-3 text-slate-400" />
                        {doc.category || "General"}
                      </span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                        {formatBytes(doc.fileSize)}
                      </span>
                      {doc.createdAt && (
                        <span className="inline-flex items-center gap-1 text-slate-400 ml-auto">
                          <FiCalendar className="w-3 h-3" />
                          {formatDate(doc.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveModalResource(doc)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-semibold border border-primary/30 text-primary hover:bg-primary hover:text-white transition duration-200"
                    >
                      <FiEye className="w-3.5 h-3.5" />
                      Preview
                    </button>

                    <a
                      href={getPublicPdfDownloadUrl(doc.id)}
                      download
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-semibold bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/20 transition duration-200"
                    >
                      <FiDownload className="w-3.5 h-3.5" />
                      Download
                    </a>
                  </div>
                </MotionDiv>
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  type="button"
                  disabled={!pagination.hasPrevPage}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500 font-medium px-2">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} resources)
                </span>
                <button
                  type="button"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* PDF Preview Modal */}
      {activeModalResource && (
        <PdfViewerModal
          isOpen={Boolean(activeModalResource)}
          onClose={() => setActiveModalResource(null)}
          title={activeModalResource.title}
          category={activeModalResource.category}
          subject={activeModalResource.subject}
          fileSizeText={formatBytes(activeModalResource.fileSize)}
          previewUrl={getPublicPdfPreviewUrl(activeModalResource.id)}
          downloadUrl={getPublicPdfDownloadUrl(activeModalResource.id)}
        />
      )}
    </div>
  );
}
