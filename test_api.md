# SUM Academy — Test API Documentation
> **For Android Developer** | Base URL: `https://<your-domain>/api`  
> All endpoints require **Firebase ID Token** in the `Authorization` header unless stated otherwise.

---

## Authentication
Every request must include:
```
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json
```
Only `student` role tokens are valid for student endpoints.

---

## Standard Response Envelope

Every API response (success or error) follows this shape:

```json
{
  "success": true,          // boolean
  "message": "...",         // human-readable message
  "data": { ... }           // payload (null on error)
}
```

**Error response:**
```json
{
  "success": false,
  "message": "Error description",
  "data": null,
  "error": { "code": "OPTIONAL_ERROR_CODE" }
}
```

---

## 1. Get All Tests for Student

Lists all tests the student is eligible to see (class-assigned + center-wide).

```
GET /api/student/tests
```

### Response `data` — Array of Test Summary objects

```json
[
  {
    "id": "TEST_ID",
    "title": "Biology Weekly Test 1",
    "description": "Practice test for the week",
    "scope": "class",                      // "class" | "center"
    "classId": "CLASS_ID",
    "className": "9th Class - Morning",
    "startAt": "2026-06-10T09:00:00.000Z", // ISO 8601 UTC
    "endAt":   "2026-06-10T10:30:00.000Z", // ISO 8601 UTC
    "durationMinutes": 90,
    "totalMarks": 50,
    "questionsCount": 50,
    "status": "active",                    // "scheduled" | "active" | "ended"
    "canAttempt": true,                    // false if already submitted or window closed
    "hasSubmittedAttempt": false,
    "inProgress": false,
    "obtainedMarks": null,                 // number if submitted, else null
    "percentage": null,                    // number if submitted, else null
    "submittedAt": null,                   // ISO string if submitted, else null
    "maxViolations": 3,
    "attempt": null                        // see Attempt Object below, or null
  }
]
```

#### `status` values:
| Value | Meaning |
|-------|---------|
| `"scheduled"` | Test not yet started (before `startAt`) |
| `"active"` | Test is currently live (between `startAt` and `endAt`) |
| `"ended"` | Test window has passed (after `endAt`) |

---

## 2. Get Single Test Details

Returns full test info + all questions + current attempt state.

```
GET /api/student/tests/:testId
```

### Response `data`

```json
{
  "serverNow": "2026-06-10T09:05:00.000Z",   // server's current UTC time — use this for the countdown timer

  "test": {
    "id": "TEST_ID",
    "title": "Biology Weekly Test 1",
    "description": "Practice test for the week",
    "scope": "class",
    "classId": "CLASS_ID",
    "className": "9th Class - Morning",
    "startAt": "2026-06-10T09:00:00.000Z",
    "endAt":   "2026-06-10T10:30:00.000Z",
    "durationMinutes": 90,
    "totalMarks": 50,
    "questionsCount": 50,
    "status": "active",
    "canAttempt": true,
    "hasSubmittedAttempt": false,
    "inProgress": false,
    "obtainedMarks": null,
    "percentage": null,
    "submittedAt": null,
    "maxViolations": 3,
    "perQuestionTimeLimit": 60
  },

  "questions": [                            // shown even before starting
    {
      "questionId": "QID_1",
      "order": 1,                           // 1-based display order
      "questionText": "What is the powerhouse of the cell?",
      "options": ["Nucleus", "Mitochondria", "Ribosome", "Golgi"],
      "marks": 1,
      "imageUrl": null                      // URL string or null
    }
  ],

  "attempt": null,                          // Attempt Object if in_progress or submitted, else null

  "currentQuestion": null,                  // Question Object if in_progress, else null

  "rankingPreview": null                    // Ranking Preview Object if submitted, else null
}
```

---

## 3. Start Test

Creates a new attempt and returns the first question.

```
POST /api/student/tests/:testId/start
```

**No request body needed.**

### Success Response `data` (new attempt started)

```json
{
  "serverNow": "2026-06-10T09:05:00.000Z",
  "testId": "TEST_ID",
  "attempt": {
    "id": "ATTEMPT_ID",
    "status": "in_progress",
    "currentIndex": 0,
    "totalQuestions": 50,
    "answersCount": 0,
    "answers": [],
    "flagged": [],
    "startedAt": "2026-06-10T09:05:00.000Z",
    "expiresAt": "2026-06-10T10:30:00.000Z"  // same as test's endAt — use for countdown
  },
  "currentQuestion": {
    "questionId": "QID_1",
    "order": 1,
    "questionText": "What is the powerhouse of the cell?",
    "options": ["Nucleus", "Mitochondria", "Ribosome", "Golgi"],
    "marks": 1,
    "imageUrl": null
  }
}
```

