import { Search } from 'lucide-react';
import React from 'react';

type CrewPoolSideBarProps = {
    selectedCrewPoolPage: string;
    allowedPages: string[];
    setSelectedCrewPoolPage: (page: string) => void;
};

const crewPoolSideBarList: { name: string; icon: React.ReactNode; page: string }[] = [
    {
        name: "Crew Database",
        icon: <Search size={20} className='mb-2' />,
        page: "crew-database"
    }
];

export default function CrewPoolSideBar({ selectedCrewPoolPage, setSelectedCrewPoolPage, allowedPages }: CrewPoolSideBarProps) {
    return (
        <>
            <aside className="w-[67px] absolute left-0 top-[67px] h-[calc(100vh-67px)]">
                {
                    crewPoolSideBarList.filter(item => allowedPages.includes(item.page)).map(item => (
                        <div
                            key={item.page}
                            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer ${
                                selectedCrewPoolPage === item.page ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
                            }`}
                            onClick={() => setSelectedCrewPoolPage(item.page)}
                            data-testid={`sidebar-${item.page}`}
                        >
                            <div className="flex flex-col items-center justify-center text-white text-[10px] font-normal font-['Roboto',Helvetica]">
                                <div className="mb-1">
                                    {item.icon}
                                </div>
                                <div className="text-center">
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