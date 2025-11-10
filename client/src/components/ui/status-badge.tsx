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
  // "Open" renders as plain text, "Closed" renders with green badge
  if (isOpen) {
    return (
      <span
        className={cn("text-gray-700", className)}
        style={{ fontSize: '13px' }}
        data-testid={`status-badge-${status.toLowerCase()}`}
      >
        {status}
      </span>
    );
  }
  
  return (
    <span
      className={cn(
        "px-4 py-1.5 rounded font-medium min-w-[70px] text-center bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        className
      )}
      style={{ fontSize: '13px' }}
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
