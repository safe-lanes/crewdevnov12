const BASE =
  "rounded-md px-2.5 py-1 font-semibold min-w-[90px] text-center border-transparent shadow hover:bg-primary/80";
const COLOURS = {
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-800",
  grey: "bg-gray-100 text-gray-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  yellow: "bg-yellow-100 text-yellow-800",
} as const;
export function accountsStatusBadgeClass(
  colour: keyof typeof COLOURS,
): string {
  return `${BASE} ${COLOURS[colour]}`;
}
