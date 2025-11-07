interface SemiCircularGaugeProps {
  value: number;
  max: number;
  color: string;
  label?: string;
}

export const SemiCircularGauge = ({ value, max, color, label }: SemiCircularGaugeProps) => {
  const percentage = max > 0 ? Math.min(1, value / max) : 0;
  const fillAngle = percentage * 180; // 0-180 degrees for the filled portion
  
  // SVG parameters
  const radius = 70;
  const strokeWidth = 20;
  const center = 100;
  
  // Full 180° background arc (always visible, represents 100% of vessels)
  // Goes from 180° (left/9 o'clock) to 0° (right/3 o'clock)
  const backgroundPath = describeArc(center, center, radius, 180, 0);
  
  // Filled arc based on percentage (fills from left to right)
  // Starts at 180° (left) and fills clockwise based on percentage
  const filledEndAngle = 180 - fillAngle;
  const filledPath = percentage > 0 ? describeArc(center, center, radius, 180, filledEndAngle) : '';
  
  return (
    <div className="flex items-center justify-center w-full h-full">
      <svg width="200" height="130" viewBox="0 0 200 130">
        {/* Background arc - full 180° frame (light gray) */}
        <path
          d={backgroundPath}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Filled arc - percentage-based (colored) */}
        {percentage > 0 && (
          <path
            d={filledPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        
        {/* Center value */}
        <text
          x={center}
          y={center - 5}
          textAnchor="middle"
          className="text-4xl font-bold fill-gray-800 dark:fill-gray-200"
        >
          {value}
        </text>
        
        {/* Label */}
        {label && (
          <text
            x={center}
            y={center + 18}
            textAnchor="middle"
            className="text-sm fill-gray-600 dark:fill-gray-400"
          >
            {label}
          </text>
        )}
      </svg>
    </div>
  );
};

// Helper function to describe an arc path
function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  
  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(' ');
}

// Helper function to convert polar coordinates to cartesian
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}
