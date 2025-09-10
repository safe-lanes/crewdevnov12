import { File, UserPlus, Users, AlignJustify, Grid3x3 } from 'lucide-react';
import React from 'react'

type SideBarComponentProps = {
    selectedAdminPage: string;
    allowedPages: string[];
    setSelectedAdminPage: (page: string) => void;
};

const sideBarList: { name: string; icon: React.ReactNode; page: string }[] = [
    {
        name: "All",
        icon: <UserPlus size={20} className='mb-2' />,
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

export default function SideBarComponent({ selectedAdminPage, setSelectedAdminPage, allowedPages }: SideBarComponentProps) {
    return (
        <>
            <aside className="w-[67px] absolute left-0 top-[67px] h-[calc(100vh-67px)]">
                {
                    sideBarList.filter(item => allowedPages.includes(item.page)).map(item => (
                        <div
                            key={item.page}
                            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer px-1 ${selectedAdminPage === item.page ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
                                }`}
                            onClick={() => setSelectedAdminPage(item.page)}
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
    )
}
