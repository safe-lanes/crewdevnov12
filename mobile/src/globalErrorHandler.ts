// Catches JS exceptions ErrorBoundary can't see — event handlers, timers,
// promise callbacks. Without this, an uncaught throw outside render is
// silently invisible (no console output anywhere in this app previously)
// and, in production, crashes the app with no diagnostic trail.
// Import this once, for its side effect, before anything else runs.

declare const global: { ErrorUtils?: { setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void; getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void } };

export function installGlobalErrorHandler(): void {
  const ErrorUtils = global.ErrorUtils;
  if (!ErrorUtils) return;

  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error(`[GlobalError]${isFatal ? " (fatal)" : ""}`, error);
    defaultHandler(error, isFatal);
  });
}
