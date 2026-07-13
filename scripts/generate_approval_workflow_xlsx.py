"""
Generate Crewing Approval Workflow Register Excel file.
Matches the format of Crewing_Module_Approval_Workflows_Sample_File.xlsx.
Output: attached_assets/Crewing_Approval_Workflow_Register.xlsx
"""

import re
import os
from openpyxl import Workbook
from openpyxl.styles import (
    Font, PatternFill, Alignment, Border, Side
)
from openpyxl.utils import get_column_letter

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clean(text):
    """Strip markdown bold markers and normalise <br> to newlines."""
    if not text:
        return ""
    text = text.replace("<br><br>", "\n\n").replace("<br>", "\n")
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)  # remove **bold**
    text = text.strip()
    return text


def side(style="thin"):
    return Side(border_style=style)


def border(top=None, bottom=None, left=None, right=None):
    return Border(top=top, bottom=bottom, left=left, right=right)


def thin_border():
    s = side("thin")
    return Border(top=s, bottom=s, left=s, right=s)


# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------

NAVY        = "1B3A5C"   # title row
MID_BLUE    = "2E5F8E"   # section header
HDR_BLUE    = "4472C4"   # column header row
ROW_ALT     = "EEF4FF"   # alternate data row tint
AMBER       = "FFC000"   # Critical type cell
WHITE       = "FFFFFF"
LIGHT_GREY  = "F2F2F2"

# Fonts
def white_bold(size=11):
    return Font(bold=True, color=WHITE, size=size)

def black(size=10):
    return Font(size=size)

def black_bold(size=10):
    return Font(bold=True, size=size)

# Fills
def fill(hex_color):
    return PatternFill(fill_type="solid", start_color=hex_color, end_color=hex_color)

# Alignment helpers
WRAP_TOP    = Alignment(wrap_text=True, vertical="top")
WRAP_CENTER = Alignment(wrap_text=True, vertical="center", horizontal="center")
CENTER      = Alignment(horizontal="center", vertical="center")

# ---------------------------------------------------------------------------
# DATA — all 62 items
# (item_no, process, type, step1, step2, step3, step4, step5, step6, step7)
# ---------------------------------------------------------------------------

