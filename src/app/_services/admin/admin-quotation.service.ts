import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GeneralResponseOf } from '../../_models/generalResponse';
import {
  ChangeQuotationStatus,
  ConvertQuotation,
  QuotationListItem,
  QuotationQuery,
  SaveQuotation
} from '../../_models/admin-quotations';
import { Quotation } from '../../_models/quotations';
import { PaymentMethod, PlacedOrder } from '../../_models/order';
import { PagedResult } from '../../_models/pagination';
import { appendIfPresent } from '../paginationHelper';
import { handledInline, handlesNotFound } from '../../_interceptors/http-context';

/**
 * The shop's side of quotations.
 *
 * Reading is for every staff role — whoever answers the telephone is asked
 * "what did you quote me". Writing one is admin or manager: a quotation is a
 * price the shop is held to, and it can be accepted the moment it is sent. The
 * API enforces that; the screens hide the controls so a packer is not shown a
 * button that answers 403.
 */
@Injectable({ providedIn: 'root' })
export class AdminQuotationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}admin/quotations`;

  /** The board. Pages in the body, like the order and booking lists. */
  search(query: QuotationQuery): Observable<PagedResult<QuotationListItem>> {
    const pageSize = query.pageSize ?? 20;

    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(pageSize));

    params = appendIfPresent(params, 'term', query.term);
    params = appendIfPresent(params, 'status', query.status);
    params = appendIfPresent(params, 'bookingId', query.bookingId);

    return this.http
      .get<GeneralResponseOf<PagedResult<QuotationListItem>>>(this.baseUrl, { params })
      .pipe(map(response => response.data ?? { items: [], total: 0, page: 1, pageSize }));
  }

  /** One quotation, with the internal notes and the moves that are legal from here. */
  get(quotationNumber: string): Observable<Quotation | null> {
    return this.http
      .get<GeneralResponseOf<Quotation>>(`${this.baseUrl}/${encodeURIComponent(quotationNumber)}`, {
        context: handlesNotFound()
      })
      .pipe(map(response => response.data ?? null), catchError(nullOnNotFound));
  }

  /**
   * Writes a quotation, lines and all.
   *
   * Whole, because the API takes it whole: the discount only means something
   * beside the lines it comes off, and a half-saved quotation is one whose
   * total disagrees with itself.
   *
   * Refusals are read on the page, not toasted. "That variant is gone" and
   * "the discount is larger than the goods" both belong beside the line that
   * caused them.
   */
  create(dto: SaveQuotation): Observable<GeneralResponseOf<Quotation>> {
    return this.http
      .post<GeneralResponseOf<Quotation>>(this.baseUrl, dto, { context: handledInline() })
      .pipe(catchError(envelopeFromError<Quotation>()));
  }

  update(id: number, dto: SaveQuotation): Observable<GeneralResponseOf<Quotation>> {
    return this.http
      .put<GeneralResponseOf<Quotation>>(`${this.baseUrl}/${id}`, dto, {
        context: handledInline()
      })
      .pipe(catchError(envelopeFromError<Quotation>()));
  }

  /** Send it, pull it back, or write it off. */
  setStatus(
    quotationNumber: string,
    dto: ChangeQuotationStatus
  ): Observable<GeneralResponseOf<Quotation>> {
    return this.http.put<GeneralResponseOf<Quotation>>(
      `${this.baseUrl}/${encodeURIComponent(quotationNumber)}/status`,
      dto
    );
  }

  /**
   * The ways this quotation may be paid for.
   *
   * Its own endpoint rather than the checkout's, which prices the methods
   * against the caller's own basket — and a member of staff converting a
   * quotation has no basket. What decides here is the quotation's total: a
   * three-lakh one may be over the cash-on-delivery ceiling, and that ceiling
   * is about the amount being ordered.
   */
  paymentMethods(quotationNumber: string): Observable<PaymentMethod[]> {
    return this.http
      .get<GeneralResponseOf<PaymentMethod[]>>(
        `${this.baseUrl}/${encodeURIComponent(quotationNumber)}/payment-methods`
      )
      .pipe(map(response => response.data ?? []));
  }

  /**
   * Turns an accepted quotation into an order.
   *
   * The one call Phase 4 exists for. It does not re-price: the customer agreed
   * to a figure and the order carries that figure, plus whatever the chosen
   * way of paying costs. Refused inline, because "this one has already become
   * an order" is an answer with an order number in it.
   */
  convert(
    quotationNumber: string,
    dto: ConvertQuotation
  ): Observable<GeneralResponseOf<PlacedOrder>> {
    return this.http
      .post<GeneralResponseOf<PlacedOrder>>(
        `${this.baseUrl}/${encodeURIComponent(quotationNumber)}/convert`,
        dto,
        { context: handledInline() }
      )
      .pipe(catchError(envelopeFromError<PlacedOrder>()));
  }
}

/** A 404 is an answer — "no quotation with that number" — not a failure. */
function nullOnNotFound(error: unknown): Observable<null> {
  return error instanceof HttpErrorResponse && error.status === 404
    ? of(null)
    : throwError(() => error);
}

/** Hands the API's own envelope back, so the screen can read `message`. */
function envelopeFromError<T>(): (error: unknown) => Observable<GeneralResponseOf<T>> {
  return error => {
    if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
      return of(error.error as GeneralResponseOf<T>);
    }

    return throwError(() => error);
  };
}
