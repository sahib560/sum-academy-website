import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "../../components/Skeleton.jsx";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const quizData = {
  title: "Genetics Quiz",
  course: "Biology Masterclass XI",
  duration: 25 * 60,
  passScore: 60,
  questions: [
    {
      id: 1,
      type: "mcq",
      question: "What is the basic unit of heredity?",
      options: ["Chromosome", "Gene", "Protein", "Nucleus"],
      answer: 1,
    },
    {
      id: 2,
      type: "truefalse",
      question: "DNA is a double-stranded molecule.",
      answer: true,
    },
    {
      id: 3,
      type: "short",
      question: "Define phenotype in one sentence.",
      answer: "Observable characteristics of an organism",
    },
    {
      id: 4,
      type: "mcq",
      question: "Which base pairs with Adenine in DNA?",
      options: ["Uracil", "Thymine", "Cytosine", "Guanine"],
      answer: 1,
    },
    {
      id: 5,
      type: "mcq",
      question: "Mendel is known for work on?",
      options: ["Evolution", "Inheritance", "DNA structure", "Natural selection"],
      answer: 1,
    },
    {
      id: 6,
      type: "truefalse",
      question: "RNA contains Thymine.",
      answer: false,
    },
    {
      id: 7,
      type: "mcq",
      question: "Which is a dominant trait?",
      options: ["Recessive allele", "Dominant allele", "Mutation", "Hybrid"],
      answer: 1,
    },
    {
      id: 8,
      type: "short",
      question: "What is genotype?",
      answer: "Genetic makeup of an organism",
    },
    {
      id: 9,
      type: "mcq",
      question: "The process of DNA copying is called?",
      options: ["Transcription", "Replication", "Translation", "Mutation"],
      answer: 1,
    },
    {
      id: 10,
      type: "truefalse",
      question: "Phenotype is influenced by environment.",
      answer: true,
    },
  ],
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

function StudentQuizAttempt() {
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [timeLeft, setTimeLeft] = useState(quizData.duration);
  const [showWarning, setShowWarning] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [scoreDisplay, setScoreDisplay] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading || submitted) return undefined;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit(true);
          return 0;
        }
        if (prev === 121) {
          setShowWarning(true);
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, submitted]);

  const currentQuestion = quizData.questions[currentIndex];

  const answeredCount = useMemo(
    () =>
      quizData.questions.filter((q) => {
        const value = answers[q.id];
        if (q.type === "short") return Boolean(value?.trim());
        return value !== undefined;
      }).length,
    [answers]
  );

  const unansweredCount = quizData.questions.length - answeredCount;

  const score = useMemo(() => {
    let correct = 0;
    let skipped = 0;
    let wrong = 0;
    quizData.questions.forEach((q) => {
      const value = answers[q.id];
      if (value === undefined || (q.type === "short" && !value?.trim())) {
        skipped += 1;
        return;
      }
      if (q.type === "mcq" && value === q.answer) correct += 1;
      else if (q.type === "truefalse" && value === q.answer) correct += 1;
      else if (
        q.type === "short" &&
        value.trim().toLowerCase() === q.answer.trim().toLowerCase()
      )
        correct += 1;
      else wrong += 1;
    });
    const percent = Math.round((correct / quizData.questions.length) * 100);
    return { correct, wrong, skipped, percent };
  }, [answers]);

  useEffect(() => {
    if (!submitted) return;
    let start = 0;
    const target = score.percent;
    const interval = setInterval(() => {
      start += 2;
      if (start >= target) {
        setScoreDisplay(target);
        clearInterval(interval);
      } else {
        setScoreDisplay(start);
      }
    }, 20);
    return () => clearInterval(interval);
  }, [submitted, score.percent]);

  const handleSubmit = (auto = false) => {
    if (submitted) return;
    setSubmitted(true);
    setShowSubmit(false);
    if (auto) {
      setTimeLeft(0);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-xl">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-8 border-primary/20">
              <div
                className="absolute inset-0 rounded-full border-8 border-primary"
                style={{ clipPath: `inset(${100 - scoreDisplay}% 0 0 0)` }}
              />
              <span className="text-2xl font-semibold text-slate-900">
                {scoreDisplay}%
              </span>
            </div>
            <span
              className={`rounded-full px-4 py-1 text-sm font-semibold ${
                score.percent >= quizData.passScore
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-rose-50 text-rose-600"
              }`}
            >
              {score.percent >= quizData.passScore ? "Pass" : "Fail"}
            </span>
            <div className="mt-4 grid w-full grid-cols-3 gap-4 text-sm">
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-slate-500">Correct</p>
                <p className="text-lg font-semibold text-slate-900">
                  {score.correct}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-slate-500">Wrong</p>
                <p className="text-lg font-semibold text-slate-900">
                  {score.wrong}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-slate-500">Skipped</p>
                <p className="text-lg font-semibold text-slate-900">
                  {score.skipped}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                className="btn-outline"
                onClick={() => setShowReview((prev) => !prev)}
              >
                {showReview ? "Hide Review" : "Review Answers"}
              </button>
              <a className="btn-primary" href="/student/quizzes">
                Back to Quizzes
              </a>
            </div>
          </div>
          {showReview && (
            <div className="mt-6 space-y-4">
              {quizData.questions.map((q, index) => {
                const given = answers[q.id];
                const isCorrect =
                  (q.type === "mcq" && given === q.answer) ||
                  (q.type === "truefalse" && given === q.answer) ||
                  (q.type === "short" &&
                    given?.trim().toLowerCase() ===
                      q.answer.trim().toLowerCase());
                return (
                  <div
                    key={q.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"
                  >
                    <p className="font-semibold text-slate-900">
                      Q{index + 1}. {q.question}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Your answer:{" "}
                      <span className={isCorrect ? "text-emerald-600" : "text-rose-500"}>
                        {given === undefined ? "Not answered" : String(given)}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Correct answer: {String(q.answer)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      {loading ? (
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      ) : (
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl text-slate-900">
                {quizData.title}
              </h1>
              <p className="text-sm text-slate-500">{quizData.course}</p>
            </div>
            <div className="flex items-center gap-4">
              <div
                className={`text-lg font-semibold ${
                  timeLeft <= 300 ? "text-rose-500" : "text-slate-700"
                }`}
              >
                {formatTime(timeLeft)}
              </div>
              <div className="text-sm text-slate-500">
                Question {currentIndex + 1} of {quizData.questions.length}
              </div>
              <button
                className="btn-outline"
                onClick={() => setShowExit(true)}
              >
                Exit
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_240px]">
            <div className="flex justify-center">
              <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                  Question {currentIndex + 1}
                </span>
                <h2 className="mt-4 text-xl text-slate-900">
                  {currentQuestion.question}
                </h2>
                <div className="mt-4 space-y-3">
                  {currentQuestion.type === "mcq" &&
                    currentQuestion.options.map((option, idx) => (
                      <button
                        key={option}
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm ${
                          answers[currentQuestion.id] === idx
                            ? "border-primary bg-primary/5"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                        onClick={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [currentQuestion.id]: idx,
                          }))
                        }
                      >
                        <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px]">
                          {answers[currentQuestion.id] === idx ? "●" : ""}
                        </span>
                        {option}
                      </button>
                    ))}
                  {currentQuestion.type === "truefalse" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                          answers[currentQuestion.id] === true
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-emerald-200 text-emerald-600"
                        }`}
                        onClick={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [currentQuestion.id]: true,
                          }))
                        }
                      >
                        True
                      </button>
                      <button
                        className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                          answers[currentQuestion.id] === false
                            ? "border-rose-500 bg-rose-500 text-white"
                            : "border-rose-200 text-rose-600"
                        }`}
                        onClick={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [currentQuestion.id]: false,
                          }))
                        }
                      >
                        False
                      </button>
                    </div>
                  )}
                  {currentQuestion.type === "short" && (
                    <textarea
                      className="w-full rounded-2xl border border-slate-200 p-3 text-sm"
                      placeholder="Type your answer here..."
                      rows={4}
                      value={answers[currentQuestion.id] || ""}
                      onChange={(event) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [currentQuestion.id]: event.target.value,
                        }))
                      }
                    />
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <button
                    className="btn-outline"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
                  >
                    Previous
                  </button>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500"
                    onClick={() =>
                      setFlagged((prev) => ({
                        ...prev,
                        [currentQuestion.id]: !prev[currentQuestion.id],
                      }))
                    }
                  >
                    {flagged[currentQuestion.id] ? "Unflag" : "Flag"} for review
                  </button>
                  <button
                    className="btn-primary"
                    disabled={currentIndex === quizData.questions.length - 1}
                    onClick={() =>
                      setCurrentIndex((prev) =>
                        Math.min(prev + 1, quizData.questions.length - 1)
                      )
                    }
                  >
                    Next
                  </button>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {quizData.questions.map((q, idx) => {
                    const isAnswered = answers[q.id] !== undefined;
                    const isFlagged = flagged[q.id];
                    const isCurrent = idx === currentIndex;
                    const color = isCurrent
                      ? "bg-emerald-500"
                      : isFlagged
                        ? "bg-amber-400"
                        : isAnswered
                          ? "bg-blue-500"
                          : "bg-slate-300";
                    return (
                      <button
                        key={q.id}
                        className={`h-3 w-3 rounded-full ${color}`}
                        onClick={() => setCurrentIndex(idx)}
                        aria-label={`Go to question ${idx + 1}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="font-heading text-lg text-slate-900">
                  Question Overview
                </h3>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {quizData.questions.map((q, idx) => {
                    const isAnswered = answers[q.id] !== undefined;
                    const isFlagged = flagged[q.id];
                    const isCurrent = idx === currentIndex;
                    const color = isCurrent
                      ? "bg-emerald-500 text-white"
                      : isFlagged
                        ? "bg-amber-400 text-white"
                        : isAnswered
                          ? "bg-blue-500 text-white"
                          : "bg-slate-200 text-slate-600";
                    return (
                      <button
                        key={q.id}
                        className={`h-9 w-9 rounded-full text-xs font-semibold ${color}`}
                        onClick={() => setCurrentIndex(idx)}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4">
                  <button
                    className="btn-primary w-full"
                    disabled={unansweredCount > 0}
                    onClick={() => setShowSubmit(true)}
                  >
                    Submit Quiz
                  </button>
                  {unansweredCount > 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      {unansweredCount} questions unanswered
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl"
          >
            <h3 className="font-heading text-xl text-slate-900">
              2 minutes left
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Please submit your quiz before time runs out.
            </p>
            <button className="btn-primary mt-4" onClick={() => setShowWarning(false)}>
              Continue
            </button>
          </motion.div>
        </div>
      )}

      {showExit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl"
          >
            <h3 className="font-heading text-xl text-slate-900">
              Exit quiz?
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Your progress will be lost.
            </p>
            <div className="mt-4 flex gap-3">
              <button className="btn-outline flex-1" onClick={() => setShowExit(false)}>
                Stay
              </button>
              <a className="btn-primary flex-1" href="/student/quizzes">
                Exit
              </a>
            </div>
          </motion.div>
        </div>
      )}

      {showSubmit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl"
          >
            <h3 className="font-heading text-xl text-slate-900">
              Submit quiz?
            </h3>
            {unansweredCount > 0 && (
              <p className="mt-2 text-sm text-amber-600">
                {unansweredCount} questions unanswered
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <button className="btn-outline flex-1" onClick={() => setShowSubmit(false)}>
                Cancel
              </button>
              <button className="btn-primary flex-1" onClick={() => handleSubmit()}>
                Confirm Submit
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default StudentQuizAttempt;
