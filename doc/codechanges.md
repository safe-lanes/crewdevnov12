# Code Changes Prompt

Task: Generate a new changelog markdown file for the last fixed issue.

Requirements:

1. Navigate to folder: doc/changelog
2. Check existing files with naming pattern: changes<SerialNumber>.md
   Example:
   - changes1.md
   - changes2.md
   - changes3.md

3. Identify the highest existing serial number.
4. Auto-increment the serial number by +1.
5. Create a new file with name:
   changes<NextSerialNumber>.md

6. File content structure must be:

# Change Log – Issue <Short Issue Title>

## 1. Frontend Code Changes
- List all frontend changes here
- Mention files modified
- Mention logic updates

## 2. Backend Code Changes
- List backend updates
- Mention APIs modified
- Mention service or controller updates

## 3. Database Level Changes
- Schema updates
- New tables / columns added
- Modified columns
- Migration details
- Index changes (if any)

## Additional Notes
- Deployment notes (if any)
- Environment changes (if any)

Rules:
- If no changelog folder exists, create doc/changelog first.
- If no previous changes file exists, start with changes1.md.
- Ensure serial number increments correctly.
- Follow clean markdown formatting.
