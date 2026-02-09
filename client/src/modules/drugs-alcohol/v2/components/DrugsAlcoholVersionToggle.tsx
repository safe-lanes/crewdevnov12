import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useDrugsAlcoholVersion } from '../hooks/useDrugsAlcoholVersion';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DrugsAlcoholVersionToggleProps {
  className?: string;
  compact?: boolean;
}

export function DrugsAlcoholVersionToggle({ className, compact = false }: DrugsAlcoholVersionToggleProps) {
  const { isV2, toggleVersion } = useDrugsAlcoholVersion();

  if (compact) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div 
            className={`flex flex-col items-center justify-center cursor-pointer ${className || ''}`}
            onClick={toggleVersion}
            data-testid="drugs-alcohol-version-toggle"
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
    <div className={`flex items-center gap-2 ${className || ''}`} data-testid="drugs-alcohol-version-toggle">
      <Label htmlFor="drugs-alcohol-version" className="text-xs text-muted-foreground">
        V1
      </Label>
      <Switch
        id="drugs-alcohol-version"
        checked={isV2}
        onCheckedChange={toggleVersion}
        data-testid="switch-drugs-alcohol-version"
      />
      <Label htmlFor="drugs-alcohol-version" className="text-xs text-muted-foreground">
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
