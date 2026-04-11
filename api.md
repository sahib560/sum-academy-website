# SUM Academy API Documentation
Base URL: `https://sumacademy.net/api`

Legacy complete category-wise API reference is preserved below in this same file.

Last updated: 2026-04-09

## Standard Response Shape

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

## 2026-04-09 Completion Lock Update

### Permanent completion message

When a class/subject is marked completed, APIs now return this message:

`This class or subject is completed. Your certificate is generated. Thank you for joining us. Keep exploring our other subjects and classes. Thank you.`

### Course content response additions

`GET /api/student/courses/:courseId/content` now includes:

- `data.isPermanentlyCompleted` (`boolean`)
- `data.completionMessage` (`string`)

Lecture and quiz items are returned locked with the same completion message when permanent completion is active.

### Enrollment and payment blocks

Enrollment/payment approval now blocks completed classes/subjects with:

- `code: "CLASS_COMPLETED"`
- `code: "SUBJECT_COMPLETED"`
- `code: "SUBJECT_OR_CLASS_COMPLETED"` (content/quiz upload protection)

## Course Content API

### GET `/api/student/courses/:courseId/content`
- Auth required: Bearer token
- Role: `student`
- Returns complete course structure with lock status for each lecture based on student progress.

Response structure:

```json
{
  "success": true,
  "data": {
    "courseId": "string",
    "courseName": "string",
    "isCourseCompleted": false,
    "overallProgress": 45,
    "totalLectures": 10,
    "completedLectures": 4,
    "chapters": [
      {
        "id": "chapter_id",
        "title": "Chapter 1",
        "order": 1,
        "courseId": "course_id",
        "isChapterComplete": false,
        "allLecturesDone": false,
        "completedLectures": 2,
        "totalLectures": 3,
        "lectures": [
          {
            "id": "lecture_id",
            "title": "Introduction to the topic",
            "order": 1,
            "chapterId": "chapter_id",
            "courseId": "course_id",
            "videoUrl": "https://storage.googleapis.com/...",
            "videoTitle": "Introduction Video",
            "videoDuration": "12:30",
            "pdfNotes": [
              {
                "id": "pdf_id",
                "title": "Lecture Notes",
                "url": "https://...",
                "size": 204800
              }
            ],
            "books": [],
            "isCompleted": true,
            "watchedPercent": 100,
            "isLocked": false,
            "lockReason": "",
            "unlocked": true,
            "access": {
              "canWatch": true,
              "canSeekForward": false,
              "isPaymentLocked": false,
              "isProgressLocked": false,
              "isClassLocked": false,
              "isCompletionLocked": false,
              "manuallyUnlocked": false
            },
            "lockAfterCompletion": false,
            "rewatch": {
              "isAllowed": false,
              "unlockedByTeacher": false,
              "unlockedAt": null,
              "unlockedBy": null
            }
          },
          {
            "id": "lecture_id_3",
            "title": "Advanced Topics",
            "order": 3,
            "chapterId": "chapter_id",
            "courseId": "course_id",
            "videoUrl": null,
            "videoTitle": null,
            "videoDuration": null,
            "pdfNotes": [],
            "books": [],
            "isCompleted": false,
            "watchedPercent": 0,
            "isLocked": true,
            "lockReason": "Complete previous lecture first",
            "unlocked": false,
            "access": {
              "canWatch": false,
              "canSeekForward": false,
              "isPaymentLocked": false,
              "isProgressLocked": true,
              "isClassLocked": false,
              "isCompletionLocked": false,
              "manuallyUnlocked": false
            },
            "lockAfterCompletion": false,
            "rewatch": {
              "isAllowed": false,
              "unlockedByTeacher": false,
              "unlockedAt": null,
              "unlockedBy": null
            }
          }
        ],
        "quizzes": [
          {
            "id": "quiz_id",
            "title": "Chapter 1 Quiz",
            "scope": "chapter",
            "chapterId": "chapter_id",
            "totalMarks": 20,
            "questionsCount": 10,
            "passScore": 70,
            "isLocked": true,
            "lockReason": "Complete all chapter videos to unlock quiz",
            "isAttempted": false,
            "isPassed": false,
            "result": null
          }
        ]
      }
    ],
    "subjectQuizzes": [
      {
        "id": "final_quiz_id",
        "title": "Final Assessment",
        "scope": "subject",
        "totalMarks": 50,
        "questionsCount": 25,
        "passScore": 70,
        "isLocked": true,
        "lockReason": "Complete all chapters to unlock final quiz",
        "isAttempted": false,
        "isPassed": false,
        "result": null
      }
    ]
  }
}
```

## Lock Types Explained

`isProgressLocked = true`
Student has not completed previous lecture and must complete in sequence.

`isClassLocked = true`
Class has not started yet (before startDate) OR class has expired (after endDate).

`isCompletionLocked = true`
Student completed the full course and videos auto-lock after completion. Teacher/admin can unlock for rewatch.

`isPaymentLocked = true`
Student has not purchased this subject/course.

`manuallyUnlocked = true`
Teacher or admin manually unlocked lecture access.

## Lock Priority Order
1. `isPaymentLocked`
2. `isClassLocked`
3. `isProgressLocked`
4. `isCompletionLocked`

## Lecture Lock Reasons
- `Complete previous lecture first`
- `Complete previous chapter first`
- `Complete all chapter videos to unlock quiz`
- `Complete all chapters to unlock final quiz`
- `Course completed. Contact teacher to rewatch.`
- `Class has not started yet`
- `Class has ended`

## Complete Lecture API

### POST `/api/student/courses/:courseId/lectures/:lectureId/complete`
- Marks a lecture complete.
- Auto-unlocks next lecture in sequence.
- Auto-unlocks chapter quiz when all lectures in chapter are completed.
- Generates certificate when course + quiz completion requirements are satisfied.

Request body: no required fields.

Sample response:

```json
{
  "success": true,
  "data": {
    "lectureId": "string",
    "completedCount": 3,
    "totalLectures": 10,
    "progressPercent": 30,
    "courseCompleted": false,
    "certificateGenerated": false,
    "nextAction": "continue",
    "chapterQuizUnlocked": false
  }
}
```

## Video Access APIs

### PATCH `/api/courses/:courseId/students/:studentId/video-access`
- Role: `teacher` or `admin`
- Unlock/lock specific lectures for a student (rewatch/manual override).

Request body:

```json
{
  "lectureAccess": [
    { "lectureId": "lecture_id_1", "hasAccess": true },
    { "lectureId": "lecture_id_2", "hasAccess": false }
  ]
}
```

### POST `/api/courses/:courseId/students/:studentId/unlock-all`
- Role: `teacher` or `admin`
- Unlock all course lectures for student rewatch.

Request body:

```json
{}
```

Sample response:

```json
{
  "success": true,
  "data": {
    "unlockedCount": 10
  },
  "message": "All 10 videos unlocked for student"
}
```

## Class Purchase Visibility (Student)

For classes containing 2+ subjects:
- My Classes shows purchased subjects for learning.
- Not-purchased subjects appear as locked in Explore with subject price and Buy flow.
- Full class purchase shows remaining/full class amount based on purchased subjects.

Relevant APIs:
- `GET /api/student/dashboard`
- `GET /api/classes/available`

```json
{
  "success": false,
  "message": "Error message",
  "error": "Error message",
  "errors": {}
}
```

## Public APIs

### PATCH `/api/announcements/:id/read`
- Auth: Bearer token
- Path Params: `id`
- Query Params: None
- Body Keys: None
- Success Messages: `Announcement marked as read`
- Error Messages: `Unauthorized`, `Announcement id is required`, `Announcement not found`, `Failed to mark announcement as read`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Announcement marked as read",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### GET `/api/announcements/my`
- Auth: Bearer token
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Announcements fetched`
- Error Messages: `Unauthorized`, `Failed to fetch announcements`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Announcements fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### PATCH `/api/announcements/read-all`
- Auth: Bearer token
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `All notifications marked as read`
- Error Messages: `Unauthorized`, `Failed to mark all announcements as read`
- Sample Success Response:

```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### POST `/api/contact/messages`
- Auth: Public
- Path Params: None
- Query Params: None
- Body Keys: `category`, `email`, `message`, `name`, `subject`
- Success Messages: `Your message has been sent to support`
- Error Messages: `Name must be at least 2 characters`, `Valid email is required`, `Subject must be at least 3 characters`, `Message must be at least 10 characters`, `Failed to submit contact message`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Your message has been sent to support",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "category": "<category>",
  "email": "<email>",
  "message": "<message>",
  "name": "<name>",
  "subject": "<subject>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Name must be at least 2 characters",
  "error": "Name must be at least 2 characters"
}
```

### GET `/api/courses/explore`
- Auth: Public
- Path Params: None
- Query Params: `category`, `level`, `search`
- Body Keys: None
- Success Messages: `Explore courses fetched`
- Error Messages: `Failed to fetch courses`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Explore courses fetched",
  "data": [
    {
      "id": "SUBJECT_DOC_ID",
      "courseId": "SUBJECT_DOC_ID",
      "subjectId": "SUBJECT_DOC_ID",
      "sourceType": "subject",
      "title": "Biology XI",
      "description": "Core concepts for pre-medical students",
      "thumbnail": "https://storage.googleapis.com/.../bio.jpg",
      "category": "Science",
      "level": "Intermediate",
      "originalPrice": 10000,
      "price": 10000,
      "discountPercent": 10,
      "discountAmount": 1000,
      "discountedPrice": 9000,
      "teacherId": "TEACHER_UID",
      "teacherName": "Ahsan Ali",
      "enrollmentCount": 24,
      "rating": 4.8,
      "subjects": [
        "Biology XI"
      ],
      "hasCertificate": true,
      "isEnrolled": false,
      "createdAt": "2026-04-07T10:00:00.000Z"
    }
  ]
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch courses",
  "error": "Failed to fetch courses"
}
```

### GET `/api/teachers/public`
- Auth: Public
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Public teachers fetched`
- Error Messages: `Failed to fetch teachers`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Public teachers fetched",
  "data": [
    {
      "id": "TEACHER_UID",
      "uid": "TEACHER_UID",
      "fullName": "Ahsan Ali",
      "name": "Ahsan Ali",
      "email": "teacher@example.com",
      "title": "Senior Instructor",
      "role": "Teacher",
      "subject": "Biology XI",
      "subjects": [
        "Biology XI",
        "Chemistry XI"
      ],
      "subjectsCount": 2,
      "coursesCount": 2,
      "classesCount": 1,
      "courses": "2 Subjects",
      "bio": "Teaching Biology and Chemistry for XI pre-medical.",
      "rating": 4.9,
      "profileImage": null
    }
  ]
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch teachers",
  "error": "Failed to fetch teachers"
}
```

### GET `/api/health`
- Auth: Public
- Path Params: None
- Query Params: None
- Body Keys: None
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/launch/notify`
- Auth: Public
- Path Params: None
- Query Params: None
- Body Keys: `email`
- Success Messages: `sent`
- Error Messages: `Valid email is required`, `Failed to save launch notification`
- Sample Success Response:

```json
{
  "success": true,
  "message": "sent",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "email": "<email>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Valid email is required",
  "error": "Valid email is required"
}
```

### POST `/api/launch/notify/dispatch`
- Auth: Public
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Launch notifications dispatched`
- Error Messages: `Launch date has not passed yet`, `Email settings are incomplete`, `Failed to dispatch launch notifications`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Launch notifications dispatched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Launch date has not passed yet",
  "error": "Launch date has not passed yet"
}
```

### POST `/api/promo-codes/validate`
- Auth: Bearer token
- Path Params: None
- Query Params: None
- Body Keys: None
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### GET `/api/settings`
- Auth: Public
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Settings fetched`
- Error Messages: `Failed to fetch settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Settings fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch settings",
  "error": "Failed to fetch settings"
}
```

### GET `/api/test`
- Auth: Public
- Path Params: None
- Query Params: None
- Body Keys: None
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### GET `/api/verify/:certId`
- Auth: Public
- Path Params: `certId`
- Query Params: None
- Body Keys: None
- Error Messages: `Certificate not found`, `Certificate has been revoked`, `Failed to verify certificate`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Certificate not found",
  "error": "Certificate not found"
}
```

## Auth APIs

### POST `/api/auth/forgot-password/reset`
- Auth: Public
- Path Params: None
- Query Params: None
- Body Keys: None
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/auth/forgot-password/send-otp`
- Auth: Public
- Path Params: None
- Query Params: None
- Body Keys: None
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/auth/forgot-password/verify-otp`
- Auth: Public
- Path Params: None
- Query Params: None
- Body Keys: None
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/auth/login`
- Auth: Firebase token required (verifyFirebaseToken)
- Path Params: None
- Query Params: None
- Body Keys: None
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/auth/logout`
- Auth: Bearer token
- Path Params: None
- Query Params: None
- Body Keys: None
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### GET `/api/auth/me`
- Auth: Bearer token
- Path Params: None
- Query Params: None
- Body Keys: None
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/auth/register`
- Auth: Firebase token required (verifyFirebaseToken)
- Path Params: None
- Query Params: None
- Body Keys: None
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/auth/register/send-otp`
- Auth: Public
- Path Params: None
- Query Params: None
- Body Keys: None
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### POST `/api/auth/register/verify-otp`
- Auth: Public
- Path Params: None
- Query Params: None
- Body Keys: None
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### PATCH `/api/auth/set-role`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `role`
- Success Messages: `Role updated`
- Error Messages: `Invalid role`, `User not found`, `Failed to update role`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Role updated",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "role": "<role>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Invalid role",
  "error": "Invalid role"
}
```

