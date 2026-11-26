import { useEffect, type RefObject } from 'react';

type ScrollSection<Id extends string> = {
  id: Id;
  ref: RefObject<HTMLElement>;
};

export function useFormSectionHighlight<Id extends string>(
  containerRef: RefObject<HTMLElement>,
  sections: readonly ScrollSection<Id>[],
  onActiveSectionChange: (id: Id) => void,
  enabled = true,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;

    let frame: number | null = null;
    const update = () => {
      frame = null;
      if (container.clientHeight <= 0) return;
      const top = container.getBoundingClientRect().top + container.clientTop;
      const bottom = top + container.clientHeight;
      const marker = top + container.clientHeight * 0.2;
      const measured = sections.flatMap(({ id, ref }) => {
        const element = ref.current;
        if (!element || !container.contains(element)) return [];
        const rect = element.getBoundingClientRect();
        return rect.height > 0 ? [{ id, rect }] : [];
      });
      if (!measured.length) return;

      let current = measured[0];
      for (const section of measured) {
        if (container.scrollTop > 1 && section.rect.top <= marker) current = section;
      }
      const atBottom = container.scrollHeight > container.clientHeight + 1 &&
        container.scrollTop + container.clientHeight >= container.scrollHeight - 1;
      if (atBottom) {
        const visible = measured.filter(({ rect }) => rect.bottom > top && rect.top < bottom);
        if (visible.length) current = visible[visible.length - 1];
      }
      onActiveSectionChange(current.id);
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };

    container.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(container);
    sections.forEach(({ ref }) => {
      if (ref.current) resizeObserver.observe(ref.current);
    });
    schedule();

    return () => {
      container.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      resizeObserver.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [containerRef, sections, onActiveSectionChange, enabled]);
}
