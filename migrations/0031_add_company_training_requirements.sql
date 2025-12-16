-- Add company_training_requirements table for M/R status per training-rank combination
-- M = Mandatory, R = Recommended, null = not set

CREATE TABLE IF NOT EXISTS company_training_requirements (
    id SERIAL PRIMARY KEY,
    company_training_id INTEGER NOT NULL REFERENCES company_trainings(id) ON DELETE CASCADE,
    rank_id INTEGER NOT NULL REFERENCES available_ranks(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('M', 'R') OR status IS NULL)
);

-- Create index for efficient lookups by company training
CREATE INDEX IF NOT EXISTS idx_ctr_company_training_id ON company_training_requirements(company_training_id);

-- Create index for efficient lookups by rank
CREATE INDEX IF NOT EXISTS idx_ctr_rank_id ON company_training_requirements(rank_id);

-- Create unique constraint to prevent duplicate entries for the same training-rank pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_ctr_unique_training_rank ON company_training_requirements(company_training_id, rank_id);
