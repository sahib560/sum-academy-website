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

## Student Endpoints (`/api/student`)

| Method | Endpoint | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|
| GET | `/api/student/dashboard` | `{}` | `{"success":true,"message":"Dashboard fetched","data":{"profile":{"fullName":"Ali"},"stats":{"classes":2,"courses":4},"classes":[{"id":"class_1","name":"Batch A"}]}}` | `{"success":false,"message":"Failed to fetch dashboard","error":"Failed to fetch dashboard"}` |
| GET | `/api/student/courses` | `{}` | `{"success":true,"message":"Courses fetched","data":[{"classId":"class_1","className":"Batch A","courseId":"course_1","title":"Math 101","progress":45}]}` | `{"success":false,"message":"Failed to fetch courses","error":"Failed to fetch courses"}` |
| GET | `/api/student/courses/:courseId/progress` | `{"params":{"courseId":"course_1"}}` | `{"success":true,"message":"Progress fetched","data":{"courseId":"course_1","progress":45,"chapters":[{"id":"ch_1","completed":true}]}}` | `{"success":false,"message":"Course not found","error":"Course not found"}` |
| POST | `/api/student/courses/:courseId/lectures/:lectureId/complete` | `{"params":{"courseId":"course_1","lectureId":"lec_1"}}` | `{"success":true,"message":"Lecture marked complete","data":{"courseId":"course_1","lectureId":"lec_1","completionPercent":52,"courseCompleted":false}}` | `{"success":false,"message":"Lecture not found","error":"Lecture not found"}` |
| GET | `/api/student/certificates` | `{}` | `{"success":true,"message":"Certificates fetched","data":[{"certId":"CERT-1","courseTitle":"Math 101"}]}` | `{"success":false,"message":"Failed to fetch certificates","error":"Failed to fetch certificates"}` |
| GET | `/api/student/quizzes` | `{}` | `{"success":true,"message":"Quizzes fetched","data":[{"quizId":"quiz_1","title":"Chapter 1 Quiz","attemptsLeft":2}]}` | `{"success":false,"message":"Failed to fetch quizzes","error":"Failed to fetch quizzes"}` |
| GET | `/api/student/quizzes/:quizId` | `{"params":{"quizId":"quiz_1"}}` | `{"success":true,"message":"Quiz fetched","data":{"quizId":"quiz_1","questions":[{"id":"q1","type":"mcq"}]}}` | `{"success":false,"message":"Quiz not found","error":"Quiz not found"}` |
| POST | `/api/student/quizzes/:quizId/submit` | `{"answers":[{"questionId":"q1","selected":"A"}]}` | `{"success":true,"message":"Quiz submitted","data":{"quizId":"quiz_1","score":8,"total":10,"passed":true}}` | `{"success":false,"message":"Attempt limit reached","error":"Attempt limit reached"}` |
| GET | `/api/student/announcements` | `{}` | `{"success":true,"message":"Announcements fetched","data":[{"id":"ann_1","title":"Exam Update"}]}` | `{"success":false,"message":"Failed to fetch announcements","error":"Failed to fetch announcements"}` |
| PATCH | `/api/student/announcements/:id/read` | `{"params":{"id":"ann_1"}}` | `{"success":true,"message":"Announcement marked as read","data":{"id":"ann_1","isRead":true}}` | `{"success":false,"message":"Announcement not found","error":"Announcement not found"}` |
| GET | `/api/student/attendance` | `{}` | `{"success":true,"message":"Attendance fetched","data":{"summary":{"present":22,"absent":3},"classes":[{"classId":"class_1","percentage":88}]}}` | `{"success":false,"message":"Failed to fetch attendance","error":"Failed to fetch attendance"}` |
| POST | `/api/student/help-support` | `{"category":"technical","subject":"Video not opening","message":"Lecture 2 fails"}` | `{"success":true,"message":"Support message submitted","data":{"submitted":true,"ticketId":"sup_100"}}` | `{"success":false,"message":"subject and message are required","error":"subject and message are required"}` |
| GET | `/api/student/settings` | `{}` | `{"success":true,"message":"Settings fetched","data":{"fullName":"Ali","phoneNumber":"+923001112233"}}` | `{"success":false,"message":"Failed to fetch settings","error":"Failed to fetch settings"}` |
| PUT | `/api/student/settings` | `{"fullName":"Ali Khan","phoneNumber":"03001112233","address":"Lahore"}` | `{"success":true,"message":"Settings updated","data":{"fullName":"Ali Khan","phoneNumber":"+923001112233"}}` | `{"success":false,"message":"Invalid phone number","error":"Invalid phone number"}` |

## Teacher Endpoints (`/api/teacher`)

