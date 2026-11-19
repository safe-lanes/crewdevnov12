import { Input } from "@/components/ui/input";

/** The missing-master message is presentation only, never the input's value. */
export function VisaCountryField({ value, countryId, unavailable, invalid, onChange, onBlur }: {
  value: string;
  countryId?: string;
  unavailable?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  if (countryId) {
    return <span className="text-[#4f5863] text-[13px]">{value || (unavailable ? "Country unavailable" : "")}</span>;
  }
  return <Input
    value={value}
    placeholder={unavailable ? "Country unavailable" : undefined}
    onChange={event => onChange(event.target.value)}
    onBlur={onBlur}
    className={`text-[#4f5863] text-[13px] border ${invalid ? "border-red-500" : "border-[#EAEBEF]"} shadow-none p-0 h-auto`}
  />;
}
