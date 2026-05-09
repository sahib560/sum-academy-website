# Sum Academy API Documentation (v1.4)

This document provides details for all essential API endpoints used in the Sum Academy platform. It is intended for both the frontend team and the Android mobile team to ensure synchronization and correct implementation of features.

## Base URL
The base URL for all API requests is: `https://your-api-domain.com/api` (Replace with actual server URL).

## Authentication
Most endpoints require a `Bearer` token in the `Authorization` header. This token is obtained from Firebase Authentication.

### Get Current Profile
- **Endpoint**: `GET /auth/me`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "uid": "user_id",
        "email": "student@example.com",
        "fullName": "John Doe",
        "role": "student",
        "status": "active",
        "isActive": true
      }
    }
  }
  ```

---

## Course Content & Lectures (Crucial for Android)

### Get Chapter/Subject Content
- **Endpoint**: `GET /student/courses/:courseId/chapters`
- **Response Item (Lecture)**:
  ```json
  {
    "id": "lecture_123",
    "title": "Introduction to Physics",
    "type": "video",
    "videoUrl": "...",
    "videoMode": "recorded",
    "isLiveSession": false,
    "liveStartAt": "2026-05-04T09:00:00",
    "liveEndAt": "2026-05-04T10:30:00",
    "isLocked": true,
    "lockReason": "Scheduled for 04 May, 09:00 AM",
    "durationSec": 5400
  }
  ```

### **Scheduling Logic (Android Developer Note)**:
1.  **Release Locking**: A lecture (Recorded or Live) is **LOCKED** if `liveStartAt` is set and the current server time is *before* that timestamp.
2.  **Live Window**: If `isLiveSession` is `true`, the video should be treated as a live stream between `liveStartAt` and `liveEndAt`.
3.  **Recorded Scheduling**: Recorded videos can now have a `liveStartAt`. If the current time is before this, the video must not be playable. Use the `lockReason` string provided by the API to show the student when it will be available.
4.  **Local Time**: All timestamps (`liveStartAt`, `liveEndAt`) are returned in **Asia/Karachi** (PKT) time.

---

## Student Management

### List Students (Admin/Teacher)
- **Endpoint**: `GET /admin/students`
- **Query Params**:
  - `pageSize`: Number (default 100)
  - `cursor`: String (for pagination)
  - `search`: String (filter by name/email)
  - `isActive`: Boolean (`true` or `false`) - **NEW**
- **Description**: Use `isActive=true` to fetch only active students for enrollment into classes.

---

## Student Assessments (Quizzes)

### Submit Quiz Attempt
- **Endpoint**: `POST /student/quizzes/:quizId/submit`
- **Payload**:
  ```json
  {
    "answers": [
      { "questionId": "q1", "answer": "Option A" }
    ]
  }
  ```
- **Evaluation Logic**:
  - **Flagged Questions**: The mobile app should show a confirmation dialog if the student has "flagged" questions before sending the final POST request.

### Quiz Result Avatar
- **Logic**: Use the first letter of the `fullName`. If `fullName` contains an `@` and no spaces (meaning it's an email fallback), take the first letter of the email prefix.
- **Example**: `John Doe` -> `J`, `john.doe@gmail.com` -> `J`.

---

## Student Assessments (Tests)

### List Available Tests
- **Endpoint**: `GET /student/tests`
- **Scheduling**: Tests are enabled ONLY during their specific time window. If `currentTime < testStartTime`, the "Start" button must be disabled.

### Submit Single Test Answer (Navigation & Persistence)
- **Endpoint**: `POST /student/tests/:testId/submit`
- **Payload**:
  ```json
  {
    "answer": "Option B",
    "targetIndex": 5, 
    "direction": "jump", 
    "flagged": true
  }
  ```
- **Navigation Logic (Android Developer Note)**:
  - `targetIndex` (Number): The index of the question the user wants to jump to. Use this for the non-linear question navigation grid.
  - `direction` (String): Can be `"next"`, `"prev"`, or `"jump"`.
  - `flagged` (Boolean): If the student marks the current question for review, send `true`. The backend persists this in the `flagged` array, so it is remembered if the student navigates away and returns.
  - **State Sync**: The response includes the `attempt` document, which contains the `flagged` array and performance metrics (`correctCount`, `wrongCount`, `missedCount`) if the test was finalized during this request.
  - **Performance Metrics (New)**: `correctCount`, `wrongCount`, and `missedCount` are now returned in the `attempt` object upon submission/finalization.

### Finish/Finalize Test
- **Endpoint**: `POST /student/tests/:testId/finish`
- **Payload**:
  ```json
  {
    "reason": "manual" 
  }
  ```
- **Note**: `reason` can be `"manual"`, `"timeout"`, `"auto"`, or `"violation"`.
- **Response**: Returns the final evaluated `attempt`, the `result` summary, and the `ranking` object.
  - **Attempt Data**: Now includes `correctCount`, `wrongCount`, `missedCount`, and `totalQuestions`.
  - **Ranking Data**: Includes `position`, `ordinalPosition`, and `totalParticipants`.

---

## Teacher & Admin Operations

### Assign Quiz
- **Endpoint**: `PATCH /teacher/quizzes/:quizId/assign` or `PATCH /admin/quizzes/:quizId/assign`
- **Payload**:
  ```json
  {
    "assignTo": "all_class" | "all_subject" | "specific" | "all_enrolled",
    "classId": "string", 
    "studentIds": ["student_id_1", "student_id_2"],
    "dueDate": "2026-05-10T23:59:59.000Z",
    "timeLimit": 30
  }
  ```
- **Logic Details**:
  1.  **`all_enrolled`**: Assigns the quiz to EVERY student enrolled in the course.
  2.  **`all_subject`**: Assigns the quiz to students enrolled in that specific subject.
  3.  **`all_class`**: Requires `classId`. Assigns to all students in that class.
  4.  **`specific`**: Requires `studentIds`. Assigns only to the listed students.

---

## Reporting & PDF Analysis (OMR Style)

### Download Student Report Card (Student)
- **Endpoint**: `GET /student/tests/:testId/report-card`
- **Response**: Binary (PDF Blob)
- **Format**: **Individual OMR Sheet**. Includes Exam info, Student details, a compact question-by-question grid with correctness indicators, and a performance summary box.

### Download Detailed Test Analysis (Admin/Teacher)
- **Endpoint**: `GET /admin/tests/:testId/report-detailed`
- **Endpoint (Teacher)**: `GET /teacher/tests/:testId/report-detailed`
- **Response**: Binary (PDF Blob)
- **Format**: **Comprehensive Multi-Page PDF**. 
  - **Page 1+**: Ranking table of all students (Attempted & Not Attempted).
  - **Following Pages**: Individual OMR sheets for every student who attempted the test, providing granular answer visibility.

---

## Success & Error Messaging

### Success Template
```json
{
  "success": true,
  "data": { ... },
  "message": "Action completed successfully"
}
```

### Error Template
```json
{
  "success": false,
  "error": "Error title",
  "message": "Detailed error message for the user",
  "code": "SPECIFIC_ERROR_CODE"
}
```

---
**Version History**
- **v1.4**: Implemented OMR-style PDF layout for Student Report Cards and Admin Detailed Analysis. Admin reports now include individual breakdown sheets for every student.
- **v1.3**: Added PDF Reporting endpoints for Students and Admins.
- **v1.2**: Added `all_enrolled` quiz assignment and cascading deletion.
- **v1.1**: Added Video Scheduling and `isActive` student filtering.
