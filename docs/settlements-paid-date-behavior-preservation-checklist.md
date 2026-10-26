# Group 7 — Settlements Paid date preservation

## Authority, scope and evidence

This records every behaviour and validation finding from the source-code audit
presented on 2026-10-08. The user requested saving the complete audit to preserve
it during later changes, while changing nothing in the application.

Scope: Settlements → Mark Settlement Paid → Paid date, one field.
Keep this group separate from all other changes: confirming the dialog saves
payment information, marks the settlement Paid and its engagement Settled.

This is a source-code audit, not live payment, cross-browser or concurrency
testing. Recheck current sources before implementation. Saving this checklist
authorizes no solution, code changes, refactoring, standardization or repair of
existing gaps. Approvals from other date groups do not transfer.

## 1. Availability, status and permissions

- Mark Paid appears in settlement detail only when status is Approved and the
  user has Account Settlements Edit permission.

| Status/permission | Mark Paid |
| --- | --- |
| Draft | Hidden |
| Submitted | Hidden |
| Approved with Edit | Shown |
| Approved without Edit | Hidden |
| Paid | Hidden; Lock available with Edit permission |
| Locked | Hidden |

- The server separately checks that the settlement is still Approved.
- The Accounts server's office-only route policy blocks Ship users from this
  endpoint. Preserve this independently of UI permissions.

## 2. Default and initialization

- Paid date initializes to today's UTC date when the Settlements page component
  mounts, using new Date().toISOString().slice(0, 10).
- UTC today may differ from local/India today around midnight.
- It is not based on settlement date, sign-off, engagement dates, approval,
  payroll period, selected vessel or an existing saved Paid date.
- Opening the dialog does not recalculate today.
- Leaving the page mounted across midnight does not automatically update it.
- Reopening does not reset it to today; a fresh page mount initializes it again.
- Today is a default, not a minimum or maximum.

## 3. Retained dialog values and cross-settlement state

- Paid date, payment reference and payment remarks are page-held state.
- Opening, closing and successful saving do not explicitly reset these values.
- Cancel/reopen retains the entered date and other fields.
- Clearing the date, cancelling and reopening retains a blank date.
- Returning to the list and selecting another settlement while the same page
  component remains mounted does not deliberately reset these values.
- A previous date/reference/remark can appear for another settlement.
- Do not silently replace this with fresh defaults or reset-on-open behaviour.

## 4. Input and appearance

- Native browser date input; not the shared date selector.
- 36px high, full width, using the standard Input styling.
- Label: Paid date, without a required asterisk.
- No custom placeholder, shared date-text parser, inline date-format error or
  reserved inline-error space.
- Browser controls visible format, calendar and native typing behaviour.
- Accepted state is a date string, e.g. 2026-10-08.
- Changing or blurring does not save.

## 5. Required versus optional

- Paid date is required for the payment action.
- Input has no HTML required attribute.
- Confirmation is disabled when the stored date value is empty.
- The server separately requires a date string.
- User can clear the field; clearing prevents normal confirmation rather than
  saving a blank payment date.
- There is no separate Save date action.

## 6. No business-date limits

- No HTML min or max.
- No explicit requirement for today, past-only or future-only.
- No comparison with settlement date, sign-off, approval, engagement dates,
  settlement payroll month or locked periods.
- Past/future dates are not rejected by a business-date comparison here; browser
  handling, request validation and database acceptance still apply.
- Do not introduce date relationships merely because other groups have them.

## 7. Three validation layers

### Browser

- Native browser date handling and calendar selection.
- Page does not call checkValidity/reportValidity before requesting payment.
- No separate unfinished-text state, invalid-visible-draft tracking or check
  that visible draft matches the last accepted date.
- Partial native input behaviour can depend on the browser.

### Confirmation button

- Disabled only while Mark Paid is pending or stored Paid date is empty.
- No dirty check: unchanged default can be confirmed.
- No separate nonblank-invalid-value disable condition.

### Server request schema

