import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router, UrlTree } from '@angular/router';
import { AccountService } from '../_services/account.service';
import { ToastService } from '../_services/toast.service';

/**
 * Every guard here waits for the session restore first.
 *
 * <b>This is the difference between a working admin panel and one that logs
 * you out on refresh.</b> The access token lives in memory, so pressing F5 on
 * `/admin/products` starts with nobody signed in; the session comes back from
 * the refresh cookie a round trip later. A guard that answers immediately
 * answers "not signed in" — correctly, and uselessly — and bounces the admin
 * to the storefront every single time.
 *
 * `ensureRestored()` is memoised, so several guards on one navigation share the
 * one call rather than each rotating the refresh token and tripping the
 * server's reuse alarm.
 */
/** Requires any signed-in user. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const account = inject(AccountService);
  const router = inject(Router);

  // Injected above, awaited here: after the first await this is no longer an
  // injection context, so nothing below may call inject().
  await account.ensureRestored();

  if (account.isAuthenticated()) {
    return true;
  }

  // returnUrl, so signing in lands the customer back where they were rather
  // than on the home page. On a checkout flow that difference is an
  // abandoned order.
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Admin only — settings, payment configuration. */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const account = inject(AccountService);
  const router = inject(Router);
  const toast = inject(ToastService);

  await account.ensureRestored();

  if (account.isAdmin()) {
    return true;
  }

  return refuse(account, router, toast, state.url);
};

/** Any staff role — the admin panel at large. */
export const staffGuard: CanActivateFn = async (_route, state) => {
  const account = inject(AccountService);
  const router = inject(Router);
  const toast = inject(ToastService);

  await account.ensureRestored();

  if (account.isStaff()) {
    return true;
  }

  return refuse(account, router, toast, state.url);
};

/**
 * Sends the visitor somewhere useful, which is not the same place twice.
 *
 * Signed out means "you have not proved who you are yet" — the sign-in form,
 * with a returnUrl, so the trip is one hop. Signed in without the role means
 * "we know exactly who you are and the answer is still no", and the sign-in
 * form would invite them to try the same credentials again and be refused the
 * same way.
 */
function refuse(
  account: AccountService,
  router: Router,
  toast: ToastService,
  returnUrl: string
): UrlTree {
  if (!account.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
  }

  toast.error('You do not have permission to view that page.');

  return router.createUrlTree(['/']);
}

/** Implemented by any component that guards against navigating away mid-edit. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Blocks navigation away from a dirty form.
 *
 * Deliberately a plain `confirm`: it is synchronous, so there is no window in
 * which the router proceeds while a styled modal is still resolving. Losing an
 * admin's half-finished product description is the exact thing this exists to
 * prevent, so the boring implementation is the correct one.
 */
export const preventUnsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = component => {
  if (!component.hasUnsavedChanges()) {
    return true;
  }

  return confirm('You have unsaved changes. Are you sure you want to leave?');
};
