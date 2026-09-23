import { DeliveryAddress } from './order';
import { QuotationStatus } from './quotations';

/**
 * The shop's side of quotations, as the API shapes them.
 *
 * Mirrors the admin half of `QuotationDtos.cs`. The quotation itself is one
 * thing read two ways and lives in `quotations.ts`; what is here is the list
 * the board draws and the shapes that write one.
 */

/** One row of the shop's quotation list. */
export interface QuotationListItem {
  id: number;
  quotationNumber: string;
  contactName: string;
  /** Unmasked: the list is behind a staff policy and is what gets rung from. */
  contactPhone: string;
  status: QuotationStatus;
  /** True once the date has passed, whatever the status still says. */
  hasLapsed: boolean;
  /** A Dhaka date, `YYYY-MM-DD`. */
  validUntil: string;
  grandTotal: number;
  lineCount: number;
  bookingNumber?: string | null;
  orderNumber?: string | null;
  createdAt: string;
}

export interface QuotationQuery {
  term?: string | null;
  status?: QuotationStatus | null;
  bookingId?: number | null;
  page?: number;
  pageSize?: number;
}

/**
 * Writing a quotation, lines and all.
 *
 * <b>Saved whole, like a consultant's week.</b> A quotation is one document —
 * the discount only means something beside the lines it comes off — and a
 * partial save is a quotation whose total disagrees with itself.
 */
export interface SaveQuotation {
  /** The consultation this came out of. Optional. */
  bookingId?: number | null;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  /** Needed before it can be sent: delivery cannot be priced without it. */
  shippingAddress?: DeliveryAddress | null;
  /** A Dhaka date. Null lets the API pick its own fortnight. */
  validUntil?: string | null;
  /** Money off the goods, as a figure the designer typed. */
  discount: number;
  /** Delivery priced by hand. Null lets the products decide. */
  deliveryFeeOverride?: number | null;
  notes?: string | null;
  internalNotes?: string | null;
  lines: SaveQuotationLine[];
}

/**
 * One line: either a catalogue variant or something made to measure.
 *
 * Naming a variant fills the description, the SKU and the photograph from the
 * catalogue, and takes the price from there unless one is given — a designer
 * who quotes a bed at a negotiated price is doing something ordinary. Leaving
 * it null makes the line whatever the description says, which is how "wardrobe
 * to the alcove, 7ft" gets quoted at all.
 */
export interface SaveQuotationLine {
  productVariantId?: number | null;
  description?: string | null;
  quantity: number;
  /** Null takes the catalogue's price. Required without a variant. */
  unitPrice?: number | null;
  leadTimeDays?: number | null;
}

/** Moving a quotation along, from the shop's side. */
export interface ChangeQuotationStatus {
  status: QuotationStatus;
  reason?: string | null;
}

/** Turning an accepted quotation into an order. */
export interface ConvertQuotation {
  /** Defaults to cash on delivery, which is how most of these are paid. */
  paymentMethodCode?: string | null;
  deliveryNote?: string | null;
}

/** How long a quotation stands when nobody says. Timber prices move. */
export const DEFAULT_VALID_DAYS = 14;
