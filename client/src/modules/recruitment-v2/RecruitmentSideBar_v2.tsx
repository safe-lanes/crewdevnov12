import { Clock, CheckCircle, Users, XCircle } from 'lucide-react';
import { useViewport, getLayoutConfig } from '@/hooks/useViewport';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type RecruitmentSideBarV2Props = {
    selectedRecruitmentPage: string;
    allowedPages: string[];
    setSelectedRecruitmentPage: (page: string) => void;
};

const recruitmentSideBarList: { name: string; icon: React.ReactNode; page: string }[] = [
    {
        name: "In Progress",
        icon: <Clock size={20} className='text-white' />,
        page: "in-progress"
    },
    {
        name: "Recruited",
        icon: <CheckCircle size={20} className='text-white' />,
        page: "recruited"
    },
    {
        name: "Waitlist",
        icon: <Users size={20} className='text-white' />,
        page: "waitlist"
    },
    {
        name: "Rejected",
        icon: <XCircle size={20} className='text-white' />,
        page: "rejected"
    }
];

export default function RecruitmentSideBarV2({ selectedRecruitmentPage, setSelectedRecruitmentPage, allowedPages }: RecruitmentSideBarV2Props) {
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
                    recruitmentSideBarList.filter(item => allowedPages.includes(item.page)).map(item => (
                        <Tooltip key={item.page} delayDuration={0}>
                            <TooltipTrigger asChild>
                                <div
                                    className={`w-full flex flex-col items-center justify-center cursor-pointer flex-shrink-0 transition-all duration-200 ${
                                        selectedRecruitmentPage === item.page ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
                                    }`}
                                    style={{ height: isCompact ? '56px' : '79px' }}
                                    onClick={() => setSelectedRecruitmentPage(item.page)}
                                    data-testid={`sidebar-v2-${item.page}`}
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

                <div className="w-full flex-1 bg-[#16569e]" />
            </aside>
        </TooltipProvider>
    );
}
