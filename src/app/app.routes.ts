import { Routes } from '@angular/router';
import { DefaultLayout } from './_layout/default-layout/default-layout';
import { Home } from './home/home';
import { NotFound } from './errors/not-found/not-found';
import { ServerError } from './errors/server-error/server-error';
import { staffGuard } from './_guards/auth.guard';

/**
 * Two top-level shells: the public storefront and the admin panel.
 *
 * Admin is lazily loaded behind `staffGuard`, so a customer browsing products
 * never downloads it. That is worth more here than it looks — a large share of
 * this audience is on a mid-range phone over 4G, and the admin bundle would
 * otherwise be dead weight in the initial download.
 */
export const routes: Routes = [
  // Admin comes first, and it has to. The storefront shell below ends in a
  // `**` child that matches anything, so a route declared after it would never
  // be reached.
  {
    path: 'admin',
    canActivate: [staffGuard],
    loadComponent: () => import('./_layout/admin-layout/admin-layout').then(m => m.AdminLayout),
    children: [
      // Phase 1 onward: dashboard, products, categories, orders, inventory,
      // discounts, consultations, customers, settings.
    ]
  },

  {
    path: '',
    component: DefaultLayout,
    children: [
      { path: '', component: Home, title: 'WoodHeart — Interiors, made in Bangladesh' },

      // Lazy, even though the storefront is the common case. The listing and
      // the product page are separate chunks because a customer arriving on a
      // product from a search result never opens the listing, and vice versa.
      {
        path: 'products',
        loadComponent: () => import('./catalog/product-list/product-list').then(m => m.ProductList)
      },
      {
        path: 'products/:slug',
        loadComponent: () =>
          import('./catalog/product-detail/product-detail').then(m => m.ProductDetail)
      },

      // Phase 2 onward:
      // { path: 'cart', loadComponent: ... },
      // { path: 'checkout', loadComponent: ... },
      // { path: 'account', canActivate: [authGuard], loadChildren: ... },

      { path: 'not-found', component: NotFound, title: 'Page not found' },
      { path: 'server-error', component: ServerError, title: 'Something went wrong' },

      // Catch-all, rendered in place rather than redirected to /not-found.
      //
      // A redirect turns a dead link into a 302 that lands on a 404 one hop
      // later. Rendering here keeps the address the customer actually typed,
      // and lets the page answer 404 on that URL — which is the status a
      // crawler needs to drop the link rather than keep following it.
      //
      // It also stays inside the storefront shell, so a mistyped URL still has
      // the header, the search and a way back into the catalogue.
      { path: '**', component: NotFound, title: 'Page not found' }
    ]
  }
];
