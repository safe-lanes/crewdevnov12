import { useState, useRef, useCallback } from 'react';
import { Download, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { AgChartInstance } from '@/lib/agCharts';

interface ChartToolbarProps {
  chartRef?: React.RefObject<AgChartInstance>;
  chartTitle?: string;
  onDownload?: () => void;
  onFullscreen?: () => void;
}

export const ChartToolbar = ({ chartRef, chartTitle = 'chart', onDownload, onFullscreen }: ChartToolbarProps) => {
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

  return (
    <>
      <div className="flex items-center gap-1">
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
