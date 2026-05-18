import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get simulation state
router.get('/simulation', (req, res) => {
  const db = req.app.locals.db;
  const simulation = req.app.locals.simulation || { speedMultiplier: 1 };
  
  res.json({
    speedMultiplier: simulation.speedMultiplier,
    tickInterval: 60000 / simulation.speedMultiplier,
    isAccelerated: simulation.speedMultiplier > 1
  });
});

// Set simulation speed (for testing)
router.post('/simulation/speed', (req, res) => {
  const { multiplier } = req.body;
  
  if (!multiplier || multiplier < 1 || multiplier > 600) {
    return res.status(400).json({ error: 'Multiplier must be between 1 and 600' });
  }

  // Store in app locals
  req.app.locals.simulation = req.app.locals.simulation || {};
  req.app.locals.simulation.speedMultiplier = multiplier;

  res.json({ 
    success: true, 
    speedMultiplier: multiplier,
    message: `Simulation speed set to x${multiplier}`
  });
});

// Create a new race
router.post('/race/create', (req, res) => {
  const db = req.app.locals.db;
  const { name, startTime, waypoints, difficulty } = req.body;

  if (!name || !waypoints || waypoints.length < 2) {
    return res.status(400).json({ error: 'Name and at least 2 waypoints required' });
  }

  const raceId = uuidv4();
  const start = startTime || Math.floor(Date.now() / 1000) + 300; // Default: 5 min from now

  db.run(`
    INSERT INTO races (id, name, status, start_time, waypoints, difficulty)
    VALUES (?, ?, 'upcoming', ?, ?, ?)
  `, [raceId, name, start, JSON.stringify(waypoints), difficulty || 'mixed']);

  res.json({
    success: true,
    raceId,
    name,
    startTime: start,
    difficulty: difficulty || 'mixed'
  });
});

// Update a race
router.put('/race/:raceId', (req, res) => {
  const db = req.app.locals.db;
  const { raceId } = req.params;
  const { name, startTime, waypoints, difficulty, status } = req.body;

  // Check race exists
  const raceResult = db.exec(`SELECT status FROM races WHERE id = ?`, [raceId]);
  if (!raceResult.length || !raceResult[0].values.length) {
    return res.status(404).json({ error: 'Race not found' });
  }

  const currentStatus = raceResult[0].values[0][0];
  
  // Can only edit upcoming races (unless just changing status)
  if (currentStatus !== 'upcoming' && !status) {
    return res.status(400).json({ error: 'Can only edit upcoming races' });
  }

  // Build update query
  const updates = [];
  const params = [];

  if (name) {
    updates.push('name = ?');
    params.push(name);
  }
  if (startTime) {
    updates.push('start_time = ?');
    params.push(startTime);
  }
  if (waypoints) {
    updates.push('waypoints = ?');
    params.push(JSON.stringify(waypoints));
  }
  if (difficulty) {
    updates.push('difficulty = ?');
    params.push(difficulty);
  }
  if (status) {
    updates.push('status = ?');
    params.push(status);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  params.push(raceId);
  db.run(`UPDATE races SET ${updates.join(', ')} WHERE id = ?`, params);

  res.json({ success: true, message: 'Race updated' });
});

// Delete a race
router.delete('/race/:raceId', (req, res) => {
  const db = req.app.locals.db;
  const { raceId } = req.params;

  // Check race exists and is upcoming
  const raceResult = db.exec(`SELECT status FROM races WHERE id = ?`, [raceId]);
  if (!raceResult.length || !raceResult[0].values.length) {
    return res.status(404).json({ error: 'Race not found' });
  }

  // Delete participants first
  db.run(`DELETE FROM race_participants WHERE race_id = ?`, [raceId]);
  db.run(`DELETE FROM wind_state WHERE race_id = ?`, [raceId]);
  db.run(`DELETE FROM races WHERE id = ?`, [raceId]);

  res.json({ success: true, message: 'Race deleted' });
});

// Get all races with full details (admin view)
router.get('/races', (req, res) => {
  const db = req.app.locals.db;

  const result = db.exec(`
    SELECT id, name, status, start_time, waypoints, difficulty
    FROM races
    ORDER BY start_time DESC
  `);

  if (!result.length) {
    return res.json([]);
  }

  const races = result[0].values.map(row => {
    const [id, name, status, startTime, waypointsJson, difficulty] = row;
    const waypoints = JSON.parse(waypointsJson);

    // Count participants
    const countResult = db.exec(`
      SELECT COUNT(*) FROM race_participants WHERE race_id = ?
    `, [id]);
    const participantCount = countResult[0]?.values[0]?.[0] || 0;

    return {
      id,
      name,
      status,
      startTime,
      waypoints,
      waypointCount: waypoints.length,
      difficulty: difficulty || 'mixed',
      participantCount
    };
  });

  res.json(races);
});

// Force start a race (for testing)
router.post('/race/:raceId/force-start', (req, res) => {
  const db = req.app.locals.db;
  const { raceId } = req.params;

  const raceResult = db.exec(`SELECT status FROM races WHERE id = ?`, [raceId]);
  if (!raceResult.length || !raceResult[0].values.length) {
    return res.status(404).json({ error: 'Race not found' });
  }

  const status = raceResult[0].values[0][0];
  if (status !== 'upcoming') {
    return res.status(400).json({ error: 'Race is not upcoming' });
  }

  // Set start time to now
  const now = Math.floor(Date.now() / 1000);
  db.run(`UPDATE races SET start_time = ? WHERE id = ?`, [now, raceId]);

  res.json({ success: true, message: 'Race will start on next tick' });
});

// Reset a race (for testing)
router.post('/race/:raceId/reset', (req, res) => {
  const db = req.app.locals.db;
  const { raceId } = req.params;

  // Delete participants and reset race
  db.run(`DELETE FROM race_participants WHERE race_id = ?`, [raceId]);
  db.run(`DELETE FROM wind_state WHERE race_id = ?`, [raceId]);
  db.run(`UPDATE races SET status = 'upcoming' WHERE id = ?`, [raceId]);

  res.json({ success: true, message: 'Race reset to upcoming' });
});

// Get bot configuration
router.get('/bots', (req, res) => {
  const db = req.app.locals.db;

  const result = db.exec(`
    SELECT id, name, bot_level, speed_max, vmg_upwind, vmg_downwind, vmg_reaching
    FROM boats
    WHERE is_bot = 1
    ORDER BY bot_level, name
  `);

  if (!result.length) {
    return res.json([]);
  }

  const bots = result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    level: row[2],
    stats: {
      speedMax: row[3],
      vmgUpwind: row[4],
      vmgDownwind: row[5],
      vmgReaching: row[6]
    }
  }));

  res.json(bots);
});

