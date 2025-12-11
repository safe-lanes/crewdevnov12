import { Ship } from 'lucide-react';
import React from 'react';

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
    return (
        <>
            <aside className="w-[67px] fixed left-0 top-[67px] h-[calc(100vh-67px)] z-50">
                {
                    vesselSideBarList.filter(item => allowedPages.includes(item.page)).map(item => (
                        <div
                            key={item.page}
                            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer px-1 ${
                                selectedVesselPage === item.page ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
                            }`}
                            onClick={() => setSelectedVesselPage(item.page)}
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
