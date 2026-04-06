#!/bin/bash

# ============================================
# Apply All Database Migrations
# ============================================
# This script applies all migration files in order
# Safe to run multiple times (idempotent)

set -e  # Exit on error

echo "=========================================="
echo "Applying Database Migrations"
echo "=========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set DATABASE_URL before running this script:"
    echo "  export DATABASE_URL='postgresql://user:pass@host:port/database'"
    exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

# Function to apply migration
apply_migration() {
    local file=$1
    echo "📝 Applying: $file"
    psql "$DATABASE_URL" -f "$file"
    if [ $? -eq 0 ]; then
        echo "✅ Success: $file"
    else
        echo "❌ Failed: $file"
        exit 1
    fi
    echo ""
}

# Apply migrations in order
echo "Starting migration process..."
echo ""

# Migration 1: Initial schema (if fresh database)
if [ -f "migrations/0000_stiff_archangel.sql" ]; then
    apply_migration "migrations/0000_stiff_archangel.sql"
fi

# Migration 2: Phase 2 tables
if [ -f "migrations/PHASE2_DATABASE_MIGRATION.sql" ]; then
    apply_migration "migrations/PHASE2_DATABASE_MIGRATION.sql"
fi

# Migration 3: Soft delete column
if [ -f "migrations/0001_add_is_delete_to_recruitment_candidates.sql" ]; then
    apply_migration "migrations/0001_add_is_delete_to_recruitment_candidates.sql"
fi

echo "=========================================="
echo "✅ All migrations applied successfully!"
echo "=========================================="
echo ""

# Verification
echo "Verifying database state..."
echo ""

psql "$DATABASE_URL" -c "\d recruitment_candidates" | head -20

echo ""
echo "✅ Migration complete!"
