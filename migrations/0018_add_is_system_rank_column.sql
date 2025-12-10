-- Add is_system_rank column to available_ranks table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'available_ranks' AND column_name = 'is_system_rank'
    ) THEN
        ALTER TABLE available_ranks ADD COLUMN is_system_rank boolean DEFAULT false;
    END IF;
END $$;
