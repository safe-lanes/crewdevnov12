-- Starter Pack Ranks Migration
-- This migration:
-- 1. Clears existing available_ranks and repopulates with standardized starter pack
-- 2. Uses new sequential Rank IDs (R001-R023)
-- 3. Sets isSystemRank=true for all starter pack ranks
-- 4. Creates/updates company_ranks with pre-set Officer/Rating flags based on STCW

-- First, clear existing available_ranks
DELETE FROM available_ranks;

-- Reset the sequence
ALTER SEQUENCE available_ranks_id_seq RESTART WITH 1;

-- Insert Starter Pack ranks with new sequential IDs
INSERT INTO available_ranks (name, category, rank_id, label, applicable_to_company, sort_order, is_system_rank) VALUES
-- Officers (Officer flag = true)
('Master', 'Senior Officers', 'R001', 'Master', true, 1, true),
('Chief Officer', 'Senior Officers', 'R002', 'Chief Officer', true, 2, true),
('Second Officer', 'Junior Officers', 'R003', 'Second Officer', true, 3, true),
('Third Officer', 'Junior Officers', 'R004', 'Third Officer', true, 4, true),
('Chief Engineer', 'Senior Officers', 'R005', 'Chief Engineer', true, 5, true),
('Second Engineer', 'Junior Officers', 'R006', 'Second Engineer', true, 6, true),
('Third Engineer', 'Junior Officers', 'R007', 'Third Engineer', true, 7, true),
('Fourth Engineer', 'Junior Officers', 'R008', 'Fourth Engineer', true, 8, true),
('Fifth Engineer', 'Junior Officers', 'R009', 'Fifth Engineer', true, 9, true),
('Electrical Officer', 'Junior Officers', 'R010', 'Electrical Officer', true, 10, true),
('Gas Engineer', 'Junior Officers', 'R011', 'Gas Engineer', true, 11, true),
-- Cadets (neither Officer nor Rating pre-set)
('Deck Cadet', 'Cadets', 'R012', 'Deck Cadet', true, 12, true),
('Engine Cadet', 'Cadets', 'R013', 'Engine Cadet', true, 13, true),
-- Ratings (Rating flag = true)
('Bosun', 'Ratings', 'R014', 'Bosun', true, 14, true),
('Able Bodied Seaman', 'Ratings', 'R015', 'Able Bodied Seaman', true, 15, true),
('Ordinary Seaman', 'Ratings', 'R016', 'Ordinary Seaman', true, 16, true),
('Pumpman', 'Ratings', 'R017', 'Pumpman', true, 17, true),
('Fitter', 'Ratings', 'R018', 'Fitter', true, 18, true),
('Motorman', 'Ratings', 'R019', 'Motorman', true, 19, true),
('Wiper', 'Ratings', 'R020', 'Wiper', true, 20, true),
('Oiler', 'Ratings', 'R021', 'Oiler', true, 21, true),
('Chief Cook', 'Catering', 'R022', 'Chief Cook', true, 22, true),
('Messman', 'Catering', 'R023', 'Messman', true, 23, true);

-- Clear existing company_ranks and recreate with proper flags
-- Note: company_ranks uses TEXT id (not serial), so no sequence reset needed
DELETE FROM company_ranks;

-- Insert company_ranks for each starter pack rank with STCW-based flags
-- Based on user's reference (Image 2):
-- Officers: Master, Chief Officer, Second Officer, Third Officer, Chief Engineer, 
--           Second Engineer, Third Engineer, Fourth Engineer, Electrical Officer, Gas Engineer
-- Fifth Engineer is NOT marked as Officer (user's explicit preference - ambiguous per STCW)
-- Cadets are neither Officer nor Rating (company-specific decision)

INSERT INTO company_ranks (id, rank, rank_id, officer, rating, senior_officer, deck_officer, eng_officer, petty_officer, deck_rating, engine_rating, general_rating, catering_rating, safety_officer, sso, medical_officer, navigating_officer, emt_officer) VALUES
-- Senior Officers (officer=true, senior_officer=true)
('1', 'Master', 'R001', true, false, true, true, false, false, false, false, false, false, true, true, false, true, false),
('2', 'Chief Officer', 'R002', true, false, true, true, false, false, false, false, false, false, true, false, false, true, false),
('5', 'Chief Engineer', 'R005', true, false, true, false, true, false, false, false, false, false, true, false, false, false, false),
-- Junior Deck Officers (officer=true, deck_officer=true)
('3', 'Second Officer', 'R003', true, false, false, true, false, false, false, false, false, false, false, false, false, true, false),
('4', 'Third Officer', 'R004', true, false, false, true, false, false, false, false, false, false, false, false, false, true, false),
-- Junior Engine Officers (officer=true, eng_officer=true)
('6', 'Second Engineer', 'R006', true, false, false, false, true, false, false, false, false, false, false, false, false, false, false),
('7', 'Third Engineer', 'R007', true, false, false, false, true, false, false, false, false, false, false, false, false, false, false),
('8', 'Fourth Engineer', 'R008', true, false, false, false, true, false, false, false, false, false, false, false, false, false, false),
-- Fifth Engineer (officer NOT checked per user's explicit preference - company specific)
('9', 'Fifth Engineer', 'R009', false, false, false, false, false, false, false, false, false, false, false, false, false, false, false),
-- Electrical Officer (officer=true, eng_officer=true - corrected per user's feedback)
('10', 'Electrical Officer', 'R010', true, false, false, false, true, false, false, false, false, false, false, false, false, false, false),
-- Gas Engineer (officer=true, eng_officer=true)
('11', 'Gas Engineer', 'R011', true, false, false, false, true, false, false, false, false, false, false, false, false, false, false),
-- Cadets (neither officer nor rating - company specific)
('12', 'Deck Cadet', 'R012', false, false, false, false, false, false, false, false, false, false, false, false, false, false, false),
('13', 'Engine Cadet', 'R013', false, false, false, false, false, false, false, false, false, false, false, false, false, false, false),
-- Ratings (rating=true)
-- Bosun - deck_rating (not petty_officer by default - company specific)
('14', 'Bosun', 'R014', false, true, false, false, false, false, true, false, false, false, false, false, false, false, false),
('15', 'Able Bodied Seaman', 'R015', false, true, false, false, false, false, true, false, false, false, false, false, false, false, false),
('16', 'Ordinary Seaman', 'R016', false, true, false, false, false, false, true, false, false, false, false, false, false, false, false),
-- Engine ratings
('17', 'Pumpman', 'R017', false, true, false, false, false, false, false, true, false, false, false, false, false, false, false),
('18', 'Fitter', 'R018', false, true, false, false, false, false, false, true, false, false, false, false, false, false, false),
('19', 'Motorman', 'R019', false, true, false, false, false, false, false, true, false, false, false, false, false, false, false),
('20', 'Wiper', 'R020', false, true, false, false, false, false, false, true, false, false, false, false, false, false, false),
('21', 'Oiler', 'R021', false, true, false, false, false, false, false, true, false, false, false, false, false, false, false),
-- Catering ratings
('22', 'Chief Cook', 'R022', false, true, false, false, false, false, false, false, false, true, false, false, false, false, false),
('23', 'Messman', 'R023', false, true, false, false, false, false, false, false, false, true, false, false, false, false, false);