SECTIONS = [
    {
        "letter": "A",
        "header": (
            "A.  RECRUITMENT  (Application Processing & Approval)   |   "
            "Normal = single approver   |   Critical = two-level approvers   |   "
            "Level 1 = Crewing Manager   |   Level 2 = Fleet Personnel Manager   |   "
            "[ASSUMPTION A1] Two-level approval via multiple approver selection at B8; no enforced ordering in code."
        ),
        "rows": [
            (1, "Recruitment Application — Create\n(Part A — Candidate Profile)", "Normal",
             "[Manning Agent / Crewing Executive]\n\nEnter candidate name, rank applied for, nationality, DOB, gender\nEnter personal details, family info, next-of-kin, addresses\nEnter documents, visas, licenses, training courses, sea service, education\nAttach supporting documents and photo\n\nStatus (of Application): → Draft\nAudit: rec_can_uuid auto-assigned; created_by_uuid, created_at stamped",
             "[System]\n\nAuto-assign rec_can_uuid\nAuto-assign file_no", "", "", "", "", ""),

            (2, "Recruitment Application — B1 Initial Screening", "Normal",
             "[Crewing Executive]\n\nOpen candidate in Draft status\nVerify: age meets criteria, rank meets criteria, certificates valid\nRecord shortlisted: Yes / No\nAdd comments and attachments\nSubmit B1\n\nStatus (of B1 stage): → Submitted\nsubmitted_by_uuid + submitted_date stamped",
             "", "", "", "", "", ""),

            (3, "Recruitment Application — B2 Reference Checks", "Normal",
             "[Crewing Executive]\n\nContact previous employers\nRecord reference contact names, dates, contact info\nRecord employer feedback\nMark references_completed: Yes / No\nAdd comments and attachments\nSubmit B2\n\nStatus (of B2 stage): → Submitted\nsubmitted_by_uuid + submitted_date stamped",
             "", "", "", "", "", ""),

            (4, "Recruitment Application — B3 Background & Security Checks", "Normal",
             "[Crewing Executive]\n\nSubmit candidate details to security authorities\nRecord authority names and check dates\nRecord results\nMark checks_completed: Yes / No\nAdd comments and attachments\nSubmit B3\n\nStatus (of B3 stage): → Submitted\nsubmitted_by_uuid + submitted_date stamped",
             "", "", "", "", "", ""),

            (5, "Recruitment Application — B4 Authentication of Certificates & Documents", "Normal",
             "[Crewing Executive]\n\nAuthenticate certificates against issuing authorities\nRecord authentication date and authority per certificate item\nMark certificates_authenticated: Yes / No\nAdd comments and attachments\nSubmit B4\n\nStatus (of B4 stage): → Submitted\nsubmitted_by_uuid + submitted_date stamped",
             "", "", "", "", "", ""),

            (6, "Recruitment Application — B5 CES / Language Tests", "Normal",
             "[Crewing Executive]\n\nSchedule and administer CES and language proficiency tests\nRecord subject, score, result per test item\nMark tests_completed: Yes / No\nAdd comments and attachments\nSubmit B5\n\nStatus (of B5 stage): → Submitted\nsubmitted_by_uuid + submitted_date stamped",
             "", "", "", "", "", ""),

            (7, "Recruitment Application — B6 Interviews", "Normal",
             "[Crewing Executive / Crewing Manager]\n\nSchedule interview; record interviewer UUID, interview date\nRecord status and result per interview\nAdd comments\nMark interview_completed: Yes / No\nSubmit B6\n\nStatus (of B6 stage): → Submitted\nsubmitted_by_uuid + submitted_date stamped",
             "", "", "", "", "", ""),

            (8, "Recruitment Application — B7 Training Needs Identified", "Normal",
             "[Crewing Executive]\n\nIdentify training gaps from B1–B6 evidence and certificate matrix\nEnter training items: training name, category, due date, identified_by\nSubmit B7\n\nStatus (of B7 stage): → Submitted\nsubmitted_by_uuid + submitted_date stamped",
             "[System]\n\nTraining need items auto-created in Training & Retention module\nSource: \"recruitment\"\nStatus (of each Training Need): → Pending",
             "", "", "", "", ""),

            (9, "Recruitment Application — B8 Shortlisting & Submission for Approval", "Normal",
             "[Crewing Executive]\n\nReview B1–B7 outcomes\nMark shortlisted: Yes / No\nSelect approver(s) from user list (stored as selected_approver_uuids)\nSubmit for approval\n\nStatus (of Application): → For Approval\nsubmitted_by_uuid + submitted_date stamped on B8\n\n⚠️ GAP: Notification sent to [Crewing Manager] — not implemented",
             "[System]\n\nApproval rows created in cand_approvals per selected approver\nStatus (of each Approval row): → Pending",
             "", "", "", "", ""),

            (10, "Recruitment Application — Approve\n(Part C — Normal, single-level)", "Normal",
             "[Crewing Manager]\n\nReview Part A candidate profile\nReview Part B screening evidence (B1–B8)\nComplete Part C1: record approval_result\nComplete Part C2: record Suitable For (vessel types, fleet groups in cand_suitability)\nComplete Part C3: set recruitment_status = Recruited, enter recruited_date\n\nStatus (of Approval row): → Approved\nStatus (of Application): → Recruited\nsubmitted_by_uuid + submitted_date stamped on cand_recruitment_decision",
             "[System]\n\nCrew record auto-created in crew_members_v2\ncrew_uuid assigned; status: Active; isActive: true\nB7 training needs retained in Training & Retention module\nAudit: created_by_uuid, created_at stamped",
             "", "", "", "", ""),

            (11, "Recruitment Application — Approve\n(Part C — Critical, two-level)\n[ASSUMPTION A1]", "Critical",
             "[Crewing Manager]\n\nReview Part A + Part B evidence\nComplete Part C1 at Level 1\nSet approval_result (Level 1 approval row)\n\nStatus (of L1 Approval row): → Approved",
             "[Fleet Personnel Manager]\n\nReview Part A + Part B evidence and L1 decision\nComplete Part C1 at Level 2\nComplete Part C2 — Suitable For\nComplete Part C3 — set recruitment_status = Recruited\n\nStatus (of L2 Approval row): → Approved\nStatus (of Application): → Recruited (triggered when all approval rows = Approved)",
             "[System]\n\nCrew record auto-created in crew_members_v2\ncrew_uuid assigned; status: Active; isActive: true\nB7 training needs retained",
             "", "", "", ""),

            (12, "Recruitment Application — Reject\n(Part C — deficiency found)", "Normal",
             "[Crewing Manager]\n\nReview Part A + Part B evidence\nEnter mandatory rejection reason in comments field\nSet approval_result = Rejected\n\nStatus (of Approval row): → Rejected\nStatus (of Application): → Rejected\n\n⚠️ GAP: Notification sent to [Crewing Executive] — not implemented",
             "[System]\n\nRecord retained for audit\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", ""),

            (13, "Recruitment Application — Waitlist\n(qualified but no current vacancy)", "Normal",
             "[Crewing Manager]\n\nReview Part A + Part B evidence\nSet recruitment_status = Waitlisted\nEnter comments (reason for waitlisting)\n\nStatus (of Application): → Waitlisted\n\n⚠️ GAP: Notification sent to [Crewing Executive] — not implemented",
             "[System]\n\nRecord retained; can be re-evaluated when vacancy arises\nAudit: submitted_by_uuid, submitted_date stamped",
             "", "", "", "", ""),
        ]
    },
    {
        "letter": "B",
        "header": (
            "B.  CREW POOL / CREW DATABASE  (Change Requests to Seafarer Records)   |   "
            "Normal = direct write, no approval level in current code   |   "
            "⚠️ GAP G1: Approval gaps noted — see Gaps & Recommendations"
        ),
        "rows": [
            (14, "Crew Record — Create\n(auto-transfer from Recruited candidate)", "Normal",
             "[System]\n\nTriggered when cand_recruitment_decision.recruitment_status = Recruited\nPOST /api/v2/crew-pool/transfer/recruitment\nCandidate data copied to crew_members_v2\ncrew_uuid auto-assigned\n\nStatus (of Crew): → Active (isActive: true)\nAudit: created_by_uuid, created_at stamped",
             "[Crewing Executive]\n\nVerify transferred record in Crew Pool\nComplete additional sections: medical, travel documents, emergency contacts, flag-state documents\n\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", ""),

            (15, "Crew Record — Create\n(manual entry, not via Recruitment module)", "Normal",
             "[Crewing Executive]\n\nPOST /api/v2/crew-pool/crew\nEnter crew personal details, rank, nationality, DOB\nEnter certificates, licenses, sea service, medical, documents\n\nStatus (of Crew): → Active (isActive: true)\ncrew_uuid auto-assigned\nAudit: created_by_uuid, created_at stamped",
             "", "", "", "", "", ""),

            (16, "Crew Record — Update Particulars / Documents / Certificates / Sea Service", "Normal",
             "[Crewing Executive]\n\nEdit any section of the crew profile\n(personal details, documents, licenses, sea service, medical, addresses, NOK)\n\nStatus (of Crew): No change\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", "", ""),

            (17, "Crew Termination — Company-Initiated\n(General / UT / BT)\n⚠️ GAP G1: no approval step; direct write", "Normal",
             "[Crewing Executive]\n\nOpen crew record\nSelect initiated_by: Company\nSelect category: General / Unavoidable Termination (UT) / Beneficial Termination (BT)\nSelect reason: Poor Performance / Disciplinary / No suitable vessel / Unresponsive / Other\nEnter effective termination date and notes\nSet not_for_hire flag if applicable\nPOST /api/v2/crew-pool/crew/:crewUuid/terminations\n\nStatus (of Crew): → Terminated\nAudit: created_by_uuid, created_at stamped on crew_terminations",
             "[System]\n\ncrew_members_v2.status → Terminated\nActive vessel assignments cleared\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", ""),

            (18, "Crew Termination — Crew-Initiated\n(Resignation)\n⚠️ GAP G1: no approval step; direct write", "Normal",
             "[Crewing Executive]\n\nOpen crew record\nSelect initiated_by: Crew Member (resignation)\nCategory: General\nReason: Resignation\nEnter effective date and notes\nPOST /api/v2/crew-pool/crew/:crewUuid/terminations\n\nStatus (of Crew): → Terminated\nAudit: created_by_uuid, created_at stamped on crew_terminations",
             "[System]\n\ncrew_members_v2.status → Terminated\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", ""),

            (19, "Crew Record — Archive / Deactivate (soft-delete)", "Normal",
             "[Crewing Executive]\n\nSoft-delete crew record\nDELETE /api/v2/crew-pool/crew/:crewUuid\n\nStatus (of Crew): → Inactive (is_deleted: true, isActive: false)\narchived_at stamped\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", "", ""),
        ]
    },
    {
        "letter": "C",
        "header": (
            "C.  VESSEL ASSIGNMENT & ROTATION  (Crew Lineup / Relief Planning)   |   "
            "Critical = Top-4 Officers (Master, C/O, C/E, 2/E)   |   "
            "Level 1 = Crewing Manager   |   Level 2 = Fleet Personnel Manager   |   "
            "[ASSUMPTION A2] Critical flag for top-4 ranks not implemented in code; recommended pattern only."
        ),
        "rows": [
            (20, "Rotation Plan — Create Draft", "Normal",
             "[Crewing Executive / Crewing Manager]\n\nCreate new rotation draft for a vessel and planning period\nAdd rotation entries: planned crew, reliever candidates, proposed dates, remarks\n\nStatus (of Plan): → In Draft\nStatus (of Entries): → Pending\nAudit: created_by_uuid, created_at stamped",
             "", "", "", "", "", ""),

            (21, "Rotation Plan — Propose (Submit for Review)", "Normal",
             "[Crewing Executive / Crewing Manager]\n\nReview all entries in draft\nTrigger Propose action on the plan\n\nStatus (of Plan): In Draft → Proposed\nAudit: updated_by_uuid, updated_at stamped\n\n⚠️ GAP: Notification sent to [Crewing Manager] — not implemented",
             "", "", "", "", "", ""),

            (22, "Rotation Entry — Deploy (Approve Assignment)\n— Normal rank", "Normal",
             "[Crewing Manager]\n\nOpen Proposed plan in Approval table\nReview entry: crew member, vessel, dates, rank match, documentation status\nConfirm suitability and regulatory compliance\nClick Deploy\n\nStatus (of Entry): Pending → Deployed\nStatus (of Plan): → Partially Approved (other entries pending) or Completed (all deployed)\nAudit: updated_by_uuid, updated_at stamped\n\n⚠️ GAP: Notification sent to [Crewing Executive] — not implemented",
             "[System]\n\nvessel_planning_v2 record created\njoining_status: → Planned\nreliever crew UUID set on planning record\ncrew_assignments row created: type = Planned, isCurrent = false\nAudit: created_by_uuid, created_at stamped",
             "", "", "", "", ""),

            (23, "Rotation Entry — Deploy (Approve Assignment)\n— Top-4 rank [ASSUMPTION A2]", "Critical",
             "[Crewing Manager]\n\nReview entry for top-4 officer: flag, endorsements, STCW qualifications, GMDSS (if applicable)\nApprove at Level 1\n\nStatus (of Entry): Pending → reviewed by L1\nAudit: updated_by_uuid stamped",
             "[Fleet Personnel Manager]\n\nFinal review and sign-off\nConfirm deployment\n\nStatus (of Entry): → Deployed\nStatus (of Plan): → Partially Approved / Completed\nAudit: updated_by_uuid stamped\n\n⚠️ GAP: Notification sent to [Crewing Executive] — not implemented",
             "[System]\n\nvessel_planning_v2 record created\njoining_status: → Planned\ncrew_assignments: Planned, isCurrent: false",
             "", "", "", ""),

            (24, "Rotation Entry — Reject", "Normal",
             "[Crewing Manager]\n\nReview proposed entry\nEnter mandatory rejection_reason\nClick Reject\n\nStatus (of Entry): Pending → Rejected\nAudit: updated_by_uuid, updated_at stamped\n\n⚠️ GAP: Notification sent to [Crewing Executive] — not implemented",
             "[Crewing Executive]\n\nReview rejection reason\nIdentify alternative crew or revised dates\nUpdate draft and re-propose",
             "", "", "", "", ""),

            (25, "Vessel Planning — Update Reliever Joining Status", "Normal",
             "[Crewing Executive]\n\nAs reliever travel progresses, update joining_status\nPlanned → Confirmed (ticket booked)\nConfirmed → In Transit (en route to vessel)\n\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", "", ""),

            (26, "Vessel Planning — Sign-On", "Normal",
             "[Crewing Executive / Master]\n\nConfirm joining date on board\nTrigger Sign-On action\n\nStatus (of Joining): → Signed On\nReliever promoted to primary crew in vessel_planning_v2\ncrew_assignments updated: type → OnBoard, isCurrent: true\nPrevious primary crew assignment ended (isCurrent: false)\nAudit: updated_by_uuid, updated_at stamped",
             "[System]\n\nCrew status display: → On Board\nnextAvailability cleared for signing-on crew",
             "", "", "", "", ""),

            (27, "Vessel Planning — Sign-Off", "Normal",
             "[Crewing Executive / Master]\n\nRecord sign-off date\nRecord sign_off_reason\nComplete Part G (Briefing & De-briefing) if applicable\n\nStatus (of Crew): → On Leave (assignment isCurrent: false; no active assignment)\nAudit: updated_by_uuid, updated_at stamped",
             "[System]\n\nCrew status display: → On Leave\navailability / nextAvailability date set\nRelief planning cycle begins for the vessel",
             "", "", "", "", ""),

            (28, "Rotation Plan — Archive", "Normal",
             "[Crewing Manager]\n\nArchive completed or superseded plan\n\nStatus (of Plan): → Archived\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", "", ""),
        ]
    },
    {
        "letter": "D",
        "header": (
            "D.  PROMOTIONS   |   "
            "Normal = single-level   |   Critical = senior rank or cross-fleet [ASSUMPTION A3]   |   "
            "Level 1 = Crewing Manager   |   Level 2 = Fleet Personnel Manager   |   "
            "Trigger: Appraisal recommendation or eligibility matrix"
        ),
        "rows": [
            (29, "Promotion Review — Create", "Normal",
             "[Crewing Executive / Crewing Manager]\n\nCreate promotion review record for crew member\nSelect crew, from_rank, proposed to_rank\nReview eligibility criteria (verified_status, meets_status per criterion)\nView promotion recommendation count from recent appraisals\n\nStatus (of Review): → draft / in progress\nisLockForm: false\nform_version_uuid pinned at creation\nAudit: created_by_uuid, created_at stamped",
             "", "", "", "", "", ""),

            (30, "Promotion Review — Submit for Approval", "Normal",
             "[Crewing Executive / Crewing Manager]\n\nComplete all promotion review particulars\nAssign approver(s) in promo_approvals_v2\nSubmit for approval\n\nStatus (of Review): in progress → submitted / for approval\nApproval rows: status → Pending\nAudit: updated_by_uuid, updated_at stamped\n\n⚠️ GAP: Notification sent to [Crewing Manager / Fleet Personnel Manager] — not implemented",
             "", "", "", "", "", ""),

            (31, "Promotion Review — Approve\n(on-board or prior-joining)", "Normal",
             "[Crewing Manager]\n\nReview promotion case: criteria, appraisal recommendations, sea service\nSet promotionConfirmed: yes\nSet promotionTiming: on-board or prior-joining\nRecord approval decision on promo_approvals_v2 row\n\nStatus (of Approval row): Pending → Approved\nStatus (of Review): → approved\nisLockForm: true\nAudit: updated_by_uuid, updated_at stamped\n\n⚠️ GAP: Notification sent to [Crewing Executive] — not implemented",
             "[System]\n\nIf timing = prior-joining:\nPromotion displayed as (PR) marker in Rotation Planning until sign-on\nIf timing = on-board:\nPromotion ready for execution on next sign-on event",
             "", "", "", "", ""),

            (32, "Promotion Review — Reject", "Normal",
             "[Crewing Manager]\n\nReview promotion case\nSet promotionConfirmed: rejected\nEnter mandatory rejection comments\n\nStatus (of Approval row): Pending → Rejected\nStatus (of Review): remains \"for approval\" with rejection noted on approval row — see GAP G11\nAudit: updated_by_uuid, updated_at stamped\n\n⚠️ GAP: Notification sent to [Crewing Executive] — not implemented",
             "", "", "", "", "", ""),

            (33, "Promotion Review — Waitlist", "Normal",
             "[Crewing Manager]\n\nSet promotionConfirmed: waitlist\nEnter reason (qualified but no position available)\n\nStatus (of Review): → Waitlisted (reflected via promotionConfirmed value)\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", "", ""),

            (34, "Promotion Review — Execute\n(Rank Flip — Complete)", "Normal",
             "[Crewing Executive / Crewing Manager]\n\nAfter sign-on event (on-board timing) or before joining (prior-joining timing)\nExecute promotion\n\nStatus (of Review): approved → completed\nisLockForm: true (full lock)\nAudit: updated_by_uuid, updated_at stamped",
             "[System]\n\nWrite to promo_execution_ledger_v2: from_rank → to_rank (at-most-once per review_uuid)\ncrew_members_v2 rank updated\nNew wage scale look-up triggered in Crew Accounts if rank change affects pay element",
             "", "", "", "", ""),
        ]
    },
    {
        "letter": "E",
        "header": (
            "E.  APPRAISALS   |   "
            "Normal = stage-gate progression (no rejection path in current code)   |   "
            "Level 1 = Vessel HOD / Master (Stage 1–2)   |   Level 2 = Crewing Manager (Stage 3 Office Review)   |   "
            "⚠️ GAP G5: No seafarer acknowledgement step between Stage 2 and Stage 3"
        ),
        "rows": [
            (35, "Appraisal — Stage 1 Submission\n(Seafarer Info & Start Info → Preliminary)", "Normal",
             "[Vessel HOD / Master]\n\nCreate appraisal record for seafarer\nComplete Stage 1: seafarer info, appraisal period, vessel, appraisal start information\nSubmit Stage 1\n\nStatus (of Appraisal): draft → preliminary\nstage1_status: → completed\nform_version_uuid pinned at creation\nisLockForm: false\nAudit: created_by_uuid, updated_by_uuid, updated_at stamped",
             "[System]\n\nGuard: submission accepted from any status below \"submitted\"\nRecord visible to Office users in preliminary state",
             "", "", "", "", ""),

            (36, "Appraisal — Stage 2 Submission\n(Performance Assessment → Submitted)", "Normal",
             "[Vessel HOD / Master]\n\nRequires: stage1_status = completed\nComplete all competence assessments (Part B sections)\nComplete recommendations sections\nSubmit Stage 2\n\nStatus (of Appraisal): preliminary → submitted\nstage2_status: → completed\nisLockForm: → true (performance assessment sections locked)\nAudit: updated_by_uuid, updated_at stamped",
             "[System]\n\nGuard enforced: stage2 blocked if stage1_status ≠ completed\nisLockForm snapshot taken; performance fields read-only hereafter\nAppraisal now actionable by Office",
             "", "", "", "", ""),

            (37, "Appraisal — Stage 3 Submission\n(Office Review & Follow-up → Reviewed)\n⚠️ GAP G5: no seafarer acknowledgement step", "Normal",
             "[Crewing Manager / Crewing Executive]\n\nRequires: stage2_status = completed\nRequires: all B1 training row evaluations are non-empty\nComplete office review and follow-up sections\nUpdate training follow-up statuses as applicable\nSubmit Stage 3\n\nStatus (of Appraisal): submitted → reviewed\nstage3_status: → completed\nisLockForm: → true (entire form locked)\nAudit: updated_by_uuid, updated_at stamped",
             "[System]\n\nGuard enforced: stage3 blocked if stage2_status ≠ completed or any training evaluation empty\nPromotion recommendations count updated (visible to Promotions module)\nTraining follow-up items visible for status updates",
             "", "", "", "", ""),

            (38, "Appraisal — Training Follow-up Status Update\n(within Stage 3 Office Review)", "Normal",
             "[Crewing Manager / Crewing Executive]\n\nFor each identified training item in the appraisal\nUpdate training follow-up status: Proposed → Approved → Planned → Completed / Declined\nEnter comments per item\n\nAudit: updated_by_uuid, updated_at stamped",
             "[System]\n\nTraining need pushed to Training & Retention module (source: \"appraisal\") when status set to Approved or Planned\nStatus (of Training Need in T&R module): → Pending or Scheduled",
             "", "", "", "", ""),
        ]
    },
    {
        "letter": "F",
        "header": (
            "F.  TRAINING & RETENTION   |   "
            "Normal = direct status updates, no approval in current code   |   "
            "⚠️ GAP G4: No approval or completion-verification step"
        ),
        "rows": [
            (39, "Training Need — Identify from Recruitment (B7)", "Normal",
             "[Crewing Executive]\n\nDuring B7 stage of recruitment screening\nEnter training items: name, category (Mandatory / Recommended / Optional / Other), due date, identified_by\nSubmit B7\n\nStatus (of Training Need): → Pending\nSource: recruitment\nAudit: created_by_uuid, created_at stamped",
             "[System]\n\nItems visible in Training & Retention module under source filter = \"recruitment\"",
             "", "", "", "", ""),

            (40, "Training Need — Identify from Appraisal\n(Stage 3 Office Review)", "Normal",
             "[Crewing Manager / Crewing Executive]\n\nDuring appraisal Stage 3\nSet training follow-up status to Approved or Planned\n\nStatus (of Training Need): → Pending\nSource: appraisal\nAudit: updated_by_uuid, updated_at stamped",
             "[System]\n\nItems visible in Training & Retention module under source filter = \"appraisal\"",
             "", "", "", "", ""),

            (41, "Training Need — Identify from Promotion Review", "Normal",
             "[Crewing Manager / Crewing Executive]\n\nDuring promotion review, identify training prerequisite for the target rank\nTraining item created\n\nStatus (of Training Need): → Pending\nSource: promotion\nAudit: created_by_uuid stamped",
             "[System]\n\nItems visible in Training & Retention module under source filter = \"promotion\"",
             "", "", "", "", ""),

            (42, "Training Need — Progress / Complete / Cancel\n⚠️ GAP G4: no approval or verification step", "Normal",
             "[Crewing Executive / Crewing Manager]\n\nUpdate training item status as training progresses\nPending → Scheduled (training booked)\nScheduled → In Progress (underway)\nIn Progress → Completed (certificate received) or Cancelled\nEnter comments; overlay stored in training_needs_source_overlay_v2\n\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", "", ""),
        ]
    },
    {
        "letter": "G",
        "header": (
            "G.  DRUGS & ALCOHOL   |   "
            "Normal = record, submit, lock   |   Critical = positive result escalation   |   "
            "⚠️ GAP G3: Escalation path for positive results not implemented in code"
        ),
        "rows": [
            (43, "D&A Test Record — Create", "Normal",
             "[Master / Vessel HOD]\n\nCreate test record for vessel and date\nSelect test type: annual / periodic / monthly / post-incident / others\nSelect alcoholDrugType: Alcohol / Drug (or both)\nSystem enforces duplicate check: same vessel + same date → 409 Conflict\n\nStatus (of Record): → draft\nAudit: created_by_uuid, created_at stamped",
             "", "", "", "", "", ""),

            (44, "D&A Test Record — Enter Personnel Tested", "Normal",
             "[Master / Vessel HOD]\n\nAdd all personnel tested for this record\nRecord individual alcohol result: Positive / Negative\nRecord individual drug result: Positive / Negative\nSet violation flags: alcoholViolation = true / drugViolation = true where positive\nMark equipment_not_applicable if testing equipment not used\n\nStatus (of Record): draft (no change)\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", "", ""),

            (45, "D&A Test Record — Digital Signature / Confirmation", "Normal",
             "[Master]\n\nReview all personnel entries\nApply digital confirmation via da_signatures_v2 (confirmed: true)\n\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", "", ""),

            (46, "D&A Test Record — Submit", "Normal",
             "[Master / Vessel HOD]\n\nReview all entries and signature\nAttach supporting documents (da_attachments_v2)\nSubmit record\n\nStatus (of Record): draft → submitted\nAudit: updated_by_uuid, updated_at stamped\n\n⚠️ GAP G2: Notification sent to [Crewing Manager] — not implemented",
             "", "", "", "", "", ""),

            (47, "D&A Test Record — Lock", "Normal",
             "[Crewing Manager / Crewing Executive]\n\nRequires: status = submitted AND permission DA Lock/Unlock (canedit)\nLock the record to prevent further edits\n\nisLocked: → true\nlockedOnce: → true\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", "", ""),

            (48, "D&A — Positive Result Escalation\n⚠️ GAP G3: no escalation workflow in current code", "Critical",
             "[System]\n\nalcoholViolation = true or drugViolation = true set on da_personnel_tested_v2\n\nViolation flag counted in D&A dashboard violation count endpoint\n\nGAP G3: No automated notification, case creation, or escalation is triggered",
             "[Crewing Manager]\n\nManually identify violation in D&A records / dashboard\nInitiate HR / disciplinary process\n\nGAP G3: No in-system escalation, case management, or formal notification workflow exists",
             "", "", "", "", ""),
        ]
    },
    {
        "letter": "H",
        "header": (
            "H.  REST HOURS   |   "
            "Normal = monthly review cycle   |   "
            "Level 1 = Master (vessel)   |   Level 2 = Crewing Manager / Marine Superintendent (office)"
        ),
        "rows": [
            (49, "Rest Hours — Vessel Monthly Review Submission", "Normal",
             "[Master / Vessel HOD]\n\nReview rest hours records for the month\nIdentify and acknowledge non-conformities\nSubmit vessel monthly review\n\nStatus (of vesselReviewStatus): Due → Submitted\nvesselReviewSubmittedDate stamped\nAudit: updated_by_uuid, updated_at stamped",
             "[System]\n\nIf not submitted by 7th of following month: vesselReviewStatus → Overdue (calculated dynamically in reviewStatusUtils.ts)\nOffice review clock starts: officeReviewStatus triggered as Due",
             "", "", "", "", ""),

            (50, "Rest Hours — Office Monthly Review Submission", "Normal",
             "[Crewing Manager / Marine Superintendent]\n\nReview vessel-submitted rest hours data\nReview non-conformities and planned remediation\nSubmit office review\n\nStatus (of officeReviewStatus): Due → Submitted → Completed\nAudit: updated_by_uuid, updated_at stamped",
             "[System]\n\nIf not submitted by 10th of following month: officeReviewStatus → Overdue (calculated dynamically)",
             "", "", "", "", ""),

            (51, "Rest Hours — Lock Monthly Record", "Normal",
             "[Crewing Manager]\n\nRequires permission: RH Lock/Unlock (canedit)\nLock the vessel monthly rest hours record\n\nisLocked: → true\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", "", ""),

            (52, "Rest Hours — NC Report Open\n(Non-Conformity Identified)", "Normal",
             "[Master / Vessel HOD]\n\nIdentify MLC / STCW non-conformity in rest hours data\nCreate NC Report: enter violation details, affected crew, circumstances\nSet preventiveActionStatus: → Pending\n\nStatus (of NC Report): → Open\nsubmissionStatus: → draft\nAudit: created_by_uuid, created_at stamped",
             "[Master]\n\nSubmit NC Report from vessel\nEnter proposed preventive action\n\nsubmissionStatus: draft → vessel-submitted\nAudit: updated_by_uuid, updated_at stamped\n\n⚠️ GAP G2: Notification sent to [Crewing Manager / Marine Superintendent] — not implemented",
             "", "", "", "", ""),

            (53, "Rest Hours — NC Report Close", "Normal",
             "[Crewing Manager / Marine Superintendent]\n\nReview vessel-submitted NC report\nVerify preventive action was completed\nSet preventiveActionStatus: → Completed\nEnter officeClosureVerifiedByName and officeClosureDate\nSubmit office closure\n\nsubmissionStatus: vessel-submitted → office-submitted\nStatus (of NC Report): Open → Closed\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", "", ""),
        ]
    },
    {
        "letter": "I",
        "header": (
            "I.  CREW ACCOUNTS  (Payroll & Financial)   |   "
            "Critical = Portage Bills & Final Settlement (financial, two-level)   |   "
            "Level 1 = Accounts Officer / Crewing Manager   |   Level 2 = Finance Manager"
        ),
        "rows": [
            (54, "Portage Bill — Prepare\n(Office-Prepares Mode)", "Critical",
             "[Accounts Officer / Crewing Executive]\n\nOpen portage workspace for vessel + period (YYYY-MM)\nTrigger wage calculation run via wage engine\nReview calculation run status: → completed\nReview crew totals and pay element breakdown\n\nStatus (of Portage Bill): → open\nAudit: created_by_uuid, created_at stamped",
             "", "", "", "", "", ""),

            (55, "Portage Bill — Prepare\n(Vessel-Prepares Mode)", "Critical",
             "[Master / Vessel HOD]\n\nEnter portage data on board\nRecord attendance, overtime, bonuses, deductions per crew member\n\nStatus (of Portage Bill): → vessel_draft\nAudit: created_by_uuid, created_at stamped",
             "[Accounts Officer]\n\nReceive vessel draft on office side\nReview and reconcile with crew master data\nPrepare for submission",
             "", "", "", "", ""),

            (56, "Portage Bill — Submit for Approval", "Critical",
             "[Accounts Officer / Crewing Manager]\n\nReview completed portage bill and crew totals\nSelect approver(s) from user list (minimum 1 required)\nSubmit for approval\n\nStatus (of Portage Bill): open / vessel_draft / returned → office_review\nApproval rows created in acc_portage_approvals_v2: status → Pending\nsubmittedByUuid + submittedDate stamped\nPrevious approval rows soft-deleted before new ones created\nAudit: updated_by_uuid, updated_at stamped\n\n⚠️ GAP G2: Notification sent to approver(s) — not implemented",
             "", "", "", "", "", ""),

            (57, "Portage Bill — Approve\n(all approvers approve → auto-lock or approved)", "Critical",
             "[Crewing Manager / Finance Manager]\n\nReview portage bill, crew totals, pay element detail\nRecord decision: Approved\nEnter comments (optional)\n\nStatus (of Approval row): Pending → Approved\nDate stamped on approval row\nAudit: updated_by_uuid, updated_at stamped",
             "[System]\n\nCheck: all live approval rows = Approved?\nIf YES and autoLockOnApproval = true:\n  Status (of Portage Bill): → locked\n  isLocked: true; lockedByUuid + lockedDate stamped\n  Linked CTM also locked (ctmService.lockForPortage)\nIf YES and autoLockOnApproval = false:\n  Status (of Portage Bill): office_review → approved\n  (Manual lock required — see Item 59)",
             "", "", "", "", ""),

            (58, "Portage Bill — Reject / Return for Revision", "Critical",
             "[Crewing Manager / Finance Manager]\n\nReview portage bill\nRecord decision: Rejected\nEnter mandatory rejection comments\n\nStatus (of Approval row): Pending → Rejected\nStatus (of Portage Bill): office_review → returned\nAudit: updated_by_uuid, updated_at stamped\n\n⚠️ GAP G2: Notification sent to [Accounts Officer] — not implemented",
             "[Accounts Officer]\n\nReview rejection comments\nCorrect payroll data / recalculate\nRe-submit (portage in \"returned\" is re-submittable)\n\nStatus (of Portage Bill): returned → office_review (on re-submit)\nPrevious approval rows soft-deleted; new Pending rows created",
             "", "", "", "", ""),

            (59, "Portage Bill — Manual Lock\n(when autoLockOnApproval = false)", "Normal",
             "[Accounts Officer / Finance Manager]\n\nRequires: status = approved (autoLockOnApproval = false scenario)\nManually lock the portage bill\n\nStatus (of Portage Bill): approved → locked\nisLocked: true; lockedByUuid + lockedDate stamped\nLinked CTM locked\nAudit: updated_by_uuid, updated_at stamped",
             "", "", "", "", "", ""),

            (60, "Cash Advance — Request, Approve & Disburse", "Normal",
             "[Accounts Officer / Master]\n\nCreate cash advance request for crew member\nEnter amount, currency, reason\n\nStatus (of Advance): → pending\nAudit: created_by_uuid, created_at stamped",
             "[Crewing Manager / Finance Manager]\n\nReview advance request against crew entitlement\nApprove or Reject\n\nStatus (of Advance): pending → approved or rejected\nAudit: updated_by_uuid, updated_at stamped",
             "[Accounts Officer]\n\nDisburse approved advance\n\nStatus (of Advance): approved → disbursed\nAudit: updated_by_uuid stamped",
             "[System]\n\nRecovery entries scheduled in monthly transactions\nStatus (of Advance): → recovered when fully recovered in payroll",
             "", "", ""),

            (61, "Allotment — Setup / Modify / Suspend / End\n⚠️ GAP G10: no formal approval step in code", "Normal",
             "[Accounts Officer]\n\nCreate or update allotment for crew member\nEnter: beneficiary name, amount, frequency, bank details\nValidated against maxAllotmentPercent tenant config on creation\n\nStatus (of Allotment): → active\nAudit: created_by_uuid / updated_by_uuid stamped",
             "[Crewing Manager]\n\nReview and confirm allotment change\n[ASSUMPTION A6: no formal approval step in code; this step is recommended, not currently implemented]\nSuspend: Status → suspended\nEnd: Status → ended\nAudit: updated_by_uuid stamped",
             "", "", "", "", ""),

            (62, "Engagement — Final Settlement (Sign-Off)", "Critical",
             "[Accounts Officer]\n\nCrew member signed off vessel\nCalculate final settlement: balance wages, leave pay, repatriation allowance, deductions\nTrigger settlement calculation run\nPrepare settlement statement\n\nStatus (of Engagement): active → completed\nCalculation run recorded in acc_calculation_runs_v2\nAudit: updated_by_uuid, updated_at stamped",
             "[Crewing Manager]\n\nReview final settlement statement\nVerify against engagement history\nSubmit for final approval",
             "[Finance Manager]\n\nFinal approval of settlement amounts\n\nStatus (of Engagement): completed → settled\n[ASSUMPTION A7: no explicit settlement approval controller found; pattern inferred from engagement status sequence and portage bill flow]\nAudit: updated_by_uuid, updated_at stamped",
             "[System]\n\nSettlement amounts locked\nPortage bill for final month updated to reflect sign-off\nAllotments ended\nCash advance recovery balanced",
             "", "", ""),
        ]
    },
]

