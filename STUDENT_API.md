# Student API Reference — Android Developer Guide

> **Base URL:** `https://<sumacademy.net>/api/student`  
> **Auth:** All endpoints require `Authorization: Bearer <Firebase ID Token>` header.  
> **Content-Type:** `application/json`

---

## Standard Response Envelope
```json
{ "success": true, "message": "...", "data": { ... } }
```
On error:
```json
{ "success": false, "message": "Error description", "error": { "code": "ERROR_CODE" } }
```

---

## Dashboard
| Method | Path | Description |
|---|---|---|
| GET | `/dashboard` | Student overview (courses, announcements, upcoming tests) |

---

## Courses
| Method | Path | Description |
|---|---|---|
| GET | `/courses` | All enrolled courses |
| GET | `/courses/:courseId/progress` | Detailed course progress |
| GET | `/courses/:courseId/final-quiz-request` | Final quiz unlock request status |
| POST | `/courses/:courseId/final-quiz-request` | Request final quiz unlock |
| POST | `/courses/:courseId/lectures/:lectureId/complete` | Mark a lecture complete |

---

## Live Sessions
| Method | Path | Description |
|---|---|---|
| GET | `/live-sessions` | Upcoming/active sessions |
| POST | `/live-sessions/:sessionId/join` | Join a live session |
| GET | `/sessions/:sessionId` | Session detail |
| POST | `/sessions/:sessionId/join` | Join an ongoing session |
| GET | `/sessions/:sessionId/status` | Session status |
| POST | `/sessions/:sessionId/leave` | Leave a session |
| GET | `/sessions/:sessionId/sync` | Sync data (slide, time) |
| POST | `/sessions/:sessionId/violation` | Report session violation |

---

## Certificates
| Method | Path | Description |
|---|---|---|
| GET | `/certificates` | All earned certificates |
| GET | `/certificates/:id/download` | Download certificate PDF (binary) |

---

## Announcements
| Method | Path | Description |
|---|---|---|
| GET | `/announcements` | All announcements for student |
| PATCH | `/announcements/:id/read` | Mark announcement as read |

---

## Quizzes
| Method | Path | Description |
|---|---|---|
| GET | `/quizzes` | All assigned quizzes |
| GET | `/quizzes/:quizId` | Quiz detail + questions |
| POST | `/quizzes/:quizId/submit` | Submit quiz answers |

**Submit body:**
```json
{ "answers": [{ "questionId": "q_001", "selectedAnswer": "Mitochondria" }] }
```

---

## Scheduled Quizzes
| Method | Path | Description |
|---|---|---|
| GET | `/scheduled-quizzes` | All scheduled quizzes |
| GET | `/scheduled-quizzes/:quizId` | Scheduled quiz detail + questions |
| POST | `/scheduled-quizzes/:quizId/submit` | Submit scheduled quiz |

---

## Settings
| Method | Path | Description |
|---|---|---|
| GET | `/settings` | Student settings |
| PUT | `/settings` | Update settings |

---

## Security
| Method | Path | Description |
|---|---|---|
| POST | `/security/violations` | Report a test security violation |

---

## Help & Support
| Method | Path | Description |
|---|---|---|
| POST | `/help-support` | Send a support message |

---

# Tests API (Student)
> Base path: `/api/student/tests`

---

## GET `/tests`
List all tests available to the student.

**Response `data` (array):**
```json
[
  {
    "testId": "test_abc123",
    "title": "Chapter 5 Assessment",
    "scope": "class",
    "className": "11-A Morning",
    "status": "active",
    "startAt": "2025-05-10T08:00:00Z",
    "endAt": "2025-05-10T10:00:00Z",
    "durationMinutes": 120,
    "questionsCount": 30,
    "totalMarks": 30,
    "maxViolations": 3,
    "attemptStatus": "not_started",
    "attempt": null
  }
]
```

**`attemptStatus` values:**
| Value | Meaning |
|---|---|
| `not_started` | Student hasn't started |
| `in_progress` | Test is active |
| `submitted` | Student submitted |
| `auto_submitted` | Auto-submitted (time/violation) |

---

## GET `/tests/:testId`
Full test details with questions and current attempt.

