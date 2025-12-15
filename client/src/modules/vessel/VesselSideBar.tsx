import { Ship } from 'lucide-react';
import React from 'react';
import { useViewport, getLayoutConfig } from '@/hooks/useViewport';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type VesselSideBarProps = {
    selectedVesselPage: string;
    allowedPages: string[];
    setSelectedVesselPage: (page: string) => void;
};

const vesselSideBarList: { name: string; icon: React.ReactNode; page: string }[] = [
    {
        name: "Vessel Database",
        icon: <Ship size={20} className='text-white' />,
        page: "vessel-database"
    }
];

export default function VesselSideBar({ selectedVesselPage, setSelectedVesselPage, allowedPages }: VesselSideBarProps) {
    const viewport = useViewport();
    const layoutConfig = getLayoutConfig(viewport);
    const isCompact = layoutConfig.sidebarMode === 'compact';
    const sidebarWidth = layoutConfig.sidebarWidth;

    return (
        <TooltipProvider>
            <aside 
                className="fixed left-0 top-[67px] h-[calc(100vh-67px)] z-50 flex flex-col transition-all duration-200"
                style={{ width: `${sidebarWidth}px` }}
            >
                {
                    vesselSideBarList.filter(item => allowedPages.includes(item.page)).map(item => (
                        <Tooltip key={item.page} delayDuration={0}>
                            <TooltipTrigger asChild>
                                <div
                                    className={`w-full flex flex-col items-center justify-center cursor-pointer flex-shrink-0 transition-all duration-200 ${
                                        selectedVesselPage === item.page ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
                                    }`}
                                    style={{ height: isCompact ? '56px' : '79px' }}
                                    onClick={() => setSelectedVesselPage(item.page)}
                                    data-testid={`sidebar-${item.page}`}
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
                    ))
                }

                {/* Dark blue section for rest of sidebar */}
                <div className="w-full flex-1 bg-[#16569e]" />
            </aside>
        </TooltipProvider>
    );
}
