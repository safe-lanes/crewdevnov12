# Recruitment Application "Save as Draft" Duplicate Fix

## 🐛 Issue Summary

**Problem:** When creating a new recruitment application, clicking "Save Draft" or "Save & Continue" multiple times created duplicate records in the database instead of updating the existing one.

**Root Cause:** The component was not tracking the candidate ID after the first save. Every save button click triggered a POST request instead of checking if an ID already exists and using PATCH.

---

## ✅ Solution Implemented

### Changes Made to `client/src/modules/recruitment/RecruitmentApplicationForm.tsx`

#### 1. Added Candidate ID State Tracking (Line 215-217)
```typescript
// Track the candidate ID for this session (fixes duplicate creation bug)
// Initialize from prop (for editing existing) or null (for new candidate)
const [currentCandidateId, setCurrentCandidateId] = useState<string | null>(candidate?.id || null);
```

#### 2. Updated `saveOnlyMutation` (Lines 225-262)
**Before:** Always used `candidate?.id` (null for new candidates)
**After:** Uses `currentCandidateId` and stores ID after POST

```typescript
mutationFn: (candidateData: InsertRecruitmentCandidate) => {
  if (currentCandidateId) {  // ✅ Use tracked ID
    // PATCH - Update existing
    console.log('🔄 PATCH - Updating existing candidate:', currentCandidateId);
    return fetch(`/api/recruitment-candidates/${currentCandidateId}`, {
      method: 'PATCH',
      // ...
    });
  } else {
    // POST - Create new
    console.log('✨ POST - Creating new candidate');
    return fetch('/api/recruitment-candidates', {
      method: 'POST',
      // ...
    });
  }
},
onSuccess: async (savedCandidate) => {
  // ✅ Store the ID after first creation (fixes duplicate bug)
  if (!currentCandidateId && savedCandidate.id) {
    console.log('💾 Storing candidate ID for future updates:', savedCandidate.id);
    setCurrentCandidateId(savedCandidate.id);
  }
  // ...
}
```

#### 3. Updated `saveMutation` (Lines 315-351)
Same pattern - uses `currentCandidateId` and stores ID after successful POST.

#### 4. Updated `handleA5SubmitForScreening` (Lines 555-617)
Same pattern - uses `currentCandidateId` and stores ID after successful POST.

#### 5. Updated All ID Generation Points
Changed all instances from `candidate?.id || generateNewId()` to `currentCandidateId || generateNewId()`:
- Line 431: `handleC3Submit`
- Line 470: `handleSaveOnly`
- Line 503: `handleSaveAndContinue`
- Line 538: `handleA5SubmitForScreening`

---

## 🔍 How It Works Now

### New Application Flow (CORRECT)
```
User Action                          Backend Request        Database Result
─────────────────────────────────────────────────────────────────────────────
1. Open form (new applicant)         -                      -
   currentCandidateId: null

2. Fill Part A1 → Save Draft         POST /api/...          Record created
   Response: { id: "2025-11-18-123" }                       ID: 2025-11-18-123
   ✅ setCurrentCandidateId("2025-11-18-123")

3. Move to Part A2 → Save & Continue PATCH /api/.../123    Record updated
   Uses currentCandidateId                                  Same record

4. Move to Part A3 → Save & Continue PATCH /api/.../123    Record updated
   Uses currentCandidateId                                  Same record

5. Continue through all steps...     PATCH /api/.../123    Same record
   All use currentCandidateId                              Only 1 record!
```

### Editing Existing Application (CORRECT)
```
User Action                          Backend Request        Database Result
─────────────────────────────────────────────────────────────────────────────
1. Click "Edit" on existing draft    -                      -
   candidate prop: { id: "2025-11-18-456" }
   currentCandidateId: "2025-11-18-456" (from prop)

2. Modify fields → Save              PATCH /api/.../456    Record updated
   Uses currentCandidateId                                  Same record
```

---

## 🧪 Testing Checklist

