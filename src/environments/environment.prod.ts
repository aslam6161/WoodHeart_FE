export const environment = {
  production: true,

  /**
   * Relative, not absolute. In production nginx serves the app and proxies
   * `/api` to the API on the same origin, which keeps cookies first-party and
   * removes CORS from the picture entirely.
   *
   * The server-rendering process cannot use a relative URL — Node's fetch
   * rejects one — so `apiBaseInterceptor` makes it absolute there, from
   * `API_INTERNAL_URL` or the incoming request's own origin.
   */
  apiUrl: '/api/',

  /**
   * Last resort only. The real origin comes from `SITE_ORIGIN`, resolved per
   * request on the server and from `location.origin` in the browser, so no
   * domain is compiled into the bundle.
   */
  siteUrl: '',

  /** Empty means media resolves against the site's own origin. */
  mediaUrl: '',

  anonymousIdKey: 'wh_anon',

  defaultLanguage: 'en'
};
