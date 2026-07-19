// Supabase admin client for server-side operations.
//
// WebSocket polyfill is NOT needed here — the backend only uses REST API calls
// (auth.getUser, database queries). No Realtime features.
// For local dev, the polyfill is set up in server/index.ts before this module loads.
//
// In dev: dotenv is loaded by server/index.ts before this module is resolved.
// In production (Netlify Functions): env vars are injected by the platform.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment.');
  console.error('   Local: check your .env file.  Production: check Netlify Dashboard → Environment variables.');
  process.exit(1);
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
