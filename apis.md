# SUM Academy API Reference

Last updated: 2026-04-06
Audience: Web + Android developers
Base URL (prod): `https://sumacademy.net/api`
Base URL (local): `http://localhost:5000/api`

---

## 1) Global Response Format

All JSON endpoints use this format (except file downloads like CSV/template):

```json
{
  "success": true,
  "message": "Human readable message",
  "data": {}
}
```

Error format:

```json
{
  "success": false,
  "message": "Error message",
  "error": "Error message",
  "errors": {}
}
```

### Common HTTP Status

- `200` OK
- `201` Created
- `400` Validation or business rule error
- `401` Missing/invalid token
- `403` Permission denied / account blocked / locked flow
- `404` Not found
- `409` Conflict
- `500` Server error

### Common Auth Header

```http
Authorization: Bearer <firebase_id_token>
```

Roles:

- `admin`
- `teacher`
- `student`

---

## 2) High-Value Business Error Codes

Use these codes in Android to show exact messages:

- `ACCESS_DENIED`
- `PENDING_APPROVAL`
- `ACCOUNT_DEACTIVATED`
- `PAYMENT_APPROVAL_BLOCKED`
- `RECEIPT_REQUIRED`
- `RECEIPT_NOT_UPLOADED`
- `CLASS_FULL`
- `ALREADY_ENROLLED`
- `CLASS_NOT_STARTED`
- `CLASS_ENDED`
- `PAYMENT_PENDING`
- `LECTURE_LOCKED`
- `WATCH_REQUIREMENT_NOT_MET`
- `QUIZ_LOCKED`
- `QUIZ_NOT_AVAILABLE`

Error example:

```json
{
  "success": false,
  "message": "Complete previous videos/quizzes to unlock this quiz",
  "error": "Complete previous videos/quizzes to unlock this quiz",
  "errors": {
    "code": "QUIZ_LOCKED",
    "lockReason": "Complete all chapter videos to unlock quiz."
  }
}
```

---

## 3) Public + Common Endpoints

### Health

- `GET /api/health`
- `GET /api/test`

Success sample:

```json
{
  "status": "ok",
  "message": "SUM Academy API healthy",
  "timestamp": "2026-04-06T12:00:00.000Z"
}
```

### Public Explore + Catalog

- `GET /api/courses/explore`
- `GET /api/classes/catalog`
- `GET /api/classes/available?courseId=<optional>`

`/classes/available` item keys:

```json
{
  "id": "classId",
  "name": "Batch A",
  "batchCode": "A-01",
  "description": "Morning batch",
  "teacherName": "Teacher",
  "teacherId": "uid",
  "capacity": 5,
  "enrolledCount": 3,
  "spotsLeft": 2,
  "availableSpots": 2,
  "isFull": false,
  "status": "active",
  "startDate": "...",
  "endDate": "...",
  "assignedCourses": [
    {
      "courseId": "courseId",
      "title": "Math 101",
      "thumbnail": "https://...",
      "price": 10000,
      "originalPrice": 12000,
      "discountPercent": 20,
      "discountedPrice": 9600,
      "subjects": ["Algebra"],
      "teacherName": "Teacher",
      "courseName": "Math 101"
    }
  ],
  "course": {
    "courseId": "courseId",
    "courseName": "Math 101",
    "subjectName": "Algebra"
  },
  "shifts": [
    {
      "id": "shiftId",
      "name": "Morning",
      "days": ["Mon", "Wed"],
      "startTime": "10:00",
      "endTime": "12:00",
      "teacherId": "uid",
      "teacherName": "Teacher",
      "room": "A1",
      "courseId": "courseId",
      "courseName": "Math 101"
    }
  ]
}
```

### Public Settings + Launch + Certificate Verify

- `GET /api/settings`
- `POST /api/launch/notify`
- `POST /api/launch/notify/dispatch`
- `GET /api/verify/:certId`

### Public Contact to Admin Inbox

