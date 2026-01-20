# Recruitment V2 API Testing Documentation

**Base URL:** `/api/v2/recruitment`

**Total Tables:** 54 (excluding master tables)

---

## Table of Contents

1. [Phase 1: Candidate Core (7 tables)](#phase-1-candidate-core-7-tables)
2. [Phase 2: Documents & Attachments (14 tables)](#phase-2-documents--attachments-14-tables)
3. [Phase 3: Screening B1-B8 (27 tables)](#phase-3-screening-b1-b8-27-tables)
4. [Phase 4: Approvals & Decisions (6 tables)](#phase-4-approvals--decisions-6-tables)
5. [Common Patterns](#common-patterns)
6. [Sample Payloads](#sample-payloads)

---

## Phase 1: Candidate Core (7 tables)

### 1.1 Candidates (`recruitment_candidates_v2`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates` | List all candidates |
| GET | `/candidates/:id` | Get candidate by serial ID |
| GET | `/candidates/uuid/:recCanUuid` | Get candidate by UUID |
| POST | `/candidates` | Create new candidate |
| PATCH | `/candidates/:id` | Update by serial ID |
| PATCH | `/candidates/uuid/:recCanUuid` | Update by UUID |
| DELETE | `/candidates/:id` | Soft delete by serial ID |
| DELETE | `/candidates/uuid/:recCanUuid` | Soft delete by UUID |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| rec_can_uuid | text | UK, NOT NULL |
| file_no | text | UK |
| first_name | text | |
| middle_name | text | |
| family_name | text | |
| gender | text | |
| dob | text | |
| nationality_uuid | text | FK → master_nationalities |
| present_rank | text | |
| rank_applied_for | text | |
| status | text | |
| uploaded_photo | text | |

---

### 1.2 Vessel Types Applied (`cand_vessel_types_applied`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/vessel-types` | List vessel types |
| POST | `/candidates/:recCanUuid/vessel-types` | Add vessel type |
| DELETE | `/candidates/:recCanUuid/vessel-types/:id` | Remove vessel type |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| cvta_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| vessel_type_uuid | text | FK → master_vessel_types |
| sort_order | integer | |

---

### 1.3 Personal Details (`cand_personal_details`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/personal-details` | Get personal details |
| PUT | `/candidates/:recCanUuid/personal-details` | Create/Update (upsert) |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| cpd_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| height_cm | text | |
| weight_kg | text | |
| place_of_birth_city | text | |
| place_of_birth_country_uuid | text | FK → master_countries |
| age_in_years | text | |
| native_language_uuid | text | FK → master_languages |
| foreign_languages | text | |
| english_proficiency | text | |
| manning_agent | text | |

---

### 1.4 Address (`cand_addresses`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/address` | Get address |
| PUT | `/candidates/:recCanUuid/address` | Create/Update (upsert) |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| addr_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| country_of_residence_uuid | text | FK → master_countries |
| nearest_airport | text | |
| address_line1 | text | |
| address_line2 | text | |
| contact_landline | text | |
| mobile | text | |
| email | text | |

---

### 1.5 Family Info (`cand_family_info`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/family-info` | Get family info |
| PUT | `/candidates/:recCanUuid/family-info` | Create/Update (upsert) |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| fam_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| marital_status | text | |
| num_dependent_children | text | |
| father_name | text | |
| mother_name | text | |
| spouse_first_name | text | |
| spouse_middle_name | text | |
| spouse_family_name | text | |
| spouse_dob | text | |

---

### 1.6 Children (`cand_children`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/children` | List children |
| POST | `/candidates/:recCanUuid/children` | Add child |
| PATCH | `/candidates/:recCanUuid/children/:id` | Update child |
| DELETE | `/candidates/:recCanUuid/children/:id` | Delete child |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| child_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| first_name | text | |
| middle_name | text | |
| family_name | text | |
| dob | text | |
| gender | text | |
| sort_order | integer | |

---

### 1.7 Next of Kin (`cand_next_of_kin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/next-of-kin` | Get next of kin |
| PUT | `/candidates/:recCanUuid/next-of-kin` | Create/Update (upsert) |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| nok_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| first_name | text | |
| middle_name | text | |
| family_name | text | |
| telephone | text | |
| email | text | |
| address | text | |
| relationship | text | |

---

## Phase 2: Documents & Attachments (14 tables)

### 2.1 Documents (`cand_documents`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/documents` | List documents |
| POST | `/candidates/:recCanUuid/documents` | Create document |
| PATCH | `/documents/:id` | Update document |
| DELETE | `/documents/:id` | Delete document |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| doc_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| document_id | text | |
| document_name | text | |
| number | text | |
| issued | text | |
| expiry | text | |
| issuing_authority | text | |
| issuing_country_uuid | text | FK → master_countries |
| sort_order | integer | |

### 2.1a Document Attachments (`cand_documents_attachments`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/documents/:docUuid/attachments` | List attachments |
| POST | `/documents/:docUuid/attachments` | Add attachment |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| att_uuid | text | UK, NOT NULL |
| doc_uuid | text | FK, NOT NULL |
| file_name | text | |
| file_type | text | |
| file_size | text | |
| file_path | text | |
| file_data | text | |
| uploaded_by_uuid | text | FK → master_users |
| sort_order | integer | |

---

### 2.2 Visas (`cand_visas`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/visas` | List visas |
| POST | `/candidates/:recCanUuid/visas` | Create visa |
| PATCH | `/visas/:id` | Update visa |
| DELETE | `/visas/:id` | Delete visa |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| visa_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| country_uuid | text | FK → master_countries |
| serial_no | text | |
| issued | text | |
| expiry | text | |
| visa_type | text | |
| sort_order | integer | |

### 2.2a Visa Attachments (`cand_visas_attachments`)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/visas/:visaUuid/attachments` | List attachments | Pending |
| POST | `/visas/:visaUuid/attachments` | Add attachment | Pending |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| att_uuid | text | UK, NOT NULL |
| visa_uuid | text | FK, NOT NULL |
| file_name | text | |
| file_type | text | |
| file_size | text | |
| file_path | text | |
| file_data | text | |
| uploaded_by_uuid | text | FK → master_users |
| sort_order | integer | |

---

### 2.3 Education (`cand_education`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/education` | List education records |
| POST | `/candidates/:recCanUuid/education` | Create education |
| PATCH | `/education/:id` | Update education |
| DELETE | `/education/:id` | Delete education |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| edu_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| date_of_completion | text | |
| institution | text | |
| subjects_field | text | |
| qualifications | text | |
| sort_order | integer | |

### 2.3a Education Attachments (`cand_education_attachments`)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/education/:eduUuid/attachments` | List attachments | Pending |
| POST | `/education/:eduUuid/attachments` | Add attachment | Pending |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| att_uuid | text | UK, NOT NULL |
| edu_uuid | text | FK, NOT NULL |
| file_name | text | |
| file_type | text | |
| file_size | text | |
| file_path | text | |
| file_data | text | |
| uploaded_by_uuid | text | FK → master_users |
| sort_order | integer | |

---

### 2.4 Licenses (`cand_licenses`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/licenses` | List licenses |
| POST | `/candidates/:recCanUuid/licenses` | Create license |
| PATCH | `/licenses/:id` | Update license |
| DELETE | `/licenses/:id` | Delete license |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| lic_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| license_id | text | |
| certificate_document | text | |
| abbr | text | |
| requirement | text | |
| certificate_no | text | |
| issuing_authority | text | |
| issuing_country_uuid | text | FK → master_countries |
| issued | text | |
| expiry | text | |
| sort_order | integer | |

### 2.4a License Attachments (`cand_licenses_attachments`)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/licenses/:licUuid/attachments` | List attachments | Pending |
| POST | `/licenses/:licUuid/attachments` | Add attachment | Pending |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| att_uuid | text | UK, NOT NULL |
| lic_uuid | text | FK, NOT NULL |
| file_name | text | |
| file_type | text | |
| file_size | text | |
| file_path | text | |
| file_data | text | |
| uploaded_by_uuid | text | FK → master_users |
| sort_order | integer | |

---

### 2.5 Training Courses (`cand_training_courses`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/training` | List training courses |
| POST | `/candidates/:recCanUuid/training` | Create training course |
| PATCH | `/training/:id` | Update training course |
| DELETE | `/training/:id` | Delete training course |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| train_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| course_id | text | |
| training_course | text | |
| abbr | text | |
| requirement | text | |
| certificate_no | text | |
| issuing_authority | text | |
| issuing_country_uuid | text | FK → master_countries |
| issued | text | |
| expiry | text | |
| sort_order | integer | |

### 2.5a Training Attachments (`cand_training_attachments`)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/training/:trainUuid/attachments` | List attachments | Pending |
| POST | `/training/:trainUuid/attachments` | Add attachment | Pending |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| att_uuid | text | UK, NOT NULL |
| train_uuid | text | FK, NOT NULL |
| file_name | text | |
| file_type | text | |
| file_size | text | |
| file_path | text | |
| file_data | text | |
| uploaded_by_uuid | text | FK → master_users |
| sort_order | integer | |

---

### 2.6 Sea Service (`cand_sea_service`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/sea-service` | List sea service records |
| POST | `/candidates/:recCanUuid/sea-service` | Create sea service |
| PATCH | `/sea-service/:id` | Update sea service |
| DELETE | `/sea-service/:id` | Delete sea service |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| sea_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| vessel_name | text | |
| vessel_uuid | text | FK → master_vessels |
| vessel_type_uuid | text | FK → master_vessel_types |
| deadweight | text | |
| engine_type_power | text | |
| owner_operator | text | |
| rank | text | |
| from_date | text | |
| to_date | text | |
| period_months | text | |
| sort_order | integer | |

### 2.6a Sea Service Attachments (`cand_sea_service_attachments`)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/sea-service/:seaUuid/attachments` | List attachments | Pending |
| POST | `/sea-service/:seaUuid/attachments` | Add attachment | Pending |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| att_uuid | text | UK, NOT NULL |
| sea_uuid | text | FK, NOT NULL |
| file_name | text | |
| file_type | text | |
| file_size | text | |
| file_path | text | |
| file_data | text | |
| uploaded_by_uuid | text | FK → master_users |
| sort_order | integer | |

---

### 2.7 Additional Info (`cand_additional_info`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/additional-info` | List additional info |
| POST | `/candidates/:recCanUuid/additional-info` | Create additional info |
| PATCH | `/additional-info/:id` | Update additional info |
| DELETE | `/additional-info/:id` | Delete additional info |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| info_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| information | text | |
| response | text | |
| sort_order | integer | |

### 2.7a Additional Info Attachments (`cand_additional_info_attachments`)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/additional-info/:infoUuid/attachments` | List attachments | Pending |
| POST | `/additional-info/:infoUuid/attachments` | Add attachment | Pending |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| att_uuid | text | UK, NOT NULL |
| info_uuid | text | FK, NOT NULL |
| file_name | text | |
| file_type | text | |
| file_size | text | |
| file_path | text | |
| file_data | text | |
| uploaded_by_uuid | text | FK → master_users |
| sort_order | integer | |

---

## Phase 3: Screening B1-B8 (27 tables)

### 3.1 B1 - Initial Screening (3 tables)

#### 3.1.1 Main (`screening_b1_initial`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/screening/b1` | Get B1 screening |
| PUT | `/candidates/:recCanUuid/screening/b1` | Create/Update B1 |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| b1_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| age_meets_criteria | text | |
| rank_meets_criteria | text | |
| certificates_valid | text | |
| shortlisted | text | |
| submitted_by_uuid | text | FK → master_users |
| submitted_date | text | |

#### 3.1.2 Comments (`screening_b1_comments`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/screening/b1/:b1Uuid/comments` | List comments |
| POST | `/screening/b1/:b1Uuid/comments` | Add comment |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| comment_uuid | text | UK, NOT NULL |
| b1_uuid | text | FK, NOT NULL |
| field_key | text | |
| user_uuid | text | FK → master_users |
| comment_text | text | |
| sort_order | integer | |

#### 3.1.3 Attachments (`screening_b1_attachments`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/screening/b1/:b1Uuid/attachments` | List attachments |
| POST | `/screening/b1/:b1Uuid/attachments` | Add attachment |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| att_uuid | text | UK, NOT NULL |
| b1_uuid | text | FK, NOT NULL |
| file_name | text | |
| file_type | text | |
| file_size | text | |
| file_path | text | |
| file_data | text | |
| uploaded_by_uuid | text | FK → master_users |
| sort_order | integer | |

---

### 3.2 B2 - References (4 tables)

#### 3.2.1 Main (`screening_b2_references`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/screening/b2` | Get B2 screening |
| PUT | `/candidates/:recCanUuid/screening/b2` | Create/Update B2 |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| b2_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| references_completed | text | |
| employer_feedback | text | |
| submitted_by_uuid | text | FK → master_users |
| submitted_date | text | |

#### 3.2.2 Reference Items (`screening_b2_reference_items`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/screening/b2/:b2Uuid/items` | List reference items |
| POST | `/screening/b2/:b2Uuid/items` | Add reference item |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| ref_uuid | text | UK, NOT NULL |
| b2_uuid | text | FK, NOT NULL |
| ref_date | text | |
| name_designation | text | |
| contact_info | text | |
| sort_order | integer | |

#### 3.2.3 Comments (`screening_b2_comments`)

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| comment_uuid | text | UK, NOT NULL |
| b2_uuid | text | FK, NOT NULL |
| field_key | text | |
| user_uuid | text | FK → master_users |
| comment_text | text | |
| sort_order | integer | |

#### 3.2.4 Attachments (`screening_b2_attachments`)

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| att_uuid | text | UK, NOT NULL |
| b2_uuid | text | FK, NOT NULL |
| file_name | text | |
| file_type | text | |
| file_size | text | |
| file_path | text | |
| file_data | text | |
| uploaded_by_uuid | text | FK → master_users |
| sort_order | integer | |

---

### 3.3 B3 - Security (4 tables)

#### 3.3.1 Main (`screening_b3_security`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/screening/b3` | Get B3 screening |
| PUT | `/candidates/:recCanUuid/screening/b3` | Create/Update B3 |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| b3_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| checks_completed | text | |
| results | text | |
| submitted_by_uuid | text | FK → master_users |
| submitted_date | text | |

#### 3.3.2 Authorities (`screening_b3_authorities`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/screening/b3/:b3Uuid/authorities` | List authorities |
| POST | `/screening/b3/:b3Uuid/authorities` | Add authority |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| auth_uuid | text | UK, NOT NULL |
| b3_uuid | text | FK, NOT NULL |
| check_date | text | |
| authority | text | |
| sort_order | integer | |

#### 3.3.3 Comments (`screening_b3_comments`)

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| comment_uuid | text | UK, NOT NULL |
| b3_uuid | text | FK, NOT NULL |
| field_key | text | |
| user_uuid | text | FK → master_users |
| comment_text | text | |
| sort_order | integer | |

#### 3.3.4 Attachments (`screening_b3_attachments`)

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| att_uuid | text | UK, NOT NULL |
| b3_uuid | text | FK, NOT NULL |
| file_name | text | |
| file_type | text | |
| file_size | text | |
| file_path | text | |
| file_data | text | |
| uploaded_by_uuid | text | FK → master_users |
| sort_order | integer | |

---

### 3.4 B4 - Certificates (4 tables)

#### 3.4.1 Main (`screening_b4_certificates`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/screening/b4` | Get B4 screening |
| PUT | `/candidates/:recCanUuid/screening/b4` | Create/Update B4 |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| b4_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| certificates_authenticated | text | |
| results | text | |
| submitted_by_uuid | text | FK → master_users |
| submitted_date | text | |

#### 3.4.2 Cert Items (`screening_b4_cert_items`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/screening/b4/:b4Uuid/cert-items` | List cert items |
| POST | `/screening/b4/:b4Uuid/cert-items` | Add cert item |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| cert_uuid | text | UK, NOT NULL |
| b4_uuid | text | FK, NOT NULL |
| auth_date | text | |
| certificate | text | |
| authority | text | |
| sort_order | integer | |

#### 3.4.3 Comments (`screening_b4_comments`)

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| comment_uuid | text | UK, NOT NULL |
| b4_uuid | text | FK, NOT NULL |
| field_key | text | |
| user_uuid | text | FK → master_users |
| comment_text | text | |
| sort_order | integer | |

#### 3.4.4 Attachments (`screening_b4_attachments`)

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| att_uuid | text | UK, NOT NULL |
| b4_uuid | text | FK, NOT NULL |
| file_name | text | |
| file_type | text | |
| file_size | text | |
| file_path | text | |
| file_data | text | |
| uploaded_by_uuid | text | FK → master_users |
| sort_order | integer | |

---

### 3.5 B5 - Tests (4 tables)

#### 3.5.1 Main (`screening_b5_tests`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/screening/b5` | Get B5 screening |
| PUT | `/candidates/:recCanUuid/screening/b5` | Create/Update B5 |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| b5_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| tests_completed | text | |
| submitted_by_uuid | text | FK → master_users |
| submitted_date | text | |

#### 3.5.2 Test Items (`screening_b5_test_items`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/screening/b5/:b5Uuid/test-items` | List test items |
| POST | `/screening/b5/:b5Uuid/test-items` | Add test item |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| test_uuid | text | UK, NOT NULL |
| b5_uuid | text | FK, NOT NULL |
| test_date | text | |
| subject | text | |
| score | text | |
| result | text | |
| sort_order | integer | |

#### 3.5.3 Comments (`screening_b5_comments`)

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| comment_uuid | text | UK, NOT NULL |
| b5_uuid | text | FK, NOT NULL |
| field_key | text | |
| user_uuid | text | FK → master_users |
| comment_text | text | |
| sort_order | integer | |

#### 3.5.4 Attachments (`screening_b5_attachments`)

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| att_uuid | text | UK, NOT NULL |
| b5_uuid | text | FK, NOT NULL |
| file_name | text | |
| file_type | text | |
| file_size | text | |
| file_path | text | |
| file_data | text | |
| uploaded_by_uuid | text | FK → master_users |
| sort_order | integer | |

---

### 3.6 B6 - Interviews (4 tables)

#### 3.6.1 Main (`screening_b6_interviews`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/screening/b6` | Get B6 screening |
| PUT | `/candidates/:recCanUuid/screening/b6` | Create/Update B6 |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| b6_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| interview_completed | text | |
| submitted_by_uuid | text | FK → master_users |
| submitted_date | text | |

#### 3.6.2 Interview Items (`screening_b6_interview_items`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/screening/b6/:b6Uuid/interview-items` | List interview items |
| POST | `/screening/b6/:b6Uuid/interview-items` | Add interview item |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| int_uuid | text | UK, NOT NULL |
| b6_uuid | text | FK, NOT NULL |
| interview_date | text | |
| interviewer_uuid | text | FK → master_users |
| status | text | |
| result | text | |
| comments | text | |
| sort_order | integer | |

#### 3.6.3 Comments (`screening_b6_comments`)

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| comment_uuid | text | UK, NOT NULL |
| b6_uuid | text | FK, NOT NULL |
| field_key | text | |
| user_uuid | text | FK → master_users |
| comment_text | text | |
| sort_order | integer | |

#### 3.6.4 Attachments (`screening_b6_attachments`)

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| att_uuid | text | UK, NOT NULL |
| b6_uuid | text | FK, NOT NULL |
| file_name | text | |
| file_type | text | |
| file_size | text | |
| file_path | text | |
| file_data | text | |
| uploaded_by_uuid | text | FK → master_users |
| sort_order | integer | |

---

### 3.7 B7 - Training (2 tables)

#### 3.7.1 Main (`screening_b7_training`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/screening/b7` | Get B7 screening |
| PUT | `/candidates/:recCanUuid/screening/b7` | Create/Update B7 |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| b7_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| submitted_by_uuid | text | FK → master_users |
| submitted_date | text | |

#### 3.7.2 Training Items (`screening_b7_training_items`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/screening/b7/:b7Uuid/training-items` | List training items |
| POST | `/screening/b7/:b7Uuid/training-items` | Add training item |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| train_item_uuid | text | UK, NOT NULL |
| b7_uuid | text | FK, NOT NULL |
| training | text | |
| identified_by_uuid | text | FK → master_users |
| category | text | |
| due_date | text | |
| comments | text | |
| sort_order | integer | |

---

### 3.8 B8 - Shortlisting (4 tables)

#### 3.8.1 Main (`screening_b8_shortlisting`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/screening/b8` | Get B8 screening |
| PUT | `/candidates/:recCanUuid/screening/b8` | Create/Update B8 |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| b8_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| shortlisted | text | |
| submitted_by_uuid | text | FK → master_users |
| submitted_date | text | |

#### 3.8.2 Selected Approvers (`screening_b8_selected_approvers`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/screening/b8/:b8Uuid/approvers` | List selected approvers |
| POST | `/screening/b8/:b8Uuid/approvers` | Add approver |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| approver_uuid | text | UK, NOT NULL |
| b8_uuid | text | FK, NOT NULL |
| user_uuid | text | FK → master_users |
| sort_order | integer | |

#### 3.8.3 Comments (`screening_b8_comments`)

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| comment_uuid | text | UK, NOT NULL |
| b8_uuid | text | FK, NOT NULL |
| field_key | text | |
| user_uuid | text | FK → master_users |
| comment_text | text | |
| sort_order | integer | |

#### 3.8.4 Attachments (`screening_b8_attachments`)

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| att_uuid | text | UK, NOT NULL |
| b8_uuid | text | FK, NOT NULL |
| file_name | text | |
| file_type | text | |
| file_size | text | |
| file_path | text | |
| file_data | text | |
| uploaded_by_uuid | text | FK → master_users |
| sort_order | integer | |

---

## Phase 4: Approvals & Decisions (6 tables)

### 4.1 Approvals (`cand_approvals`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/approvals` | List approvals |
| POST | `/candidates/:recCanUuid/approvals` | Create approval |
| PATCH | `/approvals/:id` | Update approval |
| DELETE | `/approvals/:id` | Delete approval |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| approval_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| approval_date | text | |
| approver_uuid | text | FK → master_users |
| status | text | |
| approval_result | text | |
| comments | text | |
| sort_order | integer | |

---

### 4.2 Suitability (`cand_suitability`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/suitability` | Get suitability |
| PUT | `/candidates/:recCanUuid/suitability` | Create/Update suitability |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| suit_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |

---

### 4.3 Suitability Vessel Types (`cand_suitability_vessel_types`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/suitability/:suitUuid/vessel-types` | List vessel types |
| POST | `/suitability/:suitUuid/vessel-types` | Add vessel type |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| svt_uuid | text | UK, NOT NULL |
| suit_uuid | text | FK, NOT NULL |
| vessel_type_uuid | text | FK → master_vessel_types |
| sort_order | integer | |

---

### 4.4 Suitability Fleet Groups (`cand_suitability_fleet_groups`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/suitability/:suitUuid/fleet-groups` | List fleet groups |
| POST | `/suitability/:suitUuid/fleet-groups` | Add fleet group |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| sfg_uuid | text | UK, NOT NULL |
| suit_uuid | text | FK, NOT NULL |
| fleet_group_uuid | text | FK → master_fleet_groups |
| sort_order | integer | |

---

### 4.5 Recruitment Decision (`cand_recruitment_decision`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates/:recCanUuid/decision` | Get recruitment decision |
| PUT | `/candidates/:recCanUuid/decision` | Create/Update decision |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| decision_uuid | text | UK, NOT NULL |
| rec_can_uuid | text | FK, NOT NULL |
| recruitment_status | text | |
| submitted_by_uuid | text | FK → master_users |
| submitted_date | text | |

---

### 4.6 Assigned Groups (`cand_assigned_groups`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/decisions/:decisionUuid/assigned-groups` | List assigned groups |
| POST | `/decisions/:decisionUuid/assigned-groups` | Add assigned group |

**Fields:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| cag_uuid | text | UK, NOT NULL |
| decision_uuid | text | FK, NOT NULL |
| group_uuid | text | FK → master_additional_groups |
| sort_order | integer | |

---

## Common Patterns

### Audit Columns (All Tables)

Every table includes these standard audit columns:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| created_at | timestamp | now() | Record creation timestamp |
| updated_at | timestamp | now() | Last update timestamp |
| created_by_uuid | text | | User who created the record |
| updated_by_uuid | text | | User who last updated |
| is_deleted | boolean | false | Soft delete flag |
| is_sync | boolean | false | Sync status flag |

### ID Patterns

- **Primary Key**: Serial integer (`id`)
- **Unique Key**: UUID text field (e.g., `rec_can_uuid`, `doc_uuid`)
- **Foreign Keys**: UUID text references (soft foreign keys, no database constraints)

### HTTP Methods

| Method | Operation | Idempotent | Description |
|--------|-----------|------------|-------------|
| GET | Read | Yes | Retrieve resource(s) |
| POST | Create | No | Create new resource |
| PUT | Upsert | Yes | Create or update (full replacement) |
| PATCH | Update | No | Partial update |
| DELETE | Delete | Yes | Soft delete (sets is_deleted = true) |

### Response Codes

| Code | Description |
|------|-------------|
| 200 | Success (GET, PATCH, DELETE) |
| 201 | Created (POST) |
| 400 | Bad Request (validation error) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Sample Payloads

### Create Candidate

```http
POST /api/v2/recruitment/candidates
Content-Type: application/json

{
  "fileNo": "RC-2026-001",
  "firstName": "John",
  "middleName": "Michael",
  "familyName": "Doe",
  "gender": "Male",
  "dob": "1990-05-15",
  "nationalityUuid": "nat-uuid-123",
  "presentRank": "3rd Officer",
  "rankAppliedFor": "2nd Officer",
  "status": "Draft"
}
```

### Update Personal Details

```http
PUT /api/v2/recruitment/candidates/rec-can-uuid-123/personal-details
Content-Type: application/json

{
  "heightCm": "175",
  "weightKg": "70",
  "placeOfBirthCity": "Manila",
  "placeOfBirthCountryUuid": "country-uuid-ph",
  "ageInYears": "34",
  "nativeLanguageUuid": "lang-uuid-tl",
  "englishProficiency": "Fluent"
}
```

### Add Document

```http
POST /api/v2/recruitment/candidates/rec-can-uuid-123/documents
Content-Type: application/json

{
  "documentId": "PASSPORT",
  "documentName": "Passport",
  "number": "P1234567890",
  "issued": "2020-01-15",
  "expiry": "2030-01-14",
  "issuingAuthority": "DFA",
  "issuingCountryUuid": "country-uuid-ph",
  "sortOrder": 1
}
```

### Add Sea Service

```http
POST /api/v2/recruitment/candidates/rec-can-uuid-123/sea-service
Content-Type: application/json

{
  "vesselName": "MV Pacific Star",
  "vesselTypeUuid": "vt-uuid-tanker",
  "deadweight": "50000",
  "engineTypePower": "MAN B&W 6S60MC-C",
  "ownerOperator": "Pacific Shipping Co.",
  "rank": "3rd Officer",
  "fromDate": "2023-01-15",
  "toDate": "2023-07-15",
  "periodMonths": "6",
  "sortOrder": 1
}
```

### Create B1 Screening

```http
PUT /api/v2/recruitment/candidates/rec-can-uuid-123/screening/b1
Content-Type: application/json

{
  "ageMeetsCriteria": "Yes",
  "rankMeetsCriteria": "Yes",
  "certificatesValid": "Yes",
  "shortlisted": "Yes",
  "submittedByUuid": "user-uuid-456",
  "submittedDate": "2026-01-20"
}
```

### Add B1 Comment

```http
POST /api/v2/recruitment/screening/b1/b1-uuid-123/comments
Content-Type: application/json

{
  "fieldKey": "certificates_valid",
  "userUuid": "user-uuid-789",
  "commentText": "All certificates verified and valid",
  "sortOrder": 1
}
```

### Create Approval

```http
POST /api/v2/recruitment/candidates/rec-can-uuid-123/approvals
Content-Type: application/json

{
  "approvalDate": "2026-01-20",
  "approverUuid": "user-uuid-789",
  "status": "Approved",
  "approvalResult": "Pass",
  "comments": "Candidate meets all requirements",
  "sortOrder": 1
}
```

### Create Recruitment Decision

```http
PUT /api/v2/recruitment/candidates/rec-can-uuid-123/decision
Content-Type: application/json

{
  "recruitmentStatus": "Accepted",
  "submittedByUuid": "user-uuid-456",
  "submittedDate": "2026-01-20"
}
```

### Add Assigned Group

```http
POST /api/v2/recruitment/decisions/decision-uuid-123/assigned-groups
Content-Type: application/json

{
  "groupUuid": "ag-uuid-tanker-group",
  "sortOrder": 1
}
```

---

## Table Summary

| Phase | Category | Tables | Implemented Endpoints |
|-------|----------|--------|----------------------|
| 1 | Candidate Core | 7 | 23 |
| 2 | Documents & Attachments | 14 | 30 |
| 3 | Screening B1-B8 | 27 | 28 |
| 4 | Approvals & Decisions | 6 | 14 |
| **Total** | | **54** | **95** |

---

## Table Count Breakdown

### Phase 1: Candidate Core (7 tables)
1. recruitment_candidates_v2
2. cand_vessel_types_applied
3. cand_personal_details
4. cand_addresses
5. cand_family_info
6. cand_children
7. cand_next_of_kin

### Phase 2: Documents & Attachments (14 tables)
1. cand_documents
2. cand_documents_attachments
3. cand_visas
4. cand_visas_attachments
5. cand_education
6. cand_education_attachments
7. cand_licenses
8. cand_licenses_attachments
9. cand_training_courses
10. cand_training_attachments
11. cand_sea_service
12. cand_sea_service_attachments
13. cand_additional_info
14. cand_additional_info_attachments

### Phase 3: Screening B1-B8 (27 tables)
**B1 - Initial Screening (3)**
1. screening_b1_initial
2. screening_b1_comments
3. screening_b1_attachments

**B2 - References (4)**
4. screening_b2_references
5. screening_b2_reference_items
6. screening_b2_comments
7. screening_b2_attachments

**B3 - Security (4)**
8. screening_b3_security
9. screening_b3_authorities
10. screening_b3_comments
11. screening_b3_attachments

**B4 - Certificates (4)**
12. screening_b4_certificates
13. screening_b4_cert_items
14. screening_b4_comments
15. screening_b4_attachments

**B5 - Tests (4)**
16. screening_b5_tests
17. screening_b5_test_items
18. screening_b5_comments
19. screening_b5_attachments

**B6 - Interviews (4)**
20. screening_b6_interviews
21. screening_b6_interview_items
22. screening_b6_comments
23. screening_b6_attachments

**B7 - Training (2)**
24. screening_b7_training
25. screening_b7_training_items

**B8 - Shortlisting (4)**
26. screening_b8_shortlisting
27. screening_b8_selected_approvers
28. screening_b8_comments
29. screening_b8_attachments

> **Note:** Per specification, B7 has only 2 tables (no comments/attachments). Actual count is 29, but specification states 27.

### Phase 4: Approvals & Decisions (6 tables)
1. cand_approvals
2. cand_suitability
3. cand_suitability_vessel_types
4. cand_suitability_fleet_groups
5. cand_recruitment_decision
6. cand_assigned_groups

---

*Generated: January 2026*
*Version: 2.0*
*Schema aligned with ERD specification*
