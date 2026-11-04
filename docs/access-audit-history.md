# Access audit history

## Permission label snapshots

Migration 0269 adds nullable `permission_display_label` without a backfill.
The central server writer freezes the current display label, never request
input. Sentences and detail headings prefer this snapshot. Legacy entries
continue to use the live lookup. CSV has separate **Permission (current label)**
and **Permission (recorded at event)** columns; the latter is empty for legacy
events. No historical row is rewritten. See
[diagnosis and measurements](access-audit-permission-label.md).

## Changes-only capture and affected-role snapshots

The shared `appendAudit` writer compares the JSON values that would be stored.
Equal scalar/null values and structurally equal objects (regardless of key
order) do not insert an audit entry. This applies to every event type; no
browser flag can bypass it. Historical entries, including no-change entries,
remain untouched. Unchanged Save requests still return their normal successful
response; the audit list is not a Save-attempt or review register.

Read-only development preflight, before any migration or watched-server edit:
51 entries, **12 identical before/after entries**, all training-setting events.
The original columns of all 270 public business tables were fingerprinted.
Only after that preflight passed was migration
`0268_access_audit_affected_role_name.sql` added to the watched directory.
It adds nullable text `adm_access_control_audit.affected_role_name`, without
updates or backfill. Removing that column after capture would lose evidence.

New affected-role names come from the transaction's role master, never from
the browser. Parent synchronization can supply its trusted in-transaction role
snapshot when the replacement removed the role. The sentence uses the snapshot
first, with the existing live-role lookup for legacy null entries. CSV retains
`Affected role (current name)` and adds `Affected role (recorded at event)`.
Neither actor nor affected-role names are historically backfilled.

### Event inventory

| Event | Could previously insert equal before/after values? |
| --- | --- |
| `training_setting_changed` | Yes; every submitted setting was appended even if unchanged. |
| `grant_change` | No in existing action/menu paths; each already compares decisions. The central guard also protects internal callers. |
| `role_eligibility_change` | No; the caller checks active/deleted flags. |
| `parent_sync_management_eligibility` | No; the caller checks eligibility changes. |
| `parent_sync_category_readiness` | No; the caller checks readiness changes. |
| `parent_sync_rejected` | Yes; previously stored null/null. Now records the newly created refusal outcome, not a change to the preserved configuration. |
| `training_override` | Yes if the checklist was already true; now suppressed when before/after match. |
| `checklist_override` | Yes if the checklist was already true; now suppressed when before/after match. |
| `company_document_branding` | No equal stored values: each save creates a distinct, real branding version UUID. |

Parent-update refusals remain visible: before is null and after is
`{outcome:"rejected",existingStatePreserved:true}`; details still contain the
server-recorded reason. This is an outcome event, not a fabricated grant change.
The central equality rule still applies to this event like every other one.

Dependency inspection found only audit-history reads/export, their pagination
counts and query invalidation after Save. There is no consumer treating
no-change entries as a “last reviewed” marker, report input or business-operation
prerequisite. History counts continue to count recorded changes/outcomes.

Verification writes, settings saves, role renaming and deletion run only in the
registered isolated test database. The development preview verifier is read-only.

## Presentation

Admin > Access Control now has an **Access audit history** button beside Company
PDF branding. The audit list is no longer in the page body and is not fetched
until the popup opens. The popup uses the same shared Dialog components, width,
height limit, scrolling and background as Training Matrix Compliance.

Each resting entry is one plain sentence containing the recorded time (UTC),
the person or recorded actor role, and what changed. Details contains only the
named before/after comparisons, with the existing On/Off and Granted/Not granted
wording unchanged. No technical payload or raw JSON is rendered in the popup.
Structured before/after values point to the export rather than exposing JSON.

**Recommendation:** retain the Details expander. It keeps the list compact while
allowing an office user to inspect the useful named comparisons when needed.
Those comparisons were not moved inline.

## Export

**Export CSV** downloads every entry matching the current event, role, inclusive
UTC date range and sentence-search filters, not just the displayed page. It uses
the same protected read endpoint and the same filtering/presentation code as the
list, with an explicit export flag. Ordinary page requests remain paginated.

The existing `rowsToCsv` and `downloadCsv` helpers in `client/src/lib/csvExport.ts`
are reused unchanged, exactly as `ReportResultsTable` does for Reports.
Crew/promotions tables use AG Grid's CSV export, which requires a grid API;
this popup is not a grid. No new CSV library or grid was introduced.

Columns include the plain sentence, UTC timestamp, current person name, current
affected-role name, event key, resource, setting/action key, raw before and after
values, audit ID, actor account ID, affected role UUID, recorded actor JSON and
recorded details JSON. Unknown person names remain blank, not substituted with a
role name. Structured values are serialized as JSON in the file only. Missing
values are blank and explicit null is `null`. Potential spreadsheet-formula
prefixes are escaped with an apostrophe. Export errors show a plain retry
sentence. Export does not write audit records.

