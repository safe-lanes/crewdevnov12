import React, { useCallback } from 'react'
import { Link, useLocation } from 'wouter'
import { ModuleNavigator } from '../ModuleNavigator'
import HeaderComponent from '../Navbar/HeaderComponent';
import SideBarComponent from '../Navbar/SideBarComponent';

interface MainLayoutProps {
    children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
    return (
        <main className="ml-[67px] h-[calc(100vh-67px)] px-6 py-2 bg-[#f8fafc] overflow-y-auto">
            <div className="flex flex-col h-full">
                {children}
            </div>
        </main>
    )
}