| Method | Endpoint | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|
| GET | `/api/teacher/dashboard` | `{}` | `{"success":true,"message":"Teacher dashboard fetched","data":{"stats":{"students":120,"courses":3}}}` | `{"success":false,"message":"Failed to fetch teacher dashboard","error":"Failed to fetch teacher dashboard"}` |
| GET | `/api/teacher/courses` | `{}` | `{"success":true,"message":"Teacher assigned courses fetched","data":[{"id":"course_1","title":"Math 101"}]}` | `{"success":false,"message":"Failed to fetch teacher courses","error":"Failed to fetch teacher courses"}` |
| GET | `/api/teacher/courses/:courseId` | `{"params":{"courseId":"course_1"}}` | `{"success":true,"message":"Teacher course fetched","data":{"id":"course_1","subjects":[{"id":"sub_1","name":"Algebra"}]}}` | `{"success":false,"message":"Forbidden","error":"Forbidden"}` |
| GET | `/api/teacher/courses/:courseId/subjects/:subjectId/chapters` | `{"params":{"courseId":"course_1","subjectId":"sub_1"}}` | `{"success":true,"message":"Chapters fetched","data":[{"id":"ch_1","title":"Numbers"}]}` | `{"success":false,"message":"courseId and subjectId are required","error":"courseId and subjectId are required"}` |
| POST | `/api/teacher/courses/:courseId/subjects/:subjectId/chapters` | `{"title":"Chapter 2","order":2}` | `{"success":true,"message":"Chapter added","data":{"id":"ch_2","title":"Chapter 2","order":2}}` | `{"success":false,"message":"Chapter title must be at least 3 characters","error":"Chapter title must be at least 3 characters"}` |
| PUT | `/api/teacher/chapters/:chapterId` | `{"title":"Updated Chapter","order":3}` | `{"success":true,"message":"Chapter updated","data":{"chapterId":"ch_2"}}` | `{"success":false,"message":"No valid fields to update","error":"No valid fields to update"}` |
| DELETE | `/api/teacher/chapters/:chapterId` | `{"params":{"chapterId":"ch_2"}}` | `{"success":true,"message":"Chapter deleted","data":{"chapterId":"ch_2"}}` | `{"success":false,"message":"chapterId is required","error":"chapterId is required"}` |
| GET | `/api/teacher/chapters/:chapterId/lectures` | `{"params":{"chapterId":"ch_1"}}` | `{"success":true,"message":"Lectures fetched","data":[{"id":"lec_1","title":"Intro"}]}` | `{"success":false,"message":"chapterId is required","error":"chapterId is required"}` |
| POST | `/api/teacher/chapters/:chapterId/lectures` | `{"title":"Lecture 2","order":2}` | `{"success":true,"message":"Lecture added","data":{"id":"lec_2","title":"Lecture 2"}}` | `{"success":false,"message":"Lecture title must be at least 3 characters","error":"Lecture title must be at least 3 characters"}` |
| PUT | `/api/teacher/lectures/:lectureId` | `{"title":"Updated Lecture","order":2}` | `{"success":true,"message":"Lecture updated","data":{"lectureId":"lec_2"}}` | `{"success":false,"message":"lectureId is required","error":"lectureId is required"}` |
| DELETE | `/api/teacher/lectures/:lectureId` | `{"params":{"lectureId":"lec_2"}}` | `{"success":true,"message":"Lecture deleted","data":{"lectureId":"lec_2"}}` | `{"success":false,"message":"lectureId is required","error":"lectureId is required"}` |
| POST | `/api/teacher/lectures/:lectureId/content` | `{"type":"video","title":"Part A","url":"https://cdn/video.mp4","duration":"10:21"}` | `{"success":true,"message":"Content saved","data":{"id":"cnt_1","type":"video","title":"Part A"}}` | `{"success":false,"message":"type, title and url are required","error":"type, title and url are required"}` |
| DELETE | `/api/teacher/lectures/:lectureId/content/:contentId` | `{"params":{"lectureId":"lec_1","contentId":"cnt_1"}}` | `{"success":true,"message":"Content deleted","data":{"contentId":"cnt_1"}}` | `{"success":false,"message":"Failed to delete content","error":"Failed to delete content"}` |
| GET | `/api/teacher/courses/:courseId/students` | `{"params":{"courseId":"course_1"}}` | `{"success":true,"message":"Course students fetched","data":[{"studentId":"stu_1","fullName":"Ali"}]}` | `{"success":false,"message":"courseId is required","error":"courseId is required"}` |
| PATCH | `/api/teacher/courses/:courseId/students/:studentId/video-access` | `{"lectureId":"lec_1","hasAccess":false}` | `{"success":true,"message":"Video access updated","data":{"studentId":"stu_1","lectureId":"lec_1","hasAccess":false}}` | `{"success":false,"message":"studentId and lectureId are required","error":"studentId and lectureId are required"}` |
| GET | `/api/teacher/students` | `{}` | `{"success":true,"message":"Students fetched","data":[{"studentId":"stu_1","fullName":"Ali"}]}` | `{"success":false,"message":"Failed to fetch students","error":"Failed to fetch students"}` |
| GET | `/api/teacher/students/:studentId` | `{"params":{"studentId":"stu_1"}}` | `{"success":true,"message":"Student fetched","data":{"studentId":"stu_1","fullName":"Ali"}}` | `{"success":false,"message":"Student not found","error":"Student not found"}` |
| GET | `/api/teacher/students/:studentId/progress/:courseId` | `{"params":{"studentId":"stu_1","courseId":"course_1"}}` | `{"success":true,"message":"Student progress fetched","data":{"progress":70}}` | `{"success":false,"message":"Failed to fetch student progress","error":"Failed to fetch student progress"}` |
| PATCH | `/api/teacher/students/:studentId/video-access` | `{"lectureAccess":[{"lectureId":"lec_1","hasAccess":true}]}` | `{"success":true,"message":"Student video access updated","data":{"studentId":"stu_1"}}` | `{"success":false,"message":"lectureAccess must be an array","error":"lectureAccess must be an array"}` |
| GET | `/api/teacher/students/:studentId/attendance/:classId` | `{"params":{"studentId":"stu_1","classId":"class_1"}}` | `{"success":true,"message":"Attendance fetched","data":{"present":20,"absent":2}}` | `{"success":false,"message":"Failed to fetch attendance","error":"Failed to fetch attendance"}` |
| GET | `/api/teacher/sessions` | `{"query":{"classId":"class_1"}}` | `{"success":true,"message":"Sessions fetched","data":[{"id":"ses_1","topic":"Vectors","status":"scheduled"}]}` | `{"success":false,"message":"Failed to fetch sessions","error":"Failed to fetch sessions"}` |
| GET | `/api/teacher/sessions/:sessionId` | `{"params":{"sessionId":"ses_1"}}` | `{"success":true,"message":"Session fetched","data":{"id":"ses_1","topic":"Vectors"}}` | `{"success":false,"message":"Session not found","error":"Session not found"}` |
| POST | `/api/teacher/sessions` | `{"classId":"class_1","courseId":"course_1","topic":"Live Doubts","date":"2026-04-07","startTime":"10:00","endTime":"11:00","platform":"zoom"}` | `{"success":true,"message":"Session created","data":{"id":"ses_2","status":"scheduled"}}` | `{"success":false,"message":"classId, date, startTime and endTime are required","error":"classId, date, startTime and endTime are required"}` |
| PUT | `/api/teacher/sessions/:sessionId` | `{"topic":"Updated Topic","endTime":"11:30"}` | `{"success":true,"message":"Session updated","data":{"id":"ses_2"}}` | `{"success":false,"message":"Session not found","error":"Session not found"}` |
| PATCH | `/api/teacher/sessions/:sessionId/cancel` | `{"cancelReason":"Emergency","notifyStudents":true}` | `{"success":true,"message":"Session cancelled","data":{"id":"ses_2","status":"cancelled"}}` | `{"success":false,"message":"Session cannot be cancelled","error":"Session cannot be cancelled"}` |
| PATCH | `/api/teacher/sessions/:sessionId/complete` | `{"notes":"Covered full chapter"}` | `{"success":true,"message":"Session marked complete","data":{"id":"ses_2","status":"completed"}}` | `{"success":false,"message":"Session not found","error":"Session not found"}` |
| GET | `/api/teacher/sessions/:sessionId/attendance` | `{"params":{"sessionId":"ses_1"}}` | `{"success":true,"message":"Attendance fetched","data":[{"studentId":"stu_1","status":"present"}]}` | `{"success":false,"message":"Failed to fetch attendance","error":"Failed to fetch attendance"}` |
| POST | `/api/teacher/sessions/:sessionId/attendance` | `{"attendance":[{"studentId":"stu_1","status":"present"}]}` | `{"success":true,"message":"Attendance saved","data":{"updated":1}}` | `{"success":false,"message":"attendance is required","error":"attendance is required"}` |
| GET | `/api/teacher/classes` | `{}` | `{"success":true,"message":"Classes fetched","data":[{"id":"class_1","name":"Batch A"}]}` | `{"success":false,"message":"Failed to fetch classes","error":"Failed to fetch classes"}` |
| GET | `/api/teacher/timetable` | `{}` | `{"success":true,"message":"Timetable fetched","data":[{"day":"Mon","startTime":"10:00","endTime":"11:00"}]}` | `{"success":false,"message":"Failed to fetch timetable","error":"Failed to fetch timetable"}` |
| GET | `/api/teacher/announcements` | `{}` | `{"success":true,"message":"Announcements fetched","data":[{"id":"ann_1","title":"Quiz Reminder"}]}` | `{"success":false,"message":"Failed to fetch announcements","error":"Failed to fetch announcements"}` |
| POST | `/api/teacher/announcements` | `{"title":"Quiz Reminder","message":"Quiz tomorrow","targetType":"course","targetId":"course_1","sendEmail":true}` | `{"success":true,"message":"Announcement posted","data":{"id":"ann_2","emailsSent":35}}` | `{"success":false,"message":"Title and message required","error":"Title and message required"}` |
| GET | `/api/teacher/quizzes/template` | `{}` | `{"file":"quiz-template.csv"}` | `{"success":false,"message":"Failed to download template","error":"Failed to download template"}` |
| GET | `/api/teacher/quizzes` | `{}` | `{"success":true,"message":"Teacher quizzes fetched","data":{"items":[{"id":"quiz_1","title":"Algebra Test"}],"total":1}}` | `{"success":false,"message":"Failed to fetch quizzes","error":"Failed to fetch quizzes"}` |
| GET | `/api/teacher/quizzes/:quizId` | `{"params":{"quizId":"quiz_1"}}` | `{"success":true,"message":"Quiz fetched","data":{"id":"quiz_1","title":"Algebra Test"}}` | `{"success":false,"message":"quizId is required","error":"quizId is required"}` |
| GET | `/api/teacher/quizzes/:quizId/analytics` | `{"params":{"quizId":"quiz_1"}}` | `{"success":true,"message":"Quiz analytics fetched","data":{"attempts":40,"avgScore":7.2}}` | `{"success":false,"message":"Failed to fetch quiz analytics","error":"Failed to fetch quiz analytics"}` |
| POST | `/api/teacher/quizzes` | `{"scope":"chapter","title":"Chapter Quiz","courseId":"course_1","subjectId":"sub_1","chapterId":"ch_1","questions":[{"type":"mcq","question":"2+2?","options":["3","4"],"correctAnswer":"4"}]}` | `{"success":true,"message":"Quiz created","data":{"quizId":"quiz_2","assignedCount":0}}` | `{"success":false,"message":"At least one question is required","error":"At least one question is required"}` |
| POST | `/api/teacher/quizzes/bulk-upload` | `{"multipart":"file=<quiz.csv>"}` | `{"success":true,"message":"Quiz bulk upload completed","data":{"quizId":"quiz_3","imported":30,"failed":2}}` | `{"success":false,"message":"CSV file is required","error":"CSV file is required"}` |
| PATCH | `/api/teacher/quizzes/:quizId/assign` | `{"dueAt":"2026-04-10T18:00:00Z","targetType":"class","classId":"class_1"}` | `{"success":true,"message":"Quiz assigned","data":{"quizId":"quiz_2","assignedTo":25}}` | `{"success":false,"message":"classId is required for class assignment","error":"classId is required for class assignment"}` |
| POST | `/api/teacher/quizzes/:quizId/evaluate` | `{"answers":[{"questionId":"q1","answer":"4"}]}` | `{"success":true,"message":"Quiz evaluated","data":{"score":1,"total":1}}` | `{"success":false,"message":"Failed to evaluate quiz answers","error":"Failed to evaluate quiz answers"}` |
| POST | `/api/teacher/quizzes/:quizId/submissions` | `{"studentId":"stu_1","studentName":"Ali","answers":[{"questionId":"q1","answer":"4"}]}` | `{"success":true,"message":"Quiz submission saved","data":{"resultId":"res_1","score":8}}` | `{"success":false,"message":"studentId is required","error":"studentId is required"}` |
| GET | `/api/teacher/quizzes/:quizId/submissions` | `{"params":{"quizId":"quiz_2"}}` | `{"success":true,"message":"Quiz submissions fetched","data":{"items":[{"resultId":"res_1","studentId":"stu_1","score":8}]}}` | `{"success":false,"message":"Failed to fetch quiz submissions","error":"Failed to fetch quiz submissions"}` |
| PATCH | `/api/teacher/quizzes/:quizId/submissions/:resultId/grade-short` | `{"gradedAnswers":[{"questionId":"q2","marksAwarded":4,"feedback":"Good"}]}` | `{"success":true,"message":"Short answers graded","data":{"resultId":"res_1","updated":1}}` | `{"success":false,"message":"quizId and resultId are required","error":"quizId and resultId are required"}` |
| GET | `/api/teacher/settings/profile` | `{}` | `{"success":true,"message":"Profile settings fetched","data":{"fullName":"Sara","phoneNumber":"+923001112233"}}` | `{"success":false,"message":"Failed to fetch profile settings","error":"Failed to fetch profile settings"}` |
| PUT | `/api/teacher/settings/profile` | `{"fullName":"Sara Ahmed","phoneNumber":"03001112233","bio":"Math Teacher"}` | `{"success":true,"message":"Profile settings updated","data":{"fullName":"Sara Ahmed","phoneNumber":"+923001112233"}}` | `{"success":false,"message":"Invalid phone number","error":"Invalid phone number"}` |
| GET | `/api/teacher/settings/security` | `{}` | `{"success":true,"message":"Security settings fetched","data":{"sessions":[{"id":"sess_1","device":"Chrome on Windows"}]}}` | `{"success":false,"message":"Failed to fetch security settings","error":"Failed to fetch security settings"}` |
| PATCH | `/api/teacher/settings/security/sessions/:sessionDocId/revoke` | `{"params":{"sessionDocId":"sess_2"}}` | `{"success":true,"message":"Session revoked","data":{"sessionDocId":"sess_2"}}` | `{"success":false,"message":"Session not found","error":"Session not found"}` |
| PATCH | `/api/teacher/settings/security/sessions/revoke-all` | `{}` | `{"success":true,"message":"All other sessions revoked","data":{"revoked":3}}` | `{"success":false,"message":"Failed to revoke sessions","error":"Failed to revoke sessions"}` |

