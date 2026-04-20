# SUM Academy API (A-Z)

Base URL (prod): `https://sumacademy.net/api`

Notes:
- Most endpoints return JSON using the standard envelope below (unless marked **(non-standard)**).
- Auth protected endpoints require: `Authorization: Bearer <firebase_id_token>`
- Timestamps are ISO strings unless noted.
- In this system, `courseId` and `subjectId` refer to the same entity in many places (aliases exist in routes).

---

## Standard Response Envelopes

### Success (most endpoints)
```json
{
  "success": true,
  "message": "Human readable message",
  "data": {}
}
```

### Error (most endpoints)
```json
{
  "success": false,
  "message": "Human readable error message",
  "error": "Human readable error message",
  "errors": { "code": "OPTIONAL_MACHINE_CODE", "any": "extra details" }
}
```

Common auth/role errors:
```json
{ "success": false, "message": "No token provided", "error": "No token provided" }
```
```json
{ "success": false, "message": "Access denied", "error": "Access denied" }
```

Rate limit example (some endpoints):
```json
{ "success": false, "message": "Too many requests. Please wait a moment.", "retryAfter": 60 }
```

---

## Endpoint Index (A-Z)

### `/api/admin/*` (Admin)
- GET `/api/admin/analytics-report`
- GET `/api/admin/announcements`
- POST `/api/admin/announcements`
- PUT `/api/admin/announcements/:id`
- DELETE `/api/admin/announcements/:id`
- PATCH `/api/admin/announcements/:id/pin`
- POST `/api/admin/classes`
- POST `/api/admin/classes/:classId/courses`
- POST `/api/admin/classes/:classId/enroll`
- POST `/api/admin/classes/:classId/shifts`
- POST `/api/admin/classes/:classId/students`
- POST `/api/admin/classes/:classId/subjects`
- DELETE `/api/admin/classes/:classId`
- DELETE `/api/admin/classes/:classId/courses/:courseId`
- DELETE `/api/admin/classes/:classId/shifts/:shiftId`
- DELETE `/api/admin/classes/:classId/students/:studentId`
- DELETE `/api/admin/classes/:classId/subjects/:courseId`
- GET `/api/admin/classes`
- GET `/api/admin/classes/:classId/students`
- PATCH `/api/admin/classes/:classId/reopen`
- PUT `/api/admin/classes/:classId`
- PUT `/api/admin/classes/:classId/shifts/:shiftId`
- GET `/api/admin/class-performance`
- GET `/api/admin/courses`
- POST `/api/admin/courses`
- POST `/api/admin/courses/:courseId/subjects`
- POST `/api/admin/courses/:courseId/subjects/:subjectId/content`
- DELETE `/api/admin/courses/:courseId`
- DELETE `/api/admin/courses/:courseId/content/:contentId`
- DELETE `/api/admin/courses/:courseId/subjects/:subjectId`
- GET `/api/admin/courses/:courseId/content`
- PATCH `/api/admin/courses/:courseId`
- PUT `/api/admin/courses/:courseId`
- GET `/api/admin/courses` (alias of subjects is also available)
- GET `/api/admin/certificates`
- POST `/api/admin/certificates`
- PATCH `/api/admin/certificates/:certId/revoke`
- PATCH `/api/admin/certificates/:certId/unrevoke`
- GET `/api/admin/final-quiz-requests`
- PATCH `/api/admin/final-quiz-requests/:requestId`
- GET `/api/admin/installments`
- POST `/api/admin/installments`
- GET `/api/admin/installments/:planId`
- PATCH `/api/admin/installments/:planId/:number/pay`
- POST `/api/admin/installments/send-reminders`
- PUT `/api/admin/installments/:planId/override`
- GET `/api/admin/payments`
- PATCH `/api/admin/payments/:paymentId/verify`
- PATCH `/api/admin/payments/:id/verify` (alias)
- GET `/api/admin/promo-codes`
- POST `/api/admin/promo-codes`
- PUT `/api/admin/promo-codes/:codeId`
- DELETE `/api/admin/promo-codes/:codeId`
- PATCH `/api/admin/promo-codes/:codeId/toggle`
- POST `/api/admin/promo-codes/validate`
- GET `/api/admin/quizzes`
- POST `/api/admin/quizzes`
- POST `/api/admin/quizzes/bulk-upload` (**multipart/form-data**)
- GET `/api/admin/quizzes/template` (**CSV download**)
- GET `/api/admin/quizzes/:quizId`
- GET `/api/admin/quizzes/:quizId/analytics`
- PATCH `/api/admin/quizzes/:quizId/assign`
- GET `/api/admin/quizzes/:quizId/submissions`
- GET `/api/admin/recent-activity`
- GET `/api/admin/recent-enrollments`
- GET `/api/admin/revenue-chart`
- PATCH `/api/admin/sessions/:sessionId/unlock`
- GET `/api/admin/settings`
- PUT `/api/admin/settings/about`
- PUT `/api/admin/settings/appearance`
- PUT `/api/admin/settings/certificate`
- PUT `/api/admin/settings/contact`
- PUT `/api/admin/settings/email`
- POST `/api/admin/settings/email/test`
- PUT `/api/admin/settings/features`
- PUT `/api/admin/settings/footer`
- PUT `/api/admin/settings/general`
- PUT `/api/admin/settings/hero`
- PUT `/api/admin/settings/how-it-works`
- PUT `/api/admin/settings/maintenance`
- PUT `/api/admin/settings/payment`
- PUT `/api/admin/settings/security`
- PUT `/api/admin/settings/templates`
- GET `/api/admin/settings/templates`
- PUT `/api/admin/settings/testimonials`
- GET `/api/admin/stats`
- GET `/api/admin/students`
- GET `/api/admin/students/template` (**CSV download**)
- POST `/api/admin/students/bulk-upload` (**multipart/form-data**)
- GET `/api/admin/students/:uid`
- GET `/api/admin/students/:uid/progress`
- PATCH `/api/admin/students/:uid/approve`
- PATCH `/api/admin/students/:uid/reject`
- PATCH `/api/admin/students/:uid/payment-rejections/reset`
- GET `/api/admin/support/messages`
- PATCH `/api/admin/support/messages/:messageId/read`
- POST `/api/admin/support/messages/:messageId/reply`
- DELETE `/api/admin/support/messages/:messageId`
- GET `/api/admin/teachers`
- GET `/api/admin/teachers/:uid`
- GET `/api/admin/tests`
- POST `/api/admin/tests`
- GET `/api/admin/tests/template` (**CSV download**)
- POST `/api/admin/tests/bulk-upload` (**multipart/form-data**)
- GET `/api/admin/tests/:testId`
- GET `/api/admin/tests/:testId/ranking`
- GET `/api/admin/top-classes`
- GET `/api/admin/top-courses`
- GET `/api/admin/users`
- POST `/api/admin/users`
- GET `/api/admin/users/:uid`
- PUT `/api/admin/users/:uid`
- DELETE `/api/admin/users/:uid`
- PATCH `/api/admin/users/:uid/role`
- PATCH `/api/admin/users/:uid/reset-device`
- GET `/api/admin/videos`
- POST `/api/admin/videos`
- DELETE `/api/admin/videos/:videoId`

