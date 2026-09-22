import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GeneralResponseOf } from '../../_models/generalResponse';
import {
  Discount,
  DiscountListItem,
  DiscountQuery,
  DiscountStatus,
  PromotionUsage,
  SaveDiscount
} from '../../_models/promotions';
import { PagedResult } from '../../_models/pagination';
import { appendIfPresent } from '../paginationHelper';

/**
 * The discounts API.
 *
 * Reading is for every staff role — somebody answering the phone needs to be
 * able to say whether a code is still running. Writing is admin or manager;
 * the API enforces that, and the screens hide the buttons so a packer is not
 * shown a control that answers 403.
 *
 * There is no delete. A discount that has been given is part of an order's
 * history, so archiving is how one goes away.
 */
@Injectable({ providedIn: 'root' })
export class AdminDiscountService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}admin/discounts`;

  /** The list. Pages in the body, like the order board and the stock list. */
  search(query: DiscountQuery): Observable<PagedResult<DiscountListItem>> {
    const pageSize = query.pageSize ?? 20;

    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(pageSize));

    params = appendIfPresent(params, 'term', query.term);
    params = appendIfPresent(params, 'status', query.status);

    return this.http
      .get<GeneralResponseOf<PagedResult<DiscountListItem>>>(this.baseUrl, { params })
      .pipe(map(response => response.data ?? { items: [], total: 0, page: 1, pageSize }));
  }

  get(id: number): Observable<Discount | null> {
    return this.http
      .get<GeneralResponseOf<Discount>>(`${this.baseUrl}/${id}`)
      .pipe(map(response => response.data ?? null));
  }

  create(dto: SaveDiscount): Observable<GeneralResponseOf<Discount>> {
    return this.http.post<GeneralResponseOf<Discount>>(this.baseUrl, dto);
  }

  update(id: number, dto: SaveDiscount): Observable<GeneralResponseOf<Discount>> {
    return this.http.put<GeneralResponseOf<Discount>>(`${this.baseUrl}/${id}`, dto);
  }

  /**
   * Switches a discount on, off, or away, without touching the rest of it.
   *
   * Its own endpoint rather than a full save, because pausing a campaign that
   * is already running should not require sending back every field — and
   * because a discount that has been used refuses a full save that changes
   * what it is worth.
   */
  setStatus(id: number, status: DiscountStatus): Observable<GeneralResponseOf<Discount>> {
    return this.http.put<GeneralResponseOf<Discount>>(`${this.baseUrl}/${id}/status`, { status });
  }

  /** Who used it, on which order, and for how much. */
  usage(id: number, page = 1, pageSize = 20): Observable<PagedResult<PromotionUsage>> {
    const params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));

    return this.http
      .get<GeneralResponseOf<PagedResult<PromotionUsage>>>(`${this.baseUrl}/${id}/usage`, { params })
      .pipe(map(response => response.data ?? { items: [], total: 0, page, pageSize }));
  }
}
