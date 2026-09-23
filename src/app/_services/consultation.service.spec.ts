import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ConsultationApiService } from './consultation.service';
import { Availability, Booking, ConsultationService } from '../_models/consultations';
import { GeneralResponseOf } from '../_models/generalResponse';
import { environment } from '../../environments/environment';
import { HANDLES_NOT_FOUND } from '../_interceptors/http-context';

const base = `${environment.apiUrl}consultations`;

describe('ConsultationApiService', () => {
  let service: ConsultationApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(ConsultationApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getService', () => {
    it('answers null for a slug the shop does not offer, rather than failing', () => {
      // The wizard's whole job on that URL is to say "we do not offer that",
      // on the address the customer actually opened. A thrown 404 would send
      // them to a page that has lost the slug.
      let result: ConsultationService | null | undefined;

      service.getService('studio-consultation').subscribe(value => (result = value));

      http
        .expectOne(`${base}/services/studio-consultation`)
        .flush({ isSuccess: false }, { status: 404, statusText: 'Not Found' });

      expect(result).toBe(null);
    });

    it('does not let the interceptor navigate away from it', () => {
      service.getService('studio-consultation').subscribe();

      const request = http.expectOne(`${base}/services/studio-consultation`);

      expect(request.request.context.get(HANDLES_NOT_FOUND)).toBe(true);

      request.flush({ isSuccess: true, data: null });
    });
  });

  describe('getAvailability', () => {
    it('asks in Dhaka dates and leaves the consultant out when anybody will do', () => {
      let days = -1;

      service
        .getAvailability(3, '2026-09-27', '2026-10-10', null)
        .subscribe((value: Availability) => (days = value.days.length));

      const request = http.expectOne(r => r.url === `${base}/availability`);

      expect(request.request.params.get('serviceId')).toBe('3');
      expect(request.request.params.get('from')).toBe('2026-09-27');
      expect(request.request.params.get('to')).toBe('2026-10-10');

      // Absent, not empty. An empty consultantId would be read as an id.
      expect(request.request.params.has('consultantId')).toBe(false);

      request.flush({ isSuccess: true, data: { serviceId: 3, durationMinutes: 60, days: [] } });

      expect(days).toBe(0);
    });

    it('names the consultant when the customer asked for one', () => {
      service.getAvailability(3, '2026-09-27', '2026-10-10', 7).subscribe();

      const request = http.expectOne(r => r.url === `${base}/availability`);

      expect(request.request.params.get('consultantId')).toBe('7');

      request.flush({ isSuccess: true, data: { serviceId: 3, durationMinutes: 60, days: [] } });
    });

    it('treats a reply with no data as an empty calendar rather than a crash', () => {
      let days = -1;

      service.getAvailability(3, '2026-09-27', '2026-10-10').subscribe(value => (days = value.days.length));

      http.expectOne(r => r.url === `${base}/availability`).flush({ isSuccess: true });

      expect(days).toBe(0);
    });
  });

  describe('book', () => {
    it('sends the idempotency key, so a double tap is one booking', () => {
      service.book(bookingRequest(), 'key-1').subscribe();

      const request = http.expectOne(`${base}/bookings`);

      expect(request.request.method).toBe('POST');
      expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');

      request.flush({ isSuccess: true, data: booking() });
    });

    it('hands a refusal back as the envelope, not as an error', () => {
      // "That time has just gone" belongs beside the calendar, with the
      // calendar redrawn. Thrown away with the status, the page could only say
      // "something went wrong" about a slot somebody else had just taken.
      let response: GeneralResponseOf<Booking> | undefined;

      service.book(bookingRequest(), 'key-1').subscribe(value => (response = value));

      http.expectOne(`${base}/bookings`).flush(
        {
          isSuccess: false,
          errorCode: 'consultations.slot_taken.conflict',
          message: 'Somebody booked that time while you were filling in the form.'
        },
        { status: 409, statusText: 'Conflict' }
      );

      expect(response?.isSuccess).toBe(false);
      expect(response?.errorCode).toBe('consultations.slot_taken.conflict');
      expect(response?.message).toContain('Somebody booked that time');
    });
  });

  describe('get', () => {
    it('lets a guest quote the phone the booking was made with', () => {
      service.get('WHC-2609-00042', '01712345678').subscribe();

      const request = http.expectOne(r => r.url === `${base}/bookings/WHC-2609-00042`);

      expect(request.request.params.get('phone')).toBe('01712345678');

      request.flush({ isSuccess: true, data: booking() });
    });

    it('asks for nothing else when the customer is signed in', () => {
      service.get('WHC-2609-00042').subscribe();

      const request = http.expectOne(r => r.url === `${base}/bookings/WHC-2609-00042`);

      expect(request.request.params.has('phone')).toBe(false);

      request.flush({ isSuccess: true, data: booking() });
    });

    it('answers null for a wrong pair, the same as for a number that does not exist', () => {
      // Which is the point: the endpoint is not a way to discover which
      // booking numbers are real.
      let result: Booking | null | undefined;

      service.get('WHC-2609-00042', '01700000000').subscribe(value => (result = value));

      http
        .expectOne(r => r.url === `${base}/bookings/WHC-2609-00042`)
        .flush({ isSuccess: false }, { status: 404, statusText: 'Not Found' });

      expect(result).toBe(null);
    });

    it('encodes the number into the path', () => {
      service.get('WHC 2609/00042', null).subscribe();

      http.expectOne(r => r.url === `${base}/bookings/WHC%202609%2F00042`).flush({ isSuccess: true });
    });
  });

  describe('cancel', () => {
    it('puts the phone in the body rather than the URL', () => {
      // A URL ends up in browser history, in a proxy log and in a referrer
      // header, and the phone number is the other half of the credential.
      service.cancel('WHC-2609-00042', { phone: '01712345678', reason: 'Away' }).subscribe();

      const request = http.expectOne(`${base}/bookings/WHC-2609-00042/cancel`);

      expect(request.request.method).toBe('POST');
      expect(request.request.body.phone).toBe('01712345678');
      expect(request.request.urlWithParams).not.toContain('01712345678');

      request.flush({ isSuccess: true, data: booking('Cancelled') });
    });

    it('hands back the refusal when it is too late to cancel', () => {
      let response: GeneralResponseOf<Booking> | undefined;

      service.cancel('WHC-2609-00042', {}).subscribe(value => (response = value));

      http.expectOne(`${base}/bookings/WHC-2609-00042/cancel`).flush(
        {
          isSuccess: false,
          errorCode: 'consultations.booking.not_cancellable.conflict',
          message: 'That booking can no longer be cancelled here. Please telephone us.'
        },
        { status: 409, statusText: 'Conflict' }
      );

      expect(response?.errorCode).toBe('consultations.booking.not_cancellable.conflict');
    });
  });

  describe('getMine', () => {
    it('reads the page out of the body, not the X-Pagination header', () => {
      let total = -1;

      service.getMine(2, 10).subscribe(result => (total = result.total));

      const request = http.expectOne(r => r.url === `${base}/my-bookings`);

      expect(request.request.params.get('page')).toBe('2');

      request.flush({
        isSuccess: true,
        data: { items: [booking()], total: 14, page: 2, pageSize: 10 }
      });

      expect(total).toBe(14);
    });
  });
});

function bookingRequest() {
  return {
    serviceId: 3,
    consultantId: 7,
    startUtc: '2026-09-27T04:00:00Z',
    contactName: 'Rakib Hasan',
    contactPhone: '01712345678',
    roomTypes: ['Bedroom']
  };
}

function booking(status: Booking['status'] = 'Requested'): Booking {
  return {
    id: 1,
    bookingNumber: 'WHC-2609-00042',
    serviceName: 'Studio consultation',
    mode: 'InStudio',
    consultantName: 'Rakib Hasan',
    scheduledAtUtc: '2026-09-27T04:00:00Z',
    durationMinutes: 60,
    status,
    contactName: 'Rakib Hasan',
    contactPhone: '+88017*****678',
    roomTypes: [],
    fee: 2000,
    timeline: [],
    canCancel: status === 'Requested'
  };
}
