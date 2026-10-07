import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GeneralResponseOf } from '../../_models/generalResponse';
import {
  ContactMessage,
  ContactMessageListItem,
  ContactMessageQuery,
  UpdateContactMessage
} from '../../_models/contact';
import { PagedResult } from '../../_models/pagination';
import { appendIfPresent } from '../paginationHelper';
import { handledInline, handlesNotFound, silentFailure } from '../../_interceptors/http-context';

/**
 * The shop's inbox.
 *
 * All staff, reading and answering alike — whoever picks up the telephone is
 * the person who should be able to see what was written and mark it dealt with.
 */
@Injectable({ providedIn: 'root' })
export class AdminContactService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}admin/contact-messages`;

  /**
   * How many nobody has opened, for the badge in the menu.
   *
   * <b>Held here rather than in the sidebar.</b> The count changes when a
   * message is opened on another screen, and a sidebar that fetched its own
   * copy would keep showing the old number until the next full page load.
   */
  readonly newCount = signal(0);

  search(query: ContactMessageQuery): Observable<PagedResult<ContactMessageListItem>> {
    const pageSize = query.pageSize ?? 20;

    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(pageSize));

    params = appendIfPresent(params, 'status', query.status);
    params = appendIfPresent(params, 'topic', query.topic);
    params = appendIfPresent(params, 'term', query.term);

    return this.http
      .get<GeneralResponseOf<PagedResult<ContactMessageListItem>>>(this.baseUrl, { params })
      .pipe(map(response => response.data ?? { items: [], total: 0, page: 1, pageSize }));
  }

  /**
   * One message.
   *
   * <b>Fetching it is what marks it read</b>, server-side — so the badge is
   * refreshed straight afterwards rather than left one ahead of the truth.
   */
  get(id: number): Observable<ContactMessage | null> {
    return this.http
      .get<GeneralResponseOf<ContactMessage>>(`${this.baseUrl}/${id}`, {
        context: handlesNotFound()
      })
      .pipe(
        map(response => response.data ?? null),
        tap(() => this.refreshCount()),
        catchError(nullOnNotFound)
      );
  }

  update(id: number, dto: UpdateContactMessage): Observable<GeneralResponseOf<ContactMessage>> {
    return this.http
      .put<GeneralResponseOf<ContactMessage>>(`${this.baseUrl}/${id}`, dto, {
        context: handledInline()
      })
      .pipe(tap(() => this.refreshCount()), catchError(envelopeFromError));
  }

  /** Quietly: a badge that could not be fetched is not worth a red toast. */
  refreshCount(): void {
    this.http
      .get<GeneralResponseOf<number>>(`${this.baseUrl}/new-count`, { context: silentFailure() })
      .pipe(catchError(() => of({ data: 0 } as GeneralResponseOf<number>)))
      .subscribe(response => this.newCount.set(response.data ?? 0));
  }
}

/** A 404 is an answer — "that message is not in the inbox" — not a failure. */
function nullOnNotFound(error: unknown): Observable<null> {
  return error instanceof HttpErrorResponse && error.status === 404
    ? of(null)
    : throwError(() => error);
}

function envelopeFromError(error: unknown): Observable<GeneralResponseOf<ContactMessage>> {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
    return of(error.error as GeneralResponseOf<ContactMessage>);
  }

  return throwError(() => error);
}
