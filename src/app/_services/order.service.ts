import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GeneralResponseOf } from '../_models/generalResponse';
import { CancelOrder, GuestOrderLookup, OrderDetail, OrderSummary } from '../_models/order';
import { PagedResult } from '../_models/pagination';
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

  /**
   * The signed-in customer's orders, newest first.
   *
   * Pages in the body, not the `X-Pagination` header the catalogue uses —
   * see `PagedResult`. Running this through `getPaginatedResult` would
   * type-check and hand the page an empty list.
   */
  getMine(page = 1, pageSize = 10): Observable<PagedResult<OrderSummary>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);

    return this.http
      .get<GeneralResponseOf<PagedResult<OrderSummary>>>(this.baseUrl, { params })
      .pipe(map(response => response.data ?? { items: [], total: 0, page, pageSize }));
  }

  /** One of the signed-in customer's orders. Null when it is not theirs, or does not exist. */
  getMineByNumber(orderNumber: string): Observable<OrderDetail | null> {
    return this.http
      .get<GeneralResponseOf<OrderDetail>>(
        `${this.baseUrl}/${encodeURIComponent(orderNumber)}`,
        { context: handlesNotFound() }
      )
      .pipe(map(response => response.data ?? null), catchError(nullOnNotFound));
  }

  /**
   * Stops one of the customer's own orders, while it is still theirs to stop.
   *
   * The API refuses with `ordering.order.not_cancellable.conflict` once the
   * shop has started work; the page shows the message beside the button, and
   * the order as it now stands comes back either way.
   */
  cancel(orderNumber: string, dto: CancelOrder): Observable<OrderDetail> {
    return this.http
      .post<GeneralResponseOf<OrderDetail>>(
        `${this.baseUrl}/${encodeURIComponent(orderNumber)}/cancel`,
        dto
      )
      .pipe(
        map(response => {
          if (!response.data) {
            throw new Error('The API confirmed the cancellation without the order.');
          }

          return response.data;
        })
      );
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
      .pipe(map(response => response.data ?? null), catchError(nullOnNotFound));
  }
}

/**
 * A 404 is an answer here — "no such order for you" — not a failure.
 *
 * `handlesNotFound()` only stops the interceptor navigating away; the error
 * still arrives, and a page that treats it as one shows nothing at all where
 * "we could not find that order" belongs. Anything else is still an error.
 */
function nullOnNotFound(error: unknown): Observable<null> {
  return error instanceof HttpErrorResponse && error.status === 404
    ? of(null)
    : throwError(() => error);
}
