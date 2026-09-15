import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GeneralResponseOf } from '../_models/generalResponse';
import { GuestOrderLookup, OrderDetail } from '../_models/order';
import { handlesNotFound } from '../_interceptors/http-context';

/**
 * A customer's own orders.
 *
 * Two doors into the same order. A signed-in customer reads theirs by number;
 * a guest, who has no account to be "theirs" against, presents the number off
 * the SMS together with the phone it was sent to. The API answers both with
 * the same shape and the same not-found for a wrong number — so nothing here
 * can be used to discover which order numbers exist.
 */
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}orders`;

  /** One of the signed-in customer's orders. Null when it is not theirs, or does not exist. */
  getMineByNumber(orderNumber: string): Observable<OrderDetail | null> {
    return this.http
      .get<GeneralResponseOf<OrderDetail>>(
        `${this.baseUrl}/${encodeURIComponent(orderNumber)}`,
        { context: handlesNotFound() }
      )
      .pipe(map(response => response.data ?? null));
  }

  /**
   * A guest's order, by number and phone.
   *
   * Handles its own 404: "we could not find that order" belongs on the page
   * beside the form, not on a generic not-found page that has lost the number
   * the customer typed.
   */
  lookup(dto: GuestOrderLookup): Observable<OrderDetail | null> {
    return this.http
      .post<GeneralResponseOf<OrderDetail>>(`${this.baseUrl}/lookup`, dto, {
        context: handlesNotFound()
      })
      .pipe(map(response => response.data ?? null));
  }
}
