# Training Matrix — Certificate expires impact report

Snapshot: **21-Oct-2026 (UTC)**. Existing calculation: **v1.5.0**, unchanged.
Source HEAD at analysis: **`50b08c1d5c52057c6a9f85b1669680fe1ff88718` — VERIFIED**. The report commit is reported separately after committing; a file cannot contain its own final commit hash.

## Fleet-wide totals

- Training courses: **78** (all non-deleted master courses).
- Active seafarer certificate records: **388**; linked to these courses: **321**; unlinked/ambiguous identifier: **67**; linked outside the active master list: **0**.
- Current on-board population evaluated: **26 assignments / 25 distinct seafarers**. No present-rank fallback.
- Incomplete assignment checks: **2**. Of these, **1** cannot be allocated to courses because no readable saved matrix provides the course list.
- Explicit No + recorded expiry contradictions: **1 course**.

| Matrix state | Distinct seafarer/course results |
|---|---:|
| Valid | 82 |
| Valid, no expiry | 0 |
| Expires during contract | 0 |
| Expired at joining | 2 |
| Not held | 238 |
| Expiry not recorded | 1 |
| Incomplete | 2 |
| **Total course/seafarer pairs** | **325** |

**Visible amber overlay:** 0 of the Valid results have the existing on-board “Expires within 2 months” warning with no planned relief. These stay Valid in the shared calculation; they are not an eighth state or counted twice. Total amber results including this overlay: **1**. Known red results: **240**. Grey results: **2**, plus 1 unallocatable incomplete checks.

**Interpretation:** these are review priorities, not proof that an expiry flag is wrong. “Not held” can reflect a missing, unlinked or future-issued certificate; changing the expiry flag cannot cure that gap. Incomplete checks here cite missing captured rank and/or a missing saved matrix, not an expiry-policy decision. The 67 unlinked/ambiguous D3 records cannot safely be attributed to a course by its name.

## Scope and reading the counts

- This is an impact snapshot, not a proposal to change flags and not a compliance enforcement run. It creates no checks, snapshots, suggestions or history.
- Certificate coverage uses all active D3 records belonging to non-deleted seafarers, including registered fixtures. Recruitment candidate records and deleted records are excluded. Certificate rows are counted, not deduplicated; a person can hold several certificates.
- State counts reproduce the live Vessel Training Matrix population: non-deleted OnBoard assignments without actual sign-off, on non-deleted vessels. Today is the server UTC civil date; end date comes only from exact assignment-linked planning. Planned/off-board seafarers are not assigned invented current ranks or matrix outcomes.
- Existing shared identifier resolution, saved vessel revision, accepted equivalents, longest qualifying certificate selection, inclusive expiry days and incomplete-check behavior are reused unchanged. Certificate counts belong to the certificate’s own course; a valid equivalent may satisfy another course.
- Each seafarer contributes at most one result to a course. Where multiple on-board assignments apply, aggregation chooses a known blocking gap first: Not held, Expired at joining, Incomplete, Expiry not recorded, Expires during contract, Valid, then Valid/no expiry. This only aggregates the report; it does not change either assignment’s calculation.
- An incomplete check makes its visible course cells Incomplete, as on the live matrix. If the captured rank is missing but the saved matrix course list is known, those visible cells are counted Incomplete: this does not assert that every course is required for that unknown rank. With no readable matrix, the check is counted separately, never fabricated across all 78 courses.
- M/R are active company rank cells (M=Mandatory, R=Recommended); both are shown if applicable. Optional means there is no active M/R cell; a course absent from the company matrix is stated explicitly. Blank rank cells are not requirements.
- Abbreviations come from the active company training records. “—” means none is stored there; no abbreviation is invented from the course name.
- Mandatory rank/vessel-type combinations are DISTINCT pairs across each vessel’s latest non-deleted saved matrix, joined to current active rank cells. Multiple vessels of one type do not inflate a pair. Unknown vessel type is reported separately, not guessed. These are observed configured combinations, not a vessel-type policy table.
- With expiry means a nonblank recorded value. Invalid values are flagged and excluded from earliest/latest dates; without expiry means null/blank, not proof of a permanent certificate. Dates are 01-Oct-2026 format.
- Sections are mutually exclusive in requested priority order: Blocking, then Noise, then remaining False-green, then everything else. Every contradiction is explicitly flagged in its row, including contradictions already in Sections 1 or 2. Empty sections are retained. Low impact does not certify a flag as correct.
- The requested “No + recorded expiry” contradiction is a review alert, not proof that the current calculator paints those certificates green: v1.5.0 still uses a valid recorded expiry when one exists. SC006 has no current M/R rank requirement and therefore no evaluated outcomes in this population.

