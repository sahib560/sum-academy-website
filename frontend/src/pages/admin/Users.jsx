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
  getTeachers,
  getUsers,
  resetUserDevice,
  setUserRole,
  updateUser,
} from "../../services/admin.service.js";

const TAB_OPTIONS = [
  { key: "all", label: "All" },
  { key: "student", label: "Students" },
  { key: "teacher", label: "Teachers" },
  { key: "admin", label: "Admins" },
];

const ROLE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "admin", label: "Admin" },
];

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PHONE_REGEX = /^(?:\+92|0)3\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const roleBadgeClass = {
  admin: "bg-purple-50 text-purple-600 border-purple-100",
  teacher: "bg-blue-50 text-blue-600 border-blue-100",
  student: "bg-emerald-50 text-emerald-600 border-emerald-100",
};

const avatarClass = {
  admin: "bg-purple-100 text-purple-700",
  teacher: "bg-blue-100 text-blue-700",
  student: "bg-emerald-100 text-emerald-700",
};

const emptyAddForm = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  role: "",
};

const emptyEditForm = {
  uid: "",
  fullName: "",
  isActive: true,
  role: "",
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
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const formatRole = (role) => {
  if (!role) return "Unknown";
  return role.charAt(0).toUpperCase() + role.slice(1);
};

const emailName = (email = "") =>
  email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "User";

const getInitials = (name = "", email = "") => {
  const source = name || emailName(email);
  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const normalizeUsers = (users = [], teachers = [], students = []) => {
  const teacherMap = new Map(teachers.map((teacher) => [teacher.uid || teacher.id, teacher]));
  const studentMap = new Map(students.map((student) => [student.uid || student.id, student]));

  return users.map((user) => {
    const uid = user.uid || user.id;
    const teacher = teacherMap.get(uid);
    const student = studentMap.get(uid);
    const fullName =
      teacher?.fullName ||
      student?.fullName ||
      user.fullName ||
      user.name ||
      "";
    const displayName = fullName || emailName(user.email);

    return {
      ...user,
      uid,
      fullName,
      displayName,
      joinedDate: formatDate(user.createdAt),
      initials: getInitials(displayName, user.email),
      isActive: user.isActive !== false,
      assignedWebDevice: user.assignedWebDevice || "",
      assignedWebIp: user.assignedWebIp || "",
    };
  });
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
    errors.phone = "Phone is required.";
  } else if (!PHONE_REGEX.test(values.phone.trim())) {
    errors.phone = "Use 03003425849 or +923003425849 format.";
  }

  if (!values.role) {
    errors.role = "Role is required.";
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

  if (!values.role) {
    errors.role = "Role is required.";
  }

  return errors;
};

const validateResetForm = (values) => {
  const errors = {};
  if (!values.device.trim() && !values.webIp.trim()) {
    errors.device = "Enter a new device or a new web IP.";
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
            aria-label="Close modal"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
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
              <div>
                <h3 className="font-heading text-2xl text-slate-900">{title}</h3>
              </div>
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

function TextInput({
  label,
  error,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`mt-2 w-full rounded-2xl border px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition ${
          error
            ? "border-rose-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            : "border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10"
        } ${disabled ? "bg-slate-100 text-slate-400" : "bg-white"}`}
      />
      <FieldError message={error} />
    </div>
  );
}

function SelectInput({ label, error, value, onChange, options }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className={`mt-2 w-full rounded-2xl border px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition ${
          error
            ? "border-rose-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            : "border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10"
        } bg-white`}
      >
        <option value="">Select role</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError message={error} />
    </div>
  );
}

function StatusSwitch({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-7 w-14 items-center rounded-full border shadow-sm transition-all duration-200 ${
        checked
          ? "border-emerald-300 bg-emerald-400"
          : "border-slate-200 bg-slate-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:shadow-md"}`}
      aria-pressed={checked}
      aria-label="Toggle active status"
    >
      <span className="sr-only">{checked ? "Active" : "Inactive"}</span>
      <span
        className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-7" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function Users() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);

  const [addForm, setAddForm] = useState(emptyAddForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [resetForm, setResetForm] = useState(emptyResetForm);

  const [addTouched, setAddTouched] = useState({});
  const [editTouched, setEditTouched] = useState({});
  const [resetTouched, setResetTouched] = useState({});

  const [selectedUser, setSelectedUser] = useState(null);
  const [pendingStatusMap, setPendingStatusMap] = useState({});
  const [showAddPassword, setShowAddPassword] = useState(false);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(searchInput.trim().toLowerCase()),
      300
    );
    return () => clearTimeout(timer);
  }, [searchInput]);

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => getUsers(),
    staleTime: 30000,
  });

  const teachersQuery = useQuery({
    queryKey: ["admin", "teachers"],
    queryFn: getTeachers,
    staleTime: 30000,
  });

  const studentsQuery = useQuery({
    queryKey: ["admin", "students"],
    queryFn: getStudents,
    staleTime: 30000,
  });

  const invalidateUsersData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] }),
    ]);
  };

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      await invalidateUsersData();
      setIsAddOpen(false);
      setAddForm(emptyAddForm);
      setAddTouched({});
      toast.success("User created successfully.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to create user.");
    },
  });

  const editUserMutation = useMutation({
    mutationFn: async (values) => {
      await updateUser(values.uid, {
        name: values.fullName.trim(),
        isActive: values.isActive,
      });

      if (selectedUser?.role !== values.role) {
        await setUserRole(values.uid, values.role);
      }
    },
    onSuccess: async () => {
      await invalidateUsersData();
      setIsEditOpen(false);
      setSelectedUser(null);
      setEditTouched({});
      toast.success("User updated successfully.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to update user.");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (uid) => deleteUser(uid),
    onSuccess: async () => {
      await invalidateUsersData();
      setIsDeleteOpen(false);
      setSelectedUser(null);
      toast.success("User deleted.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to delete user.");
    },
  });

  const resetDeviceMutation = useMutation({
    mutationFn: ({ uid, data }) => resetUserDevice(uid, data),
    onSuccess: async () => {
      await invalidateUsersData();
      setIsResetOpen(false);
      setSelectedUser(null);
      setResetTouched({});
      setResetForm(emptyResetForm);
      toast.success("Device reset. User can login again.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to reset device.");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ uid, nextValue }) => updateUser(uid, { isActive: nextValue }),
    onMutate: ({ uid, nextValue }) => {
      setPendingStatusMap((prev) => ({ ...prev, [uid]: nextValue }));
    },
    onSuccess: async (_data, { uid }) => {
      await invalidateUsersData();
      setPendingStatusMap((prev) => {
        const next = { ...prev };
        delete next[uid];
        return next;
      });
      toast.success("User status updated.");
    },
    onError: (error, { uid }) => {
      setPendingStatusMap((prev) => {
        const next = { ...prev };
        delete next[uid];
        return next;
      });
      toast.error(error?.response?.data?.error || "Failed to update user status.");
    },
  });

  const users = useMemo(
    () =>
      normalizeUsers(
        usersQuery.data || [],
        teachersQuery.data || [],
        studentsQuery.data || []
      ),
    [studentsQuery.data, teachersQuery.data, usersQuery.data]
  );

  const counts = useMemo(
    () => ({
      all: users.length,
      student: users.filter((user) => user.role === "student").length,
      teacher: users.filter((user) => user.role === "teacher").length,
      admin: users.filter((user) => user.role === "admin").length,
    }),
    [users]
  );

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const tabMatch = activeTab === "all" || user.role === activeTab;
        const searchMatch =
          !debouncedSearch || user.email?.toLowerCase().includes(debouncedSearch);
        return tabMatch && searchMatch;
      }),
    [activeTab, debouncedSearch, users]
  );

  const perPage = 10;
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / perPage));
  const paginatedUsers = filteredUsers.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [activeTab, debouncedSearch]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const addErrors = useMemo(() => validateAddForm(addForm), [addForm]);
  const editErrors = useMemo(() => validateEditForm(editForm), [editForm]);
  const resetErrors = useMemo(() => validateResetForm(resetForm), [resetForm]);

  const isLoading =
    usersQuery.isLoading || teachersQuery.isLoading || studentsQuery.isLoading;

  const openAddModal = () => {
    setAddForm(emptyAddForm);
    setAddTouched({});
    setShowAddPassword(false);
    setIsAddOpen(true);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditForm({
      uid: user.uid,
      fullName: user.fullName || "",
      isActive: user.isActive,
      role: user.role,
    });
    setEditTouched({});
    setIsEditOpen(true);
  };

  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setIsDeleteOpen(true);
  };

  const openResetModal = (user) => {
    setSelectedUser(user);
    setResetForm({
      device: user.assignedWebDevice || "",
      webIp: user.assignedWebIp || "",
    });
    setResetTouched({});
    setIsResetOpen(true);
  };

  const handlePhoneChange = (value, setter) => {
    setter((prev) => ({
      ...prev,
      phone: value.replace(/(?!^\+)[^\d]/g, "").replace(/^(\+)?(.*)$/, (_m, plus, rest) => `${plus || ""}${rest.replace(/\+/g, "")}`),
    }));
  };

  const exportUsersPdf = () => {
    const doc = new jsPDF();
    const exportDate = new Date().toLocaleDateString("en-PK", {
      month: "short",
      day: "2-digit",
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
    doc.text("Users Export", 14, 34);
    doc.text(`Generated: ${exportDate}`, 14, 41);
    doc.text(`Filtered users: ${filteredUsers.length}`, 14, 48);

    let y = 60;
    filteredUsers.forEach((user, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, y - 6, 182, 18, 3, 3);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${index + 1}. ${user.displayName}`, 18, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(user.email || "N/A", 18, y + 6);
      doc.text(formatRole(user.role), 106, y);
      doc.text(user.isActive ? "Active" : "Inactive", 136, y);
      doc.text(user.joinedDate, 162, y);
      y += 24;
    });

    doc.save(`sum-academy-users-${Date.now()}.pdf`);
    toast.success("Users PDF exported.");
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
          success: {
            style: {
              border: "1px solid #bbf7d0",
            },
          },
          error: {
            style: {
              border: "1px solid #fecaca",
            },
          },
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">User Management</h2>
          <p className="text-sm text-slate-500">
            Manage students, teachers, and admin accounts from real backend data.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportUsersPdf}
            disabled={!filteredUsers.length}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export PDF
          </button>
          <button type="button" onClick={openAddModal} className="btn-primary">
            Add User
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.key
                ? "bg-primary text-white"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {tab.label}
            <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs">
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative max-w-md">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M10 4a6 6 0 1 0 3.9 10.6l4.7 4.7 1.4-1.4-4.7-4.7A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by email"
            className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-6 py-4">Avatar</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="border-b border-slate-100">
                    <td className="px-6 py-4">
                      <div className="skeleton h-12 w-12 rounded-full" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-5 w-52" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-20 rounded-full" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-24 rounded-full" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-5 w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="ml-auto flex w-28 gap-2">
                        <div className="skeleton h-9 w-9 rounded-full" />
                        <div className="skeleton h-9 w-9 rounded-full" />
                        <div className="skeleton h-9 w-9 rounded-full" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : usersQuery.isError ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-rose-500">
                    Failed to load users.
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    No users found
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => {
                  const displayedStatus =
                    pendingStatusMap[user.uid] !== undefined
                      ? pendingStatusMap[user.uid]
                      : user.isActive;

                  return (
                    <tr key={user.uid} className="border-b border-slate-100">
                      <td className="px-6 py-4">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${
                            avatarClass[user.role] || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {user.initials}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-900">{user.displayName}</p>
                          <p className="text-slate-500">{user.email || "N/A"}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                            roleBadgeClass[user.role] || "bg-slate-50 text-slate-600 border-slate-100"
                          }`}
                        >
                          {formatRole(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex min-w-[190px] items-center gap-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              displayedStatus
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-rose-50 text-rose-600"
                            }`}
                          >
                            {displayedStatus ? "Active" : "Inactive"}
                          </span>
                          <StatusSwitch
                            checked={displayedStatus}
                            disabled={statusMutation.isPending}
                            onChange={() =>
                              statusMutation.mutate({
                                uid: user.uid,
                                nextValue: !displayedStatus,
                              })
                            }
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{user.joinedDate}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:text-primary"
                            aria-label="Edit user"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                              <path d="M3 17.2V21h3.8l11-11-3.8-3.8-11 11zm17.7-10.5a1 1 0 0 0 0-1.4l-2-2a1 1 0 0 0-1.4 0l-1.6 1.6 3.8 3.8 1.2-1z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(user)}
                            className="rounded-full border border-slate-200 p-2 text-rose-500 transition hover:text-rose-600"
                            aria-label="Delete user"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                              <path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => openResetModal(user)}
                            className="rounded-full border border-slate-200 p-2 text-orange-500 transition hover:text-orange-600"
                            aria-label="Reset device"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                              <path d="M12 6V3L8 7l4 4V8c2.8 0 5 2.2 5 5a5 5 0 0 1-9.9 1H5a7 7 0 1 0 7-8z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-4 lg:hidden">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={`mobile-skeleton-${index}`} className="skeleton h-28 w-full rounded-2xl" />
            ))
          ) : paginatedUsers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              No users found
            </div>
          ) : (
            paginatedUsers.map((user) => {
              const displayedStatus =
                pendingStatusMap[user.uid] !== undefined
                  ? pendingStatusMap[user.uid]
                  : user.isActive;

              return (
                <div
                  key={user.uid}
                  className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${
                        avatarClass[user.role] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {user.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">{user.displayName}</p>
                      <p className="truncate text-sm text-slate-500">{user.email || "N/A"}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                            roleBadgeClass[user.role] || "bg-slate-50 text-slate-600 border-slate-100"
                          }`}
                        >
                          {formatRole(user.role)}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            displayedStatus
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-rose-50 text-rose-600"
                          }`}
                        >
                          {displayedStatus ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          displayedStatus
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        {displayedStatus ? "Active" : "Inactive"}
                      </span>
                      <span className="text-xs text-slate-500">{user.joinedDate}</span>
                    </div>
                    <StatusSwitch
                      checked={displayedStatus}
                      disabled={statusMutation.isPending}
                      onChange={() =>
                        statusMutation.mutate({
                          uid: user.uid,
                          nextValue: !displayedStatus,
                        })
                      }
                    />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(user)}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(user)}
                      className="flex-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => openResetModal(user)}
                      className="flex-1 rounded-xl border border-orange-200 px-3 py-2 text-xs font-semibold text-orange-600"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
          <span>
            Page {page} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded-full border border-slate-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
              disabled={page === pageCount}
              className="rounded-full border border-slate-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <ModalShell open={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add User">
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setAddTouched({
              fullName: true,
              email: true,
              password: true,
              phone: true,
              role: true,
            });
            if (Object.keys(addErrors).length) return;

            createUserMutation.mutate({
              name: addForm.fullName.trim(),
              email: addForm.email.trim(),
              password: addForm.password,
              phone: addForm.phone.trim(),
              role: addForm.role,
            });
          }}
        >
          <TextInput
            label="Full Name"
            value={addForm.fullName}
            onChange={(event) => {
              setAddForm((prev) => ({ ...prev, fullName: event.target.value }));
              setAddTouched((prev) => ({ ...prev, fullName: true }));
            }}
            placeholder="Full Name"
            error={addTouched.fullName ? addErrors.fullName : ""}
          />

          <TextInput
            label="Email"
            type="email"
            value={addForm.email}
            onChange={(event) => {
              setAddForm((prev) => ({ ...prev, email: event.target.value }));
              setAddTouched((prev) => ({ ...prev, email: true }));
            }}
            placeholder="you@example.com"
            error={addTouched.email ? addErrors.email : ""}
          />

          <div>
            <label className="text-sm font-semibold text-slate-700">Password</label>
            <div className="relative mt-2">
              <input
                type={showAddPassword ? "text" : "password"}
                value={addForm.password}
                onChange={(event) => {
                  setAddForm((prev) => ({ ...prev, password: event.target.value }));
                  setAddTouched((prev) => ({ ...prev, password: true }));
                }}
                placeholder="Enter secure password"
                className={`w-full rounded-2xl border px-4 py-3 pr-12 text-sm text-slate-700 shadow-sm outline-none transition ${
                  addTouched.password && addErrors.password
                    ? "border-rose-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    : "border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10"
                } bg-white`}
              />
              <button
                type="button"
                onClick={() => setShowAddPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition hover:text-slate-700"
                aria-label={showAddPassword ? "Hide password" : "Show password"}
              >
                {showAddPassword ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M12 5c5 0 9.3 3.1 11 7-1.7 3.9-6 7-11 7S2.7 15.9 1 12c1.7-3.9 6-7 11-7zm0 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M2 5.3 3.3 4 20 20.7 18.7 22l-3.2-3.2A12.4 12.4 0 0 1 12 19C7 19 2.7 15.9 1 12c.8-1.8 2-3.4 3.5-4.7L2 5.3zm9.9 9.9a3.5 3.5 0 0 1-3.1-3.1l3.1 3.1zm7.2-1.7-2.2-2.2a3.5 3.5 0 0 0-4.2-4.2L9.3 6.4A8.7 8.7 0 0 1 12 5c5 0 9.3 3.1 11 7-.9 2.1-2.5 4-4.6 5.5z" />
                  </svg>
                )}
              </button>
            </div>
            <FieldError message={addTouched.password ? addErrors.password : ""} />
          </div>

          <TextInput
            label="Phone"
            value={addForm.phone}
            onChange={(event) => {
              handlePhoneChange(event.target.value, setAddForm);
              setAddTouched((prev) => ({ ...prev, phone: true }));
            }}
            placeholder="03003425849 or +923003425849"
            error={addTouched.phone ? addErrors.phone : ""}
          />

          <SelectInput
            label="Role"
            value={addForm.role}
            onChange={(event) => {
              setAddForm((prev) => ({ ...prev, role: event.target.value }));
              setAddTouched((prev) => ({ ...prev, role: true }));
            }}
            options={ROLE_OPTIONS}
            error={addTouched.role ? addErrors.role : ""}
          />

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createUserMutation.isPending}
              className="btn-primary min-w-32"
            >
              {createUserMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Saving...
                </span>
              ) : (
                "Create User"
              )}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell open={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit User">
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setEditTouched({ fullName: true, role: true });
            if (Object.keys(editErrors).length) return;
            editUserMutation.mutate(editForm);
          }}
        >
          <TextInput
            label="Full Name"
            value={editForm.fullName}
            onChange={(event) => {
              setEditForm((prev) => ({ ...prev, fullName: event.target.value }));
              setEditTouched((prev) => ({ ...prev, fullName: true }));
            }}
            placeholder="Full Name"
            error={editTouched.fullName ? editErrors.fullName : ""}
          />

          <SelectInput
            label="Role"
            value={editForm.role}
            onChange={(event) => {
              setEditForm((prev) => ({ ...prev, role: event.target.value }));
              setEditTouched((prev) => ({ ...prev, role: true }));
            }}
            options={ROLE_OPTIONS}
            error={editTouched.role ? editErrors.role : ""}
          />

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Account Status</p>
                <p className="text-xs text-slate-500">
                  Toggle whether this user can access the system.
                </p>
              </div>
              <StatusSwitch
                checked={editForm.isActive}
                onChange={() =>
                  setEditForm((prev) => ({ ...prev, isActive: !prev.isActive }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editUserMutation.isPending}
              className="btn-primary min-w-32"
            >
              {editUserMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Saving...
                </span>
              ) : (
                "Update User"
              )}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete User"
        maxWidth="max-w-md"
      >
        <div className="mt-6 space-y-6">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-slate-900">
              {selectedUser?.email || "this user"}
            </span>
            ?
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteUserMutation.mutate(selectedUser?.uid)}
              disabled={deleteUserMutation.isPending}
              className="rounded-full bg-rose-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-60"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title="Reset Device"
      >
        <div className="mt-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">Current Device:</span>{" "}
              {selectedUser?.assignedWebDevice || "Not set"}
            </p>
            <p className="mt-2">
              <span className="font-semibold text-slate-900">Current Web IP:</span>{" "}
              {selectedUser?.assignedWebIp || "Not set"}
            </p>
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setResetTouched({ device: true, webIp: true });
              if (Object.keys(resetErrors).length) return;
              resetDeviceMutation.mutate({
                uid: selectedUser?.uid,
                data: {
                  device: resetForm.device.trim(),
                  webIp: resetForm.webIp.trim(),
                },
              });
            }}
          >
            <TextInput
              label="New Device"
              value={resetForm.device}
              onChange={(event) => {
                setResetForm((prev) => ({ ...prev, device: event.target.value }));
                setResetTouched((prev) => ({ ...prev, device: true }));
              }}
              placeholder="Chrome on Windows"
              error={resetTouched.device ? resetErrors.device : ""}
            />

            <TextInput
              label="New Web IP"
              value={resetForm.webIp}
              onChange={(event) => {
                setResetForm((prev) => ({ ...prev, webIp: event.target.value }));
                setResetTouched((prev) => ({ ...prev, webIp: true }));
              }}
              placeholder="127.0.0.1"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resetDeviceMutation.isPending}
                className="btn-primary min-w-32"
              >
                {resetDeviceMutation.isPending ? "Updating..." : "Reset Device"}
              </button>
            </div>
          </form>
        </div>
      </ModalShell>
    </div>
  );
}

export default Users;