- Paid date must be a string matching /^\d{4}-\d{2}-\d{2}$/.
- Exact pattern error: paidDate must be YYYY-MM-DD.
- Missing, null, non-string or incorrectly shaped values fail this schema.
- This is a shape check, not a real-calendar-date check.
- 2026-02-31, 2026-13-01 and 0000-01-01 match the pattern; that does not mean
  they can be stored successfully. Database date validation is separate.
- Years longer than four digits fail the pattern even if a browser displays them.
- Do not describe full real-date or unfinished-draft validation as pre-existing.

## 8. Server processing order and errors

1. Validate request fields.
2. Find live, non-deleted settlement.
3. Check status is Approved.
4. Update settlement payment information and status.
5. Update engagement status.
6. Read and return updated settlement detail.

| Condition | Response |
| --- | --- |
| Invalid request fields | HTTP 400, Invalid payment details, with validation details |
| Missing/deleted settlement | HTTP 404, Settlement not found |
| Status not approved | HTTP 409, Settlement can only be marked paid from 'approved' (status '…') |
| Unexpected database/processing failure | HTTP 500, Failed to mark settlement paid |

- Server status validation remains important if status changes after opening.
- Request validation precedes settlement lookup/status validation.

## 9. Payment reference and remarks in the same request

### Payment reference

- Optional; trim leading/trailing whitespace.
- Empty/whitespace-only becomes null.
- Supplied reference/null is written; blank does not mean preserve old reference.
- No explicit maximum length in this request schema.
- Placeholder: Bank ref / voucher no.

### Payment remarks

- Optional; trim leading/trailing whitespace.
- Empty/whitespace-only becomes undefined and is omitted from the JSON request.
- Omitted remarks preserve existing settlement remarks.
- Nonblank remarks replace existing remarks.
- Server schema permits at most 2,000 characters.
- Textarea has two rows and no local maxlength enforcement.
- Placeholder: Leave blank to keep existing remarks.
- API schema also accepts null; service overwrites remarks whenever the property
  is not undefined. The normal dialog omits blank remarks rather than sending null.
- Oversized remarks can reject the entire payment request despite a valid date.
- Preserve the distinction between blank reference and blank remarks.

## 10. Request and writes

- POST /api/v2/accounts/settlements/:uuid/mark-paid.
- Request uses selected settlement UUID and captured Paid date/reference/remarks.
- Date is sent as its stored string, not converted to a timestamp or timezone.

Settlement update:
- status = paid.
- paidDate = submitted date.
- paymentReference = supplied reference or null.
- remarks replaced only if supplied.
- updated-by audit identity and updated timestamp.

Engagement update:
- status = settled.
- updated-by audit identity and updated timestamp.

Does not:
- Recompute settlement or payment amounts.
- Change settlement date or settlement period.
- Rebuild statement snapshot.
- Recreate approval rows.
- Automatically lock settlement.
- Initiate a bank transfer in this code path.

This records payment; it is not merely a date edit.

## 11. Related balances and timing

- Balance calculations recognise paid and locked settlement statuses.
- Settlement's existing period, not Paid date, determines payout timing in
  period-based balance deductions.
- On-board balance component reduces on-board balance.
- Leave payout component from snapshot reduces leave balance.
- Do not subtract the whole net payable from on-board balance: this would
  double-count components which never entered it.
- Mark Paid does not itself rewrite wage-ledger lines.
- Changing Paid date must not be treated as moving settlement payroll period.

## 12. Pending request behaviour

- Confirmation disabled; label becomes Saving….
- Date, reference and remarks remain editable.
- Cancel and normal dialog close controls remain available.
- Request uses values captured when the mutation starts.
- Later typing does not change the already-sent request.
- Closing does not cancel the request or undo a successful payment update.
- No automatic mutation retry is configured.

## 13. Success

1. Invalidate/request refresh of settlements list.
2. Invalidate/request refresh of selected settlement detail.
3. Close dialog.
4. Show Settlement marked paid.