## Incomplete check reasons

- 2 assignment checks: Contract rank was not recorded at Deploy. Record the contract rank and retry the check.
- 1 assignment checks: No saved training matrix is available for this vessel. Ask the office to publish one, then retry.
- Unreadable latest saved matrices: 0.

## Section 1 — Blocking risk (26 courses)

| Course ID | Course | Abbreviation | Certificate expires | Matrix | Mandatory rank/type pairs | Certificates | With expiry | Without expiry | Earliest expiry | Latest expiry | Valid | Valid, no expiry | Expires during contract | Expired at joining | Not held | Expiry not recorded | Incomplete | Review flags |
|---|---|---|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| SA003 | Elementary First Aid (EFA) | EFA | Yes | Mandatory | 69 | 4 | 3 | 1 | 08-Jul-2026 | 01-Jan-2028 | 1 | 0 | 0 | 0 | 22 | 0 | 0 | — |
| NG010 | SMS Training | — | Yes | Mandatory | 23 | 1 | 0 | 1 | — | — | 0 | 0 | 0 | 0 | 22 | 0 | 0 | — |
| SC008 | Basic Training for Chemical Tanker Cargo operations | — | Yes | Mandatory | 46 | 11 | 7 | 4 | 13-Oct-2026 | 03-Jan-2029 | 2 | 0 | 0 | 0 | 20 | 0 | 0 | — |
| SA009 | Medical First Aid | MFA | Yes | Mandatory | 34 | 8 | 2 | 6 | 05-Jan-2048 | 10-Dec-2055 | 0 | 0 | 0 | 0 | 19 | 0 | 0 | — |
| SA002 | Fire Prevention and Fire Fighting (FPFF) | FPFF | Yes | Mandatory | 69 | 11 | 8 | 3 | 22-Apr-2026 | 01-Jan-2030 | 5 | 0 | 0 | 0 | 18 | 0 | 0 | — |
| SA001 | Personal Survival Techniques (PST) | PST | Yes | Mandatory | 69 | 9 | 8 | 1 | 11-Feb-2026 | 01-Jan-2030 | 6 | 0 | 0 | 0 | 17 | 0 | 0 | — |
| SB002 | Security Training for Seafarers with Designated Security Duties (STSDSD) | STSDSD | Yes | Mandatory | 46 | 15 | 9 | 6 | 25-Sep-2026 | 10-Dec-2055 | 5 | 0 | 0 | 1 | 16 | 0 | 0 | — |
| SA008 | Proficiency in Fast Rescue Boats (PFRB) | PFRB | Yes | Mandatory | 24 | 3 | 2 | 1 | 01-Jan-2027 | 11-Feb-2030 | 1 | 0 | 0 | 0 | 12 | 0 | 0 | — |
| SA004 | Personal Safety and Social Responsibilities (PSSR) | PSSR | Yes | Mandatory | 46 | 16 | 13 | 3 | 07-May-2026 | 01-Jan-2030 | 11 | 0 | 0 | 0 | 11 | 0 | 0 | — |
| SA005 | Basic Safety Training | — | Yes | Mandatory | 23 | 13 | 12 | 1 | 10-Mar-2027 | 26-Dec-2029 | 11 | 0 | 0 | 0 | 11 | 0 | 0 | — |
| NG011 | ERP Training | — | Yes | Mandatory | 9 | 1 | 0 | 1 | — | — | 0 | 0 | 0 | 0 | 8 | 0 | 0 | — |
| SC004 | Advanced Training for Chemical Tanker Cargo Operations | ACT | Yes | Mandatory | 9 (+9 unknown-type rank cells) | 9 | 6 | 3 | 19-May-2026 | 18-Nov-2029 | 0 | 0 | 0 | 0 | 8 | 0 | 1 | — |
| MA001 | Safe Mooring Operations | SMO | Yes | Mandatory | 7 | 1 | 1 | 0 | 09-Oct-2028 | 09-Oct-2028 | 0 | 0 | 0 | 0 | 8 | 0 | 0 | — |
| SD004 | Deck Watchkeeping | — | Yes | Mandatory | 3 | 3 | 3 | 0 | 01-Jan-2027 | 10-May-2029 | 0 | 0 | 0 | 0 | 5 | 0 | 0 | — |
| NA002 | Incident Investigation & Root Cause Analysis | — | Yes | Mandatory | 8 | 3 | 2 | 1 | 17-Oct-2028 | 16-Oct-2029 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | — |
| NA003 | Risk Assessment and Management | — | Yes | Mandatory | 8 | 1 | 0 | 1 | — | — | 0 | 0 | 0 | 0 | 3 | 0 | 0 | — |
| SA011 | Maritime Resource Management | MRM | Yes | Mandatory | 4 | 2 | 1 | 1 | 05-Jun-2029 | 05-Jun-2029 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | — |
| SD003 | Ship Simulator and Bridge Teamwork | — | Yes | Mandatory | 4 | 1 | 0 | 1 | — | — | 0 | 0 | 0 | 0 | 3 | 0 | 0 | — |
| SA006 | Advanced Fire Fighting (AFF) | AFF | Yes | Mandatory | 22 (+11 unknown-type rank cells) | 21 | 18 | 3 | 26-Nov-2026 | 16-Dec-2030 | 7 | 0 | 0 | 0 | 2 | 0 | 1 | — |
| NA007 | Shipboard Safety Officer | SBSO | Yes | Mandatory; Recommended | 2 | 2 | 1 | 1 | 17-Oct-2028 | 17-Oct-2028 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | — |
| NG009 | International Cuisine Preparation | — | Yes | Mandatory | 2 | 0 | 0 | 0 | — | — | 0 | 0 | 0 | 0 | 2 | 0 | 0 | — |
| ND005 | ECDIS Type-Specific Training | — | Yes | Mandatory; Recommended | 4 | 7 | 5 | 2 | 01-Jan-2027 | 19-Feb-2030 | 3 | 0 | 0 | 0 | 1 | 0 | 0 | — |
| NE002 | Electronic Engine Control Systems (ME Engines) Familiarization | — | Yes | Mandatory | 3 | 4 | 4 | 0 | 10-Mar-2027 | 01-May-2028 | 2 | 0 | 0 | 0 | 1 | 0 | 0 | — |
| SE001 | Engine Watchkeeping | — | Yes | Mandatory | 3 | 3 | 3 | 0 | 10-Mar-2027 | 01-Jan-2029 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | — |
| NA008 | ISM Internal Auditor course | — | Yes | Mandatory | 2 | 1 | 0 | 1 | — | — | 0 | 0 | 0 | 0 | 1 | 0 | 0 | — |
| ND003 | Ship Handling and Manoeuvring | — | Yes | Mandatory | 2 | 2 | 1 | 1 | 18-Feb-2030 | 18-Feb-2030 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | — |

