/**
 * Wage Accounts Module - Main container
 */

import React, { useState } from "react";
import { PayRunBoard } from "./PayRunBoard";
import { PayRunDetail } from "./PayRunDetail";
import { CrewPayrollCard } from "./CrewPayrollCard";
import { ValidationCenter } from "./ValidationCenter";
import { AllotmentsManager } from "./AllotmentsManager";

type ViewType = "board" | "detail" | "crew-card" | "validation" | "allotments";

export function WageAccountsModule() {
  const [currentView, setCurrentView] = useState<ViewType>("board");
  const [selectedPayRun, setSelectedPayRun] = useState<string | null>(null);
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);

  const handleNavigate = (view: ViewType, payRunId?: string, crewId?: string) => {
    setCurrentView(view);
    if (payRunId) setSelectedPayRun(payRunId);
    if (crewId) setSelectedCrewId(crewId);
  };

  const renderView = () => {
    switch (currentView) {
      case "board":
        return <PayRunBoard />;
      case "detail":
        return <PayRunDetail payRunId={selectedPayRun} onNavigate={handleNavigate} />;
      case "crew-card":
        return <CrewPayrollCard crewId={selectedCrewId} payRunId={selectedPayRun} onNavigate={handleNavigate} />;
      case "validation":
        return <ValidationCenter payRunId={selectedPayRun} onNavigate={handleNavigate} />;
      case "allotments":
        return <AllotmentsManager payRunId={selectedPayRun} onNavigate={handleNavigate} />;
      default:
        return <PayRunBoard />;
    }
  };

  return (
    <div className="w-full h-full">
      {renderView()}
    </div>
  );
}