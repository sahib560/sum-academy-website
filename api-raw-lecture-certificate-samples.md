# Raw API Samples (Requested)

Below are raw JSON objects in the same structure currently returned by your backend.

## 1) Locked lecture object
From: `GET /api/student/courses/:courseId/content`  
Path inside response: `data.chapters[].lectures[]`

```jsonc
{
  "id": "4v6cK3Q2WfR9pLx7nT1m",
  "lectureId": "4v6cK3Q2WfR9pLx7nT1m",
  "chapterId": "chp_kf9A2mQ8z7",
  "courseId": "KscKrww9Yr8oNoIQpV2a",
  "title": "Chemical Bonding - Part 2",
  "order": 2,
  "duration": "14:20",
  "durationLabel": "14:20",
  "videoUrl": "https://storage.googleapis.com/sum-academy-lms.appspot.com/videos/courses/KscKrww9Yr8oNoIQpV2a/subjects/KscKrww9Yr8oNoIQpV2a/1743984000000-chemical-bonding-part-2.mp4",
  "streamUrl": "",
  "signedUrl": "",
  "playbackUrl": "",
  "videoMode": "recorded",
  "isLiveSession": false,
  "videoTitle": "Chemical Bonding - Part 2",
  "videoDuration": "14:20",
  "pdfNotes": [],
  "books": [],
  "notes": null,
  "isCompleted": false,
  "completedAt": null,
  "watchedPercent": 0,
  "resumeAtSeconds": 0,
  "durationSec": 860,
  "isPremiereLive": false,
  "livePlaybackMode": "recorded",
  "disableSeeking": false,
  "isLocked": true,
  "lockReason": "Complete previous lecture first",
  "unlocked": false,
  "access": {
    "canWatch": false,
    "canSeekForward": false,
    "isPaymentLocked": false,
    "isProgressLocked": true, // locked because previous lecture is not completed
    "isClassLocked": false,
    "isCompletionLocked": false,
    "manuallyUnlocked": false
  },
  "lockAfterCompletion": false, // enrollment/course not completed yet
  "rewatch": {
    "isAllowed": false,
    "unlockedByTeacher": false,
    "unlockedAt": null,
    "unlockedBy": null
  },
  "manuallyUnlocked": false
}
```

## 2) Raw certificate JSON
From: `GET /api/student/certificates`  
Path inside response: `data[]`

```jsonc
{
  "id": "3uR0gK2aP9mQzv8XyT4n",
  "studentId": "M4m0hT7BfRj2e9QwK6Ys",
  "studentName": "Ahsan Ali",
  "courseId": "KscKrww9Yr8oNoIQpV2a",
  "subjectId": "KscKrww9Yr8oNoIQpV2a", // present when subject-course mapping is used
  "courseName": "Chemistry XI-Pre Medical",
  "classId": "TR5HYHIIuuZ6Xlouoa5k",
  "className": "Class Pre Medical for XI batch 0001",
  "batchCode": "CLAS-15940",
  "completionScope": "class", // "course" when not class-scoped
  "completionTitle": "Class Pre Medical for XI batch 0001 (CLAS-15940) - Chemistry XI-Pre Medical",
  "certId": "SUM-2026-A1B2C3D4",
  "verificationUrl": "https://sumacademy.net/verify/SUM-2026-A1B2C3D4",
  "isRevoked": false,
  "issuedAt": "2026-04-07T14:12:26.000Z",
  "createdAt": "2026-04-07T14:12:26.000Z",
  "updatedAt": "2026-04-07T14:12:26.000Z",
  "revokedAt": null
}
```