## Classes Public APIs

### GET `/api/classes/available`
- Auth: Public
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Available classes fetched`
- Error Messages: `Failed to fetch available classes`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Available classes fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch available classes",
  "error": "Failed to fetch available classes"
}
```

### GET `/api/classes/catalog`
- Auth: Public
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Course catalog fetched`
- Error Messages: `Failed to fetch course catalog`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Course catalog fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch course catalog",
  "error": "Failed to fetch course catalog"
}
```

## Payment APIs

### GET `/api/payments/:id/status`
- Auth: Bearer token
- Path Params: `id`, `paymentId`
- Query Params: None
- Body Keys: None
- Error Messages: `Payment not found`, `Access denied`, `Failed to fetch payment status`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Payment not found",
  "error": "Payment not found"
}
```

### PATCH `/api/payments/:paymentId/receipt`
- Auth: Bearer token
- Path Params: `id`, `paymentId`
- Query Params: None
- Body Keys: `receiptSize`, `receiptUrl`
- Success Messages: `pending_verification`
- Error Messages: `paymentId is required`, `Payment not found`, `You can upload receipt for your own payment only`, `Payment approvals are blocked after 3 rejected receipts. Contact admin to reset.`, `Unsupported payment method for receipt upload`, `Receipt cannot be uploaded for this payment status`, `Invalid receipt URL`, `No file uploaded`, `Failed to upload receipt`
- Sample Success Response:

```json
{
  "success": true,
  "message": "pending_verification",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "receiptSize": "<receiptSize>",
  "receiptUrl": "<receiptUrl>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "paymentId is required",
  "error": "paymentId is required"
}
```

### POST `/api/payments/:paymentId/receipt`
- Auth: Bearer token
- Path Params: `id`, `paymentId`
- Query Params: None
- Body Keys: `receiptSize`, `receiptUrl`
- Success Messages: `pending_verification`
- Error Messages: `paymentId is required`, `Payment not found`, `You can upload receipt for your own payment only`, `Payment approvals are blocked after 3 rejected receipts. Contact admin to reset.`, `Unsupported payment method for receipt upload`, `Receipt cannot be uploaded for this payment status`, `Invalid receipt URL`, `No file uploaded`, `Failed to upload receipt`
- Sample Success Response:

```json
{
  "success": true,
  "message": "pending_verification",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "receiptSize": "<receiptSize>",
  "receiptUrl": "<receiptUrl>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "paymentId is required",
  "error": "paymentId is required"
}
```

### GET `/api/payments/config`
- Auth: Bearer token
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Payment config fetched`
- Error Messages: `Failed to fetch payment config`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Payment config fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch payment config",
  "error": "Failed to fetch payment config"
}
```

### POST `/api/payments/initiate`
- Auth: Bearer token
- Path Params: None
- Query Params: None
- Body Keys: `classId`, `enrollmentType`, `installments`, `method`, `promoCode`, `shiftId`
- Success Messages: `bank_transfer`
- Error Messages: `enrollmentType must be full_class or single_course`, `classId, shiftId and method are required`, `courseId is required for single_course enrollment`, `Invalid payment method`, `Installments must be between 2 and 6`, `Student profile not found`, `Payment requests are blocked after 3 rejected receipts. Contact admin to reset.`, `Class not found`, `Selected class has already ended. Choose an active class.`, `You already have an active enrollment request for this class.`
- Sample Success Response:

```json
{
  "success": true,
  "message": "bank_transfer",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "enrollmentType must be full_class or single_course",
  "error": "enrollmentType must be full_class or single_course"
}
```

### GET `/api/payments/my-installments`
- Auth: Bearer token
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `My installments fetched`
- Error Messages: `Failed to fetch installments`
- Sample Success Response:

```json
{
  "success": true,
  "message": "My installments fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch installments",
  "error": "Failed to fetch installments"
}
```

### GET `/api/payments/my-payments`
- Auth: Bearer token
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `My payments fetched`
- Error Messages: `Failed to fetch payments`
- Sample Success Response:

```json
{
  "success": true,
  "message": "My payments fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch payments",
  "error": "Failed to fetch payments"
}
```

### POST `/api/payments/validate-promo`
- Auth: Bearer token
- Path Params: None
- Query Params: None
- Body Keys: `courseId`, `studentId`
- Error Messages: `Promo code is required`, `Invalid promo code`, `Promo code is inactive`, `Promo code has expired`, `Promo code usage limit reached`, `Promo code not valid for this course`, `You have already used this promo code`, `Failed to validate promo code`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "courseId": "<courseId>",
  "studentId": "<studentId>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Promo code is required",
  "error": "Promo code is required"
}
```

## Student APIs

### GET `/api/student/announcements`
- Auth: Bearer token (student)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Announcements fetched`
- Error Messages: `Unauthorized`, `Failed to fetch announcements`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Announcements fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### PATCH `/api/student/announcements/:id/read`
- Auth: Bearer token (student)
- Path Params: `id`
- Query Params: None
- Body Keys: None
- Success Messages: `Announcement marked as read`
- Error Messages: `Unauthorized`, `Announcement id is required`, `Announcement not found`, `Failed to mark announcement as read`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Announcement marked as read",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### GET `/api/student/certificates`
- Auth: Bearer token (student)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Certificates fetched`
- Error Messages: `Missing student uid`, `Failed to fetch certificates`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Certificates fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### GET `/api/student/courses`
- Auth: Bearer token (student)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Student courses fetched`
- Error Messages: `Missing student uid`, `Failed to fetch student courses`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Student courses fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### GET `/api/student/courses/:courseId/content`
- Auth: Bearer token (student)
- Path Params: `courseId`
- Query Params: None
- Body Keys: None
- Error Messages: `courseId is required`, `Missing student uid`, `Failed to fetch course content`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "courseId is required",
  "error": "courseId is required"
}
```

### GET `/api/student/courses/:courseId/final-quiz-request`
- Auth: Bearer token (student)
- Path Params: `courseId`
- Query Params: None
- Body Keys: None
- Success Messages: `No final quiz is configured for this course`, `Final quiz status fetched`
- Error Messages: `Missing student uid`, `courseId is required`, `You are not enrolled in this course`, `Failed to fetch final quiz status`
- Sample Success Response:

```json
{
  "success": true,
  "message": "No final quiz is configured for this course",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### POST `/api/student/courses/:courseId/final-quiz-request`
- Auth: Bearer token (student)
- Path Params: `courseId`
- Query Params: None
- Body Keys: `notes`
- Success Messages: `pending`
- Error Messages: `Missing student uid`, `courseId is required`, `You are not enrolled in this course`, `No final quiz is configured for this course`, `Final quiz is already passed for this course`, `A final quiz request is already in progress`, `Complete all course lectures before requesting the final quiz`, `Failed to request final quiz`
- Sample Success Response:

```json
{
  "success": true,
  "message": "pending",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "notes": "<notes>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### POST `/api/student/courses/:courseId/lectures/:lectureId/complete`
- Auth: Bearer token (student)
- Path Params: `courseId`, `lectureId`
- Query Params: None
- Body Keys: `currentTimeSec`, `duration`, `durationSec`, `watchedPercent`
- Error Messages: `courseId and lectureId are required`, `Missing student uid`, `Course is already completed`, `Lecture not found in this course`, `Complete previous content first`, `Watch at least 80% of the lecture before marking complete`, `Failed to mark complete`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "currentTimeSec": "<currentTimeSec>",
  "duration": "<duration>",
  "durationSec": "<durationSec>",
  "watchedPercent": "<watchedPercent>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "courseId and lectureId are required",
  "error": "courseId and lectureId are required"
}
```

### PATCH `/api/student/courses/:courseId/lectures/:lectureId/progress`
- Auth: Bearer token (student)
- Path Params: `courseId`, `lectureId`
- Query Params: None
- Body Keys: `currentTimeSec`, `duration`, `durationSec`, `watchedPercent`
- Error Messages: `courseId and lectureId are required`, `Missing student uid`, `Lecture not found in this course`, `Complete previous content first`, `Failed to save progress`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "currentTimeSec": "<currentTimeSec>",
  "duration": "<duration>",
  "durationSec": "<durationSec>",
  "watchedPercent": "<watchedPercent>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "courseId and lectureId are required",
  "error": "courseId and lectureId are required"
}
```

### GET `/api/student/courses/:courseId/progress`
- Auth: Bearer token (student)
- Path Params: `courseId`, `studentId`
- Query Params: None
- Body Keys: None
- Error Messages: `courseId and studentId are required`, `Missing requester uid`, `Only teachers and admins can view student progress`, `Failed to fetch progress`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "courseId and studentId are required",
  "error": "courseId and studentId are required"
}
```

### GET `/api/student/dashboard`
- Auth: Bearer token (student)
- Path Params: None
- Query Params: None
- Body Keys: None
- Error Messages: `Missing student uid`, `Failed to fetch student dashboard`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### POST `/api/student/help-support`
- Auth: Bearer token (student)
- Path Params: None
- Query Params: None
- Body Keys: `category`, `email`, `message`, `name`, `subject`
- Success Messages: `Help support message sent`
- Error Messages: `Missing student uid`, `Subject must be at least 3 characters`, `Message must be at least 10 characters`, `Student email is invalid`, `Support email is not configured`, `Failed to send support message`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Help support message sent",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "category": "<category>",
  "email": "<email>",
  "message": "<message>",
  "name": "<name>",
  "subject": "<subject>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### GET `/api/student/quizzes`
- Auth: Bearer token (student)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Student quizzes fetched`
- Error Messages: `Missing student uid`, `Failed to fetch quizzes`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Student quizzes fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### GET `/api/student/quizzes/:quizId`
- Auth: Bearer token (student)
- Path Params: `quizId`
- Query Params: None
- Body Keys: None
- Error Messages: `Missing student uid`, `quizId is required`, `Quiz not found`, `You are not enrolled in this quiz course`, `Final quiz is not approved for you yet. Request approval first.`, `This quiz is not assigned to you`, `Quiz deadline has passed`, `Failed to fetch quiz`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### POST `/api/student/quizzes/:quizId/submit`
- Auth: Bearer token (student)
- Path Params: `quizId`
- Query Params: None
- Body Keys: `answers`
- Error Messages: `Missing student uid`, `quizId is required`, `answers are required`, `Quiz not found`, `You are not enrolled in this quiz course`, `Final quiz is not approved for you yet. Request approval first.`, `This quiz is not assigned to you`, `Quiz deadline has passed`, `Quiz has no questions`, `Failed to submit quiz attempt`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "answers": "<answers>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### POST `/api/student/security/violations`
- Auth: Bearer token (student)
- Path Params: None
- Query Params: None
- Body Keys: `details`, `page`, `reason`
- Success Messages: `Account deactivated due to repeated security violations`
- Error Messages: `Missing student uid`, `User profile not found`, `Only students can report violations`, `Failed to record security violation`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Account deactivated due to repeated security violations",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "details": "<details>",
  "page": "<page>",
  "reason": "<reason>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### GET `/api/student/settings`
- Auth: Bearer token (student)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Student settings fetched`
- Error Messages: `Missing student uid`, `Student profile not found`, `Failed to fetch student settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Student settings fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### PUT `/api/student/settings`
- Auth: Bearer token (student)
- Path Params: None
- Query Params: None
- Body Keys: `address`, `caste`, `district`, `domicile`, `fatherName`, `fatherOccupation`, `fatherPhone`, `fullName`, `phoneNumber`
- Error Messages: `Missing student uid`, `fullName must be at least 2 characters`, `fullName cannot exceed 120 characters`, `phoneNumber must be 03001234567 or +923001234567 format`, `fatherName cannot exceed 120 characters`, `fatherPhone must be 03001234567 or +923001234567 format`, `fatherOccupation cannot exceed 120 characters`, `district cannot exceed 120 characters`, `domicile cannot exceed 120 characters`, `caste cannot exceed 120 characters`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

## Teacher APIs

