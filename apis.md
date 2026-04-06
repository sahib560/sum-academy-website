# SUM Academy API (Auto Synced From Backend Code)

Last updated: 2026-04-07
Source of truth: `backend/src/routes/*.js` + controller handlers

## Global Response Shape

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

```json
{
  "success": false,
  "message": "Error message",
  "error": "Error message",
  "errors": {}
}
```

- HTTP methods used: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- Auth header: `Authorization: Bearer <token>` where required

## Endpoint Index

### Core & Public (12)
- PATCH `/api/announcements/:id/read`
- GET `/api/announcements/my`
- PATCH `/api/announcements/read-all`
- POST `/api/contact/messages`
- GET `/api/courses/explore`
- GET `/api/health`
- POST `/api/launch/notify`
- POST `/api/launch/notify/dispatch`
- POST `/api/promo-codes/validate`
- GET `/api/settings`
- GET `/api/test`
- GET `/api/verify/:certId`

### Auth (/api/auth) (10)
- POST `/api/auth/forgot-password/reset`
- POST `/api/auth/forgot-password/send-otp`
- POST `/api/auth/forgot-password/verify-otp`
- POST `/api/auth/login`
- POST `/api/auth/logout`
- GET `/api/auth/me`
- POST `/api/auth/register`
- POST `/api/auth/register/send-otp`
- POST `/api/auth/register/verify-otp`
- PATCH `/api/auth/set-role`

### Admin (/api/admin) (105)
- GET `/api/admin/analytics-report`
- GET `/api/admin/announcements`
- POST `/api/admin/announcements`
- DELETE `/api/admin/announcements/:id`
- PUT `/api/admin/announcements/:id`
- PATCH `/api/admin/announcements/:id/pin`
- GET `/api/admin/certificates`
- POST `/api/admin/certificates`
- PATCH `/api/admin/certificates/:certId/revoke`
- PATCH `/api/admin/certificates/:certId/unrevoke`
- GET `/api/admin/classes`
- POST `/api/admin/classes`
- DELETE `/api/admin/classes/:classId`
- PUT `/api/admin/classes/:classId`
- POST `/api/admin/classes/:classId/courses`
- DELETE `/api/admin/classes/:classId/courses/:courseId`
- POST `/api/admin/classes/:classId/enroll`
- POST `/api/admin/classes/:classId/shifts`
- DELETE `/api/admin/classes/:classId/shifts/:shiftId`
- PUT `/api/admin/classes/:classId/shifts/:shiftId`
- GET `/api/admin/classes/:classId/students`
- POST `/api/admin/classes/:classId/students`
- DELETE `/api/admin/classes/:classId/students/:studentId`
- GET `/api/admin/courses`
- POST `/api/admin/courses`
- DELETE `/api/admin/courses/:courseId`
- PATCH `/api/admin/courses/:courseId`
- PUT `/api/admin/courses/:courseId`
- GET `/api/admin/courses/:courseId/content`
- DELETE `/api/admin/courses/:courseId/content/:contentId`
- PATCH `/api/admin/courses/:courseId/students/:studentId/rewatch-access`
- POST `/api/admin/courses/:courseId/subjects`
- DELETE `/api/admin/courses/:courseId/subjects/:subjectId`
- POST `/api/admin/courses/:courseId/subjects/:subjectId/content`
- GET `/api/admin/final-quiz-requests`
- PATCH `/api/admin/final-quiz-requests/:requestId`
- GET `/api/admin/installments`
- POST `/api/admin/installments`
- GET `/api/admin/installments/:planId`
- PATCH `/api/admin/installments/:planId/:number/pay`
- PUT `/api/admin/installments/:planId/override`
- POST `/api/admin/installments/send-reminders`
- GET `/api/admin/payments`
- PATCH `/api/admin/payments/:id/verify`
- PATCH `/api/admin/payments/:paymentId/verify`
- GET `/api/admin/promo-codes`
- POST `/api/admin/promo-codes`
- DELETE `/api/admin/promo-codes/:codeId`
- PUT `/api/admin/promo-codes/:codeId`
- PATCH `/api/admin/promo-codes/:codeId/toggle`
- POST `/api/admin/promo-codes/validate`
- GET `/api/admin/quizzes`
- POST `/api/admin/quizzes`
- GET `/api/admin/quizzes/:quizId`
- GET `/api/admin/quizzes/:quizId/analytics`
- PATCH `/api/admin/quizzes/:quizId/assign`
- GET `/api/admin/quizzes/:quizId/submissions`
- POST `/api/admin/quizzes/bulk-upload`
- GET `/api/admin/quizzes/template`
- GET `/api/admin/recent-activity`
- GET `/api/admin/recent-enrollments`
- GET `/api/admin/revenue-chart`
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
- GET `/api/admin/settings/templates`
- PUT `/api/admin/settings/templates`
- PUT `/api/admin/settings/testimonials`
- GET `/api/admin/stats`
- GET `/api/admin/students`
- GET `/api/admin/students/:uid`
- PATCH `/api/admin/students/:uid/approve`
- PATCH `/api/admin/students/:uid/payment-rejections/reset`
- GET `/api/admin/students/:uid/progress`
- PATCH `/api/admin/students/:uid/reject`
- POST `/api/admin/students/bulk-upload`
- GET `/api/admin/students/template`
- GET `/api/admin/support/messages`
- DELETE `/api/admin/support/messages/:messageId`
- PATCH `/api/admin/support/messages/:messageId/read`
- POST `/api/admin/support/messages/:messageId/reply`
- GET `/api/admin/teachers`
- GET `/api/admin/teachers/:uid`
- GET `/api/admin/top-courses`
- GET `/api/admin/users`
- POST `/api/admin/users`
- DELETE `/api/admin/users/:uid`
- GET `/api/admin/users/:uid`
- PUT `/api/admin/users/:uid`
- PATCH `/api/admin/users/:uid/reset-device`
- PATCH `/api/admin/users/:uid/role`
- GET `/api/admin/videos`
- POST `/api/admin/videos`

### Teacher (/api/teacher) (53)
- GET `/api/teacher/announcements`
- POST `/api/teacher/announcements`
- DELETE `/api/teacher/chapters/:chapterId`
- PUT `/api/teacher/chapters/:chapterId`
- GET `/api/teacher/chapters/:chapterId/lectures`
- POST `/api/teacher/chapters/:chapterId/lectures`
- GET `/api/teacher/classes`
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
- DELETE `/api/teacher/lectures/:lectureId`
- PUT `/api/teacher/lectures/:lectureId`
- POST `/api/teacher/lectures/:lectureId/content`
- DELETE `/api/teacher/lectures/:lectureId/content/:contentId`
- GET `/api/teacher/quizzes`
- POST `/api/teacher/quizzes`
- GET `/api/teacher/quizzes/:quizId`
- GET `/api/teacher/quizzes/:quizId/analytics`
- PATCH `/api/teacher/quizzes/:quizId/assign`
- POST `/api/teacher/quizzes/:quizId/evaluate`
- GET `/api/teacher/quizzes/:quizId/submissions`
- POST `/api/teacher/quizzes/:quizId/submissions`
- PATCH `/api/teacher/quizzes/:quizId/submissions/:resultId/grade-short`
- POST `/api/teacher/quizzes/bulk-upload`
- GET `/api/teacher/quizzes/template`
- GET `/api/teacher/sessions`
- POST `/api/teacher/sessions`
- GET `/api/teacher/sessions/:sessionId`
- PUT `/api/teacher/sessions/:sessionId`
- GET `/api/teacher/sessions/:sessionId/attendance`
- POST `/api/teacher/sessions/:sessionId/attendance`
- PATCH `/api/teacher/sessions/:sessionId/cancel`
- PATCH `/api/teacher/sessions/:sessionId/complete`
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
- GET `/api/teacher/timetable`
- GET `/api/teacher/videos`
- POST `/api/teacher/videos`

### Student (/api/student) (18)
- GET `/api/student/announcements`
- PATCH `/api/student/announcements/:id/read`
- GET `/api/student/certificates`
- GET `/api/student/courses`
- GET `/api/student/courses/:courseId/content`
- GET `/api/student/courses/:courseId/final-quiz-request`
- POST `/api/student/courses/:courseId/final-quiz-request`
- POST `/api/student/courses/:courseId/lectures/:lectureId/complete`
- PATCH `/api/student/courses/:courseId/lectures/:lectureId/progress`
- GET `/api/student/courses/:courseId/progress`
- GET `/api/student/dashboard`
- POST `/api/student/help-support`
- GET `/api/student/quizzes`
- GET `/api/student/quizzes/:quizId`
- POST `/api/student/quizzes/:quizId/submit`
- POST `/api/student/security/violations`
- GET `/api/student/settings`
- PUT `/api/student/settings`

### Payments (/api/payments) (8)
- GET `/api/payments/:id/status`
- PATCH `/api/payments/:paymentId/receipt`
- POST `/api/payments/:paymentId/receipt`
- GET `/api/payments/config`
- POST `/api/payments/initiate`
- GET `/api/payments/my-installments`
- GET `/api/payments/my-payments`
- POST `/api/payments/validate-promo`

### Classes Public (/api/classes) (2)
- GET `/api/classes/available`
- GET `/api/classes/catalog`

### Progress & Access (/api/*) (3)
- GET `/api/courses/:courseId/students/:studentId/progress`
- POST `/api/courses/:courseId/students/:studentId/unlock-all`
- PATCH `/api/courses/:courseId/students/:studentId/video-access`

### Uploads (/api/*) (5)
- DELETE `/api/upload/file`
- POST `/api/upload/logo`
- POST `/api/upload/pdf`
- POST `/api/upload/thumbnail`
- POST `/api/upload/video`

## Detailed Endpoints

## Core & Public

### PATCH `/api/announcements/:id/read`
- Auth: Bearer token
- Handler(s): `markAnnouncementRead`
- Path params: `id`
- Query keys: None
- Body keys: None
- Success message examples: `Announcement marked as read`
- Error message examples: `Unauthorized`, `Announcement id is required`, `Announcement not found`, `Failed to mark announcement as read`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Announcement marked as read",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Unauthorized",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/announcements/my`
- Auth: Bearer token
- Handler(s): `getStudentAnnouncements`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Announcements fetched`
- Error message examples: `Unauthorized`, `Failed to fetch announcements`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Announcements fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Unauthorized",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/announcements/read-all`
- Auth: Bearer token
- Handler(s): `markAllAnnouncementsRead`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `All notifications marked as read`
- Error message examples: `Unauthorized`, `Failed to mark all announcements as read`
- Success JSON sample:

