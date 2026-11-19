import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type Props = Omit<ComponentProps<typeof Input>, "value" | "className"> & {
  value: string;
};

// Match the real input's typography and padding, including its md font size.
// An intrinsic mirror accommodates proportional fonts, pasted text and spaces
// without guessing a character width or changing the field's saved value.
export function CompanyAbbreviationInput({ value, placeholder = "Enter abbreviation", ...props }: Props) {
  return (
    <div className="inline-grid min-w-[160px] align-middle">
      <span
        aria-hidden="true"
        className="invisible pointer-events-none col-start-1 row-start-1 whitespace-pre border border-transparent px-3 pr-5 text-xs md:text-sm"
      >
        {value || placeholder}
      </span>
      <Input
        {...props}
        value={value}
        placeholder={placeholder}
        aria-label={props["aria-label"] || "Abbreviation"}
        className="col-start-1 row-start-1 h-7 min-w-0 w-full text-xs"
      />
    </div>
  );
}
