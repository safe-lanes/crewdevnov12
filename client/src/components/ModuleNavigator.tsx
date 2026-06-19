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

  // Check conditions from localStorage and sessionStorage
  const isIncident = localStorage.getItem("isIncident") === "true";
  const isSafety = localStorage.getItem("isSafety") === "true";
  const technicalAccess = sessionStorage.getItem("technicalAccess") === "granted";
  const crewingAccess = sessionStorage.getItem("crewingAccess") === "granted";
  const userType = sessionStorage.getItem("userType");

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
      {currentModule !== "Audit" && (
        <DropdownMenuItem
          onClick={() => {
            localStorage.setItem("selected_module", "U2FsdGVkX19gp34OrOluh/gJ6eeByT19nc8eMBUBsVE=");
            window.location.assign(`${fullUrl}/audit/dashboard/summary`);
          }}
          className="cursor-pointer"
        >
          Audit
        </DropdownMenuItem>
      )}

        {isIncident && currentModule !== "Incident Investigation" && (
          <DropdownMenuItem
            onClick={() => {
              localStorage.setItem("selected_module", "U2FsdGVkX1+1tMb2pUA4bx7U+6hcIsaruuPbgkzlDJA=");
              window.location.assign(`${fullUrl}/incident/investigation-stats`);
            }}
            className="cursor-pointer"
          >
            Incident Investigation
          </DropdownMenuItem>
        )}

        {isSafety && currentModule !== "Safety" && (
          <DropdownMenuItem
            onClick={() => {
              localStorage.setItem("selected_module", "U2FsdGVkX19opQjksvN74IqPHYbQz9RqoKNoqmLQVF8=");
              window.location.assign(`${fullUrl}/safety/risk_assessment`);
            }}
            className="cursor-pointer"
          >
            Safety
          </DropdownMenuItem>
        )}

        {technicalAccess && currentModule !== "Technical" && (
          <DropdownMenuItem
            onClick={() => {
              localStorage.setItem("selected_module", "U2FsdGVkX18M7QeL1YQCM8/7o+KDvgIlzZI2KEkB9Ws=");
              window.location.assign(`${fullUrl}/technical/pms/dashboard`);
            }}
            className="cursor-pointer"
          >
            Technical
          </DropdownMenuItem>
        )}

        {crewingAccess && currentModule !== "Crewing" && (
          <DropdownMenuItem
            onClick={() => {
              localStorage.setItem("selected_module", "U2FsdGVkX1/zTYInEs7rof+o3R//IOa4hSuxsb3kfbc=");
              const route = userType === "U2FsdGVkX18APK1Va6FMA+zoU8Rhw9B9QB8PAZhGYyM="
                ? `${fullUrl}/crewing/dashboard/`
                : `${fullUrl}/crewing/vessel/`;
              window.location.assign(route);
            }}
            className="cursor-pointer"
          >
            Crewing
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
