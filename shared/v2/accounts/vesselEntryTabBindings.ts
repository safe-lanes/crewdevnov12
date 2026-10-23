interface VesselTabPayElement {
  payElementUuid: string;
  code: string;
  status: string;
  category: string;
  calcMethod: string;
}
export function getBuiltInVesselTabElementUuids(
  elements: readonly VesselTabPayElement[],
): Set<string> {
  const pick = (category: string, preferredCode?: string) => {
    const candidates = elements.filter(
      (e) => e.status === "active" && e.category === category &&
        e.calcMethod !== "scale_lookup",
    );
    return candidates.find((e) => e.code === preferredCode) ?? candidates[0];
  };
  const mapped = [
    pick("overtime_variable", "OT"),
    pick("advance_recovery", "ADVANCE"),
    pick("allotment", "ALLOT"),
    pick("bond_slop_chest", "BOND"),
    pick("one_off") ?? pick("other"),
  ];
  return new Set(mapped.flatMap((e) => e ? [e.payElementUuid] : []));
}
