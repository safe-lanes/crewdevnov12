# User Manual — Importing Crew Members and Their Documents

**Who is this for?** Anyone who needs to add multiple crew members into SAIL Crewing at once, along with their supporting documents (passports, certificates, medical records, etc.).

**How long does it take?** The import happens in two separate steps. Step 1 loads the crew data. Step 2 uploads the actual document files. You can do Step 1 today and Step 2 later — they are independent.

---

## Tips Before You Start

Read these before doing anything else.

| Topic | What you need to know |
|---|---|
| **Template** | Always use the official SAIL template. Do not use your own spreadsheet format. |
| **File types for attachments** | Only **PDF**, **PNG**, and **JPEG (.jpg)** files are accepted. Word documents (.docx), Excel files (.xlsx), and other formats will be rejected. |
| **File size limit** | Each individual attachment file must be **5 MB or smaller**. Larger files must be compressed or re-scanned at a lower resolution. |
| **ZIP format** | All attachment files must be packed into a single ZIP archive with a specific folder structure (explained in Step 2). |
| **Employee IDs must match** | The Employee ID you use in the template and in your ZIP folder names must be an exact match — same spelling, same capitalisation. |

---

## Part 1 — Importing Crew Data from Excel

### Step 1 — Open the Import Window

1. Go to the **Crew Pool** section of SAIL Crewing.
2. Look for the **Import** button (usually in the top-right area of the crew list page).
3. Click it. A popup window will appear titled **"Import Crew Members"**.

> You will see two tabs at the top of the popup: **Crew Data** and **Attachments**. Make sure **Crew Data** is selected (it is selected by default).

---

### Step 2 — Download the Template

> Skip this step if you already have a filled-in template from a previous import.

1. Inside the popup, look for a green section that says **"Need the template?"**.
2. Click the **Template** button on the right side of that section.
3. A file called `SAIL_Crew_Import_Template.xlsx` will download to your computer.
4. Open it in Microsoft Excel or Google Sheets.

---

### Step 3 — Fill in the Template

The template has multiple sheets (tabs at the bottom of the spreadsheet). Each sheet covers a different type of information. You only need to fill in the sheets that are relevant to your crew.

| Sheet name | What goes here |
|---|---|
| **Crew Members** | Basic details: name, Employee ID, nationality, rank, date of birth, etc. This sheet is **required** — every other sheet links back to it. |
| **Children Details** | Children's names and dates of birth. |
| **Emergency Contacts** | Next-of-kin details. |
| **Travel Documents** | Passports, seaman's books, and other identity documents. |
| **Travel Visas** | Visa details per country. |
| **Licenses & COCs** | STCW certificates, endorsements, and other licences. |
| **Sea Service History** | Previous vessel experience. |
| **Training Courses** | Completed training courses and certificates. |
| **Education Details** | Academic qualifications. |
| **Pre-Joining Medicals** | Medical fitness certificates. |
| **Doctor Visits** | Records of on-board or port medical consultations. |
| **Briefings** | Sign-on briefing records. |
| **De-briefings** | Sign-off de-briefing records. |

**Important rules when filling in the template:**

- Do not add, remove, or rename any columns.
- Do not change the sheet names.
- Do not leave the **Employee ID** column blank on any sheet — this is how the system links all the sheets together.
- The **Attachment Ref** column (where it appears) is filled in automatically during import — you do not need to enter anything there yourself.
- Date fields must be entered in the format shown in the column header (e.g. `DD-MMM-YYYY` means `15-Jan-2024`).
- Dropdown columns (where the cell shows a list when you click) must use exactly one of the values from the list.

---

### Step 4 — Upload Your Filled Template

1. Go back to the Import popup in SAIL Crewing.
2. Click the **upload area** (the dashed box that says "Upload a file or drag and drop").
3. Select your filled-in `.xlsx` file from your computer.
4. You will see the file name appear with its size shown below.

---