### `/api/announcements/*` (Token user)
- GET `/api/announcements/my`
- PATCH `/api/announcements/read-all`
- PATCH `/api/announcements/:id/read`

### `/api/auth/*` (Auth)
- POST `/api/auth/forgot-password/reset`
- POST `/api/auth/forgot-password/send-otp`
- POST `/api/auth/forgot-password/verify-otp`
- POST `/api/auth/login`
- GET `/api/auth/me`
- POST `/api/auth/logout`
- POST `/api/auth/register`
- POST `/api/auth/register/send-otp`
- POST `/api/auth/register/verify-otp`
- PATCH `/api/auth/set-role`

### `/api/classes/*` (Public)
- GET `/api/classes/available`
- GET `/api/classes/catalog`

### `/api/contact/*` (Public)
- POST `/api/contact/messages`

### `/api/courses/*` (Public)
- GET `/api/courses/explore`

### `/api/courses/*` + `/api/subjects/*` (Teacher/Admin Progress)
- PATCH `/api/courses/:courseId/lectures/:lectureId/lock`
- PATCH `/api/subjects/:subjectId/lectures/:lectureId/lock`
- PATCH `/api/courses/:courseId/students/:studentId/video-access`
- PATCH `/api/subjects/:subjectId/students/:studentId/video-access`
- POST `/api/courses/:courseId/students/:studentId/unlock-all`
- POST `/api/subjects/:subjectId/students/:studentId/unlock-all`
- GET `/api/courses/:courseId/students/:studentId/progress`
- GET `/api/subjects/:subjectId/students/:studentId/progress`
- POST `/api/courses/:courseId/students/:studentId/complete`
- POST `/api/subjects/:subjectId/students/:studentId/complete`

### `/api/classes/:classId/students/:studentId/complete` (Teacher/Admin Progress)
- POST `/api/classes/:classId/students/:studentId/complete`

### `/api/health` (Public, non-standard)
- GET `/api/health`

### `/api/launch/*` (Public)
- POST `/api/launch/notify`
- POST `/api/launch/notify/dispatch`

### `/api/payments/*` (Student auth)
- POST `/api/payments/initiate`
- GET `/api/payments/config`
- GET `/api/payments/my-installments`
- GET `/api/payments/my-payments`
- GET `/api/payments/:id/status`
- POST `/api/payments/:paymentId/finish`
- POST `/api/payments/:paymentId/receipt` (**multipart/form-data OR JSON**) (non-standard in parts)
- PATCH `/api/payments/:paymentId/receipt` (**multipart/form-data OR JSON**) (non-standard in parts)
- POST `/api/payments/validate-promo`

### `/api/promo-codes/*` (Auth)
- POST `/api/promo-codes/validate`

### `/api/settings` (Public)
- GET `/api/settings`

### `/api/sessions/*` (Auth)
- GET `/api/sessions/:sessionId/recording`

### `/api/student/*` (Student)
- GET `/api/student/announcements`
- PATCH `/api/student/announcements/:id/read`
- GET `/api/student/certificates`
- GET `/api/student/certificates/:id/download` (**file download**)
- GET `/api/student/courses/:courseId/content`
- GET `/api/student/subjects/:subjectId/content`
- POST `/api/student/courses/:courseId/lectures/:lectureId/complete`
- POST `/api/student/subjects/:subjectId/lectures/:lectureId/complete`
- PATCH `/api/student/courses/:courseId/lectures/:lectureId/progress`
- PATCH `/api/student/subjects/:subjectId/lectures/:lectureId/progress`
- GET `/api/student/courses`
- GET `/api/student/courses/:courseId/final-quiz-request`
- POST `/api/student/courses/:courseId/final-quiz-request`
- POST `/api/student/courses/:courseId/lectures/:lectureId/complete`
- GET `/api/student/courses/:courseId/progress`
- GET `/api/student/dashboard`
- POST `/api/student/help-support`
- GET `/api/student/live-sessions`
- POST `/api/student/live-sessions/:sessionId/join`
- POST `/api/student/quizzes/:quizId/submit`
- GET `/api/student/quizzes`
- GET `/api/student/quizzes/:quizId`
- GET `/api/student/scheduled-quizzes`
- GET `/api/student/scheduled-quizzes/:quizId`
- POST `/api/student/scheduled-quizzes/:quizId/submit`
- POST `/api/student/security/violations`
- GET `/api/student/sessions/:sessionId`
- POST `/api/student/sessions/:sessionId/join`
- POST `/api/student/sessions/:sessionId/leave`
- GET `/api/student/sessions/:sessionId/status`
- GET `/api/student/sessions/:sessionId/sync`
- POST `/api/student/sessions/:sessionId/violation`
- GET `/api/student/settings`
- PUT `/api/student/settings`
- POST `/api/student/tests/:testId/answer`
- POST `/api/student/tests/:testId/finish`
- GET `/api/student/tests/:testId/ranking`
- GET `/api/student/tests/:testId/ranking/pdf` (**PDF download**)
- POST `/api/student/tests/:testId/start`
- GET `/api/student/tests`
- GET `/api/student/tests/:testId`