### Resume Response (attempt already in progress)
Returns same shape as above but with `message: "Resuming your test attempt"` and existing `currentIndex` / `answers`.

### Error Codes
| HTTP | `code` | Meaning |
|------|--------|---------|
| 409 | `ALREADY_SUBMITTED` | Student already submitted this test |
| 400 | _(none)_ | Test not yet started / already ended |
| 403 | _(none)_ | Student not assigned to this test |

---

## 4. Submit Answer (Navigate Between Questions)

Save an answer and move to next/previous/specific question. Called on **every** answer.

```
POST /api/student/tests/:testId/answer
```

### Request Body

```json
{
  "questionId": "QID_1",         // required — the current question's ID
  "selectedAnswer": "B",         // required — "A" | "B" | "C" | "D" | "" (blank to un-answer)
  "direction": "next",           // optional — "next" | "prev" | "jump" | "stay"
  "targetIndex": null,           // required only when direction="jump" — 0-based target index
  "flagged": false               // optional — true to flag this question for review
}
```

#### `direction` behavior:
| Value | Effect on `currentIndex` |
|-------|--------------------------|
| `"next"` (default) | Moves forward one question |
| `"prev"` | Moves back one question |
| `"jump"` | Jumps to `targetIndex` (0-based) |
| `"stay"` | Stays on current question |

> **Auto-submit:** If `direction = "next"` on the **last question**, the test is automatically submitted and results are returned.

---

### Response A — Test Still In Progress (`completed: false`)

```json
{
  "completed": false,
  "attempt": {
    "id": "ATTEMPT_ID",
    "status": "in_progress",
    "currentIndex": 1,           // 0-based index of NEXT question to show
    "totalQuestions": 50,
    "answersCount": 1,
    "answers": [
      {
        "questionId": "QID_1",
        "selectedAnswer": "B",
        "answeredAt": "2026-06-10T09:06:10.000Z",
        "questionOrder": 1
      }
    ],
    "flagged": [],               // array of questionIds that are flagged
    "updatedAt": "2026-06-10T09:06:10.000Z"
  },
  "currentQuestion": {
    "questionId": "QID_2",
    "order": 2,
    "questionText": "The human heart has how many chambers?",
    "options": ["2", "3", "4", "5"],
    "marks": 1,
    "imageUrl": null
  }
}
```

---

### Response B — Test Auto-Submitted on Last Question (`completed: true`)

```json
{
  "completed": true,
  "attempt": {
    "id": "ATTEMPT_ID",
    "status": "submitted",
    "currentIndex": 50,
    "totalQuestions": 50,
    "answersCount": 50,
    "score": 38,
    "totalMarks": 50,
    "percentage": 76.0,
    "submittedAt": "2026-06-10T10:02:00.000Z"
  },
  "result": {
    "obtainedMarks": 38,
    "totalMarks": 50,
    "percentage": 76.0
  },
  "ranking": {
    "position": 3,
    "ordinalPosition": "3rd",
    "totalParticipants": 25
  }
}
```

### Error Codes
| HTTP | `code` | Meaning |
|------|--------|---------|
| 404 | `ATTEMPT_NOT_FOUND` | No active attempt — call `/start` first |
| 409 | `TEST_EXPIRED` | Timer has run out — call `/finish` instead |
| 404 | `QUESTION_NOT_FOUND` | `questionId` is not in this test |

---

## 5. Finish / Submit Test (Manual or Timeout)

Submits the test with all answers answered so far. Call this when:
- Student taps "Finish Test" manually
- Timer reaches zero (client-side timeout)
- Security violation limit exceeded

```
POST /api/student/tests/:testId/finish
```

### Request Body

```json
{
  "reason": "manual"    // "manual" | "timeout" | "violation" | "auto"
}
```

> **Important:** For `reason = "timeout"` or `"auto"`, the server verifies that the server-side time is actually past `endAt` (with 3-second tolerance). If not, returns 409.

### Response `data`

```json
{
  "completed": true,
  "attempt": {
    "id": "ATTEMPT_ID",
    "status": "submitted",          // or "auto_submitted" for timeout/violation
    "currentIndex": 50,
    "totalQuestions": 50,
    "answersCount": 42,             // questions answered before finishing
    "score": 35,
    "totalMarks": 50,
    "percentage": 70.0
  },
  "result": {
    "obtainedMarks": 35,
    "totalMarks": 50,
    "percentage": 70.0
  },
  "ranking": {
    "position": 5,
    "ordinalPosition": "5th",
    "totalParticipants": 25
  }
}
```

