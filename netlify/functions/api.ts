import { createApp } from '../../server/app.js';
import serverless from 'serverless-http';

const app = createApp();

export const handler = serverless(app);
