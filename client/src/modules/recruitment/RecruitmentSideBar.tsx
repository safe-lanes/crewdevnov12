import { Clock, CheckCircle, Users, XCircle } from 'lucide-react';
import React from 'react';

type RecruitmentSideBarProps = {
    selectedRecruitmentPage: string;
    allowedPages: string[];
    setSelectedRecruitmentPage: (page: string) => void;
};

const recruitmentSideBarList: { name: string; icon: React.ReactNode; page: string }[] = [
    {
        name: "In Progress",
        icon: <Clock size={20} className='mb-2' />,
        page: "in-progress"
    },
    {
        name: "Recruited",
        icon: <CheckCircle size={20} className='mb-2' />,
        page: "recruited"
    },
    {
        name: "Waitlist",
        icon: <Users size={20} className='mb-2' />,
        page: "waitlist"
    },
    {
        name: "Rejected",
        icon: <XCircle size={20} className='mb-2' />,
        page: "rejected"
    }
];

export default function RecruitmentSideBar({ selectedRecruitmentPage, setSelectedRecruitmentPage, allowedPages }: RecruitmentSideBarProps) {
    return (
        <>
            <aside className="w-[67px] absolute left-0 top-[67px] h-[calc(100vh-67px)]">
                {
                    recruitmentSideBarList.filter(item => allowedPages.includes(item.page)).map(item => (
                        <div
                            key={item.page}
                            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer ${selectedRecruitmentPage === item.page ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
                                }`}
                            onClick={() => setSelectedRecruitmentPage(item.page)}
                        >
                            <div className="text-white text-[10px] font-normal font-['Roboto',Helvetica]">
                                {item.icon}
                                {item.name}
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