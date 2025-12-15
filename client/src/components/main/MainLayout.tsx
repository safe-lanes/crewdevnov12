import React from 'react'
import { useViewport, getLayoutConfig } from '@/hooks/useViewport';

interface MainLayoutProps {
    children: React.ReactNode;
    hasSidebar?: boolean;
}

export default function MainLayout({ children, hasSidebar = false }: MainLayoutProps) {
    const viewport = useViewport();
    const layoutConfig = getLayoutConfig(viewport);
    
    const marginLeft = hasSidebar ? layoutConfig.sidebarWidth : 0;
    const padding = layoutConfig.mainPadding;

    return (
        <main 
            className="h-[calc(100vh-67px)] bg-[#f8fafc] overflow-y-auto transition-all duration-200"
            style={{ 
                marginLeft: `${marginLeft}px`,
                padding: `8px ${padding}px`
            }}
            data-testid="main-layout"
        >
            <div className="flex flex-col h-full">
                {children}
            </div>
        </main>
    )
}
