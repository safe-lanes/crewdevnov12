# Business Logic Documentation

## Overview

This document describes the core business rules, workflows, and feature logic implemented in the Seafarer Performance Management System.

---

## 1. Rest Hours Management

### 1.1 What Are Rest Hours?

Rest hours tracking is a critical maritime compliance feature mandated by:
- **MLC 2006** (Maritime Labour Convention)
- **STCW** (Standards of Training, Certification and Watchkeeping)
- **ILO 180** (International Labour Organization)

These regulations ensure seafarers receive adequate rest to prevent fatigue-related accidents.

### 1.2 Recording Structure

#### Time Slots
- Each day is divided into **48 half-hour slots** (00:00-00:30, 00:30-01:00, ..., 23:30-24:00)
- Each slot can be marked as:
  - `"w"` - Watch duty
  - `"d"` - Day work
  - `"a"` - Anchor watch
  - `""` - Rest (empty string)

#### Data Storage
Records are stored per crew member, per vessel, per month in `rest_hours_daily_records`:
```json
{
  "crewMemberId": "A000452",
  "vesselId": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "monthYear": "2025-01",
  "dailyRecords": [
    {
      "day": 1,
      "dayOfWeek": "Wed",
      "hours": ["w","w","w","w","","","","","d","d","d","d",...],
      "isPlan": false,
      "comments": "",
      "violations": [3],
      "hoursOfRest24hr": 10.5,
      "hoursOfWork24hr": 13.5,
      ...
    }
  ]
}
```

### 1.3 Violation Types

| Code | Description | Window | Limit |
|------|-------------|--------|-------|
| 1 | Minimum 10 hours rest in any 24-hour period | 24 hours | < 10 hours rest |
| 2 | Minimum 77 hours rest in any 7-day period | 7 days | < 77 hours rest |
| 3 | Maximum 14 hours work in any 24-hour period | 24 hours | > 14 hours work |
| 4 | Minimum 6 hours continuous rest required | 24 hours | All rest periods < 6 hours |
| 5 | Maximum 2 rest periods per 24 hours | 24 hours | > 2 rest periods |
| 6 | Maximum 91 hours work in any 7-day period | 7 days | > 91 hours work |
| 7 | One rest period must be at least 6 consecutive hours | 24 hours | No 6-hour rest block |
| 8 | Interval between rest periods not to exceed 14 hours | 24 hours | Gap > 14 hours |

### 1.4 Violation Assignment Strategy

The system uses a **hybrid violation assignment strategy**:

- **24-hour violations (codes 1,3,4,5,7,8)**: Display on the day where the violation window **ends**
- **7-day violations (codes 2,6)**: Display on the **first day** they occur

This ensures violations are assigned to the day they can first be detected and corrected.

### 1.5 Rolling Window Calculations

For each day, the system calculates:
- **24-hour window**: Current day (for single-day violations)
- **48-hour window**: Current + previous day
- **96-hour window**: Current + previous 3 days
- **7-day window**: Current + previous 6 days

These calculations handle **cross-month boundaries** by loading previous month data.

### 1.6 Rest Hours Workflow

```
Recording → Vessel Review → Office Review → Completed

Statuses:
- Due: Month ended, review not submitted
- Overdue: 7 days past month end, not submitted
- Completed: Review submitted
```

### 1.7 NC Reports (Non-Conformity)

When violations occur, NC reports must be created:
1. **Vessel creates NC report** with root cause analysis
2. **Vessel submits** to office
3. **Office reviews** and verifies closure
4. **Report closed** when preventive action completed

---

## 2. Crew Management

### 2.1 Crew Member Lifecycle

```
Recruitment → Crew Pool → Vessel Assignment → Active Service
                                    ↓
                              Sign Off → On Leave → Re-assignment
                                    ↓
                                Inactive
```

### 2.2 Status Definitions

| Status | Description |
|--------|-------------|
| On Board | Currently assigned and on vessel |
| On Leave | Between assignments, available |
| Inactive | No longer active (left company) |

### 2.3 Crew ID Format

- Format: `A######` (e.g., A000452)
- Auto-generated on creation
- Primary key for crew_members table

### 2.4 Vessel Assignment

Crew-vessel assignments are tracked in `vessel_planning`:
- **Primary Crew**: Currently on board
- **Secondary Crew**: Planned replacement/reliever
- **Handover Status**: Tracking crew transitions

---

## 3. Vessel Management

### 3.1 Vessel Identification

- **Vessel ID**: UUID from external SAIL ERP (Master 014)
- **Vessel Name**: Human-readable name displayed in UI
- **Translation Layer**: Backend uses IDs, frontend displays names

### 3.2 Vessel Rank Configuration

Each vessel has configured ranks through the revision system:

```
Draft → Submit → Revision (R1, R2, R3...)
```

**Revision Data Structure:**
```json
[
  {
    "rankId": "R001",
    "rank": "Master",
    "actualManningFlag": true,
    "category": "Senior Officers"
  },
  {
    "rankId": "R002",
    "rank": "Chief Officer",
    "actualManningFlag": true,
    "category": "Senior Officers"
  }
]
```

### 3.3 Officer Matrix

The Officer Matrix displays:
- All officers assigned to a vessel
- Experience calculations (tanker type, all tankers, with operator)
- Time on board (months since sign-on)
- Compliance status per oil major

---

## 4. Appraisal System

### 4.1 Appraisal Types

From Appraisal Type Master (023):
- End of Contract
- Mid Term
- Special
- Probation

### 4.2 3-Stage Workflow

