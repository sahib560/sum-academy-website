import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  rebuildClassAnalytics,
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
const getCurrentTimeInput = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

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

const pickTeacherFromMaps = (teacherId, activeTeachersById = {}, allTeachersById = {}) => {
  const normalizedId = String(teacherId || "").trim();
  if (!normalizedId) return null;

  const teacher = activeTeachersById[normalizedId] || allTeachersById[normalizedId];
  const teacherName =
    teacher?.fullName ||
    teacher?.teacherName ||
    teacher?.name ||
    "";

  if (!teacherName && !normalizedId) return null;
  return {
    id: normalizedId,
    fullName: teacherName || "Assigned Teacher",
  };
};

const resolveAssignedTeacher = (item = {}, activeTeachersById = {}, allTeachersById = {}) => {
  const subjects = Array.isArray(item?.subjects) ? item.subjects : [];
  const direct = pickTeacherFromMaps(item?.teacherId, activeTeachersById, allTeachersById);
  if (direct) return direct;

  for (const subject of subjects) {
    const subjectTeacher = pickTeacherFromMaps(
      subject?.teacherId,
      activeTeachersById,
      allTeachersById
    );
    if (subjectTeacher) return subjectTeacher;
  }

  const fallbackName =
    String(item?.teacherName || "").trim() ||
    String(subjects.find((subject) => subject?.teacherName)?.teacherName || "").trim();
  const fallbackId =
    String(item?.teacherId || "").trim() ||
    String(subjects.find((subject) => subject?.teacherId)?.teacherId || "").trim();

  if (!fallbackId && !fallbackName) return null;
  return {
    id: fallbackId,
    fullName: fallbackName || "Assigned Teacher",
  };
};

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
    totalPrice: Number(row.totalPrice || 0),
    coursesCount: Number(row.coursesCount || assignedCourses.length || 0),
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
  price: "",
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

  const parsedPrice = Number(values.price);
  if (!Number.isFinite(parsedPrice)) {
    errors.price = "Class price is required.";
  } else if (parsedPrice < 0) {
    errors.price = "Class price must be 0 or higher.";
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
    return { assignedCourses: "At least 1 subject is required." };
  }
  return {};
};

const getAssignedCourseId = (course = {}) =>
  String(
    typeof course === "string" ? course : course?.courseId || course?.id || ""
  ).trim();

const getAssignedCourseName = (course = {}) => {
  if (typeof course === "string") return course;
  return String(course?.courseName || course?.title || course?.name || "").trim();
};

