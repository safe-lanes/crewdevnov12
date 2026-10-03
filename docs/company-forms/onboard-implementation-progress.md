# On-board Company Forms implementation

One task, six implementation steps, each committed and its HEAD reported in
chat. The reviewed plan is `.local/tasks/company-form-crew-list-entry.md`.

## Step 1 — trusted identity and policy

- Identity comes from the authenticated numeric master-user ID.
- Access Control resolution maps the trusted user's role to one active role
  identifier; permissions use that identifier, not the display name.
- Vessel membership comes from that user's complete numeric vessel-ID list,
  resolved to active vessel UUIDs; JWT vessel claims are not a fallback.
- The signing-time rank source is the authenticated user's own designation,
  validated against base company ranks and captured as readable text. There
  is no lookup of the current Master on a crew row.
- The development catalogue currently has Ship roles but no Master-named
  Ship role. Closing fixtures will add a retained, explicitly synthetic
  Master actor/role without converting any existing actor or rank.
- Requirements now explicitly allow pinned-role on-board witnessing and
  retain Office before-joining witnessing.
- Existing submission, System snapshot and signature rows were captured
  before implementation in a private verification baseline. Subsequent
  comparisons project only the original keys, ignoring new nullable columns.
- No existing operational or signed record was changed in this step.

## Step 2 — migration and designer configuration

- Added migration 0231: distinct Vessel Management signature constraints,
  pinned section role-ID lists and nullable actor/witness capture columns.
- Designer signature settings include Vessel Management and a multiple-Ship-role
  selector. Read/save/version-copy paths preserve identifiers.
- Configuration writes reject unknown/inactive/non-Ship role IDs and reject
  this feature on unrelated form categories.
- Release/eligibility validates required role lists and current role validity.
- Six new release-policy tests plus existing lifecycle/render tests pass:
  36 tests across three suites. TypeScript remains at the 226 baseline
  diagnostics, none in the changed files.

## Step 3 — guarded signing and witnessing

- Subject declarations now separate Office Company Representative signing,
  Seafarer authentication/witnessing, and permitted-role Vessel Management.
- Stage-specific creation/edit/sign/submit guards reject vessel writes outside
  current on-board assignments. Permitted role and trusted complete vessel
  provisioning are rechecked for section writes.
- Authenticated vessel users and roles are locked during capture. Name and
  designation-to-company-rank resolution are frozen; no vessel Master roster
  lookup or later reconstruction is used.
- Witness user ID, name and readable rank are separate from the subject's
  signature identity. Before-joining Office witnessing is retained.
- Third-signature contracts, Preview/live pads, captured witness display and
  required-signature completion checks are integrated.
- Changed code adds no TypeScript diagnostics (226 existing baseline).

## Step 4 — scoped reads and readable history

- Added one subject-authorised batch count endpoint; it counts saved on-board
  submissions including retained void/replacement history, not definitions.
- Linked targets are separately authorised. Shared on-board/before-joining
  renderer links show form, recorded declaration/explicit creation date and
  recorded seafarer name, never an exposed submission UUID.
- Where no recorded historical name exists, the link explicitly says it is
  unavailable. No current crew/master value is substituted.