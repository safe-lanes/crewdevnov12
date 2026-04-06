-- Migration: Add oil_major_rules table for compliance engine
-- This table stores compliance rules for oil majors (BP, Shell, Chevron, etc.)

CREATE TABLE IF NOT EXISTS oil_major_rules (
    id SERIAL PRIMARY KEY,
    oil_major_name VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    rules JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups by oil major name
CREATE INDEX IF NOT EXISTS idx_oil_major_rules_name ON oil_major_rules(oil_major_name);

-- Create index for active rules
CREATE INDEX IF NOT EXISTS idx_oil_major_rules_active ON oil_major_rules(is_active) WHERE is_active = true;