### GET `/api/teacher/announcements`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Teacher outgoing announcements fetched`
- Error Messages: `Unauthorized`, `Failed to fetch teacher outgoing announcements`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Teacher outgoing announcements fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### POST `/api/teacher/announcements`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: `isPinned`, `message`, `sendEmail`, `targetId`, `targetType`, `title`
- Success Messages: `Announcement posted`
- Error Messages: `Unauthorized`, `Title must be between 5 and 100 characters`, `Message must be at least 10 characters`, `targetType must be course or single_user`, `targetId is required`, `You are not assigned to any course`, `Course not found`, `You can only send announcements to your assigned course students`, `No enrolled students found in this course`, `Student not found`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Announcement posted",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### DELETE `/api/teacher/chapters/:chapterId`
- Auth: Bearer token (teacher or admin)
- Path Params: `chapterId`
- Query Params: None
- Body Keys: None
- Success Messages: `Chapter deleted`
- Error Messages: `Missing teacher uid`, `chapterId is required`, `Failed to delete chapter`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Chapter deleted",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### PUT `/api/teacher/chapters/:chapterId`
- Auth: Bearer token (teacher or admin)
- Path Params: `chapterId`
- Query Params: None
- Body Keys: `order`
- Error Messages: `Missing teacher uid`, `chapterId is required`, `Chapter title must be at least 3 characters`, `Chapter order must be a positive number`, `No valid fields to update`, `Failed to update chapter`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "order": "<order>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/chapters/:chapterId/lectures`
- Auth: Bearer token (teacher or admin)
- Path Params: `chapterId`
- Query Params: None
- Body Keys: None
- Success Messages: `Lectures fetched`
- Error Messages: `Missing teacher uid`, `chapterId is required`, `Failed to fetch lectures`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Lectures fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### POST `/api/teacher/chapters/:chapterId/lectures`
- Auth: Bearer token (teacher or admin)
- Path Params: `chapterId`
- Query Params: None
- Body Keys: `order`
- Error Messages: `Missing teacher uid`, `chapterId is required`, `Lecture title must be at least 3 characters`, `Failed to add lecture`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "order": "<order>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/classes`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Teacher classes fetched`
- Error Messages: `Missing teacher uid`, `Failed to fetch teacher classes`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Teacher classes fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/courses`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Courses fetched`, `Teacher assigned courses fetched`
- Error Messages: `Missing teacher uid`, `Failed to fetch teacher courses`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Courses fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/courses/:courseId`
- Auth: Bearer token (teacher or admin)
- Path Params: `courseId`
- Query Params: None
- Body Keys: None
- Success Messages: `Teacher course content fetched`
- Error Messages: `Missing teacher uid`, `courseId is required`, `Failed to fetch teacher course`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Teacher course content fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/courses/:courseId/students`
- Auth: Bearer token (teacher or admin)
- Path Params: `courseId`
- Query Params: None
- Body Keys: None
- Success Messages: `Course students fetched`
- Error Messages: `Missing teacher uid`, `courseId is required`, `Failed to fetch course students`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Course students fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### PATCH `/api/teacher/courses/:courseId/students/:studentId/rewatch-access`
- Auth: Bearer token (teacher or admin)
- Path Params: `courseId`, `studentId`
- Query Params: None
- Body Keys: `lockAfterCompletion`, `unlocked`
- Error Messages: `Missing user uid`, `courseId and studentId are required`, `No class enrollment found for this student in the selected course`, `Failed to update rewatch access`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "lockAfterCompletion": "<lockAfterCompletion>",
  "unlocked": "<unlocked>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### PATCH `/api/teacher/courses/:courseId/students/:studentId/video-access`
- Auth: Bearer token (teacher or admin)
- Path Params: `courseId`, `studentId`
- Query Params: None
- Body Keys: `lectureAccess`
- Success Messages: `Video access updated successfully`
- Error Messages: `courseId and studentId are required`, `Missing requester uid`, `Only teachers and admins can manage video access`, `lectureAccess array required`, `No valid lectureId provided`, `Failed to update video access`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Video access updated successfully",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "lectureAccess": "<lectureAccess>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "courseId and studentId are required",
  "error": "courseId and studentId are required"
}
```

### GET `/api/teacher/courses/:courseId/subjects/:subjectId/chapters`
- Auth: Bearer token (teacher or admin)
- Path Params: `courseId`, `subjectId`
- Query Params: None
- Body Keys: None
- Success Messages: `Chapters fetched`
- Error Messages: `Missing teacher uid`, `courseId and subjectId are required`, `Forbidden`, `Failed to fetch chapters`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Chapters fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### POST `/api/teacher/courses/:courseId/subjects/:subjectId/chapters`
- Auth: Bearer token (teacher or admin)
- Path Params: `courseId`, `subjectId`
- Query Params: None
- Body Keys: `order`, `subjectId`
- Error Messages: `Missing teacher uid`, `courseId and subjectId are required`, `Chapter title must be at least 3 characters`, `Forbidden`, `Failed to add chapter`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "order": "<order>",
  "subjectId": "<subjectId>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/dashboard`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Teacher dashboard fetched`
- Error Messages: `Missing teacher uid`, `Failed to fetch teacher dashboard`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Teacher dashboard fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/final-quiz-requests`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: `courseId`, `status`
- Body Keys: None
- Success Messages: `Final quiz requests fetched`
- Error Messages: `Missing user uid`, `Failed to fetch final quiz requests`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Final quiz requests fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### PATCH `/api/teacher/final-quiz-requests/:requestId`
- Auth: Bearer token (teacher or admin)
- Path Params: `requestId`
- Query Params: None
- Body Keys: `action`, `notes`
- Error Messages: `Missing user uid`, `requestId is required`, `action must be approve, reject or complete`, `Request not found`, `Forbidden`, `Failed to update final quiz request`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "action": "<action>",
  "notes": "<notes>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### DELETE `/api/teacher/lectures/:lectureId`
- Auth: Bearer token (teacher or admin)
- Path Params: `lectureId`
- Query Params: None
- Body Keys: None
- Success Messages: `Lecture deleted`
- Error Messages: `Missing teacher uid`, `lectureId is required`, `Failed to delete lecture`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Lecture deleted",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### PUT `/api/teacher/lectures/:lectureId`
- Auth: Bearer token (teacher or admin)
- Path Params: `lectureId`
- Query Params: None
- Body Keys: `title`
- Error Messages: `Missing teacher uid`, `lectureId is required`, `Lecture title must be at least 3 characters`, `Failed to update lecture`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "title": "<title>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### POST `/api/teacher/lectures/:lectureId/content`
- Auth: Bearer token (teacher or admin)
- Path Params: `lectureId`
- Query Params: None
- Body Keys: `duration`, `isLiveSession`, `liveStartAt`, `size`, `title`, `type`, `url`, `videoId`, `videoMode`
- Notes:
  - If `isLiveSession=true` you can pass `liveStartAt` (ISO string). Backend auto-calculates `liveEndAt` from lecture duration and stores both on the lecture.
- Error Messages: `Missing teacher uid`, `lectureId is required`, `type must be video, pdf or book`, `Either videoId or url is required for video content.`, `Content title must be at least 3 characters`, `Content url is required`, `Failed to save lecture content`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### DELETE `/api/teacher/lectures/:lectureId/content/:contentId`
- Auth: Bearer token (teacher or admin)
- Path Params: `contentId`, `lectureId`
- Query Params: None
- Body Keys: `type`
- Success Messages: `Content removed`
- Error Messages: `Missing teacher uid`, `lectureId is required`, `type must be video, pdf or book`, `Failed to delete lecture content`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Content removed",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "type": "<type>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/quizzes`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Teacher quizzes fetched`
- Error Messages: `Missing user uid`, `Failed to fetch quizzes`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Teacher quizzes fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### POST `/api/teacher/quizzes`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: `assignToClassId`, `assignmentTargetType`, `chapterId`, `classId`, `courseId`, `description`, `dueAt`, `isFinalQuiz`, `questions`, `scope`, `subjectId`, `targetType`, `title`
- Error Messages: `Missing user uid`, `scope must be chapter or subject`, `title must be at least 3 characters`, `courseId and subjectId are required`, `chapterId is required for chapter quiz`, `At least one question is required`, `classId is required for class assignment`, `dueAt is required for class assignment`, `Invalid dueAt date/time`, `dueAt must be in the future`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### GET `/api/teacher/quizzes/:quizId`
- Auth: Bearer token (teacher or admin)
- Path Params: `quizId`
- Query Params: None
- Body Keys: None
- Success Messages: `Quiz fetched`
- Error Messages: `Missing user uid`, `quizId is required`, `Failed to fetch quiz`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Quiz fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### GET `/api/teacher/quizzes/:quizId/analytics`
- Auth: Bearer token (teacher or admin)
- Path Params: `quizId`
- Query Params: None
- Body Keys: None
- Error Messages: `Missing user uid`, `quizId is required`, `Failed to fetch quiz analytics`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### PATCH `/api/teacher/quizzes/:quizId/assign`
- Auth: Bearer token (teacher or admin)
- Path Params: `quizId`
- Query Params: None
- Body Keys: `classId`, `courseId`, `dueAt`, `studentIds`, `targetType`
- Error Messages: `Missing user uid`, `quizId is required`, `dueAt is required`, `Invalid dueAt date/time`, `dueAt must be in the future`, `Quiz is missing course/subject linkage`, `Quiz can only be assigned within its own course`, `No students found in this course`, `classId is required for class assignment`, `Class not found`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "classId": "<classId>",
  "courseId": "<courseId>",
  "dueAt": "<dueAt>",
  "studentIds": "<studentIds>",
  "targetType": "<targetType>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### POST `/api/teacher/quizzes/:quizId/evaluate`
- Auth: Bearer token (teacher or admin)
- Path Params: `quizId`
- Query Params: None
- Body Keys: `answers`
- Success Messages: `Quiz evaluated`
- Error Messages: `Missing user uid`, `quizId is required`, `Failed to evaluate quiz answers`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Quiz evaluated",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "answers": "<answers>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### GET `/api/teacher/quizzes/:quizId/submissions`
- Auth: Bearer token (teacher or admin)
- Path Params: `quizId`
- Query Params: None
- Body Keys: None
- Success Messages: `Quiz submissions fetched`
- Error Messages: `Missing user uid`, `quizId is required`, `Failed to fetch quiz submissions`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Quiz submissions fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### POST `/api/teacher/quizzes/:quizId/submissions`
- Auth: Bearer token (teacher or admin)
- Path Params: `quizId`
- Query Params: None
- Body Keys: `answers`
- Error Messages: `Missing student uid`, `quizId is required`, `answers are required`, `Quiz not found`, `You are not enrolled in this quiz course`, `Final quiz is not approved for you yet. Request approval first.`, `This quiz is not assigned to you`, `Quiz deadline has passed`, `Quiz has no questions`, `Failed to submit quiz attempt`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "answers": "<answers>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### PATCH `/api/teacher/quizzes/:quizId/submissions/:resultId/grade-short`
- Auth: Bearer token (teacher or admin)
- Path Params: `quizId`, `resultId`
- Query Params: None
- Body Keys: `gradedAnswers`
- Success Messages: `Short answers graded`
- Error Messages: `Missing user uid`, `quizId and resultId are required`, `Result not found`, `Result does not belong to this quiz`, `Failed to grade short answers`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Short answers graded",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "gradedAnswers": "<gradedAnswers>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### POST `/api/teacher/quizzes/bulk-upload`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: `csvText`
- Success Messages: `Bulk quiz upload completed`
- Error Messages: `Missing user uid`, `CSV file is required`, `CSV header row not found`, `, `, `No question rows found in CSV`, `courseId is required in every row`, `subjectId is required in every row`, `scope must be chapter or subject`, `All rows must belong to same course`, `All rows must belong to same subject`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Bulk quiz upload completed",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "csvText": "<csvText>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### GET `/api/teacher/quizzes/template`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: `chapterId`, `chapterName`, `courseId`, `courseName`, `scope`, `subjectId`, `subjectName`
- Body Keys: None
- Error Messages: `Missing user uid`, `scope must be chapter or subject`, `courseId and subjectId are required`, `chapterId is required for chapter scope`, `Failed to download template`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### GET `/api/teacher/sessions`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Teacher sessions fetched`
- Error Messages: `Missing teacher uid`, `Failed to fetch teacher sessions`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Teacher sessions fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### POST `/api/teacher/sessions`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: `classId`, `courseId`, `date`, `description`, `endTime`, `meetingLink`, `notifyStudents`, `platform`, `startTime`, `topic`
- Success Messages: `Session created`
- Error Messages: `Missing teacher uid`, `classId is required`, `topic must be at least 5 characters`, `date is required`, `date must be today or future`, `startTime is required`, `endTime is required`, `endTime must be after startTime`, `platform is required`, `meetingLink must be a valid URL`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Session created",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/sessions/:sessionId`
- Auth: Bearer token (teacher or admin)
- Path Params: `sessionId`
- Query Params: None
- Body Keys: None
- Success Messages: `Session fetched`
- Error Messages: `Missing teacher uid`, `sessionId is required`, `Failed to fetch session`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Session fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### PUT `/api/teacher/sessions/:sessionId`
- Auth: Bearer token (teacher or admin)
- Path Params: `sessionId`
- Query Params: None
- Body Keys: `date`, `description`, `endTime`, `meetingLink`, `platform`, `startTime`, `topic`
- Success Messages: `Session updated`
- Error Messages: `Missing teacher uid`, `sessionId is required`, `Cannot edit a completed session`, `Cannot edit a cancelled session`, `topic must be at least 5 characters`, `date is required`, `date must be today or future`, `startTime is required`, `endTime is required`, `platform is required`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Session updated",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/sessions/:sessionId/attendance`
- Auth: Bearer token (teacher or admin)
- Path Params: `sessionId`
- Query Params: None
- Body Keys: None
- Error Messages: `Missing teacher uid`, `sessionId is required`, `Session class is missing`, `Class not found`, `You are not assigned to this class attendance`, `You are not assigned to this course attendance`, `You are not assigned to this subject attendance`, `Failed to fetch session attendance`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### POST `/api/teacher/sessions/:sessionId/attendance`
- Auth: Bearer token (teacher or admin)
- Path Params: `sessionId`
- Query Params: None
- Body Keys: `attendance`
- Success Messages: `Attendance saved`
- Error Messages: `Missing teacher uid`, `sessionId is required`, `attendance is required`, `Session class is missing`, `Class not found`, `You are not assigned to this class attendance`, `You are not assigned to this course attendance`, `You are not assigned to this subject attendance`, `Class has no enrolled students`, `studentId is required`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Attendance saved",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "attendance": "<attendance>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### PATCH `/api/teacher/sessions/:sessionId/cancel`
- Auth: Bearer token (teacher or admin)
- Path Params: `sessionId`
- Query Params: None
- Body Keys: `cancelReason`, `notifyStudents`
- Success Messages: `Session cancelled`
- Error Messages: `Missing teacher uid`, `sessionId is required`, `cancelReason must be at least 10 characters`, `Already cancelled`, `Cannot cancel completed session`, `Failed to cancel session`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Session cancelled",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "cancelReason": "<cancelReason>",
  "notifyStudents": "<notifyStudents>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### PATCH `/api/teacher/sessions/:sessionId/complete`
