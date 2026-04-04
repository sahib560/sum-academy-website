# SUM Academy API Reference

Last updated: 2026-04-04

## Base URL
- `https://sumacademy.net`
- Local: `http://localhost:5000`

## Auth and Headers
- Auth header for protected APIs: `Authorization: Bearer <firebase_id_token>`
- Optional device/security headers (recommended for login/register/me):
  - `x-device-fingerprint`
  - `x-screen-resolution`
  - `x-platform`

## Standard Response Shape
### Success
```json
{
  "success": true,
  "message": "Success message",
  "data": {}
}
```

### Error
```json
{
  "success": false,
  "message": "Human readable error",
  "error": "Human readable error",
  "errors": {
    "code": "OPTIONAL_MACHINE_CODE"
  }
}
```

## Role Enforcement (Important Android/Admin Fix)
Role checks are now normalized (`trim + lowercase`) before access control.

Example denied payload now includes debug keys:
```json
{
  "success": false,
  "message": "Access denied",
  "code": "ACCESS_DENIED",
  "requiredRoles": ["admin"],
  "actualRole": "student"
}
```

## Common Error Codes
- `ACCESS_DENIED`
- `PENDING_APPROVAL`
- `ACCOUNT_DEACTIVATED`
- `DEVICE_MISMATCH`
- `CLASS_FULL`
- `ALREADY_ENROLLED`
- `INCOMPLETE_COURSE`
- `FIREBASE_CREDENTIALS_ERROR`

## Public APIs

### System
| Method | Path | Auth | Request keys | Success `data` keys |
|---|---|---|---|---|
| GET | `/api/health` | No | - | `status`, `message`, `timestamp` |
| GET | `/api/test` | No | - | `status`, `message`, `firebase` |

### Courses/Classes (Public)
| Method | Path | Auth | Query keys | Success `data` keys |
|---|---|---|---|---|
| GET | `/api/courses/explore` | No | `category`, `level`, `search` | array of course cards, enrollment hint flags |
| GET | `/api/classes/catalog` | No | - | array: `id`, `title`, `category`, `level`, `price`, `originalPrice`, `discount`, `rating`, `reviews`, `students`, `teacher`, `description`, `subjectsCount` |
| GET | `/api/classes/available` | No | `courseId` (optional) | array: `id`, `name`, `batchCode`, `description`, `teacherName`, `teacherId`, `capacity`, `enrolledCount`, `spotsLeft`, `availableSpots`, `isFull`, `status`, `startDate`, `endDate`, `assignedCourses[]`, `course`, `shifts[]` |

### Settings (Public)
| Method | Path | Auth | Body keys | Success `data` keys |
|---|---|---|---|---|
| GET | `/api/settings` | No | - | full `siteSettings` document sections |
| POST | `/api/launch/notify` | No | `email` | `status` (`pending`/`sent`) |
| POST | `/api/launch/notify/dispatch` | No | - | `sentCount` |

### Certificates (Public)
| Method | Path | Auth | Params | Success `data` keys |
|---|---|---|---|---|
| GET | `/api/verify/:certId` | No | `certId` | certificate record with verification metadata |

### Announcements (User-level)
| Method | Path | Auth | Request keys | Success `data` keys |
|---|---|---|---|---|
| GET | `/api/announcements/my` | Yes | - | array of visible announcements with read state |
| PATCH | `/api/announcements/read-all` | Yes | - | `updated` |
| PATCH | `/api/announcements/:id/read` | Yes | `id` | `id`, `isRead` |

## Auth APIs (`/api/auth`)