#### `attempt.status` values after finish:
| Value | Trigger |
|-------|---------|
| `"submitted"` | `reason = "manual"` |
| `"auto_submitted"` | `reason = "timeout"`, `"violation"`, or `"auto"` |

### Error Codes
| HTTP | `code` | Meaning |
|------|--------|---------|
| 409 | `TEST_NOT_EXPIRED` | reason=timeout but server time is still before endAt |
| 404 | _(none)_ | No attempt found |

---

## 6. Get Test Ranking

Returns class/center ranking. Only available after the student has submitted.

```
GET /api/student/tests/:testId/ranking
```

### Response `data`

```json
{
  "testId": "TEST_ID",
  "title": "Biology Weekly Test 1",
  "className": "9th Class - Morning",
  "totalParticipants": 25,

  "myResult": {
    "position": 3,
    "ordinalPosition": "3rd",
    "obtainedMarks": 38,
    "totalMarks": 50,
    "percentage": 76.0
  },

  "ranking": [
    {
      "attemptId": "ATTEMPT_ID",
      "studentId": "STUDENT_UID",
      "studentName": "Ahmed Ali",
      "className": "9th Class - Morning",
      "obtainedMarks": 45,
      "totalMarks": 50,
      "correctCount": 45,
      "wrongCount": 4,
      "missedCount": 1,
      "totalQuestions": 50,
      "percentage": 90.0,
      "submittedAt": "2026-06-10T09:58:00.000Z",
      "position": 1
    },
    {
      "attemptId": "...",
      "studentId": "...",
      "studentName": "Sara Khan",
      "className": "9th Class - Morning",
      "obtainedMarks": 45,
      "totalMarks": 50,
      "correctCount": 45,
      "wrongCount": 4,
      "missedCount": 1,
      "totalQuestions": 50,
      "percentage": 90.0,
      "submittedAt": "2026-06-10T10:00:00.000Z",
      "position": 1      // same position for tied scores
    }
  ]
}
```

> Ranking is sorted by `obtainedMarks` DESC → `percentage` DESC → `submittedAt` ASC (earlier submission wins ties).

### Error Codes
| HTTP | `code` | Meaning |
|------|--------|---------|
| 403 | `RANKING_LOCKED` | Student hasn't submitted yet |

---

## 7. Download Ranking PDF

Returns a PDF file (binary). Show as download or open in PDF viewer.

```
GET /api/student/tests/:testId/ranking/pdf
```

- **Response:** `Content-Type: application/pdf` binary stream  
- **Filename header:** `Content-Disposition: attachment; filename="SUM_Test_Ranking_<title>.pdf"`

---

## 8. Download Report Card PDF (OMR Sheet)

Returns the student's personal OMR-style result card as PDF.

```
GET /api/student/tests/:testId/report-card
```

- **Response:** `Content-Type: application/pdf` binary stream  
- **Filename header:** `Content-Disposition: attachment; filename="Report_Card_<name>_<title>.pdf"`
- Only available after test is submitted.

---

## Key Data Objects Reference

### Attempt Object

```json
{
  "id": "ATTEMPT_ID",
  "testId": "TEST_ID",
  "status": "in_progress",          // "in_progress" | "submitted" | "auto_submitted"
  "currentIndex": 5,                // 0-based index of current question
  "totalQuestions": 50,
  "answersCount": 5,
  "answers": [                      // only present when status = "in_progress"
    {
      "questionId": "QID_1",
      "selectedAnswer": "B",        // "A" | "B" | "C" | "D" | ""
      "answeredAt": "2026-06-10T09:06:10.000Z",
      "questionOrder": 1
    }
  ],
  "flagged": ["QID_3", "QID_7"],    // questionIds flagged for review (in_progress only)
  "score": 0,                       // 0 while in_progress, filled on submit
  "totalMarks": 50,
  "percentage": 0,
  "startedAt": "2026-06-10T09:05:00.000Z",
  "updatedAt": "2026-06-10T09:10:00.000Z",
  "submittedAt": null,              // ISO string when submitted
  "expiresAt": "2026-06-10T10:30:00.000Z",   // = test endAt — use for countdown timer
  "evaluatedAnswers": null          // only present when status = "submitted" (see below)
}
```

### Evaluated Answers (after submission)

```json
"evaluatedAnswers": [
  {
    "questionId": "QID_1",
    "selectedAnswer": "B",
    "correctAnswer": "B",
    "selectedLetter": "B",
    "correctLetter": "B",
    "isCorrect": true,
    "marks": 1,
    "questionOrder": 1,
    "answeredAt": "2026-06-10T09:06:10.000Z"
  }
]
```

### Question Object (as returned to student)

