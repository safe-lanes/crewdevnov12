import { useState, useEffect } from 'react';

export type ViewportSize = 'desktop' | 'laptop' | 'tablet' | 'phone';

export const useViewport = (): ViewportSize => {
  const [viewport, setViewport] = useState<ViewportSize>('desktop');

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      
      if (width >= 1920) {
        setViewport('desktop');
      } else if (width >= 1366) {
        setViewport('laptop');
      } else if (width >= 768) {
        setViewport('tablet');
      } else {
        setViewport('phone');
      }
    };

    // Set initial viewport
    updateViewport();

    // Add event listener
    window.addEventListener('resize', updateViewport);

    // Cleanup
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  return viewport;
};

export const getViewportConfig = (viewport: ViewportSize) => ({
  isDesktopOrLaptop: viewport === 'desktop' || viewport === 'laptop',
  isTabletOrPhone: viewport === 'tablet' || viewport === 'phone',
  showSideBar: viewport === 'desktop' || viewport === 'laptop',
  showStatusBar: viewport === 'desktop' || viewport === 'laptop',
  showFloatingFilters: viewport === 'desktop' || viewport === 'laptop',
  useFitColumns: viewport === 'desktop' || viewport === 'laptop',
  minColumnWidth: viewport === 'tablet' || viewport === 'phone' ? 120 : 70,
  rowHeight: viewport === 'phone' ? 60 : 50,
  headerHeight: viewport === 'phone' ? 40 : 50,
  alwaysShowHorizontalScroll: viewport === 'tablet' || viewport === 'phone'
});

export const getLayoutConfig = (viewport: ViewportSize) => ({
  showFixedSidebar: viewport === 'desktop' || viewport === 'laptop',
  sidebarWidth: viewport === 'desktop' || viewport === 'laptop' ? 67 : 0,
  mainMarginLeft: viewport === 'desktop' || viewport === 'laptop' ? 67 : 0,
  mainPadding: viewport === 'phone' ? 12 : viewport === 'tablet' ? 16 : 24,
  headerHeight: 67,
  showMobileSidebarToggle: viewport === 'tablet' || viewport === 'phone',
});