GAPS = [
    ("G1", "High Priority", "No Approval Step on Crew Terminations",
     "Termination is a direct write — any user with canedit on the Crew Pool menu can terminate a crew member. "
     "For a compliance-heavy maritime domain, company-initiated terminations (especially UT and BT categories) "
     "should require at minimum a Level 1 manager approval before status: Terminated is committed. "
     "Recommend adding a pending_termination intermediate status and an approval record in a new crew_termination_approvals table."),
    ("G2", "High Priority", "No Workflow-Triggered Notifications",
     "The alerts engine exists (visa/document expiry, relief-due) but zero workflow state transitions currently "
     "dispatch notifications. Impacted transitions: recruitment approval/rejection, rotation deploy/reject, "
     "promotion approval/rejection, portage bill submission/rejection, D&A submission, NC Report submission. "
     "Recommend extending the alerts engine or adding a lightweight notification hook to the service layer."),
    ("G3", "Critical — Compliance", "No Escalation Workflow for D&A Positive Results",
     "alcoholViolation and drugViolation flags are set in da_personnel_tested_v2 and counted for dashboard display, "
     "but nothing is triggered automatically. A positive D&A test on a SOLAS vessel is a safety-critical event (STCW requirement). "
     "Recommend: on drugViolation=true or alcoholViolation=true, auto-create an escalation case record, "
     "notify Crewing Manager and Fleet Personnel Manager, and prevent sign-on of the affected crew member until the case is closed."),
    ("G4", "Medium Priority", "No Approval Step in Training & Retention",
     "Training status transitions (Pending → Scheduled → Completed) are direct writes. For mandatory training, "
     "completion should require a verification step (e.g., certificate upload + manager sign-off) before the training "
     "is counted as compliant. Recommend adding a verified status and a verified_by_uuid field."),
    ("G5", "Medium Priority — MLC context", "No Seafarer Acknowledgement in Appraisals",
     "The appraisal workflow moves from Stage 2 (vessel submission by HOD/Master) directly to Stage 3 (office review) "
     "with no step for the seafarer to acknowledge or sign the assessment. MLC 2006 Standard A1.1 implies the seafarer "
     "should be aware of their appraisal. Recommend adding a stage2_5_seafarer_acknowledged status between Stage 2 and Stage 3."),
    ("G6", "", "No Centralized Audit Log Table",
     "All tables carry created_by_uuid / updated_by_uuid but there is no queryable log of who changed field X from "
     "value A to value B at time T. For financial and compliance workflows (Crew Accounts, Terminations, D&A) "
     "a field-level change log is important for regulatory audit purposes."),
    ("G7", "", "'Partially Approved' Rotation Plan Status Has No Automatic Completion Trigger",
     "When individual rotation entries are deployed one by one, the plan moves to Partially Approved. "
     "There is no server-side logic to automatically transition the plan to Completed when the last entry is deployed. "
     "Recommend adding a post-deploy check: if all entries in the plan are Deployed or Rejected, auto-transition plan to Completed."),
    ("G8", "", "'submitted' Portage Bill Status Is Potentially Vestigial",
     "SUBMITTABLE = ['open', 'vessel_draft', 'submitted', 'returned'] — a portage in submitted status can be re-submitted. "
     "However, the active awaiting-approval state is office_review, not submitted. The portageService.submit() function "
     "transitions directly to office_review; it is unclear how a portage bill reaches submitted status. See Question Q2."),
    ("G9", "", "Monthly Transaction 'accepted' / 'rejected' Statuses — Approval Path Unclear",
     "acc_monthly_transactions_v2 has statuses draft, submitted, accepted, rejected but no controller or service logic "
     "was found implementing the accepted/rejected transitions. These may be planned but not yet implemented. See Question Q3."),
    ("G10", "", "Allotment Changes Have No Formal Approval",
     "Allotment amounts can be changed as a direct write. Given allotments are direct financial commitments "
     "(bank wire instructions), a manager sign-off step is recommended, particularly for new allotments and amount "
     "increases above a threshold."),
    ("G11", "", "Promotion Has No Explicit 'rejected' Terminal Status on the Review Record",
     "When an approver sets promotionConfirmed: rejected, the rejection is recorded on the promo_approvals_v2 row "
     "but promotion_reviews_v2.status remains 'for approval'. There is no terminal rejected status on the review itself. "
     "This means a rejected promotion review is indistinguishable from one still awaiting a decision. See Question Q10."),
]

