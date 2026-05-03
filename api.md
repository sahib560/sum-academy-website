# Sum Academy API Documentation (v1.0)

This document provides details for all essential API endpoints used in the Sum Academy platform. It is intended for both the frontend team and the Android mobile team to ensure synchronization and correct implementation of features.

## Base URL
The base URL for all API requests is: `https://your-api-domain.com/api` (Replace with actual server URL).

## Authentication
Most endpoints require a `Bearer` token in the `Authorization` header. This token is obtained from Firebase Authentication.

### Get Current Profile
- **Endpoint**: `GET /auth/me`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "uid": "user_id",
        "email": "student@example.com",
        "fullName": "John Doe",
        "role": "student",
        "status": "active"
      }
    }
  }
  ```

---

## Student Assessments (Quizzes)

### List Classic Quizzes
- **Endpoint**: `GET /student/quizzes`
- **Success Response**: Array of quiz objects.

### List Scheduled Quizzes
- **Endpoint**: `GET /student/scheduled-quizzes`
- **Success Response**: Array of scheduled quiz objects.

### Get Quiz Details (Classic)
- **Endpoint**: `GET /student/quizzes/:quizId`
- **Description**: Fetches the questions for a specific quiz.

### Get Quiz Details (Scheduled)
- **Endpoint**: `GET /student/scheduled-quizzes/:quizId`

### Submit Quiz Attempt
- **Endpoint**: `POST /student/quizzes/:quizId/submit` (Classic)
- **Endpoint**: `POST /student/scheduled-quizzes/:quizId/submit` (Scheduled)
- **Payload**:
  ```json
  {
    "answers": [
      { "questionId": "q1", "answer": "Option A" },
      { "questionId": "q2", "answer": "The user's text" }
    ]
  }
  ```
- **Response**: Contains the evaluation result (score, percentage, isPassed).

### Report Security Violation
- **Endpoint**: `POST /student/security/violations`
- **Payload**:
  ```json
  {
    "reason": "tab_switch",
    "count": 1,
    "quizId": "quiz_123"
  }
  ```

---

## Student Assessments (Tests)

### List Available Tests
- **Endpoint**: `GET /student/tests`

### Start Test
- **Endpoint**: `POST /student/tests/:testId/start`
- **Description**: Initializes a test attempt and starts the timer on the server.

### Submit Test Answer (Incremental)
- **Endpoint**: `POST /student/tests/:testId/answer`
- **Payload**:
  ```json
  {
    "questionId": "q1",
    "answer": "Option B"
  }
  ```

### Finish Test
- **Endpoint**: `POST /student/tests/:testId/finish`
- **Description**: Ends the test and triggers final evaluation.

### Get Test Ranking/Results
- **Endpoint**: `GET /student/tests/:testId/ranking`

---

## Teacher & Admin Quiz Management

### List Quizzes
- **Endpoint**: `GET /teacher/quizzes`

### Create Quiz
- **Endpoint**: `POST /teacher/quizzes`
- **Payload**:
  ```json
  {
    "title": "Quiz Title",
    "courseId": "course_123",
    "subjectId": "subj_456",
    "scope": "subject",
    "passScore": 70,
    "questions": [
      {
        "questionText": "What is...?",
        "options": { "A": "...", "B": "..." },
        "correctAnswer": "A",
        "marks": 1,
        "imagePath": "path/to/image.jpg"
      }
    ]
  }
  ```

### Upload Question Image
- **Endpoint**: `POST /teacher/quizzes/questions/image`
- **Method**: `multipart/form-data`
- **Body**: `image` (file)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "imagePath": "uploads/quiz/xyz.jpg",
      "imageUrl": "https://..."
    }
  }
  ```

### Delete Question Image
- **Endpoint**: `POST /teacher/quizzes/questions/image/delete`
- **Payload**: `{ "imagePath": "..." }`

---

## Media & Storage

### Fetch Protected Image (Teacher Side)
- **Endpoint**: `GET /storage/protected-image`
- **Params**: `?path=uploads/quiz/abc.jpg`
- **Response**: Image Blob (requires Authorization header).

### Fetch Protected Image (Student Side)
- **Endpoint**: `GET /media/image`
- **Params**: `?path=uploads/quiz/abc.jpg`
- **Response**: Image Blob (requires Authorization header).

---

## Success & Error Messaging

### Success Template
```json
{
  "success": true,
  "data": { ... },
  "message": "Action completed successfully"
}
```

### Error Template
```json
{
  "success": false,
  "error": "Error title",
  "message": "Detailed error message for the user",
  "code": "SPECIFIC_ERROR_CODE"
}
```

### Common Error Codes
- `UNAUTHORIZED`: Token missing or expired.
- `FORBIDDEN`: User does not have required role.
- `ACCOUNT_DEACTIVATED`: Account blocked due to security violations.
- `RESOURCE_NOT_FOUND`: Quiz or test ID is invalid.
- `VALIDATION_ERROR`: Payload fields are missing or invalid.
