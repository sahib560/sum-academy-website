import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "react-hot-toast";
import { jsPDF } from "jspdf";
import {
  FiEdit3,
  FiEye,
  FiEyeOff,
  FiSearch,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";
import {
  createUser,
  deleteUser,
  getTeachers,
  updateUser,
} from "../../services/admin.service.js";

const PHONE_REGEX = /^\+92\d{10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

const emptyAddForm = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  subject: "",
  bio: "",
};

const emptyEditForm = {
  uid: "",
  fullName: "",
  phone: "",
  subject: "",
  bio: "",
};

const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?._seconds === "number") return new Date(value._seconds * 1000);
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const normalizeTeachers = (teachers = []) =>
  teachers.map((teacher) => ({
    ...teacher,
    uid: teacher.uid || teacher.id,
    fullName: teacher.fullName || "Unknown Teacher",
    phone: teacher.phoneNumber || "",
    subject: teacher.subject || "General",
    bio: teacher.bio || "",
    email: teacher.email || "",
    joinedDate: formatDate(teacher.createdAt),
    initials: getInitials(teacher.fullName || "Teacher"),
    isActive: teacher.isActive !== false,
  }));

const validateAddForm = (values) => {
  const errors = {};
  if (!values.fullName.trim()) {
    errors.fullName = "Full Name is required.";
  } else if (values.fullName.trim().length < 3) {
    errors.fullName = "Full Name must be at least 3 characters.";
  }

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (!PASSWORD_REGEX.test(values.password)) {
    errors.password =
      "Password must be 8+ chars with uppercase, number, and special char.";
  }

  if (!values.phone.trim()) {
    errors.phone = "Phone is required.";
  } else if (!PHONE_REGEX.test(values.phone.trim())) {
    errors.phone = "Use +923001234567 format.";
  }

  if (!values.subject.trim()) {
    errors.subject = "Subject is required.";
  } else if (values.subject.trim().length < 2) {
    errors.subject = "Subject must be at least 2 characters.";
  }

  if (values.bio.length > 300) {
    errors.bio = "Bio cannot exceed 300 characters.";
  }

  return errors;
};

const validateEditForm = (values) => {
  const errors = {};
  if (!values.fullName.trim()) {
    errors.fullName = "Full Name is required.";
  } else if (values.fullName.trim().length < 3) {
    errors.fullName = "Full Name must be at least 3 characters.";
  }

  if (!values.phone.trim()) {
    errors.phone = "Phone is required.";
  } else if (!PHONE_REGEX.test(values.phone.trim())) {
    errors.phone = "Use +923001234567 format.";
  }

  if (!values.subject.trim()) {
    errors.subject = "Subject is required.";
  } else if (values.subject.trim().length < 2) {
    errors.subject = "Subject must be at least 2 characters.";
  }

  if (values.bio.length > 300) {
    errors.bio = "Bio cannot exceed 300 characters.";
  }

  return errors;
};

function ModalShell({ open, title, onClose, children, maxWidth = "max-w-lg" }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const dialog = dialogRef.current;
    const preferredFocus =
      dialog?.querySelector("input, select, textarea, button:not([aria-label='Close'])") ||
      dialog?.querySelectorAll(FOCUSABLE_SELECTOR)?.[0];
    preferredFocus?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const items = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute("disabled")
      );
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close modal"
          />
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2 }}
            className={`relative z-10 flex max-h-[90vh] w-full ${maxWidth} flex-col overflow-hidden rounded-3xl bg-white p-6 shadow-2xl`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-heading text-2xl text-slate-900">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:text-slate-900"
                aria-label="Close"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto pr-1">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-2 text-xs text-rose-500">{message}</p>;
}

