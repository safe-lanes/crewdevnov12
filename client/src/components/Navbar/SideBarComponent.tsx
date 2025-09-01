import { File, UserPlus, Users, FileText } from 'lucide-react';
import React from 'react'

type SideBarComponentProps = {
    selectedAdminPage: string;
    allowedPages: string[];
    setSelectedAdminPage: (page: string) => void;
};

const sideBarList: { name: string; icon: React.ReactNode; page: string }[] = [
    {
        name: "All",
        icon: <Users size={18} className='mb-1' />,
        page: "all"
    },
    {
        name: "Forms",
        icon: <FileText size={18} className='mb-1' />,
        page: "forms"
    }
]

export default function SideBarComponent({ selectedAdminPage, setSelectedAdminPage, allowedPages }: SideBarComponentProps) {
    return (
        <>
            <aside className="w-[67px] absolute left-0 top-[67px] h-[calc(100vh-67px)]">
                {
                    sideBarList.filter(item => allowedPages.includes(item.page)).map((item, index) => (
                        <div
                            key={item.page}
                            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer transition-colors ${selectedAdminPage === item.page ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
                            }`}
                            onClick={() => setSelectedAdminPage(item.page)}
                        >
                            <div className="text-white text-[10px] font-normal font-['Roboto',Helvetica] flex flex-col items-center">
                                {item.icon}
                                <span className="mt-1">{item.name}</span>
                            </div>
                        </div>
                    ))
                }

                {/* Dark blue section for rest of sidebar */}
                <div className="w-full h-[calc(100%-79px)] bg-[#16569e]">
                </div>
            </aside>
        </>
    )
}
