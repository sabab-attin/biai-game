import { createApp } from './app.js';
import { ensureServerlessReady } from './bootstrap.js';
import { loadConfig } from './config/env.js';

function isHealthOrPrizesPath(url = '') {
  const pathname = url.split('?')[0];
  return pathname === '/api/health' || pathname === '/api/prizes';
}

/** Build the Express request handler wrapped with lazy database bootstrap for serverless deploys. */
export function createServerlessHandler(overrides = {}) {
  const config = loadConfig({ isVercel: true, ...overrides });
  const app = createApp(config);

  return async function serverlessHandler(req, res) {
    if (!isHealthOrPrizesPath(req.url)) {
      try {
        await ensureServerlessReady(config);
      } catch (error) {
        console.error('[serverless] Initialization failed:', error);
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            error:
              error.publicMessage ||
              'Database connection unavailable. Verify MONGODB_URI and network access.',
          })
        );
        return;
      }
    }

    return app(req, res);
  };
}

let cachedDefaultHandler = null;

export default function defaultServerlessHandler(req, res) {
  if (!cachedDefaultHandler) {
    cachedDefaultHandler = createServerlessHandler();
  }
  return cachedDefaultHandler(req, res);
}
