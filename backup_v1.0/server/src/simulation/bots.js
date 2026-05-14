import { calculateOptimalHeading, calculateBearing } from './physics.js';

/**
 * Bot AI decision making
 * Bots recalculate their heading based on their skill level
 */

// Error margins by bot level (in degrees)
const BOT_ERROR_MARGINS = {
  beginner: 25,
  intermediate: 15,
  advanced: 8,
  expert: 5
};

// Decision frequency (how often bots reconsider their heading)
const BOT_DECISION_FREQUENCY = {
  beginner: 0.3,      // 30% chance to recalculate each tick
  intermediate: 0.5,  // 50% chance
  advanced: 0.7,      // 70% chance
  expert: 0.9         // 90% chance
};

/**
 * Update bot heading decision
 * Returns new heading
 */
export function updateBotDecisions(boat, waypoint, wind) {
  const level = boat.botLevel || 'intermediate';
  
  // Check if bot should recalculate this tick
  if (Math.random() > BOT_DECISION_FREQUENCY[level]) {
    return boat.heading; // Keep current heading
  }

  // Calculate optimal heading
  const optimalHeading = calculateOptimalHeading(boat, waypoint, wind);

  // Add error based on skill level
  const errorMargin = BOT_ERROR_MARGINS[level];
  const error = (Math.random() - 0.5) * 2 * errorMargin;

  let newHeading = (optimalHeading + error + 360) % 360;

  // Expert bots sometimes make perfect decisions
  if (level === 'expert' && Math.random() > 0.7) {
    newHeading = optimalHeading;
  }

  // Beginner bots sometimes make really bad decisions
  if (level === 'beginner' && Math.random() > 0.9) {
    // Random heading
    newHeading = Math.random() * 360;
  }

  return Math.round(newHeading);
}

/**
 * Select optimal sail for bot based on wind angle
 */
export function selectBotSail(heading, windDirection, level) {
  let angleToWind = Math.abs(heading - windDirection);
  if (angleToWind > 180) angleToWind = 360 - angleToWind;

  // Optimal sail selection
  let optimalSail;
  if (angleToWind < 60) {
    optimalSail = 'grandvoile';
  } else if (angleToWind > 140) {
    optimalSail = 'spi';
  } else {
    optimalSail = 'genois';
  }

  // Lower level bots sometimes pick wrong sail
  const sailErrorChance = {
    beginner: 0.3,
    intermediate: 0.15,
    advanced: 0.05,
    expert: 0.01
  };

  if (Math.random() < sailErrorChance[level]) {
    const sails = ['spi', 'genois', 'grandvoile'];
    return sails[Math.floor(Math.random() * sails.length)];
  }

  return optimalSail;
}

/**
 * Generate bot name
 */
export function generateBotName() {
  const prefixes = ['Captain', 'Admiral', 'Skipper', 'Commodore', 'Sailor'];
  const names = ['Storm', 'Wave', 'Wind', 'Tide', 'Reef', 'Gulf', 'Ocean', 'Sea', 
                 'Tempest', 'Cyclone', 'Monsoon', 'Zephyr', 'Mistral', 'Alizé'];
  
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const name = names[Math.floor(Math.random() * names.length)];
  
  return `${prefix} ${name}`;
}

/**
 * Calculate bot aggression for racing
 * Higher aggression = more risk-taking
 */
export function getBotAggression(level) {
  const baseAggression = {
    beginner: 0.3,
    intermediate: 0.5,
    advanced: 0.7,
    expert: 0.85
  };

  // Add some randomness
  return baseAggression[level] + (Math.random() - 0.5) * 0.2;
}
