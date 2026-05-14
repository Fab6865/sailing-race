import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/sailing.db');

export async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Load existing database or create new one
  let db;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log('📂 Database loaded from disk');
  } else {
    db = new SQL.Database();
    console.log('🆕 New database created');
  }

  // Create tables
  createTables(db);

  // Auto-save every 30 seconds
  setInterval(() => saveDatabase(db), 30000);

  return db;
}

function createTables(db) {
  // Players table
  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      credits INTEGER DEFAULT 1000,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Boats table (player boats with upgrades)
  db.run(`
    CREATE TABLE IF NOT EXISTS boats (
      id TEXT PRIMARY KEY,
      player_id TEXT,
      name TEXT NOT NULL,
      is_bot INTEGER DEFAULT 0,
      bot_level TEXT DEFAULT NULL,
      speed_max REAL DEFAULT 8.0,
      vmg_upwind REAL DEFAULT 0.7,
      vmg_downwind REAL DEFAULT 0.85,
      vmg_reaching REAL DEFAULT 1.0,
      storm_resistance REAL DEFAULT 0.5,
      weather_forecast INTEGER DEFAULT 0,
      FOREIGN KEY (player_id) REFERENCES players(id)
    )
  `);

  // Races table
  db.run(`
    CREATE TABLE IF NOT EXISTS races (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'upcoming',
      start_time INTEGER,
      waypoints TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Race participants (boats in a race)
  db.run(`
    CREATE TABLE IF NOT EXISTS race_participants (
      id TEXT PRIMARY KEY,
      race_id TEXT NOT NULL,
      boat_id TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      heading INTEGER DEFAULT 0,
      sail_type TEXT DEFAULT 'genois',
      current_waypoint INTEGER DEFAULT 0,
      finished INTEGER DEFAULT 0,
      finish_time INTEGER DEFAULT NULL,
      finish_position INTEGER DEFAULT NULL,
      FOREIGN KEY (race_id) REFERENCES races(id),
      FOREIGN KEY (boat_id) REFERENCES boats(id)
    )
  `);

  // Wind state (global wind for each race)
  db.run(`
    CREATE TABLE IF NOT EXISTS wind_state (
      race_id TEXT PRIMARY KEY,
      direction INTEGER DEFAULT 0,
      speed REAL DEFAULT 15.0,
      last_update INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (race_id) REFERENCES races(id)
    )
  `);

  // Upgrades available
  db.run(`
    CREATE TABLE IF NOT EXISTS upgrades (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      effect_type TEXT NOT NULL,
      effect_value REAL NOT NULL
    )
  `);

  // Player upgrades (purchased)
  db.run(`
    CREATE TABLE IF NOT EXISTS player_upgrades (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      upgrade_id TEXT NOT NULL,
      equipped INTEGER DEFAULT 0,
      FOREIGN KEY (player_id) REFERENCES players(id),
      FOREIGN KEY (upgrade_id) REFERENCES upgrades(id)
    )
  `);

  // Race history for rankings
  db.run(`
    CREATE TABLE IF NOT EXISTS race_history (
      id TEXT PRIMARY KEY,
      race_id TEXT NOT NULL,
      boat_id TEXT NOT NULL,
      player_id TEXT,
      position INTEGER NOT NULL,
      finish_time INTEGER NOT NULL,
      credits_earned INTEGER DEFAULT 0,
      FOREIGN KEY (race_id) REFERENCES races(id),
      FOREIGN KEY (boat_id) REFERENCES boats(id)
    )
  `);

  console.log('✅ Database tables created/verified');
}

export function saveDatabase(db) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}