## Section 2 — Noise risk (1 courses)

| Course ID | Course | Abbreviation | Certificate expires | Matrix | Mandatory rank/type pairs | Certificates | With expiry | Without expiry | Earliest expiry | Latest expiry | Valid | Valid, no expiry | Expires during contract | Expired at joining | Not held | Expiry not recorded | Incomplete | Review flags |
|---|---|---|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| SB003 | Ship Security Officer (SSO) | SSO | Yes | Mandatory | 4 | 7 | 4 | 3 | 01-Jan-2027 | 10-Dec-2055 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | — |

## Section 3 — False-green risk (1 courses)

| Course ID | Course | Abbreviation | Certificate expires | Matrix | Mandatory rank/type pairs | Certificates | With expiry | Without expiry | Earliest expiry | Latest expiry | Valid | Valid, no expiry | Expires during contract | Expired at joining | Not held | Expiry not recorded | Incomplete | Review flags |
|---|---|---|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| SC006 | Liquid Cargo Handling Simulator | LCHS | No | Optional (no M/R cells) | 0 | 3 | 3 | 0 | 12-Oct-2027 | 29-Sep-2030 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **CONTRADICTION: No but expiry recorded** |

## Section 4 — Low impact (50 courses)

| Course ID | Course | Abbreviation | Certificate expires | Matrix | Mandatory rank/type pairs | Certificates | With expiry | Without expiry | Earliest expiry | Latest expiry | Valid | Valid, no expiry | Expires during contract | Expired at joining | Not held | Expiry not recorded | Incomplete | Review flags |
|---|---|---|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| SA007 | Proficiency in Survival Craft & Rescue Boats (PSCRB) | PSCRB | Yes | Mandatory | 22 | 15 | 12 | 3 | 07-Jul-2026 | 17-Feb-2030 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| SA010 | Medical Care | MC | Yes | Mandatory; Recommended | 4 | 12 | 10 | 2 | 13-Oct-2026 | 10-Dec-2055 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| SC003 | Advanced Training for Oil Tanker Cargo Operations | AOT | Yes | Optional (no M/R cells) | 0 | 11 | 8 | 3 | 18-Apr-2026 | 19-Nov-2029 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| SB001 | Security Awareness Training | SAT | Yes | Optional (no M/R cells) | 0 | 10 | 6 | 4 | 14-May-2026 | 10-Dec-2055 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| SD001 | Electronic Chart Display & Information System (ECDIS) – Generic | ECDISG | Yes | Mandatory | 8 | 8 | 6 | 2 | 18-Dec-2026 | 18-Feb-2030 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| SC002 | Basic Training for Liquefied Gas Tanker Cargo Operations | BGT | Yes | Optional (no M/R cells) | 0 | 8 | 8 | 0 | 01-Jan-2027 | 06-Jun-2030 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| SC005 | Advanced Training for Liquefied Gas Tanker Cargo Operations | AGT | Yes | Optional (no M/R cells) | 0 | 8 | 7 | 1 | 19-Oct-2027 | 01-Jan-2029 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NE001 | Engine Room Resource Management (ERM) | — | Yes | Mandatory | 4 | 7 | 7 | 0 | 01-Jan-2027 | 01-Jan-2030 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NG006 | Planned Maintenance System (PMS) Familiarization | — | Yes | Optional (no M/R cells) | 0 | 7 | 7 | 0 | 15-Apr-2027 | 01-Jan-2030 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| SC001 | Basic Training for Oil Tanker Cargo operations | BOT | Yes | Optional (no M/R cells) | 0 | 7 | 5 | 2 | 01-Jan-2027 | 03-Jan-2029 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| SD002 | High Voltage (HV) Safety Training(Marine HV Systems >1000V) | HVST | Yes | Mandatory | 14 | 5 | 5 | 0 | 01-Jan-2027 | 01-Jan-2030 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| ND002 | Bridge Team Management (BTM) | — | Yes | Optional (no M/R cells) | 0 | 5 | 4 | 1 | 01-Jan-2027 | 01-Jan-2029 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NF001 | Energy Efficiency & Emissions (EEXI/CII) Awareness | — | Yes | Optional (no M/R cells) | 0 | 5 | 5 | 0 | 01-Jan-2027 | 01-May-2028 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NF003 | Environment Compliance / MARPOL Course | — | Yes | Recommended | 0 | 5 | 4 | 1 | 30-Jul-2026 | 01-Jan-2030 | 3 | 0 | 0 | 1 | 18 | 0 | 0 | — |
| NC013 | Ballast Water Treatment System (BWTS) Training | — | Yes | Optional (no M/R cells) | 0 | 4 | 4 | 0 | 15-Apr-2027 | 17-Oct-2028 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| ND007 | Radar/ ARPA Operational Simulator | — | Yes | Optional (no M/R cells) | 0 | 4 | 3 | 1 | 01-Jan-2027 | 01-Jan-2029 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NG007 | Safety Management System Familiarization | — | Yes | Optional (no M/R cells) | 0 | 4 | 4 | 0 | 15-Apr-2027 | 16-Oct-2029 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| ND009 | Large Vessel Ship Handling Training | — | Yes | Mandatory | 2 | 3 | 2 | 1 | 28-Jun-2028 | 15-Oct-2029 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NA001 | Safety Officer Training | — | Yes | Optional (no M/R cells) | 0 | 3 | 2 | 1 | 01-Jan-2027 | 17-Oct-2028 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NA005 | Gas Detection & Atmosphere Testing | — | Yes | Optional (no M/R cells) | 0 | 3 | 3 | 0 | 01-Aug-2027 | 01-Jan-2030 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| ND001 | Bridge Resource Management (BRM) | — | Yes | Optional (no M/R cells) | 0 | 3 | 3 | 0 | 15-Jun-2027 | 01-Jan-2029 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NE003 | Automation & Alarm Management Simulator | — | Yes | Optional (no M/R cells) | 0 | 3 | 3 | 0 | 01-Jan-2028 | 01-Jan-2029 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NE004 | Fuel Changeover & Emissions Compliance Ops | — | Yes | Optional (no M/R cells) | 0 | 3 | 3 | 0 | 01-Jan-2028 | 01-Jan-2029 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NC010 | Ship-to-Ship (STS) Transfer Operations | — | Yes | Optional (no M/R cells) | 0 | 2 | 2 | 0 | 08-Jun-2027 | 17-Oct-2028 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| ND004 | Manned Model Ship-Handling Training (Advanced) | — | Yes | Optional (no M/R cells) | 0 | 2 | 2 | 0 | 01-Jan-2028 | 01-Jan-2028 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| SC007 | Ship's Cook & Galley Training | SCGT | Yes | Optional (no M/R cells) | 0 | 2 | 2 | 0 | 29-Oct-2026 | 16-Jun-2028 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NA006 | Advanced Welding & Cutting | — | Yes | Mandatory | 1 | 1 | 1 | 0 | 09-Sep-2027 | 09-Sep-2027 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NB001 | Cyber Security Awareness | — | Yes | Optional (no M/R cells) | 0 | 1 | 1 | 0 | 15-Jun-2027 | 15-Jun-2027 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NC004 | LPG Tanker Cargo & Ballast Handling Simulator | — | Yes | Optional (no M/R cells) | 0 | 1 | 1 | 0 | 05-Jun-2029 | 05-Jun-2029 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NC008 | Ballast Water Management Simulator | — | Yes | Optional (no M/R cells) | 0 | 1 | 1 | 0 | 06-Jun-2028 | 06-Jun-2028 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NC011 | Emergency Shutdown (ESD) System Training | — | Yes | Optional (no M/R cells) | 0 | 1 | 1 | 0 | 06-Jun-2028 | 06-Jun-2028 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NC012 | Crude Oil Washing (COW) Operations | — | Yes | Optional (no M/R cells) | 0 | 1 | 1 | 0 | 06-Feb-2030 | 06-Feb-2030 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| ND006 | COLREGS Refresher Training | — | Yes | Optional (no M/R cells) | 0 | 1 | 1 | 0 | 01-Jan-2029 | 01-Jan-2029 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| ND008 | Passage Planning | — | Yes | Optional (no M/R cells) | 0 | 1 | 1 | 0 | 01-Jan-2029 | 01-Jan-2029 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NG001 | Leadership and Teamwork (Operational Level) | — | Yes | Optional (no M/R cells) | 0 | 1 | 1 | 0 | 08-Jun-2027 | 08-Jun-2027 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NG002 | Leadership & Managerial Skills (Management Level) | — | Yes | Optional (no M/R cells) | 0 | 1 | 1 | 0 | 25-May-2027 | 25-May-2027 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NA004 | Enclosed Space Entry | — | Yes | Optional (no M/R cells) | 0 | 0 | 0 | 0 | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NC001 | Oil Tanker Cargo & Ballast Handling Simulator | — | Yes | Optional (no M/R cells) | 0 | 0 | 0 | 0 | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NC002 | Chemical Tanker Cargo Handling Simulator | — | Yes | Optional (no M/R cells) | 0 | 0 | 0 | 0 | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NC003 | LNG Tanker Cargo & Ballast Handling Simulator | — | Yes | Optional (no M/R cells) | 0 | 0 | 0 | 0 | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NC005 | Bulk Carrier Ballast & Stress Simulator | — | Yes | Optional / not in company matrix | 0 | 0 | 0 | 0 | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NC006 | Container Ship Stability & Ballast Simulator | — | Yes | Optional / not in company matrix | 0 | 0 | 0 | 0 | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NC007 | General Cargo Ship Ballast & Stability Simulator | — | Yes | Optional / not in company matrix | 0 | 0 | 0 | 0 | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NC009 | Integrated Cargo & Ballast Emergency Simulator | — | Yes | Optional (no M/R cells) | 0 | 0 | 0 | 0 | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NC014 | Cranes & Cargo Gear Operator Training | — | Yes | Optional (no M/R cells) | 0 | 0 | 0 | 0 | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NF002 | Volatile Organic Compounds (VOC) Management | — | Yes | Optional (no M/R cells) | 0 | 0 | 0 | 0 | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NG003 | Vetting & SIRE Inspection Familiarisation | — | Yes | Optional (no M/R cells) | 0 | 0 | 0 | 0 | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NG004 | Media Response & Crisis Communications | — | Yes | Optional (no M/R cells) | 0 | 0 | 0 | 0 | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NG005 | Train-the-Trainer (Instructor Training) | — | Yes | Optional (no M/R cells) | 0 | 0 | 0 | 0 | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| NG008 | Human factors & Error Management | — | Yes | Optional (no M/R cells) | 0 | 0 | 0 | 0 | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |

