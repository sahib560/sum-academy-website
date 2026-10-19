# PDF Resource Management System — Architecture & Documentation

## 1. System Overview

The **PDF Resource Management System** is a full-stack educational document repository integrated into the SUM Academy platform. It enables:
- **Administrators**: Upload, categorize, manage, publish/unpublish, preview, and delete educational PDF resources.
- **Public Visitors & Students**: Discover, search, filter, preview, and download published educational PDFs without requiring an account or login.

```mermaid
flowchart TD
    subgraph Client ["Client Tier (React 19 / Vite / Tailwind)"]
        A["Public /resources"] -->|Browse & Filter| APICall1["Axios GET"]
        B["Admin /admin/pdf-resources"] -->|Upload / Manage| APICall2["Axios POST/PATCH/DELETE"]
        C["PdfViewerModal"] -->|Inline Preview Stream| APIStream["GET /preview"]
    end

    subgraph Server ["Server Tier (Express 5 / Node.js 20+)"]
        APICall1 --> PublicRoutes["/api/public/pdf-resources"]
        APICall2 --> AdminRoutes["/api/admin/pdf-resources"]
        APIStream --> StreamRoutes["Stream Controller"]
        AdminRoutes --> AuthMiddleware["verifyToken + requireRole('admin')"]
        AdminRoutes --> Multer["Multer (MemoryStorage, 50MB, PDF filter)"]
        Multer --> MagicBytes["Magic Bytes Validation (%PDF-)"]
    end

    subgraph Storage ["Data & Storage Tier"]
        MagicBytes --> R2Upload["Cloudflare R2 (Private Bucket)"]
        AdminRoutes --> Firestore["Google Cloud Firestore (pdfResources)"]
        StreamRoutes --> R2Stream["R2 GetObjectCommand (Range Support)"]
        R2Upload -.->|Compensation on Failure| R2Delete["R2 DeleteObjectCommand"]
    end
```

---

## 2. Architecture & Design Decisions

### Cloudflare R2 Storage Strategy
- **Private Bucket**: All PDF objects are stored securely in Cloudflare R2 without public bucket exposure.
- **Server-Mediated Streaming**: Both preview and download requests flow through authenticated or status-checked backend streaming endpoints.
- **Content-Disposition Control**:
  - `preview`: Streams with `Content-Disposition: inline; filename="<sanitized>.pdf"` for instant in-browser rendering.
  - `download`: Streams with `Content-Disposition: attachment; filename="<sanitized>.pdf"` and triggers an atomic Firestore `downloadCount` increment.
- **Range Request Support**: The `streamPdfFileFromR2` utility supports HTTP 206 Partial Content (Range headers), enabling fast page-by-page rendering in native PDF viewers without downloading the entire file first.

### Upload Pipeline & Compensation Pattern
1. **Multer & Magic-Byte Validation**: Files are received into memory with a 50MB size limit. The backend inspects the first 5 bytes (`%PDF-` / `0x25 0x50 0x44 0x46 0x2D`) to ensure the file is an authentic PDF, rejecting disguised binaries or script files.
2. **Deterministic & Safe Key Generation**: Storage paths follow `pdf-resources/<timestamp>-<uuid>.pdf`. Original user-supplied filenames are preserved solely in document metadata (`originalFileName`) to prevent directory traversal or file-system injection.
3. **Atomic Compensation**:
   - If Cloudflare R2 upload succeeds but the subsequent Firestore write/update fails, the server initiates an immediate compensation cleanup to delete the newly uploaded R2 object.
   - When a resource is deleted by an admin, the Firestore metadata is removed and the corresponding R2 object is purged.

---

## 3. Firestore Data Model

### Collection: `pdfResources`

```json
{
  "title": "A-Level Mathematics Past Papers 2024",
  "slug": "a-level-mathematics-past-papers-2024-k8f9a2",
  "description": "Complete past examination papers with mark schemes.",
  "category": "Past Papers",
  "subject": "Mathematics",
  "classLevel": "A-Level",
  "tags": ["exam", "past-papers", "marking-scheme"],
  "originalFileName": "A_Level_Math_2024.pdf",
  "objectKey": "pdf-resources/1776592800000-4b2a8d11-e612-4a0b-8d9e.pdf",
  "storageProvider": "cloudflare-r2",
  "contentType": "application/pdf",
  "fileSize": 4194304,
  "fileSizeFormatted": "4.00 MB",
  "pageCount": null,
  "downloadCount": 142,
  "status": "published",
  "isPublic": true,
  "uploadedBy": "firebase-uid-admin",
  "uploaderEmail": "admin@sumacademy.com",
  "createdAt": "2026-10-19T10:00:00.000Z",
  "updatedAt": "2026-10-19T10:00:00.000Z",
  "publishedAt": "2026-10-19T10:00:00.000Z"
}
```

