import { Injectable, RESPONSE_INIT, inject } from '@angular/core';

/**
 * Sets the HTTP status of a server-rendered page.
 *
 * <b>Why this exists.</b> A product page for a slug that does not exist must
 * answer 404, not 200 with the words "not found" on it. A soft 404 gets
 * indexed, competes with the real product pages, and is invisible until
 * someone reads Search Console months later.
 *
 * <b>Why mutating an injected object is the supported way.</b>
 * `@angular/ssr` builds one `responseInit`, provides that same object through
 * `RESPONSE_INIT`, and then passes it to `new Response(html, responseInit)`
 * once rendering finishes. The token's type is declared with `-readonly` on
 * every member precisely so it can be written to during the render. Nothing
 * here reaches around the framework.
 *
 * On the browser the token is null and every call is a no-op, so components do
 * not need a platform check of their own.
 */
@Injectable({ providedIn: 'root' })
export class ServerResponseService {
  // Optional: null during client-side rendering, prerendering and route
  // extraction, all of which are documented on the token itself.
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  setStatus(status: number): void {
    if (this.responseInit) {
      this.responseInit.status = status;
    }
  }

  notFound(): void {
    this.setStatus(404);
  }
}