```
┌─────────────────────────────────────────────────────┐
│  Stage 1: Initial Assessment                        │
│  - Seafarer info, period, appraiser assignment     │
│  - Submitted by: Primary Appraiser                 │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Stage 2: Competence & Behavioral Assessment       │
│  - Ratings, training needs, recommendations        │
│  - Submitted by: Appraiser                         │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Stage 3: Office Review                            │
│  - Office comments, training follow-up             │
│  - Submitted by: Office Personnel                  │
└─────────────────────────────────────────────────────┘
```

### 4.3 Rank Group Configuration

Forms are configured per rank group:
- Each rank can only belong to one active rank group
- Rank groups define which form sections are visible
- Configuration stored in `rank_groups.configuration` JSON

### 4.4 Score Calculations

```typescript
// Competence Score (Part D)
competenceScore = average of all competence ratings (1-5 scale)

// Behavioral Score (Part D)
behavioralScore = average of all behavioral ratings (1-5 scale)

// Overall Score
overallScore = (competenceScore + behavioralScore) / 2
```

---

## 5. Promotion System

### 5.1 Promotion Hierarchy

Configurable promotion paths define:
- Current rank → Next possible rank
- Minimum criteria for promotion
- Required approvals

### 5.2 Promotion Review Process

```
Initiate Review → Complete Checklist → Submit for Approval → Approved/Rejected
```

### 5.3 Criteria Validation

The system validates against A2 Minimum Promotion Criteria:
- Sea service requirements
- Training certifications
- Appraisal scores
- Experience thresholds

---

## 6. Training Matrix

### 6.1 Training Structure

```
Training Master (Global)
    ↓ "Applicable to Company" = true
Company Trainings (Company-specific)
    ↓
Company Training Requirements (Rank-specific M/R status)
```

### 6.2 Training Categories

| Code | Category |
|------|----------|
| S | Statutory (mandatory by law) |
| N | Non-Statutory (industry best practice) |
| M | Others |

### 6.3 Training Groups

Trainings organized into groups A-J:
- A: Safety
- B: Security
- C: Cargo
- D: Navigation
- E: Engine
- F: Environment
- G: General
- H-J: Custom company groups

### 6.4 Requirement Status

| Status | Meaning |
|--------|---------|
| M | Mandatory for rank |
| R | Recommended for rank |
| null | Not required |

---

## 7. Oil Major Compliance

### 7.1 Overview

Oil major companies (BP, Chevron, Shell, etc.) have specific requirements for tanker crews. The compliance engine validates crew experience against these rules.

### 7.2 Compliance Categories

| Category | Description |
|----------|-------------|
| Years with Operator | Time with current company |
| Years in Rank | Time in current rank |
| Years on Tanker Types | Experience on specific vessel types |
| Years on All Tankers | Total tanker experience |
| Years as OOW | Officer of the Watch experience |
| Date Joined Gap | Maximum gap since last service |
| Language Proficiency | English proficiency requirement |

### 7.3 Rank Pair Logic

Rules can apply to:
- Individual ranks (e.g., Master only)
- Rank pairs (e.g., Master + Chief Officer combined)

### 7.4 Compliance Status

| Status | Color | Meaning |
|--------|-------|---------|
| Compliant | Green | Meets all requirements |
| Warning | Yellow | Close to non-compliance |
| Non-Compliant | Red | Does not meet requirements |

---

## 8. Rotation Planning

### 8.1 Rotation Due Calculation

Crew are "due" for rotation based on:
- Contract period (typically 6-9 months)
- Relief due date
- Company rotation policy

### 8.2 Rotation Workflow

```
Due Crew Identified → Create Rotation Plan → Propose Deployment
           ↓
Office Reviews → Approve/Reject → Deploy (update vessel planning)
```

### 8.3 Conflict Detection

The system checks for:
- Double bookings (same crew assigned to multiple vessels)
- Skill/rank mismatches
- Certification expiry conflicts

---

## 9. Drug & Alcohol Testing

### 9.1 Test Types

| Type | Frequency |
|------|-----------|
| Monthly | Every month |
| Periodic | Quarterly/semi-annual |
| Annual | Once per year |
| Post-Incident | After any incident |
| Other | Ad-hoc testing |

### 9.2 Test Record Structure

```json
{
  "crewMemberId": "A000452",
  "vesselId": "7440571a-...",
  "testDate": "2025-01-15",
  "testType": "Monthly",
  "drugResult": "Negative",
  "alcoholResult": "Negative",
  "notes": ""
}
```

---

## 10. Data Validation Rules

### 10.1 Crew Member Validation

- `firstName` and `nationality` are required
- `presentRank` and `presentVessel` required when active
- `email` must be valid format (if provided)
- `dateOfBirth` must be valid date string

### 10.2 Rest Hours Validation

- `monthYear` must be format "YYYY-MM"
- `dailyRecords` array must have entries for all days in month
- Each `hours` array must have exactly 48 elements
- Each element must be "w", "d", "a", or ""

### 10.3 Appraisal Validation

Stage-specific validation:
- **Stage 1**: Basic crew info required
- **Stage 2**: All competence/behavioral ratings required
- **Stage 3**: Office review fields required

---

## 11. Business Rules Summary

### Critical Rules

1. **Unique Constraints**: Only one rest hours record per crew/vessel/month
2. **Rank Group Uniqueness**: Each rank can only belong to one active rank group per form
3. **Vessel Configuration Required**: Vessel must have rank configuration before crew can be added
4. **Soft Delete**: Recruitment candidates are soft-deleted (is_delete flag)
5. **Cascade Delete**: Form versions deleted when parent form deleted

### Data Integrity

1. **Upsert Logic**: Rest hours uses upsert to prevent duplicates
2. **Unique Index**: Database constraint prevents duplicate rest hour records
3. **Foreign Keys**: Appraisals reference crew_members and forms tables
4. **JSON Validation**: Complex nested data validated before storage
