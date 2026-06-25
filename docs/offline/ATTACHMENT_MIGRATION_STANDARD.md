# Attachment Migration & Storage Standard — CrewingV2

This document establishes the definitive engineering standard for storing, retrieving, and validating attachments in the Crewing application. All existing modules must migrate to this standard, and all future modules must follow it from inception.

---

## 1. Canonical Attachment Schema

Every attachment table in the database must adhere to the following schema standard:

### Mandatory Standardized Columns
*   `file_name` (type `text`): The sanitized name of the file (including extension) as it should be displayed and downloaded.
*   `file_path` (type `text`): The relative path of the file on disk under the `.private/` storage root (e.g. `rsms/recruitment/1719300000000_a8f9d3b2_resume.pdf`). This serves as the key for accessing the physical file.

### Module-Specific / Requirement-Dependent Columns
The following columns are not subject to a strict naming or presence mandate and are decided per-module based on requirements:
*   `file_size`: Size of the file (typically `text` or `integer`).
*   `file_type` / `mime_type`: The MIME type of the file.
*   Uploader references (e.g., `uploaded_by_uuid` or `uploaded_by` text or foreign key).
*   Date fields (e.g., `upload_date` or relying on audit columns).
*   `sort_order` / `is_deleted` / `is_sync` and other standard audit columns.

### Existing vs. New Tables Storage Constraint
*   **Existing Tables**: Existing tables must retain a nullable `file_data` (type `text`) column temporarily during the dual-read transition phase to support fallback/rollback safety.
*   **New Tables**: Any newly created attachment tables (such as the new `promo_checklist_attachments_v2` table) must be created **WITHOUT a `file_data` column**.

---

## 2. Storage Layout, Naming, & Sanitization

### Storage Root & Directory Convention
All attachment binaries must be saved to the filesystem under a private root directory at the project root:
```
.private/{domainname}/{modulegroup}/{entityname}/
```
*   `domainname`: Product/tenant domain (e.g. `rsms`, `sail`, `demo`) resolved dynamically from request context.
*   `modulegroup`: The owning module the attachment belongs to (e.g. `crew-pool`, `recruitment`, `drugs-alcohol`, `vessel`, `promotions`). Attachments are grouped by module so all of a module's entities live under one folder.
*   `entityname`: The specific entity within the module (e.g. `crew-sea-service`, `recruitment-licenses`, `screening-b1`, `test-records`, `vessel-planning`, `briefing`).

The module identifier passed to `writeAttachment` is a nested `"{modulegroup}/{entityname}"` string; it is split on `/`, each segment is sanitized independently, and empty/traversal segments are dropped so a value can never escape its module folder. Legacy attachments persisted under the older flat `.private/{domainname}/{modulename}/` layout continue to resolve unchanged, because reads always derive from the stored relative `file_path`.

### Directory Auto-Creation
The directory structure must be created recursively at runtime before writing a file if it does not already exist.

### Collision-Safe Naming Convention
To prevent filename collisions across concurrent uploads or identical file names from different users, filenames must be prefixed using the following format:
```
{timestamp}_{random8}_{sanitized_filename}
```
*   `timestamp`: Epoch timestamp in milliseconds (`Date.now()`).
*   `random8`: An 8-character random alphanumeric suffix generated via secure cryptographics (`crypto.randomBytes(4).toString('hex')` or similar base36 generation).
*   `sanitized_filename`: The sanitized original file name.

### Filename Sanitization Rules
The server must sanitize all user-supplied filenames before writing to disk using a standard helper:
1.  **Path Traversal Prevention**: Remove all path separators (`/`, `\`) and directory traversal sequences (`..`).
2.  **Special Characters**: Replace spaces and non-alphanumeric characters (excluding the dot `.`) with underscores `_`.
3.  **Encoding**: Strip non-ASCII characters to prevent filesystem encoding issues.
4.  **Windows Reserved Names**: Re-name or prefix files matching Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`).
5.  **Length Constraints**: Truncate the sanitized portion of the name so that the entire filename (including prefix and extension) does not exceed 255 characters (limit to 200 characters to be safe).

