# ============================================
# Apply All Database Migrations (PowerShell)
# ============================================
# This script applies all migration files in order
# Safe to run multiple times (idempotent)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Applying Database Migrations" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "ERROR: DATABASE_URL environment variable is not set" -ForegroundColor Red
    Write-Host "Please set DATABASE_URL before running this script:" -ForegroundColor Yellow
    Write-Host '  $env:DATABASE_URL = "postgresql://user:pass@host:port/database"' -ForegroundColor Yellow
    exit 1
}

Write-Host "DATABASE_URL is set" -ForegroundColor Green
Write-Host ""

# Function to apply migration
function Apply-Migration {
    param (
        [string]$FilePath
    )
    
    Write-Host "Applying: $FilePath" -ForegroundColor Yellow
    
    & psql $env:DATABASE_URL -f $FilePath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Success: $FilePath" -ForegroundColor Green
    } else {
        Write-Host "Failed: $FilePath" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
}

# Apply migrations in order
Write-Host "Starting migration process..." -ForegroundColor Cyan
Write-Host ""

# Migration 1: Initial schema (if fresh database)
$migration1 = "migrations\0000_stiff_archangel.sql"
if (Test-Path $migration1) {
    Apply-Migration -FilePath $migration1
}

# Migration 2: Phase 2 tables
$migration2 = "migrations\PHASE2_DATABASE_MIGRATION.sql"
if (Test-Path $migration2) {
    Apply-Migration -FilePath $migration2
}

# Migration 3: Soft delete column
$migration3 = "migrations\0001_add_is_delete_to_recruitment_candidates.sql"
if (Test-Path $migration3) {
    Apply-Migration -FilePath $migration3
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "All migrations applied successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Verification
Write-Host "Verifying database state..." -ForegroundColor Cyan
Write-Host ""

& psql $env:DATABASE_URL -c "\d recruitment_candidates" | Select-Object -First 20

Write-Host ""
Write-Host "Migration complete!" -ForegroundColor Green
