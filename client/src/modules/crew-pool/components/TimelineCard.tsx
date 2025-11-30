import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { format, addMonths, differenceInDays, parseISO, isAfter, isBefore } from 'date-fns';
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

export function TimelineCard({ 
  assignments, 
  isLoading = false,
  onAppraisalClick,
  onHandoverClick
}: TimelineCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [badgePositions, setBadgePositions] = useState<BadgePosition[]>([]);
  
  const today = useMemo(() => new Date(), []);
  const startDate = useMemo(() => addMonths(today, -2), [today]);
  const endDate = useMemo(() => addMonths(today, 4), [today]);
  const totalDays = useMemo(() => differenceInDays(endDate, startDate), [startDate, endDate]);
  
  const months = useMemo(() => {
    const result = [];
    let current = new Date(startDate);
    while (isBefore(current, endDate) || format(current, 'MMM') === format(endDate, 'MMM')) {
      result.push({
        label: format(current, 'MMM'),
        date: new Date(current)
      });
      current = addMonths(current, 1);
    }
    return result.slice(0, 6);
  }, [startDate, endDate]);
  
  // Draw multi-segment bar matching Rotation module:
  // Green: startDate → contractEndDate
  // Yellow: contractEndDate → rangeEndDate  
  // Red: rangeEndDate → today (only if overdue)
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
    
    // For planned assignments - single blue bar
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
    
    // For completed assignments - single gray bar
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
    
    // For active/current assignments - multi-segment bar matching Rotation module
    const todayX = leftPadding + (differenceInDays(today, startDate) / totalDays) * chartWidth;
    
    // Determine bar boundaries
    const effectiveContractEnd = contractEnd || rangeEnd || addMonths(assignmentStart, 6);
    const effectiveRangeEnd = rangeEnd || effectiveContractEnd;
    
    // Calculate X positions for each segment
    const greenEndX = leftPadding + Math.max(0, (differenceInDays(effectiveContractEnd, startDate) / totalDays) * chartWidth);
    const yellowEndX = leftPadding + Math.max(0, (differenceInDays(effectiveRangeEnd, startDate) / totalDays) * chartWidth);
    
    // Clip to visible range
    const clippedGreenEndX = Math.min(greenEndX, leftPadding + chartWidth);
    const clippedYellowEndX = Math.min(yellowEndX, leftPadding + chartWidth);
    
    let finalBarEndX = barStartX;
    
    // Draw green bar (Contract Start to Contract End)
    if (clippedGreenEndX > barStartX) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.7)'; // Green with opacity
      ctx.beginPath();
      ctx.roundRect(barStartX, barY, clippedGreenEndX - barStartX, barHeight, 4);
      ctx.fill();
      finalBarEndX = clippedGreenEndX;
    }
    
    // Draw yellow bar (Contract End to Range End)
    if (clippedYellowEndX > clippedGreenEndX && rangeEnd && contractEnd && isAfter(rangeEnd, contractEnd)) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.7)'; // Yellow/Amber with opacity
      ctx.fillRect(clippedGreenEndX, barY, clippedYellowEndX - clippedGreenEndX, barHeight);
      finalBarEndX = clippedYellowEndX;
    }
    
    // Draw red bar (After Range End) - only if overdue
    if (rangeEnd && isAfter(today, rangeEnd)) {
      const redStartX = clippedYellowEndX;
      const redEndX = Math.min(todayX, leftPadding + chartWidth);
      if (redEndX > redStartX) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.7)'; // Red with opacity
        ctx.fillRect(redStartX, barY, redEndX - redStartX, barHeight);
        finalBarEndX = redEndX;
      }
    }
    
    return finalBarEndX;
  }, [today, startDate, endDate, totalDays]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isLoading) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const headerHeight = 24;
    const barHeight = 20;
    const barSpacing = 8;
    const leftPadding = 8;
    const rightPadding = 8;
    const chartWidth = width - leftPadding - rightPadding;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, headerHeight);
    
    ctx.fillStyle = '#6B7280';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    
    const monthWidth = chartWidth / 6;
    months.forEach((month, index) => {
      const x = leftPadding + (index + 0.5) * monthWidth;
      ctx.fillText(month.label, x, 16);
    });
    
    const todayX = leftPadding + (differenceInDays(today, startDate) / totalDays) * chartWidth;
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(todayX, headerHeight);
    ctx.lineTo(todayX, height);
    ctx.stroke();
    ctx.setLineDash([]);
    
    const filteredAssignments = assignments.filter(a => {
      const aStart = parseISO(a.startDate);
      // Use rangeEndDate for visibility check (matches Rotation module logic)
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
      
      // Use multi-segment bar drawing (matching Rotation module)
      const barEndX = drawAssignmentBar(ctx, assignment, barStartX, barY, barHeight, chartWidth, leftPadding);
      const barWidth = barEndX - barStartX;
      
      // Draw vessel name label
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
    
  }, [assignments, isLoading, months, today, startDate, endDate, totalDays, drawAssignmentBar]);
  
  if (isLoading) {
    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200" data-testid="card-timeline">
        <h3 className="text-lg font-medium mb-4" style={{ color: '#16569e' }}>Timeline</h3>
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
    <div className="bg-white p-4 rounded-lg border border-gray-200" data-testid="card-timeline">
      <h3 className="text-lg font-medium mb-4" style={{ color: '#16569e' }}>Timeline</h3>
      
      <div ref={containerRef} className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={Math.max(100, 32 + assignments.length * 28)}
          className="w-full"
          style={{ maxHeight: '200px' }}
        />
        
        {badgePositions.map((pos) => (
          <div 
            key={pos.index}
            className="absolute flex gap-1"
            style={{
              left: `${(pos.x / 400) * 100}%`,
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
      
      {assignments.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          No timeline data available
        </div>
      )}
      
      {assignments.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-gray-600">On Board</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span className="text-gray-600">Near Relief</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500"></div>
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
      )}
    </div>
  );
}

export default TimelineCard;
