import React, { useCallback } from 'react'
import { Link, useLocation } from 'wouter'
import { ModuleNavigator } from '../ModuleNavigator'
import { FileText, Star } from "lucide-react"; // Import icons

const navItems = [
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
        label: "Admin",
        href: "/admin",
        icon: Star,
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
            <header className="w-full h-[67px] bg-[#f1f1f1] border-b-2 border-[#5DADE2]">
                <div className="flex items-center h-full bg-[#f1f1f1]">
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
                    <nav className="flex ml-8">
                        {/* Module Navigator */}
                        <div className="flex flex-col items-center justify-center w-[100px] h-[67px] bg-[#f1f1f1] border-r border-gray-300">
                            <ModuleNavigator
                                currentModule="crewing"
                                onModuleChange={handleModuleChange}
                            />
                        </div>
                        <div className="flex">
                            {navItems.map(({ label, href, icon: Icon, activeBg, activeText, inactiveBg, inactiveText }) => {
                                const isActive = location === href;
                                return (
                                    <Link key={href} href={href}>
                                        <div
                                            className={`flex flex-col items-center justify-center w-[100px] h-[67px] border-r border-gray-300 cursor-pointer hover:bg-gray-300`}
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
