import mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun } from "docx";

/**
 * Extract clean plain text from a DOCX buffer.
 * Uses convertToHtml so paragraph boundaries are preserved even in
 * Compatibility Mode or two-column DOCX files.
 */
export const extractDocxText = async (buffer) => {
  try {
    const result = await mammoth.convertToHtml({ buffer });
    let html = result.value || "";

    // Convert block-level close tags → newlines BEFORE stripping
    html = html.replace(/<\/(p|li|tr|h[1-6])>/gi, "\n");
    html = html.replace(/<br\s*\/?>/gi, "\n");
    html = html.replace(/<\/td>/gi, "  ");

    // Strip remaining tags
    html = html.replace(/<[^>]+>/g, "");

    // Decode HTML entities
    html = html
      .replace(/&nbsp;/gi, " ")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");

    // Re-inject newlines before structural markers (handles collapsed lines)
    html = html.replace(/([^\n])(Q\s*\d+\s*[:.]\s)/gi, "$1\n$2");
    html = html.replace(/^(Q\s*\d+\s*[:.]\s)/i, "\n$1");
    html = html.replace(/([^\n])(Marks?\s*:)/gi, "$1\n$2");
    html = html.replace(/([^\n])([A-D]\s*[.)])/g, "$1\n$2");

    return html;
  } catch (error) {
    console.error("mammoth extraction error:", error);
    throw new Error("Failed to extract text from DOCX file");
  }
};