- Auth: Bearer token (teacher or admin)
- Path Params: `sessionId`
- Query Params: None
- Body Keys: `notes`
- Success Messages: `Session marked as complete`
- Error Messages: `Missing teacher uid`, `sessionId is required`, `Cannot complete a cancelled session`, `Failed to complete session`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Session marked as complete",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "notes": "<notes>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/settings/profile`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Teacher profile settings fetched`
- Error Messages: `Missing teacher uid`, `User not found`, `Failed to fetch teacher profile settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Teacher profile settings fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### PUT `/api/teacher/settings/profile`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: `bio`, `fullName`, `phoneNumber`, `profilePicture`, `subject`
- Success Messages: `Teacher profile settings updated`
- Error Messages: `Missing teacher uid`, `fullName must be at least 2 characters`, `subject cannot exceed 120 characters`, `bio cannot exceed 500 characters`, `phoneNumber must be 03001234567 or +923001234567 format`, `User not found`, `Failed to update teacher profile settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Teacher profile settings updated",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "bio": "<bio>",
  "fullName": "<fullName>",
  "phoneNumber": "<phoneNumber>",
  "profilePicture": "<profilePicture>",
  "subject": "<subject>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/settings/security`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Error Messages: `Missing teacher uid`, `Failed to fetch teacher security settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### PATCH `/api/teacher/settings/security/sessions/:sessionDocId/revoke`
- Auth: Bearer token (teacher or admin)
- Path Params: `sessionDocId`
- Query Params: None
- Body Keys: None
- Success Messages: `Session revoked successfully`
- Error Messages: `Missing teacher uid`, `sessionDocId is required`, `Session not found`, `Forbidden`, `Session is already revoked`, `Failed to revoke session`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Session revoked successfully",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### PATCH `/api/teacher/settings/security/sessions/revoke-all`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `No active sessions found`, `No other active sessions found`, `Other sessions revoked successfully`
- Error Messages: `Missing teacher uid`, `Failed to revoke sessions`
- Sample Success Response:

```json
{
  "success": true,
  "message": "No active sessions found",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/students`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Students fetched`, `Teacher students fetched`
- Error Messages: `Missing teacher uid`, `Failed to fetch teacher students`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Students fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/students/:studentId`
- Auth: Bearer token (teacher or admin)
- Path Params: `studentId`
- Query Params: None
- Body Keys: None
- Error Messages: `Missing teacher uid`, `studentId is required`, `Not your student`, `Failed to fetch student profile`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/students/:studentId/attendance/:classId`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Student attendance fetched`
- Error Messages: `Missing student uid`, `Failed to fetch attendance`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Student attendance fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### GET `/api/teacher/students/:studentId/progress/:courseId`
- Auth: Bearer token (teacher or admin)
- Path Params: `courseId`, `studentId`
- Query Params: None
- Body Keys: None
- Error Messages: `Missing teacher uid`, `studentId and courseId are required`, `Student is not enrolled in this course`, `Failed to fetch student progress`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### PATCH `/api/teacher/students/:studentId/video-access`
- Auth: Bearer token (teacher or admin)
- Path Params: `studentId`
- Query Params: None
- Body Keys: `lectureAccess`
- Success Messages: `Video access updated`
- Error Messages: `Missing teacher uid`, `studentId is required`, `lectureAccess is required`, `Failed to update student video access`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Video access updated",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "lectureAccess": "<lectureAccess>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/timetable`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Error Messages: `Missing teacher uid`, `Failed to fetch teacher timetable`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing teacher uid",
  "error": "Missing teacher uid"
}
```

### GET `/api/teacher/videos`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Video library fetched`
- Error Messages: `Missing user uid`, `Failed to fetch video library`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Video library fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### POST `/api/teacher/videos`
- Auth: Bearer token (teacher or admin)
- Path Params: None
- Query Params: None
- Body Keys: `courseId`, `courseName`, `isActive`, `isLiveSession`, `teacherId`, `teacherName`, `url`, `videoMode`
- Error Messages: `Missing user uid`, `title must be at least 3 characters`, `url is required`, `courseId is required`, `Course not found`, `You are not assigned to this course`, `Failed to add video to library`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

## Admin APIs

### GET `/api/admin/analytics-report`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Error Messages: `Failed to generate report`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to generate report",
  "error": "Failed to generate report"
}
```

### GET `/api/admin/announcements`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Announcements fetched`
- Error Messages: `Failed to fetch announcements`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Announcements fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch announcements",
  "error": "Failed to fetch announcements"
}
```

### POST `/api/admin/announcements`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `audienceRole`, `isPinned`, `message`, `sendEmail`, `targetId`, `targetType`
- Success Messages: `Announcement posted`
- Error Messages: `Title must be between 5 and 100 characters`, `Message must be at least 10 characters`, `targetType must be system, class, course, or single_user`, `audienceRole must be student, teacher, admin, or all`, `targetId is required for class/course/single_user target`, `Class/Course announcements can only target students or all`, `Class not found`, `Course not found`, `User is required`, `Selected user not found`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Announcement posted",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "Title must be between 5 and 100 characters",
  "error": "Title must be between 5 and 100 characters"
}
```

### DELETE `/api/admin/announcements/:id`
- Auth: Bearer token (admin)
- Path Params: `announcementId`, `id`
- Query Params: None
- Body Keys: None
- Success Messages: `Announcement deleted`
- Error Messages: `Announcement not found`, `Failed to delete announcement`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Announcement deleted",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Announcement not found",
  "error": "Announcement not found"
}
```

### PUT `/api/admin/announcements/:id`
- Auth: Bearer token (admin)
- Path Params: `announcementId`, `id`
- Query Params: None
- Body Keys: `isPinned`, `message`
- Error Messages: `Announcement not found`, `Title must be between 5 and 100 characters`, `Message must be at least 10 characters`, `Failed to update announcement`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "isPinned": "<isPinned>",
  "message": "<message>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Announcement not found",
  "error": "Announcement not found"
}
```

### PATCH `/api/admin/announcements/:id/pin`
- Auth: Bearer token (admin)
- Path Params: `announcementId`, `id`
- Query Params: None
- Body Keys: `isPinned`
- Success Messages: `pinned`
- Error Messages: `Announcement not found`, `Failed to toggle pin`
- Sample Success Response:

```json
{
  "success": true,
  "message": "pinned",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "isPinned": "<isPinned>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Announcement not found",
  "error": "Announcement not found"
}
```

### GET `/api/admin/certificates`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Certificates fetched`
- Error Messages: `Failed to fetch certificates`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Certificates fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch certificates",
  "error": "Failed to fetch certificates"
}
```

### POST `/api/admin/certificates`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `allowIncomplete`, `courseId`, `forceGenerate`
- Success Messages: `Certificate already exists`
- Error Messages: `studentId and courseId are required`, `Student or course not found`, `Student is not enrolled in this course`, `Student has not completed this course. Confirm override to generate anyway.`, `Certificate will be available after class completion, class end date, or teacher completion mark.`, `Failed to generate certificate`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Certificate already exists",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "allowIncomplete": "<allowIncomplete>",
  "courseId": "<courseId>",
  "forceGenerate": "<forceGenerate>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "studentId and courseId are required",
  "error": "studentId and courseId are required"
}
```

### PATCH `/api/admin/certificates/:certId/revoke`
- Auth: Bearer token (admin)
- Path Params: `certId`
- Query Params: None
- Body Keys: None
- Success Messages: `Certificate revoked`
- Error Messages: `Certificate not found`, `Failed to revoke certificate`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Certificate revoked",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Certificate not found",
  "error": "Certificate not found"
}
```

### PATCH `/api/admin/certificates/:certId/unrevoke`
- Auth: Bearer token (admin)
- Path Params: `certId`
- Query Params: None
- Body Keys: None
- Success Messages: `Certificate is already active`, `Certificate unrevoked`
- Error Messages: `Certificate not found`, `Failed to unrevoke certificate`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Certificate is already active",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Certificate not found",
  "error": "Certificate not found"
}
```

### GET `/api/admin/classes`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Classes fetched`
- Error Messages: `Failed to fetch classes`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Classes fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch classes",
  "error": "Failed to fetch classes"
}
```

### POST `/api/admin/classes`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `assignedCourses`, `batchCode`, `capacity`, `description`, `endDate`, `shifts`, `startDate`, `status`
- Success Messages: `Class created`
- Error Messages: `Class name must be at least 3 characters`, `Capacity must be between 1 and 1000`, `At least 1 course is required`, `At least 1 shift is required`, `, `, `Failed to create class`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Class created",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "Class name must be at least 3 characters",
  "error": "Class name must be at least 3 characters"
}
```

### DELETE `/api/admin/classes/:classId`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Class deleted`
- Error Messages: `Class not found`, `Cannot delete class while it has students, courses, or teachers assigned`, `Failed to delete class`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Class deleted",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found"
}
```

### PUT `/api/admin/classes/:classId`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `assignedCourses`, `batchCode`, `capacity`, `description`, `endDate`, `name`, `shifts`, `startDate`, `status`
- Success Messages: `Class updated`
- Error Messages: `Class not found`, `Class name must be at least 3 characters`, `Capacity must be between 1 and 1000`, `Capacity cannot be smaller than current enrolled students`, `At least 1 course is required`, `At least 1 shift is required`, `Remove or update shifts that use removed courses first`, `, `, `Failed to update class`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Class updated",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found"
}
```

### POST `/api/admin/classes/:classId/courses`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `courseId`
- Success Messages: `Course assigned to class`
- Error Messages: `courseId is required`, `Class not found`, `Course already assigned to class`, `Course not found`, `Failed to assign course`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Course assigned to class",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "courseId": "<courseId>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "courseId is required",
  "error": "courseId is required"
}
```

### DELETE `/api/admin/classes/:classId/courses/:courseId`
- Auth: Bearer token (admin)
- Path Params: `courseId`
- Query Params: None
- Body Keys: None
- Success Messages: `Course removed from class`
- Error Messages: `Class not found`, `Course not assigned to class`, `Remove shifts linked to this course first`, `Failed to remove course`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Course removed from class",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found"
}
```

### POST `/api/admin/classes/:classId/enroll`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `courseId`, `enrollmentType`, `paymentId`, `shiftId`, `studentId`
- Success Messages: `full_class`
- Error Messages: `studentId is required`, `enrollmentType must be full_class or single_course`, `courseId is required for single_course enrollment`, `Class not found`, `Student not found`, `Student is already enrolled in this class/course`, `CLASS_FULL`, `Shift not found`, `This class has no assigned courses`, `Selected course is not assigned to this class`
- Sample Success Response:

```json
{
  "success": true,
  "message": "full_class",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "courseId": "<courseId>",
  "enrollmentType": "<enrollmentType>",
  "paymentId": "<paymentId>",
  "shiftId": "<shiftId>",
  "studentId": "<studentId>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "studentId is required",
  "error": "studentId is required"
}
```

### POST `/api/admin/classes/:classId/shifts`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Shift added`
- Error Messages: `Class not found`, `Assign at least one course before adding shifts`, `Failed to add shift`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Shift added",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found"
}
```

### DELETE `/api/admin/classes/:classId/shifts/:shiftId`
- Auth: Bearer token (admin)
- Path Params: `shiftId`
- Query Params: None
- Body Keys: None
- Success Messages: `Shift removed`
- Error Messages: `Class not found`, `Shift not found`, `Remove students from this shift before deleting it`, `Failed to remove shift`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Shift removed",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found"
}
```

### PUT `/api/admin/classes/:classId/shifts/:shiftId`
- Auth: Bearer token (admin)
- Path Params: `shiftId`
- Query Params: None
- Body Keys: None
- Success Messages: `Shift updated`
- Error Messages: `Class not found`, `Shift not found`, `Failed to update shift`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Shift updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found"
}
```

### GET `/api/admin/classes/:classId/students`
- Auth: Bearer token (admin or student)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Class students fetched`
- Error Messages: `Class not found`, `Failed to fetch class students`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Class students fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found"
}
```

### POST `/api/admin/classes/:classId/students`
- Auth: Bearer token (admin or student)
- Path Params: None
- Query Params: None
- Body Keys: `courseId`, `enrollmentType`, `paymentId`, `shiftId`, `studentId`
- Success Messages: `full_class`
- Error Messages: `studentId is required`, `shiftId is required`, `enrollmentType must be full_class or single_course`, `courseId is required for single_course enrollment`, `Class not found`, `Student not found`, `Student is already enrolled in this class/course`, `CLASS_FULL`, `Shift not found`, `Cannot enroll student. This class has already ended.`
- Sample Success Response:

```json
{
  "success": true,
  "message": "full_class",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "courseId": "<courseId>",
  "enrollmentType": "<enrollmentType>",
  "paymentId": "<paymentId>",
  "shiftId": "<shiftId>",
  "studentId": "<studentId>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "studentId is required",
  "error": "studentId is required"
}
```

### DELETE `/api/admin/classes/:classId/students/:studentId`
- Auth: Bearer token (admin)
- Path Params: `studentId`
- Query Params: None
- Body Keys: None
- Error Messages: `Class not found`, `Student is not enrolled in this class`, `Failed to remove student`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Class not found",
  "error": "Class not found"
}
```

