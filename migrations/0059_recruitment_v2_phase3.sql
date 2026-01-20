-- ============================================================================
-- PHASE 3: SCREENING B1-B8 (29 Tables)
-- Migration for Recruitment V2 Phase 3
-- ============================================================================

-- ============================================================================
-- B1: GENERAL SCREENING (4 tables)
-- ============================================================================

-- TABLE 22: SCREENING GENERAL INFO (One-to-One)
CREATE TABLE IF NOT EXISTS screening_general_info (
    id SERIAL PRIMARY KEY,
    sgi_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT UNIQUE NOT NULL,
    availability_date TEXT,
    notice_period_days INTEGER,
    expected_salary_usd TEXT,
    contract_duration_preference TEXT,
    willing_to_relocate BOOLEAN,
    preferred_vessel_types TEXT,
    preferred_trading_areas TEXT,
    reason_for_leaving TEXT,
    career_objectives TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_sgi_rec_can_uuid ON screening_general_info(rec_can_uuid);

-- TABLE 23: SCREENING AVAILABILITY (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_availability (
    id SERIAL PRIMARY KEY,
    avail_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    available_from_date TEXT,
    available_to_date TEXT,
    availability_type TEXT,
    remarks TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_avail_rec_can_uuid ON screening_availability(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_avail_from_date ON screening_availability(available_from_date);

-- TABLE 24: SCREENING SALARY HISTORY (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_salary_history (
    id SERIAL PRIMARY KEY,
    sal_hist_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    employer_name TEXT,
    position TEXT,
    salary_amount_usd TEXT,
    currency TEXT,
    period_from TEXT,
    period_to TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_sal_hist_rec_can_uuid ON screening_salary_history(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_sal_hist_employer ON screening_salary_history(employer_name);

-- TABLE 25: SCREENING DOCUMENTS CHECKLIST (One-to-One)
CREATE TABLE IF NOT EXISTS screening_documents_checklist (
    id SERIAL PRIMARY KEY,
    doc_check_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT UNIQUE NOT NULL,
    passport_verified BOOLEAN DEFAULT FALSE,
    seaman_book_verified BOOLEAN DEFAULT FALSE,
    coc_verified BOOLEAN DEFAULT FALSE,
    stcw_verified BOOLEAN DEFAULT FALSE,
    medical_verified BOOLEAN DEFAULT FALSE,
    flag_endorsement_verified BOOLEAN DEFAULT FALSE,
    visa_verified BOOLEAN DEFAULT FALSE,
    checklist_completed_at TIMESTAMP,
    checklist_completed_by_uuid TEXT,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_doc_check_rec_can_uuid ON screening_documents_checklist(rec_can_uuid);

-- ============================================================================
-- B2: SKILLS ASSESSMENT (5 tables)
-- ============================================================================

-- TABLE 26: SCREENING TECHNICAL SKILLS (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_technical_skills (
    id SERIAL PRIMARY KEY,
    tech_skill_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    skill_category TEXT,
    skill_name TEXT,
    proficiency_level TEXT,
    years_experience INTEGER,
    last_used_date TEXT,
    certification_uuid TEXT,
    assessed_by_uuid TEXT,
    assessed_at TIMESTAMP,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_tech_skill_rec_can_uuid ON screening_technical_skills(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_tech_skill_category ON screening_technical_skills(skill_category);

-- TABLE 27: SCREENING COMPETENCY RATINGS (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_competency_ratings (
    id SERIAL PRIMARY KEY,
    comp_rating_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    competency_area TEXT,
    competency_name TEXT,
    rating INTEGER,
    rating_description TEXT,
    evidence_notes TEXT,
    rated_by_uuid TEXT,
    rated_at TIMESTAMP,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_comp_rating_rec_can_uuid ON screening_competency_ratings(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_comp_rating_area ON screening_competency_ratings(competency_area);

-- TABLE 28: SCREENING EQUIPMENT EXPERIENCE (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_equipment_experience (
    id SERIAL PRIMARY KEY,
    equip_exp_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    equipment_category TEXT,
    equipment_type TEXT,
    manufacturer TEXT,
    model TEXT,
    experience_level TEXT,
    years_experience INTEGER,
    last_used_date TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_equip_exp_rec_can_uuid ON screening_equipment_experience(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_equip_exp_category ON screening_equipment_experience(equipment_category);

-- TABLE 29: SCREENING LANGUAGE PROFICIENCY (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_language_proficiency (
    id SERIAL PRIMARY KEY,
    lang_prof_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    language_uuid TEXT,
    language_name TEXT,
    speaking_level TEXT,
    reading_level TEXT,
    writing_level TEXT,
    listening_level TEXT,
    test_name TEXT,
    test_score TEXT,
    test_date TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_lang_prof_rec_can_uuid ON screening_language_proficiency(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_lang_prof_language ON screening_language_proficiency(language_uuid);

-- TABLE 30: SCREENING PRACTICAL TESTS (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_practical_tests (
    id SERIAL PRIMARY KEY,
    pract_test_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    test_category TEXT,
    test_name TEXT,
    test_description TEXT,
    test_date TEXT,
    test_location TEXT,
    max_score INTEGER,
    achieved_score INTEGER,
    pass_score INTEGER,
    result TEXT,
    assessor_uuid TEXT,
    assessor_notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_pract_test_rec_can_uuid ON screening_practical_tests(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_pract_test_category ON screening_practical_tests(test_category);
CREATE INDEX IF NOT EXISTS idx_pract_test_result ON screening_practical_tests(result);

-- ============================================================================
-- B3: INTERVIEW ASSESSMENT (4 tables)
-- ============================================================================

-- TABLE 31: SCREENING INTERVIEWS (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_interviews (
    id SERIAL PRIMARY KEY,
    interview_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    interview_type TEXT,
    interview_stage TEXT,
    scheduled_date TEXT,
    scheduled_time TEXT,
    duration INTEGER,
    location TEXT,
    meeting_link TEXT,
    status TEXT,
    overall_rating INTEGER,
    recommendation TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_interview_rec_can_uuid ON screening_interviews(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_interview_status ON screening_interviews(status);
CREATE INDEX IF NOT EXISTS idx_interview_date ON screening_interviews(scheduled_date);

-- TABLE 32: SCREENING INTERVIEW PANELISTS (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_interview_panelists (
    id SERIAL PRIMARY KEY,
    panelist_uuid TEXT UNIQUE NOT NULL,
    interview_uuid TEXT NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    panelist_user_uuid TEXT,
    panelist_name TEXT,
    panelist_role TEXT,
    individual_rating INTEGER,
    feedback TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_panelist_interview_uuid ON screening_interview_panelists(interview_uuid);
CREATE INDEX IF NOT EXISTS idx_panelist_rec_can_uuid ON screening_interview_panelists(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_panelist_user ON screening_interview_panelists(panelist_user_uuid);

-- TABLE 33: SCREENING INTERVIEW QUESTIONS (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_interview_questions (
    id SERIAL PRIMARY KEY,
    int_quest_uuid TEXT UNIQUE NOT NULL,
    interview_uuid TEXT NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    question_category TEXT,
    question_text TEXT,
    expected_answer TEXT,
    candidate_response TEXT,
    rating INTEGER,
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_int_quest_interview_uuid ON screening_interview_questions(interview_uuid);
CREATE INDEX IF NOT EXISTS idx_int_quest_rec_can_uuid ON screening_interview_questions(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_int_quest_category ON screening_interview_questions(question_category);

-- TABLE 34: SCREENING INTERVIEW NOTES (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_interview_notes (
    id SERIAL PRIMARY KEY,
    int_note_uuid TEXT UNIQUE NOT NULL,
    interview_uuid TEXT NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    note_type TEXT,
    note_content TEXT,
    author_uuid TEXT,
    author_name TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_int_note_interview_uuid ON screening_interview_notes(interview_uuid);
CREATE INDEX IF NOT EXISTS idx_int_note_rec_can_uuid ON screening_interview_notes(rec_can_uuid);

-- ============================================================================
-- B4: REFERENCE CHECKS (4 tables)
-- ============================================================================

-- TABLE 35: SCREENING EMPLOYER REFERENCES (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_employer_references (
    id SERIAL PRIMARY KEY,
    emp_ref_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    company_name TEXT,
    contact_name TEXT,
    contact_position TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    relationship_to_candidate TEXT,
    employment_period_from TEXT,
    employment_period_to TEXT,
    position_held TEXT,
    reference_status TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_emp_ref_rec_can_uuid ON screening_employer_references(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_emp_ref_status ON screening_employer_references(reference_status);

-- TABLE 36: SCREENING REFERENCE RESPONSES (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_reference_responses (
    id SERIAL PRIMARY KEY,
    ref_resp_uuid TEXT UNIQUE NOT NULL,
    emp_ref_uuid TEXT NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    question_text TEXT,
    response_text TEXT,
    rating INTEGER,
    contacted_date TEXT,
    contacted_by_uuid TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_ref_resp_emp_ref_uuid ON screening_reference_responses(emp_ref_uuid);
CREATE INDEX IF NOT EXISTS idx_ref_resp_rec_can_uuid ON screening_reference_responses(rec_can_uuid);

-- TABLE 37: SCREENING PERSONAL REFERENCES (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_personal_references (
    id SERIAL PRIMARY KEY,
    pers_ref_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    reference_name TEXT,
    relationship TEXT,
    occupation TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    years_known INTEGER,
    reference_status TEXT,
    reference_notes TEXT,
    contacted_date TEXT,
    contacted_by_uuid TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_pers_ref_rec_can_uuid ON screening_personal_references(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_pers_ref_status ON screening_personal_references(reference_status);

-- TABLE 38: SCREENING SEA SERVICE VERIFICATION (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_sea_service_verification (
    id SERIAL PRIMARY KEY,
    ss_verif_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    sea_service_uuid TEXT,
    sea_service_type TEXT,
    verification_status TEXT,
    verified_by_uuid TEXT,
    verified_at TIMESTAMP,
    company_contact_name TEXT,
    company_contact_email TEXT,
    discrepancy_notes TEXT,
    verification_notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_ss_verif_rec_can_uuid ON screening_sea_service_verification(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_ss_verif_status ON screening_sea_service_verification(verification_status);

-- ============================================================================
-- B5: BACKGROUND VERIFICATION (4 tables)
-- ============================================================================

-- TABLE 39: SCREENING BACKGROUND CHECKS (One-to-One)
CREATE TABLE IF NOT EXISTS screening_background_checks (
    id SERIAL PRIMARY KEY,
    bg_check_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT UNIQUE NOT NULL,
    overall_status TEXT,
    initiated_date TEXT,
    completed_date TEXT,
    initiated_by_uuid TEXT,
    vendor_name TEXT,
    vendor_reference_number TEXT,
    expiry_date TEXT,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_bg_check_rec_can_uuid ON screening_background_checks(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_bg_check_status ON screening_background_checks(overall_status);

-- TABLE 40: SCREENING CRIMINAL RECORDS (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_criminal_records (
    id SERIAL PRIMARY KEY,
    crim_rec_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    country_uuid TEXT,
    country_name TEXT,
    check_type TEXT,
    check_date TEXT,
    result TEXT,
    record_details TEXT,
    certificate_number TEXT,
    issuing_authority TEXT,
    expiry_date TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_crim_rec_rec_can_uuid ON screening_criminal_records(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_crim_rec_country ON screening_criminal_records(country_uuid);
CREATE INDEX IF NOT EXISTS idx_crim_rec_result ON screening_criminal_records(result);

-- TABLE 41: SCREENING EMPLOYMENT VERIFICATION (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_employment_verification (
    id SERIAL PRIMARY KEY,
    emp_verif_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    employer_name TEXT,
    position_claimed TEXT,
    position_verified TEXT,
    period_claimed_from TEXT,
    period_claimed_to TEXT,
    period_verified_from TEXT,
    period_verified_to TEXT,
    salary_verified BOOLEAN,
    verification_status TEXT,
    verified_by_uuid TEXT,
    verified_at TIMESTAMP,
    discrepancy_notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_emp_verif_rec_can_uuid ON screening_employment_verification(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_emp_verif_status ON screening_employment_verification(verification_status);

-- TABLE 42: SCREENING EDUCATION VERIFICATION (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_education_verification (
    id SERIAL PRIMARY KEY,
    edu_verif_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    education_uuid TEXT,
    institution_name TEXT,
    degree_claimed TEXT,
    degree_verified TEXT,
    year_claimed_from TEXT,
    year_claimed_to TEXT,
    year_verified_from TEXT,
    year_verified_to TEXT,
    verification_status TEXT,
    verified_by_uuid TEXT,
    verified_at TIMESTAMP,
    discrepancy_notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_edu_verif_rec_can_uuid ON screening_education_verification(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_edu_verif_education ON screening_education_verification(education_uuid);
CREATE INDEX IF NOT EXISTS idx_edu_verif_status ON screening_education_verification(verification_status);

-- ============================================================================
-- B6: PSYCHOLOGICAL ASSESSMENT (3 tables)
-- ============================================================================

-- TABLE 43: SCREENING PSYCHOMETRIC TESTS (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_psychometric_tests (
    id SERIAL PRIMARY KEY,
    psych_test_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    test_name TEXT,
    test_type TEXT,
    test_provider TEXT,
    test_date TEXT,
    expiry_date TEXT,
    overall_score TEXT,
    percentile INTEGER,
    result TEXT,
    administered_by_uuid TEXT,
    remarks TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_psych_test_rec_can_uuid ON screening_psychometric_tests(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_psych_test_type ON screening_psychometric_tests(test_type);
CREATE INDEX IF NOT EXISTS idx_psych_test_result ON screening_psychometric_tests(result);

-- TABLE 44: SCREENING PSYCHOMETRIC DIMENSIONS (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_psychometric_dimensions (
    id SERIAL PRIMARY KEY,
    psych_dim_uuid TEXT UNIQUE NOT NULL,
    psych_test_uuid TEXT NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    dimension_name TEXT,
    dimension_score TEXT,
    percentile INTEGER,
    normal_range TEXT,
    interpretation TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_psych_dim_psych_test_uuid ON screening_psychometric_dimensions(psych_test_uuid);
CREATE INDEX IF NOT EXISTS idx_psych_dim_rec_can_uuid ON screening_psychometric_dimensions(rec_can_uuid);

-- TABLE 45: SCREENING BEHAVIORAL ASSESSMENTS (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_behavioral_assessments (
    id SERIAL PRIMARY KEY,
    beh_assess_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    assessment_type TEXT,
    assessment_date TEXT,
    assessor_uuid TEXT,
    assessor_name TEXT,
    primary_style TEXT,
    secondary_style TEXT,
    strengths_identified TEXT,
    areas_of_development TEXT,
    team_fit_score INTEGER,
    leadership_potential TEXT,
    overall_notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_beh_assess_rec_can_uuid ON screening_behavioral_assessments(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_beh_assess_type ON screening_behavioral_assessments(assessment_type);

-- ============================================================================
-- B7: MEDICAL SCREENING (3 tables)
-- ============================================================================

-- TABLE 46: SCREENING PEME (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_peme (
    id SERIAL PRIMARY KEY,
    peme_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    exam_date TEXT,
    clinic_name TEXT,
    clinic_location TEXT,
    exam_type TEXT,
    overall_result TEXT,
    restrictions TEXT,
    valid_until TEXT,
    examiner_name TEXT,
    examiner_license TEXT,
    certificate_number TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_peme_rec_can_uuid ON screening_peme(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_peme_result ON screening_peme(overall_result);
CREATE INDEX IF NOT EXISTS idx_peme_valid_until ON screening_peme(valid_until);

-- TABLE 47: SCREENING PEME RESULTS (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_peme_results (
    id SERIAL PRIMARY KEY,
    peme_result_uuid TEXT UNIQUE NOT NULL,
    peme_uuid TEXT NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    test_category TEXT,
    test_name TEXT,
    test_result TEXT,
    normal_range TEXT,
    status TEXT,
    remarks TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_peme_result_peme_uuid ON screening_peme_results(peme_uuid);
CREATE INDEX IF NOT EXISTS idx_peme_result_rec_can_uuid ON screening_peme_results(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_peme_result_status ON screening_peme_results(status);

-- TABLE 48: SCREENING DRUG ALCOHOL TESTS (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_drug_alcohol_tests (
    id SERIAL PRIMARY KEY,
    da_test_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    test_type TEXT,
    test_date TEXT,
    test_location TEXT,
    collector_name TEXT,
    specimen_type TEXT,
    chain_of_custody_number TEXT,
    laboratory_name TEXT,
    result TEXT,
    substances_tested_for TEXT,
    substances_detected TEXT,
    confirmed_by_mro BOOLEAN,
    mro_name TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_da_test_rec_can_uuid ON screening_drug_alcohol_tests(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_da_test_type ON screening_drug_alcohol_tests(test_type);
CREATE INDEX IF NOT EXISTS idx_da_test_result ON screening_drug_alcohol_tests(result);

-- ============================================================================
-- B8: FINAL EVALUATION (2 tables)
-- ============================================================================

-- TABLE 49: SCREENING FINAL EVALUATION (One-to-One)
CREATE TABLE IF NOT EXISTS screening_final_evaluation (
    id SERIAL PRIMARY KEY,
    final_eval_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT UNIQUE NOT NULL,
    evaluation_date TEXT,
    evaluator_uuid TEXT,
    evaluator_name TEXT,
    technical_score INTEGER,
    interview_score INTEGER,
    reference_score INTEGER,
    background_score INTEGER,
    medical_score INTEGER,
    overall_score INTEGER,
    overall_rating TEXT,
    hiring_recommendation TEXT,
    recommended_rank TEXT,
    recommended_vessel_type TEXT,
    start_date_recommended TEXT,
    salary_recommended TEXT,
    conditions_for_hire TEXT,
    evaluation_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_final_eval_rec_can_uuid ON screening_final_evaluation(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_final_eval_recommendation ON screening_final_evaluation(hiring_recommendation);
CREATE INDEX IF NOT EXISTS idx_final_eval_rating ON screening_final_evaluation(overall_rating);

-- TABLE 50: SCREENING EVALUATION APPROVALS (One-to-Many)
CREATE TABLE IF NOT EXISTS screening_evaluation_approvals (
    id SERIAL PRIMARY KEY,
    eval_approval_uuid TEXT UNIQUE NOT NULL,
    final_eval_uuid TEXT NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    approval_level INTEGER,
    approver_uuid TEXT,
    approver_name TEXT,
    approver_role TEXT,
    approval_status TEXT,
    approval_date TEXT,
    comments TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_eval_approval_final_eval_uuid ON screening_evaluation_approvals(final_eval_uuid);
CREATE INDEX IF NOT EXISTS idx_eval_approval_rec_can_uuid ON screening_evaluation_approvals(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_eval_approval_status ON screening_evaluation_approvals(approval_status);
