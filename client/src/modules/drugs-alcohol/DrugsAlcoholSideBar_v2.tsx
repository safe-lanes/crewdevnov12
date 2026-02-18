import { Calendar, CalendarClock, CalendarDays, AlertTriangle, MoreHorizontal, BarChart3 } from 'lucide-react';
import React from 'react';
import { useViewport, getLayoutConfig } from '@/hooks/useViewport';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type DrugsAlcoholSideBarProps = {
    selectedDrugsAlcoholPage: string;
    allowedPages: string[];
    setSelectedDrugsAlcoholPage: (page: string) => void;
};

const drugsAlcoholSideBarList: { name: string; icon: React.ReactNode; page: string }[] = [
    {
        name: "Annual",
        icon: <Calendar size={20} className='text-white' />,
        page: "annual"
    },
    {
        name: "Periodic",
        icon: <CalendarClock size={20} className='text-white' />,
        page: "periodic"
    },
    {
        name: "Monthly",
        icon: <CalendarDays size={20} className='text-white' />,
        page: "monthly"
    },
    {
        name: "Post Incident",
        icon: <AlertTriangle size={20} className='text-white' />,
        page: "post-incident"
    },
    {
        name: "Others",
        icon: <MoreHorizontal size={20} className='text-white' />,
        page: "others"
    },
    {
        name: "Summary",
        icon: <BarChart3 size={20} className='text-white' />,
        page: "summary"
    }
];

export default function DrugsAlcoholSideBar({ selectedDrugsAlcoholPage, setSelectedDrugsAlcoholPage, allowedPages }: DrugsAlcoholSideBarProps) {
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
                    drugsAlcoholSideBarList.filter(item => allowedPages.includes(item.page)).map(item => (
                        <Tooltip key={item.page} delayDuration={0}>
                            <TooltipTrigger asChild>
                                <div
                                    className={`w-full flex flex-col items-center justify-center cursor-pointer flex-shrink-0 transition-all duration-200 ${
                                        selectedDrugsAlcoholPage === item.page ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
                                    }`}
                                    style={{ height: isCompact ? '56px' : '79px' }}
                                    onClick={() => setSelectedDrugsAlcoholPage(item.page)}
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