## Verification and provenance

**(a) No writes to any table by this report: VERIFIED.** All database work used one PostgreSQL-enforced `REPEATABLE READ READ ONLY` transaction, read-only at both ends, then ROLLBACK. A local query guard also refused every statement other than SELECT and those transaction boundaries. No application endpoints, migrations, fixture helpers or setters were invoked.
Database identity: `heliumdb`, database OID `16384`, cluster system identifier `7586633721581772821`. This is DATABASE_URL and differs by cluster/OID from THE registered test database (sail_automated_tests / OID 1144979); it is not sail_automated_tests.
SELECT/transaction statements observed: **564**. Ordered SQL-text transcript SHA-256: `a037f0e371145c2c86fba73be409a14ecfee92f3e7b62464b55447335b208af6`. This fingerprints the queries, not the database contents; it is not a claim that concurrent users could not write.
**(b) HEAD: VERIFIED — `50b08c1d5c52057c6a9f85b1669680fe1ff88718` at analysis.** Generated at 2026-10-21T14:49:29.070Z.
The required full-suite gate runs separately against the registered isolated test database; its normal test fixture writes are not report writes and do not target the development database.
No schema, master flag, matrix calculation, rank, certificate, assignment, planning or permission changes. This document is the only tracked change for the analysis.

## Standing gates

- Fresh full suite on the registered isolated test database: **1,638 passed / 162 failed / 67 pending**. No new failures compared with the slice 7 baseline; the full suite is not green.
- Company Forms: **661 passed in 97 suites**, zero skipped, pending or failed.
- TypeScript: **222 diagnostics**. Application source is unchanged.
- Final report commit/time and the subsequent backend start/time are reported in the completion message. Raw console output and gate evidence are outside git in `generated-artifacts/certificate-expires-impact/`.
