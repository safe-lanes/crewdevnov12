"""
Generate Crewing Approval Workflow Register Excel file.
One row = one complete end-to-end process variant. Functional language only.
Output: attached_assets/Crewing_Approval_Workflow_Register.xlsx
"""

import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------

NAVY       = "1B3A5C"   # title row
MID_BLUE   = "2E5F8E"   # section header
HDR_BLUE   = "4472C4"   # column header row
GREEN_ROW  = "E2EFDA"   # Normal data row
RED_ROW    = "F2DCDB"   # Critical data row
GREEN_TYPE = "C6EFCE"   # Normal type cell
RED_TYPE   = "FFC7CE"   # Critical type cell
GREEN_TXT  = "006100"
RED_TXT    = "9C0006"
WHITE      = "FFFFFF"


def white_bold(size=11):
    return Font(bold=True, color=WHITE, size=size)

def black(size=10):
    return Font(size=size)

def black_bold(size=10):
    return Font(bold=True, size=size)

def fill(hex_color):
    return PatternFill(fill_type="solid", start_color=hex_color, end_color=hex_color)

def thin_border():
    s = Side(border_style="thin")
    return Border(top=s, bottom=s, left=s, right=s)


WRAP_TOP    = Alignment(wrap_text=True, vertical="top")
WRAP_CENTER = Alignment(wrap_text=True, vertical="center", horizontal="center")
CENTER      = Alignment(horizontal="center", vertical="center")

# ---------------------------------------------------------------------------
# DATA — one row per complete end-to-end process variant
# (item_no, process, type, step1..step7)
# ---------------------------------------------------------------------------

