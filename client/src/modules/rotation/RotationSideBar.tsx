import { CalendarClock, CalendarRange, BadgeCheck } from 'lucide-react';
import React from 'react';

type RotationSideBarProps = {
    selectedRotationPage: string;
    allowedPages: string[];
    setSelectedRotationPage: (page: string) => void;
};

const rotationSideBarList: { name: string; icon: React.ReactNode; page: string }[] = [
    {
        name: "Due",
        icon: <CalendarClock size={20} className='text-white' />,
        page: "due"
    },
    {
        name: "Plan",
        icon: <CalendarRange size={20} className='text-white' />,
        page: "plan"
    },
    {
        name: "Approval",
        icon: <BadgeCheck size={20} className='text-white' />,
        page: "approval"
    }
];

export default function RotationSideBar({ selectedRotationPage, setSelectedRotationPage, allowedPages }: RotationSideBarProps) {
    return (
        <>
            <aside className="w-[67px] absolute left-0 top-[67px] h-[calc(100vh-67px)] z-50">
                {
                    rotationSideBarList.filter(item => allowedPages.includes(item.page)).map(item => (
                        <div
                            key={item.page}
                            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer px-1 ${
                                selectedRotationPage === item.page ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
                            }`}
                            onClick={() => setSelectedRotationPage(item.page)}
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