## Payment Endpoints

### Student Payments (`/api/payments`)

| Method | Endpoint | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|
| POST | `/api/payments/initiate` | `{"courseId":"course_1","classId":"class_1","shiftId":"shift_m","method":"bank_transfer","promoCode":"SUM10","installments":false}` | `{"success":true,"message":"Payment initiated","data":{"paymentId":"pay_1","reference":"SUM-2026-1001","originalAmount":10000,"courseDiscountPercent":10,"promoDiscountAmount":500,"totalAmount":8500,"status":"pending"}}` | `{"success":false,"message":"Class is full","error":"Class is full"}` |
| POST | `/api/payments/validate-promo` | `{"code":"SUM10","courseId":"course_1"}` | `{"success":true,"message":"Promo code is valid","data":{"discountAmount":1000,"finalAmount":9000}}` | `{"success":false,"message":"Promo code is inactive","error":"Promo code is inactive"}` |
| GET | `/api/payments/config` | `{}` | `{"success":true,"message":"Payment config fetched","data":{"jazzcash":{"enabled":true},"easypaisa":{"enabled":true},"bankTransfer":{"enabled":true}}}` | `{"success":false,"message":"Failed to fetch payment config","error":"Failed to fetch payment config"}` |
| POST | `/api/payments/:id/receipt` | `{"params":{"id":"pay_1"},"receiptUrl":"https://cdn/receipt.jpg"}` | `{"success":true,"message":"Receipt uploaded","data":{"paymentId":"pay_1","status":"under_review"}}` | `{"success":false,"message":"Payment not found","error":"Payment not found"}` |
| GET | `/api/payments/:id/status` | `{"params":{"id":"pay_1"}}` | `{"success":true,"message":"Payment status fetched","data":{"id":"pay_1","status":"approved","verifiedAt":"2026-04-04T11:30:00.000Z"}}` | `{"success":false,"message":"Payment not found","error":"Payment not found"}` |
| GET | `/api/payments/my-payments` | `{}` | `{"success":true,"message":"Payments fetched","data":[{"id":"pay_1","amount":8500,"status":"approved"}]}` | `{"success":false,"message":"Failed to fetch payments","error":"Failed to fetch payments"}` |
| GET | `/api/payments/my-installments` | `{}` | `{"success":true,"message":"Installments fetched","data":[{"planId":"plan_1","numberOfInstallments":3,"remainingAmount":4000}]}` | `{"success":false,"message":"Failed to fetch installments","error":"Failed to fetch installments"}` |

