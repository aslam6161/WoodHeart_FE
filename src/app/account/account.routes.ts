import { Routes } from '@angular/router';

/**
 * The customer's own corner of the site: `/account/…`.
 *
 * Every route here is behind `authGuard` at the parent, so nothing in this
 * file checks again. The guard waits for the session restore, which is what
 * makes a refresh on `/account/orders` land back on the orders and not on the
 * sign-in page.
 */
export const accountRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'orders' },
  {
    path: 'orders',
    loadComponent: () => import('./order-history/order-history').then(m => m.OrderHistory),
    title: 'Your orders'
  },
  {
    path: 'orders/:orderNumber',
    loadComponent: () => import('./order-page/order-page').then(m => m.OrderPage),
    title: 'Your order'
  },
  {
    path: 'bookings',
    loadComponent: () => import('./booking-history/booking-history').then(m => m.BookingHistory),
    title: 'Your consultations'
  }
];
