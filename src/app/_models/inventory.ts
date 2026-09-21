/**
 * Stock, mirroring `InventoryDtos.cs` on the backend.
 *
 * The count on a variant is a projection of its ledger: every change is a
 * movement with who, why and the count afterwards, and `onHand` is what those
 * add up to. The screens read the count from the API and never work one out.
 */

/**
 * Why a count moved. `Sale` is written by shipping an order and is refused
 * by hand; the others are what a person records.
 */
export type StockMovementType =
  | 'Purchase'
  | 'Sale'
  | 'Return'
  | 'Adjustment'
  | 'Damage'
  | 'TransferIn'
  | 'TransferOut';

/** One row of the stock list: a variant and where its count stands. */
export interface StockLevel {
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  sku: string;
  variantName: string;
  imagePath?: string | null;
  /** False until the first stock-in. An unstocked variant cannot be sold. */
  isStocked: boolean;
  onHand: number;
  /** Held for orders that have not shipped. */
  reserved: number;
  /** `onHand` less `reserved`: what a customer can buy right now. */
  available: number;
  /** This variant's own reorder level; null means the store threshold applies. */
  reorderLevel?: number | null;
  /** At or below the reorder level, or the store threshold where none is set. */
  isLow: boolean;
  lastMovementAt?: string | null;
}

export interface StockMovement {
  id: number;
  type: StockMovementType;
  /** Signed: positive in, negative out. */
  quantity: number;
  onHandAfter: number;
  orderId?: number | null;
  orderNumber?: string | null;
  reference?: string | null;
  reason?: string | null;
  performedBy: string;
  occurredAt: string;
}

/** A stock-in, a write-off, a correction or a transfer, recorded by hand. */
export interface AdjustStock {
  type: StockMovementType;
  /**
   * How many. Positive for everything but an Adjustment, which is signed:
   * `-2` means "two fewer than the system said".
   */
  quantity: number;
  /** Required for an adjustment or damage; welcome on the rest. */
  reason?: string | null;
  /** The supplier's invoice, the delivery note — whatever the paper says. */
  reference?: string | null;
  /** Sets the variant's own reorder level at the same time, if given. */
  reorderLevel?: number | null;
}

export interface StockQuery {
  term?: string | null;
  lowOnly?: boolean;
  page?: number;
  pageSize?: number;
}

/** The three numbers at the top of the list. */
export interface StockSummary {
  stockedVariants: number;
  lowVariants: number;
  unstockedVariants: number;
}

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  Purchase: 'Stock in',
  Sale: 'Sale',
  Return: 'Return',
  Adjustment: 'Correction',
  Damage: 'Written off',
  TransferIn: 'Transfer in',
  TransferOut: 'Transfer out'
};

/**
 * What the form offers, in the order the shop meets them: a delivery from
 * the workshop first, a breakage or a miscount less often. Never `Sale` —
 * sales are recorded by shipping the order, so the ledger and the order book
 * cannot disagree.
 */
export const MANUAL_MOVEMENT_TYPES: readonly StockMovementType[] = [
  'Purchase',
  'Return',
  'Damage',
  'Adjustment',
  'TransferIn',
  'TransferOut'
];

/** The types that must say why. The others may. */
export const REASON_REQUIRED_TYPES: ReadonlySet<StockMovementType> = new Set(['Adjustment', 'Damage']);
