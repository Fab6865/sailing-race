import { v4 as uuidv4 } from 'uuid';
import { updateWind } from './wind.js';
import { moveBoat, calculateOptimalHeading, calculateBearing, calculateDistance } from './physics.js';
import { updateBotDecisions } from './bots.js';
import { checkWaypointReached, finishRace } from './race.js';
import { saveDatabase } from '../database/init.js';

// Calculate heading from boat to target point
function calculateHeadingToTarget(boat, target) {
  return calculateBearing(boat.lat, boat.lon, target.lat, target.lon);
}

// Calculate distance in nautical miles
function calculateDistanceNM(lat1, lon1, lat2, lon2) {
  return calculateDistance(lat1, lon1, lat2, lon2);
}

const BASE_TICK_INTERVAL = 60000; // 60 seconds
const WIND_UPDATE_INTERVAL = 60 * 60 * 1000; // 1 hour (more frequent wind changes)

let currentTickInterval = null;
let currentApp = null;

function pickWindInterval(previousInterval) {
  const MIN = 18000; // 5 hours
  const MAX = 28800; // 8 hours
  let interval;
  do {
    interval = Math.floor(MIN + Math.random() * (MAX - MIN));
  } while (previousInterval && Math.abs(interval - previousInterval) < 1800); // differ by at least 30 min
  return interval;
}

// In-memory previous speeds for inertia smoothing (participantId -> knots)
const prevSpeeds = new Map();
// Multiplicateur de vitesse persistant par bot (attribué une fois, stable toute la course)
const botSpeedMultipliers = new Map();

export function startSimulation(db, app) {
  console.log('🎮 Starting simulation engine...');
  currentApp = app;

  // Reset next_change_at for all active races so the first tick re-assigns a fresh 5–8h interval
  db.run(`UPDATE wind_state SET next_change_at = 0 WHERE race_id IN (SELECT id FROM races WHERE status = 'active')`);
  // Reset old boost values on startup so no stale boost remains from previous session
  db.run(`UPDATE race_participants SET boost_active_until = 0, boost_energy = 0`);
  console.log('🔄 Boost values reset for all participants');

  // Initial tick
  simulationTick(db);

  // Start dynamic tick loop
  scheduleNextTick(db);

  // Check for race starts every 10 seconds
  setInterval(() => {
    checkRaceStarts(db);
  }, 10000);

  // Return trigger function for manual ticks
  return {
    triggerTick: () => simulationTick(db)
  };
}

function getTickInterval() {
  const multiplier = currentApp?.locals?.simulation?.speedMultiplier || 1;
  return Math.max(100, BASE_TICK_INTERVAL / multiplier); // Min 100ms
}

function scheduleNextTick(db) {
  const interval = getTickInterval();
  
  if (currentTickInterval) {
    clearTimeout(currentTickInterval);
  }
  
  currentTickInterval = setTimeout(() => {
    simulationTick(db);
    scheduleNextTick(db);
  }, interval);
}