### Recommended Firestore Indexes

For optimal query performance with compound filtering:

| Collection | Fields Indexed | Query Scope | Purpose |
|------------|----------------|-------------|---------|
| `pdfResources` | `status` (Ascending), `createdAt` (Descending) | Collection | Filter published resources ordered by recency |
| `pdfResources` | `status` (Ascending), `category` (Ascending), `createdAt` (Descending) | Collection | Filter by publication status + category |
| `pdfResources` | `status` (Ascending), `subject` (Ascending), `createdAt` (Descending) | Collection | Filter by publication status + subject |

---

## 4. API Specification

### Public Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/public/pdf-resources` | Search and filter published resources (query params: `search`, `category`, `subject`, `classLevel`, `page`, `limit`) | No |
| `GET` | `/api/public/pdf-resources/:id` | Fetch public resource metadata by ID (only returns published resources) | No |
| `GET` | `/api/public/pdf-resources/:id/preview` | Stream PDF file inline for modal/in-browser preview | No |
| `GET` | `/api/public/pdf-resources/:id/download` | Stream PDF file as attachment and increment `downloadCount` | No |

### Admin Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/admin/pdf-resources` | Paginated listing of all resources (draft, published, archived) with search/filter | Admin Role |
| `GET` | `/api/admin/pdf-resources/stats` | Aggregated metrics: total, published, draft, archived counts | Admin Role |
| `GET` | `/api/admin/pdf-resources/:id` | Full resource metadata details | Admin Role |
| `GET` | `/api/admin/pdf-resources/:id/preview` | Stream PDF file inline for administrative preview (works for drafts/archived) | Admin Role |
| `POST` | `/api/admin/pdf-resources` | Multipart upload of new PDF file + metadata (`multipart/form-data`) | Admin Role |
| `PATCH` | `/api/admin/pdf-resources/:id` | Update metadata or replace existing PDF file | Admin Role |
| `PATCH` | `/api/admin/pdf-resources/:id/status` | Quick toggle of publication status (`draft`, `published`, `archived`) | Admin Role |
| `DELETE` | `/api/admin/pdf-resources/:id` | Delete metadata from Firestore and delete object from Cloudflare R2 | Admin Role |

---

## 5. Frontend Pages & Components

### 1. Public PDF Library (`/resources`)
- **File**: `frontend/src/pages/public/Resources.jsx`
- **Features**:
  - Live title/description/tag search with debounced typing.
  - Dropdown filters for Category, Subject, and Class Level.
  - Active filter badges with "Clear all" action.
  - Responsive cards with document metadata (size, category, subject, class level, date, download count).
  - Fast pagination controls with previous/next and active page numbers.
  - Instant inline preview via `PdfViewerModal`.
  - Direct download action opening the backend stream endpoint.

### 2. Admin Management Dashboard (`/admin/pdf-resources`)
- **File**: `frontend/src/pages/admin/PdfResources.jsx`
- **Features**:
  - Top metric summary cards: Total, Published, Draft, Archived documents.
  - Search and filter bar for title, category, subject, and status.
  - Responsive tabular list with badges, file sizes, and creation dates.
  - Inline status toggle dropdown (instantly update from Draft to Published or Archived).
  - Create / Edit modal with drag-and-drop file picker, upload progress indicator, and validation.
  - Safe confirmation modal before resource deletion.

### 3. Reusable PDF Viewer Modal (`PdfViewerModal.jsx`)
- **File**: `frontend/src/components/PdfViewerModal.jsx`
- **Features**:
  - Sandboxed `<iframe>` pointing to the secure streaming endpoint.
  - Header with document title, subject, category badge, and file size.
  - Controls for fullscreen toggle, open in new tab, direct download, and ESC/backdrop close.
  - Loading skeleton state with spinner while the stream initializes.

---

## 6. Environment Variables

Ensure the following variables are defined in `backend/.env`:

```env
# Cloudflare R2 Object Storage
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key-id"
R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
R2_BUCKET_NAME="sum-academy-bucket"
R2_PUBLIC_URL="https://pub-your-id.r2.dev" # Optional fallback

# Firebase Admin SDK (Existing configuration)
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_CLIENT_EMAIL="your-service-account-email"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

---

## 7. Verification & Build Status

- **Lint Status**: `src/components/PdfViewerModal.jsx`, `src/pages/public/Resources.jsx`, and `src/pages/admin/PdfResources.jsx` pass ESLint with zero errors (`exit code 0`).
- **Backend Syntax**: `backend/src/index.js` validated with `node --check` (`exit code 0`).
- **Frontend Production Build**: Built successfully using Vite 7 (`✓ built in 45.61s`).
- **Deployment Artifacts**: `frontend/dist` compiled and synchronized to `backend/frontend-dist`.
