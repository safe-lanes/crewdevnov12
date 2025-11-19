# Fix: "storage.softDeleteRecruitmentCandidate is not a function"

## 🐛 Issue

When running locally after pulling the latest code, you get this error:
```
Error soft deleting recruitment candidate: TypeError: storage.softDeleteRecruitmentCandidate is not a function
```

## ✅ Solution

This happens because TypeScript needs to be recompiled. The method exists in the source code but your local environment is running old compiled JavaScript.

### **Quick Fix** (Run these commands):

```bash
# 1. Clean any cached/compiled files
rm -rf node_modules/.vite
rm -rf dist

# 2. Kill any running processes
# Press Ctrl+C to stop the server if running

# 3. Restart the development server
npm run dev
```

### **If that doesn't work** (Full Reset):

```bash
# 1. Stop the server (Ctrl+C)

# 2. Clean everything
rm -rf node_modules
rm -rf node_modules/.vite
rm -rf dist
rm package-lock.json

# 3. Reinstall dependencies
npm install

# 4. Start fresh
npm run dev
```

---

## 🔍 Why This Happens

The `softDeleteRecruitmentCandidate` method exists in:
- ✅ `server/storage.ts` (PersistentFileStorage) - Line 4501
- ✅ `server/database.ts` (DatabaseStorage) - Line 1213  
- ✅ `server/storage.ts` (IStorage interface) - Line 77

But when you run the app, it uses **compiled JavaScript** from the build process. If you pulled new code but didn't rebuild, the old compiled version runs without the new method.

---

## 🎯 Verify the Fix

After restarting, you should see:

```bash
🔄 Starting automatic database migrations...
✅ Database migrations completed successfully!
[timestamp] [express] serving on port 5000
```

Then test soft delete in Recruitment module - it should work!

---

## 🛡️ Prevention

**Always restart the dev server after pulling new code:**

```bash
# After git pull
npm run dev
```

This ensures TypeScript recompiles and you're running the latest code.

---

## 📋 Method Implementation

The method is implemented in **all storage classes**:

### PersistentFileStorage (for local dev without database):
```typescript
async softDeleteRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | undefined> {
  const existingCandidate = this.recruitmentCandidates.get(id);
  if (!existingCandidate) return undefined;

  const updatedCandidate: RecruitmentCandidate = { 
    ...existingCandidate, 
    isDelete: true,
    updatedAt: null as any
  };
  this.recruitmentCandidates.set(id, updatedCandidate);
  this.saveToFile();
  return updatedCandidate;
}
```

### DatabaseStorage (for PostgreSQL):
```typescript
async softDeleteRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | undefined> {
  const result = await this.db.update(recruitmentCandidates)
    .set({ isDelete: true, updatedAt: new Date() })
    .where(eq(recruitmentCandidates.id, id))
    .returning();
  
  return result[0] || undefined;
}
```

---

## ✅ Expected Behavior After Fix

When you click delete on a recruitment candidate:

**Console Output:**
```
Soft deleting recruitment candidate: 2025-11-18-1763442992243
Successfully soft deleted candidate: 2025-11-18-1763442992243
[timestamp] [express] PATCH /api/recruitment-candidates/2025-11-18-1763442992243/soft-delete 200
```

**UI:**
- Record disappears from table
- Toast notification: "Candidate deleted successfully"
- Record is preserved in database with `is_delete = true`

---

## 🚨 Still Not Working?

If the fix above doesn't work, check:

### 1. Verify Method Exists in Your Files

```bash
# Should return line numbers
grep -n "async softDeleteRecruitmentCandidate" server/storage.ts server/database.ts
```

Expected output:
```
server/storage.ts:4501:  async softDeleteRecruitmentCandidate(id: string)
server/database.ts:1213:  async softDeleteRecruitmentCandidate(id: string)
```

### 2. Check Which Storage You're Using

```bash
# Check server startup logs
npm run dev | grep -i "storage"
```

Look for:
- `DatabaseStorage (PostgreSQL) initialized` (using database)
- `PersistentFileStorage initialized` (using file storage)

### 3. Verify TypeScript Compilation

```bash
# Check for TypeScript errors
npx tsc --noEmit
```

Should show no errors related to storage methods.

---

## 📞 Need More Help?

If you're still seeing the error after trying all the above:

1. **Check Node version**: `node --version` (should be 18+)
2. **Check npm version**: `npm --version` (should be 9+)
3. **Share full error**: Copy the entire stack trace
4. **Share logs**: Show the startup logs when running `npm run dev`

---

## ✅ Summary

**Problem**: Old compiled JavaScript running instead of new TypeScript source  
**Solution**: Restart dev server or clean rebuild  
**Command**: `npm run dev` (after pulling code)  
**Time**: ~30 seconds  

**This method was added in recent commits** - always restart after pulling!
