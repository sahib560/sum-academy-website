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
  createUser,
  deleteUser,
  getStudents,
  resetUserDevice,
  updateUser,
} from "../../services/admin.service.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PHONE_REGEX = /^\+92\d{10}$/;
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const emptyAddForm = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
};

const emptyEditForm = {
  uid: "",
  fullName: "",
  phone: "",
};

const emptyResetForm = {
  device: "",
  webIp: "",
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

const relativeTime = (value) => {
  const date = parseDate(value);
  if (!date) return "Never";
  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return formatDate(date);
};

const emailName = (email = "") =>
  email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getInitials = (name = "", email = "") => {
  const source = name || emailName(email) || "S";
  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const normalizeEnrolledCourses = (courses) => {
  if (!Array.isArray(courses)) return [];
  return courses.map((entry, index) => {
    if (typeof entry === "string") {
      return {
        id: `course-${index}-${entry}`,
        courseName: entry,
        enrolledAt: null,
        progress: 0,
      };
    }
    return {
      id: entry.id || entry.courseId || `course-${index}`,
      courseName: entry.courseName || entry.name || "Untitled Course",
      enrolledAt: entry.enrolledAt || entry.createdAt || null,
      progress: Number(entry.progress || 0),
    };
  });
};

const normalizeCertificates = (certificates) => {
  if (!Array.isArray(certificates)) return [];
  return certificates.map((entry, index) => {
    if (typeof entry === "string") {
      return {
        id: `cert-${index}`,
        certId: entry,
        courseName: "N/A",
        issuedAt: null,
      };
    }
    return {
      id: entry.id || entry.certId || `cert-${index}`,
      certId: entry.certId || "N/A",
      courseName: entry.courseName || "N/A",
      issuedAt: entry.issuedAt || entry.createdAt || null,
    };
  });
};

const normalizeStudents = (students = []) =>
  students.map((student) => {
    const fullName = student.fullName || student.name || emailName(student.email);
    return {
      ...student,
      uid: student.uid || student.id,
      fullName,
      email: student.email || "",
      phoneNumber: student.phoneNumber || "",
      enrolledCourses: normalizeEnrolledCourses(student.enrolledCourses),
      certificates: normalizeCertificates(student.certificates),
      joinedDate: formatDate(student.createdAt),
      lastLoginText: relativeTime(student.lastLoginAt),
      initials: getInitials(fullName, student.email),
      isActive: student.isActive !== false,
      assignedWebDevice: student.assignedWebDevice || "",
      assignedWebIp: student.assignedWebIp || student.lastKnownWebIp || "",
      lastLoginAt: student.lastLoginAt || null,
      createdAt: student.createdAt || null,
    };
  });

const maskIp = (ip = "") => {
  if (!ip) return "N/A";
  if (!ip.includes(".")) return ip;
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
};

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
    errors.phone = "Phone number is required.";
  } else if (!PHONE_REGEX.test(values.phone.trim())) {
    errors.phone = "Use +923001234567 format.";
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
    errors.phone = "Phone number is required.";
  } else if (!PHONE_REGEX.test(values.phone.trim())) {
    errors.phone = "Use +923001234567 format.";
  }
  return errors;
};

const validateResetForm = (values) => {
  const errors = {};
  if (!values.device.trim() && !values.webIp.trim()) {
    errors.device = "Enter a new device or new web IP.";
  }
  return errors;
};

const sortStudents = (students, sortBy) => {
  const list = [...students];
  if (sortBy === "name_asc") {
    list.sort((a, b) => a.fullName.localeCompare(b.fullName));
  } else if (sortBy === "newest") {
    list.sort((a, b) => {
      const aDate = parseDate(a.createdAt)?.getTime() || 0;
      const bDate = parseDate(b.createdAt)?.getTime() || 0;
      return bDate - aDate;
    });
  } else if (sortBy === "last_active") {
    list.sort((a, b) => {
      const aDate = parseDate(a.lastLoginAt)?.getTime() || 0;
      const bDate = parseDate(b.lastLoginAt)?.getTime() || 0;
      return bDate - aDate;
    });
  }
  return list;
};