const getMissingScheduledCourses = (assignedCourses = [], shifts = []) => {
  const normalizedCourses = (Array.isArray(assignedCourses) ? assignedCourses : [])
    .map((course) => {
      const courseId = getAssignedCourseId(course);
      if (!courseId) return null;
      return {
        courseId,
        courseName: getAssignedCourseName(course) || courseId,
      };
    })
    .filter(Boolean);

  if (normalizedCourses.length < 1) return [];

  const shiftCourseIds = new Set(
    (Array.isArray(shifts) ? shifts : [])
      .map((shift) => String(shift?.courseId || "").trim())
      .filter(Boolean)
  );

  return normalizedCourses.filter((course) => !shiftCourseIds.has(course.courseId));
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
    const minMinutes = now.getHours() * 60 + now.getMinutes();
    if (startMinutes < minMinutes) {
      errors[`${prefix}-startTime`] =
        "For today, start time cannot be in the past.";
    }
  }
  if (!shift.courseId) {
    errors[`${prefix}-courseId`] = "Subject is required.";
  }
  if (!shift.teacherId) {
    errors[`${prefix}-teacherId`] = "Assigned subject teacher is required.";
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
  const missingCourses = getMissingScheduledCourses(
    values.assignedCourses,
    values.shifts
  );
  if (missingCourses.length > 0) {
    errors.shiftsCoverage = `Add at least one shift for: ${missingCourses
      .map((course) => course.courseName)
      .join(", ")}`;
  }
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
  assignedTeacher,
  teacherOptions = [],
  classStartDate = "",
  lockCourseSelection = false,
  onChange,
  onRemove,
  errors,
  removeDisabled = false,
}) {
  const prefix = `shift-${index}`;
  const startsToday = classStartDate === getTodayInputDate();
  const minStartTime = startsToday ? getCurrentTimeInput() : undefined;
  const selectedCourseName =
    courses.find((course) => course.courseId === shift.courseId)?.courseName ||
    "Assigned Subject";
  const selectedTeacherName =
    teacherOptions.find((t) => t.id === shift.teacherId)?.fullName ||
    assignedTeacher?.fullName ||
    "No assigned teacher";

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
            min={minStartTime}
            max={shift.endTime || undefined}
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
            min={shift.startTime || minStartTime || undefined}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <FieldError message={errors[`${prefix}-endTime`]} />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Subject
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
              <option value="">Select subject</option>
              {courses.map((course) => (
                <option key={course.courseId} value={course.courseId}>
                  {course.courseName || "Untitled Subject"}
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
          {teacherOptions.length > 1 ? (
            <select
              value={shift.teacherId}
              onChange={(event) => onChange(index, "teacherId", event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select teacher</option>
              {teacherOptions.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.fullName}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-1 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
              {selectedTeacherName}
            </div>
          )}
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
  const [enrollStudentSearch, setEnrollStudentSearch] = useState("");
  const [enrollStudentIds, setEnrollStudentIds] = useState([]);
  const [enrollShiftId, setEnrollShiftId] = useState("");
  const [enrollEnrollmentType, setEnrollEnrollmentType] = useState("full_class");
  const [enrollCourseId, setEnrollCourseId] = useState("");

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

  const studentsQuery = useInfiniteQuery({
    queryKey: ["admin", "students", enrollStudentSearch.trim()],
    queryFn: ({ pageParam }) =>
      getStudents({
        pageSize: 50,
        cursor: String(pageParam || ""),
        search: enrollStudentSearch.trim(),
      }),
    initialPageParam: "",
    getNextPageParam: (lastPage) =>
      lastPage?.page?.hasMore ? String(lastPage.page.nextCursor || "") : undefined,
    staleTime: 30000,
  });

  const classStudentsQuery = useQuery({
    queryKey: ["admin", "class-students", drawerClassId],
    queryFn: () => getClassStudents(drawerClassId),
    enabled: Boolean(drawerClassId),
    staleTime: 10000,
  });

  const classes = useMemo(() => {
    const raw = classesQuery.data;
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
    return list.map((item) => normalizeClass(item));
  }, [classesQuery.data]);
  const courses = useMemo(() => coursesQuery.data || [], [coursesQuery.data]);
  const teachers = useMemo(() => {
    const raw = teachersQuery.data;
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
    return list.map((teacher) => ({
      ...teacher,
      id: teacher.id || teacher.uid || "",
    }));
  }, [teachersQuery.data]);
  const activeTeachers = useMemo(
    () => teachers.filter((teacher) => teacher.isActive !== false),
    [teachers]
  );
  const teachersById = useMemo(
    () =>
      teachers.reduce((acc, teacher) => {
        const key = teacher.id || teacher.teacherId || "";
        if (key) acc[key] = teacher;
        return acc;
      }, {}),
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
  const getTeacherOptionsForCourse = (courseId) => {
    const normalizedId = String(courseId || "").trim();
    if (!normalizedId) return [];
    const subject = courses.find((item) => item.id === normalizedId);
    if (!subject) return [];

    const rawIds = [];
    if (Array.isArray(subject.teacherIds) && subject.teacherIds.length > 0) {
      rawIds.push(...subject.teacherIds);
    } else if (Array.isArray(subject.teachers) && subject.teachers.length > 0) {
      rawIds.push(
        ...subject.teachers.map((row) => row?.teacherId || row?.id || row?.uid)
      );
    } else if (subject.teacherId) {
      rawIds.push(subject.teacherId);
    }

    const uniqueIds = Array.from(
      new Set(rawIds.map((v) => String(v || "").trim()).filter(Boolean))
    );

    return uniqueIds
      .map((id) => {
        const teacher = activeTeachersById[id] || teachersById[id];
        if (!teacher || teacher.isActive === false) return null;
        return {
          id,
          fullName:
            teacher.fullName || teacher.teacherName || teacher.name || "Teacher",
        };
      })
      .filter(Boolean);
  };
  const resolveDefaultTeacherId = (courseId, currentTeacherId = "") => {
    const options = getTeacherOptionsForCourse(courseId);
    if (options.length === 1) return options[0].id;
    if (currentTeacherId && options.some((t) => t.id === currentTeacherId)) {
      return currentTeacherId;
    }
    return "";
  };
  const getAssignedTeacherForCourse = (courseId) => {
    if (!courseId) return null;
    const subject = courses.find((item) => item.id === courseId);
    if (!subject) return null;
    return resolveAssignedTeacher(subject, activeTeachersById, teachersById);
  };
  const selectableCourseIdsForClass = useMemo(() => {
    const selectable = new Set();
    courses.forEach((subject) => {
      const options = getTeacherOptionsForCourse(subject.id);
      if (options.length > 0) {
        selectable.add(subject.id);
      }
    });
    return selectable;
  }, [courses, activeTeachersById, teachersById]);
  const selectableCoursesForClass = useMemo(
    () => courses.filter((course) => selectableCourseIdsForClass.has(course.id)),
    [courses, selectableCourseIdsForClass]
  );
  const students = useMemo(() => {
    const pages = Array.isArray(studentsQuery.data?.pages)
      ? studentsQuery.data.pages
      : [];
    const merged = pages.flatMap((page) =>
      Array.isArray(page) ? page : Array.isArray(page?.items) ? page.items : []
    );
    const byId = new Map();
    merged.forEach((student) => {
      const uid = String(student?.uid || student?.id || "").trim();
      if (!uid) return;
      if (!byId.has(uid)) {
        byId.set(uid, {
          ...student,
          uid,
          fullName:
            student.fullName ||
            (student.email ? student.email.split("@")[0] : "Unknown Student"),
        });
      }
    });
    return Array.from(byId.values());
  }, [studentsQuery.data]);
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

  const rebuildAnalyticsMutation = useMutation({
    mutationFn: async () => {
      const toastId = "rebuild-class-analytics";
      toast.loading("Rebuilding class analytics…", { id: toastId });
      let cursor = "";
      let updated = 0;
      let pages = 0;

      while (true) {
        const result = await rebuildClassAnalytics({
          pageSize: 50,
          cursor,
          includeRevenue: true,
          dryRun: false,
        });
        updated += Number(result?.updatedClasses || 0);
        cursor = String(result?.page?.nextCursor || "").trim();
        pages += 1;

        toast.loading(`Rebuilding… updated ${updated} classes`, { id: toastId });

        if (!result?.page?.hasMore) break;
        if (!cursor) break;
        if (pages >= 50) {
          throw new Error("Rebuild stopped after 50 pages (safety limit). Run again to continue.");
        }
      }

      toast.success(`Class analytics rebuilt (${updated} classes)`, { id: toastId });
      return { updated };
    },
    onSuccess: async () => {
      await refreshClasses();
    },
    onError: (error) => {
      const message = String(error?.message || "Failed to rebuild analytics");
      toast.error(message);
    },
  });
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
    onSuccess: async (_, variables) => {
      await refreshClasses();
      setDrawerCourseId("");
      toast.success("Course assigned. Add shift days/time for this course.");
      if (variables?.courseId) {
        openCreateShiftModal(variables.courseId);
      }
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

  const addStudentsMutation = useMutation({
    mutationFn: async ({ classId, data, studentIds }) => {
      const results = {
        added: [],
        alreadyEnrolled: [],
        failed: [],
        classFull: false,
        grantedCoursesTotal: 0,
      };

      for (const studentId of studentIds) {
        try {
          const response = await addStudentToClass(classId, { ...data, studentId });
          results.added.push(studentId);
          results.grantedCoursesTotal += Number(response?.data?.coursesEnrolled || 0);
        } catch (error) {
          const code = error?.response?.data?.errors?.code;
          if (code === "ALREADY_ENROLLED") {
            results.alreadyEnrolled.push(studentId);
            continue;
          }
          if (code === "CLASS_FULL") {
            results.classFull = true;
            results.failed.push({ studentId, code });
            break;
          }
          results.failed.push({ studentId, code: code || "UNKNOWN" });
        }
      }

      return results;
    },
    onSuccess: async (results, variables) => {
      await refreshClasses();
      await refreshClassStudents();
      setEnrollStudentIds([]);
      setEnrollStudentSearch("");
      setEnrollShiftId("");
      setEnrollCourseId("");
      setEnrollEnrollmentType("full_class");

      const selectedClass = classes.find((row) => row.id === variables?.classId);
      const addedCount = results?.added?.length || 0;
      const alreadyCount = results?.alreadyEnrolled?.length || 0;
      const failedCount = results?.failed?.length || 0;

      if (addedCount > 0) {
        toast.success(
          `${addedCount} student(s) enrolled in ${selectedClass?.name || "class"}.`
        );
      } else {
        toast.error("No students were added.");
      }

      if (alreadyCount > 0) {
        toast(`${alreadyCount} already enrolled`);
      }
      if (results?.classFull) {
        toast.error("Class reached capacity while adding students.");
      } else if (failedCount > 0) {
        toast.error(`${failedCount} failed to add`);
      }
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to add students.");
    },
  });

  const removeStudentMutation = useMutation({
    mutationFn: ({ classId, studentId }) => removeStudentFromClass(classId, studentId),
    onSuccess: async () => {
      await refreshClasses();
      await refreshClassStudents();
      const removedStudentName = removeStudentTarget?.fullName || "Student";
      setRemoveStudentTarget(null);
      toast.success(
        `${removedStudentName} removed from class. Access to class courses revoked.`
      );
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || "Failed to remove student.");
    },
  });

  const getCourseMetaById = (courseId) => {
    const course = courses.find((item) => item.id === courseId);
    if (!course) return null;
    const options = getTeacherOptionsForCourse(course.id);
    const primaryTeacherId = options[0]?.id || "";
    const primaryTeacherName = options[0]?.fullName || "";
    return {
      courseId: course.id,
      courseName: course.title || "Untitled Subject",
      subjectName:
        Array.isArray(course.subjects) && course.subjects[0]?.name
          ? course.subjects[0].name
          : course.category || "",
      teacherId: primaryTeacherId,
      teacherName: primaryTeacherName,
    };
  };

  useEffect(() => {
    if (classForm.assignedCourses.length !== 1) return;
    const onlyCourseId = classForm.assignedCourses[0].courseId;
    setClassForm((prev) => {
      const nextShifts = prev.shifts.map((shift) => {
        return {
          ...shift,
          courseId: onlyCourseId,
          teacherId: resolveDefaultTeacherId(onlyCourseId, shift.teacherId),
        };
      });
      const changed = nextShifts.some((shift, index) => shift !== prev.shifts[index]);
      if (!changed) return prev;
      return { ...prev, shifts: nextShifts };
    });
  }, [classForm.assignedCourses, courses, activeTeachersById, teachersById]);

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
      price: classItem.price ?? classItem.totalPrice ?? "",
      startDate: toDateInput(classItem.startDate),
      endDate: toDateInput(classItem.endDate),
      assignedCourses: (classItem.assignedCourses || []).map((course) => ({
        courseId: course.courseId || course.subjectId || course.id || "",
        courseName: course.courseName || course.subjectName || course.title || "Untitled Subject",
        subjectName: course.subjectName || "",
        teacherId: course.teacherId || "",
        teacherName: course.teacherName || "",
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
      toast.error("This subject has no active assigned teacher.");
      return;
    }
    if (classForm.assignedCourses.some((course) => course.courseId === courseSelectForForm)) {
      toast.error("Subject already added.");
      return;
    }
    const meta = getCourseMetaById(courseSelectForForm);
    if (!meta) {
      toast.error("Subject not found.");
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
        current.teacherId = resolveDefaultTeacherId(value, current.teacherId);
      }
      nextShifts[index] = current;
      return {
        ...prev,
        shifts: nextShifts,
      };
    });
  };

  const addShiftToForm = (preferredCourseId = "") => {
    const normalizedCourseId = String(preferredCourseId || "").trim();
    const defaultTeacherId = resolveDefaultTeacherId(normalizedCourseId, "");
    setClassForm((prev) => ({
      ...prev,
      shifts: [
        ...prev.shifts,
        {
          ...emptyShift(),
          courseId: normalizedCourseId,
          teacherId: defaultTeacherId,
        },
      ],
    }));
  };

  useEffect(() => {
    if (!isShiftModalOpen) return;
    if (!shiftForm.courseId) return;
    const nextTeacherId = resolveDefaultTeacherId(shiftForm.courseId, shiftForm.teacherId);
    if (nextTeacherId === shiftForm.teacherId) return;
    setShiftForm((prev) => ({ ...prev, teacherId: nextTeacherId }));
  }, [isShiftModalOpen, shiftForm.courseId, shiftForm.teacherId]);

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
      price: Number(classForm.price),
      startDate: classForm.startDate,
      endDate: classForm.endDate,
      assignedCourses: classForm.assignedCourses.map((course) => course.courseId),
      shifts: classForm.shifts.map((shift) => ({
        id: shift.id,
        name: shift.name,
        days: shift.days,
        startTime: shift.startTime,
        endTime: shift.endTime,
        teacherId: shift.teacherId || getAssignedTeacherForCourse(shift.courseId)?.id || "",
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
    setEnrollEnrollmentType("full_class");
    setEnrollCourseId("");
  };

  const closeDrawer = () => {
    setDrawerClassId("");
    setDrawerCourseId("");
    setDrawerTab("overview");
  };

  const openCreateShiftModal = (preferredCourseId = "") => {
    if (!activeClass) return;
    const assignedCourses = activeClass.assignedCourses || [];
    const preferredId = String(preferredCourseId || "").trim();
    const hasPreferred = assignedCourses.some(
      (course) => course.courseId === preferredId
    );
    const defaultCourseId = hasPreferred
      ? preferredId
      : assignedCourses.length === 1
      ? assignedCourses[0].courseId || ""
      : "";
    const assignedTeacher = getAssignedTeacherForCourse(defaultCourseId);
    setShiftModalMode("create");
    setEditingShiftId("");
    setShiftForm({
      ...emptyShift(),
      courseId: defaultCourseId,
      teacherId: assignedTeacher?.id || "",
    });
    setShiftErrors({});
    setIsShiftModalOpen(true);
  };

  const openEditShiftModal = (shift) => {
    const assignedTeacher = getAssignedTeacherForCourse(shift.courseId || "");
    setShiftModalMode("edit");
    setEditingShiftId(shift.id);
    setShiftForm({
      id: shift.id,
      name: shift.name || "Morning",
      days: Array.isArray(shift.days) ? shift.days : [],
      startTime: shift.startTime || "",
      endTime: shift.endTime || "",
      teacherId: shift.teacherId || assignedTeacher?.id || "",
      courseId: shift.courseId || "",
      room: shift.room || "",
    });
    setShiftErrors({});
    setIsShiftModalOpen(true);
  };

  const validateShiftModal = () => {
    const errors = validateShiftRow(shiftForm, 0, shiftModalClassStartDateInput);
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
      teacherId:
        shiftForm.teacherId || getAssignedTeacherForCourse(shiftForm.courseId)?.id || "",
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

  const filteredAvailableStudentsForClass = useMemo(() => {
    const query = enrollStudentSearch.trim().toLowerCase();
    const base = Array.isArray(availableStudentsForClass) ? availableStudentsForClass : [];
    if (!query) return base;
    return base.filter((student) => {
      const fullName = String(student.fullName || student.name || "").toLowerCase();
      const email = String(student.email || "").toLowerCase();
      return fullName.includes(query) || email.includes(query);
    });
  }, [availableStudentsForClass, enrollStudentSearch]);

  const toggleEnrollStudent = (studentId) => {
    const clean = String(studentId || "").trim();
    if (!clean) return;
    setEnrollStudentIds((prev) =>
      prev.includes(clean) ? prev.filter((id) => id !== clean) : [...prev, clean]
    );
  };

  const selectedEnrollShift = useMemo(
    () =>
      activeClass?.shifts?.find((shift) => shift.id === enrollShiftId) || null,
    [activeClass?.shifts, enrollShiftId]
  );
  const availableShiftsForEnrollment = useMemo(() => {
    const shifts = Array.isArray(activeClass?.shifts) ? activeClass.shifts : [];
    return shifts;
  }, [activeClass?.shifts, enrollEnrollmentType, enrollCourseId]);

  const classCapacity = activeClass
    ? Math.max(1, Number(activeClass.capacity || 30))
    : 30;
  const enrolledStudentsCount = activeClass
    ? Math.max(
        Number(classStudents.length || 0),
        Number(activeClass.enrolledCount || 0)
      )
    : 0;
  const classFillPercent = Math.min(
    100,
    Math.round((enrolledStudentsCount / classCapacity) * 100)
  );
  const isClassFull = enrolledStudentsCount >= classCapacity;
  const remainingSeats = Math.max(0, classCapacity - enrolledStudentsCount);
  const classFillColor =
    classFillPercent >= 100
      ? "bg-rose-500"
      : classFillPercent >= 80
      ? "bg-amber-500"
      : "bg-emerald-500";
  const missingShiftCoursesInForm = useMemo(
    () => getMissingScheduledCourses(classForm.assignedCourses, classForm.shifts),
    [classForm.assignedCourses, classForm.shifts]
  );
  const missingShiftCoursesInActiveClass = useMemo(
    () =>
      getMissingScheduledCourses(
        activeClass?.assignedCourses || [],
        activeClass?.shifts || []
      ),
    [activeClass?.assignedCourses, activeClass?.shifts]
  );
  const drawerAssignedCourses = activeClass?.assignedCourses || [];
  const isSingleDrawerCourse = drawerAssignedCourses.length === 1;
  const singleDrawerCourseId = isSingleDrawerCourse
    ? drawerAssignedCourses[0].courseId
    : "";
  const singleDrawerCourseName = isSingleDrawerCourse
    ? drawerAssignedCourses[0].courseName || "Assigned Subject"
    : "";
  const shiftModalClassStartDateInput = activeClass?.startDate
    ? toDateInput(activeClass.startDate)
    : "";
  const shiftModalMinStartTime =
    shiftModalClassStartDateInput === getTodayInputDate()
      ? getCurrentTimeInput()
      : undefined;
  const shiftModalAssignedTeacher = getAssignedTeacherForCourse(shiftForm.courseId);
  const shiftModalTeacherOptions = getTeacherOptionsForCourse(shiftForm.courseId);

  useEffect(() => {
    if (!enrollShiftId) return;
    const stillValid = availableShiftsForEnrollment.some(
      (shift) => shift.id === enrollShiftId
    );
    if (!stillValid) {
      setEnrollShiftId("");
    }
  }, [availableShiftsForEnrollment, enrollShiftId]);

  useEffect(() => {
    if (!isShiftModalOpen || !singleDrawerCourseId) return;
    const assignedTeacher = getAssignedTeacherForCourse(singleDrawerCourseId);
    setShiftForm((prev) => {
      if (
        prev.courseId === singleDrawerCourseId &&
        prev.teacherId === (assignedTeacher?.id || "")
      ) {
        return prev;
      }
      return {
        ...prev,
        courseId: singleDrawerCourseId,
        teacherId: assignedTeacher?.id || "",
      };
    });
  }, [isShiftModalOpen, singleDrawerCourseId, courses, activeTeachersById, teachersById]);

  useEffect(() => {
    if (enrollCourseId) setEnrollCourseId("");
  }, [enrollCourseId]);

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
                {classItem.assignedCourses.length} Subjects
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
            Create classes, assign subjects and shifts, and manage student enrollment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (rebuildAnalyticsMutation.isPending) return;
              const ok = window.confirm(
                "This will recalculate enrollmentCount/activeStudents/totalRevenue for classes. Continue?"
              );
              if (!ok) return;
              rebuildAnalyticsMutation.mutate();
            }}
            disabled={rebuildAnalyticsMutation.isPending}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            title="Rebuild class analytics fields (one-time maintenance)"
          >
            {rebuildAnalyticsMutation.isPending ? "Rebuilding…" : "Rebuild Analytics"}
          </button>
          <button type="button" onClick={openCreateClassModal} className="btn-primary">
            Add Class
          </button>
        </div>
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
            Start by creating your first class with subjects and shifts.
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
                <label className="text-sm font-semibold text-slate-700">Class Price (PKR)</label>
                <input
                  type="number"
                  min={0}
                  value={classForm.price}
                  onChange={(event) =>
                    setClassForm((prev) => ({ ...prev, price: event.target.value }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                />
                <FieldError message={classErrors.price} />
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
                  <option value="">Select subject</option>
                  {selectableCoursesForClass.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title || "Untitled Subject"}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddCourseToForm}
                  className="rounded-full border border-primary/20 bg-primary px-4 py-2 text-xs font-semibold text-white"
                >
                  Add Subject
                </button>
              </div>
              {selectableCoursesForClass.length < 1 ? (
                <p className="text-xs text-amber-600">
                  No subject can be assigned right now. Please assign active teachers to
                  subjects first.
                </p>
              ) : null}
              <FieldError message={classErrors.assignedCourses} />

              {classForm.assignedCourses.length < 1 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  No subjects assigned yet.
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
                          {course.courseName || "Untitled Subject"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {course.teacherName
                            ? `Assigned Teacher: ${course.teacherName}`
                            : course.subjectName || "General"}
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => addShiftToForm()}
                  className="rounded-full border border-primary/20 bg-primary px-4 py-2 text-xs font-semibold text-white"
                >
                  Add Shift
                </button>
                {missingShiftCoursesInForm.length > 0 ? (
                  <span className="text-xs font-semibold text-amber-700">
                    Missing schedule for {missingShiftCoursesInForm.length} subject
                    {missingShiftCoursesInForm.length > 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>
              <FieldError message={classErrors.shifts} />
              <FieldError message={classErrors.shiftsCoverage} />

              {missingShiftCoursesInForm.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Unscheduled Subjects
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {missingShiftCoursesInForm.map((course) => (
                      <button
                        key={`missing-form-course-${course.courseId}`}
                        type="button"
                        onClick={() => addShiftToForm(course.courseId)}
                        className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-700"
                      >
                        Add shift: {course.courseName}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {classForm.shifts.map((shift, index) => (
                <ShiftFormFields
                  key={shift.id}
                  shift={shift}
                  index={index}
                  courses={classForm.assignedCourses}
                  assignedTeacher={getAssignedTeacherForCourse(shift.courseId)}
                  teacherOptions={getTeacherOptionsForCourse(shift.courseId)}
                  classStartDate={classForm.startDate}
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
                      ? "Subjects & Shifts"
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
                      <p className="text-xs text-slate-500">Subjects</p>
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
                  <h4 className="font-heading text-2xl text-slate-900">Assigned Subjects</h4>
                  {missingShiftCoursesInActiveClass.length > 0 ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-sm font-semibold text-amber-800">
                        Schedule missing for{" "}
                        {missingShiftCoursesInActiveClass
                          .map((course) => course.courseName)
                          .join(", ")}
                      </p>
                      <p className="mt-1 text-xs text-amber-700">
                        Add days and timings for each subject so timetable and teacher dashboard
                        stay accurate.
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-4 space-y-2">
                    {activeClass.assignedCourses.length < 1 ? (
                      <p className="text-sm text-slate-500">No subjects assigned yet.</p>
                    ) : (
                      activeClass.assignedCourses.map((course) => (
                        <div
                          key={course.courseId}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {course.courseName || "Untitled Subject"}
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
                      <option value="">Select subject to add</option>
                      {selectableCoursesForClass
                        .filter(
                          (course) =>
                            !activeClass.assignedCourses.some(
                              (assigned) => assigned.courseId === course.id
                            )
                        )
                        .map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.title || "Untitled Subject"}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (!drawerCourseId) {
                          toast.error("Select a subject first.");
                          return;
                        }
                        if (!selectableCourseIdsForClass.has(drawerCourseId)) {
                          toast.error("This subject has no active assigned teacher.");
                          return;
                        }
                        addClassCourseMutation.mutate({
                          classId: activeClass.id,
                          courseId: drawerCourseId,
                        });
                      }}
                      className="btn-primary"
                    >
                      Add Subject
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
                  {missingShiftCoursesInActiveClass.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {missingShiftCoursesInActiveClass.map((course) => (
                        <button
                          key={`missing-shift-${course.courseId}`}
                          type="button"
                          onClick={() => openCreateShiftModal(course.courseId)}
                          className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                        >
                          Add shift for {course.courseName}
                        </button>
                      ))}
                    </div>
                  ) : null}

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
                    <div>
                      <h4 className="font-heading text-2xl text-slate-900">Students</h4>
                      <p className="mt-1 text-sm text-slate-500">
                        {enrolledStudentsCount} / {classCapacity} students enrolled
                      </p>
                    </div>
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(event) => setStudentSearch(event.target.value)}
                      placeholder="Search students..."
                      className="min-w-[240px] rounded-full border border-slate-200 px-4 py-2 text-sm"
                    />
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Enrolled: {enrolledStudentsCount} / {classCapacity} (capacity)
                      </span>
                      <span>{classFillPercent}% full</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full transition-all ${classFillColor}`}
                        style={{ width: `${classFillPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Shift</th>
                          <th className="px-4 py-3">Enrolled Courses</th>
                          <th className="px-4 py-3">Enrolled Date</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classStudentsQuery.isLoading ? (
                          Array.from({ length: 5 }).map((_, index) => (
                            <tr key={`class-student-skeleton-${index}`}>
                              <td colSpan={6} className="px-4 py-3">
                                <div className="skeleton h-10 rounded-xl" />
                              </td>
                            </tr>
                          ))
                        ) : filteredClassStudents.length < 1 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
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
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {student.email || "No email"}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {student.shiftName || "N/A"}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                <p className="text-xs font-semibold text-slate-700">
                                  {Number(student.enrolledCoursesCount || 0)}/
                                  {Number(student.totalCoursesCount || 0)}
                                </p>
                                <p className="mt-1 text-[11px] text-emerald-700">
                                  {(Array.isArray(student.enrolledCourses)
                                    ? student.enrolledCourses
                                    : []
                                  )
                                    .map((row) => row.courseName || "Course")
                                    .join(", ") || "None"}
                                </p>
                                {(Array.isArray(student.lockedCourses) ? student.lockedCourses : [])
                                  .length > 0 ? (
                                  <p className="mt-1 text-[11px] text-rose-700">
                                    Locked:{" "}
                                    {(student.lockedCourses || [])
                                      .map((row) => row.courseName || "Course")
                                      .join(", ")}
                                  </p>
                                ) : null}
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
                    Enrolled: {enrolledStudentsCount} / {classCapacity} (capacity)
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Full class price: PKR {Number(activeClass?.totalPrice || 0).toLocaleString("en-PK")}
                  </p>
                  {isClassFull ? (
                    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                      Class is full ({enrolledStudentsCount}/{classCapacity} students)
                    </div>
                  ) : null}
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Enrollment Type
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="enrollType"
                          checked={enrollEnrollmentType === "full_class"}
                          onChange={() => {
                            setEnrollEnrollmentType("full_class");
                            setEnrollCourseId("");
                          }}
                          disabled={isClassFull}
                        />
                        Full Class (PKR {Number(activeClass?.totalPrice || 0).toLocaleString("en-PK")})
                      </label>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Select Students ({enrollStudentIds.length} selected)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                            onClick={() =>
                              setEnrollStudentIds(
                                filteredAvailableStudentsForClass.map((student) => String(student.uid || "").trim()).filter(Boolean)
                              )
                            }
                            disabled={isClassFull || filteredAvailableStudentsForClass.length < 1}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                            onClick={() => setEnrollStudentIds([])}
                            disabled={isClassFull || enrollStudentIds.length < 1}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <input
                        value={enrollStudentSearch}
                        onChange={(event) => setEnrollStudentSearch(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                        placeholder="Search student by name/email"
                        disabled={isClassFull}
                      />

                      <div className="max-h-60 overflow-auto rounded-2xl border border-slate-200 bg-white p-2">
                        {filteredAvailableStudentsForClass.length < 1 ? (
                          <p className="px-2 py-6 text-center text-sm text-slate-500">
                            {studentsQuery.isLoading || studentsQuery.isFetching
                              ? "Loading students..."
                              : "No available students found."}
                          </p>
                        ) : (
                          filteredAvailableStudentsForClass.map((student) => {
                            const studentId = String(student.uid || "").trim();
                            const checked = enrollStudentIds.includes(studentId);
                            const seatLimitReached =
                              !checked && remainingSeats > 0 && enrollStudentIds.length >= remainingSeats;
                            const checkboxDisabled = isClassFull || seatLimitReached;
                            return (
                              <label
                                key={studentId}
                                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm hover:bg-slate-50"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-slate-900">
                                    {student.fullName || "Student"}
                                  </p>
                                  <p className="truncate text-xs text-slate-500">
                                    {student.email || "No email"}
                                  </p>
                                  {seatLimitReached ? (
                                    <p className="mt-1 text-[11px] text-amber-600">
                                      Seat limit reached ({remainingSeats} left).
                                    </p>
                                  ) : null}
                                </div>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleEnrollStudent(studentId)}
                                  disabled={checkboxDisabled}
                                />
                              </label>
                            );
                          })
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                          Showing {filteredAvailableStudentsForClass.length} of {students.length} loaded
                        </span>
                        {studentsQuery.hasNextPage ? (
                          <button
                            type="button"
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 disabled:opacity-50"
                            onClick={() => studentsQuery.fetchNextPage()}
                            disabled={studentsQuery.isFetchingNextPage}
                          >
                            {studentsQuery.isFetchingNextPage ? "Loading..." : "Load more"}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <select
                      value={enrollShiftId}
                      onChange={(event) => setEnrollShiftId(event.target.value)}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      disabled={isClassFull}
                    >
                      <option value="">Select shift</option>
                      {availableShiftsForEnrollment.map((shift) => (
                        <option key={shift.id} value={shift.id}>
                          {shift.name} - {(shift.days || []).map((day) => SHORT_DAYS[day]).join(", ")} -{" "}
                          {formatTime(shift.startTime)} to {formatTime(shift.endTime)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        const remaining = Math.max(0, classCapacity - enrolledStudentsCount);
                        if (!enrollStudentIds.length) {
                          toast.error("Select at least one student.");
                          return;
                        }
                        if (!enrollShiftId) {
                          toast.error("Select a shift first.");
                          return;
                        }
                        if (isClassFull || remaining < 1) {
                          toast.error("Class is full. Cannot add more students.");
                          return;
                        }
                        if (enrollStudentIds.length > remaining) {
                          toast.error(
                            `Only ${remaining} seat(s) left. Remove some students or increase capacity.`
                          );
                          return;
                        }

                        addStudentsMutation.mutate({
                          classId: activeClass.id,
                          studentIds: enrollStudentIds,
                          data: {
                            shiftId: enrollShiftId,
                            enrollmentType: enrollEnrollmentType,
                          },
                        });
                      }}
                      className="btn-primary h-[52px] self-start"
                      disabled={addStudentsMutation.isPending || isClassFull}
                    >
                      {isClassFull
                        ? "Class Full"
                        : addStudentsMutation.isPending
                        ? "Adding..."
                        : enrollStudentIds.length > 0
                          ? `Add ${enrollStudentIds.length} Student(s)`
                          : "Add Students"}
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
                {missingShiftCoursesInActiveClass.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-800">
                      Timetable is incomplete.
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      Missing schedule for{" "}
                      {missingShiftCoursesInActiveClass
                        .map((course) => course.courseName)
                        .join(", ")}
                      .
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {missingShiftCoursesInActiveClass.map((course) => (
                        <button
                          key={`schedule-missing-${course.courseId}`}
                          type="button"
                          onClick={() => {
                            setDrawerTab("courses");
                            openCreateShiftModal(course.courseId);
                          }}
                          className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-700"
                        >
                          Add shift for {course.courseName}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
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
                min={shiftModalMinStartTime}
                max={shiftForm.endTime || undefined}
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
                min={shiftForm.startTime || shiftModalMinStartTime || undefined}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
              <FieldError message={shiftErrors.endTime} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">Subject</label>
              {isSingleDrawerCourse ? (
                <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  {singleDrawerCourseName}
                </div>
              ) : (
                <select
                  value={shiftForm.courseId}
                  onChange={(event) =>
                    setShiftForm((prev) => {
                      const nextCourseId = event.target.value;
                      return {
                        ...prev,
                        courseId: nextCourseId,
                        teacherId: resolveDefaultTeacherId(nextCourseId, prev.teacherId),
                      };
                    })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                >
                  <option value="">Select subject</option>
                  {(activeClass?.assignedCourses || []).map((course) => (
                    <option key={course.courseId} value={course.courseId}>
                      {course.courseName || "Untitled Subject"}
                    </option>
                  ))}
                </select>
              )}
              <FieldError message={shiftErrors.courseId} />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Teacher</label>
              {shiftModalTeacherOptions.length > 1 ? (
                <select
                  value={shiftForm.teacherId}
                  onChange={(event) =>
                    setShiftForm((prev) => ({ ...prev, teacherId: event.target.value }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                >
                  <option value="">Select teacher</option>
                  {shiftModalTeacherOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.fullName}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                  {shiftModalAssignedTeacher?.fullName || "No assigned teacher"}
                </div>
              )}
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

