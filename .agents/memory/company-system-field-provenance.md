---
name: Company system-field provenance
description: Distinguish shared submission fields from subject-specific record fields in Company Forms.
---

Company Form System fields have a shared set available across subjects and a subject-specific set. Date of declaration is shared, but its eventual live value must come from the submission at completion; it is not a crew-assignment attribute.

**Why:** The user explicitly corrected an initial assumption that all System fields should be sourced from the crew assignment. A field's availability in every subject does not determine its source record.

**How to apply:** When implementing live field resolution or snapshotting, resolve shared fields from the submission context and subject-specific fields from that subject's record. Do not invent a Preview value.