import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApiV2 } from "@/modules/admin/api/adminApiV2";
import { getUserProfile } from "@/contexts/PermissionsContext";

/**
 * Shared rank-hierarchy access-control utility.
 *
 * Reads the logged-in user's rank/designation (`designation`) and user type
 * from the decrypted user profile (`localStorage.userProfile`, the same
 * source `usePermissions()` uses), and resolves the set of ranks that user
 * is allowed to see from the Vessel Org Chart hierarchy (Admin -> Rank Admin
 * -> Company -> Vessel Org Chart): the user's own rank plus every rank
 * reporting to it, transitively.
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

export interface RankScope {
  /** Designation value read from the decrypted user profile (e.g. "MASTER"). */
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
  const designation = useMemo(() => getUserProfile()?.designation || "", []);
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
