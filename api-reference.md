# SUM Academy API Reference

Base URL (prod): `https://sumacademy.net/api`

All responses use this envelope (unless noted otherwise):
```json
{
  "success": true,
  "message": "Human readable message",
  "data": {}
}
```

Auth header (when required):
```http
Authorization: Bearer <firebase_id_token>
```

Common error envelopes:
```json
// 400 Bad Request
{ "success": false, "message": "Validation error message", "errors": { "field": "what went wrong" } }
```
```json
// 401 Unauthorized
{ "success": false, "message": "No token provided" }
```
```json
// 403 Forbidden
{ "success": false, "message": "Access denied" }
```
```json
// 404 Not Found
{ "success": false, "message": "Resource not found" }
```
```json
// 429 Rate Limited
{ "success": false, "message": "Too many requests", "retryAfter": 60 }
```
```json
// 500 Server Error
{ "success": false, "message": "Internal server error" }
```

---

## AUTH

### POST /auth/register
**Auth:** Public  
**Description:** Register a new user (student/teacher/admin based on server rules).

**Request Body:**
```json
{
  "fullName": "string",
  "email": "string",
  "password": "string",
  "role": "student | teacher"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Registered successfully",
  "data": {
    "uid": "firebase_uid",
    "role": "student",
    "email": "student@example.com"
  }
}
```

**Error Responses:**
```json
{ "success": false, "message": "Email already exists" }
```

### POST /auth/login
**Auth:** Public  
**Description:** Login (server may return session cookie or simply confirm role/profile).

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "uid": "firebase_uid",
    "role": "student",
    "email": "student@example.com"
  }
}
```

### POST /auth/logout
**Auth:** Bearer | Role: any  
**Description:** Logout current session (if server sessions are enabled).

**Request Body:**
```json
{}
```

**Success Response (200):**
```json
{ "success": true, "message": "Logged out", "data": {} }
```

### GET /auth/me
**Auth:** Bearer | Role: any  
**Description:** Returns current authenticated profile.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Profile fetched",
  "data": {
    "uid": "firebase_uid",
    "role": "student",
    "email": "student@example.com",
    "fullName": "Ali Khan",
    "isActive": true
  }
}
```

---

## STUDENT

### GET /student/dashboard
**Auth:** Bearer | Role: student  
**Description:** Student dashboard summary.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Dashboard fetched",
  "data": {
    "student": { "uid": "stu_1", "fullName": "Ali Khan" },
    "classesCount": 2,
    "coursesCount": 3,
    "announcementsCount": 4
  }
}
```

### GET /student/courses
**Auth:** Bearer | Role: student  
**Description:** List courses/subjects available to the student (based on enrollment/class access).

**Success Response (200):**
```json
{
  "success": true,
  "message": "Student courses fetched",
  "data": [
    {
      "courseId": "course_1",
      "title": "Physics - XI",
      "thumbnail": "https://...",
      "progress": 35
    }
  ]
}
```

### GET /student/courses/:courseId/content
**Auth:** Bearer | Role: student  
**Description:** Full course content (chapters/lectures) for the player and progress gating.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Course content fetched",
  "data": {
    "courseId": "course_1",
    "title": "Physics - XI",
    "chapters": [
      {
        "chapterId": "ch_1",
        "title": "Chapter 1",
        "lectures": [
          { "lectureId": "lec_1", "title": "Intro", "isLocked": false }
        ]
      }
    ]
  }
}
```

### POST /student/courses/:courseId/lectures/:lectureId/complete
**Auth:** Bearer | Role: student  
**Description:** Mark lecture as complete (used for gating next content).

**Request Body:**
```json
{}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Lecture marked as complete",
  "data": {
    "courseId": "course_1",
    "lectureId": "lec_1",
    "courseCompleted": false
  }
}
```

### GET /student/quizzes
**Auth:** Bearer | Role: student  
**Description:** List quizzes assigned to the student (MCQ + other types supported by manual builder).

Notes:
- Only quizzes with `status=active` are listed.
- Assignment is based on `assignedStudents[]` and/or `assignedTo` (`all_subject`, `all_enrolled`, `all_class`).

