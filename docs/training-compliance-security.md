# Training compliance: attachment access

Slice 1 precedes training compliance. Attachment reads require a resolved,
active parent role with the relevant explicit View grant. Ship/Vessel actors
also require complete server-resolved vessel membership and a current onboard
assignment for crew-level records. Recruitment evidence remains Office-only.
Deleted attachments, deleted parents/subjects and orphaned references are denied.
UUID possession and browser-supplied vessel claims never confer authority.

Private file reads additionally require the current tenant's storage prefix.
Legacy inline-file collection responses require the same subject access.

Later compliance slices use a separate **Override training compliance**
permission, default off for every parent role. **Override checklist** never
overrides training gaps. Training override records server identity, timestamp,
written reason and the overridden results. Existing Company Forms restrictions
on outstanding/started mandatory forms remain unchanged.
