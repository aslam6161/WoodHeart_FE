import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GeneralResponseOf } from '../../_models/generalResponse';
import {
  NotificationMessage,
  NotificationMessageQuery,
  NotificationTemplateDetail,
  NotificationTemplates,
  UpdateNotificationTemplate
} from '../../_models/notifications';
import { PagedResult } from '../../_models/pagination';
import { appendIfPresent } from '../paginationHelper';
import { handledInline, handlesNotFound } from '../../_interceptors/http-context';

/**
 * What the shop says, and what became of each message.
 *
 * Reading and resending are for every staff role: whoever answers the
 * telephone is the person asked "I never got a text about my order", and a
 * screen they cannot open is a question they cannot answer. Turning a template
 * off is Admin, because it is a decision about what the shop pays a gateway.
 * The API enforces both; the screens hide what a packer would only be given a
 * 403 for.
 *
 * <b>There is no create and no delete.</b> A template's code is the join to
 * the method that renders it, so a row invented from a screen would read as
 * configured and send nothing. The message log is a record of what the shop
 * did and did not say, and a log an admin can edit is not one.
 */
@Injectable({ providedIn: 'root' })
export class AdminNotificationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}admin/notifications`;

  /** Every kind of message, with what each costs to send. */
  getTemplates(): Observable<NotificationTemplates> {
    return this.http
      .get<GeneralResponseOf<NotificationTemplates>>(`${this.baseUrl}/templates`)
      .pipe(
        map(
          response =>
            response.data ?? {
              templates: [],
              smsGatewayConfigured: false,
              emailConfigured: false,
              shopPhoneConfigured: false
            }
        )
      );
  }

  /** One template, rendered from a sample in every language it has a form in. */
  getTemplate(code: string): Observable<NotificationTemplateDetail | null> {
    return this.http
      .get<GeneralResponseOf<NotificationTemplateDetail>>(
        `${this.baseUrl}/templates/${encodeURIComponent(code)}`,
        { context: handlesNotFound() }
      )
      .pipe(
        map(response => response.data ?? null),
        catchError(nullOnNotFound)
      );
  }

  /**
   * Turns one template's channels on or off.
   *
   * Handled inline rather than toasted: there is one thing that can go wrong
   * — a code nothing renders — and it belongs beside the switch that was just
   * pressed.
   */
  updateTemplate(
    code: string,
    dto: UpdateNotificationTemplate
  ): Observable<GeneralResponseOf<NotificationTemplateDetail>> {
    return this.http
      .put<GeneralResponseOf<NotificationTemplateDetail>>(
        `${this.baseUrl}/templates/${encodeURIComponent(code)}`,
        dto,
        { context: handledInline() }
      )
      .pipe(catchError(envelopeFromError<NotificationTemplateDetail>()));
  }

  /** The outbox, newest first. */
  searchMessages(
    query: NotificationMessageQuery
  ): Observable<PagedResult<NotificationMessage>> {
    const pageSize = query.pageSize ?? 20;

    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(pageSize));

    params = appendIfPresent(params, 'term', query.term);
    params = appendIfPresent(params, 'status', query.status);
    params = appendIfPresent(params, 'type', query.type);

    return this.http
      .get<GeneralResponseOf<PagedResult<NotificationMessage>>>(`${this.baseUrl}/messages`, {
        params
      })
      .pipe(map(response => response.data ?? { items: [], total: 0, page: 1, pageSize }));
  }

  /**
   * Puts one message back in the queue.
   *
   * Refused inline for one already queued or one a worker is holding, and both
   * refusals are about the row somebody just pressed — a toast floating over a
   * table of forty would not say which.
   */
  resend(id: number): Observable<GeneralResponseOf<NotificationMessage>> {
    return this.http
      .post<GeneralResponseOf<NotificationMessage>>(
        `${this.baseUrl}/messages/${id}/resend`,
        {},
        { context: handledInline() }
      )
      .pipe(catchError(envelopeFromError<NotificationMessage>()));
  }
}

/** A 404 is an answer — "nothing sends a message of that kind" — not a failure. */
function nullOnNotFound(error: unknown): Observable<null> {
  return error instanceof HttpErrorResponse && error.status === 404
    ? of(null)
    : throwError(() => error);
}

/** Hands the API's own envelope back, so the screen can read `message`. */
function envelopeFromError<T>() {
  return (error: unknown): Observable<GeneralResponseOf<T>> => {
    if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
      return of(error.error as GeneralResponseOf<T>);
    }

    return throwError(() => error);
  };
}
