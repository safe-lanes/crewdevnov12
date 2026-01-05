# Entity Relationship Diagrams

## Core Entities

```mermaid
erDiagram
    CREW_MEMBERS {
        text id PK
        text first_name
        text family_name
        text nationality
        text present_rank
        text present_vessel FK
        text status
        text sign_on_date
        timestamp created_at
    }
    
    VESSELS {
        serial id PK
        text name
        text vessel_type
        text vessel_group
    }
    
    VESSEL_PLANNING {
        serial id PK
        text vessel_id FK
        text crew_member_id FK
        text rank
        text status
        text sign_on_date
    }
    
    APPRAISAL_RESULTS {
        serial id PK
        text crew_member_id FK
        integer form_id FK
        text appraisal_type
        text status
        text appraisal_data
    }
    
    CREW_MEMBERS ||--o{ VESSEL_PLANNING : assigned_to
    CREW_MEMBERS ||--o{ APPRAISAL_RESULTS : has
    VESSELS ||--o{ VESSEL_PLANNING : contains
```

## Rest Hours Module

```mermaid
erDiagram
    REST_HOURS_DAILY_RECORDS {
        serial id PK
        text crew_member_id FK
        text vessel_id
        text month_year
        text daily_records
        boolean show_planning
        boolean opa_mode
    }
    
    REST_HOURS_VESSEL_RECORDS {
        serial id PK
        text vessel_id
        text month_value
        integer total_crew
        integer total_violations
        text vessel_review_status
    }
    
    NC_REPORTS {
        serial id PK
        text crew_member_id FK
        text vessel_id
        text month_value
        text status
        text submission_status
    }
    
    VESSEL_VIOLATION_COMMENTS {
        serial id PK
        text vessel_id
        text month_value
        text comment
    }
    
    CREW_MEMBERS ||--o{ REST_HOURS_DAILY_RECORDS : records
    CREW_MEMBERS ||--o{ NC_REPORTS : has
```

## Forms & Appraisals

```mermaid
erDiagram
    FORMS {
        serial id PK
        text name
        text category
        text rank_group
        text version_no
        text configuration
    }
    
    FORM_VERSIONS {
        serial id PK
        integer form_id FK
        integer rank_group_id FK
        text version_no
        text status
        text configuration
    }
    
    RANK_GROUPS {
        serial id PK
        integer form_id FK
        text name
        text ranks
        timestamp archived_at
    }
    
    AVAILABLE_RANKS {
        serial id PK
        text name
        text category
        text rank_id
        boolean applicable_to_company
    }
    
    FORMS ||--o{ FORM_VERSIONS : has
    FORMS ||--o{ RANK_GROUPS : has
    RANK_GROUPS ||--o{ FORM_VERSIONS : has
```

## Training Matrix

```mermaid
erDiagram
    TRAINING_MASTER {
        serial id PK
        text training_id UK
        text training_name
        text category
        text training_group
        boolean applicable_to_company
    }
    
    COMPANY_TRAININGS {
        serial id PK
        integer training_master_id FK UK
        text company_id
        text training_label
        text group_code
    }
    
    COMPANY_TRAINING_REQUIREMENTS {
        serial id PK
        integer company_training_id FK
        integer rank_id FK
        text status
    }
    
    TRAINING_MASTER ||--o| COMPANY_TRAININGS : syncs_to
    COMPANY_TRAININGS ||--o{ COMPANY_TRAINING_REQUIREMENTS : has
    AVAILABLE_RANKS ||--o{ COMPANY_TRAINING_REQUIREMENTS : required_for
```

## Promotions

```mermaid
erDiagram
    PROMOTION_HIERARCHIES {
        serial id PK
        text from_rank
        text to_rank
        text criteria
    }
    
    PROMOTION_REVIEWS {
        serial id PK
        text crew_member_id FK
        text current_rank
        text promotion_to_rank
        text status
        text checklist_data
    }
    
    CREW_MEMBERS ||--o{ PROMOTION_REVIEWS : has
    PROMOTION_HIERARCHIES ||--o{ PROMOTION_REVIEWS : defines
```

## Master Data

```mermaid
erDiagram
    DATA_MASTERS {
        serial id PK
        text master_id UK
        text name
        text description
    }
    
    MASTER_DATA_ENTRIES {
        serial id PK
        integer master_id FK
        text entry_id
        text name
        text description
    }
    
    DATA_MASTERS ||--o{ MASTER_DATA_ENTRIES : contains
```