### `/api/teacher/*` (Teacher/Admin)
- POST `/api/teacher/announcements`
- GET `/api/teacher/announcements`
- GET `/api/teacher/classes`
- PATCH `/api/teacher/classes/:classId/reopen`
- GET `/api/teacher/courses`
- GET `/api/teacher/courses/:courseId`
- GET `/api/teacher/courses/:courseId/students`
- PATCH `/api/teacher/courses/:courseId/students/:studentId/rewatch-access`
- PATCH `/api/teacher/courses/:courseId/students/:studentId/video-access`
- GET `/api/teacher/courses/:courseId/subjects/:subjectId/chapters`
- POST `/api/teacher/courses/:courseId/subjects/:subjectId/chapters`
- GET `/api/teacher/dashboard`
- GET `/api/teacher/final-quiz-requests`
- PATCH `/api/teacher/final-quiz-requests/:requestId`
- GET `/api/teacher/question-bank`
- POST `/api/teacher/question-bank`
- GET `/api/teacher/quizzes`
- POST `/api/teacher/quizzes`
- GET `/api/teacher/quizzes/template` (**CSV download**)
- POST `/api/teacher/quizzes/bulk-upload` (**multipart/form-data**)
- PATCH `/api/teacher/quizzes/:quizId/assign`
- GET `/api/teacher/quizzes/:quizId`
- GET `/api/teacher/quizzes/:quizId/analytics`
- POST `/api/teacher/quizzes/:quizId/evaluate`
- POST `/api/teacher/quizzes/:quizId/submissions`
- GET `/api/teacher/quizzes/:quizId/submissions`
- PATCH `/api/teacher/quizzes/:quizId/submissions/:resultId/grade-short`
- GET `/api/teacher/scheduled-quizzes`
- POST `/api/teacher/scheduled-quizzes`
- GET `/api/teacher/scheduled-quizzes/:quizId`
- GET `/api/teacher/sessions`
- POST `/api/teacher/sessions`
- GET `/api/teacher/sessions/:sessionId`
- PUT `/api/teacher/sessions/:sessionId`
- PATCH `/api/teacher/sessions/:sessionId/cancel`
- PATCH `/api/teacher/sessions/:sessionId/complete`
- GET `/api/teacher/sessions/:sessionId/attendance`
- POST `/api/teacher/sessions/:sessionId/attendance`
- PATCH `/api/teacher/sessions/:sessionId/unlock`
- GET `/api/teacher/settings/profile`
- PUT `/api/teacher/settings/profile`
- GET `/api/teacher/settings/security`
- PATCH `/api/teacher/settings/security/sessions/:sessionDocId/revoke`
- PATCH `/api/teacher/settings/security/sessions/revoke-all`
- GET `/api/teacher/students`
- GET `/api/teacher/students/:studentId`
- GET `/api/teacher/students/:studentId/attendance/:classId`
- GET `/api/teacher/students/:studentId/progress/:courseId`
- PATCH `/api/teacher/students/:studentId/video-access`
- GET `/api/teacher/tests`
- POST `/api/teacher/tests`
- GET `/api/teacher/tests/template` (**CSV download**)
- POST `/api/teacher/tests/bulk-upload` (**multipart/form-data**)
- GET `/api/teacher/tests/:testId`
- GET `/api/teacher/tests/:testId/ranking`
- GET `/api/teacher/timetable`
- GET `/api/teacher/videos`
- POST `/api/teacher/videos`
- GET `/api/teacher/chapters/:chapterId/lectures`
- POST `/api/teacher/chapters/:chapterId/lectures`
- PUT `/api/teacher/chapters/:chapterId`
- DELETE `/api/teacher/chapters/:chapterId`
- PUT `/api/teacher/lectures/:lectureId`
- DELETE `/api/teacher/lectures/:lectureId`
- POST `/api/teacher/lectures/:lectureId/content`
- DELETE `/api/teacher/lectures/:lectureId/content/:contentId`

### `/api/teachers/*` (Public)
- GET `/api/teachers/public`

### `/api/upload/*` (Admin/Teacher)
- POST `/api/upload/apk` (**multipart/form-data**)
- DELETE `/api/upload/file`
- POST `/api/upload/logo` (**multipart/form-data**)
- POST `/api/upload/pdf` (**multipart/form-data**)
- POST `/api/upload/thumbnail` (**multipart/form-data**)
- POST `/api/upload/video` (**multipart/form-data**, long-running)

### `/api/verify/*` (Public)
- GET `/api/verify/:certId`

### `/api/video/*` (Auth)
- GET `/api/video/:lectureId/stream` (**stream**)
- GET `/api/video/:lectureId/stream-url`

### Other
- GET `/api/test` (non-standard)
- GET `/download/app` (APK download)

---

## Detailed Endpoints (with JSON examples)

### Health (non-standard)

#### GET `/api/health`
Success:
```json
{ "status": "ok", "message": "SUM Academy API healthy", "timestamp": "2026-04-18T00:00:00.000Z" }
```

#### GET `/api/test`
Success:
```json
{ "status": "ok", "message": "SUM Academy API is running", "firebase": "connected" }
```
Error:
```json
{ "status": "error", "message": "Firebase connection failed", "error": "..." }
```

---

## Auth

#### POST `/api/auth/register/send-otp` (Public)
Request:
```json
{ "email": "student@example.com" }
```
Success:
```json
{ "success": true, "message": "OTP sent", "data": { "email": "student@example.com" } }
```
Error:
```json
{ "success": false, "message": "Failed to send OTP", "error": "Failed to send OTP" }
```

#### POST `/api/auth/register/verify-otp` (Public)
Request:
```json
{ "email": "student@example.com", "otp": "123456" }
```
Success:
```json
{ "success": true, "message": "OTP verified", "data": { "verified": true } }
```
Error:
```json
{ "success": false, "message": "Invalid OTP", "error": "Invalid OTP" }
```

#### POST `/api/auth/register` (Public, Firebase token required)
Headers: `Authorization: Bearer <firebase_id_token>`

Success (example):
```json
{
  "success": true,
  "message": "Registered successfully",
  "data": { "uid": "uid", "role": "student", "email": "student@example.com" }
}
```
Error (rate-limited):
```json
{ "success": false, "message": "Too many attempts. Try again in 15 minutes.", "retryAfter": 900 }
```

#### POST `/api/auth/login` (Public, Firebase token required)
Headers: `Authorization: Bearer <firebase_id_token>`

Success (example):
```json
{
  "success": true,
  "message": "Login successful",
  "data": { "uid": "uid", "role": "student", "email": "student@example.com" }
}
```
Error:
```json
{ "success": false, "message": "Invalid credentials", "error": "Invalid credentials" }
```

#### Forgot Password
- POST `/api/auth/forgot-password/send-otp`
- POST `/api/auth/forgot-password/verify-otp`
- POST `/api/auth/forgot-password/reset`

Success (example):
```json
{ "success": true, "message": "Password reset successfully", "data": { "ok": true } }
```
Error:
```json
{ "success": false, "message": "OTP expired", "error": "OTP expired" }
```

#### POST `/api/auth/logout` (Auth)
Success:
```json
{ "success": true, "message": "Logged out", "data": { "ok": true } }
```

