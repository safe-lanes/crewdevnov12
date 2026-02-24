-- Migration 0097: Seed test crew members and vessel planning records
-- Date: 2026-02-24
-- Purpose: Populate crew database with test data for Vessel 3 and Vessel 5,
--          plus additional crew on other vessels and on-leave crew.
-- Source: Screenshots of expected crew lists provided by user.

-- Nationality UUID reference:
-- Filipino/Philippines: bb1b521a-60b0-11ec-a42e-507b9da1cbd6
-- Greek:     ba80a616-60b0-11ec-a42e-507b9da1cbd6
-- Polish:    bb1f5e51-60b0-11ec-a42e-507b9da1cbd6
-- Czech:     ba1e3a6c-60b0-11ec-a42e-507b9da1cbd6
-- Romanian:  bb2d1f36-60b0-11ec-a42e-507b9da1cbd6
-- Norwegian: bb0ba33d-60b0-11ec-a42e-507b9da1cbd6
-- Chinese:   ba12f05f-60b0-11ec-a42e-507b9da1cbd6
-- Ukrainian: bb792548-60b0-11ec-a42e-507b9da1cbd6
-- Indonesian:ba95a08f-60b0-11ec-a42e-507b9da1cbd6
-- Indian:    ba9cddf2-60b0-11ec-a42e-507b9da1cbd6
-- British:   ba68798b-60b0-11ec-a42e-507b9da1cbd6
-- Croatian:  ba9063eb-60b0-11ec-a42e-507b9da1cbd6

-- Vessel UUID reference:
-- Vessel 1: 743ef9d1-841a-11ed-aa7c-7003bca91a86
-- Vessel 2: 743feb08-841a-11ed-aa7c-7003bca91a86
-- Vessel 3: 7440571a-841a-11ed-aa7c-7003bca91a86
-- Vessel 5: 7446783c-841a-11ed-aa7c-7003bca91a86
-- Vessel 9: 744cf286-841a-11ed-aa7c-7003bca91a86

-- ============================================================
-- PART 1: Insert crew members
-- ============================================================

