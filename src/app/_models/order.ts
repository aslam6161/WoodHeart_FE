import { DeliveryZone } from './cart';

/**
 * Checkout and orders, as the API shapes them.
 *
 * Mirrors `CheckoutDtos.cs` and `OrderDtos.cs` on the backend. The enums
 * arrive as their names — `Confirmed`, `Unpaid` — because the API serialises
 * enums as strings; the union types below are those names, kept in step by
 * hand.
 */

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'ReadyToShip'
  | 'Shipped'
  | 'Delivered'
  | 'Completed'
  | 'Cancelled'
  | 'Returned'
  | 'Refunded';

export type PaymentStatus =
  | 'Unpaid'
  | 'AdvancePaid'
  | 'Paid'
  | 'PartiallyRefunded'
  | 'Refunded'
  | 'Failed';

export type FulfilmentStatus = 'Unfulfilled' | 'PartiallyFulfilled' | 'Fulfilled' | 'Returned';

/**
 * Where an order is going, in the shape Bangladeshi addresses take.
 *
 * Division → district → upazila → area, then a free-text line. The hierarchy
 * is what decides the delivery zone and what a rider is told, so the form asks
 * for it in pieces rather than as one textarea.
 */
export interface DeliveryAddress {
  division: string;
  district: string;
  /** Upazila or thana. Optional inside a city, where the area is enough. */
  upazila?: string | null;
  /** "Dhanmondi", "Bashundhara R/A" — the neighbourhood a rider knows. */
  area?: string | null;
  /** House, road and any flat number. */
  addressLine: string;
  /** "Opposite Popular Diagnostic". How the rider actually finds it. */
  landmark?: string | null;
  postcode?: string | null;
}

export interface PlaceOrder {
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  shippingAddress: DeliveryAddress;
  paymentMethodCode: string;
  deliveryNote?: string | null;
  /** Where a gateway should send the customer back. Unused by cash on delivery. */
  returnUrl?: string | null;
}

/** One way to pay, as offered for a particular address. */
export interface PaymentMethod {
  code: string;
  displayName: string;
  description?: string | null;
  iconUrl?: string | null;
  /** What choosing it adds to the total. Zero for most. */
  surcharge: number;
  /** True when the customer leaves the site to pay — bKash, later. */
  redirectsToGateway: boolean;
}

/** What `POST /api/checkout/place-order` answers with. */
export interface PlacedOrder {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  grandTotal: number;
  /** Set when the payment method needs the customer sent elsewhere. */
  redirectUrl?: string | null;

  /**
   * True when this request repeated an earlier one and the API handed back
   * the order it had already made. A double-tap on "Place order" is one
   * order, and this is how the page knows not to say "placed" twice.
   */
  alreadyPlaced: boolean;
}

export interface OrderSummary {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  placedAt: string;
  grandTotal: number;
  itemCount: number;
  previewImagePath?: string | null;
  previewTitle: string;
  canCancel: boolean;
}

export interface OrderDetail {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  paymentMethodCode: string;
  placedAt: string;
  contactName: string;
  /** Masked for the customer's own view — `+88017*****678`. */
  contactPhone: string;
  contactEmail?: string | null;
  shippingAddress: DeliveryAddress;
  deliveryZone: DeliveryZone;
  deliveryNote?: string | null;
  currency: string;
  lines: OrderLine[];
  totals: OrderTotals;

  /**
   * What came off, named — as it was at placement.
   *
   * Frozen on the order rather than read through the discount, so an invoice
   * reprinted next year still says what was actually given even after the
   * campaign has been renamed or archived.
   */
  discounts: OrderDiscount[];

  timeline: OrderTimelineEntry[];
  canCancel: boolean;
}

/** One discount as it applied to an order. */
export interface OrderDiscount {
  name: string;
  /** The code the customer typed. Null for an automatic promotion. */
  code?: string | null;
  type: import('./promotions').DiscountType;
  amount: number;
}

export interface OrderLine {
  id: number;
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  sku: string;
  variantName: string;
  imagePath?: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
  leadTimeDays?: number | null;
}

export interface OrderTotals {
  subtotal: number;
  discountTotal: number;
  goodsNet: number;
  vatAmount: number;
  vatRatePercent: number;
  pricesIncludeVat: boolean;
  deliveryFee: number;
  paymentSurcharge: number;
  grandTotal: number;
  deliveryWaived: boolean;
  deliveryOverridden: boolean;
}

export interface OrderTimelineEntry {
  fromStatus?: OrderStatus | null;
  toStatus: OrderStatus;
  actorName: string;
  note?: string | null;
  occurredAt: string;
}

/** Why the customer is stopping the order. Optional, and worth asking for. */
export interface CancelOrder {
  reason?: string | null;
}

/** A guest finding their order: the number off the SMS plus the phone it went to. */
export interface GuestOrderLookup {
  orderNumber: string;
  contactPhone: string;
}

/**
 * The status, spelled for a customer.
 *
 * "ReadyToShip" is an enum name. The shop's own words for each state live
 * here so that the confirmation page, the order history and the tracking page
 * cannot each phrase the same state differently.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  Pending: 'Pending',
  Confirmed: 'Confirmed',
  Processing: 'Being prepared',
  ReadyToShip: 'Ready to ship',
  Shipped: 'On its way',
  Delivered: 'Delivered',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  Returned: 'Returned',
  Refunded: 'Refunded'
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  Unpaid: 'Unpaid',
  AdvancePaid: 'Advance paid',
  Paid: 'Paid',
  PartiallyRefunded: 'Partly refunded',
  Refunded: 'Refunded',
  Failed: 'Failed'
};

/**
 * What the status means for the customer, in a sentence.
 *
 * A badge that says "Confirmed" answers "what is it" and not "what now". This
 * is the "what now", and it is what the order page leads with.
 */
export const ORDER_STATUS_EXPLANATIONS: Record<OrderStatus, string> = {
  Pending: 'We have your order and will confirm it shortly.',
  Confirmed: 'Confirmed. We are getting it ready.',
  Processing: 'Being prepared for delivery.',
  ReadyToShip: 'Packed and waiting for the van.',
  Shipped: 'On its way. Our rider will call before arriving.',
  Delivered: 'Delivered. We hope you love it.',
  Completed: 'Completed. Thank you for shopping with WoodHeart.',
  Cancelled: 'This order was cancelled.',
  Returned: 'This order was returned.',
  Refunded: 'This order was refunded.'
};
