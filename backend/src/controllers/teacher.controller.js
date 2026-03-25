import { db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";

const DAY_INDEX = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIso = (value) => {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : null;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const capitalize = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return "Draft";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getNameFromEmail = (email = "") =>
  String(email || "")
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim();

const resolveStudentName = (studentDoc = {}, userDoc = {}) => {
  return (
    studentDoc.fullName ||
    studentDoc.name ||
    userDoc.fullName ||
    userDoc.name ||
    userDoc.displayName ||
    getNameFromEmail(userDoc.email) ||
    "Student"
  );
};

const normalizeTeacherCourseIds = (courses = [], teacherId = "") => {
  return courses
    .filter((course) => {
      const data = course.data || {};
      const legacyTeacherMatch = String(data.teacherId || "") === teacherId;
      const subjects = Array.isArray(data.subjects) ? data.subjects : [];
      const subjectMatch = subjects.some(
        (subject) => String(subject?.teacherId || "") === teacherId
      );
      return legacyTeacherMatch || subjectMatch;
    })
    .map((course) => course.id);
};

const getNextShiftDate = (days = [], minDate, maxDate) => {
  if (!Array.isArray(days) || !days.length || !minDate || !maxDate) return null;

  const dayIndexes = days
    .map((day) => DAY_INDEX[String(day || "").trim().toLowerCase()])
    .filter((day) => Number.isInteger(day));

  if (!dayIndexes.length) return null;

  const start = new Date(minDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(maxDate);
  end.setHours(23, 59, 59, 999);

  let best = null;
  for (const targetDay of dayIndexes) {
    const candidate = new Date(start);
    const diff = (targetDay - candidate.getDay() + 7) % 7;
    candidate.setDate(candidate.getDate() + diff);
    if (candidate < start || candidate > end) continue;
    if (!best || candidate < best) best = candidate;
  }

  return best;
};

export const getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user?.uid;
    if (!teacherId) {
      return errorResponse(res, "Missing teacher uid", 400);
    }

    const [coursesSnap, classesSnap, enrollmentsSnap, quizResultsSnap] =
      await Promise.all([
        db.collection(COLLECTIONS.COURSES).get(),
        db.collection(COLLECTIONS.CLASSES).get(),
        db.collection(COLLECTIONS.ENROLLMENTS).get(),
        db.collection(COLLECTIONS.QUIZ_RESULTS).get(),
      ]);

    const allCourses = coursesSnap.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() || {},
    }));

    const teacherCourseIds = new Set(
      normalizeTeacherCourseIds(allCourses, teacherId)
    );

    const teacherCourses = allCourses.filter((course) =>
      teacherCourseIds.has(course.id)
    );

    const courseMetaById = {};
    teacherCourses.forEach((course) => {
      courseMetaById[course.id] = course.data;
    });

    const teacherEnrollments = enrollmentsSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => teacherCourseIds.has(String(row.courseId || "")));

    const uniqueStudentIds = new Set(
      teacherEnrollments
        .map((row) => String(row.studentId || "").trim())
        .filter(Boolean)
    );

    const [studentDocs, userDocs] = await Promise.all([
      Promise.all(
        Array.from(uniqueStudentIds).map(async (studentId) => {
          const snap = await db.collection(COLLECTIONS.STUDENTS).doc(studentId).get();
          return [studentId, snap.exists ? snap.data() || {} : {}];
        })
      ),
      Promise.all(
        Array.from(uniqueStudentIds).map(async (studentId) => {
          const snap = await db.collection(COLLECTIONS.USERS).doc(studentId).get();
          return [studentId, snap.exists ? snap.data() || {} : {}];
        })
      ),
    ]);

    const studentById = Object.fromEntries(studentDocs);
    const userById = Object.fromEntries(userDocs);

    const enrollmentMetrics = {};
    teacherEnrollments.forEach((row) => {
      const courseId = String(row.courseId || "");
      if (!courseId) return;
      if (!enrollmentMetrics[courseId]) {
        enrollmentMetrics[courseId] = {
          count: 0,
          progressTotal: 0,
          progressRows: 0,
        };
      }
      enrollmentMetrics[courseId].count += 1;
      const progress = toNumber(row.progress, null);
      if (Number.isFinite(progress)) {
        enrollmentMetrics[courseId].progressTotal += progress;
        enrollmentMetrics[courseId].progressRows += 1;
      }
    });

    const courses = teacherCourses
      .map((course) => {
        const data = course.data || {};
        const metrics = enrollmentMetrics[course.id] || {
          count: 0,
          progressTotal: 0,
          progressRows: 0,
        };

        const fallbackEnrolled = Math.max(
          0,
          toNumber(data.enrollmentCount, 0),
          metrics.count
        );

        const avgCompletion =
          metrics.progressRows > 0
            ? Math.round(metrics.progressTotal / metrics.progressRows)
            : fallbackEnrolled > 0
              ? Math.round(
                  (toNumber(data.completionCount, 0) / fallbackEnrolled) * 100
                )
              : 0;

        return {
          id: course.id,
          title: data.title || "Untitled Course",
          enrolled: fallbackEnrolled,
          completion: Math.max(0, Math.min(100, avgCompletion)),
          status: capitalize(data.status || "draft"),
          updatedAt: toIso(data.updatedAt) || toIso(data.createdAt),
        };
      })
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .slice(0, 8);

    const overallCompletionRate =
      teacherEnrollments.length > 0
        ? Math.round(
            teacherEnrollments.reduce(
              (sum, row) => sum + Math.max(0, Math.min(100, toNumber(row.progress, 0))),
              0
            ) / teacherEnrollments.length
          )
        : 0;

    const pendingQuizReviews = quizResultsSnap.docs
      .map((doc) => doc.data() || {})
      .filter((row) => {
        const courseId = String(row.courseId || "").trim();
        const belongsToTeacherCourse = teacherCourseIds.has(courseId);
        const belongsToTeacher = String(row.teacherId || "").trim() === teacherId;
        if (!belongsToTeacherCourse && !belongsToTeacher) return false;
        const status = String(row.status || "").toLowerCase();
        if (status.includes("pending") || status.includes("submitted")) return true;
        if (row.reviewedAt) return false;
        return row.score === null || row.score === undefined;
      }).length;

    const activities = teacherEnrollments
      .flatMap((row) => {
        const studentId = String(row.studentId || "").trim();
        const studentDoc = studentById[studentId] || {};
        const userDoc = userById[studentId] || {};
        const studentName = resolveStudentName(studentDoc, userDoc);
        const courseName =
          courseMetaById[String(row.courseId || "")]?.title || "Course";

        const items = [];
        const enrolledAt = toIso(row.createdAt);
        if (enrolledAt) {
          items.push({
            id: `${row.id}-enroll`,
            name: studentName,
            action: "New enrollment",
            course: courseName,
            timestamp: enrolledAt,
          });
        }

        const completedAt = toIso(row.completedAt);
        if (completedAt) {
          items.push({
            id: `${row.id}-completed`,
            name: studentName,
            action: "Course completed",
            course: courseName,
            timestamp: completedAt,
          });
        }
        return items;
      })
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        name: item.name,
        action: item.action,
        course: item.course,
        time: item.timestamp,
      }));

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const sessions = classesSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .flatMap((classData) => {
        const startDate = toDate(classData.startDate) || now;
        const endDate = toDate(classData.endDate) || new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        if (endDate < now) return [];

        const minDate = startDate > now ? startDate : now;
        const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];

        return shifts
          .filter((shift) => String(shift?.teacherId || "") === teacherId)
          .map((shift) => {
            const nextDate = getNextShiftDate(shift?.days || [], minDate, endDate);
            if (!nextDate) return null;
            return {
              id: `${classData.id}-${shift?.id || `${shift?.name || "shift"}-${shift?.startTime || "time"}`}`,
              title: `${classData.name || "Class"} - ${shift?.courseName || shift?.name || "Session"}`,
              date: nextDate.toISOString(),
              time: String(shift?.startTime || "").trim() || "TBD",
            };
          })
          .filter(Boolean);
      })
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
      .slice(0, 6);

    const payload = {
      stats: {
        myCourses: teacherCourses.length,
        totalMyStudents: uniqueStudentIds.size,
        avgCompletionRate: overallCompletionRate,
        pendingQuizReviews,
      },
      courses,
      activities,
      sessions,
    };

    return successResponse(res, payload, "Teacher dashboard fetched");
  } catch (error) {
    console.error("getTeacherDashboard error:", error);
    return errorResponse(res, "Failed to fetch teacher dashboard", 500);
  }
};
