import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AdminConsultationService } from './admin-consultation.service';
import { environment } from '../../../environments/environment';

const base = `${environment.apiUrl}admin/consultations`;

describe('AdminConsultationService', () => {
  let service: AdminConsultationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AdminConsultationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('searchBookings', () => {
    it('sends nothing it was not given', () => {
      // The API answers an unfiltered query with today onwards. Sending a
      // date here anyway would put that rule in two places, and the second
      // copy is the one that goes wrong.
      service.searchBookings({}).subscribe();

      const request = http.expectOne(r => r.url === `${base}/bookings`);

      expect(request.request.params.has('from')).toBe(false);
      expect(request.request.params.has('to')).toBe(false);
      expect(request.request.params.has('status')).toBe(false);
      expect(request.request.params.get('page')).toBe('1');

      request.flush({ isSuccess: true, data: { items: [], total: 0, page: 1, pageSize: 20 } });
    });

    it('passes every filter the board offers', () => {
      service
        .searchBookings({
          term: 'ayesha',
          status: 'Requested',
          consultantId: 7,
          mode: 'SiteVisit',
          from: '2026-09-27',
          to: '2026-10-03',
          page: 2,
          pageSize: 50
        })
        .subscribe();

      const request = http.expectOne(r => r.url === `${base}/bookings`);
      const params = request.request.params;

      expect(params.get('term')).toBe('ayesha');
      expect(params.get('status')).toBe('Requested');
      expect(params.get('consultantId')).toBe('7');
      expect(params.get('mode')).toBe('SiteVisit');
      expect(params.get('from')).toBe('2026-09-27');
      expect(params.get('to')).toBe('2026-10-03');
      expect(params.get('page')).toBe('2');
      expect(params.get('pageSize')).toBe('50');

      request.flush({ isSuccess: true, data: { items: [], total: 0, page: 2, pageSize: 50 } });
    });

    it('treats a reply with no data as an empty board rather than a crash', () => {
      let total = -1;

      service.searchBookings({}).subscribe(result => (total = result.total));

      http.expectOne(r => r.url === `${base}/bookings`).flush({ isSuccess: true });

      expect(total).toBe(0);
    });
  });

  describe('moving a booking along', () => {
    it('puts a status change on its own endpoint', () => {
      service.setStatus('WHC-2609-00042', { status: 'Confirmed', note: 'Rang them.' }).subscribe();

      const request = http.expectOne(`${base}/bookings/WHC-2609-00042/status`);

      expect(request.request.method).toBe('PUT');
      expect(request.request.body.status).toBe('Confirmed');

      request.flush({ isSuccess: true });
    });

    it('keeps rescheduling separate from it', () => {
      // A different decision, checked against the schedule rather than the
      // status machine, and refusable for reasons a status change never meets.
      service
        .reschedule('WHC-2609-00042', { startUtc: '2026-09-27T10:00:00Z', consultantId: 7 })
        .subscribe();

      const request = http.expectOne(`${base}/bookings/WHC-2609-00042/reschedule`);

      expect(request.request.method).toBe('PUT');
      expect(request.request.body.startUtc).toBe('2026-09-27T10:00:00Z');
      expect(request.request.body.consultantId).toBe(7);

      request.flush({ isSuccess: true });
    });

    it('encodes a booking number into the path', () => {
      service.setStatus('WHC 2609/00042', { status: 'Cancelled' }).subscribe();

      http.expectOne(`${base}/bookings/WHC%202609%2F00042/status`).flush({ isSuccess: true });
    });
  });

  describe('the schedule', () => {
    it('replaces a week whole', () => {
      // All-or-nothing, as the API takes it. A partial save is how somebody
      // ends up bookable on a day nobody meant.
      service
        .saveSchedule(7, {
          rules: [
            { dayOfWeek: 'Sunday', startTime: '10:00:00', endTime: '17:00:00', slotMinutes: 30 }
          ],
          exceptions: [{ date: '2026-10-01', isClosed: true, note: 'Eid' }]
        })
        .subscribe();

      const request = http.expectOne(`${base}/consultants/7/schedule`);

      expect(request.request.method).toBe('PUT');
      expect(request.request.body.rules.length).toBe(1);
      expect(request.request.body.exceptions[0].isClosed).toBe(true);

      request.flush({ isSuccess: true });
    });

    it('reads a designer with their whole diary', () => {
      service.getConsultant(7).subscribe();

      http.expectOne(`${base}/consultants/7`).flush({ isSuccess: true, data: null });
    });
  });

  describe('services', () => {
    it('lists the inactive ones too, unlike the storefront', () => {
      let count = -1;

      service.getServices().subscribe(services => (count = services.length));

      http.expectOne(`${base}/services`).flush({
        isSuccess: true,
        data: [{ id: 1, isActive: true }, { id: 2, isActive: false }]
      });

      expect(count).toBe(2);
    });

    it('creates with a POST and updates with a PUT on the id', () => {
      const dto = {
        nameEn: 'Studio consultation',
        mode: 'InStudio' as const,
        durationMinutes: 60,
        fee: 2000,
        requiresAdvance: false,
        bufferBeforeMinutes: 15,
        bufferAfterMinutes: 15,
        isActive: true,
        sortOrder: 0
      };

      service.createService(dto).subscribe();
      expect(http.expectOne(`${base}/services`).request.method).toBe('POST');
      http.verify();

      service.updateService(3, dto).subscribe();
      expect(http.expectOne(`${base}/services/3`).request.method).toBe('PUT');
    });
  });
});