### Admin Payments and Installments (`/api/admin`)

| Method | Endpoint | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|
| GET | `/api/admin/payments` | `{}` | `{"success":true,"message":"Payments fetched","data":[{"id":"pay_1","studentName":"Ali","status":"under_review"}]}` | `{"success":false,"message":"Access denied","code":"ACCESS_DENIED"}` |
| PATCH | `/api/admin/payments/:id/verify` | `{"params":{"id":"pay_1"},"action":"approve"}` | `{"success":true,"message":"Payment approved","data":{"paymentId":"pay_1","status":"approved"}}` | `{"success":false,"message":"Action must be approve or reject","error":"Action must be approve or reject"}` |
| PATCH | `/api/admin/payments/:paymentId/verify` | `{"params":{"paymentId":"pay_1"},"action":"reject"}` | `{"success":true,"message":"Payment rejected","data":{"paymentId":"pay_1","status":"rejected"}}` | `{"success":false,"message":"Payment not found","error":"Payment not found"}` |
| GET | `/api/admin/installments` | `{"query":{"status":"pending","search":"Ali"}}` | `{"success":true,"message":"Installments fetched","data":[{"planId":"plan_1","studentName":"Ali","remainingAmount":4000}]}` | `{"success":false,"message":"Failed to fetch installments","error":"Failed to fetch installments"}` |
| GET | `/api/admin/installments/:planId` | `{"params":{"planId":"plan_1"}}` | `{"success":true,"message":"Installment details fetched","data":{"id":"plan_1","installments":[{"number":1,"status":"paid"}]}}` | `{"success":false,"message":"Plan not found","error":"Plan not found"}` |
| POST | `/api/admin/installments` | `{"studentId":"stu_1","courseId":"course_1","classId":"class_1","totalAmount":9000,"numberOfInstallments":3,"startDate":"2026-05-01"}` | `{"success":true,"message":"Installment plan created","data":{"id":"plan_1"}}` | `{"success":false,"message":"Failed to create plan","error":"Failed to create plan"}` |
| PATCH | `/api/admin/installments/:planId/:number/pay` | `{"params":{"planId":"plan_1","number":"2"}}` | `{"success":true,"message":"Installment marked paid","data":{}}` | `{"success":false,"message":"Plan not found","error":"Plan not found"}` |
| PUT | `/api/admin/installments/:planId/override` | `{"installments":[{"number":1,"amount":3000,"dueDate":"2026-05-01"}]}` | `{"success":true,"message":"Installment plan overridden","data":{"id":"plan_1"}}` | `{"success":false,"message":"Failed to override installment plan","error":"Failed to override installment plan"}` |
| POST | `/api/admin/installments/send-reminders` | `{"studentId":"stu_1"}` | `{"success":true,"message":"Installment reminders sent","data":{"sent":true,"remindersSent":1}}` | `{"success":false,"message":"Failed to send reminders","error":"Failed to send reminders"}` |

## Admin Endpoints (`/api/admin`)

### Analytics

| Method | Endpoint | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|
| GET | `/api/admin/stats` | `{}` | `{"success":true,"message":"Dashboard stats fetched","data":{"totalStudents":200,"totalTeachers":18,"totalCourses":25,"monthlyRevenue":350000}}` | `{"success":false,"message":"Failed to fetch stats","error":"Failed to fetch stats"}` |
| GET | `/api/admin/revenue-chart` | `{"query":{"days":30}}` | `{"success":true,"message":"Revenue chart fetched","data":[{"date":"2026-04-01","amount":15000}]}` | `{"success":false,"message":"Failed to fetch revenue chart","error":"Failed to fetch revenue chart"}` |
| GET | `/api/admin/recent-enrollments` | `{}` | `{"success":true,"message":"Recent enrollments fetched","data":[{"studentName":"Ali","className":"Batch A"}]}` | `{"success":false,"message":"Failed to fetch enrollments","error":"Failed to fetch enrollments"}` |
| GET | `/api/admin/top-courses` | `{}` | `{"success":true,"message":"Top courses fetched","data":[{"courseId":"course_1","title":"Math 101","enrollmentCount":120}]}` | `{"success":false,"message":"Failed to fetch top courses","error":"Failed to fetch top courses"}` |
| GET | `/api/admin/recent-activity` | `{}` | `{"success":true,"message":"Recent activity fetched","data":[{"type":"enrollment","actor":"admin"}]}` | `{"success":false,"message":"Failed to fetch activity","error":"Failed to fetch activity"}` |
| GET | `/api/admin/analytics-report` | `{"query":{"days":90}}` | `{"success":true,"message":"Analytics report generated","data":{"periodDays":90,"totals":{"students":200}}}` | `{"success":false,"message":"Failed to generate report","error":"Failed to generate report"}` |

### Users, Teachers, Students

