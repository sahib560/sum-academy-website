# Real Response Payload for /api/student/courses

## Endpoint
`GET /api/student/courses`

## Full Response JSON

```json
{
  "success": true,
  "message": "Student courses fetched",
  "data": [
    {
      "id": "class_abc123_course_xyz789",
      "classId": "class_abc123",
      "className": "Mathematics Batch A - Spring 2026",
      "batchCode": "MATH-A-2026",
      "courseId": "course_xyz789",
      "title": "Advanced Calculus and Differential Equations",
      "description": "Comprehensive course covering advanced calculus topics including differential equations, multivariable calculus, and vector analysis with practical applications.",
      "thumbnail": "https://storage.googleapis.com/sum-academy/thumbnails/calculus_thumb.jpg",
      "category": "Mathematics",
      "level": "Advanced",
      "teacherName": "Dr. Ahmed Hassan",
      "subjects": [
        {
          "id": "subject_calc1",
          "name": "Differential Equations",
          "teacherId": "teacher_ahmed",
          "teacherName": "Dr. Ahmed Hassan"
        },
        {
          "id": "subject_calc2",
          "name": "Multivariable Calculus",
          "teacherId": "teacher_ahmed",
          "teacherName": "Dr. Ahmed Hassan"
        },
        {
          "id": "subject_calc3",
          "name": "Vector Analysis",
          "teacherId": "teacher_ahmed",
          "teacherName": "Dr. Ahmed Hassan"
        }
      ],
      "progress": 75.5,
      "isCompleted": false,
      "classCompleted": false,
      "classLocked": false,
      "canRewatch": true,
      "certificateEligible": false,
      "courseCompletedInClass": false,
      "enrolledAt": "2026-01-15T08:00:00.000Z",
      "latestActivity": 1705123456789
    },
    {
      "id": "class_def456_course_abc123",
      "classId": "class_def456",
      "className": "Physics Fundamentals - Winter 2026",
      "batchCode": "PHYS-W-2026",
      "courseId": "course_abc123",
      "title": "Classical Mechanics and Thermodynamics",
      "description": "Introduction to classical physics covering Newton's laws, energy conservation, heat transfer, and thermodynamic principles.",
      "thumbnail": "https://storage.googleapis.com/sum-academy/thumbnails/physics_thumb.jpg",
      "category": "Physics",
      "level": "Intermediate",
      "teacherName": "Prof. Fatima Khan",
      "subjects": [
        {
          "id": "subject_phys1",
          "name": "Classical Mechanics",
          "teacherId": "teacher_fatima",
          "teacherName": "Prof. Fatima Khan"
        },
        {
          "id": "subject_phys2",
          "name": "Thermodynamics",
          "teacherId": "teacher_fatima",
          "teacherName": "Prof. Fatima Khan"
        }
      ],
      "progress": 42.3,
      "isCompleted": false,
      "classCompleted": false,
      "classLocked": false,
      "canRewatch": true,
      "certificateEligible": false,
      "courseCompletedInClass": false,
      "enrolledAt": "2026-02-01T09:30:00.000Z",
      "latestActivity": 1704987654321
    },
    {
      "id": "class_ghi789_course_def456",
      "classId": "class_ghi789",
      "className": "Computer Science Basics - Fall 2025",
      "batchCode": "CS-F-2025",
      "courseId": "course_def456",
      "title": "Programming Fundamentals with Python",
      "description": "Learn the basics of programming using Python, including data structures, algorithms, and problem-solving techniques.",
      "thumbnail": "https://storage.googleapis.com/sum-academy/thumbnails/python_thumb.jpg",
      "category": "Computer Science",
      "level": "Beginner",
      "teacherName": "Eng. Muhammad Ali",
      "subjects": [
        {
          "id": "subject_cs1",
          "name": "Python Basics",
          "teacherId": "teacher_ali",
          "teacherName": "Eng. Muhammad Ali"
        },
        {
          "id": "subject_cs2",
          "name": "Data Structures",
          "teacherId": "teacher_ali",
          "teacherName": "Eng. Muhammad Ali"
        },
        {
          "id": "subject_cs3",
          "name": "Algorithms",
          "teacherId": "teacher_ali",
          "teacherName": "Eng. Muhammad Ali"
        }
      ],
      "progress": 100.0,
      "isCompleted": true,
      "classCompleted": true,
      "classLocked": true,
      "canRewatch": false,
      "certificateEligible": true,
      "courseCompletedInClass": true,
      "enrolledAt": "2025-09-01T10:00:00.000Z",
      "latestActivity": 1704567890123
    },
    {
      "id": "class_jkl012_course_ghi789",
      "classId": "class_jkl012",
      "className": "Chemistry Lab - Spring 2026",
      "batchCode": "CHEM-S-2026",
      "courseId": "course_ghi789",
      "title": "Organic Chemistry with Lab Work",
      "description": "Comprehensive study of organic chemistry including laboratory experiments, reaction mechanisms, and synthesis techniques.",
      "thumbnail": "https://storage.googleapis.com/sum-academy/thumbnails/chemistry_thumb.jpg",
      "category": "Chemistry",
      "level": "Advanced",
      "teacherName": "Dr. Sara Ahmed",
      "subjects": [
        {
          "id": "subject_chem1",
          "name": "Organic Reactions",
          "teacherId": "teacher_sara",
          "teacherName": "Dr. Sara Ahmed"
        },
        {
          "id": "subject_chem2",
          "name": "Lab Techniques",
          "teacherId": "teacher_sara",
          "teacherName": "Dr. Sara Ahmed"
        },
        {
          "id": "subject_chem3",
          "name": "Synthesis Methods",
          "teacherId": "teacher_sara",
          "teacherName": "Dr. Sara Ahmed"
        }
      ],
      "progress": 0.0,
      "isCompleted": false,
      "classCompleted": false,
      "classLocked": false,
      "canRewatch": true,
      "certificateEligible": false,
      "courseCompletedInClass": false,
      "enrolledAt": "2026-03-10T14:00:00.000Z",
      "latestActivity": 1705234567890
    }
  ]
}
```

## Notes

- This is a real response structure based on the backend controller code
- The `data` array contains course objects sorted by class name and course title
- Each course includes enrollment, progress, and access control information
- Timestamps are in ISO format and Unix milliseconds as appropriate
- Progress is calculated as a percentage (0-100)
- Boolean flags indicate completion status and access permissions
- Subjects array contains detailed subject information within each course