| Method | Path | Auth | Body keys | Success `data` keys |
|---|---|---|---|---|
| POST | `/register/send-otp` | No | `email`, `fullName` | `expiresInSeconds` |
| POST | `/register/verify-otp` | No | `email`, `otp` | `otpVerificationToken` |
| POST | `/register` | Firebase token required (`verifyFirebaseToken`) | `uid`, `email`, `fullName`, `phoneNumber`, `fatherName`, `fatherPhone`, `fatherOccupation`, `address`, `district`, `domicile`, `caste`, `otpVerificationToken`, `provider` | `user.uid`, `user.email`, `user.role`, `user.fullName` |
| POST | `/login` | Firebase token required (`verifyFirebaseToken`) | body optional, user from token/device headers | `user.uid`, `user.email`, `user.role` |
| POST | `/forgot-password/send-otp` | No | `email` | `expiresInSeconds` |
| POST | `/forgot-password/verify-otp` | No | `email`, `otp` | `otpVerificationToken` |
| POST | `/forgot-password/reset` | No | `email`, `newPassword`, `confirmPassword`, `otpVerificationToken` | `{}` |
| POST | `/logout` | Yes | - | (message only) |
| GET | `/me` | Yes | - | `user` full merged profile |
| PATCH | `/set-role` | Yes (`admin`) | `uid`, `role` (`student|teacher|admin`) | (message only) |

## Student APIs (`/api/student`) 
All routes require `student` role.

| Method | Path | Body/Params/Query keys | Success `data` keys |
|---|---|---|---|
| GET | `/dashboard` | - | `profile`, `stats`, `classes[]`, `courses[]`, `lastAccessedCourse`, `attendanceSummary`, `announcements[]`, `upcomingSessions[]`, `nextInstallment` |
| GET | `/courses` | - | array of enrolled course rows grouped with class context |
| GET | `/courses/:courseId/progress` | `courseId` | `course`, `progress`, `chapters[]` |
| POST | `/courses/:courseId/lectures/:lectureId/complete` | params `courseId`, `lectureId` (or body fallback) | `courseId`, `lectureId`, `completedLectures`, `totalLectures`, `completionPercent`, `courseCompleted`, `certificateIssued` |
| GET | `/certificates` | - | array of student certificates |
| GET | `/quizzes` | - | quiz list with assignment/attempt status |
| GET | `/quizzes/:quizId` | `quizId` | quiz detail |
| POST | `/quizzes/:quizId/submit` | `quizId`, `answers[]` | quiz result summary |
| GET | `/announcements` | - | array of student-visible announcements |
| PATCH | `/announcements/:id/read` | `id` | `id`, `isRead` |
| GET | `/attendance` | - | `classes[]`, `summary` |
| POST | `/help-support` | `category`, `subject`, `message`, optional `name`, `email` | `submitted` |
| GET | `/settings` | - | student settings profile |
| PUT | `/settings` | `fullName`, `phoneNumber`, `fatherName`, `fatherPhone`, `fatherOccupation`, `address`, `district`, `domicile`, `caste` | updated settings payload |

## Teacher APIs (`/api/teacher`)
All routes require `teacher` or `admin` role.

