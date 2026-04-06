-- Migration: Consolidate vessel_planning rank_ids to new R00X format
-- This fixes the mismatch between Crew List and Planning views

-- Step 1: Create a mapping table for old to new rank IDs based on rank names
-- The mapping is determined by matching rank names to the new format

-- Step 2: Update old-format records (S*, numeric) to use new R00X format
-- based on matching the base rank name

-- Master: S1 -> R001
UPDATE vessel_planning 
SET rank_id = 'R001' 
WHERE rank_id = 'S1' AND rank LIKE 'Master%';

-- Chief Officer: S2 -> R002
UPDATE vessel_planning 
SET rank_id = 'R002' 
WHERE rank_id = 'S2' AND rank LIKE 'Chief Officer%';

-- 2nd Officer: numeric 4 or S3 -> R003
UPDATE vessel_planning 
SET rank_id = 'R003' 
WHERE rank_id IN ('4', 'S3') AND rank LIKE '2nd Officer%';

-- 3rd Officer: S4 -> R004 (including variants like 3rd Officer_1, 3rd Officer_2)
UPDATE vessel_planning 
SET rank_id = 'R004' 
WHERE rank_id = 'S4' AND rank LIKE '3rd Officer%';

-- Chief Engineer: S7 -> R005
UPDATE vessel_planning 
SET rank_id = 'R005' 
WHERE rank_id = 'S7' AND rank LIKE 'Chief Engineer%';

-- 2nd Engineer: S9 -> R006
UPDATE vessel_planning 
SET rank_id = 'R006' 
WHERE rank_id = 'S9' AND rank LIKE '2nd Engineer%';

-- 3rd Engineer: S10 -> R007
UPDATE vessel_planning 
SET rank_id = 'R007' 
WHERE rank_id = 'S10' AND rank LIKE '3rd Engineer%';

-- 4th Engineer: S16 -> R008
UPDATE vessel_planning 
SET rank_id = 'R008' 
WHERE rank_id = 'S16' AND rank LIKE '4th Engineer%';

-- Electrical Officer: S21 -> R010
UPDATE vessel_planning 
SET rank_id = 'R010' 
WHERE rank_id = 'S21' AND rank LIKE 'Electrical Officer%';

-- Bosun: S12 -> R014
UPDATE vessel_planning 
SET rank_id = 'R014' 
WHERE rank_id = 'S12' AND rank LIKE 'Bosun%';

-- AB: S14 -> R015 (including variants)
UPDATE vessel_planning 
SET rank_id = 'R015' 
WHERE rank_id = 'S14' AND rank LIKE 'AB%';

-- OS: S15 -> R016 (including variants)
UPDATE vessel_planning 
SET rank_id = 'R016' 
WHERE rank_id = 'S15' AND rank LIKE 'OS%';

-- Pumpman: S17 -> R017
UPDATE vessel_planning 
SET rank_id = 'R017' 
WHERE rank_id = 'S17' AND rank LIKE 'Pumpman%';

-- Fitter: S17 -> R018 (including variants)
UPDATE vessel_planning 
SET rank_id = 'R018' 
WHERE rank_id = 'S17' AND rank LIKE 'Fitter%';

-- Oiler: S18 -> R021 (including variants)
UPDATE vessel_planning 
SET rank_id = 'R021' 
WHERE rank_id = 'S18' AND rank LIKE 'Oiler%';

-- Chief Cook: S19 -> R022
UPDATE vessel_planning 
SET rank_id = 'R022' 
WHERE rank_id = 'S19' AND rank LIKE 'Chief Cook%';

-- Messman: S20 -> R023
UPDATE vessel_planning 
SET rank_id = 'R023' 
WHERE rank_id = 'S20' AND rank LIKE 'Messman%';

-- Step 3: Delete empty duplicate records that were created with R00X IDs
-- but have no crew assigned (these are duplicates of the now-updated records)
-- We keep records that have crew_member_id OR on_board_crew_id set

DELETE FROM vessel_planning 
WHERE rank_id LIKE 'R0%' 
  AND (crew_member_id IS NULL OR crew_member_id = '')
  AND (on_board_crew_id IS NULL OR on_board_crew_id = '')
  AND id IN (
    -- Only delete if there's another record for the same vessel+rank with actual data
    SELECT vp1.id 
    FROM vessel_planning vp1
    INNER JOIN vessel_planning vp2 ON vp1.vessel_id = vp2.vessel_id 
      AND vp1.rank = vp2.rank 
      AND vp1.id != vp2.id
    WHERE vp1.rank_id LIKE 'R0%'
      AND (vp1.crew_member_id IS NULL OR vp1.crew_member_id = '')
      AND (vp1.on_board_crew_id IS NULL OR vp1.on_board_crew_id = '')
      AND (vp2.crew_member_id IS NOT NULL AND vp2.crew_member_id != '')
  );

-- Step 4: Also clean up any remaining empty R00X base rank records 
-- where variant records (AB_1, OS_1 etc) exist with crew data
DELETE FROM vessel_planning 
WHERE rank_id LIKE 'R0%' 
  AND rank NOT LIKE '%\_%' -- base rank (no underscore suffix)
  AND (crew_member_id IS NULL OR crew_member_id = '')
  AND (on_board_crew_id IS NULL OR on_board_crew_id = '')
  AND EXISTS (
    -- Check if there are variant records with crew data for this base rank
    SELECT 1 FROM vessel_planning vp2 
    WHERE vp2.vessel_id = vessel_planning.vessel_id
      AND vp2.rank LIKE vessel_planning.rank || '\_%' -- variant of this base rank
      AND (vp2.crew_member_id IS NOT NULL AND vp2.crew_member_id != '')
  );
