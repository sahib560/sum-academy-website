import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../api/axios.js";

const defaultQuestion = () => ({
  questionText: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctAnswer: "A",
  marks: 1,
});

const normalizeCorrectAnswer = (value) => {
  const clean = String(value || "").trim().toUpperCase();
  return ["A", "B", "C", "D"].includes(clean) ? clean : "";
};

const toInputDateTime = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (v) => String(v).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(
    parsed.getHours()
  )}:${pad(parsed.getMinutes())}`;
};

const parseLocalDateTime = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const computeDurationMinutes = (startAt, endAt) => {
  const start = parseLocalDateTime(startAt);
  const end = parseLocalDateTime(endAt);
  if (!start || !end) return null;
  const diff = end.getTime() - start.getTime();
  if (diff <= 0) return null;
  return Math.max(5, Math.ceil(diff / (60 * 1000)));
};

const escapeHtml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const stripAllHtmlExceptSupSub = (value = "") => {
  const raw = String(value ?? "");
  const placeholders = {
    "[[SUP_O]]": "<sup>",
    "[[SUP_C]]": "</sup>",
    "[[SUB_O]]": "<sub>",
    "[[SUB_C]]": "</sub>",
  };
  let text = raw
    .replace(/<\s*sup\s*>/gi, "[[SUP_O]]")
    .replace(/<\s*\/\s*sup\s*>/gi, "[[SUP_C]]")
    .replace(/<\s*sub\s*>/gi, "[[SUB_O]]")
    .replace(/<\s*\/\s*sub\s*>/gi, "[[SUB_C]]");
  text = text.replace(/<\/?[^>]+>/g, "");
  text = escapeHtml(text);
  Object.entries(placeholders).forEach(([key, tag]) => {
    text = text.split(key).join(tag);
  });
  return text;
};

const applyFormulaNotations = (value = "") => {
  let text = String(value ?? "");
  text = text.replace(/\^(\w+)/g, "<sup>$1</sup>");
  text = text.replace(/_(\w+)/g, "<sub>$1</sub>");
  text = text.replace(/([A-Za-z])(\d+)/g, "$1<sub>$2</sub>");
  return text;
};

const sanitizeQuestionHtml = (value = "") =>
  applyFormulaNotations(stripAllHtmlExceptSupSub(value));

const TEST_CSV_HEADERS = [
  "scope",
  "classid",
  "title",
  "description",
  "startat",
  "endat",
  "durationminutes",
  "maxviolations",
  "questiontext",
  "optiona",
  "optionb",
  "optionc",
  "optiond",
  "correctanswer",
  "marks",
];

const parseCsvLine = (line = "") => {
  const row = [];
  let current = "";
  let insideQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }
    if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  row.push(current);
  return row.map((cell) => String(cell ?? "").trim());
};

const parseCsvToRows = (csvText = "") => {
  const rawLines = String(csvText || "").split(/\r?\n/);
  if (!rawLines.length) return { headers: [], rows: [] };
  let headers = [];
  let headerFound = false;
  const rows = [];
  rawLines.forEach((rawLine, index) => {
    const lineNo = index + 1;
    const trimmedLine = String(rawLine || "").trim();
    if (!trimmedLine) return;
    if (trimmedLine.startsWith("#")) return;

    if (!headerFound) {
      headers = parseCsvLine(rawLine).map((h) => String(h || "").trim().toLowerCase());
      headerFound = true;
      return;
    }

    const values = parseCsvLine(rawLine);
    const row = { __row: lineNo };
    headers.forEach((header, cellIndex) => {
      row[header] = values[cellIndex] ?? "";
    });
    const hasAnyValue = headers.some((header) => String(row[header] || "").trim());
    if (!hasAnyValue) return;
    rows.push(row);
  });
  return { headers, rows };
};

export default function TestsManager({
  actor = "teacher",
  fetchTests,
  createTest,
  fetchClasses,
  fetchTestById,
  bulkUploadTest,
  downloadTestTemplate,
}) {
  const queryClient = useQueryClient();
  const [selectedTestId, setSelectedTestId] = useState("");
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkErrors, setBulkErrors] = useState([]);
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkBusyRow, setBulkBusyRow] = useState({});
  const questionRefs = useRef([]);
  const [adminEditOpen, setAdminEditOpen] = useState(false);
  const [adminDeleteOpen, setAdminDeleteOpen] = useState(false);
  const [adminReassignOpen, setAdminReassignOpen] = useState(false);
  const [adminDraft, setAdminDraft] = useState(null);
  const [adminReassignDraft, setAdminReassignDraft] = useState({
    assignTo: "all_class",
    classId: "",
    startAt: "",
    endAt: "",
  });
  const [form, setForm] = useState({
    title: "",
    description: "",
    scope: "class",
    classId: "",
    startAt: "",
    endAt: "",
    durationMinutes: 60,
    perQuestionTimeLimit: 60,
    maxViolations: 3,
    questions: [defaultQuestion()],
  });

  const testsQuery = useQuery({
    queryKey: [`${actor}-tests`],
    queryFn: fetchTests,
    staleTime: 30000,
  });

  const classesQuery = useQuery({
    queryKey: [`${actor}-classes-for-tests`],
    queryFn: fetchClasses,
    staleTime: 60000,
  });

  const detailsQuery = useQuery({
    queryKey: [`${actor}-test-details`, selectedTestId],
    queryFn: () => fetchTestById(selectedTestId),
    enabled: Boolean(selectedTestId),
  });

  const updateAdminTestMutation = useMutation({
    mutationFn: async ({ testId, payload }) => {
      const response = await api.put(`/admin/tests/${testId}`, payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Test updated");
      setAdminEditOpen(false);
      detailsQuery.refetch();
      queryClient.invalidateQueries({ queryKey: [`${actor}-tests`] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update test");
    },
  });

  const deleteAdminTestMutation = useMutation({
    mutationFn: async (testId) => {
      const response = await api.delete(`/admin/tests/${testId}`);
      return response.data;
    },
    onSuccess: (data) => {
      const count = Number(data?.data?.deletedImagesCount || data?.deletedImagesCount || 0);
      toast.success(`Test deleted. ${count} images removed from storage.`);
      setAdminDeleteOpen(false);
      setSelectedTestId("");
      queryClient.invalidateQueries({ queryKey: [`${actor}-tests`] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to delete test");
    },
  });

  const reassignAdminTestMutation = useMutation({
    mutationFn: async ({ testId, payload }) => {
      const response = await api.patch(`/admin/tests/${testId}/reassign`, payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Test reassigned");
      setAdminReassignOpen(false);
      detailsQuery.refetch();
      queryClient.invalidateQueries({ queryKey: [`${actor}-tests`] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to reassign test");
    },
  });

  const createMutation = useMutation({
    mutationFn: createTest,
    onSuccess: () => {
      toast.success("Test created successfully");
      setForm({
        title: "",
        description: "",
        scope: "class",
        classId: "",
        startAt: "",
        endAt: "",
        durationMinutes: 60,
        perQuestionTimeLimit: 60,
        maxViolations: 3,
        questions: [defaultQuestion()],
      });
      setBulkErrors([]);
      setBulkFile(null);
      setBulkPreview(null);
      setBulkBusyRow({});
      queryClient.invalidateQueries({ queryKey: [`${actor}-tests`] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to create test");
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (file) => {
      if (!bulkUploadTest) throw new Error("Bulk upload not supported");
      return bulkUploadTest(file);
    },
    onSuccess: () => {
      setBulkErrors([]);
      setBulkFile(null);
      toast.success("Test created from CSV");
      queryClient.invalidateQueries({ queryKey: [`${actor}-tests`] });
    },
    onError: (error) => {
      const errs = error?.response?.data?.errors?.errors;
      if (Array.isArray(errs) && errs.length) {
        setBulkErrors(errs);
        toast.error("CSV has validation errors");
        return;
      }
      toast.error(error?.response?.data?.message || "Failed to upload CSV");
    },
  });

  const bulkApiBase = actor === "admin" ? "/admin" : "/teacher";
  const uploadQuestionImage = async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    const response = await api.post(`${bulkApiBase}/tests/questions/image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data?.data || {};
  };
  const removeQuestionImage = async (imagePath) => {
    const response = await api.post(`${bulkApiBase}/tests/questions/image/delete`, { imagePath });
    return response.data?.data || {};
  };

  const parseBulkCsvFile = async (file) => {
    const text = await file.text();
    const parsed = parseCsvToRows(text);
    const headers = parsed.headers || [];
    const rows = parsed.rows || [];
    const missing = TEST_CSV_HEADERS.filter((h) => !headers.includes(h));
    if (!headers.length) {
      return { error: "CSV header row is missing", rows: [], meta: null };
    }
    if (missing.length) {
      return { error: `CSV headers are invalid. Missing: ${missing.join(", ")}`, rows: [], meta: null };
    }
    if (!rows.length) {
      return { error: "CSV has no data rows", rows: [], meta: null };
    }

    const first = rows[0] || {};
    const scope = String(first.scope || "class").trim().toLowerCase();
    const title = String(first.title || "").trim();
    const startAt = String(first.startat || "").trim();
    const endAt = String(first.endat || "").trim();
    const classId = String(first.classid || "").trim();
    const maxViolations = Number(first.maxviolations || 3);

    if (!["class", "center"].includes(scope)) {
      return { error: "scope must be class or center", rows: [], meta: null };
    }
    if (title.length < 3) {
      return { error: "title is required (min 3 chars)", rows: [], meta: null };
    }
    if (!startAt || !endAt || Number.isNaN(new Date(startAt).getTime()) || Number.isNaN(new Date(endAt).getTime())) {
      return { error: "startAt and endAt must be valid ISO dates", rows: [], meta: null };
    }
    if (scope === "class" && !classId) {
      return { error: "classId is required for class scope", rows: [], meta: null };
    }

    const meta = {
      scope,
      classId,
      title,
      description: String(first.description || "").trim(),
      startAt,
      endAt,
      maxViolations: Number.isFinite(maxViolations) ? Math.max(1, maxViolations) : 3,
    };

    const normalized = rows.map((row) => {
      const rowNo = Number(row.__row || 0);
      const questionTextRaw = String(row.questiontext || "").trim();
      const optionA = String(row.optiona || "").trim();
      const optionB = String(row.optionb || "").trim();
      const optionC = String(row.optionc || "").trim();
      const optionD = String(row.optiond || "").trim();
      const correct = String(row.correctanswer || "").trim().toUpperCase();
      const marksRaw = Number(row.marks || 1);
      const marks = Number.isFinite(marksRaw) ? Math.max(1, marksRaw) : 1;

      const errors = [];
      if (questionTextRaw.length < 3) errors.push("Question text too short");
      if (!optionA || !optionB || !optionC || !optionD) errors.push("Options A-D are required");
      if (!["A", "B", "C", "D"].includes(correct)) errors.push("Correct must be A/B/C/D");

      return {
        rowNo,
        questionTextRaw,
        questionTextHtml: sanitizeQuestionHtml(questionTextRaw),
        optionA,
        optionB,
        optionC,
        optionD,
        correct,
        marks,
        imageUrl: "",
        imagePath: "",
        isValid: errors.length === 0,
        error: errors.join("; "),
      };
    });

    return { error: "", meta, rows: normalized };
  };

  const computedDuration = useMemo(
    () => computeDurationMinutes(form.startAt, form.endAt),
    [form.startAt, form.endAt]
  );

  const bulkAllValid = useMemo(() => {
    const rows = Array.isArray(bulkPreview?.rows) ? bulkPreview.rows : [];
    return rows.length > 0 && rows.every((row) => row.isValid);
  }, [bulkPreview]);
  const bulkReadyCount = useMemo(() => {
    const rows = Array.isArray(bulkPreview?.rows) ? bulkPreview.rows : [];
    return rows.filter((row) => row.isValid).length;
  }, [bulkPreview]);
  const bulkTotalCount = useMemo(() => {
    const rows = Array.isArray(bulkPreview?.rows) ? bulkPreview.rows : [];
    return rows.length;
  }, [bulkPreview]);

  useEffect(() => {
    if (!computedDuration) return;
    setForm((p) => (p.durationMinutes === computedDuration ? p : { ...p, durationMinutes: computedDuration }));
  }, [computedDuration]);

  const downloadTemplate = async () => {
    try {
      if (!downloadTestTemplate) {
        toast.error("Template download is not available");
        return;
      }
      const canDownload =
        Boolean(form.title.trim()) &&
        Boolean(parseLocalDateTime(form.startAt)) &&
        Boolean(parseLocalDateTime(form.endAt)) &&
        (form.scope === "center" || Boolean(form.classId));
      if (!canDownload) {
        toast.error("Fill title, scope, class (if needed), start and end time first.");
        return;
      }

      const startIso = parseLocalDateTime(form.startAt)?.toISOString() || "";
      const endIso = parseLocalDateTime(form.endAt)?.toISOString() || "";
      const { blob, filename } = await downloadTestTemplate({
        scope: form.scope,
        classId: form.scope === "center" ? "" : form.classId,
        title: form.title,
        description: form.description,
        startAt: startIso,
        endAt: endIso,
        maxViolations: form.maxViolations,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "test_template.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to download template");
    }
  };

  const tests = Array.isArray(testsQuery.data) ? testsQuery.data : [];
  const classes = Array.isArray(classesQuery.data) ? classesQuery.data : [];
  const selected = detailsQuery.data || null;
  const isCenter = form.scope === "center";
  const canDownloadTemplate = useMemo(() => {
    if (!downloadTestTemplate) return false;
    if (!form.title.trim()) return false;
    if (!parseLocalDateTime(form.startAt) || !parseLocalDateTime(form.endAt)) return false;
    if (!computedDuration) return false;
    if (!isCenter && !form.classId) return false;
    return true;
  }, [downloadTestTemplate, form.title, form.startAt, form.endAt, form.classId, isCenter, computedDuration]);

  const canSubmit = useMemo(() => {
    if (!form.title.trim()) return false;
    if (!form.startAt || !form.endAt) return false;
    if (!isCenter && !form.classId) return false;
    if (!Array.isArray(form.questions) || form.questions.length < 1) return false;
    return form.questions.every(
      (q) =>
        q.questionText.trim() &&
        q.optionA.trim() &&
        q.optionB.trim() &&
        q.optionC.trim() &&
        q.optionD.trim() &&
        normalizeCorrectAnswer(q.correctAnswer)
    );
  }, [form, isCenter]);

  const submitCreate = () => {
    if (!canSubmit) return;
    const payload = {
      title: form.title,
      description: form.description,
      scope: form.scope,
      classId: isCenter ? "" : form.classId,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      durationMinutes: Number(computedDuration || form.durationMinutes || 60),
      perQuestionTimeLimit: Number(form.perQuestionTimeLimit || 60),
      maxViolations: Number(form.maxViolations || 3),
      questions: form.questions.map((q) => ({
        questionText: sanitizeQuestionHtml(q.questionText),
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: q.correctAnswer,
        expectedAnswer: "",
        marks: Number(q.marks || 1),
      })),
    };
    createMutation.mutate(payload);
  };

  const wrapSelection = (questionIndex, tagName) => {
    const element = questionRefs.current[questionIndex];
    if (!element) return;
    const start = Number(element.selectionStart || 0);
    const end = Number(element.selectionEnd || 0);
    const current = String(form.questions?.[questionIndex]?.questionText || "");
    const before = current.slice(0, start);
    const selected = current.slice(start, end);
    const after = current.slice(end);
    const fallbackText = selected || (tagName === "sup" ? "2" : "2");
    const insert = `<${tagName}>${fallbackText}</${tagName}>`;

    setForm((p) => ({
      ...p,
      questions: (p.questions || []).map((q, idx) =>
        idx === questionIndex
          ? { ...q, questionText: `${before}${insert}${after}` }
          : q
      ),
    }));

    setTimeout(() => {
      try {
        element.focus();
        const caret = before.length + tagName.length + 2;
        const selEnd = caret + fallbackText.length;
        element.setSelectionRange(caret, selEnd);
      } catch {
        // ignore
      }
    }, 0);
  };

  return (
    <div className="space-y-6">
      {bulkUploadTest && downloadTestTemplate ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-heading text-xl text-slate-900">Bulk Create Test (CSV)</h2>
              <p className="mt-1 text-sm text-slate-500">
                Upload one CSV to create one test with many MCQ questions. Correct answer must be A/B/C/D.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              disabled={!canDownloadTemplate}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Download Template
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv"
              onChange={async (e) => {
                const file = e.target.files?.[0] || null;
                setBulkErrors([]);
                setBulkPreview(null);
                setBulkBusyRow({});
                setBulkFile(file);
                if (!file) return;
                if (!file.name.toLowerCase().endsWith(".csv")) {
                  setBulkErrors(["Please select a .csv file"]);
                  return;
                }
                try {
                  const parsed = await parseBulkCsvFile(file);
                  if (parsed.error) {
                    setBulkErrors([parsed.error]);
                    return;
                  }
                  setBulkPreview({ meta: parsed.meta, rows: parsed.rows });
                } catch (err) {
                  setBulkErrors([err?.message || "Failed to parse CSV"]);
                }
              }}
              className="text-sm"
            />
            {bulkPreview ? (
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => {
                  setBulkErrors([]);
                  setBulkFile(null);
                  setBulkPreview(null);
                  setBulkBusyRow({});
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>

          {Array.isArray(bulkErrors) && bulkErrors.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-700">Fix these CSV errors and re-upload:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-700">
                {bulkErrors.slice(0, 20).map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
              {bulkErrors.length > 20 ? (
                <p className="mt-2 text-xs text-rose-700">
                  Showing first 20 of {bulkErrors.length} errors
                </p>
              ) : null}
            </div>
          ) : null}

          {bulkPreview ? (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">
                    {bulkReadyCount}/{bulkTotalCount} questions ready
                  </p>
                  <p className="text-xs text-slate-500">
                    Review, add images, then add all questions to the test.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!bulkAllValid || createMutation.isPending}
                  onClick={() => {
                    const meta = bulkPreview.meta || {};
                    const rows = Array.isArray(bulkPreview.rows) ? bulkPreview.rows : [];
                    const payload = {
                      title: meta.title || form.title,
                      description: meta.description || "",
                      scope: meta.scope || "class",
                      classId: meta.scope === "class" ? meta.classId : "",
                      startAt: meta.startAt,
                      endAt: meta.endAt,
                      perQuestionTimeLimit: Number(form.perQuestionTimeLimit || 60),
                      maxViolations: Number(meta.maxViolations || 3),
                      questions: rows.map((row) => ({
                        questionText: row.questionTextHtml,
                        optionA: row.optionA,
                        optionB: row.optionB,
                        optionC: row.optionC,
                        optionD: row.optionD,
                        correctAnswer: row.correct,
                        marks: row.marks,
                        imageUrl: row.imageUrl || null,
                        imagePath: row.imagePath || null,
                      })),
                    };
                    createMutation.mutate(payload);
                  }}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createMutation.isPending ? "Adding..." : "Add All to Test"}
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Question</th>
                      <th className="px-3 py-2">A</th>
                      <th className="px-3 py-2">B</th>
                      <th className="px-3 py-2">C</th>
                      <th className="px-3 py-2">D</th>
                      <th className="px-3 py-2">Correct</th>
                      <th className="px-3 py-2">Marks</th>
                      <th className="px-3 py-2">Image</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPreview.rows.map((row, idx) => {
                      const busy = Boolean(bulkBusyRow[idx]);
                      const correctClass = (letter) =>
                        row.correct === letter ? "bg-emerald-50 text-emerald-800 font-semibold" : "";
                      return (
                        <tr key={`${row.rowNo}-${idx}`} className="border-t border-slate-100 align-top">
                          <td className="px-3 py-2">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <div dangerouslySetInnerHTML={{ __html: row.questionTextHtml }} />
                          </td>
                          <td className={`px-3 py-2 ${correctClass("A")}`}>{row.optionA}</td>
                          <td className={`px-3 py-2 ${correctClass("B")}`}>{row.optionB}</td>
                          <td className={`px-3 py-2 ${correctClass("C")}`}>{row.optionC}</td>
                          <td className={`px-3 py-2 ${correctClass("D")}`}>{row.optionD}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{row.correct}</td>
                          <td className="px-3 py-2">{row.marks}</td>
                          <td className="px-3 py-2">
                            {row.imageUrl ? (
                              <div className="flex items-center gap-2">
                                <img
                                  src={row.imageUrl}
                                  alt="thumb"
                                  className="h-10 w-10 rounded-lg border border-slate-200 object-cover"
                                  draggable={false}
                                  onContextMenu={(e) => e.preventDefault()}
                                />
                                <button
                                  type="button"
                                  disabled={busy}
                                  className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-60"
                                  onClick={async () => {
                                    if (!row.imagePath) return;
                                    setBulkBusyRow((p) => ({ ...p, [idx]: true }));
                                    try {
                                      await removeQuestionImage(row.imagePath);
                                      toast.success("Question image removed");
                                      setBulkPreview((p) => ({
                                        ...p,
                                        rows: (p.rows || []).map((r, i) =>
                                          i === idx ? { ...r, imageUrl: "", imagePath: "" } : r
                                        ),
                                      }));
                                    } catch (err) {
                                      toast.error(err?.response?.data?.message || "Failed to remove image");
                                    } finally {
                                      setBulkBusyRow((p) => ({ ...p, [idx]: false }));
                                    }
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-primary/40 hover:bg-primary/5 hover:text-primary">
                                Add Image
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  className="hidden"
                                  disabled={busy}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0] || null;
                                    e.target.value = "";
                                    if (!file) return;
                                    const mime = String(file.type || "");
                                    const size = Number(file.size || 0);
                                    if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
                                      toast.error("Only JPG, PNG, WEBP images are allowed");
                                      return;
                                    }
                                    if (size > 2 * 1024 * 1024) {
                                      toast.error("Max image size is 2MB");
                                      return;
                                    }
                                    setBulkBusyRow((p) => ({ ...p, [idx]: true }));
                                    try {
                                      const uploaded = await uploadQuestionImage(file);
                                      if (!uploaded?.imageUrl || !uploaded?.imagePath) {
                                        throw new Error("Upload did not return imageUrl");
                                      }
                                      toast.success("Question image added");
                                      setBulkPreview((p) => ({
                                        ...p,
                                        rows: (p.rows || []).map((r, i) =>
                                          i === idx
                                            ? {
                                                ...r,
                                                imageUrl: uploaded.imageUrl,
                                                imagePath: uploaded.imagePath,
                                              }
                                            : r
                                        ),
                                      }));
                                    } catch (err) {
                                      toast.error(err?.response?.data?.message || err?.message || "Failed to upload image");
                                    } finally {
                                      setBulkBusyRow((p) => ({ ...p, [idx]: false }));
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {row.isValid ? (
                              <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                Valid
                              </span>
                            ) : (
                              <div className="space-y-1">
                                <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                                  Invalid
                                </span>
                                <p className="text-[11px] text-rose-700">{row.error}</p>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-xl text-slate-900">Create Test</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Test title"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={form.scope}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                scope: e.target.value,
                classId: "",
              }))
            }
          >
            <option value="class">Entire Class</option>
            <option value="center">Entire Center</option>
          </select>
          {!isCenter ? (
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              value={form.classId}
              onChange={(e) => setForm((p) => ({ ...p, classId: e.target.value }))}
            >
              <option value="">Select class</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name || classItem.className || "Class"}
                </option>
              ))}
            </select>
          ) : null}
          <textarea
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
            placeholder="Description (optional)"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          <label className="text-xs text-slate-500">
            Start At
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.startAt}
              onChange={(e) => setForm((p) => ({ ...p, startAt: e.target.value }))}
            />
          </label>
          <label className="text-xs text-slate-500">
            End At
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.endAt}
              onChange={(e) => setForm((p) => ({ ...p, endAt: e.target.value }))}
            />
          </label>
          <label className="text-xs text-slate-500">
            Duration (minutes)
            <input
              type="number"
              min={5}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.durationMinutes}
              onChange={(e) =>
                setForm((p) => ({ ...p, durationMinutes: Number(e.target.value || 60) }))
              }
              disabled={Boolean(computedDuration)}
            />
          </label>
          <label className="text-xs text-slate-500">
            Max Violations
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.maxViolations}
              onChange={(e) =>
                setForm((p) => ({ ...p, maxViolations: Number(e.target.value || 3) }))
              }
            />
          </label>
          <label className="text-xs text-slate-500">
            Per Question Time (sec)
            <input
              type="number"
              min={10}
              max={600}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.perQuestionTimeLimit}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  perQuestionTimeLimit: Number(e.target.value || 60),
                }))
              }
            />
          </label>
        </div>

        <div className="mt-4 space-y-3">
          {form.questions.map((question, idx) => (
            <div key={`q-${idx}`} className="rounded-2xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Question {idx + 1}</p>
                {form.questions.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs text-rose-500"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        questions: p.questions.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <textarea
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                rows={2}
                placeholder="Question text"
                value={question.questionText}
                ref={(el) => {
                  questionRefs.current[idx] = el;
                }}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    questions: p.questions.map((q, i) =>
                      i === idx ? { ...q, questionText: e.target.value } : q
                    ),
                  }))
                }
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  onClick={() => wrapSelection(idx, "sup")}
                >
                  x²
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  onClick={() => wrapSelection(idx, "sub")}
                >
                  x₂
                </button>
                <span className="text-xs text-slate-500">
                  Tip: also supports `^2` and `_2`
                </span>
              </div>
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                <div
                  dangerouslySetInnerHTML={{
                    __html: sanitizeQuestionHtml(question.questionText || ""),
                  }}
                />
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {["A", "B", "C", "D"].map((letter) => (
                  <input
                    key={letter}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder={`Option ${letter}`}
                    value={question[`option${letter}`]}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        questions: p.questions.map((q, i) =>
                          i === idx ? { ...q, [`option${letter}`]: e.target.value } : q
                        ),
                      }))
                    }
                  />
                ))}
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={normalizeCorrectAnswer(question.correctAnswer) || "A"}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      questions: p.questions.map((q, i) =>
                        i === idx ? { ...q, correctAnswer: normalizeCorrectAnswer(e.target.value) } : q
                      ),
                    }))
                  }
                >
                  <option value="A">Correct: A</option>
                  <option value="B">Correct: B</option>
                  <option value="C">Correct: C</option>
                  <option value="D">Correct: D</option>
                </select>
                <input
                  type="number"
                  min={1}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={question.marks}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      questions: p.questions.map((q, i) =>
                        i === idx ? { ...q, marks: Number(e.target.value || 1) } : q
                      ),
                    }))
                  }
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            onClick={() =>
              setForm((p) => ({
                ...p,
                questions: [...p.questions, defaultQuestion()],
              }))
            }
          >
            Add Question
          </button>
        </div>

        <div className="mt-4">
          <button
            type="button"
            disabled={!canSubmit || createMutation.isPending}
            onClick={submitCreate}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createMutation.isPending ? "Creating..." : "Create Test"}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-xl text-slate-900">My Tests</h2>
        <div className="mt-4 space-y-3">
          {testsQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading tests...</p>
          ) : tests.length < 1 ? (
            <p className="text-sm text-slate-500">No tests created yet.</p>
          ) : (
            tests.map((test) => (
              <div
                key={test.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{test.title}</p>
                    <p className="text-xs text-slate-500">
                      {test.className || "Entire Center"} | {test.scope} | {test.status}
                    </p>
                    <p className="text-xs text-slate-500">
                      {toInputDateTime(test.startAt).replace("T", " ")} to{" "}
                      {toInputDateTime(test.endAt).replace("T", " ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    onClick={() => setSelectedTestId(test.id)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {selectedTestId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-xl text-slate-900">Test Details</h3>
              <div className="flex flex-wrap items-center gap-2">
                {actor === "admin" && selected ? (
                  <>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      onClick={() => {
                        const qRows = Array.isArray(selected.questions) ? selected.questions : [];
                        setAdminDraft({
                          title: selected.title || "",
                          description: selected.description || "",
                          startAt: toInputDateTime(selected.startAt),
                          endAt: toInputDateTime(selected.endAt),
                          maxViolations: Number(selected.maxViolations || 3),
                          perQuestionTimeLimit: Number(selected.perQuestionTimeLimit || 60),
                          questions: qRows.map((q, idx) => {
                            const options = Array.isArray(q.options) ? q.options : [];
                            return {
                              questionId: q.questionId || `q-${idx}`,
                              questionText: q.questionText || "",
                              optionA: options[0] || "",
                              optionB: options[1] || "",
                              optionC: options[2] || "",
                              optionD: options[3] || "",
                              correctAnswer: String(q.correctAnswer || "A").trim().toUpperCase() || "A",
                              marks: Number(q.marks || 1),
                              imageUrl: q.imageUrl || "",
                              imagePath: q.imagePath || "",
                            };
                          }),
                        });
                        setAdminEditOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      onClick={() => {
                        setAdminReassignDraft((p) => ({
                          ...p,
                          classId: selected.classId || "",
                          startAt: toInputDateTime(selected.startAt),
                          endAt: toInputDateTime(selected.endAt),
                          assignTo: selected.scope === "center" ? "center" : "all_class",
                        }));
                        setAdminReassignOpen(true);
                      }}
                    >
                      Reassign
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      onClick={() => setAdminDeleteOpen(true)}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                  onClick={() => setSelectedTestId("")}
                >
                  Close
                </button>
              </div>
            </div>
            {detailsQuery.isLoading ? (
              <p className="text-sm text-slate-500">Loading details...</p>
            ) : selected ? (
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-semibold text-slate-900">{selected.title}</p>
                  <p className="text-sm text-slate-500">
                    {selected.className || "Entire Center"} | {selected.questions?.length || 0}{" "}
                    questions | {selected.totalMarks || 0} marks
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Per question: {Number(selected.perQuestionTimeLimit || 60)}s
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-800">Questions</p>
                  <div className="space-y-2">
                    {(selected.questions || []).map((q, index) => (
                      <div key={q.questionId || index} className="rounded-xl border border-slate-200 p-3">
                        {q.imageUrl ? (
                          <img
                            src={q.imageUrl}
                            alt="Question figure"
                            style={{
                              maxWidth: "100%",
                              maxHeight: "220px",
                              borderRadius: "12px",
                              marginBottom: "12px",
                              border: "1px solid #e2e8f0",
                              display: "block",
                            }}
                            onContextMenu={(e) => e.preventDefault()}
                            draggable={false}
                          />
                        ) : null}
                        <div className="text-sm font-medium text-slate-800">
                          <span className="mr-1">{index + 1}.</span>
                          <span
                            dangerouslySetInnerHTML={{
                              __html: sanitizeQuestionHtml(q.questionText || ""),
                            }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Marks: {q.marks}</p>
                        <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
                          {(q.options || []).map((option) => (
                            <li key={`${q.questionId}-${option}`}>{option}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-800">Ranking</p>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Pos</th>
                          <th className="px-3 py-2">Student</th>
                          <th className="px-3 py-2">Class</th>
                          <th className="px-3 py-2">Marks</th>
                          <th className="px-3 py-2">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selected.ranking || []).slice(0, 30).map((row) => (
                          <tr key={`${row.studentId}-${row.attemptId}`} className="border-t border-slate-100">
                            <td className="px-3 py-2">{row.position}</td>
                            <td className="px-3 py-2">{row.studentName}</td>
                            <td className="px-3 py-2">{row.className}</td>
                            <td className="px-3 py-2">
                              {row.obtainedMarks}/{row.totalMarks}
                            </td>
                            <td className="px-3 py-2">{row.percentage}%</td>
                          </tr>
                        ))}
                        {(selected.ranking || []).length < 1 ? (
                          <tr>
                            <td className="px-3 py-2 text-slate-500" colSpan={5}>
                              No submissions yet
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Unable to load details.</p>
            )}
          </div>
        </div>
      ) : null}

      {actor === "admin" && adminEditOpen && adminDraft ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-xl text-slate-900">Edit Test</h3>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                onClick={() => setAdminEditOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Title"
                value={adminDraft.title}
                onChange={(e) => setAdminDraft((p) => ({ ...p, title: e.target.value }))}
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Description"
                value={adminDraft.description}
                onChange={(e) => setAdminDraft((p) => ({ ...p, description: e.target.value }))}
              />
              <label className="text-xs text-slate-500">
                Start At
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={adminDraft.startAt}
                  onChange={(e) => setAdminDraft((p) => ({ ...p, startAt: e.target.value }))}
                />
              </label>
              <label className="text-xs text-slate-500">
                End At
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={adminDraft.endAt}
                  onChange={(e) => setAdminDraft((p) => ({ ...p, endAt: e.target.value }))}
                />
              </label>
              <label className="text-xs text-slate-500">
                Per Question Time (sec)
                <input
                  type="number"
                  min={10}
                  max={600}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={adminDraft.perQuestionTimeLimit}
                  onChange={(e) =>
                    setAdminDraft((p) => ({
                      ...p,
                      perQuestionTimeLimit: Number(e.target.value || 60),
                    }))
                  }
                />
              </label>
              <label className="text-xs text-slate-500">
                Max Violations
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={adminDraft.maxViolations}
                  onChange={(e) =>
                    setAdminDraft((p) => ({ ...p, maxViolations: Number(e.target.value || 3) }))
                  }
                />
              </label>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Questions</p>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  onClick={() =>
                    setAdminDraft((p) => ({
                      ...p,
                      questions: [
                        ...(Array.isArray(p.questions) ? p.questions : []),
                        {
                          questionId: `q-${Date.now()}`,
                          questionText: "",
                          optionA: "",
                          optionB: "",
                          optionC: "",
                          optionD: "",
                          correctAnswer: "A",
                          marks: 1,
                          imageUrl: "",
                          imagePath: "",
                        },
                      ],
                    }))
                  }
                >
                  Add Question
                </button>
              </div>

              {(adminDraft.questions || []).map((q, idx) => (
                <div key={q.questionId || idx} className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">Question {idx + 1}</p>
                    {(adminDraft.questions || []).length > 1 ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-600"
                        onClick={async () => {
                          // Best-effort: delete existing image immediately when removing question
                          if (q.imagePath) {
                            try {
                              await removeQuestionImage(q.imagePath);
                            } catch {
                              // ignore
                            }
                          }
                          setAdminDraft((p) => ({
                            ...p,
                            questions: (p.questions || []).filter((_, i) => i !== idx),
                          }));
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  {q.imageUrl ? (
                    <div className="mb-3 flex items-center gap-3">
                      <img
                        src={q.imageUrl}
                        alt="Question figure"
                        className="h-20 w-20 rounded-2xl border border-slate-200 object-cover"
                        draggable={false}
                        onContextMenu={(e) => e.preventDefault()}
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                        onClick={async () => {
                          if (!q.imagePath) return;
                          try {
                            await removeQuestionImage(q.imagePath);
                            toast.success("Question image removed");
                            setAdminDraft((p) => ({
                              ...p,
                              questions: (p.questions || []).map((row, i) =>
                                i === idx ? { ...row, imageUrl: "", imagePath: "" } : row
                              ),
                            }));
                          } catch (err) {
                            toast.error(err?.response?.data?.message || "Failed to remove image");
                          }
                        }}
                      >
                        Remove Image
                      </button>
                    </div>
                  ) : (
                    <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-primary/40 hover:bg-primary/5 hover:text-primary">
                      Add Image
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0] || null;
                          e.target.value = "";
                          if (!file) return;
                          const mime = String(file.type || "");
                          const size = Number(file.size || 0);
                          if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
                            toast.error("Only JPG, PNG, WEBP images are allowed");
                            return;
                          }
                          if (size > 2 * 1024 * 1024) {
                            toast.error("Max image size is 2MB");
                            return;
                          }
                          try {
                            const uploaded = await uploadQuestionImage(file);
                            toast.success("Question image added");
                            setAdminDraft((p) => ({
                              ...p,
                              questions: (p.questions || []).map((row, i) =>
                                i === idx
                                  ? { ...row, imageUrl: uploaded.imageUrl, imagePath: uploaded.imagePath }
                                  : row
                              ),
                            }));
                          } catch (err) {
                            toast.error(err?.response?.data?.message || "Failed to upload image");
                          }
                        }}
                      />
                    </label>
                  )}

                  <textarea
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Question text (supports ^2 / _2)"
                    value={q.questionText}
                    onChange={(e) =>
                      setAdminDraft((p) => ({
                        ...p,
                        questions: (p.questions || []).map((row, i) =>
                          i === idx ? { ...row, questionText: e.target.value } : row
                        ),
                      }))
                    }
                  />
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: sanitizeQuestionHtml(q.questionText || ""),
                      }}
                    />
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {["A", "B", "C", "D"].map((letter) => (
                      <input
                        key={letter}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder={`Option ${letter}`}
                        value={q[`option${letter}`]}
                        onChange={(e) =>
                          setAdminDraft((p) => ({
                            ...p,
                            questions: (p.questions || []).map((row, i) =>
                              i === idx
                                ? { ...row, [`option${letter}`]: e.target.value }
                                : row
                            ),
                          }))
                        }
                      />
                    ))}
                    <label className="text-xs text-slate-500">
                      Correct
                      <select
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={q.correctAnswer || "A"}
                        onChange={(e) =>
                          setAdminDraft((p) => ({
                            ...p,
                            questions: (p.questions || []).map((row, i) =>
                              i === idx ? { ...row, correctAnswer: e.target.value } : row
                            ),
                          }))
                        }
                      >
                        {["A", "B", "C", "D"].map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-slate-500">
                      Marks
                      <input
                        type="number"
                        min={1}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={q.marks}
                        onChange={(e) =>
                          setAdminDraft((p) => ({
                            ...p,
                            questions: (p.questions || []).map((row, i) =>
                              i === idx ? { ...row, marks: Number(e.target.value || 1) } : row
                            ),
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => setAdminEditOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateAdminTestMutation.isPending}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => {
                  const payload = {
                    title: adminDraft.title,
                    description: adminDraft.description,
                    startAt: adminDraft.startAt ? new Date(adminDraft.startAt).toISOString() : undefined,
                    endAt: adminDraft.endAt ? new Date(adminDraft.endAt).toISOString() : undefined,
                    maxViolations: Number(adminDraft.maxViolations || 3),
                    perQuestionTimeLimit: Number(adminDraft.perQuestionTimeLimit || 60),
                    questions: (adminDraft.questions || []).map((row, i) => ({
                      questionId: row.questionId || `q-${i}`,
                      questionText: sanitizeQuestionHtml(row.questionText),
                      optionA: row.optionA,
                      optionB: row.optionB,
                      optionC: row.optionC,
                      optionD: row.optionD,
                      correctAnswer: row.correctAnswer,
                      marks: Number(row.marks || 1),
                      imageUrl: row.imageUrl || null,
                      imagePath: row.imagePath || null,
                    })),
                  };
                  updateAdminTestMutation.mutate({ testId: selectedTestId, payload });
                }}
              >
                {updateAdminTestMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {actor === "admin" && adminDeleteOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5">
            <h3 className="font-heading text-lg text-slate-900">Delete test?</h3>
            <p className="mt-1 text-sm text-slate-600">
              Delete test and all question images? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => setAdminDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteAdminTestMutation.isPending}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => deleteAdminTestMutation.mutate(selectedTestId)}
              >
                {deleteAdminTestMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {actor === "admin" && adminReassignOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-lg text-slate-900">Reassign test</h3>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                onClick={() => setAdminReassignOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-slate-500 md:col-span-2">
                Assign To
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={adminReassignDraft.assignTo}
                  onChange={(e) =>
                    setAdminReassignDraft((p) => ({
                      ...p,
                      assignTo: e.target.value,
                    }))
                  }
                >
                  <option value="all_class">Entire Class</option>
                  <option value="center">Entire Center</option>
                </select>
              </label>
              {adminReassignDraft.assignTo === "all_class" ? (
                <label className="text-xs text-slate-500 md:col-span-2">
                  Class
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={adminReassignDraft.classId}
                    onChange={(e) =>
                      setAdminReassignDraft((p) => ({ ...p, classId: e.target.value }))
                    }
                  >
                    <option value="">Select class</option>
                    {classes.map((classItem) => (
                      <option key={classItem.id} value={classItem.id}>
                        {classItem.name || classItem.className || "Class"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="text-xs text-slate-500">
                Start At
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={adminReassignDraft.startAt}
                  onChange={(e) => setAdminReassignDraft((p) => ({ ...p, startAt: e.target.value }))}
                />
              </label>
              <label className="text-xs text-slate-500">
                End At
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={adminReassignDraft.endAt}
                  onChange={(e) => setAdminReassignDraft((p) => ({ ...p, endAt: e.target.value }))}
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => setAdminReassignOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reassignAdminTestMutation.isPending}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => {
                  const payload = {
                    assignTo: adminReassignDraft.assignTo,
                    ...(adminReassignDraft.assignTo === "all_class"
                      ? { classId: adminReassignDraft.classId }
                      : {}),
                    ...(adminReassignDraft.startAt
                      ? { startAt: new Date(adminReassignDraft.startAt).toISOString() }
                      : {}),
                    ...(adminReassignDraft.endAt
                      ? { endAt: new Date(adminReassignDraft.endAt).toISOString() }
                      : {}),
                  };
                  reassignAdminTestMutation.mutate({ testId: selectedTestId, payload });
                }}
              >
                {reassignAdminTestMutation.isPending ? "Saving..." : "Reassign"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