#### GET `/api/auth/me` (Auth)
Success (example):
```json
{
  "success": true,
  "message": "Profile fetched",
  "data": {
    "uid": "uid",
    "role": "student",
    "email": "student@example.com",
    "device": { "fingerprint": "..." }
  }
}
```

#### PATCH `/api/auth/set-role` (Admin)
Request:
```json
{ "uid": "targetUid", "role": "student|teacher|admin" }
```
Success:
```json
{ "success": true, "message": "Role updated", "data": { "uid": "targetUid", "role": "teacher" } }
```

---

## Public Settings

#### GET `/api/settings` (Public)
Success (example):
```json
{
  "success": true,
  "message": "Settings fetched",
  "data": {
    "siteName": "SUM Academy",
    "maintenance": { "enabled": false, "message": "Maintenance", "startAt": null, "endAt": null }
  }
}
```

#### POST `/api/launch/notify` (Public)
Request:
```json
{ "email": "user@example.com" }
```
Success:
```json
{ "success": true, "message": "Subscribed", "data": { "email": "user@example.com" } }
```

#### POST `/api/launch/notify/dispatch` (Public)
Success:
```json
{ "success": true, "message": "Dispatch started", "data": { "ok": true } }
```

---

## Admin Settings (`/api/admin/settings/*`) (Admin)

All endpoints below return the updated settings section in `data`.

#### GET `/api/admin/settings`
Success:
```json
{ "success": true, "message": "Settings fetched", "data": { "general": {}, "maintenance": {} } }
```

#### PUT `/api/admin/settings/maintenance`
Request (example):
```json
{
  "enabled": true,
  "message": "Site under maintenance",
  "startAt": "2026-04-18T10:00:00.000Z",
  "endAt": "2026-04-18T12:00:00.000Z"
}
```
Success:
```json
{ "success": true, "message": "Maintenance settings updated", "data": { "maintenance": { "enabled": true } } }
```

Other update endpoints (same envelope):
- PUT `/api/admin/settings/general`
- PUT `/api/admin/settings/hero`
- PUT `/api/admin/settings/how-it-works`
- PUT `/api/admin/settings/features`
- PUT `/api/admin/settings/testimonials`
- PUT `/api/admin/settings/about`
- PUT `/api/admin/settings/contact`
- PUT `/api/admin/settings/footer`
- PUT `/api/admin/settings/appearance`
- PUT `/api/admin/settings/certificate`
- PUT `/api/admin/settings/email`
- POST `/api/admin/settings/email/test`
- PUT `/api/admin/settings/payment`
- PUT `/api/admin/settings/security`
- GET `/api/admin/settings/templates`
- PUT `/api/admin/settings/templates`

Error (example):
```json
{ "success": false, "message": "Access denied", "error": "Access denied" }
```

---

## Uploads (`/api/upload/*`)

#### POST `/api/upload/thumbnail` (Admin/Teacher) (multipart)
FormData: `file`

Success (example):
```json
{ "success": true, "message": "Thumbnail uploaded", "data": { "url": "https://...", "filePath": "..." } }
```

#### POST `/api/upload/pdf` (Admin/Teacher) (multipart)
FormData: `file`, `courseId` (or `subjectId`)

Success:
```json
{ "success": true, "message": "PDF uploaded", "data": { "url": "https://...", "filePath": "..." } }
```

#### POST `/api/upload/video` (Admin/Teacher) (multipart, long-running)
FormData: `file`, `courseId` (or `subjectId`), `lectureId` (optional), `title` (optional)

Success (example):
```json
{
  "success": true,
  "message": "Video uploaded",
  "data": { "url": "https://...mp4", "hlsUrl": "https://.../master.m3u8", "durationSec": 94 }
}
```
Error (example):
```json
{
  "success": false,
  "message": "Video transcode failed on server. FFmpeg is not executable. Please configure FFMPEG_PATH or enable execute permissions.",
  "error": "Video transcode failed on server. FFmpeg is not executable. Please configure FFMPEG_PATH or enable execute permissions.",
  "errors": { "code": "FFMPEG_EACCES" }
}
```

#### POST `/api/upload/logo` (Admin) (multipart)
FormData: `file`

#### POST `/api/upload/apk` (Admin) (multipart)
FormData: `file`

#### DELETE `/api/upload/file` (Admin/Teacher)
Request:
```json
{ "filePath": "videos/..." }
```
Success:
```json
{ "success": true, "message": "File deleted", "data": { "ok": true } }
```

---

## Video Streaming (`/api/video/*`)

#### GET `/api/video/:lectureId/stream-url` (Auth)
Success (HLS example):
```json
{
  "success": true,
  "message": "Stream URL generated",
  "data": { "streamUrl": "https://.../master.m3u8", "streamType": "hls", "lectureId": "lec_123" }
}
```

#### GET `/api/video/:lectureId/stream` (Auth) (non-JSON stream)
Returns a streamed MP4/HLS response with Range support. No JSON body on success.

#### GET `/api/sessions/:sessionId/recording` (Auth)
Success:
```json
{ "success": true, "message": "Recording URL generated", "data": { "url": "https://..." } }
```

---

## Progress / Content

### Student Content (Student)

#### GET `/api/student/courses/:courseId/content` (Student)
Alias: GET `/api/student/subjects/:subjectId/content`

Success (example):
```json
{
  "success": true,
  "message": "Content fetched",
  "data": {
    "courseId": "subjectId",
    "chapters": [
      { "chapterId": "ch_1", "title": "Chapter 1", "lectures": [ { "lectureId": "lec_1", "title": "Intro", "isLocked": false } ] }
    ]
  }
}
```

#### POST `/api/student/courses/:courseId/lectures/:lectureId/complete` (Student)
Alias: POST `/api/student/subjects/:subjectId/lectures/:lectureId/complete`

Success (example) (does NOT auto-complete/lock the course):
```json
{
  "success": true,
  "message": "Lecture completed! Keep going.",
  "data": {
    "lectureId": "lec_1",
    "completedCount": 1,
    "totalLectures": 3,
    "progressPercent": 34,
    "chapterCompleted": false,
    "chapterQuizUnlocked": false,
    "readyForCompletionApproval": false,
    "courseCompleted": false,
    "nextAction": "continue"
  }
}
```

Notes:
- `courseCompleted` becomes `true` only when an admin/teacher explicitly completes the enrollment (staff-only).
- When the student finishes all currently-uploaded content, `readyForCompletionApproval` may become `true`, but the course stays active so new lectures can be added later without locking students.

