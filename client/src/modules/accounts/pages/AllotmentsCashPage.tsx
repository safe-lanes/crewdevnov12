import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVesselLookup } from "@/hooks/useVesselLookup";
import VesselPeriodBar from "./VesselPeriodBar";
import { useVesselPeriod } from "../vesselPeriodStore";
import AllotmentsPage from "./AllotmentsPage";
import { AdvancesTab, BondTab } from "./CashBondPage";

/**
 * Combined crew-finance screen: Allotments, Advances and Bond in one page.
 * Replaces the separate Allotments and Cash & Bond menu entries; governed by
 * the "Account Allotments" menu row ("Allotments & Cash").
 */
export default function AllotmentsCashPage() {
  useVesselLookup(); // warm the vessel cache for the period bar
  const { vesselUuid, setVesselUuid, period, setPeriod } = useVesselPeriod();

  return (
    <div className="p-4 space-y-4" data-testid="allotments-cash-page">
      <div>
        <h1 className="text-xl font-semibold text-[#0f172a]">
          Allotments &amp; Cash
        </h1>
        <p className="text-sm text-muted-foreground">
          Family remittance instructions, office-arranged advances with
          recovery schedules, and bond / slop-chest deductions
        </p>
      </div>

      <Tabs defaultValue="allotments">
        <TabsList>
          <TabsTrigger value="allotments" data-testid="tab-allotments">
            Allotments
          </TabsTrigger>
          <TabsTrigger value="advances" data-testid="tab-advances">
            Advances
          </TabsTrigger>
          <TabsTrigger value="bond" data-testid="tab-bond">
            Bond
          </TabsTrigger>
        </TabsList>

        <TabsContent value="allotments" className="mt-3">
          <AllotmentsPage embedded />
        </TabsContent>

        <TabsContent value="advances" className="mt-3">
          <div className="space-y-3">
            <VesselPeriodBar
              vesselUuid={vesselUuid}
              period={period}
              onVesselChange={setVesselUuid}
              onPeriodChange={setPeriod}
            />
            <AdvancesTab vesselUuid={vesselUuid} period={period} />
          </div>
        </TabsContent>

        <TabsContent value="bond" className="mt-3">
          <div className="space-y-3">
            <VesselPeriodBar
              vesselUuid={vesselUuid}
              period={period}
              onVesselChange={setVesselUuid}
              onPeriodChange={setPeriod}
            />
            <BondTab vesselUuid={vesselUuid} period={period} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
