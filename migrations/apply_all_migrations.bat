@echo off
REM ============================================
REM Apply All Database Migrations (Windows Batch)
REM ============================================
REM This script applies all migration files in order
REM Safe to run multiple times (idempotent)

echo ==========================================
echo Applying Database Migrations
echo ==========================================
echo.

REM Check if DATABASE_URL is set
if "%DATABASE_URL%"=="" (
    echo ERROR: DATABASE_URL environment variable is not set
    echo Please set DATABASE_URL before running this script:
    echo   set DATABASE_URL=postgresql://user:pass@host:port/database
    exit /b 1
)

echo DATABASE_URL is set
echo.

echo Starting migration process...
echo.

REM Function to apply migration
REM Migration 1: Initial schema (if fresh database)
if exist "migrations\0000_stiff_archangel.sql" (
    echo Applying: migrations\0000_stiff_archangel.sql
    psql "%DATABASE_URL%" -f "migrations\0000_stiff_archangel.sql"
    if errorlevel 1 (
        echo Failed: migrations\0000_stiff_archangel.sql
        exit /b 1
    )
    echo Success: migrations\0000_stiff_archangel.sql
    echo.
)

REM Migration 2: Phase 2 tables
if exist "migrations\PHASE2_DATABASE_MIGRATION.sql" (
    echo Applying: migrations\PHASE2_DATABASE_MIGRATION.sql
    psql "%DATABASE_URL%" -f "migrations\PHASE2_DATABASE_MIGRATION.sql"
    if errorlevel 1 (
        echo Failed: migrations\PHASE2_DATABASE_MIGRATION.sql
        exit /b 1
    )
    echo Success: migrations\PHASE2_DATABASE_MIGRATION.sql
    echo.
)

REM Migration 3: Soft delete column
if exist "migrations\0001_add_is_delete_to_recruitment_candidates.sql" (
    echo Applying: migrations\0001_add_is_delete_to_recruitment_candidates.sql
    psql "%DATABASE_URL%" -f "migrations\0001_add_is_delete_to_recruitment_candidates.sql"
    if errorlevel 1 (
        echo Failed: migrations\0001_add_is_delete_to_recruitment_candidates.sql
        exit /b 1
    )
    echo Success: migrations\0001_add_is_delete_to_recruitment_candidates.sql
    echo.
)

echo ==========================================
echo All migrations applied successfully!
echo ==========================================
echo.

REM Verification
echo Verifying database state...
echo.

psql "%DATABASE_URL%" -c "\d recruitment_candidates"

echo.
echo Migration complete!
