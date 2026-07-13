# SAIL Crewing — Approval Workflow Register

**Module:** Crewing (all sub-modules)
**Phase:** 1 — Analysis & Documentation (no code changes)
**Date:** 13-Jul-2026
**Status:** Draft — awaiting review of Questions & Assumptions (Step 4)

---

## Contents

- [Role Mapping](#role-mapping)
- [A. Recruitment](#a-recruitment)
- [B. Crew Pool / Crew Database](#b-crew-pool--crew-database)
- [C. Vessel Assignment & Rotation](#c-vessel-assignment--rotation)
- [D. Promotions](#d-promotions)
- [E. Appraisals](#e-appraisals)
- [F. Training & Retention](#f-training--retention)
- [G. Drugs & Alcohol](#g-drugs--alcohol)
- [H. Rest Hours](#h-rest-hours)
- [I. Crew Accounts](#i-crew-accounts)
- [Gaps & Recommendations](#gaps--recommendations)
- [Questions & Assumptions](#questions--assumptions)

---

## Role Mapping

The system uses a **dynamic ACL** (configured per-tenant in Admin › Access Control). There are no hardcoded role names in application code beyond the `userType` JWT field (`"Ship"` vs Office). The register uses domain-role labels; the table below maps them to code equivalents.

| Register Role | Code Equivalent |
|---|---|
| **[Manning Agent]** | External party; data entered into the system by Crewing Executive. No system login role. |
| **[Crewing Executive]** | Office user with `cancreate` + `canedit` on Recruitment, Crew Pool, Vessel modules in Admin › Access Control |
| **[Crewing Manager]** | Office user with approval-level permissions (typically `canedit` + `candelete` on approval menus). Role name configured per-tenant by Administrator. |
| **[Fleet Personnel Manager]** | Office user with highest-level permissions across all crewing menus. Role name configured per-tenant. |
| **[Master]** | `userType: "Ship"` in JWT, with vessel UUIDs in `vessels` claim. Has access to vessel-side modules (D&A, Rest Hours, Appraisals, Sign-On/Off). |
| **[Vessel HOD]** | `userType: "Ship"` user with department-level permissions on the vessel. |
| **[Accounts Officer]** | Office user with `cancreate` + `canedit` on Account Payroll Run, Account Vessel Portage menus. |
| **[Finance Manager]** | Office user with approval-level permissions on Accounts menus. Role name configured per-tenant. |
| **[System]** | Automated server-side logic: service layer functions, cron jobs (alert engine), Drizzle ORM triggers. |
| **[Seafarer]** | Subject of records. Has no login in this system; interacts only through on-board paper or vessel-user proxies. |

---

## A. RECRUITMENT

**Normal** = single approver | **Critical** = two-level approvers
**Level 1** = Crewing Manager | **Level 2** = Fleet Personnel Manager
**[ASSUMPTION A1]** Two-level approval is achieved by selecting two approvers at B8 — no ordering is enforced in code; treated as L1 = Crewing Manager, L2 = Fleet Personnel Manager.

| Item | Process | Type | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 | Step 6 | Step 7 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Recruitment Application — Create (Part A — Candidate Profile) | Normal | **[Manning Agent / Crewing Executive]**<br><br>Enter candidate name, rank applied for, nationality, DOB, gender<br>Enter personal details, family info, next-of-kin, addresses<br>Enter documents, visas, licenses, training courses, sea service, education<br>Attach supporting documents and photo<br><br>Status (of Application): → **Draft**<br>Audit: rec_can_uuid auto-assigned; created_by_uuid, created_at stamped | **[System]**<br><br>Auto-assign rec_can_uuid<br>Auto-assign file_no | | | | | |
| 2 | Recruitment Application — B1 Initial Screening | Normal | **[Crewing Executive]**<br><br>Open candidate in Draft status<br>Verify: age meets criteria, rank meets criteria, certificates valid<br>Record shortlisted: Yes / No<br>Add comments and attachments<br>Submit B1<br><br>Status (of B1 stage): → Submitted<br>submitted_by_uuid + submitted_date stamped | | | | | | |
| 3 | Recruitment Application — B2 Reference Checks | Normal | **[Crewing Executive]**<br><br>Contact previous employers<br>Record reference contact names, dates, contact info<br>Record employer feedback<br>Mark references_completed: Yes / No<br>Add comments and attachments<br>Submit B2<br><br>Status (of B2 stage): → Submitted<br>submitted_by_uuid + submitted_date stamped | | | | | | |
| 4 | Recruitment Application — B3 Background & Security Checks | Normal | **[Crewing Executive]**<br><br>Submit candidate details to security authorities<br>Record authority names and check dates<br>Record results<br>Mark checks_completed: Yes / No<br>Add comments and attachments<br>Submit B3<br><br>Status (of B3 stage): → Submitted<br>submitted_by_uuid + submitted_date stamped | | | | | | |
| 5 | Recruitment Application — B4 Authentication of Certificates & Documents | Normal | **[Crewing Executive]**<br><br>Authenticate certificates against issuing authorities<br>Record authentication date and authority per certificate item<br>Mark certificates_authenticated: Yes / No<br>Add comments and attachments<br>Submit B4<br><br>Status (of B4 stage): → Submitted<br>submitted_by_uuid + submitted_date stamped | | | | | | |
| 6 | Recruitment Application — B5 CES / Language Tests | Normal | **[Crewing Executive]**<br><br>Schedule and administer CES and language proficiency tests<br>Record subject, score, result per test item<br>Mark tests_completed: Yes / No<br>Add comments and attachments<br>Submit B5<br><br>Status (of B5 stage): → Submitted<br>submitted_by_uuid + submitted_date stamped | | | | | | |
| 7 | Recruitment Application — B6 Interviews | Normal | **[Crewing Executive / Crewing Manager]**<br><br>Schedule interview; record interviewer UUID, interview date<br>Record status and result per interview<br>Add comments<br>Mark interview_completed: Yes / No<br>Submit B6<br><br>Status (of B6 stage): → Submitted<br>submitted_by_uuid + submitted_date stamped | | | | | | |
| 8 | Recruitment Application — B7 Training Needs Identified | Normal | **[Crewing Executive]**<br><br>Identify training gaps from B1–B6 evidence and certificate matrix<br>Enter training items: training name, category, due date, identified_by<br>Submit B7<br><br>Status (of B7 stage): → Submitted<br>submitted_by_uuid + submitted_date stamped | **[System]**<br><br>Training need items auto-created in Training & Retention module<br>Source: "recruitment"<br>Status (of each Training Need): → **Pending** | | | | | |
| 9 | Recruitment Application — B8 Shortlisting & Submission for Approval | Normal | **[Crewing Executive]**<br><br>Review B1–B7 outcomes<br>Mark shortlisted: Yes / No<br>Select approver(s) from user list (stored as selected_approver_uuids)<br>Submit for approval<br><br>Status (of Application): → **For Approval**<br>submitted_by_uuid + submitted_date stamped on B8<br><br>⚠️ GAP: Notification sent to [Crewing Manager] — not implemented | **[System]**<br><br>Approval rows created in cand_approvals per selected approver<br>Status (of each Approval row): → **Pending** | | | | | |
| 10 | Recruitment Application — Approve (Part C — Normal, single-level) | Normal | **[Crewing Manager]**<br><br>Review Part A candidate profile<br>Review Part B screening evidence (B1–B8)<br>Complete Part C1: record approval_result<br>Complete Part C2: record Suitable For (vessel types, fleet groups in cand_suitability)<br>Complete Part C3: set recruitment_status = **Recruited**, enter recruited_date<br><br>Status (of Approval row): → **Approved**<br>Status (of Application): → **Recruited**<br>submitted_by_uuid + submitted_date stamped on cand_recruitment_decision | **[System]**<br><br>Crew record auto-created in crew_members_v2<br>crew_uuid assigned; status: Active; isActive: true<br>B7 training needs retained in Training & Retention module<br>Audit: created_by_uuid, created_at stamped | | | | | |
| 11 | Recruitment Application — Approve (Part C — Critical, two-level) **[ASSUMPTION A1]** | Critical | **[Crewing Manager]**<br><br>Review Part A + Part B evidence<br>Complete Part C1 at Level 1<br>Set approval_result (Level 1 approval row)<br><br>Status (of L1 Approval row): → **Approved** | **[Fleet Personnel Manager]**<br><br>Review Part A + Part B evidence and L1 decision<br>Complete Part C1 at Level 2<br>Complete Part C2 — Suitable For<br>Complete Part C3 — set recruitment_status = Recruited<br><br>Status (of L2 Approval row): → **Approved**<br>Status (of Application): → **Recruited** (triggered when all approval rows = Approved) | **[System]**<br><br>Crew record auto-created in crew_members_v2<br>crew_uuid assigned; status: Active; isActive: true<br>B7 training needs retained | | | | | |
| 12 | Recruitment Application — Reject (Part C — deficiency found at screening or approval stage) | Normal | **[Crewing Manager]**<br><br>Review Part A + Part B evidence<br>Enter mandatory rejection reason in comments field<br>Set approval_result = Rejected<br><br>Status (of Approval row): → **Rejected**<br>Status (of Application): → **Rejected**<br><br>⚠️ GAP: Notification sent to [Crewing Executive] — not implemented | **[System]**<br><br>Record retained for audit<br>Audit: updated_by_uuid, updated_at stamped | | | | | |
| 13 | Recruitment Application — Waitlist (qualified but no current vacancy) | Normal | **[Crewing Manager]**<br><br>Review Part A + Part B evidence<br>Set recruitment_status = **Waitlisted**<br>Enter comments (reason for waitlisting)<br><br>Status (of Application): → **Waitlisted**<br><br>⚠️ GAP: Notification sent to [Crewing Executive] — not implemented | **[System]**<br><br>Record retained; can be re-evaluated when vacancy arises<br>Audit: submitted_by_uuid, submitted_date stamped | | | | | |

---

## B. CREW POOL / CREW DATABASE

**Normal** = direct write, no approval level in current code
⚠️ Approval gaps noted — see Gaps & Recommendations G1

| Item | Process | Type | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 | Step 6 | Step 7 |
|---|---|---|---|---|---|---|---|---|---|
| 14 | Crew Record — Create (auto-transfer from Recruited candidate) | Normal | **[System]**<br><br>Triggered when cand_recruitment_decision.recruitment_status = Recruited<br>POST /api/v2/crew-pool/transfer/recruitment<br>Candidate data copied to crew_members_v2<br>crew_uuid auto-assigned<br><br>Status (of Crew): → **Active** (isActive: true)<br>Audit: created_by_uuid, created_at stamped | **[Crewing Executive]**<br><br>Verify transferred record in Crew Pool<br>Complete additional sections: medical, travel documents, emergency contacts, flag-state documents<br><br>Audit: updated_by_uuid, updated_at stamped | | | | | |
| 15 | Crew Record — Create (manual entry, not via Recruitment module) | Normal | **[Crewing Executive]**<br><br>POST /api/v2/crew-pool/crew<br>Enter crew personal details, rank, nationality, DOB<br>Enter certificates, licenses, sea service, medical, documents<br><br>Status (of Crew): → **Active** (isActive: true)<br>crew_uuid auto-assigned<br>Audit: created_by_uuid, created_at stamped | | | | | | |
| 16 | Crew Record — Update Particulars / Documents / Certificates / Sea Service | Normal | **[Crewing Executive]**<br><br>Edit any section of the crew profile<br>(personal details, documents, licenses, sea service, medical, addresses, NOK)<br><br>Status (of Crew): No change<br>Audit: updated_by_uuid, updated_at stamped | | | | | | |
| 17 | Crew Termination — Company-Initiated (General / UT / BT) ⚠️ GAP G1: no approval step; direct write | Normal | **[Crewing Executive]**<br><br>Open crew record<br>Select initiated_by: **Company**<br>Select category: General / Unavoidable Termination (UT) / Beneficial Termination (BT)<br>Select reason: Poor Performance / Disciplinary / No suitable vessel / Unresponsive / Other<br>Enter effective termination date and notes<br>Set not_for_hire flag if applicable<br>POST /api/v2/crew-pool/crew/:crewUuid/terminations<br><br>Status (of Crew): → **Terminated**<br>Audit: created_by_uuid, created_at stamped on crew_terminations | **[System]**<br><br>crew_members_v2.status → Terminated<br>Active vessel assignments cleared<br>Audit: updated_by_uuid, updated_at stamped | | | | | |
| 18 | Crew Termination — Crew-Initiated (Resignation) ⚠️ GAP G1: no approval step; direct write | Normal | **[Crewing Executive]**<br><br>Open crew record<br>Select initiated_by: **Crew Member (resignation)**<br>Category: General<br>Reason: Resignation<br>Enter effective date and notes<br>POST /api/v2/crew-pool/crew/:crewUuid/terminations<br><br>Status (of Crew): → **Terminated**<br>Audit: created_by_uuid, created_at stamped on crew_terminations | **[System]**<br><br>crew_members_v2.status → Terminated<br>Audit: updated_by_uuid, updated_at stamped | | | | | |
| 19 | Crew Record — Archive / Deactivate (soft-delete) | Normal | **[Crewing Executive]**<br><br>Soft-delete crew record<br>DELETE /api/v2/crew-pool/crew/:crewUuid<br><br>Status (of Crew): → **Inactive** (is_deleted: true, isActive: false)<br>archived_at stamped<br>Audit: updated_by_uuid, updated_at stamped | | | | | | |

---

## C. VESSEL ASSIGNMENT & ROTATION

**Critical** = Top-4 Officers (Master, C/O, C/E, 2/E)
**Level 1** = Crewing Manager | **Level 2** = Fleet Personnel Manager
**[ASSUMPTION A2]** The "Critical" flag for top-4 rank entries is not implemented in code; included as a recommended pattern. All deploy/reject actions are currently treated identically regardless of rank.

| Item | Process | Type | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 | Step 6 | Step 7 |
|---|---|---|---|---|---|---|---|---|---|
| 20 | Rotation Plan — Create Draft | Normal | **[Crewing Executive / Crewing Manager]**<br><br>Create new rotation draft for a vessel and planning period<br>Add rotation entries: planned crew, reliever candidates, proposed dates, remarks<br><br>Status (of Plan): → **In Draft**<br>Status (of Entries): → **Pending**<br>Audit: created_by_uuid, created_at stamped | | | | | | |
| 21 | Rotation Plan — Propose (Submit for Review) | Normal | **[Crewing Executive / Crewing Manager]**<br><br>Review all entries in draft<br>Trigger Propose action on the plan<br><br>Status (of Plan): In Draft → **Proposed**<br>Audit: updated_by_uuid, updated_at stamped<br><br>⚠️ GAP: Notification sent to [Crewing Manager] — not implemented | | | | | | |
| 22 | Rotation Entry — Deploy (Approve Assignment) — Normal rank | Normal | **[Crewing Manager]**<br><br>Open Proposed plan in Approval table<br>Review entry: crew member, vessel, dates, rank match, documentation status<br>Confirm suitability and regulatory compliance<br>Click Deploy<br><br>Status (of Entry): Pending → **Deployed**<br>Status (of Plan): → **Partially Approved** (other entries pending) or **Completed** (all deployed)<br>Audit: updated_by_uuid, updated_at stamped<br><br>⚠️ GAP: Notification sent to [Crewing Executive] — not implemented | **[System]**<br><br>vessel_planning_v2 record created<br>joining_status: → **Planned**<br>reliever crew UUID set on planning record<br>crew_assignments row created: type = Planned, isCurrent = false<br>Audit: created_by_uuid, created_at stamped | | | | | |
| 23 | Rotation Entry — Deploy (Approve Assignment) — Top-4 rank **[ASSUMPTION A2]** | Critical | **[Crewing Manager]**<br><br>Review entry for top-4 officer: flag, endorsements, STCW qualifications, GMDSS (if applicable)<br>Approve at Level 1<br><br>Status (of Entry): Pending → reviewed by L1<br>Audit: updated_by_uuid stamped | **[Fleet Personnel Manager]**<br><br>Final review and sign-off<br>Confirm deployment<br><br>Status (of Entry): → **Deployed**<br>Status (of Plan): → Partially Approved / Completed<br>Audit: updated_by_uuid stamped<br><br>⚠️ GAP: Notification sent to [Crewing Executive] — not implemented | **[System]**<br><br>vessel_planning_v2 record created<br>joining_status: → **Planned**<br>crew_assignments: Planned, isCurrent: false | | | | | |
| 24 | Rotation Entry — Reject | Normal | **[Crewing Manager]**<br><br>Review proposed entry<br>Enter mandatory rejection_reason<br>Click Reject<br><br>Status (of Entry): Pending → **Rejected**<br>Audit: updated_by_uuid, updated_at stamped<br><br>⚠️ GAP: Notification sent to [Crewing Executive] — not implemented | **[Crewing Executive]**<br><br>Review rejection reason<br>Identify alternative crew or revised dates<br>Update draft and re-propose | | | | | |
| 25 | Vessel Planning — Update Reliever Joining Status | Normal | **[Crewing Executive]**<br><br>As reliever travel progresses, update joining_status<br>Planned → **Confirmed** (ticket booked)<br>Confirmed → **In Transit** (en route to vessel)<br><br>Audit: updated_by_uuid, updated_at stamped | | | | | | |
| 26 | Vessel Planning — Sign-On | Normal | **[Crewing Executive / Master]**<br><br>Confirm joining date on board<br>Trigger Sign-On action<br><br>Status (of Joining): → **Signed On**<br>Reliever promoted to primary crew in vessel_planning_v2<br>crew_assignments updated: type → **OnBoard**, isCurrent: true<br>Previous primary crew assignment ended (isCurrent: false)<br>Audit: updated_by_uuid, updated_at stamped | **[System]**<br><br>Crew status display: → **On Board**<br>nextAvailability cleared for signing-on crew | | | | | |
| 27 | Vessel Planning — Sign-Off | Normal | **[Crewing Executive / Master]**<br><br>Record sign-off date<br>Record sign_off_reason<br>Complete Part G (Briefing & De-briefing) if applicable<br><br>Status (of Crew): → **On Leave** (assignment isCurrent: false; no active assignment)<br>Audit: updated_by_uuid, updated_at stamped | **[System]**<br><br>Crew status display: → **On Leave**<br>availability / nextAvailability date set<br>Relief planning cycle begins for the vessel | | | | | |
| 28 | Rotation Plan — Archive | Normal | **[Crewing Manager]**<br><br>Archive completed or superseded plan<br><br>Status (of Plan): → **Archived**<br>Audit: updated_by_uuid, updated_at stamped | | | | | | |

---

## D. PROMOTIONS

**Normal** = single-level | **Critical** = senior rank or cross-fleet **[ASSUMPTION A3]**
**Level 1** = Crewing Manager | **Level 2** = Fleet Personnel Manager

| Item | Process | Type | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 | Step 6 | Step 7 |
|---|---|---|---|---|---|---|---|---|---|
| 29 | Promotion Review — Create | Normal | **[Crewing Executive / Crewing Manager]**<br><br>Create promotion review record for crew member<br>Select crew, from_rank, proposed to_rank<br>Review eligibility criteria (verified_status, meets_status per criterion)<br>View promotion recommendation count from recent appraisals<br><br>Status (of Review): → **draft / in progress**<br>isLockForm: false<br>form_version_uuid pinned at creation<br>Audit: created_by_uuid, created_at stamped | | | | | | |
| 30 | Promotion Review — Submit for Approval | Normal | **[Crewing Executive / Crewing Manager]**<br><br>Complete all promotion review particulars<br>Assign approver(s) in promo_approvals_v2<br>Submit for approval<br><br>Status (of Review): in progress → **submitted / for approval**<br>Approval rows: status → **Pending**<br>Audit: updated_by_uuid, updated_at stamped<br><br>⚠️ GAP: Notification sent to [Crewing Manager / Fleet Personnel Manager] — not implemented | | | | | | |
| 31 | Promotion Review — Approve (on-board or prior-joining) | Normal | **[Crewing Manager]**<br><br>Review promotion case: criteria, appraisal recommendations, sea service<br>Set promotionConfirmed: **yes**<br>Set promotionTiming: **on-board** or **prior-joining**<br>Record approval decision on promo_approvals_v2 row<br><br>Status (of Approval row): Pending → **Approved**<br>Status (of Review): → **approved**<br>isLockForm: true<br>Audit: updated_by_uuid, updated_at stamped<br><br>⚠️ GAP: Notification sent to [Crewing Executive] — not implemented | **[System]**<br><br>If timing = prior-joining:<br>Promotion displayed as **(PR)** marker in Rotation Planning until sign-on<br>If timing = on-board:<br>Promotion ready for execution on next sign-on event | | | | | |
| 32 | Promotion Review — Reject | Normal | **[Crewing Manager]**<br><br>Review promotion case<br>Set promotionConfirmed: **rejected**<br>Enter mandatory rejection comments<br><br>Status (of Approval row): Pending → **Rejected**<br>Status (of Review): remains "for approval" with rejection noted on approval row — see GAP G11<br>Audit: updated_by_uuid, updated_at stamped<br><br>⚠️ GAP: Notification sent to [Crewing Executive] — not implemented | | | | | | |
| 33 | Promotion Review — Waitlist | Normal | **[Crewing Manager]**<br><br>Set promotionConfirmed: **waitlist**<br>Enter reason (qualified but no position available)<br><br>Status (of Review): → **Waitlisted** (reflected via promotionConfirmed value)<br>Audit: updated_by_uuid, updated_at stamped | | | | | | |
| 34 | Promotion Review — Execute (Rank Flip — Complete) | Normal | **[Crewing Executive / Crewing Manager]**<br><br>After sign-on event (on-board timing) or before joining (prior-joining timing)<br>Execute promotion<br><br>Status (of Review): approved → **completed**<br>isLockForm: true (full lock)<br>Audit: updated_by_uuid, updated_at stamped | **[System]**<br><br>Write to promo_execution_ledger_v2: from_rank → to_rank (at-most-once per review_uuid)<br>crew_members_v2 rank updated<br>New wage scale look-up triggered in Crew Accounts if rank change affects pay element | | | | | |

---

## E. APPRAISALS

**Normal** = stage-gate progression (no rejection path in current code)
**Level 1** = Vessel HOD / Master (Stage 1–2) | **Level 2** = Crewing Manager (Stage 3 Office Review)
⚠️ GAP G5: No seafarer acknowledgement step between Stage 2 and Stage 3

| Item | Process | Type | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 | Step 6 | Step 7 |
|---|---|---|---|---|---|---|---|---|---|
| 35 | Appraisal — Stage 1 Submission (Seafarer Info & Start Info → Preliminary) | Normal | **[Vessel HOD / Master]**<br><br>Create appraisal record for seafarer<br>Complete Stage 1: seafarer info, appraisal period, vessel, appraisal start information<br>Submit Stage 1<br><br>Status (of Appraisal): draft → **preliminary**<br>stage1_status: → **completed**<br>form_version_uuid pinned at creation<br>isLockForm: false<br>Audit: created_by_uuid, updated_by_uuid, updated_at stamped | **[System]**<br><br>Guard: submission accepted from any status below "submitted"<br>Record visible to Office users in preliminary state | | | | | |
| 36 | Appraisal — Stage 2 Submission (Performance Assessment → Submitted) | Normal | **[Vessel HOD / Master]**<br><br>Requires: stage1_status = completed<br>Complete all competence assessments (Part B sections)<br>Complete recommendations sections<br>Submit Stage 2<br><br>Status (of Appraisal): preliminary → **submitted**<br>stage2_status: → **completed**<br>isLockForm: → **true** (performance assessment sections locked)<br>Audit: updated_by_uuid, updated_at stamped | **[System]**<br><br>Guard enforced: stage2 blocked if stage1_status ≠ completed<br>isLockForm snapshot taken; performance fields read-only hereafter<br>Appraisal now actionable by Office | | | | | |
| 37 | Appraisal — Stage 3 Submission (Office Review & Follow-up → Reviewed) ⚠️ GAP G5: no seafarer acknowledgement step | Normal | **[Crewing Manager / Crewing Executive]**<br><br>Requires: stage2_status = completed<br>Requires: all B1 training row evaluations are non-empty<br>Complete office review and follow-up sections<br>Update training follow-up statuses as applicable<br>Submit Stage 3<br><br>Status (of Appraisal): submitted → **reviewed**<br>stage3_status: → **completed**<br>isLockForm: → **true** (entire form locked)<br>Audit: updated_by_uuid, updated_at stamped | **[System]**<br><br>Guard enforced: stage3 blocked if stage2_status ≠ completed or any training evaluation empty<br>Promotion recommendations count updated (visible to Promotions module)<br>Training follow-up items visible for status updates | | | | | |
| 38 | Appraisal — Training Follow-up Status Update (within Stage 3 Office Review) | Normal | **[Crewing Manager / Crewing Executive]**<br><br>For each identified training item in the appraisal<br>Update training follow-up status: Proposed → Approved → Planned → Completed / Declined<br>Enter comments per item<br><br>Audit: updated_by_uuid, updated_at stamped | **[System]**<br><br>Training need pushed to Training & Retention module (source: "appraisal") when status set to Approved or Planned<br>Status (of Training Need in T&R module): → **Pending** or **Scheduled** | | | | | |

---

## F. TRAINING & RETENTION

**Normal** = direct status updates, no approval in current code
⚠️ GAP G4: No approval or completion-verification step

| Item | Process | Type | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 | Step 6 | Step 7 |
|---|---|---|---|---|---|---|---|---|---|
| 39 | Training Need — Identify from Recruitment (B7) | Normal | **[Crewing Executive]**<br><br>During B7 stage of recruitment screening<br>Enter training items: name, category (Mandatory / Recommended / Optional / Other), due date, identified_by<br>Submit B7<br><br>Status (of Training Need): → **Pending**<br>Source: **recruitment**<br>Audit: created_by_uuid, created_at stamped | **[System]**<br><br>Items visible in Training & Retention module under source filter = "recruitment" | | | | | |
| 40 | Training Need — Identify from Appraisal (Stage 3 Office Review) | Normal | **[Crewing Manager / Crewing Executive]**<br><br>During appraisal Stage 3<br>Set training follow-up status to Approved or Planned<br><br>Status (of Training Need): → **Pending**<br>Source: **appraisal**<br>Audit: updated_by_uuid, updated_at stamped | **[System]**<br><br>Items visible in Training & Retention module under source filter = "appraisal" | | | | | |
| 41 | Training Need — Identify from Promotion Review | Normal | **[Crewing Manager / Crewing Executive]**<br><br>During promotion review, identify training prerequisite for the target rank<br>Training item created<br><br>Status (of Training Need): → **Pending**<br>Source: **promotion**<br>Audit: created_by_uuid stamped | **[System]**<br><br>Items visible in Training & Retention module under source filter = "promotion" | | | | | |
| 42 | Training Need — Progress / Complete / Cancel ⚠️ GAP G4: no approval or verification step | Normal | **[Crewing Executive / Crewing Manager]**<br><br>Update training item status as training progresses<br>Pending → **Scheduled** (training booked)<br>Scheduled → **In Progress** (underway)<br>In Progress → **Completed** (certificate received) or **Cancelled**<br>Enter comments; overlay stored in training_needs_source_overlay_v2<br><br>Audit: updated_by_uuid, updated_at stamped | | | | | | |

---

## G. DRUGS & ALCOHOL

**Normal** = record, submit, lock | **Critical** = positive result escalation
⚠️ GAP G3: Escalation path for positive results not implemented in code

| Item | Process | Type | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 | Step 6 | Step 7 |
|---|---|---|---|---|---|---|---|---|---|
| 43 | D&A Test Record — Create | Normal | **[Master / Vessel HOD]**<br><br>Create test record for vessel and date<br>Select test type: annual / periodic / monthly / post-incident / others<br>Select alcoholDrugType: Alcohol / Drug (or both)<br>System enforces duplicate check: same vessel + same date → 409 Conflict<br><br>Status (of Record): → **draft**<br>Audit: created_by_uuid, created_at stamped | | | | | | |
| 44 | D&A Test Record — Enter Personnel Tested | Normal | **[Master / Vessel HOD]**<br><br>Add all personnel tested for this record<br>Record individual alcohol result: Positive / Negative<br>Record individual drug result: Positive / Negative<br>Set violation flags: alcoholViolation = true / drugViolation = true where positive<br>Mark equipment_not_applicable if testing equipment not used<br><br>Status (of Record): draft (no change)<br>Audit: updated_by_uuid, updated_at stamped | | | | | | |
| 45 | D&A Test Record — Digital Signature / Confirmation | Normal | **[Master]**<br><br>Review all personnel entries<br>Apply digital confirmation via da_signatures_v2 (confirmed: true)<br><br>Audit: updated_by_uuid, updated_at stamped | | | | | | |
| 46 | D&A Test Record — Submit | Normal | **[Master / Vessel HOD]**<br><br>Review all entries and signature<br>Attach supporting documents (da_attachments_v2)<br>Submit record<br><br>Status (of Record): draft → **submitted**<br>Audit: updated_by_uuid, updated_at stamped<br><br>⚠️ GAP G2: Notification sent to [Crewing Manager] — not implemented | | | | | | |
| 47 | D&A Test Record — Lock | Normal | **[Crewing Manager / Crewing Executive]**<br><br>Requires: status = submitted AND permission DA Lock/Unlock (canedit)<br>Lock the record to prevent further edits<br><br>isLocked: → **true**<br>lockedOnce: → **true**<br>Audit: updated_by_uuid, updated_at stamped | | | | | | |
| 48 | D&A — Positive Result Escalation ⚠️ GAP G3: no escalation workflow exists in current code | Critical | **[System]**<br><br>alcoholViolation = true or drugViolation = true set on da_personnel_tested_v2<br><br>Violation flag counted in D&A dashboard violation count endpoint<br><br>**GAP G3: No automated notification, case creation, or escalation is triggered** | **[Crewing Manager]**<br><br>Manually identify violation in D&A records / dashboard<br>Initiate HR / disciplinary process<br><br>**GAP G3: No in-system escalation, case management, or formal notification workflow exists** | | | | | |

---

## H. REST HOURS

**Normal** = monthly review cycle
**Level 1** = Master (vessel) | **Level 2** = Crewing Manager / Marine Superintendent (office)

| Item | Process | Type | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 | Step 6 | Step 7 |
|---|---|---|---|---|---|---|---|---|---|
| 49 | Rest Hours — Vessel Monthly Review Submission | Normal | **[Master / Vessel HOD]**<br><br>Review rest hours records for the month<br>Identify and acknowledge non-conformities<br>Submit vessel monthly review<br><br>Status (of vesselReviewStatus): Due → **Submitted**<br>vesselReviewSubmittedDate stamped<br>Audit: updated_by_uuid, updated_at stamped | **[System]**<br><br>If not submitted by 7th of following month: vesselReviewStatus → **Overdue** (calculated dynamically in reviewStatusUtils.ts)<br>Office review clock starts: officeReviewStatus triggered as **Due** | | | | | |
| 50 | Rest Hours — Office Monthly Review Submission | Normal | **[Crewing Manager / Marine Superintendent]**<br><br>Review vessel-submitted rest hours data<br>Review non-conformities and planned remediation<br>Submit office review<br><br>Status (of officeReviewStatus): Due → **Submitted** → **Completed**<br>Audit: updated_by_uuid, updated_at stamped | **[System]**<br><br>If not submitted by 10th of following month: officeReviewStatus → **Overdue** (calculated dynamically) | | | | | |
| 51 | Rest Hours — Lock Monthly Record | Normal | **[Crewing Manager]**<br><br>Requires permission: RH Lock/Unlock (canedit)<br>Lock the vessel monthly rest hours record<br><br>isLocked: → **true**<br>Audit: updated_by_uuid, updated_at stamped | | | | | | |
| 52 | Rest Hours — NC Report Open (Non-Conformity Identified) | Normal | **[Master / Vessel HOD]**<br><br>Identify MLC / STCW non-conformity in rest hours data<br>Create NC Report: enter violation details, affected crew, circumstances<br>Set preventiveActionStatus: → **Pending**<br><br>Status (of NC Report): → **Open**<br>submissionStatus: → **draft**<br>Audit: created_by_uuid, created_at stamped | **[Master]**<br><br>Submit NC Report from vessel<br>Enter proposed preventive action<br><br>submissionStatus: draft → **vessel-submitted**<br>Audit: updated_by_uuid, updated_at stamped<br><br>⚠️ GAP G2: Notification sent to [Crewing Manager / Marine Superintendent] — not implemented | | | | | |
| 53 | Rest Hours — NC Report Close | Normal | **[Crewing Manager / Marine Superintendent]**<br><br>Review vessel-submitted NC report<br>Verify preventive action was completed<br>Set preventiveActionStatus: → **Completed**<br>Enter officeClosureVerifiedByName and officeClosureDate<br>Submit office closure<br><br>submissionStatus: vessel-submitted → **office-submitted**<br>Status (of NC Report): Open → **Closed**<br>Audit: updated_by_uuid, updated_at stamped | | | | | | |

---

## I. CREW ACCOUNTS

**Critical** = Portage Bills & Final Settlement (financial, two-level)
**Level 1** = Accounts Officer / Crewing Manager | **Level 2** = Finance Manager

| Item | Process | Type | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 | Step 6 | Step 7 |
|---|---|---|---|---|---|---|---|---|---|
| 54 | Portage Bill — Prepare (Office-Prepares Mode) | Critical | **[Accounts Officer / Crewing Executive]**<br><br>Open portage workspace for vessel + period (YYYY-MM)<br>Trigger wage calculation run via wage engine<br>Review calculation run status: → **completed**<br>Review crew totals and pay element breakdown<br><br>Status (of Portage Bill): → **open**<br>Audit: created_by_uuid, created_at stamped | | | | | | |
| 55 | Portage Bill — Prepare (Vessel-Prepares Mode) | Critical | **[Master / Vessel HOD]**<br><br>Enter portage data on board<br>Record attendance, overtime, bonuses, deductions per crew member<br><br>Status (of Portage Bill): → **vessel_draft**<br>Audit: created_by_uuid, created_at stamped | **[Accounts Officer]**<br><br>Receive vessel draft on office side<br>Review and reconcile with crew master data<br>Prepare for submission | | | | | |
| 56 | Portage Bill — Submit for Approval | Critical | **[Accounts Officer / Crewing Manager]**<br><br>Review completed portage bill and crew totals<br>Select approver(s) from user list (minimum 1 required)<br>Submit for approval<br><br>Status (of Portage Bill): open / vessel_draft / returned → **office_review**<br>Approval rows created in acc_portage_approvals_v2: status → **Pending**<br>submittedByUuid + submittedDate stamped<br>Previous approval rows soft-deleted before new ones created<br>Audit: updated_by_uuid, updated_at stamped<br><br>⚠️ GAP G2: Notification sent to approver(s) — not implemented | | | | | | |
| 57 | Portage Bill — Approve (all approvers approve → auto-lock or approved) | Critical | **[Crewing Manager / Finance Manager]**<br><br>Review portage bill, crew totals, pay element detail<br>Record decision: **Approved**<br>Enter comments (optional)<br><br>Status (of Approval row): Pending → **Approved**<br>Date stamped on approval row<br>Audit: updated_by_uuid, updated_at stamped | **[System]**<br><br>Check: all live approval rows = Approved?<br>If YES and autoLockOnApproval = **true**:<br>Status (of Portage Bill): → **locked**<br>isLocked: true; lockedByUuid + lockedDate stamped<br>Linked CTM also locked (ctmService.lockForPortage)<br>If YES and autoLockOnApproval = **false**:<br>Status (of Portage Bill): office_review → **approved**<br>(Manual lock required — see Item 59) | | | | | |
| 58 | Portage Bill — Reject / Return for Revision | Critical | **[Crewing Manager / Finance Manager]**<br><br>Review portage bill<br>Record decision: **Rejected**<br>Enter mandatory rejection comments<br><br>Status (of Approval row): Pending → **Rejected**<br>Status (of Portage Bill): office_review → **returned**<br>Audit: updated_by_uuid, updated_at stamped<br><br>⚠️ GAP G2: Notification sent to [Accounts Officer] — not implemented | **[Accounts Officer]**<br><br>Review rejection comments<br>Correct payroll data / recalculate<br>Re-submit (portage in "returned" is re-submittable)<br><br>Status (of Portage Bill): returned → **office_review** (on re-submit)<br>Previous approval rows soft-deleted; new Pending rows created | | | | | |
| 59 | Portage Bill — Manual Lock (when autoLockOnApproval = false) | Normal | **[Accounts Officer / Finance Manager]**<br><br>Requires: status = **approved** (autoLockOnApproval = false scenario)<br>Manually lock the portage bill<br><br>Status (of Portage Bill): approved → **locked**<br>isLocked: true; lockedByUuid + lockedDate stamped<br>Linked CTM locked<br>Audit: updated_by_uuid, updated_at stamped | | | | | | |
| 60 | Cash Advance — Request, Approve & Disburse | Normal | **[Accounts Officer / Master]**<br><br>Create cash advance request for crew member<br>Enter amount, currency, reason<br><br>Status (of Advance): → **pending**<br>Audit: created_by_uuid, created_at stamped | **[Crewing Manager / Finance Manager]**<br><br>Review advance request against crew entitlement<br>Approve or Reject<br><br>Status (of Advance): pending → **approved** or **rejected**<br>Audit: updated_by_uuid, updated_at stamped | **[Accounts Officer]**<br><br>Disburse approved advance<br><br>Status (of Advance): approved → **disbursed**<br>Audit: updated_by_uuid stamped | **[System]**<br><br>Recovery entries scheduled in monthly transactions<br>Status (of Advance): → **recovered** when fully recovered in payroll | | | |
| 61 | Allotment — Setup / Modify / Suspend / End ⚠️ GAP G10: no formal approval step in code | Normal | **[Accounts Officer]**<br><br>Create or update allotment for crew member<br>Enter: beneficiary name, amount, frequency, bank details<br>Validated against maxAllotmentPercent tenant config on creation<br><br>Status (of Allotment): → **active**<br>Audit: created_by_uuid / updated_by_uuid stamped | **[Crewing Manager]**<br><br>Review and confirm allotment change<br>**[ASSUMPTION A6: no formal approval step in code; this step is recommended, not currently implemented]**<br>Suspend: Status → **suspended**<br>End: Status → **ended**<br>Audit: updated_by_uuid stamped | | | | | |
| 62 | Engagement — Final Settlement (Sign-Off) | Critical | **[Accounts Officer]**<br><br>Crew member signed off vessel<br>Calculate final settlement: balance wages, leave pay, repatriation allowance, deductions<br>Trigger settlement calculation run<br>Prepare settlement statement<br><br>Status (of Engagement): active → **completed**<br>Calculation run recorded in acc_calculation_runs_v2<br>Audit: updated_by_uuid, updated_at stamped | **[Crewing Manager]**<br><br>Review final settlement statement<br>Verify against engagement history<br>Submit for final approval | **[Finance Manager]**<br><br>Final approval of settlement amounts<br><br>Status (of Engagement): completed → **settled**<br>**[ASSUMPTION A7: no explicit settlement approval controller found; pattern inferred from engagement status sequence and portage bill flow]**<br>Audit: updated_by_uuid, updated_at stamped | **[System]**<br><br>Settlement amounts locked<br>Portage bill for final month updated to reflect sign-off<br>Allotments ended<br>Cash advance recovery balanced | | | |

---

## Gaps & Recommendations

### G1 — No Approval Step on Crew Terminations *(High Priority)*

Termination is a **direct write** — any user with `canedit` on the Crew Pool menu can terminate a crew member. For a compliance-heavy maritime domain, **company-initiated terminations** (especially `UT` and `BT` categories) should require at minimum a Level 1 manager approval before `status: Terminated` is committed. Recommend adding a `pending_termination` intermediate status and an approval record in a new `crew_termination_approvals` table.

### G2 — No Workflow-Triggered Notifications *(High Priority)*

The alerts engine exists (visa/document expiry, relief-due) but **zero workflow state transitions** currently dispatch notifications. Every `⚠️ GAP G2` annotation in the register above represents a missing notification. Impacted transitions include: recruitment approval/rejection, rotation deploy/reject, promotion approval/rejection, portage bill submission/rejection, D&A submission, NC Report submission. Recommend extending the alerts engine or adding a lightweight notification hook to the service layer.

### G3 — No Escalation Workflow for D&A Positive Results *(Critical — Compliance)*

`alcoholViolation` and `drugViolation` flags are set in `da_personnel_tested_v2` and counted for dashboard display, but **nothing is triggered automatically**. A positive D&A test on a SOLAS vessel is a safety-critical event (STCW requirement). Recommend: on `drugViolation=true` or `alcoholViolation=true`, auto-create an escalation case record, notify the Crewing Manager and Fleet Personnel Manager, and prevent sign-on of the affected crew member until the case is closed.

### G4 — No Approval Step in Training & Retention *(Medium Priority)*

Training status transitions (Pending → Scheduled → Completed) are direct writes. For mandatory training, **completion should require a verification step** (e.g., certificate upload + manager sign-off) before the training is counted as compliant. Recommend adding a `verified` status and a `verified_by_uuid` field.

### G5 — No Seafarer Acknowledgement in Appraisals *(Medium Priority — MLC context)*

The appraisal workflow moves from Stage 2 (vessel submission by HOD/Master) directly to Stage 3 (office review) with no step for the seafarer to acknowledge or sign the assessment. MLC 2006 Standard A1.1 implies the seafarer should be aware of their appraisal. Recommend adding a `stage2_5_seafarer_acknowledged` status between Stage 2 and Stage 3 office review.

### G6 — No Centralized Audit Log Table

All tables carry `created_by_uuid` / `updated_by_uuid` but there is no queryable log of "who changed field X from value A to value B at time T". `docs/RECOMMENDATIONS.md` already notes this. For financial and compliance workflows (Crew Accounts, Terminations, D&A) a field-level change log is important for regulatory audit purposes.

### G7 — `Partially Approved` Rotation Plan Status Has No Automatic Completion Trigger

When individual rotation entries are deployed one by one, the plan moves to `Partially Approved`. There is **no server-side logic to automatically transition** the plan to `Completed` when the last entry is deployed. The `Completed` status appears to require a manual action (or is never reached via normal flow). Recommend adding a post-deploy check: if all entries in the plan are `Deployed` or `Rejected`, auto-transition the plan to `Completed`.

### G8 — `submitted` Portage Bill Status Is Potentially Vestigial

`SUBMITTABLE = ['open', 'vessel_draft', 'submitted', 'returned']` — a portage in `submitted` status can be re-submitted. However, the active "awaiting approval" state is `office_review`, not `submitted`. The `portageService.submit()` function transitions directly to `office_review`; it is unclear how a portage bill reaches `submitted` status through the current code. **See Question Q2.**

### G9 — Monthly Transaction `accepted` / `rejected` Statuses — Approval Path Unclear

`acc_monthly_transactions_v2` has statuses `draft`, `submitted`, `accepted`, `rejected` but no controller or service logic was found implementing the `accepted`/`rejected` transitions. These may be planned but not yet implemented. **See Question Q3.**

### G10 — Allotment Changes Have No Formal Approval

Allotment amounts can be changed as a direct write. Given allotments are direct financial commitments (bank wire instructions), a manager sign-off step is recommended, particularly for new allotments and amount increases above a threshold.

### G11 — Promotion Has No Explicit `rejected` Terminal Status on the Review Record

When an approver sets `promotionConfirmed: rejected`, the rejection is recorded on the `promo_approvals_v2` row but `promotion_reviews_v2.status` remains `for approval`. There is no terminal `rejected` status on the review itself. This means a "rejected" promotion review is indistinguishable from one still awaiting a decision by looking at the review record alone. **See Question Q10.**

---

## Questions & Assumptions

### Questions (require your input before Phase 2)

| # | Sub-module | Question |
|---|---|---|
| Q1 | Recruitment | The code supports selecting multiple approvers at B8, but there is no enforced ordering (Level 1 must approve before Level 2 sees it). Is the intent **parallel approval** (all approvers receive the record simultaneously) or **sequential** (Level 1 first, then Level 2)? |
| Q2 | Crew Accounts | The `portageService.submit()` function transitions status to `office_review` immediately. When would a portage bill be in `submitted` status rather than `office_review`? Is this a legacy value from an older flow, or used in a path not yet visible in the code? |
| Q3 | Crew Accounts | Who approves or rejects a monthly transaction, and what is the trigger? Is this the vessel-side DPB (Daily Portage Bill) workflow vs. the office portage bill, or something else? |
| Q4 | Rest Hours | Is `officeReviewStatus: Completed` reached automatically when `officeReviewStatus` is set to `Submitted`, or is there a separate completion-confirmation action? The `reviewStatusUtils.ts` calculates this dynamically — please confirm the exact trigger. |
| Q5 | Drugs & Alcohol | Should a positive D&A test result trigger any in-system action (notification, case creation, crew sign-on block)? Or is the process handled entirely outside the system? |
| Q6 | Appraisals | Is there an intent (or regulatory requirement) for the seafarer to acknowledge their appraisal within the system, or is this handled via paper/external process? |
| Q7 | Crew Pool | Should company-initiated terminations (especially `UT` and `BT`) require a Crewing Manager or Fleet Personnel Manager sign-off before taking effect? |
| Q8 | Training & Retention | Should completion of a Mandatory training item require document upload and manager verification before the item is marked `Completed`? |
| Q9 | Crew Accounts | Should allotment creation or changes above a defined amount (or above `maxAllotmentPercent`) require Finance Manager approval? |
| Q10 | Promotions | Should a rejected promotion review show a distinct terminal status (e.g., `rejected`) on the review record itself, separate from the `promo_approvals_v2` row? This affects reporting and re-opening. |

### Assumptions (mark any that need correcting)

| # | Item | Assumption & Reasoning |
|---|---|---|
| A1 | Recruitment — two-level approval | Two-level approval is achieved by selecting two approvers at B8. No ordering is enforced in code. Treated as L1 = Crewing Manager, L2 = Fleet Personnel Manager for register purposes. |
| A2 | Rotation — Critical flag for top-4 ranks | The "Critical" designation for Top-4 officer rotation entries (Master, C/O, C/E, 2/E) is **not implemented in code**. Included in the register as a recommended pattern; all current deploy/reject actions are treated identically regardless of rank. |
| A3 | Promotions — Critical type | "Critical" designation for senior rank or cross-fleet promotions is **not implemented in code**. Register row 31 is marked Normal accordingly; the Critical variant is noted as recommended. |
| A4 | D&A — escalation | No escalation workflow exists for positive D&A results. Item 48 is shown as a "Critical / GAP" row to flag this as a missing compliance control. |
| A5 | Training — verification | No formal approval or verification step exists for training completion. Item 42 Step 2 is shown as a recommended step, not a currently implemented one. |
| A6 | Allotment — approval | No formal approval step exists for allotment changes. Item 61 Step 2 is shown as a recommended step, not currently implemented. |
| A7 | Final settlement — approval path | No explicit settlement approval controller was found. The pattern (Accounts Officer prepares → Crewing Manager reviews → Finance Manager approves) is inferred from the portage bill approval pattern and the engagement status sequence (`completed` → `settled`). |

---

*This document was produced by Phase 1 codebase analysis only. No code, schema, or database changes were made. Phase 2 implementation is pending review and approval of the register above, with particular attention to the 10 Questions and 7 Assumptions listed above.*
