# Improvement Recommendations

## Overview

This document identifies areas for improvement in the Seafarer Performance Management System, including technical debt, security concerns, and enhancement opportunities.

---

## Critical Improvements

### 1. Authentication & Authorization

**Current State:** No authentication system implemented. All API endpoints are publicly accessible.

**Risk Level:** HIGH

**Recommendations:**
1. Implement Replit Auth for quick setup:
   ```typescript
   // Use search_integrations to find Replit Auth
   import { replitAuth } from '@replit/auth';
   ```

2. Add role-based access control (RBAC):
   - Admin: Full access to all modules
   - Office: View/edit most data, manage reviews
   - Vessel: Limited to vessel-specific data
   - Read-only: View only

3. Protect sensitive endpoints:
   ```typescript
   app.use('/api/crew-members', authMiddleware);
   app.use('/api/appraisals', authMiddleware);
   ```

### 2. Automated Testing

**Current State:** No automated tests exist.

**Risk Level:** HIGH

**Recommendations:**
1. Add unit tests for violation calculations (critical compliance logic)
2. Add integration tests for REST APIs
3. Add E2E tests for critical workflows (appraisal, rest hours)
4. Target 80% coverage for business logic

See [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) for detailed plan.

### 3. Rate Limiting

**Current State:** No rate limiting on API endpoints.

**Risk Level:** MEDIUM

**Recommendations:**
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
});

app.use('/api/', limiter);
```

---

## Performance Improvements

### 1. API Response Pagination

**Current State:** All endpoints return full datasets.

**Impact:** Slow responses for large datasets.

**Recommendations:**
```typescript
// Add pagination parameters
app.get('/api/crew-members', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  
  const [data, total] = await Promise.all([
    storage.getCrewMembers({ limit, offset }),
    storage.getCrewMembersCount(),
  ]);
  
  res.json({ data, page, limit, total, totalPages: Math.ceil(total / limit) });
});
```

### 2. Database Query Optimization

**Current State:** Some queries fetch more data than needed.

**Recommendations:**
1. Add indexes for frequently queried columns:
   ```sql
   CREATE INDEX idx_crew_members_vessel ON crew_members(present_vessel);
   CREATE INDEX idx_rest_hours_month ON rest_hours_daily_records(month_year);
   ```

2. Use field selection in queries:
   ```typescript
   // Instead of SELECT *
   db.select({ id: crew.id, name: crew.firstName }).from(crew);
   ```

### 3. Frontend Bundle Size

**Current State:** Large bundle due to AG Grid and all modules.

**Recommendations:**
1. ✅ Already implemented: Route-level code splitting
2. Consider lazy loading AG Grid only when needed
3. Analyze bundle with `npx vite-bundle-visualizer`

---

## Code Quality Improvements

### 1. File Size Reduction

**Current State:** Several files exceed 1000 lines.

**Files to refactor:**
| File | Lines | Recommendation |
|------|-------|----------------|
| routes.ts | 9,914 | Split into route modules |
| storage.ts | 8,298 | Split into domain-specific storage |
| AdminModule.tsx | ~3,000 | Extract sub-components |
| VesselModule.tsx | ~2,000 | Extract sub-components |

**Proposed structure:**
```
server/
├── routes/
│   ├── crew.routes.ts
│   ├── rest-hours.routes.ts
│   ├── appraisal.routes.ts
│   └── index.ts (combines all)
├── storage/
│   ├── crew.storage.ts
│   ├── rest-hours.storage.ts
│   └── index.ts
```

### 2. Type Safety

**Current State:** Some `any` types used.

**Recommendations:**
1. Enable strict TypeScript mode
2. Replace `any` with proper types
3. Use Zod inference for request types

### 3. Error Handling Standardization

**Current State:** Inconsistent error responses.

**Recommendations:**
Create error handling middleware:
```typescript
class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
  }
}

