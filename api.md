# SUM Academy API Documentation
Base URL: https://sumacademy.net/api

> Notes
> - All endpoints return JSON unless stated otherwise.
> - Auth protected routes require `Authorization: Bearer <token>`.
> - Times are ISO strings unless stated otherwise.
> - `courseId` and `subjectId` are the same in this system.
> - Standard response format:
>   ```json
>   { "success": true, "message": "...", "data": { } }
>   ```

---

## Health

### GET `/api/health`
Public. Health check.

Success:
```json
{ "status": "ok", "message": "SUM Academy API healthy", "timestamp": "2026-04-12T00:00:00.000Z" }
```

### GET `/api/test`
Admin internal health (writes a ping doc).

Success:
```json
{ "status": "ok", "message": "SUM Academy API is running", "firebase": "connected" }
```

---

## Auth

### POST `/api/auth/register/send-otp`
Public. Send OTP for registration.

### POST `/api/auth/register/verify-otp`
Public. Verify OTP.

### POST `/api/auth/register`
Auth: Firebase token. Device detection.

### POST `/api/auth/login`
Auth: Firebase token. Device detection.

### POST `/api/auth/forgot-password/send-otp`
Public.

### POST `/api/auth/forgot-password/verify-otp`
Public.

### POST `/api/auth/forgot-password/reset`
Public.

### POST `/api/auth/logout`
Auth required.

### GET `/api/auth/me`
Auth required. Returns current user profile and device info.

### PATCH `/api/auth/set-role`
Auth: admin. Set user role.

Common errors:
```json
{ "success": false, "message": "Invalid credentials" }
{ "success": false, "message": "Too many attempts. Try again in 15 minutes." }
```

---

## Public Settings

### GET `/api/settings`
Public. Fetch site settings.

### POST `/api/launch/notify`
Public. Subscribe to launch notifications.

### POST `/api/launch/notify/dispatch`
Public. Dispatch launch notifications.

---

## Admin Settings

### GET `/api/admin/settings`
Admin. Fetch settings.

### PUT `/api/admin/settings/general`
Admin. Update general settings.

### PUT `/api/admin/settings/hero`
### PUT `/api/admin/settings/how-it-works`
### PUT `/api/admin/settings/features`
### PUT `/api/admin/settings/testimonials`
### PUT `/api/admin/settings/about`
### PUT `/api/admin/settings/contact`
### PUT `/api/admin/settings/footer`
### PUT `/api/admin/settings/appearance`
### PUT `/api/admin/settings/certificate`
### PUT `/api/admin/settings/maintenance`
### PUT `/api/admin/settings/email`
### POST `/api/admin/settings/email/test`
### PUT `/api/admin/settings/payment`
### PUT `/api/admin/settings/security`
### GET `/api/admin/settings/templates`
### PUT `/api/admin/settings/templates`

---

## Uploads

### POST `/api/upload/thumbnail`
Role: admin/teacher. Upload thumbnail.

FormData:
- `file`

### POST `/api/upload/pdf`
Role: admin/teacher. Upload course PDF.

FormData:
- `file`
- `courseId`
- `subjectId`

### POST `/api/upload/video`
Role: admin/teacher. Upload course video.

FormData:
- `file`
- `courseId`
- `subjectId`
- `lectureId` (optional)
- `title` (optional)

Success:
```json
{
  "success": true,
  "message": "Video uploaded",
  "data": {
    "url": "https://...mp4",
    "filePath": "videos/...",
    "name": "video.mp4",
    "durationSec": 94,
    "hlsUrl": "https://.../master.m3u8"
  }
}
```

Error (FFmpeg not executable):
```json
{
  "success": false,
  "message": "Video transcode failed on server. FFmpeg is not executable. Please configure FFMPEG_PATH or enable execute permissions.",
  "errors": { "code": "FFMPEG_EACCES" }
}
```

### POST `/api/upload/logo`
Role: admin. Upload site logo.

### POST `/api/upload/apk`
Role: admin. Upload APK.

### DELETE `/api/upload/file`
Role: admin/teacher. Delete file by path.

---

## Video Streaming

