-- Crewing Test Case Manager - PMS-style fields (follow-up to 0132/0133).
-- 1) Adds test_data, comments, how_to_test columns (idempotent).
-- 2) Backfills Test Data and a structured How to Test guide for the
--    seeded starter cases (current/working v2 functionality only).
-- Fully idempotent: ADD COLUMN IF NOT EXISTS + guarded UPDATEs.

ALTER TABLE test_cases_v2 ADD COLUMN IF NOT EXISTS test_data TEXT;
ALTER TABLE test_cases_v2 ADD COLUMN IF NOT EXISTS comments TEXT;
ALTER TABLE test_cases_v2 ADD COLUMN IF NOT EXISTS how_to_test TEXT;

UPDATE test_cases_v2 SET test_data = 'Navigate to /crew-pool; New crew: Rank=Master, Nationality=India',
  how_to_test = 'Goal:
• Verify a new crew member profile can be created and appears in the crew pool.

Steps:
1. Setup — Log in with Crew Pool create permission and open the Crew Pool module.
2. Action — Click Add Crew and complete the mandatory personal details.
3. Verify — Save and confirm the crew member appears in the list.

What to Verify:
• New profile is saved and listed
• A unique crew UUID is generated
• Mandatory field validation blocks empty required fields

Edge Cases:
• Try saving with a missing mandatory field — validation error appears
• Create a duplicate name — both records are kept and distinguishable by UUID'
WHERE tc_uuid = 'seed-cp-001' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Open an existing crew profile; edit address + next-of-kin',
  how_to_test = 'Goal:
• Verify crew personal, address and next-of-kin details can be edited and persisted.

Steps:
1. Setup — Open an existing crew profile.
2. Action — Edit personal, address and next-of-kin fields.
3. Verify — Save and re-open the profile.

What to Verify:
• Edited values persist after reload
• Updated-by/updated-at metadata changes

Edge Cases:
• Clear a previously filled optional field — empty value is saved
• Edit then cancel — original values remain'
WHERE tc_uuid = 'seed-cp-002' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Filters: Rank=Chief Officer, Nationality=Philippines, Status=Active',
  how_to_test = 'Goal:
• Verify search and filtering narrows the crew pool to matching members.

Steps:
1. Setup — Open Crew Pool with multiple members present.
2. Action — Apply rank, nationality and status filters and type a search term.
3. Verify — Review the filtered result set.

What to Verify:
• Only matching crew are shown
• Clearing filters restores the full list
• Result count updates with the filter

Edge Cases:
• Filter combination returning zero results — empty state shown
• Search special characters — no error'
WHERE tc_uuid = 'seed-cp-003' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Document: type=Passport, expiry=31-Dec-2027, attach PDF',
  how_to_test = 'Goal:
• Verify crew documents can be added with attachment and expiry tracking.

Steps:
1. Setup — Open a crew profile and go to Documents.
2. Action — Add a document (travel doc/visa/licence/course) with expiry and attachment.
3. Verify — Save and confirm the document and expiry are tracked.

What to Verify:
• Document is saved with attachment
• Expiry date is captured and shown
• Expiring/expired documents are flagged

Edge Cases:
• Add a document with a past expiry — it is flagged as expired
• Upload an unsupported file type — handled gracefully'
WHERE tc_uuid = 'seed-cp-004' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Sea service: Rank=2/O, VesselType=Tanker, 01-Jan-2024 to 30-Jun-2024',
  how_to_test = 'Goal:
• Verify sea service entries are recorded and experience totals recalculate.

Steps:
1. Setup — Open a crew profile and go to Sea Service.
2. Action — Add a sea service entry (rank, vessel type, dates).
3. Verify — Save and review rank/company/vessel-type experience totals.

What to Verify:
• Entry is saved
• Experience totals update by rank, company and vessel type
• Overlapping/duplicate periods are handled

Edge Cases:
• Enter an end date before the start date — validation error
• Add overlapping periods — totals stay consistent'
WHERE tc_uuid = 'seed-cp-005' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Briefing session date today; attach briefing form',
  how_to_test = 'Goal:
• Verify briefing and de-briefing sessions are recorded with attachments.

