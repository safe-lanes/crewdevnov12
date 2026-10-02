---
name: Runtime guard provenance
description: Distinguish a missing guard from a live API process still executing its predecessor.
---

When an API accepts something newly merged source rejects, establish which backend generation handled the request before concluding that another endpoint bypassed validation.

**Why:** A Company Form release succeeded through the canonical endpoint after its lifecycle check had merged, but the backend process predated that change and retained the older handler. Frontend hot updates and current source were not evidence that the backend check was live.

**How to apply:** Correlate the recorded request, database event timestamp, backend process start, and source history. Distinguish isolated task-agent restart claims from evidence for the main process after merge. During an investigation-only request, preserve evidence and do not restart or rewrite the affected record without authorisation. Follow the project's closing-evidence protocol in `replit.md`; do not infer historical verification from an unqualified restart sentence.