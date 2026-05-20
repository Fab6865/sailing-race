// Nautical mile in degrees (approximate at mid-latitudes)
const NM_TO_DEG_LAT = 1 / 60;
const NM_TO_DEG_LON = 1 / 60; // Simplified, should vary with latitude

/**
 * Calculate boat speed based on wind angle and sail type
 * Returns speed in knots
 */
export function calculateBoatSpeed(boat, wind) {
  // Calculate angle between boat heading and wind direction
  let angleToWind = Math.abs(boat.heading - wind.direction);
  if (angleToWind > 180) angleToWind = 360 - angleToWind;

  // Base speed from wind
  let baseSpeed = wind.speed * 0.5; // Boat can achieve ~50% of wind speed max

  // VMG coefficient based on angle to wind
  let vmgCoeff = 1.0;

  if (angleToWind < 45) {
    // No-go zone - can't sail directly into wind
    vmgCoeff = 0.1;
  } else if (angleToWind < 60) {
    // Close hauled (beating)
    vmgCoeff = boat.vmgUpwind * (angleToWind - 45) / 15; // Gradual increase
  } else if (angleToWind < 90) {
    // Close reach
    vmgCoeff = boat.vmgUpwind + (boat.vmgReaching - boat.vmgUpwind) * (angleToWind - 60) / 30;
  } else if (angleToWind < 120) {
    // Beam reach - fastest point of sail
    vmgCoeff = boat.vmgReaching;
  } else if (angleToWind < 150) {
    // Broad reach
    vmgCoeff = boat.vmgReaching - (boat.vmgReaching - boat.vmgDownwind) * (angleToWind - 120) / 30;
  } else {
    // Running (downwind)
    vmgCoeff = boat.vmgDownwind;
  }

  // Sail type bonus/penalty - STRONG IMPACT
  let sailBonus = 1.0;
  if (boat.sailType === 'spi') {
    // Spinnaker: excellent downwind, terrible upwind
    if (angleToWind > 150) sailBonus = 1.5;       // Vent arrière = parfait
    else if (angleToWind > 120) sailBonus = 1.3;  // Largue = très bon
    else if (angleToWind > 90) sailBonus = 0.7;   // Travers = moyen
    else if (angleToWind > 60) sailBonus = 0.4;   // Près = mauvais
    else sailBonus = 0.1;                          // Face au vent = inutile
  } else if (boat.sailType === 'genois') {
    // Genoa: polyvalent, excellent au reaching
    if (angleToWind > 150) sailBonus = 0.8;       // Vent arrière = correct
    else if (angleToWind > 90) sailBonus = 1.3;   // Largue/travers = excellent
    else if (angleToWind > 60) sailBonus = 1.1;   // Près = bon
    else sailBonus = 0.5;                          // Face au vent = difficile
  } else if (boat.sailType === 'grandvoile') {
    // Grand-voile: meilleur au près, permet de remonter au vent
    if (angleToWind > 150) sailBonus = 0.5;       // Vent arrière = mauvais
    else if (angleToWind > 90) sailBonus = 0.7;   // Largue = moyen
    else if (angleToWind > 45) sailBonus = 1.2;   // Près = excellent
    else sailBonus = 0.8;                          // Face au vent = possible
  }

  // Storm penalty based on wind speed
  let stormPenalty = 1.0;
  if (wind.speed > 25) {
    const excessWind = wind.speed - 25;
    stormPenalty = Math.max(0.5, 1 - (excessWind * 0.02 * (1 - boat.stormResistance)));
  }

  // Calculate final speed
  let speed = baseSpeed * vmgCoeff * sailBonus * stormPenalty;

  // Trim bonus (player active sail trimming, max +3 knots)
  speed += boat.trimBonus || 0;

  // Boost bonus (+3.9 knots flat)
  if (boat.boostActive) {
    speed += 3.9;
  }

  // Cap at boat's max speed (boost and trim can exceed slightly)
  const maxSpeed = boat.boostActive ? boat.speedMax + 5 : boat.speedMax + (boat.trimBonus || 0);
  speed = Math.min(speed, maxSpeed);

  // Minimum speed (drift)
  speed = Math.max(speed, 0.5);

  return speed;
}

/**
 * Move boat based on heading and speed
 * Returns new position {lat, lon, speed}
 * previousSpeed: optional — when provided, applies gentle inertia so speed
 * changes are gradual rather than instantaneous (boat momentum).
 */
