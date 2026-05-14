import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get boat details
router.get('/:boatId', (req, res) => {
  const db = req.app.locals.db;
  const { boatId } = req.params;

  const result = db.exec(`
    SELECT id, player_id, name, is_bot, speed_max, vmg_upwind, vmg_downwind, 
           vmg_reaching, storm_resistance, weather_forecast
    FROM boats WHERE id = ?
  `, [boatId]);

  if (!result.length || !result[0].values.length) {
    return res.status(404).json({ error: 'Boat not found' });
  }

  const row = result[0].values[0];
  res.json({
    id: row[0],
    playerId: row[1],
    name: row[2],
    isBot: !!row[3],
    stats: {
      speedMax: row[4],
      vmgUpwind: row[5],
      vmgDownwind: row[6],
      vmgReaching: row[7],
      stormResistance: row[8],
      weatherForecast: row[9]
    }
  });
});

// Get player's boat
router.get('/player/:playerId', (req, res) => {
  const db = req.app.locals.db;
  const { playerId } = req.params;

  const result = db.exec(`
    SELECT id, name, speed_max, vmg_upwind, vmg_downwind, 
           vmg_reaching, storm_resistance, weather_forecast
    FROM boats WHERE player_id = ? AND is_bot = 0
  `, [playerId]);

  if (!result.length || !result[0].values.length) {
    return res.status(404).json({ error: 'No boat found for this player' });
  }

  const row = result[0].values[0];
  res.json({
    id: row[0],
    name: row[1],
    stats: {
      speedMax: row[2],
      vmgUpwind: row[3],
      vmgDownwind: row[4],
      vmgReaching: row[5],
      stormResistance: row[6],
      weatherForecast: row[7]
    }
  });
});

// Create boat for player
router.post('/create', (req, res) => {
  const db = req.app.locals.db;
  const { playerId, name } = req.body;

  if (!playerId || !name) {
    return res.status(400).json({ error: 'Player ID and boat name required' });
  }

  // Check player exists
  const playerResult = db.exec(`SELECT id FROM players WHERE id = ?`, [playerId]);
  if (!playerResult.length || !playerResult[0].values.length) {
    return res.status(404).json({ error: 'Player not found' });
  }

  // Check player doesn't already have a boat
  const existingResult = db.exec(`
    SELECT id FROM boats WHERE player_id = ? AND is_bot = 0
  `, [playerId]);

  if (existingResult.length && existingResult[0].values.length) {
    return res.status(400).json({ error: 'Player already has a boat' });
  }

  const boatId = uuidv4();
  db.run(`
    INSERT INTO boats (id, player_id, name, is_bot, speed_max, vmg_upwind, vmg_downwind, vmg_reaching, storm_resistance, weather_forecast)
    VALUES (?, ?, ?, 0, 8.0, 0.7, 0.85, 1.0, 0.5, 0)
  `, [boatId, playerId, name]);

  res.json({
    success: true,
    boatId,
    name
  });
});

// Rename boat
router.put('/:boatId/rename', (req, res) => {
  const db = req.app.locals.db;
  const { boatId } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name required' });
  }

  db.run(`UPDATE boats SET name = ? WHERE id = ?`, [name, boatId]);

  res.json({ success: true, name });
});

// Get boat race history
router.get('/:boatId/history', (req, res) => {
  const db = req.app.locals.db;
  const { boatId } = req.params;

  const result = db.exec(`
    SELECT rh.position, rh.finish_time, rh.credits_earned, r.name as race_name
    FROM race_history rh
    JOIN races r ON rh.race_id = r.id
    WHERE rh.boat_id = ?
    ORDER BY rh.finish_time DESC
  `, [boatId]);

  if (!result.length) {
    return res.json([]);
  }

  const history = result[0].values.map(row => ({
    position: row[0],
    finishTime: row[1],
    creditsEarned: row[2],
    raceName: row[3]
  }));

  res.json(history);
});

// Get current race status for a boat
router.get('/:boatId/current-race', (req, res) => {
  const db = req.app.locals.db;
  const { boatId } = req.params;

  const result = db.exec(`
    SELECT r.id, r.name, r.status, rp.lat, rp.lon, rp.heading, rp.sail_type, 
           rp.current_waypoint, rp.finished
    FROM race_participants rp
    JOIN races r ON rp.race_id = r.id
    WHERE rp.boat_id = ? AND r.status = 'active'
    LIMIT 1
  `, [boatId]);

  if (!result.length || !result[0].values.length) {
    return res.json({ inRace: false });
  }

  const row = result[0].values[0];
  res.json({
    inRace: true,
    raceId: row[0],
    raceName: row[1],
    raceStatus: row[2],
    position: {
      lat: row[3],
      lon: row[4]
    },
    heading: row[5],
    sailType: row[6],
    currentWaypoint: row[7],
    finished: !!row[8]
  });
});

export default router;
