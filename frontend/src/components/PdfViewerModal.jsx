import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiDownload, FiMaximize2, FiMinimize2, FiFileText, FiExternalLink } from "react-icons/fi";

const MotionDiv = motion.div;

export default function PdfViewerModal({
  isOpen,
  onClose,
  title,
  previewUrl,
  downloadUrl,
  category,
  subject,
  fileSizeText,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState("");
  const isLoading = Boolean(previewUrl && loadedUrl !== previewUrl);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/80 backdrop-blur-md">
        <MotionDiv
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          className={`flex flex-col w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
            isFullscreen ? "h-[98vh] max-w-full" : "h-[90vh] max-w-5xl"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
            <div className="flex items-center gap-3 min-w-0 pr-4">
              <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center shrink-0">
                <FiFileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                  {title || "PDF Document"}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  {subject && <span>{subject}</span>}
                  {category && (
                    <>
                      <span>•</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[11px] font-medium">
                        {category}
                      </span>
                    </>
                  )}
                  {fileSizeText && (
                    <>
                      <span>•</span>
                      <span>{fileSizeText}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 shadow-sm transition"
                  title="Download PDF"
                >
                  <FiDownload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
              )}

              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Open in new tab"
              >
                <FiExternalLink className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={() => setIsFullscreen((prev) => !prev)}
                className="hidden sm:inline-flex p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <FiMinimize2 className="w-4 h-4" /> : <FiMaximize2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                title="Close"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* PDF Viewer Body */}
          <div className="relative flex-1 w-full bg-slate-100 dark:bg-slate-950 overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/90 dark:bg-slate-900/90 z-10">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Loading PDF document...
                </p>
              </div>
            )}

            {previewUrl ? (
              <iframe
                src={`${previewUrl}#toolbar=1&navpanes=0`}
                title={title || "PDF Preview"}
                className="w-full h-full border-0"
                onLoad={() => setLoadedUrl(previewUrl)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <p className="text-sm text-slate-500">Preview not available for this document.</p>
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    className="mt-3 inline-flex items-center gap-2 btn-primary text-xs"
                  >
                    <FiDownload className="w-3.5 h-3.5" /> Download Instead
                  </a>
                )}
              </div>
            )}
          </div>
        </MotionDiv>
      </div>
    </AnimatePresence>
  );
}
