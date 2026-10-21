/**
 * Shared SAIL chat widget — configuration and pinned bundle loader.
 *
 * The widget is ONE pinned JavaScript bundle served by the central assistant (same file for every module).
 * Nothing from React is shared with it and nothing is installed. It is enabled only when VITE_ASSISTANT_URL is
 * set for the build (e.g. https://assistant.sl-sail.com); without it no script is loaded and no widget appears.
 * No key, secret or trainer credential exists in browser code: the token comes from GET /api/v2/assistant/token.
 */
export const ASSISTANT_MODULE = "crewing";
export const WIDGET_VERSION = "1.0.1";
// Subresource Integrity of sail-assistant-widget.1.0.1.js (from the widget's dist/1.0.1/integrity.json).
export const WIDGET_INTEGRITY = "sha384-e2Q1Mm3OiovWmjX/D8EIXFTxKaNbunU2Y2jH0JuaITO2DdarwsW3BxJQrHte4ZMU";

export function assistantUrl(): string | null {
  const raw = (import.meta.env.VITE_ASSISTANT_URL as string | undefined)?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

/** UI-only gate (the token endpoint enforces the real rule): roles that see the widget. */
export function uiAllowedRoles(): string[] {
  return ((import.meta.env.VITE_ASSISTANT_ALLOWED_ROLES as string | undefined) || "Sail Admin")
    .split(",")
    .map((r) => r.trim().toLocaleLowerCase())
    .filter(Boolean);
}

let loading: Promise<boolean> | null = null;

/** Loads the pinned bundle once (integrity-checked). Resolves false if it cannot load — the module then runs without a widget. */
export function loadWidgetBundle(baseUrl: string): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.SailAssistant) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise<boolean>((resolve) => {
    const el = document.createElement("script");
    el.src = `${baseUrl}/widget/${WIDGET_VERSION}/sail-assistant-widget.${WIDGET_VERSION}.js`;
    el.integrity = WIDGET_INTEGRITY;
    el.crossOrigin = "anonymous";
    el.async = true;
    el.onload = () => resolve(!!window.SailAssistant);
    el.onerror = () => {
      loading = null;
      resolve(false);
    };
    document.head.appendChild(el);
  });
  return loading;
}

type Ctx = { vesselId?: string | null; vesselName?: string | null; userKey?: string | null; tenantKey?: string | null; currentPage?: string | null };
export type SailAssistantHandle = { updateContext(c: Ctx & { module?: string }): void; open(): void; close(): void; destroy(): void };
export type SailAssistantContext = Ctx;

declare global {
  interface Window {
    SailAssistant?: { init(config: Record<string, unknown>): SailAssistantHandle; VERSION: string };
  }
}