export const parseQuizOrTestDocxText = (text) => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const rows = [];
  
  const globals = {
    courseId: "",
    subjectId: "",
    chapterId: "",
    classId: "",
    scope: "",
    quizTitle: "",
    testTitle: "",
    description: "",
    startAt: "",
    endAt: "",
    durationMinutes: "",
    maxViolations: "",
    passScore: "",
  };

  let currentQuestion = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Check for globals (ignore comments)
    if (lowerLine.startsWith("#")) continue;

    if (lowerLine.startsWith("course id:") || lowerLine.startsWith("courseid:")) {
      globals.courseId = line.substring(line.indexOf(":") + 1).trim();
      continue;
    }
    if (lowerLine.startsWith("subject id:") || lowerLine.startsWith("subjectid:")) {
      globals.subjectId = line.substring(line.indexOf(":") + 1).trim();
      continue;
    }
    if (lowerLine.startsWith("chapter id:") || lowerLine.startsWith("chapterid:")) {
      globals.chapterId = line.substring(line.indexOf(":") + 1).trim();
      continue;
    }
    if (lowerLine.startsWith("class id:") || lowerLine.startsWith("classid:")) {
      globals.classId = line.substring(line.indexOf(":") + 1).trim();
      continue;
    }
    if (lowerLine.startsWith("scope:")) {
      globals.scope = line.substring(line.indexOf(":") + 1).trim();
      continue;
    }
    if (lowerLine.startsWith("quiz title:")) {
      globals.quizTitle = line.substring(line.indexOf(":") + 1).trim();
      if (!globals.testTitle) globals.testTitle = globals.quizTitle;
      continue;
    }
    if (lowerLine.startsWith("test title:") || lowerLine.startsWith("title:")) {
      globals.testTitle = line.substring(line.indexOf(":") + 1).trim();
      if (!globals.quizTitle) globals.quizTitle = globals.testTitle;
      continue;
    }
    if (lowerLine.startsWith("description:")) {
      globals.description = line.substring(line.indexOf(":") + 1).trim();
      continue;
    }
    if (lowerLine.startsWith("pass score:") || lowerLine.startsWith("passscore:")) {
      globals.passScore = line.substring(line.indexOf(":") + 1).trim();
      continue;
    }
    if (lowerLine.startsWith("start at:") || lowerLine.startsWith("startat:")) {
      globals.startAt = line.substring(line.indexOf(":") + 1).trim();
      continue;
    }
    if (lowerLine.startsWith("end at:") || lowerLine.startsWith("endat:")) {
      globals.endAt = line.substring(line.indexOf(":") + 1).trim();
      continue;
    }
    if (lowerLine.startsWith("duration minutes:")) {
      globals.durationMinutes = line.substring(line.indexOf(":") + 1).trim();
      continue;
    }
    if (lowerLine.startsWith("max violations:") || lowerLine.startsWith("maxviolations:")) {
      globals.maxViolations = line.substring(line.indexOf(":") + 1).trim();
      continue;
    }

    // Question start — Q1: / Q10: (must have at least one digit to avoid false matches on "Question:" metadata)
    if (/^q\s*\d+\s*[:.]/i.test(line)) {
      if (currentQuestion) {
        rows.push({ ...globals, ...currentQuestion });
      }
      const colonIdx = line.indexOf(":");
      const dotIdx   = line.indexOf(".");
      const sepIdx   = (colonIdx > 0 && dotIdx > 0) ? Math.min(colonIdx, dotIdx) : Math.max(colonIdx, dotIdx);
      currentQuestion = {
        questionText: sepIdx >= 0 ? line.substring(sepIdx + 1).trim() : "",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctAnswer: "",
        marks: "1",
      };
      continue;
    }

    if (currentQuestion) {
      if (lowerLine.startsWith("marks:")) {
        currentQuestion.marks = line.substring(line.indexOf(":") + 1).trim();
      } else if (/^a\s*[.)]/i.test(line)) {
        const text = line.replace(/^a\s*[.)]\s*/i, "");
        const isCorrect = /[✓*√]/.test(text);
        currentQuestion.optionA = text.replace(/[✓*√]/g, "").trim();
        if (isCorrect) currentQuestion.correctAnswer = "A";
      } else if (/^b\s*[.)]/i.test(line)) {
        const text = line.replace(/^b\s*[.)]\s*/i, "");
        const isCorrect = /[✓*√]/.test(text);
        currentQuestion.optionB = text.replace(/[✓*√]/g, "").trim();
        if (isCorrect) currentQuestion.correctAnswer = "B";
      } else if (/^c\s*[.)]/i.test(line)) {
        const text = line.replace(/^c\s*[.)]\s*/i, "");
        const isCorrect = /[✓*√]/.test(text);
        currentQuestion.optionC = text.replace(/[✓*√]/g, "").trim();
        if (isCorrect) currentQuestion.correctAnswer = "C";
      } else if (/^d\s*[.)]/i.test(line)) {
        const text = line.replace(/^d\s*[.)]\s*/i, "");
        const isCorrect = /[✓*√]/.test(text);
        currentQuestion.optionD = text.replace(/[✓*√]/g, "").trim();
        if (isCorrect) currentQuestion.correctAnswer = "D";
      } else if (lowerLine.startsWith("correct answer:")) {
        currentQuestion.correctAnswer = line.substring(line.indexOf(":") + 1).trim().toUpperCase();
      } else {
        // Multi-line question text if options haven't started yet
        if (!currentQuestion.optionA) {
          currentQuestion.questionText += " " + line;
        }
      }
    }
  }

  if (currentQuestion) {
    rows.push({ ...globals, ...currentQuestion });
  }

  const formattedRows = rows.map((row, index) => ({
    __row: index + 1,
    courseid: row.courseId,
    subjectid: row.subjectId,
    chapterid: row.chapterId,
    classid: row.classId,
    scope: row.scope,
    quiztitle: row.quizTitle,
    title: row.testTitle,
    description: row.description,
    startat: row.startAt,
    endat: row.endAt,
    durationminutes: row.durationMinutes,
    maxviolations: row.maxViolations,
    passscore: row.passScore,
    questiontext: row.questionText,
    optiona: row.optionA,
    optionb: row.optionB,
    optionc: row.optionC,
    optiond: row.optionD,
    correctanswer: row.correctAnswer,
    marks: row.marks
  }));

  const headers = [
    "courseid", "subjectid", "chapterid", "classid", "scope",
    "quiztitle", "title", "description", "startat", "endat",
    "durationminutes", "maxviolations", "passscore", "questiontext",
    "optiona", "optionb", "optionc", "optiond", "correctanswer", "marks"
  ];

  return { headers, rows: formattedRows };
};

