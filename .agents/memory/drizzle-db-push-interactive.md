---
name: Drizzle db:push is interactive
description: Why `npm run db:push` cannot be run non-interactively in this repl, and the safe workaround.
---

`npm run db:push` (drizzle-kit push) prompts interactively when it can't tell a
table/column rename from a create+drop. `--force` does NOT bypass this prompt,
and piping newlines into it is unsafe (you can accidentally pick "rename" and
lose data).

**Why:** drizzle-kit asks "is this a rename or a new entity?" for ambiguous
diffs; the prompt is on stdin, not a flag. An automated answer can silently map
a brand-new table onto an unrelated existing one.

**How to apply:** When adding new tables/columns in this project, create them
directly via `psql` with DDL that matches the Drizzle schema exactly, then
verify with `\dt` / `\d <table>`. Reserve `db:push` for a human-run terminal.
