# System Workflow Diagrams

## Appraisal 3-Stage Workflow

```mermaid
flowchart TD
    A[Create Appraisal] --> B[Draft Status]
    B --> C{Stage 1 Complete?}
    C -->|No| B
    C -->|Yes| D[Submit Stage 1]
    D --> E[Preliminary Status]
    E --> F{Stage 2 Complete?}
    F -->|No| E
    F -->|Yes| G[Submit Stage 2]
    G --> H[Submitted Status]
    H --> I{Office Review?}
    I -->|No| H
    I -->|Yes| J[Submit Stage 3]
    J --> K[Reviewed Status]
    K --> L[Complete]
```

## Rest Hours Recording Flow

```mermaid
flowchart TD
    A[Select Crew Member] --> B[Select Month]
    B --> C[Load Existing Record or Create New]
    C --> D[RH Recording Form]
    D --> E{Mark Hours}
    E --> F[Work/Rest/Duty Selection]
    F --> G[Auto-Calculate Violations]
    G --> H{Violations Detected?}
    H -->|Yes| I[Highlight Violations]
    H -->|No| J[No Violations]
    I --> K[Auto-Save Draft]
    J --> K
    K --> L{All Days Complete?}
    L -->|No| E
    L -->|Yes| M[Month Complete]
```

## Rest Hours Review Workflow

```mermaid
flowchart TD
    A[Month Ends] --> B[Status: Due]
    B --> C{7 Days Passed?}
    C -->|Yes| D[Status: Overdue]
    C -->|No| B
    D --> E{Vessel Submits Review?}
    B --> E
    E -->|Yes| F[Vessel Review Complete]
    F --> G[Office Review Due]
    G --> H{Office Submits Review?}
    H -->|Yes| I[Status: Completed]
    H -->|No| J{10 Days Passed?}
    J -->|Yes| K[Office Review Overdue]
    J -->|No| G
```

## NC Report Workflow

```mermaid
flowchart TD
    A[Violations Detected] --> B[Create NC Report]
    B --> C[Status: Draft]
    C --> D[Vessel Enters Root Cause]
    D --> E[Vessel Enters Corrective Action]
    E --> F[Vessel Submits]
    F --> G[Status: Vessel-Submitted]
    G --> H[Office Reviews]
    H --> I{Preventive Action Complete?}
    I -->|No| J[Set Due Date]
    J --> K[Monitor Progress]
    K --> I
    I -->|Yes| L[Office Verifies Closure]
    L --> M[Status: Office-Submitted]
    M --> N[NC Report Closed]
```

## Crew Rotation Workflow

```mermaid
flowchart TD
    A[Identify Due Crew] --> B[Create Rotation Plan]
    B --> C[Select Reliever]
    C --> D[Set Dates]
    D --> E[Propose for Approval]
    E --> F{Conflicts?}
    F -->|Yes| G[Resolve Conflicts]
    G --> E
    F -->|No| H[Pending Approval]
    H --> I{Approved?}
    I -->|No| J[Rejected - Revise]
    J --> B
    I -->|Yes| K[Deploy]
    K --> L[Update Vessel Planning]
    L --> M[Reliever Assigned]
```

## Promotion Review Flow

```mermaid
flowchart TD
    A[Identify Promotion Candidate] --> B[Check Eligibility]
    B --> C{Meets Criteria?}
    C -->|No| D[Not Eligible]
    C -->|Yes| E[Create Review]
    E --> F[Complete Checklist]
    F --> G[Submit for Approval]
    G --> H{All Items Checked?}
    H -->|No| I[Return for Completion]
    I --> F
    H -->|Yes| J[Manager Review]
    J --> K{Approved?}
    K -->|No| L[Rejected]
    K -->|Yes| M[Promotion Approved]
    M --> N[Update Crew Rank]
```

## Vessel Configuration Flow

```mermaid
flowchart TD
    A[Select Vessel] --> B{Existing Config?}
    B -->|Yes| C[Load Draft]
    B -->|No| D[Create New Draft]
    C --> E[Edit Rank Configuration]
    D --> E
    E --> F[Save Draft]
    F --> G{Ready to Submit?}
    G -->|No| E
    G -->|Yes| H[Submit Revision]
    H --> I[Create Revision R1/R2/etc]
    I --> J[Configuration Active]
```

## Oil Major Compliance Check

```mermaid
flowchart TD
    A[Select Vessel] --> B[Load Officer Matrix]
    B --> C[Select Oil Major]
    C --> D[Load Compliance Rules]
    D --> E[For Each Officer]
    E --> F[Calculate Experience]
    F --> G[Check Years with Operator]
    G --> H[Check Years in Rank]
    H --> I[Check Tanker Experience]
    I --> J[Check Language Proficiency]
    J --> K{All Rules Pass?}
    K -->|Yes| L[Green - Compliant]
    K -->|Some| M[Yellow - Warning]
    K -->|No| N[Red - Non-Compliant]
    L --> O[Display Result]
    M --> O
    N --> O
```

## Data Flow: Rest Hours Recording

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as Express API
    participant DB as PostgreSQL
    
    U->>FE: Open RH Recording Form
    FE->>API: GET /api/rest-hours-daily-records/by-key/:crew/:vessel/:month
    API->>DB: SELECT from rest_hours_daily_records
    DB-->>API: Record or null
    API-->>FE: Existing record or empty template
    FE-->>U: Display form
    
    U->>FE: Mark hours (work/rest)
    FE->>FE: Auto-calculate violations
    FE->>FE: Update UI (highlight violations)
    
    U->>FE: Navigate away / Auto-save triggered
    FE->>API: POST /api/rest-hours-daily-records (upsert)
    API->>DB: INSERT ... ON CONFLICT UPDATE
    DB-->>API: Saved record
    API-->>FE: Success response
    FE-->>U: Save confirmed
```