| Method | Endpoint | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|
| GET | `/api/admin/users` | `{"query":{"role":"teacher","isActive":"true","search":"sara"}}` | `{"success":true,"message":"Users fetched","data":[{"uid":"uid_1","email":"sara@sumacademy.net","role":"teacher"}]}` | `{"success":false,"message":"Failed to fetch users","error":"Failed to fetch users"}` |
| GET | `/api/admin/users/:uid` | `{"params":{"uid":"uid_1"}}` | `{"success":true,"message":"User fetched","data":{"uid":"uid_1","role":"teacher","teacher":{"subject":"Math"}}}` | `{"success":false,"message":"User not found","error":"User not found"}` |
| POST | `/api/admin/users` | `{"name":"Teacher One","email":"teacher1@sumacademy.net","password":"Strong@123","phone":"+923001112233","role":"teacher","subject":"Physics"}` | `{"success":true,"message":"User created","data":{"uid":"uid_200","role":"teacher"}}` | `{"success":false,"message":"Email already exists","error":"Email already exists"}` |
| PUT | `/api/admin/users/:uid` | `{"fullName":"Teacher 1 Updated","isActive":true,"phoneNumber":"03001112233"}` | `{"success":true,"message":"User updated","data":{"uid":"uid_200"}}` | `{"success":false,"message":"You cannot deactivate your own account","error":"You cannot deactivate your own account","errors":{"code":"SELF_DEACTIVATE_NOT_ALLOWED"}}` |
| DELETE | `/api/admin/users/:uid` | `{"params":{"uid":"uid_200"}}` | `{"success":true,"message":"User deleted successfully","data":{"uid":"uid_200","deletedFromAuth":true,"deletedFromCollections":["users","teachers"]}}` | `{"success":false,"message":"You cannot delete your own account","error":"You cannot delete your own account","errors":{"code":"SELF_DELETE_NOT_ALLOWED"}}` |
| PATCH | `/api/admin/users/:uid/role` | `{"role":"admin"}` | `{"success":true,"message":"Role updated","data":{"uid":"uid_200","role":"admin"}}` | `{"success":false,"message":"Invalid role","error":"Invalid role"}` |
| PATCH | `/api/admin/users/:uid/reset-device` | `{"params":{"uid":"uid_1"}}` | `{"success":true,"message":"Device reset successfully","data":{"uid":"uid_1"}}` | `{"success":false,"message":"Failed to reset device","error":"Failed to reset device"}` |
| GET | `/api/admin/teachers` | `{}` | `{"success":true,"message":"Teachers fetched","data":[{"uid":"t_1","fullName":"Sara"}]}` | `{"success":false,"message":"Failed to fetch teachers","error":"Failed to fetch teachers"}` |
| GET | `/api/admin/teachers/:uid` | `{"params":{"uid":"t_1"}}` | `{"success":true,"message":"Teacher fetched","data":{"uid":"t_1","subject":"Math"}}` | `{"success":false,"message":"Teacher not found","error":"Teacher not found"}` |
| GET | `/api/admin/students` | `{}` | `{"success":true,"message":"Students fetched","data":[{"uid":"s_1","fullName":"Ali","enrolledClasses":["class_1"],"enrolledClassesCount":1,"enrolledCourses":["course_1","course_2"]}]}` | `{"success":false,"message":"Failed to fetch students","error":"Failed to fetch students"}` |
| PATCH | `/api/admin/students/:uid/approve` | `{"params":{"uid":"s_1"}}` | `{"success":true,"message":"Student approved","data":{"uid":"s_1","approvalStatus":"approved"}}` | `{"success":false,"message":"Student not found","error":"Student not found"}` |
| PATCH | `/api/admin/students/:uid/reject` | `{"params":{"uid":"s_2"},"reason":"Invalid documents"}` | `{"success":true,"message":"Student rejected","data":{"uid":"s_2","approvalStatus":"rejected"}}` | `{"success":false,"message":"Student not found","error":"Student not found"}` |
| GET | `/api/admin/students/template` | `{}` | `{"file":"students-template.csv"}` | `{"success":false,"message":"Failed to download template","error":"Failed to download template"}` |
| POST | `/api/admin/students/bulk-upload` | `{"multipart":"file=<students.csv>"}` | `{"success":true,"message":"Bulk upload completed","data":{"created":20,"updated":2,"failed":1}}` | `{"success":false,"message":"CSV file is required","error":"CSV file is required"}` |
| GET | `/api/admin/students/:uid/progress` | `{"params":{"uid":"s_1"}}` | `{"success":true,"message":"Student progress fetched","data":{"uid":"s_1","courses":[{"courseId":"course_1","progress":50}]}}` | `{"success":false,"message":"Student not found","error":"Student not found"}` |
| GET | `/api/admin/students/:uid` | `{"params":{"uid":"s_1"}}` | `{"success":true,"message":"Student fetched","data":{"uid":"s_1","fullName":"Ali"}}` | `{"success":false,"message":"Student not found","error":"Student not found"}` |

### Admin Quiz Management

| Method | Endpoint | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|
| GET | `/api/admin/quizzes/template` | `{}` | `{"file":"quiz-template.csv"}` | `{"success":false,"message":"Failed to download template","error":"Failed to download template"}` |
| GET | `/api/admin/quizzes` | `{}` | `{"success":true,"message":"Teacher quizzes fetched","data":{"items":[{"id":"quiz_1","title":"Algebra"}]}}` | `{"success":false,"message":"Failed to fetch quizzes","error":"Failed to fetch quizzes"}` |
| GET | `/api/admin/quizzes/:quizId` | `{"params":{"quizId":"quiz_1"}}` | `{"success":true,"message":"Quiz fetched","data":{"id":"quiz_1","title":"Algebra"}}` | `{"success":false,"message":"quizId is required","error":"quizId is required"}` |
| GET | `/api/admin/quizzes/:quizId/analytics` | `{"params":{"quizId":"quiz_1"}}` | `{"success":true,"message":"Quiz analytics fetched","data":{"attempts":40,"avgScore":7.3}}` | `{"success":false,"message":"Failed to fetch quiz analytics","error":"Failed to fetch quiz analytics"}` |
| POST | `/api/admin/quizzes` | `{"scope":"subject","title":"Subject Quiz","courseId":"course_1","subjectId":"sub_1","questions":[{"type":"mcq","question":"2+2?"}]}` | `{"success":true,"message":"Quiz created","data":{"quizId":"quiz_2"}}` | `{"success":false,"message":"At least one question is required","error":"At least one question is required"}` |
| POST | `/api/admin/quizzes/bulk-upload` | `{"multipart":"file=<quiz.csv>"}` | `{"success":true,"message":"Quiz bulk upload completed","data":{"imported":30,"failed":0}}` | `{"success":false,"message":"CSV file is required","error":"CSV file is required"}` |
| PATCH | `/api/admin/quizzes/:quizId/assign` | `{"dueAt":"2026-04-10T18:00:00Z","targetType":"class","classId":"class_1"}` | `{"success":true,"message":"Quiz assigned","data":{"quizId":"quiz_2","assignedTo":25}}` | `{"success":false,"message":"classId is required for class assignment","error":"classId is required for class assignment"}` |
| GET | `/api/admin/quizzes/:quizId/submissions` | `{"params":{"quizId":"quiz_2"}}` | `{"success":true,"message":"Quiz submissions fetched","data":{"items":[{"resultId":"res_1","score":8}]}}` | `{"success":false,"message":"Failed to fetch quiz submissions","error":"Failed to fetch quiz submissions"}` |

