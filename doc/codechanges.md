# Code Changes Prompt

Task: Generate a new changelog markdown file for the last fixed issue.

## Fork Detection

1. Extract the fork name from the Replit team URL.
   The URL pattern is:
   ```
   https://replit.com/t/<team>/repls/<forkname>
   ```
   The fork name is the last segment of the URL path.
   Example: `https://replit.com/t/safe-lanes/repls/upgradedcrewingarchitecturev2`
   → fork name = `upgradedcrewingarchitecturev2`

2. Use this fork name for the changelog directory path:
   ```
   doc/<forkname>/changelog/
   ```

## Requirements

1. Detect the fork name from the Replit team URL (last segment of the URL path).
2. Navigate to folder: `doc/<forkname>/changelog/`
3. Check existing files with naming pattern: `changes<SerialNumber>.md`
   Example:
   - changes1.md
   - changes2.md
   - changes3.md

4. Identify the highest existing serial number.
5. Auto-increment the serial number by +1.
6. Create a new file with name:
   `changes<NextSerialNumber>.md`

## File Content Structure

```markdown
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
```

## Directory Structure Example

```
doc/
  upgradedcrewingarchitecturev2/
    changelog/
      changes1.md
      changes2.md
      changes3.md
  anotherForkName/
    changelog/
      changes1.md
      changes2.md
```

Each fork maintains its own isolated changelog directory with independent numbering.

## Rules

- Detect fork name from the Replit team URL (last segment of the path).
- If the fork directory does not exist, create `doc/<forkname>/changelog/` first.
- If no previous changes file exists for that fork, start with `changes1.md`.
- Ensure serial number increments correctly per fork.
- Follow clean markdown formatting.
- Each fork's changelog numbering is independent of other forks.