Steps:
1. Setup — Open a crew profile and go to Briefing/De-briefing.
2. Action — Record a briefing and a de-briefing session with attachment.
3. Verify — Save and confirm both records are listed.

What to Verify:
• Briefing and de-briefing records are saved
• Attachments open correctly

Edge Cases:
• Record a de-briefing without a prior briefing — both still save
• Remove an attachment — record remains'
WHERE tc_uuid = 'seed-cp-006' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Active crew member; termination reason=End of Contract',
  how_to_test = 'Goal:
• Verify crew employment can be terminated and the record moves to Terminated.

Steps:
1. Setup — Open an active crew member profile.
2. Action — Trigger employment termination and confirm.
3. Verify — Check the Terminated view.

What to Verify:
• Crew moves to the Terminated list
• Crew no longer appears as Active

Edge Cases:
• Cancel the termination confirmation — crew remains Active
• Terminated crew can still be opened read-only'
WHERE tc_uuid = 'seed-cp-007' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Open Vessel module; select a vessel with assigned crew',
  how_to_test = 'Goal:
• Verify the vessel manning plan shows current statuses per rank.

Steps:
1. Setup — Open the Vessel module and select a vessel.
2. Action — View the manning plan (On Board, Reliever, Planned).
3. Verify — Confirm statuses are correct per rank.

What to Verify:
• Manning statuses display per rank
• On Board / Reliever / Planned are distinguished

Edge Cases:
• Select a vessel with no crew — empty manning shown
• Switch vessels rapidly — no data mix-up'
WHERE tc_uuid = 'seed-ve-001' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Vessel with a planned reliever; sign-on date today',
  how_to_test = 'Goal:
• Verify a planned reliever can be signed on and becomes On Board.

Steps:
1. Setup — Open vessel planning with a planned reliever.
2. Action — Select the planned reliever and Sign-on Reliever.
3. Verify — Confirm the reliever is now active On Board.

What to Verify:
• Reliever transitions to On Board
• Manning plan reflects the change

Edge Cases:
• Sign on with a missing sign-on date — validation error
• Cancel sign-on — reliever stays Planned'
WHERE tc_uuid = 'seed-ve-002' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Vessel with crew certifications vs rank requirements',
  how_to_test = 'Goal:
• Verify the compliance matrix highlights certification gaps against requirements.

Steps:
1. Setup — Open a vessel with crew certifications.
2. Action — Open the compliance matrix.
3. Verify — Review mandatory certifications against rank requirements.

What to Verify:
• Compliance gaps are highlighted
• Matrix aligns to rank requirements

Edge Cases:
• Crew with all certs — no gaps highlighted
• Expired cert — shown as a gap'
WHERE tc_uuid = 'seed-ve-003' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Vessel with officers; choose Export Officer Matrix',
  how_to_test = 'Goal:
• Verify the Officer Matrix exports to Excel with experience/vetting data.

Steps:
1. Setup — Open a vessel that has officers.
2. Action — Choose Export Officer Matrix.
3. Verify — Open the downloaded file.

What to Verify:
• Excel file downloads
• Officer experience/vetting data is present

Edge Cases:
• Export with zero officers — empty/headers-only file
• Export reflects the selected vessel only'
WHERE tc_uuid = 'seed-ve-004' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Vessel with onboard crew; choose Export Crew List',
  how_to_test = 'Goal:
• Verify a standardized crew list is generated for download.

Steps:
1. Setup — Open a vessel with onboard crew.
2. Action — Choose Export Crew List.
3. Verify — Open the downloaded file.

What to Verify:
• Crew list downloads in standard format
• Onboard crew are included

Edge Cases:
• Export with no onboard crew — headers-only file
• Special characters in names render correctly'
WHERE tc_uuid = 'seed-ve-005' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Rest Hours: select crew + month; enter hour-by-hour grid',
  how_to_test = 'Goal:
• Verify daily work/rest hours can be recorded and validated against rules.

Steps:
1. Setup — Open Rest Hours and select a crew member and month.
2. Action — Enter the hour-by-hour work/rest grid for a day.
3. Verify — Save and review rule validation (STCW/MLC/OPA).

What to Verify:
• Hours save per day
• Violations flag against STCW/MLC/OPA thresholds