**Success Response (200):**
```json
{
  "success": true,
  "message": "Student quizzes fetched",
  "data": [
    {
      "id": "quiz_1",
      "title": "Chapter 1 Quiz",
      "courseId": "course_1",
      "courseName": "Physics - XI",
      "subjectId": "sub_1",
      "subjectName": "Physics",
      "scope": "chapter",
      "chapterId": "ch_1",
      "chapterName": "Chapter 1",
      "questionsCount": 10,
      "totalMarks": 10,
      "passScore": 70,
      "timeLimit": 30,
      "assignedTo": "all_class",
      "isAssignedToYou": true,
      "assignmentBadge": "assigned_to_you",
      "dueDate": "2026-04-20T12:00:00.000Z",
      "dueAt": "2026-04-20T12:00:00.000Z",
      "isPastDue": false,
      "status": "available",
      "lastAttempt": null
    }
  ]
}
```

### GET /student/quizzes/:quizId
**Auth:** Bearer | Role: student  
**Description:** Fetch quiz questions for attempting (correct answers are never returned).

**Success Response (200):**
```json
{
  "success": true,
  "message": "Quiz fetched",
  "data": {
    "id": "quiz_1",
    "title": "Chapter 1 Quiz",
    "courseId": "course_1",
    "courseName": "Physics - XI",
    "subjectId": "sub_1",
    "subjectName": "Physics",
    "scope": "chapter",
    "totalMarks": 10,
    "passScore": 70,
    "timeLimit": 30,
    "questions": [
      {
        "questionId": "q1",
        "questionType": "mcq",
        "questionText": "What is 2+2?",
        "options": { "A": "3", "B": "4", "C": "5", "D": "6" },
        "marks": 1
      }
    ]
  }
}
```

### POST /student/quizzes/:quizId/submit
**Auth:** Bearer | Role: student  
**Description:** Submit quiz attempt, auto-grades objective questions, computes rank and class stats.

**Request Body:**
```json
{
  "answers": [
    { "questionId": "q1", "answer": "B" }
  ]
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Quiz submitted successfully",
  "data": {
    "resultId": "result_1",
    "quizId": "quiz_1",
    "isFinalQuiz": false,
    "autoScore": 8,
    "totalMarks": 10,
    "percentage": 80,
    "isPassed": true,
    "rank": 3,
    "totalAttempts": 25,
    "topScore": 96,
    "avgScore": 71.2,
    "passingCount": 18,
    "shortAnswerPending": 0,
    "status": "completed",
    "answers": [
      { "questionId": "q1", "questionType": "mcq", "status": "graded", "isCorrect": true, "marksObtained": 1 }
    ]
  }
}
```

**Error Responses:**
```json
{ "success": false, "message": "Quiz deadline has passed" }
```
```json
{ "success": false, "message": "This quiz is not assigned to you" }
```

### GET /student/certificates
**Auth:** Bearer | Role: student  
**Description:** List certificates.

### GET /student/announcements
**Auth:** Bearer | Role: student  
**Description:** List announcements visible to the student.

### GET /student/attendance
**Auth:** Bearer | Role: student  
**Description:** Attendance summary for student.

### GET /student/settings
**Auth:** Bearer | Role: student  
**Description:** Fetch student settings.

### PUT /student/settings
**Auth:** Bearer | Role: student  
**Description:** Update student settings.

**Request Body:**
```json
{
  "notificationsEnabled": true,
  "language": "en"
}
```

### GET /student/sessions/:sessionId/status
**Auth:** Bearer | Role: student  
**Description:** Fetch live session status/counters.

### POST /student/sessions/:sessionId/join
**Auth:** Bearer | Role: student  
**Description:** Join live session within join window.

### POST /student/sessions/:sessionId/leave
**Auth:** Bearer | Role: student  
**Description:** Mark leaving time for attendance.

---

## TEACHER

### GET /teacher/dashboard
**Auth:** Bearer | Role: teacher/admin  
**Description:** Teacher dashboard summary.

### GET /teacher/courses
**Auth:** Bearer | Role: teacher/admin  
**Description:** Teacher courses/subjects.

### GET /teacher/students
**Auth:** Bearer | Role: teacher/admin  
**Description:** Teacher student list.

### GET /teacher/sessions
**Auth:** Bearer | Role: teacher/admin  
**Description:** List teacher sessions.

### POST /teacher/sessions
**Auth:** Bearer | Role: teacher/admin  
**Description:** Create session.