| Method | Path | Body/Params keys | Success `data` keys |
|---|---|---|---|
| GET | `/dashboard` | - | dashboard KPIs |
| GET | `/courses` | - | assigned courses |
| GET | `/courses/:courseId` | `courseId` | course detail |
| GET | `/courses/:courseId/subjects/:subjectId/chapters` | `courseId`, `subjectId` | chapter list |
| POST | `/courses/:courseId/subjects/:subjectId/chapters` | params + body `title`, `order` | created chapter |
| PUT | `/chapters/:chapterId` | `chapterId`, body `title`, `order` | updated chapter |
| DELETE | `/chapters/:chapterId` | `chapterId` | deleted marker |
| GET | `/chapters/:chapterId/lectures` | `chapterId` | lecture list |
| POST | `/chapters/:chapterId/lectures` | `chapterId`, body `title`, `order` | created lecture |
| PUT | `/lectures/:lectureId` | `lectureId`, body `title`, `order` | updated lecture |
| DELETE | `/lectures/:lectureId` | `lectureId` | deleted marker |
| POST | `/lectures/:lectureId/content` | `lectureId`, body `type`, `title`, `url`, `size`, `duration` | created content |
| DELETE | `/lectures/:lectureId/content/:contentId` | `lectureId`, `contentId` | deleted marker |
| GET | `/courses/:courseId/students` | `courseId` | students list |
| PATCH | `/courses/:courseId/students/:studentId/video-access` | params + body `lectureId`, `hasAccess` | access update |
| GET | `/students` | - | teacher students list |
| GET | `/students/:studentId` | `studentId` | student detail |
| GET | `/students/:studentId/progress/:courseId` | `studentId`, `courseId` | progress report |
| PATCH | `/students/:studentId/video-access` | `studentId`, body `lectureAccess[]` | access matrix update |
| GET | `/students/:studentId/attendance/:classId` | `studentId`, `classId` | attendance detail |
| GET | `/sessions` | query filters (optional) | sessions list |
| GET | `/sessions/:sessionId` | `sessionId` | session detail |
| POST | `/sessions` | `classId`, `courseId`, `topic`, `description`, `date`, `startTime`, `endTime`, `platform`, `meetingLink`, `notifyStudents` | created session |
| PUT | `/sessions/:sessionId` | `sessionId` + editable session fields | updated session |
| PATCH | `/sessions/:sessionId/cancel` | `sessionId`, `cancelReason`, `notifyStudents` | status update |
| PATCH | `/sessions/:sessionId/complete` | `sessionId`, `notes` | status update |
| GET | `/sessions/:sessionId/attendance` | `sessionId` | attendance rows |
| POST | `/sessions/:sessionId/attendance` | `sessionId`, `attendance[]` | saved rows |
| GET | `/classes` | - | teacher classes |
| GET | `/timetable` | - | timetable |
| GET | `/announcements` | - | teacher outgoing announcements |
| POST | `/announcements` | `title`, `message`, `targetType` (`course|single_user`), `targetId`, `sendEmail`, `isPinned` | created announcement |
| GET | `/quizzes/template` | - | CSV template file |
| GET | `/quizzes` | - | quizzes list |
| GET | `/quizzes/:quizId` | `quizId` | quiz detail |
| GET | `/quizzes/:quizId/analytics` | `quizId` | analytics |
| POST | `/quizzes` | `scope`, `title`, `description`, `courseId`, `subjectId`, `chapterId`, `questions[]`, `assignmentTargetType/targetType`, `assignToClassId/classId`, `dueAt` | created quiz |
| POST | `/quizzes/bulk-upload` | multipart `file` | import summary |
| PATCH | `/quizzes/:quizId/assign` | `quizId`, `dueAt`, `targetType`, `classId`, `courseId`, `studentIds[]` | assignment summary |
| POST | `/quizzes/:quizId/evaluate` | `quizId`, `answers` preview payload | evaluation preview |
| POST | `/quizzes/:quizId/submissions` | `quizId`, `studentId`, `studentName`, `answers` | submission result |
| GET | `/quizzes/:quizId/submissions` | `quizId` | submissions list |
| PATCH | `/quizzes/:quizId/submissions/:resultId/grade-short` | `quizId`, `resultId`, `gradedAnswers[]` | grading result |
| GET | `/settings/profile` | - | teacher profile settings |
| PUT | `/settings/profile` | `fullName`, `phoneNumber`, `subject`, `bio`, `profilePicture` | updated profile |
| GET | `/settings/security` | - | session/security info |
| PATCH | `/settings/security/sessions/:sessionDocId/revoke` | `sessionDocId` | revoke result |
| PATCH | `/settings/security/sessions/revoke-all` | - | revoke summary |

## Payment APIs

### Student payment APIs (`/api/payments`)
| Method | Path | Body/Params/Query keys | Success `data` keys |
|---|---|---|---|
| POST | `/initiate` | `courseId`, `classId`, `shiftId`, `method` (`jazzcash|easypaisa|bank_transfer`), `promoCode`, `installments` | `paymentId`, `reference`, `amount`, `totalAmount`, `originalAmount`, `discount`, `method`, `promoCode`, `paymentDetails`, `bankDetails`, `installments`, `isInstallment`, `numberOfInstallments` |
| POST | `/validate-promo` | `code`, `courseId`, optional `studentId` | `code`, `discountType`, `discountValue`, `discountAmount`, `finalAmount` |
| GET | `/config` | - | `jazzcash`, `easypaisa`, `bankTransfer` configuration |
| POST | `/:id/receipt` | params `id`, body `receiptUrl` | `paymentId`, `status` |
| GET | `/:id/status` | params `id` | payment record with timestamps |
| GET | `/my-payments` | - | payments[] |
| GET | `/my-installments` | - | installment plans[] |

