import { createApp } from './app.js';
import { ensureServerlessReady } from './bootstrap.js';
import { loadConfig } from './config/env.js';

function isHealthOrPrizesPath(url = '') {
  const pathname = url.split('?')[0];
  return pathname === '/api/health' || pathname === '/api/prizes';
}

/** Build the Express application wrapped with lazy database bootstrap for Vercel serverless deploys. */
export function createServerlessHandler(overrides = {}) {
  const config = loadConfig({ isVercel: true, ...overrides });

  return createApp(config, {
    beforeApi: async (req, res, next) => {
      if (isHealthOrPrizesPath(req.originalUrl || req.url)) {
        return next();
      }

      try {
        await ensureServerlessReady(config);
        return next();
      } catch (error) {
        console.error('[serverless] Initialization failed:', error);
        return res.status(503).json({
          error:
            error.publicMessage ||
            'Database connection unavailable. Verify MONGODB_URI and network access.',
        });
      }
    },
  });
}

const app = createServerlessHandler();

export default app;
