import { LayoutDashboard, FileText, Calendar } from 'lucide-react';

interface RestHoursSideBarProps {
    selectedRestHoursPage: string;
    setSelectedRestHoursPage: (page: string) => void;
    allowedPages: string[];
}

const restHoursSideBarList: { name: string; icon: React.ReactNode; page: string }[] = [
    {
        name: "Dashboard",
        icon: <LayoutDashboard size={20} className='text-white' />,
        page: "dashboard"
    },
    {
        name: "Record",
        icon: <FileText size={20} className='text-white' />,
        page: "record"
    },
    {
        name: "Plan",
        icon: <Calendar size={20} className='text-white' />,
        page: "plan"
    }
];

export default function RestHoursSideBar({ selectedRestHoursPage, setSelectedRestHoursPage, allowedPages }: RestHoursSideBarProps) {
    return (
        <>
            <aside className="w-[67px] absolute left-0 top-[67px] h-[calc(100vh-67px)] z-50">
                {
                    restHoursSideBarList.filter(item => allowedPages.includes(item.page)).map(item => (
                        <div
                            key={item.page}
                            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer px-1 ${
                                selectedRestHoursPage === item.page ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
                            }`}
                            onClick={() => setSelectedRestHoursPage(item.page)}
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
                <div className="w-full h-[calc(100%-237px)] bg-[#16569e]">
                </div>
            </aside>
        </>
    );
}