---

## 3. Security & Serving Mechanism

### Direct Access Block (Nginx)
The `.private/` directory must be stored in the project root folder. The Nginx configuration (e.g. [nginx.conf.example](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/deploy/nginx.conf.example)) is configured to serve only assets inside the public build directories (e.g. `dist/public`). Direct HTTP access to files in `.private/` is strictly prohibited.

### Authenticated Serving
All attachments must be served via authenticated Express routes. The route handler must check:
1.  The user's authentication status (session/token validation).
2.  Tenant membership (the active database context matching `x-tenant-id`).
3.  Fine-grained permissions where applicable.

### Path Traversal Guard
When resolving the file path on the server:
*   Always resolve the absolute path using `path.resolve` and verify that the resolved path is located strictly inside the `.private/` root directory.
*   Throw a 400/403 error if a traversal attempt is detected.

---

## 4. Size & Type Validation

To prevent server storage exhaustion and malicious file execution, all uploads must pass the following server-side checks before write:
1.  **Size Limits**: Enforce a strict file size ceiling (default: **5 MB**).
2.  **MIME-Type Restrictions**: Validate the file signature (MIME type) against an allow-list of safe, renderable types:
    *   `application/pdf`
    *   `image/jpeg`
    *   `image/png`
3.  **Double Guards**: Do not rely on client-side React constraints alone. Server routes must inspect the upload size and headers.

---

## 5. Dual-Read / Fallback Mechanism

During the migration transition period, attachment serving routes must support dual-read:
1.  **Check file_path**: If `file_path` is populated in the database record:
    *   Read the file from disk using Node `fs.createReadStream` and pipe it directly to the HTTP response.
2.  **Fallback to file_data**: If `file_path` is null or empty, check if `file_data` is populated:
    *   Decode the base64-encoded string using the server-side decoder and stream the buffer.
3.  **Not Found**: If both are empty, return a `404 Not Found` response.

---

## 6. Shared Backend Infrastructure Contract

A centralized service `server/v2/shared/fileStorageService.ts` must implement and export the following interfaces. All service layers and controllers must delegate file operations to this service.

### Function Signatures

```typescript
export interface FileStorageService {
  /**
   * Sanitizes a user-provided file name to prevent path traversal, special character, 
   * and length issues.
   * @param name Original filename from client
   */
  sanitizeFileName(name: string): string;

  /**
   * Writes file data to disk under the structured directory path.
   * Auto-creates the required subdirectories recursively.
   * Validates size (<= 5 MB) and MIME signature (PDF/PNG/JPEG allow-list)
   * before writing, throwing AttachmentValidationError on violation.
   *
   * @param module The module identifier (e.g., 'recruitment', 'medical')
   * @param fileName The original user-provided filename
   * @param buffer The raw file bytes as a Buffer
   * @param domainOverride Optional explicit tenant domain. When omitted the
   *        active tenant is resolved internally from request context
   *        (AsyncLocalStorage), falling back to 'main'. Pass this only for
   *        out-of-request flows such as the backfill script.
   * @returns The relative file path to be persisted in the DB (e.g., 'domain/module/prefix_file.pdf')
   */
  writeAttachment(
    module: string,
    fileName: string,
    buffer: Buffer,
    domainOverride?: string
  ): Promise<string>;

  /**
   * Reads an attachment from disk.
   * Enforces path traversal checks.
   * 
   * @param filePath The relative file path stored in the database
   * @returns Object containing the file stream and content type
   */
  readAttachment(
    filePath: string
  ): Promise<{ stream: NodeJS.ReadableStream; mimeType: string }>;
}
```

### Shared Controller serving helper

All raw attachment routes must call a centralized Express helper `serveAttachmentFromFilePath`:

