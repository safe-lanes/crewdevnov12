import { BarChart3 } from "lucide-react";

export const ReportsComingSoon = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <BarChart3 size={64} className="text-[#5DADE2] mb-4" />
      <h1 className="text-2xl font-semibold text-gray-700 mb-2" data-testid="reports-coming-soon-title">
        Reports
      </h1>
      <p className="text-lg text-gray-500" data-testid="reports-coming-soon-message">
        Coming Soon
      </p>
    </div>
  );
};
