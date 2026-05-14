import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getRaceRankings, getRaceStatus } from '../simulation/race.js';
import { getWindForecast, windDirectionToText, getBeaufortScale } from '../simulation/wind.js';
import { calculateDistance } from '../simulation/physics.js';

const router = Router();

// Get all races (upcoming, active, finished)
router.get('/list', (req, res) => {
  const db = req.app.locals.db;
  const { status } = req.query;

  let query = `SELECT id, name, status, start_time, waypoints FROM races`;
  if (status) {
    query += ` WHERE status = '${status}'`;
  }
  query += ` ORDER BY start_time DESC`;

  const result = db.exec(query);

  if (!result.length) {
    return res.json([]);
  }

  const races = result[0].values.map(row => {
    const [id, name, raceStatus, startTime, waypointsJson] = row;
    const waypoints = JSON.parse(waypointsJson);

    // Count participants
    const countResult = db.exec(`
      SELECT COUNT(*) FROM race_participants WHERE race_id = ?
    `, [id]);
    const participantCount = countResult[0]?.values[0]?.[0] || 0;

    return {
      id,
      name,
      status: raceStatus,
      startTime,
      waypointCount: waypoints.length,
      participantCount,
      startLocation: waypoints[0]?.name || 'Unknown',
      endLocation: waypoints[waypoints.length - 1]?.name || 'Unknown'
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

  // Get wind
  const windResult = db.exec(`
    SELECT direction, speed FROM wind_state WHERE race_id = ?
  `, [raceId]);

  let wind = { direction: 0, speed: 15 };
  if (windResult.length && windResult[0].values.length) {
    const [dir, spd] = windResult[0].values[0];
    wind = {
      direction: Math.round(dir),
      speed: Math.round(spd * 10) / 10,
      directionText: windDirectionToText(dir),
      beaufort: getBeaufortScale(spd)
    };
  }

  // Get all boat positions
  const boatsResult = db.exec(`
    SELECT rp.id, rp.boat_id, rp.lat, rp.lon, rp.heading, rp.sail_type, 
           rp.current_waypoint, rp.finished, rp.finish_position,
           b.name, b.is_bot, b.player_id
    FROM race_participants rp
    JOIN boats b ON rp.boat_id = b.id
    WHERE rp.race_id = ?
  `, [raceId]);

  const boats = [];
  let playerBoat = null;

  if (boatsResult.length && boatsResult[0].values.length) {
    for (const row of boatsResult[0].values) {
      const [participantId, boatId, lat, lon, heading, sailType, currentWaypoint, finished, finishPosition, boatName, isBot, boatPlayerId] = row;

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
        playerBoat = boat;
      }
    }
  }

  // Get rankings
  const rankings = getRaceRankings(db, raceId);

  // Get weather forecast if player has upgrade
  let forecast = null;
  if (playerId) {
    const forecastResult = db.exec(`
      SELECT b.weather_forecast FROM boats b
      WHERE b.player_id = ?
    `, [playerId]);

    if (forecastResult.length && forecastResult[0].values.length) {
      const hoursAhead = forecastResult[0].values[0][0] || 0;
      if (hoursAhead > 0) {
        forecast = getWindForecast(db, raceId, hoursAhead);
      }
    }
  }

  res.json({
    race: {
      id,
      name,
      status,
      startTime,
      waypoints
    },
    wind,
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

  // Check not already registered
  const existingResult = db.exec(`
    SELECT id FROM race_participants WHERE race_id = ? AND boat_id = ?
  `, [raceId, boatId]);

  if (existingResult.length && existingResult[0].values.length) {
    return res.status(400).json({ error: 'Already registered for this race' });
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
