# Deployment Guide

## Overview

The Seafarer Performance Management System is designed to run on Replit's platform with PostgreSQL database support.

---

## Environment Setup

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes (auto-set by Replit) |
| `PGHOST` | PostgreSQL host | Yes (auto-set by Replit) |
| `PGPORT` | PostgreSQL port | Yes (auto-set by Replit) |
| `PGUSER` | PostgreSQL user | Yes (auto-set by Replit) |
| `PGPASSWORD` | PostgreSQL password | Yes (auto-set by Replit) |
| `PGDATABASE` | Database name | Yes (auto-set by Replit) |
| `VITE_AG_GRID_LICENSE_KEY` | AG Grid Enterprise license | Optional (shows watermark if not set) |
| `NODE_ENV` | Environment mode | Auto-set |

### Setting Environment Variables on Replit

1. Open the **Secrets** panel (click "Secrets" in left sidebar or search)
2. Add key-value pairs for each required variable
3. Secrets are encrypted and project-specific

---

## Build Process

### Development Mode

```bash
npm run dev
```

This runs:
1. Express server with hot reload (via TSX)
2. Vite dev server for frontend
3. Both on port 5000

### Production Build

```bash
npm run build
```

This:
1. Compiles TypeScript
2. Bundles frontend with Vite
3. Outputs to `dist/` directory

---

## Database Setup

### Initial Setup

1. Create PostgreSQL database on Replit:
   - Use Replit's database feature (Neon-backed)
   - Environment variables are automatically set

2. Run migrations:
   - Migrations run automatically on server start
   - Manual: Check `migrations/` folder for SQL files

### Migration System

Migrations are stored in `migrations/` as SQL files:
```
migrations/
├── 0000_stiff_archangel.sql
├── 0001_add_is_delete_to_recruitment_candidates.sql
├── ...
├── 0052_add_rest_hours_daily_records_unique_constraint.sql
└── meta/
```

#### Running Migrations Manually

```bash
# Via migrationRunner.ts (on server start)
npm run dev

# Or directly with psql (if needed)
psql $DATABASE_URL -f migrations/NNNN_name.sql
```

#### Creating New Migrations

1. Create file: `migrations/NNNN_descriptive_name.sql`
2. Use `IF NOT EXISTS` / `IF EXISTS` for idempotency
3. Test locally before deploying

---

## Deployment Steps

### Deploying on Replit

1. **Push code** to the Replit project

2. **Verify environment variables** in Secrets panel

3. **Start the application**:
   ```bash
   npm run dev
   ```

4. **Check logs** for migration status and startup:
   ```
   🔗 Using DATABASE_URL from environment (Replit PostgreSQL)
   ✅ Schema migrations handled by Drizzle/PostgreSQL migrations
   🔌 Attempting to connect to PostgreSQL...
   ✅ SUCCESS: PostgreSQL database connected successfully!
   📊 Migration Summary:
      ✅ Applied: 0
      ⏭️  Skipped: 57
   🚀 Application is ready to serve requests
   ```

### Deploying to Production

1. **Configure deployment** in Replit:
   - Go to deployment settings
   - Set run command: `npm run start` (or `npm run dev`)
   - Set port: 5000

2. **Enable autoscaling** (optional):
   - Configure for autoscale deployment type
   - Stateless frontend can use autoscaling

3. **Set production environment**:
   - Ensure `NODE_ENV=production`
   - Set all required secrets

---

## Server Configuration

### Port Configuration

- **Development/Production**: Port 5000
- **Frontend binding**: Must be `0.0.0.0:5000` (not localhost)

### CORS Configuration

Currently allows all origins. For production, configure in `server/index.ts`:
```typescript
app.use(cors({
  origin: ['https://your-domain.com'],
  credentials: true
}));
```

### Request Limits

```typescript
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
```

---

## Monitoring & Logging

### Server Logs

Logs are output to console:
```
6:10:21 AM [express] serving on port 5000
6:10:28 AM [express] GET /api/crew-members 304 in 72ms
```

### Health Check

```bash
curl https://your-app.replit.dev/api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-05T06:10:21.000Z"
}
```

### Database Check

```bash
curl https://your-app.replit.dev/api/db-test
```

---

## Backup & Recovery

### Database Backup

1. **Replit's automatic backups**: Neon-backed PostgreSQL includes automatic backups

2. **Manual backup**:
   ```bash
   pg_dump $DATABASE_URL > backup.sql
   ```

3. **Application-level backup**:
   - `server/backup-database.ts` - Backup utility
   - `server/restore-database.ts` - Restore utility

### Rollback

Replit supports checkpoint rollback:
1. Code, chat history, and database can be rolled back together
2. Use checkpoints for safe points before major changes

---

## Troubleshooting

### Common Issues

#### Database Connection Errors
```
Error: connect ECONNREFUSED
```
**Solution**: Ensure PostgreSQL is running and `DATABASE_URL` is set correctly

#### Migration Failures
```
Error: duplicate key value violates unique constraint
```
**Solution**: 
1. Check for existing data that violates the constraint
2. Clean up duplicates before applying migration
3. Use `IF NOT EXISTS` in migration

#### Port Already in Use
```
Error: EADDRINUSE: address already in use :::5000
```
**Solution**: Stop any other processes using port 5000, or restart the workflow

#### Frontend Not Loading
**Solution**:
1. Ensure Vite dev server is configured to allow all hosts
2. Check `vite.config.ts` for `server.allowedHosts: true`

### Debug Mode

Enable verbose logging:
```typescript
// In development
console.log('Debug:', data);
```

---

## Performance Optimization

### Database

1. **Connection pooling**: Handled by Drizzle/Neon
2. **Indexes**: Added for frequently queried columns
3. **Query optimization**: Use specific field selection

### Frontend

1. **Code splitting**: React.lazy() for route modules
2. **Caching**: TanStack Query with 5-minute cache
3. **Memoization**: React.memo for expensive components

### Server

1. **Response caching**: 304 responses for unchanged data
2. **JSON parsing**: Efficient body parsing with limits
3. **Static serving**: Vite handles static file optimization

---

## Security Checklist

### Pre-Deployment

- [ ] Remove any hardcoded credentials
- [ ] Set secure environment variables
- [ ] Enable HTTPS (automatic on Replit)
- [ ] Configure CORS for production domains
- [ ] Implement rate limiting (recommended)
- [ ] Add authentication (not currently implemented)

### Post-Deployment

- [ ] Monitor error logs
- [ ] Set up alerts for failures
- [ ] Regular database backups
- [ ] Keep dependencies updated
