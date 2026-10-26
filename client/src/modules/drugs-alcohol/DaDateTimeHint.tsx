import { useLayoutEffect, useRef, type ReactNode } from 'react';

type Props = { value: string | undefined; children: ReactNode };

export function DaDateTimeHint({ value, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const prefixRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current!;
    const hint = hintRef.current!;
    const prefix = prefixRef.current!;
    const input = root.querySelector<HTMLInputElement>('input[type="text"]');
    if (!input) return;
    let frame = 0;
    let disposed = false;
    const update = () => {
      const text = input.value;
      const show = /^\s*[0-9A-Za-z/-]+\s*$/.test(text);
      hint.style.display = show ? 'flex' : 'none';
      if (!show) return;
      const style = getComputedStyle(input);
      const box = input.getBoundingClientRect();
      const parent = root.getBoundingClientRect();
      const left = parseFloat(style.paddingLeft) || 0;
      const right = parseFloat(style.paddingRight) || 0;
      Object.assign(hint.style, {
        left: (box.left - parent.left + input.clientLeft + left) + 'px',
        top: (box.top - parent.top + input.clientTop) + 'px',
        width: Math.max(0, input.clientWidth - left - right) + 'px',
        height: input.clientHeight + 'px',
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        letterSpacing: style.letterSpacing,
        opacity: input.matches(':disabled') ? '0.6' : '1',
      });
      prefix.textContent = text + (/\s$/.test(text) ? '' : ' ');
      prefix.parentElement!.style.transform = 'translateX(' + (-input.scrollLeft) + 'px)';
    };
    const schedule = () => {
      if (disposed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const events = ['input', 'change', 'blur', 'focus', 'click', 'scroll'];
    events.forEach(event => root.addEventListener(event, schedule, true));
    const resize = new ResizeObserver(schedule);
    resize.observe(root);
    resize.observe(input);
    const mutation = new MutationObserver(schedule);
    mutation.observe(input, { attributes: true, attributeFilter: ['value', 'disabled', 'readonly', 'class', 'style'] });
    void document.fonts.ready.then(schedule);
    update();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      events.forEach(event => root.removeEventListener(event, schedule, true));
      resize.disconnect();
      mutation.disconnect();
    };
  }, [value]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      {children}
      <span ref={hintRef} aria-hidden="true" className="pointer-events-none absolute overflow-hidden text-muted-foreground" style={{ display: 'none', alignItems: 'center' }}>
        <span style={{ whiteSpace: 'pre', flexShrink: 0 }}>
          <span ref={prefixRef} style={{ visibility: 'hidden' }} />
          <span>--:-- --</span>
        </span>
      </span>
    </div>
  );
}
