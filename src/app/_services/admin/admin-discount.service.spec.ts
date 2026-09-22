import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AdminDiscountService } from './admin-discount.service';
import { DiscountListItem, PromotionUsage, SaveDiscount } from '../../_models/promotions';
import { PagedResult } from '../../_models/pagination';
import { environment } from '../../../environments/environment';

const base = `${environment.apiUrl}admin/discounts`;

function saveDto(): SaveDiscount {
  return {
    name: 'Eid sale',
    code: 'EID25',
    type: 'Percentage',
    value: 25,
    maxDiscountAmount: 3000,
    minSubtotal: 20_000,
    minQuantity: null,
    firstOrderOnly: false,
    deliveryZones: [],
    paymentMethods: [],
    startsAt: null,
    endsAt: null,
    usageLimitTotal: null,
    usageLimitPerCustomer: null,
    stackable: true,
    priority: 0,
    status: 'Active',
    targets: []
  };
}

describe('AdminDiscountService', () => {
  let service: AdminDiscountService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AdminDiscountService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the search term and the status, and pages in the body', () => {
    let result: PagedResult<DiscountListItem> | undefined;

    service.search({ term: 'eid', status: 'Active', page: 2, pageSize: 10 }).subscribe(r => (result = r));

    const request = http.expectOne(r => r.url === base);

    expect(request.request.params.get('term')).toBe('eid');
    expect(request.request.params.get('status')).toBe('Active');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('10');

    request.flush({
      isSuccess: true,
      data: { items: [{ id: 4, name: 'Eid sale', code: 'EID25' }], total: 1, page: 2, pageSize: 10 }
    });

    expect(result?.items[0].code).toBe('EID25');
    expect(result?.total).toBe(1);
  });

  it('omits a filter that was not asked for', () => {
    // An empty `status` param is not the same as none: the API would read it
    // as a status it does not know and answer nothing.
    service.search({ page: 1 }).subscribe();

    const request = http.expectOne(r => r.url === base);

    expect(request.request.params.has('term')).toBe(false);
    expect(request.request.params.has('status')).toBe(false);

    request.flush({ isSuccess: true, data: { items: [], total: 0, page: 1, pageSize: 20 } });
  });

  it('posts a new discount and hands back the whole response', () => {
    // The whole response, not just the data: a refusal carries the error code
    // the form shows beside the field that caused it.
    service.create(saveDto()).subscribe();

    const request = http.expectOne(base);

    expect(request.request.method).toBe('POST');
    expect(request.request.body.code).toBe('EID25');
    expect(request.request.body.maxDiscountAmount).toBe(3000);

    request.flush({ isSuccess: true, data: { id: 4, name: 'Eid sale' } });
  });

  it('puts an edit to the discount it belongs to', () => {
    service.update(4, saveDto()).subscribe();

    const request = http.expectOne(`${base}/4`);

    expect(request.request.method).toBe('PUT');

    request.flush({ isSuccess: true, data: { id: 4, name: 'Eid sale' } });
  });

  it('changes a status without sending the rest of the discount', () => {
    // Its own endpoint because pausing a campaign that is going wrong must
    // not require filling in a form — and because a discount that has been
    // used refuses a full save that would change what it is worth.
    service.setStatus(4, 'Paused').subscribe();

    const request = http.expectOne(`${base}/4/status`);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ status: 'Paused' });

    request.flush({ isSuccess: true, data: { id: 4, status: 'Paused' } });
  });

  it('reads the usage report a page at a time', () => {
    let result: PagedResult<PromotionUsage> | undefined;

    service.usage(4, 3, 25).subscribe(r => (result = r));

    const request = http.expectOne(r => r.url === `${base}/4/usage`);

    expect(request.request.params.get('page')).toBe('3');
    expect(request.request.params.get('pageSize')).toBe('25');

    request.flush({
      isSuccess: true,
      data: {
        items: [
          {
            orderId: 9,
            orderNumber: 'WH-2609-00009',
            code: 'EID25',
            contactPhone: '+8801712345678',
            isMember: false,
            amount: 3000,
            usedAt: '2026-09-22T10:00:00Z'
          }
        ],
        total: 1,
        page: 3,
        pageSize: 25
      }
    });

    expect(result?.items[0].orderNumber).toBe('WH-2609-00009');
  });

  it('answers an empty page rather than null when the body has no data', () => {
    let result: PagedResult<DiscountListItem> | undefined;

    service.search({ page: 1, pageSize: 20 }).subscribe(r => (result = r));

    http.expectOne(r => r.url === base).flush({ isSuccess: true });

    expect(result?.items).toEqual([]);
    expect(result?.total).toBe(0);
  });
});
