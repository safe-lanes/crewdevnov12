import { useState, useCallback } from 'react'
import { Link, useLocation } from 'wouter'
import { ModuleNavigator } from '../ModuleNavigator'
import { 
    LayoutGrid, 
    UserPlus,
    Users, 
    Ship, 
    Calendar, 
    TrendingUp, 
    FileText, 
    TestTube, 
    Clock, 
    BarChart3, 
    User, 
    Settings,
    Menu,
    X
} from "lucide-react";

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
        label: "Recruitment",
        href: "/recruitment",
        icon: UserPlus,
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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
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

    const handleNavClick = (href: string) => {
        setIsMobileMenuOpen(false);
        navigate(href);
    };

    return (
        <>
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 w-full h-[67px] bg-[#f1f1f1] border-b-2 border-[#51baf4] z-[100]">
                <div className="flex items-center justify-between h-[65px] bg-[#f1f1f1]">
                    {/* Left section: Logo + Module Navigator */}
                    <div className="flex items-center h-full">
                        {/* Logo */}
                        <div className="flex items-center ml-4">
                            <Link to='/'>
                                <img
                                    className="w-14 h-10"
                                    alt="Logo"
                                    src="/figmaAssets/group-2.png"
                                    data-testid="header-logo"
                                />
                            </Link>
                        </div>

                        {/* Module Navigator - always visible */}
                        <div className="flex flex-col items-center justify-center w-[80px] lg:w-[100px] h-full bg-[#f1f1f1] border-r border-gray-300 ml-4 lg:ml-8">
                            <ModuleNavigator
                                currentModule="crewing"
                                onModuleChange={handleModuleChange}
                            />
                        </div>
                    </div>

                    {/* Desktop Navigation Menu - hidden on smaller screens */}
                    <nav className="hidden xl:flex h-[65px] flex-1">
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
                                            data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
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

                    {/* Hamburger Menu Button - visible on smaller screens */}
                    <button
                        className="xl:hidden flex items-center justify-center w-12 h-12 mr-4"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        data-testid="hamburger-menu-button"
                        aria-label="Toggle menu"
                    >
                        {isMobileMenuOpen ? (
                            <X size={28} className="text-gray-700" />
                        ) : (
                            <Menu size={28} className="text-gray-700" />
                        )}
                    </button>
                </div>
            </header>

            {/* Mobile/Tablet Dropdown Menu */}
            {isMobileMenuOpen && (
                <nav className="xl:hidden fixed top-[67px] left-0 right-0 bg-[#f1f1f1] border-b-2 border-[#51baf4] shadow-lg z-[99] max-h-[calc(100vh-67px)] overflow-y-auto" aria-label="Mobile navigation">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-0">
                        {navItems.map(({ label, href, icon: Icon, activeBg, activeText, inactiveBg, inactiveText }) => {
                            const isActive = location === href;
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`flex flex-col items-center justify-center h-[70px] border-r border-b border-gray-300 cursor-pointer hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-[#51baf4] focus:ring-inset`}
                                    style={{
                                        backgroundColor: isActive ? activeBg : inactiveBg,
                                    }}
                                    data-testid={`mobile-nav-${label.toLowerCase().replace(' ', '-')}`}
                                >
                                    <Icon size={22} color={isActive ? activeText : "#6B7280"} className="mb-1" />
                                    <div
                                        className="text-[9px] sm:text-[10px] font-normal font-['Roboto',Helvetica] text-center px-1"
                                        style={{ color: isActive ? activeText : inactiveText }}
                                    >
                                        {label}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </nav>
            )}

            {/* Overlay to close menu when clicking outside */}
            {isMobileMenuOpen && (
                <div 
                    className="xl:hidden fixed inset-0 top-[67px] bg-black bg-opacity-25 z-[98]"
                    onClick={() => setIsMobileMenuOpen(false)}
                    data-testid="menu-overlay"
                />
            )}
        </>
    )
}