- `POST /api/contact/messages`

Body:

```json
{
  "name": "Ali",
  "email": "ali@example.com",
  "category": "Contact",
  "subject": "Need help",
  "message": "I need support for enrollment"
}
```

Success:

```json
{
  "success": true,
  "message": "Your message has been sent to support",
  "data": {
    "ticketId": "msgId",
    "submitted": true
  }
}
```

### Authenticated Shared Endpoints

- `POST /api/promo-codes/validate` (requires token)
- `GET /api/announcements/my` (requires token)
- `PATCH /api/announcements/read-all` (requires token)
- `PATCH /api/announcements/:id/read` (requires token)

---

## 4) Auth Endpoints (`/api/auth`)

### OTP + Registration

- `POST /api/auth/register/send-otp`
  - Body: `{ "email": "student@example.com", "fullName": "Student Name" }`
- `POST /api/auth/register/verify-otp`
  - Body: `{ "email": "student@example.com", "otp": "123456" }`
  - Returns `data.otpVerificationToken`
- `POST /api/auth/register`
  - Requires Firebase token middleware
  - Typical body:

```json
{
  "uid": "firebaseUid",
  "email": "student@example.com",
  "fullName": "Student Name",
  "phoneNumber": "03001234567",
  "otpVerificationToken": "token-from-verify-otp"
}
```

### Login + Session

- `POST /api/auth/login` (requires Firebase token middleware)
- `POST /api/auth/logout` (auth)
- `GET /api/auth/me` (auth)

`/auth/me` success `data` keys:

```json
{
  "uid": "uid",
  "email": "user@example.com",
  "role": "student",
  "fullName": "Student",
  "isActive": true,
  "status": "active"
}
```

### Forgot Password

- `POST /api/auth/forgot-password/send-otp`
  - Body: `{ "email": "student@example.com" }`
- `POST /api/auth/forgot-password/verify-otp`
  - Body: `{ "email": "student@example.com", "otp": "123456" }`
- `POST /api/auth/forgot-password/reset`
  - Body:

```json
{
  "email": "student@example.com",
  "otpVerificationToken": "token-from-verify-otp",
  "newPassword": "NewStrongPass123"
}
```

### Admin Role Assignment

- `PATCH /api/auth/set-role` (admin)
  - Body: `{ "uid": "userUid", "role": "admin|teacher|student" }`

---

## 5) Student Endpoints (`/api/student`)

All endpoints below require role `student`.

### Dashboard + Learning

- `GET /api/student/dashboard`
- `GET /api/student/courses`
- `GET /api/student/courses/:courseId/progress`
- `POST /api/student/courses/:courseId/lectures/:lectureId/complete`

### Final Quiz Request

- `GET /api/student/courses/:courseId/final-quiz-request`
- `POST /api/student/courses/:courseId/final-quiz-request`

### Certificates

- `GET /api/student/certificates`

### Quizzes

- `GET /api/student/quizzes`
- `GET /api/student/quizzes/:quizId`
- `POST /api/student/quizzes/:quizId/submit`

Submit body:

```json
{
  "answers": [
    { "questionId": "q1", "answer": "A" },
    { "questionId": "q2", "answer": "True" }
  ]
}
```

Submit success data keys:

```json
{
  "resultId": "resultId",
  "quizId": "quizId",
  "isFinalQuiz": false,
  "autoScore": 8,
  "totalMarks": 10,
  "shortAnswerPending": 0,
  "status": "completed",
  "percentage": 80,
  "isPassed": true,
  "certificateIssued": false,
  "certificatePending": false,
  "certificateBlockedByFinalQuiz": false,
  "classCertificatesIssued": 0,
  "classCertificateBlockedByFinalQuiz": 0,
  "answers": [
    {
      "questionId": "q1",
      "questionType": "mcq",
      "status": "graded",
      "isCorrect": true,
      "marksObtained": 1
    }
  ]
}
```

### Student Announcements

