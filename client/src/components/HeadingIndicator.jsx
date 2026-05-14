import { useMemo } from 'react';

function HeadingIndicator({ currentHeading, targetWaypoint, boatPosition, windDirection }) {
  const analysis = useMemo(() => {
    if (!targetWaypoint || !boatPosition) {
      return { quality: 'unknown', optimalHeading: 0, deviation: 0 };
    }

    // Calculate optimal heading to waypoint
    const dLon = (targetWaypoint.lon - boatPosition.lon) * Math.PI / 180;
    const lat1 = boatPosition.lat * Math.PI / 180;
    const lat2 = targetWaypoint.lat * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let optimalHeading = Math.atan2(y, x) * 180 / Math.PI;
    optimalHeading = (optimalHeading + 360) % 360;

    // Check if optimal heading is in no-go zone (too close to wind)
    let angleToWind = Math.abs(optimalHeading - windDirection);
    if (angleToWind > 180) angleToWind = 360 - angleToWind;

    // If in no-go zone, calculate best tack
    let adjustedOptimal = optimalHeading;
    let needsTacking = false;

    if (angleToWind < 45) {
      needsTacking = true;
      const tackAngle = 50;
      const portTack = (windDirection + tackAngle) % 360;
      const starboardTack = (windDirection - tackAngle + 360) % 360;

      const portDiff = Math.abs(portTack - optimalHeading);
      const starboardDiff = Math.abs(starboardTack - optimalHeading);

      adjustedOptimal = portDiff < starboardDiff ? portTack : starboardTack;
    }

    // Calculate deviation from optimal
    let deviation = Math.abs(currentHeading - adjustedOptimal);
    if (deviation > 180) deviation = 360 - deviation;

    // Determine quality
    let quality;
    if (deviation < 10) {
      quality = 'optimal';
    } else if (deviation < 30) {
      quality = 'good';
    } else if (deviation < 60) {
      quality = 'medium';
    } else {
      quality = 'bad';
    }

    // Check if current heading is in no-go zone
    let currentAngleToWind = Math.abs(currentHeading - windDirection);
    if (currentAngleToWind > 180) currentAngleToWind = 360 - currentAngleToWind;
    const inNoGoZone = currentAngleToWind < 45;

    return {
      quality,
      optimalHeading: Math.round(adjustedOptimal),
      directHeading: Math.round(optimalHeading),
      deviation: Math.round(deviation),
      needsTacking,
      inNoGoZone,
      angleToWind: Math.round(currentAngleToWind)
    };
  }, [currentHeading, targetWaypoint, boatPosition, windDirection]);

  const getQualityStyle = () => {
    const styles = {
      optimal: { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-400', label: '🟢 Optimal' },
      good: { bg: 'bg-green-500/10', border: 'border-green-600', text: 'text-green-300', label: '🟢 Bon' },
      medium: { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-400', label: '🟡 Moyen' },
      bad: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400', label: '🔴 Mauvais' },
      unknown: { bg: 'bg-gray-500/20', border: 'border-gray-500', text: 'text-gray-400', label: '⚪ -' }
    };
    return styles[analysis.quality] || styles.unknown;
  };

  const style = getQualityStyle();

  return (
    <div className={`${style.bg} border ${style.border} rounded-lg p-3`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-ocean-300 text-sm">Qualité du cap</span>
        <span className={`font-bold ${style.text}`}>{style.label}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-ocean-400">Cap actuel:</span>
          <span className="text-white ml-1">{currentHeading}°</span>
        </div>
        <div>
          <span className="text-ocean-400">Cap optimal:</span>
          <span className="text-green-400 ml-1">{analysis.optimalHeading}°</span>
        </div>
        <div>
          <span className="text-ocean-400">Déviation:</span>
          <span className={`ml-1 ${analysis.deviation > 30 ? 'text-yellow-400' : 'text-white'}`}>
            {analysis.deviation}°
          </span>
        </div>
        <div>
          <span className="text-ocean-400">Angle au vent:</span>
          <span className={`ml-1 ${analysis.inNoGoZone ? 'text-red-400' : 'text-white'}`}>
            {analysis.angleToWind}°
          </span>
        </div>
      </div>

      {analysis.inNoGoZone && (
        <div className="mt-2 text-red-400 text-xs bg-red-500/10 rounded px-2 py-1">
          ⚠️ Zone interdite ! Vous remontez trop au vent.
        </div>
      )}

      {analysis.needsTacking && !analysis.inNoGoZone && (
        <div className="mt-2 text-yellow-400 text-xs bg-yellow-500/10 rounded px-2 py-1">
          💡 Louvoyer nécessaire pour atteindre le waypoint
        </div>
      )}

      {analysis.deviation > 30 && !analysis.inNoGoZone && (
        <div className="mt-2 text-ocean-300 text-xs">
          Suggestion: Tournez vers {analysis.optimalHeading}° pour optimiser votre route
        </div>
      )}
    </div>
  );
}

export default HeadingIndicator;
