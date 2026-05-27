import { useState, useRef, type ReactNode } from "react";
import { Download, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AgChartInstance } from "@/lib/agCharts";

export interface DashboardCardOption {
  value: string;
  label: string;
}

export interface DashboardCardProps {
  label: string;
  testId: string;
  dropdownPlaceholder?: string;
  options?: DashboardCardOption[];
  defaultOption?: string;
  renderContent?: (
    selectedOption: string,
    chartRef: React.MutableRefObject<AgChartInstance | null>,
  ) => ReactNode;
  downloadFileName?: string;
  children?: ReactNode;
}

export const DashboardCard = ({
  label,
  testId,
  dropdownPlaceholder = "Select",
  options,
  defaultOption,
  renderContent,
  downloadFileName,
  children,
}: DashboardCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const initialSelected = defaultOption ?? options?.[0]?.value ?? "";
  const [selected, setSelected] = useState<string>(initialSelected);

  const cardChartRef = useRef<AgChartInstance | null>(null);
  const dialogChartRef = useRef<AgChartInstance | null>(null);

  const handleDownload = (which: "card" | "dialog") => {
    const ref = which === "dialog" ? dialogChartRef : cardChartRef;
    if (ref.current) {
      ref.current.download({
        fileName: downloadFileName ?? `${testId}.png`,
      });
    }
  };

  const renderToolbar = (variant: "card" | "dialog") => {
    const iconSize = variant === "dialog" ? "h-4 w-4" : "h-3.5 w-3.5";
    const buttonSize = variant === "dialog" ? "h-8 w-8" : "h-7 w-7";
    const hasOptions = options && options.length > 0;
    return (
      <div className="flex items-center gap-2">
        <Select
          value={hasOptions ? selected : undefined}
          onValueChange={(v) => setSelected(v)}
          disabled={!hasOptions}
        >
          <SelectTrigger
            className="h-7 w-[110px] text-xs border-gray-300 dark:border-gray-600"
            data-testid={`select-${testId}`}
          >
            <SelectValue placeholder={dropdownPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {hasOptions &&
              options!.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  data-testid={`option-${testId}-${opt.value}`}
                >
                  {opt.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDownload(variant)}
          className={`${buttonSize} p-0 hover:bg-gray-100 dark:hover:bg-gray-700`}
          title="Download"
          data-testid={`button-download-${testId}${variant === "dialog" ? "-dialog" : ""}`}
        >
          <Download className={`${iconSize} text-gray-600 dark:text-gray-400`} />
        </Button>
        {variant === "card" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(true)}
            className={`${buttonSize} p-0 hover:bg-gray-100 dark:hover:bg-gray-700`}
            title="Expand"
            data-testid={`button-expand-${testId}`}
          >
            <Maximize2
              className={`${iconSize} text-gray-600 dark:text-gray-400`}
            />
          </Button>
        )}
      </div>
    );
  };

  const cardBody = renderContent ? renderContent(selected, cardChartRef) : children;
  const dialogBody = renderContent
    ? renderContent(selected, dialogChartRef)
    : children;

  return (
    <>
      <div
        className="flex flex-col min-h-0"
        data-testid={`card-wrapper-${testId}`}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-[#4a7ba7] dark:text-blue-400 uppercase tracking-wide">
            {label}
          </h3>
          {renderToolbar("card")}
        </div>
        <Card
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-1 min-h-0"
          data-testid={`card-${testId}`}
        >
          <CardContent className="p-3 h-full flex flex-col">
            <div className="flex-1 min-h-0">{cardBody}</div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-6xl w-[90vw] h-[85vh] p-6">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <DialogTitle className="text-xs font-semibold text-[#4a7ba7] dark:text-blue-400 uppercase tracking-wide">
                {label}
              </DialogTitle>
              {renderToolbar("dialog")}
            </div>
            <div className="flex-1 min-h-0 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
              {expanded && dialogBody}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
