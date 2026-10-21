# Pre-joining Training Matrix — slice 4

## Delivered scope

Read-only compliance in **Vessel → TEST ONLY PDF layout review → Planning →
Chief Officer's Reliever Status → See Details**.

- Mandatory and Recommended have a coloured dot **and written state**.
- Details show the seafarer, captured contract rank, reliever's own saved
  joining date and calculated contract end, vessel and saved matrix revision.
- Course rows show the rank requirement, explicit state, issue/expiry,
  certificate actually used and protected attachment link.
- Equivalents are named. Expand a course to see every matching certificate,
  which was selected, why others were not used, and correction flags.
- Missing information is explained; incomplete is never presented as clear.
  Missing contract end is a warning, not incomplete.
- A failed request shows a plain sentence and Retry. Attachment failures also
  use a plain sentence. No raw server error is rendered.
- Dates are `01-Oct-2026`. The calculation version is displayed.
- Compliance results refresh when the popup reopens, even though the wider app
  normally caches queries indefinitely. Cached results are hidden while a
  fresh calculation is in progress. This was found and fixed by main-preview
  verification, with a regression test.

No Training Needs writes, snapshots, checklist gate, sign-on enforcement,
training override or new grants are introduced by this slice.

## Step 0: calculation 1.2.0

Malformed issue dates count as held and produce the nonblocking flag
**Certificate dates invalid: correct the record**. Only an invalid expiry date
sets the certificate aside. Missing issue date retains its separate
**Issue date not recorded** flag. A valid future issue date still does not count
at joining.

Changed review row:

| Row | Required course | Certificate held | Joining | Contract end | Result | Certificate used |
|---|---|---|---|---|---|---|
| **34 — changed** | Basic fire fighting | BF-invalid-issue; issue `bad-date`; expiry 01-May-2027 | 21-Oct-2026 | 21-Apr-2027 | **Valid; complete**, with the correction flag above | BF-invalid-issue |

The issue date is normalized to absent for the calculation, not rewritten in
D3. Raw review output: `generated-artifacts/training-slice4/row34.json`.
The kernel and review-table focused run passed **79 tests**.

## API and security

`GET /api/v2/vessel/planning/:planUuid/reliever-assignment/:assignUuid/training-compliance`

Both persisted **Vessel View** and **Crew Database View** are required.
The exact planning/assignment relationship, crew ownership, active records and
vessel scope are checked. The browser cannot submit replacement dates, rank or
matrix revision. The calculation and certificate evidence use one
repeatable-read, read-only database transaction.

Attachment metadata contains only filenames, IDs and existing protected raw
links, not stored paths or file data. Opening one performs an authenticated
fetch through the existing attachment ownership/permission checks, then opens
the returned blob.

The focused reader/endpoint suite passed **31 tests**, including refused
missing grants, out-of-scope vessel, orphan link, browser-supplied calculation
inputs and friendly unexpected failures. Table fingerprints and transaction
settings verify that the display read makes no domain writes.

## Registered main-preview fixture and actor

See [the retained manifest](training-compliance-slice-4-fixtures.json) and
[the acceptance register](company-form-regression-fixtures.md).

- Reuses the existing fixture-only vessel and dedicated PDF fixture seafarer.
- A new planned contract was created **once through normal Rotation Deploy**.
  The captured contract rank is **Chief Officer**, by identifier lineage.
- A fixture-only vessel rank configuration makes that position visible.
- Existing saved **R0** and its accepted equivalent are reused. No company-wide
  M/R cells or training matrix revisions are changed.
- Three D3 certificate rows and one small PDF attachment are retained.
- No vessel, seafarer, role or grant is created. The retained seafarer with
  protected vessel-02 records is not modified.
- The office development persona is **user 3, Crewing Manager**, parent role
  `408d9fe9-1d0f-11f1-925d-5419ffd80f01`. Existing Vessel, Crew Database,
  Planning and Rotation View/Edit grants are recorded in the manifest; no
  grants were added. This is the ordinary manager persona, not an all-grants
  administrator.
- Persona requests pass the same persisted permission, ownership and vessel
  checks. This is development-persona verification, **not parent sign-in**;
  normal parent authentication remains on the developers' production checklist.

Normal setup reruns only verify/reuse:
`node scripts/prepare-training-compliance-fixtures.mjs`.

An explicit `--reset-dates` resets only this registered fixture's reliever
joining/end fields for replay. It creates nothing. The browser journey then
saves its scenario dates through the real Planning screen and restores
**01-May-2027 / 6 months**.

## Browser evidence

`node scripts/verify-training-compliance.mjs`

The script clicks the normal screens. It does not supply API response fixtures,
call the compliance API directly or bypass authentication/authorization.
Only PATCHes to the registered Planning record are permitted; unexpected
business writes are refused. A single intentional network abort exercises the
failure/Retry state without manufacturing a server response.

| Screenshot | Saved scenario and evidence |
|---|---|
| `01-incomplete.png` | Own joining date absent; incomplete with the missing fact and Retry |
| `02-contract-end-not-set.png` | Joining 01-May-2027; end absent; complete check with the full-contract warning |
| `03-compliance-line.png` | Written Mandatory/Recommended states and coloured dots in Reliever Status |
| `04-valid-and-not-held.png` | Joining 01-May-2027, end 01-Nov-2027: AFF Valid; chemical tanker course explicitly Not held |
| `05-multiple-certificates.png` | Longer AFF certificate selected; shorter one remains visible; malformed-issue correction flag |
| `06-attachment-open.png` | The selected certificate's PDF opens in the browser viewer; protected GET 200, actual opened blob is a 970-byte PDF |
| `07-expires-during-contract.png` | Joining 01-Oct-2027, end 01-Apr-2028: AFF Expires during contract |
| `08-expired-at-joining.png` | Joining 01-Dec-2027: AFF Expired at joining |
| `09-no-expiry-equivalent.png` | Joining 01-Jan-2028: chemical tanker certificate has no expiry; AFF uses it as a named accepted equivalent |
| `10-failure-and-retry.png` | Intentional request failure: plain sentence and Retry, no cached clear state or raw error |
| `11-retry-recovered.png` | Retry obtains the actual saved-fixture result again |

Files and response observations are in `generated-artifacts/training-slice4/`.
The delivered self-contained screenshot gallery includes all eleven images.
Finite animations are completed for screenshots, not mistaken for transparent
dialogs. The actual opened PDF blob is verified, not a second API download.

## Slice 5 — recorded only

[The deferred policy](pre-joining-training-matrix-slice-5-policy.md) specifies
the per-tenant **Block mandatory courses expiring during contract** setting,
default **OFF**. OFF warns; ON blocks with the separate
**Override training compliance** permission. No setting, permission, override
or enforcement implementation is included here.

## Closing gates

The final full-suite, Company Forms and TypeScript results and main-process
chronology are recorded below after the coherent implementation is verified.
