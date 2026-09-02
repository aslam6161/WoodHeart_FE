/**
 * The signed-in user, mirroring `AuthenticatedUserDto` on the backend.
 *
 * <b>There is no refresh token here, and its absence is the design.</b> It
 * lives in an `HttpOnly` cookie scoped to `/api/account` that no script can
 * read — not this one, and not a compromised dependency. The access token below
 * is short-lived and held in memory only; see `AccountService`.
 */
export interface User {
  id: number;
  fullName?: string | null;

  /** E.164 — this is the login handle, not the email. */
  phoneNumber: string;

  email?: string | null;

  /**
   * What this user may do — as far as the *menu* is concerned.
   *
   * A rendering hint and nothing more. Every admin endpoint checks the token's
   * own role claims server-side, so editing this array in the console earns a
   * visible menu item and a 403 behind it.
   */
  roles: string[];

  /** The JWT. Empty from `/me`, which answers "who am I" without minting one. */
  accessToken: string;

  /**
   * When the access token stops working, as an ISO instant.
   *
   * Sent so the client can refresh slightly early rather than discovering
   * expiry as a failed request halfway through saving a product.
   */
  accessTokenExpiresAt: string;

  /** `en` or `bn`. Drives the UI language and the language of SMS received. */
  preferredLanguage: string;
}

export interface LoginDto {
  /** Any format the customer types; the API normalises it. */
  phoneNumber: string;
  password: string;

  /** Labels the session in a future "your devices" screen. */
  deviceLabel?: string;
}

export interface RegisterDto {
  fullName: string;
  phoneNumber: string;
  email?: string;
  password: string;
  preferredLanguage?: string;
  deviceLabel?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}
