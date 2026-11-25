import cors from 'cors';
import express from 'express';
import { createApiRouter } from './routes/api.js';

export function createApp(config) {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: config.frontendOrigin ? [config.frontendOrigin, 'http://127.0.0.1:5173'] : true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '64kb' }));

  app.use('/api', createApiRouter(config));

  app.use((err, _req, res, _next) => {
    console.error('[API error]', err);
    res.status(500).json({
      error: 'Something broke on the server. Try again in a moment.',
    });
  });

  return app;
}
