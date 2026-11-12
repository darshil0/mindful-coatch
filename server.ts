import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { SERVER_PORT } from './server/config.ts';
import {
  apiNotFoundHandler,
  jsonErrorHandler,
} from './server/middleware/errorHandler.ts';
import { createCoachRouter } from './server/routes/coachRoutes.ts';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(jsonErrorHandler);

  app.use('/api/coach', createCoachRouter());
  app.use('/api', apiNotFoundHandler);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(SERVER_PORT, '0.0.0.0', () => {
    console.log(`Mindful Coach server listening on http://0.0.0.0:${SERVER_PORT}`);
  });
}

startServer();
