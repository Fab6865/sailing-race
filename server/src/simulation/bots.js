import { calculateOptimalHeading, calculateBearing, calculateDistance } from './physics.js';

/**
 * Enhanced Bot AI decision making
 * Bots have personality traits and strategic thinking
 */

// Error margins by bot level (in degrees)
const BOT_ERROR_MARGINS = {
  beginner: 30,
  intermediate: 15,
  advanced: 8,
  expert: 3
};

// Decision frequency (how often bots reconsider their heading)
const BOT_DECISION_FREQUENCY = {
  beginner: 0.4,      // 40% chance to recalculate each tick
  intermediate: 0.6,  // 60% chance
  advanced: 0.8,      // 80% chance
  expert: 0.95        // 95% chance
};

// Bot personality traits
const BOT_PERSONALITIES = {
  aggressive: {
    riskTolerance: 0.8,
    sailChangeDelay: 0.5,
    waypointMargin: 0.8  // Cut closer to waypoints
  },
  conservative: {
    riskTolerance: 0.3,
    sailChangeDelay: 1.2,
    waypointMargin: 1.2  // More margin around waypoints
  },
  balanced: {
    riskTolerance: 0.5,
    sailChangeDelay: 0.8,
    waypointMargin: 1.0
  }
};

/**
 * Update bot heading decision with enhanced AI
 * Returns new heading
 */
export function updateBotDecisions(boat, waypoint, wind) {
  const level = boat.botLevel || 'intermediate';
  
  // Get bot personality (randomly assigned if not set)
  const personality = boat.personality || 
    Object.keys(BOT_PERSONALITIES)[Math.floor(Math.random() * 3)];
  const traits = BOT_PERSONALITIES[personality];
  
  // Check if bot should recalculate this tick
  if (Math.random() > BOT_DECISION_FREQUENCY[level]) {
    return boat.heading; // Keep current heading
  }

  // Calculate distance to waypoint
  const distanceToWaypoint = calculateDistance(boat.lat, boat.lon, waypoint.lat, waypoint.lon);
  
  // Adjust waypoint approach based on personality
  let adjustedWaypoint = { ...waypoint };
  if (distanceToWaypoint < 5) { // Within 5 NM
    // Personality affects how close bots get to waypoints
    const margin = traits.waypointMargin;
    const bearing = calculateBearing(boat.lat, boat.lon, waypoint.lat, waypoint.lon);
    // This is simplified - in reality would adjust position based on margin
  }

  // Calculate optimal heading
  const optimalHeading = calculateOptimalHeading(boat, adjustedWaypoint, wind);

  // Add error based on skill level and personality
  const baseError = BOT_ERROR_MARGINS[level];
  const personalityError = (1 - traits.riskTolerance) * 10;
  const errorMargin = baseError + personalityError;
  const error = (Math.random() - 0.5) * 2 * errorMargin;

  let newHeading = (optimalHeading + error + 360) % 360;

  // Expert bots sometimes make perfect decisions
  if (level === 'expert' && Math.random() > 0.8) {
    newHeading = optimalHeading;
  }

  // Beginner bots sometimes make really bad decisions
  if (level === 'beginner' && Math.random() > 0.85) {
    // Random heading
    newHeading = Math.random() * 360;
  }

  // Store personality for consistency
  boat.personality = personality;
  
  return Math.round(newHeading);
}

/**
 * Select optimal sail for bot with personality influence
 */
export function selectBotSail(heading, windDirection, level, personality = 'balanced') {
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

  // Personality affects sail choices
  const traits = BOT_PERSONALITIES[personality];
  
  // Aggressive bots might push spi earlier
  if (personality === 'aggressive' && angleToWind > 120) {
    optimalSail = 'spi';
  }
  
  // Conservative bots might stay with safer sails
  if (personality === 'conservative' && angleToWind < 160) {
    optimalSail = 'genois';
  }

  // Lower level bots sometimes pick wrong sail
  const baseSailErrorChance = {
    beginner: 0.35,
    intermediate: 0.15,
    advanced: 0.05,
    expert: 0.01
  };

  // Personality affects error rate
  const personalityErrorBonus = traits.sailChangeDelay - 0.8;
  const sailErrorChance = baseSailErrorChance[level] + personalityErrorBonus;

  if (Math.random() < sailErrorChance) {
    const sails = ['spi', 'genois', 'grandvoile'];
    return sails[Math.floor(Math.random() * sails.length)];
  }

  return optimalSail;
}

/**
 * Generate bot name with personality hint
 */
export function generateBotName(personality) {
  const prefixes = {
    aggressive: ['Captain', 'Admiral', 'Commodore'],
    conservative: ['Skipper', 'Sailor', 'Navigator'],
    balanced: ['Captain', 'Skipper', 'Pilot']
  };
  
  const names = {
    aggressive: ['Storm', 'Tempest', 'Cyclone', 'Thunder', 'Lightning'],
    conservative: ['Wave', 'Tide', 'Reef', 'Harbor', 'Calm'],
    balanced: ['Wind', 'Ocean', 'Sea', 'Breeze', 'Zephyr']
  };
  
  const prefixList = prefixes[personality] || prefixes.balanced;
  const nameList = names[personality] || names.balanced;
  
  const prefix = prefixList[Math.floor(Math.random() * prefixList.length)];
  const name = nameList[Math.floor(Math.random() * nameList.length)];
  
  return `${prefix} ${name}`;
}

/**
 * Calculate bot aggression for racing
 * Higher aggression = more risk-taking
 */
export function getBotAggression(level, personality) {
  const baseAggression = {
    beginner: 0.3,
    intermediate: 0.5,
    advanced: 0.7,
    expert: 0.85
  };

  const personalityModifier = {
    aggressive: 0.15,
    conservative: -0.1,
    balanced: 0
  };

  // Combine level and personality
  let aggression = baseAggression[level] + (personalityModifier[personality] || 0);
  
  // Add some randomness
  return Math.max(0.1, Math.min(1.0, aggression + (Math.random() - 0.5) * 0.1));
}

/**
 * Initialize bot with personality and skill
 */
export function initializeBot(bot, level) {
  const personalities = Object.keys(BOT_PERSONALITIES);
  const personality = personalities[Math.floor(Math.random() * personalities.length)];
  
  bot.botLevel = level;
  bot.personality = personality;
  bot.name = generateBotName(personality);
  bot.aggression = getBotAggression(level, personality);
  
  return bot;
}
