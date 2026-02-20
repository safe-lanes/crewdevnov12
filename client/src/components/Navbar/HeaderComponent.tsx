import { useState, useCallback } from 'react'
import { Link, useLocation } from 'wouter'
import { ModuleNavigator } from '../ModuleNavigator'
import { useViewport, getLayoutConfig } from '@/hooks/useViewport';
import { 
    LayoutGrid, 
    UserPlus,
    Users, 
    Ship, 
    Calendar, 
    TrendingUp, 
    FileText, 
    FlaskConical, 
    Clock, 
    BarChart3, 
    User, 
    Settings,
    Menu,
    X,
    PanelLeft
} from "lucide-react";

const navItems = [
    // Temporarily hidden - Dashboard
    // {
    //     label: "Dashboard",
    //     href: "/dashboard",
    //     icon: LayoutGrid,
    //     activeBg: "#5DADE2",
    //     activeText: "white",
    //     inactiveBg: "#f1f1f1",
    //     inactiveText: "#4f5863",
    // },
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
        icon: FlaskConical,
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
        href: "/accounts",
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

interface HeaderComponentProps {
    showSidebarToggle?: boolean;
    onSidebarToggle?: () => void;
    isSidebarOpen?: boolean;
}

export default function HeaderComponent({ 
    showSidebarToggle = false, 
    onSidebarToggle,
    isSidebarOpen = false
}: HeaderComponentProps) {
    const [location, navigate] = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const viewport = useViewport();
    const layoutConfig = getLayoutConfig(viewport);
    
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
            <header className="fixed top-0 left-0 right-0 w-full h-[67px] bg-[#f1f1f1] border-b-2 border-[#51baf4] z-[100]">
                <div className="flex items-center justify-between h-[65px] bg-[#f1f1f1]">
                    <div className="flex items-center h-full">
                        {showSidebarToggle && layoutConfig.showMobileSidebarToggle && (
                            <button
                                className="flex items-center justify-center w-10 h-10 ml-2 text-[#16569e] hover:bg-gray-200 rounded"
                                onClick={onSidebarToggle}
                                data-testid="sidebar-toggle-button"
                                aria-label="Toggle sidebar"
                            >
                                <PanelLeft size={24} />
                            </button>
                        )}
                        
                        <div className={`flex items-center ${showSidebarToggle && layoutConfig.showMobileSidebarToggle ? 'ml-1' : 'ml-2 sm:ml-4'}`}>
                            <Link to='/'>
                                <img
                                    className="w-10 h-8 sm:w-14 sm:h-10"
                                    alt="Logo"
                                    src="/figmaAssets/group-2.png"
                                    data-testid="header-logo"
                                />
                            </Link>
                        </div>

                        <div className="flex flex-col items-center justify-center w-[60px] sm:w-[80px] lg:w-[100px] h-full bg-[#f1f1f1] border-r border-gray-300 ml-2 sm:ml-4 lg:ml-8">
                            <ModuleNavigator
                                currentModule="crewing"
                                onModuleChange={handleModuleChange}
                            />
                        </div>
                    </div>

                    {/* Desktop navigation - full width, no scroll (xl and above) */}
                    <nav className="hidden xl:flex h-[65px] flex-1">
                        <div className="flex h-full">
                            {navItems.map(({ label, href, icon: Icon, activeBg, activeText, inactiveBg, inactiveText }) => {
                                const isActive = location === href;
                                return (
                                    <Link key={href} href={href}>
                                        <div
                                            className="flex flex-col items-center justify-center w-[100px] h-full border-r border-gray-300 cursor-pointer hover:bg-gray-300"
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

                    {/* Tablet navigation - horizontal scroll (md to lg, 768px-1279px) */}
                    <nav className="hidden md:flex xl:hidden h-[65px] flex-1 overflow-x-auto overflow-y-hidden" data-testid="tablet-nav">
                        <div className="flex h-full min-w-max">
                            {navItems.map(({ label, href, icon: Icon, activeBg, activeText, inactiveBg, inactiveText }) => {
                                const isActive = location === href;
                                return (
                                    <Link key={href} href={href}>
                                        <div
                                            className="flex flex-col items-center justify-center w-[80px] lg:w-[90px] h-full border-r border-gray-300 cursor-pointer hover:bg-gray-300 flex-shrink-0"
                                            style={{
                                                backgroundColor: isActive ? activeBg : inactiveBg,
                                            }}
                                            data-testid={`tablet-nav-${label.toLowerCase().replace(' ', '-')}`}
                                        >
                                            <Icon size={20} color={isActive ? activeText : "#6B7280"} className="mb-1" />
                                            <div
                                                className="text-[9px] lg:text-[10px] font-normal font-['Roboto',Helvetica] text-center"
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

                    {/* Hamburger menu button - phone only (below 768px) */}
                    <button
                        className="md:hidden flex items-center justify-center w-10 h-10 mr-2"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        data-testid="hamburger-menu-button"
                        aria-label="Toggle menu"
                    >
                        {isMobileMenuOpen ? (
                            <X size={24} className="text-gray-700" />
                        ) : (
                            <Menu size={24} className="text-gray-700" />
                        )}
                    </button>
                </div>
            </header>

            {/* Mobile dropdown menu - phone only (below 768px) */}
            {isMobileMenuOpen && (
                <nav 
                    className="md:hidden fixed top-[67px] left-0 right-0 bg-[#f1f1f1] border-b-2 border-[#51baf4] shadow-lg z-[99] max-h-[calc(100vh-67px)] overflow-y-auto" 
                    aria-label="Mobile navigation"
                    data-testid="mobile-nav-menu"
                >
                    <div className="grid grid-cols-3 gap-0">
                        {navItems.map(({ label, href, icon: Icon, activeBg, activeText, inactiveBg, inactiveText }) => {
                            const isActive = location === href;
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="flex flex-col items-center justify-center h-[60px] border-r border-b border-gray-300 cursor-pointer hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-[#51baf4] focus:ring-inset"
                                    style={{
                                        backgroundColor: isActive ? activeBg : inactiveBg,
                                    }}
                                    data-testid={`mobile-nav-${label.toLowerCase().replace(' ', '-')}`}
                                >
                                    <Icon size={20} color={isActive ? activeText : "#6B7280"} className="mb-1" />
                                    <div
                                        className="text-[8px] font-normal font-['Roboto',Helvetica] text-center px-1"
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

            {isMobileMenuOpen && (
                <div 
                    className="md:hidden fixed inset-0 top-[67px] bg-black bg-opacity-25 z-[98]"
                    onClick={() => setIsMobileMenuOpen(false)}
                    data-testid="menu-overlay"
                />
            )}
        </>
    )
}
