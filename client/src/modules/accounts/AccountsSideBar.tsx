import {
  Coins,
  Grid3x3,
  ScrollText,
  Settings,
  Calculator,
  FileSpreadsheet,
  Send,
  Wallet,
  Repeat,
  Receipt,
  BarChart3,
  Lock,
} from "lucide-react";
import { useViewport, getLayoutConfig } from "@/hooks/useViewport";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SideItem = {
  name: string;
  icon: React.ReactNode;
  page: string;
};

type SideSection = {
  label: string;
  items: SideItem[];
};

const iconClass = "text-white";

const ACTIVE_SECTIONS: SideSection[] = [
  {
    label: "Master Tables",
    items: [
      {
        name: "Pay Elements",
        icon: <Coins size={20} className={iconClass} />,
        page: "pay-elements",
      },
      {
        name: "Wage Scales",
        icon: <Grid3x3 size={20} className={iconClass} />,
        page: "wage-scales",
      },
      {
        name: "CBA Reference",
        icon: <ScrollText size={20} className={iconClass} />,
        page: "cba-reference",
      },
    ],
  },
  {
    label: "Payroll",
    items: [
      {
        name: "Payroll Run",
        icon: <Calculator size={20} className={iconClass} />,
        page: "payroll-run",
      },
      {
        name: "Portage Bill",
        icon: <FileSpreadsheet size={20} className={iconClass} />,
        page: "portage-bill",
      },
      {
        name: "Monthly Txns",
        icon: <Repeat size={20} className={iconClass} />,
        page: "monthly-transactions",
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        name: "Tenant Config",
        icon: <Settings size={20} className={iconClass} />,
        page: "tenant-config",
      },
    ],
  },
];

const COMING_SOON: SideItem[] = [
  { name: "Allotments", icon: <Send size={20} />, page: "allotments" },
  { name: "Cash & Bond", icon: <Wallet size={20} />, page: "cash-bond" },
  { name: "Settlements", icon: <Receipt size={20} />, page: "settlements" },
  { name: "Reports", icon: <BarChart3 size={20} />, page: "reports" },
];

type AccountsSideBarProps = {
  selected: string;
  setSelected: (page: string) => void;
  allowedPages: string[];
};

export default function AccountsSideBar({
  selected,
  setSelected,
  allowedPages,
}: AccountsSideBarProps) {
  const viewport = useViewport();
  const layoutConfig = getLayoutConfig(viewport);
  const isCompact = layoutConfig.sidebarMode === "compact";
  const sidebarWidth = layoutConfig.sidebarWidth;
  const itemHeight = isCompact ? "56px" : "72px";

  const sections = ACTIVE_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => allowedPages.includes(i.page)),
  })).filter((s) => s.items.length > 0);

  return (
    <TooltipProvider>
      <aside
        className="fixed left-0 top-[67px] h-[calc(100vh-67px)] z-50 flex flex-col overflow-y-auto bg-[#16569e] transition-all duration-200"
        style={{ width: `${sidebarWidth}px` }}
        data-testid="accounts-sidebar"
      >
        {sections.map((section) => (
          <div key={section.label} className="w-full flex flex-col">
            {!isCompact && (
              <div
                className="px-1 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-wide text-white/60 text-center"
                data-testid={`sidebar-section-${section.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {section.label}
              </div>
            )}
            {section.items.map((item) => (
              <Tooltip key={item.page} delayDuration={0}>
                <TooltipTrigger asChild>
                  <div
                    className={`w-full flex flex-col items-center justify-center cursor-pointer flex-shrink-0 transition-all duration-200 ${
                      selected === item.page
                        ? "bg-[#52baf3]"
                        : "bg-[#16569e] hover:bg-[#1e5fa8]"
                    }`}
                    style={{ height: itemHeight }}
                    onClick={() => setSelected(item.page)}
                    data-testid={`sidebar-${item.page}`}
                  >
                    <div className="text-white text-[10px] font-normal flex flex-col items-center justify-center text-center">
                      <div className={isCompact ? "" : "mb-1"}>{item.icon}</div>
                      {!isCompact && (
                        <div className="leading-tight break-words max-w-full px-1">
                          {item.name}
                        </div>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                {isCompact && (
                  <TooltipContent
                    side="right"
                    className="bg-[#16569e] text-white border-none"
                  >
                    {item.name}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>
        ))}

        <div className="w-full flex flex-col border-t border-white/10 mt-1">
          {!isCompact && (
            <div className="px-1 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-wide text-white/40 text-center">
              Coming Soon
            </div>
          )}
          {COMING_SOON.map((item) => (
            <Tooltip key={item.page} delayDuration={0}>
              <TooltipTrigger asChild>
                <div
                  className="w-full flex flex-col items-center justify-center flex-shrink-0 cursor-not-allowed bg-[#16569e] opacity-40 relative"
                  style={{ height: itemHeight }}
                  data-testid={`sidebar-comingsoon-${item.page}`}
                  aria-disabled="true"
                >
                  <div className="text-white/70 text-[10px] font-normal flex flex-col items-center justify-center text-center">
                    <div className={isCompact ? "" : "mb-1"}>
                      {item.icon}
                    </div>
                    {!isCompact && (
                      <div className="leading-tight break-words max-w-full px-1">
                        {item.name}
                      </div>
                    )}
                  </div>
                  <Lock
                    size={9}
                    className="absolute top-1 right-1 text-white/70"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-[#16569e] text-white border-none"
              >
                {item.name} — coming soon
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="w-full flex-1 bg-[#16569e]" />
      </aside>
    </TooltipProvider>
  );
}
