import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { format, addMonths, differenceInDays, parseISO, isAfter, isBefore, startOfMonth, endOfMonth, getMonth } from 'date-fns';
import { Maximize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ServiceAssignment } from '@shared/schema';

interface TimelineCardProps {
  assignments: ServiceAssignment[];
  isLoading?: boolean;
  onAppraisalClick?: (appraisalId: number) => void;
  onHandoverClick?: (handoverId: number) => void;
}

interface BadgePosition {
  index: number;
  x: number;
  y: number;
  hasAppraisal: boolean;
  hasHandover: boolean;
  appraisalIds: number[];
  handoverIds: number[];
}

interface TimelineCanvasProps {
  assignments: ServiceAssignment[];
  isExpanded: boolean;
  onAppraisalClick?: (appraisalId: number) => void;
  onHandoverClick?: (handoverId: number) => void;
  canvasWidth?: number;
}

function TimelineCanvas({
  assignments,
  isExpanded,
  onAppraisalClick,
  onHandoverClick,
  canvasWidth = 400
}: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [badgePositions, setBadgePositions] = useState<BadgePosition[]>([]);
  
  const today = useMemo(() => new Date(), []);
  
  const startDate = useMemo(() => {
    const monthsBefore = isExpanded ? 12 : 2;
    return startOfMonth(addMonths(today, -monthsBefore));
  }, [today, isExpanded]);
  
  const endDate = useMemo(() => {
    const monthsAfter = isExpanded ? 5 : 3;
    return endOfMonth(addMonths(today, monthsAfter));
  }, [today, isExpanded]);
  
  const totalDays = useMemo(() => differenceInDays(endDate, startDate), [startDate, endDate]);
  const monthCount = isExpanded ? 18 : 6;
  
  const months = useMemo(() => {
    const result = [];
    let current = new Date(startDate);
    for (let i = 0; i < monthCount; i++) {
      result.push({
        label: format(current, 'MMM'),
        date: new Date(current)
      });
      current = addMonths(current, 1);
    }
    return result;
  }, [startDate, monthCount]);
  
  const drawAssignmentBar = useCallback((
    ctx: CanvasRenderingContext2D,
    assignment: ServiceAssignment,
    barStartX: number,
    barY: number,
    barHeight: number,
    chartWidth: number,
    leftPadding: number
  ): number => {
    const assignmentStart = parseISO(assignment.startDate);
    const contractEnd = assignment.contractEndDate ? parseISO(assignment.contractEndDate) : null;
    const rangeEnd = assignment.rangeEndDate ? parseISO(assignment.rangeEndDate) : null;
    
    if (assignment.type === 'planned') {
      const assignmentEnd = assignment.endDate 
        ? parseISO(assignment.endDate) 
        : (rangeEnd || (contractEnd ? contractEnd : addMonths(today, 4)));
      
      const displayEnd = isAfter(assignmentEnd, endDate) ? endDate : assignmentEnd;
      const barEndX = leftPadding + (differenceInDays(displayEnd, startDate) / totalDays) * chartWidth;
      const barWidth = Math.max(barEndX - barStartX, 4);
      
      ctx.fillStyle = '#3B82F6';
      ctx.beginPath();
      ctx.roundRect(barStartX, barY, barWidth, barHeight, 4);
      ctx.fill();
      
      return barEndX;
    }
    
    if (assignment.type === 'completed') {
      const assignmentEnd = assignment.endDate 
        ? parseISO(assignment.endDate) 
        : (rangeEnd || addMonths(assignmentStart, 6));
      
      const displayEnd = isAfter(assignmentEnd, endDate) ? endDate : assignmentEnd;
      const barEndX = leftPadding + (differenceInDays(displayEnd, startDate) / totalDays) * chartWidth;
      const barWidth = Math.max(barEndX - barStartX, 4);
      
      ctx.fillStyle = '#9CA3AF';
      ctx.beginPath();
      ctx.roundRect(barStartX, barY, barWidth, barHeight, 4);
      ctx.fill();
      
      return barEndX;
    }
    
    const todayX = leftPadding + (differenceInDays(today, startDate) / totalDays) * chartWidth;
    const effectiveContractEnd = contractEnd || rangeEnd || addMonths(assignmentStart, 6);
    const effectiveRangeEnd = rangeEnd || effectiveContractEnd;
    
    const greenEndX = leftPadding + Math.max(0, (differenceInDays(effectiveContractEnd, startDate) / totalDays) * chartWidth);
    const yellowEndX = leftPadding + Math.max(0, (differenceInDays(effectiveRangeEnd, startDate) / totalDays) * chartWidth);
    
    const clippedGreenEndX = Math.min(greenEndX, leftPadding + chartWidth);
    const clippedYellowEndX = Math.min(yellowEndX, leftPadding + chartWidth);
    
    let finalBarEndX = barStartX;
    
    if (clippedGreenEndX > barStartX) {
      ctx.fillStyle = 'rgba(2, 169, 33, 0.5)';
      ctx.fillRect(barStartX, barY, clippedGreenEndX - barStartX, barHeight);
      finalBarEndX = clippedGreenEndX;
    }
    
    if (clippedYellowEndX > clippedGreenEndX && rangeEnd && contractEnd && isAfter(rangeEnd, contractEnd)) {
      ctx.fillStyle = 'rgba(241, 205, 29, 0.5)';
      ctx.fillRect(clippedGreenEndX, barY, clippedYellowEndX - clippedGreenEndX, barHeight);
      finalBarEndX = clippedYellowEndX;
    }
    
    // Red (Overdue): Draw when today is past the range end date (or contract end if no range extension)
    // Use effectiveRangeEnd which falls back to effectiveContractEnd when rangeEnd is null
    if (isAfter(today, effectiveRangeEnd)) {
      // Red bar starts from where yellow ends (or green ends if no yellow)
      const redStartX = clippedYellowEndX;
      const redEndX = Math.min(todayX, leftPadding + chartWidth);
      if (redEndX > redStartX) {
        ctx.fillStyle = 'rgba(229, 78, 96, 0.5)';
        ctx.fillRect(redStartX, barY, redEndX - redStartX, barHeight);
        finalBarEndX = redEndX;
      }
    }
    
    return finalBarEndX;
  }, [today, startDate, endDate, totalDays]);
  
  const yearRowHeight = isExpanded ? 18 : 0;
  const monthRowHeight = 24;
  const headerHeight = yearRowHeight + monthRowHeight;
  const canvasHeight = Math.max(100, headerHeight + 8 + assignments.length * 28);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const barHeight = 20;
    const barSpacing = 8;
    const leftPadding = 8;
    const rightPadding = 8;
    const chartWidth = width - leftPadding - rightPadding;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, headerHeight);
    
    // Draw month grid lines and labels using day-based positioning (to align with bar date calculations)
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    months.forEach((month, index) => {
      if (index > 0) {
        // Calculate month boundary position using day-based positioning
        const boundaryX = leftPadding + (differenceInDays(month.date, startDate) / totalDays) * chartWidth;
        ctx.beginPath();
        ctx.moveTo(boundaryX, 0);
        ctx.lineTo(boundaryX, height);
        ctx.stroke();
      }
    });
    
    if (isExpanded) {
      ctx.fillStyle = '#16569e';
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      months.forEach((month, index) => {
        if (getMonth(month.date) === 0) {
          // Calculate month center using day-based positioning
          const monthStart = month.date;
          const monthEnd = index < months.length - 1 ? months[index + 1].date : endDate;
          const monthCenterDays = differenceInDays(monthStart, startDate) + differenceInDays(monthEnd, monthStart) / 2;
          const x = leftPadding + (monthCenterDays / totalDays) * chartWidth;
          ctx.fillText(format(month.date, 'yyyy'), x, 13);
        }
      });
    }
    
    ctx.fillStyle = '#6B7280';
    ctx.font = isExpanded ? '10px Inter, system-ui, sans-serif' : '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    months.forEach((month, index) => {
      // Calculate month center using day-based positioning
      const monthStart = month.date;
      const monthEnd = index < months.length - 1 ? months[index + 1].date : endDate;
      const monthCenterDays = differenceInDays(monthStart, startDate) + differenceInDays(monthEnd, monthStart) / 2;
      const x = leftPadding + (monthCenterDays / totalDays) * chartWidth;
      ctx.fillText(month.label, x, yearRowHeight + 16);
    });
    
    const todayX = leftPadding + (differenceInDays(today, startDate) / totalDays) * chartWidth;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(todayX, headerHeight);
    ctx.lineTo(todayX, height);
    ctx.stroke();
    
    const filteredAssignments = assignments.filter(a => {
      const aStart = parseISO(a.startDate);
      const aEnd = a.rangeEndDate 
        ? parseISO(a.rangeEndDate) 
        : (a.endDate ? parseISO(a.endDate) : addMonths(today, 6));
      return !(isAfter(aStart, endDate) || isBefore(aEnd, startDate));
    });
    
    const newBadgePositions: BadgePosition[] = [];
    
    filteredAssignments.forEach((assignment, index) => {
      const assignmentStart = parseISO(assignment.startDate);
      const displayStart = isBefore(assignmentStart, startDate) ? startDate : assignmentStart;
      
      const barStartX = leftPadding + (differenceInDays(displayStart, startDate) / totalDays) * chartWidth;
      const barY = headerHeight + 8 + index * (barHeight + barSpacing);
      
      const barEndX = drawAssignmentBar(ctx, assignment, barStartX, barY, barHeight, chartWidth, leftPadding);
      const barWidth = barEndX - barStartX;
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      
      const vesselName = assignment.vessel.length > 20 
        ? assignment.vessel.substring(0, 18) + '...' 
        : assignment.vessel;
      
      if (barWidth > 50) {
        ctx.fillText(vesselName, barStartX + 6, barY + 14);
      }
      
      const hasAppraisal = assignment.appraisalIds && assignment.appraisalIds.length > 0;
      const hasHandover = assignment.handoverIds && assignment.handoverIds.length > 0;
      
      if (hasAppraisal || hasHandover) {
        newBadgePositions.push({
          index,
          x: barEndX + 4,
          y: barY,
          hasAppraisal: !!hasAppraisal,
          hasHandover: !!hasHandover,
          appraisalIds: assignment.appraisalIds || [],
          handoverIds: assignment.handoverIds || []
        });
      }
    });
    
    setBadgePositions(newBadgePositions);
    
  }, [assignments, months, today, startDate, endDate, totalDays, monthCount, isExpanded, canvasWidth, drawAssignmentBar, yearRowHeight, headerHeight]);
  
  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="w-full"
        style={{ maxHeight: isExpanded ? '400px' : '200px' }}
      />
      
      {badgePositions.map((pos) => (
        <div 
          key={pos.index}
          className="absolute flex gap-1"
          style={{
            left: `${(pos.x / canvasWidth) * 100}%`,
            top: `${pos.y}px`,
            transform: 'translateY(-2px)'
          }}
        >
          {pos.hasAppraisal && (
            <button
              onClick={() => onAppraisalClick?.(pos.appraisalIds[0])}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-1.5 py-0.5 rounded text-xs font-medium transition-colors whitespace-nowrap"
              data-testid={`badge-appraisal-${pos.index}`}
            >
              App-{pos.appraisalIds.length}
            </button>
          )}
          {pos.hasHandover && (
            <button
              onClick={() => onHandoverClick?.(pos.handoverIds[0])}
              className="bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-0.5 rounded text-xs font-medium transition-colors whitespace-nowrap"
              data-testid={`badge-handover-${pos.index}`}
            >
              HO-{pos.handoverIds.length}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function TimelineLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(2, 169, 33, 0.7)' }}></div>
        <span className="text-gray-600">Contract</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(241, 205, 29, 0.7)' }}></div>
        <span className="text-gray-600">+/- Range</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(229, 78, 96, 0.7)' }}></div>
        <span className="text-gray-600">Overdue</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded bg-blue-500"></div>
        <span className="text-gray-600">Planned</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded bg-gray-400"></div>
        <span className="text-gray-600">Completed</span>
      </div>
    </div>
  );
}

export function TimelineCard({ 
  assignments, 
  isLoading = false,
  onAppraisalClick,
  onHandoverClick
}: TimelineCardProps) {
  const [showModal, setShowModal] = useState(false);
  
  if (isLoading) {
    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200 h-full" data-testid="card-timeline">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium" style={{ color: '#16569e' }}>Timeline</h3>
          <button
            disabled
            className="p-1 rounded hover:bg-gray-100 text-gray-400"
            data-testid="button-expand-timeline"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 animate-pulse">
          <div className="grid grid-cols-6 gap-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-3 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 ml-auto"></div>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <div className="bg-white p-4 rounded-lg border border-gray-200 h-full" data-testid="card-timeline">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium" style={{ color: '#16569e' }}>Timeline</h3>
          <button
            onClick={() => setShowModal(true)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="Expand to 18 months view"
            data-testid="button-expand-timeline"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
        
        <TimelineCanvas
          assignments={assignments}
          isExpanded={false}
          onAppraisalClick={onAppraisalClick}
          onHandoverClick={onHandoverClick}
          canvasWidth={400}
        />
        
        {assignments.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No timeline data available
          </div>
        )}
        
        {assignments.length > 0 && <TimelineLegend />}
      </div>
      
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-5xl w-[90vw] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle style={{ color: '#16569e' }}>
              Timeline (18 Months View)
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            <TimelineCanvas
              assignments={assignments}
              isExpanded={true}
              onAppraisalClick={onAppraisalClick}
              onHandoverClick={onHandoverClick}
              canvasWidth={800}
            />
            
            {assignments.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No timeline data available
              </div>
            )}
            
            {assignments.length > 0 && <TimelineLegend />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TimelineCard;
