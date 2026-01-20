-- Phase 4: Approvals & Decisions (6 tables)
-- Migration for Recruitment V2 module

-- TABLE 51: HIRING DECISIONS
CREATE TABLE IF NOT EXISTS hiring_decisions (
    id SERIAL PRIMARY KEY,
    decision_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT UNIQUE NOT NULL,
    final_eval_uuid TEXT,
    decision_type TEXT,
    decision_date TEXT,
    decided_by_uuid TEXT,
    decided_by_name TEXT,
    decision_reason TEXT,
    approved_rank TEXT,
    approved_vessel_type TEXT,
    approved_salary TEXT,
    proposed_joining_date TEXT,
    probation_period_months INTEGER,
    special_conditions TEXT,
    rejection_reason TEXT,
    hold_until_date TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_hiring_decision_rec_can_uuid ON hiring_decisions(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_hiring_decision_type ON hiring_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_hiring_decision_date ON hiring_decisions(decision_date);

-- TABLE 52: OFFER LETTERS
CREATE TABLE IF NOT EXISTS offer_letters (
    id SERIAL PRIMARY KEY,
    offer_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    decision_uuid TEXT,
    offer_number TEXT,
    offer_date TEXT,
    offer_expiry_date TEXT,
    offered_rank TEXT,
    offered_vessel_type TEXT,
    offered_vessel_name TEXT,
    offered_salary_usd TEXT,
    contract_duration_months INTEGER,
    joining_date TEXT,
    joining_port TEXT,
    benefits TEXT,
    terms_and_conditions TEXT,
    offer_status TEXT,
    sent_date TEXT,
    response_date TEXT,
    decline_reason TEXT,
    offer_letter_path TEXT,
    signed_offer_path TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_offer_rec_can_uuid ON offer_letters(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_offer_decision_uuid ON offer_letters(decision_uuid);
CREATE INDEX IF NOT EXISTS idx_offer_status ON offer_letters(offer_status);
CREATE INDEX IF NOT EXISTS idx_offer_number ON offer_letters(offer_number);

-- TABLE 53: EMPLOYMENT CONTRACTS
CREATE TABLE IF NOT EXISTS employment_contracts (
    id SERIAL PRIMARY KEY,
    contract_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    offer_uuid TEXT,
    contract_number TEXT,
    contract_type TEXT,
    contract_start_date TEXT,
    contract_end_date TEXT,
    contracted_rank TEXT,
    contracted_vessel_type TEXT,
    basic_salary_usd TEXT,
    allowances TEXT,
    total_package_usd TEXT,
    leave_entitlement_days INTEGER,
    medical_coverage TEXT,
    insurance_coverage TEXT,
    notice_period_days INTEGER,
    contract_status TEXT,
    signed_by_candidate BOOLEAN DEFAULT FALSE,
    candidate_signature_date TEXT,
    signed_by_company BOOLEAN DEFAULT FALSE,
    company_signer_uuid TEXT,
    company_signature_date TEXT,
    contract_document_path TEXT,
    signed_contract_path TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_contract_rec_can_uuid ON employment_contracts(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_contract_offer_uuid ON employment_contracts(offer_uuid);
CREATE INDEX IF NOT EXISTS idx_contract_status ON employment_contracts(contract_status);
CREATE INDEX IF NOT EXISTS idx_contract_number ON employment_contracts(contract_number);

-- TABLE 54: ONBOARDING TASKS
CREATE TABLE IF NOT EXISTS onboarding_tasks (
    id SERIAL PRIMARY KEY,
    task_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    contract_uuid TEXT,
    task_category TEXT,
    task_name TEXT,
    task_description TEXT,
    assigned_to_uuid TEXT,
    assigned_to_name TEXT,
    due_date TEXT,
    priority TEXT,
    task_status TEXT,
    completed_date TEXT,
    completed_by_uuid TEXT,
    completed_by_name TEXT,
    notes TEXT,
    attachment_path TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_onboard_task_rec_can_uuid ON onboarding_tasks(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_onboard_task_contract_uuid ON onboarding_tasks(contract_uuid);
CREATE INDEX IF NOT EXISTS idx_onboard_task_status ON onboarding_tasks(task_status);
CREATE INDEX IF NOT EXISTS idx_onboard_task_category ON onboarding_tasks(task_category);

-- TABLE 55: DECISION AUDIT TRAIL
CREATE TABLE IF NOT EXISTS decision_audit_trail (
    id SERIAL PRIMARY KEY,
    audit_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    entity_type TEXT,
    entity_uuid TEXT,
    action_type TEXT,
    previous_value TEXT,
    new_value TEXT,
    field_changed TEXT,
    action_by_uuid TEXT,
    action_by_name TEXT,
    action_date TEXT,
    ip_address TEXT,
    user_agent TEXT,
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_rec_can_uuid ON decision_audit_trail(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity ON decision_audit_trail(entity_type, entity_uuid);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action_type ON decision_audit_trail(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_trail_date ON decision_audit_trail(action_date);

-- TABLE 56: APPROVAL WORKFLOWS
CREATE TABLE IF NOT EXISTS approval_workflows (
    id SERIAL PRIMARY KEY,
    workflow_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    entity_type TEXT,
    entity_uuid TEXT,
    workflow_name TEXT,
    current_step INTEGER DEFAULT 1,
    total_steps INTEGER,
    step_name TEXT,
    approver_uuid TEXT,
    approver_name TEXT,
    approver_role TEXT,
    approval_required BOOLEAN DEFAULT TRUE,
    approval_status TEXT,
    approval_date TEXT,
    delegated_to_uuid TEXT,
    delegated_to_name TEXT,
    escalation_date TEXT,
    comments TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_workflow_rec_can_uuid ON approval_workflows(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_workflow_entity ON approval_workflows(entity_type, entity_uuid);
CREATE INDEX IF NOT EXISTS idx_workflow_status ON approval_workflows(approval_status);
CREATE INDEX IF NOT EXISTS idx_workflow_approver ON approval_workflows(approver_uuid);