The person column is a current-name lookup. A separate recorded-name column now
contains the frozen actor name; legacy entries remain blank there.

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

Settings use the exact Blocking Seafarer Deployment Policy labels:

- `block_missing_expiry` → **Block seafarer deployment when a mandatory certificate's expiry is not recorded**
- `block_expiring_during_contract` → **Block seafarer deployment when mandatory courses expiring during contract**

Company Forms permission labels come from the existing shared permission
catalogue: View, Fill in, Witness, Sign as Company Representative, Void,
Void completed and Override checklist. Management and training override have
explicit labels. Menu permissions resolve the menu's display name, falling back
to its name or the menu name already captured in audit details.

No current key was left unmapped in the 51-entry development history checked.
Future unknown events/actions receive a non-technical sentence pointing to
the export; their keys are reported in the read response's `unmappedKeys` metadata,
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

## Frozen actor identity

`server/v2/admin/services/accessControlManagement.ts` derives the actor from
the authenticated server-side role resolution and stores:

- `actor.masterUserId`: the **individual user's identifier**, not merely a role;
- `actor.roleId` and `actor.roleName`: the role recorded when the event occurred;
- `actor.userType` and `actor.source`.

A new nullable text column, **`adm_access_control_audit.actor_display_name`**,
stores the server-derived name when the entry is inserted. The authenticated
actor is resolved from the tenant's user master, not browser input. All existing
event writers pass through `appendAudit`; no event-selection logic changed.
The name is kept outside the existing actor JSON, whose identifiers remain.

The history sentence prefers the frozen name. Only entries with no stored name
use the existing live lookup against `master_users.id`. The CSV includes both
**Person (recorded at event)** and **Person (current name)** as separate columns.
Changing or deleting the account cannot change an entry's frozen-name sentence.
New events with no available name explicitly record “A user whose name was not
recorded”; they must not acquire a different identity from a later lookup.

Parent synchronization snapshots its operator's name before replacing users,
so deleting or renaming the operator within that transaction does not lose the
name. Other internal callers without a prior snapshot resolve it in the audit
insertion transaction.

**Role answer:** `actor.roleName` is already a frozen text value from trusted
role resolution when the event is captured. It is not resolved live. No extra
actor-role column is needed. The **affected** role's name (`role_name`) is a
separate live enrichment, not the actor's captured role.

### Preflight, migration and backfill decision

Read-only preflight finished before adding any migration or editing watched
server files. Its report is retained outside Git at
`.local/verification/frozen-audit-actor/preflight.json`. This ordering prevents
the development watcher from applying a migration before preflight passes.

Migration **`0267_access_audit_actor_name.sql`** adds only the nullable text column
and its explanatory comment. It leaves all existing values untouched and does
not weaken the append-only trigger. It is idempotent. Dropping the column after
capture begins would destroy historical facts and is not a safe rollback.

Preflight found **51 entries across 2 accounts**; all 51 currently resolve names,
and all 51 have captured actor-role names. None is backfilled; all 51 continue to
use live-name fallback. Today's names cannot prove the accounts were not renamed
after the events. **Recommendation: do not backfill without independent historical
evidence and explicit approval.**

If the person's master record/name becomes unavailable, the UI uses the captured
role name, explicitly falling back to an unnamed user if that too is absent.
It does not invent a person's name. Name and affected-role-name enrichment is
read-time presentation, not a rewrite of historical audit data; current master
names are not evidence of the spelling at the time of the event.

The authorized migration and its migration-ledger entry are the only intended
development database changes. No development audit records or acceptance fixtures
are created, updated or deleted. Rename/deletion/new-event verification uses only
the isolated automated-test database. Permission guards remain unchanged.

## Verification

`scripts/verify-access-audit-popup.mjs` uses the existing office development
persona and real read responses. Every API mutation is blocked.

Screenshots and the request report are under the ignored directory
`.local/verification/access-audit-export/`:

- `button.jpg`: main page without the old history section;
- `popup.jpg`: normal resting sentences;
- `details.jpg`: expanded named On/Off values with no technical payload;
- `export-opened.jpg`: the actual downloaded CSV opened as a table, with both
  the sentence and technical columns;
- `all-history.csv` and `filtered-history.csv`: actual downloads clicked in
  the popup, verified against the protected export response;
- `event-filter.jpg`, `role-filter.jpg`, `date-filter.jpg`,
  `search-filter.jpg`: each filter in use;
- `pagination.jpg`: the next page.

The check asserts no history fetch while closed, no technical keys/UUIDs/booleans
in resting sentences, no technical payload even after expansion, no entries after closing,
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
