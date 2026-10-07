import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GeneralResponseOf } from '../_models/generalResponse';
import { ContactDetails, ContactReceipt, SubmitContactMessage } from '../_models/contact';
import { handledInline, silentFailure } from '../_interceptors/http-context';

/** The contact page's half of the conversation. */
@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}contact`;

  /**
   * The shop's phone, email, address and hours.
   *
   * Fails quietly to an empty object. The page's other half is a form that
   * works regardless, and a red toast over a storefront because an address line
   * could not be fetched helps nobody.
   */
  details(): Observable<ContactDetails> {
    return this.http
      .get<GeneralResponseOf<ContactDetails>>(`${this.baseUrl}/details`, {
        context: silentFailure()
      })
      .pipe(
        map(response => response.data ?? {}),
        catchError(() => of({} as ContactDetails))
      );
  }

  /**
   * Sends a message.
   *
   * The envelope comes back on failure rather than being thrown away with the
   * status: "leave a number or an email" and "that mobile number is not valid"
   * belong against the fields that caused them, not in a toast.
   */
  send(message: SubmitContactMessage): Observable<GeneralResponseOf<ContactReceipt>> {
    return this.http
      .post<GeneralResponseOf<ContactReceipt>>(this.baseUrl, message, {
        context: handledInline()
      })
      .pipe(catchError(envelopeFromError));
  }
}

function envelopeFromError(error: unknown): Observable<GeneralResponseOf<ContactReceipt>> {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
    return of(error.error as GeneralResponseOf<ContactReceipt>);
  }

  return throwError(() => error);
}
