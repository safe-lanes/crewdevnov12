-- Training Master Seed Data
-- Inserts default training data from CSV (66 trainings)
-- Category codes: S=Statutory, N=Industry, M=Others
-- Group codes: A=Safety, B=Security, C=Cargo, D=Navigation, E=Engine, F=Environment, G=General

-- Create table if not exists
CREATE TABLE IF NOT EXISTS training_master (
  id SERIAL PRIMARY KEY,
  training_id TEXT NOT NULL UNIQUE,
  training_name TEXT NOT NULL,
  category TEXT NOT NULL,
  training_group TEXT NOT NULL,
  requirement_reference TEXT,
  applicable_to_company BOOLEAN DEFAULT false,
  training_label TEXT,
  sort_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false
);

-- Insert default training data
INSERT INTO training_master (training_id, training_name, category, training_group, requirement_reference, applicable_to_company, training_label, sort_order, is_default) VALUES
-- Statutory Safety (SA)
('SA001', 'Personal Survival Techniques (PST)', 'S', 'A', 'STCW A-VI/1-1', false, 'Personal Survival Techniques (PST)', 1, true),
('SA002', 'Fire Prevention and Fire Fighting (FPFF)', 'S', 'A', 'STCW A-VI/1-2', false, 'Fire Prevention and Fire Fighting (FPFF)', 2, true),
('SA003', 'Elementary First Aid (EFA)', 'S', 'A', 'STCW A-VI/1-3', false, 'Elementary First Aid (EFA)', 3, true),
('SA004', 'Personal Safety and Social Responsibilities (PSSR)', 'S', 'A', 'STCW A-VI/1-4', false, 'Personal Safety and Social Responsibilities (PSSR)', 4, true),
('SA005', 'Basic Safety Training', 'S', 'A', 'STCW A-VI/1-1 to 1-4', false, 'Basic Safety Training', 5, true),
('SA006', 'Advanced Fire Fighting (AFF)', 'S', 'A', 'STCW A-VI/3', false, 'Advanced Fire Fighting (AFF)', 6, true),
('SA007', 'Proficiency in Survival Craft & Rescue Boats (PSCRB)', 'S', 'A', 'STCW A-VI/2-1', false, 'Proficiency in Survival Craft & Rescue Boats (PSCRB)', 7, true),
('SA008', 'Proficiency in Fast Rescue Boats (PFRB)', 'S', 'A', 'STCW A-VI/2-2', false, 'Proficiency in Fast Rescue Boats (PFRB)', 8, true),
('SA009', 'Medical First Aid', 'S', 'A', 'STCW A-VI/4-1', false, 'Medical First Aid', 9, true),
('SA010', 'Medical Care', 'S', 'A', 'STCW A-VI/4-2', false, 'Medical Care', 10, true),
-- Statutory Security (SB)
('SB001', 'Security Awareness Training', 'S', 'B', 'STCW A-VI/6-1', false, 'Security Awareness Training', 1, true),
('SB002', 'Security Training for Seafarers with Designated Security Duties (STSDSD)', 'S', 'B', 'STCW A-VI/6-2', false, 'Security Training for Seafarers with Designated Security Duties (STSDSD)', 2, true),
('SB003', 'Ship Security Officer (SSO)', 'S', 'B', 'STCW A-VI/5', false, 'Ship Security Officer (SSO)', 3, true),
-- Statutory Cargo (SC)
('SC001', 'Basic Training for Oil & Chemical Tanker Cargo Operations', 'S', 'C', 'STCW V/1-1, Table A-V/1-1-1', false, 'Basic Training for Oil & Chemical Tanker Cargo Operations', 1, true),
('SC002', 'Basic Training for Liquefied Gas Tanker Cargo Operations', 'S', 'C', 'STCW V/1-2, Table A-V/1-2-1', false, 'Basic Training for Liquefied Gas Tanker Cargo Operations', 2, true),
('SC003', 'Advanced Training for Oil Tanker Cargo Operations', 'S', 'C', 'STCW V/1-1, Table A-V/1-1-2', false, 'Advanced Training for Oil Tanker Cargo Operations', 3, true),
('SC004', 'Advanced Training for Chemical Tanker Cargo Operations', 'S', 'C', 'STCW V/1-1, Table A-V/1-1-3', false, 'Advanced Training for Chemical Tanker Cargo Operations', 4, true),
('SC005', 'Advanced Training for Liquefied Gas Tanker Cargo Operations', 'S', 'C', 'STCW V/1-2, Table A-V/1-2-2', false, 'Advanced Training for Liquefied Gas Tanker Cargo Operations', 5, true),
('SC006', 'Liquid Cargo Handling Simulator', 'S', 'C', 'STCW Table A-II/2 Section A-V/1', false, 'Liquid Cargo Handling Simulator', 6, true),
('SC007', 'Ship''s Cook & Galley Training', 'S', 'C', 'MLC', false, 'Ship''s Cook & Galley Training', 7, true),
-- Statutory Navigation (SD)
('SD001', 'Electronic Chart Display & Information System (ECDIS) – Generic', 'S', 'D', 'IMO Model Course 1.27; STCW Ch II', false, 'Electronic Chart Display & Information System (ECDIS) – Generic', 1, true),
-- Statutory Engine (SE) - Note: SD002 in CSV is actually Engine category
('SD002', 'High Voltage (HV) Safety Training(Marine HV Systems >1000V)', 'S', 'E', 'STCW Table A-III/1 & A-III/2', false, 'High Voltage (HV) Safety Training(Marine HV Systems >1000V)', 1, true),
-- Industry Safety (NA)
('NA001', 'Safety Officer Training', 'N', 'A', 'ISM Code', false, 'Safety Officer Training', 1, true),
('NA002', 'Incident Investigation & Root Cause Analysis', 'N', 'A', 'OCIMF, TMSA', false, 'Incident Investigation & Root Cause Analysis', 2, true),
('NA003', 'Risk Assessment and Management', 'N', 'A', 'OCIMF, TMSA', false, 'Risk Assessment and Management', 3, true),
('NA004', 'Enclosed Space Entry', 'N', 'A', 'OCIMF', false, 'Enclosed Space Entry', 4, true),
('NA005', 'Gas Detection & Atmosphere Testing', 'N', 'A', NULL, false, 'Gas Detection & Atmosphere Testing', 5, true),
('NA006', 'Advanced Welding & Cutting', 'N', 'A', 'Class Approval', false, 'Advanced Welding & Cutting', 6, true),
-- Industry Security (NB)
('NB001', 'Cyber Security Awareness', 'N', 'B', 'IMO Resolution MSC.428(98)', false, 'Cyber Security Awareness', 1, true),
-- Industry Cargo (NC)
('NC001', 'Oil Tanker Cargo & Ballast Handling Simulator', 'N', 'C', 'IMO Model Course 2.06', false, 'Oil Tanker Cargo & Ballast Handling Simulator', 1, true),
('NC002', 'Chemical Tanker Cargo Handling Simulator', 'N', 'C', NULL, false, 'Chemical Tanker Cargo Handling Simulator', 2, true),
('NC003', 'LNG Tanker Cargo & Ballast Handling Simulator', 'N', 'C', 'IMO Model Course 1.36', false, 'LNG Tanker Cargo & Ballast Handling Simulator', 3, true),
('NC004', 'LPG Tanker Cargo & Ballast Handling Simulator', 'N', 'C', 'IMO Model Course 1.35', false, 'LPG Tanker Cargo & Ballast Handling Simulator', 4, true),
('NC005', 'Bulk Carrier Ballast & Stress Simulator', 'N', 'C', NULL, false, 'Bulk Carrier Ballast & Stress Simulator', 5, true),
('NC006', 'Container Ship Stability & Ballast Simulator', 'N', 'C', NULL, false, 'Container Ship Stability & Ballast Simulator', 6, true),
('NC007', 'General Cargo Ship Ballast & Stability Simulator', 'N', 'C', NULL, false, 'General Cargo Ship Ballast & Stability Simulator', 7, true),
('NC008', 'Ballast Water Management Simulator', 'N', 'C', NULL, false, 'Ballast Water Management Simulator', 8, true),
('NC009', 'Integrated Cargo & Ballast Emergency Simulator', 'N', 'C', NULL, false, 'Integrated Cargo & Ballast Emergency Simulator', 9, true),
('NC010', 'Ship-to-Ship (STS) Transfer Operations', 'N', 'C', 'OCIMF STS Transfer Guide', false, 'Ship-to-Ship (STS) Transfer Operations', 10, true),
('NC011', 'Emergency Shutdown (ESD) System Training', 'N', 'C', NULL, false, 'Emergency Shutdown (ESD) System Training', 11, true),
('NC012', 'Crude Oil Washing (COW) Operations', 'N', 'C', 'MARPOL Annex I and ISGOTT guidelines', false, 'Crude Oil Washing (COW) Operations', 12, true),
('NC013', 'Ballast Water Treatment System (BWTS) Training', 'N', 'C', 'IMO Ballast Water Management Convention', false, 'Ballast Water Treatment System (BWTS) Training', 13, true),
('NC014', 'Cranes & Cargo Gear Operator Training', 'N', 'C', 'ILO/OSHA guidance', false, 'Cranes & Cargo Gear Operator Training', 14, true),
-- Industry Navigation (ND)
('ND001', 'Bridge Resource Management (BRM)', 'N', 'D', 'IMO Model Course 1.22', false, 'Bridge Resource Management (BRM)', 1, true),
('ND002', 'Bridge Team Management (BTM)', 'N', 'D', 'IMO Model Course', false, 'Bridge Team Management (BTM)', 2, true),
('ND003', 'Ship Handling and Manoeuvring', 'N', 'D', 'IMO Model Course 1.22/1.23', false, 'Ship Handling and Manoeuvring', 3, true),
('ND004', 'Manned Model Ship-Handling Training (Advanced)', 'N', 'D', 'OCIMF', false, 'Manned Model Ship-Handling Training (Advanced)', 4, true),
('ND005', 'ECDIS Type-Specific Training', 'N', 'D', 'OCIMF', false, 'ECDIS Type-Specific Training', 5, true),
('ND006', 'COLREGS Refresher Training', 'N', 'D', NULL, false, 'COLREGS Refresher Training', 6, true),
('ND007', 'Radar/ ARPA Operational Simulator', 'N', 'D', NULL, false, 'Radar/ ARPA Operational Simulator', 7, true),
('ND008', 'Passage Planning', 'N', 'D', NULL, false, 'Passage Planning', 8, true),
('ND009', 'Large Vessel Ship Handling Training', 'N', 'D', 'OCIMF', false, 'Large Vessel Ship Handling Training', 9, true),
-- Industry Engine (NE)
('NE001', 'Engine Room Resource Management (ERM)', 'N', 'E', 'IMO Model Course 2.07', false, 'Engine Room Resource Management (ERM)', 1, true),
('NE002', 'Electronic Engine Control Systems (ME Engines) Familiarization', 'N', 'E', NULL, false, 'Electronic Engine Control Systems (ME Engines) Familiarization', 2, true),
('NE003', 'Automation & Alarm Management Simulator', 'N', 'E', NULL, false, 'Automation & Alarm Management Simulator', 3, true),
('NE004', 'Fuel Changeover & Emissions Compliance Ops', 'N', 'E', NULL, false, 'Fuel Changeover & Emissions Compliance Ops', 4, true),
-- Industry Environment (NF)
('NF001', 'Energy Efficiency & Emissions (EEXI/CII) Awareness', 'N', 'F', 'MARPOL Annex VI – SEEMP Part III (CII)', false, 'Energy Efficiency & Emissions (EEXI/CII) Awareness', 1, true),
('NF002', 'Volatile Organic Compounds (VOC) Management', 'N', 'F', NULL, false, 'Volatile Organic Compounds (VOC) Management', 2, true),
-- Industry General (NG)
('NG001', 'Leadership and Teamwork (Operational Level)', 'N', 'G', 'STCW Tables A-II/1, A-III/1, A-II/2, A-III/2', false, 'Leadership and Teamwork (Operational Level)', 1, true),
('NG002', 'Leadership & Managerial Skills (Management Level)', 'N', 'G', 'OCIMF', false, 'Leadership & Managerial Skills (Management Level)', 2, true),
('NG003', 'Vetting & SIRE Inspection Familiarisation', 'N', 'G', 'OCIMF', false, 'Vetting & SIRE Inspection Familiarisation', 3, true),
('NG004', 'Media Response & Crisis Communications', 'N', 'G', 'TMSA', false, 'Media Response & Crisis Communications', 4, true),
('NG005', 'Train-the-Trainer (Instructor Training)', 'N', 'G', 'IMO Model Course 6.09', false, 'Train-the-Trainer (Instructor Training)', 5, true),
('NG006', 'Planned Maintenance System (PMS) Familiarization', 'N', 'G', 'TMSA', false, 'Planned Maintenance System (PMS) Familiarization', 6, true),
('NG007', 'Safety Management System Familiarization', 'N', 'G', 'TMSA', false, 'Safety Management System Familiarization', 7, true),
('NG008', 'Human factors & Error Management', 'N', 'G', NULL, false, 'Human factors & Error Management', 8, true)
ON CONFLICT (training_id) DO NOTHING;
