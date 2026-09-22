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
  phoneTaken: 'identity.phone_taken',

  /** The code is already on this basket — a double-click, not a second discount. */
  couponAlreadyApplied: 'promotions.coupon_already_applied.conflict',

  /** No discount has that code. Covers an archived one too. */
  couponNotFound: 'promotions.coupon.not_found'
} as const;

/**
 * Why a coupon did not apply, worded for a customer.
 *
 * <b>The API sends a code, not a sentence, and this is where the sentence
 * lives.</b> Every one of these distinctions already exists in the engine, so
 * collapsing them into "that code cannot be used" would be throwing away
 * information the shop has already computed — and "that code runs from the 1st
 * of October" is the difference between a customer who waits and one who
 * telephones.
 */
export const COUPON_REASONS: Record<string, string> = {
  'promotions.coupon.not_found': 'We do not have a code by that name.',
  'promotions.coupon_inactive': 'That code is not in use.',
  'promotions.coupon_not_started': 'That code is not valid yet.',
  'promotions.coupon_expired': 'That code has expired.',
  'promotions.coupon_no_eligible_items': 'That code does not apply to anything in your basket.',
  'promotions.coupon_min_subtotal': 'Your basket is below the minimum for that code.',
  'promotions.coupon_min_quantity': 'That code needs more items in the basket.',
  'promotions.coupon_zone': 'That code is not offered for deliveries to your area.',
  'promotions.coupon_payment_method': 'That code applies only to certain payment methods.',
  'promotions.coupon_first_order_only': 'That code is for a first order.',
  'promotions.coupon_limit_reached.conflict': 'That code has been fully claimed.',
  'promotions.coupon_customer_limit_reached.conflict': 'You have already used that code.',
  'promotions.coupon_not_combinable':
    'That code cannot be combined with the offer already on your basket.',
  'promotions.coupon_already_applied.conflict': 'That code is already on your basket.'
};

/** The sentence for a coupon refusal, falling back to the API's own message. */
export function couponReason(code: string | null | undefined, fallback = ''): string {
  return (code ? COUPON_REASONS[code] : undefined) ?? fallback ?? '';
}
