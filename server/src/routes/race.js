import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getRaceRankings, getRaceStatus } from '../simulation/race.js';
import { getWindForecast, windDirectionToText, getBeaufortScale, getLastWindChange } from '../simulation/wind.js';
import { calculateDistance, calculateSailEfficiency, calculateBoatSpeed } from '../simulation/physics.js';

const router = Router();

// Get all races (upcoming, active, finished)
router.get('/list', (req, res) => {
  const db = req.app.locals.db;
  const { status, playerId } = req.query;

  let query = `SELECT id, name, status, start_time, waypoints FROM races`;
  if (status) {
    query += ` WHERE status = '${status}'`;
  }
  query += ` ORDER BY start_time DESC`;

  const result = db.exec(query);

  if (!result.length) {
    return res.json([]);
  }

  // Get player's boat if playerId provided
  let playerBoatId = null;
  if (playerId) {
    const boatResult = db.exec(`SELECT id FROM boats WHERE player_id = ? AND is_bot = 0`, [playerId]);
    if (boatResult.length && boatResult[0].values.length) {
      playerBoatId = boatResult[0].values[0][0];
    }
  }

  const races = result[0].values.map(row => {
    const [id, name, raceStatus, startTime, waypointsJson] = row;
    const waypoints = JSON.parse(waypointsJson);

    // Count participants
    const countResult = db.exec(`
      SELECT COUNT(*) FROM race_participants WHERE race_id = ?
    `, [id]);
    const participantCount = countResult[0]?.values[0]?.[0] || 0;

    // Check if player has finished this race
    let playerFinished = false;
    if (playerBoatId) {
      const finishedResult = db.exec(`
        SELECT finished FROM race_participants WHERE race_id = ? AND boat_id = ?
      `, [id, playerBoatId]);
      if (finishedResult.length && finishedResult[0].values.length) {
        playerFinished = !!finishedResult[0].values[0][0];
      }
    }

    return {
      id,
      name,
      status: raceStatus,
      startTime,
      waypointCount: waypoints.length,
      participantCount,
      startLocation: waypoints[0]?.name || 'Unknown',
      endLocation: waypoints[waypoints.length - 1]?.name || 'Unknown',
      playerFinished
    };
  });

  res.json(races);
});

// Get race details
router.get('/:raceId', (req, res) => {
  const db = req.app.locals.db;
  const { raceId } = req.params;

  const status = getRaceStatus(db, raceId);
  if (!status) {
    return res.status(404).json({ error: 'Race not found' });
  }

  res.json(status);
});

