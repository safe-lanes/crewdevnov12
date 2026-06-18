import { useMemo, useState } from "react";
import SectionTitleComponents from "@/components/Section/SectionTitleComponents";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DashboardCard } from "@/modules/dashboard/DashboardCard";
import {
  ManagementFilterBar,
  EMPTY_MANAGEMENT_FILTERS,
  type ManagementFilters,
} from "@/modules/dashboard/ManagementFilterBar";
import { CrewRecruitmentRankChart } from "@/modules/dashboard/CrewRecruitmentRankChart";
import { CrewPromotionsRankChart } from "@/modules/dashboard/CrewPromotionsRankChart";
import { CrewAppraisalsRankChart } from "@/modules/dashboard/CrewAppraisalsRankChart";
import { CrewPoolRankChart } from "@/modules/dashboard/CrewPoolRankChart";
import { CrewRetentionMetrics } from "@/modules/dashboard/CrewRetentionMetrics";
import { DAAnalysisMetrics } from "@/modules/dashboard/DAAnalysisMetrics";
import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";

type DashboardTab = "management" | "operation";

const PLACEHOLDER_CARDS: { label: string; testId: string }[] = [];

export const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>("management");

  const defaultPeriod = useMemo<PeriodFilterValue>(() => {
    const now = new Date();
    return { mode: "year", year: now.getFullYear() };
  }, []);

  const [period, setPeriod] = useState<PeriodFilterValue>(defaultPeriod);
  const [filters, setFilters] = useState<ManagementFilters>(
    EMPTY_MANAGEMENT_FILTERS,
  );

  return (
    <div
      className="p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-67px)]"
      data-testid="dashboard-page"
    >
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as DashboardTab)}
        className="space-y-6"
      >
        <div className="relative">
          <SectionTitleComponents title="Dashboard">
            <span aria-hidden="true" />
          </SectionTitleComponents>
          <div className="hidden absolute inset-x-0 top-0 flex justify-center pointer-events-none">
            <TabsList
              className="h-auto bg-[#f1f1f1] p-1 rounded-md pointer-events-auto"
              data-testid="tabs-dashboard"
            >
              <TabsTrigger
                value="management"
                data-testid="tab-management"
                className="px-6 py-1.5 text-sm font-medium text-[#4f5863] data-[state=active]:bg-[#5DADE2] data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                Management
              </TabsTrigger>
              <TabsTrigger
                value="operation"
                data-testid="tab-operation"
                className="px-6 py-1.5 text-sm font-medium text-[#4f5863] data-[state=active]:bg-[#5DADE2] data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                Operation
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent
          value="management"
          data-testid="panel-management"
          className="mt-0 space-y-4"
        >
          <ManagementFilterBar
            period={period}
            onPeriodChange={setPeriod}
            filters={filters}
            onFiltersChange={setFilters}
            onClear={() => {
              setPeriod(defaultPeriod);
              setFilters(EMPTY_MANAGEMENT_FILTERS);
            }}
          />
          <div
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
            style={{ gridAutoRows: "minmax(300px, 1fr)" }}
          >
            <DashboardCard
              key="crew-recruitment"
              label="Crew Recruitment"
              testId="crew-recruitment"
              options={[{ value: "rank", label: "Rank" }]}
              defaultOption="rank"
              downloadFileName="crew_recruitment_rank.png"
              renderContent={(selected, chartRef) =>
                selected === "rank" ? (
                  <CrewRecruitmentRankChart
                    period={period}
                    ranks={filters.ranks}
                    crewPools={filters.crewPools}
                    manningAgents={filters.manningAgents}
                    nationalities={filters.nationalities}
                    chartRef={chartRef}
                  />
                ) : null
              }
            />
            <DashboardCard
              key="crew-promotions"
              label="Crew Promotions"
              testId="crew-promotions"
              options={[{ value: "rank", label: "Rank" }]}
              defaultOption="rank"
              downloadFileName="crew_promotions_rank.png"
              renderContent={(selected, chartRef) =>
                selected === "rank" ? (
                  <CrewPromotionsRankChart
                    period={period}
                    ranks={filters.ranks}
                    crewPools={filters.crewPools}
                    manningAgents={filters.manningAgents}
                    nationalities={filters.nationalities}
                    chartRef={chartRef}
                  />
                ) : null
              }
            />
            <DashboardCard
              key="crew-appraisals"
              label="Crew Appraisals"
              testId="crew-appraisals"
              options={[{ value: "rank", label: "Rank" }]}
              defaultOption="rank"
              downloadFileName="crew_appraisals_rank.png"
              renderContent={(selected, chartRef) =>
                selected === "rank" ? (
                  <CrewAppraisalsRankChart
                    period={period}
                    chartRef={chartRef}
                  />
                ) : null
              }
            />
            <DashboardCard
              key="crew-retention"
              label="Crew Retention"
              testId="crew-retention"
              renderContent={() => (
                <CrewRetentionMetrics
                  period={period}
                  ranks={filters.ranks}
                  crewPools={filters.crewPools}
                  manningAgents={filters.manningAgents}
                  nationalities={filters.nationalities}
                />
              )}
            />
            <DashboardCard
              key="crew-pool"
              label="Crew Pool"
              testId="crew-pool"
              options={[{ value: "rank", label: "Rank" }]}
              defaultOption="rank"
              downloadFileName="crew_pool_rank.png"
              renderContent={(selected, chartRef) =>
                selected === "rank" ? (
                  <CrewPoolRankChart
                    period={period}
                    ranks={filters.ranks}
                    vessels={filters.vessels}
                    crewPools={filters.crewPools}
                    manningAgents={filters.manningAgents}
                    nationalities={filters.nationalities}
                    chartRef={chartRef}
                  />
                ) : null
              }
            />
            <DashboardCard
              key="da-analysis"
              label="D&A Analysis"
              testId="da-analysis"
              renderContent={() => (
                <DAAnalysisMetrics
                  period={period}
                  ranks={filters.ranks}
                  vessels={filters.vessels}
                  crewPools={filters.crewPools}
                  manningAgents={filters.manningAgents}
                />
              )}
            />
            {PLACEHOLDER_CARDS.map((card) => (
              <DashboardCard
                key={card.testId}
                label={card.label}
                testId={card.testId}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent
          value="operation"
          data-testid="panel-operation"
          className="min-h-[200px] mt-0 flex items-center justify-center text-sm text-gray-500"
        >
          Coming soon
        </TabsContent>
      </Tabs>
    </div>
  );
};
