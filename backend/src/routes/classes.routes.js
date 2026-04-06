import { Router } from "express";
import { db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";

const router = Router();

const trimText = (value = "") => String(value || "").trim();
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const getStatusFromDates = (classData = {}) => {
  const explicitStatus = trimText(classData.status).toLowerCase();
  if (explicitStatus) return explicitStatus;

  const start = parseDate(classData.startDate);
  const end = parseDate(classData.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (start) {
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    if (today.getTime() < startDay.getTime()) return "upcoming";
  }
  if (end) {
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    if (today.getTime() > endDay.getTime()) return "completed";
  }

  return "active";
};

const getAssignedCourseIds = (classData = {}) => {
  const ids = [];
  const assigned = Array.isArray(classData.assignedCourses) ? classData.assignedCourses : [];
  assigned.forEach((entry) => {
    const courseId =
      typeof entry === "string"
        ? trimText(entry)
        : trimText(entry?.courseId || entry?.id);
    if (courseId) ids.push(courseId);
  });

  const classCourseId = trimText(classData.courseId);
  if (classCourseId) ids.push(classCourseId);

  const shifts = Array.isArray(classData.shifts) ? classData.shifts : [];
  shifts.forEach((shift) => {
    const shiftCourseId = trimText(shift?.courseId);
    if (shiftCourseId) ids.push(shiftCourseId);
  });

  return [...new Set(ids)];
};

router.get("/catalog", async (req, res) => {
  try {
    const coursesSnap = await db.collection(COLLECTIONS.COURSES).get();
    const data = coursesSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((course) => String(course.status || "").toLowerCase() !== "archived")
      .map((course) => {
        const subjects = Array.isArray(course.subjects) ? course.subjects : [];
        const firstSubject = subjects[0] || {};
        const rawPrice = Number(course.price || 0);
        const discountPercent = Number(course.discountPercent || 0);
        const finalPrice = Math.max(
          Number((rawPrice - (rawPrice * discountPercent) / 100).toFixed(2)),
          0
        );

        return {
          id: course.id,
          title: course.title || "",
          category: course.category || "General",
          level: course.level || "Beginner",
          price: finalPrice,
          originalPrice: rawPrice,
          discount: discountPercent,
          rating: Number(course.rating || 0),
          reviews: Number(course.ratingCount || 0),
          students: Number(course.enrollmentCount || 0),
          teacher:
            firstSubject.teacherName ||
            course.teacherName ||
            "SUM Academy Faculty",
          description:
            course.shortDescription || course.description || "",
          subjectsCount: subjects.length,
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));

    return successResponse(res, data, "Course catalog fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch course catalog", 500);
  }
});

router.get("/available", async (req, res) => {
  try {
    const courseId = trimText(req.query.courseId);
    const [classesSnap, coursesSnap] = await Promise.all([
      db.collection(COLLECTIONS.CLASSES).get(),
      db.collection(COLLECTIONS.COURSES).get(),
    ]);

    const courseMap = coursesSnap.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data() || {};
      return acc;
    }, {});

    const data = classesSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .map((classItem) => {
        const status = getStatusFromDates(classItem);
        const assignedCourseIds = getAssignedCourseIds(classItem);
        const capacity = Math.max(1, toNumber(classItem.capacity, 30));
        const students = Array.isArray(classItem.students) ? classItem.students : [];
        const enrolledCount = Math.max(students.length, toNumber(classItem.enrolledCount, 0));
        const spotsLeft = Math.max(capacity - enrolledCount, 0);
        const isFull = enrolledCount >= capacity;

        const assignedCourses = assignedCourseIds
          .map((id) => {
            const course = courseMap[id] || {};
            const courseSubjects = Array.isArray(course.subjects)
              ? course.subjects.map((subject) => ({
                  subjectId: trimText(subject?.id || subject?.subjectId),
                  name: trimText(subject?.name || subject?.subjectName) || "Subject",
                  teacherId: trimText(subject?.teacherId),
                  teacherName: trimText(subject?.teacherName) || "Teacher",
                }))
              : [];
            const subjectNames = courseSubjects.map((subject) => subject.name).filter(Boolean);
            const teacherNameFromSubject = courseSubjects.find(
              (subject) => trimText(subject.teacherName)
            )?.teacherName;
            const originalPrice = toNumber(course.price, 0);
            const discountPercent = Math.max(
              0,
              Math.min(100, toNumber(course.discountPercent, 0))
            );
            const discountedPrice = Number(
              Math.max(
                originalPrice - (originalPrice * discountPercent) / 100,
                0
              ).toFixed(2)
            );
            return {
              courseId: id,
              title: trimText(course.title) || "Course",
              thumbnail: course.thumbnail || null,
              price: originalPrice,
              originalPrice,
              discountPercent,
              finalPrice: discountedPrice,
              discountedPrice,
              subjectsCount: courseSubjects.length,
              subjects: subjectNames,
              teacherName: teacherNameFromSubject || trimText(course.teacherName) || "Teacher",
              courseName: trimText(course.title) || "Course",
            };
          })
          .filter((course) => trimText(course.courseId));

        const computedTotalPrice = Math.round(
          assignedCourses.reduce((sum, course) => {
            return sum + toNumber(course.finalPrice, toNumber(course.price, 0));
          }, 0)
        );
        const totalPrice = Math.max(
          0,
          Math.round(
            toNumber(
              classItem.totalPrice,
              computedTotalPrice
            )
          )
        );

        const shifts = (Array.isArray(classItem.shifts) ? classItem.shifts : [])
          .filter((shift) =>
            courseId ? trimText(shift?.courseId) === courseId : true
          )
          .map((shift) => ({
            id: trimText(shift?.id),
            name: trimText(shift?.name) || "Shift",
            days: Array.isArray(shift?.days) ? shift.days : [],
            startTime: trimText(shift?.startTime),
            endTime: trimText(shift?.endTime),
            teacherId: trimText(shift?.teacherId),
            teacherName: trimText(shift?.teacherName) || "Teacher",
            room: trimText(shift?.room),
            courseId: trimText(shift?.courseId),
            courseName: trimText(shift?.courseName),
          }))
          .filter((shift) => Boolean(shift.id));

        const teacherName =
          trimText(classItem.teacherName) ||
          trimText(classItem.teachers?.[0]?.teacherName) ||
          trimText(shifts[0]?.teacherName) ||
          "Teacher";

        const selectedCourse =
          assignedCourses.find((course) => course.courseId === courseId) ||
          assignedCourses[0] ||
          null;

        return {
          id: classItem.id,
          name: trimText(classItem.name) || "Class",
          batchCode: trimText(classItem.batchCode),
          description: trimText(classItem.description),
          teacherName,
          teacherId:
            trimText(classItem.teacherId) ||
            trimText(classItem.teachers?.[0]?.teacherId) ||
            trimText(shifts[0]?.teacherId),
          capacity,
          enrolledCount,
          spotsLeft,
          availableSpots: spotsLeft,
          isFull,
          status,
          startDate: classItem.startDate || null,
          endDate: classItem.endDate || null,
          totalPrice,
          coursesCount: Math.max(
            toNumber(classItem.coursesCount, 0),
            assignedCourses.length
          ),
          assignedCourses,
          course: selectedCourse
            ? {
                courseId: selectedCourse.courseId,
                courseName: selectedCourse.title,
                subjectName: selectedCourse.subjects?.[0] || "",
              }
            : null,
          shifts,
        };
      })
      .filter((classItem) => classItem.status !== "completed")
      .filter((classItem) =>
        courseId
          ? classItem.assignedCourses.some((course) => course.courseId === courseId)
          : true
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    return successResponse(res, data, "Available classes fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch available classes", 500);
  }
});

export default router;
