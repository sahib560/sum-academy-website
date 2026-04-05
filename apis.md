# SUM Academy API Documentation (Updated 2026-04-05)

This file is for Web + Android integration.
All endpoints return JSON using this envelope unless file/blob download:

```json
{
  "success": true,
  "message": "Human readable message",
  "data": {}
}
```

Error envelope:

```json
{
  "success": false,
  "message": "Error message",
  "error": "Error message",
  "errors": {}
}
```

## Base URL

- Production: `https://sumacademy.net/api`
- Local: `http://localhost:5000/api`

## Auth

- Header: `Authorization: Bearer <firebase_id_token>`
- Roles: `admin`, `teacher`, `student`

## Common Status Codes

- `200` OK
- `201` Created
- `400` Validation/business error
- `401` Missing/invalid token
- `403` Access denied / blocked
- `404` Not found
- `409` Conflict
- `500` Server error

---

## 1) Health + Public

### GET `/health`
- Auth: none
- Success `200`: API health check

```json
{
  "status": "ok",
  "message": "SUM Academy API healthy",
  "timestamp": "2026-04-05T18:00:00.000Z"
}
```

### GET `/test`
- Auth: none
- Success `200`: Firebase connectivity test

### POST `/contact/messages`
- Auth: none
- Body keys:
  - `fullName` string
  - `email` string
  - `subject` string
  - `message` string
- Success `200`: message stored and forwarded to admin inbox

### GET `/courses/explore`
- Auth: none
- Success `200`: public explore cards

### GET `/classes/catalog`
- Auth: none
- Success `200`
- `data[]` keys:
  - `id`, `title`, `category`, `level`
  - `price`, `originalPrice`, `discount`
  - `rating`, `reviews`, `students`
  - `teacher`, `description`, `subjectsCount`

### GET `/classes/available`
- Auth: none
- Query optional: `courseId`
- Success `200`
- `data[]` keys:
  - `id`, `name`, `batchCode`, `description`
  - `teacherName`, `teacherId`
  - `capacity`, `enrolledCount`, `spotsLeft`, `availableSpots`, `isFull`
  - `status`, `startDate`, `endDate`
  - `assignedCourses[]`:
    - `courseId`, `title`, `thumbnail`
    - `price`, `originalPrice`, `discountPercent`, `discountedPrice`
    - `subjects[]`, `teacherName`, `courseName`
  - `course` (selected course object)
  - `shifts[]`:
    - `id`, `name`, `days[]`, `startTime`, `endTime`
    - `teacherId`, `teacherName`, `room`, `courseId`, `courseName`

### GET `/settings`
- Auth: none
- Success `200`: public site settings used by web/android splash and branding

### POST `/launch/notify`
- Auth: none
- Success `200`: launch waitlist subscription

### POST `/launch/notify/dispatch`
- Auth: none/internal usage

### GET `/verify/:certId`
- Auth: none
- Success `200`: certificate verification details

### Announcements public-user routes
- `GET /announcements/my` (auth required)
- `PATCH /announcements/read-all` (auth required)
- `PATCH /announcements/:id/read` (auth required)

### Promo validation (global)
- `POST /promo-codes/validate` (auth required)

---

## 2) Auth APIs (`/auth`)

### POST `/auth/register/send-otp`
Body:
```json
{ "email": "student@example.com" }
```

### POST `/auth/register/verify-otp`
Body:
```json
{ "email": "student@example.com", "otp": "123456" }
```

### POST `/auth/register`
- Middleware verifies Firebase token + device.
- Creates user profile based on role flow.

### POST `/auth/login`
- Middleware verifies Firebase token + device.
- Returns app session profile and role.

### POST `/auth/forgot-password/send-otp`
### POST `/auth/forgot-password/verify-otp`
### POST `/auth/forgot-password/reset`

### POST `/auth/logout`
- Auth required

### GET `/auth/me`
- Auth required
- Returns `uid`, `email`, `role`, active/session metadata

### PATCH `/auth/set-role`
- Admin only

---

## 3) Payment APIs

## Student payment routes (`/payments`)

