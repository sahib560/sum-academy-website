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
  FiDownload,
  FiEdit3,
  FiEye,
  FiEyeOff,
  FiUpload,
  FiSearch,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import {
  bulkUploadStudents,
  createUser,
  deleteUser,
  downloadStudentsBulkTemplate,
  getStudents,
  approveStudent,
  rejectStudent,
  resetUserDevice,
  updateUser,
} from "../../services/admin.service.js";
import {
  isPakistanPhone,
  normalizePakistanPhone,
  sanitizePhoneInput,
} from "../../utils/phone.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "pending_approval", label: "Pending Approval" },
  { id: "inactive", label: "Inactive" },
];

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
    const resolvedStatus =
      student.status ||
      (student.approvalStatus === "pending" ? "pending_approval" : "") ||
      "";
    return {
      ...student,
      uid: student.uid || student.id,
      fullName,
      email: student.email || "",
      phoneNumber:
        normalizePakistanPhone(student.phoneNumber || student.phone || "") ||
        student.phoneNumber ||
        student.phone ||
        "",
      enrolledCourses: normalizeEnrolledCourses(student.enrolledCourses),
      certificates: normalizeCertificates(student.certificates),
      joinedDate: formatDate(student.createdAt),
      lastLoginText: relativeTime(student.lastLoginAt),
      initials: getInitials(fullName, student.email),
      isActive: student.isActive !== false,
      status: resolvedStatus,
      assignedWebDevice: student.assignedWebDevice || "",
      assignedWebIp: student.assignedWebIp || student.lastKnownWebIp || "",
      lastLoginAt: student.lastLoginAt || null,
      createdAt: student.createdAt || null,
      avgProgress: Number(student.avgProgress || 0),
      completedCourses: Number(student.completedCourses || 0),
      securityViolationCount: Number(student.securityViolationCount || 0),
      securityViolationLimit: Number(student.securityViolationLimit || 3),
      lastSecurityViolationReason: student.lastSecurityViolationReason || "",
      lastSecurityViolationAt: student.lastSecurityViolationAt || null,
      securityDeactivatedAt: student.securityDeactivatedAt || null,
      securityDeactivationReason: student.securityDeactivationReason || "",
      recentSecurityViolations: Array.isArray(student.recentSecurityViolations)
        ? student.recentSecurityViolations
        : [],
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
  } else if (!isPakistanPhone(values.phone)) {
    errors.phone = "Use 03001234567 or +923001234567 format.";
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
  } else if (!isPakistanPhone(values.phone)) {
    errors.phone = "Use 03001234567 or +923001234567 format.";
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

function Students() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name_asc");
  const [page, setPage] = useState(1);
  const [searchParams] = useSearchParams();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [profileStudent, setProfileStudent] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const [addForm, setAddForm] = useState(emptyAddForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [addTouched, setAddTouched] = useState({});
  const [editTouched, setEditTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [emailFieldError, setEmailFieldError] = useState("");
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);

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
        (statusFilter === "pending_approval" &&
          student.status === "pending_approval") ||
        (statusFilter === "inactive" && !student.isActive);
      return searchMatch && statusMatch;
    });
    return sortStudents(filtered, sortBy);
  }, [search, statusFilter, sortBy, students]);

  const stats = useMemo(
    () => ({
      total: students.length,
      active: students.filter((s) => s.isActive).length,
      pending: students.filter((s) => s.status === "pending_approval").length,
      inactive: students.filter((s) => !s.isActive).length,
      enrolledStudents: students.filter((s) => s.enrolledCourses.length > 0).length,
      flagged: students.filter(
        (s) =>
          Number(s.securityViolationCount || 0) >= Number(s.securityViolationLimit || 3) ||
          Boolean(s.securityDeactivatedAt)
      ).length,
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
    const tab = searchParams.get("tab") || searchParams.get("status");
    if (tab && STATUS_TABS.some((item) => item.id === tab)) {
      setStatusFilter(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const addErrors = useMemo(() => validateAddForm(addForm), [addForm]);
  const editErrors = useMemo(() => validateEditForm(editForm), [editForm]);
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

  const downloadTemplateMutation = useMutation({
    mutationFn: downloadStudentsBulkTemplate,
    onSuccess: () => {
      toast.success("Template downloaded. Fill it and upload.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to download template.");
    },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: bulkUploadStudents,
    onSuccess: async (response) => {
      await invalidateStudents();
      const result = response?.data || {};
      setBulkResult(result);
      toast.success(
        `${result.createdCount || 0} student(s) created${
          result.failedCount ? `, ${result.failedCount} failed` : ""
        }.`
      );
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Bulk upload failed.");
      setBulkResult({
        createdCount: 0,
        failedCount: error?.response?.data?.errors?.length || 0,
        failed: error?.response?.data?.errors || [],
      });
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
      setSelectedStudent(null);
      toast.success("Device reset. Student can login again.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to reset device.");
    },
  });

  const approveStudentMutation = useMutation({
    mutationFn: (uid) => approveStudent(uid),
    onSuccess: async () => {
      await invalidateStudents();
      toast.success("Student approved! Email sent to student.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to approve student.");
    },
  });

  const rejectStudentMutation = useMutation({
    mutationFn: ({ uid, reason }) => rejectStudent(uid, reason),
    onSuccess: async () => {
      await invalidateStudents();
      setShowRejectModal(false);
      setRejectReason("");
      setSelectedStudent(null);
      toast.success("Student rejected");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to reject student.");
    },
  });

  const openAdd = () => {
    setAddForm(emptyAddForm);
    setAddTouched({});
    setShowPassword(false);
    setEmailFieldError("");
    setShowAddModal(true);
  };

  const openBulk = () => {
    setBulkFile(null);
    setBulkResult(null);
    setShowBulkModal(true);
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
    setShowResetModal(true);
  };

  const openReject = (student) => {
    setSelectedStudent(student);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const sanitizePhone = (value) => sanitizePhoneInput(value);

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
          <button
            type="button"
            onClick={openBulk}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary"
          >
            <FiUpload className="h-4 w-4" />
            Bulk Add
          </button>
          <button type="button" onClick={openAdd} className="btn-primary">
            Add Student
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "Total Students", value: stats.total },
          { label: "Active Students", value: stats.active },
          { label: "Pending Approval", value: stats.pending },
          { label: "Inactive Students", value: stats.inactive },
          { label: "Enrolled Students", value: stats.enrolledStudents },
          { label: "Security Flagged", value: stats.flagged },
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
            <FiSearch className="h-5 w-5" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by full name or email"
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
              <span className="flex items-center gap-2">
                {tab.label}
                {tab.id === "pending_approval" && stats.pending > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    {stats.pending}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>

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

      {stats.pending > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          {stats.pending} students waiting for approval
        </div>
      ) : null}

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
                <th className="px-6 py-4">Security</th>
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
                    <td className="px-6 py-4"><div className="skeleton h-6 w-20 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-24" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-6 w-20 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="ml-auto flex w-36 gap-2"><div className="skeleton h-9 w-9 rounded-full" /><div className="skeleton h-9 w-9 rounded-full" /><div className="skeleton h-9 w-9 rounded-full" /><div className="skeleton h-9 w-9 rounded-full" /></div></td>
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-14">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <FiUser className="h-8 w-8" />
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
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          Number(student.securityViolationCount || 0) >=
                            Number(student.securityViolationLimit || 3) ||
                          Boolean(student.securityDeactivatedAt)
                            ? "bg-rose-50 text-rose-700"
                            : Number(student.securityViolationCount || 0) > 0
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {Number(student.securityViolationCount || 0)}/
                        {Number(student.securityViolationLimit || 3)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{student.lastLoginText}</td>
                    <td className="px-6 py-4">
                      {student.status === "pending_approval" ? (
                        <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          Pending
                        </span>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            student.isActive
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-rose-50 text-rose-600"
                          }`}
                        >
                          {student.isActive ? "Active" : "Inactive"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => openProfile(student)} className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:text-primary" aria-label="View">
                          <FiEye className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => openEdit(student)} className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:text-primary" aria-label="Edit">
                          <FiEdit3 className="h-4 w-4" />
                        </button>
                        {student.status === "pending_approval" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => approveStudentMutation.mutate(student.uid)}
                              className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600"
                              disabled={approveStudentMutation.isPending}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => openReject(student)}
                              className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={() => openStatus(student)} className={`rounded-full px-3 py-1 text-xs font-semibold ${student.isActive ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                            {student.isActive ? "Deactivate" : "Activate"}
                          </button>
                        )}
                        <button type="button" onClick={() => openDelete(student)} className="rounded-full border border-slate-200 p-2 text-rose-500 transition hover:text-rose-600" aria-label="Delete">
                          <FiTrash2 className="h-4 w-4" />
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
                  <FiUser className="h-7 w-7" />
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
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${Number(student.securityViolationCount || 0) >= Number(student.securityViolationLimit || 3) || Boolean(student.securityDeactivatedAt) ? "bg-rose-50 text-rose-700" : Number(student.securityViolationCount || 0) > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>Security: {Number(student.securityViolationCount || 0)}/{Number(student.securityViolationLimit || 3)}</span>
                  {student.status === "pending_approval" ? (
                    <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Pending</span>
                  ) : (
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${student.isActive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{student.isActive ? "Active" : "Inactive"}</span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => openProfile(student)} className="rounded-full border border-slate-200 px-3 py-1 text-xs">View</button>
                  <button type="button" onClick={() => openEdit(student)} className="rounded-full border border-slate-200 px-3 py-1 text-xs">Edit</button>
                  {student.status === "pending_approval" ? (
                    <>
                      <button type="button" onClick={() => approveStudentMutation.mutate(student.uid)} className="rounded-full border border-emerald-200 px-3 py-1 text-xs text-emerald-600">Approve</button>
                      <button type="button" onClick={() => openReject(student)} className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600">Reject</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => openStatus(student)} className="rounded-full border border-slate-200 px-3 py-1 text-xs">{student.isActive ? "Deactivate" : "Activate"}</button>
                  )}
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
              phone: normalizePakistanPhone(addForm.phone),
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
                {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
              </button>
            </div>
            <FieldError message={addTouched.password ? addErrors.password : ""} />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Phone Number</label>
            <input type="text" value={addForm.phone} onChange={(event) => { setAddForm((prev) => ({ ...prev, phone: sanitizePhone(event.target.value) })); setAddTouched((prev) => ({ ...prev, phone: true })); }} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="03001234567 or +923001234567" />
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

      <ModalShell
        open={showBulkModal}
        title="Bulk Add Students"
        onClose={() => {
          if (bulkUploadMutation.isPending || downloadTemplateMutation.isPending) return;
          setShowBulkModal(false);
        }}
      >
        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Template columns</p>
            <p className="mt-1">Use only these columns: `name,email,password,phone,address`.</p>
            <p className="mt-1">Do not add `id`. Other details can be completed by student after login.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => downloadTemplateMutation.mutate()}
              disabled={downloadTemplateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary disabled:opacity-60"
            >
              <FiDownload className="h-4 w-4" />
              {downloadTemplateMutation.isPending ? "Downloading..." : "Download Template"}
            </button>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary">
              <FiUpload className="h-4 w-4" />
              Choose CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setBulkFile(file);
                  setBulkResult(null);
                }}
              />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 text-sm">
            {bulkFile ? (
              <div className="space-y-1 text-slate-700">
                <p className="font-semibold">{bulkFile.name}</p>
                <p className="text-xs text-slate-500">
                  {(bulkFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ) : (
              <p className="text-slate-500">No CSV selected yet.</p>
            )}
          </div>

          {bulkResult ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
              <p className="font-semibold text-slate-900">Upload Summary</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                  Created: {Number(bulkResult.createdCount || 0)}
                </div>
                <div className="rounded-xl bg-rose-50 p-3 text-rose-700">
                  Failed: {Number(bulkResult.failedCount || 0)}
                </div>
                <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                  Rows: {Number(bulkResult.totalRows || 0)}
                </div>
              </div>
              {Array.isArray(bulkResult.failed) && bulkResult.failed.length > 0 ? (
                <div className="max-h-36 space-y-2 overflow-y-auto rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                  {bulkResult.failed.slice(0, 12).map((item, index) => (
                    <p key={`${item.row || index}-${item.email || ""}`}>
                      Row {item.row || "-"}: {item.message || "Failed"}
                      {item.email ? ` (${item.email})` : ""}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => {
                setBulkFile(null);
                setBulkResult(null);
              }}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                if (!bulkFile) {
                  toast.error("Please select a CSV file first.");
                  return;
                }
                if (!bulkFile.name.toLowerCase().endsWith(".csv")) {
                  toast.error("Please upload a CSV file only.");
                  return;
                }
                bulkUploadMutation.mutate(bulkFile);
              }}
              disabled={bulkUploadMutation.isPending}
              className="btn-primary min-w-36"
            >
              {bulkUploadMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Uploading...
                </span>
              ) : (
                "Upload CSV"
              )}
            </button>
          </div>
        </div>
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
                phone: normalizePakistanPhone(editForm.phone),
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
            <input type="text" value={editForm.phone} onChange={(event) => { setEditForm((prev) => ({ ...prev, phone: sanitizePhone(event.target.value) })); setEditTouched((prev) => ({ ...prev, phone: true })); }} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="03001234567 or +923001234567" />
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

      <ModalShell
        open={showResetModal && Boolean(selectedStudent)}
        title="Reset Device"
        onClose={() => {
          if (resetDeviceMutation.isPending) return;
          setShowResetModal(false);
          setSelectedStudent(null);
        }}
      >
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedStudent) return;
            resetDeviceMutation.mutate({
              uid: selectedStudent.uid,
              data: { resetDevice: true },
            });
          }}
        >
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Reset access for {selectedStudent?.fullName}?</p>
            <p className="mt-2">
              This will clear the current registered device and IP. The student will register a
              new device automatically on next login.
            </p>
            <p className="mt-2">
              A notification email will also be sent to <span className="font-semibold">{selectedStudent?.email}</span>.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowResetModal(false);
                setSelectedStudent(null);
              }}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button type="submit" disabled={resetDeviceMutation.isPending} className="btn-primary min-w-32">
              {resetDeviceMutation.isPending ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Resetting...</span> : "Confirm Reset"}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        open={showRejectModal && Boolean(selectedStudent)}
        title="Reject Student"
        onClose={() => {
          if (rejectStudentMutation.isPending) return;
          setShowRejectModal(false);
        }}
      >
        <div className="mt-6 space-y-4">
          <p className="text-sm text-slate-600">
            Reject <span className="font-semibold text-slate-900">{selectedStudent?.fullName}</span>? You can optionally add a reason.
          </p>
          <textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            placeholder="Reason (optional)"
          />
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedStudent) return;
                rejectStudentMutation.mutate({
                  uid: selectedStudent.uid,
                  reason: rejectReason.trim(),
                });
              }}
              disabled={rejectStudentMutation.isPending}
              className="inline-flex min-w-[140px] items-center justify-center rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
            >
              {rejectStudentMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Rejecting...
                </span>
              ) : (
                "Confirm Reject"
              )}
            </button>
          </div>
        </div>
      </ModalShell>

      <AnimatePresence>
        {profileStudent ? (
          <div className="fixed inset-0 z-[65] flex items-start justify-end">
            <button type="button" className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setProfileStudent(null)} />
            <motion.aside initial={{ x: 360, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 360, opacity: 0 }} transition={{ duration: 0.22 }} className="relative h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-2xl text-slate-900">Student Profile</h3>
                <button type="button" className="rounded-full border border-slate-200 p-2 text-slate-500" onClick={() => setProfileStudent(null)}>
                  <FiX className="h-4 w-4" />
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
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3"><p className="text-xs text-blue-700">Enrolled Courses</p><p className="mt-1 text-xl font-semibold text-blue-900">{profileStudent.enrolledCourses.length}</p></div>
                  <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3"><p className="text-xs text-violet-700">Certificates Earned</p><p className="mt-1 text-xl font-semibold text-violet-900">{profileStudent.certificates.length}</p></div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Avg Progress</p><p className="mt-1 text-xl font-semibold text-emerald-900">{Math.max(0, Math.min(100, Number(profileStudent.avgProgress || 0)))}%</p></div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3"><p className="text-xs text-amber-700">Completed Courses</p><p className="mt-1 text-xl font-semibold text-amber-900">{Number(profileStudent.completedCourses || 0)}</p></div>
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
                  <div className="flex items-center justify-between"><span className="text-slate-500">Violation Count</span><span className="font-semibold text-slate-900">{Number(profileStudent.securityViolationCount || 0)}/{Number(profileStudent.securityViolationLimit || 3)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Last Violation</span><span className="font-semibold text-slate-900">{profileStudent.lastSecurityViolationReason || "N/A"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Last Violation At</span><span className="font-semibold text-slate-900">{profileStudent.lastSecurityViolationAt ? formatDate(profileStudent.lastSecurityViolationAt) : "N/A"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Deactivated At</span><span className="font-semibold text-slate-900">{profileStudent.securityDeactivatedAt ? formatDate(profileStudent.securityDeactivatedAt) : "N/A"}</span></div>
                </div>
                {profileStudent.recentSecurityViolations?.length ? (
                  <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    <p className="font-semibold text-slate-700">Recent Violations</p>
                    {profileStudent.recentSecurityViolations.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <span className="font-semibold text-slate-700">{item.reason || "default"} ({item.page || "unknown"})</span>
                        <span className="text-slate-500">{item.createdAt ? formatDate(item.createdAt) : "N/A"}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
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
