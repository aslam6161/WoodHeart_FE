import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GeneralResponseOf } from '../../_models/generalResponse';
import {
  AdjustStock,
  StockLevel,
  StockMovement,
  StockQuery,
  StockSummary
} from '../../_models/inventory';
import { PagedResult } from '../../_models/pagination';
import { appendIfPresent } from '../paginationHelper';
import { handlesNotFound } from '../../_interceptors/http-context';

/**
 * The stock ledger's API.
 *
 * Reading is for every staff role — whoever packs an order needs to know the
 * bed is there. Recording a movement is admin or manager; the API enforces
 * that, and the screen hides the form from the rest so a packer is not shown
 * a button that answers 403.
 */
@Injectable({ providedIn: 'root' })
export class AdminStockService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}admin/stock`;

  /** The list. Pages in the body, like the order board. */
  search(query: StockQuery): Observable<PagedResult<StockLevel>> {
    const pageSize = query.pageSize ?? 50;

    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(pageSize));

    params = appendIfPresent(params, 'term', query.term);

    if (query.lowOnly) {
      params = params.set('lowOnly', 'true');
    }

    return this.http
      .get<GeneralResponseOf<PagedResult<StockLevel>>>(this.baseUrl, { params })
      .pipe(map(response => response.data ?? { items: [], total: 0, page: 1, pageSize }));
  }

  summary(): Observable<StockSummary> {
    return this.http
      .get<GeneralResponseOf<StockSummary>>(`${this.baseUrl}/summary`)
      .pipe(
        map(response => response.data ?? { stockedVariants: 0, lowVariants: 0, unstockedVariants: 0 })
      );
  }

  /**
   * One variant's level. Null when the variant does not exist or is not the
   * stocked kind — the page says so in place rather than bouncing to the
   * site's not-found page, because a stale link is the likeliest way here.
   */
  level(variantId: number): Observable<StockLevel | null> {
    return this.http
      .get<GeneralResponseOf<StockLevel>>(`${this.baseUrl}/${variantId}`, { context: handlesNotFound() })
      .pipe(
        map(response => response.data ?? null),
        catchError((error: unknown) =>
          error instanceof HttpErrorResponse && error.status === 404 ? of(null) : throwError(() => error)
        )
      );
  }

  /** The ledger for one variant, newest first. */
  movements(variantId: number, page = 1, pageSize = 50): Observable<PagedResult<StockMovement>> {
    const params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));

    return this.http
      .get<GeneralResponseOf<PagedResult<StockMovement>>>(`${this.baseUrl}/${variantId}/movements`, {
        params
      })
      .pipe(map(response => response.data ?? { items: [], total: 0, page, pageSize }));
  }

  /** Records a movement and answers with the level as it now stands. */
  adjust(variantId: number, dto: AdjustStock): Observable<GeneralResponseOf<StockLevel>> {
    return this.http.post<GeneralResponseOf<StockLevel>>(`${this.baseUrl}/${variantId}/movements`, dto);
  }
}
