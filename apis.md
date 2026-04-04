
# SUM Academy API Reference

Last updated: 2026-04-04

## Base URL
- Production: `https://sumacademy.net`
- Local: `http://localhost:5000`

## Auth Header
- Protected endpoints require: `Authorization: Bearer <firebase_id_token>`
- Device/security headers used by auth/device checks:
  - `x-device-fingerprint`
  - `x-screen-resolution`
  - `x-platform`

## Standard JSON Envelope

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

## Common Error Samples

### 401 No token
```json
{
  "success": false,
  "message": "No token provided"
}
```

### 403 Access denied (role mismatch)
```json
{
  "success": false,
  "message": "Access denied",
  "code": "ACCESS_DENIED",
  "requiredRoles": ["admin"],
  "actualRole": "student"
}
```

### 403 Pending approval (student)
```json
{
  "success": false,
  "message": "Your account is pending admin approval. Please wait for activation.",
  "code": "PENDING_APPROVAL"
}
```

### 400 Class full
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

## Public Endpoints

| Method | Endpoint | Auth | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|---|
| GET | `/api/health` | No | `{}` | `{"status":"ok","message":"SUM Academy API healthy","timestamp":"2026-04-04T09:00:00.000Z"}` | `{"error":"Internal Server Error"}` |
| GET | `/api/test` | No | `{}` | `{"status":"ok","message":"SUM Academy API is running","firebase":"connected ?"}` | `{"status":"error","message":"Firebase connection failed ?","error":"permission-denied"}` |
| GET | `/api/courses/explore` | No | `{"query":{"category":"Science","level":"Beginner","search":"Math"}}` | `{"success":true,"message":"Courses fetched","data":[{"id":"course_1","title":"Math 101","price":9000,"discountPercent":10,"enrollmentCount":24}]}` | `{"success":false,"message":"Failed to fetch courses","error":"Failed to fetch courses"}` |
| GET | `/api/classes/catalog` | No | `{}` | `{"success":true,"message":"Course catalog fetched","data":[{"id":"course_1","title":"Math 101","price":9000,"originalPrice":10000,"discount":10}]}` | `{"success":false,"message":"Failed to fetch course catalog","error":"Failed to fetch course catalog"}` |
| GET | `/api/classes/available` | No | `{"query":{"courseId":"course_1"}}` | `{"success":true,"message":"Available classes fetched","data":[{"id":"class_1","name":"Batch A","capacity":5,"enrolledCount":3,"spotsLeft":2,"isFull":false,"assignedCourses":[{"courseId":"course_1","title":"Math 101"}],"shifts":[{"id":"shift_m","name":"Morning"}]}]}` | `{"success":false,"message":"Failed to fetch available classes","error":"Failed to fetch available classes"}` |
| GET | `/api/settings` | No | `{}` | `{"success":true,"message":"Settings fetched","data":{"general":{"siteName":"SUM Academy"},"contact":{"email":"help@sumacademy.net"}}}` | `{"success":false,"message":"Failed to fetch settings","error":"Failed to fetch settings"}` |
| POST | `/api/launch/notify` | No | `{"email":"student@example.com"}` | `{"success":true,"message":"Notification request saved","data":{"status":"pending","email":"student@example.com"}}` | `{"success":false,"message":"Email is required","error":"Email is required"}` |
| POST | `/api/launch/notify/dispatch` | No | `{}` | `{"success":true,"message":"Launch notifications sent","data":{"sentCount":42}}` | `{"success":false,"message":"Failed to dispatch notifications","error":"Failed to dispatch notifications"}` |
| POST | `/api/contact/messages` | No | `{"name":"Ali","email":"ali@example.com","category":"support","subject":"Need help","message":"Please call me"}` | `{"success":true,"message":"Message submitted successfully","data":{"ticketId":"msg_1001","submitted":true}}` | `{"success":false,"message":"subject and message are required","error":"subject and message are required"}` |
| GET | `/api/verify/:certId` | No | `{"params":{"certId":"CERT-2026-0001"}}` | `{"success":true,"message":"Certificate verified","data":{"certId":"CERT-2026-0001","studentName":"Ali","courseTitle":"Math 101","isRevoked":false}}` | `{"success":false,"message":"Certificate not found","error":"Certificate not found"}` |
| GET | `/api/announcements/my` | Yes | `{}` | `{"success":true,"message":"Announcements fetched","data":[{"id":"ann_1","title":"Holiday","isRead":false}]}` | `{"success":false,"message":"No token provided"}` |
| PATCH | `/api/announcements/read-all` | Yes | `{}` | `{"success":true,"message":"Announcements marked as read","data":{"updated":4}}` | `{"success":false,"message":"Failed to mark announcements","error":"Failed to mark announcements"}` |
| PATCH | `/api/announcements/:id/read` | Yes | `{"params":{"id":"ann_1"}}` | `{"success":true,"message":"Announcement marked as read","data":{"id":"ann_1","isRead":true}}` | `{"success":false,"message":"Announcement not found","error":"Announcement not found"}` |
| POST | `/api/promo-codes/validate` | Yes | `{"code":"SUM10","courseId":"course_1","studentId":"stu_1"}` | `{"success":true,"message":"Promo code is valid","data":{"code":"SUM10","discountType":"percentage","discountValue":10,"discountAmount":1000,"finalAmount":9000}}` | `{"success":false,"message":"Invalid promo code","error":"Invalid promo code"}` |

