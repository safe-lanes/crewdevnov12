import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

type Options = { title?: string; actionLabel?: string; cancelLabel?: string };
type Request = Options & { message: string; kind: "confirm" | "alert" | "prompt"; initialValue?: string };
type Answer = boolean | string | null;

// Reuse the product's AlertDialog, not browser dialogs. Each owner renders
// `dialog` alongside its screen, so unmounting cancels an outstanding action.
export function useAppDialog() {
  const [request, setRequest] = useState<Request | null>(null);
  const [text, setText] = useState("");
  const pending = useRef<((answer: Answer) => void) | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const finish = useCallback((answer: Answer) => {
    const resolve = pending.current;
    pending.current = null;
    setRequest(null);
    resolve?.(answer);
  }, []);

  useEffect(() => () => {
    // An answer must never continue a write after the owning screen unmounts.
    pending.current?.(null);
    pending.current = null;
  }, []);

  const open = useCallback((next: Request): Promise<Answer> => {
    // Unlike a blocking native dialog the page can receive another event.
    // Refuse re-entry rather than running duplicate continuations.
    if (pending.current) return Promise.resolve(null);
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setText(next.initialValue ?? "");
    setRequest(next);
    return new Promise(resolve => { pending.current = resolve; });
  }, []);

  const ask = useCallback(async (message: string, options: Options = {}) =>
    (await open({ ...options, message, kind: "confirm" })) === true, [open]);
  const notify = useCallback(async (message: string, options: Options = {}) => {
    await open({ ...options, message, kind: "alert" });
  }, [open]);
  const requestText = useCallback(async (message: string, initialValue = "", options: Options = {}) => {
    const answer = await open({ ...options, message, initialValue, kind: "prompt" });
    return typeof answer === "string" ? answer : null;
  }, [open]);

  const dialog = (
    <AlertDialog open={request !== null} onOpenChange={open => { if (!open) finish(null); }}>
      <AlertDialogContent
        className="z-[600] max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto"
        overlayClassName="z-[590]"
        onEscapeKeyDown={event => {
          event.preventDefault();
          event.stopPropagation();
          finish(null);
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (previousFocus.current?.isConnected) previousFocus.current.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title ?? (request?.kind === "alert" ? "Notice" : "Confirm action")}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-wrap">{request?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        {request?.kind === "prompt" && <Input
          autoFocus aria-label={request.message} value={text}
          onChange={event => setText(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") { event.preventDefault(); finish(text); }
          }}
        />}
        <AlertDialogFooter>
          {request?.kind !== "alert" && <AlertDialogCancel type="button" onClick={() => finish(null)}>
            {request?.cancelLabel ?? "Keep editing"}
          </AlertDialogCancel>}
          <AlertDialogAction type="button" onClick={() => finish(request?.kind === "prompt" ? text : true)}>
            {request?.actionLabel ?? (request?.kind === "alert" ? "Close" : "Continue")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { ask, notify, requestText, dialog };
}
