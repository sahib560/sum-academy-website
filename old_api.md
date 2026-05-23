# Legacy API Endpoints for Website Developer

This document contains a comprehensive list of all API endpoints currently used by the Sum-Academy Android application. 
The website developer can use this reference to ensure all equivalent endpoints are updated, backward-compatible, or migrated appropriately.

**Base URL:** `https://sumacademy.net/api`

## 1. Auth & Verification
- `/auth/register/send-otp`
- `/auth/register/verify-otp`
- `/verify/$certId`

## 2. General / App Configuration
- `/settings`
- `/classes/available`

## 3. Payments & Promotions
- `/payments/config`
- `/payments/initiate`
- `/payments/my-installments`
- `/payments/my-payments`
- `/payments/$paymentId/receipt`
- `/payments/validate-promo`
- `/promo-codes/validate`

## 4. Student Module
### Dashboard & General
- `/student/dashboard`
- `/student/settings`
- `/student/certificates`

### Announcements
- `/student/announcements`
- `/student/announcements/$id/read`

### Courses & Progress
- `/student/courses`
- `/student/courses/$courseId/progress`

### Quizzes
- `/student/quizzes`
- `/student/quizzes/$quizId`
- `/student/quizzes/$quizId/submit`

### Tests
- `/student/tests`
- `/student/tests/$testId`
- `/student/tests/$testId/start`
- `/student/tests/$testId/submit`
- `/student/tests/$testId/finish`
- `/student/tests/$testId/ranking`

### Live Sessions
- `/student/live-sessions`
- `/student/live-sessions/$sessionId/join`
- `/student/live-sessions/$sessionId/leave`
- `/student/live-sessions/$sessionId/status`
- `/student/live-sessions/$sessionId/sync`
- `/student/live-sessions/$sessionId/violation`
- `/student/sessions/$sessionId`
- `/student/sessions/$sessionId/join`
- `/student/sessions/$sessionId/leave`
- `/student/sessions/$sessionId/status`
- `/student/sessions/$sessionId/sync`
- `/student/sessions/$sessionId/violation`

## 5. Admin Module
### Dashboard & Settings
- `/admin/stats`
- `/admin/recent-activity`
- `/admin/settings/maintenance`

### User Management
- `/admin/users`
- `/admin/users/$uid`
- `/admin/users/$userId`
- `/admin/users/$uid/role`
- `/admin/users/$uid/reset-device`

### Student & Teacher Management
- `/admin/students`
- `/admin/students/$studentId`
- `/admin/students/$studentId/progress`
- `/admin/teachers`
- `/admin/teachers/$teacherId`

### Announcements
- `/admin/announcements`
- `/admin/announcements/$id`
- `/admin/announcements/$id/pin`

### Classes & Shifts
- `/admin/classes`
- `/admin/classes/$classId`
- `/admin/classes/$classId/enroll`
- `/admin/classes/$classId/students`
- `/admin/classes/$classId/students/$studentId`
- `/admin/classes/$classId/courses`
- `/admin/classes/$classId/courses/$courseId`
- `/admin/classes/$classId/shifts`
- `/admin/classes/$classId/shifts/$shiftId`

### Courses
- `/admin/courses`
- `/admin/courses/$courseId`
- `/admin/courses/$courseId/content`
- `/admin/courses/$courseId/subjects`
- `/admin/courses/$courseId/subjects/$subjectId`

### Payments & Installments
- `/admin/payments`
- `/admin/payments/$paymentId/verify`
- `/admin/installments`
- `/admin/installments/$planId`
- `/admin/installments/$planId/$number/pay`
- `/admin/installments/send-reminders`

---
*Note: Variables starting with `$` (like `$testId`, `$uid`, `$classId`) represent dynamic URL path parameters used throughout the app.*
