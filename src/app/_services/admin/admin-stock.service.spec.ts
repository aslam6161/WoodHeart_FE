import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AdminStockService } from './admin-stock.service';
import { StockLevel, StockMovement } from '../../_models/inventory';
import { PagedResult } from '../../_models/pagination';
import { environment } from '../../../environments/environment';

const base = `${environment.apiUrl}admin/stock`;

describe('AdminStockService', () => {
  let service: AdminStockService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AdminStockService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the search term and the low-only flag, and pages in the body', () => {
    let result: PagedResult<StockLevel> | undefined;

    service.search({ term: 'bed', lowOnly: true, page: 2, pageSize: 25 }).subscribe(r => (result = r));

    const request = http.expectOne(r => r.url === base);

    expect(request.request.params.get('term')).toBe('bed');
    expect(request.request.params.get('lowOnly')).toBe('true');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('25');

    request.flush({
      isSuccess: true,
      data: { items: [{ variantId: 1, sku: 'WH-BED-001', available: 2, isLow: true }], total: 1, page: 2, pageSize: 25 }
    });

    expect(result?.total).toBe(1);
    expect(result?.items[0].isLow).toBe(true);
  });

  it('leaves lowOnly off the query when it is false', () => {
    // The API defaults it to false; sending "false" is noise in every log line.
    service.search({}).subscribe();

    const request = http.expectOne(r => r.url === base);

    expect(request.request.params.has('lowOnly')).toBe(false);
    expect(request.request.params.has('term')).toBe(false);

    request.flush({ isSuccess: true, data: { items: [], total: 0, page: 1, pageSize: 50 } });
  });

  it('reads the ledger newest first, as the API orders it', () => {
    let rows: StockMovement[] = [];

    service.movements(7).subscribe(r => (rows = r.items));

    http.expectOne(r => r.url === `${base}/7/movements`).flush({
      isSuccess: true,
      data: {
        items: [
          { id: 2, type: 'Sale', quantity: -1, onHandAfter: 9, performedBy: 'Rakib', occurredAt: '2026-09-21T10:00:00Z' },
          { id: 1, type: 'Purchase', quantity: 10, onHandAfter: 10, performedBy: 'Seed', occurredAt: '2026-09-20T10:00:00Z' }
        ],
        total: 2,
        page: 1,
        pageSize: 50
      }
    });

    expect(rows.map(r => r.type)).toEqual(['Sale', 'Purchase']);
  });

  it('posts a movement and hands back the level as it now stands', () => {
    let onHand: number | undefined;

    service
      .adjust(7, { type: 'Damage', quantity: 2, reason: 'Cracked in the godown' })
      .subscribe(response => (onHand = response.data?.onHand));

    const request = http.expectOne(`${base}/7/movements`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ type: 'Damage', quantity: 2, reason: 'Cracked in the godown' });

    request.flush({ isSuccess: true, data: { variantId: 7, onHand: 8, reserved: 0, available: 8 } });

    expect(onHand).toBe(8);
  });
});