export const generateDocxTemplate = async (type, data = {}) => {
  const children = [];

  const addLine = (text, bold = false, color = "000000") => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text, bold, color, size: 24 })],
      })
    );
  };

  const addEmpty = () => children.push(new Paragraph({}));

  if (type === "quiz") {
    addLine("# INSTRUCTIONS:", true, "FF0000");
    addLine("# Do NOT change the ID fields below.", false, "FF0000");
    addLine("# To mark correct answers, put a ✓ or * at the end of the option text.", false, "FF0000");
    addLine("# Format: Q1:, A), B), C), D), Marks:", false, "FF0000");
    addEmpty();

    addLine(`Course ID: ${data.courseId || ""}`);
    addLine(`Subject ID: ${data.subjectId || ""}`);
    addLine(`Chapter ID: ${data.chapterId || ""}`);
    addLine(`Scope: ${data.scope || ""}`);
    addLine(`Quiz Title: ${data.title || "Chapter 1 Quiz"}`);
    addLine(`Pass Score: 50`);
    addEmpty();

    addLine("Q1: What is the formula of Sulfuric Acid?", true);
    addLine("Marks: 1");
    addLine("A) H₂O");
    addLine("B) H₂SO₄ ✓");
    addLine("C) HCl");
    addLine("D) NaCl");
    addEmpty();

    addLine("Q2: Which planet is known as the Red Planet?", true);
    addLine("Marks: 1");
    addLine("A) Venus");
    addLine("B) Jupiter");
    addLine("C) Mars ✓");
    addLine("D) Saturn");

  } else if (type === "test") {
    addLine("# INSTRUCTIONS:", true, "FF0000");
    addLine("# To mark correct answers, put a ✓, *, or √ at the end of the option text.", false, "FF0000");
    addEmpty();

    addLine("Q1: The human heart has how many chambers?", true);
    addLine("Marks: 1");
    addLine("A) 2");
    addLine("B) 3");
    addLine("C) 4 ✓");
    addLine("D) 5");
    addEmpty();

    addLine("Q2: What is the chemical symbol for Gold?", true);
    addLine("Marks: 1");
    addLine("A) Ag");
    addLine("B) Au ✓");
    addLine("C) Pb");
    addLine("D) Fe");
    addEmpty();

    addLine("Q3: Which planet is known as the Red Planet?", true);
    addLine("Marks: 1");
    addLine("A) Venus");
    addLine("B) Jupiter");
    addLine("C) Mars ✓");
    addLine("D) Saturn");
    addEmpty();

    addLine("Q4: What is the powerhouse of the cell?", true);
    addLine("Marks: 1");
    addLine("A) Nucleus");
    addLine("B) Mitochondria ✓");
    addLine("C) Ribosome");
    addLine("D) Golgi apparatus");
    addEmpty();

    addLine("Q5: What is the hardest natural substance on Earth?", true);
    addLine("Marks: 1");
    addLine("A) Gold");
    addLine("B) Iron");
    addLine("C) Diamond ✓");
    addLine("D) Platinum");
    addEmpty();

    addLine("Q6: How many continents are there on Earth?", true);
    addLine("Marks: 1");
    addLine("A) 5");
    addLine("B) 6");
    addLine("C) 7 ✓");
    addLine("D) 8");
    addEmpty();

    addLine("Q7: What is the freezing point of water in Celsius?", true);
    addLine("Marks: 1");
    addLine("A) 0 ✓");
    addLine("B) 32");
    addLine("C) 100");
    addLine("D) -10");
    addEmpty();

    addLine("Q8: Which gas do plants primarily absorb?", true);
    addLine("Marks: 1");
    addLine("A) Oxygen");
    addLine("B) Nitrogen");
    addLine("C) Carbon Dioxide ✓");
    addLine("D) Hydrogen");
    addEmpty();

    addLine("Q9: What is the largest mammal in the world?", true);
    addLine("Marks: 1");
    addLine("A) Elephant");
    addLine("B) Blue Whale ✓");
    addLine("C) Giraffe");
    addLine("D) Great White Shark");
    addEmpty();

    addLine("Q10: Who wrote 'Romeo and Juliet'?", true);
    addLine("Marks: 1");
    addLine("A) Charles Dickens");
    addLine("B) Mark Twain");
    addLine("C) William Shakespeare ✓");
    addLine("D) Jane Austen");
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return await Packer.toBuffer(doc);
};