### Admin payment APIs (`/api/admin`)
| Method | Path | Body/Params/Query keys | Success `data` keys |
|---|---|---|---|
| GET | `/payments` | - | merged payments list |
| PATCH | `/payments/:id/verify` | `id`, body `action` (`approve|reject`) | `paymentId`, `status`, optional `installmentPlanId` |
| GET | `/transactions` | query `method`, `status`, `search`, `startDate`, `endDate` | transaction rows |
| GET | `/transactions/export` | - | CSV stream |
| GET | `/transactions/:id` | `id` | merged transaction detail |
| GET | `/installments` | query `status`, `search` | installment plans |
| GET | `/installments/:planId` | `planId` | installment plan detail |
| PATCH | `/installments/:planId/:number/pay` | `planId`, `number` | refreshed installment plan |
| PUT | `/installments/:planId/override` | `planId`, `installments[]` | refreshed installment plan |
| POST | `/installments/send-reminders` | optional `studentId` | `sent`, `remindersSent`, `students` |
| POST | `/installments` | `studentId`, `courseId`, optional `classId`, `totalAmount`, `numberOfInstallments`, `startDate` | `id` |

## Admin APIs (`/api/admin`)
All routes require admin except `/classes/:classId/students` which allows `admin` or `student`.

### Dashboard and analytics
| Method | Path | Query/Body keys | Success `data` keys |
|---|---|---|---|
| GET | `/stats` | - | totals and revenue counters |
| GET | `/revenue-chart` | query `days` | `{date, amount}[]` |
| GET | `/recent-enrollments` | - | recent paid payments list |
| GET | `/top-courses` | - | top courses by enrollment |
| GET | `/recent-activity` | - | audit activity rows |
| GET | `/analytics-report` | query `days` | analytics aggregate |

### Users/teachers/students
| Method | Path | Request keys | Success `data` keys |
|---|---|---|---|
| GET | `/users` | query `role`, `isActive`, `search` | users[] |
| GET | `/users/:uid` | `uid` | user detail + role profile |
| POST | `/users` | `name`, `email`, `password`, `phone`, `role`, `subject`, `bio` | created user |
| PUT | `/users/:uid` | `uid` + editable profile fields | updated user |
| DELETE | `/users/:uid` | `uid` | deleted marker |
| PATCH | `/users/:uid/role` | `uid`, `role` | role update |
| PATCH | `/users/:uid/reset-device` | `uid` | device reset result |
| GET | `/teachers` | - | teachers[] |
| GET | `/teachers/:uid` | `uid` | teacher detail |
| GET | `/students` | - | students[] with `enrolledClasses`, `enrolledClassesCount`, class-derived `enrolledCourses`, progress metrics |
| PATCH | `/students/:uid/approve` | `uid` | approval result |
| PATCH | `/students/:uid/reject` | `uid`, `reason` | rejection result |
| GET | `/students/template` | - | CSV template |
| POST | `/students/bulk-upload` | multipart `file` (or `csvText`) | created/failed summary |
| GET | `/students/:uid/progress` | `uid` | student progress detail |
| GET | `/students/:uid` | `uid` | student detail |

### Courses management
| Method | Path | Request keys | Success `data` keys |
|---|---|---|---|
| GET | `/courses` | - | courses[] (`enrollmentCount` includes class-derived live count) |
| POST | `/courses` | `title`, `description`, `shortDescription`, `category`, `level`, `price`, `discountPercent`, `status`, `thumbnail`, `hasCertificate`, `subjects[]` | `id` |
| PUT/PATCH | `/courses/:courseId` | `courseId` + editable course fields | `courseId` |
| DELETE | `/courses/:courseId` | `courseId` | `courseId` |
| POST | `/courses/:courseId/subjects` | `courseId`, `name`, `teacherId`, `order` | subject object |
| DELETE | `/courses/:courseId/subjects/:subjectId` | `courseId`, `subjectId` | `subjectId` |
| POST | `/courses/:courseId/subjects/:subjectId/content` | `type`, `title`, `url`, `size`, `contentType`, `noteType` | content object |
| GET | `/courses/:courseId/content` | `courseId` | subject-grouped content[] |
| DELETE | `/courses/:courseId/content/:contentId` | `courseId`, `contentId` | `contentId` |

