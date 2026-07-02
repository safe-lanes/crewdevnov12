import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDecryptedSessionStorageItem } from "@/lib/encryptionService";
import { adminApiV2 } from "@/modules/admin/api/adminApiV2";
import { getUserProfile } from "@/contexts/PermissionsContext";

/**
 * Shared rank-hierarchy access-control utility.
 *
 * Reads the logged-in user's rank/designation (`crewDesignation`) from
 * session storage and user type from the decrypted user profile
 * (`localStorage.userProfile`, same source `usePermissions()` uses), and
 * resolves the set of ranks that user is allowed to see from the Vessel Org
 * Chart hierarchy (Admin -> Rank Admin -> Company -> Vessel Org Chart): the
 * user's own rank plus every rank reporting to it, transitively.
 *
 * This hook ONLY resolves the scope — it does not filter or restrict any
 * data itself. Each consuming module (Vessel, Promotions, Appraisals, etc.)
 * is responsible for applying `allowedRanks` to its own queries/views, and
 * for deciding whether/when to enforce it (e.g. vessel-side screens should
 * only enforce this when `shouldRestrictForShipUser` is true).
 *
 * Usage pattern for a future module:
 *   const { allowedRanks, isRestricted, isLoading } = useRankScope();
 *   const visibleRows = isRestricted
 *     ? rows.filter(r => allowedRanks.includes(r.rank))
 *     : rows;
 */

function extractStringValue(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    return val.value || val.name || val.label || "";
  }
  return String(val);
}

function readSessionField(key: string): string {
  try {
    const decrypted = getDecryptedSessionStorageItem(key, true);
    const fromDecrypted = extractStringValue(decrypted);
    if (fromDecrypted) return fromDecrypted;
  } catch {
    // fall through to raw read below
  }
  return sessionStorage.getItem(key) || "";
}

export interface RankScope {
  /** Raw crewDesignation value read from session storage (e.g. "Chief Officer"). */
  designation: string;
  /** User type from the decrypted user profile (e.g. "Ship", "Office"). */
  userType: string;
  /** True when the current designation matched a rank in the Vessel Org Chart. */
  isRestricted: boolean;
  /** Convenience flag for vessel-side consumers: restriction should only be enforced for Ship users. */
  shouldRestrictForShipUser: boolean;
  /** Rank names at/under the current designation (inclusive). Empty when unrestricted. */
  allowedRanks: string[];
  /** Rank IDs at/under the current designation (inclusive). Empty when unrestricted. */
  allowedRankIds: string[];
  isLoading: boolean;
}

export function useRankScope(): RankScope {
  const designation = useMemo(() => readSessionField("crewDesignation"), []);
  const userType = useMemo(() => getUserProfile()?.userType || "", []);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/v2/admin/vessel-org-chart/rank-scope", designation],
    queryFn: () => adminApiV2.getRankScope(designation),
    enabled: !!designation,
    staleTime: 5 * 60 * 1000,
  });

  const isRestricted = !!data?.isRestricted;
  const allowedRanks = data?.allowedRanks || [];
  const allowedRankIds = data?.allowedRankIds || [];
  const shouldRestrictForShipUser = isRestricted && userType.toLowerCase() === "ship";

  return {
    designation,
    userType,
    isRestricted,
    shouldRestrictForShipUser,
    allowedRanks,
    allowedRankIds,
    isLoading: !!designation && isLoading,
  };
}
