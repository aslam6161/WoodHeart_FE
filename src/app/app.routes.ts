import { Routes } from '@angular/router';
import { DefaultLayout } from './_layout/default-layout/default-layout';
import { Home } from './home/home';
import { NotFound } from './errors/not-found/not-found';
import { ServerError } from './errors/server-error/server-error';
import { authGuard, staffGuard } from './_guards/auth.guard';

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
    loadChildren: () => import('./admin/admin.routes').then(m => m.adminRoutes)
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

      {
        path: 'cart',
        loadComponent: () => import('./cart/cart-page/cart-page').then(m => m.CartPage),
        title: 'Your basket'
      },
      {
        path: 'checkout',
        loadComponent: () =>
          import('./checkout/checkout-page/checkout-page').then(m => m.CheckoutPage),
        title: 'Checkout'
      },
      {
        path: 'checkout/confirmation/:orderNumber',
        loadComponent: () =>
          import('./checkout/order-confirmation/order-confirmation').then(
            m => m.OrderConfirmation
          ),
        title: 'Order placed'
      },

      // The second revenue line. Open to a guest throughout: somebody who
      // wants a designer to look at their flat should not have to make an
      // account first.
      {
        path: 'consultation',
        loadComponent: () =>
          import('./consultation/consultation-list/consultation-list').then(m => m.ConsultationList),
        title: 'Talk to a designer'
      },

      // Both before ':slug', or "find" and "bookings" would be read as the
      // slugs of consultations that do not exist.
      {
        path: 'consultation/find',
        loadComponent: () =>
          import('./consultation/booking-page/booking-page').then(m => m.BookingPage),
        title: 'Find your booking'
      },
      {
        path: 'consultation/bookings/:bookingNumber',
        loadComponent: () =>
          import('./consultation/booking-page/booking-page').then(m => m.BookingPage),
        title: 'Your consultation'
      },
      {
        path: 'consultation/:slug',
        loadComponent: () =>
          import('./consultation/booking-wizard/booking-wizard').then(m => m.BookingWizard)
      },

      // Anyone: a guest tracking their order by number and phone.
      {
        path: 'track',
        loadComponent: () => import('./orders/track-order/track-order').then(m => m.TrackOrder),
        title: 'Track your order'
      },

      // Signed-in customers: their orders. Client-rendered — see
      // app.routes.server.ts for why an authenticated area cannot be SSR'd.
      {
        path: 'account',
        canActivate: [authGuard],
        loadChildren: () => import('./account/account.routes').then(m => m.accountRoutes)
      },

      {
        path: 'login',
        loadComponent: () => import('./account/login/login').then(m => m.Login),
        title: 'Sign in'
      },
      {
        path: 'register',
        loadComponent: () => import('./account/register/register').then(m => m.Register),
        title: 'Create an account'
      },

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
