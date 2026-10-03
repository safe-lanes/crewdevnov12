# SAIL Crew Mobile App Demo Guide

An end-to-end client demonstration of office credential provisioning, crew self-service, and office review of a crew-submitted change.

**Suggested duration:** 12-15 minutes  
**Presenters:** Office/crewing user, then crew member  
**Demo setup:** Office app open in a browser; SAIL Crew open on a phone, emulator, or web preview

## What You Will Demonstrate

1. An office user provisions mobile access from an active crew member's saved profile.
2. The system sends temporary sign-in instructions to the registered email address.
3. The crew member signs in, sets a personal password, and submits a profile change.
4. The change waits for office verification and is not yet part of the live crew record.
5. An authorized office reviewer compares the submitted change with the current value and approves it.
6. The change is published to the crew record and the crew member can see the result in the app.

## Prepare the Demo

- Use a non-production tenant and a dedicated, active demo crew member. The crew record must already be saved and have an employee number, first name, family name, and valid registered email address.
- Confirm the office presenter can open the crew record in **Crew Database** and has permission to create the mobile account.
- Confirm a reviewer can open **Crew Portal Submissions** and has permission to approve submissions.
- Prepare a unique test email inbox that can be opened during the demo, or verify the credential email was delivered in advance. Never put a real crew member's credentials on screen.
- Confirm the mobile app targets the intended API using `EXPO_PUBLIC_API_BASE_URL` for native or `EXPO_PUBLIC_API_BASE_URL_WEB` for web preview. A physical phone must be able to reach the API host; `localhost` usually refers to the phone itself.
- Choose a harmless, reversible change in a writable profile section, such as a demo address line or personal detail. Record the original value so the reviewer can show the before-and-after comparison.
- Confirm this tenant has office verification enabled for crew portal submissions. If verification is disabled, submissions are auto-published and there will be no pending item to approve.
- Keep credentials and personal data hidden in screenshots, recordings, and shared displays. Have a prepared backup crew account or screenshots in case email delivery or network access fails.

## Live Walkthrough

### 1. Office: open the saved crew profile | 1 minute

In the office web app, open **Crew Pool > Crew Database** and select the prepared active crew member. Verify the profile has a valid email address. Scroll to the **Mobile account** panel and show that no account has been provisioned yet.

**Say:** “Mobile access is provisioned from the crew member's existing, active record. We first confirm the employee details and registered email where the access instructions will be sent.”

### 2. Office: provision mobile access | 2 minutes

Select **Submit Application** and confirm the action. The system creates the crew credential and emails credential instructions to the registered address. Show the updated mobile-account status. If the email delivery fails, the panel exposes the failure and offers **Retry Email**; do not repeatedly submit new applications.

**Say:** “The office does not choose or view a permanent password. The system creates a temporary credential, sends setup instructions to the registered email, and requires the crew member to set a new password at first sign-in.”

Avoid displaying the temporary password on a shared screen. If email delivery cannot be shown live, use the already-delivered demo email or explain that this step sends it; do not claim delivery succeeded unless the panel confirms it.

### 3. Crew: first sign-in and password setup | 2 minutes

Open SAIL Crew on the device. Sign in using the employee number and temporary password from the demo email. At the first-login prompt, enter the temporary password, choose and confirm a new password, then continue to the app.

**Say:** “The employee number identifies the crew account. A first-time sign-in must replace the temporary password before the crew member reaches their workspace.”

### 4. Crew: submit a profile change | 2-3 minutes

From **Overview**, open **My Profile**. Choose the prepared writable section, change the agreed test value, and save. Return to the profile and show the **Awaiting crewing team review** status or **Recent submissions** entry.

**Say:** “The crew member can submit permitted updates from the app. With office verification enabled, the submission is staged for review; it has not changed the live crew record yet.”

Do not use sensitive or real personal data. If the chosen section is read-only or already has a pending change, use a different prepared section or demo account.

### 5. Office: compare and approve the submission | 3 minutes

Return to the office app and open **Crew Pool > Crew Portal Submissions**. Locate the submission for the demo crew member. Show the crew identity, section/action, submitted time, and the field comparison. For an update, the reviewer sees the previous value and proposed value. Select **Approve**.

**Say:** “The reviewer sees who submitted the change and what will change before deciding. Approval applies the submission to the crew database, so it becomes the current record.”

After approval, the item should disappear from the pending queue. Reopen or refresh the crew profile in **Crew Database** to confirm the new value is live.

### 6. Crew: confirm the outcome | 1 minute

Return to the mobile app and refresh or reopen **My Profile**. Show the updated value and, if visible, the recent submission outcome.

**Say:** “The workflow is complete: the crew member submitted the update, the office verified and approved it, and the published value is now visible back to the crew member.”

## Optional: Demonstrate Rejection

For a separate prepared submission, choose **Reject** in **Crew Portal Submissions**, enter a clear reason, and confirm rejection. Return to the crew app and show that the submission is marked **Not approved** with the reviewer reason. Explain that the crew member can correct the information and submit again. Avoid rejecting the main demo change if you also want to finish by showing a successful approval.

## Optional Mobile Tour

If time allows after the approval workflow, show **Documents & Visas**, **Training & Licenses**, **Sea Service**, **Notices**, and **Alerts**. Medical records, doctor visits, briefings, and debriefings are read-only in the app. The mobile app is crew self-service, not the office administration system.

## Demo Data Checklist

- [ ] Active, saved demo crew profile with employee number, first name, family name, and valid email
- [ ] Office user allowed to create crew mobile accounts
- [ ] Reviewer allowed to view and edit Crew Portal Submissions
- [ ] Demo inbox available and credential instructions received or ready to receive
- [ ] Crew app connected to the correct demo API
- [ ] Verification gate enabled for this tenant
- [ ] One writable profile section with an agreed harmless test change
- [ ] Original value recorded so the before-and-after review is clear
- [ ] Optional second change ready for rejection demonstration

## Troubleshooting

- **Submit Application is unavailable:** confirm the crew profile is saved, active, not terminated, has a valid email, and the office user has the required Crew Database permission.
- **Credential email failed:** check the mobile-account status and last error; use **Retry Email** after resolving the mail issue.
- **First sign-in fails:** confirm the employee number, temporary password from the latest email, and API/network settings. Reissued credentials invalidate the previous credentials.
- **Submission is not in the review queue:** confirm it saved successfully, check the correct crew member and section, and confirm office verification is enabled for the tenant.
- **No pending review item appears:** the tenant may have verification disabled, in which case submissions are auto-published; verify the tenant setting before presenting an approval step.
- **Approve is unavailable:** confirm the reviewer has edit permission for **Crew Portal Submissions**.
- **The crew profile still shows the old value:** refresh the office profile after approval and confirm the submission status changed to approved.

## Scope Notes

Credential provisioning creates an app account for an existing active crew profile; it does not create the crew employment record itself. Temporary credentials are generated by the system and emailed to the crew member. Crew changes are staged for office review when verification is enabled; if that tenant setting is disabled, changes are auto-published instead. Do not describe attendance, leave requests, payroll, or crew-side approval actions as mobile features.