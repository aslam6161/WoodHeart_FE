import { DeliveryZone } from './cart';
import {
  DeliveryAddress,
  FulfilmentStatus,
  OrderStatus,
  OrderTimelineEntry,
  OrderTotals,
  PaymentStatus
} from './order';

/**
 * Orders as the admin panel sees them.
 *
 * Mirrors `AdminOrderDtos.cs`. Deliberately separate types from the
 * customer-facing ones in `order.ts`: these carry the unmasked phone, the
 * internal notes and the legal moves, and a shared type with an `isStaff`
 * flag is one wrong argument away from showing a customer the staff notepad.
 */

export interface AdminOrderSummary {
  id: number;
  orderNumber: string;
  placedAt: string;
  contactName: string;
  /** Unmasked. The first thing anybody does with a new order is ring about it. */
  contactPhone: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  paymentMethodCode: string;
  deliveryZone: DeliveryZone;
  /** "Dhanmondi" — the narrowest part of the address that is still recognisable. */
  shippingArea: string;
  grandTotal: number;
  deliveryFee: number;
  deliveryOverridden: boolean;
  itemCount: number;
  hasAccount: boolean;
}

export interface AdminOrderDetail {
  id: number;
  orderNumber: string;
  placedAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  paymentMethodCode: string;

  /**
   * The moves the API will accept from here, from the same table it
   * validates against — so a button that renders is a button that works,
   * and the client never re-implements the status machine.
   */
  allowedStatusTransitions: OrderStatus[];
  allowedPaymentTransitions: PaymentStatus[];
  canEditDeliveryFee: boolean;

  customerId?: number | null;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  shippingAddress: DeliveryAddress;
  shippingAddressLine: string;
  deliveryZone: DeliveryZone;
  deliveryNote?: string | null;
  /** Staff-only. Never reaches the customer. */
  internalNotes?: string | null;
  currency: string;
  lines: AdminOrderLine[];
  totals: OrderTotals;
  /** What the rate card said at the time, to set beside what was charged. */
  deliveryChargeFromLines: number;
  timeline: OrderTimelineEntry[];
  cartId?: number | null;
}

export interface AdminOrderLine {
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
  /** This line's share of the rate card, before any override. */
  deliveryChargeApplied: number;
  leadTimeDays?: number | null;
}

export interface OrderStatusCount {
  status: OrderStatus;
  count: number;
}

/** The shape the order endpoints page with — in the body, not an `X-Pagination` header. */
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminOrderQuery {
  status?: OrderStatus | null;
  term?: string | null;
  page?: number;
  pageSize?: number;
}

export interface ChangeOrderStatusDto {
  status: OrderStatus;
  /** Required by the API for a cancellation. */
  note?: string | null;
}

export interface RecordPaymentDto {
  status: PaymentStatus;
  note?: string | null;
}

export interface RecordFulfilmentDto {
  status: FulfilmentStatus;
  note?: string | null;
}

export interface OverrideDeliveryFeeDto {
  deliveryFee: number;
  /** Required. Written to the timeline, so the change is attributable. */
  reason: string;
}

export interface UpdateInternalNotesDto {
  internalNotes?: string | null;
}

/** Every work status, in the order the board's tabs show them. */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'ReadyToShip',
  'Shipped',
  'Delivered',
  'Completed',
  'Cancelled',
  'Returned',
  'Refunded'
];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  Unpaid: 'Unpaid',
  AdvancePaid: 'Advance paid',
  Paid: 'Paid',
  PartiallyRefunded: 'Partly refunded',
  Refunded: 'Refunded',
  Failed: 'Failed'
};

export const FULFILMENT_STATUS_LABELS: Record<FulfilmentStatus, string> = {
  Unfulfilled: 'Not yet shipped',
  PartiallyFulfilled: 'Part shipped',
  Fulfilled: 'Delivered',
  Returned: 'Returned'
};
