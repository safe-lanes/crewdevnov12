# Seafarer Performance Management System - Deployment Guide

**Comprehensive deployment documentation for Windows, Linux, and macOS environments**

> **Last Updated:** December 17, 2025  
> **Database Tables:** 42  
> **Migrations Applied:** 36  
> **Latest Backup:** `crew-management-backup-2025-12-17.sql` (3.1 MB)  
> **Auto-Migration:** ✅ Enabled on startup

---

## 📊 Current System Status (Dec 17, 2025)

| Metric | Value |
|--------|-------|
| Total database tables | 42 |
| Total migrations | 36 (all applied) |
| Latest migration | `0033_sync_sc001_label_to_company.sql` |
| Migration tracking table | `schema_migrations` |
| Latest backup | `crew-management-backup-2025-12-17.sql` (3.1 MB) |
| Auto-migration | Runs on `npm run dev` startup |

### Quick Verification Commands
```bash
# Check table count (expected: 42)
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Check migration count (expected: 36)
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM schema_migrations;"

# View last 5 migrations
psql "$DATABASE_URL" -c "SELECT filename, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;"
```

---

## Table of Contents

1. [Local Development Setup](#1-local-development-setup)
   - [Windows](#for-windows)
   - [Linux/Mac](#for-linuxmac)
   - [Troubleshooting](#troubleshooting-local-setup)
2. [Staging/Dev Environment](#2-stagingdev-environment)
3. [Production Deployment](#3-production-deployment)
   - [Windows Server](#windows-server-deployment)
   - [Linux Server](#linux-server-deployment)
   - [Docker Deployment](#docker-deployment-cross-platform)
4. [Database Maintenance](#4-database-maintenance)
5. [Platform-Specific Monitoring](#5-platform-specific-monitoring)
6. [Firewall Configuration](#6-firewall-configuration)
7. [SSL/TLS Setup](#7-ssltls-setup)
8. [Quick Reference Commands](#8-quick-reference-commands)
9. [Drizzle Kit Schema Drift (False Positive)](#9-drizzle-kit-schema-drift-false-positive)
10. [Migration Files Reference](#10-migration-files-reference)
11. [Backup Files Reference](#11-backup-files-reference)

---

## 1. LOCAL DEVELOPMENT SETUP

### Prerequisites

- **Node.js:** Version 18.0 or higher
- **PostgreSQL:** Version 14.0 or higher
- **npm:** Version 8.0 or higher (comes with Node.js)
- **System Requirements:**
  - 4GB RAM minimum
  - 10GB available disk space
  - Internet connection for package installation

---

### For Windows

#### Install PostgreSQL

1. **Download PostgreSQL:**
   - Visit https://www.postgresql.org/download/windows/
   - Download PostgreSQL 15 installer (recommended)

2. **Run the installer:**
   - Double-click the downloaded .exe file
   - Follow installation wizard
   - **Important settings:**
     - Set password for `postgres` user (remember this!)
     - Port: `5432` (default)
     - Install pgAdmin 4 (GUI tool)
     - Install Command Line Tools

3. **Add PostgreSQL to PATH:**
   ```cmd
   setx PATH "%PATH%;C:\Program Files\PostgreSQL\15\bin"
   ```

4. **Verify installation:**
   ```cmd
   psql --version
   ```

#### Setup Project

```cmd
# Clone repository
git clone <your-repo-url>
cd crew-management

# Install dependencies
npm install

# Create .env file from template
copy .env.example .env

# Edit .env with your preferred editor
notepad .env
```

#### Configure Environment Variables

Edit `.env` file with the following configuration:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/crew_management
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=crew_management

# Application Configuration
NODE_ENV=development
PORT=5000
```

**Replace `your_password` with the password you set during PostgreSQL installation.**

#### Create Database

**Option 1: Using Command Line (psql)**

```cmd
# Connect to PostgreSQL
psql -U postgres

# In psql prompt, create database:
CREATE DATABASE crew_management;

# Exit psql
\q
```

**Option 2: Using pgAdmin 4 (GUI)**

1. Open pgAdmin 4
2. Right-click on **Databases** → **Create** → **Database**
3. Database name: `crew_management`
4. Owner: `postgres`
5. Click **Save**

#### Run Database Migrations

```cmd
# Generate migration files
npm run db:generate

# Apply migrations to database
npm run db:push

# Optional: Migrate existing JSON data to PostgreSQL
npx tsx server/migrate-json-to-postgres.ts
```

#### Start Development Server

```cmd
# Development mode with hot reload
npm run dev

# The server will start at http://localhost:5000
```

**Alternative: Production build**

```cmd
# Build the application
npm run build

# Start production server
npm start
```

#### Access Application

Open your web browser and navigate to:
```
http://localhost:5000
```

---

### For Linux/Mac

#### Install PostgreSQL

**Ubuntu/Debian:**

```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql

# Enable auto-start on boot
sudo systemctl enable postgresql

# Verify installation
psql --version
```

**macOS (using Homebrew):**

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Verify installation
psql --version
```

#### Setup Project

```bash
# Clone repository
git clone <your-repo-url>
cd crew-management

# Install dependencies
npm install

# Create .env file from template
cp .env.example .env

# Edit .env with your preferred editor
nano .env  # or vim .env or code .env
```

#### Configure Environment Variables

Edit `.env` file with the following configuration:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/crew_management
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=crew_management

# Application Configuration
NODE_ENV=development
PORT=5000
```

#### Create Database

**Option 1: Using psql**

```bash
# Switch to postgres user and create database
sudo -u postgres psql

# In psql prompt:
CREATE DATABASE crew_management;

# Exit psql
\q
```

**Option 2: Direct command**

```bash
# Create database directly
sudo -u postgres createdb crew_management
```

#### Run Database Migrations

```bash
# Generate migration files
npm run db:generate

# Apply migrations to database
npm run db:push

# Optional: Migrate existing JSON data to PostgreSQL
npx tsx server/migrate-json-to-postgres.ts
```

#### Start Development Server

```bash
# Development mode with hot reload
npm run dev

# The server will start at http://localhost:5000
```

**Alternative: Production build**

```bash
# Build the application
npm run build

# Start production server
npm start
```

#### Access Application

Open your web browser and navigate to:
```
http://localhost:5000
```

---

### Troubleshooting Local Setup

#### Windows Issues

**Issue: "psql is not recognized as an internal or external command"**

**Solution:**

```cmd
# Temporarily add to PATH for current session
set PATH=%PATH%;C:\Program Files\PostgreSQL\15\bin

# Permanently add to PATH:
# 1. Press Win + X → System
# 2. Click "Advanced system settings"
# 3. Click "Environment Variables"
# 4. Under "System variables", select "Path"
# 5. Click "Edit" → "New"
# 6. Add: C:\Program Files\PostgreSQL\15\bin
# 7. Click OK on all dialogs
# 8. Restart Command Prompt
```

**Issue: "Connection refused" or "could not connect to server"**

**Solution:**

```cmd
# Check if PostgreSQL service is running
sc query postgresql-x64-15

# Start the service if stopped
net start postgresql-x64-15

# Verify PostgreSQL is listening on port 5432
netstat -an | findstr 5432
```

**Issue: "Permission denied" when running npm commands**

**Solution:**
- Run Command Prompt or PowerShell as Administrator
- Check that PostgreSQL service is running
- Verify Windows Firewall allows port 5432

**Issue: "Port 5000 is already in use"**

**Solution:**

```cmd
# Find the process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace <PID> with the Process ID from above)
taskkill /PID <PID> /F
```

#### Linux/Mac Issues

**Issue: "Connection refused" or "could not connect to server"**

**Solution:**

```bash
# Check PostgreSQL service status
sudo systemctl status postgresql

# Start if stopped
sudo systemctl start postgresql

# Verify PostgreSQL is listening on port 5432
sudo netstat -tulpn | grep 5432
# OR on macOS:
lsof -i :5432
```

**Issue: "Peer authentication failed for user postgres"**

**Solution:**

```bash
# Edit pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Find the line:
local   all   postgres   peer

# Change to:
local   all   postgres   md5

# Save and exit (Ctrl+X, Y, Enter)

# Restart PostgreSQL
sudo systemctl restart postgresql
```

**Issue: "Port 5000 is already in use"**

**Solution:**

```bash
# Find the process using port 5000
lsof -i :5000

# Kill the process (replace <PID> with the Process ID)
kill -9 <PID>
```

**Issue: "permission denied" when creating database**

**Solution:**

```bash
# Set password for postgres user
sudo -u postgres psql
ALTER USER postgres PASSWORD 'your_password';
\q

# Now you can connect normally
psql -U postgres -h localhost
```

---

## 2. STAGING/DEV ENVIRONMENT

### Cloud PostgreSQL Setup (Cross-Platform)

For staging and development environments, we recommend using managed PostgreSQL services that work across all platforms.

#### Recommended Providers

**Neon (Recommended for Windows users):**
- **Website:** https://neon.tech
- **Features:** Serverless PostgreSQL, auto-scaling, free tier
- **Setup:**
  1. Create account at neon.tech
  2. Create new project
  3. Copy connection string
  4. Add to `.env`: `DATABASE_URL=postgresql://...`

**Supabase:**
- **Website:** https://supabase.com
- **Features:** PostgreSQL with real-time features, free tier
- **Setup:**
  1. Create account at supabase.com
  2. Create new project
  3. Navigate to Project Settings → Database
  4. Copy connection string (URI)
  5. Add to `.env`: `DATABASE_URL=postgresql://...`

**Railway:**
- **Website:** https://railway.app
- **Features:** Easy deployment, PostgreSQL plugin, free tier
- **Setup:**
  1. Create account at railway.app
  2. Create new project
  3. Add PostgreSQL service
  4. Copy connection string
  5. Add to `.env`: `DATABASE_URL=postgresql://...`

**Render:**
- **Website:** https://render.com
- **Features:** Managed PostgreSQL, free tier available
- **Setup:**
  1. Create account at render.com
  2. Create new PostgreSQL database
  3. Copy External Database URL
  4. Add to `.env`: `DATABASE_URL=postgresql://...`

### Deployment Steps (Any Platform)

```bash
# 1. Set environment to staging
export NODE_ENV=staging  # Linux/Mac
set NODE_ENV=staging     # Windows

# 2. Install dependencies
npm ci --only=production

# 3. Build application
npm run build

# 4. Run database migrations
npm run db:push

# 5. Start server
npm start
```

### Environment Variables for Staging

```env
# Database (use cloud provider connection string)
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# Application
NODE_ENV=staging
PORT=5000

# Security (generate strong secrets)
SESSION_SECRET=your-random-session-secret-here
```

---

## 3. PRODUCTION DEPLOYMENT

### Windows Server Deployment

#### Option A: Windows Server with IIS

**Prerequisites:**
- Windows Server 2019/2022
- IIS installed and configured
- Node.js 18+ installed
- PostgreSQL installed OR cloud database configured

**Install IIS Node Module:**

1. Download iisnode from: https://github.com/Azure/iisnode/releases
2. Install the appropriate version (x64 or x86)
3. Restart IIS after installation

**Install PM2 for Process Management:**

```cmd
# Install PM2 globally
npm install -g pm2

# Install PM2 Windows Service
npm install -g pm2-windows-service

# Setup PM2 as Windows Service
pm2-service-install
```

**Deploy Application:**

```cmd
# Navigate to application directory
cd C:\inetpub\wwwroot\crew-management

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Start with PM2
pm2 start npm --name "crew-management" -- start

# Save PM2 configuration
pm2 save

# Verify application is running
pm2 list
```

**IIS Configuration:**

1. Open **IIS Manager**
2. Right-click **Sites** → **Add Website**
3. Configure:
   - Site name: `crew-management`
   - Physical path: `C:\inetpub\wwwroot\crew-management`
   - Port: `80` (or `443` for HTTPS)
4. Configure **Application Pool:**
   - .NET CLR version: `No Managed Code`
   - Managed pipeline mode: `Integrated`

**Create web.config:**

Create `web.config` in your application root:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="iisnode" path="dist/server/index.js" verb="*" modules="iisnode"/>
    </handlers>
    <rewrite>
      <rules>
        <rule name="NodeInspector" patternSyntax="ECMAScript" stopProcessing="true">
          <match url="^dist/server/index.js\/debug[\/]?" />
        </rule>
        <rule name="StaticContent">
          <action type="Rewrite" url="public{REQUEST_URI}"/>
        </rule>
        <rule name="DynamicContent">
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True"/>
          </conditions>
          <action type="Rewrite" url="dist/server/index.js"/>
        </rule>
      </rules>
    </rewrite>
    <security>
      <requestFiltering>
        <hiddenSegments>
          <add segment="node_modules" />
        </hiddenSegments>
      </requestFiltering>
    </security>
    <httpErrors existingResponse="PassThrough" />
  </system.webServer>
</configuration>
```

#### Option B: Windows with PM2 (Standalone)

```cmd
# Install PM2 globally
npm install -g pm2

# Navigate to application directory
cd C:\apps\crew-management

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Start application with PM2
pm2 start npm --name crew-management -- start

# Configure PM2 to run on Windows startup
pm2 startup
pm2 save

# Monitor application
pm2 monit

# View logs
pm2 logs crew-management

# Restart application
pm2 restart crew-management
```

---

### Linux Server Deployment

#### Option A: Ubuntu/Debian with systemd

**Prerequisites:**
- Ubuntu 20.04+ or Debian 11+
- Node.js 18+ installed
- PostgreSQL installed OR cloud database configured
- nginx (optional, for reverse proxy)

**Create Application User:**

```bash
# Create dedicated user for the application
sudo useradd -r -s /bin/bash nodeuser

# Create application directory
sudo mkdir -p /var/www/crew-management

# Set ownership
sudo chown -R nodeuser:nodeuser /var/www/crew-management
```

**Deploy Application:**

```bash
# Switch to application directory
cd /var/www/crew-management

# Clone or copy application files
# If using git:
sudo -u nodeuser git clone <your-repo-url> .

# Install dependencies
sudo -u nodeuser npm ci --only=production

# Build application
sudo -u nodeuser npm run build

# Run database migrations
sudo -u nodeuser npm run db:push
```

**Create systemd Service:**

```bash
# Create service file
sudo nano /etc/systemd/system/crew-management.service
```

**Service Configuration:**

```ini
[Unit]
Description=Crew Management System
Documentation=https://github.com/your-org/crew-management
After=network.target postgresql.service

[Service]
Type=simple
User=nodeuser
WorkingDirectory=/var/www/crew-management
Environment=NODE_ENV=production
Environment=DATABASE_URL=postgresql://user:password@localhost:5432/crew_prod
EnvironmentFile=/var/www/crew-management/.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/crew-management/access.log
StandardError=append:/var/log/crew-management/error.log

[Install]
WantedBy=multi-user.target
```

**Create Log Directory:**

```bash
# Create log directory
sudo mkdir -p /var/log/crew-management

# Set permissions
sudo chown -R nodeuser:nodeuser /var/log/crew-management
```

**Enable and Start Service:**

```bash
# Reload systemd daemon
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable crew-management

# Start the service
sudo systemctl start crew-management

# Check service status
sudo systemctl status crew-management

# View logs
sudo journalctl -u crew-management -f
```

#### Option B: Linux with PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Navigate to application directory
cd /var/www/crew-management

# Start application with PM2
pm2 start npm --name crew-management -- start

# Configure PM2 to start on boot
pm2 startup systemd
# Run the command that PM2 outputs

# Save PM2 process list
pm2 save

# Monitor application
pm2 monit

# View logs
pm2 logs crew-management

# Restart application
pm2 restart crew-management
```

**Configure nginx as Reverse Proxy (Optional but Recommended):**

```bash
# Install nginx
sudo apt install nginx

# Create nginx configuration
sudo nano /etc/nginx/sites-available/crew-management
```

**nginx Configuration:**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable nginx Site:**

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/crew-management /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

### Docker Deployment (Cross-Platform)

**Works on: Windows, Linux, macOS**

#### Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose

**Dockerfile:**

Create `Dockerfile` in project root:

```dockerfile
# Use Node.js LTS Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production

# Start application
CMD ["npm", "start"]
```

**docker-compose.yml:**

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/crew_prod
      - NODE_ENV=production
    depends_on:
      - db
    restart: unless-stopped
    networks:
      - crew-network

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=crew_prod
    restart: unless-stopped
    networks:
      - crew-network

volumes:
  postgres_data:

networks:
  crew-network:
    driver: bridge
```

**Deploy with Docker:**

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f app

# Check container status
docker-compose ps

# Stop containers
docker-compose down

# Stop and remove volumes (WARNING: deletes database data)
docker-compose down -v
```

**Docker Management Commands:**

```bash
# Rebuild after code changes
docker-compose up -d --build

# Scale application (multiple instances)
docker-compose up -d --scale app=3

# Execute commands in container
docker-compose exec app npm run db:push

# Access database
docker-compose exec db psql -U postgres crew_prod

# View application logs
docker-compose logs -f --tail=100 app

# Restart specific service
docker-compose restart app
```

---

## 4. DATABASE MAINTENANCE

### Backup Strategy

#### Windows Backup

**Manual Backup:**

```cmd
# Backup with timestamp
pg_dump -U postgres -h localhost -p 5432 crew_management > backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%.sql

# Example output: backup_20250113.sql
```

**Automated Backup (Task Scheduler):**

Create `backup.bat`:

```batch
@echo off
set PGPASSWORD=your_password
set BACKUP_DIR=C:\backups\crew-management

# Create backup directory if it doesn't exist
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

# Create backup with timestamp
pg_dump -U postgres crew_management > "%BACKUP_DIR%\crew_%date:~-4,4%%date:~-10,2%%date:~-7,2%.sql"

# Delete backups older than 30 days
forfiles /p "%BACKUP_DIR%" /s /m *.sql /d -30 /c "cmd /c del @path"
```

**Schedule with Task Scheduler:**

1. Open **Task Scheduler**
2. Click **Create Basic Task**
3. Name: `Crew Management Backup`
4. Trigger: **Daily** at **2:00 AM**
5. Action: **Start a Program**
6. Program: `C:\backups\backup.bat`
7. Click **Finish**

#### Linux/Mac Backup

**Manual Backup:**

```bash
# Backup with timestamp
pg_dump crew_management > backup_$(date +%Y%m%d).sql

# Example output: backup_20250113.sql
```

**Automated Backup (cron):**

Create backup script `backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/crew-management"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup
pg_dump crew_management | gzip > "$BACKUP_DIR/crew_$DATE.sql.gz"

# Delete backups older than 30 days
find "$BACKUP_DIR" -name "crew_*.sql.gz" -mtime +30 -delete

# Log backup completion
echo "Backup completed: crew_$DATE.sql.gz" >> "$BACKUP_DIR/backup.log"
```

Make script executable:

```bash
chmod +x backup.sh
```

**Schedule with cron:**

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 2 AM):
0 2 * * * /path/to/backup.sh

# View scheduled cron jobs
crontab -l
```

### Restore from Backup

**Windows:**

```cmd
# Restore from backup
psql -U postgres crew_management < backup_20250113.sql

# Or restore to new database
createdb -U postgres crew_management_restore
psql -U postgres crew_management_restore < backup_20250113.sql
```

**Linux/Mac:**

```bash
# Restore from backup
psql crew_management < backup_20250113.sql

# Or restore from gzipped backup
gunzip -c crew_20250113_020000.sql.gz | psql crew_management

# Or restore to new database
createdb crew_management_restore
psql crew_management_restore < backup_20250113.sql
```

### Database Optimization

**Vacuum and Analyze (All Platforms):**

```sql
# Connect to database
psql -U postgres crew_management

# Vacuum to reclaim storage
VACUUM FULL;

# Analyze to update statistics
ANALYZE;

# Or combine both
VACUUM FULL ANALYZE;

# Exit
\q
```

**Automate Vacuum (PostgreSQL autovacuum is enabled by default)**

Check autovacuum status:

```sql
SHOW autovacuum;
```

---

## 5. PLATFORM-SPECIFIC MONITORING

### Windows Monitoring

**Check Service Status:**

```cmd
# Check PM2 service
pm2 list

# Check Windows service (if using PM2 Windows Service)
sc query crew-management

# Check PostgreSQL service
sc query postgresql-x64-15
```

**View Application Logs:**

```cmd
# PM2 logs
pm2 logs crew-management

# PM2 monitoring dashboard
pm2 monit

# View Windows Event Logs
eventvwr.msc
```

**Resource Monitoring:**

```cmd
# Open Performance Monitor
perfmon

# Open Resource Monitor
resmon

# Check port usage
netstat -ano | findstr :5000
```

### Linux Monitoring

**Check Service Status:**

```bash
# Check systemd service
sudo systemctl status crew-management

# Check PM2 (if using PM2)
pm2 list
pm2 status
```

**View Application Logs:**

```bash
# systemd logs (real-time)
sudo journalctl -u crew-management -f

# systemd logs (last 100 lines)
sudo journalctl -u crew-management -n 100

# PM2 logs
pm2 logs crew-management

# PM2 monitoring dashboard
pm2 monit
```

**Resource Monitoring:**

```bash
# Real-time process monitoring
htop

# Or standard top
top

# Disk usage
df -h

# Memory usage
free -h

# Check port usage
sudo lsof -i :5000
sudo netstat -tulpn | grep :5000
```

**Application Health Check:**

```bash
# Create health check script
#!/bin/bash
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health)

if [ "$response" == "200" ]; then
    echo "Application is healthy"
else
    echo "Application is down! Restarting..."
    systemctl restart crew-management
fi
```

---

## 6. FIREWALL CONFIGURATION

### Windows Firewall

**Allow Application Port:**

```cmd
# Allow inbound traffic on port 5000
netsh advfirewall firewall add rule name="Crew Management App" dir=in action=allow protocol=TCP localport=5000

# Allow PostgreSQL port (if external access needed)
netsh advfirewall firewall add rule name="PostgreSQL" dir=in action=allow protocol=TCP localport=5432
```

**Remove Firewall Rule:**

```cmd
# Remove application rule
netsh advfirewall firewall delete rule name="Crew Management App"
```

**View Firewall Rules:**

```cmd
# View all rules
netsh advfirewall firewall show rule name=all

# View specific rule
netsh advfirewall firewall show rule name="Crew Management App"
```

### Linux Firewall (UFW)

**Install and Enable UFW (Ubuntu/Debian):**

```bash
# Install UFW
sudo apt install ufw

# Allow SSH first (important!)
sudo ufw allow ssh
sudo ufw allow 22/tcp

# Allow application port
sudo ufw allow 5000/tcp

# Allow PostgreSQL (if external access needed)
sudo ufw allow 5432/tcp

# Allow HTTP/HTTPS (if using nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

**Remove Firewall Rule:**

```bash
# Remove rule by number
sudo ufw status numbered
sudo ufw delete <number>

# Or remove by rule
sudo ufw delete allow 5000/tcp
```

### Linux Firewall (firewalld - CentOS/RHEL)

```bash
# Install firewalld
sudo yum install firewalld

# Start and enable firewalld
sudo systemctl start firewalld
sudo systemctl enable firewalld

# Allow application port
sudo firewall-cmd --permanent --add-port=5000/tcp

# Allow PostgreSQL (if needed)
sudo firewall-cmd --permanent --add-port=5432/tcp

# Reload firewall
sudo firewall-cmd --reload

# Check configuration
sudo firewall-cmd --list-all
```

---

## 7. SSL/TLS SETUP

### Windows with IIS

**Using IIS Manager:**

1. Open **IIS Manager**
2. Select your server node
3. Double-click **Server Certificates**
4. Click **Create Certificate Request** (right panel)
5. Fill in certificate details
6. Choose cryptographic provider: **Microsoft RSA SChannel**
7. Bit length: **2048**
8. Save request to file

**Install Certificate:**

1. Submit certificate request to Certificate Authority (CA)
2. Receive certificate file
3. In IIS Manager → **Server Certificates** → **Complete Certificate Request**
4. Browse to certificate file
5. Provide friendly name

**Bind HTTPS to Site:**

1. In IIS Manager, select your site
2. Click **Bindings** (right panel)
3. Click **Add**
4. Type: **https**
5. Port: **443**
6. SSL certificate: Select your certificate
7. Click **OK**

### Linux with nginx + Let's Encrypt

**Install Certbot:**

```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx
```

**Obtain Certificate:**

```bash
# For nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose redirect (option 2 recommended)
```

**Auto-Renewal:**

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot installs a cron job automatically
# Verify cron job:
sudo systemctl status certbot.timer

# Or manually add to crontab
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet
```

**Manual nginx SSL Configuration (if not using certbot):**

Edit nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/your_certificate.crt;
    ssl_certificate_key /etc/ssl/private/your_private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 8. QUICK REFERENCE COMMANDS

### Windows Commands

```cmd
# PostgreSQL
net start postgresql-x64-15          # Start PostgreSQL
net stop postgresql-x64-15           # Stop PostgreSQL
psql -U postgres                     # Connect to PostgreSQL

# Application
npm start                            # Start application
npm run dev                          # Start development mode
npm run build                        # Build application

# PM2
pm2 start npm --name app -- start    # Start with PM2
pm2 stop app                         # Stop application
pm2 restart app                      # Restart application
pm2 logs app                         # View logs
pm2 monit                            # Monitor dashboard

# Network
netstat -ano | findstr :5000         # Check port 5000
tasklist | findstr node              # List Node processes
taskkill /PID <pid> /F               # Kill process
ipconfig                             # Network configuration

# System
sc query <service>                   # Check service status
eventvwr                             # Event Viewer
perfmon                              # Performance Monitor
```

### Linux/Mac Commands

```bash
# PostgreSQL
sudo systemctl start postgresql      # Start PostgreSQL
sudo systemctl stop postgresql       # Stop PostgreSQL
sudo systemctl status postgresql     # Check status
psql -U postgres                     # Connect to PostgreSQL

# Application
npm start                            # Start application
npm run dev                          # Start development mode
npm run build                        # Build application

# systemd
sudo systemctl start crew-management     # Start service
sudo systemctl stop crew-management      # Stop service
sudo systemctl restart crew-management   # Restart service
sudo systemctl status crew-management    # Check status
sudo journalctl -u crew-management -f    # View logs

# PM2
pm2 start npm --name app -- start    # Start with PM2
pm2 stop app                         # Stop application
pm2 restart app                      # Restart application
pm2 logs app                         # View logs
pm2 monit                            # Monitor dashboard

# Network
sudo lsof -i :5000                   # Check port 5000
sudo netstat -tulpn | grep :5000     # Alternative port check
sudo ss -tulpn | grep :5000          # Another alternative
ip addr                              # Network configuration

# System
htop                                 # Process monitor
df -h                                # Disk usage
free -h                              # Memory usage
systemctl list-units --type=service  # List services
```

### Database Commands (All Platforms)

```sql
-- Connect to database
psql -U postgres crew_management

-- List databases
\l

-- List tables
\dt

-- Describe table
\d crew_members

-- View table data
SELECT * FROM crew_members LIMIT 10;

-- Count records
SELECT COUNT(*) FROM crew_members;

-- Backup database
\! pg_dump crew_management > backup.sql

-- Quit
\q
```

### Git Deployment Commands

```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Run migrations
npm run db:push

# Restart application
# PM2:
pm2 restart crew-management

# systemd (Linux):
sudo systemctl restart crew-management

# PM2 (Windows):
pm2 restart crew-management
```

---

## Environment-Specific .env Templates

### Development (.env.development)

```env
NODE_ENV=development
PORT=5000

# Local PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/crew_dev
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=crew_dev

# Development settings
LOG_LEVEL=debug
ENABLE_CORS=true
```

### Staging (.env.staging)

```env
NODE_ENV=staging
PORT=5000

# Cloud PostgreSQL (Neon/Supabase/Railway)
DATABASE_URL=postgresql://user:password@host:5432/crew_staging?sslmode=require

# Staging settings
LOG_LEVEL=info
ENABLE_CORS=true
SESSION_SECRET=your-staging-secret-here
```

### Production (.env.production)

```env
NODE_ENV=production
PORT=5000

# Production PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/crew_prod?sslmode=require

# Production settings
LOG_LEVEL=error
ENABLE_CORS=false
SESSION_SECRET=your-production-secret-here

# Security
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

## Support and Troubleshooting

### Common Issues Across All Platforms

**Issue: Database connection timeout**

**Solution:**
- Verify DATABASE_URL is correct
- Check PostgreSQL is running
- Verify firewall allows database port
- For cloud databases, check IP whitelist

**Issue: Application crashes on startup**

**Solution:**
```bash
# Check logs for errors
# PM2:
pm2 logs crew-management --err

# systemd:
sudo journalctl -u crew-management -n 50

# Look for:
# - Missing environment variables
# - Database connection errors
# - Port conflicts
```

**Issue: Out of memory**

**Solution:**
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 dist/server/index.js

# Or in package.json:
"start": "node --max-old-space-size=4096 dist/server/index.js"
```

---

## Performance Optimization

### Database Connection Pooling

Already configured in `server/database.ts` with optimal settings:
- Pool size: 20 connections
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

### Application Performance

**Enable Compression (Express):**

```bash
npm install compression
```

**Production Build Optimization:**

Vite automatically optimizes for production with:
- Code minification
- Tree shaking
- Asset optimization
- Code splitting

---

## Security Checklist

- [ ] Use strong passwords for PostgreSQL
- [ ] Configure firewall rules (only allow necessary ports)
- [ ] Enable SSL/TLS for HTTPS
- [ ] Set strong SESSION_SECRET in production
- [ ] Keep dependencies updated (`npm audit`)
- [ ] Regular database backups
- [ ] Restrict database access (use environment-specific users)
- [ ] Enable logging and monitoring
- [ ] Use environment variables for secrets (never commit .env)
- [ ] Implement rate limiting for APIs
- [ ] Regular security updates for OS and packages

---

## Maintenance Schedule

**Daily:**
- Monitor application logs
- Check disk space
- Verify backup completion

**Weekly:**
- Review error logs
- Check application performance
- Update dependencies (review changelogs first)

**Monthly:**
- Security updates
- Database optimization (VACUUM ANALYZE)
- Review and archive old logs
- Test backup restoration

**Quarterly:**
- Major version updates
- Security audit
- Performance review
- Disaster recovery drill

---

## Additional Resources

- **PostgreSQL Documentation:** https://www.postgresql.org/docs/
- **Node.js Documentation:** https://nodejs.org/docs/
- **PM2 Documentation:** https://pm2.keymetrics.io/docs/
- **nginx Documentation:** https://nginx.org/en/docs/
- **Let's Encrypt:** https://letsencrypt.org/
- **Neon PostgreSQL:** https://neon.tech/docs
- **Docker Documentation:** https://docs.docker.com/

---

---

## 9. DRIZZLE KIT SCHEMA DRIFT (FALSE POSITIVE)

⚠️ **Important:** When running `npx drizzle-kit generate`, you may see prompts like:

```
Is uploaded_photo column in crew_members table created or renamed from another column?
```

**This is a FALSE POSITIVE.** The column already exists and the migration was applied.

### Why This Happens

1. The application uses a custom migration system (`schema_migrations` table)
2. Drizzle Kit uses its own migration tracking (`drizzle.__drizzle_migrations`)
3. Both systems are valid, but Drizzle Kit isn't aware of manually applied migrations

### How to Verify Everything is Correct

```bash
# Verify column exists
psql "$DATABASE_URL" -c "\d crew_members" | grep uploaded_photo
# Expected: uploaded_photo | text | YES

# Verify migration was applied
psql "$DATABASE_URL" -c "SELECT * FROM schema_migrations WHERE filename LIKE '%uploaded_photo%';"
# Expected: 0013_add_uploaded_photo_column.sql | 2025-12-05 ...

# Verify unique constraint on company_trainings
psql "$DATABASE_URL" -c "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'company_trainings' AND constraint_type = 'UNIQUE';"
# Expected: company_trainings_training_master_id_key
```

### Resolution

**Do NOT run `npx drizzle-kit push --force`** unless you understand the implications.

The schema is correct. The warning is due to different migration tracking systems. Use the verification commands above to confirm the database is in sync.

---

## 10. MIGRATION FILES REFERENCE

### Migration Folder Structure

```
migrations/
├── 0000_stiff_archangel.sql        # Initial schema (18KB)
├── 0001_add_is_delete_to_recruitment_candidates.sql
├── 0002_add_handover_fields_to_vessel_planning.sql
├── 0003_set_default_crew_status_primary.sql
├── 0004_add_performance_indexes.sql
├── 0005_add_rotation_archive_table.sql
├── 0006_add_vessel_crew_archive_fields.sql
├── 0007_add_vessel_type_hierarchy.sql
├── 0008_add_crew_status_fields.sql
├── 0009_add_sign_off_reason.sql
├── 0010_add_oil_chemical_tanker.sql
├── 0011_add_license_dce_master.sql
├── 0012_add_dce_support_licenses.sql
├── 0013_add_uploaded_photo_column.sql
├── 0014_consolidate_sign_on_date.sql
├── 0015_add_reliever_sign_on_date.sql
├── 0016_backfill_crew_sign_on_date.sql
├── 0017_allow_null_file_no.sql
├── 0018_add_is_system_rank_column.sql
├── 0019_starter_pack_ranks.sql
├── 0020_sync_vessel_actual_manning.sql
├── 0021_consolidate_vessel_planning_rank_ids.sql
├── 0022_update_english_proficiency_values.sql
├── 0023_add_oil_major_rules_table.sql
├── 0024_training_master_seed.sql
├── 0025_add_company_trainings_table.sql
├── 0026_backfill_company_trainings.sql
├── 0027_update_company_trainings_data.sql
├── 0028_align_company_training_sort_order.sql
├── 0029_fix_company_training_sort_order.sql
├── 0030_add_company_training_groups.sql
├── 0031_add_company_training_requirements.sql
├── 0032_update_sc001_add_sc008.sql
├── 0033_sync_sc001_label_to_company.sql
├── AUTO_MIGRATION_GUIDE.md
├── DEVELOPER_MIGRATION_GUIDE.md
└── README.md
```

### Creating New Migrations

Follow the naming convention: `NNNN_descriptive_name.sql`

```sql
-- Example: 0034_add_new_feature.sql

-- Always use IF NOT EXISTS / IF EXISTS for idempotent migrations
CREATE TABLE IF NOT EXISTS new_table (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

ALTER TABLE existing_table 
ADD COLUMN IF NOT EXISTS new_column TEXT;
```

---

## 11. BACKUP FILES REFERENCE

### Available Backups

| File | Size | Date | Notes |
|------|------|------|-------|
| `crew-management-backup-2025-12-17.sql` | 3.1 MB | Dec 17, 2025 | ⭐ Latest (42 tables) |
| `crew_management_backup_v2_phase2.sql` | 108 KB | Nov 17, 2025 | Phase 2 backup |
| `crew-management-backup-2025-11-14.sql` | 103 KB | Nov 14, 2025 | Baseline (32 tables) |

### Creating New Backups

```bash
# Run the backup script
npx tsx server/backup-database.ts

# Output: backups/crew-management-backup-YYYY-MM-DD.sql
```

### Restoring from Backup

```bash
# Linux/macOS
dropdb seafarer_db && createdb seafarer_db
psql "$DATABASE_URL" < backups/crew-management-backup-2025-12-17.sql

# Windows (PowerShell)
dropdb -U postgres seafarer_db; createdb -U postgres seafarer_db
psql -U postgres -d seafarer_db -f backups\crew-management-backup-2025-12-17.sql
```

---

**Document Version:** 2.0  
**Last Updated:** December 17, 2025  
**Maintainer:** Development Team
