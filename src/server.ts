import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();

/**
 * The hostnames this server will render for, beyond the `localhost` and
 * `127.0.0.1` compiled into the build manifest.
 *
 * <b>This is not optional configuration.</b> Angular fails closed: a host that
 * is not on the list does not get an error, it gets a silent fall back to
 * client-side rendering — an empty shell, with none of the product HTML, none
 * of the title and none of the structured data this storefront exists to
 * serve. It answers 200, so a health check passes and nothing looks wrong.
 * A deployment on a real domain must name it here.
 *
 *   ALLOWED_HOSTS=woodheart.com.bd,www.woodheart.com.bd
 *
 * `*.woodheart.com.bd` is understood, and `*` allows everything — only ever
 * correct when a proxy in front is already validating the Host header, which
 * is the whole point of the check.
 */
const allowedHosts = (process.env['ALLOWED_HOSTS'] ?? '')
  .split(',')
  .map(host => host.trim())
  .filter(Boolean);

/**
 * Whether to trust `X-Forwarded-*`.
 *
 * The other half of the same trap. Behind a reverse proxy those headers are
 * always present, and an untrusted one also deopts the request to client-side
 * rendering. Turn this on only when something in front is actually setting
 * them — trusting them when nothing is means a client can set its own.
 */
const trustProxyHeaders = process.env['TRUST_PROXY_HEADERS'] === 'true';

const angularApp = new AngularNodeAppEngine({ allowedHosts, trustProxyHeaders });

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
