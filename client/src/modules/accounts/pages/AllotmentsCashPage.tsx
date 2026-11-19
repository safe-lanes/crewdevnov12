import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [advanceStatusFilter, setAdvanceStatusFilter] = useState("all");

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
              onClear={() => {
                useVesselPeriod.getState().resetFilters();
                setAdvanceStatusFilter("all");
              }}
            >
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Status</Label>
                <Select
                  value={advanceStatusFilter}
                  onValueChange={setAdvanceStatusFilter}
                >
                  <SelectTrigger
                    className="h-8 w-36 text-xs"
                    data-testid="select-filter-status"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="fully-recovered">Fully-Recovered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </VesselPeriodBar>
            <AdvancesTab
              vesselUuid={vesselUuid}
              period={period}
              statusFilter={advanceStatusFilter}
            />
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