### GET `/api/video/:lectureId/stream-url`
Role: student. Returns streaming URL. Prefers `hlsUrl` when available.

Success (HLS):
```json
{
  "success": true,
  "message": "Stream URL generated",
  "data": {
    "streamUrl": "https://.../master.m3u8",
    "streamType": "hls",
    "lectureId": "lec_123",
    "title": "Lecture Title",
    "duration": "01:34",
    "watermarkText": "Student | SUM Academy",
    "expiresIn": 7200
  }
}
```

Success (MP4 fallback):
```json
{
  "success": true,
  "message": "Stream URL generated",
  "data": {
    "streamUrl": "https://...mp4",
    "streamType": "mp4",
    "lectureId": "lec_123"
  }
}
```

Errors:
- `403 Not enrolled in this course`
- `403 Video locked after course completion. Contact teacher.`
- `404 Video file not found`

### GET `/api/video/:lectureId/stream`
Role: student. Proxy stream with range support.

### GET `/api/sessions/:sessionId/recording`
Role: student. Returns signed URL for session recording (if unlocked).

---

## Admin APIs

### Dashboard
- GET `/api/admin/stats`
- GET `/api/admin/revenue-chart`
- GET `/api/admin/recent-enrollments`
- GET `/api/admin/top-courses`
- GET `/api/admin/recent-activity`
- GET `/api/admin/analytics-report`

### Users
- GET `/api/admin/users`
- GET `/api/admin/users/:uid`
- POST `/api/admin/users`
- PUT `/api/admin/users/:uid`
- DELETE `/api/admin/users/:uid`
- PATCH `/api/admin/users/:uid/role`
- PATCH `/api/admin/users/:uid/reset-device`

### Teachers / Students
- GET `/api/admin/teachers`
- GET `/api/admin/teachers/:uid`
- GET `/api/admin/students`
- GET `/api/admin/students/:uid`
- PATCH `/api/admin/students/:uid/approve`
- PATCH `/api/admin/students/:uid/reject`
- PATCH `/api/admin/students/:uid/payment-rejections/reset`
- GET `/api/admin/students/:uid/progress`
- GET `/api/admin/students/template`
- POST `/api/admin/students/bulk-upload`

### Quizzes
- GET `/api/admin/quizzes/template`
- GET `/api/admin/quizzes`
- GET `/api/admin/quizzes/:quizId`
- GET `/api/admin/quizzes/:quizId/analytics`
- POST `/api/admin/quizzes`
- POST `/api/admin/quizzes/bulk-upload`
- PATCH `/api/admin/quizzes/:quizId/assign`
- GET `/api/admin/quizzes/:quizId/submissions`

### Tests
- GET `/api/admin/tests`
- POST `/api/admin/tests`
- GET `/api/admin/tests/template`
- POST `/api/admin/tests/bulk-upload`
- GET `/api/admin/tests/:testId`
- GET `/api/admin/tests/:testId/ranking`

### Courses / Subjects
- GET `/api/admin/courses`
- GET `/api/admin/subjects`
- POST `/api/admin/courses`
- POST `/api/admin/subjects`
- PUT `/api/admin/courses/:courseId`
- PATCH `/api/admin/courses/:courseId`
- DELETE `/api/admin/courses/:courseId`
- (same endpoints with `/subjects`)
- POST `/api/admin/courses/:courseId/subjects`
- DELETE `/api/admin/courses/:courseId/subjects/:subjectId`
- POST `/api/admin/courses/:courseId/subjects/:subjectId/content`
- DELETE `/api/admin/courses/:courseId/content/:contentId`
- GET `/api/admin/courses/:courseId/content`

### Classes
- GET `/api/admin/classes`
- POST `/api/admin/classes`
- PUT `/api/admin/classes/:classId`
- PATCH `/api/admin/classes/:classId/reopen`
- DELETE `/api/admin/classes/:classId`
- POST `/api/admin/classes/:classId/courses`
- POST `/api/admin/classes/:classId/subjects`
- DELETE `/api/admin/classes/:classId/courses/:courseId`
- DELETE `/api/admin/classes/:classId/subjects/:courseId`
- POST `/api/admin/classes/:classId/shifts`
- PUT `/api/admin/classes/:classId/shifts/:shiftId`
- DELETE `/api/admin/classes/:classId/shifts/:shiftId`
- POST `/api/admin/classes/:classId/students`
- GET `/api/admin/classes/:classId/students`
- POST `/api/admin/classes/:classId/enroll`
- DELETE `/api/admin/classes/:classId/students/:studentId`

