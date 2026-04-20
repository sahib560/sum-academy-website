import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getStudentTests } from "../../services/student.service.js";

const badgeClass = {
  active: "bg-emerald-50 text-emerald-700",
  scheduled: "bg-amber-50 text-amber-700",
  ended: "bg-slate-100 text-slate-600",
};

const prettyDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
};

function StudentTests() {
  const testsQuery = useQuery({
    queryKey: ["student-tests"],
    queryFn: getStudentTests,
    staleTime: 30000,
    refetchInterval: false,
  });

  const tests = Array.isArray(testsQuery.data) ? testsQuery.data : [];

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-heading text-3xl text-slate-900">Tests</h1>
        <p className="mt-1 text-sm text-slate-500">
          Attempt scheduled tests and view ranking after submission.
        </p>
      </section>

      <section className="space-y-3">
        {testsQuery.isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Loading tests...
          </div>
        ) : tests.length < 1 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            No tests available right now.
          </div>
        ) : (
          tests.map((test) => {
            const status = String(test.status || "scheduled").toLowerCase();
            const badge = badgeClass[status] || badgeClass.scheduled;
            const showMarks = test.hasSubmittedAttempt;
            const attempt = test.attempt || null;
            const obtainedMarks =
              attempt?.score ?? attempt?.obtainedMarks ?? test.obtainedMarks ?? null;
            const totalMarks = attempt?.totalMarks || test.totalMarks || 0;
            const percentage = attempt?.percentage ?? test.percentage ?? null;
            return (
              <article
                key={test.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-lg text-slate-900">{test.title}</h3>
                    <p className="text-sm text-slate-500">
                      {test.className || "Entire Center"} | {test.questionsCount || 0} questions |{" "}
                      {test.totalMarks || 0} marks
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {prettyDate(test.startAt)} to {prettyDate(test.endAt)}
                    </p>
                    {showMarks ? (
                      <p className="mt-1 text-xs font-semibold text-primary">
                        Result: {obtainedMarks ?? 0}/{totalMarks} ({percentage ?? 0}%)
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge}`}>
                      {status}
                    </span>
                    <Link
                      className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white"
                      to={`/student/tests/${test.id}/attempt`}
                    >
                      {test.hasSubmittedAttempt
                        ? "View Result"
                        : test.inProgress
                          ? "Resume Test"
                          : "Start Test"}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

export default StudentTests;