### GET `/api/admin/courses`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Courses fetched`
- Error Messages: `Failed to fetch courses`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Courses fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch courses",
  "error": "Failed to fetch courses"
}
```

### POST `/api/admin/courses`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `category`, `description`, `discountPercent`, `hasCertificate`, `level`, `price`, `shortDescription`, `status`, `subjects`, `thumbnail`
- Success Messages: `Course created`
- Error Messages: `Title must be at least 5 characters`, `At least one subject is required`, `Failed to create course`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Course created",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "Title must be at least 5 characters",
  "error": "Title must be at least 5 characters"
}
```

### DELETE `/api/admin/courses/:courseId`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Course deleted`
- Error Messages: `Cannot delete course while linked to classes, teachers, students, or quizzes`, `Failed to delete course`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Course deleted",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Cannot delete course while linked to classes, teachers, students, or quizzes",
  "error": "Cannot delete course while linked to classes, teachers, students, or quizzes"
}
```

### PATCH `/api/admin/courses/:courseId`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Course updated`
- Error Messages: `Failed to update course`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Course updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to update course",
  "error": "Failed to update course"
}
```

### PUT `/api/admin/courses/:courseId`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Course updated`
- Error Messages: `Failed to update course`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Course updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to update course",
  "error": "Failed to update course"
}
```

### GET `/api/admin/courses/:courseId/content`
- Auth: Bearer token (admin)
- Path Params: `courseId`
- Query Params: None
- Body Keys: None
- Error Messages: `courseId is required`, `Missing student uid`, `Failed to fetch course content`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "courseId is required",
  "error": "courseId is required"
}
```

### DELETE `/api/admin/courses/:courseId/content/:contentId`
- Auth: Bearer token (admin)
- Path Params: `contentId`
- Query Params: None
- Body Keys: None
- Success Messages: `Content deleted`
- Error Messages: `Failed to delete content`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Content deleted",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to delete content",
  "error": "Failed to delete content"
}
```

### PATCH `/api/admin/courses/:courseId/students/:studentId/rewatch-access`
- Auth: Bearer token (admin)
- Path Params: `courseId`, `studentId`
- Query Params: None
- Body Keys: `lockAfterCompletion`, `unlocked`
- Error Messages: `Missing user uid`, `courseId and studentId are required`, `No class enrollment found for this student in the selected course`, `Failed to update rewatch access`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "lockAfterCompletion": "<lockAfterCompletion>",
  "unlocked": "<unlocked>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### POST `/api/admin/courses/:courseId/subjects`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `name`, `order`, `teacherId`
- Success Messages: `Subject added`
- Error Messages: `Subject name and teacher are required`, `Teacher not found`, `Course not found`, `Failed to add subject`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Subject added",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "name": "<name>",
  "order": "<order>",
  "teacherId": "<teacherId>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Subject name and teacher are required",
  "error": "Subject name and teacher are required"
}
```

### DELETE `/api/admin/courses/:courseId/subjects/:subjectId`
- Auth: Bearer token (admin)
- Path Params: `subjectId`
- Query Params: None
- Body Keys: None
- Success Messages: `Subject removed`
- Error Messages: `Cannot remove subject while linked to content or quizzes`, `Course not found`, `Subject not found`, `Failed to remove subject`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Subject removed",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Cannot remove subject while linked to content or quizzes",
  "error": "Cannot remove subject while linked to content or quizzes"
}
```

### POST `/api/admin/courses/:courseId/subjects/:subjectId/content`
- Auth: Bearer token (admin)
- Path Params: `subjectId`
- Query Params: None
- Body Keys: `contentType`, `isLiveSession`, `liveStartAt`, `noteType`, `size`, `title`, `type`, `url`, `videoId`
- Notes:
  - If the selected gallery video is a Live Session (`isLiveSession=true`), you can pass `liveStartAt` (ISO string).
  - Backend stores `liveStartAt` and auto-calculates `liveEndAt` using the gallery video `durationSec`.
- Success Messages: `Content added`
- Error Messages: `type is required`, `Invalid content type`, `Course not found`, `Subject not found`, `Video not found in library`, `Selected video has no URL`, `title and url are required (or pass valid videoId)`, `Failed to add content`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Content added",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "type is required",
  "error": "type is required"
}
```

### GET `/api/admin/final-quiz-requests`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: `courseId`, `status`
- Body Keys: None
- Success Messages: `Final quiz requests fetched`
- Error Messages: `Missing user uid`, `Failed to fetch final quiz requests`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Final quiz requests fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### PATCH `/api/admin/final-quiz-requests/:requestId`
- Auth: Bearer token (admin)
- Path Params: `requestId`
- Query Params: None
- Body Keys: `action`, `notes`
- Error Messages: `Missing user uid`, `requestId is required`, `action must be approve, reject or complete`, `Request not found`, `Forbidden`, `Failed to update final quiz request`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "action": "<action>",
  "notes": "<notes>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### GET `/api/admin/installments`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: `search`
- Body Keys: None
- Success Messages: `Installments fetched`
- Error Messages: `Failed to fetch installments`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Installments fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch installments",
  "error": "Failed to fetch installments"
}
```

### POST `/api/admin/installments`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `classId`, `courseId`, `numberOfInstallments`, `startDate`, `totalAmount`
- Success Messages: `Installment plan created`
- Error Messages: `studentId, courseId, totalAmount, numberOfInstallments are required`, `Installments must be between 2 and 6`, `Amount must be positive`, `Student not found`, `Course not found`, `Class not found`, `Failed to create installment plan`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Installment plan created",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "classId": "<classId>",
  "courseId": "<courseId>",
  "numberOfInstallments": "<numberOfInstallments>",
  "startDate": "<startDate>",
  "totalAmount": "<totalAmount>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "studentId, courseId, totalAmount, numberOfInstallments are required",
  "error": "studentId, courseId, totalAmount, numberOfInstallments are required"
}
```

### GET `/api/admin/installments/:planId`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Installment plan fetched`
- Error Messages: `Installment plan not found`, `Failed to fetch installment plan`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Installment plan fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Installment plan not found",
  "error": "Installment plan not found"
}
```

### PATCH `/api/admin/installments/:planId/:number/pay`
- Auth: Bearer token (admin)
- Path Params: `installmentNumber`, `number`, `planId`
- Query Params: None
- Body Keys: None
- Success Messages: `Installment marked paid`
- Error Messages: `planId and installment number are required`, `Plan not found`, `Installment not found in this plan`, `Installment already marked as paid`, `Failed to mark installment paid`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Installment marked paid",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "planId and installment number are required",
  "error": "planId and installment number are required"
}
```

### PUT `/api/admin/installments/:planId/override`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `installments`
- Success Messages: `Installment schedule updated`
- Error Messages: `installments array is required`, `Installment plan not found`, `Each installment amount must be a positive number`, `Each installment dueDate must be valid`, `Unpaid installment due dates must be today or future`, `Failed to override installment schedule`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Installment schedule updated",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "installments": "<installments>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "installments array is required",
  "error": "installments array is required"
}
```

### POST `/api/admin/installments/send-reminders`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Error Messages: `Failed to send reminders`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to send reminders",
  "error": "Failed to send reminders"
}
```

### GET `/api/admin/payments`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: `includeAwaitingReceipt`
- Body Keys: None
- Success Messages: `Admin payments fetched`
- Error Messages: `Failed to fetch admin payments`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Admin payments fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch admin payments",
  "error": "Failed to fetch admin payments"
}
```

### PATCH `/api/admin/payments/:id/verify`
- Auth: Bearer token (admin)
- Path Params: `id`, `paymentId`
- Query Params: None
- Body Keys: `action`
- Success Messages: `paid`, `rejected`
- Error Messages: `paymentId is required`, `Action must be approve or reject`, `Payment not found`, `Receipt is required before approval. Ask student to upload receipt first.`, `Payment record is missing studentId. Please recreate payment request.`, `Payment is missing class/course reference. Please recreate payment request.`, `Payment cannot be approved until receipt is uploaded.`, `Only receipt-submitted requests can be approved`, `Paid payment cannot be rejected`, `Only pending requests can be rejected`
- Sample Success Response:

```json
{
  "success": true,
  "message": "paid",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "action": "<action>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "paymentId is required",
  "error": "paymentId is required"
}
```

### PATCH `/api/admin/payments/:paymentId/verify`
- Auth: Bearer token (admin)
- Path Params: `id`, `paymentId`
- Query Params: None
- Body Keys: `action`
- Success Messages: `paid`, `rejected`
- Error Messages: `paymentId is required`, `Action must be approve or reject`, `Payment not found`, `Receipt is required before approval. Ask student to upload receipt first.`, `Payment record is missing studentId. Please recreate payment request.`, `Payment is missing class/course reference. Please recreate payment request.`, `Payment cannot be approved until receipt is uploaded.`, `Only receipt-submitted requests can be approved`, `Paid payment cannot be rejected`, `Only pending requests can be rejected`
- Sample Success Response:

```json
{
  "success": true,
  "message": "paid",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "action": "<action>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "paymentId is required",
  "error": "paymentId is required"
}
```

### GET `/api/admin/promo-codes`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Promo codes fetched`
- Error Messages: `Failed to fetch promo codes`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Promo codes fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch promo codes",
  "error": "Failed to fetch promo codes"
}
```

### POST `/api/admin/promo-codes`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `courseId`, `discountType`, `discountValue`, `expiresAt`, `isActive`, `isSingleUse`, `usageLimit`
- Success Messages: `Promo code created`
- Error Messages: `Code must be at least 4 characters`, `Code must be alphanumeric only`, `discountType must be percentage or fixed`, `discountValue must be a positive number`, `Percentage discount must be between 1 and 100`, `usageLimit must be 0 or a positive number`, `Invalid expiresAt date`, `expiresAt must be a future date`, `Course not found`, `Code already exists`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Promo code created",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "Code must be at least 4 characters",
  "error": "Code must be at least 4 characters"
}
```

### DELETE `/api/admin/promo-codes/:codeId`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Promo code deleted`
- Error Messages: `Promo code not found`, `Cannot delete used promo code. Deactivate it instead.`, `Failed to delete promo code`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Promo code deleted",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Promo code not found",
  "error": "Promo code not found"
}
```

### PUT `/api/admin/promo-codes/:codeId`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `code`, `createdAt`, `discountValue`, `expiresAt`, `isActive`, `isSingleUse`, `usageCount`, `usageLimit`
- Error Messages: `Promo code not found`, `Cannot update code, usageCount, or createdAt fields`, `, `, `discountValue must be positive`, `Percentage discount must be between 1 and 100`, `usageLimit must be 0 or positive`, `usageLimit cannot be less than current usageCount`, `Invalid expiresAt date`, `expiresAt must be a future date`, `Failed to update promo code`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "Promo code not found",
  "error": "Promo code not found"
}
```

### PATCH `/api/admin/promo-codes/:codeId/toggle`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `isActive`
- Success Messages: `activated`
- Error Messages: `isActive boolean is required`, `Promo code not found`, `Failed to toggle promo code`
- Sample Success Response:

```json
{
  "success": true,
  "message": "activated",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "isActive": "<isActive>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "isActive boolean is required",
  "error": "isActive boolean is required"
}
```

### POST `/api/admin/promo-codes/validate`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `courseId`, `studentId`
- Error Messages: `Promo code is required`, `Invalid promo code`, `Promo code is inactive`, `Promo code has expired`, `Promo code usage limit reached`, `Promo code not valid for this course`, `You have already used this promo code`, `Failed to validate promo code`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "courseId": "<courseId>",
  "studentId": "<studentId>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Promo code is required",
  "error": "Promo code is required"
}
```

### GET `/api/admin/quizzes`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Teacher quizzes fetched`
- Error Messages: `Missing user uid`, `Failed to fetch quizzes`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Teacher quizzes fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### POST `/api/admin/quizzes`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `assignToClassId`, `assignmentTargetType`, `chapterId`, `classId`, `courseId`, `description`, `dueAt`, `isFinalQuiz`, `questions`, `scope`, `subjectId`, `targetType`, `title`
- Error Messages: `Missing user uid`, `scope must be chapter or subject`, `title must be at least 3 characters`, `courseId and subjectId are required`, `chapterId is required for chapter quiz`, `At least one question is required`, `classId is required for class assignment`, `dueAt is required for class assignment`, `Invalid dueAt date/time`, `dueAt must be in the future`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### GET `/api/admin/quizzes/:quizId`
- Auth: Bearer token (admin)
- Path Params: `quizId`
- Query Params: None
- Body Keys: None
- Success Messages: `Quiz fetched`
- Error Messages: `Missing user uid`, `quizId is required`, `Failed to fetch quiz`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Quiz fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### GET `/api/admin/quizzes/:quizId/analytics`
- Auth: Bearer token (admin)
- Path Params: `quizId`
- Query Params: None
- Body Keys: None
- Error Messages: `Missing user uid`, `quizId is required`, `Failed to fetch quiz analytics`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### PATCH `/api/admin/quizzes/:quizId/assign`
- Auth: Bearer token (admin)
- Path Params: `quizId`
- Query Params: None
- Body Keys: `classId`, `courseId`, `dueAt`, `studentIds`, `targetType`
- Error Messages: `Missing user uid`, `quizId is required`, `dueAt is required`, `Invalid dueAt date/time`, `dueAt must be in the future`, `Quiz is missing course/subject linkage`, `Quiz can only be assigned within its own course`, `No students found in this course`, `classId is required for class assignment`, `Class not found`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "classId": "<classId>",
  "courseId": "<courseId>",
  "dueAt": "<dueAt>",
  "studentIds": "<studentIds>",
  "targetType": "<targetType>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### GET `/api/admin/quizzes/:quizId/submissions`