-- Vessel 3 crew (22 new + existing Jack Sparrow A0029)
INSERT INTO crew_members_v2 (crew_uuid, emp_no, first_name, family_name, dob, nationality_uuid, present_rank, status, is_active, is_deleted, is_sync, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'A00100', 'John',       'Fiddich',     '1981-03-03', 'bb1b521a-60b0-11ec-a42e-507b9da1cbd6', 'Master',              'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00102', 'Piotr',      'Nowak',       '1985-11-24', 'bb1f5e51-60b0-11ec-a42e-507b9da1cbd6', '2nd Officer',         'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00103', 'Wang2',      'Liu2',        '1984-03-04', 'ba1e3a6c-60b0-11ec-a42e-507b9da1cbd6', '3rd Officer',         'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00104', 'Pawel',      'Nowak',       '1996-03-08', 'bb1f5e51-60b0-11ec-a42e-507b9da1cbd6', '3rd Officer',         'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00105', 'Constantin', 'Popa',        '1974-10-06', 'bb2d1f36-60b0-11ec-a42e-507b9da1cbd6', 'Chief Engineer',      'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00106', 'Georgios',   'Dimitriou',   '1982-10-18', 'ba80a616-60b0-11ec-a42e-507b9da1cbd6', '2nd Engineer',        'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00107', 'Knut',       'Olsen',       '1991-12-01', 'bb0ba33d-60b0-11ec-a42e-507b9da1cbd6', '3rd Engineer',        'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00108', 'Zhang',      'Huang',       '1978-05-10', 'ba12f05f-60b0-11ec-a42e-507b9da1cbd6', '4th Engineer',        'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00109', 'Oleksandr',  'Bondarenko',  '1986-07-11', 'bb792548-60b0-11ec-a42e-507b9da1cbd6', 'Electrical Officer',  'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00110', 'Tomasz',     'Kowalski',    '1974-02-17', 'bb1f5e51-60b0-11ec-a42e-507b9da1cbd6', 'Bosun',               'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00111', 'Oleksandr',  'Bondarenko',  '1980-05-24', 'bb792548-60b0-11ec-a42e-507b9da1cbd6', 'AB',                  'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00112', 'Tomasz',     'Zielinski',   '1986-01-17', 'bb1f5e51-60b0-11ec-a42e-507b9da1cbd6', 'AB',                  'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00113', 'Pedro',      'Reyes',       '1987-06-25', 'bb1b521a-60b0-11ec-a42e-507b9da1cbd6', 'AB',                  'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00114', 'Agus',       'Gunawan',     '1987-04-18', 'ba95a08f-60b0-11ec-a42e-507b9da1cbd6', 'OS',                  'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00115', 'Marcin',     'Kowalski',    '1976-04-29', 'bb1f5e51-60b0-11ec-a42e-507b9da1cbd6', 'OS',                  'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00116', 'Vasile',     'Dumitrescu',  '1983-05-01', 'bb2d1f36-60b0-11ec-a42e-507b9da1cbd6', 'OS',                  'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00117', 'Lars',       'Andersen',    '1983-12-06', 'bb0ba33d-60b0-11ec-a42e-507b9da1cbd6', 'Fitter',              'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00118', 'Jose',       'Santos',      '1978-01-18', 'bb1b521a-60b0-11ec-a42e-507b9da1cbd6', 'Oiler',               'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00119', 'Zhang',      'Wu',          '1991-08-11', 'ba12f05f-60b0-11ec-a42e-507b9da1cbd6', 'Oiler',               'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00120', 'Li',         'Huang',       '1988-12-01', 'ba12f05f-60b0-11ec-a42e-507b9da1cbd6', 'Oiler',               'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00121', 'Tomasz',     'Nowak',       '1979-05-09', 'bb1f5e51-60b0-11ec-a42e-507b9da1cbd6', 'Chief Cook',          'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00122', 'Wei',        'Huang',       '1980-07-08', 'ba12f05f-60b0-11ec-a42e-507b9da1cbd6', 'Messman',             'On Board', true, false, false, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Vessel 5 crew (23 new)
INSERT INTO crew_members_v2 (crew_uuid, emp_no, first_name, family_name, dob, nationality_uuid, present_rank, status, is_active, is_deleted, is_sync, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'A00200', 'James',      'O''Brien',    '1978-08-23', 'ba9cddf2-60b0-11ec-a42e-507b9da1cbd6', 'Master',              'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00201', 'Wang',       'Zhao',        '1985-03-15', 'ba12f05f-60b0-11ec-a42e-507b9da1cbd6', 'Chief Officer',       'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00202', 'Robert',     'Anderson',    '1983-03-18', 'bb1b521a-60b0-11ec-a42e-507b9da1cbd6', '2nd Officer',         'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00203', 'Lars',       'Larsen',      '1989-05-20', 'bb0ba33d-60b0-11ec-a42e-507b9da1cbd6', '3rd Officer',         'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00204', 'Bjorn',      'Hansen',      '2000-08-05', 'bb0ba33d-60b0-11ec-a42e-507b9da1cbd6', '3rd Officer',         'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00205', 'Anna',       'Johnson',     '1981-03-31', 'ba68798b-60b0-11ec-a42e-507b9da1cbd6', 'Chief Engineer',      'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00206', 'Anil',       'Reddy',       '1988-09-23', 'ba9cddf2-60b0-11ec-a42e-507b9da1cbd6', '2nd Engineer',        'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00207', 'Wang',       'Liu',         '1979-01-18', 'ba12f05f-60b0-11ec-a42e-507b9da1cbd6', '3rd Engineer',        'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00208', 'Jose',       'Santos',      '1985-07-11', 'bb1b521a-60b0-11ec-a42e-507b9da1cbd6', '4th Engineer',        'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00209', 'Per',        'Andersen',    '1978-09-11', 'bb0ba33d-60b0-11ec-a42e-507b9da1cbd6', 'Electrical Officer',  'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00210', 'Adrian',     'Dumitrescu',  '1988-04-01', 'bb2d1f36-60b0-11ec-a42e-507b9da1cbd6', 'Bosun',               'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00211', 'Kumar',      'Nair',        '1973-07-08', 'ba9cddf2-60b0-11ec-a42e-507b9da1cbd6', 'AB',                  'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00212', 'Zhang',      'Liu',         '1988-02-04', 'ba12f05f-60b0-11ec-a42e-507b9da1cbd6', 'AB',                  'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00213', 'Jan',        'Kowalski',    '1981-06-20', 'bb1f5e51-60b0-11ec-a42e-507b9da1cbd6', 'AB',                  'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00214', 'Ivan',       'Petrenko',    '1991-08-08', 'bb792548-60b0-11ec-a42e-507b9da1cbd6', 'OS',                  'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00215', 'Andriy',     'Kovalenko',   '1984-04-27', 'bb792548-60b0-11ec-a42e-507b9da1cbd6', 'OS',                  'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00216', 'Piotr',      'Zielinski',   '1988-02-18', 'bb1f5e51-60b0-11ec-a42e-507b9da1cbd6', 'OS',                  'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00217', 'Kumar',      'Patel',       '1974-08-01', 'ba9cddf2-60b0-11ec-a42e-507b9da1cbd6', 'Fitter',              'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00218', 'Sergiy',     'Petrenko',    '1985-04-26', 'bb792548-60b0-11ec-a42e-507b9da1cbd6', 'Oiler',               'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00219', 'Pedro',      'Garcia',      '1990-01-17', 'bb1b521a-60b0-11ec-a42e-507b9da1cbd6', 'Oiler',               'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00220', 'Constantin', 'Dumitrescu',  '1982-03-05', 'bb2d1f36-60b0-11ec-a42e-507b9da1cbd6', 'Oiler',               'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00221', 'Rizky',      'Setiawan',    '1988-05-23', 'ba95a08f-60b0-11ec-a42e-507b9da1cbd6', 'Chief Cook',          'On Board', true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00222', 'Amit',       'Patel',       '1982-05-21', 'ba9cddf2-60b0-11ec-a42e-507b9da1cbd6', 'Messman',             'On Board', true, false, false, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Additional crew (other vessels + on leave)
INSERT INTO crew_members_v2 (crew_uuid, emp_no, first_name, family_name, dob, nationality_uuid, present_rank, status, is_active, is_deleted, is_sync, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'A00300', 'Gheorghe',   'Popescu',     '1973-01-17', 'bb2d1f36-60b0-11ec-a42e-507b9da1cbd6', 'Chief Officer',  'On Board',  true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00301', 'Wang',       'Chen',        '1987-07-20', 'ba12f05f-60b0-11ec-a42e-507b9da1cbd6', 'Chief Officer',  'On Board',  true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00302', 'Prasad',     'Menon',       '1980-06-15', 'bb1b521a-60b0-11ec-a42e-507b9da1cbd6', 'Master',         'On Board',  true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00303', 'Brandon',    'Taylor',      '1996-12-12', 'ba9063eb-60b0-11ec-a42e-507b9da1cbd6', '3rd Officer',    'On Leave',  true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00304', 'James',      'Wilson',      '1973-09-09', 'ba68798b-60b0-11ec-a42e-507b9da1cbd6', 'Master',         'On Leave',  true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00305', 'Robert',     'Anderson',    '1985-03-10', 'bb1b521a-60b0-11ec-a42e-507b9da1cbd6', 'Chief Officer',  'On Leave',  true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00306', 'Chisel',     'Anver',       '1979-05-20', 'ba9cddf2-60b0-11ec-a42e-507b9da1cbd6', 'Chief Engineer', 'On Leave',  true, false, false, NOW(), NOW()),
  (gen_random_uuid(), 'A00307', 'Panagiotis', 'Petrou',      '1980-09-16', 'ba80a616-60b0-11ec-a42e-507b9da1cbd6', '2nd Officer',    'On Leave',  true, false, false, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Update existing Jack Sparrow (A0029) with correct data
UPDATE crew_members_v2
SET present_rank = 'Chief Officer',
    status = 'On Board',
    nationality_uuid = 'ba80a616-60b0-11ec-a42e-507b9da1cbd6',
    dob = '1989-02-09',
    updated_at = NOW()
WHERE emp_no = 'A0029';

-- ============================================================
-- PART 2: Clean existing planning for Vessel 3 & 5
-- ============================================================
DELETE FROM vessel_planning_v2
WHERE vessel_uuid IN ('7440571a-841a-11ed-aa7c-7003bca91a86', '7446783c-841a-11ed-aa7c-7003bca91a86')
AND is_deleted = false;

-- ============================================================
-- PART 3: Vessel 3 planning records
-- ============================================================
INSERT INTO vessel_planning_v2 (plan_uuid, vessel_uuid, rank_id, rank, crew_uuid, crew_status, sign_on_date, relief_due, contract_period_months, is_archived, is_deleted, is_sync, created_at, updated_at)
SELECT gen_random_uuid(), '7440571a-841a-11ed-aa7c-7003bca91a86', v.rank_id, v.rank, c.crew_uuid, 'primary', v.sign_on, v.relief, v.contract_months, false, false, false, NOW(), NOW()
FROM (VALUES
  ('R001', 'Master',             'A00100', '2025-08-15', '2026-02-15', 6),
  ('R002', 'Chief Officer',      'A0029',  '2025-11-26', '2026-03-26', 4),
  ('R003', '2nd Officer',        'A00102', '2025-05-15', '2025-10-15', 5),
  ('R004', '3rd Officer',        'A00103', '2025-06-05', '2025-11-05', 5),
  ('R004', '3rd Officer',        'A00104', '2025-08-16', '2026-04-16', 8),
  ('R005', 'Chief Engineer',     'A00105', '2025-05-02', '2025-11-02', 6),
  ('R006', '2nd Engineer',       'A00106', '2025-04-15', '2025-12-15', 8),
  ('R007', '3rd Engineer',       'A00107', '2025-04-24', '2025-12-24', 8),
  ('R008', '4th Engineer',       'A00108', '2025-09-28', '2026-04-28', 7),
  ('R010', 'Electrical Officer', 'A00109', '2025-09-11', '2026-05-11', 8),
  ('R014', 'Bosun',              'A00110', '2025-06-05', '2026-03-05', 9),
  ('R015', 'AB',                 'A00111', '2025-07-31', '2026-03-31', 8),
  ('R015', 'AB',                 'A00112', '2025-07-09', '2026-02-09', 7),
  ('R015', 'AB',                 'A00113', '2025-05-08', '2026-02-08', 9),
  ('R016', 'OS',                 'A00114', '2025-08-22', '2026-05-22', 9),
  ('R016', 'OS',                 'A00115', '2025-09-29', '2026-03-29', 6),
  ('R016', 'OS',                 'A00116', '2025-05-22', '2026-01-22', 8),
  ('R018', 'Fitter',             'A00117', '2025-06-12', '2026-02-12', 8),
  ('R021', 'Oiler',              'A00118', '2025-04-15', '2025-11-15', 7),
  ('R021', 'Oiler',              'A00119', '2025-08-16', '2026-05-16', 9),
  ('R021', 'Oiler',              'A00120', '2025-07-01', '2026-01-01', 6),
  ('R022', 'Chief Cook',         'A00121', '2025-06-04', '2026-03-04', 9),
  ('R023', 'Messman',            'A00122', '2025-09-10', '2026-06-10', 9)
) AS v(rank_id, rank, emp, sign_on, relief, contract_months)
JOIN crew_members_v2 c ON c.emp_no = v.emp;

-- ============================================================
-- PART 4: Vessel 5 planning records
-- ============================================================
INSERT INTO vessel_planning_v2 (plan_uuid, vessel_uuid, rank_id, rank, crew_uuid, crew_status, sign_on_date, relief_due, contract_period_months, is_archived, is_deleted, is_sync, created_at, updated_at)
SELECT gen_random_uuid(), '7446783c-841a-11ed-aa7c-7003bca91a86', v.rank_id, v.rank, c.crew_uuid, 'primary', v.sign_on, v.relief, v.contract_months, false, false, false, NOW(), NOW()
FROM (VALUES
  ('R001', 'Master',             'A00200', '2025-11-26', '2026-02-26', 3),
  ('R002', 'Chief Officer',      'A00201', '2025-12-31', '2026-06-30', 6),
  ('R003', '2nd Officer',        'A00202', '2025-12-02', '2026-06-02', 6),
  ('R004', '3rd Officer',        'A00203', '2025-06-01', '2025-12-01', 6),
  ('R004', '3rd Officer',        'A00204', '2025-06-15', '2025-12-15', 6),
  ('R005', 'Chief Engineer',     'A00205', '2025-05-01', '2025-11-01', 6),
  ('R006', '2nd Engineer',       'A00206', '2025-06-01', '2026-02-01', 8),
  ('R007', '3rd Engineer',       'A00207', '2025-07-01', '2026-02-01', 7),
  ('R008', '4th Engineer',       'A00208', '2025-05-15', '2026-02-15', 9),
  ('R010', 'Electrical Officer', 'A00209', '2025-04-01', '2026-02-01', 10),
  ('R014', 'Bosun',              'A00210', '2025-03-01', '2025-12-01', 9),
  ('R015', 'AB',                 'A00211', '2025-04-01', '2026-02-01', 10),
  ('R015', 'AB',                 'A00212', '2025-05-01', '2026-02-01', 9),
  ('R015', 'AB',                 'A00213', '2025-06-01', '2026-02-01', 8),
  ('R016', 'OS',                 'A00214', '2025-03-15', '2025-12-15', 9),
  ('R016', 'OS',                 'A00215', '2025-03-01', '2025-12-01', 9),
  ('R016', 'OS',                 'A00216', '2025-04-15', '2026-01-15', 9),
  ('R018', 'Fitter',             'A00217', '2025-07-01', '2026-02-01', 7),
  ('R021', 'Oiler',              'A00218', '2025-04-01', '2026-02-01', 10),
  ('R021', 'Oiler',              'A00219', '2025-05-01', '2026-02-01', 9),
  ('R021', 'Oiler',              'A00220', '2025-08-01', '2026-04-01', 8),
  ('R022', 'Chief Cook',         'A00221', '2025-06-01', '2026-02-01', 8),
  ('R023', 'Messman',            'A00222', '2025-03-15', '2025-11-15', 8)
) AS v(rank_id, rank, emp, sign_on, relief, contract_months)
JOIN crew_members_v2 c ON c.emp_no = v.emp;

-- ============================================================
-- PART 5: Additional vessel assignments (Vessel 9, 1, 2)
-- ============================================================
INSERT INTO vessel_planning_v2 (plan_uuid, vessel_uuid, rank_id, rank, crew_uuid, crew_status, sign_on_date, relief_due, contract_period_months, is_archived, is_deleted, is_sync, created_at, updated_at)
SELECT gen_random_uuid(), v.vessel_uuid, v.rank_id, v.rank, c.crew_uuid, 'primary', v.sign_on, v.relief, v.contract_months, false, false, false, NOW(), NOW()
FROM (VALUES
  ('744cf286-841a-11ed-aa7c-7003bca91a86', 'R002', 'Chief Officer', 'A00300', '2025-09-15', '2026-02-27', 6),
  ('743ef9d1-841a-11ed-aa7c-7003bca91a86', 'R002', 'Chief Officer', 'A00301', '2025-12-31', '2026-06-30', 6),
  ('743feb08-841a-11ed-aa7c-7003bca91a86', 'R001', 'Master',        'A00302', '2025-10-30', '2026-04-30', 6)
) AS v(vessel_uuid, rank_id, rank, emp, sign_on, relief, contract_months)
JOIN crew_members_v2 c ON c.emp_no = v.emp;

-- ============================================================
-- Verification queries (for manual check)
-- ============================================================
-- SELECT COUNT(*) FROM crew_members_v2 WHERE is_deleted = false;  -- Expected: ~72
-- SELECT COUNT(*) FROM vessel_planning_v2 WHERE vessel_uuid = '7440571a-841a-11ed-aa7c-7003bca91a86' AND is_deleted = false;  -- Expected: 23 (Vessel 3)
-- SELECT COUNT(*) FROM vessel_planning_v2 WHERE vessel_uuid = '7446783c-841a-11ed-aa7c-7003bca91a86' AND is_deleted = false;  -- Expected: 23 (Vessel 5)
