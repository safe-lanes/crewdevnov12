-- Migration: Add company_trainings table with unique constraint on training_master_id
-- This table stores company-specific training data that is auto-synced from Training Master

CREATE TABLE IF NOT EXISTS "company_trainings" (
  "id" serial PRIMARY KEY NOT NULL,
  "training_master_id" integer NOT NULL UNIQUE,
  "company_id" text NOT NULL,
  "training_label" text NOT NULL,
  "abr" text,
  "requirement" text,
  "sort_order" integer DEFAULT 0,
  CONSTRAINT "company_trainings_training_master_id_training_master_id_fk" FOREIGN KEY ("training_master_id") REFERENCES "training_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- Add unique index for training_master_id to prevent duplicate company training records
CREATE UNIQUE INDEX IF NOT EXISTS "company_trainings_training_master_id_idx" ON "company_trainings" ("training_master_id");
