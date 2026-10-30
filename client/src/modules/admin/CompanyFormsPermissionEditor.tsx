import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, ChevronDown } from "lucide-react";
import { COMPANY_FORM_PERMISSIONS, type CompanyFormGrants } from "@shared/v2/admin/companyFormPermissions";

const ACTION_HELP: Record<(typeof COMPANY_FORM_PERMISSIONS)[number]["action"], string> = {
  view: "Allows this role to view Company Forms.",
  fill_in: "Allows this role to fill in Company Forms.",
  witness: "Records a seafarer’s signature on their behalf, with the acting user’s own identity recorded as the witness.",
  sign_representative: "Allows an office user to sign a Company Form in the company representative role.",
  void: "Allows this role to void a Company Form that has not been completed.",
  void_completed: "Allows this role to void a Company Form that has already been completed.",
  override_checklist: "Allows this role to override unresolved mandatory or failed/pending checklist checks. It does not allow overriding unfinished required forms.",
};

function ActionHelp({ action, label }: { action: keyof typeof ACTION_HELP; label: string }) {
  const helpId = `company-form-help-${action}`;
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Help: ${label}`}
              aria-describedby={helpId}
              onClick={event => event.stopPropagation()}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#16569e] hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16569e]"
            >
              <Info aria-hidden="true" className="h-4 w-4" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-sm leading-5">{ACTION_HELP[action]}</TooltipContent>
      </Tooltip>
      <PopoverContent id={helpId} side="top" className="w-72 text-sm leading-5">
        {ACTION_HELP[action]}
      </PopoverContent>
    </Popover>
  );
}

export function CompanyFormsPermissionEditor({
  grants,
  onChange,
  disabled = false,
}: {
  grants: CompanyFormGrants;
  onChange: (grants: CompanyFormGrants) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => COMPANY_FORM_PERMISSIONS.filter(({ action }) => grants[action]),
    [grants],
  );
  const summary = selected.length === 0
    ? "None selected"
    : selected.length === COMPANY_FORM_PERMISSIONS.length
      ? "All 7 permissions"
      : `${selected.slice(0, 3).map(({ label }) => label).join(", ")}${selected.length > 3 ? ` +${selected.length - 3}` : ""}`;

  return (
    <div className="col-span-4 min-w-0 py-1.5">
      <Popover open={open} onOpenChange={nextOpen => !disabled && setOpen(nextOpen)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Company Forms permissions"
            aria-haspopup="dialog"
            aria-expanded={open}
            className="flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-800 shadow-sm transition-colors hover:border-[#16569e] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16569e] disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="company-form-permissions-trigger"
          >
            <span className="truncate" title={summary}>{summary}</span>
            <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          collisionPadding={12}
          className="z-50 w-[min(25rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] p-2"
          data-testid="company-form-grant-action"
        >
          <div className="mb-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Company Forms permissions
          </div>
          <TooltipProvider delayDuration={250}>
            <div role="group" aria-label="Company Forms permissions" className="space-y-0.5">
              {COMPANY_FORM_PERMISSIONS.map(({ action, label }) => {
                const controlId = `company-form-grant-${action}`;
                return (
                  <div key={action} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50">
                    <Checkbox
                      id={controlId}
                      checked={grants[action]}
                      disabled={disabled}
                      data-testid={`company-form-grant-${action}`}
                      onCheckedChange={value => onChange({ ...grants, [action]: value === true })}
                    />
                    <label htmlFor={controlId} className="min-w-0 flex-1 cursor-pointer py-1 text-sm leading-5 text-slate-800">
                      {label}
                    </label>
                    <ActionHelp action={action} label={label} />
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        </PopoverContent>
      </Popover>
    </div>
  );
}
