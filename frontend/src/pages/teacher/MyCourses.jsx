import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "react-hot-toast";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { SkeletonCard } from "../../components/Skeleton.jsx";
import {
  addChapter,
  addLecture,
  deleteChapter,
  deleteLecture,
  deleteLectureContent,
  getCourseStudents,
  getTeacherCourseById,
  getTeacherCourses,
  saveLectureContent,
  updateLecture,
  updateVideoAccess,
} from "../../services/teacher.service.js";
import { storage } from "../../config/firebase.js";

const Motion = motion;
const QUERY_STALE_TIME = 30000;
const STATUS_TABS = ["all", "published", "draft"];
const VIDEO_TYPES = ["video/mp4", "video/x-msvideo", "video/quicktime"];
const PDF_TYPES = ["application/pdf"];
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024;
const MAX_PDF_SIZE = 50 * 1024 * 1024;

const formatNumber = (value) => Number(value || 0).toLocaleString("en-US");
const normalizeStatus = (value) => String(value || "draft").toLowerCase();
const toOrder = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatFileSize = (bytes) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / 1024).toFixed(2)} KB`;
};

const STATUS_STYLES = {
  published: "bg-emerald-50 text-emerald-700",
  draft: "bg-amber-50 text-amber-700",
  archived: "bg-slate-100 text-slate-600",
};

const uploadToStorage = (file, path, onProgress, onTask) =>
  new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file);
    if (typeof onTask === "function") onTask(task);

    task.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (typeof onProgress === "function") onProgress(progress);
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({ url, size: file.size, name: file.name });
      }
    );
  });

function StatusBadge({ status }) {
  const normalized = normalizeStatus(status);
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[normalized] || STATUS_STYLES.draft}`}>
      {normalized.charAt(0).toUpperCase() + normalized.slice(1)}
    </span>
  );
}

