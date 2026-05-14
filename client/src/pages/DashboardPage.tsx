import { useState } from "react";
import SectionTitleComponents from "@/components/Section/SectionTitleComponents";

type DashboardTab = "management" | "operation";

export const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>("management");

  const tabs: { value: DashboardTab; label: string }[] = [
    { value: "management", label: "Management" },
    { value: "operation", label: "Operation" },
  ];

  return (
    <div
      className="p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-67px)]"
      data-testid="dashboard-page"
    >
      <SectionTitleComponents title="Dashboard">
        <div
          className="flex items-center gap-1 bg-[#f1f1f1] rounded-md p-1"
          role="tablist"
          aria-label="Dashboard view"
          data-testid="tabs-dashboard"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                id={`tab-${tab.value}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.value}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.value)}
                data-testid={`tab-${tab.value}`}
                className={`px-6 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? "bg-[#5DADE2] text-white shadow-sm"
                    : "bg-transparent text-[#4f5863] hover:bg-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="w-[120px]" aria-hidden="true" />
      </SectionTitleComponents>

      {activeTab === "management" && (
        <div
          id="panel-management"
          role="tabpanel"
          aria-labelledby="tab-management"
          data-testid="panel-management"
          className="min-h-[200px]"
        />
      )}

      {activeTab === "operation" && (
        <div
          id="panel-operation"
          role="tabpanel"
          aria-labelledby="tab-operation"
          data-testid="panel-operation"
          className="min-h-[200px] flex items-center justify-center text-sm text-gray-500"
        >
          Coming soon
        </div>
      )}
    </div>
  );
};