SECTIONS = [
    {
        "header": (
            "A.  RECRUITMENT  (Application Processing & Approval)   |   "
            "Normal = single approver   |   Critical = two-level approval   |   "
            "Level 1 = Crewing Manager   |   Level 2 = Fleet Personnel Manager   |   "
            "[ASSUMPTION A1] Two-level approval is achieved by selecting two approvers at submission; "
            "the system does not enforce the approval order."
        ),
        "rows": [
            (1, "Recruitment Application — Approve & Recruit\n(Normal, single approver)", "Normal",
             "[Manning Agent / Crewing Executive]\n\nCreate candidate application (Part A): name, rank applied for, nationality, date of birth\nEnter personal details, family and next-of-kin details, addresses\nEnter documents, visas, licences, training courses, sea service, education\nAttach supporting documents and photo\nApplication ID auto-generated\n\nStatus (of Application): → Draft",
             "[Crewing Executive]\n\nComplete screening stages B1–B4:\nB1 Initial Screening — verify age, rank and certificate criteria; mark Shortlisted: Yes / No\nB2 Reference Checks — contact previous employers; record feedback\nB3 Background & Security Checks — record authorities, dates and results\nB4 Authentication of Certificates & Documents — verify with issuing authorities\nEach stage submitted with comments and attachments\n\nStatus (of each stage): → Submitted",
             "[Crewing Executive / Crewing Manager]\n\nComplete screening stages B5–B7:\nB5 CES / Language Tests — record subject, score and result per test\nB6 Interviews — record interviewer, date and result\nB7 Training Needs Identified — list training items with category and due date\n\nStatus (of each stage): → Submitted",
             "[Crewing Executive]\n\nB8 Shortlisting & Submission:\nReview B1–B7 outcomes\nMark Shortlisted: Yes / No\nSelect approver from the user list\nSubmit for approval\nApplication sent to the selected approver\n\nStatus (of Application): → For Approval\n\n⚠️ GAP G2: Notification sent to [Crewing Manager] — not implemented",
             "[Crewing Manager]\n\nReview candidate profile (Part A) and screening evidence (Part B)\nRecord Approval Decision\nRecord Suitable For: vessel types and fleet groups\nConfirm recruitment and enter Recruited Date\n\nStatus (of Application): → Recruited",
             "[System]\n\nSeafarer record auto-created in Crew Pool\nCrew ID generated\nStatus (of Seafarer): → Active\nTraining needs from B7 carried into the Training & Retention module\n\nAction recorded in audit trail (user, date & time)",
             ""),

            (2, "Recruitment Application — Approve & Recruit\n(Critical, two-level approval)\n[ASSUMPTION A1]", "Critical",
             "[Manning Agent / Crewing Executive]\n\nCreate candidate application and complete screening stages B1–B7\n(as Item 1, Steps 1–3)\n\nStatus (of Application): → Draft; screening stages → Submitted",
             "[Crewing Executive]\n\nB8 Shortlisting & Submission:\nSelect two approvers (Level 1 and Level 2)\nSubmit for approval\nApplication sent to both approvers\n\nStatus (of Application): → For Approval\n\n⚠️ GAP G2: Notification sent to approvers — not implemented",
             "[Crewing Manager]\n\nLevel 1 review of candidate profile and screening evidence\nRecord Level 1 Approval Decision\n\nStatus (of Level 1 decision): → Approved",
             "[Fleet Personnel Manager]\n\nLevel 2 review of the case and the Level 1 decision\nRecord Suitable For: vessel types and fleet groups\nConfirm recruitment and enter Recruited Date\n\nStatus (of Level 2 decision): → Approved\nStatus (of Application): → Recruited (once both approvals are given)",
             "[System]\n\nSeafarer record auto-created in Crew Pool\nCrew ID generated\nStatus (of Seafarer): → Active\nTraining needs from B7 carried into the Training & Retention module\n\nAction recorded in audit trail (user, date & time)",
             "", ""),

            (3, "Recruitment Application — Reject\n(deficiency found at screening or approval)", "Normal",
             "[Crewing Executive]\n\nApplication created, screened and submitted for approval\n(as Item 1, Steps 1–4)\n\nStatus (of Application): → For Approval",
             "[Crewing Manager]\n\nReview candidate profile and screening evidence\nDeficiency found\nEnter mandatory Rejection Reason\nReject the application\n\nStatus (of Application): → Rejected\n\n⚠️ GAP G2: Notification sent to [Crewing Executive] — not implemented",
             "[System]\n\nApplication retained for future reference\n\nAction recorded in audit trail (user, date & time)",
             "", "", "", ""),

            (4, "Recruitment Application — Waitlist\n(qualified, no current vacancy)", "Normal",
             "[Crewing Executive]\n\nApplication created, screened and submitted for approval\n(as Item 1, Steps 1–4)\n\nStatus (of Application): → For Approval",
             "[Crewing Manager]\n\nReview candidate profile and screening evidence\nCandidate is qualified but no vacancy is currently available\nEnter Waitlist Reason\n\nStatus (of Application): → Waitlisted\n\n⚠️ GAP G2: Notification sent to [Crewing Executive] — not implemented",
             "[System]\n\nApplication retained; candidate can be re-considered when a vacancy arises\n\nAction recorded in audit trail (user, date & time)",
             "", "", "", ""),
        ]
    },
    {
        "header": (
            "B.  CREW POOL / CREW DATABASE  (Seafarer Records)   |   "
            "Normal = direct update, no approval level in the current system   |   "
            "⚠️ GAP G1: no approval step on terminations — see Gaps & Recommendations"
        ),
        "rows": [
            (5, "Crew Record — Create & Complete\n(auto-transfer from Recruitment, or manual entry)", "Normal",
             "[System]\n\nWhen a candidate is Recruited, the seafarer record is auto-created in Crew Pool from the application\nCrew ID generated\n\nStatus (of Seafarer): → Active",
             "[Crewing Executive]\n\nVerify the transferred record\n(or create the record manually when the seafarer did not come through Recruitment: personal details, rank, nationality, certificates, licences, sea service, medical, documents)\nComplete the remaining sections: medical, travel documents, emergency contacts, flag-state documents\n\nAction recorded in audit trail (user, date & time)",
             "", "", "", "", ""),

            (6, "Crew Record — Update Particulars /\nDocuments / Certificates / Sea Service", "Normal",
             "[Crewing Executive]\n\nEdit any section of the seafarer profile\n(personal details, documents, licences, sea service, medical, addresses, next-of-kin)\n\nStatus (of Seafarer): no change\n\nAction recorded in audit trail (user, date & time)",
             "", "", "", "", "", ""),

            (7, "Crew Termination — Company-Initiated\n(General / UT / BT)\n⚠️ GAP G1: no approval step", "Normal",
             "[Crewing Executive]\n\nOpen the seafarer record\nSelect Initiated By: Company\nSelect Category: General / Unavoidable Termination (UT) / Beneficial Termination (BT)\nSelect Reason: Poor Performance / Disciplinary / No Suitable Vessel / Unresponsive / Other\nEnter Effective Date and notes\nFlag Not For Re-Hire if applicable\n\nStatus (of Seafarer): → Terminated",
             "[System]\n\nActive vessel assignments cleared\n\nAction recorded in audit trail (user, date & time)\n\n⚠️ GAP G1: no manager approval step before the termination takes effect",
             "", "", "", "", ""),

            (8, "Crew Termination — Crew-Initiated\n(Resignation)\n⚠️ GAP G1: no approval step", "Normal",
             "[Crewing Executive]\n\nOpen the seafarer record\nSelect Initiated By: Crew Member (resignation)\nCategory: General; Reason: Resignation\nEnter Effective Date and notes\n\nStatus (of Seafarer): → Terminated",
             "[System]\n\nAction recorded in audit trail (user, date & time)\n\n⚠️ GAP G1: no manager approval step before the termination takes effect",
             "", "", "", "", ""),

            (9, "Crew Record — Archive / Deactivate", "Normal",
             "[Crewing Executive]\n\nArchive the seafarer record\nRecord is hidden from active lists but retained for reference\n\nStatus (of Seafarer): → Inactive / Archived\n\nAction recorded in audit trail (user, date & time)",
             "", "", "", "", "", ""),
        ]
    },
    {
        "header": (
            "C.  VESSEL ASSIGNMENT & ROTATION  (Crew Lineup / Relief Planning)   |   "
            "Critical = Top-4 Officers (Master, Chief Officer, Chief Engineer, Second Engineer)   |   "
            "Level 1 = Crewing Manager   |   Level 2 = Fleet Personnel Manager   |   "
            "[ASSUMPTION A2] Two-level approval for Top-4 ranks is a recommended pattern, "
            "not enforced in the current system."
        ),
        "rows": [
            (10, "Crew Deployment — Plan, Approve & Sign-On\n(Normal rank)", "Normal",
             "[Crewing Executive / Crewing Manager]\n\nCreate rotation plan draft for a vessel and planning period\nAdd entries: planned crew, reliever candidates, proposed dates, remarks\n\nStatus (of Plan): → In Draft\nStatus (of each Entry): → Pending",
             "[Crewing Executive / Crewing Manager]\n\nReview all entries in the draft\nPropose the plan for approval\n\nStatus (of Plan): → Proposed\n\n⚠️ GAP G2: Notification sent to [Crewing Manager] — not implemented",
             "[Crewing Manager]\n\nReview each entry: crew member, vessel, dates, rank match, documentation\nConfirm suitability and regulatory compliance\nDeploy the entry\n\nStatus (of Entry): → Deployed\nStatus (of Plan): → Partially Approved (entries pending) or Completed (all decided)\n\n⚠️ GAP G2: Notification sent to [Crewing Executive] — not implemented",
             "[System]\n\nVessel planning record created for the reliever\n\nStatus (of Joining): → Planned",
             "[Crewing Executive]\n\nUpdate joining progress as travel is arranged:\nPlanned → Confirmed (ticket booked)\nConfirmed → In Transit (en route to the vessel)",
             "[Crewing Executive / Master]\n\nConfirm joining date on board and complete Sign-On\nPrevious crew member's assignment ended\n\nStatus (of Joining): → Signed On\nStatus (of Seafarer): → On Board\n\nAction recorded in audit trail (user, date & time)",
             ""),

            (11, "Crew Deployment — Plan, Approve & Sign-On\n(Top-4 Officer, two-level)\n[ASSUMPTION A2]", "Critical",
             "[Crewing Executive / Crewing Manager]\n\nRotation plan drafted and proposed\n(as Item 10, Steps 1–2)\n\nStatus (of Plan): → Proposed",
             "[Crewing Manager]\n\nLevel 1 review of the Top-4 officer entry:\nflag documents, endorsements, STCW qualifications, GMDSS where applicable\nApprove at Level 1",
             "[Fleet Personnel Manager]\n\nLevel 2 final review and sign-off\nConfirm the deployment\n\nStatus (of Entry): → Deployed\nStatus (of Plan): → Partially Approved / Completed\n\n⚠️ GAP G2: Notification sent to [Crewing Executive] — not implemented",
             "[System]\n\nVessel planning record created for the reliever\n\nStatus (of Joining): → Planned",
             "[Crewing Executive / Master]\n\nJoining progress updated and Sign-On completed\n(as Item 10, Steps 5–6)\n\nStatus (of Seafarer): → On Board\n\nAction recorded in audit trail (user, date & time)",
             "", ""),

            (12, "Rotation Entry — Reject & Re-plan", "Normal",
             "[Crewing Manager]\n\nReview the proposed entry\nEnter mandatory Rejection Reason\nReject the entry\n\nStatus (of Entry): → Rejected\n\n⚠️ GAP G2: Notification sent to [Crewing Executive] — not implemented",
             "[Crewing Executive]\n\nReview the rejection reason\nIdentify alternative crew or revised dates\nUpdate the draft and re-propose\n\nAction recorded in audit trail (user, date & time)",
             "", "", "", "", ""),

            (13, "Crew Sign-Off & Relief Cycle", "Normal",
             "[Crewing Executive / Master]\n\nRecord Sign-Off Date and Sign-Off Reason\nComplete Briefing & De-briefing where applicable\n\nStatus (of Seafarer): → On Leave",
             "[System]\n\nNext availability date set for the seafarer\nRelief planning cycle begins for the vessel\nCompleted or superseded plans archived by [Crewing Manager] — Status (of Plan): → Archived\n\nAction recorded in audit trail (user, date & time)",
             "", "", "", "", ""),
        ]
    },
    {
        "header": (
            "D.  PROMOTIONS   |   "
            "Normal = single-level approval   |   "
            "Critical = senior rank or cross-fleet [ASSUMPTION A3 — recommended, not enforced in the current system]   |   "
            "Level 1 = Crewing Manager   |   Level 2 = Fleet Personnel Manager"
        ),
        "rows": [
            (14, "Promotion — Review, Approve & Execute", "Normal",
             "[Crewing Executive / Crewing Manager]\n\nCreate promotion review: select crew member, current rank and proposed rank\nCheck eligibility criteria (each criterion verified and marked as met or not met)\nView promotion recommendations from recent appraisals\n\nStatus (of Review): → In Progress",
             "[Crewing Executive / Crewing Manager]\n\nComplete all review particulars\nAssign approver\nSubmit for approval\n\nStatus (of Review): → For Approval\n\n⚠️ GAP G2: Notification sent to [Crewing Manager / Fleet Personnel Manager] — not implemented",
             "[Crewing Manager]\n\nReview the case: criteria, appraisal recommendations, sea service\nConfirm the promotion\nSet Promotion Timing: On Board or Prior Joining\n\nStatus (of Review): → Approved; form locked\n\n⚠️ GAP G2: Notification sent to [Crewing Executive] — not implemented",
             "[System]\n\nIf timing is Prior Joining: promotion shown as a (PR) marker in Rotation Planning until sign-on\nIf timing is On Board: promotion ready for execution at the next sign-on",
             "[Crewing Executive / Crewing Manager]\n\nExecute the promotion at the applicable moment\n(after sign-on for On Board timing; before joining for Prior Joining timing)\n\nStatus (of Review): → Completed",
             "[System]\n\nSeafarer's rank updated\nPromotion recorded in the promotion history\nNew wage scale applied in Crew Accounts where the rank change affects pay\n\nAction recorded in audit trail (user, date & time)",
             ""),

            (15, "Promotion — Reject", "Normal",
             "[Crewing Manager]\n\nReview the promotion case\nEnter mandatory Rejection Comments\nReject the promotion\n\nStatus (of decision): → Rejected\n\n⚠️ GAP G11: the review itself still shows For Approval — no separate Rejected status\n⚠️ GAP G2: Notification sent to [Crewing Executive] — not implemented\n\nAction recorded in audit trail (user, date & time)",
             "", "", "", "", "", ""),

            (16, "Promotion — Waitlist", "Normal",
             "[Crewing Manager]\n\nCandidate is qualified but no position is available\nSet the decision to Waitlist and enter the reason\n\nStatus (of Review): → Waitlisted\n\nAction recorded in audit trail (user, date & time)",
             "", "", "", "", "", ""),
        ]
    },
    {
        "header": (
            "E.  APPRAISALS   |   "
            "Normal = stage-gate progression (no rejection path in the current system)   |   "
            "Level 1 = Vessel HOD / Master (Stages 1–2)   |   Level 2 = Crewing Manager (Stage 3 Office Review)   |   "
            "⚠️ GAP G5: no seafarer acknowledgement step between Stage 2 and Stage 3"
        ),
        "rows": [
            (17, "Appraisal — Complete Cycle\n(Vessel Assessment → Office Review)\n⚠️ GAP G5: no seafarer acknowledgement step", "Normal",
             "[Vessel HOD / Master]\n\nCreate the appraisal for the seafarer\nComplete Stage 1: seafarer information, appraisal period, vessel, start information\nSubmit Stage 1\n\nStatus (of Appraisal): → Preliminary",
             "[Vessel HOD / Master]\n\nComplete Stage 2: all competence assessments and recommendation sections\nSubmit Stage 2\n\nStatus (of Appraisal): → Submitted\nPerformance assessment sections locked",
             "[System]\n\nStage order enforced: Stage 2 cannot be submitted before Stage 1 is complete\nAppraisal becomes visible and actionable for the office\n\n⚠️ GAP G5: no step for the seafarer to acknowledge or sign the assessment",
             "[Crewing Manager / Crewing Executive]\n\nComplete Stage 3 Office Review & Follow-up\nEvaluate every identified training item\nUpdate training follow-up statuses: Proposed → Approved → Planned → Completed / Declined\nSubmit Stage 3\n\nStatus (of Appraisal): → Reviewed\nEntire form locked",
             "[System]\n\nPromotion recommendation count updated (visible to the Promotions module)\nApproved / Planned training items sent to the Training & Retention module\n\nAction recorded in audit trail (user, date & time)",
             "", ""),
        ]
    },
    {
        "header": (
            "F.  TRAINING & RETENTION   |   "
            "Normal = direct status updates, no approval in the current system   |   "
            "⚠️ GAP G4: no approval or completion-verification step"
        ),
        "rows": [
            (18, "Training Need — Identify, Progress & Complete\n⚠️ GAP G4: no verification step", "Normal",
             "[Crewing Executive / Crewing Manager]\n\nTraining need identified from one of three sources:\n• Recruitment screening (training gaps identified at stage B7)\n• Appraisal Stage 3 Office Review (follow-up items)\n• Promotion review (prerequisite for the target rank)\nEach item records: training name, category (Mandatory / Recommended / Optional / Other), due date, identified by\n\nStatus (of Training Need): → Pending",
             "[System]\n\nItems appear in the Training & Retention module\nList can be filtered by source: Recruitment / Appraisal / Promotion",
             "[Crewing Executive / Crewing Manager]\n\nUpdate the status as training progresses:\nPending → Scheduled (training booked)\nScheduled → In Progress (underway)\nIn Progress → Completed (certificate received) or Cancelled\nEnter comments per item\n\n⚠️ GAP G4: no verification step before an item is marked Completed\n\nAction recorded in audit trail (user, date & time)",
             "", "", "", ""),
        ]
    },
    {
        "header": (
            "G.  DRUGS & ALCOHOL   |   "
            "Normal = record, submit, lock   |   Critical = positive result escalation   |   "
            "⚠️ GAP G3: escalation path for positive results not implemented"
        ),
        "rows": [
            (19, "D&A Test — Record, Confirm, Submit & Lock", "Normal",
             "[Master / Vessel HOD]\n\nCreate test record for the vessel and date\nSelect Test Type: Annual / Periodic / Monthly / Post-Incident / Others\nSelect Test Category: Alcohol / Drug (or both)\nDuplicate records for the same vessel and date are blocked by the system\n\nStatus (of Record): → Draft",
             "[Master / Vessel HOD]\n\nEnter all personnel tested\nRecord each individual's alcohol result and drug result: Positive / Negative\nNote where testing equipment was not applicable",
             "[Master]\n\nReview all personnel entries\nApply digital confirmation (signature)",
             "[Master / Vessel HOD]\n\nAttach supporting documents\nSubmit the record\n\nStatus (of Record): → Submitted\n\n⚠️ GAP G2: Notification sent to [Crewing Manager] — not implemented",
             "[Crewing Manager / Crewing Executive]\n\nLock the record to prevent further edits (requires lock permission)\n\nStatus (of Record): → Locked\n\nAction recorded in audit trail (user, date & time)",
             "", ""),

            (20, "D&A — Positive Result Escalation\n⚠️ GAP G3: no escalation workflow exists", "Critical",
             "[System]\n\nPositive result flagged against the individual on the personnel tested list\nViolation counted in the D&A dashboard\n\n⚠️ GAP G3: no automated notification, case creation or escalation is triggered",
             "[Crewing Manager]\n\nManually identify the violation in the D&A records / dashboard\nInitiate the HR / disciplinary process outside the system\n\n⚠️ GAP G3: no in-system escalation, case management or formal notification workflow exists",
             "", "", "", "", ""),
        ]
    },
    {
        "header": (
            "H.  REST HOURS   |   "
            "Normal = monthly review cycle   |   "
            "Level 1 = Master (vessel)   |   Level 2 = Crewing Manager / Marine Superintendent (office)"
        ),
        "rows": [
            (21, "Rest Hours — Monthly Review & Lock", "Normal",
             "[Master / Vessel HOD]\n\nReview rest hours records for the month\nIdentify and acknowledge non-conformities\nSubmit the vessel monthly review\n\nStatus (of Vessel Review): → Submitted\n(automatically shown as Overdue if not submitted by the 7th of the following month)",
             "[Crewing Manager / Marine Superintendent]\n\nReview the vessel-submitted data, non-conformities and planned remediation\nSubmit the office review\n\nStatus (of Office Review): → Submitted / Completed\n(automatically shown as Overdue if not submitted by the 10th of the following month)",
             "[Crewing Manager]\n\nLock the vessel monthly record (requires lock permission)\n\nStatus (of Record): → Locked\n\nAction recorded in audit trail (user, date & time)",
             "", "", "", ""),

            (22, "Rest Hours — Non-Conformity Report\n(Open → Close)", "Normal",
             "[Master / Vessel HOD]\n\nIdentify an MLC / STCW non-conformity in the rest hours data\nCreate the NC Report: violation details, affected crew, circumstances\nPropose the preventive action\n\nStatus (of NC Report): → Open",
             "[Master]\n\nSubmit the NC Report from the vessel\n\nStatus (of Submission): → Vessel Submitted\n\n⚠️ GAP G2: Notification sent to [Crewing Manager / Marine Superintendent] — not implemented",
             "[Crewing Manager / Marine Superintendent]\n\nReview the vessel-submitted report\nVerify the preventive action was completed\nRecord the closure verification name and date\nSubmit the office closure\n\nStatus (of NC Report): → Closed\n\nAction recorded in audit trail (user, date & time)",
             "", "", "", ""),
        ]
    },
    {
        "header": (
            "I.  CREW ACCOUNTS  (Payroll & Financial)   |   "
            "Critical = Portage Bills & Final Settlement (financial, two-level)   |   "
            "Level 1 = Accounts Officer / Crewing Manager   |   Level 2 = Finance Manager"
        ),
        "rows": [
            (23, "Portage Bill — Prepare, Approve & Lock\n(Office-Prepares Mode)", "Critical",
             "[Accounts Officer / Crewing Executive]\n\nOpen the portage workspace for the vessel and month\nRun the wage calculation\nReview crew totals and the pay breakdown\n\nStatus (of Portage Bill): → Open",
             "[Accounts Officer / Crewing Manager]\n\nReview the completed bill and crew totals\nSelect approver(s) — minimum one required\nSubmit for approval; any earlier approval round is replaced by a fresh one\n\nStatus (of Portage Bill): → Office Review\n\n⚠️ GAP G2: Notification sent to approver(s) — not implemented",
             "[Crewing Manager / Finance Manager]\n\nReview the bill, crew totals and pay detail\nApprove, with optional comments\n\nStatus (of each approval): → Approved",
             "[System]\n\nWhen every approver has approved:\nIf auto-lock is switched on for the company — bill locked immediately and the linked Cash-to-Master record locked\nIf auto-lock is switched off — bill set to Approved, awaiting manual lock\n\nStatus (of Portage Bill): → Locked or Approved",
             "[Accounts Officer / Finance Manager]\n\nIf not auto-locked: manually lock the approved bill\nLinked Cash-to-Master record locked\n\nStatus (of Portage Bill): → Locked\n\nAction recorded in audit trail (user, date & time)",
             "", ""),

            (24, "Portage Bill — Prepare, Approve & Lock\n(Vessel-Prepares Mode)", "Critical",
             "[Master / Vessel HOD]\n\nEnter portage data on board:\nattendance, overtime, bonuses, deductions per crew member\n\nStatus (of Portage Bill): → Vessel Draft",
             "[Accounts Officer]\n\nReceive the vessel draft at the office\nReview and reconcile against the crew master data\nPrepare for submission",
             "[Accounts Officer / Crewing Manager]\n\nSubmit for approval\nApproval and locking then proceed as Item 23, Steps 3–5\n\nStatus (of Portage Bill): → Office Review → Approved → Locked\n\nAction recorded in audit trail (user, date & time)",
             "", "", "", ""),

            (25, "Portage Bill — Reject / Return & Re-submit", "Critical",
             "[Crewing Manager / Finance Manager]\n\nReview the bill\nEnter mandatory Rejection Comments\nReject the bill\n\nStatus (of Portage Bill): → Returned\n\n⚠️ GAP G2: Notification sent to [Accounts Officer] — not implemented",
             "[Accounts Officer]\n\nReview the rejection comments\nCorrect the payroll data and recalculate\nRe-submit — a fresh approval round is created\n\nStatus (of Portage Bill): → Office Review\n\nAction recorded in audit trail (user, date & time)",
             "", "", "", "", ""),

            (26, "Cash Advance — Request, Approve,\nDisburse & Recover", "Normal",
             "[Accounts Officer / Master]\n\nCreate a cash advance request for the crew member\nEnter amount, currency and reason\n\nStatus (of Advance): → Pending",
             "[Crewing Manager / Finance Manager]\n\nReview the request against the crew member's entitlement\nApprove or Reject\n\nStatus (of Advance): → Approved or Rejected",
             "[Accounts Officer]\n\nDisburse the approved advance\n\nStatus (of Advance): → Disbursed",
             "[System]\n\nRecovery instalments scheduled in the monthly payroll\n\nStatus (of Advance): → Recovered, once fully recovered\n\nAction recorded in audit trail (user, date & time)",
             "", "", ""),

            (27, "Allotment — Setup / Modify / Suspend / End\n⚠️ GAP G10: no formal approval step", "Normal",
             "[Accounts Officer]\n\nCreate or update the allotment for the crew member\nEnter beneficiary name, amount, frequency, bank details\nAmount validated against the company's maximum allotment percentage\n\nStatus (of Allotment): → Active",
             "[Crewing Manager]\n\nReview and confirm the allotment change\n[ASSUMPTION A6: recommended step — no formal approval exists in the current system]\nSuspend — Status (of Allotment): → Suspended\nEnd — Status (of Allotment): → Ended\n\nAction recorded in audit trail (user, date & time)",
             "", "", "", "", ""),

            (28, "Final Settlement — Calculate, Review & Approve\n(Sign-Off)", "Critical",
             "[Accounts Officer]\n\nCrew member has signed off the vessel\nCalculate the final settlement: balance wages, leave pay, repatriation allowance, deductions\nPrepare the settlement statement\n\nStatus (of Engagement): → Completed",
             "[Crewing Manager]\n\nReview the final settlement statement\nVerify against the engagement history\nSubmit for final approval",
             "[Finance Manager]\n\nFinal approval of the settlement amounts\n[ASSUMPTION A7: approval path inferred from the portage bill approval pattern]\n\nStatus (of Engagement): → Settled",
             "[System]\n\nSettlement amounts locked\nFinal month's portage bill updated to reflect the sign-off\nAllotments ended\nCash advance recovery balanced\n\nAction recorded in audit trail (user, date & time)",
             "", "", ""),
        ]
    },
]