- `GET /api/student/announcements`
- `PATCH /api/student/announcements/:id/read`

### Security + Help

- `POST /api/student/security/violations`
- `POST /api/student/help-support`

`/help-support` body:

```json
{
  "category": "Payment",
  "subject": "Receipt issue",
  "message": "My receipt is uploaded but pending"
}
```

### Student Settings

- `GET /api/student/settings`
- `PUT /api/student/settings`

---

## 6) Sequential Course Progress Endpoints (`/api`)

These are the current Udemy-style locking/unlocking APIs.

### Student Progress APIs

- `GET /api/student/courses/:courseId/content`
- `POST /api/student/courses/:courseId/lectures/:lectureId/complete`
- `PATCH /api/student/courses/:courseId/lectures/:lectureId/progress`

`PATCH .../progress` body:

```json
{ "watchedPercent": 65 }
```

`GET .../content` lecture object includes actual video URL fields:

```json
{
  "lectureId": "lectureId",
  "title": "Lecture 1",
  "videoUrl": "https://...",
  "videoMode": "recorded",
  "isLiveSession": false,
  "videoTitle": "Intro",
  "videoDuration": "10:32",
  "pdfNotes": [],
  "books": [],
  "notes": "...",
  "isCompleted": false,
  "watchedPercent": 35,
  "isLocked": true,
  "lockReason": "Complete the previous lecture first.",
  "manuallyUnlocked": false
}
```

Important:

- First lecture unlocks by default.
- Next lecture unlocks after previous complete.
- Chapter quiz unlocks after all chapter lectures complete.
- Final quiz unlocks after all chapters complete.
- After course completion lectures auto-lock unless manually unlocked.

### Teacher/Admin Progress Control APIs

- `PATCH /api/courses/:courseId/students/:studentId/video-access`
  - Body:

```json
{
  "lectureAccess": [
    { "lectureId": "lec1", "hasAccess": true },
    { "lectureId": "lec2", "hasAccess": false }
  ]
}
```

- `POST /api/courses/:courseId/students/:studentId/unlock-all`
- `GET /api/courses/:courseId/students/:studentId/progress`

---

## 7) Payment APIs

## Student Payment (`/api/payments`)

- `POST /api/payments/initiate`
- `POST /api/payments/validate-promo`
- `GET /api/payments/config`
- `GET /api/payments/:id/status`
- `GET /api/payments/my-payments`
- `GET /api/payments/my-installments`

### Initiate Payment Body

```json
{
  "courseId": "courseId",
  "classId": "classId",
  "shiftId": "shiftId",
  "method": "bank_transfer",
  "promoCode": "SUM10",
  "installments": 1
}
```

Rules:

- `courseId`, `classId`, `shiftId`, `method` required.
- `method` one of: `jazzcash`, `easypaisa`, `bank_transfer`.
- Class seat rules enforced (`CLASS_FULL`).
- Promo expiry + usage limits enforced.
- Student blocked after 3 rejected receipts (`PAYMENT_APPROVAL_BLOCKED`).

Success data keys:

```json
{
  "paymentId": "paymentId",
  "reference": "SUM-XXXX",
  "amount": 5000,
  "totalAmount": 5000,
  "originalAmount": 6000,
  "discount": 1000,
  "courseDiscountPercent": 10,
  "courseDiscountAmount": 600,
  "promoDiscountAmount": 400,
  "method": "bank_transfer",
  "promoCode": "SUM10",
  "paymentDetails": {
    "bankName": "...",
    "accountTitle": "...",
    "accountNumber": "...",
    "iban": "...",
    "instructions": "..."
  },
  "bankDetails": {
    "bankName": "...",
    "accountTitle": "...",
    "accountNumber": "...",
    "iban": "...",
    "instructions": "..."
  },
  "installments": null,
  "isInstallment": false,
  "numberOfInstallments": 1
}
```

## Receipt Upload (Manual Approval Flow)

