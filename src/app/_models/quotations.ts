import { DeliveryAddress } from './order';

/**
 * Quotations, as the API shapes them.
 *
 * Mirrors `QuotationDtos.cs`. One shape, read two ways: the shop's screens and
 * the customer's page render the same `Quotation`, and the API decides what is
 * in it — the phone arrives masked for the customer, `internalNotes` arrives
 * not at all. The admin's own write shapes live in `admin-quotations.ts`.
 */

export type QuotationStatus =
  | 'Draft'
  | 'Sent'
  | 'Accepted'
  | 'Declined'
  | 'Expired'
  | 'Converted';

/**
 * What each status is called to a customer.
 *
 * "Draft" is in the map for completeness and should never reach a customer's
 * screen: the API does not serve a draft to one at all, because a figure
 * nobody has checked is not a price the shop wants held to it.
 */
export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  Draft: 'Being prepared',
  Sent: 'Awaiting your answer',
  Accepted: 'Accepted',
  Declined: 'Declined',
  Expired: 'Out of date',
  Converted: 'Ordered'
};

/** The shop's own words. Shorter, and about where the work stands. */
export const ADMIN_QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  Draft: 'Draft',
  Sent: 'Sent',
  Accepted: 'Accepted',
  Declined: 'Declined',
  Expired: 'Expired',
  Converted: 'Ordered'
};

/**
 * Sent is deliberately not green.
 *
 * Green would read as settled, and a sent quotation is the opposite: it is the
 * shop waiting on an answer, and the one row on the board somebody should be
 * chasing.
 */
export const QUOTATION_STATUS_CLASS: Record<QuotationStatus, string> = {
  Draft: 'text-bg-light',
  Sent: 'text-bg-warning',
  Accepted: 'text-bg-success',
  Declined: 'text-bg-secondary',
  Expired: 'text-bg-secondary',
  Converted: 'text-bg-dark'
};

/** One line of a quotation. */
export interface QuotationLine {
  id: number;
  /**
   * Null for anything made to measure.
   *
   * A wardrobe built to the shape of an alcove has no variant and never will,
   * and it is the most valuable thing a designer sells.
   */
  productVariantId?: number | null;
  description: string;
  variantName?: string | null;
  sku?: string | null;
  imagePath?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  leadTimeDays?: number | null;
  /** Whether this comes off a shelf or is made. Only the first holds stock. */
  holdsStock: boolean;
}

export interface Quotation {
  id: number;
  quotationNumber: string;
  /** The consultation it came out of, when it came out of one. */
  bookingNumber?: string | null;

  contactName: string;
  /** Masked on the customer's own view — `017****5678`. */
  contactPhone: string;
  contactEmail?: string | null;
  shippingAddress?: DeliveryAddress | null;

  status: QuotationStatus;
  /** A Dhaka date, `YYYY-MM-DD`. */
  validUntil: string;
  /**
   * True once the date has passed, whatever the status still says.
   *
   * Worked out by the API against Dhaka's today, not the browser's: a laptop
   * set to another zone must not make a quotation look live for another six
   * hours, nor dead six hours early.
   */
  hasLapsed: boolean;
  sentAt?: string | null;
  respondedAt?: string | null;
  declineReason?: string | null;
  notes?: string | null;
  /** Staff only. Absent from the customer's view entirely. */
  internalNotes?: string | null;

  subtotal: number;
  discountTotal: number;
  goodsNet: number;
  vatAmount: number;
  /**
   * The rate this quotation was priced at, frozen when it was written.
   *
   * Carried onto the order rather than re-read, so one given at 5% does not
   * become an order at today's 7.5%.
   */
  vatRatePercent: number;
  pricesIncludeVat: boolean;
  deliveryFee: number;
  deliveryOverridden: boolean;
  /** Goods, VAT and delivery. Any payment charge is added at checkout. */
  grandTotal: number;

  /** The order it became, once it became one. */
  orderNumber?: string | null;
  lines: QuotationLine[];

  /** Whether the customer may still accept or decline it. */
  canAnswer: boolean;

  /**
   * Every status legal from this one, straight from the API's own table.
   *
   * Sent rather than reimplemented here, exactly as an order's and a booking's
   * are: a second copy of the graph in TypeScript drifts, and the drift is a
   * button that renders, is pressed, and comes back 409.
   */
  allowedStatusTransitions: QuotationStatus[];
}

/**
 * The customer answering one.
 *
 * The phone goes in the body rather than the query string, for the same reason
 * a guest order lookup puts it there: a URL ends up in browser history, in a
 * proxy log and in a referrer header.
 */
export interface AnswerQuotation {
  phone?: string | null;
  /** Why not, when they say why. Worth asking for. */
  reason?: string | null;
}
