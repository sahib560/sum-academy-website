import React from "react";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default function QuizResultCard({ result, quiz, studentName }) {
  const isPassed = Boolean(result?.isPassed);
  const rank = toNumber(result?.rank, 0) || 1;
  const total =
    toNumber(result?.totalAttempts ?? result?.totalStudents, 0) || 1;

  const getRankSuffix = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  const getRankColor = (rankValue, totalValue) => {
    const pct = rankValue / Math.max(totalValue, 1);
    if (rankValue === 1) return "#f59e0b"; // Gold/Amber
    if (rankValue === 2) return "#94a3b8"; // Silver
    if (rankValue === 3) return "#b45309"; // Bronze
    if (pct <= 0.1) return "#4f46e5"; // Indigo
    if (pct <= 0.25) return "#10b981"; // Emerald
    return "#64748b"; // Slate
  };

  const rankColor = getRankColor(rank, total);
  const percentage = Math.round(toNumber(result?.percentage ?? result?.scorePercent, 0));
  const marksScored = toNumber(result?.autoScore ?? result?.score ?? result?.totalScore, 0);
  const totalMarks = toNumber(result?.totalMarks, 0);

  return (
    <div
      className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl transition-all"
      style={{ maxWidth: "560px", margin: "0 auto" }}
    >
      <div
        className={`px-10 py-8 text-center border-b relative overflow-hidden ${
          isPassed ? "bg-emerald-50/50 border-emerald-100" : "bg-rose-50/50 border-rose-100"
        }`}
      >
        <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10 ${isPassed ? "bg-emerald-500" : "bg-rose-500"}`} />
        
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/20 text-white font-bold text-xl">
          {(() => {
            const name = String(studentName || "S");
            const letter = (name.includes("@") && !name.includes(" ")) ? name.split("@")[0][0] : name[0];
            return String(letter || "S").toUpperCase();
          })()}
        </div>

        <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] border mb-4 ${
          isPassed ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-rose-100 text-rose-700 border-rose-200"
        }`}>
          {isPassed ? "PASSED" : "FAILED"}
        </div>

        <h2 className="text-2xl font-black text-slate-900">{studentName}</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">{quiz?.title}</p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/30">
        <div className="flex items-center justify-center p-8 gap-6">
          <div className="relative h-24 w-24">
            <svg width="96" height="96" className="-rotate-90">
              <circle cx="48" cy="48" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke={isPassed ? "#10b981" : "#f43f5e"}
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - percentage / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-slate-900 leading-none">{percentage}%</span>
              <span className="mt-1 text-[8px] font-black tracking-widest text-slate-400 uppercase">Score</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center p-8 space-y-4">
          {[
            { label: "Marks Scored", value: `${marksScored} / ${totalMarks}`, color: "text-slate-900" },
            { label: "Pass Target", value: `${toNumber(quiz?.passScore, 70)}%`, color: "text-slate-500" },
            { label: "Duration", value: quiz?.timeLimit ? `${quiz.timeLimit}m` : "-", color: "text-slate-500" },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
              <p className={`text-sm font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Performance Rank</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-900">#{rank}</span>
              <span className="text-sm font-bold text-slate-500">out of {total}</span>
            </div>
          </div>
          <div 
            className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 shadow-inner"
            style={{ borderColor: `${rankColor}33`, backgroundColor: `${rankColor}11` }}
          >
            <span className="text-2xl font-black" style={{ color: rankColor }}>{rank}</span>
          </div>
        </div>

        <div className="space-y-4 bg-slate-50 rounded-2xl p-6 border border-slate-100">
          {[
            { label: "Top Percentile", value: `${Math.round(toNumber(result?.topScore, 0))}%`, color: "text-indigo-600", bg: "bg-indigo-100/50" },
            { label: "Class Average", value: `${Math.round(toNumber(result?.avgScore, 0))}%`, color: "text-amber-600", bg: "bg-amber-100/50" },
            { label: "Total Passed", value: toNumber(result?.passingCount, 0), color: "text-emerald-600", bg: "bg-emerald-100/50" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">{label}</span>
              <span className={`rounded-lg px-2 py-1 text-xs font-black ${bg} ${color}`}>{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            <span>Rank Position</span>
            <span>{100 - Math.round(((rank - 1) / Math.max(total - 1, 1)) * 100)}th Percentile</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
              style={{ 
                backgroundColor: rankColor, 
                width: `${Math.max(5, 100 - ((rank - 1) / Math.max(total - 1, 1)) * 100)}%` 
              }}
            />
          </div>
        </div>

        {toNumber(result?.shortAnswerPending, 0) > 0 && (
          <div className="mt-8 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-200 text-amber-700">
               <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
               </svg>
            </div>
            <p className="text-xs font-bold text-amber-800">
              {result.shortAnswerPending} answer(s) pending review. Score may improve.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
