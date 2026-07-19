import WebSocket from 'ws';

// Polyfill must run before supabase client is imported (via createApp → routes → client)
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}

import { createApp } from '../../server/app.js';
import serverless from 'serverless-http';

const app = createApp();

export const handler = serverless(app);