**Response `data`:**
```json
{
  "serverNow": "2025-05-10T08:05:00Z",
  "test": {
    "testId": "test_abc123",
    "title": "Chapter 5 Assessment",
    "startAt": "2025-05-10T08:00:00Z",
    "endAt": "2025-05-10T10:00:00Z",
    "durationMinutes": 120,
    "questionsCount": 30,
    "totalMarks": 30,
    "maxViolations": 3,
    "perQuestionTimeLimit": 60
  },
  "questions": [
    {
      "questionId": "q_001",
      "questionText": "What is Newton's first law?",
      "imageUrl": null,
      "imagePath": null,
      "options": ["An object at rest...", "F = ma", "For every action...", "None"],
      "marks": 1,
      "order": 1
    }
  ],
  "attempt": {
    "id": "attempt_xyz",
    "status": "in_progress",
    "currentIndex": 3,
    "totalQuestions": 30,
    "answersCount": 3,
    "flagged": ["q_002"],
    "startedAt": "2025-05-10T08:05:00Z",
    "expiresAt": "2025-05-10T10:00:00Z"
  },
  "currentQuestion": { "questionId": "q_004", "..." : "..." },
  "rankingPreview": null
}
```

> ⚠️ `correctAnswer` is **never** returned during an active test — only in `evaluatedAnswers` after submission.

---

## POST `/tests/:testId/start`
Start or resume a test attempt.

**Body:** *(empty)*

**Success Response:**
```json
{
  "serverNow": "2025-05-10T08:05:00Z",
  "testId": "test_abc123",
  "attempt": {
    "id": "attempt_xyz",
    "status": "in_progress",
    "currentIndex": 0,
    "totalQuestions": 30,
    "answersCount": 0,
    "startedAt": "...",
    "expiresAt": "2025-05-10T10:00:00Z"
  },
  "currentQuestion": { "questionId": "q_001", "...": "..." }
}
```

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| `ALREADY_SUBMITTED` | 409 | Already submitted — show results |
| `TEST_SCHEDULED` | 403 | Test hasn't started yet |
| `TEST_ENDED` | 403 | Test window has closed |

---

## POST `/tests/:testId/answer`
Save an answer and navigate to the next/previous/specific question.

**Request Body:**
```json
{
  "questionId": "q_001",
  "selectedAnswer": "An object at rest stays at rest...",
  "direction": "next",
  "targetIndex": null,
  "flagged": false
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `questionId` | string | ✅ | Question being answered |
| `selectedAnswer` | string | ✅ | Full option text. Send `""` to clear. |
| `direction` | string | ✅ | `"next"` / `"prev"` / `"stay"` / `"jump"` |
| `targetIndex` | number / null | Only for `"jump"` | 0-based index to jump to |
| `flagged` | boolean | ✅ | Flag for review |

**Response (mid-test):**
```json
{
  "completed": false,
  "attempt": {
    "id": "attempt_xyz",
    "status": "in_progress",
    "currentIndex": 1,
    "totalQuestions": 30,
    "answersCount": 1
  },
  "currentQuestion": { "questionId": "q_002", "...": "..." }
}
```

**Response (last question → auto-submit):**
```json
{
  "completed": true,
  "attempt": {
    "id": "attempt_xyz",
    "status": "submitted",
    "score": 24,
    "totalMarks": 30,
    "percentage": 80.0,
    "submittedAt": "2025-05-10T09:00:00Z"
  },
  "result": {
    "obtainedMarks": 24,
    "totalMarks": 30,
    "percentage": 80.0
  },
  "ranking": {
    "position": 3,
    "ordinalPosition": "3rd",
    "totalParticipants": 28
  }
}
```

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| `ATTEMPT_NOT_FOUND` | 404 | No active attempt |
| `TEST_EXPIRED` | 409 | Time is up — call `/finish` |
| `QUESTION_NOT_FOUND` | 404 | Question ID invalid |

---

## POST `/tests/:testId/finish`
Manually submit/finish the test.

**Body:**
```json
{ "reason": "manual" }
```

**`reason` options:** `"manual"` · `"violation"` · `"expired"`

**Response `data`:**
```json
{
  "testId": "test_abc123",
  "attemptId": "attempt_xyz",
  "result": {
    "obtainedMarks": 24,
    "totalMarks": 30,
    "percentage": 80.0,
    "correctCount": 24,
    "wrongCount": 4,
    "missedCount": 2
  },
  "ranking": {
    "position": 3,
    "ordinalPosition": "3rd",
    "totalParticipants": 28
  }
}
```

---

## GET `/tests/:testId/ranking`
Full class leaderboard (only accessible after submission).

**Response `data`:**
```json
{
  "testId": "test_abc123",
  "title": "Chapter 5 Assessment",
  "className": "11-A Morning",
  "totalParticipants": 28,
  "myResult": {
    "position": 3,
    "ordinalPosition": "3rd",
    "obtainedMarks": 24,
    "totalMarks": 30,
    "percentage": 80.0
  },
  "ranking": [
    {
      "position": 1,
      "studentId": "uid_abc",
      "studentName": "Fatima Khan",
      "className": "11-A Morning",
      "obtainedMarks": 30,
      "totalMarks": 30,
      "percentage": 100.0,
      "attemptId": "attempt_aaa"
    }
  ]
}
```

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| `RANKING_LOCKED` | 403 | Not submitted yet |

---

## GET `/tests/:testId/ranking/pdf`
Download ranking leaderboard as PDF (binary response).

**Response headers:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="SUM_Test_Ranking_Chapter5.pdf"
```

