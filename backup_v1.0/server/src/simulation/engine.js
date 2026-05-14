import { v4 as uuidv4 } from 'uuid';
import { updateWind } from './wind.js';
import { moveBoat, calculateOptimalHeading } from './physics.js';
import { updateBotDecisions } from './bots.js';
import { checkWaypointReached, finishRace } from './race.js';
import { saveDatabase } from '../database/init.js';

const TICK_INTERVAL = 60000; // 60 seconds
const WIND_UPDATE_INTERVAL = 30 * 60 * 1000; // 30 minutes

let lastWindUpdate = Date.now();

export function startSimulation(db) {
  console.log('🎮 Starting simulation engine...');

  // Initial tick
  simulationTick(db);

  // Main simulation loop
  setInterval(() => {
    simulationTick(db);
  }, TICK_INTERVAL);

  // Check for race starts every 10 seconds
  setInterval(() => {
    checkRaceStarts(db);
  }, 10000);
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

    // Update wind if needed
    if (Date.now() - lastWindUpdate > WIND_UPDATE_INTERVAL) {
      updateWind(db, raceId);
      lastWindUpdate = Date.now();
      console.log(`🌬️ Wind updated for race ${raceName}`);
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
             b.is_bot, b.bot_level, b.speed_max, b.vmg_upwind, b.vmg_downwind, b.vmg_reaching, b.storm_resistance
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

    // Process each boat
    for (const participant of participants[0].values) {
      const [
        participantId, boatId, lat, lon, heading, sailType, currentWaypoint, finished,
        isBot, botLevel, speedMax, vmgUpwind, vmgDownwind, vmgReaching, stormResistance
      ] = participant;

      if (finished) continue;

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
        stormResistance
      };

      const wind = { direction: windDirection, speed: windSpeed };
      const targetWaypoint = waypoints[currentWaypoint];

      // Bot AI: recalculate heading
      if (isBot) {
        const newHeading = updateBotDecisions(boat, targetWaypoint, wind);
        boat.heading = newHeading;
        
        // Bot auto-selects optimal sail
        boat.sailType = selectOptimalSail(boat.heading, windDirection);
        
        db.run(`
          UPDATE race_participants SET heading = ?, sail_type = ? WHERE id = ?
        `, [boat.heading, boat.sailType, participantId]);
      }

      // Move boat
      const newPosition = moveBoat(boat, wind, TICK_INTERVAL / 1000);

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
          // Move to next waypoint
          db.run(`
            UPDATE race_participants SET current_waypoint = ? WHERE id = ?
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
    SELECT id, name, waypoints FROM races 
    WHERE status = 'upcoming' AND start_time <= ?
  `, [now]);

  if (!racesToStart.length || !racesToStart[0].values.length) {
    return;
  }

  for (const race of racesToStart[0].values) {
    const [raceId, raceName, waypointsJson] = race;
    const waypoints = JSON.parse(waypointsJson);
    const startPos = waypoints[0];

    console.log(`🚀 Starting race: ${raceName}`);

    // Update race status
    db.run(`UPDATE races SET status = 'active' WHERE id = ?`, [raceId]);

    // Initialize wind for this race
    const initialWindDir = Math.floor(Math.random() * 360);
    const initialWindSpeed = 10 + Math.random() * 15; // 10-25 knots

    db.run(`
      INSERT OR REPLACE INTO wind_state (race_id, direction, speed, last_update)
      VALUES (?, ?, ?, ?)
    `, [raceId, initialWindDir, initialWindSpeed, now]);

    // Position all participants at start
    db.run(`
      UPDATE race_participants 
      SET lat = ?, lon = ?, current_waypoint = 1, heading = 0
      WHERE race_id = ?
    `, [startPos.lat, startPos.lon, raceId]);

    // Add bots to the race if not already registered
    addBotsToRace(db, raceId, startPos);
  }
}

function addBotsToRace(db, raceId, startPos) {
  const bots = db.exec(`SELECT id FROM boats WHERE is_bot = 1`);
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

