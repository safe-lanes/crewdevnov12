import { Calendar, CalendarClock, CalendarDays, AlertTriangle, MoreHorizontal, BarChart3 } from 'lucide-react';
import React from 'react';

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
    return (
        <>
            <aside className="w-[67px] fixed left-0 top-[67px] h-[calc(100vh-67px)] z-50">
                {
                    drugsAlcoholSideBarList.filter(item => allowedPages.includes(item.page)).map(item => (
                        <div
                            key={item.page}
                            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer px-1 ${
                                selectedDrugsAlcoholPage === item.page ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
                            }`}
                            onClick={() => setSelectedDrugsAlcoholPage(item.page)}
                            data-testid={`sidebar-${item.page}`}
                        >
                            <div className="text-white text-[10px] font-normal font-['Roboto',Helvetica] flex flex-col items-center justify-center text-center">
                                <div className="mb-1">
                                    {item.icon}
                                </div>
                                <div className="leading-tight break-words hyphens-auto max-w-full">
                                    {item.name}
                                </div>
                            </div>
                        </div>
                    ))
                }

                {/* Dark blue section for rest of sidebar */}
                <div className="w-full h-[calc(100%-79px)] bg-[#16569e]">
                </div>
            </aside>
        </>
    );
}
