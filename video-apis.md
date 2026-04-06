# SUM Academy Video APIs (Web + Android)

This file documents only video-related APIs.

## Response format

### Success
```json
{
  "success": true,
  "message": "Human readable message",
  "data": {}
}
```

### Error
```json
{
  "success": false,
  "message": "Error message",
  "error": "Error message",
  "errors": {
    "code": "OPTIONAL_ERROR_CODE"
  }
}
```

## Auth
- Student endpoints: `Authorization: Bearer <student-jwt>`
- Teacher/Admin endpoints: `Authorization: Bearer <teacher-or-admin-jwt>`

---

## 1) Get student course video content + lock status + resume time

`GET /api/student/courses/:courseId/content`

### Success example
```json
{
  "success": true,
  "message": "Course content fetched",
  "data": {
    "courseId": "course_123",
    "courseName": "Biology XI",
    "isCourseCompleted": false,
    "overallProgress": 38,
    "totalLectures": 8,
    "completedLectures": 3,
    "chapters": [
      {
        "chapterId": "ch_1",
        "title": "Chapter 1",
        "isChapterComplete": false,
        "lectures": [
          {
            "lectureId": "lec_1",
            "title": "Introduction",
            "isCompleted": true,
            "watchedPercent": 100,
            "resumeAtSeconds": 620,
            "durationSec": 620,
            "isLocked": false,
            "lockReason": "",
            "manuallyUnlocked": false,
            "videoUrl": "https://storage.googleapis.com/....mp4",
            "streamUrl": "",
            "signedUrl": "",
            "playbackUrl": "",
            "videoMode": "recorded",
            "isLiveSession": false,
            "videoTitle": "Lecture 1",
            "pdfNotes": [],
            "books": []
          }
        ],
        "quizzes": []
      }
    ],
    "subjectQuizzes": []
  }
}
```

### Common errors
- `403` with `errors.code: "PAYMENT_PENDING"`
- `403` with `errors.code: "CLASS_NOT_STARTED"`
- `403` with `errors.code: "CLASS_ENDED"`
- `403` not enrolled

---

## 2) Save student watch progress (use on pause, background, logout, periodic)

`PATCH /api/student/courses/:courseId/lectures/:lectureId/progress`

### Request body
```json
{
  "watchedPercent": 42,
  "currentTimeSec": 315,
  "durationSec": 750
}
```

### Success example
```json
{
  "success": true,
  "message": "Progress saved",
  "data": {
    "lectureId": "lec_2",
    "watchedPercent": 42,
    "currentTimeSec": 315,
    "durationSec": 750
  }
}
```

### Common errors
- `403` with `errors.code: "LECTURE_LOCKED"`
- `403` payment/class window blocked

---

## 3) Mark lecture complete

`POST /api/student/courses/:courseId/lectures/:lectureId/complete`

### Request body
```json
{
  "watchedPercent": 100,
  "currentTimeSec": 750,
  "durationSec": 750
}
```

### Success example
```json
{
  "success": true,
  "message": "Lecture completed! Keep going.",
  "data": {
    "lectureId": "lec_2",
    "completedCount": 4,
    "totalLectures": 8,
    "progressPercent": 50,
    "chapterCompleted": false,
    "chapterQuizUnlocked": false,
    "courseCompleted": false,
    "certificateGenerated": false,
    "nextAction": "continue"
  }
}
```

### Common errors
- `400` with `errors.code: "WATCH_REQUIREMENT_NOT_MET"`
- `403` with `errors.code: "LECTURE_LOCKED"`
- `400` with `errors.code: "COURSE_COMPLETED"`

---

## 4) Teacher/Admin unlock specific lecture videos for a student (manual rewatch access)

`PATCH /api/courses/:courseId/students/:studentId/video-access`

### Request body
```json
{
  "lectureAccess": [
    { "lectureId": "lec_1", "hasAccess": true },
    { "lectureId": "lec_2", "hasAccess": false }
  ]
}
```

### Success
```json
{
  "success": true,
  "message": "Video access updated successfully",
  "data": {
    "updatedCount": 2
  }
}
```

---

## 5) Teacher/Admin unlock all course videos for a student (rewatch)

`POST /api/courses/:courseId/students/:studentId/unlock-all`

### Success
```json
{
  "success": true,
  "message": "All 12 videos unlocked for student",
  "data": {
    "unlockedCount": 12
  }
}
```

After this, student content API returns `manuallyUnlocked: true` and `isLocked: false` on lectures.

---

## 6) Teacher/Admin get one student video progress in a course

`GET /api/courses/:courseId/students/:studentId/progress`

### Success example
```json
{
  "success": true,
  "message": "Progress fetched",
  "data": {
    "courseId": "course_123",
    "studentId": "student_001",
    "progressPercent": 64,
    "totalLectures": 11,
    "completedLectures": 7,
    "lectures": [
      {
        "lectureId": "lec_1",
        "title": "Intro",
        "chapterId": "ch_1",
        "order": 1,
        "isCompleted": true,
        "watchedPercent": 100,
        "currentTimeSec": 610,
        "durationSec": 610,
        "hasManualAccess": true,
        "isLocked": false
      }
    ],
    "quizzes": []
  }
}
```

---

## 7) Video library (Admin)

### List library
`GET /api/admin/videos`

### Add library item
`POST /api/admin/videos`

Request body:
```json
{
  "title": "Lecture 1 Recording",
  "url": "https://storage.googleapis.com/.../video.mp4",
  "courseId": "course_123",
  "courseName": "Biology XI",
  "teacherId": "teacher_001",
  "teacherName": "Ali",
  "isLiveSession": true,
  "videoMode": "live_session",
  "isActive": true
}
```

---

## 8) Video library (Teacher/Admin in teacher panel)

### List library
`GET /api/teacher/videos`

### Add library item
`POST /api/teacher/videos`

Request body (same style):
```json
{
  "title": "Chapter 2 Session",
  "url": "https://storage.googleapis.com/.../chapter-2.mp4",
  "courseId": "course_123",
  "isLiveSession": false
}
```

---

## 9) Attach video to lecture (chapter-wise content)

### Teacher route
`POST /api/teacher/lectures/:lectureId/content`

### Admin route
`POST /api/admin/courses/:courseId/subjects/:subjectId/content`

For video, send either `videoId` (from library) or direct `url`.

Request example:
```json
{
  "type": "video",
  "title": "Lecture 3",
  "videoId": "video_lib_123",
  "url": "",
  "videoMode": "recorded",
  "isLiveSession": false,
  "duration": "12:40"
}
```

---

## Android/Web implementation notes

1. Call `PATCH /progress` every 10s while playing, and immediately on pause/background/exit.
2. On player open, read `resumeAtSeconds` from content API and seek to that time.
3. Respect `isLocked` + `lockReason` before playing or attempting lecture quiz flow.
4. For rewatch after completion, teacher/admin must call unlock APIs first.
