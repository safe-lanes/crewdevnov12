# Frontend Refactor Prompt – Use Environment Variable for API Base URL

## Scope
- ✅ Frontend code only
- ❌ No backend changes
- ❌ No API contract or endpoint changes

---

## Objective
Replace all hardcoded usages of the API base URL:

```
https://dev.sl-sail.com/b/api/v1
```

from **frontend hooks** and load it from an environment variable.

If the environment variable is not found, the code must **fallback** to:

```
https://dev.sl-sail.com/b/api/v1
```

---

## Environment Variable
Use the following frontend environment variable:

```
VITE_API_BASE_URL
```

Access it using:

```ts
import.meta.env.VITE_API_BASE_URL
```

---

## Implementation Guidelines

### 1. Create a Single Source of Truth
Create a frontend config file:

```
src/config/api.ts
```

Add fallback logic:

```ts
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://dev.sl-sail.com/b/api/v1";
```

---

### 2. Update Frontend Hooks
- Remove all hardcoded API base URLs from hooks
- Import and use `API_BASE_URL`
- Do not modify endpoint paths

#### Example (Before)
```ts
fetch("https://dev.sl-sail.com/b/api/v1/users");
```

#### Example (After)
```ts
fetch(`${API_BASE_URL}/users`);
```

---

## Rules
- Do not introduce backend logic
- Do not change existing API endpoints
- Keep changes minimal and clean
- Ensure fallback works when `.env` is missing

---

## Acceptance Criteria
- No hardcoded `https://dev.sl-sail.com/b/api/v1` remains in frontend hooks
- All hooks use `API_BASE_URL`
- App works with and without environment variables
- Frontend-only changes applied