### Class management (Class-first enrollment model)
| Method | Path | Request keys | Success `data` keys |
|---|---|---|---|
| GET | `/classes` | - | classes[] |
| POST | `/classes` | `name`, `batchCode`, `description`, `status`, `capacity`, `startDate`, `endDate`, `assignedCourses[]`, `shifts[]` | created class object |
| PUT | `/classes/:classId` | `classId` + editable class fields (`name`, `description`, `status`, `capacity`, `startDate`, `endDate`, `assignedCourses[]`, `shifts[]`, `batchCode`) | `classId` |
| DELETE | `/classes/:classId` | `classId` | `classId` |
| POST | `/classes/:classId/courses` | `classId`, `courseId` | assigned course meta |
| DELETE | `/classes/:classId/courses/:courseId` | `classId`, `courseId` | `courseId` |
| POST | `/classes/:classId/shifts` | `classId`, body shift: `name`, `days[]`, `startTime`, `endTime`, `courseId`, `teacherId`, `room` | shift object |
| PUT | `/classes/:classId/shifts/:shiftId` | params + shift fields | updated shift |
| DELETE | `/classes/:classId/shifts/:shiftId` | `classId`, `shiftId` | `shiftId` |
| POST | `/classes/:classId/students` | `classId`, `studentId`, `shiftId` (for student role, own UID used) | `classId`, `className`, `studentId`, `coursesEnrolled`, `createdEnrollments`, `remainingCapacity`, `capacity`, `currentCount`, `shiftId` |
| GET | `/classes/:classId/students` | `classId` | student rows with shift/course context |
| POST | `/classes/:classId/enroll` | `classId`, `studentId`, `shiftId` | same as add-student response |
| DELETE | `/classes/:classId/students/:studentId` | `classId`, `studentId` | `classId`, `studentId` |

Class enrollment specific errors:
- `CLASS_FULL` (400)
- `ALREADY_ENROLLED` (409)
- `SHIFT_NOT_FOUND` (404)
- `CLASS_HAS_NO_COURSES` (400)
- `CLASS_ENDED` (400)

### Admin quiz APIs
| Method | Path | Request keys | Success `data` keys |
|---|---|---|---|
| GET | `/quizzes/template` | - | CSV template file |
| GET | `/quizzes` | - | quizzes list |
| GET | `/quizzes/:quizId` | `quizId` | quiz detail |
| GET | `/quizzes/:quizId/analytics` | `quizId` | analytics |
| POST | `/quizzes` | quiz payload (same as teacher create) | created quiz |
| POST | `/quizzes/bulk-upload` | multipart `file` | bulk import summary |
| PATCH | `/quizzes/:quizId/assign` | assignment payload | assignment summary |
| GET | `/quizzes/:quizId/submissions` | `quizId` | submissions list |

### Certificates (`/api/admin/certificates*`)
| Method | Path | Request keys | Success `data` keys |
|---|---|---|---|
| GET | `/certificates` | - | certificates[] |
| POST | `/certificates` | `studentId`, `courseId`, optional `allowIncomplete`, `forceGenerate` | created/existing certificate |
| PATCH | `/certificates/:certId/revoke` | `certId` | `id`, `certId`, `isRevoked` |
| PATCH | `/certificates/:certId/unrevoke` | `certId` | `id`, `certId`, `isRevoked` |

### Announcements (`/api/admin/announcements*`)
| Method | Path | Request keys | Success `data` keys |
|---|---|---|---|
| GET | `/announcements` | - | announcements[] |
| POST | `/announcements` | `title`, `message`, `targetType`, `targetId`, `sendEmail`, `isPinned`, `audienceRole` | created announcement + `emailsSent` |
| PUT | `/announcements/:id` | `id`, optional `title`, `message`, `isPinned` | updated announcement |
| DELETE | `/announcements/:id` | `id` | `{}` |
| PATCH | `/announcements/:id/pin` | `id`, optional `isPinned` | `id`, `isPinned` |