---

## GET `/tests/:testId/report-card`
Download the student's personal OMR report card as PDF. Contains:
- Student info & exam header
- OMR response grid (correct vs marked per question)
- Detailed question-by-question analysis with option text
- Summary stats (correct/wrong/missed/marks/rank)

**Response headers:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="Report_Card_Ahmed_Ali_Chapter5.pdf"
```

---

## Data Models Reference

### Test Object
| Field | Type | Description |
|---|---|---|
| `testId` | string | Unique ID |
| `title` | string | Display title |
| `scope` | `class` / `center` / `specific` | Who can see it |
| `className` | string | Class or "Entire Center" |
| `status` | `active` / `draft` / `ended` | Current state |
| `startAt` | ISO 8601 | Window opens |
| `endAt` | ISO 8601 | Window closes |
| `durationMinutes` | number | Test duration |
| `questionsCount` | number | Total questions |
| `totalMarks` | number | Max marks |
| `maxViolations` | number | Allowed violations |
| `perQuestionTimeLimit` | number | Seconds per question |

### Question Object (Student-safe)
| Field | Type | Description |
|---|---|---|
| `questionId` | string | Unique ID |
| `questionText` | string | HTML string |
| `imageUrl` | string / null | Direct image URL |
| `imagePath` | string / null | Firebase path (needs auth) |
| `options` | string[] | 4 option texts |
| `marks` | number | Marks value |
| `order` | number | 1-based display order |

### Attempt Object
| Field | Type | Description |
|---|---|---|
| `id` | string | Document ID |
| `status` | string | `in_progress` / `submitted` / `auto_submitted` |
| `currentIndex` | number | 0-based current question index |
| `totalQuestions` | number | Total questions |
| `answersCount` | number | How many answered |
| `flagged` | string[] | Flagged questionIds |
| `startedAt` | ISO string | Started at |
| `expiresAt` | ISO string | Expires at (= test endAt) |
| `score` | number | Only after submission |
| `percentage` | number | Only after submission |
| `submittedAt` | ISO string / null | Submitted at |

---

## Android Developer Tips

1. **Token refresh**: Firebase tokens expire in 1 hour. Use `FirebaseUser.getIdToken(true)` to force refresh before requests.
2. **Cache questions locally**: `GET /tests/:testId` returns all questions at once. Cache them on-device. Do NOT call individual question endpoints.
3. **Countdown timer**: Use `attempt.expiresAt` (absolute UTC time) for the countdown—NOT a local relative timer. This prevents clock drift.
4. **Handle `TEST_EXPIRED`**: On this error during answer save, immediately call `POST /finish` with `reason: "expired"`.
5. **Handle `ALREADY_SUBMITTED`**: On 409 from `start`, the student already finished. Navigate to results screen.
6. **Clearing answers**: To deselect an answer, send `selectedAnswer: ""`.
7. **Violations**: On each violation event, call `POST /security/violations`. When `violations >= maxViolations`, call `finish` with `reason: "violation"`.
8. **PDF files**: Receive raw binary bytes from PDF endpoints. Save with the filename from the `Content-Disposition` header to Downloads.
9. **Protected images**: If `imagePath` is present, use the student's Firebase Auth token to generate a download URL via Firebase Storage SDK. If `imageUrl` is present, use it directly.
10. **`serverNow` field**: Use this from the API response (not your device clock) to calculate remaining time. It compensates for device clock skew.
