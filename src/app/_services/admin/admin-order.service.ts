import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GeneralResponse, GeneralResponseOf } from '../../_models/generalResponse';
import {
  AdminOrderDetail,
  AdminOrderQuery,
  AdminOrderSummary,
  ChangeOrderStatusDto,
  OrderStatusCount,
  OverrideDeliveryFeeDto,
  PagedResult,
  RecordFulfilmentDto,
  RecordPaymentDto,
  UpdateInternalNotesDto
} from '../../_models/admin-order';
import { appendIfPresent } from '../paginationHelper';

/**
 * The order board's API.
 *
 * Every mutation answers with the whole order, and the page replaces what it
 * holds with that answer. The allowed moves come back with it, so after a
 * status change the buttons on screen are the ones the API will accept next
 * — the client never works out for itself what "Shipped" may become.
 */
@Injectable({ providedIn: 'root' })
export class AdminOrderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}admin/orders`;

  /**
   * The board. Pages in the body rather than an `X-Pagination` header, which
   * is why this does not go through `getPaginatedResult`.
   */
  search(query: AdminOrderQuery): Observable<PagedResult<AdminOrderSummary>> {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 20));

    params = appendIfPresent(params, 'status', query.status);
    params = appendIfPresent(params, 'term', query.term);

    return this.http
      .get<GeneralResponseOf<PagedResult<AdminOrderSummary>>>(this.baseUrl, { params })
      .pipe(
        map(
          response =>
            response.data ?? { items: [], total: 0, page: 1, pageSize: query.pageSize ?? 20 }
        )
      );
  }

  /** A count per status, for the tabs. Every status, including the empty ones. */
  statusCounts(): Observable<OrderStatusCount[]> {
    return this.http
      .get<GeneralResponseOf<OrderStatusCount[]>>(`${this.baseUrl}/status-counts`)
      .pipe(map(response => response.data ?? []));
  }

  get(orderNumber: string): Observable<AdminOrderDetail | null> {
    return this.http
      .get<GeneralResponseOf<AdminOrderDetail>>(this.url(orderNumber))
      .pipe(map(response => response.data ?? null));
  }

  changeStatus(orderNumber: string, dto: ChangeOrderStatusDto): Observable<GeneralResponseOf<AdminOrderDetail>> {
    return this.http.post<GeneralResponseOf<AdminOrderDetail>>(`${this.url(orderNumber)}/status`, dto);
  }

  recordPayment(orderNumber: string, dto: RecordPaymentDto): Observable<GeneralResponseOf<AdminOrderDetail>> {
    return this.http.post<GeneralResponseOf<AdminOrderDetail>>(`${this.url(orderNumber)}/payment`, dto);
  }

  recordFulfilment(
    orderNumber: string,
    dto: RecordFulfilmentDto
  ): Observable<GeneralResponseOf<AdminOrderDetail>> {
    return this.http.post<GeneralResponseOf<AdminOrderDetail>>(`${this.url(orderNumber)}/fulfilment`, dto);
  }

  overrideDeliveryFee(
    orderNumber: string,
    dto: OverrideDeliveryFeeDto
  ): Observable<GeneralResponseOf<AdminOrderDetail>> {
    return this.http.post<GeneralResponseOf<AdminOrderDetail>>(
      `${this.url(orderNumber)}/delivery-fee`,
      dto
    );
  }

  updateNotes(orderNumber: string, dto: UpdateInternalNotesDto): Observable<GeneralResponse> {
    return this.http.put<GeneralResponse>(`${this.url(orderNumber)}/notes`, dto);
  }

  /**
   * The invoice, as bytes.
   *
   * Fetched rather than linked, because a plain `<a href>` carries no
   * Authorization header and the endpoint is behind the staff policy. The
   * page turns the blob into an object URL and opens it in a new tab.
   */
  invoice(orderNumber: string): Observable<Blob> {
    return this.http.get(`${this.url(orderNumber)}/invoice`, { responseType: 'blob' });
  }

  private url(orderNumber: string): string {
    return `${this.baseUrl}/${encodeURIComponent(orderNumber)}`;
  }
}
