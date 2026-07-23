import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dev only: load .env from project root before anything else
dotenv.config({ path: resolve(__dirname, '../.env') });

// WebSocket polyfill for local dev (Node 20).
// In production (Netlify Functions), supabase-js works fine without WebSocket
// because the backend only uses REST API calls (no Realtime features).
import WebSocket from 'ws';
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}

const { createApp } = await import('./app.js');

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

const app = createApp();

// Root health check for cloud platforms (Koyeb, Render, etc.)
app.get('/', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(Number(PORT), HOST, () => {
  console.log(`🚀 API 服务器已启动: http://${HOST}:${PORT}`);
  console.log(`   健康检查: http://${HOST}:${PORT}/api/health`);
});
