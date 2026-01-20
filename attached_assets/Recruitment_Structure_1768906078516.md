# Database Entity-Relationship Diagrams

## Diagram 1: Crew Management System

```mermaid
---
config:
  layout: elk
---
erDiagram
    master_nationalities {
        text nat_uuid PK
        text name
        text code
    }

    master_countries {
        text country_uuid PK
        text name
        text code
    }

    master_vessel_types {
        text vt_uuid PK
        text name
    }

    master_vessels {
        text vessel_uuid PK
        text name
        text vessel_type
    }

    master_ports {
        text port_uuid PK
        text name
        text country
    }

    master_users {
        text user_uuid PK
        text name
        text position
    }

    master_languages {
        text lang_uuid PK
        text name
    }

    master_fleet_groups {
        text fg_uuid PK
        text name
    }

    master_additional_groups {
        text ag_uuid PK
        text name
    }

    recruitment_candidates {
        serial id PK
        text rec_can_uuid UK
        text file_no UK
        text first_name
        text middle_name
        text family_name
        text gender
        text dob
        text nationality_uuid FK "master_nationalities"
        text present_rank
        text rank_applied_for
        text status
        text uploaded_photo
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_vessel_types_applied {
        serial id PK
        text cvta_uuid UK
        text rec_can_uuid FK
        text vessel_type_uuid FK "master_vessel_types"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }
    
    cand_personal_details {
        serial id PK
        text cpd_uuid UK
        text rec_can_uuid FK
        text height_cm
        text weight_kg
        text place_of_birth_city
        text place_of_birth_country_uuid FK "master_countries"
        text age_in_years
        text native_language_uuid FK "master_languages"
        text foreign_languages
        text english_proficiency
        text manning_agent
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_addresses {
        serial id PK
        text addr_uuid UK
        text rec_can_uuid FK
        text country_of_residence_uuid FK "master_countries"
        text nearest_airport
        text address_line1
        text address_line2
        text contact_landline
        text mobile
        text email
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_family_info {
        serial id PK
        text fam_uuid UK
        text rec_can_uuid FK
        text marital_status
        text num_dependent_children
        text father_name
        text mother_name
        text spouse_first_name
        text spouse_middle_name
        text spouse_family_name
        text spouse_dob
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_children {
        serial id PK
        text child_uuid UK
        text rec_can_uuid FK
        text first_name
        text middle_name
        text family_name
        text dob
        text gender
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_next_of_kin {
        serial id PK
        text nok_uuid UK
        text rec_can_uuid FK
        text first_name
        text middle_name
        text family_name
        text telephone
        text email
        text address
        text relationship
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_documents {
        serial id PK
        text doc_uuid UK
        text rec_can_uuid FK
        text document_id
        text document_name
        text number
        text issued
        text expiry
        text issuing_authority
        text issuing_country_uuid FK "master_countries"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_documents_attachments {
        serial id PK
        text att_uuid UK
        text doc_uuid FK
        text file_name
        text file_type
        text file_size
        text file_path
        text file_data
        text uploaded_by_uuid FK "master_users"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_visas {
        serial id PK
        text visa_uuid UK
        text rec_can_uuid FK
        text country_uuid FK "master_countries"
        text serial_no
        text issued
        text expiry
        text visa_type
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_visas_attachments {
        serial id PK
        text att_uuid UK
        text visa_uuid FK
        text file_name
        text file_type
        text file_size
        text file_path
        text file_data
        text uploaded_by_uuid FK "master_users"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_education {
        serial id PK
        text edu_uuid UK
        text rec_can_uuid FK
        text date_of_completion
        text institution
        text subjects_field
        text qualifications
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_education_attachments {
        serial id PK
        text att_uuid UK
        text edu_uuid FK
        text file_name
        text file_type
        text file_size
        text file_path
        text file_data
        text uploaded_by_uuid FK "master_users"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_licenses {
        serial id PK
        text lic_uuid UK
        text rec_can_uuid FK
        text license_id
        text certificate_document
        text abbr
        text requirement
        text certificate_no
        text issuing_authority
        text issuing_country_uuid FK "master_countries"
        text issued
        text expiry
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_licenses_attachments {
        serial id PK
        text att_uuid UK
        text lic_uuid FK
        text file_name
        text file_type
        text file_size
        text file_path
        text file_data
        text uploaded_by_uuid FK "master_users"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_training_courses {
        serial id PK
        text train_uuid UK
        text rec_can_uuid FK
        text course_id
        text training_course
        text abbr
        text requirement
        text certificate_no
        text issuing_authority
        text issuing_country_uuid FK "master_countries"
        text issued
        text expiry
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_training_attachments {
        serial id PK
        text att_uuid UK
        text train_uuid FK
        text file_name
        text file_type
        text file_size
        text file_path
        text file_data
        text uploaded_by_uuid FK "master_users"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_sea_service {
        serial id PK
        text sea_uuid UK
        text rec_can_uuid FK
        text vessel_name
        text vessel_uuid FK "master_vessels"
        text vessel_type_uuid FK "master_vessel_types"
        text deadweight
        text engine_type_power
        text owner_operator
        text rank
        text from_date
        text to_date
        text period_months
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_sea_service_attachments {
        serial id PK
        text att_uuid UK
        text sea_uuid FK
        text file_name
        text file_type
        text file_size
        text file_path
        text file_data
        text uploaded_by_uuid FK "master_users"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_additional_info {
        serial id PK
        text info_uuid UK
        text rec_can_uuid FK
        text information
        text response
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_additional_info_attachments {
        serial id PK
        text att_uuid UK
        text info_uuid FK
        text file_name
        text file_type
        text file_size
        text file_path
        text file_data
        text uploaded_by_uuid FK "master_users"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b1_initial {
        serial id PK
        text b1_uuid UK
        text rec_can_uuid FK
        text age_meets_criteria
        text rank_meets_criteria
        text certificates_valid
        text shortlisted
        text submitted_by_uuid FK "master_users"
        text submitted_date
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b1_comments {
        serial id PK
        text comment_uuid UK
        text b1_uuid FK
        text field_key
        text user_uuid FK "master_users"
        text comment_text
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b1_attachments {
        serial id PK
        text att_uuid UK
        text b1_uuid FK
        text file_name
        text file_type
        text file_size
        text file_path
        text file_data
        text uploaded_by_uuid FK "master_users"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b2_references {
        serial id PK
        text b2_uuid UK
        text rec_can_uuid FK
        text references_completed
        text employer_feedback
        text submitted_by_uuid FK "master_users"
        text submitted_date
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b2_reference_items {
        serial id PK
        text ref_uuid UK
        text b2_uuid FK
        text ref_date
        text name_designation
        text contact_info
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b2_comments {
        serial id PK
        text comment_uuid UK
        text b2_uuid FK
        text field_key
        text user_uuid FK "master_users"
        text comment_text
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b2_attachments {
        serial id PK
        text att_uuid UK
        text b2_uuid FK
        text file_name
        text file_type
        text file_size
        text file_path
        text file_data
        text uploaded_by_uuid FK "master_users"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b3_security {
        serial id PK
        text b3_uuid UK
        text rec_can_uuid FK
        text checks_completed
        text results
        text submitted_by_uuid FK "master_users"
        text submitted_date
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b3_authorities {
        serial id PK
        text auth_uuid UK
        text b3_uuid FK
        text check_date
        text authority
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b3_comments {
        serial id PK
        text comment_uuid UK
        text b3_uuid FK
        text field_key
        text user_uuid FK "master_users"
        text comment_text
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b3_attachments {
        serial id PK
        text att_uuid UK
        text b3_uuid FK
        text file_name
        text file_type
        text file_size
        text file_path
        text file_data
        text uploaded_by_uuid FK "master_users"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b4_certificates {
        serial id PK
        text b4_uuid UK
        text rec_can_uuid FK
        text certificates_authenticated
        text results
        text submitted_by_uuid FK "master_users"
        text submitted_date
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b4_cert_items {
        serial id PK
        text cert_uuid UK
        text b4_uuid FK
        text auth_date
        text certificate
        text authority
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b4_comments {
        serial id PK
        text comment_uuid UK
        text b4_uuid FK
        text field_key
        text user_uuid FK "master_users"
        text comment_text
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b4_attachments {
        serial id PK
        text att_uuid UK
        text b4_uuid FK
        text file_name
        text file_type
        text file_size
        text file_path
        text file_data
        text uploaded_by_uuid FK "master_users"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b5_tests {
        serial id PK
        text b5_uuid UK
        text rec_can_uuid FK
        text tests_completed
        text submitted_by_uuid FK "master_users"
        text submitted_date
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b5_test_items {
        serial id PK
        text test_uuid UK
        text b5_uuid FK
        text test_date
        text subject
        text score
        text result
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b5_comments {
        serial id PK
        text comment_uuid UK
        text b5_uuid FK
        text field_key
        text user_uuid FK "master_users"
        text comment_text
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b5_attachments {
        serial id PK
        text att_uuid UK
        text b5_uuid FK
        text file_name
        text file_type
        text file_size
        text file_path
        text file_data
        text uploaded_by_uuid FK "master_users"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b6_interviews {
        serial id PK
        text b6_uuid UK
        text rec_can_uuid FK
        text interview_completed
        text submitted_by_uuid FK "master_users"
        text submitted_date
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b6_interview_items {
        serial id PK
        text int_uuid UK
        text b6_uuid FK
        text interview_date
        text interviewer_uuid FK "master_users"
        text status
        text result
        text comments
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b6_comments {
        serial id PK
        text comment_uuid UK
        text b6_uuid FK
        text field_key
        text user_uuid FK "master_users"
        text comment_text
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b6_attachments {
        serial id PK
        text att_uuid UK
        text b6_uuid FK
        text file_name
        text file_type
        text file_size
        text file_path
        text file_data
        text uploaded_by_uuid FK "master_users"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b7_training {
        serial id PK
        text b7_uuid UK
        text rec_can_uuid FK
        text submitted_by_uuid FK "master_users"
        text submitted_date
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b7_training_items {
        serial id PK
        text train_item_uuid UK
        text b7_uuid FK
        text training
        text identified_by_uuid FK "master_users"
        text category
        text due_date
        text comments
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b8_shortlisting {
        serial id PK
        text b8_uuid UK
        text rec_can_uuid FK
        text shortlisted
        text submitted_by_uuid FK "master_users"
        text submitted_date
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b8_selected_approvers {
        serial id PK
        text approver_uuid UK
        text b8_uuid FK
        text user_uuid FK "master_users"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b8_comments {
        serial id PK
        text comment_uuid UK
        text b8_uuid FK
        text field_key
        text user_uuid FK "master_users"
        text comment_text
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    screening_b8_attachments {
        serial id PK
        text att_uuid UK
        text b8_uuid FK
        text file_name
        text file_type
        text file_size
        text file_path
        text file_data
        text uploaded_by_uuid FK "master_users"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_approvals {
        serial id PK
        text approval_uuid UK
        text rec_can_uuid FK
        text approval_date
        text approver_uuid FK "master_users"
        text status
        text approval_result
        text comments
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_suitability {
        serial id PK
        text suit_uuid UK
        text rec_can_uuid FK
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_suitability_vessel_types {
        serial id PK
        text svt_uuid UK
        text suit_uuid FK
        text vessel_type_uuid FK "master_vessel_types"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_suitability_fleet_groups {
        serial id PK
        text sfg_uuid UK
        text suit_uuid FK
        text fleet_group_uuid FK "master_fleet_groups"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_recruitment_decision {
        serial id PK
        text decision_uuid UK
        text rec_can_uuid FK
        text recruitment_status
        text submitted_by_uuid FK "master_users"
        text submitted_date
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    cand_assigned_groups {
        serial id PK
        text cag_uuid UK
        text decision_uuid FK
        text group_uuid FK "master_additional_groups"
        int sort_order
        timestamp created_at
        timestamp updated_at
        text created_by_uuid FK "master_users"
        text updated_by_uuid FK "master_users"
        boolean is_deleted
        boolean is_sync
    }

    %% Relationships
    master_nationalities ||--o{ recruitment_candidates : "nationality"
    master_users ||--o{ recruitment_candidates : "created_by/updated_by"
    recruitment_candidates ||--o{ cand_vessel_types_applied : "applied_for"
    master_vessel_types ||--o{ cand_vessel_types_applied : "vessel_type"
    recruitment_candidates ||--o| cand_personal_details : has
    recruitment_candidates ||--o| cand_addresses : has
    recruitment_candidates ||--o| cand_family_info : has
    recruitment_candidates ||--o| cand_next_of_kin : has
    recruitment_candidates ||--o{ cand_children : has
    recruitment_candidates ||--o{ cand_documents : has
    recruitment_candidates ||--o{ cand_visas : has
    recruitment_candidates ||--o{ cand_education : has
    recruitment_candidates ||--o{ cand_licenses : has
    recruitment_candidates ||--o{ cand_training_courses : has
    recruitment_candidates ||--o{ cand_sea_service : has
    recruitment_candidates ||--o{ cand_additional_info : has
    master_countries ||--o{ cand_personal_details : "place_of_birth"
    master_languages ||--o{ cand_personal_details : "native_language"
    master_countries ||--o{ cand_addresses : "country_of_residence"
    master_countries ||--o{ cand_documents : "issuing_country"
    master_countries ||--o{ cand_visas : "country"
    master_countries ||--o{ cand_licenses : "issuing_country"
    master_countries ||--o{ cand_training_courses : "issuing_country"
    master_vessels ||--o{ cand_sea_service : "vessel"
    master_vessel_types ||--o{ cand_sea_service : "vessel_type"
    cand_documents ||--o{ cand_documents_attachments : has
    cand_visas ||--o{ cand_visas_attachments : has
    cand_education ||--o{ cand_education_attachments : has
    cand_licenses ||--o{ cand_licenses_attachments : has
    cand_training_courses ||--o{ cand_training_attachments : has
    cand_sea_service ||--o{ cand_sea_service_attachments : has
    cand_additional_info ||--o{ cand_additional_info_attachments : has
    recruitment_candidates ||--o| screening_b1_initial : has
    recruitment_candidates ||--o| screening_b2_references : has
    recruitment_candidates ||--o| screening_b3_security : has
    recruitment_candidates ||--o| screening_b4_certificates : has
    recruitment_candidates ||--o| screening_b5_tests : has
    recruitment_candidates ||--o| screening_b6_interviews : has
    recruitment_candidates ||--o| screening_b7_training : has
    recruitment_candidates ||--o| screening_b8_shortlisting : has
    screening_b1_initial ||--o{ screening_b1_comments : has
    screening_b1_initial ||--o{ screening_b1_attachments : has
    screening_b2_references ||--o{ screening_b2_reference_items : has
    screening_b2_references ||--o{ screening_b2_comments : has
    screening_b2_references ||--o{ screening_b2_attachments : has
    screening_b3_security ||--o{ screening_b3_authorities : has
    screening_b3_security ||--o{ screening_b3_comments : has
    screening_b3_security ||--o{ screening_b3_attachments : has
    screening_b4_certificates ||--o{ screening_b4_cert_items : has
    screening_b4_certificates ||--o{ screening_b4_comments : has
    screening_b4_certificates ||--o{ screening_b4_attachments : has
    screening_b5_tests ||--o{ screening_b5_test_items : has
    screening_b5_tests ||--o{ screening_b5_comments : has
    screening_b5_tests ||--o{ screening_b5_attachments : has
    screening_b6_interviews ||--o{ screening_b6_interview_items : has
    screening_b6_interviews ||--o{ screening_b6_comments : has
    screening_b6_interviews ||--o{ screening_b6_attachments : has
    screening_b7_training ||--o{ screening_b7_training_items : has
    screening_b8_shortlisting ||--o{ screening_b8_selected_approvers : has
    screening_b8_shortlisting ||--o{ screening_b8_comments : has
    screening_b8_shortlisting ||--o{ screening_b8_attachments : has
    master_users ||--o{ screening_b1_comments : "user"
    master_users ||--o{ screening_b2_comments : "user"
    master_users ||--o{ screening_b3_comments : "user"
    master_users ||--o{ screening_b4_comments : "user"
    master_users ||--o{ screening_b5_comments : "user"
    master_users ||--o{ screening_b6_comments : "user"
    master_users ||--o{ screening_b6_interview_items : "interviewer"
    master_users ||--o{ screening_b7_training_items : "identified_by"
    master_users ||--o{ screening_b8_comments : "user"
    master_users ||--o{ screening_b8_selected_approvers : "user"
    recruitment_candidates ||--o{ cand_approvals : has
    recruitment_candidates ||--o| cand_suitability : has
    recruitment_candidates ||--o| cand_recruitment_decision : has
    cand_suitability ||--o{ cand_suitability_vessel_types : has
    cand_suitability ||--o{ cand_suitability_fleet_groups : has
    cand_recruitment_decision ||--o{ cand_assigned_groups : has
    master_users ||--o{ cand_approvals : "approver"
    master_vessel_types ||--o{ cand_suitability_vessel_types : "vessel_type"
    master_fleet_groups ||--o{ cand_suitability_fleet_groups : "fleet_group"
    master_additional_groups ||--o{ cand_assigned_groups : "group"
```
