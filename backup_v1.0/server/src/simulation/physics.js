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

  // Sail type bonus/penalty
  let sailBonus = 1.0;
  if (boat.sailType === 'spi') {
    // Spinnaker: great downwind, bad upwind
    if (angleToWind > 120) sailBonus = 1.15;
    else if (angleToWind < 90) sailBonus = 0.6;
  } else if (boat.sailType === 'genois') {
    // Genoa: good all-around, best for reaching
    if (angleToWind >= 60 && angleToWind <= 140) sailBonus = 1.05;
  } else if (boat.sailType === 'grandvoile') {
    // Main sail only: best for close hauled
    if (angleToWind < 70) sailBonus = 1.1;
    else sailBonus = 0.85;
  }

  // Storm penalty based on wind speed
  let stormPenalty = 1.0;
  if (wind.speed > 25) {
    const excessWind = wind.speed - 25;
    stormPenalty = Math.max(0.5, 1 - (excessWind * 0.02 * (1 - boat.stormResistance)));
  }

  // Calculate final speed
  let speed = baseSpeed * vmgCoeff * sailBonus * stormPenalty;

  // Cap at boat's max speed
  speed = Math.min(speed, boat.speedMax);

  // Minimum speed (drift)
  speed = Math.max(speed, 0.5);

  return speed;
}

/**
 * Move boat based on heading and speed
 * Returns new position {lat, lon}
 */
export function moveBoat(boat, wind, deltaSeconds) {
  const speed = calculateBoatSpeed(boat, wind);
  
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