function MyCourses() {
  const queryClient = useQueryClient();

  const [statusTab, setStatusTab] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [contentCourseId, setContentCourseId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [expandedChapters, setExpandedChapters] = useState({});
  const [selectedLectureId, setSelectedLectureId] = useState("");
  const [lectureTitleDraft, setLectureTitleDraft] = useState("");

  const [contentInputModal, setContentInputModal] = useState({ open: false, type: "chapter", chapterId: "", title: "" });
  const [isContentInputSaving, setIsContentInputSaving] = useState(false);
  const [chapterDeleteModal, setChapterDeleteModal] = useState({ open: false, chapterId: "" });

  const [videoUpload, setVideoUpload] = useState({ file: null, progress: 0, uploading: false, stage: "", task: null });
  const [resourceModal, setResourceModal] = useState({ open: false, type: "pdf", lectureId: "" });
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceFile, setResourceFile] = useState(null);
  const [resourceProgress, setResourceProgress] = useState(0);

  const [studentsCourseId, setStudentsCourseId] = useState("");
  const [videoAccessPanel, setVideoAccessPanel] = useState({ open: false, student: null, map: {} });

  const coursesQuery = useQuery({ queryKey: ["teacher-courses"], queryFn: getTeacherCourses, staleTime: QUERY_STALE_TIME });
  const contentQuery = useQuery({
    queryKey: ["teacher-course-detail", contentCourseId],
    queryFn: () => getTeacherCourseById(contentCourseId),
    enabled: Boolean(contentCourseId),
    staleTime: QUERY_STALE_TIME,
  });
  const studentsQuery = useQuery({
    queryKey: ["teacher-course-students", studentsCourseId],
    queryFn: () => getCourseStudents(studentsCourseId),
    enabled: Boolean(studentsCourseId),
    staleTime: QUERY_STALE_TIME,
  });
  const accessCourseQuery = useQuery({
    queryKey: ["teacher-course-access", studentsCourseId],
    queryFn: () => getTeacherCourseById(studentsCourseId),
    enabled: Boolean(studentsCourseId),
    staleTime: QUERY_STALE_TIME,
  });

  const addChapterMutation = useMutation({ mutationFn: ({ courseId, subjectId, data }) => addChapter(courseId, subjectId, data) });
  const deleteChapterMutation = useMutation({ mutationFn: deleteChapter });
  const addLectureMutation = useMutation({ mutationFn: ({ chapterId, data }) => addLecture(chapterId, data) });
  const updateLectureMutation = useMutation({ mutationFn: ({ lectureId, data }) => updateLecture(lectureId, data) });
  const deleteLectureMutation = useMutation({ mutationFn: deleteLecture });
  const saveLectureContentMutation = useMutation({ mutationFn: ({ lectureId, data }) => saveLectureContent(lectureId, data) });
  const deleteLectureContentMutation = useMutation({ mutationFn: ({ lectureId, contentId, type }) => deleteLectureContent(lectureId, contentId, type) });
  const updateVideoAccessMutation = useMutation({ mutationFn: ({ courseId, studentId, data }) => updateVideoAccess(courseId, studentId, data) });

  const isContentBusy = addChapterMutation.isPending || deleteChapterMutation.isPending || addLectureMutation.isPending || updateLectureMutation.isPending || deleteLectureMutation.isPending || saveLectureContentMutation.isPending || deleteLectureContentMutation.isPending || isContentInputSaving;

  const courses = useMemo(() => (Array.isArray(coursesQuery.data) ? coursesQuery.data : []), [coursesQuery.data]);
  const stats = useMemo(() => ({
    assignedCourses: courses.length,
    mySubjects: courses.reduce((sum, course) => sum + (Array.isArray(course.mySubjects) ? course.mySubjects.length : 0), 0),
    totalStudents: courses.reduce((sum, course) => sum + Number(course.enrollmentCount || 0), 0),
  }), [courses]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const filteredCourses = useMemo(() => courses.filter((course) => {
    const status = normalizeStatus(course.status);
    const statusMatch = statusTab === "all" || status === statusTab;
    const searchMatch = !debouncedSearch || String(course.title || "").toLowerCase().includes(debouncedSearch);
    return statusMatch && searchMatch;
  }), [courses, statusTab, debouncedSearch]);

  const contentSubjects = useMemo(() => {
    const rows = Array.isArray(contentQuery.data?.mySubjects) ? contentQuery.data.mySubjects : [];
    return rows.slice().sort((a, b) => toOrder(a.order) - toOrder(b.order));
  }, [contentQuery.data]);

  useEffect(() => {
    if (!contentCourseId || !contentSubjects.length) {
      setSelectedSubjectId("");
      setSelectedLectureId("");
      return;
    }
    if (!contentSubjects.some((subject) => subject.subjectId === selectedSubjectId)) {
      setSelectedSubjectId(contentSubjects[0].subjectId);
      setSelectedLectureId("");
    }
  }, [contentCourseId, contentSubjects, selectedSubjectId]);

  const selectedSubject = useMemo(() => contentSubjects.find((subject) => subject.subjectId === selectedSubjectId) || null, [contentSubjects, selectedSubjectId]);
  const contentChapters = useMemo(() => {
    const rows = Array.isArray(selectedSubject?.chapters) ? selectedSubject.chapters : [];
    return rows.slice().sort((a, b) => toOrder(a.order) - toOrder(b.order));
  }, [selectedSubject]);
  const selectedLecture = useMemo(() => {
    for (const chapter of contentChapters) {
      const lectures = Array.isArray(chapter.lectures) ? chapter.lectures : [];
      const match = lectures.find((lecture) => lecture.lectureId === selectedLectureId);
      if (match) return match;
    }
    return null;
  }, [contentChapters, selectedLectureId]);

  useEffect(() => {
    setLectureTitleDraft(selectedLecture?.title || "");
  }, [selectedLecture?.lectureId, selectedLecture?.title]);

  const accessLectures = useMemo(() => {
    const subjects = Array.isArray(accessCourseQuery.data?.mySubjects) ? accessCourseQuery.data.mySubjects : [];
    return subjects.flatMap((subject) => (Array.isArray(subject.chapters) ? subject.chapters : [])).flatMap((chapter) => (Array.isArray(chapter.lectures) ? chapter.lectures : [])).map((lecture) => ({ id: lecture.lectureId, title: lecture.title }));
  }, [accessCourseQuery.data]);

  const invalidateCourse = async (courseId) => {
    if (!courseId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["teacher-courses"] }),
      queryClient.invalidateQueries({ queryKey: ["teacher-course-detail", courseId] }),
      queryClient.invalidateQueries({ queryKey: ["teacher-course-students", courseId] }),
      queryClient.invalidateQueries({ queryKey: ["teacher-course-access", courseId] }),
    ]);
  };

  const submitContentInputModal = async () => {
    if (isContentBusy) return;
    const title = String(contentInputModal.title || "").trim();
    if (title.length < 3) return toast.error("Title must be at least 3 characters");

    setIsContentInputSaving(true);
    try {
      if (contentInputModal.type === "chapter") {
        await addChapterMutation.mutateAsync({ courseId: contentCourseId, subjectId: selectedSubjectId, data: { title } });
        toast.success(`Chapter added to ${selectedSubject?.subjectName || "subject"}`);
      } else {
        await addLectureMutation.mutateAsync({ chapterId: contentInputModal.chapterId, data: { title } });
        toast.success("Lecture added");
      }
      await invalidateCourse(contentCourseId);
      setContentInputModal({ open: false, type: "chapter", chapterId: "", title: "" });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save");
    } finally {
      setIsContentInputSaving(false);
    }
  };

  const saveLectureTitle = async () => {
    if (!selectedLecture) return;
    const nextTitle = lectureTitleDraft.trim();
    if (nextTitle.length < 3) return toast.error("Lecture title must be at least 3 characters");
    try {
      await updateLectureMutation.mutateAsync({ lectureId: selectedLecture.lectureId, data: { title: nextTitle } });
      await invalidateCourse(contentCourseId);
      toast.success("Lecture updated");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update lecture");
    }
  };

  const startVideoUpload = async () => {
    if (!selectedLecture || !videoUpload.file) return;
    if (!VIDEO_TYPES.includes(videoUpload.file.type)) return toast.error("Only MP4, AVI, MOV allowed");
    if (videoUpload.file.size > MAX_VIDEO_SIZE) return toast.error("File too large. Max 2GB");

    try {
      setVideoUpload((prev) => ({ ...prev, uploading: true, stage: "Uploading..." }));
      const path = `courses/${contentCourseId}/lectures/${selectedLecture.lectureId}/videos/${Date.now()}-${videoUpload.file.name}`;
      const uploaded = await uploadToStorage(videoUpload.file, path, (progress) => setVideoUpload((prev) => ({ ...prev, progress })), (task) => setVideoUpload((prev) => ({ ...prev, task })));
      await saveLectureContentMutation.mutateAsync({ lectureId: selectedLecture.lectureId, data: { type: "video", title: videoUpload.file.name, url: uploaded.url, size: uploaded.size, duration: "" } });
      await invalidateCourse(contentCourseId);
      setVideoUpload({ file: null, progress: 0, uploading: false, stage: "", task: null });
      toast.success("Video uploaded successfully");
    } catch (error) {
      setVideoUpload((prev) => ({ ...prev, uploading: false, stage: "", task: null }));
      toast.error(error?.response?.data?.message || "Failed to upload video");
    }
  };

  const saveResource = async () => {
    if (!resourceModal.lectureId) return;
    if (resourceTitle.trim().length < 3) return toast.error("Content title must be at least 3 characters");
    if (!resourceFile) return toast.error("Select a file");
    if (!PDF_TYPES.includes(resourceFile.type)) return toast.error("Only PDF files are allowed");
    if (resourceFile.size > MAX_PDF_SIZE) return toast.error("File too large. Max 50MB");

    try {
      const folder = resourceModal.type === "pdf" ? "pdfs" : "books";
      const path = `courses/${contentCourseId}/lectures/${resourceModal.lectureId}/${folder}/${Date.now()}-${resourceFile.name}`;
      const uploaded = await uploadToStorage(resourceFile, path, setResourceProgress);
      await saveLectureContentMutation.mutateAsync({ lectureId: resourceModal.lectureId, data: { type: resourceModal.type, title: resourceTitle.trim(), url: uploaded.url, size: uploaded.size } });
      await invalidateCourse(contentCourseId);
      setResourceModal({ open: false, type: "pdf", lectureId: "" });
      setResourceTitle("");
      setResourceFile(null);
      setResourceProgress(0);
      toast.success(resourceModal.type === "pdf" ? "PDF notes added" : "Book added");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save content");
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-left" toastOptions={{ style: { borderRadius: "12px", fontFamily: "DM Sans, sans-serif" } }} />
      <section className="rounded-3xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">Courses are created and managed by Admin. You can add content to your assigned subjects only.</section>
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">You cannot create or delete courses. Contact admin to create a new course.</section>
      <section><h1 className="font-heading text-3xl text-slate-900">My Assigned Courses</h1><p className="text-sm text-slate-500">Courses where you are assigned as subject teacher</p></section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">My Assigned Courses</p><p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(stats.assignedCourses)}</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">My Subjects</p><p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(stats.mySubjects)}</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Total Enrolled Students</p><p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(stats.totalStudents)}</p></div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {STATUS_TABS.map((tab) => <button key={tab} className={`rounded-full px-3 py-2 text-xs font-semibold ${statusTab === tab ? "bg-primary text-white" : "border border-slate-200 text-slate-600"}`} onClick={() => setStatusTab(tab)} disabled={false}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>)}
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by course title..." className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm md:w-80" />
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {coursesQuery.isLoading ? Array.from({ length: 6 }).map((_, idx) => <SkeletonCard key={`s-${idx}`} />) : null}
        {!coursesQuery.isLoading && filteredCourses.length === 0 ? <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No assigned courses found.</div> : null}
        {filteredCourses.map((course) => <div key={course.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="h-40">{course.thumbnail ? <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover" /> : <div className="h-full bg-gradient-to-br from-blue-600 to-indigo-500" />}</div><div className="p-4"><div className="mb-2"><StatusBadge status={course.status} /></div><h3 className="text-lg font-bold text-slate-900">{course.title || "Untitled course"}</h3><span className="mt-2 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{course.category || "General"}</span><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Your Subjects:</p><div className="mt-2 flex flex-wrap gap-2">{(course.mySubjects || []).map((subject) => <span key={`${course.id}-${subject.subjectId}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{subject.subjectName || "Subject"}</span>)}</div><p className="mt-2 text-xs text-slate-500">{formatNumber((course.mySubjects || []).length)} subjects assigned to you</p><p className="mt-3 text-sm text-slate-600">{formatNumber(course.enrollmentCount)} students enrolled</p><div className="mt-4 space-y-2"><button className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={() => setContentCourseId(course.id)} disabled={false}>Manage Content</button><button className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => setStudentsCourseId(course.id)} disabled={false}>View Students</button></div></div></div>)}
      </section>
      <AnimatePresence>
        {contentCourseId ? (
          <div className="fixed inset-0 z-[88]">
            <Motion.button className="absolute inset-0 bg-slate-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setContentCourseId("")} disabled={isContentBusy} />
            <Motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="absolute right-0 top-0 h-full w-full bg-white shadow-2xl lg:max-w-[1080px]">
              <div className="border-b border-slate-200 p-4"><div className="flex items-center justify-between"><div><h2 className="font-heading text-2xl text-slate-900">{contentQuery.data?.courseTitle || "Course"}</h2><div className="mt-2"><StatusBadge status={contentQuery.data?.courseStatus} /></div></div><button className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-600" onClick={() => setContentCourseId("")} disabled={isContentBusy}>Close</button></div><p className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">You can only add content to your assigned subjects.</p><div className="mt-3 flex flex-wrap gap-2">{contentSubjects.map((subject) => <button key={subject.subjectId} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selectedSubjectId === subject.subjectId ? "bg-primary text-white" : "border border-slate-200 text-slate-600"}`} onClick={() => { setSelectedSubjectId(subject.subjectId); setSelectedLectureId(""); }} disabled={isContentBusy}>{subject.subjectName || "Subject"}</button>)}</div></div>
              <div className="grid h-[calc(100%-190px)] min-h-0 lg:grid-cols-[280px_1fr]">
                <aside className="border-r border-slate-200 p-4"><div className="space-y-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>{contentChapters.map((chapter) => <div key={chapter.chapterId} className="rounded-2xl border border-slate-200 p-3"><div className="flex items-center gap-2"><button className="text-slate-500" onClick={() => setExpandedChapters((prev) => ({ ...prev, [chapter.chapterId]: !prev[chapter.chapterId] }))} disabled={isContentBusy}>{expandedChapters[chapter.chapterId] ? "?" : "?"}</button><span className="text-xs font-semibold text-slate-700">{chapter.title}</span><button className="ml-auto text-xs text-rose-600" onClick={() => setChapterDeleteModal({ open: true, chapterId: chapter.chapterId })} disabled={isContentBusy}>Delete</button></div>{expandedChapters[chapter.chapterId] ? <div className="mt-2 space-y-2 pl-4">{(chapter.lectures || []).map((lecture) => <div key={lecture.lectureId} className="flex items-center gap-2"><button className={`flex-1 rounded-xl border px-2 py-1 text-left text-xs ${selectedLectureId === lecture.lectureId ? "border-primary bg-primary/5" : "border-slate-200"}`} onClick={() => setSelectedLectureId(lecture.lectureId)} disabled={isContentBusy}>{lecture.title}</button><button className="text-xs text-rose-600" onClick={() => deleteLectureMutation.mutateAsync(lecture.lectureId).then(() => invalidateCourse(contentCourseId)).then(() => toast.success("Lecture deleted")).catch((error) => toast.error(error?.response?.data?.message || "Failed to delete lecture"))} disabled={isContentBusy}>X</button></div>)}<button className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700" onClick={() => setContentInputModal({ open: true, type: "lecture", chapterId: chapter.chapterId, title: "" })} disabled={isContentBusy}>Add Lecture</button></div> : null}</div>)}</div><button className="mt-3 w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={() => setContentInputModal({ open: true, type: "chapter", chapterId: "", title: "" })} disabled={isContentBusy || !selectedSubjectId}>Add Chapter</button></aside>
                <section className="overflow-y-auto p-5">{!selectedLecture ? <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center text-slate-500">Select a lecture from the left to add content</div> : <div className="space-y-5"><div className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap gap-2"><input value={lectureTitleDraft} onChange={(e) => setLectureTitleDraft(e.target.value)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" /><button className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700" onClick={saveLectureTitle} disabled={isContentBusy}>Save title</button></div></div><div className="rounded-2xl border border-slate-200 p-4"><h3 className="font-heading text-xl text-slate-900">Lecture Video</h3>{!selectedLecture.videoUrl ? <div className="mt-3 space-y-3"><label className="block rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center"><input type="file" className="hidden" accept="video/mp4,video/x-msvideo,video/quicktime" onChange={(e) => setVideoUpload((prev) => ({ ...prev, file: e.target.files?.[0] || null, progress: 0 }))} /><p className="text-sm font-semibold text-slate-700">{videoUpload.file ? videoUpload.file.name : "Select MP4, AVI, or MOV"}</p><p className="text-xs text-slate-500">{videoUpload.file ? formatFileSize(videoUpload.file.size) : "Maximum 2GB"}</p></label><div className="flex gap-2"><button className="btn-primary" onClick={startVideoUpload} disabled={isContentBusy}>Upload Video</button>{videoUpload.uploading ? <button className="btn-outline" onClick={() => { if (videoUpload.task) videoUpload.task.cancel(); setVideoUpload({ file: null, progress: 0, uploading: false, stage: "", task: null }); }} disabled={!videoUpload.uploading}>Cancel</button> : null}</div></div> : <div className="mt-3 rounded-2xl border border-slate-200 p-3"><p className="font-semibold text-slate-800">{selectedLecture.videoTitle || "Lecture video"}</p><p className="text-xs text-slate-500">Duration: {selectedLecture.videoDuration || "-"}</p><div className="mt-3 flex gap-2"><button className="btn-outline" onClick={() => setVideoUpload((prev) => ({ ...prev, file: null }))} disabled={isContentBusy}>Replace Video</button><button className="rounded-full border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-600" onClick={() => deleteLectureContentMutation.mutateAsync({ lectureId: selectedLecture.lectureId, contentId: "video", type: "video" }).then(() => invalidateCourse(contentCourseId)).then(() => toast.success("Content removed")).catch((error) => toast.error(error?.response?.data?.message || "Failed to delete"))} disabled={isContentBusy}>Delete Video</button></div></div>}</div><div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="font-heading text-xl text-slate-900">Lecture Notes (PDF)</h3><button className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700" onClick={() => { setResourceModal({ open: true, type: "pdf", lectureId: selectedLecture.lectureId }); setResourceTitle(""); setResourceFile(null); setResourceProgress(0); }} disabled={isContentBusy}>Add PDF Notes</button></div><div className="mt-3 space-y-2">{(selectedLecture.pdfNotes || []).map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-2 text-sm"><div><p className="font-semibold text-slate-800">{item.title}</p><p className="text-xs text-slate-500">{formatFileSize(item.size)}</p></div><button className="rounded-full border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600" onClick={() => deleteLectureContentMutation.mutateAsync({ lectureId: selectedLecture.lectureId, contentId: item.id, type: "pdf" }).then(() => invalidateCourse(contentCourseId)).then(() => toast.success("Content removed")).catch((error) => toast.error(error?.response?.data?.message || "Failed to delete"))} disabled={isContentBusy}>Delete</button></div>)}</div></div><div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="font-heading text-xl text-slate-900">Books</h3><button className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700" onClick={() => { setResourceModal({ open: true, type: "book", lectureId: selectedLecture.lectureId }); setResourceTitle(""); setResourceFile(null); setResourceProgress(0); }} disabled={isContentBusy}>Add Book</button></div><div className="mt-3 space-y-2">{(selectedLecture.books || []).map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-2 text-sm"><div><p className="font-semibold text-slate-800">{item.title}</p><p className="text-xs text-slate-500">{formatFileSize(item.size)}</p></div><button className="rounded-full border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600" onClick={() => deleteLectureContentMutation.mutateAsync({ lectureId: selectedLecture.lectureId, contentId: item.id, type: "book" }).then(() => invalidateCourse(contentCourseId)).then(() => toast.success("Content removed")).catch((error) => toast.error(error?.response?.data?.message || "Failed to delete"))} disabled={isContentBusy}>Delete</button></div>)}</div></div></div>}</section>
              </div>
            </Motion.div>
          </div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {studentsCourseId ? (
          <div className="fixed inset-0 z-[87]">
            <Motion.button className="absolute inset-0 bg-slate-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setStudentsCourseId(""); setVideoAccessPanel({ open: false, student: null, map: {} }); }} disabled={updateVideoAccessMutation.isPending} />
            <Motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="absolute right-0 top-0 h-full w-full bg-white shadow-2xl lg:max-w-[980px]">
              <div className="h-full overflow-y-auto p-5">
                <p className="mb-3 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">You can only manage access for lectures in your assigned subjects.</p>
                <div className="mb-4 flex items-center justify-between"><h2 className="font-heading text-3xl text-slate-900">Course Students</h2><button className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-600" onClick={() => setStudentsCourseId("")} disabled={updateVideoAccessMutation.isPending}>Close</button></div>
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Progress</th><th className="px-4 py-3">Completed</th><th className="px-4 py-3">Video Access</th></tr></thead><tbody>{studentsQuery.isLoading ? <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Loading students...</td></tr> : (studentsQuery.data || []).map((student) => <tr key={student.studentId} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold text-slate-800">{student.fullName}</td><td className="px-4 py-3 text-slate-600">{student.email || "-"}</td><td className="px-4 py-3">{Math.round(Number(student.progress || 0))}%</td><td className="px-4 py-3">{student.completedAt ? "Completed" : "-"}</td><td className="px-4 py-3"><button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700" onClick={() => { const map = {}; accessLectures.forEach((lecture) => { map[lecture.id] = false; }); setVideoAccessPanel({ open: true, student, map }); }} disabled={updateVideoAccessMutation.isPending}>Video Access</button></td></tr>)}</tbody></table>
                </div>
                {videoAccessPanel.open && videoAccessPanel.student ? <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-heading text-2xl text-slate-900">{videoAccessPanel.student.fullName}</h3><div className="mt-3 space-y-2">{accessLectures.map((lecture) => <div key={lecture.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"><span className="text-sm font-semibold text-slate-800">{lecture.title}</span><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={Boolean(videoAccessPanel.map[lecture.id])} onChange={(e) => setVideoAccessPanel((prev) => ({ ...prev, map: { ...prev.map, [lecture.id]: e.target.checked } }))} />{videoAccessPanel.map[lecture.id] ? "Unlocked" : "Locked"}</label></div>)}</div><button className="btn-primary mt-4" onClick={async () => { try { for (const [lectureId, hasAccess] of Object.entries(videoAccessPanel.map)) { await updateVideoAccessMutation.mutateAsync({ courseId: studentsCourseId, studentId: videoAccessPanel.student.studentId, data: { lectureId, hasAccess } }); } toast.success("Student access updated"); setVideoAccessPanel({ open: false, student: null, map: {} }); } catch (error) { toast.error(error?.response?.data?.message || "Failed to update access"); } }} disabled={updateVideoAccessMutation.isPending}>{updateVideoAccessMutation.isPending ? "Saving..." : "Save Changes"}</button></div> : null}
              </div>
            </Motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>{contentInputModal.open ? <div className="fixed inset-0 z-[89] flex items-center justify-center px-4"><Motion.button type="button" className="absolute inset-0 bg-slate-900/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setContentInputModal({ open: false, type: "chapter", chapterId: "", title: "" })} disabled={isContentBusy} /><Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative z-[1] w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h3 className="font-heading text-2xl text-slate-900">{contentInputModal.type === "chapter" ? "Add Chapter" : "Add Lecture"}</h3><input value={contentInputModal.title} onChange={(e) => setContentInputModal((prev) => ({ ...prev, title: e.target.value }))} className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm" /><div className="mt-6 flex justify-end gap-2"><button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600" onClick={() => setContentInputModal({ open: false, type: "chapter", chapterId: "", title: "" })} disabled={isContentBusy}>Cancel</button><button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={submitContentInputModal} disabled={isContentBusy}>{isContentBusy ? "Saving..." : "Save"}</button></div></Motion.div></div> : null}</AnimatePresence>
      <AnimatePresence>{chapterDeleteModal.open ? <div className="fixed inset-0 z-[89] flex items-center justify-center px-4"><Motion.button type="button" className="absolute inset-0 bg-slate-900/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setChapterDeleteModal({ open: false, chapterId: "" })} disabled={deleteChapterMutation.isPending} /><Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative z-[1] w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h3 className="font-heading text-2xl text-slate-900">Delete Chapter</h3><p className="mt-2 text-sm text-slate-600">Delete this chapter and its lectures? This action cannot be undone.</p><div className="mt-6 flex justify-end gap-2"><button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600" onClick={() => setChapterDeleteModal({ open: false, chapterId: "" })} disabled={deleteChapterMutation.isPending}>Cancel</button><button className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => deleteChapterMutation.mutateAsync(chapterDeleteModal.chapterId).then(() => invalidateCourse(contentCourseId)).then(() => toast.success("Chapter deleted")).finally(() => setChapterDeleteModal({ open: false, chapterId: "" }))} disabled={deleteChapterMutation.isPending}>{deleteChapterMutation.isPending ? "Deleting..." : "Delete"}</button></div></Motion.div></div> : null}</AnimatePresence>
      <AnimatePresence>{resourceModal.open ? <div className="fixed inset-0 z-[90] flex items-center justify-center px-4"><Motion.button type="button" className="absolute inset-0 bg-slate-900/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setResourceModal({ open: false, type: "pdf", lectureId: "" })} disabled={saveLectureContentMutation.isPending} /><Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative z-[1] w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><h3 className="font-heading text-2xl text-slate-900">{resourceModal.type === "pdf" ? "Add PDF Notes" : "Add Book"}</h3><input value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)} className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm" placeholder="Title" /><label className="mt-4 block rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center"><input type="file" className="hidden" accept="application/pdf" onChange={(e) => setResourceFile(e.target.files?.[0] || null)} /><p className="text-sm font-semibold text-slate-700">{resourceFile ? resourceFile.name : "Select PDF file"}</p></label><div className="mt-4 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-primary" style={{ width: `${resourceProgress}%` }} /></div><div className="mt-6 flex justify-end gap-2"><button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600" onClick={() => setResourceModal({ open: false, type: "pdf", lectureId: "" })} disabled={saveLectureContentMutation.isPending}>Cancel</button><button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={saveResource} disabled={saveLectureContentMutation.isPending}>{saveLectureContentMutation.isPending ? "Saving..." : "Save"}</button></div></Motion.div></div> : null}</AnimatePresence>
    </div>
  );
}

export default MyCourses;