#### PATCH `/api/student/courses/:courseId/lectures/:lectureId/progress` (Student)
Alias: PATCH `/api/student/subjects/:subjectId/lectures/:lectureId/progress`

Request (example):
```json
{ "progressSeconds": 120, "durationSeconds": 600 }
```
Success:
```json
{ "success": true, "message": "Progress saved", "data": { "lectureId": "lec_1", "progressSeconds": 120 } }
```
Error (locked):
```json
{ "success": false, "message": "Lecture is locked", "error": "Lecture is locked", "errors": { "code": "LECTURE_LOCKED" } }
```

### Staff Progress Controls (Teacher/Admin)

#### PATCH `/api/courses/:courseId/students/:studentId/video-access`
Alias: PATCH `/api/subjects/:subjectId/students/:studentId/video-access`

Request (example):
```json
{ "isUnlocked": true }
```
Success:
```json
{ "success": true, "message": "Video access updated", "data": { "studentId": "s1", "courseId": "subjectId", "isUnlocked": true } }
```

#### PATCH `/api/courses/:courseId/lectures/:lectureId/lock`
Alias: PATCH `/api/subjects/:subjectId/lectures/:lectureId/lock`

Request (example):
```json
{ "isLocked": true }
```
Success:
```json
{ "success": true, "message": "Lecture lock updated", "data": { "lectureId": "lec_1", "isLocked": true } }
```

#### POST `/api/courses/:courseId/students/:studentId/unlock-all`
Alias: POST `/api/subjects/:subjectId/students/:studentId/unlock-all`

Success:
```json
{ "success": true, "message": "All videos unlocked", "data": { "studentId": "s1", "courseId": "subjectId" } }
```

#### GET `/api/courses/:courseId/students/:studentId/progress`
Alias: GET `/api/subjects/:subjectId/students/:studentId/progress`

Success (example):
```json
{ "success": true, "message": "Progress fetched", "data": { "studentId": "s1", "completedLectures": 12, "totalLectures": 20 } }
```

#### POST `/api/courses/:courseId/students/:studentId/complete`
Alias: POST `/api/subjects/:subjectId/students/:studentId/complete`

Success:
```json
{ "success": true, "message": "Subject marked complete", "data": { "studentId": "s1", "courseId": "subjectId", "completed": true } }
```

#### POST `/api/classes/:classId/students/:studentId/complete`
Success:
```json
{ "success": true, "message": "Class marked complete", "data": { "studentId": "s1", "classId": "classId", "completed": true } }
```

Common errors:
```json
{ "success": false, "message": "Access denied", "error": "Access denied" }
```

---

## Classes (Public)

#### GET `/api/classes/catalog`
Success:
```json
{
  "success": true,
  "message": "Subject catalog fetched",
  "data": [
    { "id": "subjectId", "subjectId": "subjectId", "title": "English", "finalPrice": 0 }
  ]
}
```

#### GET `/api/classes/available`
Query (optional): `subjectId`, `includeExpired=true|false`, `token=<firebase_token>` (optional)

Success (example):
```json
{
  "success": true,
  "message": "Available classes fetched",
  "data": [
    {
      "id": "classId",
      "name": "Class 9 Morning",
      "status": "active|upcoming|full|expired|completed",
      "spotsLeft": 5,
      "assignedSubjects": [{ "subjectId": "subjectId", "title": "Chemistry", "alreadyPurchased": false }]
    }
  ]
}
```

---

## Public Explore

#### GET `/api/courses/explore` (Public)
Success (example):
```json
{ "success": true, "message": "Courses fetched", "data": [ { "id": "subjectId", "title": "Biology" } ] }
```

#### GET `/api/teachers/public` (Public)
Success:
```json
{ "success": true, "message": "Teachers fetched", "data": [ { "uid": "t1", "fullName": "Teacher" } ] }
```

#### POST `/api/contact/messages` (Public)
Request:
```json
{ "name": "User", "email": "user@example.com", "message": "Hello" }
```
Success:
```json
{ "success": true, "message": "Message received", "data": { "ok": true } }
```

---

## Announcements

#### Admin (Admin)
- GET `/api/admin/announcements`
- POST `/api/admin/announcements`
- PUT `/api/admin/announcements/:id`
- DELETE `/api/admin/announcements/:id`
- PATCH `/api/admin/announcements/:id/pin`

Success (list example):
```json
{ "success": true, "message": "Announcements fetched", "data": [ { "id": "a1", "title": "..." } ] }
```

#### User (Any auth token)
- GET `/api/announcements/my`
- PATCH `/api/announcements/read-all`
- PATCH `/api/announcements/:id/read`

Success:
```json
{ "success": true, "message": "Announcements fetched", "data": [ { "id": "a1", "isRead": false } ] }
```

#### Student (Student) (also available in `/api/student/*`)
- GET `/api/student/announcements`
- PATCH `/api/student/announcements/:id/read`

---

## Certificates

#### Admin (Admin)
- GET `/api/admin/certificates`
- POST `/api/admin/certificates`
- PATCH `/api/admin/certificates/:certId/revoke`
- PATCH `/api/admin/certificates/:certId/unrevoke`

Success (generate example):
```json
{ "success": true, "message": "Certificate generated", "data": { "certId": "CERT123", "verifyUrl": "https://sumacademy.net/api/verify/CERT123" } }
```

#### Public
##### GET `/api/verify/:certId`
Success:
```json
{ "success": true, "message": "Certificate verified", "data": { "certId": "CERT123", "isValid": true } }
```
Error:
```json
{ "success": false, "message": "Certificate not found", "error": "Certificate not found" }
```

#### Student (Student)
- GET `/api/student/certificates`
- GET `/api/student/certificates/:id/download` (file download)

---

## Payments (`/api/payments/*`) (Auth)

#### POST `/api/payments/initiate`
Success (example):
```json
{
  "success": true,
  "message": "Bank Transfer initiated",
  "data": { "paymentId": "pay_123", "reference": "SUM-...", "method": "bank_transfer" }
}
```

#### GET `/api/payments/config`
Success:
```json
{ "success": true, "message": "Payment config fetched", "data": { "methods": ["bank_transfer", "online"] } }
```

#### GET `/api/payments/:id/status`
Success:
```json
{ "success": true, "message": "Payment status fetched", "data": { "id": "pay_123", "status": "awaiting_receipt" } }
```

#### GET `/api/payments/my-payments`
Success:
```json
{ "success": true, "message": "My payments fetched", "data": [ { "id": "pay_123", "status": "pending_verification" } ] }
```

