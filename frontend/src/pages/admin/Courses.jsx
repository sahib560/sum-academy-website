import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "react-hot-toast";
import { FiX } from "react-icons/fi";
import {
  addCourseContent,
  addCourseSubject,
  createCourse,
  deleteCourse,
  deleteCourseContent,
  getCourseContent,
  getCourses,
  getTeachers,
  patchCourse,
  removeCourseSubject,
  updateCourse,
} from "../../services/admin.service.js";
import {
  deleteFile,
  uploadPDF,
  uploadThumbnail,
  uploadVideo,
} from "../../utils/upload.firebase.js";

const MotionDiv = motion.div;
const MotionAside = motion.aside;

const CATEGORIES = [
  "Math",
  "Science",
  "English",
  "Computer Science",
  "Physics",
  "Chemistry",
  "Biology",
  "Urdu",
  "Islamic Studies",
];
const LEVELS = ["beginner", "intermediate", "advanced"];
const STATUSES = ["draft", "published", "archived"];
const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const cap = (v = "") => `${v}`.charAt(0).toUpperCase() + `${v}`.slice(1);

const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const date = parseDate(value);
  if (!date) return "N/A";
  return date.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const bytes = (value = 0) => {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = Number(value);
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(size < 10 && idx > 0 ? 1 : 0)} ${units[idx]}`;
};

const pricePKR = (value) => Number(value || 0).toLocaleString("en-PK");

const defaultForm = () => ({
  title: "",
  shortDescription: "",
  description: "",
  category: CATEGORIES[0],
  level: "beginner",
  price: "",
  discountPercent: "",
  status: "draft",
  hasCertificate: true,
  thumbnail: "",
  subjects: [{ id: makeId(), name: "", teacherId: "", order: 1 }],
});

const statusCls = {
  draft: "bg-amber-50 text-amber-700",
  published: "bg-emerald-50 text-emerald-700",
  archived: "bg-slate-100 text-slate-600",
};

const normalizeCourse = (course = {}) => {
  const subjects = Array.isArray(course.subjects)
    ? [...course.subjects]
        .map((s, i) => ({
          id: s.id || makeId(),
          name: s.name || "",
          teacherId: s.teacherId || "",
          teacherName: s.teacherName || "",
          order: Number(s.order || i + 1),
        }))
        .sort((a, b) => a.order - b.order)
    : [];

  return {
    ...course,
    id: course.id || course.uid,
    title: course.title || "Untitled Course",
    shortDescription: course.shortDescription || "",
    description: course.description || "",
    category: course.category || "",
    level: course.level || "beginner",
    price: Number(course.price || 0),
    discountPercent: Number(course.discountPercent || 0),
    status: String(course.status || "draft").toLowerCase(),
    thumbnail: course.thumbnail || "",
    hasCertificate: course.hasCertificate !== false,
    enrollmentCount: Number(course.enrollmentCount || 0),
    subjects,
  };
};

function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-rose-500">{message}</p>;
}

function Modal({ open, title, onClose, children, maxWidth = "max-w-3xl" }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const root = ref.current;
    const first =
      root?.querySelector("input, select, textarea, button:not([aria-label='Close'])") ||
      root?.querySelectorAll(FOCUSABLE)?.[0];
    first?.focus();

    const onKey = (event) => {
      if (event.key === "Escape") {
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const nodes = Array.from(root.querySelectorAll(FOCUSABLE)).filter(
        (node) => !node.hasAttribute("disabled")
      );
      if (!nodes.length) return;
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault();
        firstNode.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
            onClick={onClose}
          />
          <MotionDiv
            ref={ref}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className={`relative z-10 flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-3xl bg-white p-6 shadow-2xl`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-2xl text-slate-900">{title}</h3>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="rounded-full border border-slate-200 p-2 text-slate-500"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 overflow-y-auto pr-1">{children}</div>
          </MotionDiv>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function UploadZone({ labelText, helper, accept, onFile, error }) {
  const inputRef = useRef(null);

  const onDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      className={`rounded-2xl border-2 border-dashed p-5 text-center ${
        error ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50"
      }`}
      onDrop={onDrop}
      onDragOver={(event) => event.preventDefault()}
    >
      <p className="text-sm font-semibold text-slate-700">{labelText}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-3 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
      >
        Choose File
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
      <FieldError message={error} />
    </div>
  );
}

function Courses() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [showCourseModal, setShowCourseModal] = useState(false);
  const [step, setStep] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [touched, setTouched] = useState({});
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [thumbState, setThumbState] = useState({
    uploading: false,
    progress: 0,
    error: "",
  });
  const [uploadRootId, setUploadRootId] = useState(makeId());

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pendingArchiveId, setPendingArchiveId] = useState("");
  const [pendingDeleteContentId, setPendingDeleteContentId] = useState("");

  const [drawerCourseId, setDrawerCourseId] = useState(null);
  const [activeSubjectId, setActiveSubjectId] = useState("");
  const [subjectEditor, setSubjectEditor] = useState({ name: "", teacherId: "" });
  const [newSubject, setNewSubject] = useState({ name: "", teacherId: "" });
  const [newSubjectError, setNewSubjectError] = useState("");

  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoState, setVideoState] = useState({
    title: "",
    file: null,
    progress: 0,
    status: "idle",
    error: "",
  });

  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfState, setPdfState] = useState({
    title: "",
    file: null,
    progress: 0,
    status: "idle",
    error: "",
    mode: "notes",
    noteType: "lecture_notes",
  });

  const coursesQuery = useQuery({
    queryKey: ["admin", "courses"],
    queryFn: getCourses,
    staleTime: 30000,
  });
  const teachersQuery = useQuery({
    queryKey: ["admin", "teachers"],
    queryFn: getTeachers,
    staleTime: 30000,
  });
  const contentQuery = useQuery({
    queryKey: ["admin", "course-content", drawerCourseId],
    queryFn: () => getCourseContent(drawerCourseId),
    enabled: Boolean(drawerCourseId),
    staleTime: 10000,
  });

  const teachers = useMemo(
    () =>
      (teachersQuery.data || []).map((t) => ({
        ...t,
        id: t.uid || t.id,
        fullName: t.fullName || "Unknown Teacher",
      })),
    [teachersQuery.data]
  );

  const teachersMap = useMemo(() => {
    const map = {};
    teachers.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [teachers]);

  const courses = useMemo(
    () => (coursesQuery.data || []).map(normalizeCourse),
    [coursesQuery.data]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      const matchSearch = !q || c.title.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      const matchCategory = categoryFilter === "all" || c.category === categoryFilter;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [courses, search, statusFilter, categoryFilter]);

  const stats = useMemo(
    () => ({
      total: courses.length,
      published: courses.filter((c) => c.status === "published").length,
      draft: courses.filter((c) => c.status === "draft").length,
      enrolled: courses.reduce((sum, c) => sum + c.enrollmentCount, 0),
    }),
    [courses]
  );

  const drawerCourse = useMemo(
    () => courses.find((c) => c.id === drawerCourseId) || null,
    [courses, drawerCourseId]
  );

  const activeSubject = useMemo(
    () =>
      drawerCourse?.subjects.find((s) => s.id === activeSubjectId) || null,
    [drawerCourse, activeSubjectId]
  );

  const contentMap = useMemo(() => {
    const map = {};
    (contentQuery.data || []).forEach((s) => {
      map[s.id] = Array.isArray(s.content) ? s.content : [];
    });
    return map;
  }, [contentQuery.data]);

  const activeContent = contentMap[activeSubjectId] || [];
  const videos = activeContent.filter((i) => i.type === "video");
  const pdfNotes = activeContent.filter(
    (i) => i.type === "pdf" && i.noteType !== "book"
  );
  const books = activeContent.filter(
    (i) => i.type === "notes" || i.noteType === "book"
  );

  const basicErrors = useMemo(() => {
    const errors = {};
    if (!form.title.trim()) errors.title = "Title is required.";
    else if (form.title.trim().length < 5) {
      errors.title = "Title must be at least 5 characters.";
    }

    if (!form.description.trim()) errors.description = "Description is required.";
    else if (form.description.trim().length < 20) {
      errors.description = "Description must be at least 20 characters.";
    }

    const p = Number(form.price);
    if (!form.price && form.price !== 0) errors.price = "Price is required.";
    else if (!Number.isFinite(p) || p <= 0) errors.price = "Price must be positive.";

    if (form.shortDescription.length > 150) {
      errors.shortDescription = "Short description max length is 150.";
    }

    const d = Number(form.discountPercent || 0);
    if (d < 0 || d > 100) {
      errors.discountPercent = "Discount must be between 0 and 100.";
    }

    return errors;
  }, [form]);

  const subjectErrors = useMemo(() => {
    const errors = {};
    if (!form.subjects.length) {
      errors._form = "At least one subject is required.";
      return errors;
    }
    form.subjects.forEach((s) => {
      const row = {};
      if (!s.name.trim()) row.name = "Subject name required.";
      else if (s.name.trim().length < 2) row.name = "Minimum 2 characters.";
      if (!s.teacherId) row.teacherId = "Teacher is required.";
      if (Object.keys(row).length) errors[s.id] = row;
    });
    return errors;
  }, [form.subjects]);

  useEffect(() => {
    if (!drawerCourse) return;
    if (!drawerCourse.subjects.length) {
      setActiveSubjectId("");
      return;
    }
    const found = drawerCourse.subjects.some((s) => s.id === activeSubjectId);
    if (!found) setActiveSubjectId(drawerCourse.subjects[0].id);
  }, [drawerCourse, activeSubjectId]);

  useEffect(() => {
    if (!activeSubject) return;
    setSubjectEditor({
      name: activeSubject.name || "",
      teacherId: activeSubject.teacherId || "",
    });
  }, [activeSubject]);

  const invalidateCourses = async () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
  const invalidateContent = async (courseId) =>
    queryClient.invalidateQueries({
      queryKey: ["admin", "course-content", courseId],
    });

  const createMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: async () => {
      await invalidateCourses();
      toast.success("Course created.");
      closeCourseModal();
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || "Failed to create course."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateCourse(id, data),
    onSuccess: async () => {
      await invalidateCourses();
      toast.success(showCourseModal ? "Course updated." : "Saved.");
      if (showCourseModal) closeCourseModal();
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || "Failed to update course."),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, status }) => patchCourse(id, { status }),
    onMutate: ({ id }) => {
      setPendingArchiveId(id);
    },
    onSuccess: async (_res, vars) => {
      await invalidateCourses();
      toast.success(
        vars.status === "archived" ? "Course archived." : "Course published."
      );
    },
    onSettled: () => {
      setPendingArchiveId("");
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || "Failed to update status."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCourse,
    onSuccess: async () => {
      await invalidateCourses();
      if (drawerCourseId === deleteTarget?.id) setDrawerCourseId(null);
      setDeleteTarget(null);
      toast.success("Course deleted.");
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || "Failed to delete course."),
  });

  const addSubjectMutation = useMutation({
    mutationFn: ({ courseId, data }) => addCourseSubject(courseId, data),
    onSuccess: async (res) => {
      await invalidateCourses();
      await invalidateContent(drawerCourseId);
      const payload = res?.data || {};
      if (payload.id) setActiveSubjectId(payload.id);
      setNewSubject({ name: "", teacherId: "" });
      setNewSubjectError("");
      toast.success("Subject added.");
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || "Failed to add subject."),
  });

  const removeSubjectMutation = useMutation({
    mutationFn: ({ courseId, subjectId }) =>
      removeCourseSubject(courseId, subjectId),
    onSuccess: async () => {
      await invalidateCourses();
      await invalidateContent(drawerCourseId);
      toast.success("Subject removed.");
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || "Failed to remove subject."),
  });

  const addContentMutation = useMutation({
    mutationFn: ({ courseId, subjectId, data }) =>
      addCourseContent(courseId, subjectId, data),
    onSuccess: async () => {
      await invalidateContent(drawerCourseId);
      toast.success("Content added.");
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || "Failed to add content."),
  });

  const deleteContentMutation = useMutation({
    mutationFn: async ({ courseId, item }) => {
      try {
        await deleteFile(item.url);
      } catch {
        // continue firestore cleanup even if storage deletion fails
      }
      return deleteCourseContent(courseId, item.id);
    },
    onMutate: ({ item }) => {
      setPendingDeleteContentId(item?.id || "");
    },
    onSuccess: async () => {
      await invalidateContent(drawerCourseId);
      toast.success("Content deleted.");
    },
    onSettled: () => {
      setPendingDeleteContentId("");
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || "Failed to delete content."),
  });

  const closeCourseModal = () => {
    setShowCourseModal(false);
    setStep(1);
    setEditingId(null);
    setForm(defaultForm());
    setTouched({});
    setSubjectTouched(false);
    setThumbState({ uploading: false, progress: 0, error: "" });
    setUploadRootId(makeId());
  };

  const openAdd = () => {
    closeCourseModal();
    setShowCourseModal(true);
  };

  const openEdit = (course) => {
    setEditingId(course.id);
    setForm({
      title: course.title,
      shortDescription: course.shortDescription || "",
      description: course.description || "",
      category: course.category || CATEGORIES[0],
      level: course.level || "beginner",
      price: String(course.price || ""),
      discountPercent: String(course.discountPercent || ""),
      status: course.status || "draft",
      hasCertificate: course.hasCertificate !== false,
      thumbnail: course.thumbnail || "",
      subjects: course.subjects.length
        ? course.subjects.map((s, i) => ({ ...s, order: i + 1 }))
        : [{ id: makeId(), name: "", teacherId: "", order: 1 }],
    });
    setStep(1);
    setTouched({});
    setSubjectTouched(false);
    setThumbState({ uploading: false, progress: 0, error: "" });
    setUploadRootId(course.id || makeId());
    setShowCourseModal(true);
  };

  const setSubject = (id, field, value) => {
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    }));
  };

  const addSubjectRow = () => {
    setForm((prev) => ({
      ...prev,
      subjects: [
        ...prev.subjects,
        { id: makeId(), name: "", teacherId: "", order: prev.subjects.length + 1 },
      ],
    }));
  };

  const removeSubjectRow = (id) => {
    setForm((prev) => {
      if (prev.subjects.length <= 1) return prev;
      const next = prev.subjects
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order: i + 1 }));
      return { ...prev, subjects: next };
    });
  };

  const discounted = useMemo(() => {
    const p = Number(form.price || 0);
    const d = Number(form.discountPercent || 0);
    return Math.max(0, p - (p * d) / 100);
  }, [form.price, form.discountPercent]);

  const coursePayload = () => ({
    title: form.title.trim(),
    shortDescription: form.shortDescription.trim(),
    description: form.description.trim(),
    category: form.category,
    level: form.level,
    price: Number(form.price),
    discountPercent: Number(form.discountPercent || 0),
    status: form.status,
    hasCertificate: form.hasCertificate,
    thumbnail: form.thumbnail || null,
    subjects: form.subjects.map((s, i) => ({
      id: s.id,
      name: s.name.trim(),
      teacherId: s.teacherId,
      teacherName: teachersMap[s.teacherId]?.fullName || "",
      order: i + 1,
    })),
  });

  const saveCourse = () => {
    setTouched({
      title: true,
      shortDescription: true,
      description: true,
      price: true,
      discountPercent: true,
    });
    setSubjectTouched(true);
    if (Object.keys(basicErrors).length || Object.keys(subjectErrors).length) {
      toast.error("Please fix validation errors.");
      return;
    }
    if (editingId) updateMutation.mutate({ id: editingId, data: coursePayload() });
    else createMutation.mutate(coursePayload());
  };

  const uploadThumbnailFile = async (file) => {
    setThumbState({ uploading: true, progress: 0, error: "" });
    try {
      const uploaded = await uploadThumbnail(file, uploadRootId, (progress) =>
        setThumbState((prev) => ({ ...prev, progress }))
      );
      setForm((prev) => ({ ...prev, thumbnail: uploaded.url }));
      setThumbState({ uploading: false, progress: 100, error: "" });
      toast.success("Thumbnail uploaded.");
    } catch (error) {
      setThumbState({
        uploading: false,
        progress: 0,
        error: error.message || "Thumbnail upload failed.",
      });
    }
  };

  const updateActiveSubject = () => {
    if (!drawerCourse || !activeSubject) return;
    if (!subjectEditor.name.trim()) {
      toast.error("Subject name is required.");
      return;
    }
    if (!subjectEditor.teacherId) {
      toast.error("Teacher is required.");
      return;
    }

    const subjects = drawerCourse.subjects.map((s) =>
      s.id === activeSubject.id
        ? {
            ...s,
            name: subjectEditor.name.trim(),
            teacherId: subjectEditor.teacherId,
            teacherName: teachersMap[subjectEditor.teacherId]?.fullName || "",
          }
        : s
    );

    updateMutation.mutate({ id: drawerCourse.id, data: { subjects } });
  };

  const submitNewSubject = () => {
    if (!drawerCourse) return;
    if (!newSubject.name.trim()) {
      setNewSubjectError("Subject name is required.");
      return;
    }
    if (!newSubject.teacherId) {
      setNewSubjectError("Teacher is required.");
      return;
    }
    addSubjectMutation.mutate({
      courseId: drawerCourse.id,
      data: { name: newSubject.name.trim(), teacherId: newSubject.teacherId },
    });
  };

  const uploadVideoNow = async () => {
    if (!drawerCourse || !activeSubject) return;
    if (!videoState.title.trim()) {
      setVideoState((prev) => ({ ...prev, error: "Title is required." }));
      return;
    }
    if (!videoState.file) {
      setVideoState((prev) => ({ ...prev, error: "Select a video file." }));
      return;
    }

    setVideoState((prev) => ({
      ...prev,
      status: "uploading",
      progress: 0,
      error: "",
    }));

    try {
      const uploaded = await uploadVideo(
        videoState.file,
        drawerCourse.id,
        activeSubject.id,
        (progress) => setVideoState((prev) => ({ ...prev, progress }))
      );

      setVideoState((prev) => ({ ...prev, status: "processing" }));

      await addContentMutation.mutateAsync({
        courseId: drawerCourse.id,
        subjectId: activeSubject.id,
        data: {
          type: "video",
          title: videoState.title.trim(),
          url: uploaded.url,
          size: uploaded.size,
          subjectId: activeSubject.id,
        },
      });

      setVideoState({
        title: "",
        file: null,
        progress: 100,
        status: "done",
        error: "",
      });
      setShowVideoModal(false);
    } catch (error) {
      setVideoState((prev) => ({
        ...prev,
        status: "idle",
        error: error.message || "Video upload failed.",
      }));
    }
  };

  const uploadPdfNow = async () => {
    if (!drawerCourse || !activeSubject) return;
    if (!pdfState.title.trim()) {
      setPdfState((prev) => ({ ...prev, error: "Title is required." }));
      return;
    }
    if (!pdfState.file) {
      setPdfState((prev) => ({ ...prev, error: "Select a PDF file." }));
      return;
    }

    setPdfState((prev) => ({
      ...prev,
      status: "uploading",
      progress: 0,
      error: "",
    }));

    try {
      const uploaded = await uploadPDF(
        pdfState.file,
        drawerCourse.id,
        activeSubject.id,
        (progress) => setPdfState((prev) => ({ ...prev, progress }))
      );
      setPdfState((prev) => ({ ...prev, status: "processing" }));

      const isBook = pdfState.mode === "book";
      await addContentMutation.mutateAsync({
        courseId: drawerCourse.id,
        subjectId: activeSubject.id,
        data: {
          type: isBook ? "notes" : "pdf",
          title: pdfState.title.trim(),
          url: uploaded.url,
          size: uploaded.size,
          noteType: isBook ? "book" : pdfState.noteType,
          subjectId: activeSubject.id,
        },
      });

      setPdfState({
        title: "",
        file: null,
        progress: 100,
        status: "done",
        error: "",
        mode: "notes",
        noteType: "lecture_notes",
      });
      setShowPdfModal(false);
    } catch (error) {
      setPdfState((prev) => ({
        ...prev,
        status: "idle",
        error: error.message || "PDF upload failed.",
      }));
    }
  };

  const pageActionBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    archiveMutation.isPending ||
    deleteMutation.isPending;

  return (
    <div className="space-y-6 font-sans">
      <Toaster
        position="top-left"
        toastOptions={{
          duration: 3500,
          style: { fontFamily: "DM Sans, sans-serif", borderRadius: "16px" },
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Courses</h2>
          <p className="text-sm text-slate-500">
            Manage courses, subjects, and content.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          disabled={pageActionBusy}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add Course
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-card">
          <p className="text-sm text-slate-500">Total Courses</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="glass-card">
          <p className="text-sm text-slate-500">Published Courses</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">
            {stats.published}
          </p>
        </div>
        <div className="glass-card">
          <p className="text-sm text-slate-500">Draft Courses</p>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{stats.draft}</p>
        </div>
        <div className="glass-card">
          <p className="text-sm text-slate-500">Total Enrolled Students</p>
          <p className="mt-2 text-2xl font-semibold text-blue-700">{stats.enrolled}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by title..."
          className="min-w-[240px] flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-full border border-slate-200 px-4 py-3 text-sm"
        >
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-full border border-slate-200 px-4 py-3 text-sm"
        >
          <option value="all">All Categories</option>
          {Array.from(
            new Set([...CATEGORIES, ...courses.map((c) => c.category).filter(Boolean)])
          ).map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {coursesQuery.isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card space-y-3">
              <div className="skeleton h-40 w-full rounded-2xl" />
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-5 w-1/2" />
              <div className="skeleton h-10 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <p className="text-lg font-semibold text-slate-900">No courses yet</p>
          <button
            type="button"
            onClick={openAdd}
            disabled={pageActionBusy}
            className="btn-primary mt-4 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add Course
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const discountedPrice =
              c.discountPercent > 0
                ? Math.max(0, c.price - (c.price * c.discountPercent) / 100)
                : c.price;
            const teacherCount = new Set(
              c.subjects.map((s) => s.teacherId).filter(Boolean)
            ).size;
            return (
              <article key={c.id} className="glass-card overflow-hidden p-0">
                <div className="relative">
                  {c.thumbnail ? (
                    <img src={c.thumbnail} alt={c.title} className="h-40 w-full object-cover" />
                  ) : (
                    <div className="h-40 w-full bg-gradient-to-br from-primary/15 via-blue-100 to-violet-100" />
                  )}
                  <span
                    className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${statusCls[c.status] || statusCls.draft}`}
                  >
                    {cap(c.status)}
                  </span>
                </div>
                <div className="space-y-3 p-5">
                  <h3 className="line-clamp-2 font-heading text-xl text-slate-900">
                    {c.title}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                      {c.category || "General"}
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                      {c.subjects.length} Subjects
                    </span>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">
                      {teacherCount} Teachers
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>{c.enrollmentCount} Enrolled</span>
                    <span>{cap(c.level)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.discountPercent > 0 ? (
                      <>
                        <span className="text-lg font-semibold text-primary">
                          PKR {pricePKR(discountedPrice)}
                        </span>
                        <span className="text-sm text-slate-400 line-through">
                          PKR {pricePKR(c.price)}
                        </span>
                      </>
                    ) : (
                      <span className="text-lg font-semibold text-primary">
                        PKR {pricePKR(c.price)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      disabled={archiveMutation.isPending || deleteMutation.isPending}
                      className="rounded-full border border-slate-200 px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerCourseId(c.id);
                        setActiveSubjectId(c.subjects[0]?.id || "");
                      }}
                      disabled={archiveMutation.isPending || deleteMutation.isPending}
                      className="rounded-full border border-slate-200 px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Manage Content
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        archiveMutation.mutate({
                          id: c.id,
                          status: c.status === "archived" ? "published" : "archived",
                        })
                      }
                      disabled={
                        archiveMutation.isPending ||
                        deleteMutation.isPending ||
                        (pendingArchiveId && pendingArchiveId !== c.id)
                      }
                      className="rounded-full border border-slate-200 px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {archiveMutation.isPending && pendingArchiveId === c.id
                        ? c.status === "archived"
                          ? "Publishing..."
                          : "Archiving..."
                        : c.status === "archived"
                        ? "Publish"
                        : "Archive"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(c)}
                      disabled={archiveMutation.isPending || deleteMutation.isPending}
                      className="rounded-full border border-rose-200 px-3 py-2 font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={showCourseModal}
        onClose={() => {
          if (createMutation.isPending || updateMutation.isPending) return;
          closeCourseModal();
        }}
        title={editingId ? "Edit Course" : "Add Course"}
        maxWidth="max-w-5xl"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                step >= s ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {s}
            </span>
          ))}
        </div>

        {step === 1 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                onBlur={() => setTouched((t) => ({ ...t, title: true }))}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              <FieldError message={touched.title ? basicErrors.title : ""} />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Short Description</label>
              <textarea
                rows={2}
                value={form.shortDescription}
                onChange={(e) =>
                  setForm((p) => ({ ...p, shortDescription: e.target.value }))
                }
                onBlur={() => setTouched((t) => ({ ...t, shortDescription: true }))}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              <div className="mt-1 flex items-center justify-between">
                <FieldError
                  message={touched.shortDescription ? basicErrors.shortDescription : ""}
                />
                <span className="text-xs text-slate-400">
                  {form.shortDescription.length}/150
                </span>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Full Description</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                onBlur={() => setTouched((t) => ({ ...t, description: true }))}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              <FieldError message={touched.description ? basicErrors.description : ""} />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Level</label>
              <select
                value={form.level}
                onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {cap(l)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Price PKR</label>
              <input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                onBlur={() => setTouched((t) => ({ ...t, price: true }))}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              <FieldError message={touched.price ? basicErrors.price : ""} />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Discount %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.discountPercent}
                onChange={(e) =>
                  setForm((p) => ({ ...p, discountPercent: e.target.value }))
                }
                onBlur={() => setTouched((t) => ({ ...t, discountPercent: true }))}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              <FieldError
                message={touched.discountPercent ? basicErrors.discountPercent : ""}
              />
              <p className="mt-1 text-xs text-slate-500">
                Discounted Price: PKR {pricePKR(discounted)}
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {cap(s)}
                  </option>
                ))}
              </select>
            </div>

            <label className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.hasCertificate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, hasCertificate: e.target.checked }))
                }
              />
              Certificate on completion
            </label>

            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeCourseModal}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setTouched({
                    title: true,
                    shortDescription: true,
                    description: true,
                    price: true,
                    discountPercent: true,
                  });
                  if (Object.keys(basicErrors).length) return;
                  setStep(2);
                }}
                className="btn-primary"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-5 space-y-5">
            <UploadZone
              labelText="Upload thumbnail"
              helper="JPG, PNG, WEBP - max 5MB"
              accept="image/jpeg,image/png,image/webp"
              onFile={uploadThumbnailFile}
              error={thumbState.error}
            />

            {thumbState.uploading ? (
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Uploading...</span>
                  <span>{thumbState.progress}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${thumbState.progress}%` }}
                  />
                </div>
              </div>
            ) : null}

            {form.thumbnail ? (
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-500">Preview</p>
                <img
                  src={form.thumbnail}
                  alt="Preview"
                  className="mt-2 h-48 w-full rounded-xl object-cover"
                />
              </div>
            ) : null}

            <div className="flex justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Back
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Skip
                </button>
                <button type="button" onClick={() => setStep(3)} className="btn-primary">
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-heading text-xl text-slate-900">Subjects</h4>
              <button
                type="button"
                onClick={addSubjectRow}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Add Subject
              </button>
            </div>
            <FieldError message={subjectTouched ? subjectErrors._form : ""} />

            <div className="space-y-3">
              {form.subjects.map((s, i) => (
                <div
                  key={s.id}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr_80px_40px]"
                >
                  <div>
                    <label className="text-xs font-semibold text-slate-500">
                      Subject Name
                    </label>
                    <input
                      type="text"
                      value={s.name}
                      onChange={(e) => setSubject(s.id, "name", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                    <FieldError
                      message={subjectTouched ? subjectErrors[s.id]?.name : ""}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">
                      Teacher
                    </label>
                    <select
                      value={s.teacherId}
                      onChange={(e) => setSubject(s.id, "teacherId", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Select teacher</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName}
                        </option>
                      ))}
                    </select>
                    <FieldError
                      message={subjectTouched ? subjectErrors[s.id]?.teacherId : ""}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Order</label>
                    <input
                      type="number"
                      readOnly
                      value={i + 1}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeSubjectRow(s.id)}
                      className="w-full rounded-xl border border-rose-200 bg-white py-2 text-sm font-semibold text-rose-500"
                    >
                      X
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Back
              </button>
              <button
                type="button"
                onClick={saveCourse}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="btn-primary min-w-[150px]"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingId
                  ? "Update Course"
                  : "Save Course"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (deleteMutation.isPending) return;
          setDeleteTarget(null);
        }}
        title="Delete Course"
        maxWidth="max-w-lg"
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            Delete <span className="font-semibold text-slate-900">{deleteTarget?.title}</span>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>

      <AnimatePresence>
        {drawerCourse ? (
          <div className="fixed inset-0 z-[85] flex items-start justify-end">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
              onClick={() => setDrawerCourseId(null)}
            />
            <MotionAside
              initial={{ x: 380, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 380, opacity: 0 }}
              className="relative h-full w-full max-w-[1180px] bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDrawerCourseId(null)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                  >
                    Back
                  </button>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                      Manage Content
                    </p>
                    <h3 className="font-heading text-xl text-slate-900">{drawerCourse.title}</h3>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusCls[drawerCourse.status] || statusCls.draft}`}
                >
                  {cap(drawerCourse.status)}
                </span>
              </div>

              <div className="grid h-[calc(100%-82px)] grid-cols-1 md:grid-cols-[280px_1fr]">
                <aside className="border-r border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Subjects</h4>
                  <div className="mt-3 space-y-2">
                    {drawerCourse.subjects.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveSubjectId(s.id)}
                        className={`w-full rounded-xl border px-3 py-2 text-left ${
                          activeSubjectId === s.id ? "border-primary bg-primary/10" : "border-slate-200 bg-white"
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.teacherName || "Unassigned"}</p>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold text-slate-500">Add Subject</p>
                    <input
                      type="text"
                      value={newSubject.name}
                      onChange={(e) => {
                        setNewSubject((p) => ({ ...p, name: e.target.value }));
                        setNewSubjectError("");
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                      placeholder="Subject name"
                    />
                    <select
                      value={newSubject.teacherId}
                      onChange={(e) => {
                        setNewSubject((p) => ({ ...p, teacherId: e.target.value }));
                        setNewSubjectError("");
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Select teacher</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName}
                        </option>
                      ))}
                    </select>
                    <FieldError message={newSubjectError} />
                    <button
                      type="button"
                      onClick={submitNewSubject}
                      disabled={addSubjectMutation.isPending}
                      className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {addSubjectMutation.isPending ? "Adding..." : "Add Subject"}
                    </button>
                  </div>
                </aside>

                <section className="h-full overflow-y-auto p-5">
                  {!activeSubject ? (
                    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-500">
                      No subject selected.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                          <input
                            type="text"
                            value={subjectEditor.name}
                            onChange={(e) =>
                              setSubjectEditor((p) => ({ ...p, name: e.target.value }))
                            }
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                          />
                          <select
                            value={subjectEditor.teacherId}
                            onChange={(e) =>
                              setSubjectEditor((p) => ({ ...p, teacherId: e.target.value }))
                            }
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          >
                            <option value="">Select teacher</option>
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>{t.fullName}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={updateActiveSubject}
                            disabled={updateMutation.isPending}
                            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {updateMutation.isPending ? "Saving..." : "Save Subject"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              removeSubjectMutation.mutate({
                                courseId: drawerCourse.id,
                                subjectId: activeSubject.id,
                              })
                            }
                            disabled={
                              drawerCourse.subjects.length <= 1 ||
                              removeSubjectMutation.isPending
                            }
                            className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {removeSubjectMutation.isPending ? "Removing..." : "Remove"}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-heading text-lg text-slate-900">Videos</h4>
                          <button type="button" onClick={() => { setVideoState({ title: "", file: null, progress: 0, status: "idle", error: "" }); setShowVideoModal(true); }} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">Add Video</button>
                        </div>
                        {videos.length === 0 ? (
                          <p className="text-sm text-slate-500">No videos yet.</p>
                        ) : (
                          videos.map((item) => (
                            <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                <p className="text-xs text-slate-500">{bytes(item.size)} - {formatDate(item.createdAt)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  deleteContentMutation.mutate({
                                    courseId: drawerCourse.id,
                                    item,
                                  })
                                }
                                disabled={
                                  deleteContentMutation.isPending &&
                                  pendingDeleteContentId === item.id
                                }
                                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deleteContentMutation.isPending &&
                                pendingDeleteContentId === item.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-heading text-lg text-slate-900">PDF Notes</h4>
                          <button type="button" onClick={() => { setPdfState({ title: "", file: null, progress: 0, status: "idle", error: "", mode: "notes", noteType: "lecture_notes" }); setShowPdfModal(true); }} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">Add PDF Notes</button>
                        </div>
                        {pdfNotes.length === 0 ? (
                          <p className="text-sm text-slate-500">No PDF notes yet.</p>
                        ) : (
                          pdfNotes.map((item) => (
                            <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                <p className="text-xs text-slate-500">{cap(String(item.noteType || "notes").replaceAll("_", " "))} - {bytes(item.size)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  deleteContentMutation.mutate({
                                    courseId: drawerCourse.id,
                                    item,
                                  })
                                }
                                disabled={
                                  deleteContentMutation.isPending &&
                                  pendingDeleteContentId === item.id
                                }
                                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deleteContentMutation.isPending &&
                                pendingDeleteContentId === item.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-heading text-lg text-slate-900">Books</h4>
                          <button type="button" onClick={() => { setPdfState({ title: "", file: null, progress: 0, status: "idle", error: "", mode: "book", noteType: "book" }); setShowPdfModal(true); }} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">Add Book</button>
                        </div>
                        {books.length === 0 ? (
                          <p className="text-sm text-slate-500">No books yet.</p>
                        ) : (
                          books.map((item) => (
                            <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                <p className="text-xs text-slate-500">Book - {bytes(item.size)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  deleteContentMutation.mutate({
                                    courseId: drawerCourse.id,
                                    item,
                                  })
                                }
                                disabled={
                                  deleteContentMutation.isPending &&
                                  pendingDeleteContentId === item.id
                                }
                                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deleteContentMutation.isPending &&
                                pendingDeleteContentId === item.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </MotionAside>
          </div>
        ) : null}
      </AnimatePresence>

      <Modal
        open={showVideoModal}
        onClose={() => {
          if (videoState.status === "uploading") return;
          setShowVideoModal(false);
        }}
        title="Add Video"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Title</label>
            <input
              type="text"
              value={videoState.title}
              onChange={(e) =>
                setVideoState((p) => ({ ...p, title: e.target.value, error: "" }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <UploadZone
            labelText="Upload Video"
            helper="MP4, AVI, MOV - max 2GB"
            accept="video/mp4,video/x-msvideo,video/quicktime"
            onFile={(file) => setVideoState((p) => ({ ...p, file, error: "" }))}
            error={videoState.error}
          />
          {videoState.file ? (
            <p className="text-xs text-slate-500">
              Selected: {videoState.file.name} ({bytes(videoState.file.size)})
            </p>
          ) : null}
          {videoState.status !== "idle" ? (
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {videoState.status === "uploading"
                    ? "Uploading"
                    : videoState.status === "processing"
                    ? "Processing"
                    : "Done"}
                </span>
                <span>{videoState.progress}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${videoState.progress}%` }}
                />
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowVideoModal(false)}
              disabled={videoState.status === "uploading" || videoState.status === "processing"}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button type="button" onClick={uploadVideoNow} disabled={videoState.status === "uploading" || videoState.status === "processing"} className="btn-primary min-w-[130px]">
              {videoState.status === "uploading" || videoState.status === "processing" ? "Uploading..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showPdfModal}
        onClose={() => {
          if (pdfState.status === "uploading") return;
          setShowPdfModal(false);
        }}
        title={pdfState.mode === "book" ? "Add Book" : "Add PDF Notes"}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Title</label>
            <input
              type="text"
              value={pdfState.title}
              onChange={(e) => setPdfState((p) => ({ ...p, title: e.target.value, error: "" }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          {pdfState.mode !== "book" ? (
            <div>
              <label className="text-sm font-semibold text-slate-700">Type</label>
              <select value={pdfState.noteType} onChange={(e) => setPdfState((p) => ({ ...p, noteType: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                <option value="lecture_notes">Lecture Notes</option>
                <option value="assignment">Assignment</option>
                <option value="reference">Reference</option>
              </select>
            </div>
          ) : null}
          <UploadZone
            labelText="Upload PDF"
            helper="PDF only - max 50MB"
            accept="application/pdf"
            onFile={(file) => setPdfState((p) => ({ ...p, file, error: "" }))}
            error={pdfState.error}
          />
          {pdfState.file ? (
            <p className="text-xs text-slate-500">
              Selected: {pdfState.file.name} ({bytes(pdfState.file.size)})
            </p>
          ) : null}
          {pdfState.status !== "idle" ? (
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {pdfState.status === "uploading"
                    ? "Uploading"
                    : pdfState.status === "processing"
                    ? "Processing"
                    : "Done"}
                </span>
                <span>{pdfState.progress}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${pdfState.progress}%` }} />
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowPdfModal(false)}
              disabled={pdfState.status === "uploading" || pdfState.status === "processing"}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button type="button" onClick={uploadPdfNow} disabled={pdfState.status === "uploading" || pdfState.status === "processing"} className="btn-primary min-w-[130px]">
              {pdfState.status === "uploading" || pdfState.status === "processing" ? "Uploading..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Courses;