QUESTIONS = [
    ("Q1", "Recruitment",
     "The code supports selecting multiple approvers at B8, but there is no enforced ordering. "
     "Is the intent parallel approval (all approvers receive the record simultaneously) or sequential (Level 1 first, then Level 2)?"),
    ("Q2", "Crew Accounts",
     "The portageService.submit() function transitions status to office_review immediately. "
     "When would a portage bill be in submitted status rather than office_review? "
     "Is this a legacy value from an older flow, or used in a path not yet visible in the code?"),
    ("Q3", "Crew Accounts",
     "Who approves or rejects a monthly transaction, and what is the trigger? "
     "Is this the vessel-side DPB (Daily Portage Bill) workflow vs. the office portage bill, or something else?"),
    ("Q4", "Rest Hours",
     "Is officeReviewStatus: Completed reached automatically when officeReviewStatus is set to Submitted, "
     "or is there a separate completion-confirmation action? The reviewStatusUtils.ts calculates this dynamically — please confirm the exact trigger."),
    ("Q5", "Drugs & Alcohol",
     "Should a positive D&A test result trigger any in-system action (notification, case creation, crew sign-on block)? "
     "Or is the process handled entirely outside the system?"),
    ("Q6", "Appraisals",
     "Is there an intent (or regulatory requirement) for the seafarer to acknowledge their appraisal within the system, "
     "or is this handled via paper/external process?"),
    ("Q7", "Crew Pool",
     "Should company-initiated terminations (especially UT and BT) require a Crewing Manager or Fleet Personnel Manager "
     "sign-off before taking effect?"),
    ("Q8", "Training & Retention",
     "Should completion of a Mandatory training item require document upload and manager verification "
     "before the item is marked Completed?"),
    ("Q9", "Crew Accounts",
     "Should allotment creation or changes above a defined amount (or above maxAllotmentPercent) "
     "require Finance Manager approval?"),
    ("Q10", "Promotions",
     "Should a rejected promotion review show a distinct terminal status (e.g., rejected) on the review record itself, "
     "separate from the promo_approvals_v2 row? This affects reporting and re-opening."),
]

