# Reports: Rest Hour Compliance Summary — Month Range Preservation Checklist

Recorded: 2026-09-29.

## Scope and status

This document saves the complete findings presented for **Reports → Rest Hour Compliance Summary → Month Range → From Month / To Month**, including how selected months reach the report.

This is a current-behaviour checklist, not approval to implement a replacement or fix existing issues. Saving this document changes no application behaviour. Existing issues must not be silently fixed during a selector replacement.

## 1. What these fields currently are

1. Both fields select a **month and year**, not an individual day.
2. They currently use the **browser’s built-in month input**, not the shared date selector.
3. They appear only after choosing **Month Range** inside the period filter.
4. The other option is **Year + Quarter/Month**.
5. The two fields are independent:
   - Changing **From Month** does not change **To Month**.
   - Changing **To Month** does not change **From Month**.

## 2. Initial values and displayed format

| Behaviour | From Month | To Month |
|---|---|---|
| Initial value when starting a fresh custom range | Empty | Empty |
| Empty placeholder | `MMM-YYYY` | `MMM-YYYY` |
| Example selected display | `Sep-2026` | `Nov-2026` |
| Actual browser-input value | `2026-09` | `2026-11` |
| Date stored internally | First day of the month | Last day of the month |

Additional rules:

6. The period filter initially opens in **Year + Quarter/Month** mode—not Month Range.
7. That other mode initially selects the **current year and current month**.
8. Switching to Month Range does **not** automatically copy that year/month into either field.
9. Before applying any period, the closed filter shows **`MMM-YYYY`**, even though the other mode internally defaults to the current month.
10. There is no “today” or “current month” default automatically inserted into either custom-range field.

## 3. What From Month means

11. Selecting a month sets the start to the **first day of that month**.

    **Example:** Selecting `Sep-2026` means `2026-09-01`.

12. The report includes the selected starting month.
13. All matching months after it remain eligible, unless To Month limits them.
14. Selecting From Month does not automatically fill, clear, or correct To Month.

## 4. What To Month means

15. Selecting a month sets the end to the **last day of that month**.

    | Selected month | Internal ending date |
    |---|---|
    | April 2026 | 30 April 2026 |
    | January 2026 | 31 January 2026 |
    | February 2026 | 28 February 2026 |
    | February 2028 | 29 February 2028 |

16. Normal month lengths and leap years are handled automatically.
17. The report includes the selected ending month.
18. Selecting To Month does not automatically fill, clear, or correct From Month.

**Important preservation rule:** Although the fields show only months, their underlying dates are deliberately different: **From = first day; To = last day.**

## 5. Clicking, typing, clearing, and keyboard behaviour

19. Each field shows a calendar icon.
20. The browser’s actual month input covers the field but is visually transparent. The visible month text is displayed separately.
21. Clicking the field attempts to open the browser’s month picker.
22. There is no separate custom month-calendar implementation here.
23. The exact picker appearance, keyboard editing, and any native clear control depend on the browser/device.
24. If the browser reports an empty value, the corresponding field is cleared internally and returns to `MMM-YYYY`.
25. Clearing one field does not clear the other.
26. There is no separate application-provided clear button beside each month.
27. There is no custom manual-text parser for these two fields.
28. There is no custom blur-time correction, invalid-draft restoration, or field-level error message.

**Browser limitation:** Not every native picker’s typing, cancellation, and clearing behaviour was verified. Those should not be treated as identical across browsers.

## 6. Required fields and allowed ranges

These are the current application rules:

| Situation | Current behaviour |
|---|---|
| Both fields empty | Allowed |
| Only From Month filled | Allowed |
| Only To Month filled | Allowed |
| Both fields filled | Allowed |
| Same month in both fields | Allowed |
| From Month later than To Month | Not blocked |
| Past months | No application restriction |
| Future months | No application restriction |
| Range crossing years | Allowed |
| Very long range | No application maximum |
| Restricting selection to months with report data | Not implemented |

