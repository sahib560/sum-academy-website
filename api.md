# SUM Academy API Documentation
Base URL: https://sumacademy.net/api

> Notes
> - All endpoints return JSON.
> - Auth protected routes require `Authorization: Bearer <token>`.
> - Timestamps are ISO strings unless stated otherwise.
> - `courseId` and `subjectId` are the same in this system.
> - Many endpoints return `{ success, message, data }`.

---

## Health

### GET `/api/health`
Public. Health check.

Success:
```json
{ "status": "ok", "message": "SUM Academy API healthy", "timestamp": "2026-04-12T00:00:00.000Z" }
```

---

## Auth

### POST `/api/auth/login`
Public. Login with email/password.

Request:
```json
{ "email": "user@example.com", "password": "***" }
```

Success:
```json
{ "success": true, "message": "Login successful", "data": { "token": "..." } }
```

Errors:
- `401 Invalid credentials`
- `429 Too many attempts. Try again in 15 minutes.`

### POST `/api/auth/register`
Public. Register a student.

Request:
```json
{ "fullName": "Student", "email": "user@example.com", "password": "***" }
```

### POST `/api/auth/forgot-password`
Public.

Request:
```json
{ "email": "user@example.com" }
```

---

## Uploads

### POST `/api/upload/thumbnail`
Role: admin/teacher. Upload thumbnail.

FormData:
- `file`

Success:
```json
{ "success": true, "message": "Thumbnail uploaded", "data": { "url": "https://..." } }
```

### POST `/api/upload/pdf`
Role: admin/teacher. Upload course PDF.

FormData:
- `file`
- `courseId`
- `subjectId`

Success:
```json
{ "success": true, "message": "PDF uploaded", "data": { "url": "https://...", "name": "file.pdf", "size": 12345, "type": "pdf" } }
```

### POST `/api/upload/video`
Role: admin/teacher. Upload course video.

FormData:
- `file`
- `courseId`
- `subjectId`
- `lectureId` (optional)
- `title` (optional)

Behavior:
- Converts to H.264 + AAC (faststart) for web compatibility.
- Generates HLS master playlist + segments (240p/480p/720p).
- Saves `videoUrl`, `videoPath`, `durationSec`, `hlsUrl` on lecture (if `lectureId` provided).

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

Error:
```json
{ "success": false, "message": "Video could not be converted to a web-friendly format. Please upload H.264/AAC or try again." }
```

### POST `/api/upload/logo`
Role: admin. Upload site logo.

### POST `/api/upload/apk`
Role: admin. Upload APK file.

---

## Video Streaming

### GET `/api/video/:lectureId/stream-url`
Role: student. Returns signed streaming URL. Prefers `hlsUrl` if available.

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

Error:
- `403 Session recording is locked. Contact teacher to unlock.`

---

## Student Live Sessions

### GET `/api/student/live-sessions`
Role: student. List available live sessions.

### GET `/api/student/sessions/:sessionId`
Role: student. Session detail.

### GET `/api/student/sessions/:sessionId/status`
Role: student. Session timing + counts.

Success:
```json
{
  "success": true,
  "message": "Session status fetched",
  "data": {
    "sessionId": "abc123",
    "status": "upcoming|live|ended",
    "topic": "Physics",
    "teacherName": "Ahsan",
    "date": "2026-04-12",
    "startTime": "15:00",
    "endTime": "16:00",
    "joinedCount": 12,
    "totalStudents": 30,
    "elapsedSeconds": 0,
    "remainingSeconds": 3600,
    "canJoin": true,
    "isLocked": false,
    "hlsUrl": "https://.../master.m3u8",
    "recordingUrl": "https://...mp4",
    "joinWindow": { "opensAt": "...", "closesAt": "..." },
    "timing": { "startAt": "...", "endAt": "...", "durationSeconds": 3600 }
  }
}
```

### GET `/api/student/sessions/:sessionId/sync`
Role: student. Sync for late joiners.

### POST `/api/student/sessions/:sessionId/join`
Role: student. Join session and mark attendance.

Success:
```json
{ "success": true, "message": "Joined live session", "data": { "sessionId": "abc123", "waiting": true, "canPlay": false } }
```

Errors:
- `JOIN_NOT_OPEN`
- `JOIN_CLOSED`
- `SESSION_ENDED`

### POST `/api/student/sessions/:sessionId/leave`
Role: student. Mark left.

### POST `/api/student/sessions/:sessionId/violation`
Role: student. Log violations.

Request:
```json
{ "reason": "tab_switch", "count": 2, "timestamp": "2026-04-12T10:00:00Z" }
```

---

## Session Unlock (Recording)

### PATCH `/api/teacher/sessions/:sessionId/unlock`
### PATCH `/api/admin/sessions/:sessionId/unlock`
Unlock recording access.

Success:
```json
{ "success": true, "message": "Session unlocked", "data": { "sessionId": "abc123" } }
```

---

## Student Courses

### GET `/api/student/courses`
List enrolled courses.

### GET `/api/student/courses/:courseId/content`
Returns course structure with consistent lecture fields and lock state.

### POST `/api/student/courses/:courseId/lectures/:lectureId/complete`
Mark lecture complete.

---

## Quiz

### GET `/api/student/quizzes`
### GET `/api/student/quizzes/:quizId`
### POST `/api/student/quizzes/:quizId/submit`
Returns result + rank.

---

## Tests

### GET `/api/student/tests`
### GET `/api/student/tests/:testId`
### POST `/api/student/tests/:testId/start`
### POST `/api/student/tests/:testId/answer`
### POST `/api/student/tests/:testId/finish`
### GET `/api/student/tests/:testId/ranking`

---

## Certificates

### GET `/api/student/certificates`
Returns certificate list.

---

## Announcements

### GET `/api/student/announcements`
### PATCH `/api/student/announcements/:id/read`

---

## Admin / Teacher Content

### POST `/api/teacher/lectures/:lectureId/content`
Add lecture content (video/pdf/book). Live session scheduling uses `liveStartAt` for live videos.

### DELETE `/api/teacher/lectures/:lectureId/content`
Delete content.

---

## Payments

### POST `/api/payments/initiate`
### POST `/api/payments`

---

## Notes on HLS

- `hlsUrl` is stored on lecture after upload (master.m3u8).
- Player prefers HLS and falls back to MP4.
- If `hlsUrl` is null, re-upload video to trigger conversion.

---

## Errors (Common)

```json
{ "success": false, "message": "...", "errors": { "code": "..." } }
```

---