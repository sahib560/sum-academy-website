import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "../../components/Skeleton.jsx";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const lectureData = {
  course: "Biology Masterclass XI",
  lecture: "Human Physiology Overview",
  teacher: "Mr. Sikander Ali Qureshi",
  description:
    "In this lecture we cover the core physiology systems and common exam traps. Review the summary notes before the quiz.",
  notes: [
    { id: 1, name: "Physiology Outline.pdf", size: "1.4 MB", downloadable: true },
    { id: 2, name: "Lecture Slides.pdf", size: "2.1 MB", downloadable: false },
  ],
  resources: [
    { id: 1, label: "NCERT Chapter 10", link: "#" },
    { id: 2, label: "Supplementary Quiz", link: "#" },
  ],
};

const chapters = [
  {
    id: 1,
    title: "Cells & Genetics",
    total: 4,
    completed: 3,
    lectures: [
      { id: 1, title: "Cell Structure", duration: "12m", done: true },
      { id: 2, title: "DNA Basics", duration: "10m", done: true },
      { id: 3, title: "Genetic Variation", duration: "15m", done: false },
      { id: 4, title: "Chromosomes", duration: "13m", done: false },
    ],
  },
  {
    id: 2,
    title: "Physiology",
    total: 3,
    completed: 1,
    lectures: [
      { id: 5, title: "Human Physiology Overview", duration: "18m", done: false },
      { id: 6, title: "Circulatory System", duration: "20m", done: false, locked: true },
      { id: 7, title: "Respiration", duration: "16m", done: false, locked: true },
    ],
  },
];

function StudentCoursePlayer() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Overview");
  const [toast, setToast] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const overallProgress = useMemo(() => 62, []);

  return (
    <div className="space-y-6">
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2.2fr_1fr]">
          <motion.section {...fadeUp} className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl bg-black">
              <div className="aspect-video w-full bg-black" />
              {locked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/80 text-white">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
                    <path d="M6 10V8a6 6 0 1 1 12 0v2h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h1zm2 0h8V8a4 4 0 1 0-8 0v2z" />
                  </svg>
                  <p className="text-sm font-semibold">This video is locked</p>
                  <p className="text-xs text-slate-200">
                    Your teacher will unlock this for rewatch
                  </p>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    {lectureData.course}
                  </p>
                  <h2 className="font-heading text-2xl text-slate-900">
                    {lectureData.lecture}
                  </h2>
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {lectureData.teacher
                        .split(" ")
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")}
                    </span>
                    {lectureData.teacher}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {["Overview", "Notes", "Resources"].map((tab) => (
                    <button
                      key={tab}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        activeTab === tab
                          ? "bg-primary text-white"
                          : "border border-slate-200 text-slate-600"
                      }`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === "Overview" && (
                <div className="mt-4 text-sm text-slate-500">
                  <p>{lectureData.description}</p>
                  <button className="btn-outline mt-3">Bookmark Timestamp</button>
                </div>
              )}

              {activeTab === "Notes" && (
                <div className="mt-4 space-y-3">
                  {lectureData.notes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-slate-700">{note.name}</p>
                        <p className="text-xs text-slate-400">{note.size}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                          View
                        </button>
                        {note.downloadable && (
                          <button className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                            Download
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "Resources" && (
                <div className="mt-4 space-y-2 text-sm text-slate-500">
                  {lectureData.resources.map((res) => (
                    <a key={res.id} href={res.link} className="block text-primary">
                      {res.label}
                    </a>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <button className="btn-outline">← Previous Lecture</button>
                <button
                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() =>
                    setToast({ type: "success", message: "Lecture completed! Keep going 🎉" })
                  }
                >
                  Mark as Complete
                </button>
                <button className="btn-outline">Next Lecture →</button>
              </div>
            </div>
          </motion.section>

          <motion.aside {...fadeUp} className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-heading text-xl text-slate-900">Course Content</h3>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <div className="h-2 w-32 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
                {overallProgress}%
              </div>
              <div className="mt-4 space-y-3">
                {chapters.map((chapter) => (
                  <details
                    key={chapter.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                      {chapter.title} · {chapter.completed}/{chapter.total}
                    </summary>
                    <div className="mt-3 space-y-2 text-xs text-slate-500">
                      {chapter.lectures.map((lecture) => (
                        <div
                          key={lecture.id}
                          className="flex items-center justify-between rounded-xl bg-white px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                lecture.title === lectureData.lecture
                                  ? "bg-primary"
                                  : "bg-slate-300"
                              }`}
                            />
                            <span className="text-slate-600">{lecture.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">
                              {lecture.duration}
                            </span>
                            {lecture.done && (
                              <span className="text-emerald-500">✓</span>
                            )}
                            {lecture.locked && <span className="text-slate-300">🔒</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </motion.aside>
        </div>
      )}

      <button
        className="fixed bottom-6 right-6 z-20 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white lg:hidden"
        onClick={() => setShowDrawer(true)}
      >
        Course Content
      </button>

      {showDrawer && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setShowDrawer(false)}
            aria-label="Close drawer"
          />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg text-slate-900">
                Course Content
              </h3>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                onClick={() => setShowDrawer(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {chapters.map((chapter) => (
                <details
                  key={chapter.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                >
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                    {chapter.title} · {chapter.completed}/{chapter.total}
                  </summary>
                  <div className="mt-3 space-y-2 text-xs text-slate-500">
                    {chapter.lectures.map((lecture) => (
                      <div
                        key={lecture.id}
                        className="flex items-center justify-between rounded-xl bg-white px-3 py-2"
                      >
                        <span className="text-slate-600">{lecture.title}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">
                          {lecture.duration}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed right-6 top-6 z-[70] rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default StudentCoursePlayer;