29. Neither field is marked required.
30. Neither field has an application-defined minimum or maximum month.
31. Neither field changes its allowed range based on the other.
32. The four year buttons in **Year + Quarter/Month** do **not** restrict the custom Month Range.
33. The application does not define a supported year range for these month inputs.
34. The **Apply** button is not disabled because a field is blank or the range is reversed.
35. The **Generate** button is not disabled because a field is blank or the range is reversed.

**Important distinction:** The browser may reject certain month-input text itself. That is separate from application validation.

## 7. Apply versus Generate

There are two separate steps:

### Apply

36. Choosing a month changes a local, not-yet-applied selection.
37. **Apply** copies both current selections into the report’s filter.
38. Apply closes the period popover.
39. Apply does **not** run the report.
40. Apply does **not** automatically clear or refresh an already displayed report.

### Generate

41. **Generate** runs the report using the last **applied** filter.
42. Unapplied month edits do not become report filters automatically.
43. Generate is disabled while that report is already generating.
44. The month fields themselves are not disabled while the report is generating.
45. Changing the filter during generation does not change the request already sent.

**Practical consequence:** After changing and applying months, the old results can remain on screen until Generate is clicked again.

## 8. Closing, reopening, switching modes, and resetting

46. Closing the popover without Apply does not update the applied report filter.
47. Simply closing the popover does **not** explicitly discard its local edits. Reopening the same mounted filter can show those unapplied edits.
48. There is no dedicated **Cancel and discard changes** button.
49. Switching between Month Range and Year + Quarter/Month does not immediately erase the other mode’s local selections.
50. However, applying Year + Quarter/Month sends only that mode’s values. Once the component synchronises with that applied value, the custom From/To values are cleared.
51. Applying Month Range sends the two range dates—not the other mode’s selected year, quarter, or month.
52. Switching to another report and back retains this report’s **applied** filter and previous results while the Reports page remains mounted.
53. Unapplied edits are not part of that per-report saved state and are lost when the filter is unmounted, such as when switching reports.
54. These values are not saved permanently. Reloading the page or leaving and remounting Reports loses them.

### Reports → Clear

55. Clear removes **all filters for the selected report**, including its vessel selection and month range.
56. Clear also removes that report’s displayed results.
57. Clear recreates the filter with its initial defaults.
58. The closed period filter returns to `MMM-YYYY`.
59. Opening it returns to Year + Quarter/Month with the current year/month selected.
60. Switching to Month Range then shows two empty fields.
61. Clear does not automatically generate a new report.

## 9. How the applied selection is shown when the filter closes

62. If both months are present, the closed filter shows their **full boundary dates**, not just the month names.

    Example:
    - From Month: `Sep-2026`
    - To Month: `Nov-2026`
    - Closed filter: **`01/09/26 - 30/11/26`**

63. That summary uses a **two-digit year**.
64. If only one month is present, the closed filter shows **`MMM-YYYY`** instead of showing the selected endpoint.
65. If both are empty, it also shows `MMM-YYYY`.

**Existing display issue:** A one-sided filter can be active even though the closed filter looks empty.

## 10. What the report actually receives and includes

66. The browser sends ordinary date strings, such as:
    - `dateFrom: "2026-09-01"`
    - `dateTo: "2026-11-30"`
67. It does not send the displayed `Sep-2026` text.
68. It does not send a timestamp or UTC-converted date. It builds the date from the browser’s local year, month, and day.
69. Empty endpoints are omitted from the request.

| Applied values | Report meaning |
|---|---|
| Neither month | No month restriction |
| Only From Month | That month and later |
| Only To Month | That month and earlier |
| Both in normal order | Both endpoint months and the months between them |
| Same month | That one month |
| Reversed range | No matching rows under the current query |