Edge Cases:
• Enter 24h of work — violation flagged
• Leave a day blank — handled without error'
WHERE tc_uuid = 'seed-rh-001' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Open violations dashboard; filter Rank=Master, Code=A',
  how_to_test = 'Goal:
• Verify the non-conformities dashboard summarizes and filters violations.

Steps:
1. Setup — Ensure rest-hour records with violations exist.
2. Action — Open the violations dashboard and filter by rank and code.
3. Verify — Review the summarized non-conformities.

What to Verify:
• Non-conformities (A-H) are summarized
• Filters narrow the results

Edge Cases:
• Filter yielding no violations — empty state
• Multiple codes selected — combined correctly'
WHERE tc_uuid = 'seed-rh-002' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Month of records; submit Vessel then Office review',
  how_to_test = 'Goal:
• Verify multi-stage vessel and office review sign-off progresses correctly.

Steps:
1. Setup — Record a month of rest-hour data for a vessel.
2. Action — Submit Vessel Review (Master) then Office Review (Superintendent).
3. Verify — Confirm review status transitions.

What to Verify:
• Status advances through sign-off stages
• Each stage records its reviewer

Edge Cases:
• Attempt office review before vessel review — blocked/ordered
• Re-open after sign-off — handled per workflow'
WHERE tc_uuid = 'seed-rh-003' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Add fixed task (daily 08:00); add variable event (drill)',
  how_to_test = 'Goal:
• Verify fixed recurring and variable one-off tasks can be scheduled.

Steps:
1. Setup — Open a vessel rest-hour sheet.
2. Action — Add a recurring fixed task and a one-off variable event.
3. Verify — Save and confirm tasks appear on the records.

What to Verify:
• Fixed task recurs as configured
• Variable event appears on its date

Edge Cases:
• Overlapping tasks — both recorded
• Delete a task — records update'
WHERE tc_uuid = 'seed-rh-004' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Daily record on dateline crossing; apply -1h adjustment',
  how_to_test = 'Goal:
• Verify dateline adjustment correctly handles gained/lost hours.

Steps:
1. Setup — Open a daily record where the IDL is crossed.
2. Action — Apply the hour gain/loss for the crossing.
3. Verify — Review the adjusted totals.

What to Verify:
• Hours adjust for the gain/loss
• Daily totals stay consistent

Edge Cases:
• Apply both gain and loss in one period — net effect correct
• Remove adjustment — original hours restored'
WHERE tc_uuid = 'seed-rh-005' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Open Promotions; rank hierarchy seeded',
  how_to_test = 'Goal:
• Verify the promotion review board lists eligible crew per hierarchy.

Steps:
1. Setup — Ensure eligible crew exist per the rank hierarchy.
2. Action — Open Promotions and view eligible crew.
3. Verify — Confirm eligibility follows the hierarchy.

What to Verify:
• Eligible crew are listed
• Eligibility respects defined hierarchy

Edge Cases:
• No eligible crew — empty state
• Crew at top rank — excluded from promotion'
WHERE tc_uuid = 'seed-pr-001' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Crew under review; criteria=CES tests, training, appraisals',
  how_to_test = 'Goal:
• Verify a promotion checklist records criteria against master requirements.

Steps:
1. Setup — Open a crew member under promotion review.
2. Action — Verify criteria (CES tests, training needs, appraisals).
3. Verify — Save and confirm checklist items are recorded.

What to Verify:
• Checklist items save
• Items map to criteria master requirements

Edge Cases:
• Incomplete criteria — promotion cannot complete
• All criteria met — record is ready to progress'
WHERE tc_uuid = 'seed-pr-002' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Completed checklist; move In Progress -> Approval -> Promoted',
  how_to_test = 'Goal:
• Verify a promotion progresses through approval workflow stages.

Steps:
1. Setup — Complete a promotion checklist.
2. Action — Move from In Progress to Awaiting Approval, then Approve.
3. Verify — Confirm status reaches Promoted.

What to Verify:
• Status advances through stages
• Promoted state is final

Edge Cases:
• Reject at approval — returns to prior stage
• Approve without completed checklist — blocked'
WHERE tc_uuid = 'seed-pr-003' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Crew with appraisal recommendation + training history',
  how_to_test = 'Goal:
