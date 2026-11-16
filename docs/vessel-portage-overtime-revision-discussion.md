# Task 605 — Vessel Portage overtime revision discussion

Saved on 2026-11-04 at the user's request. This is a discussion record, not an approved implementation plan.

## Status and authority

- Await consolidated answers from the user's senior and domain experts.
- The user explicitly requested a fresh questionnaire, ignoring ALL earlier answers. Treat every business choice below as undecided.
- Recommendations are not approvals.
- Saving this discussion authorizes documentation only. Do not implement, change application behavior, data, configuration, or revision dates.
- The discussion initially referred to Task 582; the user subsequently identified this issue as Task 605. Use the latest designation. Retrieval of the stored Task 605 record failed, so the review used the supplied description, available conversation, and inspected code rather than claiming to have retrieved its complete task history.

## Original issue and expected behavior

Issue: The Vessel Portage Overtime tab reads only the engagement's original Wage Scale revision instead of resolving the applicable superseded revision based on the effective date. Valid GOT and OT Rate values added in a later revision therefore display as “–”.

Expected: Resolve and use the applicable Wage Scale revision based on the relevant effective date so valid GOT and OT Rate values display correctly.

## Discussion chronology — historical answers, NOT current decisions

The user originally answered four questions:

1. For a revision effective on the 15th, old OT rates should apply only through the 14th and new rates from the 15th. This is a date boundary, not a time-of-day boundary.
2. GOT should follow the same date-change rule. This did not establish a new prorated GOT entitlement formula.
3. No silent recalculation of saved overtime; preserve locked records and existing approval controls; corrections require an explicitly approved process.
4. Include separate overtime entries for mid-month revision changes.

The assistant summarized those requirements without proposing implementation.

The user then required deep analysis before any final fix:

- Identify exactly which existing behaviors intentionally change and preserve everything else.
- No unrelated refactoring, cleanup, code, or business-rule changes.
- Understand current behavior, design the smallest safe fix, analyze regressions caused by that exact fix, address safe in-scope regressions, and repeat.
- Stop and ask if a fix-related regression requires meaningful scope expansion or a business tradeoff.
- Ask unresolved business questions before presenting final code.
- The final proposal must include recommended fix, exact filenames, exact proposed code changes, regression checks performed, remaining fix-related risks, and confirmation of strict scope.
- Do not implement or change anything while preparing that proposal.

Read-only investigation found two blockers:

1. Payroll for Rate × Quantity monthly entries resolves a wage-scale/override rate using the final applicable segment, preferring that over the saved transaction rate. Separate screen entries alone could therefore display the right period rates while payroll applies the wrong rate to earlier-period hours.
2. Existing overtime entries store monthly hours without a period allocation. Their hours cannot safely be assigned across a newly introduced boundary automatically.

The assistant asked whether to include limited payroll support and whether to block new split entries until existing unsplit entries were explicitly resolved. The question form was cancelled; no answers were received.

The user then suggested another direction:

- Keep one rate for the whole month.
- Replace arbitrary revision effective-date selection with future-month selection.
- Start revisions on the chosen month's first day, avoiding mid-month splits.
- Asked how correct/safe that would be, not for implementation.

The assistant assessed this as simpler if it is the company's actual policy, with qualifications:

- It does not fix the original missing revision lookup by itself.
- Future month means next month or later, unlike next month only.
- Restrictions must cover saving, editing, and activation, not just a picker.
- Existing mid-month/backdated revisions must not be silently moved.
- Future months may already contain saved overtime, so future-only dates alone do not protect saved values.
- Genuine contractual mid-month or retrospective increases would need a separately agreed process.
- A revision-specific restriction avoids revision-related partial-month GOT calculations, not necessarily all other proration causes.

Finally, the user requested ALL questions from scratch, with simple explanations, clear options, recommendations and reasons, to discuss with senior/domain experts. All preceding answers and proposed policies were explicitly reset to undecided.

## Current-code observations from the read-only review

These are observations as of this discussion, not durable assumptions. Recheck current source before designing the final fix.

