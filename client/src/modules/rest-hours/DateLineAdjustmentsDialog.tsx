import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Globe, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { VesselDateLineAdjustment, DateLineAdjustmentItem } from '@shared/schema';

interface DateLineAdjustmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vesselId: string | null;
  vesselName: string;
  monthValue: string;
}

export const DateLineAdjustmentsDialog = ({
  open,
  onOpenChange,
  vesselId,
  vesselName,
  monthValue,
}: DateLineAdjustmentsDialogProps) => {
  const { toast } = useToast();
  const [adjustments, setAdjustments] = useState<DateLineAdjustmentItem[]>([]);

  const { data: existingAdjustment } = useQuery<VesselDateLineAdjustment | null>({
    queryKey: ['/api/vessel-dateline-adjustments', vesselId, monthValue],
    queryFn: async () => {
      if (!vesselId || !monthValue) return null;
      const response = await fetch(`/api/vessel-dateline-adjustments/${vesselId}/${monthValue}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch vessel date line adjustments');
      }
      return response.json();
    },
    enabled: open && !!vesselId && !!monthValue,
  });

  useEffect(() => {
    if (existingAdjustment) {
      try {
        const parsed = JSON.parse(existingAdjustment.adjustments);
        setAdjustments(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Failed to parse adjustments:', e);
        setAdjustments([]);
      }
    } else {
      setAdjustments([]);
    }
  }, [existingAdjustment]);

  const saveMutation = useMutation({
    mutationFn: async (data: { vesselId: string; monthValue: string; adjustments: string }) => {
      return apiRequest(`/api/vessel-dateline-adjustments/${data.vesselId}/${data.monthValue}`, 'PUT', { adjustments: data.adjustments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vessel-dateline-adjustments'] });
      toast({
        title: 'Success',
        description: 'Date line adjustments saved successfully',
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Failed to save date line adjustments:', error);
      toast({
        title: 'Error',
        description: 'Failed to save date line adjustments',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!vesselId || !monthValue) throw new Error('Missing vessel or month');
      return apiRequest(`/api/vessel-dateline-adjustments/${vesselId}/${monthValue}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vessel-dateline-adjustments'] });
      toast({
        title: 'Success',
        description: 'Date line adjustments cleared successfully',
      });
      setAdjustments([]);
    },
    onError: (error) => {
      console.error('Failed to delete date line adjustments:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear date line adjustments',
        variant: 'destructive',
      });
    },
  });

  const daysInMonth = useMemo(() => {
    if (!monthValue) return 31;
    const [year, month] = monthValue.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  }, [monthValue]);

  const handleDayClick = (day: number) => {
    const existing = adjustments.find(a => a.day === day);
    
    if (existing) {
      if (existing.type === 'advanced') {
        setAdjustments(prev => prev.map(a => 
          a.day === day ? { ...a, type: 'retarded' as const } : a
        ));
      } else {
        setAdjustments(prev => prev.filter(a => a.day !== day));
      }
    } else {
      setAdjustments(prev => [...prev, { day, type: 'advanced' }]);
    }
  };

  const handleSave = () => {
    if (!vesselId || !monthValue) {
      toast({
        title: 'Error',
        description: 'Vessel and month are required',
        variant: 'destructive',
      });
      return;
    }
    saveMutation.mutate({
      vesselId,
      monthValue,
      adjustments: JSON.stringify(adjustments),
    });
  };

  const handleClear = () => {
    deleteMutation.mutate();
  };

  const getDayLabel = (day: number) => {
    const adjustment = adjustments.find(a => a.day === day);
    if (!adjustment) return day;
    return adjustment.type === 'advanced' ? `${day} (A)` : `${day} (R)`;
  };

  const getDayClass = (day: number) => {
    const adjustment = adjustments.find(a => a.day === day);
    if (!adjustment) return 'bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600';
    if (adjustment.type === 'advanced') return 'bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 border-orange-400 dark:border-orange-600 font-semibold';
    return 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 border-blue-400 dark:border-blue-600 font-semibold';
  };

  const monthDisplay = useMemo(() => {
    if (!monthValue) return '';
    const [year, month] = monthValue.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthName = date.toLocaleString('en-US', { month: 'long' });
    return `${monthName} ${year}`;
  }, [monthValue]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Date Line Adjustments - {vesselName}
          </DialogTitle>
          <DialogDescription>
            Mark days as Advanced (Skipped) or Retarded (Repeated) when vessel crosses international date line - {monthDisplay}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <p>Click a day to cycle through: Normal → Advanced (Skipped) → Retarded (Repeated) → Normal</p>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded border-2 bg-orange-100 border-orange-400 dark:bg-orange-900 dark:border-orange-600"></div>
                <span className="text-xs">(A) = Advanced (Day Skipped)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded border-2 bg-blue-100 border-blue-400 dark:bg-blue-900 dark:border-blue-600"></div>
                <span className="text-xs">(R) = Retarded (Day Repeated)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                className={`h-12 rounded border-2 text-sm transition-colors ${getDayClass(day)}`}
                data-testid={`day-${day}`}
              >
                {getDayLabel(day)}
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={deleteMutation.isPending || adjustments.length === 0}
              data-testid="button-clear-adjustments"
            >
              Clear All
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                data-testid="button-save"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
