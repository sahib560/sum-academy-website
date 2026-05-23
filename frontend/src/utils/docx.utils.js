/**
 * Frontend DOCX utility
 * Parses a .docx File object into the same data shapes produced by
 * parseCsvForPreview() (Quizzes) and parseBulkCsvFile() (Tests).
 *
 * Supported question format (any of these work):
 *
 * Q1: What is H₂SO₄?
 * Marks: 2
 * A) Water
 * B) Sulfuric acid ✓    ← mark correct with ✓ , * , or √
 * C) Hydrochloric acid
 * D) Nitric acid
 */

import * as mammoth from "mammoth";
import { parseFormula, stripFormulaHtml } from "./parseFormula.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

const trimText = (v) => String(v ?? "").trim();

/**
 * Normalise a metadata key: lower-case, strip spaces/underscores/hyphens.
 * "Course ID" → "courseid", "Max Violations" → "maxviolations", etc.
 */
const normKey = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, "");

// ─── core: extract text then parse into blocks ────────────────────────────────

async function extractTextFromDocxFile(file) {
  const arrayBuffer = await file.arrayBuffer();

  // convertToHtml preserves paragraph boundaries as </p> tags
  const result = await mammoth.convertToHtml({ arrayBuffer });
  let html = result.value || "";

  // Step 1: Convert block-level close tags → newlines BEFORE stripping tags
  html = html.replace(/<\/(p|li|tr|h[1-6])>/gi, "\n");
  html = html.replace(/<br\s*\/?>/gi, "\n");
  html = html.replace(/<\/td>/gi, "  ");

  // Step 2: Strip all remaining HTML tags
  html = html.replace(/<[^>]+>/g, "");

  // Step 3: Decode common HTML entities
  html = html
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return html;
}

/**
 * Split raw text into { meta, questions }.
 *
 * This is format-agnostic: it works whether the document had proper
 * paragraph breaks (template) or everything collapsed onto one line
 * (Compatibility Mode / manually typed / two-column layout).
 */
function parseDocxBlocks(rawText) {
  // Safety: strip any stray HTML tags
  let text = rawText.replace(/<[^>]+>/g, "");

  // ── Aggressively re-inject newlines before every structural marker ────────
  // We avoid \b because after stripping tags the boundary chars may differ.
  // Strategy: if the marker is NOT already at the start of a line, add \n before it.

  // Q1: / Q2: / Q10:  (must have at least one digit)
  text = text.replace(/([^\n])(Q\s*\d+\s*[:.]\s)/gi, "$1\n$2");
  // Start-of-string case
  text = text.replace(/^(Q\s*\d+\s*[:.]\s)/i, "\n$1");

  // Marks:
  text = text.replace(/([^\n])(Marks?\s*:)/gi, "$1\n$2");

  // A) B) C) D)  or  A. B. C. D.
  // Only inject when preceded by a non-newline (handles mid-line collapse)
  text = text.replace(/([^\n])(\s[A-D]\s*[.)])/g, "$1\n$2");
  // Also catch A) at start of line or after newline already done (idempotent)
  text = text.replace(/([^\n])([A-D]\s*[.)])/g, "$1\n$2");

  // ── Split into clean lines ────────────────────────────────────────────────
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // ── Parse line-by-line ────────────────────────────────────────────────────
  const meta = {};
  const questions = [];
  let current = null;
  let qLines = [];

  // Q1:  Q10:  — requires at least one digit after Q
  const Q_RE     = /^Q\s*(\d+)\s*[:.]\s*(.*)/i;
  // A) B) C) D)  /  A. B. C. D.
  const OPT_RE   = /^([A-D])\s*[.)]\s*(.*)/i;
  // Marks: 1  (non-strict end so trailing spaces don't break it)
  const MARKS_RE = /^Marks?\s*:\s*(\d+(?:\.\d+)?)/i;
  // Generic key: value  (for metadata lines before first question)
  const META_RE  = /^([^:]{2,40}?)\s*:\s*(.*)/;

  const flush = () => {
    if (!current) return;
    const questionText = qLines.join(" ").trim();
    if (questionText) questions.push({ ...current, questionText });
    current = null;
    qLines = [];
  };

  for (const line of lines) {
    // Skip comment / instruction lines
    if (line.startsWith("#")) continue;

    // ── new question block ─────────────────────────────────────────────────
    const qMatch = line.match(Q_RE);
    if (qMatch) {
      flush();
      current = {
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctLetter: "",
        marks: "1",
      };
      const firstLine = (qMatch[2] || "").trim();
      qLines = firstLine ? [firstLine] : [];
      continue;
    }

    if (!current) {
      // Metadata line (before first Q)
      const mMatch = line.match(META_RE);
      if (mMatch) meta[normKey(mMatch[1])] = trimText(mMatch[2]);
      continue;
    }

    // ── Marks line ────────────────────────────────────────────────────────
    const marksMatch = line.match(MARKS_RE);
    // Guard: don't confuse "Marks:" with an option like "A) ..."
    if (marksMatch && !line.match(OPT_RE)) {
      current.marks = marksMatch[1];
      continue;
    }

    // ── Option line ───────────────────────────────────────────────────────
    const optMatch = line.match(OPT_RE);
    if (optMatch) {
      const letter = optMatch[1].toUpperCase();
      let text = trimText(optMatch[2]);
      // Detect correct-answer markers: ✓  *  √
      const isCorrect = /[✓*√]/.test(text);
      if (isCorrect) {
        text = trimText(text.replace(/[✓*√]/g, ""));
        current.correctLetter = letter;
      }
      current[`option${letter}`] = text;
      continue;
    }

    // ── continuation of multi-line question text ──────────────────────────
    // Only if options haven't started yet for this question
    if (!current.optionA) {
      qLines.push(line);
    }
  }

  flush();
  return { meta, questions };
}