- Auth: Bearer token (admin)
- Path Params: `quizId`
- Query Params: None
- Body Keys: None
- Success Messages: `Quiz submissions fetched`
- Error Messages: `Missing user uid`, `quizId is required`, `Failed to fetch quiz submissions`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Quiz submissions fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### POST `/api/admin/quizzes/bulk-upload`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `csvText`
- Success Messages: `Bulk quiz upload completed`
- Error Messages: `Missing user uid`, `CSV file is required`, `CSV header row not found`, `, `, `No question rows found in CSV`, `courseId is required in every row`, `subjectId is required in every row`, `scope must be chapter or subject`, `All rows must belong to same course`, `All rows must belong to same subject`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Bulk quiz upload completed",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "csvText": "<csvText>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### GET `/api/admin/quizzes/template`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: `chapterId`, `chapterName`, `courseId`, `courseName`, `scope`, `subjectId`, `subjectName`
- Body Keys: None
- Error Messages: `Missing user uid`, `scope must be chapter or subject`, `courseId and subjectId are required`, `chapterId is required for chapter scope`, `Failed to download template`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing user uid",
  "error": "Missing user uid"
}
```

### GET `/api/admin/recent-activity`
- Auth: Bearer token (admin)
- Path Params: `id`, `uid`
- Query Params: None
- Body Keys: None
- Success Messages: `Activity fetched`
- Error Messages: `Failed to fetch activity`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Activity fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch activity",
  "error": "Failed to fetch activity"
}
```

### GET `/api/admin/recent-enrollments`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Enrollments fetched`
- Error Messages: `Failed to fetch enrollments`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Enrollments fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch enrollments",
  "error": "Failed to fetch enrollments"
}
```

### GET `/api/admin/revenue-chart`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: `days`
- Body Keys: None
- Success Messages: `Revenue chart fetched`
- Error Messages: `Failed to fetch revenue`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Revenue chart fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch revenue",
  "error": "Failed to fetch revenue"
}
```

### GET `/api/admin/settings`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Server error",
  "error": "Server error"
}
```

### PUT `/api/admin/settings/about`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `About settings updated`
- Error Messages: `About heading is required`, `Failed to update about settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "About settings updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "About heading is required",
  "error": "About heading is required"
}
```

### PUT `/api/admin/settings/appearance`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Appearance settings updated`
- Error Messages: `Failed to update appearance settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Appearance settings updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to update appearance settings",
  "error": "Failed to update appearance settings"
}
```

### PUT `/api/admin/settings/certificate`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Certificate settings updated`
- Error Messages: `Failed to update certificate settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Certificate settings updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to update certificate settings",
  "error": "Failed to update certificate settings"
}
```

### PUT `/api/admin/settings/contact`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Contact settings updated`
- Error Messages: `contact email must be valid`, `Failed to update contact settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Contact settings updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "contact email must be valid",
  "error": "contact email must be valid"
}
```

### PUT `/api/admin/settings/email`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Email settings updated`
- Error Messages: `smtpHost is required`, `smtpPort must be a valid port number`, `smtpEmail must be a valid email`, `Failed to update email settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Email settings updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "smtpHost is required",
  "error": "smtpHost is required"
}
```

### POST `/api/admin/settings/email/test`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Test email sent successfully`
- Error Messages: `testEmail must be valid`, `Email settings are incomplete`, `Unknown error`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Test email sent successfully",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "testEmail must be valid",
  "error": "testEmail must be valid"
}
```

### PUT `/api/admin/settings/features`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Features updated`
- Error Messages: `Features heading is required`, `At least one feature is required`, `You can add up to 8 features only`, `Failed to update features`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Features updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Features heading is required",
  "error": "Features heading is required"
}
```

### PUT `/api/admin/settings/footer`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Footer settings updated`
- Error Messages: `Failed to update footer settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Footer settings updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to update footer settings",
  "error": "Failed to update footer settings"
}
```

### PUT `/api/admin/settings/general`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `General settings updated`
- Error Messages: `siteName must be at least 3 characters`, `contactEmail must be a valid email`, `Failed to update general settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "General settings updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "siteName must be at least 3 characters",
  "error": "siteName must be at least 3 characters"
}
```

### PUT `/api/admin/settings/hero`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Hero settings updated`
- Error Messages: `Hero heading must be at least 5 characters`, `At least one hero stat is required`, `Failed to update hero settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Hero settings updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Hero heading must be at least 5 characters",
  "error": "Hero heading must be at least 5 characters"
}
```

### PUT `/api/admin/settings/how-it-works`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `How It Works updated`
- Error Messages: `How It Works heading is required`, `At least one step is required`, `Failed to update How It Works`
- Sample Success Response:

```json
{
  "success": true,
  "message": "How It Works updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "How It Works heading is required",
  "error": "How It Works heading is required"
}
```

### PUT `/api/admin/settings/maintenance`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Maintenance settings updated`
- Error Messages: `Failed to update maintenance settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Maintenance settings updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to update maintenance settings",
  "error": "Failed to update maintenance settings"
}
```

### PUT `/api/admin/settings/payment`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Payment settings updated`
- Error Messages: `Failed to update payment settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Payment settings updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to update payment settings",
  "error": "Failed to update payment settings"
}
```

### PUT `/api/admin/settings/security`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Security settings updated`
- Error Messages: `maxLoginAttempts must be between 3 and 10`, `lockoutDuration must be between 5 and 60`, `sessionTimeout must be a positive number`, `Failed to update security settings`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Security settings updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "maxLoginAttempts must be between 3 and 10",
  "error": "maxLoginAttempts must be between 3 and 10"
}
```

### GET `/api/admin/settings/templates`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Email templates fetched`
- Error Messages: `Failed to fetch email templates`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Email templates fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch email templates",
  "error": "Failed to fetch email templates"
}
```

### PUT `/api/admin/settings/templates`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `body`, `subject`
- Success Messages: `Template updated`
- Error Messages: `templateName is required`, `subject is required`, `body is required`, `Failed to update email template`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Template updated",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "body": "<body>",
  "subject": "<subject>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "templateName is required",
  "error": "templateName is required"
}
```

### PUT `/api/admin/settings/testimonials`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Testimonials updated`
- Error Messages: `Testimonials heading is required`, `At least one testimonial is required`, `Failed to update testimonials`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Testimonials updated",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Testimonials heading is required",
  "error": "Testimonials heading is required"
}
```

### GET `/api/admin/stats`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Stats fetched`
- Error Messages: `Failed to fetch stats`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Stats fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch stats",
  "error": "Failed to fetch stats"
}
```

### GET `/api/admin/students`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Students fetched`
- Error Messages: `Failed to fetch students`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Students fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch students",
  "error": "Failed to fetch students"
}
```

### GET `/api/admin/students/:uid`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Error Messages: `uid is required`, `Student not found`, `Failed to fetch student`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "uid is required",
  "error": "uid is required"
}
```

### PATCH `/api/admin/students/:uid/approve`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Student approved successfully`
- Error Messages: `Failed to approve student`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Student approved successfully",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to approve student",
  "error": "Failed to approve student"
}
```

### PATCH `/api/admin/students/:uid/payment-rejections/reset`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Student payment reject lock has been reset`
- Error Messages: `uid is required`, `Student not found`, `Failed to reset student payment lock`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Student payment reject lock has been reset",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "uid is required",
  "error": "uid is required"
}
```

### GET `/api/admin/students/:uid/progress`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Error Messages: `uid is required`, `Student not found`, `Failed to fetch student progress`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "uid is required",
  "error": "uid is required"
}
```

### PATCH `/api/admin/students/:uid/reject`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `reason`
- Success Messages: `Student rejected`
- Error Messages: `Failed to reject student`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Student rejected",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "reason": "<reason>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to reject student",
  "error": "Failed to reject student"
}
```

### POST `/api/admin/students/bulk-upload`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `csvText`
- Success Messages: `Students bulk upload completed with some failures`
- Error Messages: `CSV file is required`, `CSV header row not found`, `CSV must include name column`, `, `, `No student rows found in CSV`, `CSV validation failed`, `No students were created`, `Failed to bulk upload students`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Students bulk upload completed with some failures",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "csvText": "<csvText>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "CSV file is required",
  "error": "CSV file is required"
}
```

### GET `/api/admin/students/template`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Error Messages: `Failed to download students template`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to download students template",
  "error": "Failed to download students template"
}
```

### GET `/api/admin/support/messages`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: `search`, `source`, `status`
- Body Keys: None
- Success Messages: `Support messages fetched`
- Error Messages: `Failed to fetch support messages`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Support messages fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch support messages",
  "error": "Failed to fetch support messages"
}
```

### DELETE `/api/admin/support/messages/:messageId`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Support message deleted`
- Error Messages: `Support message not found`, `Failed to delete support message`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Support message deleted",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Support message not found",
  "error": "Support message not found"
}
```

### PATCH `/api/admin/support/messages/:messageId/read`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `isRead`
- Success Messages: `Message marked as read`
- Error Messages: `Support message not found`, `Failed to update message status`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Message marked as read",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "isRead": "<isRead>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Support message not found",
  "error": "Support message not found"
}
```

### POST `/api/admin/support/messages/:messageId/reply`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `replyMessage`
- Success Messages: `replied`
- Error Messages: `Reply must be at least 3 characters`, `Support message not found`, `Recipient email is invalid`, `Failed to send reply`
- Sample Success Response:

```json
{
  "success": true,
  "message": "replied",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "replyMessage": "<replyMessage>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Reply must be at least 3 characters",
  "error": "Reply must be at least 3 characters"
}
```

### GET `/api/admin/teachers`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Teachers fetched`
- Error Messages: `Failed to fetch teachers`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Teachers fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch teachers",
  "error": "Failed to fetch teachers"
}
```

### GET `/api/admin/teachers/:uid`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Error Messages: `uid is required`, `Teacher not found`, `Failed to fetch teacher`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "uid is required",
  "error": "uid is required"
}
```

### GET `/api/admin/top-courses`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Top courses fetched`
- Error Messages: `Failed to fetch courses`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Top courses fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch courses",
  "error": "Failed to fetch courses"
}
```

### GET `/api/admin/users`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: `isActive`, `search`
- Body Keys: None
- Success Messages: `Users fetched`
- Error Messages: `Failed to fetch users`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Users fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch users",
  "error": "Failed to fetch users"
}
```

### POST `/api/admin/users`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `bio`, `email`, `password`, `phone`, `role`, `subject`
- Error Messages: `All fields required`, `Invalid role`, `Enter a valid email address`, `Phone must be 03001234567 or +923001234567 format`, `Email already in use`, `Failed to create user`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "All fields required",
  "error": "All fields required"
}
```

### DELETE `/api/admin/users/:uid`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `User deleted from authentication and database`
- Error Messages: `User not found`, `Admin cannot delete their own account`, `Cannot delete teacher while assigned to courses, classes, or subjects`, `Failed to delete user from authentication. No database changes were made.`, `Failed to delete user`
- Sample Success Response:

```json
{
  "success": true,
  "message": "User deleted from authentication and database",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "User not found",
  "error": "User not found"
}
```

### GET `/api/admin/users/:uid`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Error Messages: `uid is required`, `User not found`, `Failed to fetch user`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "uid is required",
  "error": "uid is required"
}
```

### PUT `/api/admin/users/:uid`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `address`, `bio`, `caste`, `confirmPassword`, `district`, `domicile`, `email`, `fatherName`, `fatherOccupation`, `fatherPhone`, `fullName`, `isActive`, `name`, `password`, `phone`, `phoneNumber`, `subject`
- Success Messages: `,
        email: nextEmail || userData.email || `
- Error Messages: `User not found`, `Enter a valid email address`, `Password cannot be empty`, `Password must be at least 6 characters`, `Passwords do not match`, `Phone must be 03001234567 or +923001234567 format`, `Father phone must be 03001234567 or +923001234567 format`, `Admin cannot deactivate their own account`, `Linked Firebase Auth account not found for this user`, `Email already in use`
- Sample Success Response:

```json
{
  "success": true,
  "message": ",\n        email: nextEmail || userData.email || ",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "User not found",
  "error": "User not found"
}
```

### PATCH `/api/admin/users/:uid/reset-device`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Device reset successfully. Student can now login from any device once.`
- Error Messages: `User not found`, `Device reset only applies to students`, `Failed to reset device`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Device reset successfully. Student can now login from any device once.",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "User not found",
  "error": "User not found"
}
```

### PATCH `/api/admin/users/:uid/role`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `role`
- Success Messages: `Role updated`
- Error Messages: `Invalid role`, `User not found`, `Failed to update role`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Role updated",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "role": "<role>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Invalid role",
  "error": "Invalid role"
}
```