70. The backend compares each stored report month as the **first day of that month**.
71. The comparisons include the boundaries: “on or after From” and “on or before To.”
72. Vessel filtering still applies alongside month filtering.
73. Deleted Rest Hours vessel records are excluded.
74. The range does not create empty rows for months without stored records.
75. Applying or generating this filter reads report data; it does not change the Rest Hours records.
76. Export uses the generated report results, not unapplied month edits.

### Server-side validation

77. Supplied dates must have the shape **`YYYY-MM-DD`**.
78. They must also represent real calendar dates.
79. Both dates remain optional on the server.
80. The server does not check that From is before or equal to To.
81. A server/request failure produces the general **“Failed to generate report”** notification, not an error beside the month field.

## 11. Existing issues and edge cases to record separately

These should **not be silently fixed as part of replacing the selector**.

### A. Missing range validation

- Empty, one-sided, and reversed ranges can all be applied.
- Reversed ranges produce no matching rows rather than a helpful validation message.
- There is no maximum range length.

These are current behaviours; whether to change them is a separate decision.

### B. Month inputs skip the existing invalid-date check

The same filter component already checks manual input in its **day-based Date Range** mode.

**That check does not run for Month Range.**

There is no equivalent application-level check preventing an incomplete or invalid month edit from reaching Apply. What happens to such an edit depends partly on the browser’s native input handling.

### C. Misleading closed-filter display

- One-sided ranges look empty.
- Two-sided ranges show days rather than months.
- Two-digit years can make unusual years ambiguous.

### D. Existing results can disagree with the newly displayed filter

Applying a new range does not regenerate the report. The displayed/exported data remains from the previous generation until Generate completes again.

### E. Native picker opening can fail silently

The code catches and ignores errors from opening the browser picker, including possible iframe restrictions.

There is no error message or application-provided replacement picker when this happens.

### F. Accessibility and keyboard visibility gaps

- The visible “From Month” and “To Month” labels are not explicitly connected to their inputs.
- The inputs have no explicit accessible-name attributes.
- Because the actual inputs are transparent, their usual focus outline and native editing feedback can be invisible.

### G. Very early years can change incorrectly

The existing JavaScript date creation treats years **0001–0099 as 1901–1999**.

For example, if the browser supplies January `0001`, the current conversion produces January **1901**.

This conversion was checked directly during the audit.

### H. Some year values can pass the picker but fail the report request

- Years **0100–0999** are not padded to four digits when the request is built.
- Years beyond **9999**, if accepted by the browser, produce more than four digits.
- The backend requires exactly four year digits.

Therefore, the picker and backend do not have fully matching year rules.

### I. No skipped-local-day protection

The month boundaries are created in the browser’s local timezone without checking whether JavaScript moved them to another date.

A concrete example:

- In the `Pacific/Kiritimati` timezone, **31 December 1994 did not exist**.
- Creating the end of December 1994 moves it to **1 January 1995**.
- That can change the displayed To Month and unintentionally include January in the report.

That conversion was checked directly. These month fields currently have **no protection against it**.

## 12. Main preservation boundary for the future replacement

The replacement must remain a **month-range filter**, even if it uses the shared date selector internally:

- **From Month means the whole starting month, beginning on day 1.**
- **To Month means the whole ending month, ending on its last day.**
- Selecting the same month must still represent that entire month.
- Apply and Generate must remain separate.
- Clear, report switching, request format, and existing result behaviour must remain accounted for.
- Adding requiredness, range-order checks, year limits, skipped-day protection, or changing the summary display would be **explicit behaviour changes**, not merely swapping the selector.

## Code reviewed

- `client/src/components/filters/PeriodFilter.tsx`
- `client/src/pages/ReportsPage.tsx`
- `client/src/components/ui/input.tsx`
- `client/src/components/ui/popover.tsx`
- `server/v2/reports/handlers/restHours.ts`
- `server/v2/reports/handlers/_shared.ts`

## Verification scope

This is a code-based audit, with direct checks of the unusual-year and skipped-day conversions. It is not a claim that every browser’s native month picker or every live report scenario has been tested.