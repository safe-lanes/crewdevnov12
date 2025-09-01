import React, { useCallback } from 'react'
import { Link, useLocation } from 'wouter'
import { ModuleNavigator } from '../ModuleNavigator'
import { 
    LayoutGrid, 
    Users, 
    Ship, 
    Calendar, 
    TrendingUp, 
    FileText, 
    TestTube, 
    Clock, 
    BarChart3, 
    User, 
    Settings 
} from "lucide-react"; // Import icons

const navItems = [
    {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutGrid,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Crew Pool",
        href: "/crew-pool",
        icon: Users,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Vessel",
        href: "/vessel",
        icon: Ship,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Rotation",
        href: "/rotation",
        icon: Calendar,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Promotions",
        href: "/promotions",
        icon: TrendingUp,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Appraisals",
        href: "/",
        icon: FileText,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Drugs Alcohol",
        href: "/drugs-alcohol",
        icon: TestTube,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Rest Hours",
        href: "/rest-hours",
        icon: Clock,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Reports",
        href: "/reports",
        icon: BarChart3,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Account",
        href: "/account",
        icon: User,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Admin",
        href: "/admin",
        icon: Settings,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
];
export default function HeaderComponent() {
    const [location, navigate] = useLocation();
    const handleModuleChange = useCallback((moduleId: string) => {
        switch (moduleId) {
            case "crewing":
                navigate("/");
                break;
            case "technical-pms":
                navigate("/technical-pms");
                break;
            default:
                navigate("/");
        }
    }, [navigate]);
    return (
        <>
            {/* Header */}
            <header className="w-full h-[67px] bg-[#f1f1f1] border-b-2 border-[#51baf4]">
                <div className="flex items-center h-[65px] bg-[#f1f1f1]">
                    {/* Logo */}
                    <div className="flex items-center ml-4">
                        <Link to='/'>
                            <img
                                className="w-14 h-10"
                                alt="Logo"
                                src="/figmaAssets/group-2.png"
                            />
                        </Link>
                    </div>

                    {/* Navigation Menu */}
                    <nav className="flex ml-8 h-[65px]">
                        {/* Module Navigator */}
                        <div className="flex flex-col items-center justify-center w-[100px] h-full bg-[#f1f1f1] border-r border-gray-300">
                            <ModuleNavigator
                                currentModule="crewing"
                                onModuleChange={handleModuleChange}
                            />
                        </div>
                        <div className="flex h-full">
                            {navItems.map(({ label, href, icon: Icon, activeBg, activeText, inactiveBg, inactiveText }) => {
                                const isActive = location === href;
                                return (
                                    <Link key={href} href={href}>
                                        <div
                                            className={`flex flex-col items-center justify-center w-[100px] h-full border-r border-gray-300 cursor-pointer hover:bg-gray-300`}
                                            style={{
                                                backgroundColor: isActive ? activeBg : inactiveBg,
                                            }}
                                        >
                                            <Icon size={24} color={isActive ? activeText : "#6B7280"} className="mb-1" />
                                            <div
                                                className="text-[10px] font-normal font-['Roboto',Helvetica]"
                                                style={{ color: isActive ? activeText : inactiveText }}
                                            >
                                                {label}
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>
                </div>
            </header>
        </>
    )
}