GAPS = [
    ("G1", "High Priority", "No Approval Step on Crew Terminations",
     "Termination is a direct update — any user with edit rights on the Crew Pool menu can terminate a seafarer. "
     "For a compliance-heavy maritime operation, company-initiated terminations (especially the UT and BT categories) "
     "should require at least a Level 1 manager approval before the seafarer is marked Terminated. "
     "Recommend an intermediate Pending Termination status with a recorded manager approval."),
    ("G2", "High Priority", "No Workflow-Triggered Notifications",
     "The alerts engine exists (document expiry, relief due) but no workflow step currently sends a notification. "
     "Every ⚠️ GAP G2 flag in the register marks a missing notification. Impacted: recruitment approval/rejection, "
     "rotation deploy/reject, promotion decisions, portage bill submission/rejection, D&A submission, NC report submission. "
     "Recommend extending the alerts engine to cover workflow events."),
    ("G3", "Critical — Compliance", "No Escalation Workflow for D&A Positive Results",
     "A positive test result is flagged and counted on the dashboard, but nothing is triggered automatically. "
     "A positive result on a SOLAS vessel is a safety-critical event (STCW requirement). "
     "Recommend: automatically create an escalation case, notify the Crewing Manager and Fleet Personnel Manager, "
     "and block sign-on of the affected seafarer until the case is closed."),
    ("G4", "Medium Priority", "No Approval Step in Training & Retention",
     "Training status changes (Pending → Scheduled → Completed) are direct updates. For mandatory training, "
     "completion should require a verification step (certificate upload plus manager sign-off) before the training "
     "counts as compliant."),
    ("G5", "Medium Priority — MLC context", "No Seafarer Acknowledgement in Appraisals",
     "The appraisal moves from the vessel's Stage 2 submission straight to the Stage 3 office review, with no step "
     "for the seafarer to acknowledge or sign the assessment. MLC 2006 implies the seafarer should be aware of their "
     "appraisal. Recommend an acknowledgement step between Stage 2 and Stage 3."),
    ("G6", "", "No Central Audit Log Report",
     "Every action records who did it and when, but there is no single report showing who changed which value "
     "from what to what, and at what time. For financial and compliance areas (Crew Accounts, Terminations, D&A) "
     "a field-level change log is important for regulatory audits."),
    ("G7", "", "Rotation Plan Is Not Automatically Completed",
     "When entries are deployed one by one, the plan shows Partially Approved. It does not automatically change to "
     "Completed when the last entry is decided. Recommend automatically completing the plan once every entry is "
     "either Deployed or Rejected."),
    ("G8", "", "An Unused Portage Bill Status May Exist",
     "A portage bill can show a Submitted status, but the normal flow moves a bill straight to Office Review on "
     "submission. It is unclear how a bill would ever show Submitted in practice. See Question Q2."),
    ("G9", "", "Monthly Transaction Approval Path Unclear",
     "Monthly payroll transactions can show Draft / Submitted / Accepted / Rejected, but no screen or process was "
     "found that performs the Accepted or Rejected step. These may be planned but not yet built. See Question Q3."),
    ("G10", "", "Allotment Changes Have No Formal Approval",
     "Allotment amounts can be changed directly. As allotments are bank payment instructions, a manager sign-off "
     "step is recommended, particularly for new allotments and increases above a threshold."),
    ("G11", "", "A Rejected Promotion Still Shows as Awaiting Approval",
     "When an approver rejects a promotion, the rejection is recorded against that approver's decision, but the "
     "review itself still shows For Approval. A rejected review is therefore indistinguishable from one still "
     "awaiting a decision. See Question Q10."),
]

