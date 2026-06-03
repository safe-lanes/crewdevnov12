---
name: Rest Hours masters endpoints
description: Which base path the Rest Hours frontend must use for fleet/additional group master data.
---

Fleet groups and additional groups for the Rest Hours module are served by the shared masters
router mounted at `/api/v2/masters` (`server/v2/masters/routes.ts` → `getFleetGroups` /
`getAdditionalGroups`), e.g. `/api/v2/masters/fleet-groups`, `/api/v2/masters/additional-groups`.

**Why:** The Rest Hours frontend API client (`restHoursApiV2.ts`) has its own `V2_BASE =
'/api/v2/rest-hours'`. Building group URLs from that base (`${V2_BASE}/masters/...`) hits a
non-existent route and silently falls through to the Vite SPA catch-all (returns index.html,
not JSON) — dropdowns render empty with no console error.

**How to apply:** For group/master data in Rest Hours, hardcode the absolute `/api/v2/masters/...`
path rather than composing from the rest-hours `V2_BASE`.

Note: group `vessels` come back as a comma-separated string of vessel NAMES (not IDs) and may
contain duplicates — dedupe (split/trim/Set) before resolving names to vessel entryIds.
