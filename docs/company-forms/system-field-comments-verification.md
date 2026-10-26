# System-field comments and draft/release test recovery

## Rule and builder

A Company Form system-field point displays a value held by the system. It
cannot accept a comment. The complete and draft server schemas retain this
rule; neither is relaxed.

The builder displays an unchecked, disabled **Comment enabled** control on
system-field points. Its tooltip explains why. Changing a comment-enabled
point to System Field clears that setting and displays an informational notice.
Existing error wording is unchanged.

## Existing released versions

The seven protected PDF fixture versions are:

| Version ID | Form | Version |
| --- | --- | --- |
| 7451 | SAMPLE PDF layout review — logo | 01 |
| 7452 | SAMPLE PDF layout review — company-name | 01 |
| 7453 | SAMPLE PDF layout review — logo | 02 |
| 7454 | SAMPLE PDF layout review — logo — revised | 01 |
| 7455 | SAMPLE PDF layout review — company-name — revised | 01 |
| 7456 | SAMPLE PDF layout review — logo — final glance | 01 |
| 7457 | SAMPLE PDF layout review — company-name — final glance | 01 |

Their registration, including prior samples, is in
`docs/company-forms/pdf-layout-fixtures.json`, referenced by the main fixture
register. No fixture is repaired, deleted or re-released by this work.

Opening each version in the main preview shows its released, read-only builder
and its form preview without an error. The system-field comment control is
visible, disabled and unchecked. Existing stored `comment_enabled=true` values
are not rewritten: the editor's existing display normalisation is read-only.

The unconditional completeness check is called by
`formsService.releaseVersionById` only after confirming that the version is a
draft. It is not called by the builder, preview or submission read paths.
Migration 0266 likewise skips the release check when an updated version was
already released. The new unconditional check does **not** retrospectively
reject or hide these versions.

`node scripts/verify-system-field-comments.mjs` repeats the browser checks for
all seven registered versions. Its database connection is read-only and its
browser refuses every non-read API request. The report, HEAD and screenshots
are saved under `.local/verification/system-field-comments/`.

## Why 27 tests did not run

Seven suites created their fixtures with direct SQL inserts already marked
`released`. Migration 0266 refuses that insertion: a Company Form version must
first exist as a draft. The shared setup error was:

> Only draft versions can be released.

| Suite | Previously pending tests |
| --- | ---: |
| company-form-stage-less-runtime | 6 |
| company-form-signing-and-completion | 3 |
| company-form-submission-answer-roundtrip | 1 |
| company-form-submission-boundary | 3 |
| company-form-submission-races | 5 |
| company-form-submission-starts | 5 |
| company-form-submission-void-races | 4 |

Those fixture setups now insert drafts and explicitly transition them to
released. They do not disable or remove any trigger. The dedicated test that
direct insertion of a released version is refused remains in place.

Other test corrections:

- The signing/document fixture supplies real content and disables comments on
  its rank system field before release.
- The applicability test saves an unfinished automatic policy, then verifies
  that releasing it without completing it is refused.
- The lower-level copy test creates an independent draft destination rather
  than asking the public endpoint to create a second simultaneous draft.
- Responsibility tests assert SQLSTATE `23514` and the exact applicable
  trigger or constraint refusal.
- Content tests retain harmless-format sanitisation and frozen-copy assertions,
  and explicitly test refusal of executable HTML in both single and bulk saves.
- Builder tests require the system-field comment control to be disabled rather
  than absent, verify the type-change notice, and open a legacy released point
  without saving or releasing it.
- API tests attempt to enable system-field comments in both single and bulk
  draft writes, verify refusal and unchanged saved rows, and release the valid
  form afterwards.

No tests are skipped, removed or marked todo to recover coverage. Tests run
against the identity-verified isolated test database, not development.

## Closing gates

The final full-suite run contains **1,786 passed, 162 failed and 67 pending**,
within the accepted limits of 162 failures and 67 pending. It is not a claim
that the entire application test suite is green.

All **98 discovered Company Forms files** are present in that run:
**694 tests passed, zero failed, zero pending/skipped/todo**. Comparing test
identities with the recovery run confirms:

- All 643 previously passing Company Forms tests still pass.
- All 21 previously failing Company Forms tests now pass.
- All 27 tests previously blocked by setup now run and pass.
- Three added tests pass.

TypeScript reports **222 diagnostics**, within the accepted limit; none are
in changed files.

Raw full-suite output is `/tmp/system-comments-full-suite.json`. The filtered
Company Forms results and identity comparison are stored in
`.local/verification/system-field-comments/`. The full-suite evidence derives
Company Forms coverage from the same run, not from a separate claimed green run.
