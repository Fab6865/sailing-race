import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all available upgrades
router.get('/list', (req, res) => {
  const db = req.app.locals.db;

  const result = db.exec(`
    SELECT id, name, description, category, price, effect_type, effect_value
    FROM upgrades
    ORDER BY category, price
  `);

  if (!result.length) {
    return res.json([]);
  }

  const upgrades = result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    description: row[2],
    category: row[3],
    price: row[4],
    effectType: row[5],
    effectValue: row[6]
  }));

  res.json(upgrades);
});

// Get player's purchased upgrades
router.get('/player/:playerId', (req, res) => {
  const db = req.app.locals.db;
  const { playerId } = req.params;

  const result = db.exec(`
    SELECT u.id, u.name, u.description, u.category, u.effect_type, u.effect_value, pu.equipped
    FROM player_upgrades pu
    JOIN upgrades u ON pu.upgrade_id = u.id
    WHERE pu.player_id = ?
  `, [playerId]);

  if (!result.length) {
    return res.json([]);
  }

  const upgrades = result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    description: row[2],
    category: row[3],
    effectType: row[4],
    effectValue: row[5],
    equipped: !!row[6]
  }));

  res.json(upgrades);
});

// Purchase an upgrade
router.post('/buy', (req, res) => {
  const db = req.app.locals.db;
  const { playerId, upgradeId } = req.body;

  if (!playerId || !upgradeId) {
    return res.status(400).json({ error: 'Player ID and Upgrade ID required' });
  }

  // Get upgrade info
  const upgradeResult = db.exec(`
    SELECT id, name, price, effect_type, effect_value FROM upgrades WHERE id = ?
  `, [upgradeId]);

  if (!upgradeResult.length || !upgradeResult[0].values.length) {
    return res.status(404).json({ error: 'Upgrade not found' });
  }

  const [id, name, price, effectType, effectValue] = upgradeResult[0].values[0];

  // Check player credits
  const playerResult = db.exec(`
    SELECT credits FROM players WHERE id = ?
  `, [playerId]);

  if (!playerResult.length || !playerResult[0].values.length) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const credits = playerResult[0].values[0][0];
  if (credits < price) {
    return res.status(400).json({ error: 'Not enough credits', required: price, available: credits });
  }

  // Check if already owned
  const ownedResult = db.exec(`
    SELECT id FROM player_upgrades WHERE player_id = ? AND upgrade_id = ?
  `, [playerId, upgradeId]);

  if (ownedResult.length && ownedResult[0].values.length) {
    return res.status(400).json({ error: 'Upgrade already owned' });
  }

  // Purchase
  db.run(`UPDATE players SET credits = credits - ? WHERE id = ?`, [price, playerId]);
  db.run(`
    INSERT INTO player_upgrades (id, player_id, upgrade_id, equipped)
    VALUES (?, ?, ?, 1)
  `, [uuidv4(), playerId, upgradeId]);

  // Apply upgrade to boat
  applyUpgradeToBoat(db, playerId, effectType, effectValue);

  res.json({
    success: true,
    upgradeName: name,
    creditsSpent: price,
    creditsRemaining: credits - price
  });
});

// Equip/unequip an upgrade
router.post('/equip', (req, res) => {
  const db = req.app.locals.db;
  const { playerId, upgradeId, equipped } = req.body;

  if (!playerId || !upgradeId) {
    return res.status(400).json({ error: 'Player ID and Upgrade ID required' });
  }

  // Check ownership
  const ownedResult = db.exec(`
    SELECT pu.id, u.effect_type, u.effect_value 
    FROM player_upgrades pu
    JOIN upgrades u ON pu.upgrade_id = u.id
    WHERE pu.player_id = ? AND pu.upgrade_id = ?
  `, [playerId, upgradeId]);

  if (!ownedResult.length || !ownedResult[0].values.length) {
    return res.status(404).json({ error: 'Upgrade not owned' });
  }

  const [puId, effectType, effectValue] = ownedResult[0].values[0];
  const isEquipping = equipped !== false;

  // Update equipped status
  db.run(`UPDATE player_upgrades SET equipped = ? WHERE id = ?`, [isEquipping ? 1 : 0, puId]);

  // Apply or remove effect
  if (isEquipping) {
    applyUpgradeToBoat(db, playerId, effectType, effectValue);
  } else {
    applyUpgradeToBoat(db, playerId, effectType, -effectValue);
  }

  res.json({ success: true, equipped: isEquipping });
});

// Helper function to apply upgrade effects to boat
function applyUpgradeToBoat(db, playerId, effectType, effectValue) {
  const columnMap = {
    'speed_max': 'speed_max',
    'vmg_upwind': 'vmg_upwind',
    'vmg_downwind': 'vmg_downwind',
    'vmg_reaching': 'vmg_reaching',
    'storm_resistance': 'storm_resistance',
    'weather_forecast': 'weather_forecast'
  };

  const column = columnMap[effectType];
  if (!column) return;

  if (effectType === 'weather_forecast') {
    // Weather forecast is set, not added
    db.run(`
      UPDATE boats SET ${column} = ? WHERE player_id = ? AND is_bot = 0
    `, [effectValue, playerId]);
  } else {
    // Other stats are added
    db.run(`
      UPDATE boats SET ${column} = ${column} + ? WHERE player_id = ? AND is_bot = 0
    `, [effectValue, playerId]);
  }
}

// Get upgrade categories
router.get('/categories', (req, res) => {
  res.json([
    { id: 'sail', name: 'Voiles', description: 'Améliorez vos voiles pour un meilleur VMG' },
    { id: 'hull', name: 'Coque', description: 'Améliorez votre coque pour plus de vitesse' },
    { id: 'weather', name: 'Météo', description: 'Prévisions météo avancées' }
  ]);
});

export default router;
