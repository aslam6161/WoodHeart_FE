import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * How each route is produced on the server.
 *
 * <b>The starting default was `Prerender` for everything, and that is wrong
 * for a catalogue.</b> Prerendering happens at build time, so every product
 * page would be frozen at the moment of the last deploy: a price change, a new
 * product or a discontinued one would not reach the site until somebody
 * rebuilt it. And `/products/:slug` cannot be prerendered at all without a
 * `getPrerenderParams` that reads the database during the build, which couples
 * deploying the frontend to a database being up.
 *
 * So the storefront renders per request, against live data, with the complete
 * HTML in the first response — which is the part that decides whether a
 * furniture shop in Dhaka is findable.
 */
export const serverRoutes: ServerRoute[] = [
  {
    // Client-rendered, deliberately. Every admin route sits behind `staffGuard`,
    // which reads the signed-in user from localStorage — absent on the server,
    // so a server render fails the guard, redirects to the home page, and hands
    // an admin a storefront page for their own dashboard URL. There is nothing
    // to gain either: an admin panel has no search ranking to protect.
    path: 'admin/**',
    renderMode: RenderMode.Client
  },
  {
    path: 'not-found',
    renderMode: RenderMode.Server,
    // The catch-all route redirects every unmatched URL here, so this is the
    // page a crawler lands on for a dead link. Answering 200 would invite it to
    // index an error page.
    status: 404
  },
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
