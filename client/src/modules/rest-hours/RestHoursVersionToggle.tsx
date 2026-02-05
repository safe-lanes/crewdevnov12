import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRestHoursVersion } from './index';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RestHoursVersionToggleProps {
  className?: string;
  compact?: boolean;
}

export function RestHoursVersionToggle({ className, compact = false }: RestHoursVersionToggleProps) {
  const { isV2, toggleVersion } = useRestHoursVersion();

  if (compact) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div 
            className={`flex flex-col items-center justify-center cursor-pointer ${className || ''}`}
            onClick={toggleVersion}
            data-testid="rest-hours-version-toggle"
          >
            <Badge 
              variant={isV2 ? "default" : "secondary"} 
              className={`text-[9px] px-1.5 py-0 ${isV2 ? 'bg-green-600' : 'bg-gray-500'}`}
            >
              {isV2 ? 'V2' : 'V1'}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-[#16569e] text-white border-none">
          Click to switch to {isV2 ? 'V1' : 'V2'}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className || ''}`} data-testid="rest-hours-version-toggle">
      <Label htmlFor="rest-hours-version" className="text-xs text-white">
        V1
      </Label>
      <Switch
        id="rest-hours-version"
        checked={isV2}
        onCheckedChange={toggleVersion}
        data-testid="switch-rest-hours-version"
      />
      <Label htmlFor="rest-hours-version" className="text-xs text-white">
        V2
      </Label>
      {isV2 && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-600 text-white">
          Active
        </Badge>
      )}
    </div>
  );
}