### POST `/payments/initiate`
- Auth: student
- Body keys:
  - `courseId` string
  - `classId` string (required)
  - `shiftId` string (required)
  - `method` enum: `jazzcash | easypaisa | bank_transfer`
  - `promoCode` optional
  - `installments` optional number
- Success `201` `data` keys:
  - `paymentId`, `reference`
  - `amount`, `totalAmount`, `originalAmount`
  - `discount`, `courseDiscountPercent`, `courseDiscountAmount`, `promoDiscountAmount`
  - `method`, `promoCode`
  - `paymentDetails`, `bankDetails`
  - `installments[]`, `isInstallment`, `numberOfInstallments`

Payment lock behavior:
- If student has 3 rejected receipts and lock is active:
  - `403` with `code: "PAYMENT_APPROVAL_BLOCKED"`

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

### POST `/payments/validate-promo`
- Auth: student
- Body: `code`, `courseId`

### GET `/payments/config`
- Auth: student
- Payment method availability + instructions

### GET `/payments/:id/status`
- Auth: owner student or admin

### GET `/payments/my-payments`
- Auth: student
- `data[]` keys:
  - `id`, `studentId`, `studentName`, `studentEmail`
  - `courseId`, `courseName`, `classId`, `className`, `shiftId`
  - `method`, `amount`, `totalAmount`, `originalAmount`
  - `discount`, `courseDiscountPercent`, `courseDiscountAmount`, `promoDiscountAmount`
  - `status`, `receiptUrl`, `reference`, `promoCode`
  - `isInstallment`, `numberOfInstallments`, `installments`
  - `createdAt`, `updatedAt`, `verifiedAt`, `receiptUploadedAt`
  - `canApprove`, `isAwaitingReceipt`

### GET `/payments/my-installments`
- Auth: student

## Receipt upload (manual payment proof)

### POST `/payments/:paymentId/receipt`
### PATCH `/payments/:paymentId/receipt`
- Auth: owner student (or admin)
- Supports:
  - Multipart file field `file`
  - OR JSON body `receiptUrl`
- On success status becomes `pending_verification`
- Success message: `"Receipt uploaded. Awaiting admin verification."`

Blocked student response (3 rejects):
- `403` with `code: "PAYMENT_APPROVAL_BLOCKED"`

## Admin payment routes (`/admin`)

### GET `/admin/payments`
- Auth: admin
- Full merged payment list for dashboard.

### PATCH `/admin/payments/:id/verify`
### PATCH `/admin/payments/:paymentId/verify`
- Auth: admin
- Body:
```json
{ "action": "approve" }
```
or
```json
{ "action": "reject" }
```

Approve behavior:
- Manual verify flow (receipt-based)
- Accepts status `pending` or `pending_verification` when receipt exists.
- Enrolls student, updates class/courses counts, promo usage handling.

Reject behavior:
- Marks payment rejected.
- Increments student `paymentRejectCount`.
- If count reaches limit (default 3):
  - `paymentApprovalBlocked: true`
  - future payment initiate/receipt upload blocked until admin reset.

Success reject sample:
```json
{
  "success": true,
  "message": "Payment rejected. Student reached reject limit and payment approvals are now blocked.",
  "data": {
    "paymentId": "abc123",
    "status": "rejected",
    "paymentRejectCount": 3,
    "paymentRejectLimit": 3,
    "paymentApprovalBlocked": true
  }
}
```

Common verify errors:
- `400` `RECEIPT_REQUIRED`
- `400` `COURSE_OR_CLASS_REQUIRED`
- `400` `STUDENT_REQUIRED`
- `400` `CLASS_FULL`
- `400` `PROMO_LIMIT_REACHED`

## Installments admin

### GET `/admin/installments`
### GET `/admin/installments/:planId`
### POST `/admin/installments`
### PATCH `/admin/installments/:planId/:number/pay`
### POST `/admin/installments/send-reminders`
### PUT `/admin/installments/:planId/override`

---

## 4) Upload APIs

### POST `/upload/thumbnail` (admin/teacher)
### POST `/upload/pdf` (admin/teacher)
### POST `/upload/video` (admin/teacher)
### POST `/upload/logo` (admin only)
### DELETE `/upload/file` (admin/teacher)