function ModalShell({ open, title, onClose, children, maxWidth = "max-w-lg" }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const dialog = dialogRef.current;
    const preferredFocus =
      dialog?.querySelector("input, select, textarea, button:not([aria-label='Close'])") ||
      dialog?.querySelectorAll(FOCUSABLE_SELECTOR)?.[0];
    preferredFocus?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onCloseRef.current?.();
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
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7l-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z" />
                </svg>
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

function Students() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name_asc");
  const [page, setPage] = useState(1);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [profileStudent, setProfileStudent] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [addForm, setAddForm] = useState(emptyAddForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [resetForm, setResetForm] = useState(emptyResetForm);
  const [addTouched, setAddTouched] = useState({});
  const [editTouched, setEditTouched] = useState({});
  const [resetTouched, setResetTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [emailFieldError, setEmailFieldError] = useState("");

  const studentsQuery = useQuery({
    queryKey: ["admin", "students"],
    queryFn: getStudents,
    staleTime: 30000,
  });

  const students = useMemo(
    () => normalizeStudents(studentsQuery.data || []),
    [studentsQuery.data]
  );

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = students.filter((student) => {
      const searchMatch =
        !q ||
        student.fullName.toLowerCase().includes(q) ||
        student.email.toLowerCase().includes(q);
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "active" && student.isActive) ||
        (statusFilter === "inactive" && !student.isActive);
      return searchMatch && statusMatch;
    });
    return sortStudents(filtered, sortBy);
  }, [search, statusFilter, sortBy, students]);

  const stats = useMemo(
    () => ({
      total: students.length,
      active: students.filter((s) => s.isActive).length,
      inactive: students.filter((s) => !s.isActive).length,
      enrolled: students.reduce((sum, s) => sum + s.enrolledCourses.length, 0),
    }),
    [students]
  );

  const perPage = 10;
  const pageCount = Math.max(1, Math.ceil(filteredStudents.length / perPage));
  const paginated = filteredStudents.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortBy]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const addErrors = useMemo(() => validateAddForm(addForm), [addForm]);
  const editErrors = useMemo(() => validateEditForm(editForm), [editForm]);
  const resetErrors = useMemo(() => validateResetForm(resetForm), [resetForm]);

  const invalidateStudents = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
  };

  const createStudentMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      await invalidateStudents();
      setShowAddModal(false);
      setAddForm(emptyAddForm);
      setAddTouched({});
      setShowPassword(false);
      setEmailFieldError("");
      toast.success("Student created");
    },
    onError: (error) => {
      if (error?.response?.status === 409) {
        setEmailFieldError("Email already in use");
        return;
      }
      toast.error(error?.response?.data?.error || "Failed to create student.");
    },
  });

  const editStudentMutation = useMutation({
    mutationFn: ({ uid, data }) => updateUser(uid, data),
    onSuccess: async () => {
      await invalidateStudents();
      setShowEditModal(false);
      setSelectedStudent(null);
      setEditTouched({});
      toast.success("Student updated");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to update student.");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ uid, isActive }) => updateUser(uid, { isActive }),
    onSuccess: async (_data, variables) => {
      await invalidateStudents();
      setShowStatusModal(false);
      setSelectedStudent(null);
      toast.success(variables.isActive ? "Student activated" : "Student deactivated");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to update status.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (uid) => deleteUser(uid),
    onSuccess: async () => {
      await invalidateStudents();
      setShowDeleteModal(false);
      setSelectedStudent(null);
      setProfileStudent(null);
      toast.success("Student deleted");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to delete student.");
    },
  });

  const resetDeviceMutation = useMutation({
    mutationFn: ({ uid, data }) => resetUserDevice(uid, data),
    onSuccess: async () => {
      await invalidateStudents();
      setShowResetModal(false);
      setResetForm(emptyResetForm);
      setResetTouched({});
      toast.success("Device reset. Student can login again.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to reset device.");
    },
  });

  const openAdd = () => {
    setAddForm(emptyAddForm);
    setAddTouched({});
    setShowPassword(false);
    setEmailFieldError("");
    setShowAddModal(true);
  };

  const openEdit = (student) => {
    setSelectedStudent(student);
    setEditForm({
      uid: student.uid,
      fullName: student.fullName,
      phone: student.phoneNumber,
    });
    setEditTouched({});
    setShowEditModal(true);
  };

  const openStatus = (student) => {
    setSelectedStudent(student);
    setShowStatusModal(true);
  };

  const openDelete = (student) => {
    setSelectedStudent(student);
    setShowDeleteModal(true);
  };

  const openProfile = (student) => {
    setProfileStudent(student);
  };

  const openReset = (student) => {
    setSelectedStudent(student);
    setResetForm(emptyResetForm);
    setResetTouched({});
    setShowResetModal(true);
  };

  const sanitizePhone = (value) =>
    value
      .replace(/(?!^\+)[^\d]/g, "")
      .replace(/^(\+)?(.*)$/, (_m, plus, rest) => `${plus || ""}${rest.replace(/\+/g, "")}`);

  const exportStudentsPdf = () => {
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
    doc.text("Students Export", 14, 34);
    doc.text(`Generated: ${generatedAt}`, 14, 41);

    let y = 54;
    filteredStudents.forEach((student, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(10, y - 6, 190, 22, 3, 3);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${index + 1}. ${student.fullName}`, 14, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(student.email || "N/A", 14, y + 6);
      doc.text(student.phoneNumber || "N/A", 86, y);
      doc.text(String(student.enrolledCourses.length), 140, y);
      doc.text(student.isActive ? "Active" : "Inactive", 152, y);
      doc.text(student.joinedDate, 172, y);
      y += 28;
    });

    doc.save(`sum-academy-students-${Date.now()}.pdf`);
    toast.success("Students PDF exported.");
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
          <h2 className="font-heading text-3xl text-slate-900">Students</h2>
          <p className="text-sm text-slate-500">
            Manage student accounts, enrollments, and account security.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={exportStudentsPdf}
            disabled={!filteredStudents.length}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export PDF
          </button>
          <button type="button" onClick={openAdd} className="btn-primary">
            Add Student
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Students", value: stats.total },
          { label: "Active Students", value: stats.active },
          { label: "Inactive Students", value: stats.inactive },
          { label: "Total Enrolled Courses", value: stats.enrolled },
        ].map((item) => (
          <div key={item.label} className="glass-card">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative min-w-[240px] flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M10 4a6 6 0 1 0 3.9 10.6l4.7 4.7 1.4-1.4-4.7-4.7A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by full name or email"
            className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
        >
          <option value="name_asc">Name A-Z</option>
          <option value="newest">Newest First</option>
          <option value="last_active">Last Active</option>
        </select>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-6 py-4">Avatar</th>
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Phone Number</th>
                <th className="px-6 py-4">Enrolled</th>
                <th className="px-6 py-4">Certificates</th>
                <th className="px-6 py-4">Last Login</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {studentsQuery.isLoading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <tr key={`student-skeleton-${index}`} className="border-b border-slate-100">
                    <td className="px-6 py-4"><div className="skeleton h-11 w-11 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-40" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-44" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-32" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-6 w-16 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-6 w-16 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-24" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-6 w-20 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="ml-auto flex w-36 gap-2"><div className="skeleton h-9 w-9 rounded-full" /><div className="skeleton h-9 w-9 rounded-full" /><div className="skeleton h-9 w-9 rounded-full" /><div className="skeleton h-9 w-9 rounded-full" /></div></td>
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-14">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
                          <path d="M12 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm-7 8a7 7 0 1 1 14 0H5z" />
                        </svg>
                      </div>
                      <p className="mt-4 text-lg font-semibold text-slate-900">No students added yet</p>
                      <button type="button" onClick={openAdd} className="btn-primary mt-4">Add your first student</button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((student) => (
                  <tr key={student.uid} className="border-b border-slate-100">
                    <td className="px-6 py-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                        {student.initials}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{student.fullName}</td>
                    <td className="px-6 py-4 text-slate-600">{student.email || "N/A"}</td>
                    <td className="px-6 py-4 text-slate-600">{student.phoneNumber || "N/A"}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {student.enrolledCourses.length}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                        {student.certificates.length}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{student.lastLoginText}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          student.isActive
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        {student.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => openProfile(student)} className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:text-primary" aria-label="View">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 5c5.5 0 9.5 5.5 9.7 5.8l.3.4-.3.4C21.5 12 17.5 17 12 17S2.5 12 2.3 11.6l-.3-.4.3-.4C2.5 10.5 6.5 5 12 5zm0 2C8.7 7 6 9.8 4.7 11.2 6 12.6 8.7 15 12 15s6-2.4 7.3-3.8C18 9.8 15.3 7 12 7zm0 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" /></svg>
                        </button>
                        <button type="button" onClick={() => openEdit(student)} className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:text-primary" aria-label="Edit">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M3 17.2V21h3.8l11-11-3.8-3.8-11 11zm17.7-10.5a1 1 0 0 0 0-1.4l-2-2a1 1 0 0 0-1.4 0l-1.6 1.6 3.8 3.8 1.2-1z" /></svg>
                        </button>
                        <button type="button" onClick={() => openStatus(student)} className={`rounded-full px-3 py-1 text-xs font-semibold ${student.isActive ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                          {student.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button type="button" onClick={() => openDelete(student)} className="rounded-full border border-slate-200 p-2 text-rose-500 transition hover:text-rose-600" aria-label="Delete">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-4 lg:hidden">
          {studentsQuery.isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={`mobile-skeleton-${index}`} className="skeleton h-32 w-full rounded-2xl" />
            ))
          ) : paginated.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
                    <path d="M12 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm-7 8a7 7 0 1 1 14 0H5z" />
                  </svg>
                </div>
                <p className="mt-3 text-base font-semibold text-slate-900">No students added yet</p>
                <button type="button" onClick={openAdd} className="btn-primary mt-4">
                  Add your first student
                </button>
              </div>
            </div>
          ) : (
            paginated.map((student) => (
              <div key={student.uid} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">{student.initials}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{student.fullName}</p>
                    <p className="truncate text-sm text-slate-500">{student.email}</p>
                    <p className="text-xs text-slate-500">{student.phoneNumber || "N/A"}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Enrolled: {student.enrolledCourses.length}</span>
                  <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">Certs: {student.certificates.length}</span>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${student.isActive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{student.isActive ? "Active" : "Inactive"}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => openProfile(student)} className="rounded-full border border-slate-200 px-3 py-1 text-xs">View</button>
                  <button type="button" onClick={() => openEdit(student)} className="rounded-full border border-slate-200 px-3 py-1 text-xs">Edit</button>
                  <button type="button" onClick={() => openStatus(student)} className="rounded-full border border-slate-200 px-3 py-1 text-xs">{student.isActive ? "Deactivate" : "Activate"}</button>
                  <button type="button" onClick={() => openDelete(student)} className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
          <span>Page {page} of {pageCount}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1} className="rounded-full border border-slate-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50">Prev</button>
            <button type="button" onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))} disabled={page === pageCount} className="rounded-full border border-slate-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      <ModalShell
        open={showAddModal}
        title="Add Student"
        onClose={() => {
          if (createStudentMutation.isPending) return;
          setShowAddModal(false);
        }}
      >
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setAddTouched({ fullName: true, email: true, password: true, phone: true });
            if (Object.keys(addErrors).length) return;

            createStudentMutation.mutate({
              name: addForm.fullName.trim(),
              email: addForm.email.trim(),
              password: addForm.password,
              phone: addForm.phone.trim(),
              role: "student",
            });
          }}
        >
          <div>
            <label className="text-sm font-semibold text-slate-700">Full Name</label>
            <input type="text" value={addForm.fullName} onChange={(event) => { setAddForm((prev) => ({ ...prev, fullName: event.target.value })); setAddTouched((prev) => ({ ...prev, fullName: true })); }} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="Student full name" />
            <FieldError message={addTouched.fullName ? addErrors.fullName : ""} />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Email</label>
            <input type="email" value={addForm.email} onChange={(event) => { setAddForm((prev) => ({ ...prev, email: event.target.value })); setAddTouched((prev) => ({ ...prev, email: true })); setEmailFieldError(""); }} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="student@example.com" />
            <FieldError message={(addTouched.email ? addErrors.email : "") || emailFieldError} />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Password</label>
            <div className="relative mt-2">
              <input type={showPassword ? "text" : "password"} value={addForm.password} onChange={(event) => { setAddForm((prev) => ({ ...prev, password: event.target.value })); setAddTouched((prev) => ({ ...prev, password: true })); }} className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="Create password" />
              <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:text-slate-700" aria-label={showPassword ? "Hide password" : "Show password"}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  {showPassword ? (
                    <path d="M2 5.3 3.3 4 20 20.7 18.7 22l-3.2-3.2A12.4 12.4 0 0 1 12 19C7 19 2.7 15.9 1 12c.8-1.8 2-3.4 3.5-4.7L2 5.3zm9.9 9.9a3.5 3.5 0 0 1-3.1-3.1l3.1 3.1zm7.2-1.7-2.2-2.2a3.5 3.5 0 0 0-4.2-4.2L9.3 6.4A8.7 8.7 0 0 1 12 5c5 0 9.3 3.1 11 7-.9 2.1-2.5 4-4.6 5.5z" />
                  ) : (
                    <path d="M12 5c5.5 0 9.5 5.5 9.7 5.8l.3.4-.3.4C21.5 12 17.5 17 12 17S2.5 12 2.3 11.6l-.3-.4.3-.4C2.5 10.5 6.5 5 12 5zm0 2C8.7 7 6 9.8 4.7 11.2 6 12.6 8.7 15 12 15s6-2.4 7.3-3.8C18 9.8 15.3 7 12 7zm0 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
                  )}
                </svg>
              </button>
            </div>
            <FieldError message={addTouched.password ? addErrors.password : ""} />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Phone Number</label>
            <input type="text" value={addForm.phone} onChange={(event) => { setAddForm((prev) => ({ ...prev, phone: sanitizePhone(event.target.value) })); setAddTouched((prev) => ({ ...prev, phone: true })); }} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="+923001234567" />
            <FieldError message={addTouched.phone ? addErrors.phone : ""} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAddModal(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
            <button type="submit" disabled={createStudentMutation.isPending} className="btn-primary min-w-32">
              {createStudentMutation.isPending ? (
                <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Saving...</span>
              ) : "Create Student"}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell open={showEditModal} title="Edit Student" onClose={() => { if (editStudentMutation.isPending) return; setShowEditModal(false); }}>
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setEditTouched({ fullName: true, phone: true });
            if (Object.keys(editErrors).length) return;
            editStudentMutation.mutate({
              uid: editForm.uid,
              data: {
                name: editForm.fullName.trim(),
                phone: editForm.phone.trim(),
              },
            });
          }}
        >
          <div>
            <label className="text-sm font-semibold text-slate-700">Full Name</label>
            <input type="text" value={editForm.fullName} onChange={(event) => { setEditForm((prev) => ({ ...prev, fullName: event.target.value })); setEditTouched((prev) => ({ ...prev, fullName: true })); }} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="Student full name" />
            <FieldError message={editTouched.fullName ? editErrors.fullName : ""} />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Phone Number</label>
            <input type="text" value={editForm.phone} onChange={(event) => { setEditForm((prev) => ({ ...prev, phone: sanitizePhone(event.target.value) })); setEditTouched((prev) => ({ ...prev, phone: true })); }} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="+923001234567" />
            <FieldError message={editTouched.phone ? editErrors.phone : ""} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowEditModal(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
            <button type="submit" disabled={editStudentMutation.isPending} className="btn-primary min-w-32">
              {editStudentMutation.isPending ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Saving...</span> : "Update Student"}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell open={showStatusModal && Boolean(selectedStudent)} title={selectedStudent?.isActive ? "Deactivate Student" : "Activate Student"} onClose={() => { if (statusMutation.isPending) return; setShowStatusModal(false); setSelectedStudent(null); }}>
        <div className="mt-6 space-y-5">
          <p className="text-sm leading-6 text-slate-600">
            {selectedStudent?.isActive
              ? `Deactivate ${selectedStudent?.fullName}? Student will lose access to all courses immediately.`
              : `Activate ${selectedStudent?.fullName}? Student will regain access.`}
          </p>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => { setShowStatusModal(false); setSelectedStudent(null); }} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
            <button type="button" disabled={statusMutation.isPending || !selectedStudent} onClick={() => selectedStudent && statusMutation.mutate({ uid: selectedStudent.uid, isActive: !selectedStudent.isActive })} className={`inline-flex min-w-[130px] items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white ${selectedStudent?.isActive ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-500 hover:bg-emerald-600"}`}>
              {statusMutation.isPending ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Updating...</span> : selectedStudent?.isActive ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={showDeleteModal && Boolean(selectedStudent)} title="Delete Student" onClose={() => { if (deleteMutation.isPending) return; setShowDeleteModal(false); setSelectedStudent(null); }}>
        <div className="mt-6 space-y-5">
          <p className="text-sm leading-6 text-slate-600">
            Delete <span className="font-semibold text-slate-900">{selectedStudent?.fullName}</span>? This cannot be undone.
          </p>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">{selectedStudent?.email}</div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => { setShowDeleteModal(false); setSelectedStudent(null); }} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
            <button type="button" disabled={deleteMutation.isPending || !selectedStudent} onClick={() => selectedStudent && deleteMutation.mutate(selectedStudent.uid)} className="inline-flex min-w-[120px] items-center justify-center rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600">
              {deleteMutation.isPending ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Deleting...</span> : "Delete"}
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={showResetModal && Boolean(selectedStudent)} title="Reset Device" onClose={() => { if (resetDeviceMutation.isPending) return; setShowResetModal(false); }}>
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setResetTouched({ device: true, webIp: true });
            if (Object.keys(resetErrors).length) return;
            if (!selectedStudent) return;
            resetDeviceMutation.mutate({
              uid: selectedStudent.uid,
              data: {
                device: resetForm.device.trim(),
                webIp: resetForm.webIp.trim(),
              },
            });
          }}
        >
          <div>
            <label className="text-sm font-semibold text-slate-700">New Device</label>
            <input type="text" value={resetForm.device} onChange={(event) => { setResetForm((prev) => ({ ...prev, device: event.target.value })); setResetTouched((prev) => ({ ...prev, device: true })); }} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="Chrome on Windows" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">New Web IP</label>
            <input type="text" value={resetForm.webIp} onChange={(event) => { setResetForm((prev) => ({ ...prev, webIp: event.target.value })); setResetTouched((prev) => ({ ...prev, webIp: true })); }} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="123.45.67.89" />
            <FieldError message={resetTouched.device || resetTouched.webIp ? resetErrors.device : ""} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowResetModal(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
            <button type="submit" disabled={resetDeviceMutation.isPending} className="btn-primary min-w-32">
              {resetDeviceMutation.isPending ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Saving...</span> : "Reset Device"}
            </button>
          </div>
        </form>
      </ModalShell>

      <AnimatePresence>
        {profileStudent ? (
          <div className="fixed inset-0 z-[65] flex items-start justify-end">
            <button type="button" className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setProfileStudent(null)} />
            <motion.aside initial={{ x: 360, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 360, opacity: 0 }} transition={{ duration: 0.22 }} className="relative h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-2xl text-slate-900">Student Profile</h3>
                <button type="button" className="rounded-full border border-slate-200 p-2 text-slate-500" onClick={() => setProfileStudent(null)}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7l-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z" /></svg>
                </button>
              </div>
              <div className="mt-6 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">{profileStudent.initials}</div>
                <div>
                  <p className="text-2xl font-semibold text-slate-900">{profileStudent.fullName}</p>
                  <p className="text-sm text-slate-600">{profileStudent.email}</p>
                  <p className="text-sm text-slate-500">{profileStudent.phoneNumber || "N/A"}</p>
                  <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Student</span>
                </div>
              </div>
              <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between"><span>Joined Date</span><span className="font-semibold text-slate-900">{profileStudent.joinedDate}</span></div>
                <div className="flex items-center justify-between"><span>Last Login</span><span className="font-semibold text-slate-900">{profileStudent.lastLoginText}</span></div>
                <div className="flex items-center justify-between"><span>Device</span><span className="font-semibold text-slate-900">{profileStudent.assignedWebDevice || "N/A"}</span></div>
              </div>
              <div className="mt-6">
                <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-400">Academic Info</h4>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3"><p className="text-xs text-blue-700">Enrolled Courses</p><p className="mt-1 text-xl font-semibold text-blue-900">{profileStudent.enrolledCourses.length}</p></div>
                  <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3"><p className="text-xs text-violet-700">Certificates Earned</p><p className="mt-1 text-xl font-semibold text-violet-900">{profileStudent.certificates.length}</p></div>
                </div>
              </div>
              <div className="mt-6">
                <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-400">Enrolled Courses</h4>
                <div className="mt-3 space-y-3">
                  {profileStudent.enrolledCourses.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">No courses enrolled yet</p>
                  ) : (
                    profileStudent.enrolledCourses.map((course) => (
                      <div key={course.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                        <div className="flex items-center justify-between"><p className="font-semibold text-slate-900">{course.courseName}</p><p className="text-xs text-slate-500">{course.progress}%</p></div>
                        <p className="mt-1 text-xs text-slate-500">Enrollment date: {course.enrolledAt ? formatDate(course.enrolledAt) : "N/A"}</p>
                        <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, course.progress))}%` }} /></div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="mt-6">
                <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-400">Certificates</h4>
                <div className="mt-3 space-y-3">
                  {profileStudent.certificates.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">No certificates earned yet</p>
                  ) : (
                    profileStudent.certificates.map((cert) => (
                      <div key={cert.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                        <p className="font-semibold text-slate-900">Cert ID: {cert.certId}</p>
                        <p className="mt-1 text-slate-600">Course: {cert.courseName}</p>
                        <p className="mt-1 text-xs text-slate-500">Issued: {cert.issuedAt ? formatDate(cert.issuedAt) : "N/A"}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-slate-200 p-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-400">Account Security</h4>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-slate-500">Assigned Web Device</span><span className="font-semibold text-slate-900">{profileStudent.assignedWebDevice || "N/A"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Assigned Web IP</span><span className="font-semibold text-slate-900">{maskIp(profileStudent.assignedWebIp)}</span></div>
                </div>
                <button type="button" onClick={() => openReset(profileStudent)} className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">Reset Device</button>
              </div>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default Students;
