# Training Matrix — consolidated control bar

## Scope

Presentation only: compact sizing, one wrapping control bar, **O/D** displayed in
place of the old **Expired** urgency chip, and hover/tap explanations. Calculation,
filter predicates, trial-date requests, validity thresholds, dot precedence and
stored data are unchanged.

The order is Due in → trial relief date → Requirement → Evidence, with separators.
At smaller widths these groups wrap within the same bar rather than introducing
a horizontal scrollbar. The five evidence entries remain unchanged.

The compact option is opt-in on the shared `DueInChips` component; the D&A screens
retain their original static legends, sizes, labels and colours.

## Measured sizing

Measured in Chromium against the main workspace preview, before and after:

| Element | Font before | Font after | Height before | Height after |
| --- | ---: | ---: | ---: | ---: |
| Due in label | 14 px | 11 px | 20 px | 16.5 px |
| Due in chip | 14 px | 11 px | 28 px | 24.5 px |
| Trial-date label | 14 px | 11 px | 20 px | 16.5 px |
| Date input | 14 px | 11 px | 36 px | 24 px |
| Requirement button | 11 px | 11 px | 24.5 px | 24.5 px |

The existing Requirement/Evidence `text-[11px]` scale and `px-2 py-1` button
padding are reused. The input uses the existing `h-6` (24 px) token, not a new
custom height. No new font size or control-height token is introduced.

### Vertical space saved

“Controls to table” measures from the first control band's top to the table's top,
so it includes the old inter-band spacing as well as the bands themselves.

| Viewport | Trial | Before | After | Space saved |
| --- | --- | ---: | ---: | ---: |
| 1700 px | Off | 141.5 px | 59.5 px | **82 px** |
| 900 px | Off | 157.5 px | 116.5 px | **41 px** |
| 1700 px | Active | 141.5 px | 84 px | **57.5 px** |
| 900 px | Active | 193.5 px | 149 px | **44.5 px** |

The merged bar has no horizontal overflow in these cases, including active trial
badge and Clear trial date. A further 600 px active-trial check also fits without
bar/page overflow.

The dense 22-crew matrix retains **37 px median rows and 142.5 px crew columns**
at both 1700 px and 900 px. The existing two-crew fixture table stretches its crew
columns to fill available width (337.4375 px and 167.03125 px respectively);
those widths are identical before and after, rather than being forced to 142.5 px.

## Explanations and trial visibility

- **O/D** retains the same red `#D50A0D` styling and the same internal `Expired`
  selection value. Mouse hover and an actual touch tap show
  **“Overdue — expired as of today”**.
- Hovering or tapping **Due in:** shows
  **“Show cells matching any selected window. None selected shows everything.”**
  That sentence is absent from the permanent control-bar layout.
- **“Trial date active — no changes saved”** remains a conspicuous amber badge,
  with the existing amber background/text colours and stronger type weight.
  **Clear trial date** remains a visible underlined action. Both are 11 px.
- Trial-date loading/error safeguards and the ability to clear/retry are retained.

## Verification and integrity

Main-preview evidence uses the existing office development persona (master user
24, Admin role), not parent SSO. It clicks through the real screens; no API
response is mocked. Registered fixture vessel and crew are reused, with no fixture
creation, grant changes or data edits. Real crew names are masked in screenshots.

The browser compares actual visible cell maps before/after, including filled and
hollow colours, for 3M, 2M, 1M, O/D and the combined 1M/O/D selection. All match.
Chip-only actions make no request. O/D hover and touch tap both work; its tap
still selects the same overdue results. The trial changes the fixture's green
certificate to amber, preserves actual relief inputs, and clearing restores the
exact original dots. Combined trial/filter use also matches the earlier result.

Source checks match all eight non-control presentation functions (including
`resolveEvidenceStyle`, `evidenceDotClass` and `MatrixCell`) and all 17 non-control
component variable declarations (including query, urgency toggle, row filtering
and embedded details mapping) against the preceding committed version.

Eight protected source files also retain identical hashes: the server calculator,
date arithmetic, types, reader, checklist policy, on-board adapter, matrix
controller and the approved See Details popup. Thus the shared server thresholds
and trial logic did not change.

All **272 development user tables** retain identical row counts and content
fingerprints; the column-schema fingerprint also matches. Checks run inside
database-enforced read-only transactions. **No schema, assignment, planning,
certificate, checklist or stored matrix changes occurred.**

Exactly five evidence entries remain, with the original green `#16A34A`, amber
`#F59E0B` and red `#DC2626` filled/hollow styles. No new evidence colour or state.

Ignored evidence directory: `generated-artifacts/training-matrix-control-bar/`.
It contains before/closing screenshots, browser reports, SQL/source fingerprints,
AST comparison and fresh full-suite/gate reports.

### Fresh standing gates

- Full suite: **1,689 passed / 162 failed / 67 pending**, no newly failing
  assertions compared with the preceding full-suite run. Exit 1 is expected from
  the existing 162 failures; the suite is not wholly green.
- Company Forms: **97 discovered suites / 661 passed**, zero skipped, pending,
  todo or failed, with no missing suites.
- Matrix UI regression suite: **27 passed**, including O/D selection and
  hover/tap explanations, default D&A sizing, and retained trial/error behaviour.
- TypeScript: **222 diagnostics**, none in the changed files.

The commit and subsequent backend process start are reported in the completion
message.