export function moveBoat(boat, wind, deltaSeconds, previousSpeed = null) {
  const targetSpeed = calculateBoatSpeed(boat, wind);

  // Inertia: blend toward target speed (factor ~0.55 per 60s tick feels natural)
  const speed = previousSpeed !== null
    ? previousSpeed + (targetSpeed - previousSpeed) * 0.55
    : targetSpeed;

  // Distance traveled in nautical miles
  const distanceNM = (speed * deltaSeconds) / 3600;

  // Convert heading to radians
  const headingRad = (boat.heading * Math.PI) / 180;

  // Calculate new position
  const deltaLat = distanceNM * Math.cos(headingRad) * NM_TO_DEG_LAT;
  const deltaLon = distanceNM * Math.sin(headingRad) * NM_TO_DEG_LON / Math.cos(boat.lat * Math.PI / 180);

  return {
    lat: boat.lat + deltaLat,
    lon: boat.lon + deltaLon,
    speed: speed
  };
}

/**
 * Calculate optimal heading to reach a waypoint
 * Takes into account wind direction for tacking
 */
export function calculateOptimalHeading(boat, waypoint, wind) {
  // Direct heading to waypoint
  const directHeading = calculateBearing(boat.lat, boat.lon, waypoint.lat, waypoint.lon);

  // Check if direct heading is in no-go zone
  let angleToWind = Math.abs(directHeading - wind.direction);
  if (angleToWind > 180) angleToWind = 360 - angleToWind;

  if (angleToWind < 45) {
    // Need to tack - choose best tack
    const tackAngle = 50; // Optimal close-hauled angle
    
    // Calculate both tack options
    const portTack = (wind.direction + tackAngle) % 360;
    const starboardTack = (wind.direction - tackAngle + 360) % 360;

    // Choose tack that gets us closer to waypoint
    const portDiff = Math.abs(portTack - directHeading);
    const starboardDiff = Math.abs(starboardTack - directHeading);

    return portDiff < starboardDiff ? portTack : starboardTack;
  }

  return directHeading;
}

/**
 * Calculate bearing between two points
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360;

  return bearing;
}

/**
 * Calculate distance between two points in nautical miles
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate sail efficiency for current wind angle
 * Returns { efficiency: 0-100, status: 'optimal'|'good'|'bad', optimalSail: string }
 */
export function calculateSailEfficiency(sailType, heading, windDirection) {
  let angleToWind = Math.abs(heading - windDirection);
  if (angleToWind > 180) angleToWind = 360 - angleToWind;

  // Calculate bonus for each sail type at this angle
  const getSailBonus = (sail) => {
    if (sail === 'spi') {
      if (angleToWind > 150) return 1.5;
      else if (angleToWind > 120) return 1.3;
      else if (angleToWind > 90) return 0.7;
      else if (angleToWind > 60) return 0.4;
      else return 0.1;
    } else if (sail === 'genois') {
      if (angleToWind > 150) return 0.8;
      else if (angleToWind > 90) return 1.3;
      else if (angleToWind > 60) return 1.1;
      else return 0.5;
    } else if (sail === 'grandvoile') {
      if (angleToWind > 150) return 0.5;
      else if (angleToWind > 90) return 0.7;
      else if (angleToWind > 45) return 1.2;
      else return 0.8;
    }
    return 1.0;
  };

  const currentBonus = getSailBonus(sailType);
  const spiBonus = getSailBonus('spi');
  const genoisBonus = getSailBonus('genois');
  const gvBonus = getSailBonus('grandvoile');

  // Find optimal sail
  const maxBonus = Math.max(spiBonus, genoisBonus, gvBonus);
  let optimalSail = 'genois';
  if (spiBonus === maxBonus) optimalSail = 'spi';
  else if (gvBonus === maxBonus) optimalSail = 'grandvoile';

  // Calculate efficiency percentage (current vs optimal)
  const efficiency = Math.round((currentBonus / maxBonus) * 100);

  // Determine status
  let status = 'bad';
  if (efficiency >= 90) status = 'optimal';
  else if (efficiency >= 70) status = 'good';

  return {
    efficiency,
    status,
    optimalSail,
    currentBonus,
    angleToWind
  };
}