ASSUMPTIONS = [
    ("A1", "Recruitment — two-level approval",
     "Two-level approval is achieved by selecting two approvers at B8. No ordering is enforced in code. "
     "Treated as L1 = Crewing Manager, L2 = Fleet Personnel Manager for register purposes."),
    ("A2", "Rotation — Critical flag for top-4 ranks",
     "The Critical designation for Top-4 officer rotation entries (Master, C/O, C/E, 2/E) is not implemented in code. "
     "Included in the register as a recommended pattern; all current deploy/reject actions are treated identically regardless of rank."),
    ("A3", "Promotions — Critical type",
     "Critical designation for senior rank or cross-fleet promotions is not implemented in code. "
     "Register items are marked Normal accordingly; the Critical variant is noted as recommended."),
    ("A4", "D&A — escalation",
     "No escalation workflow exists for positive D&A results. Item 48 is shown as a Critical / GAP row "
     "to flag this as a missing compliance control."),
    ("A5", "Training — verification",
     "No formal approval or verification step exists for training completion. "
     "Item 42 Step 2 is shown as a recommended step, not a currently implemented one."),
    ("A6", "Allotment — approval",
     "No formal approval step exists for allotment changes. "
     "Item 61 Step 2 is shown as a recommended step, not currently implemented."),
    ("A7", "Final settlement — approval path",
     "No explicit settlement approval controller was found. The pattern "
     "(Accounts Officer prepares → Crewing Manager reviews → Finance Manager approves) is inferred "
     "from the portage bill approval pattern and the engagement status sequence (completed → settled)."),
]