### Payments (admin)
- GET `/api/admin/payments`
- PATCH `/api/admin/payments/:paymentId/verify`
- GET `/api/admin/installments`
- POST `/api/admin/installments`
- PATCH `/api/admin/installments/:planId/:number/pay`
- POST `/api/admin/installments/send-reminders`

### Support
- GET `/api/admin/support/messages`
- PATCH `/api/admin/support/messages/:messageId/read`
- POST `/api/admin/support/messages/:messageId/reply`
- DELETE `/api/admin/support/messages/:messageId`

### Promo Codes
- GET `/api/admin/promo-codes`
- POST `/api/admin/promo-codes`
- PUT `/api/admin/promo-codes/:codeId`
- PATCH `/api/admin/promo-codes/:codeId/toggle`
- DELETE `/api/admin/promo-codes/:codeId`
- POST `/api/admin/promo-codes/validate`

---

## Teacher APIs

### Courses & Lectures
- GET `/api/teacher/courses`
- GET `/api/teacher/courses/:courseId`
- GET `/api/teacher/courses/:courseId/subjects/:subjectId/chapters`
- POST `/api/teacher/courses/:courseId/subjects/:subjectId/chapters`
- PUT `/api/teacher/chapters/:chapterId`
- DELETE `/api/teacher/chapters/:chapterId`
- GET `/api/teacher/chapters/:chapterId/lectures`
- POST `/api/teacher/chapters/:chapterId/lectures`
- PUT `/api/teacher/lectures/:lectureId`
- DELETE `/api/teacher/lectures/:lectureId`
- POST `/api/teacher/lectures/:lectureId/content`
- DELETE `/api/teacher/lectures/:lectureId/content/:contentId`

### Students
- GET `/api/teacher/students`
- GET `/api/teacher/students/:studentId`
- GET `/api/teacher/students/:studentId/progress/:courseId`
- PATCH `/api/teacher/students/:studentId/video-access`
- GET `/api/teacher/students/:studentId/attendance/:classId`
- GET `/api/teacher/courses/:courseId/students`
- PATCH `/api/teacher/courses/:courseId/students/:studentId/video-access`
- PATCH `/api/teacher/courses/:courseId/students/:studentId/rewatch-access`

### Sessions
- GET `/api/teacher/sessions`
- GET `/api/teacher/sessions/:sessionId`
- POST `/api/teacher/sessions`
- PUT `/api/teacher/sessions/:sessionId`
- PATCH `/api/teacher/sessions/:sessionId/cancel`
- PATCH `/api/teacher/sessions/:sessionId/complete`
- PATCH `/api/teacher/sessions/:sessionId/unlock`
- GET `/api/teacher/sessions/:sessionId/attendance`
- POST `/api/teacher/sessions/:sessionId/attendance`

### Quizzes
- GET `/api/teacher/quizzes/template`
- GET `/api/teacher/quizzes`
- GET `/api/teacher/quizzes/:quizId`
- GET `/api/teacher/quizzes/:quizId/analytics`
- POST `/api/teacher/quizzes`
- POST `/api/teacher/quizzes/bulk-upload`
- PATCH `/api/teacher/quizzes/:quizId/assign`
- POST `/api/teacher/quizzes/:quizId/evaluate`
- POST `/api/teacher/quizzes/:quizId/submissions`
- GET `/api/teacher/quizzes/:quizId/submissions`
- PATCH `/api/teacher/quizzes/:quizId/submissions/:resultId/grade-short`

### Tests
- GET `/api/teacher/tests`
- POST `/api/teacher/tests`
- GET `/api/teacher/tests/template`
- POST `/api/teacher/tests/bulk-upload`
- GET `/api/teacher/tests/:testId`
- GET `/api/teacher/tests/:testId/ranking`

---

## Student APIs