- `client/src/modules/accounts/pages/VesselPortagePage.tsx` fetches details for the engagement's attached scale and reads rank lines using the engagement's starting rank.
- Its GOT hours display derives implied guaranteed hours from fixed GOT amount divided by OT hourly rate, rounded to one decimal.
- The tab accepts excess hours, calculates amount as hours × rate, and saves qty/rate/amount.
- The current overtime entry does not save a revision period allocation.
- `client/src/modules/accounts/pages/VesselPortageGrids.tsx` identifies rows by crew and calls edits with crew ID and column ID; naive duplicate crew rows for segments could conflict.
- `shared/v2/accounts/schema.ts` monthly transactions contain qty, rate, amount, and an optional transaction date, but no explicit overtime revision-period allocation.
- `server/v2/accounts/engine/wageEngineService.ts` follows superseding scale links by effective date and qualifying status. Monthly Rate × Quantity processing uses the final segment's resolved scale/override rate before falling back to a saved transaction rate.
- `server/v2/accounts/services/monthlyTransactionsService.ts` contains existing lock, vessel window, draft, and approval-related controls that must not be bypassed.
- Revision creation, editing, and activation have distinct behavior; do not assume a date-picker change covers all paths.

Only source tracing was performed for this proposed work. There is no implemented fix, executed regression suite for a fix, finalized exact file list, or approved exact patch.

## Complete fresh questionnaire

All 18 questions remain unanswered. Recommendations below reproduce the discussion's recommendations; none is authorization.

### A. Scope

### 1. Fix only the Overtime tab, or also restrict revision start dates?

- A: Fix the tab only; retain existing revision-date rules.
- B: Fix the tab and restrict new revisions to the first day of a future month.
- C: Fix the tab and support any effective date, including separate overtime entries.

Recommendation: A as the original default scope unless experts confirm B as company policy. B simplifies future entry but prohibits legitimate mid-month revisions; C supports them but is larger.

### B. Applicable values

### 2. Should later revisions automatically apply to existing engagements?

Example: a crew member signed on with Revision 1 and Revision 2 starts while they remain onboard.

- A: Automatically apply Revision 2 from its effective date.
- B: Retain Revision 1 until the engagement is explicitly changed.
- C: Apply Revision 2 only to selected engagements/contracts.

Recommendation: A, matching the expected behavior. Experts must identify any contract exceptions.

### 3. Which date determines the overtime rate?

- A: Dates the overtime was worked.
- B: First day of the selected payroll month.
- C: Last day of the selected payroll month.

Recommendation: A for date-effective rates. With first-of-month-only revisions, this normally means one rate per month. With mid-month revisions, B uses the old rate for the whole month and C the new rate for the whole month.

### 4. Should approved personal pay arrangements override the wage scale?

Example: scale rate 10/hour, approved personal rate 12/hour.

- A: Follow existing payroll priority, including approved personal arrangements.
- B: Always use the wage-scale revision in this tab.
- C: Another specified priority.

Recommendation: A to avoid disagreement between the tab and payroll. If C, specify the priority order.

### 5. What if the crew member changes rank during the month?

- A: Use the rank applicable when overtime was worked.
- B: Use the engagement's starting rank for the whole month.
- C: Use the final rank for the whole month.

Recommendation: A for business accuracy, but rank-based splitting could expand scope. Experts must explicitly confirm whether this task includes it or preserves existing rank behavior for separate work.

### 6. What if the applicable revision has no usable OT Rate or GOT?

- A: Clearly warn; block new overtime amounts when OT Rate is unavailable.
- B: Fall back to an earlier revision containing the value.
- C: Allow an authorized manual replacement.

Recommendation: A; older values may no longer be valid. Separately confirm whether missing GOT must block excess-hours entry when OT Rate itself is valid.

### C. Revision date policy

### 7. Which revision start dates are allowed?

- A: Any valid date.
- B: First day of any month, including current/past months.
- C: First day of a future month only.

Recommendation: C only if company policy does not require mid-month or retrospective revisions; otherwise A with explicit splitting/correction handling. Do not assume this policy.

### 8. If future-month-only, how far ahead may users schedule?

Conditional on 7=C.

- A: Next month only.
- B: Next month or any later month.
- C: A specified company limit.

Recommendation: B for advance planning without backdating.

### 9. What if activation occurs after the intended start date?

Example: a revision planned for 1 December is still a draft on 3 December.

- A: Refuse activation until its start date is moved to an allowed future month.
- B: Allow late activation through an authorized exception process.
- C: Allow late activation normally.

