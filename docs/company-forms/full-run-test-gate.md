# Company Forms closing test gate

Run the normal `npm test` (no file, name or project filters, sharding or
early bailout). Retain that run's JSON results even when Vitest exits
nonzero because of known failures elsewhere in the project. Then run:

```sh
npm run test:company-forms-gate
# For a saved full result:
node scripts/verify-company-forms-full-run.mjs path/to/full-results.json
```

For a separate evidence file, override the path, not the reporter:
`npm test -- --outputFile.json=generated-artifacts/full-results.json`.
The configured full JSON reporter adds both collection scope and the
unhandled errors from Vitest's run-completion callback. Plain Vitest JSON
and focused, interrupted or incomplete runs are not accepted. Do not
reuse a prior JSON file if a run fails before producing a fresh report.

**Closing reports must quote the gate script's PASS/FAIL output from
that same full run.** Do not count files by a filename filter, or use a
passing `scripts/verify-company-forms-tests.mjs` dedicated run to override
a full-run failure. The dedicated script remains useful for diagnosis.
This gate is separate from the overall suite's known-failure and pending
ceilings.

## Updating the manifest deliberately

`tests/manifests/company-forms.json` starts with the 105 files found by
`discoverCompanyFormTests()` and all 744 full titles emitted by Vitest
for those files. The gate compares exact file paths and full test-title
multiplicity. Some parameterized cases share a title and must each run.
Missing, empty or failed suites, absent/nonpassing assertions, unexpected
tests and unhandled run errors fail the gate.

When adding, removing or renaming Company Forms tests, edit the manifest
in the **same commit** as the test change. Review the diff by file and
full title, including duplicate occurrences. The gate never updates the
manifest. Do not replace the manifest with a failed, partial or filtered
run's inventory to make a failing gate pass.
