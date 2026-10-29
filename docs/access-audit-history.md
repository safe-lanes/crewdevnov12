# Access audit history

## Presentation

Admin > Access Control now has an **Access audit history** button beside Company
PDF branding. The audit list is no longer in the page body and is not fetched
until the popup opens. The popup uses the same shared Dialog components, width,
height limit, scrolling and background as Training Matrix Compliance.

Each resting entry is one plain sentence containing the recorded time (UTC),
the person or recorded actor role, and what changed. Technical identifiers,
actor JSON, event/resource/action keys and the recorded details are inside the
native Details expander. Named before/after displays use On/Off or Granted/Not
granted, not booleans. Nested before/after booleans are displayed as Yes/No.

An audit record whose before and after values are identical says the setting
was kept on/off or the permission remained granted/not granted. It does not
claim a change that the data does not show.

## Mapping

The shared presentation mapping is
`shared/v2/admin/accessAuditPresentation.ts`.

| Internal event | Plain meaning |
| --- | --- |
| `grant_change` | Granted, removed, or retained a named permission for a named role |
| `training_setting_changed` | Turned on/off, or retained, the named training policy |
| `training_override` | Overrode training compliance for a deployment checklist |
| `checklist_override` | Overrode unresolved Company Form checks for a deployment checklist |
| `role_eligibility_change` | Changed a role's availability |
| `company_document_branding` | Updated the company document logo |
| `parent_sync_management_eligibility` | Updated a role's management eligibility from the parent |
| `parent_sync_category_readiness` | Changed the availability of the parent support category |
| `parent_sync_rejected` | Refused a parent update and preserved existing access |

Settings use the exact Training compliance policy labels:

- `block_missing_expiry` → **Block when a mandatory certificate's expiry is not recorded**
- `block_expiring_during_contract` → **Block mandatory courses expiring during contract**

Company Forms permission labels come from the existing shared permission
catalogue: View, Fill in, Witness, Sign as Company Representative, Void,
Void completed and Override checklist. Management and training override have
explicit labels. Menu permissions resolve the menu's display name, falling back
to its name or the menu name already captured in audit details.

No current key was left unmapped in the 51-entry development history checked.
Future unknown events/actions receive a non-technical sentence pointing to
Details; their keys are reported in the read response's `unmappedKeys` metadata,
not printed in the resting sentence.

## Filters and pagination

- Existing event filters: All events, Management, Void completed, Parent sync.
- Existing role filter retained.
- From and To dates are inclusive UTC calendar days.
- Free-text search matches the same sentences displayed, case-insensitively,
  including resolved names, permissions, roles and settings.
- Changing filters resets to page one. Invalid date ranges receive a plain
  explanation.
- The popup requests **20 entries per page**, with Previous/Next and an exact
  matching count. The server permits at most 50 per request.
- The reader scans matching records in bounded batches of 250 to search the
  formatted sentences across the entire history, retaining only the requested
  page. Search is not silently restricted to the old 500-row limit.
- Existing callers without a page parameter retain the legacy array response.

## What the existing audit identifies — no capture changes

`server/v2/admin/services/accessControlManagement.ts:65–77` derives the actor from
the authenticated server-side role resolution and stores:

- `actor.masterUserId`: the **individual user's identifier**, not merely a role;
- `actor.roleId` and `actor.roleName`: the role recorded when the event occurred;
- `actor.userType` and `actor.source`.

A name is **not frozen in the audit actor**. The read-only history query resolves
`actor.masterUserId` against `master_users.id` and displays the available current
full name, display name, or first/last name. All 51 entries checked have both an
individual identifier and an available current name.

If the person's master record/name becomes unavailable, the UI uses the captured
role name, explicitly falling back to an unnamed user if that too is absent.
It does not invent a person's name. Name and affected-role-name enrichment is
read-time presentation, not a rewrite of historical audit data; current master
names are not evidence of the spelling at the time of the event.

No audit writer, identity capture, permission guard, schema or migration changed.

## Verification

`scripts/verify-access-audit-popup.mjs` uses the existing office development
persona and real read responses. Every API mutation is blocked.

Screenshots and the request report are under the ignored directory
`.local/verification/access-audit-popup/`:

- `button.jpg`: main page without the old history section;
- `popup.jpg`: normal resting sentences;
- `details.jpg`: expanded technical information and named On/Off values;
- `event-filter.jpg`, `role-filter.jpg`, `date-filter.jpg`,
  `search-filter.jpg`: each filter in use;
- `pagination.jpg`: the next page.

The check asserts no history fetch while closed, no technical keys/UUIDs/booleans
in resting sentences, hidden payload until expansion, no entries after closing,
and no browser errors or attempted writes. This is development-persona
verification, not parent-authenticated production sign-in verification.

Unit tests cover label mapping, unchanged values, missing names/references,
readable before/after values, pagination across batches, search beyond the first
batch, and invalid page/date inputs.

### Gate-only test-double maintenance

The first full run reported 163 failures. The additional failure was an unchanged
master-data synchronization test whose mock still modeled the retired
bulk-insert API and lacked a transaction method. Only that test double was
updated to model transactional row-by-row reconciliation. It still checks the
exact nonsequential parent IDs and sequence reset; it now also checks the
transaction and target table. No production master-sync code changed.
