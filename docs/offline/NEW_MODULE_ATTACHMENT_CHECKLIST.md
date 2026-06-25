# Developer Guide: New Module Attachment Checklist

This checklist is the official standard for adding attachment capabilities to any new module in the Crewing application. Every developer (and AI coding agent) must implement this exact structure by default to prevent storage fragmentation and database bloat.

---

## ⛔ Rule #1: Never Store File Bytes in Database Columns
> [!CAUTION]
> **No base64 data URLs, hex arrays, or raw byte blobs may ever be saved inside a database table.**
> All files must live in the filesystem under `.private/` storage. Database tables must only record file metadata and the relative path `file_path`.
> 
> **Rationale**: DB-inline file storage causes backup (`pg_dump`) inflation, high query memory consumption, slow list views, and breaks shipboard/shore database synchronization over satellite links.

---

## Step 1: Database Schema Definition

Create a dedicated attachment table alongside your core tables in `shared/v2/{modulename}/schema.ts`.

### Required Column Set
Every new attachment table must implement the following columns exactly (do not add a `file_data` column):

```typescript
import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { auditColumns } from "../shared/audit"; // Use existing audit columns import

export const myNewModuleAttachments = pgTable("my_new_module_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(), // Unique public identifier
  parentUuid: text("parent_uuid").notNull(),     // Foreign key to parent record
  
  // MANDATORY standardized fields for the file
  fileName: text("file_name").notNull(),         // Persisted as "file_name" in SQL
  filePath: text("file_path").notNull(),         // Persisted as "file_path" in SQL
  
  // Optional but recommended metadata fields
  fileSize: text("file_size"),
  fileType: text("file_type"),
  sortOrder: integer("sort_order").default(0),
  
  ...auditColumns, // Includes createdAt, updatedAt, isDeleted, isSync
});
```

---

## Step 2: Backend Infrastructure Integration

### 1. Storage Naming Convention
Ensure your folder path matches the pattern:
```
.private/{domainname}/{modulename}/
```
*   `domainname` must be obtained dynamically via request context/tenant middleware.
*   `modulename` must be lowercase and hyphen-separated.

### 2. Service Layer Operations
In your service class (e.g., `server/v2/my-module/services/myModuleService.ts`):
*   Import `fileStorageService` from `server/v2/shared/fileStorageService`.
*   **Write Flow**: When uploading, call `fileStorageService.writeAttachment` with the file buffer to write it to disk and obtain a relative path. Store only the relative path and metadata in the database:
    ```typescript
    const filePath = await fileStorageService.writeAttachment(tenantDomain, "my-module", fileName, buffer);
    await attachmentsRepository.create({
      parentUuid,
      fileName,
      filePath,
      fileSize,
      fileType,
      uploadedByUuid
    });
    ```
*   **Delete Flow**: Soft-delete database records by setting `isDeleted` to `true` (do not delete physical files immediately to allow sync replication to complete safely).

---

## Step 3: Routes & Controllers

### 1. Raw serving route
Your module's router (`server/v2/my-module/routes.ts`) must expose a binary serving route:
```
GET /api/v2/my-module/attachments/:attUuid/raw
```

### 2. Controller handling
Use the shared backend helper `serveAttachmentFromFilePath` in your controller:
```typescript
import { Request, Response } from "express";
import { serveAttachmentFromFilePath } from "../../shared/serveAttachmentHelper";

export const myNewModuleController = {
  async serveRaw(req: Request, res: Response) {
    const { attUuid } = req.params;
    const attachment = await myNewModuleService.getAttachment(attUuid);
    
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    
    // Delegate file reading, headers setting, and response streaming to the helper
    await serveAttachmentFromFilePath(res, {
      filePath: attachment.filePath,
      fileData: null, // New tables have no fileData
      fileName: attachment.fileName,
      fileType: attachment.fileType,
    });
  }
}
```

---

## Step 4: Frontend Wiring

### 1. Dialog Configuration
Use the shared `<FileAttachmentDialog>` component inside your React pages:
*   Pass the list of attachments mapped to the `FileAttachment` shape.
*   Construct the `viewUrl` pointing to your `/raw` endpoint.

```typescript
const toFileAttachment = (att: MyNewModuleAttachment): FileAttachment => ({
  id: att.attUuid,
  name: att.fileName,
  size: att.fileSize,
  type: att.fileType,
  viewUrl: `/api/v2/my-module/attachments/${att.attUuid}/raw`,
  uploadedAt: att.createdAt,
});
```

### 2. Dialog Callbacks
*   **Add File**: Send the file binary to the controller (via `multipart/form-data` or base64 wrapper).
*   **Delete File**: Request the delete route via API request.
*   **Display Thumbnails**: Direct link to the `viewUrl` for rendering or downloading.
