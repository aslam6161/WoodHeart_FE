import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GeneralResponseOf } from '../../_models/generalResponse';
import {
  BookingListItem,
  BookingQuery,
  ChangeBookingStatus,
  ConsultantSchedule,
  RescheduleBooking,
  SaveConsultant,
  SaveConsultationService,
  SaveSchedule
} from '../../_models/admin-consultations';
import { Booking, Consultant, ConsultationService } from '../../_models/consultations';
import { PagedResult } from '../../_models/pagination';
import { appendIfPresent } from '../paginationHelper';

/**
 * The shop's side of consultations.
 *
 * Reading is for every staff role — whoever answers the telephone is the
 * person who needs to say when the next site visit is free. Writing the
 * schedule is admin or manager: a consultant's week is what the booking page
 * offers, and a rule typed wrong is either a day nobody can book or a day
 * somebody is expected to work and does not know it. The API enforces that;
 * the screens hide the controls so a packer is not shown a button that
 * answers 403.
 */
@Injectable({ providedIn: 'root' })
export class AdminConsultationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}admin/consultations`;

  // --- The diary --------------------------------------------------------------

  /**
   * The board.
   *
   * Sending no dates is not the same as sending today's: the API answers an
   * unfiltered query with today onwards, and a term with the whole history.
   * That decision lives there, so leaving the fields empty is deliberate
   * rather than lazy.
   */
  searchBookings(query: BookingQuery): Observable<PagedResult<BookingListItem>> {
    const pageSize = query.pageSize ?? 20;

    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(pageSize));

    params = appendIfPresent(params, 'term', query.term);
    params = appendIfPresent(params, 'status', query.status);
    params = appendIfPresent(params, 'consultantId', query.consultantId);
    params = appendIfPresent(params, 'mode', query.mode);
    params = appendIfPresent(params, 'from', query.from);
    params = appendIfPresent(params, 'to', query.to);

    return this.http
      .get<GeneralResponseOf<PagedResult<BookingListItem>>>(`${this.baseUrl}/bookings`, { params })
      .pipe(map(response => response.data ?? { items: [], total: 0, page: 1, pageSize }));
  }

  /** One booking, with the phone unmasked and the moves that are legal from here. */
  getBooking(bookingNumber: string): Observable<Booking | null> {
    return this.http
      .get<GeneralResponseOf<Booking>>(
        `${this.baseUrl}/bookings/${encodeURIComponent(bookingNumber)}`
      )
      .pipe(map(response => response.data ?? null));
  }

  setStatus(
    bookingNumber: string,
    dto: ChangeBookingStatus
  ): Observable<GeneralResponseOf<Booking>> {
    return this.http.put<GeneralResponseOf<Booking>>(
      `${this.baseUrl}/bookings/${encodeURIComponent(bookingNumber)}/status`,
      dto
    );
  }

  /**
   * Moves a booking to another time.
   *
   * Its own call rather than a status change carrying a date, and it can be
   * refused for reasons that have nothing to do with the status: the time is
   * checked against the same schedule the customer's calendar is drawn from,
   * and it can still lose to a customer booking that slot a moment earlier.
   */
  reschedule(
    bookingNumber: string,
    dto: RescheduleBooking
  ): Observable<GeneralResponseOf<Booking>> {
    return this.http.put<GeneralResponseOf<Booking>>(
      `${this.baseUrl}/bookings/${encodeURIComponent(bookingNumber)}/reschedule`,
      dto
    );
  }

  // --- What the shop offers -----------------------------------------------------

  /** Every service, active or not — unlike the storefront's list. */
  getServices(): Observable<ConsultationService[]> {
    return this.http
      .get<GeneralResponseOf<ConsultationService[]>>(`${this.baseUrl}/services`)
      .pipe(map(response => response.data ?? []));
  }

  createService(dto: SaveConsultationService): Observable<GeneralResponseOf<ConsultationService>> {
    return this.http.post<GeneralResponseOf<ConsultationService>>(`${this.baseUrl}/services`, dto);
  }

  updateService(
    id: number,
    dto: SaveConsultationService
  ): Observable<GeneralResponseOf<ConsultationService>> {
    return this.http.put<GeneralResponseOf<ConsultationService>>(
      `${this.baseUrl}/services/${id}`,
      dto
    );
  }

  // --- Who does it ----------------------------------------------------------------

  getConsultants(): Observable<Consultant[]> {
    return this.http
      .get<GeneralResponseOf<Consultant[]>>(`${this.baseUrl}/consultants`)
      .pipe(map(response => response.data ?? []));
  }

  getConsultant(id: number): Observable<ConsultantSchedule | null> {
    return this.http
      .get<GeneralResponseOf<ConsultantSchedule>>(`${this.baseUrl}/consultants/${id}`)
      .pipe(map(response => response.data ?? null));
  }

  createConsultant(dto: SaveConsultant): Observable<GeneralResponseOf<ConsultantSchedule>> {
    return this.http.post<GeneralResponseOf<ConsultantSchedule>>(
      `${this.baseUrl}/consultants`,
      dto
    );
  }

  updateConsultant(
    id: number,
    dto: SaveConsultant
  ): Observable<GeneralResponseOf<ConsultantSchedule>> {
    return this.http.put<GeneralResponseOf<ConsultantSchedule>>(
      `${this.baseUrl}/consultants/${id}`,
      dto
    );
  }

  /**
   * Replaces a consultant's week and their exceptions in one go.
   *
   * All-or-nothing, and the API takes it that way. Sending only the changed
   * rows would mean a half-saved week — somebody bookable on a day nobody
   * meant.
   */
  saveSchedule(id: number, dto: SaveSchedule): Observable<GeneralResponseOf<ConsultantSchedule>> {
    return this.http.put<GeneralResponseOf<ConsultantSchedule>>(
      `${this.baseUrl}/consultants/${id}/schedule`,
      dto
    );
  }
}
