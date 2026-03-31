import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "react-hot-toast";
import { FiX } from "react-icons/fi";
import {
  addClassCourse,
  addClassShift,
  addStudentToClass,
  createClass,
  deleteClass,
  deleteClassShift,
  getClasses,
  getClassStudents,
  getCourses,
  getStudents,
  getTeachers,
  removeClassCourse,
  removeStudentFromClass,
  updateClass,
  updateClassShift,
} from "../../services/admin.service.js";

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

const CREATE_STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
];

const SHIFT_NAME_OPTIONS = ["Morning", "Evening", "Night", "Weekend", "Custom"];
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const SHORT_DAYS = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const shiftBadgeClass = {
  Morning: "bg-amber-100 text-amber-700",
  Evening: "bg-indigo-100 text-indigo-700",
  Night: "bg-slate-200 text-slate-700",
  Weekend: "bg-emerald-100 text-emerald-700",
  Custom: "bg-primary/15 text-primary",
};

const statusBadgeClass = {
  upcoming: "bg-amber-100 text-amber-700 border-amber-200",
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  completed: "bg-slate-200 text-slate-700 border-slate-300",
};

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?._seconds === "number") return new Date(value._seconds * 1000);
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDateInput = (value) => {
  const date = parseDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
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

const formatTime = (value = "") => {
  if (!/^\d{2}:\d{2}$/.test(value)) return value || "N/A";
  const [hour, minutes] = value.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

const toMinutes = (value = "") => {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minutes] = value.split(":").map(Number);
  return hour * 60 + minutes;
};

const toLocalDateInput = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTodayInputDate = () => toLocalDateInput(new Date());

const normalizeStatus = (value = "upcoming") => {
  const normalized = String(value).trim().toLowerCase();
  return ["upcoming", "active", "completed"].includes(normalized)
    ? normalized
    : "upcoming";
};

const uniqueById = (list = []) => {
  const seen = new Set();
  return list.filter((item) => {
    if (!item?.id) return false;
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const getTeacherInitials = (name = "") =>
  String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const normalizeClass = (row = {}) => {
  const assignedCourses = Array.isArray(row.assignedCourses) ? row.assignedCourses : [];
  const shifts = Array.isArray(row.shifts)
    ? row.shifts.map((shift) => ({
        id: shift.id || makeId(),
        name: shift.name || "Morning",
        days: Array.isArray(shift.days) ? shift.days : [],
        startTime: shift.startTime || "",
        endTime: shift.endTime || "",
        teacherId: shift.teacherId || "",
        teacherName: shift.teacherName || "",
        courseId: shift.courseId || "",
        courseName: shift.courseName || "",
        room: shift.room || "",
      }))
    : [];
  const teachers = Array.isArray(row.teachers)
    ? row.teachers
    : uniqueById(
        shifts.map((shift) => ({
          id: shift.teacherId,
          teacherId: shift.teacherId,
          teacherName: shift.teacherName || "Unknown Teacher",
        }))
      );

  return {
    ...row,
    id: row.id || row.uid || "",
    name: row.name || "",
    batchCode: row.batchCode || "",
    description: row.description || "",
    status: normalizeStatus(row.status),
    capacity: Number(row.capacity || 0),
    enrolledCount: Number(row.enrolledCount || 0),
    students: Array.isArray(row.students) ? row.students : [],
    assignedCourses,
    shifts,
    teachers,
    startDate: row.startDate || null,
    endDate: row.endDate || null,
  };
};

const emptyShift = () => ({
  id: makeId(),
  name: "Morning",
  days: ["Monday", "Wednesday", "Friday"],
  startTime: "09:00",
  endTime: "11:00",
  teacherId: "",
  courseId: "",
  room: "",
});

const emptyClassForm = () => ({
  name: "",
  description: "",
  status: "upcoming",
  capacity: 30,
  startDate: "",
  endDate: "",
  assignedCourses: [],
  shifts: [emptyShift()],
});

const validateBasicInfo = (values) => {
  const errors = {};
  if (!values.name.trim()) {
    errors.name = "Class name is required.";
  } else if (values.name.trim().length < 3) {
    errors.name = "Class name must be at least 3 characters.";
  }

  const parsedCapacity = Number(values.capacity);
  if (!Number.isFinite(parsedCapacity)) {
    errors.capacity = "Capacity is required.";
  } else if (parsedCapacity < 1 || parsedCapacity > 1000) {
    errors.capacity = "Capacity must be between 1 and 1000.";
  }

  if (!values.startDate) {
    errors.startDate = "Start date is required.";
  } else {
    const start = new Date(values.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    if (start < today) {
      errors.startDate = "Start date cannot be in the past.";
    }
  }

  if (!values.endDate) {
    errors.endDate = "End date is required.";
  } else if (values.startDate) {
    const start = new Date(values.startDate);
    const end = new Date(values.endDate);
    if (end <= start) {
      errors.endDate = "End date must be after start date.";
    }
  }

  return errors;
};

const validateCoursesStep = (values) => {
  if (!Array.isArray(values.assignedCourses) || values.assignedCourses.length < 1) {
    return { assignedCourses: "At least 1 course is required." };
  }
  return {};
};

const validateShiftRow = (shift, index = 0, classStartDate = "") => {
  const errors = {};
  const prefix = `shift-${index}`;

  if (!shift.name?.trim()) {
    errors[`${prefix}-name`] = "Shift name is required.";
  }
  if (!Array.isArray(shift.days) || shift.days.length < 1) {
    errors[`${prefix}-days`] = "Select at least one day.";
  }
  const startMinutes = toMinutes(shift.startTime);
  const endMinutes = toMinutes(shift.endTime);
  if (startMinutes === null) {
    errors[`${prefix}-startTime`] = "Start time is required.";
  }
  if (endMinutes === null) {
    errors[`${prefix}-endTime`] = "End time is required.";
  }
  if (startMinutes !== null && endMinutes !== null && startMinutes >= endMinutes) {
    errors[`${prefix}-endTime`] = "End time must be after start time.";
  }
  const todayInput = getTodayInputDate();
  if (classStartDate === todayInput && startMinutes !== null) {
    const now = new Date();
    const minMinutes = now.getHours() * 60 + now.getMinutes() + 60;
    if (minMinutes >= 24 * 60) {
      errors[`${prefix}-startTime`] =
        "Today is almost over. Please choose tomorrow as start date.";
    } else if (startMinutes < minMinutes) {
      errors[`${prefix}-startTime`] =
        "For today, start time must be at least 1 hour from now.";
    }
  }
  if (!shift.courseId) {
    errors[`${prefix}-courseId`] = "Course is required.";
  }
  if (!shift.teacherId) {
    errors[`${prefix}-teacherId`] = "Teacher is required.";
  }

  return errors;
};

const validateShiftsStep = (values) => {
  const errors = {};
  if (!Array.isArray(values.shifts) || values.shifts.length < 1) {
    errors.shifts = "At least 1 shift is required.";
    return errors;
  }
  values.shifts.forEach((shift, index) => {
    Object.assign(errors, validateShiftRow(shift, index, values.startDate));
  });
  return errors;
};

function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-rose-500">{message}</p>;
}

function ModalShell({
  open,
  title,
  onClose,
  children,
  maxWidth = "max-w-3xl",
  fullHeight = false,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const dialog = dialogRef.current;
    const focusTarget =
      dialog?.querySelector("input, select, textarea, button:not([aria-label='Close'])") ||
      dialog?.querySelector(FOCUSABLE_SELECTOR);
    focusTarget?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const nodes = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (node) => !node.hasAttribute("disabled")
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
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
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <Motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2 }}
            className={`relative z-10 flex w-full ${maxWidth} ${
              fullHeight ? "h-[92vh]" : "max-h-[92vh]"
            } flex-col overflow-hidden rounded-3xl bg-white p-6 shadow-2xl`}
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
            <div className="mt-4 overflow-y-auto pr-1">{children}</div>
          </Motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function DrawerShell({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[85] flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={onClose}
            aria-label="Close drawer"
          />
          <Motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25 }}
            className="relative z-10 h-full w-full max-w-6xl overflow-hidden bg-white shadow-2xl"
          >
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-heading text-2xl text-slate-900">{title}</h3>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">{children}</div>
            </div>
          </Motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function StatusBadge({ status }) {
  const normalized = normalizeStatus(status);
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        statusBadgeClass[normalized] || "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      {normalized}
    </span>
  );
}

function ShiftFormFields({
  shift,
  index,
  courses,
  teacherOptions,
  lockCourseSelection = false,
  onChange,
  onRemove,
  errors,
  removeDisabled = false,
}) {
  const prefix = `shift-${index}`;
  const selectedCourseName =
    courses.find((course) => course.courseId === shift.courseId)?.courseName ||
    "Assigned Course";

  const toggleDay = (day) => {
    const nextDays = shift.days.includes(day)
      ? shift.days.filter((item) => item !== day)
      : [...shift.days, day];
    onChange(index, "days", nextDays);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Shift Name
          </label>
          <select
            value={shift.name}
            onChange={(event) => onChange(index, "name", event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {SHIFT_NAME_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <FieldError message={errors[`${prefix}-name`]} />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Start Time
          </label>
          <input
            type="time"
            value={shift.startTime}
            onChange={(event) => onChange(index, "startTime", event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <FieldError message={errors[`${prefix}-startTime`]} />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            End Time
          </label>
          <input
            type="time"
            value={shift.endTime}
            onChange={(event) => onChange(index, "endTime", event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <FieldError message={errors[`${prefix}-endTime`]} />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Course
          </label>
          {lockCourseSelection ? (
            <div className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              {selectedCourseName}
            </div>
          ) : (
            <select
              value={shift.courseId}
              onChange={(event) => onChange(index, "courseId", event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select course</option>
              {courses.map((course) => (
                <option key={course.courseId} value={course.courseId}>
                  {course.courseName || "Untitled Course"}
                </option>
              ))}
            </select>
          )}
          <FieldError message={errors[`${prefix}-courseId`]} />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Teacher
          </label>
          <select
            value={shift.teacherId}
            onChange={(event) => onChange(index, "teacherId", event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select teacher</option>
            {teacherOptions.map((teacher) => (
              <option key={teacher.id || teacher.teacherId} value={teacher.id || teacher.teacherId}>
                {teacher.fullName || teacher.teacherName || "Unknown Teacher"}
              </option>
            ))}
          </select>
          <FieldError message={errors[`${prefix}-teacherId`]} />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Room
          </label>
          <input
            type="text"
            value={shift.room}
            onChange={(event) => onChange(index, "room", event.target.value)}
            placeholder="Room (optional)"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Days
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS.map((day) => {
            const active = shift.days.includes(day);
            return (
              <button
                key={`${shift.id}-${day}`}
                type="button"
                onClick={() => toggleDay(day)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {SHORT_DAYS[day]}
              </button>
            );
          })}
        </div>
        <FieldError message={errors[`${prefix}-days`]} />
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={removeDisabled}
          className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Remove Shift
        </button>
      </div>
    </div>
  );
}

function Classes() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [classModalMode, setClassModalMode] = useState("create");
  const [classModalStep, setClassModalStep] = useState(1);
  const [editingClassId, setEditingClassId] = useState("");
  const [classForm, setClassForm] = useState(emptyClassForm);
  const [classErrors, setClassErrors] = useState({});
  const [courseSelectForForm, setCourseSelectForForm] = useState("");

  const [drawerClassId, setDrawerClassId] = useState("");
  const [drawerTab, setDrawerTab] = useState("overview");
  const [drawerCourseId, setDrawerCourseId] = useState("");

  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftModalMode, setShiftModalMode] = useState("create");
  const [shiftForm, setShiftForm] = useState(emptyShift());
  const [shiftErrors, setShiftErrors] = useState({});
  const [editingShiftId, setEditingShiftId] = useState("");

  const [studentSearch, setStudentSearch] = useState("");
  const [enrollStudentId, setEnrollStudentId] = useState("");
  const [enrollShiftId, setEnrollShiftId] = useState("");

  const [deleteClassTarget, setDeleteClassTarget] = useState(null);
  const [deleteShiftTarget, setDeleteShiftTarget] = useState(null);
  const [removeStudentTarget, setRemoveStudentTarget] = useState(null);
  const classSaveIntentRef = useRef(false);

  const classesQuery = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: getClasses,
    staleTime: 30000,
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

  const studentsQuery = useQuery({
    queryKey: ["admin", "students"],
    queryFn: getStudents,
    staleTime: 30000,
  });

  const classStudentsQuery = useQuery({
    queryKey: ["admin", "class-students", drawerClassId],
    queryFn: () => getClassStudents(drawerClassId),
    enabled: Boolean(drawerClassId),
    staleTime: 10000,
  });

  const classes = useMemo(
    () => (classesQuery.data || []).map((item) => normalizeClass(item)),
    [classesQuery.data]
  );
  const courses = useMemo(() => coursesQuery.data || [], [coursesQuery.data]);
  const teachers = useMemo(
    () =>
      (teachersQuery.data || []).map((teacher) => ({
        ...teacher,
        id: teacher.id || teacher.uid || "",
      })),
    [teachersQuery.data]
  );
  const activeTeachers = useMemo(
    () => teachers.filter((teacher) => teacher.isActive !== false),
    [teachers]
  );
  const activeTeachersById = useMemo(
    () =>
      activeTeachers.reduce((acc, teacher) => {
        const key = teacher.id || teacher.teacherId || "";
        if (key) acc[key] = teacher;
        return acc;
      }, {}),
    [activeTeachers]
  );
  const selectableCourseIdsForClass = useMemo(() => {
    const selectable = new Set();
    courses.forEach((course) => {
      const subjects = Array.isArray(course?.subjects) ? course.subjects : [];
      if (subjects.length < 1) {
        if (activeTeachers.length > 0) {
          selectable.add(course.id);
        }
        return;
      }
      const hasActiveSubjectTeacher = subjects.some((subject) => {
        const teacherId = String(subject?.teacherId || "").trim();
        return Boolean(teacherId && activeTeachersById[teacherId]);
      });
      if (hasActiveSubjectTeacher) {
        selectable.add(course.id);
      }
    });
    return selectable;
  }, [courses, activeTeachers, activeTeachersById]);
  const selectableCoursesForClass = useMemo(
    () => courses.filter((course) => selectableCourseIdsForClass.has(course.id)),
    [courses, selectableCourseIdsForClass]
  );
  const students = useMemo(
    () =>
      (studentsQuery.data || []).map((student) => ({
        ...student,
        uid: student.uid || student.id || "",
        fullName:
          student.fullName ||
          (student.email ? student.email.split("@")[0] : "Unknown Student"),
      })),
    [studentsQuery.data]
  );
  const classStudents = useMemo(
    () => classStudentsQuery.data || [],
    [classStudentsQuery.data]
  );

  const activeClass = useMemo(
    () => classes.find((item) => item.id === drawerClassId) || null,
    [classes, drawerClassId]
  );

  const loading =
    classesQuery.isLoading ||
    coursesQuery.isLoading ||
    teachersQuery.isLoading ||
    studentsQuery.isLoading;

  const filteredClasses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return classes.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.batchCode.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [classes, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      totalClasses: classes.length,
      activeClasses: classes.filter((item) => item.status === "active").length,
      totalStudents: classes.reduce(
        (sum, item) => sum + Number(item.enrolledCount || 0),
        0
      ),
      upcomingClasses: classes.filter((item) => item.status === "upcoming").length,
    };
  }, [classes]);

  const refreshClasses = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
  };
  const refreshClassStudents = async () => {
    if (!drawerClassId) return;
    await queryClient.invalidateQueries({
      queryKey: ["admin", "class-students", drawerClassId],
    });
  };

  const createClassMutation = useMutation({
    mutationFn: createClass,
    onSuccess: async () => {
      await refreshClasses();
      setIsClassModalOpen(false);
      setClassForm(emptyClassForm());
      setClassErrors({});
      toast.success("Class created successfully.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to create class.");
    },
  });

  const updateClassMutation = useMutation({
    mutationFn: ({ classId, data }) => updateClass(classId, data),
    onSuccess: async () => {
      await refreshClasses();
      setIsClassModalOpen(false);
      setClassErrors({});
      toast.success("Class updated successfully.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to update class.");
    },
  });

  const deleteClassMutation = useMutation({
    mutationFn: deleteClass,
    onSuccess: async () => {
      await refreshClasses();
      if (deleteClassTarget?.id === drawerClassId) {
        setDrawerClassId("");
      }
      setDeleteClassTarget(null);
      toast.success("Class deleted.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to delete class.");
    },
  });

  const addClassCourseMutation = useMutation({
    mutationFn: ({ classId, courseId }) => addClassCourse(classId, courseId),
    onSuccess: async () => {
      await refreshClasses();
      setDrawerCourseId("");
      toast.success("Course assigned to class.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to assign course.");
    },
  });

  const removeClassCourseMutation = useMutation({
    mutationFn: ({ classId, courseId }) => removeClassCourse(classId, courseId),
    onSuccess: async () => {
      await refreshClasses();
      await refreshClassStudents();
      toast.success("Course removed from class.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to remove course.");
    },
  });

  const addShiftMutation = useMutation({
    mutationFn: ({ classId, data }) => addClassShift(classId, data),
    onSuccess: async () => {
      await refreshClasses();
      await refreshClassStudents();
      setIsShiftModalOpen(false);
      setShiftErrors({});
      setShiftForm(emptyShift());
      toast.success("Shift added successfully.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to add shift.");
    },
  });

  const updateShiftMutation = useMutation({
    mutationFn: ({ classId, shiftId, data }) =>
      updateClassShift(classId, shiftId, data),
    onSuccess: async () => {
      await refreshClasses();
      await refreshClassStudents();
      setIsShiftModalOpen(false);
      setShiftErrors({});
      setShiftForm(emptyShift());
      setEditingShiftId("");
      toast.success("Shift updated successfully.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to update shift.");
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: ({ classId, shiftId }) => deleteClassShift(classId, shiftId),
    onSuccess: async () => {
      await refreshClasses();
      await refreshClassStudents();
      setDeleteShiftTarget(null);
      toast.success("Shift removed.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to remove shift.");
    },
  });

  const addStudentMutation = useMutation({
    mutationFn: ({ classId, data }) => addStudentToClass(classId, data),
    onSuccess: async () => {
      await refreshClasses();
      await refreshClassStudents();
      setEnrollStudentId("");
      setEnrollShiftId("");
      toast.success("Student added to class.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to add student.");
    },
  });

  const removeStudentMutation = useMutation({
    mutationFn: ({ classId, studentId }) => removeStudentFromClass(classId, studentId),
    onSuccess: async () => {
      await refreshClasses();
      await refreshClassStudents();
      setRemoveStudentTarget(null);
      toast.success("Student removed from class.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to remove student.");
    },
  });

  const getCourseMetaById = (courseId) => {
    const course = courses.find((item) => item.id === courseId);
    if (!course) return null;
    return {
      courseId: course.id,
      courseName: course.title || "Untitled Course",
      subjectName:
        Array.isArray(course.subjects) && course.subjects[0]?.name
          ? course.subjects[0].name
          : course.category || "",
    };
  };

  const getTeacherOptionsForCourse = (courseId) => {
    if (!courseId) return [];
    const course = courses.find((item) => item.id === courseId);
    const subjects = Array.isArray(course?.subjects) ? course.subjects : [];
    const fromSubjects = subjects
      .map((subject) => {
        const teacherId = String(subject?.teacherId || "").trim();
        if (!teacherId) return null;
        const activeTeacher = activeTeachersById[teacherId];
        if (!activeTeacher) return null;
        return {
          id: teacherId,
          fullName:
            activeTeacher.fullName ||
            activeTeacher.teacherName ||
            String(subject?.teacherName || "").trim(),
        };
      })
      .filter((teacher) => teacher?.id && teacher?.fullName);

    if (subjects.length > 0) {
      if (fromSubjects.length < 1) return [];
      const unique = [];
      const seen = new Set();
      fromSubjects.forEach((teacher) => {
        if (!seen.has(teacher.id)) {
          seen.add(teacher.id);
          unique.push(teacher);
        }
      });
      return unique;
    }

    return activeTeachers;
  };

  useEffect(() => {
    if (classForm.assignedCourses.length !== 1) return;
    const onlyCourseId = classForm.assignedCourses[0].courseId;
    setClassForm((prev) => {
      const nextShifts = prev.shifts.map((shift) => {
        if (shift.courseId === onlyCourseId) return shift;
        return {
          ...shift,
          courseId: onlyCourseId,
          teacherId: "",
        };
      });
      const changed = nextShifts.some((shift, index) => shift !== prev.shifts[index]);
      if (!changed) return prev;
      return { ...prev, shifts: nextShifts };
    });
  }, [classForm.assignedCourses]);

  const openCreateClassModal = () => {
    classSaveIntentRef.current = false;
    setClassModalMode("create");
    setEditingClassId("");
    setClassModalStep(1);
    setClassForm(emptyClassForm());
    setClassErrors({});
    setCourseSelectForForm("");
    setIsClassModalOpen(true);
  };

  const openEditClassModal = (classItem) => {
    const formData = {
      name: classItem.name || "",
      description: classItem.description || "",
      status: classItem.status || "upcoming",
      capacity: Number(classItem.capacity || 30),
      startDate: toDateInput(classItem.startDate),
      endDate: toDateInput(classItem.endDate),
      assignedCourses: (classItem.assignedCourses || []).map((course) => ({
        courseId: course.courseId,
        courseName: course.courseName || "Untitled Course",
        subjectName: course.subjectName || "",
      })),
      shifts:
        classItem.shifts?.length > 0
          ? classItem.shifts.map((shift) => ({
              id: shift.id || makeId(),
              name: shift.name || "Morning",
              days: Array.isArray(shift.days) ? shift.days : [],
              startTime: shift.startTime || "",
              endTime: shift.endTime || "",
              teacherId: shift.teacherId || "",
              courseId: shift.courseId || "",
              room: shift.room || "",
            }))
          : [emptyShift()],
    };

    classSaveIntentRef.current = false;
    setClassModalMode("edit");
    setEditingClassId(classItem.id);
    setClassModalStep(1);
    setClassForm(formData);
    setClassErrors({});
    setCourseSelectForForm("");
    setIsClassModalOpen(true);
  };

  const validateStep = (step) => {
    let errors = {};
    if (step === 1) {
      errors = validateBasicInfo(classForm);
    } else if (step === 2) {
      errors = validateCoursesStep(classForm);
    } else if (step === 3) {
      errors = validateShiftsStep(classForm);
    }
    setClassErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (!validateStep(classModalStep)) return;
    setClassModalStep((prev) => Math.min(3, prev + 1));
  };

  const handlePrevStep = () => {
    setClassModalStep((prev) => Math.max(1, prev - 1));
  };

  const handleAddCourseToForm = () => {
    if (!courseSelectForForm) return;
    if (!selectableCourseIdsForClass.has(courseSelectForForm)) {
      toast.error("This course has no active teacher available.");
      return;
    }
    if (classForm.assignedCourses.some((course) => course.courseId === courseSelectForForm)) {
      toast.error("Course already added.");
      return;
    }
    const meta = getCourseMetaById(courseSelectForForm);
    if (!meta) {
      toast.error("Course not found.");
      return;
    }

    setClassForm((prev) => ({
      ...prev,
      assignedCourses: [...prev.assignedCourses, meta],
    }));
    setCourseSelectForForm("");
  };

  const handleRemoveCourseFromForm = (courseId) => {
    setClassForm((prev) => {
      const nextCourses = prev.assignedCourses.filter((course) => course.courseId !== courseId);
      const nextShifts = prev.shifts.map((shift) =>
        shift.courseId === courseId
          ? {
              ...shift,
              courseId: "",
              teacherId: "",
            }
          : shift
      );
      return {
        ...prev,
        assignedCourses: nextCourses,
        shifts: nextShifts,
      };
    });
  };

  const updateShiftInForm = (index, field, value) => {
    setClassForm((prev) => {
      const nextShifts = [...prev.shifts];
      const current = { ...nextShifts[index] };
      current[field] = value;
      if (field === "courseId") {
        current.teacherId = "";
      }
      nextShifts[index] = current;
      return {
        ...prev,
        shifts: nextShifts,
      };
    });
  };

  const addShiftToForm = () => {
    setClassForm((prev) => ({
      ...prev,
      shifts: [...prev.shifts, emptyShift()],
    }));
  };

  const removeShiftFromForm = (index) => {
    setClassForm((prev) => {
      if (prev.shifts.length <= 1) return prev;
      return {
        ...prev,
        shifts: prev.shifts.filter((_, rowIndex) => rowIndex !== index),
      };
    });
  };

  const handleSubmitClassForm = (event) => {
    event.preventDefault();
    if (!classSaveIntentRef.current) return;
    classSaveIntentRef.current = false;
    const basicValid = validateStep(1);
    const coursesValid = validateStep(2);
    const shiftsValid = validateStep(3);
    if (!basicValid || !coursesValid || !shiftsValid) {
      setClassModalStep(!basicValid ? 1 : !coursesValid ? 2 : 3);
      return;
    }

    const payload = {
      name: classForm.name.trim(),
      description: classForm.description.trim(),
      status: classForm.status,
      capacity: Number(classForm.capacity),
      startDate: classForm.startDate,
      endDate: classForm.endDate,
      assignedCourses: classForm.assignedCourses.map((course) => course.courseId),
      shifts: classForm.shifts.map((shift) => ({
        id: shift.id,
        name: shift.name,
        days: shift.days,
        startTime: shift.startTime,
        endTime: shift.endTime,
        teacherId: shift.teacherId,
        courseId: shift.courseId,
        room: shift.room || "",
      })),
    };

    if (classModalMode === "create") {
      createClassMutation.mutate(payload);
      return;
    }
    updateClassMutation.mutate({
      classId: editingClassId,
      data: payload,
    });
  };

  const openDrawer = (classId, defaultTab = "overview") => {
    setDrawerClassId(classId);
    setDrawerTab(defaultTab);
    setDrawerCourseId("");
    setStudentSearch("");
    setEnrollStudentId("");
    setEnrollShiftId("");
  };

  const closeDrawer = () => {
    setDrawerClassId("");
    setDrawerCourseId("");
    setDrawerTab("overview");
  };

  const openCreateShiftModal = () => {
    if (!activeClass) return;
    const assignedCourses = activeClass.assignedCourses || [];
    const defaultCourseId =
      assignedCourses.length === 1 ? assignedCourses[0].courseId || "" : "";
    setShiftModalMode("create");
    setEditingShiftId("");
    setShiftForm({
      ...emptyShift(),
      courseId: defaultCourseId,
    });
    setShiftErrors({});
    setIsShiftModalOpen(true);
  };

  const openEditShiftModal = (shift) => {
    setShiftModalMode("edit");
    setEditingShiftId(shift.id);
    setShiftForm({
      id: shift.id,
      name: shift.name || "Morning",
      days: Array.isArray(shift.days) ? shift.days : [],
      startTime: shift.startTime || "",
      endTime: shift.endTime || "",
      teacherId: shift.teacherId || "",
      courseId: shift.courseId || "",
      room: shift.room || "",
    });
    setShiftErrors({});
    setIsShiftModalOpen(true);
  };

  const validateShiftModal = () => {
    const errors = validateShiftRow(
      shiftForm,
      0,
      activeClass?.startDate ? toDateInput(activeClass.startDate) : ""
    );
    const normalizedErrors = {
      name: errors["shift-0-name"],
      days: errors["shift-0-days"],
      startTime: errors["shift-0-startTime"],
      endTime: errors["shift-0-endTime"],
      courseId: errors["shift-0-courseId"],
      teacherId: errors["shift-0-teacherId"],
    };
    setShiftErrors(normalizedErrors);
    return Object.values(normalizedErrors).every((value) => !value);
  };

  const submitShiftModal = (event) => {
    event.preventDefault();
    if (!activeClass) return;
    if (!validateShiftModal()) return;

    const payload = {
      name: shiftForm.name,
      days: shiftForm.days,
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      teacherId: shiftForm.teacherId,
      courseId: shiftForm.courseId,
      room: shiftForm.room || "",
    };

    if (shiftModalMode === "create") {
      addShiftMutation.mutate({ classId: activeClass.id, data: payload });
      return;
    }

    updateShiftMutation.mutate({
      classId: activeClass.id,
      shiftId: editingShiftId,
      data: payload,
    });
  };

  const filteredClassStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    return classStudents.filter((student) => {
      if (!query) return true;
      return (
        (student.fullName || "").toLowerCase().includes(query) ||
        (student.email || "").toLowerCase().includes(query)
      );
    });
  }, [classStudents, studentSearch]);

  const enrolledStudentIds = useMemo(
    () => new Set(classStudents.map((student) => student.studentId || student.uid)),
    [classStudents]
  );

  const availableStudentsForClass = useMemo(
    () =>
      students.filter(
        (student) =>
          !enrolledStudentIds.has(student.uid) &&
          (student.isActive ?? true)
      ),
    [students, enrolledStudentIds]
  );

  const selectedEnrollShift = useMemo(
    () =>
      activeClass?.shifts?.find((shift) => shift.id === enrollShiftId) || null,
    [activeClass?.shifts, enrollShiftId]
  );

  const remainingSeats = activeClass
    ? Math.max(Number(activeClass.capacity || 0) - Number(activeClass.enrolledCount || 0), 0)
    : 0;
  const drawerAssignedCourses = activeClass?.assignedCourses || [];
  const isSingleDrawerCourse = drawerAssignedCourses.length === 1;
  const singleDrawerCourseId = isSingleDrawerCourse
    ? drawerAssignedCourses[0].courseId
    : "";
  const singleDrawerCourseName = isSingleDrawerCourse
    ? drawerAssignedCourses[0].courseName || "Assigned Course"
    : "";

  const teacherOptionsForShiftModal = getTeacherOptionsForCourse(shiftForm.courseId);

  useEffect(() => {
    if (!isShiftModalOpen || !singleDrawerCourseId) return;
    setShiftForm((prev) => {
      if (prev.courseId === singleDrawerCourseId) return prev;
      return {
        ...prev,
        courseId: singleDrawerCourseId,
        teacherId: "",
      };
    });
  }, [isShiftModalOpen, singleDrawerCourseId]);

  const classCards = (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filteredClasses.map((classItem) => {
        const capacity = Number(classItem.capacity || 0);
        const enrolled = Number(classItem.enrolledCount || 0);
        const fillPercent = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
        return (
          <article
            key={classItem.id}
            className="glass-card space-y-4 border border-slate-200/70 bg-white/90"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-2xl text-slate-900">{classItem.name}</h3>
                <span className="mt-2 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {classItem.batchCode || "No Batch Code"}
                </span>
              </div>
              <StatusBadge status={classItem.status} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {enrolled} / {capacity} students
                </span>
                <span>{fillPercent}% full</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-700">Start</p>
                <p>{formatDate(classItem.startDate)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-700">End</p>
                <p>{formatDate(classItem.endDate)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                {classItem.assignedCourses.length} Courses
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                {classItem.shifts.length} Shifts
              </span>
            </div>

            <div className="flex items-center gap-2">
              {classItem.teachers.slice(0, 4).map((teacher, index) => (
                <div
                  key={`${teacher.teacherId || teacher.id}-${index}`}
                  className="group relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary"
                  title={teacher.teacherName || "Unknown Teacher"}
                >
                  {getTeacherInitials(teacher.teacherName || "U")}
                </div>
              ))}
              {classItem.teachers.length > 4 ? (
                <span className="text-xs text-slate-500">+{classItem.teachers.length - 4}</span>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => openDrawer(classItem.id, "overview")}
                className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-primary/40 hover:text-primary"
              >
                Manage
              </button>
              <button
                type="button"
                onClick={() => openEditClassModal(classItem)}
                className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-primary/40 hover:text-primary"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setDeleteClassTarget(classItem)}
                className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                Delete
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );

  const scheduleRows = useMemo(() => {
    const rows = [];
    for (let hour = 8; hour <= 21; hour += 1) {
      const start = `${String(hour).padStart(2, "0")}:00`;
      rows.push(start);
    }
    return rows;
  }, []);

  const shiftsByCourseColor = useMemo(() => {
    const colors = [
      "bg-primary/15 text-primary border-primary/30",
      "bg-emerald-100 text-emerald-700 border-emerald-300",
      "bg-amber-100 text-amber-700 border-amber-300",
      "bg-violet-100 text-violet-700 border-violet-300",
      "bg-sky-100 text-sky-700 border-sky-300",
      "bg-rose-100 text-rose-700 border-rose-300",
    ];
    const map = {};
    (activeClass?.assignedCourses || []).forEach((course, index) => {
      map[course.courseId] = colors[index % colors.length];
    });
    return map;
  }, [activeClass?.assignedCourses]);

  return (
    <div className="space-y-6 font-sans">
      <Toaster
        position="top-left"
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: "14px",
            fontFamily: "DM Sans, sans-serif",
          },
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">Classes Management</h2>
          <p className="text-sm text-slate-500">
            Create classes, assign courses and shifts, and manage student enrollment.
          </p>
        </div>
        <button type="button" onClick={openCreateClassModal} className="btn-primary">
          Add Class
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={`stats-skeleton-${index}`} className="skeleton h-24 rounded-2xl" />
          ))
        ) : (
          <>
            <div className="glass-card border border-slate-200/60 bg-white/90">
              <p className="text-sm text-slate-500">Total Classes</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalClasses}</p>
            </div>
            <div className="glass-card border border-slate-200/60 bg-white/90">
              <p className="text-sm text-slate-500">Active Classes</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{stats.activeClasses}</p>
            </div>
            <div className="glass-card border border-slate-200/60 bg-white/90">
              <p className="text-sm text-slate-500">Total Students enrolled</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalStudents}</p>
            </div>
            <div className="glass-card border border-slate-200/60 bg-white/90">
              <p className="text-sm text-slate-500">Upcoming Classes</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{stats.upcomingClasses}</p>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by class name..."
            className="min-w-[230px] flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-full border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`class-skeleton-${index}`} className="skeleton h-64 rounded-2xl" />
          ))}
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-4xl">🏫</p>
          <h3 className="mt-3 text-xl font-semibold text-slate-900">No classes yet</h3>
          <p className="mt-2 text-sm text-slate-500">
            Start by creating your first class with courses and shifts.
          </p>
          <button type="button" onClick={openCreateClassModal} className="btn-primary mt-5">
            Add Class
          </button>
        </div>
      ) : (
        classCards
      )}

      <ModalShell
        open={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        title={classModalMode === "create" ? "Add Class" : "Edit Class"}
        maxWidth="max-w-5xl"
      >
        <form onSubmit={handleSubmitClassForm} className="space-y-6 pb-1">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((step) => (
              <div
                key={`step-${step}`}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                  classModalStep === step
                    ? "bg-primary text-white"
                    : classModalStep > step
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                Step {step}
              </div>
            ))}
          </div>

          {classModalStep === 1 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">Class Name</label>
                <input
                  type="text"
                  value={classForm.name}
                  onChange={(event) =>
                    setClassForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Class XI - Pre-Medical Morning Batch"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                />
                <FieldError message={classErrors.name} />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">Description</label>
                <textarea
                  rows={3}
                  value={classForm.description}
                  onChange={(event) =>
                    setClassForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Optional class notes..."
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Start Date</label>
                <input
                  type="date"
                  value={classForm.startDate}
                  onChange={(event) =>
                    setClassForm((prev) => ({ ...prev, startDate: event.target.value }))
                  }
                  min={classModalMode === "create" ? getTodayInputDate() : undefined}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                />
                <FieldError message={classErrors.startDate} />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">End Date</label>
                <input
                  type="date"
                  value={classForm.endDate}
                  onChange={(event) =>
                    setClassForm((prev) => ({ ...prev, endDate: event.target.value }))
                  }
                  min={classForm.startDate || getTodayInputDate()}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                />
                <FieldError message={classErrors.endDate} />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Capacity</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={classForm.capacity}
                  onChange={(event) =>
                    setClassForm((prev) => ({ ...prev, capacity: event.target.value }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                />
                <FieldError message={classErrors.capacity} />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Status</label>
                <select
                  value={classForm.status}
                  onChange={(event) =>
                    setClassForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                >
                  {(classModalMode === "create"
                    ? CREATE_STATUS_OPTIONS
                    : STATUS_OPTIONS
                  ).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {classModalStep === 2 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <select
                  value={courseSelectForForm}
                  onChange={(event) => setCourseSelectForForm(event.target.value)}
                  className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select course</option>
                  {selectableCoursesForClass.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title || "Untitled Course"}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddCourseToForm}
                  className="rounded-full border border-primary/20 bg-primary px-4 py-2 text-xs font-semibold text-white"
                >
                  Add Course
                </button>
              </div>
              {selectableCoursesForClass.length < 1 ? (
                <p className="text-xs text-amber-600">
                  No course can be assigned right now. Please activate at least one teacher
                  in courses first.
                </p>
              ) : null}
              <FieldError message={classErrors.assignedCourses} />

              {classForm.assignedCourses.length < 1 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  No courses assigned yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {classForm.assignedCourses.map((course) => (
                    <div
                      key={course.courseId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {course.courseName || "Untitled Course"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {course.subjectName || "General"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCourseFromForm(course.courseId)}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {classModalStep === 3 ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={addShiftToForm}
                className="rounded-full border border-primary/20 bg-primary px-4 py-2 text-xs font-semibold text-white"
              >
                Add Shift
              </button>
              <FieldError message={classErrors.shifts} />

              {classForm.shifts.map((shift, index) => (
                <ShiftFormFields
                  key={shift.id}
                  shift={shift}
                  index={index}
                  courses={classForm.assignedCourses}
                  teacherOptions={getTeacherOptionsForCourse(shift.courseId)}
                  lockCourseSelection={classForm.assignedCourses.length === 1}
                  onChange={updateShiftInForm}
                  onRemove={removeShiftFromForm}
                  errors={classErrors}
                  removeDisabled={classForm.shifts.length <= 1}
                />
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setIsClassModalOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              {classModalStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Back
                </button>
              ) : null}
              {classModalStep < 3 ? (
                <button type="button" onClick={handleNextStep} className="btn-primary">
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  onClick={() => {
                    classSaveIntentRef.current = true;
                  }}
                  className="btn-primary min-w-[150px]"
                  disabled={
                    createClassMutation.isPending || updateClassMutation.isPending
                  }
                >
                  {createClassMutation.isPending || updateClassMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Saving...
                    </span>
                  ) : classModalMode === "create" ? (
                    "Create Class"
                  ) : (
                    "Update Class"
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </ModalShell>

      <DrawerShell
        open={Boolean(activeClass)}
        onClose={closeDrawer}
        title={
          activeClass
            ? `${activeClass.name} (${activeClass.batchCode || "No Batch"})`
            : "Class"
        }
      >
        {activeClass ? (
          <div className="space-y-6 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {["overview", "courses", "students", "schedule"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDrawerTab(tab)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      drawerTab === tab
                        ? "bg-primary text-white"
                        : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {tab === "overview"
                      ? "Overview"
                      : tab === "courses"
                      ? "Courses & Shifts"
                      : tab === "students"
                      ? "Students"
                      : "Schedule"}
                  </button>
                ))}
              </div>
              <StatusBadge status={activeClass.status} />
            </div>

            {drawerTab === "overview" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
                  <h4 className="font-heading text-2xl text-slate-900">Class Info</h4>
                  <div className="space-y-2 text-sm text-slate-600">
                    <p>
                      <span className="font-semibold text-slate-800">Description:</span>{" "}
                      {activeClass.description || "No description added."}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-800">Start Date:</span>{" "}
                      {formatDate(activeClass.startDate)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-800">End Date:</span>{" "}
                      {formatDate(activeClass.endDate)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-800">Capacity:</span>{" "}
                      {activeClass.capacity}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
                  <h4 className="font-heading text-2xl text-slate-900">Quick Stats</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-500">Courses</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {activeClass.assignedCourses.length}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-500">Shifts</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {activeClass.shifts.length}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-500">Students</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {activeClass.enrolledCount}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {drawerTab === "courses" ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <h4 className="font-heading text-2xl text-slate-900">Assigned Courses</h4>
                  <div className="mt-4 space-y-2">
                    {activeClass.assignedCourses.length < 1 ? (
                      <p className="text-sm text-slate-500">No courses assigned yet.</p>
                    ) : (
                      activeClass.assignedCourses.map((course) => (
                        <div
                          key={course.courseId}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {course.courseName || "Untitled Course"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {course.subjectName || "General"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              removeClassCourseMutation.mutate({
                                classId: activeClass.id,
                                courseId: course.courseId,
                              })
                            }
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <select
                      value={drawerCourseId}
                      onChange={(event) => setDrawerCourseId(event.target.value)}
                      className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Select course to add</option>
                      {selectableCoursesForClass
                        .filter(
                          (course) =>
                            !activeClass.assignedCourses.some(
                              (assigned) => assigned.courseId === course.id
                            )
                        )
                        .map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.title || "Untitled Course"}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (!drawerCourseId) {
                          toast.error("Select a course first.");
                          return;
                        }
                        if (!selectableCourseIdsForClass.has(drawerCourseId)) {
                          toast.error("This course has no active teacher available.");
                          return;
                        }
                        addClassCourseMutation.mutate({
                          classId: activeClass.id,
                          courseId: drawerCourseId,
                        });
                      }}
                      className="btn-primary"
                    >
                      Add Course
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading text-2xl text-slate-900">Shifts / Timings</h4>
                    <button type="button" onClick={openCreateShiftModal} className="btn-primary">
                      Add Shift
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {activeClass.shifts.length < 1 ? (
                      <p className="text-sm text-slate-500">No shifts added yet.</p>
                    ) : (
                      activeClass.shifts.map((shift) => (
                        <div
                          key={shift.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                  shiftBadgeClass[shift.name] ||
                                  "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {shift.name}
                              </span>
                              <p className="text-sm text-slate-600">
                                {(shift.days || [])
                                  .map((day) => SHORT_DAYS[day] || day)
                                  .join(", ")}
                              </p>
                              <p className="text-sm text-slate-600">
                                {formatTime(shift.startTime)} to {formatTime(shift.endTime)}
                              </p>
                              <p className="text-sm text-slate-600">
                                {shift.courseName || "Course N/A"} -{" "}
                                {shift.teacherName || "Teacher N/A"}
                              </p>
                              {shift.room ? (
                                <p className="text-xs text-slate-500">Room: {shift.room}</p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditShiftModal(shift)}
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteShiftTarget({
                                    classId: activeClass.id,
                                    shift,
                                  })
                                }
                                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {drawerTab === "students" ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="font-heading text-2xl text-slate-900">Students</h4>
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(event) => setStudentSearch(event.target.value)}
                      placeholder="Search students..."
                      className="min-w-[240px] rounded-full border border-slate-200 px-4 py-2 text-sm"
                    />
                  </div>

                  <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Shift</th>
                          <th className="px-4 py-3">Course</th>
                          <th className="px-4 py-3">Enrolled Date</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classStudentsQuery.isLoading ? (
                          Array.from({ length: 5 }).map((_, index) => (
                            <tr key={`class-student-skeleton-${index}`}>
                              <td colSpan={5} className="px-4 py-3">
                                <div className="skeleton h-10 rounded-xl" />
                              </td>
                            </tr>
                          ))
                        ) : filteredClassStudents.length < 1 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                              No students enrolled yet.
                            </td>
                          </tr>
                        ) : (
                          filteredClassStudents.map((student) => (
                            <tr
                              key={student.studentId || student.uid}
                              className="border-t border-slate-100"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                                    {getTeacherInitials(student.fullName || "S")}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-900">
                                      {student.fullName || "Unknown Student"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {student.email || "No email"}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {student.shiftName || "N/A"}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {student.courseName || "N/A"}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {student.enrolledAt ? formatDate(student.enrolledAt) : "N/A"}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRemoveStudentTarget({
                                      classId: activeClass.id,
                                      studentId: student.studentId || student.uid,
                                      fullName: student.fullName || "Student",
                                    })
                                  }
                                  className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <h4 className="font-heading text-2xl text-slate-900">Add Student</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Remaining seats: {remainingSeats}
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <select
                      value={enrollStudentId}
                      onChange={(event) => setEnrollStudentId(event.target.value)}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                    >
                      <option value="">Select student</option>
                      {availableStudentsForClass.map((student) => (
                        <option key={student.uid} value={student.uid}>
                          {student.fullName} ({student.email})
                        </option>
                      ))}
                    </select>

                    <select
                      value={enrollShiftId}
                      onChange={(event) => setEnrollShiftId(event.target.value)}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                    >
                      <option value="">Select shift</option>
                      {activeClass.shifts.map((shift) => (
                        <option key={shift.id} value={shift.id}>
                          {shift.name} - {(shift.days || []).map((day) => SHORT_DAYS[day]).join(", ")} -{" "}
                          {formatTime(shift.startTime)} to {formatTime(shift.endTime)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        if (!enrollStudentId) {
                          toast.error("Select a student first.");
                          return;
                        }
                        if (!enrollShiftId) {
                          toast.error("Select a shift first.");
                          return;
                        }
                        if (remainingSeats < 1) {
                          toast.error("Class is full.");
                          return;
                        }
                        addStudentMutation.mutate({
                          classId: activeClass.id,
                          data: {
                            studentId: enrollStudentId,
                            shiftId: enrollShiftId,
                          },
                        });
                      }}
                      className="btn-primary"
                      disabled={addStudentMutation.isPending}
                    >
                      {addStudentMutation.isPending ? "Adding..." : "Add to Class"}
                    </button>
                  </div>
                  {selectedEnrollShift ? (
                    <p className="mt-3 text-xs text-slate-500">
                      {selectedEnrollShift.name} -{" "}
                      {(selectedEnrollShift.days || [])
                        .map((day) => SHORT_DAYS[day] || day)
                        .join(", ")}{" "}
                      - {formatTime(selectedEnrollShift.startTime)} to{" "}
                      {formatTime(selectedEnrollShift.endTime)}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {drawerTab === "schedule" ? (
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
                <h4 className="font-heading text-2xl text-slate-900">Weekly Timetable</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600">
                          Time
                        </th>
                        {DAYS.map((day) => (
                          <th
                            key={`head-${day}`}
                            className="border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-600"
                          >
                            {SHORT_DAYS[day]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleRows.map((slot) => {
                        const slotStart = toMinutes(slot);
                        const slotEnd = slotStart + 60;
                        return (
                          <tr key={`slot-${slot}`}>
                            <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-600">
                              {formatTime(slot)}
                            </td>
                            {DAYS.map((day) => {
                              const matchingShifts = (activeClass.shifts || []).filter((shift) => {
                                if (!(shift.days || []).includes(day)) return false;
                                const shiftStart = toMinutes(shift.startTime);
                                const shiftEnd = toMinutes(shift.endTime);
                                if (shiftStart === null || shiftEnd === null) return false;
                                return shiftStart < slotEnd && shiftEnd > slotStart;
                              });

                              return (
                                <td key={`${slot}-${day}`} className="border border-slate-200 align-top">
                                  <div className="min-h-[52px] space-y-1 p-1.5">
                                    {matchingShifts.map((shift) => (
                                      <div
                                        key={`${slot}-${day}-${shift.id}`}
                                        className={`rounded-lg border px-2 py-1 text-[10px] ${
                                          shiftsByCourseColor[shift.courseId] ||
                                          "bg-slate-100 text-slate-700 border-slate-200"
                                        }`}
                                      >
                                        <p className="font-semibold">{shift.name}</p>
                                        <p>{shift.courseName || "Course"}</p>
                                        <p>{shift.teacherName || "Teacher"}</p>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </DrawerShell>

      <ModalShell
        open={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        title={shiftModalMode === "create" ? "Add Shift" : "Edit Shift"}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={submitShiftModal} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Shift Name</label>
            <select
              value={shiftForm.name}
              onChange={(event) =>
                setShiftForm((prev) => ({ ...prev, name: event.target.value }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            >
              {SHIFT_NAME_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <FieldError message={shiftErrors.name} />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Days</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const active = shiftForm.days.includes(day);
                return (
                  <button
                    key={`shift-modal-day-${day}`}
                    type="button"
                    onClick={() =>
                      setShiftForm((prev) => ({
                        ...prev,
                        days: active
                          ? prev.days.filter((item) => item !== day)
                          : [...prev.days, day],
                      }))
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      active
                        ? "border-primary bg-primary text-white"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {SHORT_DAYS[day]}
                  </button>
                );
              })}
            </div>
            <FieldError message={shiftErrors.days} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">Start Time</label>
              <input
                type="time"
                value={shiftForm.startTime}
                onChange={(event) =>
                  setShiftForm((prev) => ({
                    ...prev,
                    startTime: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
              <FieldError message={shiftErrors.startTime} />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">End Time</label>
              <input
                type="time"
                value={shiftForm.endTime}
                onChange={(event) =>
                  setShiftForm((prev) => ({
                    ...prev,
                    endTime: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
              <FieldError message={shiftErrors.endTime} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">Course</label>
              {isSingleDrawerCourse ? (
                <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  {singleDrawerCourseName}
                </div>
              ) : (
                <select
                  value={shiftForm.courseId}
                  onChange={(event) =>
                    setShiftForm((prev) => ({
                      ...prev,
                      courseId: event.target.value,
                      teacherId: "",
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                >
                  <option value="">Select course</option>
                  {(activeClass?.assignedCourses || []).map((course) => (
                    <option key={course.courseId} value={course.courseId}>
                      {course.courseName || "Untitled Course"}
                    </option>
                  ))}
                </select>
              )}
              <FieldError message={shiftErrors.courseId} />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Teacher</label>
              <select
                value={shiftForm.teacherId}
                onChange={(event) =>
                  setShiftForm((prev) => ({ ...prev, teacherId: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              >
                <option value="">Select teacher</option>
                {teacherOptionsForShiftModal.map((teacher) => (
                  <option key={teacher.id || teacher.teacherId} value={teacher.id || teacher.teacherId}>
                    {teacher.fullName || teacher.teacherName || "Unknown Teacher"}
                  </option>
                ))}
              </select>
              <FieldError message={shiftErrors.teacherId} />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Room (optional)</label>
            <input
              type="text"
              value={shiftForm.room}
              onChange={(event) =>
                setShiftForm((prev) => ({ ...prev, room: event.target.value }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Room A-12"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setIsShiftModalOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary min-w-[130px]"
              disabled={addShiftMutation.isPending || updateShiftMutation.isPending}
            >
              {addShiftMutation.isPending || updateShiftMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving...
                </span>
              ) : shiftModalMode === "create" ? (
                "Add Shift"
              ) : (
                "Update Shift"
              )}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        open={Boolean(deleteClassTarget)}
        onClose={() => setDeleteClassTarget(null)}
        title="Delete Class"
        maxWidth="max-w-md"
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            Delete{" "}
            <span className="font-semibold text-slate-900">
              {deleteClassTarget?.name || "this class"}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteClassTarget(null)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteClassMutation.mutate(deleteClassTarget.id)}
              className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Delete
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={Boolean(deleteShiftTarget)}
        onClose={() => setDeleteShiftTarget(null)}
        title="Remove Shift"
        maxWidth="max-w-md"
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            Remove shift{" "}
            <span className="font-semibold text-slate-900">
              {deleteShiftTarget?.shift?.name || ""}
            </span>
            ? Students assigned to this shift must be removed first.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteShiftTarget(null)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                deleteShiftMutation.mutate({
                  classId: deleteShiftTarget.classId,
                  shiftId: deleteShiftTarget.shift.id,
                })
              }
              className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Remove
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={Boolean(removeStudentTarget)}
        onClose={() => setRemoveStudentTarget(null)}
        title="Remove Student"
        maxWidth="max-w-md"
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            Remove{" "}
            <span className="font-semibold text-slate-900">
              {removeStudentTarget?.fullName || "this student"}
            </span>{" "}
            from this class?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRemoveStudentTarget(null)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                removeStudentMutation.mutate({
                  classId: removeStudentTarget.classId,
                  studentId: removeStudentTarget.studentId,
                })
              }
              className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Remove
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}

export default Classes;

