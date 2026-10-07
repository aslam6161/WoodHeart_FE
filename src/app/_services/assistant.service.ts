import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { GeneralResponseOf } from '../_models/generalResponse';
import { ShopChatReply, ShopChatTurn } from '../_models/assistant';
import { handledInline, quiet, silentFailure } from '../_interceptors/http-context';

/**
 * The chat window's half of the conversation.
 *
 * <b>The conversation lives in the browser.</b> Each question travels with the
 * last few turns, and nothing is stored on the server — a chat about a wardrobe
 * is not worth a session, and what is not stored cannot be handed to the next
 * person using that phone.
 */
@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}consultations/assistant`;

  /**
   * Whether to show the window at all.
   *
   * Asked once before anything is rendered. A shop with no model configured, or
   * one that has switched the assistant off, shows a storefront with no chat
   * button rather than one that fails when somebody finally presses it.
   */
  offered(): Observable<boolean> {
    return this.http
      .get<GeneralResponseOf<boolean>>(`${this.baseUrl}/offered`, {
        context: quiet(silentFailure())
      })
      .pipe(
        map(response => response.data ?? false),
        catchError(() => of(false))
      );
  }

  /**
   * Asks, carrying the tail of the conversation.
   *
   * The envelope comes back on failure rather than being thrown away with the
   * status: "the assistant is busy" and "the assistant is switched off" are
   * different sentences, and the API says which in `errorCode`.
   */
  chat(message: string, history: ShopChatTurn[]): Observable<GeneralResponseOf<ShopChatReply>> {
    return this.http
      .post<GeneralResponseOf<ShopChatReply>>(
        `${this.baseUrl}/chat`,
        { message, history },
        { context: quiet(handledInline()) }
      )
      .pipe(catchError(envelopeFromError));
  }
}

function envelopeFromError(error: unknown): Observable<GeneralResponseOf<ShopChatReply>> {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
    return of(error.error as GeneralResponseOf<ShopChatReply>);
  }

  return throwError(() => error);
}
