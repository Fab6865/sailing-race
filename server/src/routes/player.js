import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Create new player
router.post('/create', (req, res) => {
  const db = req.app.locals.db;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name required' });
  }

  const playerId = uuidv4();
  const now = Math.floor(Date.now() / 1000);

  db.run(`
    INSERT INTO players (id, name, credits, created_at)
    VALUES (?, ?, 1000, ?)
  `, [playerId, name, now]);

  // Create default boat for player
  const boatId = uuidv4();
  db.run(`
    INSERT INTO boats (id, player_id, name, is_bot, speed_max, vmg_upwind, vmg_downwind, vmg_reaching, storm_resistance, weather_forecast)
    VALUES (?, ?, ?, 0, 8.0, 0.7, 0.85, 1.0, 0.5, 0)
  `, [boatId, playerId, `${name}'s Boat`]);

  res.json({
    success: true,
    playerId,
    boatId,
    name,
    credits: 1000
  });
});

// Find player by name (for reconnection)
router.post('/find-by-name', (req, res) => {
  const db = req.app.locals.db;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name required' });
  }

  const playerResult = db.exec(`
    SELECT id, name, credits, created_at FROM players WHERE name = ? COLLATE NOCASE
  `, [name.trim()]);

  if (!playerResult.length || !playerResult[0].values.length) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const [id, playerName, credits, created_at] = playerResult[0].values[0];

  // Get player's boat
  const boatResult = db.exec(`
    SELECT id, name, speed_max, vmg_upwind, vmg_downwind, vmg_reaching, storm_resistance, weather_forecast
    FROM boats WHERE player_id = ? AND is_bot = 0
  `, [id]);

  const boat = boatResult.length && boatResult[0].values.length ? {
    id: boatResult[0].values[0][0],
    name: boatResult[0].values[0][1],
    speedMax: boatResult[0].values[0][2],
    vmgUpwind: boatResult[0].values[0][3],
    vmgDownwind: boatResult[0].values[0][4],
    vmgReaching: boatResult[0].values[0][5],
    stormResistance: boatResult[0].values[0][6],
    weatherForecast: boatResult[0].values[0][7]
  } : null;

  res.json({
    id,
    name: playerName,
    credits,
    createdAt: created_at,
    boat
  });
});

// Get player info
router.get('/:playerId', (req, res) => {
  const db = req.app.locals.db;
  const { playerId } = req.params;

  const playerResult = db.exec(`
    SELECT id, name, credits, created_at FROM players WHERE id = ?
  `, [playerId]);

  if (!playerResult.length || !playerResult[0].values.length) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const [id, name, credits, createdAt] = playerResult[0].values[0];

  // Get boat info
  const boatResult = db.exec(`
    SELECT id, name, speed_max, vmg_upwind, vmg_downwind, vmg_reaching, storm_resistance, weather_forecast
    FROM boats WHERE player_id = ? AND is_bot = 0
  `, [playerId]);

  let boat = null;
  if (boatResult.length && boatResult[0].values.length) {
    const row = boatResult[0].values[0];
    boat = {
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
    };
  }

  // Get race stats
  const statsResult = db.exec(`
    SELECT COUNT(*) as races, 
           SUM(CASE WHEN position = 1 THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN position <= 3 THEN 1 ELSE 0 END) as podiums
    FROM race_history WHERE player_id = ?
  `, [playerId]);

  let stats = { races: 0, wins: 0, podiums: 0 };
  if (statsResult.length && statsResult[0].values.length) {
    const [races, wins, podiums] = statsResult[0].values[0];
    stats = { races: races || 0, wins: wins || 0, podiums: podiums || 0 };
  }

  res.json({
    id,
    name,
    credits,
    createdAt,
    boat,
    stats
  });
});

// Get player's current race
router.get('/:playerId/current-race', (req, res) => {
  const db = req.app.locals.db;
  const { playerId } = req.params;

  // Get player's boat
  const boatResult = db.exec(`
    SELECT id FROM boats WHERE player_id = ? AND is_bot = 0
  `, [playerId]);

  if (!boatResult.length || !boatResult[0].values.length) {
    return res.json({ inRace: false });
  }

  const boatId = boatResult[0].values[0][0];

  // Check if in active race (and not finished)
  const raceResult = db.exec(`
    SELECT r.id, r.name, r.status, r.waypoints,
           rp.lat, rp.lon, rp.heading, rp.sail_type, rp.current_waypoint, rp.finished
    FROM race_participants rp
    JOIN races r ON rp.race_id = r.id
    WHERE rp.boat_id = ? 
      AND (r.status = 'active' OR r.status = 'upcoming')
      AND rp.finished = 0
    ORDER BY r.start_time ASC
    LIMIT 1
  `, [boatId]);

  if (!raceResult.length || !raceResult[0].values.length) {
    return res.json({ inRace: false });
  }

  const row = raceResult[0].values[0];
  const waypoints = JSON.parse(row[3]);

  res.json({
    inRace: true,
    raceId: row[0],
    raceName: row[1],
    raceStatus: row[2],
    waypoints,
    position: {
      lat: row[4],
      lon: row[5]
    },
    heading: row[6],
    sailType: row[7],
    currentWaypoint: row[8],
    finished: !!row[9],
    boatId
  });
});

// Get player's race history
router.get('/:playerId/history', (req, res) => {
  const db = req.app.locals.db;
  const { playerId } = req.params;

  const result = db.exec(`
    SELECT rh.position, rh.finish_time, rh.credits_earned, r.name as race_name, r.id as race_id
    FROM race_history rh
    JOIN races r ON rh.race_id = r.id
    WHERE rh.player_id = ?
    ORDER BY rh.finish_time DESC
    LIMIT 20
  `, [playerId]);

  if (!result.length) {
    return res.json([]);
  }

  const history = result[0].values.map(row => ({
    position: row[0],
    finishTime: row[1],
    creditsEarned: row[2],
    raceName: row[3],
    raceId: row[4]
  }));

  res.json(history);
});

// Update player name
router.put('/:playerId/name', (req, res) => {
  const db = req.app.locals.db;
  const { playerId } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name required' });
  }

  db.run(`UPDATE players SET name = ? WHERE id = ?`, [name, playerId]);

  res.json({ success: true, name });
});

export default router;
