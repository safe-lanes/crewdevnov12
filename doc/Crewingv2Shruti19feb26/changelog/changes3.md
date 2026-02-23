# Change Log – A3.2 & A3.3 Duplicate ID Assignment Fix

## 1. Frontend Code Changes
- **File Modified:** `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`
- **Root Cause:** When licenses and training courses are loaded from the database, each item's internal `id` is a UUID (from `licUuid` / `trainUuid`), not the display format `LIC-001` / `TRN-001`. The ID generation functions (`getNextId`, `addLicensesFromDatabase`, `addTrainingCoursesFromDatabase`) only matched against `item.id` using the prefix regex pattern (`LIC-(\d+)` / `TRN-(\d+)`). Since UUIDs never match this pattern, `maxNum` always resolved to 0, causing new items to start numbering from `001` again — producing duplicate display IDs.
- **Fix applied to `getNextId()`:** Added an optional `altField` parameter. When provided, the function also checks the value of that field (e.g., `licenseId`, `courseId`) for the prefix pattern, ensuring UUID-based items with populated display IDs are properly counted.
- **Fix applied to `addLicense()`:** Now calls `getNextId(formData.licenses, 'LIC', 'licenseId')` to pass the alternative field.
- **Fix applied to `addTrainingCourse()`:** Now calls `getNextId(formData.trainingCourses, 'TRN', 'courseId')` to pass the alternative field.
- **Fix applied to `addLicensesFromDatabase()`:** Changed from `.map()` to `.flatMap()`, checking both `l.id` and `l.licenseId` for the `LIC-(\d+)` pattern when computing `maxNum`.
- **Fix applied to `addTrainingCoursesFromDatabase()`:** Same `.flatMap()` approach, checking both `c.id` and `c.courseId` for the `TRN-(\d+)` pattern.
- **No impact on other sections:** Documents (DOC), Visas (VIS), Education (EDU), Sea Service (SEA), and Additional Info (A5) continue to call `getNextId` without `altField` — behavior unchanged since their `id` values already use the prefix format.

## 2. Backend Code Changes
- No backend changes required. ID generation and display is handled entirely on the frontend.

## 3. Database Level Changes
- No database schema, migration, or index changes. The fix is purely a frontend display-ID computation correction.

## Additional Notes
- The issue became visible after sorting was introduced in A3.2/A3.3 (changes2.md), which reordered rows and made duplicate IDs more apparent. However, the underlying bug existed prior — any items loaded from the database with UUID-based internal IDs would cause ID numbering to reset on the next add operation.
- The fix ensures consistent, unique, auto-incrementing display IDs regardless of whether items were loaded from the database (UUID-based) or added manually/from database dialogs (prefix-based).