- `POST /api/payments/:paymentId/receipt`
- `PATCH /api/payments/:paymentId/receipt`

Supports both:

- `multipart/form-data` with file field `file`
- JSON body with direct URL: `{ "receiptUrl": "https://..." }`

Success:

```json
{
  "success": true,
  "message": "Receipt uploaded. Awaiting admin verification.",
  "data": {
    "url": "https://...",
    "paymentId": "paymentId",
    "status": "pending_verification"
  }
}
```

## Admin Payment (`/api/admin`)

- `GET /api/admin/payments`
- `PATCH /api/admin/payments/:paymentId/verify`
- Alias also accepted: `PATCH /api/admin/payments/:id/verify`

Verify body:

```json
{ "action": "approve" }
```

or

```json
{ "action": "reject" }
```

Approve rules:

- Receipt must exist (`RECEIPT_REQUIRED`).
- Payment must have student + course/class data.
- Class capacity checked on approval (`CLASS_FULL`).
- Enrollment created from class-course linkage.
- Promo usage count increments and promo limit is enforced.

Reject rules:

- Increments `paymentRejectCount`.
- At reject limit (default 3), `paymentApprovalBlocked = true`.
- Student cannot initiate/upload again until admin reset endpoint.

Reject success sample:

```json
{
  "success": true,
  "message": "Payment rejected. Student reached reject limit and payment approvals are now blocked.",
  "data": {
    "paymentId": "paymentId",
    "status": "rejected",
    "paymentRejectCount": 3,
    "paymentRejectLimit": 3,
    "paymentApprovalBlocked": true
  }
}
```

### Installments (Admin)

- `GET /api/admin/installments`
- `GET /api/admin/installments/:planId`
- `POST /api/admin/installments`
- `PATCH /api/admin/installments/:planId/:number/pay`
- `PUT /api/admin/installments/:planId/override`
- `POST /api/admin/installments/send-reminders`

---

## 8) Upload APIs (`/api`)

### Upload Endpoints

- `POST /api/upload/thumbnail` (`admin|teacher`, multipart `file`)
- `POST /api/upload/pdf` (`admin|teacher`, multipart `file`, body `courseId`, `subjectId`, optional `type`)
- `POST /api/upload/video` (`admin|teacher`, multipart `file`, body `courseId`, `subjectId`)
- `POST /api/upload/logo` (`admin`, multipart `file`)
- `DELETE /api/upload/file` (`admin|teacher`, body `{ "filePath": "..." }`)

Typical upload success:

```json
{
  "success": true,
  "message": "Video uploaded",
  "data": {
    "url": "https://storage.googleapis.com/...",
    "name": "lecture1.mp4",
    "size": 1234567
  }
}
```

---

## 9) Teacher APIs (`/api/teacher`)

Requires role `teacher` or `admin`.

### Dashboard + Courses + Video Library

- `GET /api/teacher/dashboard`
- `GET /api/teacher/courses`
- `GET /api/teacher/videos`
- `POST /api/teacher/videos`
- `GET /api/teacher/courses/:courseId`

`POST /teacher/videos` body (typical):

```json
{
  "title": "Lecture Source Video",
  "courseId": "courseId",
  "subjectId": "subjectId",
  "videoUrl": "https://...",
  "thumbnail": "https://...",
  "isLiveSession": true,
  "saveToGallery": true
}
```

### Chapters + Lectures + Content

- `GET /api/teacher/courses/:courseId/subjects/:subjectId/chapters`
- `POST /api/teacher/courses/:courseId/subjects/:subjectId/chapters`
- `PUT /api/teacher/chapters/:chapterId`
- `DELETE /api/teacher/chapters/:chapterId`
- `GET /api/teacher/chapters/:chapterId/lectures`
- `POST /api/teacher/chapters/:chapterId/lectures`
- `PUT /api/teacher/lectures/:lectureId`
- `DELETE /api/teacher/lectures/:lectureId`
- `POST /api/teacher/lectures/:lectureId/content`
- `DELETE /api/teacher/lectures/:lectureId/content/:contentId`