### GET /teacher/quizzes
**Auth:** Bearer | Role: teacher/admin  
**Description:** List quizzes created by teacher/admin.

### GET /teacher/quizzes/:quizId
**Auth:** Bearer | Role: teacher/admin  
**Description:** Get quiz with questions (teacher view).

### POST /teacher/quizzes
**Auth:** Bearer | Role: teacher/admin  
**Description:** Create quiz manually.

### GET /teacher/quizzes/template
**Auth:** Bearer | Role: teacher/admin  
**Description:** Download MCQ-only bulk template CSV.

Query params:
- `courseId` (required)
- `subjectId` (required)
- `scope` = `subject|chapter` (required)
- `chapterId` (required when scope=chapter)
- optional: `subjectName` (used for filename)

**Success Response (200):** CSV file download  
Filename: `Quiz_MCQ_Template_<subjectName>.csv`

### POST /teacher/quizzes/bulk-upload
**Auth:** Bearer | Role: teacher/admin  
**Description:** Upload CSV to create quizzes (MCQ only).

**Request Body:** `multipart/form-data` with `file`  

**Success Response (201):**
```json
{
  "success": true,
  "message": "Bulk quiz upload completed",
  "data": {
    "quizzesCreated": 1,
    "questionsCreated": 3,
    "quizzes": [
      { "id": "quiz_1", "title": "Chapter 1 Quiz", "questionsCount": 3 }
    ],
    "commentRowsSkipped": 1
  }
}
```

**Error Response (400 - CSV validation errors):**
```json
{
  "success": false,
  "message": "CSV has validation errors",
  "errors": [
    "Row 4: MCQ correctAnswer must be A B C or D, got \"E\""
  ]
}
```

### PATCH /teacher/quizzes/:quizId/assign
**Auth:** Bearer | Role: teacher/admin  
**Description:** Assign quiz to students.

**Request Body:**
```json
{
  "assignTo": "all_class | all_subject | specific | all_enrolled",
  "classId": "string (required when assignTo=all_class)",
  "subjectId": "string (optional)",
  "studentIds": ["string (required when assignTo=specific)"],
  "dueDate": "ISO string or null (optional)",
  "timeLimit": 30
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Quiz assigned to 30 students",
  "data": {
    "quizId": "quiz_1",
    "assignedTo": "all_class",
    "studentsCount": 30,
    "dueDate": "2026-04-20T12:00:00.000Z"
  }
}
```

### GET /teacher/quizzes/:quizId/submissions
**Auth:** Bearer | Role: teacher/admin  
**Description:** Fetch quiz submissions for grading/analytics.

### PATCH /teacher/quizzes/:quizId/submissions/:resultId/grade-short
**Auth:** Bearer | Role: teacher/admin  
**Description:** Grade short answers (manual review) for a specific result.

### GET /teacher/announcements
**Auth:** Bearer | Role: teacher/admin  
**Description:** Teacher outgoing announcements.

### POST /teacher/announcements
**Auth:** Bearer | Role: teacher/admin  
**Description:** Create an announcement.

### GET /teacher/classes
**Auth:** Bearer | Role: teacher/admin  
**Description:** Teacher classes list.

### GET /teacher/settings/profile
**Auth:** Bearer | Role: teacher/admin  
**Description:** Teacher profile.

### PUT /teacher/settings/profile
**Auth:** Bearer | Role: teacher/admin  
**Description:** Update teacher profile.

---

## ADMIN

### GET /admin/stats
**Auth:** Bearer | Role: admin  
**Description:** Admin dashboard stats.

### GET /admin/users
**Auth:** Bearer | Role: admin  
**Description:** List users.

### POST /admin/users
**Auth:** Bearer | Role: admin  
**Description:** Create user.

### PUT /admin/users/:uid
**Auth:** Bearer | Role: admin  
**Description:** Update user.

### DELETE /admin/users/:uid
**Auth:** Bearer | Role: admin  
**Description:** Delete user.

### GET /admin/students
**Auth:** Bearer | Role: admin  
**Description:** List students.

### GET /admin/teachers
**Auth:** Bearer | Role: admin  
**Description:** List teachers.

### GET /admin/courses
**Auth:** Bearer | Role: admin  
**Description:** List courses/subjects.

