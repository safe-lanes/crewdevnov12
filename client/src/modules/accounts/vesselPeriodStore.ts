import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { currentPeriod } from "./pages/VesselPeriodBar";

interface VesselPeriodState {
  vesselUuid: string;
  period: string; // YYYY-MM
  setVesselUuid: (uuid: string) => void;
  setPeriod: (period: string) => void;
}

/**
 * Shared vessel + accounting-period selection for the Accounts module.
 * Persisted to sessionStorage so the selection survives sub-menu
 * navigation and page reloads within the session.
 */
export const useVesselPeriod = create<VesselPeriodState>()(
  persist(
    (set) => ({
      vesselUuid: "",
      period: currentPeriod(),
      setVesselUuid: (vesselUuid) => set({ vesselUuid }),
      setPeriod: (period) => set({ period }),
    }),
    {
      name: "accounts-vessel-period",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ vesselUuid: s.vesselUuid, period: s.period }),
    },
  ),
);
