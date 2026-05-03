# SUM Academy - API Documentation

This document provides a comprehensive guide to the SUM Academy E-Portal APIs. It is designed to assist both web and mobile (Android/iOS) developers in integrating with the platform.

## Base URL
- **Production**: `https://api.sumacademy.com` (Example)
- **Staging/Local**: `http://localhost:5000/api`

---

## 1. Authentication (`/auth`)

### Send Registration OTP
- **Endpoint**: `POST /auth/register/send-otp`
- **Body**:
  ```json
  { "email": "student@example.com" }
  ```
- **Success (200)**: `{ "message": "OTP sent to your email" }`
- **Error (400)**: `{ "message": "Invalid email format" }`

### Verify Registration OTP
- **Endpoint**: `POST /auth/register/verify-otp`
- **Body**:
  ```json
  { "email": "student@example.com", "otp": "123456" }
  ```
- **Success (200)**: `{ "message": "OTP verified successfully" }`

### Login
- **Endpoint**: `POST /auth/login`
- **Headers**: `Authorization: Bearer <Firebase_ID_Token>`
- **Success (200)**:
  ```json
  {
    "success": true,
    "user": {
      "uid": "...",
      "email": "...",
      "role": "student",
      "fullName": "..."
    }
  }
  ```

### Get My Profile
- **Endpoint**: `GET /auth/me`
- **Headers**: `Authorization: Bearer <Token>`
- **Success (200)**: Returns user profile and current session data.

---

## 2. Student Dashboard (`/student`)

### Dashboard Stats
- **Endpoint**: `GET /student/dashboard`
- **Success (200)**:
  ```json
  {
    "stats": {
      "enrolledCourses": 5,
      "completedLectures": 25,
      "quizzesPassed": 3,
      "attendanceStreak": 4
    }
  }
  ```

---

## 3. Courses & Learning (`/student/courses`)

### List My Courses
- **Endpoint**: `GET /student/courses`
- **Success (200)**: Returns array of enrolled courses with progress, teacher info, and upcoming sessions.

### Course Progress Detail
- **Endpoint**: `GET /student/courses/:courseId/progress`
- **Success (200)**: Returns detailed syllabus, lecture completion status, and video links.

### Mark Lecture Complete
- **Endpoint**: `POST /student/courses/:courseId/lectures/:lectureId/complete`
- **Success (200)**: `{ "message": "Lecture marked as complete" }`

---

## 4. Quizzes (`/student/quizzes`)

### List Quizzes
- **Endpoint**: `GET /student/quizzes`
- **Success (200)**: Returns list of available/completed quizzes.

### Get Quiz Details
- **Endpoint**: `GET /student/quizzes/:quizId`
- **Success (200)**: Returns quiz metadata and questions (if active).

### Submit Quiz Attempt
- **Endpoint**: `POST /student/quizzes/:quizId/submit`
- **Body**:
  ```json
  [
    { "questionId": "q1", "answer": "Option A" },
    { "questionId": "q2", "answer": "Option B" }
  ]
  ```
- **Success (200)**: Returns score, percentage, and detailed result.

---

## 5. Standardized Tests (`/student/tests`)

### List Tests
- **Endpoint**: `GET /student/tests`
- **Success (200)**: Returns array of scheduled, active, or ended tests.

### Start Test
- **Endpoint**: `POST /student/tests/:testId/start`
- **Success (200)**: Returns the current question and initializes the attempt timer.

### Save/Submit Answer
- **Endpoint**: `POST /student/tests/:testId/answer`
- **Body**:
  ```json
  {
    "questionId": "q123",
    "selectedAnswer": "B",
    "direction": "next"
  }
  ```
- **Success (200)**: Returns the next question or completion status.

### Finish Test
- **Endpoint**: `POST /student/tests/:testId/finish`
- **Body**: `{ "reason": "manual" | "timeout" | "violation" }`
- **Success (200)**: `{ "message": "Test submitted", "attempt": { ... } }`

### Get Ranking
- **Endpoint**: `GET /student/tests/:testId/ranking`
- **Success (200)**: Returns leaderboard and student's own rank.

---

## 6. Live Sessions (`/student/sessions`)

### Join Session
- **Endpoint**: `POST /student/sessions/:sessionId/join`
- **Success (200)**: Returns session access metadata (Vimeo/Zoom links, etc.).

### Log Session Violation
- **Endpoint**: `POST /student/sessions/:sessionId/violation`
- **Body**: `{ "reason": "tab_switch", "details": "..." }`
- **Success (200)**: `{ "message": "Violation logged" }`

---

## 7. Announcements (`/student/announcements`)

### List Announcements
- **Endpoint**: `GET /student/announcements`
- **Success (200)**: Returns system and class-level announcements.

### Mark as Read
- **Endpoint**: `PATCH /student/announcements/:id/read`
- **Success (200)**: `{ "message": "Announcement marked as read" }`

---

## 8. Settings (`/student/settings`)

### Update Profile
- **Endpoint**: `PUT /student/settings`
- **Body**: `{ "fullName": "...", "phone": "..." }`
- **Success (200)**: `{ "message": "Settings updated" }`

---

## 9. Global Error Responses

All endpoints follow a standard error structure:

```json
{
  "success": false,
  "message": "Human readable error message",
  "code": "ERROR_CODE_IDENTIFIER",
  "errors": { ... } 
}
```

### Common Error Codes:
- `UNAUTHORIZED`: Invalid or missing token.
- `FORBIDDEN`: User does not have student role.
- `NOT_FOUND`: Resource (quiz/test/course) does not exist.
- `ACCOUNT_DEACTIVATED`: Multiple security violations detected.
- `TEST_EXPIRED`: Attempted to submit after deadline.

---

## Implementation Notes for Android Developers

1. **Authentication**: Use Firebase Auth SDK to obtain an ID Token, then pass it in the `Authorization: Bearer <Token>` header for all requests.
2. **Security Monitoring**: Implementing `setupMaxProtection` on mobile requires monitoring:
   - App background/foreground transitions (equivalent to tab switch).
   - Screenshots/Screen recording attempts.
3. **Image Loading**: Use the `fetchProtectedImage` pattern or similar to load images from `imagePath` if direct `imageUrl` is restricted.
4. **Time Sync**: Use the `serverNow` field returned in several responses to calculate accurate countdown timers, avoiding local device time drift.