ROLE_MAPPING = [
    ("[Manning Agent]",        "External party; data entered into the system by Crewing Executive. No system login role."),
    ("[Crewing Executive]",    "Office user with cancreate + canedit on Recruitment, Crew Pool, Vessel modules in Admin › Access Control."),
    ("[Crewing Manager]",      "Office user with approval-level permissions (typically canedit + candelete on approval menus). Role name configured per-tenant by Administrator."),
    ("[Fleet Personnel Manager]", "Office user with highest-level permissions across all crewing menus. Role name configured per-tenant."),
    ("[Master]",               "userType: \"Ship\" in JWT, with vessel UUIDs in vessels claim. Has access to vessel-side modules (D&A, Rest Hours, Appraisals, Sign-On/Off)."),
    ("[Vessel HOD]",           "userType: \"Ship\" user with department-level permissions on the vessel."),
    ("[Accounts Officer]",     "Office user with cancreate + canedit on Account Payroll Run, Account Vessel Portage menus."),
    ("[Finance Manager]",      "Office user with approval-level permissions on Accounts menus. Role name configured per-tenant."),
    ("[System]",               "Automated server-side logic: service layer functions, cron jobs (alert engine), Drizzle ORM triggers."),
    ("[Seafarer]",             "Subject of records. Has no login in this system; interacts only through on-board paper or vessel-user proxies."),
]