#### GET `/api/payments/my-installments`
Success:
```json
{ "success": true, "message": "Installments fetched", "data": [ { "planId": "plan_1", "nextDueAt": "2026-04-18T00:00:00.000Z" } ] }
```

#### POST `/api/payments/validate-promo`
Success:
```json
{ "success": true, "message": "Promo code validated", "data": { "valid": true, "discountPercent": 10 } }
```
Error:
```json
{ "success": false, "message": "Invalid promo code", "error": "Invalid promo code" }
```

#### Payment Receipt Upload (Auth)
- POST `/api/payments/:paymentId/receipt`
- PATCH `/api/payments/:paymentId/receipt`

Success (example) (uploads receipt only; does NOT submit for verification):
```json
{
  "success": true,
  "message": "Receipt uploaded. Click Finish to submit for verification.",
  "data": { "paymentId": "pay_123", "status": "awaiting_receipt", "receiptUploaded": true }
}
```

Error (example):
```json
{ "success": false, "message": "Invalid receipt URL", "error": "Invalid receipt URL" }
```

#### POST `/api/payments/:paymentId/finish` (Auth)
Submits the payment request to admin for verification (**required after receipt upload**).

Success:
```json
{
  "success": true,
  "message": "Payment submitted for verification",
  "data": { "paymentId": "pay_123", "status": "pending_verification" }
}
```

Error (receipt missing):
```json
{
  "success": false,
  "message": "Upload receipt first",
  "error": "Upload receipt first",
  "errors": { "code": "RECEIPT_REQUIRED" }
}
```

---

## Promo Codes (Auth)

#### POST `/api/promo-codes/validate`
Success:
```json
{ "success": true, "message": "Promo code validated", "data": { "valid": true } }
```
Error:
```json
{ "success": false, "message": "Promo code invalid", "error": "Promo code invalid" }
```

---

## Student Tests (Student)

#### GET `/api/student/tests`
Success (example):
```json
{
  "success": true,
  "message": "Student tests fetched",
  "data": [
    {
      "id": "testId",
      "title": "Weekly Test",
      "scope": "class|center",
      "classId": "classId",
      "className": "Class 9",
      "startAt": "2026-04-18T10:00:00.000Z",
      "endAt": "2026-04-18T11:00:00.000Z",
      "status": "scheduled|active|ended",
      "canAttempt": true,
      "hasSubmittedAttempt": false,
      "inProgress": false,
      "questionsCount": 20,
      "totalMarks": 20,
      "durationMinutes": 60,
      "maxViolations": 3,
      "attempt": null
    }
  ]
}
```

#### GET `/api/student/tests/:testId`
Success (example):
```json
{
  "success": true,
  "message": "Test fetched",
  "data": {
    "serverNow": "2026-04-18T10:00:00.000Z",
    "test": { "id": "testId", "title": "Weekly Test", "totalMarks": 20, "questionsCount": 20 },
    "questions": [
      { "questionId": "q1", "order": 1, "questionText": "2+2?", "options": ["3","4"], "marks": 1 }
    ],
    "attempt": { "id": "attemptId", "status": "in_progress", "currentIndex": 0, "totalQuestions": 20 },
    "currentQuestion": { "questionId": "q1", "order": 1, "questionText": "2+2?", "options": ["3","4"], "marks": 1 },
    "rankingPreview": null
  }
}
```

#### POST `/api/student/tests/:testId/start`
Success:
```json
{
  "success": true,
  "message": "Test started successfully",
  "data": {
    "serverNow": "2026-04-18T10:00:00.000Z",
    "testId": "testId",
    "attempt": { "id": "attemptId", "status": "in_progress", "currentIndex": 0, "totalQuestions": 20, "expiresAt": "2026-04-18T11:00:00.000Z" },
    "currentQuestion": { "questionId": "q1", "order": 1, "questionText": "2+2?", "options": ["3","4"], "marks": 1 }
  }
}
```
Error codes (examples):
```json
{ "success": false, "message": "Test already submitted", "error": "Test already submitted", "errors": { "code": "ALREADY_SUBMITTED" } }
```

#### POST `/api/student/tests/:testId/answer`
Request:
```json
{ "questionId": "q1", "selectedAnswer": "4" }
```
Success (mid-test):
```json
{ "success": true, "message": "Answer saved", "data": { "completed": false, "attempt": { "currentIndex": 1 }, "currentQuestion": { "questionId": "q2" } } }
```
Success (last question auto-submits):
```json
{ "success": true, "message": "Test submitted successfully", "data": { "completed": true, "result": { "obtainedMarks": 18, "totalMarks": 20, "percentage": 90 } } }
```
Error examples:
```json
{ "success": false, "message": "Invalid question order. You can only answer the current question.", "error": "Invalid question order. You can only answer the current question.", "errors": { "code": "STRICT_PROGRESS_ENFORCED", "expectedQuestionId": "q1" } }
```

#### POST `/api/student/tests/:testId/finish`
Request:
```json
{ "reason": "manual|timeout|auto|violation" }
```
Success:
```json
{ "success": true, "message": "Test submitted", "data": { "completed": true, "result": { "obtainedMarks": 10, "totalMarks": 20, "percentage": 50 }, "ranking": { "position": 3, "ordinalPosition": "3rd", "totalParticipants": 25 } } }
```
Error (server clock guard):
```json
{ "success": false, "message": "Test is still active", "error": "Test is still active", "errors": { "code": "TEST_NOT_EXPIRED", "serverNow": "2026-04-18T10:00:00.000Z", "endAt": "2026-04-18T11:00:00.000Z" } }
```

#### GET `/api/student/tests/:testId/ranking`
Success:
```json
{
  "success": true,
  "message": "Ranking fetched",
  "data": {
    "testId": "testId",
    "title": "Weekly Test",
    "className": "Class 9",
    "totalParticipants": 25,
    "myResult": { "position": 3, "ordinalPosition": "3rd", "obtainedMarks": 18, "totalMarks": 20, "percentage": 90 },
    "ranking": [ { "position": 1, "studentId": "s1", "studentName": "A", "obtainedMarks": 20, "percentage": 100 } ]
  }
}
```
Error:
```json
{ "success": false, "message": "Submit the test first to view ranking", "error": "Submit the test first to view ranking", "errors": { "code": "RANKING_LOCKED" } }
```

#### GET `/api/student/tests/:testId/ranking/pdf`
Returns a PDF file download. Error responses are JSON (same envelope as above).

---

## Teacher/Admin Tests (Teacher/Admin)