• Verify criteria reflect linked appraisals and training completion.

Steps:
1. Setup — Ensure crew has appraisal and training history.
2. Action — Open promotion criteria verification.
3. Verify — Check appraisal recommendation and mandatory training.

What to Verify:
• Criteria show appraisal recommendation
• Mandatory training status is reflected

Edge Cases:
• Missing mandatory training — flagged
• No appraisal on file — criterion unmet'
WHERE tc_uuid = 'seed-pr-004' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Crew due for appraisal; complete Part A/B on vessel',
  how_to_test = 'Goal:
• Verify the vessel appraisal stage (Part A/B) can be completed and routed.

Steps:
1. Setup — Open Appraisals for a crew member due for appraisal.
2. Action — Complete Part A/B on the vessel and submit.
3. Verify — Confirm the stage saves and routes onward.

What to Verify:
• Vessel stage saves
• Appraisal routes to the next stage

Edge Cases:
• Submit with incomplete mandatory items — blocked
• Save draft then resume — data retained'
WHERE tc_uuid = 'seed-ap-001' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Appraisal in progress; score professional/leadership/behavior',
  how_to_test = 'Goal:
• Verify competence assessment scores are captured on the appraisal.

Steps:
1. Setup — Open an appraisal in progress.
2. Action — Score professional, leadership and behavioral items.
3. Verify — Save and confirm scores persist.

What to Verify:
• Competence scores save
• Score ranges are validated

Edge Cases:
• Out-of-range score — rejected
• Partial scoring saved as draft'
WHERE tc_uuid = 'seed-ap-002' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Appraisal in progress; flag a training need',
  how_to_test = 'Goal:
• Verify training needs flagged in appraisal feed the training matrix.

Steps:
1. Setup — Open an appraisal in progress.
2. Action — Flag a training need and save.
3. Verify — Confirm it appears in the training matrix.

What to Verify:
• Training need is recorded
• Need feeds the training matrix

Edge Cases:
• Remove the flag — matrix updates
• Duplicate need — handled gracefully'
WHERE tc_uuid = 'seed-ap-003' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Appraisal finalizing; mark Recommended for promotion',
  how_to_test = 'Goal:
• Verify a promotion recommendation flags eligibility in Promotions.

Steps:
1. Setup — Open an appraisal being finalized.
2. Action — Mark the appraisal as Recommended for promotion and save.
3. Verify — Confirm the crew member shows as eligible in Promotions.

What to Verify:
• Recommendation saves
• Crew becomes eligible in Promotions

Edge Cases:
• Un-recommend — eligibility removed
• Recommend without competence scores — per business rule'
WHERE tc_uuid = 'seed-ap-004' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Vessel + seafarer stages done; complete office Part F/G',
  how_to_test = 'Goal:
• Verify the office appraisal stage (Part F/G) finalizes the appraisal.

Steps:
1. Setup — Ensure vessel and seafarer stages are complete.
2. Action — Complete office Part F/G and finalize.
3. Verify — Confirm the appraisal is finalized.

What to Verify:
• Office stage saves
• Appraisal reaches finalized state

Edge Cases:
• Finalize with earlier stage incomplete — blocked
• Re-open finalized appraisal — per workflow'
WHERE tc_uuid = 'seed-ap-005' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Drugs & Alcohol; add test type=Annual for a vessel',
  how_to_test = 'Goal:
• Verify a drug and alcohol test record can be created for a vessel.

Steps:
1. Setup — Open the Drugs & Alcohol module.
2. Action — Add a test record (annual/monthly/periodic/post-incident).
3. Verify — Save and confirm it is listed for the vessel.

What to Verify:
• Test record saves
• Record lists under the correct vessel

Edge Cases:
• Add without a test type — validation error
• Add for a vessel with no crew — handled'
WHERE tc_uuid = 'seed-da-001' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Existing test record; edit fields then delete',
  how_to_test = 'Goal:
• Verify a test record can be edited and deleted.

Steps:
1. Setup — Open an existing test record.
2. Action — Edit fields and save, then delete the record.
3. Verify — Confirm edits persist and deletion removes it.

