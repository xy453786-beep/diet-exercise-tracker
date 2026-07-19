import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dev only: load .env from project root BEFORE importing app
// (Dynamic import ensures dotenv runs before the module graph resolves)
dotenv.config({ path: resolve(__dirname, '../.env') });

const { createApp } = await import('./app.js');

const PORT = process.env.PORT || 3001;

const app = createApp();
app.listen(PORT, () => {
  console.log(`🚀 API 服务器已启动: http://localhost:${PORT}`);
  console.log(`   健康检查: http://localhost:${PORT}/api/health`);
});
