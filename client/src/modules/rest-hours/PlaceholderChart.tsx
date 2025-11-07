import { useState } from 'react';
import { ChartToolbar } from '@/components/charts/ChartToolbar';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface PlaceholderChartProps {
  title: string;
  onRenderToolbar?: (toolbar: JSX.Element) => void;
}

export const PlaceholderChart = ({ title, onRenderToolbar }: PlaceholderChartProps) => {
  const [showFullscreen, setShowFullscreen] = useState(false);

  const handleDownload = () => {
    console.log(`Download triggered for: ${title}`);
    alert(`Download functionality will be implemented for ${title} chart`);
  };

  // Create toolbar element
  const toolbar = (
    <ChartToolbar 
      onDownload={handleDownload}
      onFullscreen={() => setShowFullscreen(true)}
      chartTitle={title}
    />
  );

  // Call onRenderToolbar if provided
  if (onRenderToolbar) {
    onRenderToolbar(toolbar);
  }

  return (
    <>
      <div className="w-full h-full min-h-0 flex flex-col">
        {/* Only render toolbar inline if onRenderToolbar is not provided */}
        {!onRenderToolbar && (
          <div className="flex justify-end mb-1">
            {toolbar}
          </div>
        )}
        <div className="flex-1 min-h-0 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {title}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Chart will be implemented here
            </p>
          </div>
        </div>
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-6xl w-[90vw] h-[85vh] p-6">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h2>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                data-testid="button-download-fullscreen"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
            <div className="flex-1 min-h-0 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-4 flex items-center justify-center">
              <div className="text-center">
                <p className="text-lg text-gray-500 dark:text-gray-400 mb-2">
                  {title}
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Fullscreen view - Chart will be implemented here
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
