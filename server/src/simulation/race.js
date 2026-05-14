import { calculateDistance } from './physics.js';
import { v4 as uuidv4 } from 'uuid';

// Distance threshold to consider waypoint reached (in nautical miles)
const WAYPOINT_THRESHOLD = 0.5;

/**
 * Check if a boat has reached a waypoint
 */
export function checkWaypointReached(position, waypoint) {
  const distance = calculateDistance(
    position.lat, position.lon,
    waypoint.lat, waypoint.lon
  );
  
  return distance < WAYPOINT_THRESHOLD;
}

/**
 * Finish race for a boat
 */
export function finishRace(db, raceId, participantId, boatId, finishTime) {
  // Get current finish position
  const positionResult = db.exec(`
    SELECT COUNT(*) + 1 FROM race_participants 
    WHERE race_id = ? AND finished = 1
  `, [raceId]);

  const position = positionResult[0].values[0][0];

  // Update participant
  db.run(`
    UPDATE race_participants 
    SET finished = 1, finish_time = ?, finish_position = ?
    WHERE id = ?
  `, [finishTime, position, participantId]);

  // Get boat info
  const boatResult = db.exec(`
    SELECT player_id, name, is_bot FROM boats WHERE id = ?
  `, [boatId]);

  if (!boatResult.length) return;

  const [playerId, boatName, isBot] = boatResult[0].values[0];

  // Calculate credits earned
  const creditsEarned = calculateCredits(position);

  // Record in history
  db.run(`
    INSERT INTO race_history (id, race_id, boat_id, player_id, position, finish_time, credits_earned)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [uuidv4(), raceId, boatId, playerId, position, finishTime, creditsEarned]);

  // Award credits to player
  if (playerId && !isBot) {
    db.run(`
      UPDATE players SET credits = credits + ? WHERE id = ?
    `, [creditsEarned, playerId]);
  }

  console.log(`🏁 ${boatName} finished in position ${position}! (+${creditsEarned} credits)`);
}

/**
 * Calculate credits earned based on position
 */
export function calculateCredits(position) {
  const creditTable = {
    1: 500,
    2: 350,
    3: 250,
    4: 180,
    5: 150,
    6: 120,
    7: 100,
    8: 80,
    9: 60,
    10: 50
  };

  return creditTable[position] || Math.max(10, 60 - position * 5);
}

/**
 * Get race rankings
 */
export function getRaceRankings(db, raceId) {
  // Get race waypoints
  const raceResult = db.exec(`
    SELECT waypoints FROM races WHERE id = ?
  `, [raceId]);

  if (!raceResult.length) return [];

  const waypoints = JSON.parse(raceResult[0].values[0][0]);

  // Get all participants with their progress
  const participants = db.exec(`
    SELECT rp.id, rp.boat_id, rp.lat, rp.lon, rp.current_waypoint, rp.finished, 
           rp.finish_time, rp.finish_position,
           b.name, b.is_bot, b.player_id
    FROM race_participants rp
    JOIN boats b ON rp.boat_id = b.id
    WHERE rp.race_id = ?
    ORDER BY 
      rp.finished DESC,
      rp.finish_position ASC,
      rp.current_waypoint DESC
  `, [raceId]);

  if (!participants.length) return [];

  const rankings = participants[0].values.map(row => {
    const [id, boatId, lat, lon, currentWaypoint, finished, finishTime, finishPosition, name, isBot, playerId] = row;

    // Calculate distance to next waypoint
    let distanceToNext = 0;
    if (!finished && currentWaypoint < waypoints.length) {
      const nextWp = waypoints[currentWaypoint];
      distanceToNext = calculateDistance(lat, lon, nextWp.lat, nextWp.lon);
    }

    // Calculate total remaining distance
    let totalRemaining = distanceToNext;
    for (let i = currentWaypoint + 1; i < waypoints.length; i++) {
      totalRemaining += calculateDistance(
        waypoints[i - 1].lat, waypoints[i - 1].lon,
        waypoints[i].lat, waypoints[i].lon
      );
    }

    return {
      participantId: id,
      boatId,
      name,
      isBot: !!isBot,
      playerId,
      lat,
      lon,
      currentWaypoint,
      finished: !!finished,
      finishTime,
      finishPosition,
      distanceToNext: Math.round(distanceToNext * 100) / 100,
      totalRemaining: Math.round(totalRemaining * 100) / 100
    };
  });

  // Sort by progress
  rankings.sort((a, b) => {
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    if (a.finished && b.finished) return a.finishPosition - b.finishPosition;
    if (a.currentWaypoint !== b.currentWaypoint) return b.currentWaypoint - a.currentWaypoint;
    return a.distanceToNext - b.distanceToNext;
  });

  // Assign live positions
  return rankings.map((r, index) => ({
    ...r,
    livePosition: index + 1
  }));
}

/**
 * Get race status summary
 */
export function getRaceStatus(db, raceId) {
  const raceResult = db.exec(`
    SELECT id, name, status, start_time, waypoints FROM races WHERE id = ?
  `, [raceId]);

  if (!raceResult.length) return null;

  const [id, name, status, startTime, waypointsJson] = raceResult[0].values[0];
  const waypoints = JSON.parse(waypointsJson);

  // Count participants
  const countResult = db.exec(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN finished = 1 THEN 1 ELSE 0 END) as finished
    FROM race_participants WHERE race_id = ?
  `, [raceId]);

  const [total, finished] = countResult[0].values[0];

  return {
    id,
    name,
    status,
    startTime,
    waypoints,
    waypointCount: waypoints.length,
    participantCount: total,
    finishedCount: finished || 0
  };
}
