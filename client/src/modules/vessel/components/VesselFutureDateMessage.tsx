import * as React from "react";
import { parseManualDate } from "@/components/ui/formatted-date-input";

type Props = {
    value: string | undefined;
    message: string;
    children: React.ReactNode;
};

export function VesselFutureDateMessage({ value, message, children }: Props) {
    const root = React.useRef<HTMLDivElement>(null);
    const attemptedDraft = React.useRef<string | null>(null);
    const originalMessages = React.useRef(new WeakMap<HTMLElement, string>());

    const syncMessage = React.useCallback(() => {
        const input = root.current?.querySelector<HTMLInputElement>('input[type="text"]');
        const error = root.current?.querySelector<HTMLElement>('[role="alert"]');
        const max = root.current?.querySelector<HTMLInputElement>('input[type="date"]')?.max;
        if (!input || !error) return;
        if (!originalMessages.current.has(error)) {
            originalMessages.current.set(error, error.textContent ?? "");
        }
        const parsed = parseManualDate(attemptedDraft.current ?? input.value);
        const next = max && parsed && parsed > max
            ? message
            : originalMessages.current.get(error)!;
        if (error.textContent !== next) error.textContent = next;
    }, [message]);

    React.useLayoutEffect(() => {
        attemptedDraft.current = null;
    }, [value]);

    React.useLayoutEffect(() => {
        const node = root.current;
        if (!node) return;
        const observer = new MutationObserver(syncMessage);
        observer.observe(node, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ["value", "aria-invalid", "max"],
        });
        syncMessage();
        return () => observer.disconnect();
    }, [syncMessage, value]);

    return (
        <div
            ref={root}
            className="contents"
            onChangeCapture={(event) => {
                if (!(event.target instanceof HTMLInputElement)) return;
                attemptedDraft.current = event.target.type === "text"
                    ? event.target.value
                    : null;
                queueMicrotask(syncMessage);
            }}
        >
            {children}
        </div>
    );
}
