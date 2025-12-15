import { useState, useEffect } from 'react';

export type ViewportSize = 'desktop' | 'laptop' | 'tablet' | 'phone';

export const useViewport = (): ViewportSize => {
  const [viewport, setViewport] = useState<ViewportSize>('desktop');

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      
      // Desktop: 1440px+ (Full HD and above)
      // Laptop: 1280px-1439px (Standard laptop screens)
      // Tablet: 768px-1279px (iPad landscape and similar, includes 1024px)
      // Phone: below 768px
      if (width >= 1440) {
        setViewport('desktop');
      } else if (width >= 1280) {
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

export const getLayoutConfig = (viewport: ViewportSize) => {
  const isDesktopOrLaptop = viewport === 'desktop' || viewport === 'laptop';
  const isCompact = viewport === 'tablet' || viewport === 'phone';
  
  return {
    showFixedSidebar: true,
    sidebarMode: isDesktopOrLaptop ? 'full' : 'compact' as 'full' | 'compact',
    sidebarWidth: isDesktopOrLaptop ? 67 : 56,
    mainMarginLeft: isDesktopOrLaptop ? 67 : 56,
    mainPadding: viewport === 'phone' ? 8 : viewport === 'tablet' ? 12 : 24,
    headerHeight: 67,
    showMobileSidebarToggle: false,
    showSidebarLabels: isDesktopOrLaptop,
  };
};