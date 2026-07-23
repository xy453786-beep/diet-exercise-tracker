import express from 'express';
import cors from 'cors';

import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { weightsRouter } from './routes/weights.js';
import { mealsRouter } from './routes/meals.js';
import { workoutsRouter } from './routes/workouts.js';
import { waterRouter } from './routes/water.js';
import { analysesRouter } from './routes/analyses.js';
import { foodRouter } from './routes/food.js';

export function createApp() {
  const app = express();

  // CORS: allow local dev + Netlify production + deploy previews
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, mobile)
      if (!origin) return callback(null, true);
      // Allow local dev
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      // Allow Netlify domains (production + deploy previews)
      if (origin.endsWith('.netlify.app')) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
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
  app.use('/api/food', foodRouter);

  // Global error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: '服务器内部错误' });
  });

  return app;
}
