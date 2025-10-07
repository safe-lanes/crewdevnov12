import { Users } from 'lucide-react';
import React from 'react';

type PromotionsSideBarProps = {
    selectedPromotionsPage: string;
    allowedPages: string[];
    setSelectedPromotionsPage: (page: string) => void;
};

const promotionsSideBarList: { name: string; icon: React.ReactNode; page: string }[] = [
    {
        name: "All",
        icon: <Users size={20} className='text-white' />,
        page: "all"
    }
];

export default function PromotionsSideBar({ selectedPromotionsPage, setSelectedPromotionsPage, allowedPages }: PromotionsSideBarProps) {
    return (
        <>
            <aside className="w-[67px] absolute left-0 top-[67px] h-[calc(100vh-67px)] z-50">
                {
                    promotionsSideBarList.filter(item => allowedPages.includes(item.page)).map(item => (
                        <div
                            key={item.page}
                            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer px-1 ${
                                selectedPromotionsPage === item.page ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
                            }`}
                            onClick={() => setSelectedPromotionsPage(item.page)}
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