### Course Management

| Method | Endpoint | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|
| GET | `/api/admin/courses` | `{}` | `{"success":true,"message":"Courses fetched","data":[{"id":"course_1","title":"Math 101","discountPercent":10,"enrollmentCount":45}]}` | `{"success":false,"message":"Failed to fetch courses","error":"Failed to fetch courses"}` |
| POST | `/api/admin/courses` | `{"title":"Biology XI","description":"Full biology course","category":"Science","level":"Intermediate","price":12000,"discountPercent":15,"subjects":[{"name":"Botany","teacherId":"t_1"}]}` | `{"success":true,"message":"Course created","data":{"id":"course_5"}}` | `{"success":false,"message":"At least one subject is required","error":"At least one subject is required"}` |
| PUT | `/api/admin/courses/:courseId` | `{"title":"Biology XI Updated","discountPercent":20,"status":"active"}` | `{"success":true,"message":"Course updated","data":{"courseId":"course_5"}}` | `{"success":false,"message":"Failed to update course","error":"Failed to update course"}` |
| PATCH | `/api/admin/courses/:courseId` | `{"discountPercent":25}` | `{"success":true,"message":"Course updated","data":{"courseId":"course_5"}}` | `{"success":false,"message":"Failed to update course","error":"Failed to update course"}` |
| DELETE | `/api/admin/courses/:courseId` | `{"params":{"courseId":"course_5"}}` | `{"success":true,"message":"Course deleted","data":{"courseId":"course_5"}}` | `{"success":false,"message":"Failed to delete course","error":"Failed to delete course"}` |
| POST | `/api/admin/courses/:courseId/subjects` | `{"name":"Genetics","teacherId":"t_2","order":2}` | `{"success":true,"message":"Subject added","data":{"subjectId":"sub_20","name":"Genetics"}}` | `{"success":false,"message":"Subject name and teacher are required","error":"Subject name and teacher are required"}` |
| DELETE | `/api/admin/courses/:courseId/subjects/:subjectId` | `{"params":{"courseId":"course_5","subjectId":"sub_20"}}` | `{"success":true,"message":"Subject removed","data":{"subjectId":"sub_20"}}` | `{"success":false,"message":"Subject not found","error":"Subject not found"}` |
| POST | `/api/admin/courses/:courseId/subjects/:subjectId/content` | `{"type":"video","title":"DNA Intro","url":"https://cdn/dna.mp4"}` | `{"success":true,"message":"Content added","data":{"id":"cnt_30","type":"video"}}` | `{"success":false,"message":"type, title and url are required","error":"type, title and url are required"}` |
| GET | `/api/admin/courses/:courseId/content` | `{"params":{"courseId":"course_5"}}` | `{"success":true,"message":"Course content fetched","data":[{"subjectId":"sub_10","items":[{"contentId":"cnt_30"}]}]}` | `{"success":false,"message":"Course not found","error":"Course not found"}` |
| DELETE | `/api/admin/courses/:courseId/content/:contentId` | `{"params":{"courseId":"course_5","contentId":"cnt_30"}}` | `{"success":true,"message":"Content deleted","data":{"contentId":"cnt_30"}}` | `{"success":false,"message":"Failed to delete content","error":"Failed to delete content"}` |

### Class Management (Class-first Enrollment)

| Method | Endpoint | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|
| GET | `/api/admin/classes` | `{}` | `{"success":true,"message":"Classes fetched","data":[{"id":"class_1","name":"Batch A","capacity":5,"enrolledCount":4}]}` | `{"success":false,"message":"Failed to fetch classes","error":"Failed to fetch classes"}` |
| POST | `/api/admin/classes` | `{"name":"Batch A","batchCode":"BA-2026","capacity":5,"status":"active","assignedCourses":[{"courseId":"course_1"}],"shifts":[{"name":"Morning","days":["Mon","Wed"],"startTime":"10:00","endTime":"11:00","courseId":"course_1"}]}` | `{"success":true,"message":"Class created","data":{"id":"class_1","name":"Batch A","capacity":5}}` | `{"success":false,"message":"At least 1 course is required","error":"At least 1 course is required"}` |
| PUT | `/api/admin/classes/:classId` | `{"capacity":6,"status":"active"}` | `{"success":true,"message":"Class updated","data":{"classId":"class_1"}}` | `{"success":false,"message":"Cannot set capacity below enrolled students","error":"Cannot set capacity below enrolled students"}` |
| DELETE | `/api/admin/classes/:classId` | `{"params":{"classId":"class_1"}}` | `{"success":true,"message":"Class deleted","data":{"classId":"class_1"}}` | `{"success":false,"message":"Class has active enrollments and cannot be deleted","error":"Class has active enrollments and cannot be deleted"}` |
| POST | `/api/admin/classes/:classId/courses` | `{"courseId":"course_2"}` | `{"success":true,"message":"Course assigned to class","data":{"courseId":"course_2","title":"Physics 201"}}` | `{"success":false,"message":"Course already assigned to class","error":"Course already assigned to class"}` |
| DELETE | `/api/admin/classes/:classId/courses/:courseId` | `{"params":{"classId":"class_1","courseId":"course_2"}}` | `{"success":true,"message":"Course removed from class","data":{"courseId":"course_2"}}` | `{"success":false,"message":"Cannot remove course while students are enrolled","error":"Cannot remove course while students are enrolled"}` |
| POST | `/api/admin/classes/:classId/shifts` | `{"name":"Evening","days":["Tue","Thu"],"startTime":"17:00","endTime":"18:00","courseId":"course_1","teacherId":"t_1"}` | `{"success":true,"message":"Shift added","data":{"id":"shift_e","name":"Evening"}}` | `{"success":false,"message":"Assign at least one course before adding shifts","error":"Assign at least one course before adding shifts"}` |
| PUT | `/api/admin/classes/:classId/shifts/:shiftId` | `{"startTime":"17:30","endTime":"18:30"}` | `{"success":true,"message":"Shift updated","data":{"id":"shift_e"}}` | `{"success":false,"message":"Shift not found","error":"Shift not found"}` |
| DELETE | `/api/admin/classes/:classId/shifts/:shiftId` | `{"params":{"classId":"class_1","shiftId":"shift_e"}}` | `{"success":true,"message":"Shift removed","data":{"shiftId":"shift_e"}}` | `{"success":false,"message":"Cannot remove shift used by enrolled students","error":"Cannot remove shift used by enrolled students"}` |
| POST | `/api/admin/classes/:classId/students` | `{"studentId":"s_1","shiftId":"shift_m"}` | `{"success":true,"message":"Student enrolled in Batch A! Access granted to 2 course(s).","data":{"classId":"class_1","className":"Batch A","studentId":"s_1","coursesEnrolled":2,"createdEnrollments":2,"remainingCapacity":0,"capacity":5,"currentCount":5,"shiftId":"shift_m"}}` | `{"success":false,"message":"Student is already enrolled in this class","error":"Student is already enrolled in this class","errors":{"code":"ALREADY_ENROLLED"}}` |
| GET | `/api/admin/classes/:classId/students` | `{"params":{"classId":"class_1"}}` | `{"success":true,"message":"Class students fetched","data":[{"studentId":"s_1","fullName":"Ali","shiftName":"Morning","enrolledAt":"2026-04-04T10:00:00.000Z"}]}` | `{"success":false,"message":"Class not found","error":"Class not found"}` |
| POST | `/api/admin/classes/:classId/enroll` | `{"studentId":"s_2","shiftId":"shift_m"}` | `{"success":true,"message":"Student enrolled in Batch A! Access granted to 2 course(s).","data":{"classId":"class_1","studentId":"s_2","coursesEnrolled":2,"remainingCapacity":0}}` | `{"success":false,"message":"Class is full. Capacity is 5 students. Currently 5 enrolled.","error":"Class is full. Capacity is 5 students. Currently 5 enrolled.","errors":{"code":"CLASS_FULL","capacity":5,"currentCount":5}}` |
| DELETE | `/api/admin/classes/:classId/students/:studentId` | `{"params":{"classId":"class_1","studentId":"s_1"}}` | `{"success":true,"message":"Ali removed from class. Access to class courses revoked.","data":{"classId":"class_1","studentId":"s_1","coursesRevoked":2}}` | `{"success":false,"message":"Student is not enrolled in this class","error":"Student is not enrolled in this class"}` |