function simulationTick(db) {
  const now = Math.floor(Date.now() / 1000);
  
  // Get all active races
  const activeRaces = db.exec(`
    SELECT id, name, waypoints FROM races WHERE status = 'active'
  `);

  if (!activeRaces.length || !activeRaces[0].values.length) {
    return;
  }

  for (const race of activeRaces[0].values) {
    const [raceId, raceName, waypointsJson] = race;
    const waypoints = JSON.parse(waypointsJson);

    // Update wind per-race — uses next_change_at stored in DB (survives restarts, no circular deps)
    const windTimeResult = db.exec(`SELECT last_update, next_change_at FROM wind_state WHERE race_id = ?`, [raceId]);
    const lastWindUpdateDb = windTimeResult.length && windTimeResult[0].values.length
      ? (windTimeResult[0].values[0][0] || 0) : 0;
    const nextChangeAtDb = windTimeResult.length && windTimeResult[0].values.length
      ? (windTimeResult[0].values[0][1] || 0) : 0;

    // If next_change_at not set yet, assign a random interval (5–8h) from now
    if (nextChangeAtDb === 0) {
      const interval = pickWindInterval(null);
      db.run(`UPDATE wind_state SET next_change_at = ? WHERE race_id = ?`, [now + interval, raceId]);
    } else if (now >= nextChangeAtDb) {
      updateWind(db, raceId);
      const prevInterval = nextChangeAtDb - lastWindUpdateDb;
      const newInterval = pickWindInterval(prevInterval > 0 ? prevInterval : null);
      db.run(`UPDATE wind_state SET next_change_at = ? WHERE race_id = ?`, [now + newInterval, raceId]);
      // Reset trim for all players in this race (wind changed = sail trim invalidated)
      db.run(`UPDATE race_participants SET trim_bonus = 0 WHERE race_id = ? AND finished = 0`, [raceId]);
      const h = Math.floor(newInterval / 3600);
      const m = Math.floor((newInterval % 3600) / 60);
      console.log(`🌬️ Wind updated for race ${raceName} — next change in ${h}h${m}m`);
    }

    // Get wind state
    const windResult = db.exec(`
      SELECT direction, speed FROM wind_state WHERE race_id = ?
    `, [raceId]);

    let windDirection = 0;
    let windSpeed = 15;
    if (windResult.length && windResult[0].values.length) {
      [windDirection, windSpeed] = windResult[0].values[0];
    }

    // Get all participants in this race
    const participants = db.exec(`
      SELECT rp.id, rp.boat_id, rp.lat, rp.lon, rp.heading, rp.sail_type, rp.current_waypoint, rp.finished,
             b.is_bot, b.bot_level, b.speed_max, b.vmg_upwind, b.vmg_downwind, b.vmg_reaching, b.storm_resistance,
             rp.custom_route, rp.current_route_point, rp.boost_active_until, rp.trim_bonus
      FROM race_participants rp
      JOIN boats b ON rp.boat_id = b.id
      WHERE rp.race_id = ? AND rp.finished = 0
    `, [raceId]);

    if (!participants.length || !participants[0].values.length) {
      // Check if race should be marked as finished
      const unfinished = db.exec(`
        SELECT COUNT(*) FROM race_participants WHERE race_id = ? AND finished = 0
      `, [raceId]);
      
      if (unfinished[0].values[0][0] === 0) {
        db.run(`UPDATE races SET status = 'finished' WHERE id = ?`, [raceId]);
        console.log(`🏁 Race ${raceName} finished!`);
      }
      continue;
    }

    // now already defined at top of simulationTick
    
    // Process each boat
    for (const participant of participants[0].values) {
      const [
        participantId, boatId, lat, lon, heading, sailType, currentWaypoint, finished,
        isBot, botLevel, speedMax, vmgUpwind, vmgDownwind, vmgReaching, stormResistance,
        customRouteJson, currentRoutePoint, boostActiveUntil, trimBonus
      ] = participant;

      if (finished) continue;
      
      // Check if boost is active
      const boostActive = (boostActiveUntil || 0) > now;

      // Parse custom route if exists
      const customRoute = customRouteJson ? JSON.parse(customRouteJson) : [];

      const boat = {
        id: participantId,
        boatId,
        lat,
        lon,
        heading,
        sailType,
        currentWaypoint,
        isBot,
        botLevel,
        speedMax,
        vmgUpwind,
        vmgDownwind,
        vmgReaching,
        stormResistance,
        customRoute,
        currentRoutePoint: currentRoutePoint || 0,
        boostActive,
        trimBonus: trimBonus || 0
      };

      const wind = { direction: windDirection, speed: windSpeed };
      const targetWaypoint = waypoints[currentWaypoint];

      // All boats use optimal heading with automatic tacking when facing wind
      // Bots auto-select sail, players choose their sail manually
      
      if (isBot) {
        // Bot AI: auto heading with tacking + auto sail
        const newHeading = calculateOptimalHeading(boat, targetWaypoint, wind);
        boat.heading = newHeading;
        boat.sailType = selectOptimalSail(boat.heading, windDirection);
        
        db.run(`
          UPDATE race_participants SET heading = ?, sail_type = ? WHERE id = ?
        `, [boat.heading, boat.sailType, participantId]);
      } else {
        // Player: auto heading with tacking (same as bots), but keeps their chosen sail
        const newHeading = calculateOptimalHeading(boat, targetWaypoint, wind);
        boat.heading = newHeading;
        
        db.run(`
          UPDATE race_participants SET heading = ? WHERE id = ?
        `, [boat.heading, participantId]);
      }

      // Variation de vitesse pour bots amateur et pro (attribuée une fois par bot)
      if (isBot && !botSpeedMultipliers.has(participantId)) {
        if (botLevel === 'amateur' || botLevel === 'beginner') {
          // Amateur : 72% à 100% de la vitesse max → gros écarts
          botSpeedMultipliers.set(participantId, 0.72 + Math.random() * 0.28);
        } else if (botLevel === 'pro' || botLevel === 'advanced') {
          // Pro : 88% à 102% → légère variation
          botSpeedMultipliers.set(participantId, 0.88 + Math.random() * 0.14);
        } else {
          botSpeedMultipliers.set(participantId, 1.0);
        }
      }
      const speedMult = (isBot && botSpeedMultipliers.has(participantId))
        ? botSpeedMultipliers.get(participantId) : 1.0;
      const adjustedBoat = isBot ? { ...boat, speedMax: boat.speedMax * speedMult } : boat;

      // Move boat (with inertia: pass previous speed so acceleration is gradual)
      const previousSpeed = prevSpeeds.get(participantId) || null;
      const newPosition = moveBoat(adjustedBoat, wind, BASE_TICK_INTERVAL / 1000, previousSpeed);
      prevSpeeds.set(participantId, newPosition.speed);

      // Update position
      db.run(`
        UPDATE race_participants SET lat = ?, lon = ? WHERE id = ?
      `, [newPosition.lat, newPosition.lon, participantId]);

      // Check waypoint reached
      const waypointReached = checkWaypointReached(newPosition, targetWaypoint);
      
      if (waypointReached) {
        const nextWaypoint = currentWaypoint + 1;
        
        if (nextWaypoint >= waypoints.length) {
          // Boat finished the race
          finishRace(db, raceId, participantId, boatId, now);
        } else {
          // Move to next waypoint and reset trim (new leg = new sail trim needed)
          db.run(`
            UPDATE race_participants SET current_waypoint = ?, trim_bonus = 0 WHERE id = ?
          `, [nextWaypoint, participantId]);
          console.log(`⚓ Boat reached waypoint ${currentWaypoint + 1}`);
        }
      }
    }
  }

  // Save database periodically
  saveDatabase(db);
}