### GET `/api/admin/videos`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Video library fetched`
- Error Messages: `Failed to fetch video library`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Video library fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Failed to fetch video library",
  "error": "Failed to fetch video library"
}
```

### POST `/api/admin/videos`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: `courseId`, `courseName`, `isActive`, `isLiveSession`, `teacherId`, `teacherName`, `url`, `videoMode`
- Error Messages: `title must be at least 3 characters`, `url is required`, `courseId is required`, `Course not found`, `Failed to add video to library`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

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

- Sample Error Response:

```json
{
  "success": false,
  "message": "title must be at least 3 characters",
  "error": "title must be at least 3 characters"
}
```

## Progress & Access APIs

### GET `/api/courses/:courseId/students/:studentId/progress`
- Auth: Bearer token (teacher or admin)
- Path Params: `courseId`, `studentId`
- Query Params: None
- Body Keys: None
- Error Messages: `courseId and studentId are required`, `Missing requester uid`, `Only teachers and admins can view student progress`, `Failed to fetch progress`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "courseId and studentId are required",
  "error": "courseId and studentId are required"
}
```

### POST `/api/courses/:courseId/students/:studentId/unlock-all`
- Auth: Bearer token (teacher or admin)
- Path Params: `courseId`, `studentId`
- Query Params: None
- Body Keys: None
- Error Messages: `courseId and studentId are required`, `Missing requester uid`, `Only teachers and admins can unlock videos`, `Failed to unlock videos`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "courseId and studentId are required",
  "error": "courseId and studentId are required"
}
```

### PATCH `/api/courses/:courseId/students/:studentId/video-access`
- Auth: Bearer token (teacher or admin)
- Path Params: `courseId`, `studentId`
- Query Params: None
- Body Keys: `lectureAccess`
- Success Messages: `Video access updated successfully`
- Error Messages: `courseId and studentId are required`, `Missing requester uid`, `Only teachers and admins can manage video access`, `lectureAccess array required`, `No valid lectureId provided`, `Failed to update video access`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Video access updated successfully",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "lectureAccess": "<lectureAccess>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "courseId and studentId are required",
  "error": "courseId and studentId are required"
}
```

### GET `/api/student/courses`
- Auth: Bearer token (student)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Student courses fetched`
- Error Messages: `Missing student uid`, `Failed to fetch student courses`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Student courses fetched",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### GET `/api/student/courses/:courseId/content`
- Auth: Bearer token (student)
- Path Params: `courseId`
- Query Params: None
- Body Keys: None
- Error Messages: `courseId is required`, `Missing student uid`, `Failed to fetch course content`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "courseId is required",
  "error": "courseId is required"
}
```

### GET `/api/student/courses/:courseId/final-quiz-request`
- Auth: Bearer token (student)
- Path Params: `courseId`
- Query Params: None
- Body Keys: None
- Success Messages: `No final quiz is configured for this course`, `Final quiz status fetched`
- Error Messages: `Missing student uid`, `courseId is required`, `You are not enrolled in this course`, `Failed to fetch final quiz status`
- Sample Success Response:

```json
{
  "success": true,
  "message": "No final quiz is configured for this course",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### POST `/api/student/courses/:courseId/final-quiz-request`
- Auth: Bearer token (student)
- Path Params: `courseId`
- Query Params: None
- Body Keys: `notes`
- Success Messages: `pending`
- Error Messages: `Missing student uid`, `courseId is required`, `You are not enrolled in this course`, `No final quiz is configured for this course`, `Final quiz is already passed for this course`, `A final quiz request is already in progress`, `Complete all course lectures before requesting the final quiz`, `Failed to request final quiz`
- Sample Success Response:

```json
{
  "success": true,
  "message": "pending",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "notes": "<notes>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "Missing student uid",
  "error": "Missing student uid"
}
```

### POST `/api/student/courses/:courseId/lectures/:lectureId/complete`
- Auth: Bearer token (student)
- Path Params: `courseId`, `lectureId`
- Query Params: None
- Body Keys: `currentTimeSec`, `duration`, `durationSec`, `watchedPercent`
- Error Messages: `courseId and lectureId are required`, `Missing student uid`, `Course is already completed`, `Lecture not found in this course`, `Complete previous content first`, `Watch at least 80% of the lecture before marking complete`, `Failed to mark complete`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "currentTimeSec": "<currentTimeSec>",
  "duration": "<duration>",
  "durationSec": "<durationSec>",
  "watchedPercent": "<watchedPercent>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "courseId and lectureId are required",
  "error": "courseId and lectureId are required"
}
```

### PATCH `/api/student/courses/:courseId/lectures/:lectureId/progress`
- Auth: Bearer token (student)
- Path Params: `courseId`, `lectureId`
- Query Params: None
- Body Keys: `currentTimeSec`, `duration`, `durationSec`, `watchedPercent`
- Error Messages: `courseId and lectureId are required`, `Missing student uid`, `Lecture not found in this course`, `Complete previous content first`, `Failed to save progress`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "currentTimeSec": "<currentTimeSec>",
  "duration": "<duration>",
  "durationSec": "<durationSec>",
  "watchedPercent": "<watchedPercent>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "courseId and lectureId are required",
  "error": "courseId and lectureId are required"
}
```

### GET `/api/student/courses/:courseId/progress`
- Auth: Bearer token (student)
- Path Params: `courseId`, `studentId`
- Query Params: None
- Body Keys: None
- Error Messages: `courseId and studentId are required`, `Missing requester uid`, `Only teachers and admins can view student progress`, `Failed to fetch progress`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "courseId and studentId are required",
  "error": "courseId and studentId are required"
}
```

## Upload APIs

### PATCH `/api/payments/:paymentId/receipt`
- Auth: Bearer token
- Path Params: `id`, `paymentId`
- Query Params: None
- Body Keys: `receiptSize`, `receiptUrl`
- Success Messages: `pending_verification`
- Error Messages: `paymentId is required`, `Payment not found`, `You can upload receipt for your own payment only`, `Payment approvals are blocked after 3 rejected receipts. Contact admin to reset.`, `Unsupported payment method for receipt upload`, `Receipt cannot be uploaded for this payment status`, `Invalid receipt URL`, `No file uploaded`, `Failed to upload receipt`
- Sample Success Response:

```json
{
  "success": true,
  "message": "pending_verification",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "receiptSize": "<receiptSize>",
  "receiptUrl": "<receiptUrl>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "paymentId is required",
  "error": "paymentId is required"
}
```

### POST `/api/payments/:paymentId/receipt`
- Auth: Bearer token
- Path Params: `id`, `paymentId`
- Query Params: None
- Body Keys: `receiptSize`, `receiptUrl`
- Success Messages: `pending_verification`
- Error Messages: `paymentId is required`, `Payment not found`, `You can upload receipt for your own payment only`, `Payment approvals are blocked after 3 rejected receipts. Contact admin to reset.`, `Unsupported payment method for receipt upload`, `Receipt cannot be uploaded for this payment status`, `Invalid receipt URL`, `No file uploaded`, `Failed to upload receipt`
- Sample Success Response:

```json
{
  "success": true,
  "message": "pending_verification",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "receiptSize": "<receiptSize>",
  "receiptUrl": "<receiptUrl>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "paymentId is required",
  "error": "paymentId is required"
}
```

### DELETE `/api/upload/file`
- Auth: Bearer token (admin or teacher)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `File deleted`
- Error Messages: `filePath required`, `Failed to delete file`
- Sample Success Response:

```json
{
  "success": true,
  "message": "File deleted",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "filePath required",
  "error": "filePath required"
}
```

### POST `/api/upload/logo`
- Auth: Bearer token (admin)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Logo uploaded`
- Error Messages: `No file uploaded`, `Failed to upload logo`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Logo uploaded",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "No file uploaded",
  "error": "No file uploaded"
}
```

### POST `/api/upload/pdf`
- Auth: Bearer token (admin or teacher)
- Path Params: None
- Query Params: None
- Body Keys: `subjectId`, `type`
- Success Messages: `PDF uploaded`
- Error Messages: `No file uploaded`, `courseId and subjectId are required`, `Failed to upload PDF`
- Sample Success Response:

```json
{
  "success": true,
  "message": "PDF uploaded",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "subjectId": "<subjectId>",
  "type": "<type>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "No file uploaded",
  "error": "No file uploaded"
}
```

### POST `/api/upload/thumbnail`
- Auth: Bearer token (admin or teacher)
- Path Params: None
- Query Params: None
- Body Keys: None
- Success Messages: `Thumbnail uploaded`
- Error Messages: `No file uploaded`, `Failed to upload thumbnail`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Thumbnail uploaded",
  "data": {}
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "No file uploaded",
  "error": "No file uploaded"
}
```

### POST `/api/upload/video`
- Auth: Bearer token (admin or teacher)
- Path Params: None
- Query Params: None
- Body Keys: `subjectId`
- Success Messages: `Video uploaded`
- Error Messages: `No file uploaded`, `courseId and subjectId are required`, `Failed to upload video`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Video uploaded",
  "data": {}
}
```

- Sample Request Body:

```json
{
  "subjectId": "<subjectId>"
}
```

- Sample Error Response:

```json
{
  "success": false,
  "message": "No file uploaded",
  "error": "No file uploaded"
}
```

## Special Endpoints

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

## Subject-First Updates (2026-04-07)

### GET `/api/admin/subjects`
- Auth: Bearer token (admin)
- Notes: Alias of admin courses listing, now subject-first.
- Sample Success Response:

```json
{
  "success": true,
  "message": "Subjects fetched",
  "data": [
    {
      "id": "sub_123",
      "title": "Biology",
      "description": "Core pre-medical biology",
      "price": 5000,
      "discountPercent": 10,
      "thumbnail": "https://...",
      "teacherId": "teacher_1",
      "teacherName": "Ahsan Ali",
      "status": "published",
      "enrollmentCount": 12
    }
  ]
}
```

### POST `/api/admin/subjects`
- Auth: Bearer token (admin)
- Body Keys: `title`, `description`, `price`, `discount|discountPercent`, `thumbnail`, `teacherId`
- Sample Success Response:

```json
{
  "success": true,
  "message": "Subject created",
  "data": {
    "id": "sub_123",
    "subjectId": "sub_123",
    "teacherId": "teacher_1"
  }
}
```

### PUT/PATCH/DELETE `/api/admin/subjects/:courseId`
- Auth: Bearer token (admin)
- Notes: `:courseId` is the subject document id for backward compatibility.

### POST `/api/admin/classes/:classId/subjects`
- Auth: Bearer token (admin)
- Body Keys: `subjectId` (or `courseId`)
- Sample Success Response:

```json
{
  "success": true,
  "message": "Subject assigned to class",
  "data": {
    "subjectId": "sub_123",
    "subjectName": "Biology",
    "courseId": "sub_123",
    "courseName": "Biology"
  }
}
```

### DELETE `/api/admin/classes/:classId/subjects/:courseId`
- Auth: Bearer token (admin)
- Notes: Removes assigned subject from class.

### GET `/api/classes/available`
- Auth: Optional bearer token for student purchase-state enrichment
- Notes: Returns class lifecycle and pricing for full/partial enrollment.
- Added keys in each class:
  - `classStatus` (`upcoming|active|full|expired`)
  - `canEnroll`, `canLearn`, `isExpired`, `isUpcoming`, `isFull`
  - `totalPrice`, `remainingPrice`, `isFullyEnrolled`, `isPartiallyEnrolled`
  - `purchasedSubjects`, `unpurchasedSubjects`
  - `assignedSubjects[].alreadyPurchased`

### PATCH `/api/admin/classes/:classId/reopen`
- Auth: Bearer token (admin)
- Sample Success Response:

```json
{
  "success": true,
  "message": "Class reopened successfully",
  "data": {
    "classId": "class_123",
    "startDate": "2026-04-07",
    "endDate": "2026-05-07",
    "status": "active"
  }
}
```

### PATCH `/api/teacher/classes/:classId/reopen`
- Auth: Bearer token (teacher/admin assigned to class)
- Sample Success Response:

```json
{
  "success": true,
  "message": "Class reopened successfully",
  "data": {
    "classId": "class_123",
    "startDate": "2026-04-07",
    "endDate": "2026-05-07",
    "status": "active"
  }
}
```

### Subject Content / Progress Endpoints
- Student content:
  - `GET /api/student/subjects/:subjectId/content`
  - `POST /api/student/subjects/:subjectId/lectures/:lectureId/complete`
  - `PATCH /api/student/subjects/:subjectId/lectures/:lectureId/progress`
- Teacher/Admin video unlock:
  - `PATCH /api/subjects/:subjectId/students/:studentId/video-access`
  - `POST /api/subjects/:subjectId/students/:studentId/unlock-all`
  - `GET /api/subjects/:subjectId/students/:studentId/progress`

## Test Module APIs

### POST `/api/teacher/tests`
### POST `/api/admin/tests`
- Auth: Bearer token (`teacher`/`admin`)
- Body:
```json
{
  "title": "Weekly Biology Test",
  "description": "Chapter 1 to 3",
  "scope" : "class",
  "classId": "TR5HYHIIuuZ6Xlouoa5k",
  "startAt": "2026-04-12T09:00:00.000Z",
  "endAt": "2026-04-12T11:00:00.000Z",
  "durationMinutes": 60,
  "maxViolations": 3,
  "questions": [
    {
      "questionText": "Which blood group is universal donor?",
      "optionA": "A+",
      "optionB": "O-",
      "optionC": "AB+",
      "optionD": "B+",
      "correctAnswer": "B",
      "marks": 1
    }
  ]
}
```

