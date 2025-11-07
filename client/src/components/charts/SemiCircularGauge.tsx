interface SemiCircularGaugeProps {
  value: number;
  max: number;
  color: string;
  label?: string;
}

export const SemiCircularGauge = ({ value, max, color, label }: SemiCircularGaugeProps) => {
  const percentage = max > 0 ? Math.min(1, value / max) : 0;
  const angle = percentage * 180; // 0-180 degrees for semi-circle
  
  // SVG parameters
  const radius = 80;
  const strokeWidth = 15;
  const center = 100;
  
  // Calculate the path for the background arc (semi-circle)
  const backgroundPath = describeArc(center, center, radius, 180, 0);
  
  // Calculate the path for the filled arc
  const filledPath = describeArc(center, center, radius, 180, 180 - angle);
  
  return (
    <div className="flex items-center justify-center w-full h-full">
      <svg width="200" height="130" viewBox="0 0 200 130">
        {/* Background arc */}
        <path
          d={backgroundPath}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Filled arc */}
        <path
          d={filledPath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Center value */}
        <text
          x={center}
          y={center - 10}
          textAnchor="middle"
          className="text-3xl font-bold fill-gray-800 dark:fill-gray-200"
        >
          {value}
        </text>
        
        {/* Label */}
        {label && (
          <text
            x={center}
            y={center + 10}
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
