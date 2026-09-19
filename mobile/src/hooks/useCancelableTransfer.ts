import { useCallback, useEffect, useMemo, useRef } from "react";

export interface TransferHandle {
  /** False once a newer transfer has superseded this one, or the component has unmounted. */
  isCurrent: () => boolean;
  /** Registers (or clears) the function that actually aborts the underlying work — XHR.abort(), resumable.pauseAsync(), AbortController.abort(), etc. */
  setCancel: (fn: (() => void) | null) => void;
  /** Call in a finally{} once this transfer's own work is done (success or failure). */
  finish: () => void;
}

export interface CancelableTransfer {
  isBusy: () => boolean;
  isMounted: () => boolean;
  /** Claims the single in-flight-transfer slot, or returns null if one is already running. `onCancelled` fires if cancel() is called while this transfer is current. */
  begin: (onCancelled: () => void) => TransferHandle | null;
  /** For a simple, non-cancelable, lock-guarded action (e.g. delete) that doesn't need the operationId/cancel machinery below. */
  withLock: (fn: () => Promise<void>) => Promise<void>;
  cancel: () => void;
}

/**
 * At most one cancelable transfer in flight at a time, safe against state
 * updates after unmount or after a newer transfer has superseded an older
 * one — the bookkeeping CrewAttachments' upload and download flows each
 * used to hand-roll nearly identically.
 */
export function useCancelableTransfer(): CancelableTransfer {
  const transferLock = useRef(false);
  const operationId = useRef(0);
  const mounted = useRef(true);
  const cancelCurrent = useRef<null | (() => void)>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelCurrent.current?.();
      operationId.current += 1;
      cancelCurrent.current = null;
      transferLock.current = false;
    };
  }, []);

  const isBusy = useCallback(() => transferLock.current, []);
  const isMounted = useCallback(() => mounted.current, []);

  const begin = useCallback((onCancelled: () => void): TransferHandle | null => {
    if (transferLock.current) return null;
    transferLock.current = true;
    const thisOperation = ++operationId.current;
    let cancelUnderlying: (() => void) | null = null;
    cancelCurrent.current = () => {
      if (operationId.current !== thisOperation) return;
      operationId.current += 1;
      cancelUnderlying?.();
      cancelCurrent.current = null;
      transferLock.current = false;
      if (mounted.current) onCancelled();
    };
    return {
      isCurrent: () => operationId.current === thisOperation && mounted.current,
      setCancel: (fn) => { cancelUnderlying = fn; },
      finish: () => {
        if (operationId.current === thisOperation) {
          cancelCurrent.current = null;
          transferLock.current = false;
        }
      },
    };
  }, []);

  const withLock = useCallback(async (fn: () => Promise<void>): Promise<void> => {
    if (transferLock.current) return;
    transferLock.current = true;
    try {
      await fn();
    } finally {
      transferLock.current = false;
    }
  }, []);

  const cancel = useCallback(() => cancelCurrent.current?.(), []);

  return useMemo(
    () => ({ isBusy, isMounted, begin, withLock, cancel }),
    [isBusy, isMounted, begin, withLock, cancel],
  );
}
