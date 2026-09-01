import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../_services/seo.service';
import { ServerResponseService } from '../../_services/server-response.service';

/**
 * The page for a URL that does not exist.
 *
 * Sets the status itself rather than leaving it to the route configuration,
 * because it is reached two ways: directly at `/not-found`, and — the common
 * case — through the catch-all, on whatever address the customer actually
 * typed. Only the component knows it is rendering in the second case.
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-5 text-center">
      <h1 class="display-6">Page not found</h1>
      <p class="text-muted">That page does not exist, or it has moved.</p>
      <a class="btn btn-dark" routerLink="/">Back to the store</a>
    </div>
  `
})
export class NotFound {
  constructor() {
    // A no-op in the browser, where the token is null.
    inject(ServerResponseService).notFound();

    inject(SeoService).apply({
      title: 'Page not found',
      canonicalPath: '/not-found',
      noIndex: true
    });
  }
}