QUESTIONS = [
    ("Q1", "Recruitment",
     "Two approvers can be selected at submission, but the system does not enforce an order. Is the intent parallel "
     "approval (both approvers see the application at the same time) or sequential (Level 1 first, then Level 2)?"),
    ("Q2", "Crew Accounts",
     "Submission moves a portage bill straight to Office Review. When would a bill ever show a Submitted status? "
     "Is this a legacy value from an older flow, or part of a process not yet visible?"),
    ("Q3", "Crew Accounts",
     "Who accepts or rejects a monthly payroll transaction, and what triggers it? Is this the vessel-side daily "
     "portage flow, the office portage bill, or something else?"),
    ("Q4", "Rest Hours",
     "Is the office review marked Completed automatically once it is Submitted, or is there a separate completion "
     "confirmation action? Please confirm the exact trigger."),
    ("Q5", "Drugs & Alcohol",
     "Should a positive test result trigger any in-system action (notification, case creation, sign-on block)? "
     "Or is the process handled entirely outside the system?"),
    ("Q6", "Appraisals",
     "Is there an intent (or regulatory requirement) for the seafarer to acknowledge their appraisal within the "
     "system, or is this handled on paper / outside the system?"),
    ("Q7", "Crew Pool",
     "Should company-initiated terminations (especially the UT and BT categories) require a Crewing Manager or "
     "Fleet Personnel Manager sign-off before taking effect?"),
    ("Q8", "Training & Retention",
     "Should completion of a Mandatory training item require a certificate upload and manager verification before "
     "the item is marked Completed?"),
    ("Q9", "Crew Accounts",
     "Should allotment creation, or changes above a defined amount (or above the company's maximum allotment "
     "percentage), require Finance Manager approval?"),
    ("Q10", "Promotions",
     "Should a rejected promotion review show a distinct Rejected status on the review itself, separate from the "
     "individual approver's decision? This affects reporting and re-opening."),
]

