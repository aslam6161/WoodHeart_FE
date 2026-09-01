export const environment = {
  production: false,

  /** Trailing slash included, so services concatenate `apiUrl + 'product'`. */
  apiUrl: 'http://localhost:5199/api/',

  /**
   * The storefront's own origin, no trailing slash.
   *
   * Needed because a canonical URL and an `og:url` must be absolute — a
   * relative canonical is ignored, and a relative `og:url` makes every share
   * card point at whichever host scraped it. The API deliberately returns only
   * a path (`/products/segun-king-bed`); which host serves it is the client's
   * business, and this is where that is decided.
   */
  siteUrl: 'http://localhost:4200',

  /**
   * Where `storagePath` values resolve from. Empty means "same origin".
   *
   * Set to a CDN origin in production once the media pipeline lands.
   */
  mediaUrl: '',

  /** Sent as `X-Anonymous-Id` so a signed-out visitor keeps one basket. */
  anonymousIdKey: 'wh_anon',

  defaultLanguage: 'en'
};
