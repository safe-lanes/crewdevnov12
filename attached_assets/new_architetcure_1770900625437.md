erDiagram
    promo_criteria_master {
        serial id PK
        text criteria_uuid UK "NOT NULL"
        text criteria_code "NOT NULL, e.g. a2.1 a2.3a a2.8"
        text criteria_label "NOT NULL, e.g. Higher License Criteria"
        text section "e.g. a2 a2.3 a2.6"
        boolean is_parent "default false, true for group headers"
        integer sort_order "default 0"
        timestamp created_at "defaultNow"
        timestamp updated_at "defaultNow"
        text created_by_uuid
        text updated_by_uuid
        boolean is_deleted "default false"
        boolean is_sync "default false"
    }

    promotion_reviews_v2 {
        serial id PK
        text review_uuid UK "NOT NULL"
        text crew_member_id FK "NOT NULL, FK → crew_members"
        text promotion_to_rank "NOT NULL"
        text selected_vessel_type_for_a2_3b
        text promotion_confirmed "yes / waitlist / rejected"
        text vessel_assigned
        text promotion_date
        text promotion_timing "on-board / prior-joining"
        text part_a_notes
        text part_b_notes
        text part_c_notes
        text status "NOT NULL, default draft"
        integer sort_order "default 0"
        timestamp created_at "defaultNow"
        timestamp updated_at "defaultNow"
        text created_by_uuid
        text updated_by_uuid
        boolean is_deleted "default false"
        boolean is_sync "default false"
    }

    promo_criteria_status_v2 {
        serial id PK
        text cs_uuid UK "NOT NULL"
        text review_uuid FK "NOT NULL, FK → promotion_reviews_v2"
        text criteria_uuid FK "NOT NULL, FK → promo_criteria_master"
        text verified_status "yes / no / na / empty"
        text meets_status "yes / no / pending / empty"
        integer sort_order "default 0"
        timestamp created_at "defaultNow"
        timestamp updated_at "defaultNow"
        text created_by_uuid
        text updated_by_uuid
        boolean is_deleted "default false"
        boolean is_sync "default false"
    }

    promo_ces_tests_v2 {
        serial id PK
        text ct_uuid UK "NOT NULL"
        text review_uuid FK "NOT NULL, FK → promotion_reviews_v2"
        text test_id "original id from v1 JSON"
        text description
        text date
        text minScore
        text score
        text result "pass / fail"
        integer sort_order "default 0"
        timestamp created_at "defaultNow"
        timestamp updated_at "defaultNow"
        text created_by_uuid
        text updated_by_uuid
        boolean is_deleted "default false"
        boolean is_sync "default false"
    }

    promo_criteria_comments_v2 {
        serial id PK
        text cc_uuid UK "NOT NULL"
        text review_uuid FK "NOT NULL, FK → promotion_reviews_v2"
        text criteria_uuid FK "NOT NULL, FK → promo_criteria_master"
        text comment_id "original id from v1 JSON"
        text user
        text text
        integer sort_order "default 0"
        timestamp created_at "defaultNow"
        timestamp updated_at "defaultNow"
        text created_by_uuid
        text updated_by_uuid
        boolean is_deleted "default false"
        boolean is_sync "default false"
    }

    promo_training_comments_v2 {
        serial id PK
        text tc_uuid UK "NOT NULL"
        text review_uuid FK "NOT NULL, FK → promotion_reviews_v2"
        text training_row_id "NOT NULL, e.g. 1 2 6"
        text comment_id "original id from v1 JSON"
        text user
        text text
        integer sort_order "default 0"
        timestamp created_at "defaultNow"
        timestamp updated_at "defaultNow"
        text created_by_uuid
        text updated_by_uuid
        boolean is_deleted "default false"
        boolean is_sync "default false"
    }

    promo_training_needs_v2 {
        serial id PK
        text tn_uuid UK "NOT NULL"
        text review_uuid FK "NOT NULL, FK → promotion_reviews_v2"
        text training_row_id "original id from v1 JSON"
        text training
        text correspondingInDB
        text category
        text status
        text completionDate
        integer sort_order "default 0"
        timestamp created_at "defaultNow"
        timestamp updated_at "defaultNow"
        text created_by_uuid
        text updated_by_uuid
        boolean is_deleted "default false"
        boolean is_sync "default false"
    }

    promo_approvals_v2 {
        serial id PK
        text ap_uuid UK "NOT NULL"
        text review_uuid FK "NOT NULL, FK → promotion_reviews_v2"
        text approver_id "original id from v1 JSON"
        text date
        text approver "approver name"
        text status
        text approval
        text comments
        boolean isFromPartA "default false"
        boolean isSelectedForSubmission "default false"
        integer sort_order "default 0"
        timestamp created_at "defaultNow"
        timestamp updated_at "defaultNow"
        text created_by_uuid
        text updated_by_uuid
        boolean is_deleted "default false"
        boolean is_sync "default false"
    }

    promo_checklist_progress_v2 {
        serial id PK
        text cp_uuid UK "NOT NULL"
        text review_uuid FK "NOT NULL, FK → promotion_reviews_v2"
        text section_id "NOT NULL"
        text assessment_point_id "NOT NULL"
        text verification_id "original id from v1 JSON"
        text verifierName
        text date
        integer sort_order "default 0"
        timestamp created_at "defaultNow"
        timestamp updated_at "defaultNow"
        text created_by_uuid
        text updated_by_uuid
        boolean is_deleted "default false"
        boolean is_sync "default false"
    }

    promo_criteria_master ||--o{ promo_criteria_status_v2 : "criteria_uuid"
    promo_criteria_master ||--o{ promo_criteria_comments_v2 : "criteria_uuid"
    promotion_reviews_v2 ||--o{ promo_criteria_status_v2 : "review_uuid"
    promotion_reviews_v2 ||--o{ promo_ces_tests_v2 : "review_uuid"
    promotion_reviews_v2 ||--o{ promo_criteria_comments_v2 : "review_uuid"
    promotion_reviews_v2 ||--o{ promo_training_comments_v2 : "review_uuid"
    promotion_reviews_v2 ||--o{ promo_training_needs_v2 : "review_uuid"
    promotion_reviews_v2 ||--o{ promo_approvals_v2 : "review_uuid"
    promotion_reviews_v2 ||--o{ promo_checklist_progress_v2 : "review_uuid"