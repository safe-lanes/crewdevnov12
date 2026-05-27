#!/bin/bash
set -e

# Install any new dependencies brought in by the merge.
npm install

# NOTE: Schema migrations are file-based (migrations/*.sql) and are applied
# automatically by server/index.ts at workflow startup. We intentionally do NOT
# run `drizzle-kit push` here because it is interactive (asks about ambiguous
# table renames) and stdin is closed during post-merge, causing it to hang.
#!/bin/bash
set -e

npm install
# `--force` answers "no" to all interactive rename prompts so drizzle-kit
# doesn't hang on stdin (post-merge runs with stdin closed). Renames must
# be expressed as explicit SQL migrations rather than relying on push.
npm run db:push -- --force
