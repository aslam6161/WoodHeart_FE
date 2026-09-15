import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AdminOrderService } from './admin-order.service';
import { AdminOrderSummary } from '../../_models/admin-order';
import { environment } from '../../../environments/environment';

const base = `${environment.apiUrl}admin/orders`;

describe('AdminOrderService', () => {
  let service: AdminOrderService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AdminOrderService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('search', () => {
    it('reads the page out of the body, not an X-Pagination header', () => {
      // The catalogue pages with a header; the order endpoints page in the
      // body. Running this through getPaginatedResult would type-check and
      // hand the board an empty list with no page count.
      let items: AdminOrderSummary[] = [];
      let total = 0;

      service.search({ page: 2 }).subscribe(result => {
        items = result.items;
        total = result.total;
      });

      const request = http.expectOne(r => r.url === base);

      expect(request.request.params.get('page')).toBe('2');
      expect(request.request.params.get('pageSize')).toBe('20');

      request.flush({
        isSuccess: true,
        data: { items: [{ id: 1, orderNumber: 'WH-2609-00042' }], total: 41, page: 2, pageSize: 20 }
      });

      expect(items.length).toBe(1);
      expect(total).toBe(41);
    });

    it('omits filters that are not set', () => {
      service.search({ status: null, term: '' }).subscribe();

      const request = http.expectOne(r => r.url === base);

      expect(request.request.params.has('status')).toBe(false);
      expect(request.request.params.has('term')).toBe(false);

      request.flush({ isSuccess: true, data: { items: [], total: 0, page: 1, pageSize: 20 } });
    });

    it('sends the status by name', () => {
      service.search({ status: 'ReadyToShip' }).subscribe();

      const request = http.expectOne(r => r.url === base);

      expect(request.request.params.get('status')).toBe('ReadyToShip');

      request.flush({ isSuccess: true, data: { items: [], total: 0, page: 1, pageSize: 20 } });
    });
  });

  it('asks for the invoice as bytes', () => {
    // A JSON parse of a PDF is the failure this guards. The endpoint answers
    // application/pdf, and HttpClient's default is to parse the body as JSON.
    service.invoice('WH-2609-00042').subscribe();

    const request = http.expectOne(`${base}/WH-2609-00042/invoice`);

    expect(request.request.responseType).toBe('blob');

    request.flush(new Blob(['%PDF-'], { type: 'application/pdf' }));
  });

  it('posts a move with its note', () => {
    service.changeStatus('WH-2609-00042', { status: 'Cancelled', note: 'Customer rang' }).subscribe();

    const request = http.expectOne(`${base}/WH-2609-00042/status`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ status: 'Cancelled', note: 'Customer rang' });

    request.flush({ isSuccess: true, data: {} });
  });
});
