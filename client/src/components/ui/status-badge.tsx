import { cn } from "@/lib/utils";

export type NCStatus = "Open" | "Closed";

interface StatusBadgeProps {
  status: NCStatus;
  className?: string;
  variant?: "default" | "large";
}

export function StatusBadge({ status, className, variant = "default" }: StatusBadgeProps) {
  const isOpen = status === "Open";
  
  if (variant === "large") {
    return (
      <div className={cn("border-2 border-red-500 rounded px-4 py-2 inline-block", className)}>
        <div className="text-xs text-gray-600 text-center mb-1">Status</div>
        <div className={cn(
          "text-xl font-bold text-center",
          isOpen ? "text-red-600" : "text-green-600"
        )}>
          {status}
        </div>
      </div>
    );
  }
  
  // Default compact badge
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        isOpen 
          ? "bg-red-100 text-red-800 border border-red-300" 
          : "bg-green-100 text-green-800 border border-green-300",
        className
      )}
      data-testid={`status-badge-${status.toLowerCase()}`}
    >
      {status}
    </span>
  );
}

export function getStatusColor(status: NCStatus): string {
  return status === "Open" ? "text-red-600" : "text-green-600";
}

export function getStatusBgColor(status: NCStatus): string {
  return status === "Open" ? "bg-red-100" : "bg-green-100";
}
