import {
  Coins,
  Grid3x3,
  ScrollText,
  Settings,
  Calculator,
  FileSpreadsheet,
  Wallet,
  Repeat,
  Receipt,
  BarChart3,
  BookText,
  FileText,
  Ship,
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
  /** null = no heading (the top, most-used group) */
  label: string | null;
  items: SideItem[];
};

const iconClass = "text-white";

// Ordered by frequency of use: monthly screens on top, reports next,
// onboarding/setup screens at the bottom. A "Contracts" entry will be
// inserted after "Allotments & Cash" by a later task.
const ACTIVE_SECTIONS: SideSection[] = [
  {
    label: null,
    items: [
      {
        name: "Payroll Run",
        icon: <Calculator size={20} className={iconClass} />,
        page: "payroll-run",
      },
      {
        name: "Vessel Portage",
        icon: <Ship size={20} className={iconClass} />,
        page: "vessel-portage",
      },
      {
        name: "Monthly Txns",
        icon: <Repeat size={20} className={iconClass} />,
        page: "monthly-transactions",
      },
      {
        name: "Portage Bill",
        icon: <FileSpreadsheet size={20} className={iconClass} />,
        page: "portage-bill",
      },
      {
        name: "Settlements",
        icon: <Receipt size={20} className={iconClass} />,
        page: "settlements",
      },
      {
        name: "Allotments & Cash",
        icon: <Wallet size={20} className={iconClass} />,
        page: "allotments-cash",
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        name: "Payslips",
        icon: <FileText size={20} className={iconClass} />,
        page: "payslips",
      },
      {
        name: "GL Export",
        icon: <BookText size={20} className={iconClass} />,
        page: "gl-export",
      },
      {
        name: "Fleet Summary",
        icon: <BarChart3 size={20} className={iconClass} />,
        page: "fleet-summary",
      },
    ],
  },
  {
    label: "Config",
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
        name: "CBA Ref",
        icon: <ScrollText size={20} className={iconClass} />,
        page: "cba-reference",
      },
      {
        name: "Tenant Config",
        icon: <Settings size={20} className={iconClass} />,
        page: "tenant-config",
      },
    ],
  },
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
  const itemHeight = isCompact ? "56px" : "79px";

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
        {sections.map((section, sectionIdx) => (
          <div
            key={section.label ?? "main"}
            className="w-full flex flex-col"
          >
            {section.label !== null && !isCompact && (
              <div className="w-full px-1 pt-2 pb-1">
                <div className="border-t border-white/20 mb-1" />
                <div
                  className="text-[9px] font-semibold uppercase tracking-wide text-white/60 text-center"
                  data-testid={`sidebar-section-${section.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {section.label}
                </div>
              </div>
            )}
            {section.label !== null && isCompact && sectionIdx > 0 && (
              <div className="w-full px-2 py-1">
                <div className="border-t border-white/20" />
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

        <div className="w-full flex-1 bg-[#16569e]" />
      </aside>
    </TooltipProvider>
  );
}
