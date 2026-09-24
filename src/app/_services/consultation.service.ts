import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GeneralResponseOf } from '../_models/generalResponse';
import {
  Availability,
  Booking,
  CancelBooking,
  Consultant,
  ConsultationService as ConsultationServiceDto,
  CreateBooking
} from '../_models/consultations';
import { PagedResult } from '../_models/pagination';
import { handledInline, handlesNotFound } from '../_interceptors/http-context';

/**
 * Consultations: what is offered, when it can happen, and booking one.
 *
 * <b>All of it is open to a guest, and that is the point.</b> Somebody who
 * wants a designer to look at their flat should not have to make an account
 * first, so the calendar, the booking and finding it again afterwards all work
 * without one. A guest presents the booking number and the phone it was booked
 * with — the same two facts a guest order is tracked by, and the reason a
 * guessed booking number on its own discloses nothing.
 */
@Injectable({ providedIn: 'root' })
export class ConsultationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}consultations`;

  /**
   * Everything the shop sells an hour of.
   *
   * `handledInline()` because the shop being closed to consultations is not an
   * error: the page says so itself, in place and in the shop's own words, and a
   * red toast on top of that tells the same customer the same thing twice — the
   * second time as though something had broken.
   */
  getServices(): Observable<ConsultationServiceDto[]> {
    return this.http
      .get<GeneralResponseOf<ConsultationServiceDto[]>>(
        `${this.baseUrl}/services`,
        { context: handledInline() })
      .pipe(map(response => response.data ?? []));
  }

  /**
   * One service, by slug.
   *
   * Handles its own 404: the wizard's whole job is to say "we do not offer
   * that", on the URL the customer actually opened, rather than being
   * redirected somewhere that has lost the slug.
   */
  getService(slug: string): Observable<ConsultationServiceDto | null> {
    return this.http
      .get<GeneralResponseOf<ConsultationServiceDto>>(
        `${this.baseUrl}/services/${encodeURIComponent(slug)}`,
        { context: handlesNotFound() }
      )
      .pipe(map(response => response.data ?? null), catchError(nullOnNotFound));
  }

  getConsultants(serviceId?: number): Observable<Consultant[]> {
    const params = serviceId ? new HttpParams().set('serviceId', serviceId) : undefined;

    return this.http
      .get<GeneralResponseOf<Consultant[]>>(`${this.baseUrl}/consultants`, { params })
      .pipe(map(response => response.data ?? []));
  }

  /**
   * The times a customer can actually pick.
   *
   * `from` and `to` are Dhaka dates, and what comes back are UTC instants
   * grouped under the day the shop shows them on. Sending local dates and
   * rendering instants is the only combination that survives a customer
   * opening the page from another time zone.
   */
  getAvailability(
    serviceId: number,
    from: string,
    to: string,
    consultantId?: number | null
  ): Observable<Availability> {
    let params = new HttpParams().set('serviceId', serviceId).set('from', from).set('to', to);

    if (consultantId) {
      params = params.set('consultantId', consultantId);
    }

    return this.http
      .get<GeneralResponseOf<Availability>>(`${this.baseUrl}/availability`, { params })
      .pipe(map(response => response.data ?? { serviceId, durationMinutes: 0, days: [] }));
  }

  /**
   * Books a slot.
   *
   * <b>The whole envelope comes back, not just the booking.</b> "That time has
   * just gone" is an answer the wizard has to put beside the calendar and then
   * reload it — not a toast, and not a redirect. `handledInline()` keeps the
   * interceptor out of the way; the caller reads `errorCode`.
   *
   * The idempotency key is this browser's guard against a double tap on a slow
   * connection: the second press finds the first booking instead of blocking a
   * second afternoon.
   */
  book(dto: CreateBooking, idempotencyKey: string): Observable<GeneralResponseOf<Booking>> {
    return this.http
      .post<GeneralResponseOf<Booking>>(`${this.baseUrl}/bookings`, dto, {
        headers: { 'Idempotency-Key': idempotencyKey },
        context: handledInline()
      })
      .pipe(catchError(envelopeFromError));
  }

  /**
   * One booking. A signed-in customer needs nothing else; a guest passes the
   * phone it was booked with.
   */
  get(bookingNumber: string, phone?: string | null): Observable<Booking | null> {
    const params = phone ? new HttpParams().set('phone', phone) : undefined;

    return this.http
      .get<GeneralResponseOf<Booking>>(
        `${this.baseUrl}/bookings/${encodeURIComponent(bookingNumber)}`,
        { params, context: handlesNotFound() }
      )
      .pipe(map(response => response.data ?? null), catchError(nullOnNotFound));
  }

  /**
   * The customer calling it off themselves.
   *
   * The phone goes in the body rather than the query string for the same
   * reason a guest order lookup does: a URL ends up in browser history, in a
   * proxy log and in a referrer header, and the phone number is the other half
   * of the credential.
   */
  cancel(bookingNumber: string, dto: CancelBooking): Observable<GeneralResponseOf<Booking>> {
    return this.http
      .post<GeneralResponseOf<Booking>>(
        `${this.baseUrl}/bookings/${encodeURIComponent(bookingNumber)}/cancel`,
        dto,
        { context: handledInline() }
      )
      .pipe(catchError(envelopeFromError));
  }

  /** A signed-in customer's own bookings, soonest first. */
  getMine(page = 1, pageSize = 10): Observable<PagedResult<Booking>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);

    return this.http
      .get<GeneralResponseOf<PagedResult<Booking>>>(`${this.baseUrl}/my-bookings`, { params })
      .pipe(map(response => response.data ?? { items: [], total: 0, page, pageSize }));
  }
}

/**
 * A 404 is an answer here — "no such booking for you" — not a failure.
 *
 * `handlesNotFound()` only stops the interceptor navigating away; the error
 * still arrives, and a page that treats it as one shows nothing where "we
 * could not find that booking" belongs.
 */
function nullOnNotFound(error: unknown): Observable<null> {
  return error instanceof HttpErrorResponse && error.status === 404
    ? of(null)
    : throwError(() => error);
}

/**
 * Turns a refusal back into the envelope the API sent with it.
 *
 * Every refusal here is part of the screen: the slot has gone, the address is
 * missing, the booking can no longer be cancelled. The API says which in
 * `errorCode`, and that is worth more to the customer than a red toast — so
 * the body is handed back rather than thrown away with the status.
 */
function envelopeFromError(error: unknown): Observable<GeneralResponseOf<Booking>> {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
    return of(error.error as GeneralResponseOf<Booking>);
  }

  return throwError(() => error);
}
