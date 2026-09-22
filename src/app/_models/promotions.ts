/**
 * Discounts, mirroring `PromotionDtos.cs` and `Discount.cs` on the backend.
 *
 * <b>Nothing here works out what a discount is worth.</b> The engine that
 * decides lives in the API's Domain layer and runs at both basket preview and
 * order placement; a second implementation in the browser would be right until
 * the day somebody changed a rule, and then the customer would be shown one
 * number and charged another. These screens read amounts the API computed.
 */

import { DeliveryZone } from './cart';

/** What a discount does to the bill. */
export type DiscountType = 'Percentage' | 'FixedAmount' | 'FreeShipping';

/**
 * Where a discount is in its life.
 *
 * Separate from its dates on purpose: a campaign nobody has switched on and
 * one whose window has not opened look the same to a customer and are entirely
 * different to the person running the shop.
 */
export type DiscountStatus = 'Draft' | 'Active' | 'Paused' | 'Archived';

export const DISCOUNT_TYPES: readonly DiscountType[] = ['Percentage', 'FixedAmount', 'FreeShipping'];

export const DISCOUNT_STATUSES: readonly DiscountStatus[] = [
  'Draft',
  'Active',
  'Paused',
  'Archived'
];

/** Written for the person running the shop, not for the enum. */
export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  Percentage: 'Percentage off',
  FixedAmount: 'Amount off',
  FreeShipping: 'Free delivery'
};

export const DISCOUNT_STATUS_LABELS: Record<DiscountStatus, string> = {
  Draft: 'Draft',
  Active: 'Active',
  Paused: 'Paused',
  Archived: 'Archived'
};

/** Bootstrap contextual class per status, so the badges read at a glance. */
export const DISCOUNT_STATUS_CLASS: Record<DiscountStatus, string> = {
  Draft: 'text-bg-secondary',
  Active: 'text-bg-success',
  Paused: 'text-bg-warning',
  Archived: 'text-bg-light'
};

/** One row of the admin's discount list. */
export interface DiscountListItem {
  id: number;
  name: string;
  /** Null for an automatic promotion — there is nothing to type. */
  code?: string | null;
  type: DiscountType;
  value: number;
  status: DiscountStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimitTotal?: number | null;
  timesUsed: number;

  /**
   * True when it would apply to a qualifying basket right now.
   *
   * Status and window are two different facts, and a list showing only the
   * status would leave the shop guessing which of its "Active" campaigns are
   * actually running today.
   */
  isLive: boolean;
}

/** One discount in full, for the edit screen. */
export interface Discount extends DiscountListItem {
  maxDiscountAmount?: number | null;
  minSubtotal?: number | null;
  minQuantity?: number | null;
  firstOrderOnly: boolean;
  /** Empty means anywhere the shop delivers. */
  deliveryZones: DeliveryZone[];
  /** Empty means any payment method. */
  paymentMethods: string[];
  usageLimitPerCustomer?: number | null;
  stackable: boolean;
  priority: number;
  /** What it applies to. Empty means the whole basket. */
  targets: DiscountTarget[];
  /** What it has cost the shop so far. */
  totalGiven: number;
}

/**
 * A product or a category a discount is restricted to.
 *
 * Exactly one id is set. `name` comes back on a read so the chip renders
 * without a second request, and is ignored on a write.
 */
export interface DiscountTarget {
  categoryId?: number | null;
  productId?: number | null;
  name?: string | null;
}

/** Creating or replacing a discount. The form sends the whole thing. */
export interface SaveDiscount {
  name: string;
  code?: string | null;
  type: DiscountType;
  value: number;
  maxDiscountAmount?: number | null;
  minSubtotal?: number | null;
  minQuantity?: number | null;
  firstOrderOnly: boolean;
  deliveryZones: DeliveryZone[];
  paymentMethods: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimitTotal?: number | null;
  usageLimitPerCustomer?: number | null;
  stackable: boolean;
  priority: number;
  status: DiscountStatus;
  targets: DiscountTarget[];
}

export interface DiscountQuery {
  term?: string | null;
  status?: DiscountStatus | null;
  page?: number;
  pageSize?: number;
}

/** One redemption, for the usage report. */
export interface PromotionUsage {
  orderId: number;
  orderNumber: string;
  code?: string | null;
  /** The account's number when there was one, otherwise the guest's. */
  contactPhone: string;
  isMember: boolean;
  amount: number;
  usedAt: string;
}

/**
 * Codes whose value field means nothing.
 *
 * Free delivery is worth the delivery charge, whatever anybody types in the
 * box — so the box is hidden rather than left there to be filled in and
 * ignored.
 */
export const VALUELESS_TYPES: ReadonlySet<DiscountType> = new Set<DiscountType>(['FreeShipping']);