### Step 5 — Validate the File

1. Click the **Validate File** button (appears in the bottom-right of the popup after you select a file).
2. Wait a few seconds. You will see a spinning indicator while the system checks your file.

**If validation passes — green screen:**

> You will see a green panel with a tick and the message "Validation Successful!" along with a count of records found in each sheet (e.g. 45 Crew Members, 120 Travel Documents, etc.).

Review the counts to make sure they look correct, then go to Step 6.

**If validation fails — red screen:**

> You will see a red panel listing the number of errors found.

1. Click **Download Error Report** to get an Excel file that highlights exactly which cells have problems and why.
2. Open the error report, fix each highlighted cell in your original template, save it, then upload it again and re-validate.
3. Repeat until validation passes.

Common reasons for validation errors:
- A required field is blank.
- A value in a dropdown column does not match any option in the list.
- A date is in the wrong format.
- An Employee ID in one sheet does not match any Employee ID in the Crew Members sheet.

---

### Step 6 — Confirm the Import

1. Once validation shows the green success screen, click **Confirm Import**.
2. You will see a spinning indicator while the data is saved.
3. When finished, a success screen appears showing how many records were imported per category.

> The crew members and all their linked data are now in the system. You can close the popup. If you have document files to attach, continue to Part 2.

---

## Part 2 — Uploading Attachment Files (Documents, Certificates, Photos)

Attachments are the actual files — scanned passports, certificate images, medical reports, etc. — that belong to the records you imported in Part 1.

### Step 1 — Understand What You Need

Before preparing your files, you need two pieces of information for each document:

1. **Employee ID** — the same ID used in the import template (e.g. `EMP-001`).
2. **Attachment Ref** — a short code that was automatically assigned to each record during the Part 1 import (e.g. `EMP-001-D1` for the first document of employee EMP-001). You can find these codes by viewing the imported records inside SAIL Crewing, or by looking at the template's Attachment Ref column after import.

---

### Step 2 — Organise Your Files into the Correct Folder Structure

The system identifies which file belongs to which record by reading the folder names inside the ZIP. The structure must be exactly as follows:

```
EmployeeID/
  AttachmentRef/
    your-file.pdf
```

**Example with multiple crew members and documents:**

```
EMP-001/
  EMP-001-D1/
    passport.pdf
  EMP-001-L1/
    stcw-certificate.jpg
  EMP-001-L2/
    medical-fitness.pdf
EMP-002/
  EMP-002-D1/
    seaman-book.pdf
  EMP-002-V1/
    singapore-visa.jpg
```

**Rules for file and folder names:**

- The top-level folder name must be the **Employee ID** exactly (e.g. `EMP-001`).
- The second-level folder name must be the **Attachment Ref** exactly (e.g. `EMP-001-D1`).
- The file name inside can be anything descriptive (e.g. `passport.pdf`).
- Only **PDF**, **PNG**, and **JPEG (.jpg or .jpeg)** files are accepted.
- Each file must be **5 MB or smaller**.
- You can have multiple files inside one Attachment Ref folder if there are several pages.

> **Tip:** On Windows, you can create this folder structure in File Explorer. On Mac, use Finder. Just create the folders and copy the files in.

---

### Step 3 — Create the ZIP File

Once your folders are arranged correctly, compress them into a single ZIP file.

**On Windows:**
1. Select all the Employee ID folders (e.g. `EMP-001`, `EMP-002`, etc.).
2. Right-click → **Compress to ZIP file** (Windows 11) or **Send to → Compressed (zipped) folder** (Windows 10).

**On Mac:**
1. Select all the Employee ID folders.
2. Right-click → **Compress Items**.

The result will be a single `.zip` file. This is what you will upload.

---

### Step 4 — Upload the ZIP

1. Open the Import popup in SAIL Crewing (same button as Part 1).
2. Click the **Attachments** tab at the top of the popup.
3. Click the upload area and select your `.zip` file.
4. Once selected, click **Upload Attachments**.
5. A progress bar will show how much has been uploaded.
6. Wait for the system to finish processing.