// ─── QUIZ parser ──────────────────────────────────────────────────────────────
/**
 * Returns the same shape as parseCsvForPreview() in Quizzes.jsx:
 * { rows, rowPreviews, questionCount, commentRowsDetected, globalErrors, isValid }
 */
export async function parseDocxForQuizPreview(file) {
  const rawText = await extractTextFromDocxFile(file);
  const { meta, questions } = parseDocxBlocks(rawText);

  const courseId  = trimText(meta["courseid"]  || "");
  const subjectId = trimText(meta["subjectid"] || "");
  const chapterId = trimText(meta["chapterid"] || "");
  const scope     = trimText(meta["scope"]     || "chapter").toLowerCase();
  const quizTitle = trimText(meta["quiztitle"] || meta["title"] || "");
  const passScore = trimText(meta["passscore"] || "50");

  const globalErrors = [];
  if (!courseId)  globalErrors.push("Course ID not found. Add a line: Course ID: <id>");
  if (!subjectId) globalErrors.push("Subject ID not found. Add a line: Subject ID: <id>");
  if (!["chapter", "subject"].includes(scope))
    globalErrors.push("Scope must be 'chapter' or 'subject'. Add a line: Scope: chapter");
  if (!quizTitle) globalErrors.push("Quiz Title not found. Add a line: Quiz Title: <title>");
  if (!Number.isFinite(Number(passScore)) || Number(passScore) <= 0)
    globalErrors.push("Pass Score must be a positive number. Add a line: Pass Score: 50");
  if (questions.length === 0)
    globalErrors.push("No questions found. Use format — Q1: Question text");

  const rows = questions.map((q, idx) => ({
    rowNo: idx + 1,
    courseId,
    subjectId,
    chapterId,
    scope,
    quizTitle,
    passScore,
    questionText: q.questionText,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctAnswer: q.correctLetter,
    marks: q.marks,
    legacyQuestionType: "mcq",
    imageUrl: "",
    imagePath: "",
  }));

  const rowPreviews = rows.map((row) => {
    const rowErrors = [];
    if (!row.questionText) rowErrors.push("Question text is empty");
    if (!row.optionA || !row.optionB) rowErrors.push("At least optionA and optionB are required");
    if (!["A", "B", "C", "D"].includes(row.correctAnswer))
      rowErrors.push("Mark the correct answer with ✓ or * (e.g. B) Sulfuric acid ✓)");
    if (!Number.isFinite(Number(row.marks)) || Number(row.marks) <= 0)
      rowErrors.push("Marks must be a positive number");
    return {
      rowNo: row.rowNo,
      quizTitle: row.quizTitle,
      questionText: row.questionText,
      marks: row.marks,
      correctAnswer: row.correctAnswer,
      errors: rowErrors,
    };
  });

  const hasRowErrors = rowPreviews.some((r) => r.errors.length > 0);
  const isValid = globalErrors.length === 0 && !hasRowErrors && rowPreviews.length > 0;

  return {
    rows,
    rowPreviews,
    questionCount: rowPreviews.length,
    commentRowsDetected: false,
    globalErrors,
    isValid,
  };
}

// ─── TEST parser ──────────────────────────────────────────────────────────────
/**
 * Returns the same shape as parseBulkCsvFile() in TestsManager.jsx:
 * { error, meta, rows }
 */
export async function parseDocxForTestPreview(file) {
  const rawText = await extractTextFromDocxFile(file);
  const { meta, questions } = parseDocxBlocks(rawText);

  const scope         = trimText(meta["scope"] || "").toLowerCase();
  const classId       = trimText(meta["classid"] || "");
  const title         = trimText(meta["title"] || "");
  const description   = trimText(meta["description"] || "");
  const startAt       = trimText(meta["startat"] || meta["startdate"] || "");
  const endAt         = trimText(meta["endat"]   || meta["enddate"]   || "");
  const maxViolations = Number(meta["maxviolations"] || 3);

  if (questions.length === 0)
    return { error: "No questions found. Use format — Q1: Question text", rows: [], meta: null };

  const metaObj = {
    scope,
    classId,
    title,
    description,
    startAt,
    endAt,
    maxViolations: Number.isFinite(maxViolations) ? Math.max(1, maxViolations) : 3,
  };

  const normalized = questions.map((q, idx) => {
    const questionTextRaw = q.questionText;
    const optionA = q.optionA;
    const optionB = q.optionB;
    const optionC = q.optionC;
    const optionD = q.optionD;
    const correct = q.correctLetter;
    const marks = Number.isFinite(Number(q.marks)) ? Math.max(1, Number(q.marks)) : 1;

    const errors = [];
    if (stripFormulaHtml(parseFormula(questionTextRaw)).length < 3)
      errors.push("Question text too short");
    if (!optionA || !optionB || !optionC || !optionD)
      errors.push("All four options A–D are required");
    if (!["A", "B", "C", "D"].includes(correct))
      errors.push("Mark the correct answer with ✓ or * on the option line");

    return {
      rowNo: idx + 1,
      questionTextRaw,
      questionTextHtml: parseFormula(questionTextRaw),
      optionA,
      optionB,
      optionC,
      optionD,
      optionAHtml: parseFormula(optionA),
      optionBHtml: parseFormula(optionB),
      optionCHtml: parseFormula(optionC),
      optionDHtml: parseFormula(optionD),
      correct,
      marks,
      imageUrl: "",
      imagePath: "",
      isValid: errors.length === 0,
      error: errors.join("; "),
    };
  });

  return { error: "", meta: metaObj, rows: normalized };
}
