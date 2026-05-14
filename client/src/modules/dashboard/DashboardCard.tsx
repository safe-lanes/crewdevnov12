import { useState, type ReactNode } from "react";
import { Download, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export interface DashboardCardProps {
  label: string;
  testId: string;
  dropdownPlaceholder?: string;
  children?: ReactNode;
}

export const DashboardCard = ({
  label,
  testId,
  dropdownPlaceholder = "View",
  children,
}: DashboardCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const renderToolbar = (variant: "card" | "dialog") => {
    const iconSize = variant === "dialog" ? "h-4 w-4" : "h-3.5 w-3.5";
    const buttonSize = variant === "dialog" ? "h-8 w-8" : "h-7 w-7";
    return (
      <div className="flex items-center gap-2">
        <Select>
          <SelectTrigger
            className="h-7 w-[110px] text-xs border-gray-300 dark:border-gray-600"
            data-testid={`select-${testId}`}
          >
            <SelectValue placeholder={dropdownPlaceholder} />
          </SelectTrigger>
          <SelectContent />
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            /* download placeholder — wired with chart in follow-up */
          }}
          className={`${buttonSize} p-0 hover:bg-gray-100 dark:hover:bg-gray-700`}
          title="Download"
          data-testid={`button-download-${testId}`}
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
            <div className="flex-1 min-h-0">{children}</div>
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
              {children}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
