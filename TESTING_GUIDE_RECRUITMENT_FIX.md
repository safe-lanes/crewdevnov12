# Testing Guide: Recruitment Application Duplicate Fix

## 🧪 How to Test the Fix

### Preparation
1. Open the application in your browser
2. Navigate to **Recruitment** module
3. Open **Browser DevTools** (F12 or Right-click → Inspect)
4. Go to the **Network** tab in DevTools
5. Filter by "recruitment-candidates" to see only relevant requests

---

## Test Case 1: New Application (Primary Test)

### Steps:
1. Click "**Create New Applicant**" button
2. Fill in Part A1 - Seafarers' Particulars:
   - First Name: "TestUser"
   - Middle Name: "Save"
   - Family Name: "Multiple"
   - Any other required fields

3. Click "**Save Draft**" button (top-right blue button)
   
   **🔍 Expected in Network Tab:**
   ```
   POST /api/recruitment-candidates → Status: 201 Created
   ```
   
   **🔍 Expected in Console (F12 → Console tab):**
   ```
   ✨ POST - Creating new candidate
   💾 Storing candidate ID for future updates: 2025-11-18-[timestamp]
   ```

4. Navigate to "**Part A2 - Travel & ID Documents**" (click A2 in sidebar)

5. Click "**Save & Continue**" button

   **🔍 Expected in Network Tab:**
   ```
   PATCH /api/recruitment-candidates/2025-11-18-[timestamp] → Status: 200 OK
   ```
   
   **🔍 Expected in Console:**
   ```
   🔄 PATCH - Updating existing candidate: 2025-11-18-[timestamp]
   ```
   
   ❌ **MUST NOT SEE:** Another POST request!

6. Navigate to "**Part A3 - Training & Certificates**"

7. Click "**Save & Continue**" button

   **🔍 Expected:**
   ```
   Network: PATCH /api/recruitment-candidates/2025-11-18-[timestamp] → 200 OK
   Console: 🔄 PATCH - Updating existing candidate: 2025-11-18-[timestamp]
   ```

8. Continue through 2-3 more steps, saving each time

   **🔍 Expected:**
   - All subsequent saves should be **PATCH** requests
   - All use the **same ID**
   - Console shows "🔄 PATCH" messages

### Database Verification:

Open a new terminal and run:
```sql
SELECT id, file_no, first_name, family_name, status, created_at, updated_at 
FROM recruitment_candidates 
WHERE first_name = 'TestUser' AND family_name = 'Multiple'
ORDER BY created_at DESC;
```

**Expected Result:**
```
✅ Only 1 row should be returned
✅ created_at and updated_at should be different (updated_at is more recent)
✅ No duplicate records
```

---

## Test Case 2: Edit Existing Draft

### Steps:
1. From the Recruitment list, find an existing **Draft** candidate
2. Click the "**Edit**" button (pencil icon)
3. Modify any field (e.g., change mobile number)
4. Click "**Save Draft**" button

   **🔍 Expected in Network Tab:**
   ```
   PATCH /api/recruitment-candidates/[existing-id] → Status: 200 OK
   ```
   
   **🔍 Expected in Console:**
   ```
   🔄 PATCH - Updating existing candidate: [existing-id]
   ```

5. Modify another field
6. Click "**Save Draft**" again

   **🔍 Expected:**
   - Another PATCH request (not POST)
   - Same ID as before
   - No new record created

### Database Verification:
```sql
SELECT COUNT(*) as total_count,
       COUNT(DISTINCT id) as unique_records
FROM recruitment_candidates 
WHERE id = '[the-existing-id-you-edited]';
```

**Expected Result:**
```
total_count: 1
unique_records: 1
✅ No duplicates
```

---

## Test Case 3: Multiple New Applications

### Steps:
1. Create a new applicant (Test Case 1 flow)
   - Save multiple times through different steps
   - Note the ID created (e.g., 2025-11-18-AAA)

2. Click "**Back to List**" or close the form

3. Click "**Create New Applicant**" again

4. Fill in new data (different name)

5. Click "**Save Draft**"

   **🔍 Expected:**
   ```
   Network: POST /api/recruitment-candidates → 201 Created
   Console: ✨ POST - Creating new candidate
   Console: 💾 Storing candidate ID for future updates: 2025-11-18-BBB
   ```
   
   ❌ **MUST NOT:** Reuse the previous ID (2025-11-18-AAA)

6. Save again (on same form)

   **🔍 Expected:**
   ```
   Network: PATCH /api/recruitment-candidates/2025-11-18-BBB → 200 OK
   Console: 🔄 PATCH - Updating existing candidate: 2025-11-18-BBB
   ```

### Database Verification:
```sql
SELECT id, first_name, family_name, created_at
FROM recruitment_candidates 
ORDER BY created_at DESC 
LIMIT 5;
```

**Expected Result:**
```
✅ 2 separate records with different IDs
✅ Each has only 1 entry (no duplicates)
```

---

## 🎯 Success Criteria Summary

| Criterion | Status |
|-----------|--------|
| First save on new application uses POST | ✅ |
| Subsequent saves use PATCH (not POST) | ✅ |
| All PATCH requests use the same ID | ✅ |
| Console logs show POST → PATCH pattern | ✅ |
| Database has only 1 record per application | ✅ |
| Editing existing drafts uses PATCH only | ✅ |
| Creating new application after closing resets ID | ✅ |

---

## 🚨 Common Issues (If These Occur, Fix Failed)

| Issue | Meaning |
|-------|---------|
| Multiple POST requests for same application | ❌ ID not being stored |
| New POST request when navigating between steps | ❌ State resetting incorrectly |
| Duplicate records in database | ❌ PATCH not working |
| Using old ID after clicking "Create New" | ❌ State not clearing |

---

## 📊 Network Tab Reference

### CORRECT Pattern:
```
POST   /api/recruitment-candidates         → 201 Created (ID returned)
PATCH  /api/recruitment-candidates/[ID]    → 200 OK
PATCH  /api/recruitment-candidates/[ID]    → 200 OK
PATCH  /api/recruitment-candidates/[ID]    → 200 OK
...
```

### INCORRECT Pattern (Bug):
```
POST   /api/recruitment-candidates         → 201 Created (ID: AAA)
POST   /api/recruitment-candidates         → 201 Created (ID: BBB) ❌
POST   /api/recruitment-candidates         → 201 Created (ID: CCC) ❌
POST   /api/recruitment-candidates         → 201 Created (ID: DDD) ❌
...
Result: 4 duplicate records in database ❌
```

---

## 📝 Quick Test Commands

### Check for Duplicates (should return 0):
```sql
SELECT 
  first_name, 
  family_name, 
  COUNT(*) as duplicate_count 
FROM recruitment_candidates 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY first_name, family_name 
HAVING COUNT(*) > 1;
```

### View Recent Activity:
```sql
SELECT 
  id, 
  file_no, 
  first_name || ' ' || family_name as full_name,
  status,
  created_at,
  updated_at,
  (updated_at > created_at) as was_updated
FROM recruitment_candidates 
ORDER BY created_at DESC 
LIMIT 10;
```

---

**Test Date:** November 18, 2025
**Fix:** Recruitment Application Save as Draft Duplicate Prevention
**Status:** ✅ Ready for User Testing
