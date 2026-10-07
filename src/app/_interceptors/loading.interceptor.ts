import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { BusyService } from '../_services/busy.service';
import { QUIET } from './http-context';

/** Requests that must not raise the global spinner. */
const SILENT_ENDPOINTS = [
  'diagnostics/ping',
  // Typeahead fires on nearly every keystroke; a spinner flickering over the
  // whole page while someone types is worse than no feedback at all. Search
  // shows its own inline indicator instead.
  'product/search-suggest',
  // The whole public catalogue. Clicking a category is browsing, not a
  // transaction: throwing a full-screen blocking overlay over the page for it
  // makes an ordinary listing feel like a checkout. The listing dims its own
  // grid instead, which keeps the previous results readable while the next
  // page loads.
  'catalog/'
];

export const loadingInterceptor: HttpInterceptorFn = (request, next) => {
  const busy = inject(BusyService);

  // The context token first: a caller that shows its own progress says so at
  // the call site, which survives a route being renamed in a way this list of
  // URL fragments does not.
  const isSilent =
    request.context.get(QUIET) ||
    request.headers.has('X-Silent') ||
    SILENT_ENDPOINTS.some(path => request.url.includes(path));

  if (isSilent) {
    return next(request);
  }

  busy.busy();

  // finalize, not a tap on success: the counter must come down on error and on
  // cancellation too, or one failed request leaves the spinner up forever.
  return next(request).pipe(finalize(() => busy.idle()));
};