> Large ZIP files with many documents may take a minute or two. Do not close the popup while it is running.

---

### Step 5 — Review the Results

When processing is complete, you will see a summary with four counts:

| Count | Meaning |
|---|---|
| **Files Attached** | Documents successfully saved and linked to their records. |
| **Skipped** | Files that could not be processed (see below for why). |
| **Records Covered** | Number of individual records that received at least one file. |
| **Crew Covered** | Number of crew members whose records received at least one file. |

If the **Skipped** count is greater than zero, a list of skipped files appears below the counts. Each entry shows:

- A **coloured badge** indicating the type of problem (e.g. blue = Duplicate, red = Invalid Extension).
- The **file path** inside the ZIP where the problem file was found.
- A **reason** explaining exactly what went wrong.

---

### Step 6 — Download the Skip Report (if needed)

If you have many skipped files and want to review them all in a spreadsheet:

1. Click the **Download report** button (appears next to the "X files skipped" heading).
2. A CSV file will download. Open it in Excel.
3. The file has three columns: **Category**, **File Path**, and **Reason**.
4. You can use Excel's filter feature on the **Category** column to group problems by type and fix them in batches.

After fixing your files, re-ZIP only the ones that were skipped and upload again. Already-uploaded files will be detected as duplicates and safely skipped — nothing will be duplicated.

---

## Common Problems and How to Fix Them

| Problem (Category) | What it means | What to do |
|---|---|---|
| **Invalid Extension** | The file is a Word document, Excel file, or other unsupported type | Convert the file to PDF. In Word: File → Save As → PDF. |
| **Oversized** | The file is larger than 5 MB | Reduce the file size. In Adobe Acrobat: File → Compress PDF. For photos, re-scan at a lower resolution (150 DPI is usually sufficient). |
| **No Match** | The Employee ID or Attachment Ref folder name does not match any record in the system | Check that the folder name is spelled correctly and matches the record exactly. Check for extra spaces or wrong capitalisation. |
| **Ambiguous Ref** | The same Attachment Ref code appears on more than one record for the same crew member | Contact your data administrator to resolve the duplicate in the system, then re-upload. |
| **Duplicate** | This exact file name is already attached to this record from a previous upload | No action needed — the file is already there. |
| **Invalid Path** | The ZIP folder structure is not in the correct `EmployeeID / AttachmentRef / file` format | Check that you have at least two levels of folders before the file. Do not place files directly in the ZIP root. |
| **Read Error** | The file inside the ZIP could not be opened — it may be corrupted | Try re-downloading or re-scanning the original file, then re-ZIP and re-upload. |
| **Store Error** | A technical error occurred while saving the file | Try uploading again. If the problem persists, contact your system administrator. |

---

## Frequently Asked Questions

**Can I re-upload the same ZIP if some files were skipped?**
Yes. Files that were already successfully uploaded will be automatically skipped as duplicates. Only the files that were previously skipped will be processed again.

**Do I have to upload attachments right after importing crew data?**
No. You can import the crew data today and upload attachments days or weeks later. The records stay in the system waiting for their files.

**What if I made a mistake in the template and need to re-import?**
Re-importing will update existing records if the Employee ID already exists. Contact your administrator before re-importing to confirm the expected behaviour for your organisation.

**Can I upload attachments for one crew member at a time instead of in a bulk ZIP?**
Yes. Individual files can be attached directly from each crew member's profile page inside SAIL Crewing — you do not have to use the bulk ZIP method for small numbers of files.

**The import window closes when I press Escape or click outside — what do I do?**
The import window is designed to stay open even if you accidentally press Escape or click elsewhere. Use the **Cancel** or **Close** button inside the window to close it safely.

---

*Last updated: July 2026 — SAIL Crewing v2*