ASSUMPTIONS = [
    ("A1", "Recruitment — two-level approval",
     "Two-level approval is achieved by selecting two approvers at submission. No order is enforced by the system. "
     "Treated as Level 1 = Crewing Manager, Level 2 = Fleet Personnel Manager for register purposes."),
    ("A2", "Rotation — Critical flag for Top-4 ranks",
     "The Critical designation for Top-4 officer deployments (Master, Chief Officer, Chief Engineer, Second Engineer) "
     "is not enforced by the system. Included in the register as a recommended pattern; all current deploy/reject "
     "actions are treated identically regardless of rank."),
    ("A3", "Promotions — Critical type",
     "The Critical designation for senior-rank or cross-fleet promotions is not enforced by the system. "
     "Register items are marked Normal accordingly; the Critical variant is noted as recommended."),
    ("A4", "D&A — escalation",
     "No escalation workflow exists for positive test results. Item 20 is shown as a Critical / GAP row to flag "
     "this as a missing compliance control."),
    ("A5", "Training — verification",
     "No approval or verification step exists for training completion. The verification shown is a recommended "
     "step, not a current one."),
    ("A6", "Allotment — approval",
     "No formal approval step exists for allotment changes. The manager review shown in Item 27 is a recommended "
     "step, not currently in place."),
    ("A7", "Final settlement — approval path",
     "No explicit settlement approval screen was found. The pattern (Accounts Officer prepares → Crewing Manager "
     "reviews → Finance Manager approves) is inferred from the portage bill approval pattern and the engagement "
     "status sequence."),
]