All upload success responses return URL and metadata in `data`.

---

## 5) Student APIs (`/student`)

All routes require student role.

- `GET /student/dashboard`
- `GET /student/courses`
- `GET /student/courses/:courseId/progress`
- `GET /student/courses/:courseId/final-quiz-request`
- `POST /student/courses/:courseId/final-quiz-request`
- `POST /student/courses/:courseId/lectures/:lectureId/complete`
- `GET /student/certificates`
- `GET /student/quizzes`
- `GET /student/quizzes/:quizId`
- `POST /student/quizzes/:quizId/submit`
- `GET /student/announcements`
- `PATCH /student/announcements/:id/read`
- `POST /student/security/violations`
- `POST /student/help-support`
- `GET /student/settings`
- `PUT /student/settings`

Typical student course item keys:
- `courseId`, `courseName`, `classId`, `className`
- `progress`, `lecturesCompleted`, `totalLectures`
- `hasVideoAccess`, `hasRewatchAccess`, `isLocked`

---

## 6) Teacher APIs (`/teacher`)

All routes require `teacher` or `admin`.

### Dashboard/Courses
- `GET /teacher/dashboard`
- `GET /teacher/courses`
- `GET /teacher/videos`
- `GET /teacher/courses/:courseId`

### Chapters/Lectures
- `GET /teacher/courses/:courseId/subjects/:subjectId/chapters`
- `POST /teacher/courses/:courseId/subjects/:subjectId/chapters`
- `PUT /teacher/chapters/:chapterId`
- `DELETE /teacher/chapters/:chapterId`
- `GET /teacher/chapters/:chapterId/lectures`
- `POST /teacher/chapters/:chapterId/lectures`
- `PUT /teacher/lectures/:lectureId`
- `DELETE /teacher/lectures/:lectureId`
- `POST /teacher/lectures/:lectureId/content`
- `DELETE /teacher/lectures/:lectureId/content/:contentId`

### Student access/final quiz
- `GET /teacher/courses/:courseId/students`
- `PATCH /teacher/courses/:courseId/students/:studentId/video-access`
- `PATCH /teacher/courses/:courseId/students/:studentId/rewatch-access`
- `GET /teacher/final-quiz-requests`
- `PATCH /teacher/final-quiz-requests/:requestId`

### Teacher student tools
- `GET /teacher/students`
- `GET /teacher/students/:studentId`
- `GET /teacher/students/:studentId/progress/:courseId`
- `PATCH /teacher/students/:studentId/video-access`
- `GET /teacher/students/:studentId/attendance/:classId`

### Sessions
- `GET /teacher/sessions`
- `GET /teacher/sessions/:sessionId`
- `POST /teacher/sessions`
- `PUT /teacher/sessions/:sessionId`
- `PATCH /teacher/sessions/:sessionId/cancel`
- `PATCH /teacher/sessions/:sessionId/complete`
- `GET /teacher/sessions/:sessionId/attendance`
- `POST /teacher/sessions/:sessionId/attendance`

### Quizzes
- `GET /teacher/quizzes/template`
- `GET /teacher/quizzes`
- `GET /teacher/quizzes/:quizId`
- `GET /teacher/quizzes/:quizId/analytics`
- `POST /teacher/quizzes`
- `POST /teacher/quizzes/bulk-upload`
- `PATCH /teacher/quizzes/:quizId/assign`
- `POST /teacher/quizzes/:quizId/evaluate`
- `POST /teacher/quizzes/:quizId/submissions`
- `GET /teacher/quizzes/:quizId/submissions`
- `PATCH /teacher/quizzes/:quizId/submissions/:resultId/grade-short`

### Teacher settings
- `GET /teacher/settings/profile`
- `PUT /teacher/settings/profile`
- `GET /teacher/settings/security`
- `PATCH /teacher/settings/security/sessions/:sessionDocId/revoke`
- `PATCH /teacher/settings/security/sessions/revoke-all`

---

## 7) Admin APIs (`/admin`)

All routes require admin unless noted.

