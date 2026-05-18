function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function SpeedGauge({ speed = 0, maxSpeed = 8, boostActive = false }) {
  const CX = 44;
  const CY = 44;
  const R = 34;
  const SW = 7;
  const START = -225;
  const END = 45;
  const TOTAL = END - START; // 270°

  const fraction = Math.min(1, Math.max(0, speed / maxSpeed));
  const arcEnd = START + fraction * TOTAL;

  const trackPath = describeArc(CX, CY, R, START, END);
  const fillPath = fraction > 0.005 ? describeArc(CX, CY, R, START, arcEnd) : null;

  const color = boostActive
    ? '#fbbf24'
    : fraction >= 0.8
    ? '#22c55e'
    : fraction >= 0.5
    ? '#f59e0b'
    : '#ef4444';

  // Needle tip position
  const needle = polarToCartesian(CX, CY, R - 10, arcEnd);

  return (
    <div className="flex flex-col items-center select-none">
      <svg width="88" height="88" viewBox="0 0 88 88">
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="rgba(14,165,233,0.12)"
          strokeWidth={SW}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeLinecap="round"
            style={{ transition: 'stroke 0.4s ease' }}
          />
        )}
        {/* Glow ring when boost */}
        {boostActive && (
          <circle
            cx={CX}
            cy={CY}
            r={R + 4}
            fill="none"
            stroke="rgba(251,191,36,0.18)"
            strokeWidth="6"
          />
        )}
        {/* Speed value */}
        <text
          x={CX}
          y={CY - 2}
          textAnchor="middle"
          fill={color}
          fontSize="15"
          fontWeight="bold"
          style={{ transition: 'fill 0.4s ease' }}
        >
          {speed.toFixed(1)}
        </text>
        <text x={CX} y={CY + 11} textAnchor="middle" fill="rgba(148,163,184,0.7)" fontSize="9">
          nœuds
        </text>
        {boostActive && (
          <text x={CX} y={CY + 23} textAnchor="middle" fontSize="11">
            ⚡
          </text>
        )}
      </svg>
      <div className="text-ocean-500 text-[10px] mt-0.5">max {maxSpeed} kn</div>
    </div>
  );
}

export default SpeedGauge;