ROLE_MAPPING = [
    ("[Manning Agent]",           "External party; their data is entered into the system by the Crewing Executive. No system login."),
    ("[Crewing Executive]",       "Office user who can create and edit records in the Recruitment, Crew Pool and Vessel modules (rights set in Admin › Access Control)."),
    ("[Crewing Manager]",         "Office user with approval-level rights on approval screens. Role name configured per company by the Administrator."),
    ("[Fleet Personnel Manager]", "Office user with the highest-level rights across all crewing menus. Role name configured per company."),
    ("[Master]",                  "Ship user signed in for specific vessels; has access to the vessel-side modules (D&A, Rest Hours, Appraisals, Sign-On/Off)."),
    ("[Marine Superintendent]",   "Office user with review rights on the Rest Hours screens. Role name configured per company."),
    ("[Vessel HOD]",              "Ship user with department-level rights on the vessel."),
    ("[Accounts Officer]",        "Office user who can create and edit records on the payroll and portage screens."),
    ("[Finance Manager]",         "Office user with approval-level rights on the Accounts screens. Role name configured per company."),
    ("[System]",                  "Automated actions performed by the application itself: automatic record creation, status calculation, scheduled alerts."),
    ("[Seafarer]",                "Subject of the records; has no login and interacts through on-board paper forms or vessel users."),
]