```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Unauthorized",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/contact/messages`
- Auth: Public
- Handler(s): `submitPublicContactMessage`
- Path params: None
- Query keys: None
- Body keys: `category`, `email`, `message`, `name`, `subject`
- Success message examples: `Your message has been sent to support`
- Error message examples: `Name must be at least 2 characters`, `Valid email is required`, `Subject must be at least 3 characters`, `Message must be at least 10 characters`, `Failed to submit contact message`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Your message has been sent to support",
  "data": {}
}
```

- Request body sample:

```json
{
  "category": "<category>",
  "email": "<email>",
  "message": "<message>",
  "name": "<name>",
  "subject": "<subject>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Name must be at least 2 characters",
  "error": "Name must be at least 2 characters",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/courses/explore`
- Auth: Public
- Handler(s): `exploreCourses`
- Path params: None
- Query keys: `category`, `level`, `search`
- Body keys: None
- Success message examples: `Explore courses fetched`
- Error message examples: `Failed to fetch courses`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Explore courses fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch courses",
  "error": "Failed to fetch courses"
}
```

### GET `/api/health`
- Auth: Public
- Handler(s): `(req`
- Path params: None
- Query keys: None
- Body keys: None
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/launch/notify`
- Auth: Public
- Handler(s): `submitLaunchNotify`
- Path params: None
- Query keys: None
- Body keys: `email`
- Success message examples: `sent`
- Error message examples: `Valid email is required`, `Failed to save launch notification`
- Success JSON sample:

```json
{
  "success": true,
  "message": "sent",
  "data": {}
}
```

- Request body sample:

```json
{
  "email": "<email>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Valid email is required",
  "error": "Valid email is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/launch/notify/dispatch`
- Auth: Public
- Handler(s): `dispatchLaunchNotifications`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Launch notifications dispatched`
- Error message examples: `Launch date has not passed yet`, `Email settings are incomplete`, `Failed to dispatch launch notifications`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Launch notifications dispatched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Launch date has not passed yet",
  "error": "Launch date has not passed yet",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/promo-codes/validate`
- Auth: Bearer token
- Handler(s): `verifyToken`
- Path params: None
- Query keys: None
- Body keys: None
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### GET `/api/settings`
- Auth: Public
- Handler(s): `getSettings`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Settings fetched`
- Error message examples: `Failed to fetch settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Settings fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch settings",
  "error": "Failed to fetch settings"
}
```

### GET `/api/test`
- Auth: Public
- Handler(s): `async (req`
- Path params: None
- Query keys: None
- Body keys: None
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### GET `/api/verify/:certId`
- Auth: Public
- Handler(s): `verifyCertificate`
- Path params: `certId`
- Query keys: None
- Body keys: None
- Error message examples: `Certificate not found`, `Certificate has been revoked`, `Failed to verify certificate`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Certificate not found",
  "error": "Certificate not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

## Auth (/api/auth)

### POST `/api/auth/forgot-password/reset`
- Auth: Public
- Handler(s): `resetForgotPassword`
- Path params: None
- Query keys: None
- Body keys: None
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/auth/forgot-password/send-otp`
- Auth: Public
- Handler(s): `sendForgotPasswordOtp`
- Path params: None
- Query keys: None
- Body keys: None
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/auth/forgot-password/verify-otp`
- Auth: Public
- Handler(s): `verifyForgotPasswordOtp`
- Path params: None
- Query keys: None
- Body keys: None
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/auth/login`
- Auth: Firebase token required (verifyFirebaseToken)
- Handler(s): `loginUser`
- Path params: None
- Query keys: None
- Body keys: None
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/auth/logout`
- Auth: Bearer token
- Handler(s): `logoutUser`
- Path params: None
- Query keys: None
- Body keys: None
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### GET `/api/auth/me`
- Auth: Bearer token
- Handler(s): `getMe`
- Path params: None
- Query keys: None
- Body keys: None
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/auth/register`
- Auth: Firebase token required (verifyFirebaseToken)
- Handler(s): `registerUser`
- Path params: None
- Query keys: None
- Body keys: None
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/auth/register/send-otp`
- Auth: Public
- Handler(s): `sendRegistrationOtp`
- Path params: None
- Query keys: None
- Body keys: None
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/auth/register/verify-otp`
- Auth: Public
- Handler(s): `verifyRegistrationOtp`
- Path params: None
- Query keys: None
- Body keys: None
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### PATCH `/api/auth/set-role`
- Auth: Bearer token (admin)
- Handler(s): `setUserRole`
- Path params: None
- Query keys: None
- Body keys: `role`
- Success message examples: `Role updated`
- Error message examples: `Invalid role`, `User not found`, `Failed to update role`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Role updated",
  "data": {}
}
```

- Request body sample:

```json
{
  "role": "<role>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Invalid role",
  "error": "Invalid role",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

## Admin (/api/admin)

### GET `/api/admin/analytics-report`
- Auth: Bearer token (admin)
- Handler(s): `getAnalyticsReport`
- Path params: None
- Query keys: None
- Body keys: None
- Error message examples: `Failed to generate report`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to generate report",
  "error": "Failed to generate report"
}
```

### GET `/api/admin/announcements`
- Auth: Bearer token (admin)
- Handler(s): `getAnnouncements`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Announcements fetched`
- Error message examples: `Failed to fetch announcements`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Announcements fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch announcements",
  "error": "Failed to fetch announcements"
}
```

### POST `/api/admin/announcements`
- Auth: Bearer token (admin)
- Handler(s): `createAnnouncement`
- Path params: None
- Query keys: None
- Body keys: `audienceRole`, `isPinned`, `message`, `sendEmail`, `targetId`, `targetType`
- Success message examples: `Announcement posted`
- Error message examples: `Title must be between 5 and 100 characters`, `Message must be at least 10 characters`, `targetType must be system, class, course, or single_user`, `audienceRole must be student, teacher, admin, or all`, `targetId is required for class/course/single_user target`, `Class/Course announcements can only target students or all`, `Class not found`, `Course not found`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Announcement posted",
  "data": {}
}
```

- Request body sample:

```json
{
  "audienceRole": "<audienceRole>",
  "isPinned": "<isPinned>",
  "message": "<message>",
  "sendEmail": "<sendEmail>",
  "targetId": "<targetId>",
  "targetType": "<targetType>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Title must be between 5 and 100 characters",
  "error": "Title must be between 5 and 100 characters",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### DELETE `/api/admin/announcements/:id`
- Auth: Bearer token (admin)
- Handler(s): `deleteAnnouncement`
- Path params: `announcementId`, `id`
- Query keys: None
- Body keys: None
- Success message examples: `Announcement deleted`
- Error message examples: `Announcement not found`, `Failed to delete announcement`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Announcement deleted",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Announcement not found",
  "error": "Announcement not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/admin/announcements/:id`
- Auth: Bearer token (admin)
- Handler(s): `updateAnnouncement`
- Path params: `announcementId`, `id`
- Query keys: None
- Body keys: `isPinned`, `message`
- Error message examples: `Announcement not found`, `Title must be between 5 and 100 characters`, `Message must be at least 10 characters`, `Failed to update announcement`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "isPinned": "<isPinned>",
  "message": "<message>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Announcement not found",
  "error": "Announcement not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/admin/announcements/:id/pin`
- Auth: Bearer token (admin)
- Handler(s): `togglePin`
- Path params: `announcementId`, `id`
- Query keys: None
- Body keys: `isPinned`
- Success message examples: `pinned`
- Error message examples: `Announcement not found`, `Failed to toggle pin`
- Success JSON sample:

```json
{
  "success": true,
  "message": "pinned",
  "data": {}
}
```

- Request body sample:

```json
{
  "isPinned": "<isPinned>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Announcement not found",
  "error": "Announcement not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/certificates`
- Auth: Bearer token (admin)
- Handler(s): `getCertificates`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Certificates fetched`
- Error message examples: `Failed to fetch certificates`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Certificates fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch certificates",
  "error": "Failed to fetch certificates"
}
```

### POST `/api/admin/certificates`
- Auth: Bearer token (admin)
- Handler(s): `generateCertificate`
- Path params: None
- Query keys: None
- Body keys: `allowIncomplete`, `courseId`, `forceGenerate`
- Success message examples: `Certificate already exists`
- Error message examples: `studentId and courseId are required`, `Student or course not found`, `Student is not enrolled in this course`, `Student has not completed this course. Confirm override to generate anyway.`, `Certificate will be available after class completion, class end date, or teacher completion mark.`, `Failed to generate certificate`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Certificate already exists",
  "data": {}
}
```

- Request body sample:

```json
{
  "allowIncomplete": "<allowIncomplete>",
  "courseId": "<courseId>",
  "forceGenerate": "<forceGenerate>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "studentId and courseId are required",
  "error": "studentId and courseId are required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/admin/certificates/:certId/revoke`
- Auth: Bearer token (admin)
- Handler(s): `revokeCertificate`
- Path params: `certId`
- Query keys: None
- Body keys: None
- Success message examples: `Certificate revoked`
- Error message examples: `Certificate not found`, `Failed to revoke certificate`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Certificate revoked",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Certificate not found",
  "error": "Certificate not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/admin/certificates/:certId/unrevoke`
- Auth: Bearer token (admin)
- Handler(s): `unrevokeCertificate`
- Path params: `certId`
- Query keys: None
- Body keys: None
- Success message examples: `Certificate is already active`, `Certificate unrevoked`
- Error message examples: `Certificate not found`, `Failed to unrevoke certificate`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Certificate is already active",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Certificate not found",
  "error": "Certificate not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/classes`
- Auth: Bearer token (admin)
- Handler(s): `getClasses`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Classes fetched`
- Error message examples: `Failed to fetch classes`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Classes fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch classes",
  "error": "Failed to fetch classes"
}
```

### POST `/api/admin/classes`
- Auth: Bearer token (admin)
- Handler(s): `createClass`
- Path params: None
- Query keys: None
- Body keys: `assignedCourses`, `batchCode`, `capacity`, `description`, `endDate`, `shifts`, `startDate`, `status`
- Success message examples: `Class created`
- Error message examples: `Class name must be at least 3 characters`, `Capacity must be between 1 and 1000`, `At least 1 course is required`, `At least 1 shift is required`, `, `, `Failed to create class`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Class created",
  "data": {}
}
```

- Request body sample:

```json
{
  "assignedCourses": "<assignedCourses>",
  "batchCode": "<batchCode>",
  "capacity": "<capacity>",
  "description": "<description>",
  "endDate": "<endDate>",
  "shifts": "<shifts>",
  "startDate": "<startDate>",
  "status": "<status>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Class name must be at least 3 characters",
  "error": "Class name must be at least 3 characters",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### DELETE `/api/admin/classes/:classId`
- Auth: Bearer token (admin)
- Handler(s): `deleteClass`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Class deleted`
- Error message examples: `Class not found`, `Cannot delete class while it has students, courses, or teachers assigned`, `Failed to delete class`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Class deleted",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/admin/classes/:classId`
- Auth: Bearer token (admin)
- Handler(s): `updateClass`
- Path params: None
- Query keys: None
- Body keys: `assignedCourses`, `batchCode`, `capacity`, `description`, `endDate`, `name`, `shifts`, `startDate`, `status`
- Success message examples: `Class updated`
- Error message examples: `Class not found`, `Class name must be at least 3 characters`, `Capacity must be between 1 and 1000`, `Capacity cannot be smaller than current enrolled students`, `At least 1 course is required`, `At least 1 shift is required`, `Remove or update shifts that use removed courses first`, `, `
- Success JSON sample:

```json
{
  "success": true,
  "message": "Class updated",
  "data": {}
}
```

- Request body sample:

```json
{
  "assignedCourses": "<assignedCourses>",
  "batchCode": "<batchCode>",
  "capacity": "<capacity>",
  "description": "<description>",
  "endDate": "<endDate>",
  "name": "<name>",
  "shifts": "<shifts>",
  "startDate": "<startDate>",
  "status": "<status>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/admin/classes/:classId/courses`
- Auth: Bearer token (admin)
- Handler(s): `addClassCourse`
- Path params: None
- Query keys: None
- Body keys: `courseId`
- Success message examples: `Course assigned to class`
- Error message examples: `courseId is required`, `Class not found`, `Course already assigned to class`, `Course not found`, `Failed to assign course`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Course assigned to class",
  "data": {}
}
```

- Request body sample:

```json
{
  "courseId": "<courseId>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "courseId is required",
  "error": "courseId is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### DELETE `/api/admin/classes/:classId/courses/:courseId`
- Auth: Bearer token (admin)
- Handler(s): `removeClassCourse`
- Path params: `courseId`
- Query keys: None
- Body keys: None
- Success message examples: `Course removed from class`
- Error message examples: `Class not found`, `Course not assigned to class`, `Remove shifts linked to this course first`, `Failed to remove course`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Course removed from class",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/admin/classes/:classId/enroll`
- Auth: Bearer token (admin)
- Handler(s): `enrollStudentInClass`
- Path params: None
- Query keys: None
- Body keys: `courseId`, `enrollmentType`, `paymentId`, `shiftId`, `studentId`
- Success message examples: `full_class`
- Error message examples: `studentId is required`, `enrollmentType must be full_class or single_course`, `courseId is required for single_course enrollment`, `Class not found`, `Student not found`, `Student is already enrolled in this class/course`, `CLASS_FULL`, `Shift not found`
- Success JSON sample:

```json
{
  "success": true,
  "message": "full_class",
  "data": {}
}
```

- Request body sample:

```json
{
  "courseId": "<courseId>",
  "enrollmentType": "<enrollmentType>",
  "paymentId": "<paymentId>",
  "shiftId": "<shiftId>",
  "studentId": "<studentId>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "studentId is required",
  "error": "studentId is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/admin/classes/:classId/shifts`
- Auth: Bearer token (admin)
- Handler(s): `addClassShift`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Shift added`
- Error message examples: `Class not found`, `Assign at least one course before adding shifts`, `Failed to add shift`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Shift added",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### DELETE `/api/admin/classes/:classId/shifts/:shiftId`
- Auth: Bearer token (admin)
- Handler(s): `removeClassShift`
- Path params: `shiftId`
- Query keys: None
- Body keys: None
- Success message examples: `Shift removed`
- Error message examples: `Class not found`, `Shift not found`, `Remove students from this shift before deleting it`, `Failed to remove shift`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Shift removed",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/admin/classes/:classId/shifts/:shiftId`
- Auth: Bearer token (admin)
- Handler(s): `updateClassShift`
- Path params: `shiftId`
- Query keys: None
- Body keys: None
- Success message examples: `Shift updated`
- Error message examples: `Class not found`, `Shift not found`, `Failed to update shift`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Shift updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/classes/:classId/students`
- Auth: Bearer token (admin or student)
- Handler(s): `getClassStudents`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Class students fetched`
- Error message examples: `Class not found`, `Failed to fetch class students`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Class students fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/admin/classes/:classId/students`
- Auth: Bearer token (admin or student)
- Handler(s): `addStudentToClass`
- Path params: None
- Query keys: None
- Body keys: `courseId`, `enrollmentType`, `paymentId`, `shiftId`, `studentId`
- Success message examples: `full_class`
- Error message examples: `studentId is required`, `shiftId is required`, `enrollmentType must be full_class or single_course`, `courseId is required for single_course enrollment`, `Class not found`, `Student not found`, `Student is already enrolled in this class/course`, `CLASS_FULL`
- Success JSON sample:

```json
{
  "success": true,
  "message": "full_class",
  "data": {}
}
```

- Request body sample:

```json
{
  "courseId": "<courseId>",
  "enrollmentType": "<enrollmentType>",
  "paymentId": "<paymentId>",
  "shiftId": "<shiftId>",
  "studentId": "<studentId>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "studentId is required",
  "error": "studentId is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### DELETE `/api/admin/classes/:classId/students/:studentId`
- Auth: Bearer token (admin)
- Handler(s): `removeStudentFromClass`
- Path params: `studentId`
- Query keys: None
- Body keys: None
- Error message examples: `Class not found`, `Student is not enrolled in this class`, `Failed to remove student`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/courses`
- Auth: Bearer token (admin)
- Handler(s): `getCourses`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Courses fetched`
- Error message examples: `Failed to fetch courses`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Courses fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch courses",
  "error": "Failed to fetch courses"
}
```

### POST `/api/admin/courses`
- Auth: Bearer token (admin)
- Handler(s): `createCourse`
- Path params: None
- Query keys: None
- Body keys: `category`, `description`, `discountPercent`, `hasCertificate`, `level`, `price`, `shortDescription`, `status`, `subjects`, `thumbnail`
- Success message examples: `Course created`
- Error message examples: `Title must be at least 5 characters`, `At least one subject is required`, `Failed to create course`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Course created",
  "data": {}
}
```

- Request body sample:

```json
{
  "category": "<category>",
  "description": "<description>",
  "discountPercent": "<discountPercent>",
  "hasCertificate": "<hasCertificate>",
  "level": "<level>",
  "price": "<price>",
  "shortDescription": "<shortDescription>",
  "status": "<status>",
  "subjects": "<subjects>",
  "thumbnail": "<thumbnail>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Title must be at least 5 characters",
  "error": "Title must be at least 5 characters",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### DELETE `/api/admin/courses/:courseId`
- Auth: Bearer token (admin)
- Handler(s): `deleteCourse`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Course deleted`
- Error message examples: `Cannot delete course while linked to classes, teachers, students, or quizzes`, `Failed to delete course`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Course deleted",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Cannot delete course while linked to classes, teachers, students, or quizzes",
  "error": "Cannot delete course while linked to classes, teachers, students, or quizzes",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/admin/courses/:courseId`
- Auth: Bearer token (admin)
- Handler(s): `updateCourse`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Course updated`
- Error message examples: `Failed to update course`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Course updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to update course",
  "error": "Failed to update course"
}
```

### PUT `/api/admin/courses/:courseId`
- Auth: Bearer token (admin)
- Handler(s): `updateCourse`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Course updated`
- Error message examples: `Failed to update course`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Course updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to update course",
  "error": "Failed to update course"
}
```

### GET `/api/admin/courses/:courseId/content`
- Auth: Bearer token (admin)
- Handler(s): `getCourseContent`
- Path params: `courseId`
- Query keys: None
- Body keys: None
- Error message examples: `courseId is required`, `Missing student uid`, `Failed to fetch course content`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "courseId is required",
  "error": "courseId is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### DELETE `/api/admin/courses/:courseId/content/:contentId`
- Auth: Bearer token (admin)
- Handler(s): `deleteCourseContent`
- Path params: `contentId`
- Query keys: None
- Body keys: None
- Success message examples: `Content deleted`
- Error message examples: `Failed to delete content`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Content deleted",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to delete content",
  "error": "Failed to delete content"
}
```

