# Tests & Quizzes API Reference

> **For internal use / Admin & Teacher portals.**  
> **Base URLs:**
> - Admin: `https://<your-domain>/api/admin`
> - Teacher: `https://<your-domain>/api/teacher`
> - Student: `https://<your-domain>/api/student`
>
> **Auth:** `Authorization: Bearer <Firebase ID Token>` required on all endpoints.

---

## Standard Response Envelope
```json
{ "success": true, "message": "...", "data": { ... } }
```

---

# Tests API

## Admin & Teacher Endpoints

### GET `/tests`
List all managed tests (created by this teacher/admin or all for admin).

**Response `data` (array):**
```json
[
  {
    "testId": "test_abc123",
    "title": "Chapter 5 Assessment",
    "scope": "class",
    "classId": "class_001",
    "className": "11-A Morning",
    "status": "active",
    "startAt": "2025-05-10T08:00:00Z",
    "endAt": "2025-05-10T10:00:00Z",
    "durationMinutes": 120,
    "questionsCount": 30,
    "totalMarks": 30,
    "createdBy": "uid_teacher",
    "createdByName": "Sir Ahmed"
  }
]
```

---

### POST `/tests`
Create a new test manually.

**Body:**
```json
{
  "title": "Chapter 5 Assessment",
  "description": "Covers Newton's laws...",
  "scope": "class",
  "classId": "class_001",
  "startAt": "2025-05-10T08:00:00.000Z",
  "endAt": "2025-05-10T10:00:00.000Z",
  "maxViolations": 3,
  "perQuestionTimeLimit": 60,
  "questions": [
    {
      "questionText": "What is Newton's first law?",
      "optionA": "An object at rest stays at rest...",
      "optionB": "Force equals mass times acceleration",
      "optionC": "For every action there is an equal reaction",
      "optionD": "None of these",
      "correctAnswer": "A",
      "marks": 1,
      "imagePath": null
    }
  ]
}
```

**Scope values:** `"class"` (requires `classId`) · `"center"` (all students) · `"specific"` (requires `studentIds[]`)

---

### GET `/tests/template`
Download the bulk upload CSV template (binary `.csv` file).

---

### POST `/tests/bulk-upload`
Bulk create a test from a CSV file.

**Content-Type:** `multipart/form-data`  
**Form field:** `file` — the CSV file

**CSV columns:**
| Column | Required | Notes |
|---|---|---|
| `scope` | ✅ | `class` or `center` |
| `classid` | If scope=class | Class ID |
| `title` | ✅ | Test title (same for all rows) |
| `description` | — | Test description |
| `startat` | ✅ | ISO 8601 datetime |
| `endat` | ✅ | ISO 8601 datetime |
| `maxviolations` | — | Default: 3 |
| `questiontext` | ✅ | Question text (one per row) |
| `optiona` | ✅ | Option A text |
| `optionb` | ✅ | Option B text |
| `optionc` | ✅ | Option C text |
| `optiond` | ✅ | Option D text |
| `correctanswer` | ✅ | Must be A, B, C, or D |
| `marks` | — | Default: 1 |

---

### POST `/tests/questions/image`
Upload an image for a question.

**Content-Type:** `multipart/form-data`  
**Form field:** `image` — image file (JPG/PNG/WEBP, max 2MB)

**Response `data`:**
```json
{
  "imageUrl": "https://firebasestorage.googleapis.com/...",
  "imagePath": "test_question_images/1715000000-photo.jpg"
}
```

---

### POST `/tests/questions/image/delete`
Delete a previously uploaded question image.

**Body:**
```json
{ "imagePath": "test_question_images/1715000000-photo.jpg" }
```

---

### GET `/tests/:testId`
Get full test details including all questions and top 100 ranking.

**Response `data`:**
```json
{
  "testId": "test_abc123",
  "title": "Chapter 5 Assessment",
  "description": "...",
  "scope": "class",
  "classId": "class_001",
  "className": "11-A Morning",
  "startAt": "2025-05-10T08:00:00Z",
  "endAt": "2025-05-10T10:00:00Z",
  "durationMinutes": 120,
  "questionsCount": 30,
  "totalMarks": 30,
  "maxViolations": 3,
  "perQuestionTimeLimit": 60,
  "questions": [
    {
      "questionId": "q_001",
      "questionText": "What is Newton's first law?",
      "optionA": "An object at rest...",
      "optionB": "Force = ma",
      "optionC": "For every action...",
      "optionD": "None",
      "correctAnswer": "A",
      "marks": 1,
      "order": 1,
      "imagePath": null,
      "imageUrl": null
    }
  ],
  "ranking": [ ... ]
}
```