## Analytics
- `GET /admin/stats`
- `GET /admin/revenue-chart`
- `GET /admin/recent-enrollments`
- `GET /admin/top-courses`
- `GET /admin/recent-activity`
- `GET /admin/analytics-report`

## Users
- `GET /admin/users`
- `GET /admin/users/:uid`
- `POST /admin/users`
- `PUT /admin/users/:uid`
- `DELETE /admin/users/:uid`
- `PATCH /admin/users/:uid/role`
- `PATCH /admin/users/:uid/reset-device`

## Teachers + Students
- `GET /admin/teachers`
- `GET /admin/teachers/:uid`
- `GET /admin/students`
- `GET /admin/students/:uid`
- `GET /admin/students/:uid/progress`
- `PATCH /admin/students/:uid/approve`
- `PATCH /admin/students/:uid/reject`
- `GET /admin/students/template`
- `POST /admin/students/bulk-upload` (multipart `file`)

### New: reset student payment rejection lock
- `PATCH /admin/students/:uid/payment-rejections/reset`
- Body: none
- Success:
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

## Courses + Video Library
- `GET /admin/courses`
- `GET /admin/videos`
- `POST /admin/videos`
- `POST /admin/courses`
- `PUT /admin/courses/:courseId`
- `PATCH /admin/courses/:courseId`
- `DELETE /admin/courses/:courseId`
- `POST /admin/courses/:courseId/subjects`
- `DELETE /admin/courses/:courseId/subjects/:subjectId`
- `POST /admin/courses/:courseId/subjects/:subjectId/content`
- `GET /admin/courses/:courseId/content`
- `DELETE /admin/courses/:courseId/content/:contentId`
- `PATCH /admin/courses/:courseId/students/:studentId/rewatch-access`

## Classes
- `GET /admin/classes`
- `POST /admin/classes`
- `PUT /admin/classes/:classId`
- `DELETE /admin/classes/:classId`
- `POST /admin/classes/:classId/courses`
- `DELETE /admin/classes/:classId/courses/:courseId`
- `POST /admin/classes/:classId/shifts`
- `PUT /admin/classes/:classId/shifts/:shiftId`
- `DELETE /admin/classes/:classId/shifts/:shiftId`
- `POST /admin/classes/:classId/students` (admin or student)
- `GET /admin/classes/:classId/students`
- `POST /admin/classes/:classId/enroll`
- `DELETE /admin/classes/:classId/students/:studentId`

## Quizzes (admin)
- `GET /admin/quizzes/template`
- `GET /admin/quizzes`
- `GET /admin/quizzes/:quizId`
- `GET /admin/quizzes/:quizId/analytics`
- `POST /admin/quizzes`
- `POST /admin/quizzes/bulk-upload`
- `PATCH /admin/quizzes/:quizId/assign`
- `GET /admin/quizzes/:quizId/submissions`
- `GET /admin/final-quiz-requests`
- `PATCH /admin/final-quiz-requests/:requestId`

## Payments + Installments (admin)
- `GET /admin/payments`
- `PATCH /admin/payments/:paymentId/verify`
- `GET /admin/installments`
- `POST /admin/installments`
- `POST /admin/installments/send-reminders`
- `PATCH /admin/installments/:planId/:number/pay`

## Support inbox
- `GET /admin/support/messages`
- `PATCH /admin/support/messages/:messageId/read`
- `POST /admin/support/messages/:messageId/reply`
- `DELETE /admin/support/messages/:messageId`

## Promo codes
- `GET /admin/promo-codes`
- `POST /admin/promo-codes`
- `PUT /admin/promo-codes/:codeId`
- `DELETE /admin/promo-codes/:codeId`
- `PATCH /admin/promo-codes/:codeId/toggle`
- `POST /admin/promo-codes/validate`

## Admin announcements
- `GET /admin/announcements`
- `POST /admin/announcements`
- `PUT /admin/announcements/:id`
- `DELETE /admin/announcements/:id`
- `PATCH /admin/announcements/:id/pin`

## Admin certificates
- `GET /admin/certificates`
- `POST /admin/certificates`
- `PATCH /admin/certificates/:certId/revoke`
- `PATCH /admin/certificates/:certId/unrevoke`