# ---------------------------------------------------------------------------
# Build workbook
# ---------------------------------------------------------------------------

def build_workbook():
    wb = Workbook()
    ws = wb.active
    ws.title = "CREWING Approval Workflows"
    build_main_sheet(ws)
    build_gaps_sheet(wb.create_sheet("Gaps & Recommendations"))
    build_qa_sheet(wb.create_sheet("Questions & Assumptions"))
    build_role_sheet(wb.create_sheet("Role Mapping"))
    return wb


def build_main_sheet(ws):
    COL_WIDTHS = [8, 38, 13, 32, 32, 32, 32, 32, 32, 32]
    for i, w in enumerate(COL_WIDTHS, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    # Row 1: Title
    ws.merge_cells("A1:J1")
    c = ws["A1"]
    c.value = "CREWING MODULE — COMPLETE APPROVAL WORKFLOW REGISTER"
    c.font = Font(bold=True, color=WHITE, size=14)
    c.fill = fill(NAVY)
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[1].height = 30

    # Row 2: Column headers
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
    for section in SECTIONS:
        # Spacer
        ws.row_dimensions[current_row].height = 6
        current_row += 1

        # Section header row — merge B:J
        ws.merge_cells(start_row=current_row, start_column=2, end_row=current_row, end_column=10)
        c = ws.cell(row=current_row, column=2, value=section["header"])
        c.font = Font(bold=True, color=WHITE, size=10)
        c.fill = fill(MID_BLUE)
        c.alignment = Alignment(wrap_text=True, vertical="center")
        ws.cell(row=current_row, column=1).fill = fill(MID_BLUE)
        ws.row_dimensions[current_row].height = 40
        current_row += 1

        for row_data in section["rows"]:
            item_no, process, typ, *steps = row_data
            steps = list(steps) + [""] * (7 - len(steps))

            is_critical = (typ == "Critical")
            row_fill = fill(RED_ROW) if is_critical else fill(GREEN_ROW)

            c = ws.cell(row=current_row, column=1, value=item_no)
            c.font = black_bold()
            c.fill = row_fill
            c.alignment = CENTER
            c.border = thin_border()

            c = ws.cell(row=current_row, column=2, value=process)
            c.font = black_bold()
            c.fill = row_fill
            c.alignment = WRAP_TOP
            c.border = thin_border()

            c = ws.cell(row=current_row, column=3, value=typ)
            c.fill = fill(RED_TYPE) if is_critical else fill(GREEN_TYPE)
            c.font = Font(bold=True, size=10, color=RED_TXT if is_critical else GREEN_TXT)
            c.alignment = CENTER
            c.border = thin_border()

            max_lines = 1
            for step_idx, step_text in enumerate(steps, start=4):
                c = ws.cell(row=current_row, column=step_idx, value=step_text or None)
                c.font = black()
                c.fill = row_fill
                c.alignment = WRAP_TOP
                c.border = thin_border()
                if step_text:
                    max_lines = max(max_lines, step_text.count("\n") + 1)

            ws.row_dimensions[current_row].height = min(max(max_lines * 13, 60), 320)
            current_row += 1

    ws.row_dimensions[current_row].height = 6


def build_table_sheet(ws, title, title_fill, headers, widths, rows, row_height):
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    last_col = get_column_letter(len(headers))
    ws.merge_cells(f"A1:{last_col}1")
    c = ws["A1"]
    c.value = title
    c.font = Font(bold=True, color=WHITE, size=12)
    c.fill = fill(title_fill)
    c.alignment = CENTER
    ws.row_dimensions[1].height = 26

    for col, h in enumerate(headers, start=1):
        c = ws.cell(row=2, column=col, value=h)
        c.font = white_bold(10)
        c.fill = fill(HDR_BLUE)
        c.alignment = WRAP_CENTER
        c.border = thin_border()
    ws.row_dimensions[2].height = 18

    ws.freeze_panes = "A3"

    for i, row_vals in enumerate(rows, start=3):
        row_fill = fill(GREEN_ROW) if (i % 2 == 0) else fill(WHITE)
        for col, val in enumerate(row_vals, start=1):
            c = ws.cell(row=i, column=col, value=val)
            c.font = black()
            c.fill = row_fill
            c.alignment = WRAP_TOP
            c.border = thin_border()
        ws.cell(row=i, column=1).font = black_bold()
        ws.row_dimensions[i].height = row_height


def build_gaps_sheet(ws):
    build_table_sheet(
        ws, "GAPS & RECOMMENDATIONS", NAVY,
        ["#", "Priority", "Title", "Detail"],
        [8, 25, 45, 90], GAPS, 60,
    )


def build_qa_sheet(ws):
    build_table_sheet(
        ws, "QUESTIONS (require stakeholder input before Phase 2)", NAVY,
        ["#", "Sub-module", "Question"],
        [8, 22, 100], QUESTIONS, 50,
    )

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

    for i, row_vals in enumerate(ASSUMPTIONS):
        r = next_row + i
        row_fill = fill(GREEN_ROW) if (i % 2 == 0) else fill(WHITE)
        for col, val in enumerate(row_vals, start=1):
            c = ws.cell(row=r, column=col, value=val)
            c.font = black()
            c.fill = row_fill
            c.alignment = WRAP_TOP
            c.border = thin_border()
        ws.cell(row=r, column=1).font = black_bold()
        ws.row_dimensions[r].height = 50


def build_role_sheet(ws):
    build_table_sheet(
        ws, "ROLE MAPPING — Register Label → Who This Is in the System", NAVY,
        ["Register Role", "Who This Is in the System"],
        [28, 100], ROLE_MAPPING, 34,
    )
    for i in range(3, 3 + len(ROLE_MAPPING)):
        ws.cell(row=i, column=1).font = black_bold()


if __name__ == "__main__":
    os.makedirs("attached_assets", exist_ok=True)
    output_path = "attached_assets/Crewing_Approval_Workflow_Register.xlsx"
    wb = build_workbook()
    wb.save(output_path)
    print(f"Saved: {output_path}")