### Test 1: New Application Draft Workflow ✅
- [ ] Click "Create New Applicant"
- [ ] Fill Part A1 fields
- [ ] Click "Save Draft"
  - Verify: POST request in Network tab
  - Verify: Console shows "✨ POST - Creating new candidate"
  - Verify: Console shows "💾 Storing candidate ID for future updates: [ID]"
- [ ] Move to Part A2, fill fields, click "Save & Continue"
  - Verify: PATCH request in Network tab (not POST!)
  - Verify: Console shows "🔄 PATCH - Updating existing candidate: [ID]"
- [ ] Continue through remaining steps
  - Verify: All show PATCH requests
- [ ] Check database: Only 1 record with the ID

**Expected Network Requests:**
```
Request 1 (Step 1): POST   /api/recruitment-candidates → 201 Created
Request 2 (Step 2): PATCH  /api/recruitment-candidates/[ID] → 200 OK
Request 3 (Step 3): PATCH  /api/recruitment-candidates/[ID] → 200 OK
Request 4 (Step 4): PATCH  /api/recruitment-candidates/[ID] → 200 OK
...
```

### Test 2: Edit Existing Draft ✅
- [ ] From recruitment list, click "Edit" on existing draft
- [ ] Modify some fields
- [ ] Click "Save Draft"
  - Verify: PATCH request (not POST)
  - Verify: Existing record updated, no new record created

### Test 3: Database Verification ✅
```sql
-- Check for duplicates (should return 0 after fix)
SELECT 
  first_name, 
  family_name, 
  COUNT(*) as count 
FROM recruitment_candidates 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY first_name, family_name 
HAVING COUNT(*) > 1;

-- View recent candidates
SELECT id, file_no, first_name, family_name, status, created_at, updated_at 
FROM recruitment_candidates 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 📊 Console Logs to Expect

### When Creating New Application:
```javascript
✨ POST - Creating new candidate
💾 Storing candidate ID for future updates: 2025-11-18-1763447001234
🔄 PATCH - Updating existing candidate: 2025-11-18-1763447001234
🔄 PATCH - Updating existing candidate: 2025-11-18-1763447001234
...
```

### When Editing Existing:
```javascript
🔄 PATCH - Updating existing candidate: 2025-11-14-existing-id
🔄 PATCH - Updating existing candidate: 2025-11-14-existing-id
...
```

---

## ✅ Success Criteria

✅ Creating a new applicant and saving through all steps creates **exactly 1 record**
✅ Network tab shows: **1 POST** + **multiple PATCH** requests  
✅ Database contains **no duplicate records** for the same applicant
✅ Form retains data when navigating between steps
✅ Editing existing drafts works correctly (PATCH only, no new records)
✅ Console logs show clear POST vs PATCH operations

---

## 🔧 Technical Details

**Files Modified:**
- `client/src/modules/recruitment/RecruitmentApplicationForm.tsx` (6594 lines)

**Lines Changed:**
- Line 215-217: Added `currentCandidateId` state
- Lines 225-262: Updated `saveOnlyMutation`
- Lines 315-351: Updated `saveMutation`
- Lines 555-617: Updated `handleA5SubmitForScreening`
- Lines 431, 470, 503, 538: Updated ID generation

**Backend Endpoint Used:**
- `PATCH /api/recruitment-candidates/:id` (existed, no changes needed)

**Pattern Used:**
- State persistence pattern
- POST for creation, PATCH for updates
- ID tracking across component lifecycle

---

## 📝 Notes

- The `candidate` prop is only used for initial load (editing existing records)
- The `currentCandidateId` state persists throughout the form session
- When the form unmounts/closes, the state resets automatically
- Next "Create New Applicant" will start fresh with null ID
- All console.log statements can be removed in production if desired

---

**Fix Date:** November 18, 2025
**Issue:** Recruitment Application Save as Draft Creating Duplicates
**Status:** ✅ FIXED - Ready for Testing
