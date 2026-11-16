# Contract pay-item eligibility — discussion handoff

Saved on 2026-11-03 for Task 630. This records the available discussion context, not a verbatim transcript.

## Pause and authorization boundary

The user requested: “save all the discussin we did for task 630 till this point, we will continue this task once I get all the answers, do not chnage anything”.

No implementation is authorized. Wait for the consolidated senior/domain-expert answers. Do not ask the questions again piecemeal. Saving this document does not approve a solution, code changes, recalculation, migrations, or data changes.

Earlier instruction: “DO NOT CHANGE ANYTHING!” A future proposal must identify intentional behaviour changes, exact files/code, checks actually performed, and remaining risks. Preserve unrelated behaviour and stop for meaningful tradeoffs.

## Original request

Accounts → Contracts → Add/Edit pay item:
- Place Mode before Pay Element.
- Keep unavailable options visible but disabled, explaining why.
- Add only absent eligible elements; Replace/Suppress only existing eligible elements.
- Inactive elements always disabled.

The latest requested deliverable was one consolidated, simple questionnaire for senior/domain-expert review, not implementation or a final fix.

## Prior approvals, all subject to consolidated expert review

- Limit scope to scale/contract items, not every Wage Detail source.
- Use current setup rather than the last calculated Wage Detail.
- Check eligibility throughout the entire effective period.
- A suppressed underlying element cannot simply be added again.
- Block conflicting overlaps.
- Protect dependent replacements/suppressions from edits or deletion that would remove their underlying eligibility.
- Apply rules to Add/Edit, leave existing records untouched, and permit remarks-only edits.
- Include deterministic engine ordering; the user acknowledged that existing overlapping items could calculate differently on recalculation.

Important correction accepted by the user: absence from a wage scale does NOT automatically make an element eligible for Add. Elements owned by dedicated screens (advances, bond, allotments, manual-entry-only items) should remain visible but disabled in all modes, with their source explained. Do not indiscriminately block overtime contract rates.

Not approved: disabling Suppress specifically for rate-times-quantity elements instead of extending suppression into transactions. The user dismissed that standalone question and requested consolidated review.

## Consolidated questionnaire topics awaiting answers

The previous questionnaire contained options, recommendations, prior approvals, and a combined answer template. The following preserves its twelve decision topics from the available conversation summary; it is not a claim to reproduce its exact original wording or option letters.

1. **Scope:** scale/contract items only, or all Wage Detail sources?
2. **Dedicated-screen items:** confirm disabling them in all modes and identify any named exceptions.
3. **Existence source:** current setup or calculated Wage Detail? Recommendation: zero-valued configured elements still count as present.
4. **Effective period:** confirm interpretation of blank dates/open ends and inclusion of known future setup.
5. **Partly eligible periods:** block the whole range, or apply only to eligible months?
6. **Suppressed items:** may an underlying suppressed element be added again?
7. **Overlapping instructions:** confirm blocking conflicts while allowing an underlying Add plus one Replace or Suppress.
8. **Dependency protection:** confirm protection against breaking edits, including Delete.
9. **Legacy records:** confirm leaving existing records untouched and allowing remarks-only changes.
10. **Rate suppression:** disable Suppress for rate-times-quantity (recommendation, NOT approved), also stop associated transactions, or keep existing rate-only removal?
11. **Deterministic ordering:** apply Add before Replace/Suppress, accepting possible changes when old overlapping records are recalculated?
12. **Invalid selection after changing Mode/dates:** clear with an explanation (recommendation), or retain and block Save? Do not clear a legacy selection merely by opening Edit.

Proposed defaults, not blanket implementation authorization:
- Retain Add as the default Mode.
- Recheck eligibility on the server.
- Fail closed if eligibility cannot be established.
- No automatic financial changes or recalculation.
- Preserve existing date rules.

## Investigation already performed

Read-only review covered the shared Add/Edit form, API/service validation, repositories, wage-engine resolution, wage-scale editor, and date-preservation checklist.

Observed at review time; recheck against current code before proposing edits:
- The dropdown disabled inactive elements without a reason but did not implement mode/existence eligibility.
- Add/Edit shared a form, defaulting to Add.
- Service validation covered values, dates, settlement freezes, and locked windows, but not the proposed eligibility.
- Engine Add can overwrite an entry; it does not necessarily create a duplicate line.
- Replace without a base applies its value with a warning.
- Suppress removes a scale/contract entry.
- Manual-entry elements do not themselves create contract wage lines.
- Rate-times-quantity combines monthly transaction quantity with the resolved scale/contract rate, falling back to the transaction rate.
- Allotments and recoveries are calculated separately.
- Wage-scale editor permitted scale_lookup and rate_times_qty elements.
- Override reads had no explicit ordering; entry resolution followed returned order.

### Checks actually performed

Read-only isolated tests extracted actual engine code:
- Add 100 followed by Replace 150 resolved to 150; reversing order resolved to 100.
- Add followed by Suppress excluded the element; reversing order paid 100.
- Suppressing a contract rate still allowed transaction rate 8 to resolve to 8.
- With no transaction rate after suppression, rate resolution produced a missing-rate error.

These were focused tests, not a complete implementation or regression suite. No final proposed patch, implementation tests, or final regression-reviewed solution was completed.

No application files, configuration, database records, or dependencies were changed during the investigation. Working tree was clean before saving these notes.

## References for continuation

- client/src/modules/accounts/pages/ContractDetailPage.tsx
- client/src/modules/accounts/pages/WageScaleEditor.tsx
- server/v2/accounts/services/engagementsService.ts
- server/v2/accounts/controllers/engagementsController.ts
- server/v2/accounts/repositories/engagementsRepository.ts
- server/v2/accounts/engine/engineReads.ts
- server/v2/accounts/engine/wageEngineService.ts
- shared/v2/accounts/schema.ts
- docs/contract-pay-item-months-behavior-preservation-checklist.md

Preserve optional month semantics, conversions, locked payroll rules, and settlement protections. The date-selector audit is preservation guidance, not authorization to alter behaviour.

Task lookup attempts previously failed with “TaskMan Get failed”; no task records were modified. No outstanding tool question or background job was waiting for an answer.

## Resume

Receive all questionnaire answers together and reconcile them with the earlier approvals. Only if subsequently requested, finish the minimal proposed fix and regression analysis, then present exact files/code and remaining risks before any implementation.
