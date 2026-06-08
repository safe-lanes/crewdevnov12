import { useState, useRef, useEffect } from 'react';
import { format, parse, isValid } from 'date-fns';

const toInputValue = (stored?: string): string => {
  if (!stored) return '';
  const d = parse(stored, 'dd-MMM-yyyy', new Date());
  return isValid(d) ? format(d, 'yyyy-MM-dd') : '';
};

const toStoredValue = (input: string): string => {
  if (!input) return '';
  const d = parse(input, 'yyyy-MM-dd', new Date());
  return isValid(d) ? format(d, 'dd-MMM-yyyy') : '';
};

export const PlannedDateCellEditor = (props: any) => {
  const [value, setValue] = useState<string>(toInputValue(props.value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    try {
      inputRef.current?.showPicker?.();
    } catch {
      /* showPicker needs a user gesture in some browsers; focus is enough fallback */
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setValue(next);
    props.onValueChange(toStoredValue(next));
  };

  return (
    <input
      ref={inputRef}
      type="date"
      value={value}
      onChange={handleChange}
      className="w-full h-full px-2 text-xs outline-none"
      data-testid="input-planned-date"
    />
  );
};