- Refreshes are started without awaiting completion before closing/toast.
- Returned detail is not directly installed into displayed settlement state;
  UI relies on refreshes.
- Paid date/reference/remarks drafts are not cleared.

## 14. Failure

- Destructive toast title: Error.
- Description: error's message, falling back to Request failed.
- No deliberate dialog closure or field clearing.
- Pending ends; retry possible if stored date remains nonblank.
- Uses raw request error, not the API-error formatter used elsewhere.
- Error description can include HTTP status and response JSON/text.
- If user already dismissed dialog while pending, failure does not deliberately
  reopen it.

## 15. Dismissal and keyboard

- Before a request starts, Cancel/close do not mark paid.
- Normal Escape/outside-click dismissal is not overridden.
- No unsaved-changes confirmation.
- Drafts remain page-held after dismissal.
- No form-submit handler around these controls.
- Typing or Enter inside date input is not a dedicated payment-save action.
- Normal keyboard activation of a focused Mark Paid button remains available.

## 16. Saved-date display

- List column: Paid Date; absent date displays blank.
- Detail header shows Paid [formatted saved date] when saved date exists.
- Read-only display uses Accounts formatDate, normally DD-MMM-YYYY, with UTC
  date extraction; independent of unsaved dialog draft.
- Reference, if present, appears as Ref [reference] in the detail header.
- Saved Paid date is not exposed through a normal editing control after payment.
- Mark Paid disappears; Lock is a separate action.

## 17. Separate lifecycle actions

- Lock allowed only from paid; changes status to locked without replacing date.
- Revert to Draft allowed only from submitted, not paid/locked.
- No Undo payment action in this screen.
- Recompute and adjustment editing remain draft-only.
- Separate remarks editor permits draft/submitted, not paid.
- Covered calculation periods already freeze at submitted/approved and remain
  frozen at paid/locked. Paid date does not establish the freeze.
- Do not combine date replacement with approval, locking, recomputation or
  status-flow changes.

## 18. Existing gaps and concurrency boundaries

These are observations, not authorized fixes:

- Settlement update and engagement update are separate writes, not one combined
  transaction in Mark Paid.
- Failure after the first write can leave settlement marked paid: engagement
  update or final detail read can fail after payment state was written.
- Do not promise every error means no data was saved.
- Approved status is checked before update, not conditionally within that
  database update; this path does not lock the settlement row.
- Disabled button does not guarantee prevention of concurrent requests from
  different sessions.
- Open dialog is not automatically closed by displayed status/permission changes.
- Confirmation does not independently recheck displayed status/permission;
  server status check remains important.
- Do not silently repair these gaps during date-control replacement.

## Preservation boundary

Keep all distinctions:
- Input change versus payment confirmation.
- Page-mount default versus dialog-open default.
- Local drafts versus saved display.
- Empty reference versus omitted remarks.
- Browser date handling versus request shape versus database validity.
- Paid date versus settlement period.
- Mark Paid versus approval, Lock, Revert and Recompute.
- Payment recording versus bank transfer.
- UI pending/disabled state versus server concurrency protection.

No solution or implementation is authorized by saving this audit.

## Source references

- client/src/modules/accounts/pages/SettlementsPage.tsx
- client/src/modules/accounts/api/accountsApiV2.ts
- client/src/modules/accounts/accountsFormat.ts
- client/src/components/ui/input.tsx
- client/src/components/ui/dialog.tsx
- client/src/lib/queryClient.ts
- server/v2/accounts/controllers/settlementsController.ts
- server/v2/accounts/services/settlementsService.ts
- server/v2/accounts/repositories/settlementsRepository.ts
- server/v2/accounts/repositories/engagementsRepository.ts
- server/v2/accounts/routes.ts
- server/v2/accounts/shipAccessPolicy.ts
- server/v2/accounts/engine/balanceService.ts
- server/v2/accounts/engine/engineReads.ts
- shared/v2/accounts/schema.ts
- migrations/0168_accounts_settlements.sql
