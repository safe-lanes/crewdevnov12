// Host-side glue for the shared SAIL chat widget (copied from the widget's crewing-react example).
import { useEffect, useRef } from "react";
import type { SailAssistantContext, SailAssistantHandle } from "@/lib/sailAssistant";

export function useSailAssistant(opts: {
  assistantUrl: string;
  module: string;
  getToken: (r: { forceRefresh: boolean; signal: AbortSignal }) => Promise<string>;
  context: SailAssistantContext;
  enabled: boolean;
  title?: string;
}) {
  const handle = useRef<SailAssistantHandle | null>(null);
  const latest = useRef(opts);
  latest.current = opts;

  // Mount once per enabled period; destroy on unmount or when disabled (e.g. sign-out, role no longer allowed).
  useEffect(() => {
    if (!opts.enabled || !window.SailAssistant) return;
    const h = window.SailAssistant.init({
      assistantUrl: opts.assistantUrl,
      module: opts.module,
      title: opts.title,
      getToken: (r: { forceRefresh: boolean; signal: AbortSignal }) => latest.current.getToken(r),
      context: latest.current.context,
      offset: 24,
    });
    handle.current = h;
    return () => {
      h.destroy();
      handle.current = null;
    };
  }, [opts.enabled, opts.assistantUrl, opts.module]);

  // A change of user, company or vessel starts a new conversation (the widget clears history and drops late answers).
  const { vesselId, vesselName, userKey, tenantKey, currentPage } = opts.context;
  useEffect(() => {
    handle.current?.updateContext({ module: opts.module, vesselId, vesselName, userKey, tenantKey, currentPage });
  }, [opts.module, vesselId, vesselName, userKey, tenantKey, currentPage]);
}