### Student Access + Rewatch + Final Quiz Requests

- `GET /api/teacher/courses/:courseId/students`
- `PATCH /api/teacher/courses/:courseId/students/:studentId/video-access`
- `PATCH /api/teacher/courses/:courseId/students/:studentId/rewatch-access`
- `GET /api/teacher/final-quiz-requests`
- `PATCH /api/teacher/final-quiz-requests/:requestId`

### Teacher Student Tools

- `GET /api/teacher/students`
- `GET /api/teacher/students/:studentId`
- `GET /api/teacher/students/:studentId/progress/:courseId`
- `PATCH /api/teacher/students/:studentId/video-access`
- `GET /api/teacher/students/:studentId/attendance/:classId`

### Sessions + Attendance

- `GET /api/teacher/sessions`
- `GET /api/teacher/sessions/:sessionId`
- `POST /api/teacher/sessions`
- `PUT /api/teacher/sessions/:sessionId`
- `PATCH /api/teacher/sessions/:sessionId/cancel`
- `PATCH /api/teacher/sessions/:sessionId/complete`
- `GET /api/teacher/sessions/:sessionId/attendance`
- `POST /api/teacher/sessions/:sessionId/attendance`

### Classes + Timetable + Announcements

- `GET /api/teacher/classes`
- `GET /api/teacher/timetable`
- `GET /api/teacher/announcements`
- `POST /api/teacher/announcements`

`POST /teacher/announcements` body:

```json
{
  "title": "Quiz schedule",
  "message": "Final quiz on Friday",
  "targetType": "course",
  "targetId": "courseId",
  "sendEmail": true,
  "isPinned": false
}
```

### Teacher Quiz Management

- `GET /api/teacher/quizzes/template` (file download)
- `GET /api/teacher/quizzes`
- `GET /api/teacher/quizzes/:quizId`
- `GET /api/teacher/quizzes/:quizId/analytics`
- `POST /api/teacher/quizzes`
- `POST /api/teacher/quizzes/bulk-upload` (multipart `file`)
- `PATCH /api/teacher/quizzes/:quizId/assign`
- `POST /api/teacher/quizzes/:quizId/evaluate`
- `POST /api/teacher/quizzes/:quizId/submissions`
- `GET /api/teacher/quizzes/:quizId/submissions`
- `PATCH /api/teacher/quizzes/:quizId/submissions/:resultId/grade-short`

Assign quiz body:

```json
{
  "targetType": "class",
  "classId": "classId",
  "courseId": "courseId",
  "studentIds": ["uid1", "uid2"],
  "dueAt": "2026-04-10T10:00:00.000Z"
}
```

Analytics/submissions now include not-attempted rows and attempt counters:

```json
{
  "studentId": "uid",
  "status": "attempted",
  "attemptsCount": 2,
  "resultId": "resultId",
  "resultStatus": "completed",
  "objectiveScore": 10,
  "manualScore": 2,
  "totalScore": 12,
  "totalMarks": 15,
  "pendingManualMarks": 0,
  "submittedAt": "2026-04-06T12:00:00.000Z"
}
```

### Teacher Settings

- `GET /api/teacher/settings/profile`
- `PUT /api/teacher/settings/profile`
- `GET /api/teacher/settings/security`
- `PATCH /api/teacher/settings/security/sessions/:sessionDocId/revoke`
- `PATCH /api/teacher/settings/security/sessions/revoke-all`

---

## 10) Admin APIs (`/api/admin`)

Requires role `admin` unless stated.

### Dashboard + Analytics

- `GET /api/admin/stats`
- `GET /api/admin/revenue-chart`
- `GET /api/admin/recent-enrollments`
- `GET /api/admin/top-courses`
- `GET /api/admin/recent-activity`
- `GET /api/admin/analytics-report`

### User Management

