# SAIL Crewing - Deployment Guide (Windows Server)

This guide covers a fresh deployment of the SAIL Crewing application on a Windows server with nginx + PM2.

## Architecture

```
Browser → nginx (port 80/443)
            ├── /crewing/         → static files (dist/public/)
            ├── /crewing/assets/  → JS, CSS, images (dist/public/assets/)
            ├── /figmaAssets/     → figma assets (dist/public/figmaAssets/)
            └── /api/             → proxy to PM2 backend (localhost:4000)
```

- **Frontend**: Static files served directly by nginx
- **Backend**: Express API running on PM2 (port 4000)
- **Database**: PostgreSQL

---

## Prerequisites

- Node.js v18 or higher
- PostgreSQL installed and running
- nginx installed
- PM2 installed globally: `npm install -g pm2`
- Git (for cloning the repository)

---

## Step 1: Create the Database

Open a terminal and run:

```bash
psql -U postgres
CREATE DATABASE crew_management_new;
\q
```

---

## Step 2: Clone the Project

```bash
cd C:\GitHub
git clone <your-repo-url> crewing_upgraded_build
cd crewing_upgraded_build
```

---

## Step 3: Install Dependencies

```bash
npm install
```

---

## Step 4: Set Up Environment Variables

Copy the environment template and update the values:

```bash
copy .env.dev .env
```

Open `.env` and update these values as needed:

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:sailadmin@localhost:5432/crew_management_new` |
| `PORT` | Backend API port | `4000` |
| `NODE_ENV` | Environment mode | `production` |
| `SESSION_SECRET` | Session encryption key | Change this to a secure random string |
| `VITE_API_BASE_URL` | External SAIL ERP API URL | `https://dev.sl-sail.com/b/api/v1` |
| `VITE_CLIENT_ENCRYPTION_KEY` | Client encryption key | `sailAdmin` |
| `VITE_AG_GRID_LICENSE_KEY` | AG Grid license (optional) | Not set |

---

## Step 5: Build the Project

```bash
npm run build:prod
```

This creates:
- `dist/public/` — Frontend static files (HTML, JS, CSS, images)
- `dist/server/index.js` — Backend API bundle

---

## Step 6: Start the Backend with PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

Verify the backend is running:

```bash
pm2 status
pm2 logs sail-crewing-api
```

You should see: `Production API server running on port 4000`

---

## Step 7: Configure nginx

Open your nginx config file (usually `C:\nginx\conf\nginx.conf`).

Add the following location blocks inside your `server { }` block. The full config is in `deploy/nginx.conf.example`.

```nginx
# API proxy to PM2 backend
location /api/ {
    proxy_pass http://localhost:4000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;

    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization";
        add_header Content-Length 0;
        add_header Content-Type text/plain;
        return 204;
    }
}

# Static assets (JS, CSS, images) - long cache
location /crewing/assets/ {
    alias C:/GitHub/crewing_upgraded_build/dist/public/assets/;
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
}

# Figma assets
location /figmaAssets/ {
    alias C:/GitHub/crewing_upgraded_build/dist/public/figmaAssets/;
    expires 30d;
    add_header Cache-Control "public";
    try_files $uri =404;
}

# React app (catch-all for SPA routing)
location /crewing/ {
    alias C:/GitHub/crewing_upgraded_build/dist/public/;
    try_files $uri $uri/ /crewing/index.html;

    add_header Cache-Control "no-cache";
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range" always;

    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range";
        add_header Content-Length 0;
        add_header Content-Type text/plain;
        return 204;
    }
}
```

Test and reload nginx:

```bash
nginx -t
nginx -s reload
```

---

## Step 8: Verify the Deployment

1. **React app**: Open `https://dev.sl-sail.com/crewing/` in your browser
2. **API health check**: Open `https://dev.sl-sail.com/api/health`
3. **Swagger docs**: Open `https://dev.sl-sail.com/api/docs`
4. **PM2 logs**: Run `pm2 logs sail-crewing-api` to check for errors

---

## Updating the Application

When you need to deploy a new version:

```bash
cd C:\GitHub\crewing_upgraded_build

# Pull latest code
git pull

# Install any new dependencies
npm install

# Rebuild
npm run build:prod

# Restart backend
pm2 restart sail-crewing-api
```

No nginx restart needed unless the nginx config itself changed. Frontend updates are served immediately since nginx reads from `dist/public/` directly.

---

## Useful Commands

| Command | Purpose |
|---|---|
| `pm2 status` | Check if backend is running |
| `pm2 logs sail-crewing-api` | View backend logs |
| `pm2 restart sail-crewing-api` | Restart the backend |
| `pm2 stop sail-crewing-api` | Stop the backend |
| `pm2 delete sail-crewing-api` | Remove from PM2 |
| `nginx -t` | Test nginx config |
| `nginx -s reload` | Reload nginx config |
| `npm run build:frontend` | Rebuild frontend only |
| `npm run build:backend` | Rebuild backend only |
| `npm run build:prod` | Rebuild everything |
| `npm run start:prod` | Run backend directly (without PM2) |

---

## Troubleshooting

**App shows blank page at /crewing/**
- Check that `dist/public/index.html` exists after build
- Verify nginx alias path is correct: `C:/GitHub/crewing_upgraded_build/dist/public/`
- Check browser console for 404 errors on JS/CSS files

**API returns 502 Bad Gateway**
- Check PM2 is running: `pm2 status`
- Check PM2 logs: `pm2 logs sail-crewing-api`
- Verify PORT in `.env` matches nginx proxy_pass port (default 4000)

**Database connection errors**
- Verify PostgreSQL is running
- Check DATABASE_URL in `.env` has correct credentials
- Ensure database `crew_management_new` exists

**Assets not loading (JS/CSS 404)**
- Verify `dist/public/assets/` directory exists and has files
- Check nginx alias path matches your actual directory

**CORS errors in browser**
- The nginx config includes CORS headers for all routes
- If using a custom domain, update `Access-Control-Allow-Origin` from `*` to your domain

**Migrations fail on startup**
- Check PM2 logs for specific migration errors: `pm2 logs sail-crewing-api`
- Ensure database user has CREATE/ALTER permissions
