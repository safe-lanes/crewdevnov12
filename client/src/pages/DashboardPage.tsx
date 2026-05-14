import { useState } from "react";
import SectionTitleComponents from "@/components/Section/SectionTitleComponents";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type DashboardTab = "management" | "operation";

export const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>("management");

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
          <div className="absolute inset-x-0 top-0 flex justify-center pointer-events-none">
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
          className="min-h-[200px] mt-0"
        />

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
