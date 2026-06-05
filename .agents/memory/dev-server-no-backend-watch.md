---
name: Dev server has no backend hot-reload
description: New/changed Express routes require a manual workflow restart; otherwise requests hit the Vite SPA fallback.
---

The `Start application` workflow runs `npm run dev` → `tsx server/index.ts` with **no watch mode**. The Vite middleware hot-reloads the client, but the Express server does NOT pick up backend changes (new routes, controller/route edits) until the workflow is manually restarted.

**Symptom when forgotten:** a newly added API route returns HTTP 200 with `Content-Type: text/html` (the SPA `index.html` fallback) instead of JSON, because the route isn't registered in the running process and the request falls through to Vite's catch-all. On the client this surfaces as a `.json()` parse failure / "partially saved" error, and nothing persists — even though the route code is correct and present in the file.

**Why:** the running process was started before the route existed; tsx without `--watch` never reloads it.

**How to apply:** after adding or changing any backend route/controller, restart the `Start application` workflow before testing. To diagnose a "saves but doesn't persist / 200 but no DB row" report, curl the endpoint and check `Content-Type` — `text/html` means the route isn't live and a restart is needed. Production is unaffected (deploys start the server fresh).
