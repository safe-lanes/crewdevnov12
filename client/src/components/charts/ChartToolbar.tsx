import { useState, useCallback } from 'react';
import { Download, Maximize2, BarChart3, LineChart, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AgChartInstance } from '@/lib/agCharts';

export type ChartType = 'bar' | 'line' | 'pie';

interface ChartToolbarProps {
  chartRef?: React.RefObject<AgChartInstance>;
  chartTitle?: string;
  chartType?: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
  onDownload?: () => void;
  onFullscreen?: () => void;
  showChartTypeSelector?: boolean;
}

export const ChartToolbar = ({ 
  chartRef, 
  chartTitle = 'chart', 
  chartType = 'bar',
  onChartTypeChange,
  onDownload, 
  onFullscreen,
  showChartTypeSelector = false
}: ChartToolbarProps) => {
  const [showFullscreen, setShowFullscreen] = useState(false);

  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload();
    } else if (chartRef?.current) {
      // Use AG Charts built-in download method
      chartRef.current.download({
        fileName: `${chartTitle.replace(/\s+/g, '_').toLowerCase()}.png`,
      });
    }
  }, [chartRef, chartTitle, onDownload]);

  const handleFullscreen = useCallback(() => {
    if (onFullscreen) {
      onFullscreen();
    } else {
      setShowFullscreen(true);
    }
  }, [onFullscreen]);

  const getChartTypeIcon = (type: ChartType) => {
    switch (type) {
      case 'bar':
        return <BarChart3 className="h-3.5 w-3.5" />;
      case 'line':
        return <LineChart className="h-3.5 w-3.5" />;
      case 'pie':
        return <PieChart className="h-3.5 w-3.5" />;
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {showChartTypeSelector && onChartTypeChange && (
          <Select value={chartType} onValueChange={(value) => onChartTypeChange(value as ChartType)}>
            <SelectTrigger className="h-7 w-[90px] text-xs border-gray-300 dark:border-gray-600" data-testid="select-chart-type">
              <div className="flex items-center gap-1.5">
                {getChartTypeIcon(chartType)}
                <span className="capitalize">{chartType}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bar" className="text-xs">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Bar
                </div>
              </SelectItem>
              <SelectItem value="line" className="text-xs">
                <div className="flex items-center gap-2">
                  <LineChart className="h-3.5 w-3.5" />
                  Line
                </div>
              </SelectItem>
              <SelectItem value="pie" className="text-xs">
                <div className="flex items-center gap-2">
                  <PieChart className="h-3.5 w-3.5" />
                  Pie
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Download chart"
          data-testid="button-download-chart"
        >
          <Download className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleFullscreen}
          className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="View fullscreen"
          data-testid="button-fullscreen-chart"
        >
          <Maximize2 className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
        </Button>
      </div>

      {/* Fullscreen Modal */}
      {showFullscreen && (
        <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
          <DialogContent className="max-w-6xl w-[90vw] h-[85vh] p-6">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {chartTitle}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="h-8 gap-2"
                  data-testid="button-download-fullscreen"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
              <div className="flex-1 min-h-0 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                {/* Chart will be rendered here by parent component */}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
