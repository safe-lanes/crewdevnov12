import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAppraisalsVersion } from '../hooks/useAppraisalsVersion';

interface AppraisalsVersionToggleProps {
  className?: string;
}

export function AppraisalsVersionToggle({ className }: AppraisalsVersionToggleProps) {
  const { isV2, toggleVersion } = useAppraisalsVersion();

  return (
    <div className={`flex items-center gap-2 ${className || ''}`} data-testid="appraisals-version-toggle">
      <Label htmlFor="appraisals-version" className="text-xs text-muted-foreground">
        V1
      </Label>
      <Switch
        id="appraisals-version"
        checked={isV2}
        onCheckedChange={toggleVersion}
        data-testid="switch-appraisals-version"
      />
      <Label htmlFor="appraisals-version" className="text-xs text-muted-foreground">
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
