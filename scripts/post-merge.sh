#!/bin/bash
set -e

# Install any new dependencies brought in by the merge.
npm install

# NOTE: Schema migrations are file-based (migrations/*.sql) and are applied
# automatically by server/index.ts at workflow startup. We intentionally do NOT
# run `drizzle-kit push` here because it is interactive (asks about ambiguous
# table renames) and stdin is closed during post-merge, causing it to hang.
