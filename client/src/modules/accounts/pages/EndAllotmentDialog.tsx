import { useRef, useState, type FocusEventHandler } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FormattedDateInput,
  formatIsoDate,
} from "@/components/ui/formatted-date-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { accountsApiV2, parseApiError, type CashLockContext } from "../api/accountsApiV2";
import { formatDate } from "../accountsFormat";

interface EndAllotmentTarget {
  allotmentUuid: string;
  crewName?: string | null;
  beneficiaryName?: string | null;
  validFrom?: string | null;
  status: string;
}

interface EndAllotmentDialogProps {
  target: EndAllotmentTarget;
  lockContext: CashLockContext;
  mutationBlocked: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EndAllotmentDialog({
  target,
  lockContext,
  mutationBlocked,
  onClose,
  onSaved,
}: EndAllotmentDialogProps) {
  const { toast } = useToast();
  const [validTo, setValidTo] = useState("");
  const [draftValid, setDraftValid] = useState(true);
  const draftValidRef = useRef(true);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  const dateAllowed =
    !!validTo &&
    !!formatIsoDate(validTo) &&
    (!target.validFrom || validTo >= target.validFrom);

  const canConfirm = dateAllowed && draftValid && !saving && !mutationBlocked;

  const endedFrom = dateAllowed
    ? new Date(`${validTo}T00:00:00.000Z`)
    : null;

  if (endedFrom) {
    endedFrom.setUTCDate(endedFrom.getUTCDate() + 1);
  }

  // Preserve the existing Allotments calendar-selection handling.
  const handleBlurCapture: FocusEventHandler<HTMLDivElement> = (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "date") return;
    if (input.matches(":disabled") || !input.validity.valid) return;
    if (input.value === validTo) return;
    if (input.value !== "" && !formatIsoDate(input.value)) return;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const confirm = async () => {
    if (
      mutationBlocked ||
      savingRef.current ||
      !dateAllowed ||
      !draftValidRef.current
    ) return;

    savingRef.current = true;
    setSaving(true);

    try {
      const record: any = await accountsApiV2.allotments.end(
        target.allotmentUuid,
        validTo,
        lockContext,
      );

      toast({
        title:
          record.status === "ended"
            ? "Allotment ended"
            : "Allotment end date saved",
      });

      onSaved();
    } catch (err) {
      toast({
        title: "Action failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End allotment?</AlertDialogTitle>
          <AlertDialogDescription>
            Select the last date this allotment should apply for{" "}
            {target.crewName ?? "this crew"}, payable to{" "}
            {target.beneficiaryName}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <p className="text-sm">
            <span className="font-medium">Valid From:</span>{" "}
            {target.validFrom ? formatDate(target.validFrom) : "Not set"}
          </p>

          <div className="space-y-1">
            <Label>Valid To *</Label>
            <div onBlurCapture={handleBlurCapture}>
              <FormattedDateInput
                mode="date"
                value={validTo}
                onChange={(event) => setValidTo(event.target.value)}
                min={target.validFrom || undefined}
                minDateErrorMessage="Valid To cannot be earlier than Valid From."
                acceptCalendarInputEvents
                retainInvalidDraftOnBlur
                disabled={saving}
                onDraftValidityChange={(valid) => {
                  draftValidRef.current = valid;
                  setDraftValid(valid);
                }}
                data-testid="input-allotment-valid-to"
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            The selected date is inclusive. An active allotment remains
            applicable through that date.
          </p>

          {target.status === "suspended" && (
            <p className="text-sm text-muted-foreground">
              This allotment is suspended. Saving an end date will not
              reactivate it.
            </p>
          )}

          {dateAllowed && draftValid && endedFrom && (
            <div className="text-sm" aria-live="polite">
              <p>Last applicable day: {formatDate(validTo)}</p>
              <p>Ended from: {formatDate(endedFrom)}</p>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-end">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            disabled={!canConfirm}
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
            data-testid="button-confirm-end"
          >
            {saving ? "Saving…" : "Confirm End Date"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