---

### PUT `/tests/:testId` *(Admin only)*
Full update of a test.

**Body:** Same as `POST /tests` — all fields optional, only include what to update.

---

### DELETE `/tests/:testId` *(Admin only)*
Permanently delete a test and all its question images.

---

### PATCH `/tests/:testId/reassign` *(Admin only)*
Reassign/reschedule a test to a different class/scope.

**Body:**
```json
{
  "assignTo": "all_class",
  "classId": "class_002",
  "startAt": "2025-05-15T08:00:00.000Z",
  "endAt": "2025-05-15T10:00:00.000Z"
}
```

**`assignTo` values:** `"all_class"` · `"center"` · `"specific"`

---

### GET `/tests/:testId/ranking`
Get the live ranking leaderboard for a test.

**Response `data`:**
```json
{
  "testId": "test_abc123",
  "title": "Chapter 5 Assessment",
  "className": "11-A Morning",
  "totalParticipants": 28,
  "ranking": [
    {
      "position": 1,
      "studentId": "uid_abc",
      "studentName": "Fatima Khan",
      "className": "11-A Morning",
      "obtainedMarks": 30,
      "totalMarks": 30,
      "percentage": 100.0,
      "correctCount": 30,
      "wrongCount": 0,
      "missedCount": 0,
      "attemptId": "attempt_aaa",
      "submittedAt": "2025-05-10T09:00:00Z"
    }
  ]
}
```

---

### GET `/tests/:testId/report-detailed`
Download the detailed test analysis PDF (binary). Contains:
- Summary ranking table for all students (attempted + not attempted)
- Individual OMR grid + question breakdown for every student