function Teachers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [addTouched, setAddTouched] = useState({});
  const [editTouched, setEditTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [emailFieldError, setEmailFieldError] = useState("");

  const teachersQuery = useQuery({
    queryKey: ["admin", "teachers"],
    queryFn: getTeachers,
    staleTime: 30000,
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  const teachers = useMemo(
    () => normalizeTeachers(teachersQuery.data || []),
    [teachersQuery.data]
  );

  const filteredTeachers = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return teachers.filter((teacher) => {
      const matchesSearch =
        !query ||
        teacher.fullName.toLowerCase().includes(query) ||
        teacher.subject.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && teacher.isActive) ||
        (statusFilter === "inactive" && !teacher.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [debouncedSearch, statusFilter, teachers]);

  const stats = useMemo(
    () => ({
      total: teachers.length,
      active: teachers.filter((teacher) => teacher.isActive).length,
      inactive: teachers.filter((teacher) => !teacher.isActive).length,
    }),
    [teachers]
  );

  const addErrors = useMemo(() => validateAddForm(addForm), [addForm]);
  const editErrors = useMemo(() => validateEditForm(editForm), [editForm]);

  const invalidateTeachers = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
  };

  const createTeacherMutation = useMutation({
    mutationFn: (payload) => createUser(payload),
    onSuccess: async () => {
      await invalidateTeachers();
      setShowAddModal(false);
      setAddForm(emptyAddForm);
      setAddTouched({});
      setShowPassword(false);
      setEmailFieldError("");
      toast.success("Teacher created");
    },
    onError: (error) => {
      if (error?.response?.status === 409) {
        setEmailFieldError("Email already in use");
        return;
      }
      toast.error(error?.response?.data?.error || "Failed to create teacher.");
    },
  });

  const updateTeacherMutation = useMutation({
    mutationFn: (payload) => updateUser(payload.uid, payload.data),
    onSuccess: async () => {
      await invalidateTeachers();
      setShowEditModal(false);
      setSelectedTeacher(null);
      setEditTouched({});
      toast.success("Teacher updated");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to update teacher.");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ uid, isActive }) => updateUser(uid, { isActive }),
    onSuccess: async (_data, variables) => {
      await invalidateTeachers();
      setShowStatusModal(false);
      setSelectedTeacher(null);
      toast.success(variables.isActive ? "Teacher activated" : "Teacher deactivated");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to update status.");
    },
  });

  const deleteTeacherMutation = useMutation({
    mutationFn: (uid) => deleteUser(uid),
    onSuccess: async () => {
      await invalidateTeachers();
      setShowDeleteModal(false);
      setSelectedTeacher(null);
      toast.success("Teacher deleted");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to delete teacher.");
    },
  });

  const sanitizePhone = (value) =>
    value
      .replace(/(?!^\+)[^\d]/g, "")
      .replace(/^(\+)?(.*)$/, (_m, plus, rest) => `${plus || ""}${rest.replace(/\+/g, "")}`);

  const openAdd = () => {
    setAddForm(emptyAddForm);
    setAddTouched({});
    setShowPassword(false);
    setEmailFieldError("");
    setShowAddModal(true);
  };

  const handleAddChange = (field, value) => {
    if (field === "email") setEmailFieldError("");
    setAddForm((current) => ({ ...current, [field]: value }));
  };

  const handleEditChange = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const markAddTouched = (field) => {
    setAddTouched((current) => ({ ...current, [field]: true }));
  };

  const markEditTouched = (field) => {
    setEditTouched((current) => ({ ...current, [field]: true }));
  };

  const openEdit = (teacher) => {
    setSelectedTeacher(teacher);
    setEditForm({
      uid: teacher.uid,
      fullName: teacher.fullName,
      phone: teacher.phone,
      subject: teacher.subject,
      bio: teacher.bio,
    });
    setEditTouched({});
    setShowEditModal(true);
  };

  const openStatusConfirm = (teacher) => {
    setSelectedTeacher(teacher);
    setShowStatusModal(true);
  };

  const openDeleteConfirm = (teacher) => {
    setSelectedTeacher(teacher);
    setShowDeleteModal(true);
  };

  const submitAddTeacher = (event) => {
    event.preventDefault();
    setAddTouched({
      fullName: true,
      email: true,
      password: true,
      phone: true,
      subject: true,
      bio: true,
    });

    if (Object.keys(addErrors).length > 0) return;

    createTeacherMutation.mutate({
      name: addForm.fullName.trim(),
      email: addForm.email.trim(),
      password: addForm.password,
      phone: addForm.phone.trim(),
      role: "teacher",
      subject: addForm.subject.trim(),
      bio: addForm.bio.trim(),
    });
  };

  const submitEditTeacher = (event) => {
    event.preventDefault();
    setEditTouched({
      fullName: true,
      phone: true,
      subject: true,
      bio: true,
    });

    if (Object.keys(editErrors).length > 0) return;

    updateTeacherMutation.mutate({
      uid: editForm.uid,
      data: {
        name: editForm.fullName.trim(),
        phone: editForm.phone.trim(),
        subject: editForm.subject.trim(),
        bio: editForm.bio.trim(),
      },
    });
  };

  const exportTeachersPdf = () => {
    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    doc.setFillColor(74, 99, 245);
    doc.rect(0, 0, 210, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("SUM Academy", 14, 15);

    doc.setTextColor(31, 41, 55);
    doc.setFontSize(11);
    doc.text("Teachers Export", 14, 34);
    doc.text(`Generated: ${generatedAt}`, 14, 41);

    let y = 54;
    filteredTeachers.forEach((teacher, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(10, y - 6, 190, 22, 3, 3);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${index + 1}. ${teacher.fullName}`, 14, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(teacher.email || "N/A", 14, y + 6);
      doc.text(teacher.subject || "N/A", 108, y);
      doc.text(teacher.isActive ? "Active" : "Inactive", 148, y);
      doc.text(teacher.joinedDate, 170, y);
      y += 28;
    });

    doc.save(`sum-academy-teachers-${Date.now()}.pdf`);
    toast.success("Teachers PDF exported.");
  };

  return (
    <div className="space-y-6 font-sans">
      <Toaster
        position="top-left"
        toastOptions={{
          duration: 3500,
          style: {
            fontFamily: "DM Sans, sans-serif",
            borderRadius: "16px",
          },
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Teachers</h2>
          <p className="text-sm text-slate-500">
            Manage teacher profiles with real backend data.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={exportTeachersPdf}
            disabled={!filteredTeachers.length}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export PDF
          </button>
          <button type="button" onClick={openAdd} className="btn-primary">
            Add Teacher
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Teachers", value: stats.total },
          { label: "Active Teachers", value: stats.active },
          { label: "Inactive Teachers", value: stats.inactive },
        ].map((item) => (
          <div key={item.label} className="glass-card">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <FiSearch className="h-5 w-5" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or subject"
            className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                statusFilter === tab.id
                  ? "bg-primary text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {teachersQuery.isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`teacher-skeleton-${index}`} className="glass-card space-y-4">
              <div className="flex items-center gap-3">
                <div className="skeleton h-14 w-14 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-4 w-2/3" />
                </div>
              </div>
              <div className="skeleton h-6 w-24 rounded-full" />
              <div className="skeleton h-12 w-full" />
              <div className="skeleton h-10 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="glass-card flex min-h-[320px] flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <FiUser className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-xl font-semibold text-slate-900">
            {teachers.length === 0 ? "No teachers added yet" : "No teachers found"}
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            {teachers.length === 0
              ? "Create teacher accounts to start assigning subjects and classes."
              : "Try changing the search or status filter."}
          </p>
          {teachers.length === 0 ? (
            <button type="button" onClick={openAdd} className="btn-primary mt-5">
              Add your first teacher
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredTeachers.map((teacher) => (
            <div key={teacher.uid} className="glass-card card-hover flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-base font-bold text-blue-700">
                  {teacher.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-semibold text-slate-900">
                    {teacher.fullName}
                  </h3>
                  <p className="truncate text-sm text-slate-500">{teacher.email}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {teacher.subject}
                </span>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    teacher.isActive
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-rose-50 text-rose-600"
                  }`}
                >
                  {teacher.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <p className="line-clamp-2 min-h-[40px] text-sm text-slate-600">
                {teacher.bio || "No bio added yet."}
              </p>

              <div className="text-xs text-slate-500">Joined: {teacher.joinedDate}</div>

              <div className="mt-auto flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(teacher)}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:text-primary"
                  aria-label="Edit teacher"
                >
                  <FiEdit3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openStatusConfirm(teacher)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    teacher.isActive
                      ? "bg-rose-50 text-rose-600"
                      : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {teacher.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteConfirm(teacher)}
                  className="rounded-full border border-slate-200 p-2 text-rose-500 transition hover:text-rose-600"
                  aria-label="Delete teacher"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalShell
        open={showAddModal}
        title="Add Teacher"
        onClose={() => {
          if (createTeacherMutation.isPending) return;
          setShowAddModal(false);
        }}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={submitAddTeacher} className="mt-6 space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">Full Name</label>
              <input
                type="text"
                value={addForm.fullName}
                onChange={(event) => handleAddChange("fullName", event.target.value)}
                onBlur={() => markAddTouched("fullName")}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                placeholder="Teacher full name"
              />
              <FieldError message={addTouched.fullName ? addErrors.fullName : ""} />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Email</label>
              <input
                type="email"
                value={addForm.email}
                onChange={(event) => handleAddChange("email", event.target.value)}
                onBlur={() => markAddTouched("email")}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                placeholder="teacher@example.com"
              />
              <FieldError
                message={(addTouched.email ? addErrors.email : "") || emailFieldError}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Password</label>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={addForm.password}
                  onChange={(event) => handleAddChange("password", event.target.value)}
                  onBlur={() => markAddTouched("password")}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  placeholder="Create password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <FiEyeOff className="h-5 w-5" />
                  ) : (
                    <FiEye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <FieldError message={addTouched.password ? addErrors.password : ""} />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Phone</label>
              <input
                type="text"
                value={addForm.phone}
                onChange={(event) =>
                  handleAddChange("phone", sanitizePhone(event.target.value))
                }
                onBlur={() => markAddTouched("phone")}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                placeholder="+923001234567"
              />
              <FieldError message={addTouched.phone ? addErrors.phone : ""} />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Subject</label>
              <input
                type="text"
                value={addForm.subject}
                onChange={(event) => handleAddChange("subject", event.target.value)}
                onBlur={() => markAddTouched("subject")}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                placeholder="Biology"
              />
              <FieldError message={addTouched.subject ? addErrors.subject : ""} />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-slate-700">Bio</label>
                <span className="text-xs text-slate-400">{addForm.bio.length}/300</span>
              </div>
              <textarea
                value={addForm.bio}
                onChange={(event) =>
                  handleAddChange("bio", event.target.value.slice(0, 300))
                }
                onBlur={() => markAddTouched("bio")}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                placeholder="Short teacher bio"
              />
              <FieldError message={addTouched.bio ? addErrors.bio : ""} />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              disabled={createTeacherMutation.isPending}
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTeacherMutation.isPending}
              className="inline-flex min-w-[140px] items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {createTeacherMutation.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating...
                </span>
              ) : (
                "Create Teacher"
              )}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        open={showEditModal}
        title="Edit Teacher"
        onClose={() => {
          if (updateTeacherMutation.isPending) return;
          setShowEditModal(false);
        }}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={submitEditTeacher} className="mt-6 space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">Full Name</label>
              <input
                type="text"
                value={editForm.fullName}
                onChange={(event) => handleEditChange("fullName", event.target.value)}
                onBlur={() => markEditTouched("fullName")}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                placeholder="Teacher full name"
              />
              <FieldError message={editTouched.fullName ? editErrors.fullName : ""} />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Phone</label>
              <input
                type="text"
                value={editForm.phone}
                onChange={(event) =>
                  handleEditChange("phone", sanitizePhone(event.target.value))
                }
                onBlur={() => markEditTouched("phone")}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                placeholder="+923001234567"
              />
              <FieldError message={editTouched.phone ? editErrors.phone : ""} />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Subject</label>
              <input
                type="text"
                value={editForm.subject}
                onChange={(event) => handleEditChange("subject", event.target.value)}
                onBlur={() => markEditTouched("subject")}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                placeholder="Biology"
              />
              <FieldError message={editTouched.subject ? editErrors.subject : ""} />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-slate-700">Bio</label>
                <span className="text-xs text-slate-400">{editForm.bio.length}/300</span>
              </div>
              <textarea
                value={editForm.bio}
                onChange={(event) =>
                  handleEditChange("bio", event.target.value.slice(0, 300))
                }
                onBlur={() => markEditTouched("bio")}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                placeholder="Short teacher bio"
              />
              <FieldError message={editTouched.bio ? editErrors.bio : ""} />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              disabled={updateTeacherMutation.isPending}
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateTeacherMutation.isPending}
              className="inline-flex min-w-[140px] items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {updateTeacherMutation.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        open={showStatusModal && Boolean(selectedTeacher)}
        title={selectedTeacher?.isActive ? "Deactivate Teacher" : "Activate Teacher"}
        onClose={() => {
          if (statusMutation.isPending) return;
          setShowStatusModal(false);
          setSelectedTeacher(null);
        }}
      >
        <div className="mt-6 space-y-5">
          <p className="text-sm leading-6 text-slate-600">
            {selectedTeacher?.isActive
              ? `Are you sure you want to deactivate ${selectedTeacher?.fullName}? Teacher will lose access immediately.`
              : `Activate ${selectedTeacher?.fullName}? Teacher will regain access.`}
          </p>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={() => {
                setShowStatusModal(false);
                setSelectedTeacher(null);
              }}
              disabled={statusMutation.isPending}
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={statusMutation.isPending || !selectedTeacher}
              onClick={() =>
                selectedTeacher &&
                statusMutation.mutate({
                  uid: selectedTeacher.uid,
                  isActive: !selectedTeacher.isActive,
                })
              }
              className={`inline-flex min-w-[140px] items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${
                selectedTeacher?.isActive
                  ? "bg-rose-500 hover:bg-rose-600"
                  : "bg-emerald-500 hover:bg-emerald-600"
              }`}
            >
              {statusMutation.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Updating...
                </span>
              ) : selectedTeacher?.isActive ? (
                "Deactivate"
              ) : (
                "Activate"
              )}
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={showDeleteModal && Boolean(selectedTeacher)}
        title="Delete Teacher"
        onClose={() => {
          if (deleteTeacherMutation.isPending) return;
          setShowDeleteModal(false);
          setSelectedTeacher(null);
        }}
      >
        <div className="mt-6 space-y-4">
          <p className="text-sm leading-6 text-slate-600">
            Delete <span className="font-semibold text-slate-900">{selectedTeacher?.fullName}</span>? This cannot be undone.
          </p>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            {selectedTeacher?.email}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedTeacher(null);
              }}
              disabled={deleteTeacherMutation.isPending}
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteTeacherMutation.isPending || !selectedTeacher}
              onClick={() => selectedTeacher && deleteTeacherMutation.mutate(selectedTeacher.uid)}
              className="inline-flex min-w-[120px] items-center justify-center rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {deleteTeacherMutation.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}

export default Teachers;
