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