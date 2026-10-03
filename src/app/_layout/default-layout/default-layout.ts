import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Nav } from '../../nav/nav';
import { Footer } from '../../footer/footer';

/**
 * The public storefront shell: header, content, footer.
 *
 * Kept separate from the admin shell so the two can diverge — and so the
 * admin's chrome is never downloaded by a customer browsing products.
 */
@Component({
  selector: 'app-default-layout',
  imports: [RouterOutlet, Nav, Footer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- "wh-store" is what every storefront rule in styles/_storefront.scss
         hangs off, mirroring "wh-admin" on the panel. Both surfaces share one
         stylesheet and nothing else. (Plain quotes, not backticks: this comment
         lives inside a template literal.) -->
    <div class="wh-store">
      <app-nav />

      <main class="wh-main">
        <router-outlet />
      </main>

      <app-footer />
    </div>
  `,
  styles: `
    /* A short page — sign in, an empty basket, a 404 — used to end its footer
       band partway down and leave white below it, which reads as the page
       having failed to finish loading. */
    .wh-store {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .wh-main {
      flex: 1 0 auto;
    }
  `
})
export class DefaultLayout {}
