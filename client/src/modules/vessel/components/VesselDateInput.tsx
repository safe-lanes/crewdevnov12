import React from "react";
import { flushSync } from "react-dom";
import { FormattedDateInput, formatIsoDate, parseManualDate } from "@/components/ui/formatted-date-input";
type Props = Extract<
    React.ComponentPropsWithoutRef<typeof FormattedDateInput>,
    { mode?: "date" }
> & { onTemporaryClearAbandoned?: () => void };
export const VesselDateInput = React.forwardRef<HTMLDivElement, Props>(
    ({ value, onChange, onBlur, onTemporaryClearAbandoned, ...props }, ref) => {
        const boundary = React.useRef<HTMLDivElement>(null);
        const focusFrame = React.useRef<number | null>(null);
        const [clearedValue, setClearedValue] = React.useState<string | null>(null);
        const temporarilyCleared = clearedValue !== null && clearedValue === value;
        const pointerCleanup = React.useRef<(() => void) | null>(null);
        const cancelFocus = () => {
            pointerCleanup.current?.();
            pointerCleanup.current = null;
            if (focusFrame.current !== null) {
                cancelAnimationFrame(focusFrame.current);
                focusFrame.current = null;
            }
        };
        React.useEffect(() => {
            cancelFocus();
            setClearedValue(null);
            return cancelFocus;
        }, [value, props.disabled]);
        const isInside = (target: EventTarget | null) =>
            target instanceof Node && Boolean(boundary.current?.contains(target));
        return (
            <div
                ref={boundary}
                className="contents"
                onBlurCapture={(event) => {
                    if (isInside(event.relatedTarget)) return;
                    if (focusFrame.current !== null &&
                        event.target instanceof HTMLInputElement && event.target.type === "date") return;
                    cancelFocus();
                    const text = boundary.current?.querySelector<HTMLInputElement>('input[type="text"]');
                    const draft = text?.value ?? "";
                    const canonical = parseManualDate(draft);
                    if (temporarilyCleared && (
                        !draft.trim() ||
                        (!props.retainInvalidDraftOnBlur && canonical !== null)
                    )) {
                        flushSync(() => setClearedValue(null));
                    }
                }}
            >
                <FormattedDateInput
                    {...props}
                    ref={ref}
                    value={temporarilyCleared ? "" : value}
                    onChange={(event) => {
                        const next = event.target.value;
                        if (event.currentTarget.type === "date" && next === "") {
                            cancelFocus();
                            setClearedValue(value);
                            const abandonClear = () => {
                                cancelFocus();
                                setClearedValue(null);
                                onTemporaryClearAbandoned?.();
                            };
                            const outsidePointer = (event: PointerEvent) => {
                                if (!isInside(event.target)) abandonClear();
                            };
                            document.addEventListener("pointerdown", outsidePointer, true);
                            pointerCleanup.current = () =>
                                document.removeEventListener("pointerdown", outsidePointer, true);
                            focusFrame.current = requestAnimationFrame(() => {
                                cancelFocus();
                                const active = document.activeElement;
                                if (active && active !== document.body && !isInside(active)) {
                                    abandonClear();
                                    return;
                                }
                                boundary.current
                                    ?.querySelector<HTMLInputElement>('input[type="text"]')
                                    ?.focus();
                            });
                            return;
                        }
                        if (next && formatIsoDate(next) &&
                            (!props.min || next >= props.min) && (!props.max || next <= props.max)) {
                            setClearedValue(null);
                        }
                        onChange(event);
                    }}
                    onBlur={(event) => {
                        if (focusFrame.current !== null && event.currentTarget.type === "date") return;
                        onBlur?.(event);
                    }}
                />
            </div>
        );
    },
);
VesselDateInput.displayName = "VesselDateInput";