### PATCH `/api/admin/courses/:courseId/students/:studentId/rewatch-access`
- Auth: Bearer token (admin)
- Handler(s): `updateCourseRewatchAccess`
- Path params: `courseId`, `studentId`
- Query keys: None
- Body keys: `lockAfterCompletion`, `unlocked`
- Error message examples: `Missing user uid`, `courseId and studentId are required`, `No class enrollment found for this student in the selected course`, `Failed to update rewatch access`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "lockAfterCompletion": "<lockAfterCompletion>",
  "unlocked": "<unlocked>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/admin/courses/:courseId/subjects`
- Auth: Bearer token (admin)
- Handler(s): `addCourseSubject`
- Path params: None
- Query keys: None
- Body keys: `name`, `order`, `teacherId`
- Success message examples: `Subject added`
- Error message examples: `Subject name and teacher are required`, `Teacher not found`, `Course not found`, `Failed to add subject`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Subject added",
  "data": {}
}
```

- Request body sample:

```json
{
  "name": "<name>",
  "order": "<order>",
  "teacherId": "<teacherId>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Subject name and teacher are required",
  "error": "Subject name and teacher are required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### DELETE `/api/admin/courses/:courseId/subjects/:subjectId`
- Auth: Bearer token (admin)
- Handler(s): `removeCourseSubject`
- Path params: `subjectId`
- Query keys: None
- Body keys: None
- Success message examples: `Subject removed`
- Error message examples: `Cannot remove subject while linked to content or quizzes`, `Course not found`, `Subject not found`, `Failed to remove subject`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Subject removed",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Cannot remove subject while linked to content or quizzes",
  "error": "Cannot remove subject while linked to content or quizzes",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/admin/courses/:courseId/subjects/:subjectId/content`
- Auth: Bearer token (admin)
- Handler(s): `addCourseContent`
- Path params: `subjectId`
- Query keys: None
- Body keys: `contentType`, `isLiveSession`, `noteType`, `size`, `title`, `type`, `url`, `videoId`
- Success message examples: `Content added`
- Error message examples: `type is required`, `Invalid content type`, `Course not found`, `Subject not found`, `Video not found in library`, `Selected video has no URL`, `title and url are required (or pass valid videoId)`, `Failed to add content`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Content added",
  "data": {}
}
```

- Request body sample:

```json
{
  "contentType": "<contentType>",
  "isLiveSession": "<isLiveSession>",
  "noteType": "<noteType>",
  "size": "<size>",
  "title": "<title>",
  "type": "<type>",
  "url": "<url>",
  "videoId": "<videoId>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "type is required",
  "error": "type is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/final-quiz-requests`
- Auth: Bearer token (admin)
- Handler(s): `getFinalQuizRequests`
- Path params: None
- Query keys: `courseId`, `status`
- Body keys: None
- Success message examples: `Final quiz requests fetched`
- Error message examples: `Missing user uid`, `Failed to fetch final quiz requests`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Final quiz requests fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/admin/final-quiz-requests/:requestId`
- Auth: Bearer token (admin)
- Handler(s): `updateFinalQuizRequestStatus`
- Path params: `requestId`
- Query keys: None
- Body keys: `action`, `notes`
- Error message examples: `Missing user uid`, `requestId is required`, `action must be approve, reject or complete`, `Request not found`, `Forbidden`, `Failed to update final quiz request`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "action": "<action>",
  "notes": "<notes>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/installments`
- Auth: Bearer token (admin)
- Handler(s): `getInstallments`
- Path params: None
- Query keys: `search`
- Body keys: None
- Success message examples: `Installments fetched`
- Error message examples: `Failed to fetch installments`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Installments fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch installments",
  "error": "Failed to fetch installments"
}
```

### POST `/api/admin/installments`
- Auth: Bearer token (admin)
- Handler(s): `createInstallmentPlan`
- Path params: None
- Query keys: None
- Body keys: `classId`, `courseId`, `numberOfInstallments`, `startDate`, `totalAmount`
- Success message examples: `Installment plan created`
- Error message examples: `studentId, courseId, totalAmount, numberOfInstallments are required`, `Installments must be between 2 and 6`, `Amount must be positive`, `Student not found`, `Course not found`, `Class not found`, `Failed to create installment plan`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Installment plan created",
  "data": {}
}
```

- Request body sample:

```json
{
  "classId": "<classId>",
  "courseId": "<courseId>",
  "numberOfInstallments": "<numberOfInstallments>",
  "startDate": "<startDate>",
  "totalAmount": "<totalAmount>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "studentId, courseId, totalAmount, numberOfInstallments are required",
  "error": "studentId, courseId, totalAmount, numberOfInstallments are required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/installments/:planId`
- Auth: Bearer token (admin)
- Handler(s): `getInstallmentById`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Installment plan fetched`
- Error message examples: `Installment plan not found`, `Failed to fetch installment plan`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Installment plan fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Installment plan not found",
  "error": "Installment plan not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/admin/installments/:planId/:number/pay`
- Auth: Bearer token (admin)
- Handler(s): `markInstallmentPaid`
- Path params: `installmentNumber`, `number`, `planId`
- Query keys: None
- Body keys: None
- Success message examples: `Installment marked paid`
- Error message examples: `planId and installment number are required`, `Plan not found`, `Installment not found in this plan`, `Installment already marked as paid`, `Failed to mark installment paid`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Installment marked paid",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "planId and installment number are required",
  "error": "planId and installment number are required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/admin/installments/:planId/override`
- Auth: Bearer token (admin)
- Handler(s): `overrideInstallment`
- Path params: None
- Query keys: None
- Body keys: `installments`
- Success message examples: `Installment schedule updated`
- Error message examples: `installments array is required`, `Installment plan not found`, `Each installment amount must be a positive number`, `Each installment dueDate must be valid`, `Unpaid installment due dates must be today or future`, `Failed to override installment schedule`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Installment schedule updated",
  "data": {}
}
```

- Request body sample:

```json
{
  "installments": "<installments>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "installments array is required",
  "error": "installments array is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/admin/installments/send-reminders`
- Auth: Bearer token (admin)
- Handler(s): `sendInstallmentReminders`
- Path params: None
- Query keys: None
- Body keys: None
- Error message examples: `Failed to send reminders`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to send reminders",
  "error": "Failed to send reminders"
}
```

### GET `/api/admin/payments`
- Auth: Bearer token (admin)
- Handler(s): `getAdminPayments`
- Path params: None
- Query keys: `includeAwaitingReceipt`
- Body keys: None
- Success message examples: `Admin payments fetched`
- Error message examples: `Failed to fetch admin payments`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Admin payments fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch admin payments",
  "error": "Failed to fetch admin payments"
}
```

### PATCH `/api/admin/payments/:id/verify`
- Auth: Bearer token (admin)
- Handler(s): `verifyBankTransfer`
- Path params: `id`, `paymentId`
- Query keys: None
- Body keys: `action`
- Success message examples: `paid`, `rejected`
- Error message examples: `paymentId is required`, `Action must be approve or reject`, `Payment not found`, `Receipt is required before approval. Ask student to upload receipt first.`, `Payment record is missing studentId. Please recreate payment request.`, `Payment is missing class/course reference. Please recreate payment request.`, `Payment cannot be approved until receipt is uploaded.`, `Only receipt-submitted requests can be approved`
- Success JSON sample:

```json
{
  "success": true,
  "message": "paid",
  "data": {}
}
```

- Request body sample:

```json
{
  "action": "<action>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "paymentId is required",
  "error": "paymentId is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/admin/payments/:paymentId/verify`
- Auth: Bearer token (admin)
- Handler(s): `verifyBankTransfer`
- Path params: `id`, `paymentId`
- Query keys: None
- Body keys: `action`
- Success message examples: `paid`, `rejected`
- Error message examples: `paymentId is required`, `Action must be approve or reject`, `Payment not found`, `Receipt is required before approval. Ask student to upload receipt first.`, `Payment record is missing studentId. Please recreate payment request.`, `Payment is missing class/course reference. Please recreate payment request.`, `Payment cannot be approved until receipt is uploaded.`, `Only receipt-submitted requests can be approved`
- Success JSON sample:

```json
{
  "success": true,
  "message": "paid",
  "data": {}
}
```

- Request body sample:

```json
{
  "action": "<action>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "paymentId is required",
  "error": "paymentId is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/promo-codes`
- Auth: Bearer token (admin)
- Handler(s): `getPromoCodes`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Promo codes fetched`
- Error message examples: `Failed to fetch promo codes`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Promo codes fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch promo codes",
  "error": "Failed to fetch promo codes"
}
```