```typescript
import { Response } from "express";

/**
 * Shared helper to serve files to Express response.
 * Implements security headers and handles the dual-read fallback.
 * 
 * @param req Express Request
 * @param res Express Response
 * @param attachment The database attachment record
 */
export async function serveAttachmentFromFilePath(
  res: Response,
  attachment: {
    filePath: string | null;
    fileData: string | null;
    fileName: string | null;
    fileType: string | null;
  }
): Promise<void>;
```

#### Standard Security Headers enforced by this helper:
*   `X-Content-Type-Options: nosniff` (prevents MIME type sniffing)
*   `Content-Type`: Set to the specific file type (e.g. `application/pdf`).
*   `Content-Disposition`: Set to `inline; filename="{fileName}"` for allow-listed types, or `attachment; filename="{fileName}"` for others to force downloads.
*   `Cache-Control`: Set to `private, no-cache, no-store, must-revalidate` to avoid browser/proxy caching of sensitive documents.

---

## 7. Shared Frontend Contract

### FileAttachmentDialog.tsx Read Resolution
The React dialog component ([FileAttachmentDialog.tsx](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/client/src/components/FileAttachmentDialog.tsx)) must fetch and resolve attachment content according to a strict order of preference:
1.  **`viewUrl`**: If the attachment record contains a valid serving endpoint (e.g., `/api/v2/crew-pool/documents/attachments/:uuid/raw`), the frontend must request the file via this URL.
2.  **`fileData`**: Fall back to decoding and rendering inline from the base64 `file_data` property ONLY if `viewUrl` is not present (supporting legacy database records).

### Modules Missing `/raw` Streaming Routes
The following modules currently lack a `/raw` streaming route and return raw `fileData` base64 inside JSON payloads. They must be updated to implement raw streaming endpoints to support the frontend contract:
1.  **Crew Pool Documents** (route: `/api/v2/crew-pool/documents/attachments/:uuid/raw`)
2.  **Crew Pool Visas** (route: `/api/v2/crew-pool/visas/attachments/:uuid/raw`)
3.  **Crew Pool Education** (route: `/api/v2/crew-pool/education/attachments/:uuid/raw`)
4.  **Crew Pool Licenses** (route: `/api/v2/crew-pool/licenses/attachments/:uuid/raw`)
5.  **Crew Pool Training** (route: `/api/v2/crew-pool/training/attachments/:uuid/raw`)
6.  **Crew Pool Sea Service** (route: `/api/v2/crew-pool/sea-service/attachments/:uuid/raw`)
7.  **Crew Pool Medical** (route: `/api/v2/crew-pool/medical/attachments/:uuid/raw`)
8.  **Crew Pool Doctor Visits** (route: `/api/v2/crew-pool/doctor-visits/attachments/:uuid/raw`)
9.  **Recruitment Documents** (route: `/api/v2/recruitment/documents/attachments/:uuid/raw`)
10. **Recruitment Visas** (route: `/api/v2/recruitment/visas/attachments/:uuid/raw`)
11. **Recruitment Education** (route: `/api/v2/recruitment/education/attachments/:uuid/raw`)
12. **Recruitment Licenses** (route: `/api/v2/recruitment/licenses/attachments/:uuid/raw`)
13. **Recruitment Training** (route: `/api/v2/recruitment/training/attachments/:uuid/raw`)
14. **Recruitment Sea Service** (route: `/api/v2/recruitment/sea-service/attachments/:uuid/raw`)
15. **Recruitment Additional Info** (route: `/api/v2/recruitment/additional-info/attachments/:uuid/raw`)
16. **Screening B1–B8 Stages** (various stages require raw endpoints, e.g., `/api/v2/recruitment/screening/b1/attachments/:uuid/raw`)
17. **Drugs & Alcohol** (route: `/api/v2/drugs-alcohol/attachments/:uuid/raw`)
18. **Vessel Planning** (route: `/api/v2/vessel/planning/attachments/:uuid/raw`)

---

## 8. Standalone Guide: New Module Attachment Checklist

For developer guidelines and instructions when implementing attachment support in any future module, refer to the standalone [New Module Attachment Checklist](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/docs/offline/NEW_MODULE_ATTACHMENT_CHECKLIST.md).
