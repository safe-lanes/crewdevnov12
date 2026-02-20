# Change Log – Local Testing Deployment Config

## 1. Frontend Code Changes
- No frontend code changes in this issue.

## 2. Backend Code Changes
- No backend code changes in this issue.

## 3. Database Level Changes
- No database changes in this issue.

## Additional Notes

### New Files Created
- **deploy/nginx.local.conf** — Complete, self-contained nginx.conf for local Windows testing.
  - Full nginx structure (worker_processes, events, http block)
  - Gzip compression enabled for text/css/json/js
  - API proxy: `/api/` → `http://127.0.0.1:4000/api/` (backend on port 4000)
  - Static assets: `/crewing/assets/` → `dist/public/assets/` with 1-year cache
  - Figma assets: `/figmaAssets/` → `dist/public/figmaAssets/` with 30-day cache
  - SPA routing: `/crewing/` → `dist/public/` with `try_files` fallback to `index.html`
  - Root `/` redirect to `/crewing/`
  - Logging to `crewing_access.log` and `crewing_error.log`
  - Listens on port 8080 (localhost)

- **deploy/LOCAL_TESTING_GUIDE.md** — Step-by-step guide covering:
  - Prerequisites (Node.js, PostgreSQL, nginx, PM2)
  - Database setup (`crew_management_new`)
  - Environment variable configuration (`.env`)
  - Build (`npm run build:prod`)
  - Backend startup (direct or PM2)
  - nginx setup (copy config, test, start)
  - Testing checklist with URLs
  - Stopping all services
  - Common issues and troubleshooting
  - Local vs production comparison table

### Deployment Notes
- Local testing uses port 8080 (nginx) and 4000 (backend API)
- Production uses ports 80/443 with SSL
- All paths point to `C:/GitHub/crewing_upgraded_build/dist/public/`
- No code changes required — same build output works for both local and production
