import { HttpInterceptorFn } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';

/**
 * The absolute origin the *server* uses to reach the API, e.g.
 * `http://api:8080`. Null in the browser.
 */
export const API_ORIGIN = new InjectionToken<string | null>('API_ORIGIN');

/**
 * The origin the storefront is *served* from, e.g. `https://woodheart.com.bd`.
 *
 * Resolved at runtime rather than compiled in: a canonical URL and an `og:url`
 * have to be absolute, and baking a domain into the bundle means a staging
 * deploy publishes production's canonical on every page — which is how a
 * staging site ends up telling search engines it is the real one.
 */
export const SITE_ORIGIN = new InjectionToken<string | null>('SITE_ORIGIN');

/**
 * Makes a relative API URL absolute while rendering on the server.
 *
 * <b>This is not a nicety.</b> In production `environment.apiUrl` is `/api/`,
 * because nginx serves the app and proxies the API on the same origin — which
 * keeps cookies first-party and removes CORS entirely. That is right for the
 * browser and impossible on the server: Angular's fetch backend hands the URL
 * straight to Node's `fetch`, which rejects a relative URL outright. Without
 * this interceptor every server-rendered page would fail its data load in
 * production and succeed in development, where the URL happens to be absolute.
 *
 * The origin comes from `API_INTERNAL_URL` when set — inside Docker the SSR
 * container can reach the API container directly and skip a hop through the
 * proxy — and otherwise from the incoming request's own origin.
 */
export const apiBaseInterceptor: HttpInterceptorFn = (request, next) => {
  const origin = inject(API_ORIGIN, { optional: true });

  // Absolute already, or we are in the browser, where relative is correct.
  if (!origin || /^https?:\/\//i.test(request.url)) {
    return next(request);
  }

  const base = origin.replace(/\/+$/, '');
  const path = request.url.startsWith('/') ? request.url : `/${request.url}`;

  return next(request.clone({ url: `${base}${path}` }));
};