### POST `/api/admin/promo-codes`
- Auth: Bearer token (admin)
- Handler(s): `createPromoCode`
- Path params: None
- Query keys: None
- Body keys: `courseId`, `discountType`, `discountValue`, `expiresAt`, `isActive`, `isSingleUse`, `usageLimit`
- Success message examples: `Promo code created`
- Error message examples: `Code must be at least 4 characters`, `Code must be alphanumeric only`, `discountType must be percentage or fixed`, `discountValue must be a positive number`, `Percentage discount must be between 1 and 100`, `usageLimit must be 0 or a positive number`, `Invalid expiresAt date`, `expiresAt must be a future date`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Promo code created",
  "data": {}
}
```

- Request body sample:

```json
{
  "courseId": "<courseId>",
  "discountType": "<discountType>",
  "discountValue": "<discountValue>",
  "expiresAt": "<expiresAt>",
  "isActive": "<isActive>",
  "isSingleUse": "<isSingleUse>",
  "usageLimit": "<usageLimit>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Code must be at least 4 characters",
  "error": "Code must be at least 4 characters",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### DELETE `/api/admin/promo-codes/:codeId`
- Auth: Bearer token (admin)
- Handler(s): `deletePromoCode`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Promo code deleted`
- Error message examples: `Promo code not found`, `Cannot delete used promo code. Deactivate it instead.`, `Failed to delete promo code`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Promo code deleted",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Promo code not found",
  "error": "Promo code not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/admin/promo-codes/:codeId`
- Auth: Bearer token (admin)
- Handler(s): `updatePromoCode`
- Path params: None
- Query keys: None
- Body keys: `code`, `createdAt`, `discountValue`, `expiresAt`, `isActive`, `isSingleUse`, `usageCount`, `usageLimit`
- Error message examples: `Promo code not found`, `Cannot update code, usageCount, or createdAt fields`, `, `, `discountValue must be positive`, `Percentage discount must be between 1 and 100`, `usageLimit must be 0 or positive`, `usageLimit cannot be less than current usageCount`, `Invalid expiresAt date`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "code": "<code>",
  "createdAt": "<createdAt>",
  "discountValue": "<discountValue>",
  "expiresAt": "<expiresAt>",
  "isActive": "<isActive>",
  "isSingleUse": "<isSingleUse>",
  "usageCount": "<usageCount>",
  "usageLimit": "<usageLimit>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Promo code not found",
  "error": "Promo code not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/admin/promo-codes/:codeId/toggle`
- Auth: Bearer token (admin)
- Handler(s): `togglePromoCode`
- Path params: None
- Query keys: None
- Body keys: `isActive`
- Success message examples: `activated`
- Error message examples: `isActive boolean is required`, `Promo code not found`, `Failed to toggle promo code`
- Success JSON sample:

```json
{
  "success": true,
  "message": "activated",
  "data": {}
}
```

- Request body sample:

```json
{
  "isActive": "<isActive>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "isActive boolean is required",
  "error": "isActive boolean is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/admin/promo-codes/validate`
- Auth: Bearer token (admin)
- Handler(s): `validatePromoCode`
- Path params: None
- Query keys: None
- Body keys: `courseId`, `studentId`
- Error message examples: `Promo code is required`, `Invalid promo code`, `Promo code is inactive`, `Promo code has expired`, `Promo code usage limit reached`, `Promo code not valid for this course`, `You have already used this promo code`, `Failed to validate promo code`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "courseId": "<courseId>",
  "studentId": "<studentId>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Promo code is required",
  "error": "Promo code is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/quizzes`
- Auth: Bearer token (admin)
- Handler(s): `getTeacherQuizzes`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Teacher quizzes fetched`
- Error message examples: `Missing user uid`, `Failed to fetch quizzes`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Teacher quizzes fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/admin/quizzes`
- Auth: Bearer token (admin)
- Handler(s): `createTeacherQuiz`
- Path params: None
- Query keys: None
- Body keys: `assignToClassId`, `assignmentTargetType`, `chapterId`, `classId`, `courseId`, `description`, `dueAt`, `isFinalQuiz`, `questions`, `scope`, `subjectId`, `targetType`, `title`
- Error message examples: `Missing user uid`, `scope must be chapter or subject`, `title must be at least 3 characters`, `courseId and subjectId are required`, `chapterId is required for chapter quiz`, `At least one question is required`, `classId is required for class assignment`, `dueAt is required for class assignment`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "assignToClassId": "<assignToClassId>",
  "assignmentTargetType": "<assignmentTargetType>",
  "chapterId": "<chapterId>",
  "classId": "<classId>",
  "courseId": "<courseId>",
  "description": "<description>",
  "dueAt": "<dueAt>",
  "isFinalQuiz": "<isFinalQuiz>",
  "questions": "<questions>",
  "scope": "<scope>",
  "subjectId": "<subjectId>",
  "targetType": "<targetType>",
  "title": "<title>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/quizzes/:quizId`
- Auth: Bearer token (admin)
- Handler(s): `getTeacherQuizById`
- Path params: `quizId`
- Query keys: None
- Body keys: None
- Success message examples: `Quiz fetched`
- Error message examples: `Missing user uid`, `quizId is required`, `Failed to fetch quiz`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Quiz fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/quizzes/:quizId/analytics`
- Auth: Bearer token (admin)
- Handler(s): `getQuizAnalytics`
- Path params: `quizId`
- Query keys: None
- Body keys: None
- Error message examples: `Missing user uid`, `quizId is required`, `Failed to fetch quiz analytics`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/admin/quizzes/:quizId/assign`
- Auth: Bearer token (admin)
- Handler(s): `assignQuizToStudents`
- Path params: `quizId`
- Query keys: None
- Body keys: `classId`, `courseId`, `dueAt`, `studentIds`, `targetType`
- Error message examples: `Missing user uid`, `quizId is required`, `dueAt is required`, `Invalid dueAt date/time`, `dueAt must be in the future`, `Quiz is missing course/subject linkage`, `Quiz can only be assigned within its own course`, `No students found in this course`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "classId": "<classId>",
  "courseId": "<courseId>",
  "dueAt": "<dueAt>",
  "studentIds": "<studentIds>",
  "targetType": "<targetType>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/quizzes/:quizId/submissions`
- Auth: Bearer token (admin)
- Handler(s): `getQuizSubmissions`
- Path params: `quizId`
- Query keys: None
- Body keys: None
- Success message examples: `Quiz submissions fetched`
- Error message examples: `Missing user uid`, `quizId is required`, `Failed to fetch quiz submissions`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Quiz submissions fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/admin/quizzes/bulk-upload`
- Auth: Bearer token (admin)
- Handler(s): `bulkUploadTeacherQuiz`
- Path params: None
- Query keys: None
- Body keys: `csvText`
- Success message examples: `Bulk quiz upload completed`
- Error message examples: `Missing user uid`, `CSV file is required`, `CSV header row not found`, `, `, `No question rows found in CSV`, `courseId is required in every row`, `subjectId is required in every row`, `scope must be chapter or subject`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Bulk quiz upload completed",
  "data": {}
}
```

- Request body sample:

```json
{
  "csvText": "<csvText>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/quizzes/template`
- Auth: Bearer token (admin)
- Handler(s): `downloadQuizBulkTemplate`
- Path params: None
- Query keys: `chapterId`, `chapterName`, `courseId`, `courseName`, `scope`, `subjectId`, `subjectName`
- Body keys: None
- Error message examples: `Missing user uid`, `scope must be chapter or subject`, `courseId and subjectId are required`, `chapterId is required for chapter scope`, `Failed to download template`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/recent-activity`
- Auth: Bearer token (admin)
- Handler(s): `getRecentActivity`
- Path params: `id`, `uid`
- Query keys: None
- Body keys: None
- Success message examples: `Activity fetched`
- Error message examples: `Failed to fetch activity`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Activity fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch activity",
  "error": "Failed to fetch activity"
}
```

### GET `/api/admin/recent-enrollments`
- Auth: Bearer token (admin)
- Handler(s): `getRecentEnrollments`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Enrollments fetched`
- Error message examples: `Failed to fetch enrollments`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Enrollments fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch enrollments",
  "error": "Failed to fetch enrollments"
}
```

### GET `/api/admin/revenue-chart`
- Auth: Bearer token (admin)
- Handler(s): `getRevenueChart`
- Path params: None
- Query keys: `days`
- Body keys: None
- Success message examples: `Revenue chart fetched`
- Error message examples: `Failed to fetch revenue`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Revenue chart fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch revenue",
  "error": "Failed to fetch revenue"
}
```

### GET `/api/admin/settings`
- Auth: Bearer token (admin)
- Handler(s): `getAdminSettings`
- Path params: None
- Query keys: None
- Body keys: None
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### PUT `/api/admin/settings/about`
- Auth: Bearer token (admin)
- Handler(s): `updateAboutSettings`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `About settings updated`
- Error message examples: `About heading is required`, `Failed to update about settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "About settings updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "About heading is required",
  "error": "About heading is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/admin/settings/appearance`
- Auth: Bearer token (admin)
- Handler(s): `updateAppearance`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Appearance settings updated`
- Error message examples: `Failed to update appearance settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Appearance settings updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to update appearance settings",
  "error": "Failed to update appearance settings"
}
```

### PUT `/api/admin/settings/certificate`
- Auth: Bearer token (admin)
- Handler(s): `updateCertificateSettings`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Certificate settings updated`
- Error message examples: `Failed to update certificate settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Certificate settings updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to update certificate settings",
  "error": "Failed to update certificate settings"
}
```

### PUT `/api/admin/settings/contact`
- Auth: Bearer token (admin)
- Handler(s): `updateContactSettings`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Contact settings updated`
- Error message examples: `contact email must be valid`, `Failed to update contact settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Contact settings updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "contact email must be valid",
  "error": "contact email must be valid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/admin/settings/email`
- Auth: Bearer token (admin)
- Handler(s): `updateEmailSettings`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Email settings updated`
- Error message examples: `smtpHost is required`, `smtpPort must be a valid port number`, `smtpEmail must be a valid email`, `Failed to update email settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Email settings updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "smtpHost is required",
  "error": "smtpHost is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/admin/settings/email/test`
- Auth: Bearer token (admin)
- Handler(s): `testEmailSettings`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Test email sent successfully`
- Error message examples: `testEmail must be valid`, `Email settings are incomplete`, `Unknown error`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Test email sent successfully",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "testEmail must be valid",
  "error": "testEmail must be valid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/admin/settings/features`
- Auth: Bearer token (admin)
- Handler(s): `updateFeatures`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Features updated`
- Error message examples: `Features heading is required`, `At least one feature is required`, `You can add up to 8 features only`, `Failed to update features`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Features updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Features heading is required",
  "error": "Features heading is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/admin/settings/footer`
- Auth: Bearer token (admin)
- Handler(s): `updateFooterSettings`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Footer settings updated`
- Error message examples: `Failed to update footer settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Footer settings updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to update footer settings",
  "error": "Failed to update footer settings"
}
```

### PUT `/api/admin/settings/general`
- Auth: Bearer token (admin)
- Handler(s): `updateGeneralSettings`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `General settings updated`
- Error message examples: `siteName must be at least 3 characters`, `contactEmail must be a valid email`, `Failed to update general settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "General settings updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "siteName must be at least 3 characters",
  "error": "siteName must be at least 3 characters",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/admin/settings/hero`
- Auth: Bearer token (admin)
- Handler(s): `updateHeroSettings`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Hero settings updated`
- Error message examples: `Hero heading must be at least 5 characters`, `At least one hero stat is required`, `Failed to update hero settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Hero settings updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Hero heading must be at least 5 characters",
  "error": "Hero heading must be at least 5 characters",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/admin/settings/how-it-works`
- Auth: Bearer token (admin)
- Handler(s): `updateHowItWorks`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `How It Works updated`
- Error message examples: `How It Works heading is required`, `At least one step is required`, `Failed to update How It Works`
- Success JSON sample:

```json
{
  "success": true,
  "message": "How It Works updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "How It Works heading is required",
  "error": "How It Works heading is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/admin/settings/maintenance`
- Auth: Bearer token (admin)
- Handler(s): `updateMaintenance`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Maintenance settings updated`
- Error message examples: `Failed to update maintenance settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Maintenance settings updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to update maintenance settings",
  "error": "Failed to update maintenance settings"
}
```

### PUT `/api/admin/settings/payment`
- Auth: Bearer token (admin)
- Handler(s): `updatePaymentSettings`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Payment settings updated`
- Error message examples: `Failed to update payment settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Payment settings updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to update payment settings",
  "error": "Failed to update payment settings"
}
```

### PUT `/api/admin/settings/security`
- Auth: Bearer token (admin)
- Handler(s): `updateSecuritySettings`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Security settings updated`
- Error message examples: `maxLoginAttempts must be between 3 and 10`, `lockoutDuration must be between 5 and 60`, `sessionTimeout must be a positive number`, `Failed to update security settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Security settings updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "maxLoginAttempts must be between 3 and 10",
  "error": "maxLoginAttempts must be between 3 and 10",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/settings/templates`
- Auth: Bearer token (admin)
- Handler(s): `getEmailTemplates`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Email templates fetched`
- Error message examples: `Failed to fetch email templates`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Email templates fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch email templates",
  "error": "Failed to fetch email templates"
}
```

### PUT `/api/admin/settings/templates`
- Auth: Bearer token (admin)
- Handler(s): `updateEmailTemplate`
- Path params: None
- Query keys: None
- Body keys: `body`, `subject`
- Success message examples: `Template updated`
- Error message examples: `templateName is required`, `subject is required`, `body is required`, `Failed to update email template`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Template updated",
  "data": {}
}
```

- Request body sample:

```json
{
  "body": "<body>",
  "subject": "<subject>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "templateName is required",
  "error": "templateName is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/admin/settings/testimonials`
- Auth: Bearer token (admin)
- Handler(s): `updateTestimonials`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Testimonials updated`
- Error message examples: `Testimonials heading is required`, `At least one testimonial is required`, `Failed to update testimonials`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Testimonials updated",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Testimonials heading is required",
  "error": "Testimonials heading is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/stats`
- Auth: Bearer token (admin)
- Handler(s): `getDashboardStats`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Stats fetched`
- Error message examples: `Failed to fetch stats`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Stats fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch stats",
  "error": "Failed to fetch stats"
}
```

### GET `/api/admin/students`
- Auth: Bearer token (admin)
- Handler(s): `getStudents`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Students fetched`
- Error message examples: `Failed to fetch students`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Students fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch students",
  "error": "Failed to fetch students"
}
```

### GET `/api/admin/students/:uid`
- Auth: Bearer token (admin)
- Handler(s): `getStudentById`
- Path params: None
- Query keys: None
- Body keys: None
- Error message examples: `uid is required`, `Student not found`, `Failed to fetch student`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "uid is required",
  "error": "uid is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/admin/students/:uid/approve`
- Auth: Bearer token (admin)
- Handler(s): `approveStudent`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Student approved successfully`
- Error message examples: `Failed to approve student`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Student approved successfully",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to approve student",
  "error": "Failed to approve student"
}
```

### PATCH `/api/admin/students/:uid/payment-rejections/reset`
- Auth: Bearer token (admin)
- Handler(s): `resetStudentPaymentRejectLock`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Student payment reject lock has been reset`
- Error message examples: `uid is required`, `Student not found`, `Failed to reset student payment lock`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Student payment reject lock has been reset",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "uid is required",
  "error": "uid is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/students/:uid/progress`
- Auth: Bearer token (admin)
- Handler(s): `getStudentProgressById`
- Path params: None
- Query keys: None
- Body keys: None
- Error message examples: `uid is required`, `Student not found`, `Failed to fetch student progress`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "uid is required",
  "error": "uid is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/admin/students/:uid/reject`
- Auth: Bearer token (admin)
- Handler(s): `rejectStudent`
- Path params: None
- Query keys: None
- Body keys: `reason`
- Success message examples: `Student rejected`
- Error message examples: `Failed to reject student`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Student rejected",
  "data": {}
}
```

- Request body sample:

```json
{
  "reason": "<reason>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to reject student",
  "error": "Failed to reject student"
}
```

### POST `/api/admin/students/bulk-upload`
- Auth: Bearer token (admin)
- Handler(s): `bulkUploadStudents`
- Path params: None
- Query keys: None
- Body keys: `csvText`
- Success message examples: `Students bulk upload completed with some failures`
- Error message examples: `CSV file is required`, `CSV header row not found`, `CSV must include name column`, `, `, `No student rows found in CSV`, `CSV validation failed`, `No students were created`, `Failed to bulk upload students`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Students bulk upload completed with some failures",
  "data": {}
}
```

- Request body sample:

```json
{
  "csvText": "<csvText>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "CSV file is required",
  "error": "CSV file is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/students/template`
- Auth: Bearer token (admin)
- Handler(s): `downloadStudentsBulkTemplate`
- Path params: None
- Query keys: None
- Body keys: None
- Error message examples: `Failed to download students template`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to download students template",
  "error": "Failed to download students template"
}
```

### GET `/api/admin/support/messages`
- Auth: Bearer token (admin)
- Handler(s): `getSupportMessages`
- Path params: None
- Query keys: `search`, `source`, `status`
- Body keys: None
- Success message examples: `Support messages fetched`
- Error message examples: `Failed to fetch support messages`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Support messages fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch support messages",
  "error": "Failed to fetch support messages"
}
```

### DELETE `/api/admin/support/messages/:messageId`
- Auth: Bearer token (admin)
- Handler(s): `deleteSupportMessage`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Support message deleted`
- Error message examples: `Support message not found`, `Failed to delete support message`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Support message deleted",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Support message not found",
  "error": "Support message not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/admin/support/messages/:messageId/read`
