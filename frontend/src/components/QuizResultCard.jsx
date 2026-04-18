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
    if (rankValue === 1) return "#FFD700";
    if (rankValue === 2) return "#C0C0C0";
    if (rankValue === 3) return "#CD7F32";
    if (pct <= 0.1) return "#4a63f5";
    if (pct <= 0.25) return "#16a34a";
    return "#64748b";
  };

  const rankColor = getRankColor(rank, total);
  const percentage = Math.round(toNumber(result?.percentage ?? result?.scorePercent, 0));
  const marksScored = toNumber(result?.autoScore ?? result?.score ?? result?.totalScore, 0);
  const totalMarks = toNumber(result?.totalMarks, 0);

  return (
    <div
      style={{
        background: "#0d0f1a",
        borderRadius: "24px",
        padding: "0",
        maxWidth: "520px",
        margin: "0 auto",
        overflow: "hidden",
        border: `1px solid ${isPassed ? "#16a34a33" : "#dc262633"}`,
        boxShadow: `0 0 40px ${
          isPassed ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)"
        }`,
      }}
    >
      <div
        style={{
          background: isPassed
            ? "linear-gradient(135deg, #16a34a22, #16a34a11)"
            : "linear-gradient(135deg, #dc262622, #dc262611)",
          padding: "28px 32px 24px",
          textAlign: "center",
          borderBottom: `1px solid ${isPassed ? "#16a34a22" : "#dc262622"}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-40px",
            right: "-40px",
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            background: isPassed ? "#16a34a" : "#dc2626",
            opacity: 0.06,
          }}
        />

        <div
          style={{
            width: "40px",
            height: "40px",
            background: "#4a63f5",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <span
            style={{
              color: "#fff",
              fontWeight: "800",
              fontSize: "18px",
              fontFamily: "Georgia",
            }}
          >
            S
          </span>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: isPassed ? "rgba(22,163,74,0.15)" : "rgba(220,38,38,0.15)",
            color: isPassed ? "#4ade80" : "#f87171",
            padding: "5px 18px",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: "700",
            border: `1px solid ${isPassed ? "#16a34a44" : "#dc262644"}`,
            marginBottom: "12px",
            letterSpacing: "1px",
          }}
        >
          {isPassed ? "PASSED" : "FAILED"}
        </div>

        <h2
          style={{
            color: "#fff",
            fontSize: "20px",
            fontWeight: "700",
            margin: "0 0 4px",
          }}
        >
          {studentName}
        </h2>
        <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
          {quiz?.title}
        </p>
      </div>

      <div
        style={{
          padding: "28px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "32px",
          borderBottom: "1px solid #1e293b",
        }}
      >
        <div style={{ position: "relative", width: "120px", height: "120px" }}>
          <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="#1e293b" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke={isPassed ? "#16a34a" : "#dc2626"}
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={`${2 * Math.PI * 52 * (1 - percentage / 100)}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1.5s ease" }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#fff", fontSize: "26px", fontWeight: "800", lineHeight: 1 }}>
              {percentage}%
            </span>
            <span style={{ color: "#64748b", fontSize: "10px", marginTop: "2px" }}>
              SCORE
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[
            {
              label: "Marks",
              value: `${marksScored} / ${totalMarks}`,
              color: "#fff",
            },
            {
              label: "Pass Mark",
              value: `${toNumber(quiz?.passScore, 70)}%`,
              color: "#64748b",
            },
            {
              label: "Time Limit",
              value: quiz?.timeLimit ? `${quiz.timeLimit} mins` : "-",
              color: "#64748b",
            },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: "left" }}>
              <div
                style={{
                  color: "#475569",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {label}
              </div>
              <div style={{ color, fontSize: "16px", fontWeight: "700" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 32px", borderBottom: "1px solid #1e293b" }}>
        <p
          style={{
            color: "#475569",
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "16px",
            textAlign: "center",
          }}
        >
          Your Ranking
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "24px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: `${rankColor}22`,
                border: `3px solid ${rankColor}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 8px",
              }}
            >
              <span style={{ color: rankColor, fontSize: "24px", fontWeight: "800", lineHeight: 1 }}>
                {rank}
              </span>
              <span style={{ color: rankColor, fontSize: "11px", fontWeight: "600" }}>
                {getRankSuffix(rank)}
              </span>
            </div>
            <span style={{ color: "#64748b", fontSize: "11px" }}>Your Rank</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { label: "Total Students", value: total, color: "#94a3b8" },
              { label: "Top Score", value: `${Math.round(toNumber(result?.topScore, 0))}%`, color: "#4a63f5" },
              { label: "Class Average", value: `${Math.round(toNumber(result?.avgScore, 0))}%`, color: "#ff6f0f" },
              { label: "Passed", value: toNumber(result?.passingCount, 0), color: "#16a34a" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#475569", fontSize: "11px", minWidth: "90px" }}>
                  {label}:
                </span>
                <span style={{ color, fontSize: "12px", fontWeight: "700" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "10px",
              color: "#475569",
              marginBottom: "6px",
            }}
          >
            <span>Rank #{rank}</span>
            <span>of {total} students</span>
          </div>
          <div style={{ height: "6px", background: "#1e293b", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: "3px",
                background: rankColor,
                width: `${100 - ((rank - 1) / Math.max(total - 1, 1)) * 100}%`,
                transition: "width 1s ease",
              }}
            />
          </div>
        </div>
      </div>

      {toNumber(result?.shortAnswerPending, 0) > 0 ? (
        <div
          style={{
            margin: "16px 20px 0",
            background: "rgba(255,111,15,0.08)",
            border: "1px solid #ff6f0f33",
            borderRadius: "12px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#ff6f0f",
              animation: "pulse 1.5s infinite",
            }}
          />
          <p style={{ color: "#ff6f0f", fontSize: "12px", margin: 0 }}>
            {toNumber(result?.shortAnswerPending, 0)} short answer(s) pending teacher review. Score may increase.
          </p>
        </div>
      ) : null}

      <style>{`
        @keyframes pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
