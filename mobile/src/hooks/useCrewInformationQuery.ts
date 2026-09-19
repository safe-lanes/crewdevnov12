import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { crewInformationApi, CrewInformation, CrewInformationMasters } from "../api/crewInformationApi";

// crewInformationApi.get()/getMasters() were each independently re-fetched,
// in full, by HomeScreen, CrewProfileScreen and CrewCollectionScreen on
// every focus — the heaviest endpoint in the app, fetched 2-3x more than it
// needed to be. Caching it here means a screen shows the last-known data
// immediately (no blank/spinner flash on back-navigation) while a fresh
// fetch happens quietly in the background.
export const crewInfoKeys = {
  info: ["crewInformation"] as const,
  masters: ["crewInformationMasters"] as const,
};

// Refetch whenever the screen regains focus, same as every other screen's
// useFocusEffect, but on top of React Query's cache — so focus always
// revalidates, without discarding what's already on screen while it does.
function useRefetchOnFocus(refetch: () => void) {
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));
}

export function useCrewInformationQuery() {
  const query = useQuery({
    queryKey: crewInfoKeys.info,
    queryFn: crewInformationApi.get,
    staleTime: 30_000,
  });
  useRefetchOnFocus(query.refetch);
  return query;
}

export function useCrewInformationMastersQuery() {
  // Reference/master data (nationalities, countries, vessels, ...) changes
  // rarely — a much longer staleTime than the crew's own record.
  const query = useQuery({
    queryKey: crewInfoKeys.masters,
    queryFn: crewInformationApi.getMasters,
    staleTime: 10 * 60_000,
  });
  useRefetchOnFocus(query.refetch);
  return query;
}

/** Call after any mutation that changes crew-information data (section
 * updates, collection create/update/remove) so the next read is fresh. */
export function useInvalidateCrewInformation() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: crewInfoKeys.info }), [queryClient]);
}

export type { CrewInformation, CrewInformationMasters };
