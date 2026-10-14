# Company Form applicability window — presentation verification

This change only reorganizes the existing editor. It does not change policy
payloads, validation, effective-date rules, stage saving, release behavior,
permissions, or backend code. Standard Forms retain their existing selector and
layout. The Company Form selector uses the compact full-word `vNN · Draft` or
`vNN · Released` label; its dropdown retains policy and change-history details.

## Main-preview evidence

The retained test form **TEST ONLY Rule editor e4b3db3d** was reused:

- Form UUID: `ea355bac-4767-4b47-a369-0c6e0a34fda2`.
- Draft version: `881939c3-332a-4d1c-909b-be840be1533a`.
- Released version: `ea4ac78d-46ce-4ac1-afc5-eb390ff89790`.

The browser clicked the real screen, without intercepted responses:

1. Captured the original inline panel and the new compact editor header.
2. Opened Edit, changed the draft's obligation, and clicked Save applicability.
3. Cancelled an unsaved-close confirmation, then accepted it and confirmed the
   saved policy remained.
4. Restored and saved the original obligation. Mode changes to all and manual
   only were local-only and discarded, retaining the saved conditional policy.
5. Confirmed trial visibility for conditional rules and absence for the other
   two modes.
6. Selected an already-released version, clicked View, and confirmed disabled
   mode/condition controls, no Save action and no draft trial.

No new live rule was released. No crew, assignment, requirement, or operational
form was created by this browser journey. Existing test fixtures are retained.

Browser reports and screenshots live in
`.local/verification/company-form-applicability-window/`.
`initial.json` records saving and confirmation evidence. `closing.json` records
the final HEAD and a backend start after that commit; closing is read-only.
The verification script is
`scripts/verify-company-form-applicability-window.mjs`.

## Retained fixture inventory

In addition to the form and version UUIDs above, the reused graph includes:

- Parts: `298197b5-bbd5-4449-bddf-8bcc78b19269`,
  `7aa30d64-0bba-4bb6-a6e4-8f2ebb0ed0d2`,
  `bfb7a6c7-40d4-4ae8-912a-13d6ecc8551c`.
- Sections: `b68c783f-7a6e-4a38-b89f-361121bb05cb`,
  `d7e32fbf-76e2-48be-94be-090eac4f3901`.
- Questions: `02158539-b490-4344-a8a0-7ee6fab59acd`,
  `cfa22b0f-44e6-457f-8e0f-08f0352b04bd`.
- Condition sets: `168f0658-d5fe-447b-87f7-a554c8827694`,
  `243ff827-95d1-492c-ae62-e13a881e5441`,
  `50c41244-f9a5-46d8-bda0-e7890935641d`,
  `ea972bed-8cc7-4a1d-bdd5-9618ba819657`.
- Conditions: `00cbbd2f-637d-4a53-b58b-a9b039400a4f`,
  `18b1bc1b-97f8-443b-80d7-d46a619ea972`,
  `73398d41-91c7-4e7c-b9b1-f5c982490262`,
  `c019b117-9f3a-4b9c-99d4-d6489a10e442`,
  `d1ff3254-fb5f-415e-a2df-dd710bd9e225`,
  `e98091ca-2b72-4bca-a438-84daa2e7f2bb`.

## Regression checks

Six isolated UI tests cover conditional-only trials, released/view-only
controls, cancellation, confirmed discard, saved values after reopen, and the
registered save handler remaining available when the window closes.
Together with the existing permissions and release-workflow tests, all 16
focused UI checks pass. Existing tests now open the settings window and query
its portal instead of looking for the old inline panel; their safety assertions
are retained.

TypeScript remains at 222 diagnostics and the production build passed.
The final full suite is **1,226 passed / 161 failed / 67 pending**, within the
standing baseline. Company Forms is **82 suites / 503 passed / zero failed or
skipped**. The completed report is `final-full-suite.json` in the evidence
directory; the earlier run with outdated inline-panel assertions is not used
as the closing gate.