- Auth: Bearer token (admin)
- Handler(s): `markSupportMessageRead`
- Path params: None
- Query keys: None
- Body keys: `isRead`
- Success message examples: `Message marked as read`
- Error message examples: `Support message not found`, `Failed to update message status`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Message marked as read",
  "data": {}
}
```

- Request body sample:

```json
{
  "isRead": "<isRead>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Support message not found",
  "error": "Support message not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/admin/support/messages/:messageId/reply`
- Auth: Bearer token (admin)
- Handler(s): `replySupportMessage`
- Path params: None
- Query keys: None
- Body keys: `replyMessage`
- Success message examples: `replied`
- Error message examples: `Reply must be at least 3 characters`, `Support message not found`, `Recipient email is invalid`, `Failed to send reply`
- Success JSON sample:

```json
{
  "success": true,
  "message": "replied",
  "data": {}
}
```

- Request body sample:

```json
{
  "replyMessage": "<replyMessage>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Reply must be at least 3 characters",
  "error": "Reply must be at least 3 characters",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/teachers`
- Auth: Bearer token (admin)
- Handler(s): `getTeachers`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Teachers fetched`
- Error message examples: `Failed to fetch teachers`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Teachers fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch teachers",
  "error": "Failed to fetch teachers"
}
```

### GET `/api/admin/teachers/:uid`
- Auth: Bearer token (admin)
- Handler(s): `getTeacherById`
- Path params: None
- Query keys: None
- Body keys: None
- Error message examples: `uid is required`, `Teacher not found`, `Failed to fetch teacher`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "uid is required",
  "error": "uid is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/top-courses`
- Auth: Bearer token (admin)
- Handler(s): `getTopCourses`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Top courses fetched`
- Error message examples: `Failed to fetch courses`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Top courses fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch courses",
  "error": "Failed to fetch courses"
}
```

### GET `/api/admin/users`
- Auth: Bearer token (admin)
- Handler(s): `getUsers`
- Path params: None
- Query keys: `isActive`, `search`
- Body keys: None
- Success message examples: `Users fetched`
- Error message examples: `Failed to fetch users`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Users fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch users",
  "error": "Failed to fetch users"
}
```

### POST `/api/admin/users`
- Auth: Bearer token (admin)
- Handler(s): `createUser`
- Path params: None
- Query keys: None
- Body keys: `bio`, `email`, `password`, `phone`, `role`, `subject`
- Error message examples: `All fields required`, `Invalid role`, `Enter a valid email address`, `Phone must be 03001234567 or +923001234567 format`, `Email already in use`, `Failed to create user`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "bio": "<bio>",
  "email": "<email>",
  "password": "<password>",
  "phone": "<phone>",
  "role": "<role>",
  "subject": "<subject>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "All fields required",
  "error": "All fields required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### DELETE `/api/admin/users/:uid`
- Auth: Bearer token (admin)
- Handler(s): `deleteUser`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `User deleted from authentication and database`
- Error message examples: `User not found`, `Admin cannot delete their own account`, `Cannot delete teacher while assigned to courses, classes, or subjects`, `Failed to delete user from authentication. No database changes were made.`, `Failed to delete user`
- Success JSON sample:

```json
{
  "success": true,
  "message": "User deleted from authentication and database",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "User not found",
  "error": "User not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/users/:uid`
- Auth: Bearer token (admin)
- Handler(s): `getUserById`
- Path params: None
- Query keys: None
- Body keys: None
- Error message examples: `uid is required`, `User not found`, `Failed to fetch user`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "uid is required",
  "error": "uid is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/admin/users/:uid`
- Auth: Bearer token (admin)
- Handler(s): `updateUser`
- Path params: None
- Query keys: None
- Body keys: `address`, `bio`, `caste`, `confirmPassword`, `district`, `domicile`, `email`, `fatherName`, `fatherOccupation`, `fatherPhone`, `fullName`, `isActive`, `name`, `password`, `phone`, `phoneNumber`, `subject`
- Success message examples: `,
        email: nextEmail || userData.email || `
- Error message examples: `User not found`, `Enter a valid email address`, `Password cannot be empty`, `Password must be at least 6 characters`, `Passwords do not match`, `Phone must be 03001234567 or +923001234567 format`, `Father phone must be 03001234567 or +923001234567 format`, `Admin cannot deactivate their own account`
- Success JSON sample:

```json
{
  "success": true,
  "message": ",\n        email: nextEmail || userData.email || ",
  "data": {}
}
```

- Request body sample:

```json
{
  "address": "<address>",
  "bio": "<bio>",
  "caste": "<caste>",
  "confirmPassword": "<confirmPassword>",
  "district": "<district>",
  "domicile": "<domicile>",
  "email": "<email>",
  "fatherName": "<fatherName>",
  "fatherOccupation": "<fatherOccupation>",
  "fatherPhone": "<fatherPhone>",
  "fullName": "<fullName>",
  "isActive": "<isActive>",
  "name": "<name>",
  "password": "<password>",
  "phone": "<phone>",
  "phoneNumber": "<phoneNumber>",
  "subject": "<subject>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "User not found",
  "error": "User not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/admin/users/:uid/reset-device`
- Auth: Bearer token (admin)
- Handler(s): `resetUserDevice`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Device reset successfully. Student can now login from any device once.`
- Error message examples: `User not found`, `Device reset only applies to students`, `Failed to reset device`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Device reset successfully. Student can now login from any device once.",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "User not found",
  "error": "User not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/admin/users/:uid/role`
- Auth: Bearer token (admin)
- Handler(s): `setUserRole`
- Path params: None
- Query keys: None
- Body keys: `role`
- Success message examples: `Role updated`
- Error message examples: `Invalid role`, `User not found`, `Failed to update role`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Role updated",
  "data": {}
}
```

- Request body sample:

```json
{
  "role": "<role>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Invalid role",
  "error": "Invalid role",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/admin/videos`
- Auth: Bearer token (admin)
- Handler(s): `getVideoLibrary`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Video library fetched`
- Error message examples: `Failed to fetch video library`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Video library fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch video library",
  "error": "Failed to fetch video library"
}
```

### POST `/api/admin/videos`
- Auth: Bearer token (admin)
- Handler(s): `createVideoLibraryItem`
- Path params: None
- Query keys: None
- Body keys: `courseId`, `courseName`, `isActive`, `isLiveSession`, `teacherId`, `teacherName`, `url`, `videoMode`
- Error message examples: `title must be at least 3 characters`, `url is required`, `courseId is required`, `Course not found`, `Failed to add video to library`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "courseId": "<courseId>",
  "courseName": "<courseName>",
  "isActive": "<isActive>",
  "isLiveSession": "<isLiveSession>",
  "teacherId": "<teacherId>",
  "teacherName": "<teacherName>",
  "url": "<url>",
  "videoMode": "<videoMode>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "title must be at least 3 characters",
  "error": "title must be at least 3 characters",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

## Teacher (/api/teacher)

### GET `/api/teacher/announcements`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getTeacherOutgoingAnnouncements`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Teacher outgoing announcements fetched`
- Error message examples: `Unauthorized`, `Failed to fetch teacher outgoing announcements`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Teacher outgoing announcements fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Unauthorized",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/teacher/announcements`
- Auth: Bearer token (teacher or admin)
- Handler(s): `createTeacherAnnouncement`
- Path params: None
- Query keys: None
- Body keys: `isPinned`, `message`, `sendEmail`, `targetId`, `targetType`, `title`
- Success message examples: `Announcement posted`
- Error message examples: `Unauthorized`, `Title must be between 5 and 100 characters`, `Message must be at least 10 characters`, `targetType must be course or single_user`, `targetId is required`, `You are not assigned to any course`, `Course not found`, `You can only send announcements to your assigned course students`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Announcement posted",
  "data": {}
}
```

- Request body sample:

```json
{
  "isPinned": "<isPinned>",
  "message": "<message>",
  "sendEmail": "<sendEmail>",
  "targetId": "<targetId>",
  "targetType": "<targetType>",
  "title": "<title>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Unauthorized",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### DELETE `/api/teacher/chapters/:chapterId`
- Auth: Bearer token (teacher or admin)
- Handler(s): `deleteChapter`
- Path params: `chapterId`
- Query keys: None
- Body keys: None
- Success message examples: `Chapter deleted`
- Error message examples: `Missing teacher uid`, `chapterId is required`, `Failed to delete chapter`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Chapter deleted",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/teacher/chapters/:chapterId`
- Auth: Bearer token (teacher or admin)
- Handler(s): `updateChapter`
- Path params: `chapterId`
- Query keys: None
- Body keys: `order`
- Error message examples: `Missing teacher uid`, `chapterId is required`, `Chapter title must be at least 3 characters`, `Chapter order must be a positive number`, `No valid fields to update`, `Failed to update chapter`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "order": "<order>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/chapters/:chapterId/lectures`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getLectures`
- Path params: `chapterId`
- Query keys: None
- Body keys: None
- Success message examples: `Lectures fetched`
- Error message examples: `Missing teacher uid`, `chapterId is required`, `Failed to fetch lectures`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Lectures fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/teacher/chapters/:chapterId/lectures`
- Auth: Bearer token (teacher or admin)
- Handler(s): `addLecture`
- Path params: `chapterId`
- Query keys: None
- Body keys: `order`
- Error message examples: `Missing teacher uid`, `chapterId is required`, `Lecture title must be at least 3 characters`, `Failed to add lecture`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "order": "<order>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/classes`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getTeacherClasses`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Teacher classes fetched`
- Error message examples: `Missing teacher uid`, `Failed to fetch teacher classes`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Teacher classes fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/courses`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getTeacherCourses`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Courses fetched`, `Teacher assigned courses fetched`
- Error message examples: `Missing teacher uid`, `Failed to fetch teacher courses`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Courses fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/courses/:courseId`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getTeacherCourseById`
- Path params: `courseId`
- Query keys: None
- Body keys: None
- Success message examples: `Teacher course content fetched`
- Error message examples: `Missing teacher uid`, `courseId is required`, `Failed to fetch teacher course`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Teacher course content fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/courses/:courseId/students`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getCourseStudents`
- Path params: `courseId`
- Query keys: None
- Body keys: None
- Success message examples: `Course students fetched`
- Error message examples: `Missing teacher uid`, `courseId is required`, `Failed to fetch course students`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Course students fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/teacher/courses/:courseId/students/:studentId/rewatch-access`
- Auth: Bearer token (teacher or admin)
- Handler(s): `updateCourseRewatchAccess`
- Path params: `courseId`, `studentId`
- Query keys: None
- Body keys: `lockAfterCompletion`, `unlocked`
- Error message examples: `Missing user uid`, `courseId and studentId are required`, `No class enrollment found for this student in the selected course`, `Failed to update rewatch access`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "lockAfterCompletion": "<lockAfterCompletion>",
  "unlocked": "<unlocked>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/teacher/courses/:courseId/students/:studentId/video-access`
- Auth: Bearer token (teacher or admin)
- Handler(s): `updateVideoAccess`
- Path params: `courseId`, `studentId`
- Query keys: None
- Body keys: `lectureAccess`
- Success message examples: `Video access updated successfully`
- Error message examples: `courseId and studentId are required`, `Missing requester uid`, `Only teachers and admins can manage video access`, `lectureAccess array required`, `No valid lectureId provided`, `Failed to update video access`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Video access updated successfully",
  "data": {}
}
```

- Request body sample:

```json
{
  "lectureAccess": "<lectureAccess>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "courseId and studentId are required",
  "error": "courseId and studentId are required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/courses/:courseId/subjects/:subjectId/chapters`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getChapters`
- Path params: `courseId`, `subjectId`
- Query keys: None
- Body keys: None
- Success message examples: `Chapters fetched`
- Error message examples: `Missing teacher uid`, `courseId and subjectId are required`, `Forbidden`, `Failed to fetch chapters`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Chapters fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/teacher/courses/:courseId/subjects/:subjectId/chapters`
- Auth: Bearer token (teacher or admin)
- Handler(s): `addChapterToCourse`
- Path params: `courseId`, `subjectId`
- Query keys: None
- Body keys: `order`, `subjectId`
- Error message examples: `Missing teacher uid`, `courseId and subjectId are required`, `Chapter title must be at least 3 characters`, `Forbidden`, `Failed to add chapter`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "order": "<order>",
  "subjectId": "<subjectId>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/dashboard`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getTeacherDashboard`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Teacher dashboard fetched`
- Error message examples: `Missing teacher uid`, `Failed to fetch teacher dashboard`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Teacher dashboard fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/final-quiz-requests`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getFinalQuizRequests`
- Path params: None
- Query keys: `courseId`, `status`
- Body keys: None
- Success message examples: `Final quiz requests fetched`
- Error message examples: `Missing user uid`, `Failed to fetch final quiz requests`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Final quiz requests fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/teacher/final-quiz-requests/:requestId`
- Auth: Bearer token (teacher or admin)
- Handler(s): `updateFinalQuizRequestStatus`
- Path params: `requestId`
- Query keys: None
- Body keys: `action`, `notes`
- Error message examples: `Missing user uid`, `requestId is required`, `action must be approve, reject or complete`, `Request not found`, `Forbidden`, `Failed to update final quiz request`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "action": "<action>",
  "notes": "<notes>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### DELETE `/api/teacher/lectures/:lectureId`
- Auth: Bearer token (teacher or admin)
- Handler(s): `deleteLecture`
- Path params: `lectureId`
- Query keys: None
- Body keys: None
- Success message examples: `Lecture deleted`
- Error message examples: `Missing teacher uid`, `lectureId is required`, `Failed to delete lecture`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Lecture deleted",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/teacher/lectures/:lectureId`
- Auth: Bearer token (teacher or admin)
- Handler(s): `updateLecture`
- Path params: `lectureId`
- Query keys: None
- Body keys: `title`
- Error message examples: `Missing teacher uid`, `lectureId is required`, `Lecture title must be at least 3 characters`, `Failed to update lecture`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "title": "<title>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/teacher/lectures/:lectureId/content`
- Auth: Bearer token (teacher or admin)
- Handler(s): `saveLectureContent`
- Path params: `lectureId`
- Query keys: None
- Body keys: `duration`, `isLiveSession`, `size`, `title`, `url`, `videoId`, `videoMode`
- Error message examples: `Missing teacher uid`, `lectureId is required`, `type must be video, pdf or book`, `Either videoId or url is required for video content.`, `Content title must be at least 3 characters`, `Content url is required`, `Failed to save lecture content`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "duration": "<duration>",
  "isLiveSession": "<isLiveSession>",
  "size": "<size>",
  "title": "<title>",
  "url": "<url>",
  "videoId": "<videoId>",
  "videoMode": "<videoMode>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### DELETE `/api/teacher/lectures/:lectureId/content/:contentId`
- Auth: Bearer token (teacher or admin)
- Handler(s): `deleteLectureContent`
- Path params: `contentId`, `lectureId`
- Query keys: None
- Body keys: `type`
- Success message examples: `Content removed`
- Error message examples: `Missing teacher uid`, `lectureId is required`, `type must be video, pdf or book`, `Failed to delete lecture content`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Content removed",
  "data": {}
}
```

- Request body sample:

```json
{
  "type": "<type>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/quizzes`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getTeacherQuizzes`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Teacher quizzes fetched`
- Error message examples: `Missing user uid`, `Failed to fetch quizzes`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Teacher quizzes fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/teacher/quizzes`
- Auth: Bearer token (teacher or admin)
- Handler(s): `createTeacherQuiz`
- Path params: None
- Query keys: None
- Body keys: `assignToClassId`, `assignmentTargetType`, `chapterId`, `classId`, `courseId`, `description`, `dueAt`, `isFinalQuiz`, `questions`, `scope`, `subjectId`, `targetType`, `title`
- Error message examples: `Missing user uid`, `scope must be chapter or subject`, `title must be at least 3 characters`, `courseId and subjectId are required`, `chapterId is required for chapter quiz`, `At least one question is required`, `classId is required for class assignment`, `dueAt is required for class assignment`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "assignToClassId": "<assignToClassId>",
  "assignmentTargetType": "<assignmentTargetType>",
  "chapterId": "<chapterId>",
  "classId": "<classId>",
  "courseId": "<courseId>",
  "description": "<description>",
  "dueAt": "<dueAt>",
  "isFinalQuiz": "<isFinalQuiz>",
  "questions": "<questions>",
  "scope": "<scope>",
  "subjectId": "<subjectId>",
  "targetType": "<targetType>",
  "title": "<title>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/quizzes/:quizId`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getTeacherQuizById`
- Path params: `quizId`
- Query keys: None
- Body keys: None
- Success message examples: `Quiz fetched`
- Error message examples: `Missing user uid`, `quizId is required`, `Failed to fetch quiz`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Quiz fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/quizzes/:quizId/analytics`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getQuizAnalytics`
- Path params: `quizId`
- Query keys: None
- Body keys: None
- Error message examples: `Missing user uid`, `quizId is required`, `Failed to fetch quiz analytics`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/teacher/quizzes/:quizId/assign`
- Auth: Bearer token (teacher or admin)
- Handler(s): `assignQuizToStudents`
- Path params: `quizId`
- Query keys: None
- Body keys: `classId`, `courseId`, `dueAt`, `studentIds`, `targetType`
- Error message examples: `Missing user uid`, `quizId is required`, `dueAt is required`, `Invalid dueAt date/time`, `dueAt must be in the future`, `Quiz is missing course/subject linkage`, `Quiz can only be assigned within its own course`, `No students found in this course`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "classId": "<classId>",
  "courseId": "<courseId>",
  "dueAt": "<dueAt>",
  "studentIds": "<studentIds>",
  "targetType": "<targetType>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/teacher/quizzes/:quizId/evaluate`
- Auth: Bearer token (teacher or admin)
- Handler(s): `previewQuizEvaluation`
- Path params: `quizId`
- Query keys: None
- Body keys: `answers`
- Success message examples: `Quiz evaluated`
- Error message examples: `Missing user uid`, `quizId is required`, `Failed to evaluate quiz answers`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Quiz evaluated",
  "data": {}
}
```

- Request body sample:

```json
{
  "answers": "<answers>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/quizzes/:quizId/submissions`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getQuizSubmissions`
- Path params: `quizId`
- Query keys: None
- Body keys: None
- Success message examples: `Quiz submissions fetched`
- Error message examples: `Missing user uid`, `quizId is required`, `Failed to fetch quiz submissions`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Quiz submissions fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/teacher/quizzes/:quizId/submissions`
- Auth: Bearer token (teacher or admin)
- Handler(s): `submitQuizAttempt`
- Path params: `quizId`
- Query keys: None
- Body keys: `answers`
- Error message examples: `Missing student uid`, `quizId is required`, `answers are required`, `Quiz not found`, `You are not enrolled in this quiz course`, `Final quiz is not approved for you yet. Request approval first.`, `This quiz is not assigned to you`, `Quiz deadline has passed`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "answers": "<answers>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/teacher/quizzes/:quizId/submissions/:resultId/grade-short`
- Auth: Bearer token (teacher or admin)
- Handler(s): `gradeShortAnswerSubmission`
- Path params: `quizId`, `resultId`
- Query keys: None
- Body keys: `gradedAnswers`
- Success message examples: `Short answers graded`
- Error message examples: `Missing user uid`, `quizId and resultId are required`, `Result not found`, `Result does not belong to this quiz`, `Failed to grade short answers`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Short answers graded",
  "data": {}
}
```

- Request body sample:

```json
{
  "gradedAnswers": "<gradedAnswers>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/teacher/quizzes/bulk-upload`
- Auth: Bearer token (teacher or admin)
- Handler(s): `bulkUploadTeacherQuiz`
- Path params: None
- Query keys: None
- Body keys: `csvText`
- Success message examples: `Bulk quiz upload completed`
- Error message examples: `Missing user uid`, `CSV file is required`, `CSV header row not found`, `, `, `No question rows found in CSV`, `courseId is required in every row`, `subjectId is required in every row`, `scope must be chapter or subject`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Bulk quiz upload completed",
  "data": {}
}
```

- Request body sample:

```json
{
  "csvText": "<csvText>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/quizzes/template`
- Auth: Bearer token (teacher or admin)
- Handler(s): `downloadQuizBulkTemplate`
- Path params: None
- Query keys: `chapterId`, `chapterName`, `courseId`, `courseName`, `scope`, `subjectId`, `subjectName`
- Body keys: None
- Error message examples: `Missing user uid`, `scope must be chapter or subject`, `courseId and subjectId are required`, `chapterId is required for chapter scope`, `Failed to download template`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/sessions`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getTeacherSessions`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Teacher sessions fetched`
- Error message examples: `Missing teacher uid`, `Failed to fetch teacher sessions`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Teacher sessions fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/teacher/sessions`
- Auth: Bearer token (teacher or admin)
- Handler(s): `createSession`
- Path params: None
- Query keys: None
- Body keys: `classId`, `courseId`, `date`, `description`, `endTime`, `meetingLink`, `notifyStudents`, `platform`, `startTime`, `topic`
- Success message examples: `Session created`
- Error message examples: `Missing teacher uid`, `classId is required`, `topic must be at least 5 characters`, `date is required`, `date must be today or future`, `startTime is required`, `endTime is required`, `endTime must be after startTime`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Session created",
  "data": {}
}
```

- Request body sample:

```json
{
  "classId": "<classId>",
  "courseId": "<courseId>",
  "date": "<date>",
  "description": "<description>",
  "endTime": "<endTime>",
  "meetingLink": "<meetingLink>",
  "notifyStudents": "<notifyStudents>",
  "platform": "<platform>",
  "startTime": "<startTime>",
  "topic": "<topic>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/sessions/:sessionId`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getSessionById`
- Path params: `sessionId`
- Query keys: None
- Body keys: None
- Success message examples: `Session fetched`
- Error message examples: `Missing teacher uid`, `sessionId is required`, `Failed to fetch session`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Session fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/teacher/sessions/:sessionId`
- Auth: Bearer token (teacher or admin)
- Handler(s): `updateSession`
- Path params: `sessionId`
- Query keys: None
- Body keys: `date`, `description`, `endTime`, `meetingLink`, `platform`, `startTime`, `topic`
- Success message examples: `Session updated`
- Error message examples: `Missing teacher uid`, `sessionId is required`, `Cannot edit a completed session`, `Cannot edit a cancelled session`, `topic must be at least 5 characters`, `date is required`, `date must be today or future`, `startTime is required`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Session updated",
  "data": {}
}
```

- Request body sample:

```json
{
  "date": "<date>",
  "description": "<description>",
  "endTime": "<endTime>",
  "meetingLink": "<meetingLink>",
  "platform": "<platform>",
  "startTime": "<startTime>",
  "topic": "<topic>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/sessions/:sessionId/attendance`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getSessionAttendance`
- Path params: `sessionId`
- Query keys: None
- Body keys: None
- Error message examples: `Missing teacher uid`, `sessionId is required`, `Session class is missing`, `Class not found`, `You are not assigned to this class attendance`, `You are not assigned to this course attendance`, `You are not assigned to this subject attendance`, `Failed to fetch session attendance`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/teacher/sessions/:sessionId/attendance`
- Auth: Bearer token (teacher or admin)
- Handler(s): `saveSessionAttendance`
- Path params: `sessionId`
- Query keys: None
- Body keys: `attendance`
- Success message examples: `Attendance saved`
- Error message examples: `Missing teacher uid`, `sessionId is required`, `attendance is required`, `Session class is missing`, `Class not found`, `You are not assigned to this class attendance`, `You are not assigned to this course attendance`, `You are not assigned to this subject attendance`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Attendance saved",
  "data": {}
}
```

- Request body sample:

```json
{
  "attendance": "<attendance>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/teacher/sessions/:sessionId/cancel`
- Auth: Bearer token (teacher or admin)
- Handler(s): `cancelSession`
- Path params: `sessionId`
- Query keys: None
- Body keys: `cancelReason`, `notifyStudents`
- Success message examples: `Session cancelled`
- Error message examples: `Missing teacher uid`, `sessionId is required`, `cancelReason must be at least 10 characters`, `Already cancelled`, `Cannot cancel completed session`, `Failed to cancel session`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Session cancelled",
  "data": {}
}
```

- Request body sample:

```json
{
  "cancelReason": "<cancelReason>",
  "notifyStudents": "<notifyStudents>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/teacher/sessions/:sessionId/complete`
- Auth: Bearer token (teacher or admin)
- Handler(s): `markSessionComplete`
- Path params: `sessionId`
- Query keys: None
- Body keys: `notes`
- Success message examples: `Session marked as complete`
- Error message examples: `Missing teacher uid`, `sessionId is required`, `Cannot complete a cancelled session`, `Failed to complete session`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Session marked as complete",
  "data": {}
}
```

- Request body sample:

```json
{
  "notes": "<notes>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/settings/profile`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getTeacherSettingsProfile`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Teacher profile settings fetched`
- Error message examples: `Missing teacher uid`, `User not found`, `Failed to fetch teacher profile settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Teacher profile settings fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/teacher/settings/profile`
- Auth: Bearer token (teacher or admin)
- Handler(s): `updateTeacherSettingsProfile`
- Path params: None
- Query keys: None
- Body keys: `bio`, `fullName`, `phoneNumber`, `profilePicture`, `subject`
- Success message examples: `Teacher profile settings updated`
- Error message examples: `Missing teacher uid`, `fullName must be at least 2 characters`, `subject cannot exceed 120 characters`, `bio cannot exceed 500 characters`, `phoneNumber must be 03001234567 or +923001234567 format`, `User not found`, `Failed to update teacher profile settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Teacher profile settings updated",
  "data": {}
}
```

- Request body sample:

```json
{
  "bio": "<bio>",
  "fullName": "<fullName>",
  "phoneNumber": "<phoneNumber>",
  "profilePicture": "<profilePicture>",
  "subject": "<subject>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/settings/security`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getTeacherSettingsSecurity`
- Path params: None
- Query keys: None
- Body keys: None
- Error message examples: `Missing teacher uid`, `Failed to fetch teacher security settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/teacher/settings/security/sessions/:sessionDocId/revoke`
- Auth: Bearer token (teacher or admin)
- Handler(s): `revokeTeacherSession`
- Path params: `sessionDocId`
- Query keys: None
- Body keys: None
- Success message examples: `Session revoked successfully`
- Error message examples: `Missing teacher uid`, `sessionDocId is required`, `Session not found`, `Forbidden`, `Session is already revoked`, `Failed to revoke session`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Session revoked successfully",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/teacher/settings/security/sessions/revoke-all`
- Auth: Bearer token (teacher or admin)
- Handler(s): `revokeTeacherOtherSessions`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `No active sessions found`, `No other active sessions found`, `Other sessions revoked successfully`
- Error message examples: `Missing teacher uid`, `Failed to revoke sessions`
- Success JSON sample:

```json
{
  "success": true,
  "message": "No active sessions found",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/students`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getTeacherStudents`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Students fetched`, `Teacher students fetched`
- Error message examples: `Missing teacher uid`, `Failed to fetch teacher students`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Students fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/students/:studentId`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getTeacherStudentById`
- Path params: `studentId`
- Query keys: None
- Body keys: None
- Error message examples: `Missing teacher uid`, `studentId is required`, `Not your student`, `Failed to fetch student profile`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/students/:studentId/attendance/:classId`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getStudentAttendance`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Student attendance fetched`
- Error message examples: `Missing student uid`, `Failed to fetch attendance`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Student attendance fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/students/:studentId/progress/:courseId`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getStudentProgress`
- Path params: `courseId`, `studentId`
- Query keys: None
- Body keys: None
- Error message examples: `Missing teacher uid`, `studentId and courseId are required`, `Student is not enrolled in this course`, `Failed to fetch student progress`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/teacher/students/:studentId/video-access`
- Auth: Bearer token (teacher or admin)
- Handler(s): `updateStudentVideoAccess`
- Path params: `studentId`
- Query keys: None
- Body keys: `lectureAccess`
- Success message examples: `Video access updated`
- Error message examples: `Missing teacher uid`, `studentId is required`, `lectureAccess is required`, `Failed to update student video access`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Video access updated",
  "data": {}
}
```

- Request body sample:

```json
{
  "lectureAccess": "<lectureAccess>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/timetable`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getTeacherTimetable`
- Path params: None
- Query keys: None
- Body keys: None
- Error message examples: `Missing teacher uid`, `Failed to fetch teacher timetable`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/teacher/videos`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getTeacherVideoLibrary`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Video library fetched`
- Error message examples: `Missing user uid`, `Failed to fetch video library`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Video library fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/teacher/videos`
- Auth: Bearer token (teacher or admin)
- Handler(s): `createTeacherVideoLibraryItem`
- Path params: None
- Query keys: None
- Body keys: `courseId`, `courseName`, `isActive`, `isLiveSession`, `teacherId`, `teacherName`, `url`, `videoMode`
- Error message examples: `Missing user uid`, `title must be at least 3 characters`, `url is required`, `courseId is required`, `Course not found`, `You are not assigned to this course`, `Failed to add video to library`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "courseId": "<courseId>",
  "courseName": "<courseName>",
  "isActive": "<isActive>",
  "isLiveSession": "<isLiveSession>",
  "teacherId": "<teacherId>",
  "teacherName": "<teacherName>",
  "url": "<url>",
  "videoMode": "<videoMode>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

## Student (/api/student)

### GET `/api/student/announcements`
- Auth: Bearer token (student)
- Handler(s): `getStudentAnnouncements`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Announcements fetched`
- Error message examples: `Unauthorized`, `Failed to fetch announcements`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Announcements fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Unauthorized",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/student/announcements/:id/read`
- Auth: Bearer token (student)
- Handler(s): `markAnnouncementRead`
- Path params: `id`
- Query keys: None
- Body keys: None
- Success message examples: `Announcement marked as read`
- Error message examples: `Unauthorized`, `Announcement id is required`, `Announcement not found`, `Failed to mark announcement as read`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Announcement marked as read",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Unauthorized",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/student/certificates`
- Auth: Bearer token (student)
- Handler(s): `getStudentCertificates`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Certificates fetched`
- Error message examples: `Missing student uid`, `Failed to fetch certificates`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Certificates fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/student/courses`
- Auth: Bearer token (student)
- Handler(s): `getStudentCourses`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Student courses fetched`
- Error message examples: `Missing student uid`, `Failed to fetch student courses`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Student courses fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/student/courses/:courseId/content`
- Auth: Bearer token (student)
- Handler(s): `getCourseContent`
- Path params: `courseId`
- Query keys: None
- Body keys: None
- Response notes:
- `data.chapters[].quizzes[]` and `data.subjectQuizzes[]` now include `dueAt` and `isExpired`.
- Expired quizzes are returned in content lists with `isLocked: true` and `lockReason: "Quiz deadline has passed."`.
- Error message examples: `courseId is required`, `Missing student uid`, `Failed to fetch course content`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "courseId is required",
  "error": "courseId is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/student/courses/:courseId/final-quiz-request`
- Auth: Bearer token (student)
- Handler(s): `getFinalQuizRequestStatus`
- Path params: `courseId`
- Query keys: None
- Body keys: None
- Success message examples: `No final quiz is configured for this course`, `Final quiz status fetched`
- Error message examples: `Missing student uid`, `courseId is required`, `You are not enrolled in this course`, `Failed to fetch final quiz status`
- Success JSON sample:

```json
{
  "success": true,
  "message": "No final quiz is configured for this course",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/student/courses/:courseId/final-quiz-request`
- Auth: Bearer token (student)
- Handler(s): `requestFinalQuizForCourse`
- Path params: `courseId`
- Query keys: None
- Body keys: `notes`
- Success message examples: `pending`
- Error message examples: `Missing student uid`, `courseId is required`, `You are not enrolled in this course`, `No final quiz is configured for this course`, `Final quiz is already passed for this course`, `A final quiz request is already in progress`, `Complete all course lectures before requesting the final quiz`, `Failed to request final quiz`
- Success JSON sample:

```json
{
  "success": true,
  "message": "pending",
  "data": {}
}
```

- Request body sample:

```json
{
  "notes": "<notes>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/student/courses/:courseId/lectures/:lectureId/complete`
- Auth: Bearer token (student)
- Handler(s): `markLectureComplete`
- Path params: `courseId`, `lectureId`
- Query keys: None
- Body keys: `currentTimeSec`, `duration`, `durationSec`, `watchedPercent`
- Error message examples: `courseId and lectureId are required`, `Missing student uid`, `Course is already completed`, `Lecture not found in this course`, `Complete previous content first`, `Watch at least 80% of the lecture before marking complete`, `Failed to mark complete`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "currentTimeSec": "<currentTimeSec>",
  "duration": "<duration>",
  "durationSec": "<durationSec>",
  "watchedPercent": "<watchedPercent>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "courseId and lectureId are required",
  "error": "courseId and lectureId are required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/student/courses/:courseId/lectures/:lectureId/progress`
- Auth: Bearer token (student)
- Handler(s): `saveWatchProgress`
- Path params: `courseId`, `lectureId`
- Query keys: None
- Body keys: `currentTimeSec`, `duration`, `durationSec`, `watchedPercent`
- Error message examples: `courseId and lectureId are required`, `Missing student uid`, `Lecture not found in this course`, `Complete previous content first`, `Failed to save progress`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "currentTimeSec": "<currentTimeSec>",
  "duration": "<duration>",
  "durationSec": "<durationSec>",
  "watchedPercent": "<watchedPercent>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "courseId and lectureId are required",
  "error": "courseId and lectureId are required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/student/courses/:courseId/progress`
- Auth: Bearer token (student)
- Handler(s): `getStudentCourseProgress`
- Path params: `courseId`, `studentId`
- Query keys: None
- Body keys: None
- Error message examples: `courseId and studentId are required`, `Missing requester uid`, `Only teachers and admins can view student progress`, `Failed to fetch progress`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "courseId and studentId are required",
  "error": "courseId and studentId are required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/student/dashboard`
- Auth: Bearer token (student)
- Handler(s): `getStudentDashboard`
- Path params: None
- Query keys: None
- Body keys: None
- Error message examples: `Missing student uid`, `Failed to fetch student dashboard`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/student/help-support`
- Auth: Bearer token (student)
- Handler(s): `submitHelpSupportMessage`
- Path params: None
- Query keys: None
- Body keys: `category`, `email`, `message`, `name`, `subject`
- Success message examples: `Help support message sent`
- Error message examples: `Missing student uid`, `Subject must be at least 3 characters`, `Message must be at least 10 characters`, `Student email is invalid`, `Support email is not configured`, `Failed to send support message`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Help support message sent",
  "data": {}
}
```

- Request body sample:

```json
{
  "category": "<category>",
  "email": "<email>",
  "message": "<message>",
  "name": "<name>",
  "subject": "<subject>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/student/quizzes`
- Auth: Bearer token (student)
- Handler(s): `getStudentQuizzes`
- Path params: None
- Query keys: None
- Body keys: None
- Response notes:
- `data[]` includes `status`, `dueAt`, and `isPastDue`.
- `status` can now be: `available`, `attempted`, `passed`, `failed`, `expired`.
- Expired quizzes are included in the response (not hidden).
- Success message examples: `Student quizzes fetched`
- Error message examples: `Missing student uid`, `Failed to fetch quizzes`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Student quizzes fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/student/quizzes/:quizId`
- Auth: Bearer token (student)
- Handler(s): `getQuizById`
- Path params: `quizId`
- Query keys: None
- Body keys: None
- Error message examples: `Missing student uid`, `quizId is required`, `Quiz not found`, `You are not enrolled in this quiz course`, `Final quiz is not approved for you yet. Request approval first.`, `This quiz is not assigned to you`, `Quiz deadline has passed`, `Failed to fetch quiz`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/student/quizzes/:quizId/submit`
- Auth: Bearer token (student)
- Handler(s): `submitQuizAttempt`
- Path params: `quizId`
- Query keys: None
- Body keys: `answers`
- Error message examples: `Missing student uid`, `quizId is required`, `answers are required`, `Quiz not found`, `You are not enrolled in this quiz course`, `Final quiz is not approved for you yet. Request approval first.`, `This quiz is not assigned to you`, `Quiz deadline has passed`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "answers": "<answers>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/student/security/violations`
- Auth: Bearer token (student)
- Handler(s): `reportSecurityViolation`
- Path params: None
- Query keys: None
- Body keys: `details`, `page`, `reason`
- Success message examples: `Account deactivated due to repeated security violations`
- Error message examples: `Missing student uid`, `User profile not found`, `Only students can report violations`, `Failed to record security violation`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Account deactivated due to repeated security violations",
  "data": {}
}
```

- Request body sample:

```json
{
  "details": "<details>",
  "page": "<page>",
  "reason": "<reason>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/student/settings`
- Auth: Bearer token (student)
- Handler(s): `getStudentSettings`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Student settings fetched`
- Error message examples: `Missing student uid`, `Student profile not found`, `Failed to fetch student settings`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Student settings fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PUT `/api/student/settings`
- Auth: Bearer token (student)
- Handler(s): `updateStudentSettings`
- Path params: None
- Query keys: None
- Body keys: `address`, `caste`, `district`, `domicile`, `fatherName`, `fatherOccupation`, `fatherPhone`, `fullName`, `phoneNumber`
- Error message examples: `Missing student uid`, `fullName must be at least 2 characters`, `fullName cannot exceed 120 characters`, `phoneNumber must be 03001234567 or +923001234567 format`, `fatherName cannot exceed 120 characters`, `fatherPhone must be 03001234567 or +923001234567 format`, `fatherOccupation cannot exceed 120 characters`, `district cannot exceed 120 characters`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "address": "<address>",
  "caste": "<caste>",
  "district": "<district>",
  "domicile": "<domicile>",
  "fatherName": "<fatherName>",
  "fatherOccupation": "<fatherOccupation>",
  "fatherPhone": "<fatherPhone>",
  "fullName": "<fullName>",
  "phoneNumber": "<phoneNumber>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

## Payments (/api/payments)

### GET `/api/payments/:id/status`
- Auth: Bearer token
- Handler(s): `getPaymentStatus`
- Path params: `id`, `paymentId`
- Query keys: None
- Body keys: None
- Error message examples: `Payment not found`, `Access denied`, `Failed to fetch payment status`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Payment not found",
  "error": "Payment not found",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/payments/:paymentId/receipt`
- Auth: Bearer token
- Handler(s): `uploadPaymentReceipt`
- Path params: `id`, `paymentId`
- Query keys: None
- Body keys: `receiptSize`, `receiptUrl`
- Success message examples: `pending_verification`
- Error message examples: `paymentId is required`, `Payment not found`, `You can upload receipt for your own payment only`, `Payment approvals are blocked after 3 rejected receipts. Contact admin to reset.`, `Unsupported payment method for receipt upload`, `Receipt cannot be uploaded for this payment status`, `Invalid receipt URL`, `No file uploaded`
- Success JSON sample:

```json
{
  "success": true,
  "message": "pending_verification",
  "data": {}
}
```

- Request body sample:

```json
{
  "receiptSize": "<receiptSize>",
  "receiptUrl": "<receiptUrl>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "paymentId is required",
  "error": "paymentId is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/payments/:paymentId/receipt`
- Auth: Bearer token
- Handler(s): `uploadPaymentReceipt`
- Path params: `id`, `paymentId`
- Query keys: None
- Body keys: `receiptSize`, `receiptUrl`
- Success message examples: `pending_verification`
- Error message examples: `paymentId is required`, `Payment not found`, `You can upload receipt for your own payment only`, `Payment approvals are blocked after 3 rejected receipts. Contact admin to reset.`, `Unsupported payment method for receipt upload`, `Receipt cannot be uploaded for this payment status`, `Invalid receipt URL`, `No file uploaded`
- Success JSON sample:

```json
{
  "success": true,
  "message": "pending_verification",
  "data": {}
}
```

- Request body sample:

```json
{
  "receiptSize": "<receiptSize>",
  "receiptUrl": "<receiptUrl>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "paymentId is required",
  "error": "paymentId is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/payments/config`
- Auth: Bearer token
- Handler(s): `getPaymentMethodsConfig`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Payment config fetched`
- Error message examples: `Failed to fetch payment config`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Payment config fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch payment config",
  "error": "Failed to fetch payment config"
}
```

### POST `/api/payments/initiate`
- Auth: Bearer token
- Handler(s): `initiatePayment`
- Path params: None
- Query keys: None
- Body keys: `classId`, `enrollmentType`, `installments`, `method`, `promoCode`, `shiftId`
- Success message examples: `bank_transfer`
- Error message examples: `enrollmentType must be full_class or single_course`, `classId, shiftId and method are required`, `courseId is required for single_course enrollment`, `Invalid payment method`, `Installments must be between 2 and 6`, `Student profile not found`, `Payment requests are blocked after 3 rejected receipts. Contact admin to reset.`, `Class not found`
- Success JSON sample:

```json
{
  "success": true,
  "message": "bank_transfer",
  "data": {}
}
```

- Request body sample:

```json
{
  "classId": "<classId>",
  "enrollmentType": "<enrollmentType>",
  "installments": "<installments>",
  "method": "<method>",
  "promoCode": "<promoCode>",
  "shiftId": "<shiftId>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "enrollmentType must be full_class or single_course",
  "error": "enrollmentType must be full_class or single_course",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### GET `/api/payments/my-installments`
- Auth: Bearer token
- Handler(s): `getMyInstallments`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `My installments fetched`
- Error message examples: `Failed to fetch installments`
- Success JSON sample:

```json
{
  "success": true,
  "message": "My installments fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch installments",
  "error": "Failed to fetch installments"
}
```

### GET `/api/payments/my-payments`
- Auth: Bearer token
- Handler(s): `getMyPayments`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `My payments fetched`
- Error message examples: `Failed to fetch payments`
- Success JSON sample:

```json
{
  "success": true,
  "message": "My payments fetched",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Failed to fetch payments",
  "error": "Failed to fetch payments"
}
```

### POST `/api/payments/validate-promo`
- Auth: Bearer token
- Handler(s): `validatePromoCode`
- Path params: None
- Query keys: None
- Body keys: `courseId`, `studentId`
- Error message examples: `Promo code is required`, `Invalid promo code`, `Promo code is inactive`, `Promo code has expired`, `Promo code usage limit reached`, `Promo code not valid for this course`, `You have already used this promo code`, `Failed to validate promo code`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Request body sample:

```json
{
  "courseId": "<courseId>",
  "studentId": "<studentId>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Promo code is required",
  "error": "Promo code is required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

## Classes Public (/api/classes)

### GET `/api/classes/available`
- Auth: Public
- Handler(s): `classesPublicAvailable`
- Path params: None
- Query keys: None
- Body keys: None
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### GET `/api/classes/catalog`
- Auth: Public
- Handler(s): `classesPublicCatalog`
- Path params: None
- Query keys: None
- Body keys: None
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

## Progress & Access (/api/*)

### GET `/api/courses/:courseId/students/:studentId/progress`
- Auth: Bearer token (teacher or admin)
- Handler(s): `getStudentCourseProgress`
- Path params: `courseId`, `studentId`
- Query keys: None
- Body keys: None
- Error message examples: `courseId and studentId are required`, `Missing requester uid`, `Only teachers and admins can view student progress`, `Failed to fetch progress`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "courseId and studentId are required",
  "error": "courseId and studentId are required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/courses/:courseId/students/:studentId/unlock-all`
- Auth: Bearer token (teacher or admin)
- Handler(s): `unlockAllVideosForStudent`
- Path params: `courseId`, `studentId`
- Query keys: None
- Body keys: None
- Error message examples: `courseId and studentId are required`, `Missing requester uid`, `Only teachers and admins can unlock videos`, `Failed to unlock videos`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "courseId and studentId are required",
  "error": "courseId and studentId are required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### PATCH `/api/courses/:courseId/students/:studentId/video-access`
- Auth: Bearer token (teacher or admin)
- Handler(s): `updateVideoAccess`
- Path params: `courseId`, `studentId`
- Query keys: None
- Body keys: `lectureAccess`
- Success message examples: `Video access updated successfully`
- Error message examples: `courseId and studentId are required`, `Missing requester uid`, `Only teachers and admins can manage video access`, `lectureAccess array required`, `No valid lectureId provided`, `Failed to update video access`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Video access updated successfully",
  "data": {}
}
```

- Request body sample:

```json
{
  "lectureAccess": "<lectureAccess>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "courseId and studentId are required",
  "error": "courseId and studentId are required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

## Uploads (/api/*)

### DELETE `/api/upload/file`
- Auth: Bearer token (admin or teacher)
- Handler(s): `deleteUploadedFile`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `File deleted`
- Error message examples: `filePath required`, `Failed to delete file`
- Success JSON sample:

```json
{
  "success": true,
  "message": "File deleted",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "filePath required",
  "error": "filePath required",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/upload/logo`
- Auth: Bearer token (admin)
- Handler(s): `uploadLogo`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Logo uploaded`
- Error message examples: `No file uploaded`, `Failed to upload logo`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Logo uploaded",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "No file uploaded",
  "error": "No file uploaded",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/upload/pdf`
- Auth: Bearer token (admin or teacher)
- Handler(s): `uploadCoursePDF`
- Path params: None
- Query keys: None
- Body keys: `subjectId`, `type`
- Success message examples: `PDF uploaded`
- Error message examples: `No file uploaded`, `courseId and subjectId are required`, `Failed to upload PDF`
- Success JSON sample:

```json
{
  "success": true,
  "message": "PDF uploaded",
  "data": {}
}
```

- Request body sample:

```json
{
  "subjectId": "<subjectId>",
  "type": "<type>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "No file uploaded",
  "error": "No file uploaded",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/upload/thumbnail`
- Auth: Bearer token (admin or teacher)
- Handler(s): `uploadThumbnail`
- Path params: None
- Query keys: None
- Body keys: None
- Success message examples: `Thumbnail uploaded`
- Error message examples: `No file uploaded`, `Failed to upload thumbnail`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Thumbnail uploaded",
  "data": {}
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "No file uploaded",
  "error": "No file uploaded",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

### POST `/api/upload/video`
- Auth: Bearer token (admin or teacher)
- Handler(s): `uploadCourseVideo`
- Path params: None
- Query keys: None
- Body keys: `subjectId`
- Success message examples: `Video uploaded`
- Error message examples: `No file uploaded`, `courseId and subjectId are required`, `Failed to upload video`
- Success JSON sample:

```json
{
  "success": true,
  "message": "Video uploaded",
  "data": {}
}
```

- Request body sample:

```json
{
  "subjectId": "<subjectId>"
}
```

- Error JSON sample:

```json
{
  "success": false,
  "message": "No file uploaded",
  "error": "No file uploaded",
  "errors": {
    "detail": "See error message examples above"
  }
}
```

## Special Non-Wrapper Responses

### GET `/api/health`

```json
{
  "status": "ok",
  "message": "SUM Academy API healthy",
  "timestamp": "2026-04-07T00:00:00.000Z"
}
```

### GET `/api/test`

```json
{
  "status": "ok",
  "message": "SUM Academy API is running",
  "firebase": "connected ?"
}
```