```json
{
  "questionId": "QID_1",
  "order": 1,
  "questionText": "What is the powerhouse of the cell?",
  "options": ["Nucleus", "Mitochondria", "Ribosome", "Golgi"],
  "marks": 1,
  "imageUrl": "https://firebasestorage.googleapis.com/..."   // or null
}
```

> ⚠️ **correctAnswer is NEVER sent to the student** during an active test. It only appears in `evaluatedAnswers` after submission.

### Ranking Preview Object

Returned inside `getStudentTestById` when the student has already submitted:

```json
{
  "position": 3,
  "ordinalPosition": "3rd",
  "totalParticipants": 25,
  "obtainedMarks": 38,
  "totalMarks": 50,
  "percentage": 76.0
}
```

---

## Timer Implementation Guide

> Use `serverNow` and `expiresAt` from the API responses — never trust the device clock alone.

```
remainingSeconds = (expiresAt_ms - serverNow_ms) / 1000
localOffset     = (expiresAt_ms - serverNow_ms) - deviceRemainingMs
```

**Algorithm:**
1. On `GET /tests/:testId` or `POST /tests/:testId/start`, read:
   - `data.serverNow` → server timestamp
   - `data.attempt.expiresAt` → expiry timestamp
2. Compute `remainingMs = Date.parse(expiresAt) - Date.parse(serverNow)`
3. Compute `deviceExpiryTime = Date.now() + remainingMs`
4. Run countdown against `deviceExpiryTime` (device clock-based, avoids drift)
5. When countdown reaches 0: call `POST /tests/:testId/finish` with `{"reason": "timeout"}`

---

## Security Violations

When a student exits the app, screenshots, or triggers a violation, increment the local violation count.  
When `violations >= maxViolations`, auto-submit:

```
POST /api/student/tests/:testId/finish
Body: { "reason": "violation" }
```

`maxViolations` is returned in both the test list and test detail responses.

---

## Error Reference

| HTTP Status | Meaning |
|-------------|---------|
| 400 | Bad request / validation failed |
| 401 | Missing or invalid Firebase token |
| 403 | Access denied / student not assigned / ranking locked |
| 404 | Resource not found |
| 409 | Conflict — already submitted / test expired / test not expired yet |
| 500 | Server error |

---

## Complete Student Test Flow (Android)

```
1. GET /api/student/tests
   └─ Show list of tests with status badges

2. User taps a test → GET /api/student/tests/:testId
   └─ Show test info screen
   └─ If attempt.status == "in_progress"  → go to step 4 (resume)
   └─ If attempt.status == "submitted"    → show results screen
   └─ If canAttempt == true               → show "Start Test" button

3. User taps "Start Test" → POST /api/student/tests/:testId/start
   └─ Save attempt.id, attempt.expiresAt, serverNow
   └─ Start countdown timer
   └─ Show currentQuestion (index 0)

4. For each question:
   └─ User selects answer → POST /api/student/tests/:testId/answer
        Body: { questionId, selectedAnswer, direction: "next" }
   └─ If completed == true  → show results
   └─ If completed == false → show currentQuestion

5. User taps "Finish Test" → POST /api/student/tests/:testId/finish
        Body: { reason: "manual" }
   └─ Show results from response

6. Timer reaches 0 → POST /api/student/tests/:testId/finish
        Body: { reason: "timeout" }

7. After submission → GET /api/student/tests/:testId/ranking
   └─ Show leaderboard

8. Optional PDF → GET /api/student/tests/:testId/report-card
```

---

## Notes for Android Developer

- **All timestamps are ISO 8601 UTC** (e.g., `"2026-06-10T09:00:00.000Z"`). Parse with `Instant.parse()` or `OffsetDateTime.parse()`.
- **`options` is an array of strings** in display order: `["Option A text", "Option B text", "Option C text", "Option D text"]`. Index 0 = A, 1 = B, 2 = C, 3 = D.
- **`selectedAnswer`** sent in answers is `"A"`, `"B"`, `"C"`, or `"D"` (single letter), not the option text.
- **`imageUrl`** can be `null` or a full Firebase Storage HTTPS URL — render an image view only if not null.
- **`questionText`** may contain HTML tags (e.g., `<b>`, `<i>`, `<sub>`, `<sup>`) for formulas/math. Use a WebView or HTML renderer.
- **Ranking is public** (all student names shown) — expected behavior.
- **`expiresAt`** = the test's `endAt`, NOT start + duration. The timer is absolute to the test window end.
- **PDF endpoints return binary** — download and open with the device's native PDF viewer or a library.
- On **network error** mid-answer, retry the `/answer` call — answers are idempotent for the same `questionId` (last answer wins).
