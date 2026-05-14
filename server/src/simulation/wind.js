/**
 * Wind simulation system
 * Wind changes gradually over time
 */

/**
 * Update wind for a race
 * Wind direction shifts by ±30° and speed varies by ±5 knots
 */
// Store last wind change for notifications
let lastWindChanges = {};

export function updateWind(db, raceId) {
  const now = Math.floor(Date.now() / 1000);

  // Get current wind state
  const result = db.exec(`
    SELECT direction, speed FROM wind_state WHERE race_id = ?
  `, [raceId]);

  let currentDirection = 0;
  let currentSpeed = 15;

  if (result.length && result[0].values.length) {
    [currentDirection, currentSpeed] = result[0].values[0];
  }

  // Calculate new wind values with gradual change
  const directionChange = (Math.random() - 0.5) * 60; // ±30°
  const speedChange = (Math.random() - 0.5) * 10; // ±5 knots

  let newDirection = (currentDirection + directionChange + 360) % 360;
  let newSpeed = currentSpeed + speedChange;

  // Clamp speed between 5 and 35 knots
  newSpeed = Math.max(5, Math.min(35, newSpeed));

  // Store wind change info for notifications
  lastWindChanges[raceId] = {
    timestamp: now,
    oldDirection: currentDirection,
    oldSpeed: currentSpeed,
    newDirection: newDirection,
    newSpeed: newSpeed,
    directionChange: Math.round(newDirection - currentDirection),
    speedChange: Math.round((newSpeed - currentSpeed) * 10) / 10
  };

  // Update database
  db.run(`
    UPDATE wind_state SET direction = ?, speed = ?, last_update = ?
    WHERE race_id = ?
  `, [newDirection, newSpeed, now, raceId]);

  console.log(`🌬️ Wind updated: ${Math.round(newDirection)}° @ ${newSpeed.toFixed(1)} knots`);

  return { direction: newDirection, speed: newSpeed };
}

/**
 * Get last wind change for a race (for notifications)
 */
export function getLastWindChange(raceId) {
  return lastWindChanges[raceId] || null;
}

/**
 * Get wind forecast for a race
 * Returns current wind and predicted future wind
 */
export function getWindForecast(db, raceId, hoursAhead = 0) {
  const result = db.exec(`
    SELECT direction, speed, last_update FROM wind_state WHERE race_id = ?
  `, [raceId]);

  if (!result.length || !result[0].values.length) {
    return {
      current: { direction: 0, speed: 15 },
      forecast: []
    };
  }

  const [direction, speed, lastUpdate] = result[0].values[0];

  const current = { direction, speed };
  const forecast = [];

  // Generate forecast based on current trends
  // This is a simplified prediction - real weather would be more complex
  if (hoursAhead > 0) {
    let forecastDir = direction;
    let forecastSpeed = speed;

    for (let h = 1; h <= hoursAhead; h++) {
      // Predict gradual changes
      forecastDir = (forecastDir + (Math.random() - 0.5) * 20 + 360) % 360;
      forecastSpeed = Math.max(5, Math.min(35, forecastSpeed + (Math.random() - 0.5) * 4));

      forecast.push({
        hour: h,
        direction: Math.round(forecastDir),
        speed: Math.round(forecastSpeed * 10) / 10
      });
    }
  }

  return { current, forecast };
}

/**
 * Get wind direction as compass text
 */
export function windDirectionToText(direction) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(direction / 22.5) % 16;
  return directions[index];
}

/**
 * Get Beaufort scale from wind speed
 */
export function getBeaufortScale(speedKnots) {
  if (speedKnots < 1) return { force: 0, description: 'Calme' };
  if (speedKnots < 4) return { force: 1, description: 'Très légère brise' };
  if (speedKnots < 7) return { force: 2, description: 'Légère brise' };
  if (speedKnots < 11) return { force: 3, description: 'Petite brise' };
  if (speedKnots < 17) return { force: 4, description: 'Jolie brise' };
  if (speedKnots < 22) return { force: 5, description: 'Bonne brise' };
  if (speedKnots < 28) return { force: 6, description: 'Vent frais' };
  if (speedKnots < 34) return { force: 7, description: 'Grand frais' };
  if (speedKnots < 41) return { force: 8, description: 'Coup de vent' };
  if (speedKnots < 48) return { force: 9, description: 'Fort coup de vent' };
  if (speedKnots < 56) return { force: 10, description: 'Tempête' };
  if (speedKnots < 64) return { force: 11, description: 'Violente tempête' };
  return { force: 12, description: 'Ouragan' };
}