**Response headers:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="Detailed_Report_Chapter5.pdf"
```

---

## Student Endpoints (Tests)
> Base: `/api/student/tests`

| Method | Path | Description |
|---|---|---|
| GET | `/tests` | All accessible tests |
| GET | `/tests/:testId` | Test detail + questions + attempt |
| POST | `/tests/:testId/start` | Start or resume test |
| POST | `/tests/:testId/answer` | Save answer + navigate |
| POST | `/tests/:testId/finish` | Manual submit |
| GET | `/tests/:testId/ranking` | Leaderboard (post-submission only) |
| GET | `/tests/:testId/ranking/pdf` | Ranking PDF |
| GET | `/tests/:testId/report-card` | Personal OMR report card PDF |

---

# Quizzes API

## Admin & Teacher Endpoints
> Base: `/api/admin/quizzes` or `/api/teacher/quizzes`

### GET `/quizzes`
List all quizzes.

### POST `/quizzes`
Create a new quiz.

**Body:**
```json
{
  "title": "Biology Quiz 1",
  "subject": "Biology",
  "classId": "class_001",
  "dueDate": "2025-05-15T23:59:00Z",
  "questions": [
    {
      "questionText": "What is the powerhouse of the cell?",
      "type": "mcq",
      "options": ["Nucleus", "Mitochondria", "Ribosome", "Golgi body"],
      "correctAnswer": "Mitochondria",
      "marks": 1
    }
  ]
}
```

### GET `/quizzes/template`
Download bulk upload CSV template.

### POST `/quizzes/bulk-upload`
Bulk upload quiz via CSV (`multipart/form-data`, field: `file`).

### GET `/quizzes/:quizId`
Full quiz detail with all questions.

### DELETE `/quizzes/:quizId`
Delete a quiz.

### GET `/quizzes/:quizId/analytics`
Performance analytics for a quiz.

**Response `data`:**
```json
{
  "quizId": "quiz_abc",
  "title": "Biology Quiz 1",
  "submissionsCount": 25,
  "averageScore": 12.4,
  "averagePercentage": 82.7,
  "highestScore": 15,
  "lowestScore": 6,
  "questionAnalytics": [
    {
      "questionId": "q_001",
      "questionText": "...",
      "correctCount": 22,
      "wrongCount": 3,
      "accuracy": 88.0
    }
  ]
}
```

### PATCH `/quizzes/:quizId/assign`
Assign a quiz to a class or students.

**Body:**
```json
{
  "classId": "class_001",
  "studentIds": []
}
```

### POST `/quizzes/parse-formula`
Preview rendered LaTeX/formula HTML.

**Body:**
```json
{ "formula": "\\frac{a}{b}" }
```

### POST `/quizzes/questions/image`
Upload a quiz question image (`multipart/form-data`, field: `image`, max 2MB).

### POST `/quizzes/questions/image/delete`
Delete a quiz question image.

**Body:**
```json
{ "imagePath": "quiz_question_images/..." }
```

### POST `/quizzes/:quizId/evaluate`
Preview quiz evaluation without submitting.

### POST `/quizzes/:quizId/submissions`
Submit quiz attempt on behalf of a student (teacher use).

### GET `/quizzes/:quizId/submissions`
All submissions for a quiz.

**Response `data` (array):**
```json
[
  {
    "resultId": "result_abc",
    "studentId": "uid_123",
    "studentName": "Ahmed Ali",
    "score": 12,
    "totalMarks": 15,
    "percentage": 80.0,
    "submittedAt": "2025-05-12T10:00:00Z",
    "answers": [
      {
        "questionId": "q_001",
        "selectedAnswer": "Mitochondria",
        "isCorrect": true,
        "marksObtained": 1
      }
    ]
  }
]
```

### PATCH `/quizzes/:quizId/submissions/:resultId/grade-short`
Manually grade a short-answer question.

**Body:**
```json
{
  "questionId": "q_003",
  "marksAwarded": 2,
  "feedback": "Good explanation but missing details."
}
```

---

## Student Endpoints (Quizzes)
> Base: `/api/student/quizzes`

| Method | Path | Description |
|---|---|---|
| GET | `/quizzes` | All assigned quizzes |
| GET | `/quizzes/:quizId` | Quiz detail + questions |
| POST | `/quizzes/:quizId/submit` | Submit quiz |

**Submit body:**
```json
{
  "answers": [
    { "questionId": "q_001", "selectedAnswer": "Mitochondria" },
    { "questionId": "q_002", "selectedAnswer": "B" }
  ]
}
```

---

# Scheduled Quizzes API

## Teacher Endpoints
> Base: `/api/teacher/scheduled-quizzes`

| Method | Path | Description |
|---|---|---|
| GET | `/scheduled-quizzes` | All scheduled quizzes |
| GET | `/scheduled-quizzes/:quizId` | Detail |
| POST | `/scheduled-quizzes` | Create scheduled quiz |

**Create body:**
```json
{
  "title": "Weekly Physics Quiz",
  "classId": "class_001",
  "startAt": "2025-05-12T09:00:00Z",
  "endAt": "2025-05-12T10:00:00Z",
  "questions": [ ... ]
}
```

## Student Endpoints (Scheduled Quizzes)
> Base: `/api/student/scheduled-quizzes`

| Method | Path | Description |
|---|---|---|
| GET | `/scheduled-quizzes` | All scheduled quizzes |
| GET | `/scheduled-quizzes/:quizId` | Detail + questions |
| POST | `/scheduled-quizzes/:quizId/submit` | Submit |

---

# Question Bank API
> Only for teachers/admins. Base: `/api/teacher/question-bank`

| Method | Path | Description |
|---|---|---|
| GET | `/question-bank` | List all questions in the bank |
| POST | `/question-bank` | Add a question to the bank |

**Add question body:**
```json
{
  "questionText": "Define Newton's second law.",
  "type": "short_answer",
  "subject": "Physics",
  "difficulty": "medium",
  "correctAnswer": "Force equals mass times acceleration",
  "marks": 2
}
```

---

## Error Reference

| HTTP | `code` | Description |
|---|---|---|
| 400 | — | Bad request / missing fields |
| 401 | — | Missing or invalid auth token |
| 403 | `ACCESS_DENIED` | Role not permitted |
| 403 | `TEST_SCHEDULED` | Test hasn't started yet |
| 403 | `TEST_ENDED` | Test window closed |
| 403 | `RANKING_LOCKED` | Student hasn't submitted yet |
| 404 | — | Resource not found |
| 409 | `ALREADY_SUBMITTED` | Attempt already submitted |
| 409 | `TEST_EXPIRED` | Test time ran out |
| 500 | — | Server error |

---

## Notes for Android Developers

1. **Test flow:** `GET /tests` → `GET /tests/:testId` → `POST /start` → loop `POST /answer` → `POST /finish` → `GET /ranking`
2. **Question images**: If `imagePath` is set, the image is protected. Use Firebase Storage SDK with auth token to download.
3. **`selectedAnswer`** is always the **full text** of the option (e.g., `"Mitochondria"`), NOT the letter (A/B/C/D). The backend resolves it internally.
4. **PDF endpoints** return raw binary. Read as byte stream and save to device storage.
5. **`serverNow`** field in test responses gives authoritative server time. Use it for countdown timers to avoid device clock issues.