### Support Inbox

| Method | Endpoint | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|
| GET | `/api/admin/support/messages` | `{"query":{"status":"unread","source":"student","search":"video"}}` | `{"success":true,"message":"Support messages fetched","data":[{"id":"msg_1","subject":"Video issue","status":"unread"}]}` | `{"success":false,"message":"Failed to fetch support messages","error":"Failed to fetch support messages"}` |
| PATCH | `/api/admin/support/messages/:messageId/read` | `{"params":{"messageId":"msg_1"},"isRead":true}` | `{"success":true,"message":"Support message updated","data":{"id":"msg_1","isRead":true,"status":"read"}}` | `{"success":false,"message":"Message not found","error":"Message not found"}` |
| POST | `/api/admin/support/messages/:messageId/reply` | `{"params":{"messageId":"msg_1"},"replyMessage":"Please check now."}` | `{"success":true,"message":"Reply sent successfully","data":{"id":"msg_1","status":"replied"}}` | `{"success":false,"message":"replyMessage is required","error":"replyMessage is required"}` |
| DELETE | `/api/admin/support/messages/:messageId` | `{"params":{"messageId":"msg_1"}}` | `{"success":true,"message":"Support message deleted","data":{"id":"msg_1"}}` | `{"success":false,"message":"Message not found","error":"Message not found"}` |

### Promo Codes

| Method | Endpoint | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|
| GET | `/api/admin/promo-codes` | `{}` | `{"success":true,"message":"Promo codes fetched","data":[{"id":"pc_1","code":"SUM10","isActive":true}]}` | `{"success":false,"message":"Failed to fetch promo codes","error":"Failed to fetch promo codes"}` |
| POST | `/api/admin/promo-codes` | `{"code":"SUM10","discountType":"percentage","discountValue":10,"courseId":"course_1","usageLimit":100,"expiresAt":"2026-12-31T23:59:59Z","isSingleUse":true,"isActive":true}` | `{"success":true,"message":"Promo code created","data":{"id":"pc_1","code":"SUM10"}}` | `{"success":false,"message":"Code already exists","error":"Code already exists"}` |
| PUT | `/api/admin/promo-codes/:codeId` | `{"discountValue":15,"usageLimit":200,"isActive":true}` | `{"success":true,"message":"Promo code updated","data":{"id":"pc_1"}}` | `{"success":false,"message":"Promo code not found","error":"Promo code not found"}` |
| DELETE | `/api/admin/promo-codes/:codeId` | `{"params":{"codeId":"pc_1"}}` | `{"success":true,"message":"Promo code deleted","data":{}}` | `{"success":false,"message":"Promo code not found","error":"Promo code not found"}` |
| PATCH | `/api/admin/promo-codes/:codeId/toggle` | `{"isActive":false}` | `{"success":true,"message":"Promo code deactivated","data":{"id":"pc_1","isActive":false}}` | `{"success":false,"message":"isActive boolean is required","error":"isActive boolean is required"}` |
| POST | `/api/admin/promo-codes/validate` | `{"code":"SUM10","courseId":"course_1","studentId":"s_1"}` | `{"success":true,"message":"Promo code is valid","data":{"discountAmount":1000,"finalAmount":9000}}` | `{"success":false,"message":"You have already used this promo code","error":"You have already used this promo code"}` |

### Certificates

| Method | Endpoint | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|
| GET | `/api/admin/certificates` | `{}` | `{"success":true,"message":"Certificates fetched","data":[{"certId":"CERT-1","studentName":"Ali","isRevoked":false}]}` | `{"success":false,"message":"Failed to fetch certificates","error":"Failed to fetch certificates"}` |
| POST | `/api/admin/certificates` | `{"studentId":"s_1","courseId":"course_1","allowIncomplete":true}` | `{"success":true,"message":"Certificate generated","data":{"id":"cert_doc_1","certId":"CERT-1"}}` | `{"success":false,"message":"Student or course not found","error":"Student or course not found"}` |
| PATCH | `/api/admin/certificates/:certId/revoke` | `{"params":{"certId":"CERT-1"}}` | `{"success":true,"message":"Certificate revoked","data":{"certId":"CERT-1","isRevoked":true}}` | `{"success":false,"message":"Certificate not found","error":"Certificate not found"}` |
| PATCH | `/api/admin/certificates/:certId/unrevoke` | `{"params":{"certId":"CERT-1"}}` | `{"success":true,"message":"Certificate unrevoked","data":{"certId":"CERT-1","isRevoked":false}}` | `{"success":false,"message":"Certificate not found","error":"Certificate not found"}` |

### Announcements

| Method | Endpoint | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|
| GET | `/api/admin/announcements` | `{}` | `{"success":true,"message":"Announcements fetched","data":[{"id":"ann_1","title":"Exam Week","isPinned":true}]}` | `{"success":false,"message":"Failed to fetch announcements","error":"Failed to fetch announcements"}` |
| POST | `/api/admin/announcements` | `{"title":"Exam Week","message":"Starts Monday","targetType":"all","sendEmail":true,"isPinned":true}` | `{"success":true,"message":"Announcement posted","data":{"id":"ann_2","emailsSent":180}}` | `{"success":false,"message":"Title and message required","error":"Title and message required"}` |
| PUT | `/api/admin/announcements/:id` | `{"title":"Updated Title","message":"Updated body","isPinned":false}` | `{"success":true,"message":"Announcement updated","data":{}}` | `{"success":false,"message":"Failed to update announcement","error":"Failed to update announcement"}` |
| DELETE | `/api/admin/announcements/:id` | `{"params":{"id":"ann_2"}}` | `{"success":true,"message":"Announcement deleted","data":{}}` | `{"success":false,"message":"Failed to delete announcement","error":"Failed to delete announcement"}` |
| PATCH | `/api/admin/announcements/:id/pin` | `{"isPinned":true}` | `{"success":true,"message":"Announcement pin updated","data":{"id":"ann_2","isPinned":true}}` | `{"success":false,"message":"Announcement not found","error":"Announcement not found"}` |

