import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Link, useLocation } from 'wouter'
import { ModuleNavigator } from '../ModuleNavigator'
import { useViewport, getLayoutConfig } from '@/hooks/useViewport';
import { getDecryptedLocalStorageItem, getDecryptedSessionStorageItem, deepParseJson } from '@/lib/encryptionService';
import { usePermissions } from '@/contexts/PermissionsContext';
import NotificationBell from '../NotificationBell';
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
    PanelLeft,
    LogOut,
    UsersRound,
    ClipboardList
} from "lucide-react";

const navItems = [
    {
        label: "Dashboard",
        href: "/dashboard",
        menuName: "Dashboard",
        icon: LayoutGrid,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Recruitment",
        href: "/recruitment",
        menuName: "Recruitment",
        icon: UserPlus,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Crew Pool",
        href: "/crew-pool",
        menuName: "Crew Pool",
        icon: Users,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Vessel",
        href: "/vessel",
        menuName: "Vessel",
        icon: Ship,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Rotation",
        href: "/rotation",
        menuName: "Rotation",
        icon: Calendar,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Promotions",
        href: "/promotions",
        menuName: "Promotions",
        icon: TrendingUp,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Appraisals",
        href: "/",
        menuName: "Crewing",
        icon: FileText,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Drugs Alcohol",
        href: "/drugs-alcohol",
        menuName: "Drugs Alcohol",
        icon: FlaskConical,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Rest Hours",
        href: "/rest-hours",
        menuName: "Rest Hours",
        icon: Clock,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Training & Ret.",
        href: "/training-retention",
        menuName: "Training & Ret.",
        icon: UsersRound,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    {
        label: "Reports",
        href: "/reports",
        menuName: "Reports",
        icon: BarChart3,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    // Temporarily hidden - Account
    // {
    //     label: "Account",
    //     href: "/accounts",
    //     menuName: "Account",
    //     icon: User,
    //     activeBg: "#5DADE2",
    //     activeText: "white",
    //     inactiveBg: "#f1f1f1",
    //     inactiveText: "#4f5863",
    // },
    {
        label: "Admin",
        href: "/admin",
        menuName: "Admin",
        icon: Settings,
        activeBg: "#5DADE2",
        activeText: "white",
        inactiveBg: "#f1f1f1",
        inactiveText: "#4f5863",
    },
    // Test Cases menu hidden — page is reachable only via direct /test-cases URL.
    // Preserved for later restore.
    // {
    //     label: "Test Cases",
    //     href: "/test-cases",
    //     menuName: "Test Cases",
    //     icon: ClipboardList,
    //     activeBg: "#5DADE2",
    //     activeText: "white",
    //     inactiveBg: "#f1f1f1",
    //     inactiveText: "#4f5863",
    // },
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
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const viewport = useViewport();
    const layoutConfig = getLayoutConfig(viewport);
    const { canView, permissions } = usePermissions();

    const filteredNavItems = useMemo(() => {
        if (permissions.length === 0) return navItems;
        return navItems.filter(item => canView(item.menuName));
    }, [permissions, canView]);

    const extractStringValue = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (typeof val === 'object') {
            return val.name || val.userName || val.fullName || val.displayName || JSON.stringify(val);
        }
        return String(val);
    };

    const getInitials = (name: string): string => {
        if (!name) return 'UN';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const [userName, setUserName] = useState('');
    const [domain, setDomain] = useState('');

    useEffect(() => {
        const resolveUserName = (): string => {
            try {
                const rawProfile = getDecryptedLocalStorageItem('userProfile', true);
                const profile = deepParseJson(rawProfile);
                if (profile && typeof profile === 'object') {
                    const first = profile.firstname || profile.firstName || '';
                    const last = profile.lastname || profile.lastName || '';
                    if (first || last) return `${first} ${last}`.trim();
                }
                const decrypted = getDecryptedSessionStorageItem('crewUserName', true);
                if (decrypted) return extractStringValue(decrypted);
                const plain = sessionStorage.getItem('crewUserName');
                if (plain) return plain;
                const decryptedLS = getDecryptedLocalStorageItem('userName', true);
                if (decryptedLS) return extractStringValue(decryptedLS);
                return localStorage.getItem('userName') || '';
            } catch {
                return sessionStorage.getItem('crewUserName') || localStorage.getItem('userName') || '';
            }
        };

        const resolveDomain = (): string => {
            try {
                const decrypted = getDecryptedLocalStorageItem('domain', true);
                if (decrypted) return extractStringValue(decrypted);
                return localStorage.getItem('domain') || '';
            } catch {
                return localStorage.getItem('domain') || '';
            }
        };

        setUserName(resolveUserName());
        setDomain(resolveDomain());
    }, [isProfileOpen]);

    const initials = getInitials(userName);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        let portNumber = window.location.port;
        portNumber = portNumber ? `:${portNumber}` : ''
        const fullUrl = `${protocol}//${hostname}${portNumber}`;
        setIsProfileOpen(false);
        const authKeys = ['crewUserName', 'crewUserId', 'userName', 'domain', 'token', 'accessToken', 'refreshToken', 'authToken', 'sessionId'];
        // authKeys.forEach(key => {
        //     localStorage.removeItem(key);
        //     sessionStorage.removeItem(key);
        // });
        sessionStorage.clear();
        localStorage.clear();
        window.location.assign(`${fullUrl}/login`)
    };

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
                                currentModule="Crewing"
                                onModuleChange={handleModuleChange}
                            />
                        </div>
                    </div>

                    {/* Desktop navigation - full width, no scroll (xl and above) */}
                    <nav className="hidden xl:flex h-[65px] flex-1">
                        <div className="flex h-full">
                            {filteredNavItems.map(({ label, href, icon: Icon, activeBg, activeText, inactiveBg, inactiveText }) => {
                                const isActive = href === "/" ? location === "/" : location.startsWith(href);
                                return (
                                    <Link key={href} href={href}>
                                        <div
                                            className="flex flex-col items-center justify-center w-[100px] h-full cursor-pointer hover:bg-gray-300"
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
                            {filteredNavItems.map(({ label, href, icon: Icon, activeBg, activeText, inactiveBg, inactiveText }) => {
                                const isActive = href === "/" ? location === "/" : location.startsWith(href);
                                return (
                                    <Link key={href} href={href}>
                                        <div
                                            className="flex flex-col items-center justify-center w-[80px] lg:w-[90px] h-full cursor-pointer hover:bg-gray-300 flex-shrink-0"
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

                    {/* Notification Bell & User Profile Avatar */}
                    <div className="flex items-center gap-3 mr-2 sm:mr-4">
                        <NotificationBell />

                        <div className="relative flex items-center" ref={profileRef}>
                            <button
                                className="flex items-center justify-center w-10 h-10 rounded-full bg-[#16569e] text-white text-sm font-semibold cursor-pointer border-2 border-transparent hover:border-[#51baf4] transition-colors"
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                data-testid="button-user-profile"
                                aria-label="User profile menu"
                            >
                                {initials}
                            </button>
                            {isProfileOpen && (
                                <div
                                    className="absolute right-0 top-[50px] w-[240px] bg-white rounded-md shadow-lg border border-gray-200 z-[200] py-1"
                                    data-testid="dropdown-user-profile"
                                >
                                    <div className="px-5 py-3">
                                        <span className="text-sm text-gray-600 font-['Roboto',Helvetica]">User Name :  </span>
                                        <span className="text-sm font-bold text-gray-900 font-['Roboto',Helvetica]" data-testid="text-user-name">{userName || '-'}</span>
                                    </div>
                                    <div className="px-5 py-3 border-b border-gray-200">
                                        <span className="text-sm text-gray-600 font-['Roboto',Helvetica]">Domain Name :  </span>
                                        <span className="text-sm font-bold text-gray-900 font-['Roboto',Helvetica]" data-testid="text-domain-name">{domain || '-'}</span>
                                    </div>
                                    <button
                                        className="flex items-center gap-2 w-full px-5 py-3 text-sm text-gray-800 font-['Roboto',Helvetica] hover:bg-gray-100 cursor-pointer"
                                        onClick={handleLogout}
                                        data-testid="button-logout"
                                    >
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

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
                        {filteredNavItems.map(({ label, href, icon: Icon, activeBg, activeText, inactiveBg, inactiveText }) => {
                            const isActive = href === "/" ? location === "/" : location.startsWith(href);
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
