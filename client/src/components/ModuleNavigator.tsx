import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
interface ModuleNavigatorProps {
  currentModule: string;
    onModuleChange: (moduleId: string) => void;
}
export function ModuleNavigator({ currentModule, onModuleChange }: ModuleNavigatorProps) {
  const [, setLocation] = useLocation();
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  let portNumber = window.location.port;
  portNumber = portNumber ? `:${portNumber}` : ''
  const fullUrl = `${protocol}//${hostname}${portNumber}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex flex-col items-center justify-center cursor-pointer select-none">
          {/* Grid / Menu Icon */}
          <div className="w-6 h-6 mb-1">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" fill="#6B7280" />
              <rect x="14" y="3" width="7" height="7" rx="1" fill="#6B7280" />
              <rect x="3" y="14" width="7" height="7" rx="1" fill="#6B7280" />
              <rect x="14" y="14" width="7" height="7" rx="1" fill="#6B7280" />
            </svg>
          </div>

          <span className="text-[10px] text-gray-600">
            {currentModule}
          </span>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-40">
      <DropdownMenuItem
          onClick={() => {
            localStorage.setItem("selected_module", "U2FsdGVkX19gp34OrOluh/gJ6eeByT19nc8eMBUBsVE=");
            window.location.assign(`${fullUrl}/audit/dashboard/summary`);
          }}
          className="cursor-pointer"
        >
          Audit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
