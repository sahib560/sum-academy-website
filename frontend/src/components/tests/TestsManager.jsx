import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

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
  const [form, setForm] = useState({
    title: "",
    description: "",
    scope: "class",
    classId: "",
    startAt: "",
    endAt: "",
    durationMinutes: 60,
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
        maxViolations: 3,
        questions: [defaultQuestion()],
      });
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

  const downloadTemplate = async () => {
    try {
      if (!downloadTestTemplate) {
        toast.error("Template download is not available");
        return;
      }
      const { blob, filename } = await downloadTestTemplate();
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
      durationMinutes: Number(form.durationMinutes || 60),
      maxViolations: Number(form.maxViolations || 3),
      questions: form.questions.map((q) => ({
        questionText: q.questionText,
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
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Download Template
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setBulkErrors([]);
                setBulkFile(file);
              }}
              className="text-sm"
            />
            <button
              type="button"
              disabled={!bulkFile || bulkMutation.isPending}
              onClick={() => {
                if (!bulkFile) return;
                if (!bulkFile.name.toLowerCase().endsWith(".csv")) {
                  toast.error("Please select a .csv file");
                  return;
                }
                bulkMutation.mutate(bulkFile);
              }}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkMutation.isPending ? "Uploading..." : "Upload CSV"}
            </button>
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
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    questions: p.questions.map((q, i) =>
                      i === idx ? { ...q, questionText: e.target.value } : q
                    ),
                  }))
                }
              />
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
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                onClick={() => setSelectedTestId("")}
              >
                Close
              </button>
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
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-800">Questions</p>
                  <div className="space-y-2">
                    {(selected.questions || []).map((q, index) => (
                      <div key={q.questionId || index} className="rounded-xl border border-slate-200 p-3">
                        <p className="text-sm font-medium text-slate-800">
                          {index + 1}. {q.questionText}
                        </p>
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
    </div>
  );
}
