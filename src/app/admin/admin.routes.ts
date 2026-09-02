import { Routes } from '@angular/router';
import { preventUnsavedChangesGuard } from '../_guards/auth.guard';

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
  }

  // Phase 2 onward: orders, inventory, discounts, consultations, customers,
  // settings. The sidebar already lists them; they resolve to the panel's own
  // catch-all until they exist.
];