What to Verify:
• Edits persist
• Deletion removes the record from the list

Edge Cases:
• Cancel delete — record remains
• Edit to invalid value — validation error'
WHERE tc_uuid = 'seed-da-002' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Vessels with test records; open testing view',
  how_to_test = 'Goal:
• Verify testing schedule and status per vessel are shown.

Steps:
1. Setup — Ensure vessels with test records exist.
2. Action — Open the vessel testing view.
3. Verify — Review status and planned unannounced tests.

What to Verify:
• Testing status per vessel shown
• Planning details are visible

Edge Cases:
• Vessel with no tests — empty state
• Overdue tests highlighted'
WHERE tc_uuid = 'seed-da-003' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Test record; positive result; attach lab report PDF',
  how_to_test = 'Goal:
• Verify a violation can be logged with a lab report attached.

Steps:
1. Setup — Open a test record.
2. Action — Record a positive result/violation and attach the lab report.
3. Verify — Save and confirm the violation and attachment.

What to Verify:
• Violation logs
• Lab report attaches and opens

Edge Cases:
• Save violation without attachment — per business rule
• Replace attachment — latest is kept'
WHERE tc_uuid = 'seed-da-004' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Vessel with onboard crew; open test record',
  how_to_test = 'Goal:
• Verify onboard crew are confirmed before selecting test personnel.

Steps:
1. Setup — Open a test record for a vessel with onboard crew.
2. Action — Verify the current onboard crew list.
3. Verify — Confirm the list before selecting personnel.

What to Verify:
• Onboard crew list is accurate
• Selection draws from onboard crew

Edge Cases:
• Crew signed off mid-period — reflected
• No onboard crew — selection blocked/empty'
WHERE tc_uuid = 'seed-da-005' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Recruitment; add candidate (name, rank applied)',
  how_to_test = 'Goal:
• Verify a candidate can be added and enters the pipeline.

Steps:
1. Setup — Open Recruitment with create permission.
2. Action — Add a new candidate and save.
3. Verify — Confirm the candidate appears at the Applied stage.

What to Verify:
• Candidate saves
• Candidate starts at Applied stage

Edge Cases:
• Save without mandatory fields — validation error
• Duplicate candidate — both kept, distinguishable'
WHERE tc_uuid = 'seed-rc-001' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Candidate in pipeline; complete B1-B8 screening steps',
  how_to_test = 'Goal:
• Verify a candidate progresses through screening steps.

Steps:
1. Setup — Open a candidate in the pipeline.
2. Action — Complete screening steps (references, certificate verification, CES tests, interview).
3. Verify — Confirm steps record and the candidate advances.

What to Verify:
• Screening steps record
• Candidate advances through stages

Edge Cases:
• Skip a mandatory step — advancement blocked
• Fail a step — handled per workflow'
WHERE tc_uuid = 'seed-rc-002' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Candidate in screening; check vessel types + fleet groups',
  how_to_test = 'Goal:
• Verify suitability assessment records vessel types and fleet groups.

Steps:
1. Setup — Open a candidate in screening.
2. Action — Open suitability assessment, check vessel types and fleet groups.
3. Verify — Save and confirm suitability is recorded.

What to Verify:
• Suitability saves
• Vessel types and fleet groups recorded

Edge Cases:
• No selections — handled
• Change selections later — updates persist'
WHERE tc_uuid = 'seed-rc-003' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Candidate Ready for Hire; Transfer to Crew Pool',
  how_to_test = 'Goal:
• Verify a ready candidate transfers into the crew pool with data.

Steps:
1. Setup — Open a candidate marked Ready for Hire.
2. Action — Click Transfer to Crew Pool and confirm.
3. Verify — Confirm a crew record is created with migrated data.

What to Verify:
• Candidate becomes a crew record
• Screening data/documents migrate

Edge Cases:
• Transfer a not-ready candidate — blocked
• Re-transfer same candidate — no duplicate'
WHERE tc_uuid = 'seed-rc-004' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Rotation; create draft across vessels/ranks',
  how_to_test = 'Goal:
• Verify a rotation planning draft can be created and edited.