### Settings

| Method | Endpoint | Sample request JSON | Sample success JSON | Sample error JSON |
|---|---|---|---|---|
| GET | `/api/admin/settings` | `{}` | `{"success":true,"message":"Settings fetched","data":{"general":{"siteName":"SUM Academy"},"payment":{"bankTransfer":{"enabled":true}}}}` | `{"success":false,"message":"Failed to fetch settings","error":"Failed to fetch settings"}` |
| PUT | `/api/admin/settings/general` | `{"siteName":"SUM Academy","tagline":"Learn Smart","contactEmail":"help@sumacademy.net"}` | `{"success":true,"message":"Settings updated","data":{"general":{"siteName":"SUM Academy"}}}` | `{"success":false,"message":"Failed to update settings","error":"Failed to update settings"}` |
| PUT | `/api/admin/settings/hero` | `{"heading":"Future Ready Learning","subheading":"Join top batches"}` | `{"success":true,"message":"Settings updated","data":{"hero":{"heading":"Future Ready Learning"}}}` | `{"success":false,"message":"Failed to update settings","error":"Failed to update settings"}` |
| PUT | `/api/admin/settings/how-it-works` | `{"heading":"How It Works","steps":[{"title":"Enroll"}]}` | `{"success":true,"message":"Settings updated","data":{"howItWorks":{"heading":"How It Works"}}}` | `{"success":false,"message":"Failed to update settings","error":"Failed to update settings"}` |
| PUT | `/api/admin/settings/features` | `{"heading":"Features","items":[{"title":"Live classes"}]}` | `{"success":true,"message":"Settings updated","data":{"features":{"heading":"Features"}}}` | `{"success":false,"message":"Failed to update settings","error":"Failed to update settings"}` |
| PUT | `/api/admin/settings/testimonials` | `{"heading":"Testimonials","items":[{"name":"Ali","quote":"Great"}]}` | `{"success":true,"message":"Settings updated","data":{"testimonials":{"heading":"Testimonials"}}}` | `{"success":false,"message":"Failed to update settings","error":"Failed to update settings"}` |
| PUT | `/api/admin/settings/about` | `{"heading":"About Us","description":"Institute details"}` | `{"success":true,"message":"Settings updated","data":{"about":{"heading":"About Us"}}}` | `{"success":false,"message":"Failed to update settings","error":"Failed to update settings"}` |
| PUT | `/api/admin/settings/contact` | `{"email":"help@sumacademy.net","phone":"+923001112233","subjects":["Admissions"]}` | `{"success":true,"message":"Settings updated","data":{"contact":{"email":"help@sumacademy.net"}}}` | `{"success":false,"message":"Failed to update settings","error":"Failed to update settings"}` |
| PUT | `/api/admin/settings/footer` | `{"description":"Footer text","copyright":"© 2026"}` | `{"success":true,"message":"Settings updated","data":{"footer":{"description":"Footer text"}}}` | `{"success":false,"message":"Failed to update settings","error":"Failed to update settings"}` |
| PUT | `/api/admin/settings/appearance` | `{"primaryColor":"#0b7a75","secondaryColor":"#f4b400","fontFamily":"Poppins"}` | `{"success":true,"message":"Settings updated","data":{"appearance":{"primaryColor":"#0b7a75"}}}` | `{"success":false,"message":"Failed to update settings","error":"Failed to update settings"}` |
| PUT | `/api/admin/settings/certificate` | `{"issuerName":"SUM Academy","signatureName":"Director"}` | `{"success":true,"message":"Settings updated","data":{"certificate":{"issuerName":"SUM Academy"}}}` | `{"success":false,"message":"Failed to update settings","error":"Failed to update settings"}` |
| PUT | `/api/admin/settings/maintenance` | `{"enabled":false,"message":"Maintenance mode"}` | `{"success":true,"message":"Settings updated","data":{"maintenance":{"enabled":false}}}` | `{"success":false,"message":"Failed to update settings","error":"Failed to update settings"}` |
| PUT | `/api/admin/settings/email` | `{"smtpHost":"smtp.gmail.com","smtpPort":587,"smtpEmail":"noreply@sumacademy.net","smtpPassword":"***","fromName":"SUM Academy"}` | `{"success":true,"message":"Settings updated","data":{"email":{"smtpHost":"smtp.gmail.com"}}}` | `{"success":false,"message":"Failed to update settings","error":"Failed to update settings"}` |
| POST | `/api/admin/settings/email/test` | `{"testEmail":"admin@sumacademy.net"}` | `{"success":true,"message":"Test email sent successfully","data":{}}` | `{"success":false,"message":"Failed to send test email","error":"Failed to send test email"}` |
| PUT | `/api/admin/settings/payment` | `{"jazzcash":{"enabled":true},"easypaisa":{"enabled":true},"bankTransfer":{"enabled":true,"accountTitle":"SUM Academy"}}` | `{"success":true,"message":"Settings updated","data":{"payment":{"bankTransfer":{"enabled":true}}}}` | `{"success":false,"message":"Failed to update settings","error":"Failed to update settings"}` |
| PUT | `/api/admin/settings/security` | `{"maxLoginAttempts":5,"lockoutDuration":15,"sessionTimeout":60}` | `{"success":true,"message":"Settings updated","data":{"security":{"maxLoginAttempts":5}}}` | `{"success":false,"message":"Failed to update settings","error":"Failed to update settings"}` |
| GET | `/api/admin/settings/templates` | `{}` | `{"success":true,"message":"Email templates fetched","data":{"templates":{"welcome":{"subject":"Welcome"}}}}` | `{"success":false,"message":"Failed to fetch templates","error":"Failed to fetch templates"}` |
| PUT | `/api/admin/settings/templates` | `{"templateName":"welcome","subject":"Welcome to SUM","body":"Hello {{name}}"}` | `{"success":true,"message":"Template updated","data":{"templateName":"welcome"}}` | `{"success":false,"message":"templateName, subject and body are required","error":"templateName, subject and body are required"}` |

## Notes
- Student enrollment is class-first: student enrolls in class, then gets all assigned courses from that class.
- Course `enrollmentCount` is incremented/decremented during class enroll/remove flows.
- Deleting admin/teacher/student from dashboard removes linked role docs and Firebase Authentication user.
- Student self-registration remains blocked for login until approval (`PENDING_APPROVAL`).
- Transactions APIs are removed from admin dashboard flow; use payments and installments endpoints.

