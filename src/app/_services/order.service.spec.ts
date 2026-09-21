import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { OrderService } from './order.service';
import { OrderDetail, OrderSummary } from '../_models/order';
import { environment } from '../../environments/environment';

const base = `${environment.apiUrl}orders`;

describe('OrderService', () => {
  let service: OrderService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(OrderService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getMine', () => {
    it('pages in the query string and reads the page out of the body', () => {
      // The catalogue pages with an X-Pagination header; the order endpoints
      // page in the body. Reading the wrong one type-checks and shows an
      // empty history to a customer with forty orders.
      let items: OrderSummary[] = [];
      let total = 0;

      service.getMine(3, 10).subscribe(result => {
        items = result.items;
        total = result.total;
      });

      const request = http.expectOne(r => r.url === base);

      expect(request.request.method).toBe('GET');
      expect(request.request.params.get('page')).toBe('3');
      expect(request.request.params.get('pageSize')).toBe('10');

      request.flush({
        isSuccess: true,
        data: { items: [{ id: 7, orderNumber: 'WH-2609-00042' }], total: 41, page: 3, pageSize: 10 }
      });

      expect(items.length).toBe(1);
      expect(total).toBe(41);
    });

    it('treats a reply with no data as an empty page rather than a crash', () => {
      let total = -1;

      service.getMine().subscribe(result => (total = result.total));

      http.expectOne(r => r.url === base).flush({ isSuccess: true, data: null });

      expect(total).toBe(0);
    });
  });

  describe('cancel', () => {
    it('posts the reason and hands back the order as it now stands', () => {
      let cancelled: OrderDetail | undefined;

      service.cancel('WH-2609-00042', { reason: 'Wrong size' }).subscribe(o => (cancelled = o));

      const request = http.expectOne(`${base}/WH-2609-00042/cancel`);

      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ reason: 'Wrong size' });

      request.flush({ isSuccess: true, data: { orderNumber: 'WH-2609-00042', status: 'Cancelled' } });

      expect(cancelled?.status).toBe('Cancelled');
    });

    it('encodes the order number in the path', () => {
      service.cancel('WH/odd', { reason: null }).subscribe({ error: () => undefined });

      http.expectOne(`${base}/WH%2Fodd/cancel`).flush({ isSuccess: true, data: {} });
    });
  });

  describe('lookup', () => {
    it('answers null for a not-found rather than letting the interceptor redirect', () => {
      let found: OrderDetail | null | undefined;

      service.lookup({ orderNumber: 'WH-0000-00000', contactPhone: '01700000000' }).subscribe(o => (found = o));

      const request = http.expectOne(`${base}/lookup`);

      expect(request.request.method).toBe('POST');

      // The lookup answers 200 with no data for a miss as well as 404; both
      // must come back as null so the page can say "not found" beside the form.
      request.flush({ isSuccess: true, data: null });

      expect(found).toBeNull();
    });

    it('turns a 404 into null, because "no such order" is an answer', () => {
      // handlesNotFound() only stops the interceptor navigating away; the
      // error still arrives. Left as an error, the tracking page showed
      // nothing at all for a wrong phone number.
      let found: OrderDetail | null | undefined = undefined;
      let failed = false;

      service.lookup({ orderNumber: 'WH-0000-00000', contactPhone: '01700000000' }).subscribe({
        next: o => (found = o),
        error: () => (failed = true)
      });

      http
        .expectOne(`${base}/lookup`)
        .flush({ isSuccess: false, errorCode: 'ordering.order.not_found' }, { status: 404, statusText: 'Not Found' });

      expect(failed).toBe(false);
      expect(found).toBeNull();
    });

    it('still fails on anything that is not a 404', () => {
      let failed = false;

      service.getMineByNumber('WH-0000-00000').subscribe({ error: () => (failed = true) });

      http
        .expectOne(`${base}/WH-0000-00000`)
        .flush({ isSuccess: false }, { status: 500, statusText: 'Boom' });

      expect(failed).toBe(true);
    });
  });
});
