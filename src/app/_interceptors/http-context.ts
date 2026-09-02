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

/**
 * Marks a request whose failure must not reach the customer.
 *
 * There is exactly one of these and it is the session restore on start-up. The
 * app asks `/api/account/refresh` on every load because the access token lives
 * in memory and a page refresh throws it away. For a signed-in admin that call
 * silently restores the session; for the far more common visitor who has never
 * signed in, it is a 401 — the correct and expected answer.
 *
 * Without this token that ordinary 401 would raise "Please sign in to
 * continue." on the home page of a furniture shop, to somebody who was only
 * browsing beds.
 */
export const SILENT_FAILURE = new HttpContextToken<boolean>(() => false);

export function silentFailure(): HttpContext {
  return new HttpContext().set(SILENT_FAILURE, true);
}