Managed tests endpoints (teacher + admin have the same paths under their prefix):
- GET `/api/teacher/tests` / GET `/api/admin/tests`
- POST `/api/teacher/tests` / POST `/api/admin/tests`
- GET `/api/teacher/tests/template` / GET `/api/admin/tests/template` (CSV download)
- POST `/api/teacher/tests/bulk-upload` / POST `/api/admin/tests/bulk-upload` (multipart CSV upload)
- GET `/api/teacher/tests/:testId` / GET `/api/admin/tests/:testId`
- GET `/api/teacher/tests/:testId/ranking` / GET `/api/admin/tests/:testId/ranking`

Success (list example):
```json
{ "success": true, "message": "Tests fetched", "data": [ { "id": "testId", "title": "Test" } ] }
```

---

## Student (Other)

Most student endpoints return `successResponse(res, data, message)` with the standard envelope.

#### GET `/api/student/dashboard`
Success (example):
```json
{ "success": true, "message": "Dashboard fetched", "data": { "student": { "uid": "uid" }, "stats": {} } }
```

#### GET `/api/student/courses`
Success:
```json
{ "success": true, "message": "Courses fetched", "data": [ { "courseId": "subjectId", "title": "English" } ] }
```

#### Live sessions
- GET `/api/student/live-sessions`
- POST `/api/student/live-sessions/:sessionId/join`
- GET `/api/student/sessions/:sessionId`
- POST `/api/student/sessions/:sessionId/join`
- GET `/api/student/sessions/:sessionId/status`
- GET `/api/student/sessions/:sessionId/sync`
- POST `/api/student/sessions/:sessionId/leave`
- POST `/api/student/sessions/:sessionId/violation`

Success (example):
```json
{ "success": true, "message": "Sessions fetched", "data": [ { "sessionId": "s1", "status": "live" } ] }
```

#### Quizzes
- GET `/api/student/quizzes`
- GET `/api/student/quizzes/:quizId`
- POST `/api/student/quizzes/:quizId/submit`
- GET `/api/student/scheduled-quizzes`
- GET `/api/student/scheduled-quizzes/:quizId`
- POST `/api/student/scheduled-quizzes/:quizId/submit`

Success (submit example):
```json
{ "success": true, "message": "Quiz submitted", "data": { "score": 8, "total": 10 } }
```

#### Security / Support / Settings
- POST `/api/student/security/violations`
- POST `/api/student/help-support`
- GET `/api/student/settings`
- PUT `/api/student/settings`

Success (settings example):
```json
{ "success": true, "message": "Settings updated", "data": { "notificationsEnabled": true } }
```

---

## Teacher (Teacher/Admin)

All teacher endpoints use: `Authorization` + role `teacher` (admins can also access teacher routes).

Success envelope (example):
```json
{ "success": true, "message": "Success", "data": {} }
```

Typical endpoints:
- Courses/lectures/chapters CRUD: `/api/teacher/*`
- Sessions CRUD + attendance: `/api/teacher/sessions/*`
- Quiz creation + assignment + evaluation + bulk upload: `/api/teacher/quizzes/*`
- Scheduled quizzes: `/api/teacher/scheduled-quizzes/*`
- Question bank: `/api/teacher/question-bank`
- Teacher settings: `/api/teacher/settings/*`

Error example:
```json
{ "success": false, "message": "Access denied", "error": "Access denied" }
```

---

## Admin (Admin)

All admin endpoints require role `admin`.

Success envelope:
```json
{ "success": true, "message": "Success", "data": {} }
```

Notes:
- Some downloads return CSV/PDF instead of JSON (templates, ranking/pdf, bulk templates).
- Bulk upload endpoints use `multipart/form-data` with `file`.
- `GET /api/admin/top-classes` and `GET /api/admin/class-performance` use pre-calculated class fields (`enrollmentCount`, `activeStudents`, `totalRevenue`) to avoid heavy Firestore scans.

### Admin Dashboard
Endpoints:
- GET `/api/admin/stats`
- GET `/api/admin/revenue-chart`
- GET `/api/admin/recent-enrollments`
- GET `/api/admin/top-courses`
- GET `/api/admin/top-classes`
- GET `/api/admin/class-performance`
- GET `/api/admin/recent-activity`
- GET `/api/admin/analytics-report`

Success (example):
```json
{ "success": true, "message": "Stats fetched", "data": { "totalStudents": 120, "totalRevenue": 500000 } }
```

### Admin Users
Endpoints:
- GET `/api/admin/users` (supports pagination)
- GET `/api/admin/users/:uid`
- POST `/api/admin/users`
- PUT `/api/admin/users/:uid`
- DELETE `/api/admin/users/:uid`
- PATCH `/api/admin/users/:uid/role`
- PATCH `/api/admin/users/:uid/reset-device`

GET `/api/admin/users` query params (optional):
- `pageSize` (number, default `50`, max `200`)
- `cursor` (string, optional)
- `legacy=1` (optional): return legacy array response
- existing filters: `role`, `isActive`, `search` (search is best-effort on legacy mode)

Success (list example):
```json
{ "success": true, "message": "Users fetched", "data": [ { "uid": "u1", "email": "u1@example.com", "role": "student" } ] }
```
Success (create example):
```json
{ "success": true, "message": "User created", "data": { "uid": "u2", "email": "u2@example.com", "role": "teacher" } }
```
Error (example):
```json
{ "success": false, "message": "User not found", "error": "User not found" }
```

### Admin Teachers / Students
Endpoints:
- GET `/api/admin/teachers` (supports pagination)
- GET `/api/admin/teachers/:uid`
- GET `/api/admin/students` (paginated)
- GET `/api/admin/students/:uid`
- GET `/api/admin/students/:uid/progress`
- PATCH `/api/admin/students/:uid/approve`
- PATCH `/api/admin/students/:uid/reject`
- PATCH `/api/admin/students/:uid/payment-rejections/reset`
- GET `/api/admin/students/template` (CSV download)
- POST `/api/admin/students/bulk-upload` (multipart `file`)

GET `/api/admin/students` query params:
- `pageSize` (number, default `50`, max `200`)
- `cursor` (string, optional): pass the `nextCursor` from previous response
- `legacy=1` (optional): return legacy array response (no pagination metadata)

Success (students list paginated example):
```json
{
  "success": true,
  "message": "Students fetched",
  "data": {
    "items": [
      { "uid": "s1", "fullName": "Student", "status": "approved" }
    ],
    "page": { "pageSize": 50, "hasMore": true, "nextCursor": "s1" }
  }
}
```

Success (legacy array example):
```json
{ "success": true, "message": "Students fetched", "data": [ { "uid": "s1", "fullName": "Student" } ] }
```