Steps:
1. Setup — Ensure vessels and crew exist.
2. Action — Create a new planning draft across vessels/ranks and save.
3. Verify — Confirm the draft is created and editable.

What to Verify:
• Draft saves
• Draft is editable after save

Edge Cases:
• Empty draft — saved as empty
• Delete a draft — removed'
WHERE tc_uuid = 'seed-ro-001' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Open Due Crew dashboard',
  how_to_test = 'Goal:
• Verify the due crew dashboard lists crew approaching relief dates.

Steps:
1. Setup — Ensure crew with upcoming relief dates exist.
2. Action — Open the Due Crew dashboard.
3. Verify — Review crew approaching relief-due dates.

What to Verify:
• Due crew are listed
• Sorted/highlighted by relief date

Edge Cases:
• No due crew — empty state
• Overdue relief — highlighted'
WHERE tc_uuid = 'seed-ro-002' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Rotation draft; propose crew assignments; submit',
  how_to_test = 'Goal:
• Verify crew-to-vessel assignment proposals route for approval.

Steps:
1. Setup — Open an existing rotation draft.
2. Action — Propose crew assignments and submit.
3. Verify — Confirm proposals route to superintendent approval.

What to Verify:
• Proposals submit
• Proposals route for approval

Edge Cases:
• Conflicting assignment — flagged
• Submit empty proposal — handled'
WHERE tc_uuid = 'seed-ro-003' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Approved proposal; deploy rotation entry',
  how_to_test = 'Goal:
• Verify deploying a rotation entry updates vessel planning.

Steps:
1. Setup — Ensure a proposed rotation is approved.
2. Action — Open the approved proposal and deploy the entry.
3. Verify — Confirm vessel planning reflects the deployment.

What to Verify:
• Deployment succeeds
• Vessel planning updates

Edge Cases:
• Deploy an unapproved entry — blocked
• Re-deploy — no duplicate planning entry'
WHERE tc_uuid = 'seed-ro-004' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Admin; form builder; create/edit a form version',
  how_to_test = 'Goal:
• Verify form versions can be managed in the form builder.

Steps:
1. Setup — Open Admin with Admin access.
2. Action — Create/edit an appraisal or screening form version in the builder.
3. Verify — Save and confirm the version is available for use.

What to Verify:
• Form version saves
• Version is available to consuming modules

Edge Cases:
• Publish an incomplete form — per validation
• Edit a published version — handled per versioning'
WHERE tc_uuid = 'seed-ad-001' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Admin; rank hierarchy; define 3/OFF -> 2/OFF path',
  how_to_test = 'Goal:
• Verify rank hierarchy and promotion paths can be defined.

Steps:
1. Setup — Open Admin with Admin access.
2. Action — Open rank hierarchy and define a promotion path.
3. Verify — Save and confirm the hierarchy/path.

What to Verify:
• Hierarchy saves
• Promotion path is usable in Promotions

Edge Cases:
• Circular path — rejected/handled
• Remove a rank — dependent paths handled'
WHERE tc_uuid = 'seed-ad-002' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Admin; Access Control; set menu/action perms for a role',
  how_to_test = 'Goal:
• Verify role-based access control permissions save and enforce.

Steps:
1. Setup — Open Admin with Admin access.
2. Action — Set menu and action permissions for a role and save.
3. Verify — Confirm permissions are enforced for that role.

What to Verify:
• Permissions save
• Enforcement applies on next access

Edge Cases:
• Remove all permissions for a role — access blocked
• Grant view-only — create/edit/delete hidden'
WHERE tc_uuid = 'seed-ad-003' AND how_to_test IS NULL;

UPDATE test_cases_v2 SET test_data = 'Admin; Masters; add/edit a master record',
  how_to_test = 'Goal:
• Verify global master data records can be created and updated.

Steps:
1. Setup — Open Admin with Admin access.
2. Action — Add/edit a master record (port, nationality, vessel, training).
3. Verify — Save and confirm it is available app-wide.

What to Verify:
• Master record saves
• Record is available across the app

Edge Cases:
• Duplicate master value — handled
• Edit a referenced master — dependents stay valid'
WHERE tc_uuid = 'seed-ad-004' AND how_to_test IS NULL;

