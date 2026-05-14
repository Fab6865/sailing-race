import { v4 as uuidv4 } from 'uuid';

export async function seedInitialData(db) {
  // Check if already seeded
  const existingRaces = db.exec('SELECT COUNT(*) as count FROM races');
  if (existingRaces.length > 0 && existingRaces[0].values[0][0] > 0) {
    console.log('📊 Database already seeded');
    return;
  }

  console.log('🌱 Seeding initial data...');

  // Seed upgrades
  seedUpgrades(db);

  // Create initial races
  seedRaces(db);

  // Create bot boats
  seedBots(db);

  console.log('✅ Initial data seeded');
}

function seedUpgrades(db) {
  const upgrades = [
    // Sails
    { id: uuidv4(), name: 'Voile Racing', description: 'Meilleur VMG au près (+10%)', category: 'sail', price: 500, effect_type: 'vmg_upwind', effect_value: 0.1 },
    { id: uuidv4(), name: 'Spi Asymétrique Pro', description: 'Meilleur VMG vent arrière (+10%)', category: 'sail', price: 600, effect_type: 'vmg_downwind', effect_value: 0.1 },
    { id: uuidv4(), name: 'Génois HQ', description: 'Meilleur VMG reaching (+8%)', category: 'sail', price: 450, effect_type: 'vmg_reaching', effect_value: 0.08 },
    
    // Hull
    { id: uuidv4(), name: 'Coque Carbone', description: 'Vitesse max +1 noeud', category: 'hull', price: 1000, effect_type: 'speed_max', effect_value: 1.0 },
    { id: uuidv4(), name: 'Quille Profonde', description: 'Meilleure stabilité en tempête (+20%)', category: 'hull', price: 800, effect_type: 'storm_resistance', effect_value: 0.2 },
    { id: uuidv4(), name: 'Foils', description: 'Vitesse max +2 noeuds', category: 'hull', price: 2000, effect_type: 'speed_max', effect_value: 2.0 },
    
    // Weather
    { id: uuidv4(), name: 'Station Météo', description: 'Voir le vent 1h à l\'avance', category: 'weather', price: 750, effect_type: 'weather_forecast', effect_value: 1 },
    { id: uuidv4(), name: 'Météo Satellite', description: 'Voir le vent 2h à l\'avance', category: 'weather', price: 1500, effect_type: 'weather_forecast', effect_value: 2 },
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO upgrades (id, name, description, category, price, effect_type, effect_value)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const upgrade of upgrades) {
    stmt.run([upgrade.id, upgrade.name, upgrade.description, upgrade.category, upgrade.price, upgrade.effect_type, upgrade.effect_value]);
  }
  stmt.free();
}

function seedRaces(db) {
  const now = Math.floor(Date.now() / 1000);
  
  // Course côtière - démarre dans 5 minutes (pour test)
  const coastalWaypoints = JSON.stringify([
    { lat: 48.0, lon: -4.0, name: 'Départ - Brest' },
    { lat: 47.5, lon: -3.5, name: 'Bouée 1' },
    { lat: 47.0, lon: -3.0, name: 'Bouée 2' },
    { lat: 47.2, lon: -2.5, name: 'Bouée 3' },
    { lat: 47.8, lon: -3.2, name: 'Arrivée - Lorient' }
  ]);

  db.run(`
    INSERT INTO races (id, name, status, start_time, waypoints)
    VALUES (?, ?, ?, ?, ?)
  `, [uuidv4(), 'Course Côtière Bretagne', 'upcoming', now + 300, coastalWaypoints]);

  // Course transatlantique - démarre dans 2 heures
  const transatWaypoints = JSON.stringify([
    { lat: 48.4, lon: -4.5, name: 'Départ - Brest' },
    { lat: 45.0, lon: -10.0, name: 'Cap Finisterre' },
    { lat: 35.0, lon: -20.0, name: 'Açores' },
    { lat: 25.0, lon: -40.0, name: 'Mid-Atlantic' },
    { lat: 18.0, lon: -63.0, name: 'Arrivée - Guadeloupe' }
  ]);

  db.run(`
    INSERT INTO races (id, name, status, start_time, waypoints)
    VALUES (?, ?, ?, ?, ?)
  `, [uuidv4(), 'Transat Express', 'upcoming', now + 7200, transatWaypoints]);

  // Course rapide - démarre dans 1 minute (pour test immédiat)
  const quickWaypoints = JSON.stringify([
    { lat: 48.0, lon: -4.0, name: 'Départ' },
    { lat: 48.2, lon: -3.8, name: 'Bouée Nord' },
    { lat: 48.1, lon: -3.5, name: 'Bouée Est' },
    { lat: 47.9, lon: -3.7, name: 'Arrivée' }
  ]);

  db.run(`
    INSERT INTO races (id, name, status, start_time, waypoints)
    VALUES (?, ?, ?, ?, ?)
  `, [uuidv4(), 'Sprint Rade de Brest', 'upcoming', now + 60, quickWaypoints]);
}

function seedBots(db) {
  const botNames = [
    'Captain Storm', 'Sea Wolf', 'Wind Rider', 'Ocean Spirit', 'Wave Hunter',
    'Tide Master', 'Sail Shadow', 'Reef Runner', 'Gulf Stream', 'Trade Wind',
    'Monsoon', 'Cyclone', 'Tempest', 'Zephyr', 'Mistral',
    'Sirocco', 'Alizé', 'Tramontane', 'Harmattan', 'Chinook'
  ];

  const levels = ['beginner', 'intermediate', 'advanced', 'expert'];

  for (let i = 0; i < botNames.length; i++) {
    const level = levels[Math.floor(i / 5)]; // 5 bots per level
    const botId = uuidv4();

    // Stats vary by level
    let speedMax = 7.5;
    let vmgUpwind = 0.65;
    let vmgDownwind = 0.80;
    let vmgReaching = 0.95;

    if (level === 'intermediate') {
      speedMax = 8.0;
      vmgUpwind = 0.70;
      vmgDownwind = 0.85;
      vmgReaching = 1.0;
    } else if (level === 'advanced') {
      speedMax = 8.5;
      vmgUpwind = 0.75;
      vmgDownwind = 0.88;
      vmgReaching = 1.02;
    } else if (level === 'expert') {
      speedMax = 9.0;
      vmgUpwind = 0.80;
      vmgDownwind = 0.92;
      vmgReaching = 1.05;
    }

    db.run(`
      INSERT INTO boats (id, player_id, name, is_bot, bot_level, speed_max, vmg_upwind, vmg_downwind, vmg_reaching)
      VALUES (?, NULL, ?, 1, ?, ?, ?, ?, ?)
    `, [botId, botNames[i], level, speedMax, vmgUpwind, vmgDownwind, vmgReaching]);
  }
}
