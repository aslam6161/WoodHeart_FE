import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GeneralResponseOf } from '../_models/generalResponse';
import { AnswerQuotation, Quotation } from '../_models/quotations';
import { PagedResult } from '../_models/pagination';
import { handledInline, handlesNotFound } from '../_interceptors/http-context';

/**
 * The customer's side of a quotation: read it, take it, or turn it down.
 *
 * <b>Open to a guest, like the consultation it came out of.</b> Most people
 * quoted for a flat have no account, and asking them to make one before they
 * can say yes to a price is how a sale is lost. A guest presents the quotation
 * number and the phone it was written for — the same two facts a guest order
 * is tracked by, and the reason a guessed number on its own discloses nothing.
 *
 * <b>Answering hands the whole envelope back.</b> "This one has run out of
 * date" is not a red toast; it is the answer, and it belongs beside the figures
 * the customer was reading. `handledInline()` keeps the interceptor out of the
 * way and the page reads `message` for itself.
 */
@Injectable({ providedIn: 'root' })
export class QuotationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}quotations`;

  /**
   * One quotation. A signed-in customer needs nothing else; a guest passes the
   * phone it was written for.
   *
   * The phone is a query parameter here only because reading is a GET and a
   * GET has no body. Answering, below, puts it where it belongs.
   */
  get(quotationNumber: string, phone?: string | null): Observable<Quotation | null> {
    const params = phone ? new HttpParams().set('phone', phone) : undefined;

    return this.http
      .get<GeneralResponseOf<Quotation>>(
        `${this.baseUrl}/${encodeURIComponent(quotationNumber)}`,
        { params, context: handlesNotFound() }
      )
      .pipe(map(response => response.data ?? null), catchError(nullOnNotFound));
  }

  /** The customer saying yes. The shop turns it into an order afterwards. */
  accept(quotationNumber: string, dto: AnswerQuotation): Observable<GeneralResponseOf<Quotation>> {
    return this.http
      .post<GeneralResponseOf<Quotation>>(
        `${this.baseUrl}/${encodeURIComponent(quotationNumber)}/accept`,
        dto,
        { context: handledInline() }
      )
      .pipe(catchError(envelopeFromError));
  }

  /** The customer saying no, and ideally why. */
  decline(quotationNumber: string, dto: AnswerQuotation): Observable<GeneralResponseOf<Quotation>> {
    return this.http
      .post<GeneralResponseOf<Quotation>>(
        `${this.baseUrl}/${encodeURIComponent(quotationNumber)}/decline`,
        dto,
        { context: handledInline() }
      )
      .pipe(catchError(envelopeFromError));
  }

  /** A signed-in customer's own quotations, newest first. */
  getMine(page = 1, pageSize = 10): Observable<PagedResult<Quotation>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);

    return this.http
      .get<GeneralResponseOf<PagedResult<Quotation>>>(`${this.baseUrl}/my-quotations`, { params })
      .pipe(map(response => response.data ?? { items: [], total: 0, page, pageSize }));
  }
}

/**
 * A 404 is an answer here — "no such quotation for you" — not a failure.
 *
 * `handlesNotFound()` only stops the interceptor navigating away; the error
 * still arrives, and a page that treats it as one shows nothing where "we
 * could not find that quotation" belongs.
 */
function nullOnNotFound(error: unknown): Observable<null> {
  return error instanceof HttpErrorResponse && error.status === 404
    ? of(null)
    : throwError(() => error);
}

/**
 * Turns a refusal back into the envelope the API sent with it.
 *
 * Every refusal here is part of the screen: the date has passed, it has
 * already been answered, the number and the phone do not go together. The API
 * says which, and that is worth more to the customer than a red toast — so the
 * body is handed back rather than thrown away with the status.
 */
function envelopeFromError(error: unknown): Observable<GeneralResponseOf<Quotation>> {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
    return of(error.error as GeneralResponseOf<Quotation>);
  }

  return throwError(() => error);
}