- `GET /api/admin/users`
- `GET /api/admin/users/:uid`
- `POST /api/admin/users`
- `PUT /api/admin/users/:uid`
- `DELETE /api/admin/users/:uid`
- `PATCH /api/admin/users/:uid/role`
- `PATCH /api/admin/users/:uid/reset-device`

### Teachers + Students

- `GET /api/admin/teachers`
- `GET /api/admin/teachers/:uid`
- `GET /api/admin/students`
- `GET /api/admin/students/:uid`
- `GET /api/admin/students/:uid/progress`
- `PATCH /api/admin/students/:uid/approve`
- `PATCH /api/admin/students/:uid/reject`
- `GET /api/admin/students/template` (file download)
- `POST /api/admin/students/bulk-upload` (multipart `file`)
- `PATCH /api/admin/students/:uid/payment-rejections/reset`

Reset payment reject lock success:

```json
{
  "success": true,
  "message": "Student payment reject lock has been reset",
  "data": {
    "uid": "studentUid",
    "paymentRejectCount": 0,
    "paymentApprovalBlocked": false
  }
}
```

### Courses + Video Library

- `GET /api/admin/courses`
- `GET /api/admin/videos`
- `POST /api/admin/videos`
- `POST /api/admin/courses`
- `PUT /api/admin/courses/:courseId`
- `PATCH /api/admin/courses/:courseId`
- `DELETE /api/admin/courses/:courseId`
- `POST /api/admin/courses/:courseId/subjects`
- `DELETE /api/admin/courses/:courseId/subjects/:subjectId`
- `POST /api/admin/courses/:courseId/subjects/:subjectId/content`
- `GET /api/admin/courses/:courseId/content`
- `DELETE /api/admin/courses/:courseId/content/:contentId`
- `PATCH /api/admin/courses/:courseId/students/:studentId/rewatch-access`

### Classes + Enrollment

- `GET /api/admin/classes`
- `POST /api/admin/classes`
- `PUT /api/admin/classes/:classId`
- `DELETE /api/admin/classes/:classId`
- `POST /api/admin/classes/:classId/courses`
- `DELETE /api/admin/classes/:classId/courses/:courseId`
- `POST /api/admin/classes/:classId/shifts`
- `PUT /api/admin/classes/:classId/shifts/:shiftId`
- `DELETE /api/admin/classes/:classId/shifts/:shiftId`
- `POST /api/admin/classes/:classId/students` (`admin|student`)
- `GET /api/admin/classes/:classId/students`
- `POST /api/admin/classes/:classId/enroll`
- `DELETE /api/admin/classes/:classId/students/:studentId`

Enroll body:

```json
{
  "studentId": "studentUid",
  "shiftId": "shiftId"
}
```

Enroll success data:

```json
{
  "classId": "classId",
  "className": "Batch A",
  "studentId": "studentUid",
  "coursesEnrolled": 2,
  "remainingCapacity": 1
}
```

Class full error:

```json
{
  "success": false,
  "message": "Class is full. Capacity is 5 students. Currently 5 enrolled.",
  "error": "Class is full. Capacity is 5 students. Currently 5 enrolled.",
  "errors": {
    "code": "CLASS_FULL",
    "capacity": 5,
    "currentCount": 5
  }
}
```

### Admin Quiz Management

- `GET /api/admin/quizzes/template`
- `GET /api/admin/quizzes`
- `GET /api/admin/quizzes/:quizId`
- `GET /api/admin/quizzes/:quizId/analytics`
- `POST /api/admin/quizzes`
- `POST /api/admin/quizzes/bulk-upload`
- `PATCH /api/admin/quizzes/:quizId/assign`
- `GET /api/admin/quizzes/:quizId/submissions`
- `GET /api/admin/final-quiz-requests`
- `PATCH /api/admin/final-quiz-requests/:requestId`

### Admin Payments + Installments

