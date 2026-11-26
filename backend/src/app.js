import cors from 'cors';
import express from 'express';
import { createApiRouter } from './routes/api.js';

function isSameHost(origin, req) {
  const host = req.get('x-forwarded-host') || req.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function createApp(config, { beforeApi } = {}) {
  const app = express();
  const allowedOrigins = new Set([
    ...(Array.isArray(config.allowedOrigins) ? config.allowedOrigins : []),
    ...(config.frontendOrigin ? [config.frontendOrigin] : []),
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ]);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) =>
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin) || isSameHost(origin, req)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
    })(req, res, next)
  );
  app.use(express.json({ limit: '100kb' }));

  if (typeof beforeApi === 'function') {
    app.use(beforeApi);
  }

  app.use('/api', createApiRouter(config));

  app.use((err, _req, res, _next) => {
    console.error('[API error]', err);
    res.status(500).json({
      error: 'Something broke on the server. Try again in a moment.',
    });
  });

  return app;
}
