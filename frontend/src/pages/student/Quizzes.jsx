import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const quizzes = [
  {
    id: 1,
    name: "Genetics Quiz",
    course: "Biology Masterclass XI",
    due: "Mar 17, 2026",
    status: "Upcoming",
  },
  {
    id: 2,
    name: "Organic Chemistry Quiz",
    course: "Chemistry Quick Revision",
    due: "Mar 08, 2026",
    status: "Completed",
  },
  {
    id: 3,
    name: "Physics Numericals",
    course: "Physics Practice Lab",
    due: "Mar 05, 2026",
    status: "Completed",
  },
];

function StudentQuizzes() {
  return (
    <div className="space-y-6">
      <motion.section {...fadeUp}>
        <h1 className="font-heading text-3xl text-slate-900">Quizzes</h1>
        <p className="text-sm text-slate-500">
          Track your upcoming quizzes and results.
        </p>
      </motion.section>

      <motion.section
        {...fadeUp}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {quizzes.map((quiz) => (
          <div
            key={quiz.id}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                quiz.status === "Upcoming"
                  ? "bg-blue-50 text-blue-600"
                  : "bg-emerald-50 text-emerald-600"
              }`}
            >
              {quiz.status}
            </span>
            <h3 className="mt-4 font-heading text-lg text-slate-900">
              {quiz.name}
            </h3>
            <p className="text-sm text-slate-500">{quiz.course}</p>
            <p className="mt-2 text-xs text-slate-500">Due {quiz.due}</p>
            <button className="btn-primary mt-4 w-full">
              {quiz.status === "Upcoming" ? "Start Quiz" : "View Results"}
            </button>
          </div>
        ))}
      </motion.section>
    </div>
  );
}

export default StudentQuizzes;
