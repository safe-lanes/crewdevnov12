import { File, UserPlus, Users, AlignJustify, Grid3x3, X } from 'lucide-react';
import React from 'react'
import { useViewport, getLayoutConfig } from '@/hooks/useViewport';

type SideBarComponentProps = {
    selectedAdminPage: string;
    allowedPages: string[];
    setSelectedAdminPage: (page: string) => void;
    isMobileSidebarOpen?: boolean;
    onCloseMobileSidebar?: () => void;
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

export default function SideBarComponent({ 
    selectedAdminPage, 
    setSelectedAdminPage, 
    allowedPages,
    isMobileSidebarOpen = false,
    onCloseMobileSidebar
}: SideBarComponentProps) {
    const viewport = useViewport();
    const layoutConfig = getLayoutConfig(viewport);
    
    const handlePageSelect = (page: string) => {
        setSelectedAdminPage(page);
        if (onCloseMobileSidebar) {
            onCloseMobileSidebar();
        }
    };

    const filteredItems = sideBarList.filter(item => allowedPages.includes(item.page));

    if (layoutConfig.showFixedSidebar) {
        return (
            <aside 
                className="w-[67px] fixed left-0 top-[67px] h-[calc(100vh-67px)] z-50"
                data-testid="sidebar-desktop"
            >
                {filteredItems.map(item => (
                    <div
                        key={item.page}
                        className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer px-1 ${
                            selectedAdminPage === item.page ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
                        }`}
                        onClick={() => handlePageSelect(item.page)}
                        data-testid={`sidebar-item-${item.page}`}
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
                ))}
                <div className="w-full flex-1 bg-[#16569e]" />
            </aside>
        );
    }

    if (!isMobileSidebarOpen) {
        return null;
    }

    return (
        <>
            <div 
                className="fixed inset-0 top-[67px] bg-black bg-opacity-50 z-[60]"
                onClick={onCloseMobileSidebar}
                data-testid="sidebar-overlay"
            />
            <aside 
                className="fixed left-0 top-[67px] h-[calc(100vh-67px)] w-[200px] bg-[#16569e] z-[70] shadow-xl animate-in slide-in-from-left duration-200"
                data-testid="sidebar-mobile"
            >
                <div className="flex items-center justify-between p-3 border-b border-[#1e5fa8]">
                    <span className="text-white font-medium text-sm">Menu</span>
                    <button
                        onClick={onCloseMobileSidebar}
                        className="text-white hover:text-gray-200 p-1"
                        data-testid="sidebar-close-button"
                        aria-label="Close sidebar"
                    >
                        <X size={20} />
                    </button>
                </div>
                {filteredItems.map(item => (
                    <div
                        key={item.page}
                        className={`w-full py-4 px-4 flex items-center gap-3 cursor-pointer ${
                            selectedAdminPage === item.page 
                                ? "bg-[#52baf3]" 
                                : "hover:bg-[#1e5fa8]"
                        }`}
                        onClick={() => handlePageSelect(item.page)}
                        data-testid={`sidebar-mobile-item-${item.page}`}
                    >
                        <div className="text-white">
                            {item.icon}
                        </div>
                        <span className="text-white text-sm font-normal">
                            {item.name}
                        </span>
                    </div>
                ))}
            </aside>
        </>
    );
}
