import dotenv from 'dotenv';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  resolveTrustProxyConfig,
  SERVER_PORT,
  type TrustProxyConfig,
} from './server/config.ts';
import {
  apiNotFoundHandler,
  jsonErrorHandler,
} from './server/middleware/errorHandler.ts';
import {
  type CoachRouterDependencies,
  createCoachRouter,
} from './server/routes/coachRoutes.ts';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CreateAppOptions {
  isProduction?: boolean;
  distPath?: string;
  trustProxy?: TrustProxyConfig;
  enableHsts?: boolean;
  coachDeps?: CoachRouterDependencies;
}

export async function createApp(options?: CreateAppOptions): Promise<Express> {
  const isProduction =
    options?.isProduction ?? process.env.NODE_ENV === 'production';
  const distPath = options?.distPath ?? path.join(__dirname, 'dist');
  const trustProxy = options?.trustProxy ?? resolveTrustProxyConfig();
  const enableHsts =
    options?.enableHsts ?? process.env.ENABLE_HSTS === 'true';

  if (isProduction) {
    const indexHtmlPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
      throw new Error(
        `Production build missing at ${indexHtmlPath}. Run "npm run build" before starting in production.`
      );
    }
  }

  const app = express();
  app.set('trust proxy', trustProxy);
  app.disable('x-powered-by');

  const frameAncestors = (process.env.CSP_FRAME_ANCESTORS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    helmet({
      // Only enforce strict CSP & HSTS in production; Vite middleware injects inline HMR/preamble scripts in dev
      contentSecurityPolicy: isProduction
        ? {
            useDefaults: false,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              fontSrc: ["'self'", 'data:'],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors:
                frameAncestors.length > 0 ? frameAncestors : ["'none'"],
            },
          }
        : false,
      strictTransportSecurity:
        isProduction && enableHsts
          ? { maxAge: 15552000, includeSubDomains: true }
          : false,
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
      xFrameOptions:
        frameAncestors.length > 0 ? false : { action: 'deny' },
    })
  );

  app.use(express.json({ limit: '64kb' }));

  app.use('/api/coach', createCoachRouter(options?.coachDeps));
  app.use('/api', apiNotFoundHandler);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(distPath, {
        index: false,
        maxAge: '1h',
      })
    );
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (
        (req.method !== 'GET' && req.method !== 'HEAD') ||
        req.path.startsWith('/assets/') ||
        req.path.startsWith('/api/')
      ) {
        next();
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Register JSON error handler strictly AFTER routes and body parsers
  app.use(jsonErrorHandler);

  return app;
}

export async function startServer() {
  try {
    const app = await createApp();
    return app.listen(SERVER_PORT, '0.0.0.0', () => {
      console.log(`Mindful Coach server listening on http://0.0.0.0:${SERVER_PORT}`);
    });
  } catch (err) {
    console.error(
      'Failed to start Mindful Coach server:',
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  }
}

const isEntrypoint =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  void startServer();
}