### Settings (`/api/admin/settings*`)
| Method | Path | Request keys | Success `data` keys |
|---|---|---|---|
| GET | `/settings` | - | full normalized settings |
| PUT | `/settings/general` | `siteName`, `tagline`, `description`, `contactEmail`, `contactPhone`, `address`, `logoUrl`, `faviconUrl`, `socialLinks` | full settings |
| PUT | `/settings/hero` | `heading`, `subheading`, `ctaPrimary`, `ctaSecondary`, `badge`, `stats[]` | full settings |
| PUT | `/settings/how-it-works` | `heading`, `subheading`, `steps[]` | full settings |
| PUT | `/settings/features` | `heading`, `items[]` | full settings |
| PUT | `/settings/testimonials` | `heading`, `items[]` | full settings |
| PUT | `/settings/about` | about section fields | full settings |
| PUT | `/settings/contact` | `heading`, `subheading`, `subjects[]`, `email`, `phone`, `whatsapp`, `address`, `officeHours`, `mapEmbedUrl`, `faq[]` | full settings |
| PUT | `/settings/footer` | `description`, `copyright`, `links` | full settings |
| PUT | `/settings/appearance` | color/font fields (`primaryColor`, etc.) | full settings |
| PUT | `/settings/certificate` | certificate styling fields | full settings |
| PUT | `/settings/maintenance` | `enabled`, `message` | full settings |
| PUT | `/settings/email` | `smtpHost`, `smtpPort`, `smtpEmail`, `smtpPassword`, `fromName` | full settings |
| POST | `/settings/email/test` | `testEmail` | `{}` |
| PUT | `/settings/payment` | nested `jazzcash`, `easypaisa`, `bankTransfer` objects | full settings |
| PUT | `/settings/security` | `maxLoginAttempts`, `lockoutDuration`, `sessionTimeout`, `maintenanceMode` | full settings |
| GET | `/settings/templates` | - | `templates` object |
| PUT | `/settings/templates` | `templateName`, `subject`, `body` | full settings |

### Promo codes (`/api/admin/promo-codes*` and `/api/promo-codes/validate`)
| Method | Path | Request keys | Success `data` keys |
|---|---|---|---|
| GET | `/promo-codes` | - | promo codes[] |
| POST | `/promo-codes` | `code`, `discountType`, `discountValue`, `courseId`, `usageLimit`, `expiresAt`, `isSingleUse`, `isActive` | created promo |
| PUT | `/promo-codes/:codeId` | `codeId`, editable: `discountValue`, `usageLimit`, `isActive`, `expiresAt`, `isSingleUse` | updated promo |
| DELETE | `/promo-codes/:codeId` | `codeId` | `{}` |
| PATCH | `/promo-codes/:codeId/toggle` | `codeId`, `isActive` | `id`, `isActive` |
| POST | `/promo-codes/validate` | `code`, `courseId`, `studentId` | discount result |
| POST | `/api/promo-codes/validate` | `code`, `courseId`, `studentId` | discount result |

## Example: Class Enrollment Success
```json
{
  "success": true,
  "message": "Student enrolled in Batch A! Access granted to 2 course(s).",
  "data": {
    "classId": "class_123",
    "className": "Batch A",
    "studentId": "student_456",
    "coursesEnrolled": 2,
    "createdEnrollments": 2,
    "remainingCapacity": 1,
    "capacity": 5,
    "currentCount": 4,
    "shiftId": "shift_morning"
  }
}
```

## Example: Class Full Error
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

## Notes for Android Integration
- Send Firebase ID token in `Authorization` header for all protected APIs.
- Keep role values lowercase in client assumptions (`admin`, `teacher`, `student`).
- If you receive `ACCESS_DENIED`, inspect `requiredRoles` and `actualRole` from response.
- For class enrollment/payment, always provide both `classId` and `shiftId`.