app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }
  res.status(500).json({ error: 'Internal server error' });
});
```

---

## Feature Enhancements

### 1. Audit Logging

**Current State:** No audit trail for data changes.

**Recommendations:**
```typescript
// Add audit table
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  action: text("action").notNull(), // CREATE, UPDATE, DELETE
  oldData: text("old_data"),
  newData: text("new_data"),
  userId: text("user_id"),
  timestamp: timestamp("timestamp").defaultNow(),
});
```

### 2. Email Notifications

**Current State:** No notification system.

**Recommendations:**
1. Integrate email service (Resend, SendGrid)
2. Send notifications for:
   - Appraisal stage transitions
   - Rotation proposals
   - NC report assignments
   - Rest hours review deadlines

### 3. Document Management

**Current State:** Documents stored as JSON in crew_members.

**Recommendations:**
1. Use file storage (Replit Object Storage or S3)
2. Store file references, not base64 data
3. Add document expiry tracking

### 4. Offline Support

**Current State:** Requires constant connectivity.

**Recommendations:**
1. Add service worker for offline access
2. Implement local storage sync for vessel users
3. Queue API calls when offline

---

## Security Recommendations

### 1. Input Sanitization

**Current State:** Zod validation exists but no XSS protection.

**Recommendations:**
```typescript
import DOMPurify from 'dompurify';

const sanitize = (input: string) => DOMPurify.sanitize(input);
```

### 2. SQL Injection Prevention

**Current State:** ✅ Protected via Drizzle ORM parameterized queries.

### 3. Secrets Management

**Current State:** Uses Replit Secrets.

**Recommendations:**
- Ensure no secrets in code
- Rotate API keys periodically
- Use separate secrets for dev/prod

### 4. HTTPS

**Current State:** ✅ Automatic on Replit.

---

## Technical Debt

### 1. Deprecated Dependencies

**Action:** Run `npm audit` and update vulnerable packages.

### 2. Dead Code

**Files to review:**
- `storage-mem.ts` - May not be needed in production
- Test files in root (test-*.ts)
- Backup files (.backup extensions)

### 3. Console Logs

**Current State:** Many console.log statements in production code.

**Recommendations:**
1. Use structured logging library (winston, pino)
2. Implement log levels (debug, info, warn, error)
3. Remove development console.logs

---

## Prioritized Roadmap

### Phase 1 (Immediate - 1-2 weeks)
1. ✅ Add unique constraints for data integrity
2. Add basic authentication
3. Add unit tests for violation logic

### Phase 2 (Short-term - 1 month)
1. Split routes.ts into modules
2. Add API pagination
3. Implement rate limiting
4. Add integration tests

### Phase 3 (Medium-term - 2-3 months)
1. Add audit logging
2. Implement email notifications
3. Add E2E tests
4. Performance optimization

### Phase 4 (Long-term - 3-6 months)
1. Document management overhaul
2. Offline support
3. Role-based access control
4. Analytics dashboard

---

## Questions to Answer

Based on codebase analysis:

### 1. Most Complex Features
- Rest Hours violation detection (cross-boundary calculations)
- Oil Major compliance engine (multiple rules, rank pairs)
- Appraisal 3-stage workflow

### 2. Critical Paths That Must Always Work
- Rest hours recording and violation detection
- Crew-vessel assignment
- Appraisal submission workflow

### 3. Highest Risk of Bugs
- Violation window calculations (edge cases)
- Cross-month boundary handling
- Date arithmetic in experience calculations

### 4. Most Frequently Used Features
- Crew member CRUD
- Rest hours recording
- Vessel planning

### 5. Areas Needing Refactoring
- routes.ts (9,914 lines)
- storage.ts (8,298 lines)
- Large React modules

### 6. Security Concerns
- No authentication
- No rate limiting
- No audit trail

### 7. Performance Bottlenecks
- Full dataset API responses
- Large bundle size
- Unoptimized queries

### 8. Problematic Dependencies
- AG Grid Enterprise (license required)
- Large bundle impact
