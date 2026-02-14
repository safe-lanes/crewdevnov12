import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePromotionsVersion } from '../../index';

interface VersionToggleProps {
  className?: string;
}

export function PromotionsVersionToggle({ className }: VersionToggleProps) {
  const { isV2, toggleVersion } = usePromotionsVersion();

  return (
    <div className={`flex items-center gap-2 ${className || ''}`} data-testid="promotions-version-toggle">
      <Label htmlFor="promotions-version" className="text-xs text-muted-foreground">
        V1
      </Label>
      <Switch
        id="promotions-version"
        checked={isV2}
        onCheckedChange={toggleVersion}
        data-testid="switch-promotions-version"
      />
      <Label htmlFor="promotions-version" className="text-xs text-muted-foreground">
        V2
      </Label>
      {isV2 && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          V2 Active
        </Badge>
      )}
    </div>
  );
}
