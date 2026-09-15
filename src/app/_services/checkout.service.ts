import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GeneralResponseOf } from '../_models/generalResponse';
import { DeliveryAddress, PaymentMethod, PlaceOrder, PlacedOrder } from '../_models/order';

/**
 * Turning a basket into an order.
 *
 * Two calls. The first asks which payment methods this address may use — the
 * API filters by zone and by the order amount, and the client offers only what
 * came back. The second places the order, and it is the one request in the
 * storefront that must never be sent twice by accident.
 */
@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}checkout/`;

  /** The header the API reads to make a repeated placement return the first order. */
  static readonly IdempotencyHeader = 'Idempotency-Key';

  /**
   * The ways this address can pay.
   *
   * Sent as a POST with the address in the body rather than a GET, because the
   * answer depends on it — cash on delivery may stop at a ceiling, and a
   * gateway may not serve every zone. With no address the API answers for the
   * basket's chosen zone, or inside Dhaka when there is none.
   */
  getPaymentMethods(address: DeliveryAddress | null): Observable<PaymentMethod[]> {
    return this.http
      .post<GeneralResponseOf<PaymentMethod[]>>(`${this.baseUrl}payment-methods`, address)
      .pipe(map(response => response.data ?? []));
  }

  /**
   * Places the order.
   *
   * <b>`idempotencyKey` is what stops a double-tap becoming two sofas.</b> The
   * page mints one key when it opens and sends it with every attempt; a retry
   * after a timeout, or a second press before the button disabled, reaches the
   * API with the same key and is answered with the order already made. A new
   * key is minted only after an order is placed, so a deliberate second order
   * from the same session is still possible.
   */
  placeOrder(dto: PlaceOrder, idempotencyKey: string): Observable<PlacedOrder> {
    return this.http
      .post<GeneralResponseOf<PlacedOrder>>(`${this.baseUrl}place-order`, dto, {
        headers: { [CheckoutService.IdempotencyHeader]: idempotencyKey }
      })
      .pipe(
        map(response => {
          if (!response.data) {
            // A 200 with no order in it is a contract violation rather than a
            // business failure, and the page must not tell a customer their
            // order was placed on the strength of it.
            throw new Error('The order was not returned.');
          }

          return response.data;
        })
      );
  }

  /**
   * A key for one placement attempt.
   *
   * Random rather than derived from the basket, so two different visitors
   * with identical baskets cannot collide, and so a customer who clears the
   * basket and builds the same one again gets a second order rather than the
   * first one back.
   */
  newIdempotencyKey(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
