import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GeneralResponseOf } from '../../_models/generalResponse';
import { PaymentMethodConfig, UpdatePaymentMethod } from '../../_models/payment-methods';
import { handledInline, handlesNotFound } from '../../_interceptors/http-context';

/**
 * How the shop takes money.
 *
 * Admin-only on the API, and narrower than the rest of the panel for the same
 * reason the settings screen is: whether cash on delivery stops at ৳100,000,
 * and which merchant account a gateway points at, are the owner's decisions
 * rather than the day's. These routes also carry credentials.
 *
 * <b>There is no create and no delete, and that is not an omission.</b> A
 * method's code is the join to the code that implements it, so a row invented
 * from a screen would read as configured and never appear at checkout.
 */
@Injectable({ providedIn: 'root' })
export class AdminPaymentMethodService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}admin/payment-methods`;

  /** Every method, enabled or not, in the shop's display order. */
  getAll(): Observable<PaymentMethodConfig[]> {
    return this.http
      .get<GeneralResponseOf<PaymentMethodConfig[]>>(this.baseUrl)
      .pipe(map(response => response.data ?? []));
  }

  get(code: string): Observable<PaymentMethodConfig | null> {
    return this.http
      .get<GeneralResponseOf<PaymentMethodConfig>>(
        `${this.baseUrl}/${encodeURIComponent(code)}`,
        { context: handlesNotFound() }
      )
      .pipe(map(response => response.data ?? null), catchError(nullOnNotFound));
  }

  /**
   * Saves one method whole.
   *
   * Refused inline rather than toasted. "Nothing can take money this way yet"
   * and "add the merchant credentials before switching this on" are both about
   * the switch the admin just pressed, and belong beside it.
   */
  update(
    code: string,
    dto: UpdatePaymentMethod
  ): Observable<GeneralResponseOf<PaymentMethodConfig>> {
    return this.http
      .put<GeneralResponseOf<PaymentMethodConfig>>(
        `${this.baseUrl}/${encodeURIComponent(code)}`,
        dto,
        { context: handledInline() }
      )
      .pipe(catchError(envelopeFromError));
  }
}

/** A 404 is an answer — "no method with that code" — not a failure. */
function nullOnNotFound(error: unknown): Observable<null> {
  return error instanceof HttpErrorResponse && error.status === 404
    ? of(null)
    : throwError(() => error);
}

/** Hands the API's own envelope back, so the screen can read `message`. */
function envelopeFromError(error: unknown): Observable<GeneralResponseOf<PaymentMethodConfig>> {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
    return of(error.error as GeneralResponseOf<PaymentMethodConfig>);
  }

  return throwError(() => error);
}
