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
  timeline: OrderTimelineEntry[];
  canCancel: boolean;
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