## Auth Endpoints (`/api/auth`)

| Method | Endpoint | Auth | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|---|
| POST | `/api/auth/register/send-otp` | No | `{"email":"new@student.com","fullName":"New Student"}` | `{"success":true,"message":"OTP sent","data":{"expiresInSeconds":300}}` | `{"success":false,"message":"Email is required","error":"Email is required"}` |
| POST | `/api/auth/register/verify-otp` | No | `{"email":"new@student.com","otp":"123456"}` | `{"success":true,"message":"OTP verified","data":{"otpVerificationToken":"otp_token_abc"}}` | `{"success":false,"message":"Invalid OTP","error":"Invalid OTP"}` |
| POST | `/api/auth/register` | Firebase token | `{"uid":"uid_1","email":"new@student.com","fullName":"New Student","phoneNumber":"+923001112233","otpVerificationToken":"otp_token_abc"}` | `{"success":true,"message":"Registration successful","data":{"user":{"uid":"uid_1","email":"new@student.com","role":"student","status":"pending_approval"}}}` | `{"success":false,"message":"User already exists","error":"User already exists"}` |
| POST | `/api/auth/login` | Firebase token | `{}` | `{"success":true,"message":"Login successful","data":{"user":{"uid":"uid_1","role":"admin","email":"admin@sumacademy.net"}}}` | `{"success":false,"message":"Your account is pending admin approval. Please wait for activation.","error":"Your account is pending admin approval. Please wait for activation.","errors":{"code":"PENDING_APPROVAL"}}` |
| POST | `/api/auth/forgot-password/send-otp` | No | `{"email":"student@example.com"}` | `{"success":true,"message":"OTP sent","data":{"expiresInSeconds":300}}` | `{"success":false,"message":"Email is required","error":"Email is required"}` |
| POST | `/api/auth/forgot-password/verify-otp` | No | `{"email":"student@example.com","otp":"123456"}` | `{"success":true,"message":"OTP verified","data":{"otpVerificationToken":"reset_token_1"}}` | `{"success":false,"message":"Invalid OTP","error":"Invalid OTP"}` |
| POST | `/api/auth/forgot-password/reset` | No | `{"email":"student@example.com","newPassword":"Strong@123","confirmPassword":"Strong@123","otpVerificationToken":"reset_token_1"}` | `{"success":true,"message":"Password reset successful","data":{}}` | `{"success":false,"message":"Passwords do not match","error":"Passwords do not match"}` |
| POST | `/api/auth/logout` | Yes | `{}` | `{"success":true,"message":"Logout successful","data":{}}` | `{"success":false,"message":"No token provided"}` |
| GET | `/api/auth/me` | Yes | `{}` | `{"success":true,"message":"Profile fetched","data":{"user":{"uid":"uid_1","role":"teacher","fullName":"Sara"}}}` | `{"success":false,"message":"User profile not found"}` |
| PATCH | `/api/auth/set-role` | Yes admin | `{"uid":"uid_2","role":"teacher"}` | `{"success":true,"message":"Role updated successfully","data":{}}` | `{"success":false,"message":"Access denied","code":"ACCESS_DENIED"}` |