### Dashboard & Courses
- GET `/api/student/dashboard`
- GET `/api/student/courses`
- GET `/api/student/courses/:courseId/progress`
- GET `/api/student/courses/:courseId/final-quiz-request`
- POST `/api/student/courses/:courseId/final-quiz-request`
- POST `/api/student/courses/:courseId/lectures/:lectureId/complete`

### Live Sessions
- GET `/api/student/live-sessions`
- POST `/api/student/live-sessions/:sessionId/join`
- GET `/api/student/sessions/:sessionId`
- POST `/api/student/sessions/:sessionId/join`
- GET `/api/student/sessions/:sessionId/status`
- GET `/api/student/sessions/:sessionId/sync`
- POST `/api/student/sessions/:sessionId/leave`
- POST `/api/student/sessions/:sessionId/violation`

### Tests
- GET `/api/student/tests`
- GET `/api/student/tests/:testId`
- POST `/api/student/tests/:testId/start`
- POST `/api/student/tests/:testId/answer`
- POST `/api/student/tests/:testId/finish`
- GET `/api/student/tests/:testId/ranking`
- GET `/api/student/tests/:testId/ranking/pdf`

### Quizzes
- GET `/api/student/quizzes`
- GET `/api/student/quizzes/:quizId`
- POST `/api/student/quizzes/:quizId/submit`

### Certificates
- GET `/api/student/certificates`
- GET `/api/student/certificates/:id/download`

### Announcements
- GET `/api/student/announcements`
- PATCH `/api/student/announcements/:id/read`

### Security
- POST `/api/student/security/violations`

### Settings
- GET `/api/student/settings`
- PUT `/api/student/settings`

### Help & Support
- POST `/api/student/help-support`

---

## Public / Classes

### GET `/api/classes/catalog`
Public. Subject catalog (explore subjects).

### GET `/api/classes/available`
Public/optional auth. Lists classes and assigned subjects, with purchased/locked info.

### GET `/api/courses/explore`
Public. Explore subjects.

### GET `/api/teachers/public`
Public. Public teacher list.

### POST `/api/contact/messages`
Public. Contact form.

---

## Announcements (Admin/Public)

### GET `/api/admin/announcements`
Admin list.

### POST `/api/admin/announcements`
Admin create.

### PUT `/api/admin/announcements/:id`
Admin update.

### DELETE `/api/admin/announcements/:id`
Admin delete.

### PATCH `/api/admin/announcements/:id/pin`
Admin toggle pin.

### GET `/api/announcements/my`
Student list.

### PATCH `/api/announcements/read-all`
Student mark all read.

### PATCH `/api/announcements/:id/read`
Student mark one read.

---

## Certificates (Admin/Public)

### GET `/api/admin/certificates`
Admin list.

### POST `/api/admin/certificates`
Admin generate.

### PATCH `/api/admin/certificates/:certId/revoke`
### PATCH `/api/admin/certificates/:certId/unrevoke`

### GET `/api/verify/:certId`
Public verify.

---

## Payments (Student)

### POST `/api/payments/initiate`
### POST `/api/payments/validate-promo`
### GET `/api/payments/config`
### GET `/api/payments/:id/status`
### GET `/api/payments/my-payments`
### GET `/api/payments/my-installments`

---

## Payment Receipts

### POST `/api/payments/:paymentId/receipt`
### PATCH `/api/payments/:paymentId/receipt`

---

## Progress (Teacher/Admin)

### PATCH `/api/courses/:courseId/students/:studentId/video-access`
### PATCH `/api/subjects/:subjectId/students/:studentId/video-access`
### POST `/api/courses/:courseId/students/:studentId/unlock-all`
### POST `/api/subjects/:subjectId/students/:studentId/unlock-all`
### GET `/api/courses/:courseId/students/:studentId/progress`
### GET `/api/subjects/:subjectId/students/:studentId/progress`
### POST `/api/courses/:courseId/students/:studentId/complete`
### POST `/api/subjects/:subjectId/students/:studentId/complete`
### POST `/api/classes/:classId/students/:studentId/complete`

---

## Errors (Common)

```json
{ "success": false, "message": "...", "errors": { "code": "..." } }
```

---