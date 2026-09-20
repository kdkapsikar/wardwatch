import { config } from './config.js';
import { createApp } from './app.js';
import { pool } from './db/pool.js';
import { purgeExpiredSessions } from './services/sessions.js';

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`WardWatch API listening on http://localhost:${config.port} (${config.env})`);
});

// Hourly housekeeping; unref() so it never keeps the process alive on shutdown.
setInterval(() => purgeExpiredSessions().catch((e) => console.error('Session purge failed:', e.message)), 3600_000).unref();

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