# ---------------------------------------------------------------------------
# Build workbook
# ---------------------------------------------------------------------------

def build_workbook():
    wb = Workbook()

    # ---- Sheet 1: Main register ----
    ws = wb.active
    ws.title = "CREWING Approval Workflows"
    build_main_sheet(ws)

    # ---- Sheet 2: Gaps & Recommendations ----
    ws2 = wb.create_sheet("Gaps & Recommendations")
    build_gaps_sheet(ws2)

    # ---- Sheet 3: Questions & Assumptions ----
    ws3 = wb.create_sheet("Questions & Assumptions")
    build_qa_sheet(ws3)

    # ---- Sheet 4: Role Mapping ----
    ws4 = wb.create_sheet("Role Mapping")
    build_role_sheet(ws4)

    return wb


def apply_cell(ws, row, col, value, font=None, fill_=None, alignment=None, border_=None):
    c = ws.cell(row=row, column=col, value=value)
    if font:      c.font = font
    if fill_:     c.fill = fill_
    if alignment: c.alignment = alignment
    if border_:   c.border = border_
    return c


def build_main_sheet(ws):
    COL_WIDTHS = [8, 38, 13, 32, 32, 32, 32, 32, 32, 32]
    for i, w in enumerate(COL_WIDTHS, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    # --- Row 1: Title ---
    ws.merge_cells("A1:J1")
    c = ws["A1"]
    c.value = "CREWING MODULE — COMPLETE APPROVAL WORKFLOW REGISTER"
    c.font = Font(bold=True, color=WHITE, size=14)
    c.fill = fill(NAVY)
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[1].height = 30

    # --- Row 2: Column headers ---
    headers = ["Item", "Process", "Type", "Step 1", "Step 2", "Step 3", "Step 4", "Step 5", "Step 6", "Step 7"]
    for col, h in enumerate(headers, start=1):
        c = ws.cell(row=2, column=col, value=h)
        c.font = white_bold(11)
        c.fill = fill(HDR_BLUE)
        c.alignment = WRAP_CENTER
        c.border = thin_border()
    ws.row_dimensions[2].height = 20

    ws.freeze_panes = "A3"

    current_row = 3
    item_counter = 0

    for section in SECTIONS:
        # Spacer
        ws.row_dimensions[current_row].height = 6
        current_row += 1

        # Section header row — merge B:J (cols 2–10)
        ws.merge_cells(
            start_row=current_row, start_column=2,
            end_row=current_row, end_column=10
        )
        c = ws.cell(row=current_row, column=2, value=section["header"])
        c.font = Font(bold=True, color=WHITE, size=10)
        c.fill = fill(MID_BLUE)
        c.alignment = Alignment(wrap_text=True, vertical="center")
        # Col A in section header
        ws.cell(row=current_row, column=1).fill = fill(MID_BLUE)
        ws.row_dimensions[current_row].height = 36
        current_row += 1

        for row_data in section["rows"]:
            item_no, process, typ, *steps = row_data
            # Pad steps to 7
            steps = list(steps) + [""] * (7 - len(steps))

            item_counter += 1
            is_alt = (item_counter % 2 == 0)
            row_fill = fill(ROW_ALT) if is_alt else fill(WHITE)

            # Col A — item number
            c = ws.cell(row=current_row, column=1, value=item_no)
            c.font = black_bold()
            c.fill = row_fill
            c.alignment = CENTER
            c.border = thin_border()

            # Col B — process name
            c = ws.cell(row=current_row, column=2, value=process)
            c.font = black_bold()
            c.fill = row_fill
            c.alignment = WRAP_TOP
            c.border = thin_border()

            # Col C — type
            c = ws.cell(row=current_row, column=3, value=typ)
            if typ == "Critical":
                c.fill = fill(AMBER)
                c.font = Font(bold=True, size=10)
            else:
                c.fill = row_fill
                c.font = black()
            c.alignment = CENTER
            c.border = thin_border()

            # Cols D–J — steps
            for step_idx, step_text in enumerate(steps, start=4):
                c = ws.cell(row=current_row, column=step_idx, value=step_text or None)
                c.font = black()
                c.fill = row_fill
                c.alignment = WRAP_TOP
                c.border = thin_border()

            ws.row_dimensions[current_row].height = 90
            current_row += 1

    # Spacer at end
    ws.row_dimensions[current_row].height = 6


def build_gaps_sheet(ws):
    ws.column_dimensions["A"].width = 8
    ws.column_dimensions["B"].width = 25
    ws.column_dimensions["C"].width = 45
    ws.column_dimensions["D"].width = 90

    # Title
    ws.merge_cells("A1:D1")
    c = ws["A1"]
    c.value = "GAPS & RECOMMENDATIONS"
    c.font = Font(bold=True, color=WHITE, size=13)
    c.fill = fill(NAVY)
    c.alignment = CENTER
    ws.row_dimensions[1].height = 28

    # Headers
    for col, h in enumerate(["#", "Priority", "Title", "Detail"], start=1):
        c = ws.cell(row=2, column=col, value=h)
        c.font = white_bold(10)
        c.fill = fill(HDR_BLUE)
        c.alignment = WRAP_CENTER
        c.border = thin_border()
    ws.row_dimensions[2].height = 18

    ws.freeze_panes = "A3"

    for i, (ref, priority, title, detail) in enumerate(GAPS, start=3):
        row_fill = fill(ROW_ALT) if (i % 2 == 0) else fill(WHITE)
        for col, val in enumerate([ref, priority, title, detail], start=1):
            c = ws.cell(row=i, column=col, value=val)
            c.font = black()
            c.fill = row_fill
            c.alignment = WRAP_TOP
            c.border = thin_border()
        ws.cell(row=i, column=1).font = black_bold()
        ws.row_dimensions[i].height = 60


def build_qa_sheet(ws):
    ws.column_dimensions["A"].width = 8
    ws.column_dimensions["B"].width = 22
    ws.column_dimensions["C"].width = 90

    # Questions title
    ws.merge_cells("A1:C1")
    c = ws["A1"]
    c.value = "QUESTIONS (require stakeholder input before Phase 2)"
    c.font = Font(bold=True, color=WHITE, size=12)
    c.fill = fill(NAVY)
    c.alignment = CENTER
    ws.row_dimensions[1].height = 26

    for col, h in enumerate(["#", "Sub-module", "Question"], start=1):
        c = ws.cell(row=2, column=col, value=h)
        c.font = white_bold(10)
        c.fill = fill(HDR_BLUE)
        c.alignment = WRAP_CENTER
        c.border = thin_border()
    ws.row_dimensions[2].height = 18

    ws.freeze_panes = "A3"

    for i, (ref, module, question) in enumerate(QUESTIONS, start=3):
        row_fill = fill(ROW_ALT) if (i % 2 == 0) else fill(WHITE)
        for col, val in enumerate([ref, module, question], start=1):
            c = ws.cell(row=i, column=col, value=val)
            c.font = black()
            c.fill = row_fill
            c.alignment = WRAP_TOP
            c.border = thin_border()
        ws.cell(row=i, column=1).font = black_bold()
        ws.row_dimensions[i].height = 55

    # Assumptions section
    next_row = len(QUESTIONS) + 3 + 2

    ws.merge_cells(f"A{next_row}:C{next_row}")
    c = ws.cell(row=next_row, column=1, value="ASSUMPTIONS (mark any that need correcting)")
    c.font = Font(bold=True, color=WHITE, size=12)
    c.fill = fill(MID_BLUE)
    c.alignment = CENTER
    ws.row_dimensions[next_row].height = 26
    next_row += 1

    for col, h in enumerate(["#", "Item", "Assumption & Reasoning"], start=1):
        c = ws.cell(row=next_row, column=col, value=h)
        c.font = white_bold(10)
        c.fill = fill(HDR_BLUE)
        c.alignment = WRAP_CENTER
        c.border = thin_border()
    ws.row_dimensions[next_row].height = 18
    next_row += 1

    for i, (ref, item, reasoning) in enumerate(ASSUMPTIONS):
        row_fill = fill(ROW_ALT) if (i % 2 == 0) else fill(WHITE)
        r = next_row + i
        for col, val in enumerate([ref, item, reasoning], start=1):
            c = ws.cell(row=r, column=col, value=val)
            c.font = black()
            c.fill = row_fill
            c.alignment = WRAP_TOP
            c.border = thin_border()
        ws.cell(row=r, column=1).font = black_bold()
        ws.row_dimensions[r].height = 55


def build_role_sheet(ws):
    ws.column_dimensions["A"].width = 28
    ws.column_dimensions["B"].width = 90

    ws.merge_cells("A1:B1")
    c = ws["A1"]
    c.value = "ROLE MAPPING — Register Label → System Code Equivalent"
    c.font = Font(bold=True, color=WHITE, size=12)
    c.fill = fill(NAVY)
    c.alignment = CENTER
    ws.row_dimensions[1].height = 26

    for col, h in enumerate(["Register Role", "Code Equivalent"], start=1):
        c = ws.cell(row=2, column=col, value=h)
        c.font = white_bold(10)
        c.fill = fill(HDR_BLUE)
        c.alignment = WRAP_CENTER
        c.border = thin_border()
    ws.row_dimensions[2].height = 18

    ws.freeze_panes = "A3"

    for i, (role, equiv) in enumerate(ROLE_MAPPING, start=3):
        row_fill = fill(ROW_ALT) if (i % 2 == 0) else fill(WHITE)
        c = ws.cell(row=i, column=1, value=role)
        c.font = black_bold()
        c.fill = row_fill
        c.alignment = WRAP_TOP
        c.border = thin_border()
        c = ws.cell(row=i, column=2, value=equiv)
        c.font = black()
        c.fill = row_fill
        c.alignment = WRAP_TOP
        c.border = thin_border()
        ws.row_dimensions[i].height = 40


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    os.makedirs("attached_assets", exist_ok=True)
    output_path = "attached_assets/Crewing_Approval_Workflow_Register.xlsx"
    wb = build_workbook()
    wb.save(output_path)
    print(f"Saved: {output_path}")
