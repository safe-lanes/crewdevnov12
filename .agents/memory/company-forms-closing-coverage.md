---
name: Company Forms closing coverage
description: Required full-area execution and treatment of skipped tests during Company Forms acceptance.
---

Closing evidence must run every Company Forms and submission-area test file,
including shared authoring and renderer consumers, not a selected passing subset.
Any skipped suite is a failure; the gate also treats missing/empty suites and
skipped tests as failures.

**Why:** The user explicitly rejected closure with lifecycle and boundary
regressions described as inherited. Those regressions belonged to the delivered
feature, even though unchanged sources reproduced them before the correction
pass. Baseline attribution is evidence, not permission to leave them failing.

**How to apply:** Discover the full relevant inventory, retain verbose results
and failed attempts, and require every file to execute successfully before
certifying a closing run. Correct obsolete fixtures against the real
stage/role/vessel policy; never loosen permissions or delete protected evidence
to achieve a passing result.