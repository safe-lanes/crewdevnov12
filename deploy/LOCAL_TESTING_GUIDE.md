# SAIL Crewing - Local Testing Guide (Windows)

Test the full production build on your local machine before deploying to the server.

---

## Architecture (Local)

```
Browser → http://localhost:8080
              ├── /crewing/         → static files from dist/public/
              ├── /crewing/assets/  → JS, CSS (dist/public/assets/)
              ├── /figmaAssets/     → figma assets (dist/public/figmaAssets/)
              └── /api/             → proxy to backend (localhost:4000)
```

This mirrors the production setup exactly, just running locally.

---

## Prerequisites

| Requirement | How to install |
|---|---|
| **Node.js** v18+ | [nodejs.org](https://nodejs.org/) |
| **PostgreSQL** | [postgresql.org](https://www.postgresql.org/download/windows/) |
| **nginx** | [nginx.org/en/download.html](https://nginx.org/en/download.html) — download the Windows zip |
| **PM2** (optional) | `npm install -g pm2` |

### nginx on Windows

1. Download the Windows zip from nginx.org
2. Extract to `C:\nginx\`
3. You should have `C:\nginx\nginx.exe` and `C:\nginx\conf\nginx.conf`

---

## Step 1: Set Up the Database

Open a terminal and create the database:

```bash
psql -U postgres
CREATE DATABASE crew_management_new;
\q
```

---

## Step 2: Set Up Environment Variables

Copy the environment template:

```bash
copy .env.dev .env
```

Open `.env` and verify these values:

```env
DATABASE_URL=postgres://postgres:sailadmin@localhost:5432/crew_management_new
PORT=4000
NODE_ENV=production
SESSION_SECRET=your-secret-key-here
```

Update the password (`sailadmin`) to match your local PostgreSQL password.

---

## Step 3: Install Dependencies

```bash
cd C:\GitHub\crewing_upgraded_build
npm install
```

---

## Step 4: Build the Project

```bash
npm run build:prod
```

This creates:
- `dist/public/` — Frontend (HTML, JS, CSS, images)
- `dist/server/index.js` — Backend API bundle

Verify the build succeeded:

```bash
dir dist\public\index.html
dir dist\server\index.js
```

Both files should exist.

---

## Step 5: Start the Backend

**Option A — Direct (simpler):**

```bash
npm run start:prod
```

You should see: `Production API server running on port 4000`

**Option B — With PM2 (closer to production):**

```bash
pm2 start ecosystem.config.cjs
pm2 status
```

### Quick backend test

Open your browser to: `http://localhost:4000/api/health`

You should get a JSON response confirming the API is running.

---

## Step 6: Set Up nginx

1. Copy the local config file:

```bash
copy deploy\nginx.local.conf C:\nginx\conf\nginx.conf
```

2. Test the config:

```bash
C:\nginx\nginx.exe -t
```

You should see: `nginx: configuration file ... test is successful`

3. Start nginx:

```bash
C:\nginx\nginx.exe
```

If nginx is already running, reload instead:

```bash
C:\nginx\nginx.exe -s reload
```

---

## Step 7: Test Everything

Open your browser and check each part:

| What to test | URL | Expected result |
|---|---|---|
| **App loads** | http://localhost:8080/crewing/ | React app appears, login page or dashboard |
| **API health** | http://localhost:8080/api/health | JSON health response |
| **Swagger docs** | http://localhost:8080/api/docs | API documentation page |
| **Root redirect** | http://localhost:8080/ | Redirects to /crewing/ |
| **SPA routing** | http://localhost:8080/crewing/admin | App loads (no 404) |

---

## Stopping Everything

```bash
# Stop nginx
C:\nginx\nginx.exe -s stop

# Stop backend (if using PM2)
pm2 stop sail-crewing-api

# Stop backend (if running directly)
# Press Ctrl+C in the terminal running npm run start:prod
```

---

## Rebuilding After Code Changes

If you make code changes and want to re-test:

```bash
# Rebuild
npm run build:prod

# Restart backend
pm2 restart sail-crewing-api
# or stop and re-run: npm run start:prod
```

No nginx restart needed — it reads from `dist/public/` directly, so frontend changes appear immediately.

---

## Common Issues

### "Port 8080 already in use"

Another process is using port 8080. Either stop it or change the port in `nginx.local.conf`:

```nginx
listen 9090;   # change from 8080 to any free port
```

### "502 Bad Gateway" on /api/ routes

The backend isn't running on port 4000. Check:

```bash
# Is it running?
pm2 status
# or check if port 4000 is listening:
netstat -an | findstr 4000
```

### Blank page at /crewing/

- Check `dist/public/index.html` exists
- Check nginx error log: `C:\nginx\logs\crewing_error.log`
- Open browser dev tools (F12) → Console tab for JavaScript errors
- Open browser dev tools → Network tab and look for 404 errors on .js or .css files

### "Access denied" or permission errors

Run your terminal as Administrator, or check that the nginx user has read access to `C:\GitHub\crewing_upgraded_build\dist\public\`.

### Assets (JS/CSS) return 404

Verify the path in nginx.local.conf matches your actual project location. If your project is NOT at `C:\GitHub\crewing_upgraded_build\`, update all the `alias` paths in the config.

### Database connection errors on startup

- Verify PostgreSQL is running (check Services or `pg_isready`)
- Check the `DATABASE_URL` in your `.env` file
- Make sure the database `crew_management_new` exists

---

## Differences from Production

| Aspect | Local | Production |
|---|---|---|
| URL | http://localhost:8080 | https://dev.sl-sail.com |
| SSL/HTTPS | No | Yes (via certificate) |
| nginx port | 8080 | 80/443 |
| nginx config | deploy/nginx.local.conf | deploy/nginx.conf.example |
| Process manager | Optional (PM2 or direct) | PM2 (required) |

Everything else is identical — same build, same paths, same API proxying.