### GET `/api/teacher/tests/template`
### GET `/api/admin/tests/template`
- Auth: Bearer token (`teacher`/`admin`)
- Returns: CSV bulk template for creating one test with many MCQ questions.
- Content-Type: `text/csv`

### POST `/api/teacher/tests/bulk-upload`
### POST `/api/admin/tests/bulk-upload`
- Auth: Bearer token (`teacher`/`admin`)
- Content-Type: `multipart/form-data`
- Form field: `file` (CSV)
- Notes:
  - Each row = one MCQ question for the SAME test
  - `correctAnswer` must be `A|B|C|D`

Success (201):
```json
{
  "success": true,
  "message": "Test bulk uploaded successfully",
  "data": {
    "id": "test_123",
    "title": "Biology Weekly Test 1",
    "scope": "class",
    "classId": "CLASS_ID",
    "className": "Class XI",
    "totalMarks": 20,
    "questionsCount": 20,
    "startAt": "2026-04-11T10:00:00.000Z",
    "endAt": "2026-04-11T12:00:00.000Z"
  }
}
```

Error (400) example:
```json
{
  "success": false,
  "message": "CSV has validation errors",
  "errors": {
    "errors": [
      "Row 3: correctAnswer must be A, B, C or D, got \"E\""
    ]
  }
}
```

### GET `/api/student/tests`
- Returns tests available for logged-in student (class tests + center tests).

### GET `/api/student/tests/:testId`
- Returns test metadata, sanitized questions, current attempt, current question.

### POST `/api/student/tests/:testId/start`
- Starts or resumes attempt.

### POST `/api/student/tests/:testId/answer`
- One-way progression only (cannot answer previous question again).
- Body:
```json
{
  "questionId": "q_1",
  "selectedAnswer": "O-"
}
```

### POST `/api/student/tests/:testId/finish`
- Manual or auto submit.
- Body:
```json
{
  "reason": "manual"
}
```

### GET `/api/student/tests/:testId/ranking`
- Returns ranking with positions and current student's rank.

### GET `/api/student/tests/:testId/ranking/pdf`
- Downloads ranking as PDF.

## Live Session APIs (Updated)

### GET `/api/student/sessions/:sessionId`
- Auth: Bearer token (`student`)
- Access: student must be enrolled in the target class.
- Returns session details + join window.
- Sample success:
```json
{
  "success": true,
  "data": {
    "id": "session_doc_id",
    "topic": "Biology Live - Cell Division",
    "classId": "TR5HYHIIuuZ6Xlouoa5k",
    "className": "Class XI Pre Medical",
    "teacherId": "teacher_uid",
    "teacherName": "Ahsan Ali",
    "date": "2026-04-10",
    "startTime": "13:00",
    "endTime": "15:00",
    "platform": "Zoom",
    "meetingLink": "https://...",
    "status": "upcoming",
    "canJoin": true,
    "joinWindow": {
      "opensAt": "2026-04-10T12:50:00.000Z",
      "closesAt": "2026-04-10T13:00:00.000Z"
    },
    "timing": {
      "startAt": "2026-04-10T13:00:00.000Z",
      "endAt": "2026-04-10T15:00:00.000Z"
    }
  },
  "message": "Session fetched"
}
```

### POST `/api/student/sessions/:sessionId/join`
- Auth: Bearer token (`student`)
- Rules:
  - join allowed only from `startTime - 10 minutes` until session end.
  - cancelled/completed/ended sessions cannot be joined.
- Sample success:
```json
{
  "success": true,
  "data": {
    "sessionId": "session_doc_id",
    "waiting": false,
    "canPlay": true,
    "status": "active",
    "startAt": "2026-04-10T13:00:00.000Z",
    "endAt": "2026-04-10T15:00:00.000Z"
  },
  "message": "Joined live session"
}
```

### GET `/api/student/sessions/:sessionId/sync`
- Auth: Bearer token (`student`)
- Purpose: late-join sync (session does not restart for late student).
- Sample success:
```json
{
  "success": true,
  "data": {
    "sessionId": "session_doc_id",
    "startedAt": "2026-04-10T13:00:00.000Z",
    "elapsedSeconds": 735,
    "remainingSeconds": 5265,
    "totalSeconds": 6000,
    "isRunning": true,
    "status": "active",
    "hlsUrl": "https://storage.googleapis.com/.../master.m3u8",
    "videoUrl": "https://storage.googleapis.com/.../live-lecture.mp4",
    "meetingLink": "https://...",
    "topic": "Biology Live - Cell Division",
    "endTime": "15:00"
  },
  "message": "Session sync data"
}
```

### POST `/api/student/sessions/:sessionId/violation`
- Auth: Bearer token (`student`)
- Body:
```json
{
  "reason": "tab_switch",
  "count": 2,
  "timestamp": "2026-04-10T12:58:01.000Z"
}
```
- Behavior:
  - logs session violation.
  - after 3 total session violations, student account is deactivated and deactivation email is sent.

## Session Creation Conflict Rules
- `POST /api/teacher/sessions`
- New checks:
  - class conflict: no overlapping sessions for same class/date.
  - teacher conflict: no overlapping sessions for same teacher/date across classes.
- Conflict error codes:
  - `SESSION_CONFLICT`
  - `TEACHER_CONFLICT`

## APK Download Endpoint

### GET `/download/app`
- Public route (outside `/api`)
- Downloads file from backend path: `backend/Sum Academy LMS.apk`
- Error when missing:
```json
{
  "success": false,
  "message": "APK file not found"
}
```

## Rate Limiting (Production)
- Auth (`/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`): `15 requests / 15 mins` (IP key)
- Payments (`/api/payments*`): `10 requests / 15 mins` (user/IP key)
- Uploads (`/api/upload`): `10 requests / 1 min` (user/IP key)
- Admin dashboard (`/api/admin`): `300 requests / 1 min` (user/IP key)
- Teacher dashboard (`/api/teacher`): `300 requests / 1 min` (user/IP key)
- Student APIs (`/api/student`): `200 requests / 1 min` (user/IP key)
- General fallback (`/api`): `1000 requests / 15 mins` (user/IP key)

Cache policy:
- successful `GET` responses are cached briefly with route-based TTL.
- write requests (`POST/PUT/PATCH/DELETE`) invalidate related cache keys.
## 2026-04-11 Updates

### Student Live Session APIs

**Important collections**
- Live schedule is computed from `classes.shifts` + the first lecture marked `isLiveSession=true` (with a valid `videoUrl`) inside each subject.
- If a live lecture (or subject content live video) has `liveStartAt/liveEndAt`, the system will use that exact schedule instead of the shift time.
- **Student join/attendance** state is stored in Firestore collection `liveSessionAccess` (one doc per student per session id).
- The **actual live/recorded video URL** comes from the **lecture** document in `lectures` (`videoUrl` / `streamUrl` / `playbackUrl` / `signedUrl`).
- `liveSessionAccess` does not store the video file; it stores join state and completion flags (example: `lectureCompleted`).

**Live end-time rule**
- If the live lecture has a known duration (`durationSec` / `videoDuration`), the live session **ends when the video ends**.
- If duration is missing, the live session **falls back to shift duration**.
- If the live video is longer than the shift, it can continue past shift end and will end when the video ends.

**Live schedule fields (lecture-level)**
- When a lecture is attached with a gallery video marked as `isLiveSession=true`, admin/teacher can provide `liveStartAt` (ISO).
- Backend auto-calculates and stores:
  - `liveStartAt` (ISO)
  - `liveEndAt` (ISO) = `liveStartAt + durationSec`
- Student live schedule prefers `lecture.liveStartAt/liveEndAt` when present; otherwise it falls back to shift-based occurrence.
 
Timezone note:
- `liveStartAt/liveEndAt` are stored as **Pakistan local datetime strings** (no trailing `Z`) like `2026-04-11T14:34:00`.
- Backend parses these consistently as `Asia/Karachi` to avoid UTC confusion in Firestore.

**Important endpoints**
- List live sessions: `GET /api/student/live-sessions`
- Join a session: `POST /api/student/live-sessions/:sessionId/join`
- The `/api/student/sessions/:sessionId/*` endpoints are **the same system** (they also read/write `liveSessionAccess`).

Join window rule:
- Opens: 10 minutes before `startAt`
- Closes: 10 minutes after `startAt`

#### GET `/api/student/sessions/:sessionId/status`
- Auth: `Bearer`
- Role: `student`
- Purpose: Fetch live session state for pre/live/ended UI and counters.

Notes:
- The source of truth for schedule is `data.timing.startAt` / `data.timing.endAt` (ISO).
- `date/startTime/endTime` are kept for legacy clients and may reflect class shift fields.

Success:
```json
{
  "success": true,
  "message": "Session status fetched",
  "data": {
    "sessionId": "abc123",
    "status": "upcoming",
    "topic": "Physics - Live Lecture 1",
    "teacherName": "Ahsan Ali",
    "date": "2026-04-11",
    "startTime": "13:00",
    "endTime": "15:00",
    "platform": "video",
    "meetingLink": "",
    "classId": "class_1",
    "className": "Class XI",
    "batchCode": "CLAS-15940",
    "joinedCount": 12,
    "totalStudents": 30,
    "elapsedSeconds": 0,
    "remainingSeconds": 7200,
    "canJoin": false,
    "isLocked": false,
    "hlsUrl": "https://storage.googleapis.com/.../master.m3u8",
    "recordingUrl": "https://storage.googleapis.com/.../live-lecture.mp4",
    "joinWindow": {
      "opensAt": "2026-04-11T07:50:00.000Z",
      "closesAt": "2026-04-11T08:10:00.000Z"
    },
    "timing": {
      "startAt": "2026-04-11T08:00:00.000Z",
      "endAt": "2026-04-11T10:00:00.000Z",
      "durationSeconds": 7200
    }
  }
}
```

#### POST `/api/student/sessions/:sessionId/join`
- Auth: `Bearer`
- Role: `student`
- Purpose: Join live session (stored in `liveSessionAccess`) during join window / live window.

Success:
```json
{
  "success": true,
  "message": "Joined live session",
  "data": {
    "sessionId": "abc123",
    "waiting": true,
    "canPlay": false,
    "startAt": "2026-04-11T08:00:00.000Z",
    "endAt": "2026-04-11T10:00:00.000Z"
  }
}
```

Error (`JOIN_NOT_OPEN`):
```json
{
  "success": false,
  "message": "You can join only 10 minutes before class shift start time.",
  "errors": {
    "code": "JOIN_NOT_OPEN"
  }
}
```

Error (`JOIN_CLOSED`):
```json
{
  "success": false,
  "message": "Join window has closed. You can no longer join after 10 minutes from the session start time.",
  "errors": {
    "code": "JOIN_CLOSED"
  }
}
```

Error (`SESSION_ENDED`):
```json
{
  "success": false,
  "message": "This session has ended",
  "errors": {
    "code": "SESSION_ENDED"
  }
}
```

#### POST `/api/student/sessions/:sessionId/leave`
- Auth: `Bearer`
- Role: `student`
- Purpose: Mark `leftAt` in attendance.

Success:
```json
{
  "success": true,
  "message": "Left session",
  "data": {
    "sessionId": "abc123"
  }
}
```

#### POST `/api/student/sessions/:sessionId/violation`
- Auth: `Bearer`
- Role: `student`
- Body:
```json
{
  "reason": "tab_switch",
  "count": 2,
  "timestamp": "2026-04-11T08:25:00.000Z"
}
```
- Behavior: logs violation; account deactivates at threshold.

---

### Session Unlock APIs

#### PATCH `/api/teacher/sessions/:sessionId/unlock`
#### PATCH `/api/admin/sessions/:sessionId/unlock`
- Auth: `Bearer`
- Role: `teacher` (own session) or `admin` (any session)
- Purpose: unlock ended/locked session recording access.

Success:
```json
{
  "success": true,
  "message": "Session unlocked",
  "data": {
    "sessionId": "abc123"
  }
}
```

---

### Student Quiz Submit (Rank Included)

#### POST `/api/student/quizzes/:quizId/submit`
- Response now includes `rank`.

Success:
```json
{
  "success": true,
  "message": "Quiz submitted successfully",
  "data": {
    "resultId": "res_1",
    "quizId": "quiz_1",
    "isFinalQuiz": false,
    "autoScore": 18,
    "totalMarks": 20,
    "shortAnswerPending": 0,
    "status": "completed",
    "percentage": 90,
    "isPassed": true,
    "rank": 2
  }
}
```

---

### Bulk Quiz CSV Format (Updated)

Used by:
- `GET /api/teacher/quizzes/template`
- `POST /api/teacher/quizzes/bulk-upload`

Required columns:
`scope,courseId,subjectId,chapterId,quizTitle,quizDescription,passScore,questionType,questionText,optionA,optionB,optionC,optionD,correctAnswer,expectedAnswer,marks`

Validation rules:
- `mcq`: `correctAnswer` must be `A|B|C|D`
- `true_false`: `correctAnswer` must be `TRUE|FALSE`
- `short_answer`: `expectedAnswer` required, `correctAnswer` empty

Validation error response:
```json
{
  "success": false,
  "message": "CSV has validation errors",
  "errors": [
    "Row 3: MCQ correctAnswer must be A B C or D",
    "Row 7: Short answer must have expectedAnswer"
  ]
}
```
