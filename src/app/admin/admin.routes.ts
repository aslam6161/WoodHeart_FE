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

  // The diary first: it is what the panel is opened for. The two screens that
  // write the schedule sit under it, and both are declared before any ':id'
  // for the usual reason.
  {
    path: 'consultations',
    loadComponent: () =>
      import('./consultations/admin-booking-board').then(m => m.AdminBookingBoard),
    title: 'Consultations — WoodHeart Admin'
  },
  {
    path: 'consultations/services',
    loadComponent: () =>
      import('./consultations/admin-consultation-services').then(m => m.AdminConsultationServices),
    title: 'What we offer — WoodHeart Admin'
  },
  {
    path: 'consultations/services/new',
    loadComponent: () =>
      import('./consultations/admin-consultation-service-form').then(
        m => m.AdminConsultationServiceForm
      ),
    canDeactivate: [preventUnsavedChangesGuard],
    title: 'Add a consultation — WoodHeart Admin'
  },
  {
    path: 'consultations/services/:id',
    loadComponent: () =>
      import('./consultations/admin-consultation-service-form').then(
        m => m.AdminConsultationServiceForm
      ),
    canDeactivate: [preventUnsavedChangesGuard],
    title: 'Edit consultation — WoodHeart Admin'
  },
  {
    path: 'consultations/consultants',
    loadComponent: () =>
      import('./consultations/admin-consultants').then(m => m.AdminConsultants),
    title: 'Designers — WoodHeart Admin'
  },
  {
    path: 'consultations/consultants/new',
    loadComponent: () =>
      import('./consultations/admin-consultant-form').then(m => m.AdminConsultantForm),
    canDeactivate: [preventUnsavedChangesGuard],
    title: 'Add a designer — WoodHeart Admin'
  },
  {
    path: 'consultations/consultants/:id',
    loadComponent: () =>
      import('./consultations/admin-consultant-form').then(m => m.AdminConsultantForm),
    // A week of typed hours is exactly the kind of work leaving by accident
    // costs.
    canDeactivate: [preventUnsavedChangesGuard],
    title: 'Designer — WoodHeart Admin'
  },
  // Quotations: what the consultation was for. 'new' and ':number/edit' are
  // both declared before ':quotationNumber' for the usual reason — otherwise
  // the detail page tries to load a quotation called "new".
  {
    path: 'quotations',
    loadComponent: () =>
      import('./quotations/admin-quotation-list').then(m => m.AdminQuotationList),
    title: 'Quotations — WoodHeart Admin'
  },
  {
    path: 'quotations/new',
    loadComponent: () =>
      import('./quotations/admin-quotation-form').then(m => m.AdminQuotationForm),
    // Lines typed by hand after a site visit: exactly the kind of work that
    // leaving by accident costs.
    canDeactivate: [preventUnsavedChangesGuard],
    title: 'Write a quotation — WoodHeart Admin'
  },
  {
    path: 'quotations/:quotationNumber/edit',
    loadComponent: () =>
      import('./quotations/admin-quotation-form').then(m => m.AdminQuotationForm),
    canDeactivate: [preventUnsavedChangesGuard],
    title: 'Edit quotation — WoodHeart Admin'
  },
  {
    path: 'quotations/:quotationNumber',
    loadComponent: () =>
      import('./quotations/admin-quotation-detail').then(m => m.AdminQuotationDetail),
    title: 'Quotation — WoodHeart Admin'
  },

  {
    path: 'consultations/bookings/:bookingNumber',
    loadComponent: () =>
      import('./consultations/admin-booking-detail').then(m => m.AdminBookingDetail),
    title: 'Booking — WoodHeart Admin'
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
    // Admin only, beside Settings and for the same reason: this decides
    // whether money can be taken at all, and it holds merchant credentials.
    // 'new' is absent on purpose — a method is half a configuration row and
    // half a class, and one invented here would reach no customer.
    path: 'payment-methods',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./payments/admin-payment-method-list').then(m => m.AdminPaymentMethodList),
    title: 'Payment methods — WoodHeart Admin'
  },
  {
    path: 'payment-methods/:code',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./payments/admin-payment-method-form').then(m => m.AdminPaymentMethodForm),
    canDeactivate: [preventUnsavedChangesGuard],
    title: 'Payment method — WoodHeart Admin'
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
  },

  {
    // Every staff role reads: somebody answering the phone needs to be able
    // to say whether a code is still running. Writing is narrower, and the
    // screens hide the controls themselves.
    path: 'discounts',
    loadComponent: () =>
      import('./discounts/admin-discount-list').then(m => m.AdminDiscountList),
    title: 'Discounts — WoodHeart Admin'
  },

  // Before ':id', or 'new' binds as an id and the create form tries to load a
  // discount called "new" — the same trap as products above.
  {
    path: 'discounts/new',
    loadComponent: () =>
      import('./discounts/admin-discount-form').then(m => m.AdminDiscountForm),
    canDeactivate: [preventUnsavedChangesGuard],
    title: 'New discount — WoodHeart Admin'
  },

  {
    // Longer path first, for the same reason.
    path: 'discounts/:id/usage',
    loadComponent: () =>
      import('./discounts/admin-discount-usage').then(m => m.AdminDiscountUsage),
    title: 'Discount usage — WoodHeart Admin'
  },

  {
    path: 'discounts/:id',
    loadComponent: () =>
      import('./discounts/admin-discount-form').then(m => m.AdminDiscountForm),
    canDeactivate: [preventUnsavedChangesGuard],
    title: 'Discount — WoodHeart Admin'
  }

  // Phase 4 onward: consultations, customers.
];
