import { File, UserPlus, Users, AlignJustify, Grid3x3 } from 'lucide-react';
import React from 'react'
import { useViewport, getLayoutConfig } from '@/hooks/useViewport';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type SideBarComponentProps = {
    selectedAdminPage: string;
    allowedPages: string[];
    setSelectedAdminPage: (page: string) => void;
    isMobileSidebarOpen?: boolean;
    onCloseMobileSidebar?: () => void;
};

const sideBarList: { name: string; icon: React.ReactNode; page: string }[] = [
    {
        name: "All",
        icon: <UserPlus size={20} className='text-white' />,
        page: "all"
    },
    {
        name: "Forms",
        icon: <File size={20} className='text-white' />,
        page: "forms"
    },
    {
        name: "Rank Admin",
        icon: <Users size={20} className='text-white' />,
        page: "rank-admin"
    },
    {
        name: "Masters",
        icon: <AlignJustify size={20} className='text-white' />,
        page: "masters"
    },
    {
        name: "Training Matrix",
        icon: <Grid3x3 size={20} className='text-white' />,
        page: "training-matrix"
    }
]

export default function SideBarComponent({ 
    selectedAdminPage, 
    setSelectedAdminPage, 
    allowedPages,
    isMobileSidebarOpen: _isMobileSidebarOpen,
    onCloseMobileSidebar: _onCloseMobileSidebar
}: SideBarComponentProps) {
    const viewport = useViewport();
    const layoutConfig = getLayoutConfig(viewport);
    const isCompact = layoutConfig.sidebarMode === 'compact';
    const sidebarWidth = layoutConfig.sidebarWidth;

    const filteredItems = sideBarList.filter(item => allowedPages.includes(item.page));

    return (
        <TooltipProvider>
            <aside 
                className="fixed left-0 top-[67px] h-[calc(100vh-67px)] z-50 flex flex-col transition-all duration-200"
                style={{ width: `${sidebarWidth}px` }}
                data-testid="sidebar-desktop"
            >
                {filteredItems.map(item => (
                    <Tooltip key={item.page} delayDuration={0}>
                        <TooltipTrigger asChild>
                            <div
                                className={`w-full flex flex-col items-center justify-center cursor-pointer flex-shrink-0 transition-all duration-200 ${
                                    selectedAdminPage === item.page ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
                                }`}
                                style={{ height: isCompact ? '56px' : '79px' }}
                                onClick={() => setSelectedAdminPage(item.page)}
                                data-testid={`sidebar-item-${item.page}`}
                            >
                                <div className="text-white text-[10px] font-normal font-['Roboto',Helvetica] flex flex-col items-center justify-center text-center">
                                    <div className={isCompact ? '' : 'mb-1'}>
                                        {item.icon}
                                    </div>
                                    {!isCompact && (
                                        <div className="leading-tight break-words hyphens-auto max-w-full">
                                            {item.name}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TooltipTrigger>
                        {isCompact && (
                            <TooltipContent side="right" className="bg-[#16569e] text-white border-none">
                                {item.name}
                            </TooltipContent>
                        )}
                    </Tooltip>
                ))}
                <div className="w-full flex-1 bg-[#16569e]" />
            </aside>
        </TooltipProvider>
    );
}
