import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatIsoDate } from "@/components/ui/formatted-date-input";
import { ACCOUNTS_BASE, parseApiError } from "../api/accountsApiV2";

export const LOCKED_DATE_MESSAGE =
  "The Date that you entered lies inside the locked period, please select a different date";

export const LOCKED_DATE_INLINE =
  "The Date you selected lies inside the locked period";

export function useCashPeriodLock(vesselUuid: string, period: string) {
  const { toast } = useToast();
  const hasFilter = !!vesselUuid && !!period;

  const workspaceKey = [
    `${ACCOUNTS_BASE}/portage?vesselUuid=${vesselUuid}&period=${period}`,
  ];

  const periodsKey = [
    `${ACCOUNTS_BASE}/portage?vesselUuid=${vesselUuid}&lockedPeriodsOnly=true`,
  ];

  const workspace = useQuery<any>({
    queryKey: workspaceKey,
    enabled: hasFilter,
    refetchOnWindowFocus: "always",
  });

  const periods = useQuery<string[]>({
    queryKey: periodsKey,
    enabled: hasFilter,
    refetchOnWindowFocus: "always",
  });

  const isLocked =
    workspace.data?.portage?.status === "locked" ||
    !!workspace.data?.portage?.isLocked;

  const ready =
    hasFilter &&
    workspace.isSuccess &&
    periods.isSuccess &&
    !workspace.isError &&
    !periods.isError;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: workspaceKey });
    void queryClient.invalidateQueries({ queryKey: periodsKey });
  };

  const isDateBlocked = (value: string, original?: string | null) =>
    !!value &&
    value !== original &&
    !!formatIsoDate(value) &&
    !!periods.data?.includes(value.slice(0, 7));

  const showDateError = () => {
    toast({
      title: "Validation Error",
      description: LOCKED_DATE_MESSAGE,
      variant: "destructive",
    });
  };

  const handleServerError = (error: unknown, value?: string): boolean => {
    const parsed = parseApiError(error);

    if (parsed.data?.code === "LOCKED_DATE" && value) {
      const datePeriod = value.slice(0, 7);

      queryClient.setQueryData<string[]>(periodsKey, (old) =>
        Array.from(new Set([...(old ?? []), datePeriod])),
      );

      refresh();
      showDateError();
      return true;
    }

    if (parsed.data?.code === "PERIOD_LOCKED") refresh();

    return false;
  };

  return {
    isLocked,
    blocked: !ready || isLocked,
    calendarDisabledPeriods: periods.data ?? [],
    isDateBlocked,
    showDateError,
    handleServerError,
    notice: !hasFilter
      ? null
      : workspace.isError || periods.isError
        ? "Unable to check period locks. Changes are unavailable until the check succeeds."
        : !ready
          ? "Checking period locks…"
          : null,
  };
}