function checkRaceStarts(db) {
  const now = Math.floor(Date.now() / 1000);

  // Find races that should start
  const racesToStart = db.exec(`
    SELECT id, name, waypoints, difficulty FROM races 
    WHERE status = 'upcoming' AND start_time <= ?
  `, [now]);

  if (!racesToStart.length || !racesToStart[0].values.length) {
    return;
  }

  for (const race of racesToStart[0].values) {
    const [raceId, raceName, waypointsJson, difficulty] = race;
    const waypoints = JSON.parse(waypointsJson);
    const startPos = waypoints[0];

    console.log(`🚀 Starting race: ${raceName} (difficulty: ${difficulty || 'mixed'})`);

    // Update race status
    db.run(`UPDATE races SET status = 'active' WHERE id = ?`, [raceId]);

    // Initialize wind for this race
    const initialWindDir = Math.floor(Math.random() * 360);
    const initialWindSpeed = 10 + Math.random() * 15; // 10-25 knots

    const initialInterval = pickWindInterval(null);
    db.run(`
      INSERT OR REPLACE INTO wind_state (race_id, direction, speed, last_update, next_change_at)
      VALUES (?, ?, ?, ?, ?)
    `, [raceId, initialWindDir, initialWindSpeed, now, now + initialInterval]);

    // Position all participants at start
    db.run(`
      UPDATE race_participants 
      SET lat = ?, lon = ?, current_waypoint = 1, heading = 0
      WHERE race_id = ?
    `, [startPos.lat, startPos.lon, raceId]);

    // Add bots to the race based on difficulty
    addBotsToRace(db, raceId, startPos, difficulty || 'mixed');
  }
}

function addBotsToRace(db, raceId, startPos, difficulty = 'mixed') {
  // Filter bots based on difficulty
  const difficultyLevels = {
    'amateur': ['beginner'],
    'intermediate': ['beginner', 'intermediate'],
    'pro': ['advanced', 'expert'],
    'mixed': ['beginner', 'intermediate', 'advanced', 'expert']
  };

  const allowedLevels = difficultyLevels[difficulty] || difficultyLevels['mixed'];
  const levelFilter = allowedLevels.map(l => `'${l}'`).join(',');

  const bots = db.exec(`SELECT id, bot_level FROM boats WHERE is_bot = 1 AND bot_level IN (${levelFilter})`);
  if (!bots.length || !bots[0].values.length) return;

  const existingBots = db.exec(`
    SELECT boat_id FROM race_participants WHERE race_id = ?
  `, [raceId]);

  const existingIds = new Set();
  if (existingBots.length && existingBots[0].values.length) {
    existingBots[0].values.forEach(row => existingIds.add(row[0]));
  }

  for (const bot of bots[0].values) {
    const botId = bot[0];
    if (!existingIds.has(botId)) {
      const heading = Math.floor(Math.random() * 360);
      db.run(`
        INSERT INTO race_participants (id, race_id, boat_id, lat, lon, heading, sail_type, current_waypoint)
        VALUES (?, ?, ?, ?, ?, ?, 'genois', 1)
      `, [uuidv4(), raceId, botId, startPos.lat, startPos.lon, heading]);
    }
  }
}

function selectOptimalSail(heading, windDirection) {
  // Calculate angle to wind
  let angleToWind = Math.abs(heading - windDirection);
  if (angleToWind > 180) angleToWind = 360 - angleToWind;

  // Select sail based on angle
  if (angleToWind < 60) {
    return 'grandvoile'; // Close hauled - main sail only
  } else if (angleToWind > 140) {
    return 'spi'; // Running - spinnaker
  } else {
    return 'genois'; // Reaching - genoa
  }
}

