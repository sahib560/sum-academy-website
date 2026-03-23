import { Router } from "express";
import { db } from "../config/firebase.js";
import { COLLECTIONS } from "../config/collections.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";

const router = Router();

router.get("/available", async (req, res) => {
  try {
    const courseId = String(req.query.courseId || "").trim();
    if (!courseId) {
      return errorResponse(res, "courseId query is required", 400);
    }

    const classesSnap = await db.collection(COLLECTIONS.CLASSES).get();
    const data = classesSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((classItem) => {
        const status = String(classItem.status || "").toLowerCase();
        if (status === "completed") return false;

        const assignedCourses = Array.isArray(classItem.assignedCourses)
          ? classItem.assignedCourses
          : [];
        return assignedCourses.some((course) => course.courseId === courseId);
      })
      .map((classItem) => {
        const assignedCourses = Array.isArray(classItem.assignedCourses)
          ? classItem.assignedCourses
          : [];
        const courseMeta = assignedCourses.find(
          (course) => course.courseId === courseId
        );

        const shifts = Array.isArray(classItem.shifts) ? classItem.shifts : [];
        const filteredShifts = shifts.filter((shift) => shift.courseId === courseId);
        const enrolledCount = Number(classItem.enrolledCount || 0);
        const capacity = Number(classItem.capacity || 0);
        const availableSpots = Math.max(capacity - enrolledCount, 0);

        return {
          id: classItem.id,
          name: classItem.name || "",
          batchCode: classItem.batchCode || "",
          description: classItem.description || "",
          status: classItem.status || "upcoming",
          capacity,
          enrolledCount,
          availableSpots,
          startDate: classItem.startDate || null,
          endDate: classItem.endDate || null,
          course: courseMeta || { courseId, courseName: "", subjectName: "" },
          shifts: filteredShifts,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return successResponse(res, data, "Available classes fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch available classes", 500);
  }
});

export default router;
