-- Migration to sync vessel_revisions actualManningFlag based on actual crew assignments
-- This restores the Actual Manning checkboxes based on which ranks have crew assigned

-- Create a temporary function to update revision data
DO $$
DECLARE
    rec RECORD;
    updated_data JSONB;
    rank_item JSONB;
    rank_name TEXT;
    curr_vessel_id TEXT;
    has_crew BOOLEAN;
    crew_ranks TEXT[];
BEGIN
    -- Process each vessel revision
    FOR rec IN SELECT vr.id, vr.vessel_id, vr.revision_data FROM vessel_revisions vr
    LOOP
        curr_vessel_id := rec.vessel_id;
        
        -- Get distinct base ranks for this vessel from crew_members
        SELECT ARRAY_AGG(DISTINCT base_rank) INTO crew_ranks
        FROM (
            SELECT REGEXP_REPLACE(cm.present_rank, '_[0-9]+$', '') as base_rank
            FROM crew_members cm
            WHERE cm.present_vessel = curr_vessel_id
              AND cm.present_rank IS NOT NULL
        ) sub;
        
        -- If no crew, skip
        IF crew_ranks IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Parse and update the revision_data JSON
        updated_data := '[]'::JSONB;
        
        FOR rank_item IN SELECT * FROM jsonb_array_elements(rec.revision_data::JSONB)
        LOOP
            rank_name := rank_item->>'rank';
            
            -- Check if this rank has crew (with fuzzy matching for abbreviations)
            has_crew := FALSE;
            
            -- Direct match
            IF rank_name = ANY(crew_ranks) THEN
                has_crew := TRUE;
            -- Handle abbreviations: AB = Able Bodied Seaman
            ELSIF rank_name = 'Able Bodied Seaman' AND 'AB' = ANY(crew_ranks) THEN
                has_crew := TRUE;
            ELSIF rank_name = 'AB' AND 'Able Bodied Seaman' = ANY(crew_ranks) THEN
                has_crew := TRUE;
            -- Handle abbreviations: OS = Ordinary Seaman
            ELSIF rank_name = 'Ordinary Seaman' AND 'OS' = ANY(crew_ranks) THEN
                has_crew := TRUE;
            ELSIF rank_name = 'OS' AND 'Ordinary Seaman' = ANY(crew_ranks) THEN
                has_crew := TRUE;
            -- Handle 2nd/3rd Officer variations
            ELSIF rank_name = 'Second Officer' AND '2nd Officer' = ANY(crew_ranks) THEN
                has_crew := TRUE;
            ELSIF rank_name = '2nd Officer' AND 'Second Officer' = ANY(crew_ranks) THEN
                has_crew := TRUE;
            ELSIF rank_name = 'Third Officer' AND '3rd Officer' = ANY(crew_ranks) THEN
                has_crew := TRUE;
            ELSIF rank_name = '3rd Officer' AND 'Third Officer' = ANY(crew_ranks) THEN
                has_crew := TRUE;
            -- Handle 2nd/3rd/4th Engineer variations  
            ELSIF rank_name = 'Second Engineer' AND '2nd Engineer' = ANY(crew_ranks) THEN
                has_crew := TRUE;
            ELSIF rank_name = '2nd Engineer' AND 'Second Engineer' = ANY(crew_ranks) THEN
                has_crew := TRUE;
            ELSIF rank_name = 'Third Engineer' AND '3rd Engineer' = ANY(crew_ranks) THEN
                has_crew := TRUE;
            ELSIF rank_name = '3rd Engineer' AND 'Third Engineer' = ANY(crew_ranks) THEN
                has_crew := TRUE;
            ELSIF rank_name = 'Fourth Engineer' AND '4th Engineer' = ANY(crew_ranks) THEN
                has_crew := TRUE;
            ELSIF rank_name = '4th Engineer' AND 'Fourth Engineer' = ANY(crew_ranks) THEN
                has_crew := TRUE;
            END IF;
            
            -- Update the actualManningFlag in the rank item
            rank_item := jsonb_set(rank_item, '{actualManningFlag}', to_jsonb(has_crew));
            
            -- Append to updated data
            updated_data := updated_data || rank_item;
        END LOOP;
        
        -- Update the vessel revision with the new data
        UPDATE vessel_revisions 
        SET revision_data = updated_data::TEXT
        WHERE vessel_revisions.id = rec.id;
        
        RAISE NOTICE 'Updated vessel revision % for vessel % with crew ranks: %', rec.id, curr_vessel_id, crew_ranks;
    END LOOP;
END $$;