## Admin settings
- `GET /admin/settings`
- `PUT /admin/settings/general`
- `PUT /admin/settings/hero`
- `PUT /admin/settings/how-it-works`
- `PUT /admin/settings/features`
- `PUT /admin/settings/testimonials`
- `PUT /admin/settings/about`
- `PUT /admin/settings/contact`
- `PUT /admin/settings/footer`
- `PUT /admin/settings/appearance`
- `PUT /admin/settings/certificate`
- `PUT /admin/settings/maintenance`
- `PUT /admin/settings/email`
- `POST /admin/settings/email/test`
- `PUT /admin/settings/payment`
- `PUT /admin/settings/security`
- `GET /admin/settings/templates`
- `PUT /admin/settings/templates`

---

## 8) Data Key Reference (major objects)

## Student object (admin list)
- `uid`, `fullName`, `email`, `phoneNumber`
- `isActive`, `status`, `approvalStatus`
- `enrolledClasses[]`, `enrolledClassesCount`
- `enrolledCourses[]`:
  - `id`, `courseId`, `classId`, `classIds[]`, `courseName`, `enrolledAt`, `completedAt`, `progress`
- `avgProgress`, `completedCourses`
- Security:
  - `securityViolationCount`, `securityViolationLimit`
  - `lastSecurityViolationReason`, `lastSecurityViolationAt`
  - `securityDeactivatedAt`, `securityDeactivationReason`
  - `recentSecurityViolations[]`
- Payment reject lock:
  - `paymentRejectCount`, `paymentRejectLimit`
  - `paymentApprovalBlocked`, `paymentApprovalBlockedAt`
  - `paymentApprovalBlockedBy`, `paymentApprovalBlockReason`
  - `paymentRejectResetAt`, `paymentRejectResetBy`

## Payment object
- `id`, `studentId`, `studentName`, `studentEmail`
- `courseId`, `courseName`, `classId`, `className`, `shiftId`
- `method`, `amount`, `totalAmount`, `originalAmount`
- `discount`, `courseDiscountPercent`, `courseDiscountAmount`, `promoDiscountAmount`
- `promoCode`, `promoCodeId`
- `status`, `receiptUrl`, `receiptName`, `receiptSize`
- `reference`, `isInstallment`, `numberOfInstallments`, `installments[]`
- `verifiedBy`, `verifiedAt`, `receiptUploadedAt`, `createdAt`, `updatedAt`
- Dashboard helpers: `canApprove`, `isAwaitingReceipt`

## Class object
- `id`, `name`, `batchCode`, `description`
- `teacherId`, `teacherName`
- `startDate`, `endDate`, `status`
- `capacity`, `enrolledCount`
- `students[]`, `assignedCourses[]`, `shifts[]`

## Course object
- `id`, `title`, `description`, `shortDescription`
- `category`, `level`, `teacherId`, `teacherName`
- `price`, `discountPercent`
- `thumbnail`, `subjects[]`, `enrollmentCount`
- `status`, `createdAt`, `updatedAt`

---

## 9) Android Integration Notes

1. Always parse both:
   - `response.data.data` (payload)
   - `response.data.message` (user-friendly text)

2. Handle these payment lock errors:
   - `PAYMENT_APPROVAL_BLOCKED`
   - show message and hide submit/upload actions

3. Manual payment flow (current):
   - initiate payment
   - upload receipt (`/payments/:paymentId/receipt`)
   - wait `pending_verification`
   - admin verifies manually (`/admin/payments/:id/verify`)

4. Payment rejection lock:
   - on 3 rejects student gets blocked from new requests
   - only admin reset endpoint can unblock

---

## 10) Quick Success/Error Samples

### Success sample
```json
{
  "success": true,
  "message": "Students fetched",
  "data": []
}
```

### Validation error sample
```json
{
  "success": false,
  "message": "action must be approve or reject",
  "error": "action must be approve or reject"
}
```

### Access denied sample
```json
{
  "success": false,
  "message": "Access denied",
  "code": "ACCESS_DENIED",
  "requiredRoles": ["admin"],
  "actualRole": "student"
}
```