// Get live race data (positions, wind, rankings)
router.get('/:raceId/live', (req, res) => {
  const db = req.app.locals.db;
  const { raceId } = req.params;
  const { playerId } = req.query;

  // Get race info
  const raceResult = db.exec(`
    SELECT id, name, status, start_time, waypoints FROM races WHERE id = ?
  `, [raceId]);

  if (!raceResult.length || !raceResult[0].values.length) {
    return res.status(404).json({ error: 'Race not found' });
  }

  const [id, name, status, startTime, waypointsJson] = raceResult[0].values[0];
  const waypoints = JSON.parse(waypointsJson);

  // Get wind (including last_update for countdown)
  const windResult2 = db.exec(`SELECT direction, speed, last_update FROM wind_state WHERE race_id = ?`, [raceId]);
  const windResult = windResult2; // alias used below for boats section

  let wind = { direction: 0, speed: 15 };
  if (windResult2.length && windResult2[0].values.length) {
    const [dir, spd, lastUpdate] = windResult2[0].values[0];
    const WIND_INTERVAL = 3600; // 1 hour in seconds
    const nextChangeAt = (lastUpdate || 0) + WIND_INTERVAL;
    const secondsUntilChange = Math.max(0, nextChangeAt - Math.floor(Date.now() / 1000));
    wind = {
      direction: Math.round(dir),
      speed: Math.round(spd * 10) / 10,
      directionText: windDirectionToText(dir),
      beaufort: getBeaufortScale(spd),
      lastUpdate: lastUpdate || 0,
      nextChangeIn: secondsUntilChange
    };
  }

  // Get all boat positions
  const boatsResult = db.exec(`
    SELECT rp.id, rp.boat_id, rp.lat, rp.lon, rp.heading, rp.sail_type, 
           rp.current_waypoint, rp.finished, rp.finish_position,
           b.name, b.is_bot, b.player_id,
           rp.boost_energy, rp.boost_active_until
    FROM race_participants rp
    JOIN boats b ON rp.boat_id = b.id
    WHERE rp.race_id = ?
  `, [raceId]);

  const boats = [];
  let playerBoat = null;

  const now = Math.floor(Date.now() / 1000);
  
  if (boatsResult.length && boatsResult[0].values.length) {
    for (const row of boatsResult[0].values) {
      const [participantId, boatId, lat, lon, heading, sailType, currentWaypoint, finished, finishPosition, boatName, isBot, boatPlayerId, boostEnergy, boostActiveUntil] = row;

      const boat = {
        id: participantId,
        boatId,
        name: boatName,
        lat,
        lon,
        heading,
        sailType,
        currentWaypoint,
        finished: !!finished,
        finishPosition,
        isBot: !!isBot,
        isPlayer: playerId && boatPlayerId === playerId
      };

      boats.push(boat);

      if (playerId && boatPlayerId === playerId) {
        // Calculate sail efficiency for player (with safe defaults)
        if (sailType && heading !== null && wind.direction !== undefined) {
          const sailEfficiency = calculateSailEfficiency(sailType, heading || 0, wind.direction || 0);
          boat.sailEfficiency = sailEfficiency;
        }
        
        // Add boost info for player
        boat.boostEnergy = boostEnergy || 0;
        boat.boostActive = (boostActiveUntil || 0) > now;
        boat.boostTimeLeft = Math.max(0, (boostActiveUntil || 0) - now);
        
        // Calculate current speed for speedometer
        const boatForSpeed = {
          heading: heading || 0,
          sailType: sailType || 'genois',
          speedMax: 8.0,
          vmgUpwind: 0.7,
          vmgDownwind: 0.85,
          vmgReaching: 1.0,
          stormResistance: 0.5,
          boostActive: boat.boostActive
        };
        const currentSpeed = calculateBoatSpeed(boatForSpeed, wind);
        boat.speed = Math.round(currentSpeed * 10) / 10;
        boat.maxSpeed = boat.boostActive ? 9.6 : 8.0;
        
        playerBoat = boat;
      }
    }
  }

  // Get rankings
  const rankings = getRaceRankings(db, raceId);

  // Always include a 3-hour forecast for immersion (upgrade extends it further)
  let forecastHours = 3;
  if (playerId) {
    const forecastResult = db.exec(`
      SELECT b.weather_forecast FROM boats b
      WHERE b.player_id = ?
    `, [playerId]);
    if (forecastResult.length && forecastResult[0].values.length) {
      const upgraded = forecastResult[0].values[0][0] || 0;
      if (upgraded > forecastHours) forecastHours = upgraded;
    }
  }
  const forecast = getWindForecast(db, raceId, forecastHours);

  // Get last wind change for notifications
  const windChange = getLastWindChange(raceId);

  res.json({
    race: {
      id,
      name,
      status,
      startTime,
      waypoints
    },
    wind,
    windChange,
    forecast,
    boats,
    playerBoat,
    rankings,
    serverTime: Math.floor(Date.now() / 1000)
  });
});

// Register for a race
router.post('/:raceId/register', (req, res) => {
  const db = req.app.locals.db;
  const { raceId } = req.params;
  const { boatId } = req.body;

  if (!boatId) {
    return res.status(400).json({ error: 'Boat ID required' });
  }

  // Check race exists and is upcoming
  const raceResult = db.exec(`
    SELECT status, waypoints FROM races WHERE id = ?
  `, [raceId]);

  if (!raceResult.length || !raceResult[0].values.length) {
    return res.status(404).json({ error: 'Race not found' });
  }

  const [status, waypointsJson] = raceResult[0].values[0];
  if (status !== 'upcoming') {
    return res.status(400).json({ error: 'Race already started or finished' });
  }

  // Check not already registered for THIS race
  const existingResult = db.exec(`
    SELECT id FROM race_participants WHERE race_id = ? AND boat_id = ?
  `, [raceId, boatId]);

  if (existingResult.length && existingResult[0].values.length) {
    return res.status(400).json({ error: 'Already registered for this race' });
  }

  // Check player is not already in another active race (not finished)
  // Allow registration if player has finished their current race
  const activeRaceResult = db.exec(`
    SELECT r.name, r.id FROM race_participants rp
    JOIN races r ON rp.race_id = r.id
    WHERE rp.boat_id = ? AND r.status = 'active' AND rp.finished = 0
  `, [boatId]);

  if (activeRaceResult.length && activeRaceResult[0].values.length) {
    const [activeRaceName, activeRaceId] = activeRaceResult[0].values[0];
    // Don't block if trying to register for a different race after finishing current one
    if (activeRaceId !== raceId) {
      return res.status(400).json({ 
        error: `Vous participez déjà à une course en cours: ${activeRaceName}. Terminez-la d'abord!` 
      });
    }
  }

  // Get start position
  const waypoints = JSON.parse(waypointsJson);
  const startPos = waypoints[0];

  // Register
  const participantId = uuidv4();
  db.run(`
    INSERT INTO race_participants (id, race_id, boat_id, lat, lon, heading, sail_type, current_waypoint)
    VALUES (?, ?, ?, ?, ?, 0, 'genois', 0)
  `, [participantId, raceId, boatId, startPos.lat, startPos.lon]);

  res.json({ 
    success: true, 
    participantId,
    message: 'Successfully registered for race'
  });
});

