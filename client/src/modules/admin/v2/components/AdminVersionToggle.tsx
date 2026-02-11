import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAdminVersion } from '../hooks/useAdminVersion';

interface AdminVersionToggleProps {
  className?: string;
}

export function AdminVersionToggle({ className }: AdminVersionToggleProps) {
  const { isV2, toggleVersion } = useAdminVersion();

  return (
    <div className={`flex items-center gap-2 ${className || ''}`} data-testid="admin-version-toggle">
      <Label htmlFor="admin-version" className="text-xs text-muted-foreground">
        V1
      </Label>
      <Switch
        id="admin-version"
        checked={isV2}
        onCheckedChange={toggleVersion}
        data-testid="switch-admin-version"
      />
      <Label htmlFor="admin-version" className="text-xs text-muted-foreground">
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
