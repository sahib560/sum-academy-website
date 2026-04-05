import { useMemo, useRef, useState } from "react";

const bytesToText = (bytes) => {
  const size = Number(bytes || 0);
  if (!size) return "0 KB";
  if (size >= 1024 * 1024 * 1024) return `${(size / (1024 ** 3)).toFixed(2)} GB`;
  if (size >= 1024 * 1024) return `${(size / (1024 ** 2)).toFixed(2)} MB`;
  return `${(size / 1024).toFixed(2)} KB`;
};

function FileUploader({
  accept = "*/*",
  maxSize = 5,
  onUpload,
  label = "Upload File",
  hint = "",
  disabled = false,
}) {
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const maxBytes = useMemo(() => Number(maxSize || 0) * 1024 * 1024, [maxSize]);
  const isBusy = status === "uploading" || status === "processing";

  const resetState = () => {
    setProgress(0);
    setStatus("idle");
    setError("");
    setResult(null);
  };

  const onSelectFile = (pickedFile) => {
    if (!pickedFile) return;
    resetState();
    setFile(pickedFile);
  };

  const startUpload = async () => {
    if (!file || typeof onUpload !== "function" || isBusy || disabled) return;

    if (maxBytes > 0 && file.size > maxBytes) {
      setStatus("error");
      setError(`File too large. Max ${maxSize}MB`);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("uploading");
    setError("");
    setProgress(0);

    try {
      const uploadResult = await onUpload(file, {
        onProgress: (value) => {
          const next = Number(value);
          if (!Number.isFinite(next)) return;
          setProgress(Math.max(0, Math.min(100, next)));
          setStatus("uploading");
        },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setStatus("done");
      setProgress(100);
      setResult(uploadResult || null);
    } catch (uploadError) {
      if (controller.signal.aborted) {
        setStatus("idle");
        setProgress(0);
        return;
      }
      setStatus("error");
      setError(uploadError?.message || "Upload failed");
    } finally {
      abortRef.current = null;
    }
  };

  const cancelUpload = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setStatus("idle");
    setProgress(0);
  };

  const removeFile = () => {
    if (isBusy) return;
    setFile(null);
    resetState();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
      <button
        type="button"
        className={`w-full rounded-2xl border-2 border-dashed p-6 text-left transition ${
          isDragOver ? "border-primary bg-primary/5" : "border-slate-300 bg-slate-50"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);
          if (disabled) return;
          onSelectFile(event.dataTransfer.files?.[0] || null);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        disabled={disabled}
      >
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
        <p className="mt-2 text-xs text-slate-500">Drag & drop or click to choose</p>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => onSelectFile(event.target.files?.[0] || null)}
        disabled={disabled}
      />

      {file ? (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <p className="truncate font-semibold text-slate-800">{file.name}</p>
            <p className="text-slate-500">{bytesToText(file.size)}</p>
          </div>

          {(status === "uploading" || status === "processing" || status === "done") ? (
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}

          <p className="text-xs text-slate-600">
            {status === "idle" ? "Ready to upload" : null}
            {status === "uploading" ? `Uploading ${progress}%` : null}
            {status === "processing" ? "Processing..." : null}
            {status === "done" ? "Done" : null}
            {status === "error" ? "Error" : null}
          </p>

          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          {result?.url ? (
            <p className="truncate text-xs text-emerald-700">{result.url}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              onClick={startUpload}
              disabled={isBusy || disabled}
            >
              Upload
            </button>
            {isBusy ? (
              <button
                type="button"
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                onClick={cancelUpload}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                onClick={removeFile}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default FileUploader;
