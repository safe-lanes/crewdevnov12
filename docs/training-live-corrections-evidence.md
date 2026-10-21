# Pre-slice-6 live-test corrections

## 1. Certificate expiry policy

There was no expiry classification in the training master. Added
`Certificate expires: Yes/No` to Admin create/edit, including default courses.
New/existing courses default Yes as a conservative policy: an undated certificate
must not imply permanent validity. Admin must explicitly choose No for a
non-expiring course. This is a new policy default, not a claim that old records
contained that fact. Existing certificate dates are not rewritten.

Calculation 1.3.0 adds amber `Expiry not recorded` with the D3 correction action.
Accepted equivalents use their own course's expiry classification. Known valid
dated evidence beats an undated expiring certificate; an undated certificate
does not become infinite validity. Explicit No retains `Valid, no expiry`.
Issue-date and invalid-expiry handling otherwise remain unchanged.

Independent tenant setting `Block when a mandatory certificate's expiry is not
recorded` defaults OFF. Only Access Control management can change it; server
audit records identity/time/before/after. OFF warns; ON blocks mandatory results
with this state, overridable only through the independent training permission.
Recommended courses never block. A save from an older client omitting the new
setting preserves its value rather than resetting it.

Read-only main database count on 21-Oct-2026: **75** active D3 rows on
non-deleted crew have missing/blank expiry; **68**, belonging to **11** seafarers,
link unambiguously by identifiers to an active master and are affected by the
new Yes default. **7** are unlinked/ambiguous and were not name-matched or silently
classified. These counts include registered fixtures and describe certificate
records, not the number of mandatory deployment blockers. No certificate dates
or real crew records were changed to produce the count.

Focused initial checks: 122 passed; expanded isolated reader/setting integration
coverage: 40 passed, including default, management denial, forged identity,
server-derived audit, tenant isolation and explicit No.

Supporting display changes also consume the new amber state and improve the
missing-end/action-count wording; canonical contract-period fallback follows in
the next separate commit.

## 2. Contract end and visible gaps

Canonical input now reads only `reliever_contract_period_months`, alongside
the reliever's own range and joining date. A present range-end value wins;
only its absence permits the own-period fallback. Invalid explicit ranges
are not hidden by a valid period. Calendar addition still clamps to month end.
Calculation is bumped again to **1.4.0** because end-date semantics changed.
The end records its source, shown as “based on contract period” when applicable.
Both missing displays the requested Contract End Range instruction.

Fault found in presentation: the indicator used total requirement count as
though it counted action-needed courses. It now derives actual problem counts
from course results; missing end does not erase Not held/Expired at joining
or missing-expiry states. Backend joining-date states were already retained.
The isolated reader test explicitly sets incumbent/shared values while leaving
both reliever lengths blank and proves no fallback to either shared value.