// Update boat heading and sail
router.post('/:raceId/control', (req, res) => {
  const db = req.app.locals.db;
  const { raceId } = req.params;
  const { boatId, heading, sailType } = req.body;

  if (!boatId) {
    return res.status(400).json({ error: 'Boat ID required' });
  }

  // Validate heading
  let newHeading = parseInt(heading);
  if (isNaN(newHeading) || newHeading < 0 || newHeading > 360) {
    return res.status(400).json({ error: 'Invalid heading (0-360)' });
  }
  newHeading = newHeading % 360;

  // Validate sail type
  const validSails = ['spi', 'genois', 'grandvoile'];
  if (sailType && !validSails.includes(sailType)) {
    return res.status(400).json({ error: 'Invalid sail type' });
  }

  // Check participant exists
  const participantResult = db.exec(`
    SELECT rp.id, rp.finished FROM race_participants rp
    JOIN boats b ON rp.boat_id = b.id
    WHERE rp.race_id = ? AND rp.boat_id = ?
  `, [raceId, boatId]);

  if (!participantResult.length || !participantResult[0].values.length) {
    return res.status(404).json({ error: 'Boat not in this race' });
  }

  const [participantId, finished] = participantResult[0].values[0];
  if (finished) {
    return res.status(400).json({ error: 'Boat has already finished' });
  }

  // Update controls
  let updateQuery = `UPDATE race_participants SET heading = ?`;
  const params = [newHeading];

  if (sailType) {
    updateQuery += `, sail_type = ?`;
    params.push(sailType);
  }

  updateQuery += ` WHERE id = ?`;
  params.push(participantId);

  db.run(updateQuery, params);

  res.json({ 
    success: true, 
    heading: newHeading,
    sailType: sailType || 'unchanged'
  });
});

// Update player's custom route
router.post('/:raceId/route', (req, res) => {
  const db = req.app.locals.db;
  const { raceId } = req.params;
  const { boatId, route } = req.body;

  if (!boatId) {
    return res.status(400).json({ error: 'Boat ID required' });
  }

  if (!Array.isArray(route)) {
    return res.status(400).json({ error: 'Route must be an array' });
  }

  // Validate route points
  for (const point of route) {
    if (typeof point.lat !== 'number' || typeof point.lon !== 'number') {
      return res.status(400).json({ error: 'Invalid route point' });
    }
  }

  // Check participant exists
  const participantResult = db.exec(`
    SELECT rp.id, rp.finished FROM race_participants rp
    WHERE rp.race_id = ? AND rp.boat_id = ?
  `, [raceId, boatId]);

  if (!participantResult.length || !participantResult[0].values.length) {
    return res.status(404).json({ error: 'Boat not in this race' });
  }

  const [participantId, finished] = participantResult[0].values[0];
  if (finished) {
    return res.status(400).json({ error: 'Boat has already finished' });
  }

  // Update route
  db.run(`
    UPDATE race_participants 
    SET custom_route = ?, current_route_point = 0
    WHERE id = ?
  `, [JSON.stringify(route), participantId]);

  res.json({ 
    success: true, 
    routePoints: route.length,
    message: 'Route updated'
  });
});

// Force finish race for a player (debug)
router.post('/:raceId/force-finish', (req, res) => {
  const db = req.app.locals.db;
  const { raceId } = req.params;
  const { boatId } = req.body;

  if (!boatId) {
    return res.status(400).json({ error: 'Boat ID required' });
  }

  // Find participant
  const participantResult = db.exec(`
    SELECT rp.id, rp.finished FROM race_participants rp
    WHERE rp.race_id = ? AND rp.boat_id = ?
  `, [raceId, boatId]);

  if (!participantResult.length || !participantResult[0].values.length) {
    return res.status(404).json({ error: 'Boat not in this race' });
  }

  const [participantId, finished] = participantResult[0].values[0];
  
  if (finished) {
    return res.json({ success: true, message: 'Already finished' });
  }

  // Mark as finished
  const now = Math.floor(Date.now() / 1000);
  
  // Get current finish position
  const posResult = db.exec(`
    SELECT COUNT(*) FROM race_participants WHERE race_id = ? AND finished = 1
  `, [raceId]);
  const position = (posResult[0]?.values[0]?.[0] || 0) + 1;

  db.run(`
    UPDATE race_participants 
    SET finished = 1, finish_time = ?, finish_position = ?
    WHERE id = ?
  `, [now, position, participantId]);

  console.log(`🛑 Force finished boat in race, position ${position}`);

  res.json({ success: true, position, message: 'Race force finished' });
});

