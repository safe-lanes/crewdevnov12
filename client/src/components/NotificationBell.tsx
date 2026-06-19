import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePermissions } from "@/contexts/PermissionsContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bell, Loader2, Check, AlertCircle, RefreshCw } from "lucide-react";
import { type AlertEventV2 } from "@shared/v2/alerts/schema";

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { userType, roleName } = usePermissions();

  const queryKey = [`/api/v2/alerts/events/for-current-user?roleName=${encodeURIComponent(roleName || "")}`];

  // Fetch unacknowledged alerts for the user's role
  const { data: alerts = [], isLoading, refetch } = useQuery<AlertEventV2[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", queryKey[0]);
      return res.json();
    },
    enabled: !!userType,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Acknowledge alert mutation
  const ackMutation = useMutation({
    mutationFn: async (aeuuid: string) => {
      const res = await apiRequest("POST", `/api/v2/alerts/events/${aeuuid}/acknowledge`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Trigger manual background scan mutation
  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/v2/alerts/scan`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = alerts.length;

  const getPriorityStyles = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
      case "medium":
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
    }
  };

  const parsePayload = (payloadStr: string) => {
    try {
      return JSON.parse(payloadStr);
    } catch {
      return { alertMessage: payloadStr, link: "/" };
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none rounded-full hover:bg-gray-200 transition-colors"
        data-testid="notification-bell-button"
        aria-label="View notifications"
      >
        <Bell size={22} className={unreadCount > 0 ? "animate-pulse" : ""} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full min-w-[16px] h-[16px]"
            data-testid="notification-badge-count"
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[110] overflow-hidden"
          data-testid="notification-dropdown"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Notifications ({unreadCount})
            </h3>
            <button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending || isLoading}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors disabled:opacity-50"
              title="Run Alert Scan"
              data-testid="run-alert-scan-button"
            >
              {scanMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
            </button>
          </div>

          {/* Alert List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-gray-500 text-sm">
                <Loader2 size={20} className="animate-spin mr-2" />
                Loading alerts...
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <AlertCircle size={28} className="mb-2 text-gray-400" />
                <span className="text-sm">No pending alerts.</span>
              </div>
            ) : (
              alerts.map((alert) => {
                const payload = parsePayload(alert.payload);
                return (
                  <div
                    key={alert.aeuuid}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors flex gap-3"
                    data-testid={`alert-item-${alert.alertType}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${getPriorityStyles(
                            alert.priority
                          )}`}
                        >
                          {alert.priority}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {alert.createdAt ? new Date(alert.createdAt).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                        {payload.alertMessage || alert.payload}
                      </p>
                      {payload.link && (
                        <Link
                          href={payload.link}
                          onClick={() => setIsOpen(false)}
                          className="inline-block mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          View Details
                        </Link>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-start">
                      <button
                        onClick={() => ackMutation.mutate(alert.aeuuid)}
                        disabled={ackMutation.isPending}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors"
                        title="Acknowledge alert"
                        data-testid={`ack-button-${alert.aeuuid}`}
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