- `GET /api/admin/payments`
- `PATCH /api/admin/payments/:paymentId/verify`
- `PATCH /api/admin/payments/:id/verify` (alias)
- `GET /api/admin/installments`
- `GET /api/admin/installments/:planId`
- `POST /api/admin/installments`
- `PATCH /api/admin/installments/:planId/:number/pay`
- `PUT /api/admin/installments/:planId/override`
- `POST /api/admin/installments/send-reminders`

### Support Inbox (Admin)

- `GET /api/admin/support/messages`
- `PATCH /api/admin/support/messages/:messageId/read`
- `POST /api/admin/support/messages/:messageId/reply`
- `DELETE /api/admin/support/messages/:messageId`

### Promo Codes (Admin)

- `GET /api/admin/promo-codes`
- `POST /api/admin/promo-codes`
- `PUT /api/admin/promo-codes/:codeId`
- `DELETE /api/admin/promo-codes/:codeId`
- `PATCH /api/admin/promo-codes/:codeId/toggle`
- `POST /api/admin/promo-codes/validate`

Promo validation success:

```json
{
  "success": true,
  "message": "Promo code valid",
  "data": {
    "code": "SUM10",
    "discountType": "percent",
    "discountValue": 10,
    "usageLimit": 100,
    "usageCount": 20,
    "remainingUses": 80,
    "originalAmount": 12000,
    "courseDiscountPercent": 20,
    "courseDiscountAmount": 2400,
    "discountAmount": 960,
    "finalAmount": 8640
  }
}
```

### Announcements (Admin)

- `GET /api/admin/announcements`
- `POST /api/admin/announcements`
- `PUT /api/admin/announcements/:id`
- `DELETE /api/admin/announcements/:id`
- `PATCH /api/admin/announcements/:id/pin`

### Certificates (Admin)

- `GET /api/admin/certificates`
- `POST /api/admin/certificates`
- `PATCH /api/admin/certificates/:certId/revoke`
- `PATCH /api/admin/certificates/:certId/unrevoke`

### Settings (Admin)

- `GET /api/admin/settings`
- `PUT /api/admin/settings/general`
- `PUT /api/admin/settings/hero`
- `PUT /api/admin/settings/how-it-works`
- `PUT /api/admin/settings/features`
- `PUT /api/admin/settings/testimonials`
- `PUT /api/admin/settings/about`
- `PUT /api/admin/settings/contact`
- `PUT /api/admin/settings/footer`
- `PUT /api/admin/settings/appearance`
- `PUT /api/admin/settings/certificate`
- `PUT /api/admin/settings/maintenance`
- `PUT /api/admin/settings/email`
- `POST /api/admin/settings/email/test`
- `PUT /api/admin/settings/payment`
- `PUT /api/admin/settings/security`
- `GET /api/admin/settings/templates`
- `PUT /api/admin/settings/templates`

---

## 11) Data Schemas (Most Used)

## Payment Object

```json
{
  "id": "paymentId",
  "studentId": "uid",
  "studentName": "Student",
  "studentEmail": "student@example.com",
  "courseId": "courseId",
  "courseName": "Course",
  "classId": "classId",
  "className": "Batch A",
  "shiftId": "shiftId",
  "method": "bank_transfer",
  "amount": 5000,
  "totalAmount": 5000,
  "originalAmount": 6000,
  "discount": 1000,
  "courseDiscountPercent": 10,
  "courseDiscountAmount": 600,
  "promoDiscountAmount": 400,
  "promoCode": "SUM10",
  "promoCodeId": "promoId",
  "status": "pending_verification",
  "receiptUrl": "https://...",
  "receiptName": "receipt.jpg",
  "receiptSize": 20480,
  "reference": "SUM-XXXX",
  "isInstallment": false,
  "numberOfInstallments": 1,
  "installments": null,
  "verifiedBy": "adminUid",
  "verifiedAt": "2026-04-06T12:00:00.000Z",
  "receiptUploadedAt": "2026-04-06T11:55:00.000Z",
  "createdAt": "2026-04-06T11:50:00.000Z",
  "updatedAt": "2026-04-06T12:00:00.000Z",
  "canApprove": true,
  "isAwaitingReceipt": false
}
```

