import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import WebSocket from 'ws';

// Polyfill WebSocket for Node.js 20 (native WebSocket requires Node 22+)
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}

// Dynamic import after polyfill
const { createClient } = await import('@supabase/supabase-js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (server/supabase/../../.env)
dotenv.config({ path: resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('⚠️  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Backend will fail without valid credentials.');
}

// Service-role client (bypasses RLS, used server-side only)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper to create a client scoped to a specific user's JWT
export const supabaseForUser = (jwt: string) =>
  createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || '', {
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  });
