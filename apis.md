# SUM Academy API Reference (Category-wise)

Last updated: 2026-04-07
Base URL: `https://sumacademy.net/api`

## Standard Response Shape

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
  "data": [
    {
      "id": "3uR0gK2aP9mQzv8XyT4n",
      "studentId": "M4m0hT7BfRj2e9QwK6Ys",
      "studentName": "Ahsan Ali",
      "courseId": "KscKrww9Yr8oNoIQpV2a",
      "subjectId": "KscKrww9Yr8oNoIQpV2a",
      "courseName": "Chemistry XI-Pre Medical",
      "classId": "TR5HYHIIuuZ6Xlouoa5k",
      "className": "Class Pre Medical for XI batch 0001",
      "batchCode": "CLAS-15940",
      "completionScope": "class",
      "completionTitle": "Class Pre Medical for XI batch 0001 (CLAS-15940) - Chemistry XI-Pre Medical",
      "certId": "SUM-2026-A1B2C3D4",
      "verificationUrl": "https://sumacademy.net/verify/SUM-2026-A1B2C3D4",
      "downloadUrl": "https://sumacademy.net/api/student/certificates/3uR0gK2aP9mQzv8XyT4n/download",
      "pdfUrl": "https://sumacademy.net/api/student/certificates/3uR0gK2aP9mQzv8XyT4n/download",
      "isRevoked": false,
      "issuedAt": "2026-04-07T14:12:26.000Z",
      "createdAt": "2026-04-07T14:12:26.000Z",
      "revokedAt": null
    }
  ]
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

### GET `/api/student/certificates/:id/download`
- Auth: Bearer token (student)
- Path Params: `id` (certificate document id or `certId`)
- Query Params: None
- Body Keys: None
- Success Type: Binary PDF download (`application/pdf`) or redirect to existing stored certificate URL
- Error Messages: `Missing student uid`, `Certificate id is required`, `Certificate not found`, `Failed to download certificate`
- Success Response Headers:

```json
{
  "Content-Type": "application/pdf",
  "Content-Disposition": "attachment; filename=\"SUM_Certificate_SUM-2026-A1B2C3D4.pdf\""
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
- Body Keys: `duration`, `isLiveSession`, `size`, `title`, `url`, `videoId`, `videoMode`
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
- Body Keys: `contentType`, `isLiveSession`, `noteType`, `size`, `title`, `type`, `url`, `videoId`
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
