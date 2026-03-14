import { useEffect, useState } from "react";
import { SkeletonTeacherCard } from "../components/Skeleton.jsx";

const teacherData = [
  {
    id: 1,
    name: "Mr. Sikander Ali Qureshi",
    subject: "Chemistry",
    title: "Founder & Director of Academy",
    role: "Associate Professor of Chemistry",
    bio: "Leading the academy with a focus on conceptual clarity and exam success.",
    courses: 12,
    rating: 4.9,
  },
  {
    id: 2,
    name: "Mr. Shah Mohammad Pathan",
    subject: "Botany",
    title: "Senior Faculty",
    role: "Associate Professor of Botany",
    bio: "Specialized in Botany with a student-first learning approach.",
    courses: 10,
    rating: 4.8,
  },
  {
    id: 3,
    name: "Mr. Mansoor Ahmed Mangi",
    subject: "Chemistry",
    title: "Senior Faculty",
    role: "Lecturer Chemistry",
    bio: "Focused on practical techniques and board exam preparation.",
    courses: 9,
    rating: 4.7,
  },
  {
    id: 4,
    name: "Mr. Muhammad Idress Mahar",
    subject: "Physics",
    title: "Senior Faculty",
    role: "Lecturer Physics",
    bio: "Known for breaking down complex physics topics into simple steps.",
    courses: 8,
    rating: 4.8,
  },
  {
    id: 5,
    name: "Mr. Waseem Ahmed Soomro",
    subject: "English",
    title: "Senior Faculty",
    role: "Lecturer English",
    bio: "Improving language fluency and exam writing skills for students.",
    courses: 7,
    rating: 4.7,
  },
];

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <svg
          key={`teacher-rating-${index}`}
          viewBox="0 0 24 24"
          className={`h-4 w-4 ${
            index < Math.round(rating) ? "text-accent" : "text-slate-300"
          }`}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 3.4l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.7l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3.4z" />
        </svg>
      ))}
      <span className="ml-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

function TeacherCard({ teacher, onSelect }) {
  const initials = teacher.name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("");

  return (
    <div className="glass-card card-hover flex h-full flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-base font-semibold text-white shadow-lg shadow-primary/30">
          {initials}
        </div>
        <div>
          <h3 className="font-heading text-xl text-slate-900 dark:text-white">
            {teacher.name}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {teacher.subject}
          </p>
        </div>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-200">
        {teacher.bio}
      </p>
      <div className="mt-auto flex items-center justify-between">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary dark:bg-primary/20">
          {teacher.courses} Courses
        </span>
        <StarRating rating={teacher.rating} />
      </div>
      <button
        type="button"
        className="btn-outline mt-2 w-full"
        onClick={() => onSelect(teacher)}
      >
        View Profile
      </button>
    </div>
  );
}

function Teachers() {
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedTeacher) return;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setSelectedTeacher(null);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.body.classList.add("overflow-hidden");
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.classList.remove("overflow-hidden");
    };
  }, [selectedTeacher]);

  return (
    <main className="pt-24">
      <section className="section">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-2xl shadow-slate-200/50 backdrop-blur dark:border-white/10 dark:bg-dark/70 dark:shadow-black/40">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">
              SUM Academy
            </p>
            <h1 className="font-heading text-4xl text-slate-900 dark:text-white">
              Meet Our Expert Teachers
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-200">
              Learn from experienced Pakistani educators who guide students with
              clarity, structure, and care.
            </p>
          </div>
        </div>
      </section>

      <section className="section pt-0">
        <div className="mx-auto max-w-7xl">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonTeacherCard
                  key={`teacher-skeleton-${index}`}
                  className="h-full rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-lg shadow-slate-200/40 dark:border-white/10 dark:bg-white/5 dark:shadow-black/40"
                />
              ))}
            </div>
          ) : teacherData.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center dark:border-white/10 dark:bg-dark/70">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
                  <path d="M12 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm-6 8a6 6 0 1 1 12 0H6z" />
                </svg>
              </div>
              <h3 className="mt-4 font-heading text-2xl text-slate-900 dark:text-white">
                No teachers available
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                Please check back soon for updated faculty profiles.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {teacherData.map((teacher) => (
                <TeacherCard
                  key={teacher.id}
                  teacher={teacher}
                  onSelect={setSelectedTeacher}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedTeacher && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSelectedTeacher(null)}
            aria-label="Close teacher details"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-2xl rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl shadow-slate-200/60 dark:border-white/10 dark:bg-dark dark:shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-base font-semibold text-white shadow-lg shadow-primary/30">
                  {selectedTeacher.name
                    .split(" ")
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    {selectedTeacher.subject}
                  </p>
                  <h3 className="mt-2 font-heading text-2xl text-slate-900 dark:text-white">
                    {selectedTeacher.name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTeacher(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
                aria-label="Close"
              >
                x
              </button>
            </div>
            <div className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-200 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Position
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {selectedTeacher.title}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Role
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {selectedTeacher.role}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Courses
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {selectedTeacher.courses}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Rating
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {selectedTeacher.rating.toFixed(1)}
                </p>
              </div>
            </div>
            <p className="mt-6 text-sm text-slate-600 dark:text-slate-200">
              {selectedTeacher.bio}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

export default Teachers;
