import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SkeletonTeacherCard } from "../components/Skeleton.jsx";
import { FaRegUserCircle, FaStar } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { useSiteSettings } from "../context/SiteSettingsContext.jsx";
import { getPublicTeachers } from "../services/student.service.js";
const NOT_ADDED = "Not added yet";
const textOrNotAdded = (value) => {
  const cleaned = String(value || "").trim();
  return cleaned || NOT_ADDED;
};

const isDefaultFounderPlaceholder = (teacher = {}) => {
  const name = String(teacher?.name || "").trim().toLowerCase();
  const role = String(teacher?.role || teacher?.title || "")
    .trim()
    .toLowerCase();
  const subject = String(teacher?.subject || "").trim();
  const courses = String(teacher?.courses || "").trim();
  const bio = String(teacher?.bio || teacher?.description || "").trim();

  return (
    name === "sum founder" &&
    role === "founder & ceo" &&
    !subject &&
    !courses &&
    !bio
  );
};

function StarRating({ rating }) {
  const safeRating = Number.isFinite(Number(rating)) ? Number(rating) : 0;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <FaStar
          key={`teacher-rating-${index}`}
          className={`h-4 w-4 ${
            index < Math.round(safeRating) ? "text-accent" : "text-slate-300"
          }`}
          aria-hidden="true"
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
        {safeRating > 0 ? safeRating.toFixed(1) : NOT_ADDED}
      </span>
    </div>
  );
}

function TeacherCard({ teacher, onSelect }) {
  const initials = textOrNotAdded(teacher.name)
    .split(" ")
    .slice(0, 2)
    .map((word) => word?.[0] || "")
    .join("");

  return (
    <div className="glass-card card-hover flex h-full flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-base font-semibold text-white shadow-lg shadow-primary/30">
          {initials}
        </div>
        <div>
          <h3 className="font-heading text-xl text-slate-900 dark:text-white">
            {textOrNotAdded(teacher.name)}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {textOrNotAdded(teacher.subject)}
          </p>
        </div>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-200">
        {textOrNotAdded(teacher.bio)}
      </p>
      <div className="mt-auto flex items-center justify-between">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary dark:bg-primary/20">
          {teacher.courses}
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
  const { settings, loading } = useSiteSettings();
  const siteName = textOrNotAdded(settings.general?.siteName);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const teachersQuery = useQuery({
    queryKey: ["public-teachers-page"],
    queryFn: getPublicTeachers,
    staleTime: 60000,
  });

  const fallbackRows = (Array.isArray(settings.about?.team) ? settings.about.team : []).filter(
    (teacher) => !isDefaultFounderPlaceholder(teacher)
  );

  const teachers = useMemo(() => {
    const apiRows = Array.isArray(teachersQuery.data) ? teachersQuery.data : [];
    if (apiRows.length > 0) {
      return apiRows.map((teacher, index) => ({
        id: teacher.id || teacher.uid || `teacher-${index}`,
        name: textOrNotAdded(teacher.fullName || teacher.name),
        subject: textOrNotAdded(
          teacher.subject ||
            (Array.isArray(teacher.subjects) ? teacher.subjects[0] : "")
        ),
        title: textOrNotAdded(teacher.title || teacher.role),
        role: textOrNotAdded(teacher.role || "Teacher"),
        bio: textOrNotAdded(teacher.bio || teacher.description),
        courses: textOrNotAdded(
          Number.isFinite(Number(teacher.subjectsCount ?? teacher.coursesCount))
            ? `${Number(teacher.subjectsCount ?? teacher.coursesCount)} Subjects`
            : teacher.courses
        ),
        rating: Number(teacher.rating) || 0,
      }));
    }

    return fallbackRows.map((teacher, index) => ({
      id: teacher.id || `teacher-${index}`,
      name: textOrNotAdded(teacher.name),
      subject: textOrNotAdded(teacher.subject),
      title: textOrNotAdded(teacher.title || teacher.role),
      role: textOrNotAdded(teacher.role),
      bio: textOrNotAdded(teacher.bio || teacher.description),
      courses: textOrNotAdded(
        Number.isFinite(Number(teacher.courses))
          ? `${Number(teacher.courses)} Courses`
          : teacher.courses
      ),
      rating: Number(teacher.rating) || 0,
    }));
  }, [fallbackRows, teachersQuery.data]);

  const isLoading = loading || teachersQuery.isLoading;

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
          <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-2xl shadow-slate-200/50 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/40">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">
              {siteName}
            </p>
            <h1 className="font-heading text-4xl text-slate-900 dark:text-white">
              {textOrNotAdded(settings.about?.teamHeading || "Teachers")}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-200">
              {textOrNotAdded(settings.about?.story)}
            </p>
          </div>
        </div>
      </section>

      <section className="section pt-0">
        <div className="mx-auto max-w-7xl">
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonTeacherCard
                  key={`teacher-skeleton-${index}`}
                  className="h-full rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-lg shadow-slate-200/40 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/40"
                />
              ))}
            </div>
          ) : teachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center dark:border-white/10 dark:bg-slate-900/70">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FaRegUserCircle className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-heading text-2xl text-slate-900 dark:text-white">
                {NOT_ADDED}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                {NOT_ADDED}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {teachers.map((teacher) => (
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
                  {textOrNotAdded(selectedTeacher.name)
                    .split(" ")
                    .slice(0, 2)
                    .map((word) => word?.[0] || "")
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
                <IoClose className="h-5 w-5" />
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
                  {Number(selectedTeacher.rating) > 0
                    ? Number(selectedTeacher.rating).toFixed(1)
                    : NOT_ADDED}
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
