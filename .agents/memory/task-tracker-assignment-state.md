---
name: Task tracker assignment state
description: Behavior to account for when a project task appears active but completion cannot be recorded.
---

A project task may display as Active in the task panel and report `MAIN_IN_PROGRESS`, while the current session has no completion assignment and the completion action returns “No active task.”

**Why:** This occurred after the task implementation and validation had completed, so task status alone was not sufficient evidence that the current agent could close the task.

**How to apply:** Before claiming the tracker status changed, check both the project-task record and the completion result. If they disagree, report the tracker discrepancy and keep it separate from implementation completion. Follow the project's completion-record policy in `replit.md`.

A successful completion-status result is also not proof of code-review
approval. In the observed workflow, completion still returned `completed`
after a rejection, while refusing a fresh review despite the fresh-review flag.
Reopening the task did not make that review request run.

**Why:** The task-status update and review verdict can differ; treating the
status as approval can conceal unresolved findings.

**How to apply:** Read the review text separately from the status result.
Report skipped or rejected reviews plainly and do not claim approval from a
completed status alone. Keep an unresolved implementation out of the
authoritative completed-work ledger.