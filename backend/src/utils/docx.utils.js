import mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun } from "docx";

export const extractDocxText = async (buffer) => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value; // The raw text
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

    // Question start (e.g., Q1:, Q:, Question 1:)
    if (/^q\d*:|^question\s*\d*:/i.test(lowerLine)) {
      if (currentQuestion) {
        rows.push({ ...globals, ...currentQuestion });
      }
      currentQuestion = {
        questionText: line.substring(line.indexOf(":") + 1).trim(),
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctAnswer: "",
        marks: "1"
      };
      continue;
    }

    if (currentQuestion) {
      if (lowerLine.startsWith("marks:")) {
        currentQuestion.marks = line.substring(line.indexOf(":") + 1).trim();
      } else if (/^a\)/i.test(line)) {
        currentQuestion.optionA = line.substring(2).replace(/✓|\*/g, "").trim();
        if (line.includes("✓") || line.includes("*")) currentQuestion.correctAnswer = "A";
      } else if (/^b\)/i.test(line)) {
        currentQuestion.optionB = line.substring(2).replace(/✓|\*/g, "").trim();
        if (line.includes("✓") || line.includes("*")) currentQuestion.correctAnswer = "B";
      } else if (/^c\)/i.test(line)) {
        currentQuestion.optionC = line.substring(2).replace(/✓|\*/g, "").trim();
        if (line.includes("✓") || line.includes("*")) currentQuestion.correctAnswer = "C";
      } else if (/^d\)/i.test(line)) {
        currentQuestion.optionD = line.substring(2).replace(/✓|\*/g, "").trim();
        if (line.includes("✓") || line.includes("*")) currentQuestion.correctAnswer = "D";
      } else if (lowerLine.startsWith("correct answer:")) {
        currentQuestion.correctAnswer = line.substring(line.indexOf(":") + 1).trim().toUpperCase();
      } else {
        // Multi-line question text if options haven't started yet
        if (!currentQuestion.optionA) {
          currentQuestion.questionText += "\n" + line;
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
    addLine("# Do NOT change the Class ID or Scope.", false, "FF0000");
    addLine("# Provide Start At and End At in standard date/time format (e.g. 2026-06-01T10:00:00Z).", false, "FF0000");
    addLine("# To mark correct answers, put a ✓ or * at the end of the option text.", false, "FF0000");
    addEmpty();

    addLine(`Scope: ${data.scope || "class"}`);
    addLine(`Class ID: ${data.classId || ""}`);
    addLine(`Test Title: ${data.title || "Biology Test 1"}`);
    addLine(`Description: ${data.description || "Weekly test"}`);
    addLine(`Start At: ${data.startAt || new Date().toISOString()}`);
    addLine(`End At: ${data.endAt || new Date().toISOString()}`);
    addLine(`Duration Minutes: ${data.durationMinutes || 60}`);
    addLine(`Max Violations: ${data.maxViolations || 3}`);
    addEmpty();

    addLine("Q1: The human heart has how many chambers?", true);
    addLine("Marks: 1");
    addLine("A) 2");
    addLine("B) 3");
    addLine("C) 4 ✓");
    addLine("D) 5");
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return await Packer.toBuffer(doc);
};
