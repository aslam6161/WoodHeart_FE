import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Marks a request whose 404 is expected and handled by the caller.
 *
 * The error interceptor's default — redirect to `/not-found` — is right for a
 * page that fetched something it needs. It is wrong for a page whose *whole
 * job* is to say "no such product": redirecting there loses the slug, so the
 * page cannot tell the customer what was not found, cannot suggest the
 * category, and cannot set a 404 on its own URL. Google would then see a
 * redirect where it expected a status.
 */
export const HANDLES_NOT_FOUND = new HttpContextToken<boolean>(() => false);

export function handlesNotFound(): HttpContext {
  return new HttpContext().set(HANDLES_NOT_FOUND, true);
}
