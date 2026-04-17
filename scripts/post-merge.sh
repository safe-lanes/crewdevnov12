#!/bin/bash
set -e

npm install
# `--force` answers "no" to all interactive rename prompts so drizzle-kit
# doesn't hang on stdin (post-merge runs with stdin closed). Renames must
# be expressed as explicit SQL migrations rather than relying on push.
npm run db:push -- --force
