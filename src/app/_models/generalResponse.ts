/**
 * The response envelope every WoodHeart API endpoint returns.
 *
 * Mirrors `WoodHeart.Repository.GeneralResponse` on the backend. Keep the two
 * in step — if a field is added there, add it here.
 */
export interface GeneralResponse {
  id: number;
  isSuccess: boolean;
  message: string;

  /**
   * Stable machine-readable code, e.g. `ordering.insufficient_stock`.
   * Null on success.
   *
   * Branch on THIS, never on `message`. The message is prose: it gets
   * reworded, and it is translated to Bangla.
   */
  errorCode?: string | null;

  /** Per-field messages for form display. Keys are camelCase, matching the form controls. */
  errors?: Record<string, string[]> | null;
}

/** A `GeneralResponse` carrying a typed payload. */
export interface GeneralResponseOf<T> extends GeneralResponse {
  data?: T | null;
}

/**
 * Error codes the client reacts to specifically. Everything else falls through
 * to showing `message`.
 */
export const ErrorCodes = {
  validationFailed: 'common.validation_failed',
  invalidPhone: 'common.invalid_phone',
  rateLimited: 'common.rate_limited',

  /** Checkout found nothing in the basket — it was emptied or checked out elsewhere. */
  cartEmpty: 'ordering.cart.empty',

  /** Something in the basket can no longer be bought; the basket page shows which. */
  lineNotPurchasable: 'ordering.line_not_purchasable.conflict',

  /**
   * The shelf cannot cover the basket: a line sold out, or has fewer left
   * than asked for. `errors` is keyed by variant id with how many are left.
   */
  insufficientStock: 'ordering.insufficient_stock.conflict',

  /** The chosen payment method is not offered for this address or amount. */
  paymentMethodNotAvailable: 'payments.method_not_available.conflict',

  /** The shop has started work on the order; cancelling is now a phone call. */
  orderNotCancellable: 'ordering.order.not_cancellable.conflict',

  /** Registration: somebody already has an account on this number. */
  phoneTaken: 'identity.phone_taken'
} as const;
