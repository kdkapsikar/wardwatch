import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import { config } from './config.js';
import { query } from './db/pool.js';
import { loadSession } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import photoRoutes from './routes/photos.js';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import corporatorRoutes from './routes/corporator.js';
import adminRoutes from './routes/admin.js';
import citizenRoutes from './routes/citizen.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

  const defaults = helmet.contentSecurityPolicy.getDefaultDirectives();
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...defaults,
          // blob: lets the upload form preview photos before they are sent;
          // tile.openstreetmap.org serves the map tiles on the report form.
          'img-src': ["'self'", 'data:', 'blob:', 'https://tile.openstreetmap.org'],
          // Forcing https breaks plain-HTTP local runs, so it is opt-out.
          'upgrade-insecure-requests': config.forceHttps ? [] : null,
        },
      },
      // OSM's tile usage policy expects a Referer; helmet's default (no-referrer) would strip it.
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  app.use(express.json({ limit: '50kb' }));

  app.use('/uploads', photoRoutes);

  // Cross-origin browser access (e.g. web app on GitHub Pages, API elsewhere). No cookies are used,
  // so credentials are not involved; only the listed origins get CORS headers.
  if (config.corsOrigins.length > 0) {
    app.use('/api', cors({
      origin: config.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    }));
  }

  app.get('/api/health', async (_req, res) => {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use('/api', loadSession);
  app.use('/api', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/corporator', corporatorRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/citizen', citizenRoutes);
  app.use('/api', notFound);

  // Production: serve the built React app and fall back to index.html for client-side routes.
  const indexHtml = path.join(config.clientDistDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.clientDistDir, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      return res.sendFile(indexHtml);
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
