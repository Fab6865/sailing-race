import express from 'express';
import cors from 'cors';
import { initDatabase } from './database/init.js';
import { startSimulation } from './simulation/engine.js';
import { seedInitialData } from './database/seed.js';
import raceRoutes from './routes/race.js';
import boatRoutes from './routes/boat.js';
import playerRoutes from './routes/player.js';
import upgradeRoutes from './routes/upgrade.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
const db = await initDatabase();

// Seed initial data (courses, bots, etc.)
await seedInitialData(db);

// Make db available to routes
app.locals.db = db;

// Routes
app.use('/api/race', raceRoutes);
app.use('/api/boat', boatRoutes);
app.use('/api/player', playerRoutes);
app.use('/api/upgrade', upgradeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Start simulation loop
startSimulation(db);

app.listen(PORT, () => {
  console.log(`🚤 Sailing Race Server running on port ${PORT}`);
  console.log(`⏱️  Simulation tick: every 60 seconds`);
  console.log(`🌊 Wind update: every ~30 minutes`);
});
