/**
 * The basket, as `GET /api/cart` returns it.
 *
 * Mirrors `CartDto` on the backend. Every mutation — add, change a quantity,
 * remove, choose a zone — answers with the whole priced basket rather than the
 * line that changed, so the client never adds numbers up itself. The totals
 * are the API's, and the API is the only thing that knows the VAT rate and the
 * delivery rate card.
 */

/** Where the goods are going. Decides which of a product's two delivery charges applies. */
export type DeliveryZone = 'InsideDhaka' | 'OutsideDhaka';

export interface Cart {
  id: number;
  currency: string;
  deliveryZone?: DeliveryZone | null;
  lines: CartLine[];
  totals: CartTotals;

  /**
   * True when at least one line's price has moved since it was added. Said
   * once at the top of the page, so the customer is told rather than left to
   * spot a changed number and wonder whether they misremembered.
   */
  hasPriceChanges: boolean;

  /** True when something in the basket can no longer be bought. */
  hasUnavailableLines: boolean;
}

export interface CartLine {
  id: number;
  variantId: number;
  productId: number;
  productNameEn: string;
  productNameBn?: string | null;
  productSlug: string;
  sku: string;
  /** "Segun · 6ft · Matte" — what distinguished this from its siblings. */
  variantName: string;
  primaryImagePath?: string | null;
  quantity: number;
  /** The live price, which is what will be charged. */
  unitPrice: number;
  /** What it cost when it went into the basket. */
  unitPriceAtAdd: number;
  priceChanged: boolean;
  lineTotal: number;

  /**
   * False when the product has been withdrawn or the variant switched off.
   * The line stays visible: silently dropping something a customer chose is
   * worse than showing it greyed out with a reason.
   */
  isAvailable: boolean;

  /** Working days to build, for made-to-order items. Null for stocked ones. */
  leadTimeDays?: number | null;
}

export interface CartTotals {
  subtotal: number;
  discountTotal: number;
  /** Goods excluding VAT. */
  goodsNet: number;
  vatAmount: number;
  deliveryFee: number;
  grandTotal: number;
  /** True when the free-delivery threshold waived the charge. */
  deliveryWaived: boolean;
  /** True when staff set the delivery charge by hand. */
  deliveryOverridden: boolean;

  /**
   * True until a zone is chosen. The page then says "calculated at checkout"
   * rather than quoting a Dhaka price to a customer in Sylhet.
   */
  deliveryPending: boolean;

  itemCount: number;

  /**
   * Whether the prices above already contain VAT, so the VAT line can be
   * labelled "included" rather than implying it was added on.
   */
  pricesIncludeVat: boolean;
}

/** The empty basket, for a visitor who has not put anything in one yet. */
export const EMPTY_CART: Cart = {
  id: 0,
  currency: 'BDT',
  deliveryZone: null,
  lines: [],
  totals: {
    subtotal: 0,
    discountTotal: 0,
    goodsNet: 0,
    vatAmount: 0,
    deliveryFee: 0,
    grandTotal: 0,
    deliveryWaived: false,
    deliveryOverridden: false,
    deliveryPending: true,
    itemCount: 0,
    pricesIncludeVat: true
  },
  hasPriceChanges: false,
  hasUnavailableLines: false
};

/**
 * The most of one variant a basket will take.
 *
 * Matches `CartRules.MaxQuantityPerLine` on the backend, which is where the
 * rule is enforced. This copy exists so the stepper stops at the same number
 * the API would refuse, rather than letting a customer press "+" into an error.
 */
export const MAX_QUANTITY_PER_LINE = 99;