## Student (Admin listing)

```json
{
  "uid": "studentUid",
  "fullName": "Student",
  "email": "student@example.com",
  "phoneNumber": "03001234567",
  "isActive": true,
  "status": "active",
  "approvalStatus": "approved",
  "enrolledClasses": ["classId"],
  "enrolledClassesCount": 1,
  "enrolledCourses": ["courseId"],
  "avgProgress": 40,
  "completedCourses": 1,
  "securityViolationCount": 0,
  "securityViolationLimit": 3,
  "lastSecurityViolationReason": "",
  "paymentRejectCount": 0,
  "paymentRejectLimit": 3,
  "paymentApprovalBlocked": false
}
```

## Course Content Response (Student)

```json
{
  "courseId": "courseId",
  "courseName": "Course",
  "isCourseCompleted": false,
  "overallProgress": 35,
  "totalLectures": 10,
  "completedLectures": 3,
  "chapters": [
    {
      "chapterId": "chapterId",
      "title": "Chapter 1",
      "allLecturesDone": false,
      "isChapterComplete": false,
      "completedLectures": 1,
      "totalLectures": 3,
      "lectures": [
        {
          "lectureId": "lectureId",
          "title": "Lecture 1",
          "videoUrl": "https://...",
          "videoMode": "recorded",
          "isLiveSession": false,
          "isCompleted": false,
          "watchedPercent": 60,
          "isLocked": false,
          "lockReason": "",
          "manuallyUnlocked": false
        }
      ],
      "quizzes": [
        {
          "quizId": "quizId",
          "title": "Chapter Quiz",
          "scope": "chapter",
          "isLocked": true,
          "lockReason": "Complete all chapter videos to unlock quiz",
          "isAttempted": false,
          "isPassed": false,
          "result": null
        }
      ]
    }
  ],
  "subjectQuizzes": []
}
```

---

## 12) Android Integration Notes

1. Always read:
   - `response.data.success`
   - `response.data.message`
   - `response.data.data`
   - on error: `response.data.errors.code`

2. Manual payment flow:
   - `POST /api/payments/initiate`
   - upload receipt `POST/PATCH /api/payments/:paymentId/receipt`
   - wait `pending_verification`
   - admin verifies `PATCH /api/admin/payments/:paymentId/verify`

3. Payment reject lock behavior:
   - after 3 rejections student is blocked (`PAYMENT_APPROVAL_BLOCKED`)
   - admin must reset using:
     - `PATCH /api/admin/students/:uid/payment-rejections/reset`

4. Quiz lock behavior:
   - quiz APIs return `QUIZ_LOCKED`/`QUIZ_NOT_AVAILABLE`
   - UI must block attempt and show `lockReason`

5. Lecture video URL for player:
   - use `GET /api/student/courses/:courseId/content`
   - each lecture includes `videoUrl`

---

## 13) Quick Success + Error Samples

### Generic Success

```json
{
  "success": true,
  "message": "Data fetched",
  "data": []
}
```

### Access Denied

```json
{
  "success": false,
  "message": "Access denied",
  "code": "ACCESS_DENIED",
  "requiredRoles": ["admin"],
  "actualRole": "student"
}
```

### Pending Approval

```json
{
  "success": false,
  "message": "Your account is pending admin approval. Please wait for activation.",
  "code": "PENDING_APPROVAL"
}
```

### Payment Blocked After 3 Rejections

```json
{
  "success": false,
  "message": "Payment requests are blocked after 3 rejected receipts. Contact admin to reset.",
  "error": "Payment requests are blocked after 3 rejected receipts. Contact admin to reset.",
  "errors": {
    "code": "PAYMENT_APPROVAL_BLOCKED",
    "rejectCount": 3,
    "rejectLimit": 3
  }
}
```
