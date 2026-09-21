import { Routes } from '@angular/router';
import { adminGuard, preventUnsavedChangesGuard } from '../_guards/auth.guard';

/**
 * The admin panel's routes.
 *
 * <b>Lazy per page rather than one admin chunk.</b> Somebody publishing a
 * product never opens the category editor in that session, and the whole panel
 * is behind a role guard on a connection where every kilobyte is noticeable.
 *
 * Ordering matters in exactly one place: `products/new` is declared before
 * `products/:id`, or `new` binds as an id and the create form tries to load a
 * product called "new".
 */
export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/admin-dashboard').then(m => m.AdminDashboard),
    title: 'Dashboard — WoodHeart Admin'
  },

  {
    path: 'products',
    loadComponent: () =>
      import('./products/admin-product-list').then(m => m.AdminProductList),
    title: 'Products — WoodHeart Admin'
  },

  // Before ':id'. Declared the other way round, `new` matches the parameter.
  {
    path: 'products/new',
    loadComponent: () =>
      import('./products/admin-product-form').then(m => m.AdminProductForm),
    canDeactivate: [preventUnsavedChangesGuard],
    title: 'Add a product — WoodHeart Admin'
  },

  {
    // Before 'products/:id', for the same reason in reverse: a longer, more
    // specific path has to be matched first.
    path: 'products/:productId/media',
    loadComponent: () =>
      import('./products/admin-product-media').then(m => m.AdminProductMediaManager),
    title: 'Photographs — WoodHeart Admin'
  },

  {
    path: 'products/:productId/variants',
    loadComponent: () =>
      import('./products/admin-product-variants').then(m => m.AdminProductVariants),
    title: 'Variants — WoodHeart Admin'
  },

  {
    path: 'products/:id',
    loadComponent: () =>
      import('./products/admin-product-form').then(m => m.AdminProductForm),
    // The one screen where leaving by accident costs real work — a long product
    // description typed once.
    canDeactivate: [preventUnsavedChangesGuard],
    title: 'Edit product — WoodHeart Admin'
  },

  {
    path: 'categories',
    loadComponent: () =>
      import('./categories/admin-categories').then(m => m.AdminCategories),
    title: 'Categories — WoodHeart Admin'
  },

  {
    path: 'brands',
    loadComponent: () => import('./brands/admin-brands').then(m => m.AdminBrands),
    title: 'Brands — WoodHeart Admin'
  },

  {
    path: 'orders',
    loadComponent: () => import('./orders/admin-order-list').then(m => m.AdminOrderList),
    title: 'Orders — WoodHeart Admin'
  },

  {
    path: 'orders/:orderNumber',
    loadComponent: () =>
      import('./orders/admin-order-detail').then(m => m.AdminOrderDetailPage),
    title: 'Order — WoodHeart Admin'
  },

  {
    // Admin only, within a panel that is otherwise open to all staff: this
    // is the VAT rate and the name on the invoice. The API enforces the same
    // policy; the guard just saves a manager a 403.
    path: 'settings',
    canActivate: [adminGuard],
    loadComponent: () => import('./settings/admin-settings').then(m => m.AdminSettings),
    canDeactivate: [preventUnsavedChangesGuard],
    title: 'Settings — WoodHeart Admin'
  },

  {
    // Every staff role: the packer needs to see whether the bed is there.
    // Recording a movement is narrower, and the page hides the form itself.
    path: 'inventory/stock',
    loadComponent: () =>
      import('./inventory/admin-stock-list').then(m => m.AdminStockList),
    title: 'Stock — WoodHeart Admin'
  },

  {
    path: 'inventory/stock/:variantId',
    loadComponent: () =>
      import('./inventory/admin-stock-detail').then(m => m.AdminStockDetail),
    title: 'Stock — WoodHeart Admin'
  }

  // Phase 3 onward: discounts, consultations, customers.
];
