# Privacy / Data-Safety Inventory — SAIL Crew Mobile App

Working inventory of what this app collects, for filling out Apple's App Privacy
questionnaire (App Store Connect) and Google Play's Data Safety form before submission.
Derived from the actual API surface (`server/v2/crew-app`) and mobile screens as of this
review — re-verify against the code if a new data field is added before resubmitting either
form, since both stores require accuracy and penalize drift.

## Data categories collected

| Category | Specific fields | Where it's collected | Linked to identity? | Used for | Shared with third parties? |
|---|---|---|---|---|---|
| **Contact info** | Name, email, mobile, address, country of residence | Profile (`personal`, `contact` sections) | Yes | App functionality (crew record) | No |
| **User IDs** | `crewUuid`, `empNo`, login identifier, `deviceId` | Auth (login, token issuance) | Yes | Authentication, session/device binding | No |
| **Sensitive PII** | DOB, gender, nationality, place of birth | Profile (`particulars`, `personal`) | Yes | App functionality (crew record) | No |
| **Government/travel documents** | Passport & travel document numbers, visas | `documents`, `visas` collections + attachments (scans/photos of the documents) | Yes | App functionality (compliance/travel record) | No |
| **Health data** | Pre-joining medical records, doctor visit records | `medicals`, `doctorVisits` collections + attachments | Yes | App functionality (fitness-for-duty record) | No |
| **Family/dependents info** | Next of kin, family info, children's records | `family`, `nextOfKin`, `children` collections | Yes (about the crew member and their dependents) | App functionality (emergency contact/benefits) | No |
| **Professional/employment records** | Education, licenses/certificates, training courses, sea-service history, vessel assignment | `education`, `licenses`, `training`, `sea-service`, `assignment` | Yes | App functionality (qualification/compliance record) | No |
| **Photos/files** | Uploaded document/certificate photos and PDFs (≤5MB, image or PDF) | `CrewAttachments` component, all collections' attachment endpoints | Yes | App functionality (evidence for the record above) | No |
| **Authentication data** | Password (hashed, never transmitted back), access/refresh tokens | Auth module | Yes | Authentication | No |
| **Diagnostics** | None currently — **no crash reporter is wired in yet** (see Tier 2 action item to add Sentry) | — | — | — | — |

## Notes for the actual store forms

- **No analytics, ads, or third-party SDKs currently integrated** — the only external calls are to this app's own backend (`server/v2/crew-app`). Both forms' "third-party sharing" sections should currently read "not shared," but re-check this the moment any analytics/crash-reporting SDK (e.g. Sentry) is added — most crash reporters count as a data recipient and need disclosing, even though they're not "sold" or used for advertising.
- **Health data (medicals, doctor visits) is present** — this is the category both stores scrutinize most. Apple's "Health & Fitness" data type and Google Play's "Health information" category both apply; expect additional review friction and make sure the in-app privacy policy link (required by both stores) explicitly covers this.
- **Data retention/deletion**: neither store form is fully answerable from the code alone — confirm with whoever owns data-retention policy whether crew members (or the company on their behalf) can request deletion, and how "not applicable, this is an employer-mandated employment record" is represented on each form (both stores have an option for this).
- **Encryption in transit**: confirm the production `EXPO_PUBLIC_API_BASE_URL` is `https://` before submission (tracked as action item S4) — both forms ask whether data is encrypted in transit.
- This table should be treated as a first draft to hand to whoever fills out the actual store consoles, not a substitute for someone reviewing the live production API surface at submission time.
