import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: resolve(__dirname, '../.env') });

import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { weightsRouter } from './routes/weights.js';
import { mealsRouter } from './routes/meals.js';
import { workoutsRouter } from './routes/workouts.js';
import { waterRouter } from './routes/water.js';
import { analysesRouter } from './routes/analyses.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/weights', weightsRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/workouts', workoutsRouter);
app.use('/api/water', waterRouter);
app.use('/api/analyses', analysesRouter);

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`🚀 API 服务器已启动: http://localhost:${PORT}`);
  console.log(`   健康检查: http://localhost:${PORT}/api/health`);
});