// Click to add boost energy
router.post('/:raceId/boost-click', (req, res) => {
  const db = req.app.locals.db;
  const { raceId } = req.params;
  const { boatId } = req.body;
  const now = Math.floor(Date.now() / 1000);

  if (!boatId) {
    return res.status(400).json({ error: 'Boat ID required' });
  }

  // Get participant
  const participantResult = db.exec(`
    SELECT id, boost_energy, boost_active_until, last_click_time, finished
    FROM race_participants
    WHERE race_id = ? AND boat_id = ?
  `, [raceId, boatId]);

  if (!participantResult.length || !participantResult[0].values.length) {
    return res.status(404).json({ error: 'Not in this race' });
  }

  const [participantId, currentEnergy, boostActiveUntil, lastClickTime, finished] = participantResult[0].values[0];

  if (finished) {
    return res.status(400).json({ error: 'Race already finished' });
  }

  // Rate limit: max 1 click per 500ms (2 clicks/second)
  if (now - (lastClickTime || 0) < 0.5) {
    return res.json({ 
      success: false, 
      energy: currentEnergy || 0,
      boostActive: (boostActiveUntil || 0) > now,
      boostTimeLeft: Math.max(0, (boostActiveUntil || 0) - now),
      message: 'Too fast!' 
    });
  }

  // Add energy (5% per click, max 100%)
  let newEnergy = Math.min(100, (currentEnergy || 0) + 5);
  let boostActivated = false;
  let newBoostUntil = boostActiveUntil || 0;

  // If energy reaches 100%, activate boost
  if (newEnergy >= 100) {
    newEnergy = 0;
    newBoostUntil = now + 120; // 2 minutes boost
    boostActivated = true;
  }

  db.run(`
    UPDATE race_participants
    SET boost_energy = ?, boost_active_until = ?, last_click_time = ?
    WHERE id = ?
  `, [newEnergy, newBoostUntil, now, participantId]);

  res.json({
    success: true,
    energy: newEnergy,
    boostActive: newBoostUntil > now,
    boostTimeLeft: Math.max(0, newBoostUntil - now),
    boostActivated
  });
});

// Buy instant boost with credits
router.post('/:raceId/boost-buy', (req, res) => {
  const db = req.app.locals.db;
  const { raceId } = req.params;
  const { boatId, playerId } = req.body;
  const now = Math.floor(Date.now() / 1000);
  const BOOST_COST = 50;

  if (!boatId || !playerId) {
    return res.status(400).json({ error: 'Boat ID and Player ID required' });
  }

  // Check player credits
  const playerResult = db.exec(`
    SELECT credits FROM players WHERE id = ?
  `, [playerId]);

  if (!playerResult.length || !playerResult[0].values.length) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const credits = playerResult[0].values[0][0];
  if (credits < BOOST_COST) {
    return res.status(400).json({ error: `Not enough credits (need ${BOOST_COST})` });
  }

  // Get participant
  const participantResult = db.exec(`
    SELECT id, boost_active_until, finished
    FROM race_participants
    WHERE race_id = ? AND boat_id = ?
  `, [raceId, boatId]);

  if (!participantResult.length || !participantResult[0].values.length) {
    return res.status(404).json({ error: 'Not in this race' });
  }

  const [participantId, boostActiveUntil, finished] = participantResult[0].values[0];

  if (finished) {
    return res.status(400).json({ error: 'Race already finished' });
  }

  // Deduct credits and activate boost
  db.run(`UPDATE players SET credits = credits - ? WHERE id = ?`, [BOOST_COST, playerId]);
  
  const newBoostUntil = now + 120; // 2 minutes boost
  db.run(`
    UPDATE race_participants
    SET boost_energy = 0, boost_active_until = ?
    WHERE id = ?
  `, [newBoostUntil, participantId]);

  res.json({
    success: true,
    energy: 0,
    boostActive: true,
    boostTimeLeft: 120,
    creditsSpent: BOOST_COST,
    newCredits: credits - BOOST_COST
  });
});

// Get race history
router.get('/:raceId/history', (req, res) => {
  const db = req.app.locals.db;
  const { raceId } = req.params;

  const result = db.exec(`
    SELECT rh.position, rh.finish_time, rh.credits_earned,
           b.name, b.is_bot, b.player_id
    FROM race_history rh
    JOIN boats b ON rh.boat_id = b.id
    WHERE rh.race_id = ?
    ORDER BY rh.position ASC
  `, [raceId]);

  if (!result.length) {
    return res.json([]);
  }

  const history = result[0].values.map(row => ({
    position: row[0],
    finishTime: row[1],
    creditsEarned: row[2],
    boatName: row[3],
    isBot: !!row[4],
    playerId: row[5]
  }));

  res.json(history);
});

export default router;