Error (example):
```json
{ "success": false, "message": "Failed to fetch students", "error": "Failed to fetch students" }
```

### Admin Courses / Subjects / Content
Endpoints (subjects are aliases of courses in many places):
- GET `/api/admin/courses` (alias: GET `/api/admin/subjects`)
- POST `/api/admin/courses` (alias: POST `/api/admin/subjects`)
- PUT `/api/admin/courses/:courseId` (alias: PUT `/api/admin/subjects/:courseId`)
- PATCH `/api/admin/courses/:courseId` (alias: PATCH `/api/admin/subjects/:courseId`)
- DELETE `/api/admin/courses/:courseId` (alias: DELETE `/api/admin/subjects/:courseId`)
- POST `/api/admin/courses/:courseId/subjects`
- DELETE `/api/admin/courses/:courseId/subjects/:subjectId`
- POST `/api/admin/courses/:courseId/subjects/:subjectId/content`
- GET `/api/admin/courses/:courseId/content`
- DELETE `/api/admin/courses/:courseId/content/:contentId`
- PATCH `/api/admin/courses/:courseId/students/:studentId/rewatch-access`

Success (course list example):
```json
{ "success": true, "message": "Courses fetched", "data": [ { "id": "subjectId", "title": "Chemistry", "price": 0 } ] }
```

### Admin Classes
Endpoints:
- GET `/api/admin/classes`
- POST `/api/admin/classes/analytics/rebuild` (maintenance)
- POST `/api/admin/classes`
- PUT `/api/admin/classes/:classId`
- PATCH `/api/admin/classes/:classId/reopen`
- DELETE `/api/admin/classes/:classId`
- POST `/api/admin/classes/:classId/courses` (alias: `/subjects`)
- DELETE `/api/admin/classes/:classId/courses/:courseId` (alias: `/subjects/:courseId`)
- POST `/api/admin/classes/:classId/shifts`
- PUT `/api/admin/classes/:classId/shifts/:shiftId`
- DELETE `/api/admin/classes/:classId/shifts/:shiftId`
- POST `/api/admin/classes/:classId/students` (admin or student token allowed)
- GET `/api/admin/classes/:classId/students`
- POST `/api/admin/classes/:classId/enroll`
- DELETE `/api/admin/classes/:classId/students/:studentId`

POST `/api/admin/classes/analytics/rebuild` query params:
- `pageSize` (number, default `50`, max `200`)
- `cursor` (string, optional): classId cursor for paging
- `includeRevenue` (`1|0`, default `1`): also recompute `totalRevenue` (reads payments by classId)
- `dryRun` (`1|0`, default `0`): preview only, no writes

Success (example):
```json
{
  "success": true,
  "message": "Class analytics rebuilt",
  "data": {
    "updatedClasses": 50,
    "scannedClasses": 50,
    "page": { "pageSize": 50, "hasMore": true, "nextCursor": "class_123" },
    "includeRevenue": true,
    "dryRun": false
  }
}
```

Success (class list example):
```json
{ "success": true, "message": "Classes fetched", "data": [ { "id": "classId", "name": "Class 9", "capacity": 30 } ] }
```

### Admin Quizzes / Tests (Managed)
Quizzes:
- GET `/api/admin/quizzes`
- GET `/api/admin/quizzes/:quizId`
- GET `/api/admin/quizzes/:quizId/analytics`
- PATCH `/api/admin/quizzes/:quizId/assign`
- GET `/api/admin/quizzes/:quizId/submissions`
- GET `/api/admin/quizzes/template` (CSV download)
- POST `/api/admin/quizzes` / POST `/api/admin/quizzes/bulk-upload` (multipart `file`)

Tests:
- GET `/api/admin/tests`
- GET `/api/admin/tests/:testId`
- GET `/api/admin/tests/:testId/ranking`
- GET `/api/admin/tests/template` (CSV download)
- POST `/api/admin/tests` / POST `/api/admin/tests/bulk-upload` (multipart `file`)

Success (template endpoints): file download (CSV). Errors are JSON.

### Admin Payments / Installments
Endpoints (also exposed by `adminPaymentRoutes`):
- GET `/api/admin/payments` (default hides `awaiting_receipt`)
- GET `/api/admin/payments?includeAwaitingReceipt=true` (includes `awaiting_receipt`)
- PATCH `/api/admin/payments/:paymentId/verify`
- PATCH `/api/admin/payments/:id/verify` (alias)
- GET `/api/admin/installments`
- GET `/api/admin/installments/:planId`
- POST `/api/admin/installments`
- PATCH `/api/admin/installments/:planId/:number/pay`
- POST `/api/admin/installments/send-reminders`
- PUT `/api/admin/installments/:planId/override`

Success (payments list example):
```json
{ "success": true, "message": "Payments fetched", "data": [ { "paymentId": "pay_1", "status": "pending" } ] }
```

### Admin Support
Endpoints:
- GET `/api/admin/support/messages`
- PATCH `/api/admin/support/messages/:messageId/read`
- POST `/api/admin/support/messages/:messageId/reply`
- DELETE `/api/admin/support/messages/:messageId`

Success:
```json
{ "success": true, "message": "Support messages fetched", "data": [ { "messageId": "m1", "status": "open" } ] }
```

### Admin Promo Codes
Endpoints:
- GET `/api/admin/promo-codes`
- POST `/api/admin/promo-codes`
- PUT `/api/admin/promo-codes/:codeId`
- PATCH `/api/admin/promo-codes/:codeId/toggle`
- DELETE `/api/admin/promo-codes/:codeId`
- POST `/api/admin/promo-codes/validate`

Success:
```json
{ "success": true, "message": "Promo code validated", "data": { "valid": true, "discountPercent": 10 } }
```

### Admin Announcements / Certificates
Announcements:
- GET `/api/admin/announcements`
- POST `/api/admin/announcements`
- PUT `/api/admin/announcements/:id`
- DELETE `/api/admin/announcements/:id`
- PATCH `/api/admin/announcements/:id/pin`

Certificates:
- GET `/api/admin/certificates`
- POST `/api/admin/certificates`
- PATCH `/api/admin/certificates/:certId/revoke`
- PATCH `/api/admin/certificates/:certId/unrevoke`

Common errors:
```json
{ "success": false, "message": "Access denied", "error": "Access denied" }
```

---

## Downloads (non-API)

#### GET `/download/app`
Returns the Android APK file. Error response (JSON) if missing:
```json
{ "success": false, "message": "APK file not found" }
```