### POST /admin/courses
**Auth:** Bearer | Role: admin  
**Description:** Create course/subject.

### PUT /admin/courses/:courseId
**Auth:** Bearer | Role: admin  
**Description:** Update course/subject.

### DELETE /admin/courses/:courseId
**Auth:** Bearer | Role: admin  
**Description:** Delete course/subject.

### GET /admin/classes
**Auth:** Bearer | Role: admin  
**Description:** List classes.

### POST /admin/classes
**Auth:** Bearer | Role: admin  
**Description:** Create class.

### PUT /admin/classes/:classId
**Auth:** Bearer | Role: admin  
**Description:** Update class.

### DELETE /admin/classes/:classId
**Auth:** Bearer | Role: admin  
**Description:** Delete class.

### POST /admin/classes/:classId/students
**Auth:** Bearer | Role: admin  
**Description:** Add students to class.

### DELETE /admin/classes/:classId/students/:studentId
**Auth:** Bearer | Role: admin  
**Description:** Remove student from class.

### GET /admin/payments
**Auth:** Bearer | Role: admin  
**Description:** List payments.

### PATCH /admin/payments/:id/verify
**Auth:** Bearer | Role: admin  
**Description:** Verify payment.

### GET /admin/installments
**Auth:** Bearer | Role: admin  
**Description:** List installments.

### POST /admin/installments
**Auth:** Bearer | Role: admin  
**Description:** Create installment plan.

### GET /admin/promo-codes
**Auth:** Bearer | Role: admin  
**Description:** List promo codes.

### POST /admin/promo-codes
**Auth:** Bearer | Role: admin  
**Description:** Create promo code.

### GET /admin/certificates
**Auth:** Bearer | Role: admin  
**Description:** List certificates.

### POST /admin/certificates
**Auth:** Bearer | Role: admin  
**Description:** Create certificate.

### GET /admin/announcements
**Auth:** Bearer | Role: admin  
**Description:** List announcements.

### POST /admin/announcements
**Auth:** Bearer | Role: admin  
**Description:** Create announcement.

### GET /admin/settings
**Auth:** Bearer | Role: admin  
**Description:** Fetch settings.

### PUT /admin/settings/general
**Auth:** Bearer | Role: admin  
**Description:** Update general site settings.

### PUT /admin/settings/payment
**Auth:** Bearer | Role: admin  
**Description:** Update payment settings.

### PATCH /admin/users/:uid/reset-device
**Auth:** Bearer | Role: admin  
**Description:** Reset user device binding.

---

## PROGRESS

### GET /student/courses/:courseId/content
**Auth:** Bearer | Role: student  
**Description:** Course content for progress gating. (See Student section.)

### POST /courses/:courseId/students/:studentId/unlock-all
**Auth:** Bearer | Role: admin/teacher  
**Description:** Unlock all videos/quizzes for a student in a course.

### PATCH /courses/:courseId/students/:studentId/video-access
**Auth:** Bearer | Role: admin/teacher  
**Description:** Update video access for a student.

---

## VIDEO

### GET /video/:lectureId/stream-url
**Auth:** Bearer | Role: student/teacher/admin  
**Description:** Get signed URL for playback.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Stream URL generated",
  "data": {
    "lectureId": "lec_1",
    "streamUrl": "https://storage.googleapis.com/...signed...",
    "expiresIn": 7200
  }
}
```

### GET /video/:lectureId/stream
**Auth:** Bearer | Role: student/teacher/admin  
**Description:** Proxy stream endpoint with Range support (used for seeking).

Response: `206 Partial Content` (Range) or `200 OK` (full).

### GET /sessions/:sessionId/recording
**Auth:** Bearer | Role: student/teacher/admin  
**Description:** Get signed recording URL for a completed session (if unlocked).

---

## PUBLIC

### GET /settings
**Auth:** Public  
**Description:** Public site settings (logo, hero text, social links, APK url, etc.).

### GET /courses/explore
**Auth:** Public  
**Description:** Explore public subjects/courses.

### GET /classes/available
**Auth:** Public  
**Description:** List classes open for enrollment.

### GET /verify/:certId
**Auth:** Public  
**Description:** Verify a certificate by public id.

### GET /health
**Auth:** Public  
**Description:** Health check.