// Trigger manual simulation tick (for testing)
router.post('/simulation/tick', (req, res) => {
  const triggerTick = req.app.locals.triggerTick;
  
  if (triggerTick) {
    triggerTick();
    res.json({ success: true, message: 'Manual tick triggered' });
  } else {
    res.status(500).json({ error: 'Tick function not available' });
  }
});

// Finish all active races (admin cleanup)
router.post('/races/finish-all', (req, res) => {
  const db = req.app.locals.db;
  
  // Get all active races
  const activeRaces = db.exec(`SELECT id, name FROM races WHERE status = 'active'`);
  
  if (!activeRaces.length || !activeRaces[0].values.length) {
    return res.json({ success: true, message: 'No active races to finish', count: 0 });
  }
  
  let count = 0;
  for (const [raceId, raceName] of activeRaces[0].values) {
    // Mark race as finished
    db.run(`UPDATE races SET status = 'finished' WHERE id = ?`, [raceId]);
    
    // Mark all participants as finished if not already
    db.run(`UPDATE race_participants SET finished = 1 WHERE race_id = ? AND finished = 0`, [raceId]);
    
    count++;
    console.log(`🏁 Admin finished race: ${raceName}`);
  }
  
  res.json({ success: true, message: `Finished ${count} races`, count });
});

// Reset database for fresh start
router.post('/reset-all', (req, res) => {
  const db = req.app.locals.db;
  
  // Delete all race data
  db.run(`DELETE FROM race_participants`);
  db.run(`DELETE FROM race_history`);
  db.run(`DELETE FROM wind_state`);
  db.run(`UPDATE races SET status = 'upcoming', start_time = ? WHERE status != 'finished'`, 
    [Math.floor(Date.now() / 1000) + 300]);
  
  res.json({ success: true, message: 'All race data reset' });
});

// Clear finished races
router.post('/clear-finished-races', (req, res) => {
  const db = req.app.locals.db;
  
  // Get finished races
  const finishedRaces = db.exec(`SELECT id FROM races WHERE status = 'finished'`);
  
  if (!finishedRaces.length || !finishedRaces[0].values.length) {
    return res.json({ success: true, message: 'No finished races to clear', count: 0 });
  }
  
  const raceIds = finishedRaces[0].values.map(r => r[0]);
  
  // Delete participants and races
  for (const raceId of raceIds) {
    db.run(`DELETE FROM race_participants WHERE race_id = ?`, [raceId]);
    db.run(`DELETE FROM wind_state WHERE race_id = ?`, [raceId]);
    db.run(`DELETE FROM races WHERE id = ?`, [raceId]);
  }
  
  console.log(`🗑️ Cleared ${raceIds.length} finished races`);
  res.json({ success: true, message: `Cleared ${raceIds.length} finished races`, count: raceIds.length });
});

export default router;
