/**
 * Payment methods as the shop has configured them, mirroring
 * `PaymentMethodAdminDtos.cs`.
 *
 * <b>There is no credential on any shape here, and there never will be.</b>
 * A screen that displays a live merchant secret is one screenshot away from
 * being a public one, so the API tells this client whether something is stored
 * and takes a replacement — never the other way round.
 */

/** Sandbox or real money. Stored per method, not inferred from the environment. */
export type PaymentMode = 'Sandbox' | 'Live';

export type PaymentChargeType = 'None' | 'Fixed' | 'Percent';

export const CHARGE_TYPE_LABELS: Record<PaymentChargeType, string> = {
  None: 'No charge',
  Fixed: 'A flat amount',
  Percent: 'A percentage of the order'
};

export interface PaymentMethodConfig {
  id: number;
  /** `cod`, `bkash`. Fixed: it is the join to the code that implements it. */
  code: string;

  displayNameEn: string;
  displayNameBn?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  iconUrl?: string | null;

  isEnabled: boolean;
  sortOrder: number;
  mode: PaymentMode;

  minOrderAmount?: number | null;
  /**
   * The cash-on-delivery ceiling, when this is cash on delivery.
   *
   * Sending a rider out to collect ৳180,000 in notes is a risk the shop may
   * not want to carry, and this is the one field where it says so.
   */
  maxOrderAmount?: number | null;

  availableInsideDhaka: boolean;
  availableOutsideDhaka: boolean;

  chargeType: PaymentChargeType;
  chargeValue: number;

  /** Whether a credential is stored. Never what it is. */
  hasCredentials: boolean;
  /**
   * Stored, but it no longer decrypts.
   *
   * Nearly always a Data Protection key ring rotated or lost with a container.
   * It has to be visible, because the alternative is discovering it at the
   * moment a customer tries to pay.
   */
  credentialsUnreadable: boolean;

  /**
   * Whether any code implements this method.
   *
   * False for one configured ahead of the class that will serve it — bKash,
   * until the provider is written. The API refuses to enable such a method,
   * because the checkout would silently never offer it.
   */
  isImplemented: boolean;
  supportsRedirect: boolean;
  supportsRefund: boolean;
  /** Cannot work without a merchant credential. */
  needsCredentials: boolean;
}

/**
 * Changing one method.
 *
 * The code is not here: it is the join to the provider, and editing it would
 * turn a working row into one the checkout skips.
 */
export interface UpdatePaymentMethod {
  displayNameEn: string;
  displayNameBn?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  iconUrl?: string | null;

  isEnabled: boolean;
  sortOrder: number;
  mode: PaymentMode;

  minOrderAmount?: number | null;
  maxOrderAmount?: number | null;

  availableInsideDhaka: boolean;
  availableOutsideDhaka: boolean;

  chargeType: PaymentChargeType;
  chargeValue: number;

  /**
   * A new credential, or nothing.
   *
   * <b>Three states, and they are all different.</b> Leaving the field out
   * keeps what is stored — which is what every save that is not about
   * credentials sends, because this screen was never given the secret to send
   * back. An empty string clears it. Anything else replaces it. A form that
   * sent its blank box every time would wipe a merchant key on the next
   * spelling correction.
   */
  credentials?: string | null;
}
