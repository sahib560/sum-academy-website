/**
 * Frontend DOCX utility
 * Parses a .docx File object into the same data shapes produced by
 * parseCsvForPreview() (Quizzes) and parseBulkCsvFile() (Tests).
 *
 * DOCX template format expected:
 *
 * === QUIZ ===
 * Course ID: <id>
 * Subject ID: <id>
 * Chapter ID: <id>        ← only for scope=chapter
 * Scope: chapter
 * Quiz Title: My Quiz
 * Pass Score: 50
 *
 * Q1: What is H₂SO₄?
 * A) Water
 * B) Sulfuric acid ✓      ← mark correct with ✓ or *
 * C) Hydrochloric acid
 * D) Nitric acid
 * Marks: 2
 *
 * === TEST ===
 * Title: Midterm Test
 * Scope: class
 * Class ID: <id>
 * Start At: 2025-06-01T09:00:00
 * End At: 2025-06-01T11:00:00
 * Max Violations: 3
 *
 * Q1: Solve: ∫x dx
 * A) x
 * B) x²/2 ✓
 * C) 2x
 * D) x²
 * Marks: 5
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
  const result = await mammoth.convertToHtml({ arrayBuffer });
  let html = result.value || "";

  // Convert structural HTML elements to newlines
  html = html.replace(/<\/p>/gi, "\n");
  html = html.replace(/<br\s*\/?>/gi, "\n");
  html = html.replace(/<\/tr>/gi, "\n");
  html = html.replace(/<\/td>/gi, "  ");

  // Remove all other HTML tags
  html = html.replace(/<[^>]+>/g, " ");

  // Decode common entities
  html = html.replace(/&nbsp;/gi, " ");
  html = html.replace(/&lt;/gi, "<");
  html = html.replace(/&gt;/gi, ">");
  html = html.replace(/&amp;/gi, "&");

  return html;
}

/**
 * Turns raw extracted DOCX text into { meta, questions }.
 *   meta      — key/value pairs found before the first question
 *   questions — array of { questionText, optionA-D, correctLetter, marks }
 */
function parseDocxBlocks(rawText) {
  // If mammoth misses newlines (e.g. Compatibility Mode DOCX), forcefully reconstruct them
  // by injecting a newline before known structural patterns.
  let healedText = rawText
    .replace(/(Marks?\s*:)/gi, "\n$1")
    .replace(/([A-D]\s*[.)])/g, "\n$1")
    .replace(/(Q\s*\d+\s*[:.])/gi, "\n$1");

  const lines = healedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const meta = {};
  const questions = [];
  let current = null;
  let qLines = [];

  // Regex patterns
  const Q_RE = /^Q\s*\d+\s*[:.]\s*(.*)$/i;
  const OPT_RE = /^([A-D])\s*[.)]\s*(.*)$/i;
  const MARKS_RE = /^[Mm]arks?\s*:\s*(\d+(?:\.\d+)?)$/i;
  const META_RE = /^([^:]{2,40}?)\s*:\s*(.*)$/;

  const flush = () => {
    if (!current) return;
    const questionText = qLines.join(" ").trim();
    if (questionText) questions.push({ ...current, questionText });
    current = null;
    qLines = [];
  };

  for (const line of lines) {
    // New question block
    const qMatch = line.match(Q_RE);
    if (qMatch) {
      flush();
      current = { optionA: "", optionB: "", optionC: "", optionD: "", correctLetter: "", marks: "1" };
      const firstLine = qMatch[1].trim();
      if (firstLine) qLines = [firstLine];
      continue;
    }

    if (!current) {
      // Metadata (before first question)
      const mMatch = line.match(META_RE);
      if (mMatch) meta[normKey(mMatch[1])] = trimText(mMatch[2]);
      continue;
    }

    // Marks line (inside a question)
    const marksMatch = line.match(MARKS_RE);
    if (marksMatch) {
      current.marks = marksMatch[1];
      continue;
    }

    // Option line (inside a question)
    const optMatch = line.match(OPT_RE);
    if (optMatch) {
      const letter = optMatch[1].toUpperCase();
      let text = trimText(optMatch[2]);
      const isCorrect = text.includes("✓") || text.includes("*") || text.includes("√");
      if (isCorrect) {
        text = trimText(text.replace(/[✓*√]/g, ""));
        current.correctLetter = letter; // store the LETTER, not the text
      }
      current[`option${letter}`] = text;
      continue;
    }

    // Multi-line question text continuation
    qLines.push(line);
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
    correctAnswer: q.correctLetter, // letter: A | B | C | D
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

  // Validate only questions
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
    const correct = q.correctLetter; // letter A/B/C/D
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