Recommendation: A under strict future-only policy. Choose B only with a defined exception approver/process. Restricting draft creation alone does not prevent late activation.

### 10. What happens to existing mid-month or backdated revisions?

- A: Preserve them and support their actual effective dates.
- B: Preserve them, but flag affected overtime months for explicit review before new entry.
- C: Correct their dates through a separately approved process.

Recommendation: B for narrowly scoped monthly-only work; A if full split support is included. Never silently move existing dates or change historical calculations.

### D. Entry and display

### 11. How should users enter hours when multiple rates apply within one month?

- A: Separate hours per date period.
- B: One monthly total using the approved single-rate rule from Question 3.
- C: Prevent entry and require explicit review.

Recommendation: A if mid-month changes remain allowed. C can handle exceptional historical cases in a smaller future-month-only solution.

### 12. What should “Guaranteed hrs” mean?

Existing display: fixed monthly GOT amount ÷ OT hourly rate.

- A: Preserve this formula; show each revision's full-month reference hours.
- B: Show entitlement adjusted for the covered dates/service days.
- C: Show GOT money amount instead of or alongside hours.

Recommendation: A for smallest non-regressive scope, clearly labelled if several periods appear.

If B, experts must supply the calculation basis: actual calendar days, fixed 30 days, or another company rule. No new entitlement formula is agreed.

### 13. What do entered overtime hours represent?

- A: Excess hours only; guaranteed overtime is already excluded by the user.
- B: Total hours; the system subtracts guaranteed hours.
- C: Another specified meaning.

Recommendation: A, preserving current “Excess hrs” behavior. B changes the calculation, not only revision selection.

### E. Saved entries and payroll

### 14. What happens when a revision affects already-saved overtime?

Includes saved future-month entries.

- A: Preserve saved hours/rates/amounts; warn and require explicit correction if needed.
- B: Recalculate drafts automatically; preserve later approval stages.
- C: Block revision activation until conflicting saved entries are resolved.

Recommendation: A to avoid silent financial changes.

### 15. Which rate applies when editing hours on an existing entry?

- A: Retain its saved rate unless a separate correction is explicitly approved.
- B: Automatically use the newly applicable rate on an hours edit.
- C: Require rate discrepancies to be resolved before any edit is saved.

Recommendation: A; editing hours should not unexpectedly change rates. If C, define the permitted correction process.

### 16. How should an old monthly entry be handled when a month now needs splitting?

Example: 40 hours saved for a whole month, subsequently divided into two rate periods.

- A: Preserve the original entry and block new split entries until it is explicitly resolved.
- B: Allow an authorized user to allocate the old hours across periods.
- C: Preserve the original entry and permit additional split entries immediately.

Recommendation: A for minimal scope; B if a controlled allocation process is included. C risks double-counting without further controls.

### 17. Should payroll preserve the saved overtime rate or resolve it again?

- A: Use the saved, approved rate for entries covered by this fix.
- B: Re-resolve the applicable wage-scale rate whenever calculating payroll.
- C: Stop payroll for affected entries when rates disagree, pending review.

Recommendation: A if “no silent recalculation” is the agreed rule. This may require a narrowly scoped payroll change; display-only work cannot guarantee it under current behavior.

Also specify whether a changed rule applies to new entries only or existing unfinalized overtime. Do not automatically change historical finalized payroll.

### 18. Which approved correction process should be used?

- A: Existing edit/return/approval process; locked records remain untouched.
- B: Add an authorized review-and-recalculate action for unlocked entries.
- C: Correct through later-period adjustments, not changes to the original entry.

Recommendation: A for this task, and C where existing policy requires post-finalization adjustments. If the existing process cannot support the chosen rules, discuss that gap rather than silently adding permissions or reopening locked records.

## Continuation instructions

1. Obtain consolidated answers numbered 1–18, including the subsidiary clarifications and any conditional “not applicable” answers.
2. Do not treat historical answers or recommendations as selected options.
3. Reconcile inconsistent answers with the user before producing a final fix.
4. Recheck current code; source observations above may become stale.
5. Identify intentional behavior changes and preserve everything else.
6. Perform the requested design/regression-analysis cycle before presenting exact files and code.
7. Stop for meaningful business tradeoffs or scope expansion.
8. Continue analysis only until implementation is explicitly authorized. This saved document is not implementation approval.
